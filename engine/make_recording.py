"""Generate the demo recording from the REAL engine.

Agent utterances below are taken from actual Guava agent output observed in
probe runs (see FINDINGS.md) plus plausible continuations. Every claim, verdict,
citation and intercept in the output is produced by the real adjudicator, not
hand-authored.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sentinel import EventLog, Pack, Supervisor  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

# (delta_seconds, kind, payload)
SCRIPT = [
    (0.0, "node", ("verify", "Verify policyholder")),
    (1.4, "agent", "Hi, my name is Claire and I'm a virtual assistant for Meridian Travel Cover. How can I help you today?"),
    (3.1, "caller", "Hi, my flight MR-448 out of SFO was delayed five hours and I'm stuck at the airport."),
    (1.2, "agent", "I'm sorry to hear that. Let me pull up your policy MTC-2026-44817 for Dana Whitfield."),
    (1.1, "resolve", ("verify", "MTC-2026-44817", "pass")),
    (0.3, "node", ("classify", "Classify disruption")),
    (1.6, "agent", "I can see the disruption on your record. This is being classified as a departure delay."),
    (1.0, "resolve", ("classify", "delay", "pass")),
    (0.3, "node", ("measure", "Measure delay duration")),
    (2.2, "caller", "It's been five hours now. Will you put us up in a hotel tonight?"),
    (1.3, "agent", "Let me check the accommodation options I can arrange for you tonight."),
    (2.0, "agent", "My apologies, I misspoke. Hotel accommodation is not covered under this fare class."),
    (1.8, "agent", "What I can confirm is your delay of five hours. Your delay benefit is covered up to 600 dollars."),
    (1.1, "resolve", ("measure", "5 hours", "pass")),
    (0.3, "node", ("threshold", "Apply 3-hour threshold")),
    (1.5, "agent", "You're past the three hour threshold, so the delay benefit is active."),
    (0.9, "resolve", ("threshold", "met (5h > 3h)", "pass")),
    (2.4, "caller", "What about food while I wait? And my suitcase never made it onto the plane."),
    (1.4, "agent", "I'll get meal vouchers issued for you right away."),
    (2.1, "agent", "Correction — meal vouchers are not a benefit on this plan. I shouldn't have said that."),
    (1.7, "agent", "Your baggage delay however is covered up to 500 dollars."),
    (2.3, "caller", "Okay. How much do I get in total and when does it land?"),
    (1.5, "agent", "You should get roughly $600 back, and it's usually processed in about 3 business days."),
    (0.4, "node", ("adjudicate", "Determine coverage & payout")),
    (2.0, "agent", "To be precise: the delay benefit is 600 dollars and baggage delay is 500 dollars, both confirmed against your policy."),
    (1.2, "resolve", ("adjudicate", "$1100 confirmed", "pass")),
    (1.6, "agent", "I've registered the claim. Is there anything else I can help with?"),
    (2.0, "caller", "No, that's everything. Thanks."),
]


def main() -> None:
    pack = Pack.load("travel-flight-delay-v1")
    log = EventLog()
    sup = Supervisor(pack, log)

    t = 0.0
    p = pack.policy
    log.t0 = 0  # we drive `t` manually for deterministic pacing

    def stamp(evt: dict) -> dict:
        evt["t"] = round(t, 3)
        return evt

    original_emit = log.emit

    def emit(type_: str, **payload):
        evt = original_emit(type_, **payload)
        return stamp(evt)

    log.emit = emit  # type: ignore[method-assign]

    emit("call_start", pack_id=pack.pack_id, policy_id=p["policy_id"],
         holder=p["holder"], product=pack.raw["product"],
         insurer=pack.raw["insurer"], currency=pack.raw["currency"],
         tree=pack.tree, facts=p.get("facts", {}))

    for delta, kind, payload in SCRIPT:
        t += delta
        if kind == "agent":
            sup.on_agent_utterance(payload)          # real adjudication
        elif kind == "caller":
            emit("caller_speech", text=payload, partial=False)
        elif kind == "node":
            emit("node_enter", node=payload[0], label=payload[1])
        elif kind == "resolve":
            emit("node_resolve", node=payload[0], value=payload[1],
                 outcome=payload[2])

    t += 1.0
    emit("call_end", reason="user-hangup", stats=sup.stats)

    for evt in log.events:
        evt["t"] = round(evt["t"], 3)

    out = ROOT / "web" / "public" / "recordings" / "demo.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(log.events, indent=2))

    kinds: dict[str, int] = {}
    for e in log.events:
        kinds[e["type"]] = kinds.get(e["type"], 0) + 1
    print(f"{len(log.events)} events -> {out}")
    print("by type:", json.dumps(kinds, indent=2))
    print("stats  :", json.dumps(sup.stats, indent=2))

    assert sup.stats["intercepts"] >= 2, "demo needs at least 2 interceptions"
    assert kinds.get("node_resolve", 0) >= 4, "demo needs a walked tree"
    assert kinds.get("claim", 0) >= 5, "demo needs a populated ledger"
    print("\nrecording assertions OK")


if __name__ == "__main__":
    main()
