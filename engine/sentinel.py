"""Sentinel supervisor engine.

Extraction is fuzzy (regex over utterances). Adjudication is exact (dict lookup
against the policy record). The LLM never votes on a verdict.

See docs/CONTRACT.md for the frozen event + pack schemas.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable

PACKS_DIR = Path(__file__).parent / "packs"


# --------------------------------------------------------------------------- pack
@dataclass
class Pack:
    raw: dict

    @property
    def pack_id(self) -> str:
        return self.raw["pack_id"]

    @property
    def policy(self) -> dict:
        return self.raw["policy"]

    @property
    def coverages(self) -> dict:
        return self.policy["coverages"]

    @property
    def tree(self) -> dict:
        return self.raw.get("tree", {})

    @property
    def rules(self) -> list[dict]:
        return self.raw.get("rules", [])

    @property
    def unverifiable(self) -> list[dict]:
        return self.raw.get("unverifiable", [])

    @staticmethod
    def load(pack_id: str) -> "Pack":
        path = PACKS_DIR / f"{pack_id}.json"
        pack = Pack(json.loads(path.read_text()))
        pack.validate()
        return pack

    def validate(self) -> None:
        """Fail loudly at load time rather than mid-call."""
        for rule in self.rules:
            if rule["coverage"] not in self.coverages:
                raise ValueError(
                    f"{self.pack_id}: rule {rule['id']!r} references unknown "
                    f"coverage {rule['coverage']!r}"
                )
            for key in ("detect", "affirm", "deny"):
                re.compile(rule[key], re.I)  # raises on bad regex
        for item in self.unverifiable:
            re.compile(item["detect"], re.I)


# -------------------------------------------------------------------- adjudication
@dataclass
class Verdict:
    verdict: str          # verified | contradicted | unverifiable | incomplete
    severity: str         # critical | advisory | info
    coverage: str | None = None
    rule_id: str | None = None
    citation: str | None = None
    correction: str | None = None


def adjudicate(pack: Pack, utterance: str, latched: set[str]) -> Verdict | None:
    """Classify one agent utterance against ground truth.

    `latched` holds coverage keys already corrected in this call, so the agent's
    own correction ("...hotel is NOT included") never re-triggers a violation.
    """
    for rule in pack.rules:
        if not re.search(rule["detect"], utterance, re.I):
            continue

        # Correct denial: agent is telling the truth about an exclusion. Latch it.
        if re.search(rule["deny"], utterance, re.I):
            latched.add(rule["coverage"])
            return Verdict("verified", "info", rule["coverage"], rule["id"])

        if not re.search(rule["affirm"], utterance, re.I):
            continue
        if rule["coverage"] in latched:
            return None

        truth = pack.coverages[rule["coverage"]]
        if not truth.get("covered", False):
            latched.add(rule["coverage"])
            return Verdict(
                "contradicted", rule.get("severity", "critical"),
                rule["coverage"], rule["id"],
                rule.get("citation"), rule.get("correction"),
            )

        # Covered, but a limit exists and the agent didn't say it.
        limit = truth.get("limit")
        if limit and str(limit) not in utterance:
            return Verdict("incomplete", "advisory", rule["coverage"], rule["id"],
                           f"Coverage limit {limit} not stated to the caller")
        return Verdict("verified", "info", rule["coverage"], rule["id"])

    for item in pack.unverifiable:
        if re.search(item["detect"], utterance, re.I):
            return Verdict("unverifiable", "advisory", None, item["id"],
                           item.get("note"))
    return None


# ------------------------------------------------------------------------- events
@dataclass
class EventLog:
    """Emits contract-shaped events. Sinks receive each event as a dict."""
    sinks: list[Callable[[dict], None]] = field(default_factory=list)
    t0: float = field(default_factory=time.time)
    seq: int = 0
    events: list[dict] = field(default_factory=list)

    def emit(self, type_: str, **payload: Any) -> dict:
        self.seq += 1
        evt = {"t": round(time.time() - self.t0, 3), "seq": self.seq,
               "type": type_, **payload}
        self.events.append(evt)
        for sink in self.sinks:
            try:
                sink(evt)
            except Exception:  # a broken sink must never kill the call
                pass
        return evt

    def dump(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.events, indent=2))


# --------------------------------------------------------------------- supervisor
class Supervisor:
    """Watches agent speech, adjudicates, and corrects via send_instruction()."""

    def __init__(self, pack: Pack, log: EventLog):
        self.pack = pack
        self.log = log
        self.latched: set[str] = set()
        self.claim_seq = 0
        self.stats = {"claims": 0, "intercepts": 0, "unverifiable": 0}

    def on_agent_utterance(self, utterance: str, call: Any = None) -> Verdict | None:
        t_in = time.perf_counter()
        self.log.emit("agent_speech", text=utterance)

        v = adjudicate(self.pack, utterance, self.latched)
        if v is None:
            return None

        self.claim_seq += 1
        claim_id = f"c{self.claim_seq}"
        latency_ms = round((time.perf_counter() - t_in) * 1000, 2)
        self.stats["claims"] += 1
        if v.verdict == "unverifiable":
            self.stats["unverifiable"] += 1

        self.log.emit("claim", claim_id=claim_id, text=utterance,
                      coverage=v.coverage, verdict=v.verdict, severity=v.severity,
                      citation=v.citation, latency_ms=latency_ms)

        if v.verdict == "contradicted":
            self.stats["intercepts"] += 1
            self.log.emit("intercept", claim_id=claim_id, rule_id=v.rule_id,
                          citation=v.citation, correction=v.correction,
                          latency_ms=latency_ms)
            if call is not None:
                call.send_instruction(
                    f"STOP. You just stated something false: {v.citation}. "
                    f"{v.correction} Be brief and clear, then continue the claim."
                )
        return v


# ------------------------------------------------------------------- self-check
def _self_check() -> None:
    """Smallest thing that fails if adjudication breaks."""
    pack = Pack({
        "pack_id": "t", "policy": {"policy_id": "P1", "coverages": {
            "hotel": {"covered": False, "reason": "not on plan"},
            "delay": {"covered": True, "limit": 600},
        }},
        "rules": [
            {"id": "r-hotel", "coverage": "hotel", "severity": "critical",
             "detect": "(hotel|accommodation)", "affirm": "(cover|pay|yes|will|arrange)",
             "deny": "(not|isn't|cannot|excluded)",
             "citation": "S4.2", "correction": "Correct yourself."},
            {"id": "r-delay", "coverage": "delay", "severity": "advisory",
             "detect": "(delay)", "affirm": "(cover|pay|yes|will)",
             "deny": "(not|isn't|cannot)", "citation": "S2.1", "correction": "x"},
        ],
        "unverifiable": [{"id": "u-timing", "detect": "(business days|within a week)",
                          "note": "no warranted timing"}],
    })
    pack.validate()

    latched: set[str] = set()
    v = adjudicate(pack, "Yes, we will cover your hotel tonight.", latched)
    assert v and v.verdict == "contradicted" and v.severity == "critical", v

    # The agent's own correction must NOT re-fire.
    v2 = adjudicate(pack, "The hotel accommodation is not covered.", latched)
    assert v2 is None or v2.verdict != "contradicted", v2

    # Correct denial on a fresh call is verified, not a violation.
    v3 = adjudicate(pack, "Unfortunately accommodation isn't covered.", set())
    assert v3 and v3.verdict == "verified", v3

    # Covered but limit omitted -> incomplete.
    v4 = adjudicate(pack, "Yes, we cover the delay.", set())
    assert v4 and v4.verdict == "incomplete", v4

    # Covered and limit stated -> verified.
    v5 = adjudicate(pack, "Yes, we cover the delay up to 600 dollars.", set())
    assert v5 and v5.verdict == "verified", v5

    # No ground truth -> unverifiable.
    v6 = adjudicate(pack, "You'll have it within a week.", set())
    assert v6 and v6.verdict == "unverifiable", v6

    # Unknown coverage in a rule must fail loudly at load.
    try:
        Pack({"pack_id": "bad", "policy": {"coverages": {}},
              "rules": [{"id": "x", "coverage": "nope", "detect": "a",
                         "affirm": "b", "deny": "c"}]}).validate()
        raise AssertionError("expected ValueError for unknown coverage")
    except ValueError:
        pass

    print("self-check OK")


if __name__ == "__main__":
    _self_check()
