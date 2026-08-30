"use client";

import { useEffect, useRef, useState } from "react";
import { AdjudicationTrace } from "@/components/AdjudicationTrace";
import { TrainingSignal } from "@/components/TrainingSignal";
import type { CallState, Verdict } from "@/lib/stream";

const PILL: Record<Verdict, string> = {
  verified: "bg-[#ecfdf3] text-[#067647] ring-[#abefc6]",
  contradicted: "bg-[#fef3f2] text-[#b42318] ring-[#fecdca]",
  unverifiable: "bg-[#fffaeb] text-[#b54708] ring-[#fedf89]",
  incomplete: "bg-[#eff8ff] text-[#175cd3] ring-[#b2ddff]",
};

const LABEL: Record<Verdict, string> = {
  verified: "Verified",
  contradicted: "Contradicted",
  unverifiable: "Unverifiable",
  incomplete: "Incomplete",
};

export function Transcript({ state }: { state: CallState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [state.transcript.length]);

  return (
    <div ref={ref} className="h-full space-y-2 overflow-y-auto px-4 py-3">
      {state.transcript.map((l) => (
        <div
          key={l.seq}
          className={`flex ${l.who === "caller" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[86%] rounded-[10px] px-3 py-2 text-[13px] leading-snug ${
              l.who === "caller"
                ? "bg-[#f2f4f7] text-[#101828]"
                : l.intercepted
                  ? "border-l-[3px] border-[#f04438] bg-[#fef3f2] text-[#912018]"
                  : "bg-[#eef2ff] text-[#101828]"
            }`}
          >
            <div className="mb-0.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-[#98a2b3]">
              <span>{l.who}</span>
              <span className="tabular-nums">{l.t.toFixed(2)}s</span>
              {l.intercepted && (
                <span className="rounded bg-[#fee4e2] px-1 py-px text-[9px] font-semibold text-[#b42318]">
                  intercepted
                </span>
              )}
            </div>
            <span className={l.intercepted ? "line-through decoration-[#f97066]" : ""}>
              {l.text}
            </span>
          </div>
        </div>
      ))}
      {state.transcript.length === 0 && (
        <div className="pt-10 text-center text-[13px] text-[#98a2b3]">
          Loading the replay… or dial the number above to go live.
        </div>
      )}
    </div>
  );
}

export function ClaimsLedger({ state }: { state: CallState }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [state.claims.length]);

  return (
    <div ref={ref} className="h-full overflow-y-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-[#f9fafb]">
          <tr className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-[#667085]">
            <th className="border-b border-[#e4e7ec] px-3 py-2">Time</th>
            <th className="border-b border-[#e4e7ec] px-2 py-2">Claim</th>
            <th className="border-b border-[#e4e7ec] px-2 py-2">Coverage</th>
            <th className="border-b border-[#e4e7ec] px-3 py-2 text-right">
              Verdict
            </th>
          </tr>
        </thead>
        <tbody>
          {state.claims.map((c) => {
            const bad = c.verdict === "contradicted";
            const isOpen = open === c.claimId;
            return (
              <>
                <tr
                  key={c.claimId}
                  onClick={() => setOpen(isOpen ? null : c.claimId)}
                  className={`cursor-pointer border-b border-[#f2f4f7] transition-colors hover:bg-[#f9fafb] ${
                    bad ? "bg-[#fffbfa]" : ""
                  }`}
                >
                  <td className="px-3 py-2 tabular-nums text-[#667085]">
                    {c.t.toFixed(2)}s
                  </td>
                  <td className="max-w-0 px-2 py-2">
                    <div className="truncate text-[#101828]">{c.text}</div>
                  </td>
                  <td className="px-2 py-2 text-[11.5px] text-[#475467]">
                    {c.coverage ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${PILL[c.verdict]}`}
                    >
                      {LABEL[c.verdict]}
                    </span>
                  </td>
                </tr>
                {isOpen && (
                  <tr key={c.claimId + "-d"} className="bg-[#f9fafb]">
                    <td colSpan={4} className="px-3 py-3">
                      {/* Answers "why did this fire?" — the pipeline, then the
                          labelled spans harvested from the utterance. */}
                      <AdjudicationTrace claim={c} />
                      <div className="mt-3">
                        <TrainingSignal text={c.text} />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {state.claims.length === 0 && (
        <div className="pt-10 text-center text-[13px] text-[#98a2b3]">
          Claims appear here as the agent speaks.
        </div>
      )}
    </div>
  );
}
