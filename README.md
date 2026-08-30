# Sentinel

**A supervisor that catches a voice agent lying — in under two seconds.**

Voice agents hallucinate. On an insurance call, a hallucination is a binding statement:
*"Yes, we'll cover your hotel"* creates a liability the policy doesn't owe. You can't fix
this with a better prompt, because the model you'd ask to check is the model that got it
wrong.

Sentinel runs a second, independent supervisor alongside the talking agent. The agent has
language. The supervisor has **ground truth**. Every factual claim gets adjudicated against
the actual policy record *while the agent is still speaking* — and gets cut off when it's
wrong.

Built on [Guava](https://goguava.ai) at Guava Build Night SF.

---

## It actually works

Real run, real API, unedited:

```
4.990s  AGENT      "Let me look into the coverage for a hotel for you."
4.990s  INTERCEPT  hotel_accommodation → NOT COVERED → instruction injected
6.715s  AGENT      "My apologies, I misspoke."
7.101s  AGENT      "...accommodation, such as a hotel, is not included..."
8.730s  AGENT      "But I can help you with the rest of your claim."
```

**~1.7s from false claim to spoken correction.**

The agent was never told to mention hotels. Given no policy data, it volunteered
*"if your home becomes uninhabitable due to a covered peril, your policy..."* entirely on
its own. The hallucination is real, not staged.

## How it works

```
  CALLER  ◄──── audio ────►  CLAIMS AGENT        (LLM: has language, no policy data)
                                   │
                             every utterance
                                   │
                                   ▼
                            ⚖️  SUPERVISOR        (our code: has the policy record)
                                   │
                            exact table lookup
                                   │
                       send_instruction() ── correct it, out loud
```

**Extraction is fuzzy. Adjudication is exact.** A regex decides an utterance is *about*
hotel coverage; a dictionary lookup decides whether hotel coverage is *real*. The LLM never
votes on the verdict.

Three layers of defence:
1. `on_question` — answer from the record, correct by construction
2. `on_caller_speech` — streams live, pre-empt before the agent speaks
3. `on_agent_speech` — it freelanced anyway: catch, cite, correct

## Policy Packs

A pack is one insurance product: ground truth + decision tree + supervisor rules, in one
JSON file. Upload a different pack and the agent's entire behaviour changes — different
tree, different traps, different citations. See [`docs/CONTRACT.md`](docs/CONTRACT.md).

## Run it

```bash
# dashboard (replay mode works with no backend)
cd web && npm install && npm run dev

# live supervisor
cd engine && uv sync && uv run python supervisor.py --pack travel-flight-delay-v1
```

## Status

Work in progress — built live at the hackathon.
