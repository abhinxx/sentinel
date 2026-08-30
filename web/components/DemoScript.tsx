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
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  return (
    <div className="rounded-[10px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,.05)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
          What to say on the call
        </span>
        <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10.5px] font-medium text-[#4f46e5]">
          {SCRIPT.length} prompts
        </span>
        <span className="ml-auto text-[11px] text-[#98a2b3]">
          {open ? "Hide" : "Show"}
        </span>
      </button>

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
