"""Export engine packs into the shape the dashboard expects.

The engine's native pack nests ground truth under policy.coverages as an OBJECT
(keyed lookup is the whole point of exact adjudication). The UI wants flat
ARRAYS it can render as tables. This adapts one to the other so the deployed
site needs no backend.

Run after editing any pack:
    uv run python export_packs_web.py
"""
import json
from pathlib import Path

ENGINE = Path(__file__).parent / "packs"
WEB = Path(__file__).resolve().parents[1] / "web" / "public" / "packs"


def to_web(raw: dict) -> dict:
    policy = raw["policy"]
    currency = raw.get("currency", "USD")

    coverages = [
        {
            "key": key,
            "covered": bool(c.get("covered")),
            "limit": c.get("limit"),
            "currency": currency,
            "reason": c.get("reason") or c.get("note"),
        }
        for key, c in policy["coverages"].items()
    ]

    rules = [
        {
            "rule_id": r["id"],
            "coverage": r.get("coverage"),
            "severity": r.get("severity", "info"),
            "citation": r.get("citation"),
            # The dashboard re-runs adjudication client-side so judges can test
            # arbitrary sentences, so the patterns ship with the pack.
            "detect": r.get("detect"),
            "affirm": r.get("affirm"),
            "deny": r.get("deny"),
            "kind": r.get("kind"),
        }
        for r in raw.get("rules", [])
    ]

    unverifiable = [
        {"id": u["id"], "note": u.get("note")} for u in raw.get("unverifiable", [])
    ]

    return {
        "pack_id": raw["pack_id"],
        "product": raw["product"],
        "insurer": raw["insurer"],
        "policy_id": policy["policy_id"],
        "holder": policy.get("holder"),
        "currency": currency,
        "coverages_count": len(coverages),
        "rules_count": len(rules),
        "coverages": coverages,
        "rules": rules,
        "unverifiable": unverifiable,
    }


def main() -> None:
    WEB.mkdir(parents=True, exist_ok=True)
    index = []
    for src in sorted(ENGINE.glob("*.json")):
        web = to_web(json.loads(src.read_text()))
        (WEB / f"{web['pack_id']}.json").write_text(json.dumps(web, indent=2))
        index.append({k: web[k] for k in (
            "pack_id", "product", "insurer", "policy_id", "holder",
            "currency", "coverages_count", "rules_count")})
        print(f"{src.name} -> {web['pack_id']}.json  "
              f"({web['coverages_count']} coverages, {web['rules_count']} rules)")

    (WEB / "index.json").write_text(json.dumps(index, indent=2))
    print(f"index.json -> {len(index)} packs")

    # The UI renders these as tables; a shape regression silently degrades to
    # the hardcoded sample, so assert the contract here.
    for entry in index:
        pack = json.loads((WEB / f"{entry['pack_id']}.json").read_text())
        assert isinstance(pack["coverages"], list) and pack["coverages"], entry
        assert isinstance(pack["rules"], list) and pack["rules"], entry
        assert all("key" in c and "covered" in c for c in pack["coverages"])
        assert all("rule_id" in r for r in pack["rules"])
    print("shape assertions OK")


if __name__ == "__main__":
    main()
