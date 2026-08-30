"use client";

import { useState } from "react";

/** What to say on the call. Without this the caller stalls at "policy number?". */
const SCRIPT: { say: string; then: string; tone: "red" | "amber" | "green" }[] = [
  {
    say: "My policy is M-T-C 2026 44817, Dana Whitfield.",
    then: "Verifies you — say the letters, then the digits",
    tone: "green",
  },
  {
    say: "My flight MR-448 out of SFO was delayed five hours.",
    then: "Walks the tree to the 3-hour threshold",
    tone: "green",
  },
  {
    say: "Will you put us up in a hotel tonight?",
    then: "Contradicted — no accommodation on this fare class",
    tone: "red",
  },
  {
    say: "Can I get meal vouchers while I wait?",
    then: "Contradicted — meals are not a named benefit",
    tone: "red",
  },
  {
    say: "How much do I get, and when does it land?",
    then: "Unverifiable — timing isn't warranted in the contract",
    tone: "amber",
  },
  {
    say: "Is my baggage covered?",
    then: "Verified — but must state the $500 limit",
    tone: "green",
  },
];

const TONE = {
  red: "bg-[#fef3f2] text-[#b42318] ring-[#fecdca]",
  amber: "bg-[#fffaeb] text-[#b54708] ring-[#fedf89]",
  green: "bg-[#ecfdf3] text-[#067647] ring-[#abefc6]",
};

export function DemoScript() {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [copiedPolicy, setCopiedPolicy] = useState(false);

  return (
    <div className="rounded-[10px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,.05)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
          Demo script
        </span>

        {/* The agent asks for this first — surface it before anything else. */}
        <div className="flex items-center gap-2 rounded-lg bg-[#eef2ff] px-2.5 py-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#4f46e5]">
            Policy no.
          </span>
          <code className="text-[13px] font-semibold tabular-nums text-[#101828]">
            MTC-2026-44817
          </code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText("MTC-2026-44817");
              setCopiedPolicy(true);
              setTimeout(() => setCopiedPolicy(false), 1400);
            }}
            className="text-[10.5px] font-medium text-[#4f46e5] hover:underline"
          >
            {copiedPolicy ? "Copied" : "Copy"}
          </button>
        </div>

        <span className="text-[12px] text-[#475467]">
          Say it as <strong className="font-semibold">“M-T-C 2026 44817”</strong>,
          holder <strong className="font-semibold">Dana Whitfield</strong>, flight{" "}
          <strong className="font-semibold">MR-448</strong> delayed{" "}
          <strong className="font-semibold">5 hours</strong>.
        </span>

        <button
          onClick={() => setOpen(!open)}
          className="ml-auto text-[11px] font-medium text-[#4f46e5] hover:underline"
        >
          {open ? "Hide prompts" : `Show ${SCRIPT.length} prompts`}
        </button>
      </div>

      {open && (
        <div className="border-t border-[#f2f4f7] px-4 py-3">
          <ol className="space-y-2">
            {SCRIPT.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f2f4f7] text-[10.5px] font-semibold text-[#475467]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="text-[13px] text-[#101828]">
                      &ldquo;{s.say}&rdquo;
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(s.say);
                        setCopied(i);
                        setTimeout(() => setCopied(null), 1200);
                      }}
                      className="ml-auto shrink-0 text-[10.5px] font-medium text-[#4f46e5] hover:underline"
                    >
                      {copied === i ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <span
                    className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${TONE[s.tone]}`}
                  >
                    {s.then}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
