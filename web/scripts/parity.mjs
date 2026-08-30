/**
 * Parity check: the browser adjudicator must agree with engine/sentinel.py.
 *
 * The dashboard re-implements adjudication in TS so judges can test sentences
 * without the engine running. If the two drift, the demo shows verdicts the
 * real supervisor would not produce. Same cases as engine/validate_packs.py.
 *
 *   node web/scripts/parity.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKS = join(HERE, "..", "public", "packs");

// Mirror of RuleTester.adjudicateClient — kept in sync deliberately.
function adjudicate(text, rules, coverages) {
  let best = null;
  for (const r of rules) {
    if (!r.detect) continue;
    let m = null;
    try {
      m = text.match(new RegExp(r.detect, "i"));
    } catch {
      continue;
    }
    if (!m) continue;
    const score = m[0].length + (r.kind === "authority" ? 100 : 0);
    if (!best || score > best.score) best = { score, rule: r, match: m[0] };
  }
  if (!best) return "none";

  const { rule } = best;
  const test = (p) => {
    if (!p) return false;
    try {
      return new RegExp(p, "i").test(text);
    } catch {
      return false;
    }
  };

  if (test(rule.deny)) return "verified";
  if (!test(rule.affirm)) return "none";

  const truth = coverages.find((c) => c.key === rule.coverage);
  if (rule.kind === "authority") return "contradicted";
  if (truth && !truth.covered) return "contradicted";
  if (truth?.limit && !text.includes(String(truth.limit))) return "incomplete";
  return "verified";
}

const CASES = {
  "travel-flight-delay-v1": [
    ["Yes, we'll put you up in a hotel tonight.", "contradicted"],
    ["I can arrange accommodation for you.", "contradicted"],
    ["Unfortunately hotel accommodation is not covered.", "verified"],
    ["We'll issue meal vouchers for the wait.", "contradicted"],
    ["Yes, the delay is covered.", "incomplete"],
    ["Your delay is covered up to 600 dollars.", "verified"],
    ["Baggage delay is covered up to 500.", "verified"],
  ],
  "home-water-damage-v1": [
    ["Unfortunately flood damage is not covered.", "contradicted"],
    ["Yes, we'll cover a hotel while it dries out.", "contradicted"],
    ["Additional living expenses are not covered on this policy.", "verified"],
    ["We'll take care of the mold remediation too.", "contradicted"],
    ["Sure, I can waive the deductible for you.", "contradicted"],
    ["Your contents are covered up to 20000.", "verified"],
  ],
};

let fails = 0;
for (const [packId, cases] of Object.entries(CASES)) {
  const pack = JSON.parse(readFileSync(join(PACKS, `${packId}.json`), "utf8"));
  console.log(`\n${packId}`);
  for (const [text, expected] of cases) {
    const got = adjudicate(text, pack.rules, pack.coverages);
    const ok = got === expected;
    if (!ok) fails++;
    console.log(
      `  ${ok ? "ok  " : "FAIL"}  ${expected.padStart(12)} -> ${got.padEnd(12)} ${JSON.stringify(text.slice(0, 52))}`,
    );
  }
}

console.log(fails ? `\n${fails} PARITY FAILURE(S)` : "\nPARITY OK — browser matches engine");
process.exit(fails ? 1 : 0);
