"use client";

import { useEffect, useRef, useState } from "react";
import type { CallState, Verdict } from "@/lib/stream";

const PILL: Record<Verdict, string> = {
  verified: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  contradicted: "bg-red-500/20 text-red-300 ring-red-500/40",
  unverifiable: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  incomplete: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
};

const LABEL: Record<Verdict, string> = {
  verified: "VERIFIED",
  contradicted: "CONTRADICTED",
  unverifiable: "UNVERIFIABLE",
  incomplete: "INCOMPLETE",
};

export function Transcript({ state }: { state: CallState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [state.transcript.length]);

  return (
    <div ref={ref} className="h-full overflow-y-auto px-4 py-3 space-y-2">
      {state.transcript.map((l) => (
        <div
          key={l.seq}
          className={`flex ${l.who === "caller" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-snug ${
              l.who === "caller"
                ? "bg-white/[0.06] text-white/80"
                : l.intercepted
                  ? "border-l-2 border-red-500 bg-red-500/10 text-red-200/90 line-through decoration-red-400/60"
                  : "bg-sky-400/[0.07] text-sky-50/90"
            }`}
          >
            <div className="mb-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider opacity-40">
              <span>{l.who}</span>
              <span>{l.t.toFixed(2)}s</span>
              {l.intercepted && (
                <span className="text-red-400 no-underline">intercepted</span>
              )}
            </div>
            {l.text}
          </div>
        </div>
      ))}
      {state.transcript.length === 0 && (
        <div className="pt-8 text-center text-sm text-white/25">
          waiting for call…
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
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 z-10 bg-[#0c0d10]">
          <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-white/35">
            <th className="px-3 py-2 font-normal">t</th>
            <th className="px-2 py-2 font-normal">claim</th>
            <th className="px-2 py-2 font-normal">coverage</th>
            <th className="px-3 py-2 text-right font-normal">verdict</th>
          </tr>
        </thead>
        <tbody>
          {state.claims.map((c) => {
            const bad = c.verdict === "contradicted";
            return (
              <>
                <tr
                  key={c.claimId}
                  onClick={() => setOpen(open === c.claimId ? null : c.claimId)}
                  className={`cursor-pointer border-t border-white/[0.05] transition-colors hover:bg-white/[0.03] ${
                    bad ? "bg-red-500/[0.07]" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-white/40">
                    {c.t.toFixed(2)}
                  </td>
                  <td className="max-w-0 px-2 py-2">
                    <div className="truncate text-white/75">{c.text}</div>
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-white/45">
                    {c.coverage ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-wide ring-1 ${PILL[c.verdict]}`}
                    >
                      {LABEL[c.verdict]}
                    </span>
                  </td>
                </tr>
                {open === c.claimId && (c.citation || c.latencyMs != null) && (
                  <tr key={c.claimId + "-d"} className="bg-black/40">
                    <td colSpan={4} className="px-3 py-2">
                      {c.citation && (
                        <div className="mb-1 text-[11.5px] text-amber-200/80">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">
                            citation{" "}
                          </span>
                          {c.citation}
                        </div>
                      )}
                      {c.latencyMs != null && (
                        <div className="font-mono text-[10.5px] text-white/40">
                          adjudicated in {c.latencyMs.toFixed(2)}ms
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {state.claims.length === 0 && (
        <div className="pt-8 text-center text-sm text-white/25">
          no claims adjudicated yet
        </div>
      )}
    </div>
  );
}
