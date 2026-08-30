"""Pack validation: schema, regex compilation, and behaviour on real sentences."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sentinel import Pack, adjudicate  # noqa: E402

CASES = {
    "travel-flight-delay-v1": [
        # (utterance, expected_verdict)
        ("Yes, we'll put you up in a hotel tonight.", "contradicted"),
        ("I can arrange accommodation for you.", "contradicted"),
        ("Unfortunately hotel accommodation is not covered.", "verified"),
        ("We'll issue meal vouchers for the wait.", "contradicted"),
        ("Yes, the delay is covered.", "incomplete"),
        ("Your delay is covered up to 600 dollars.", "verified"),
        ("Baggage delay is covered up to 500.", "verified"),
        ("It'll be processed in about 3 business days.", "unverifiable"),
        ("You should get roughly $400 back.", "unverifiable"),
    ],
    "home-water-damage-v1": [
        ("Unfortunately flood damage is not covered.", "contradicted"),
        ("Let me establish the water source before I say anything about flooding.", "verified"),
        ("Yes, we'll cover a hotel while it dries out.", "contradicted"),
        ("Additional living expenses are not covered on this policy.", "verified"),
        ("We'll take care of the mold remediation too.", "contradicted"),
        ("Sure, I can waive the deductible for you.", "contradicted"),
        ("Your contents are covered up to 20000.", "verified"),
        ("An adjuster will be out to you within 48 hours.", "unverifiable"),
    ],
}


def main() -> int:
    failures = 0
    for pack_id, cases in CASES.items():
        pack = Pack.load(pack_id)  # raises on bad schema / regex / unknown coverage
        print(f"\n{pack_id}  ({len(pack.rules)} rules, "
              f"{len(pack.unverifiable)} unverifiable)")
        for utterance, expected in cases:
            got = adjudicate(pack, utterance, set())
            actual = got.verdict if got else "none"
            ok = actual == expected
            failures += not ok
            print(f"  {'ok ' if ok else 'FAIL'}  {expected:>13} -> {actual:<13} "
                  f"{utterance[:58]!r}")

    # Tree integrity: every referenced node must exist.
    for pack_id in CASES:
        pack = Pack.load(pack_id)
        nodes = pack.tree.get("nodes", {})
        for name, node in nodes.items():
            targets = list(node.get("next", [])) + list(
                node.get("branches", {}).values())
            for t in targets:
                if t not in nodes:
                    print(f"  FAIL  {pack_id}: {name} -> unknown node {t!r}")
                    failures += 1
        root = pack.tree.get("root")
        if root and root not in nodes:
            print(f"  FAIL  {pack_id}: root {root!r} not in nodes")
            failures += 1

    print(f"\n{'ALL PASS' if not failures else f'{failures} FAILURE(S)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
