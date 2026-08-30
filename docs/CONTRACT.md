# FROZEN CONTRACT v1 — do not change without updating every consumer

Two artifacts cross the Python/TypeScript boundary:
1. **Policy Pack** (input)  — authored by the user, uploaded in the dashboard
2. **Event stream** (output) — emitted by the engine, rendered by the dashboard

---

## 1. Policy Pack (`engine/packs/*.json`)

A pack = one insurance product. It carries ground truth AND the decision tree AND
the supervisor rules. Uploading a different pack changes the whole agent's behaviour.

```jsonc
{
  "pack_id": "travel-flight-delay-v1",
  "product": "Flight Delay & Trip Disruption",
  "insurer": "Meridian Travel Cover",
  "currency": "USD",

  // GROUND TRUTH. Adjudication is an EXACT lookup here. No LLM ever votes.
  "policy": {
    "policy_id": "MTC-2026-44817",
    "holder": "Dana Whitfield",
    "status": "active",
    "deductible": 0,
    "coverages": {
      "delay_over_3h":   { "covered": true,  "limit": 600, "note": "USD 200/hr after 3h" },
      "missed_connection": { "covered": true, "limit": 1500 },
      "hotel_accommodation": { "covered": false, "reason": "Not on this fare class" },
      "baggage_delay":   { "covered": true,  "limit": 500 }
    },
    "facts": { "flight": "MR-448", "delay_hours": 5 }   // free-form, quoted verbatim
  },

  // DECISION TREE. Rendered as the canvas. Walked by the agent.
  "tree": {
    "root": "verify",
    "nodes": {
      "verify":  { "label": "Verify policyholder", "field": "policy_id", "next": ["classify"] },
      "classify":{ "label": "Classify disruption", "field": "disruption_type",
                   "branches": { "delay": "measure", "cancellation": "measure" } },
      "measure": { "label": "Measure delay", "field": "delay_hours", "next": ["adjudicate"] },
      "adjudicate": { "label": "Determine coverage", "terminal": true }
    }
  },

  // SUPERVISOR RULES. detect+affirm => look up `coverage` in policy.coverages.
  "rules": [
    {
      "id": "ale-hallucination",
      "coverage": "hotel_accommodation",
      "severity": "critical",
      "detect": "(hotel|accommodation|room for the night|put you up)",
      "affirm": "(cover|pay|yes|will|can|entitled|reimburse|arrange|book)",
      "deny":   "(not|isn't|is not|no |unable|cannot|can't|excluded|doesn't)",
      "citation": "Policy MTC-2026-44817 §4.2 — no accommodation benefit on this fare class",
      "correction": "Accommodation is NOT covered on this policy. Correct yourself now."
    }
  ],

  // Claims with no ground truth => flagged UNVERIFIABLE, never auto-corrected.
  "unverifiable": [
    { "id": "payout-timing", "detect": "(within|takes about|business days|processed in)",
      "note": "Settlement timing is not warranted in the contract" }
  ]
}
```

### Rule semantics (exact, so both sides agree)
- `detect` matches → the utterance is ABOUT this coverage
- `deny` matches   → agent is correctly denying → **NO violation**, and latch the claim
- `affirm` matches AND coverage.covered == false → **VIOLATION (critical)**
- `affirm` matches AND coverage.covered == true  → **OK**, but if `limit` exists and the
  utterance omits it → **advisory** ("stated coverage without stating the limit")
- All regex are case-insensitive, matched against a single agent utterance
- **Latch**: once a rule fires for a coverage, it will not fire again for that coverage
  in the same call (prevents re-firing on the agent's own correction)

---

## 2. Event stream

Newline-delimited JSON. Live: SSE at `GET /events`. Replay: a JSON array in
`recordings/*.json`. **Identical shape either way** — the UI cannot tell them apart.

```jsonc
{ "t": 4.990,              // seconds since call start, float
  "seq": 12,               // monotonic
  "type": "...",           // see below
  ... }
```

| `type` | payload | UI effect |
|---|---|---|
| `call_start`   | `pack_id`, `policy_id`, `holder` | header populates |
| `agent_speech` | `text` | transcript line (left) |
| `caller_speech`| `text`, `partial:bool` | transcript line (right) |
| `node_enter`   | `node`, `label` | canvas node → active |
| `node_resolve` | `node`, `value`, `outcome:"pass"\|"fail"` | node → resolved, edge drawn |
| `claim`        | `claim_id`, `text`, `coverage`, `verdict`, `severity`, `citation`, `latency_ms` | ledger row |
| `intercept`    | `claim_id`, `rule_id`, `citation`, `correction`, `latency_ms` | RED FLASH + node snap |
| `correction`   | `claim_id`, `text` | ledger row resolves green |
| `call_end`     | `reason`, `stats{claims,intercepts,unverifiable}` | summary panel |

`verdict` ∈ `"verified"` | `"contradicted"` | `"unverifiable"` | `"incomplete"`
`severity` ∈ `"critical"` | `"advisory"` | `"info"`

### Invariants
- `seq` strictly increasing; UI sorts by `seq`, never by `t`
- every `intercept` has a preceding `claim` with the same `claim_id`
- `t` is authoritative for replay pacing
