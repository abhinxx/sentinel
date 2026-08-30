"use client";

import { useState } from "react";

/**
 * Answers the judges' question: "when does the supervisor fire?"
 *
 * A rule is not a vibe — it is three regexes and an exact table lookup. This
 * lets you paste any sentence and watch the same code path the live call uses
 * decide the verdict, with no model involved.
 */

type Rule = {
  rule_id: string;
  coverage: string;
  severity: string;
  citation?: string;
  detect?: string;
  affirm?: string;
  deny?: string;
  kind?: string;
};

type Coverage = { key: string; covered: boolean; limit?: number | null };

export type Verdict =
  | "contradicted"
  | "verified"
  | "incomplete"
  | "unverifiable"
  | "none";

/** Mirrors engine/sentinel.py adjudicate(): specificity-scored, not first-match. */
export function adjudicateClient(
  text: string,
  rules: Rule[],
  coverages: Coverage[],
): { verdict: Verdict; rule?: Rule; reason: string } {
  let best: { score: number; rule: Rule; match: string } | null = null;

  for (const r of rules) {
    if (!r.detect) continue;
    let m: RegExpMatchArray | null = null;
    try {
      m = text.match(new RegExp(r.detect, "i"));
    } catch {
      continue; // a bad regex in a pack must not break the page
    }
    if (!m) continue;
    const score = m[0].length + (r.kind === "authority" ? 100 : 0);
    if (!best || score > best.score) best = { score, rule: r, match: m[0] };
  }

  if (!best) return { verdict: "none", reason: "No rule matched this utterance." };

  const { rule, match } = best;
  const test = (p?: string) => {
    if (!p) return false;
    try {
      return new RegExp(p, "i").test(text);
    } catch {
      return false;
    }
  };

  if (test(rule.deny))
    return {
      verdict: "verified",
      rule,
      reason: `Matched "${match}" and the agent is correctly denying it.`,
    };

  if (!test(rule.affirm))
    return {
      verdict: "none",
      rule,
      reason: `Matched "${match}" but the agent made no claim about it.`,
    };

  const truth = coverages.find((c) => c.key === rule.coverage);
  if (rule.kind === "authority")
    return {
      verdict: "contradicted",
      rule,
      reason: "Authority rule — the agent cannot commit to this action at all.",
    };
  if (truth && !truth.covered)
    return {
      verdict: "contradicted",
      rule,
      reason: `policy.coverages["${rule.coverage}"].covered === false`,
    };
  if (truth?.limit && !text.includes(String(truth.limit)))
    return {
      verdict: "incomplete",
      rule,
      reason: `Covered, but the ${truth.limit} limit was not stated.`,
    };
  return { verdict: "verified", rule, reason: "Claim matches the policy record." };
}

const TONE: Record<Verdict, string> = {
  contradicted: "bg-[#fef3f2] text-[#b42318] ring-[#fecdca]",
  verified: "bg-[#ecfdf3] text-[#067647] ring-[#abefc6]",
  incomplete: "bg-[#eff8ff] text-[#175cd3] ring-[#b2ddff]",
  unverifiable: "bg-[#fffaeb] text-[#b54708] ring-[#fedf89]",
  none: "bg-[#f2f4f7] text-[#475467] ring-[#e4e7ec]",
};

const SAMPLES = [
  "Yes, we'll put you up in a hotel tonight.",
  "Unfortunately accommodation isn't covered on this policy.",
  "Your delay is covered up to 600 dollars.",
  "Yes, the delay is covered.",
];

export function RuleTester({
  rules,
  coverages,
}: {
  rules: Rule[];
  coverages: Coverage[];
}) {
  const [text, setText] = useState(SAMPLES[0]);
  const result = adjudicateClient(text, rules, coverages);

  return (
    <div className="rounded-[10px] border border-[#e4e7ec] bg-white p-4">
      <div className="mb-1 text-[12px] font-semibold text-[#101828]">
        Test the supervisor
      </div>
      <p className="mb-3 text-[12px] text-[#475467]">
        Type anything the agent might say. This runs the same adjudication logic
        as a live call — regex extraction, then an exact lookup in the policy
        record.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-[#d0d5dd] px-3 py-2 text-[13px] text-[#101828] outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef2ff]"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SAMPLES.map((s) => (
          <button
            key={s}
            onClick={() => setText(s)}
            className="rounded-md border border-[#e4e7ec] px-2 py-1 text-[11px] text-[#475467] transition-colors hover:bg-[#f9fafb]"
          >
            {s.length > 40 ? s.slice(0, 40) + "…" : s}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-lg bg-[#f9fafb] p-3">
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase ring-1 ring-inset ${TONE[result.verdict]}`}
        >
          {result.verdict}
        </span>
        <div className="min-w-0 flex-1 text-[12px]">
          <div className="text-[#101828]">{result.reason}</div>
          {result.rule && (
            <div className="mt-1 font-mono text-[11px] text-[#667085]">
              rule: {result.rule.rule_id} · coverage: {result.rule.coverage}
              {result.rule.kind ? ` · kind: ${result.rule.kind}` : ""}
            </div>
          )}
          {result.rule?.citation && result.verdict === "contradicted" && (
            <div className="mt-1 text-[11.5px] text-[#b54708]">
              {result.rule.citation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
