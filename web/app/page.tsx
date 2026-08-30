"use client";

import { useEffect, useState } from "react";
import { DecisionCanvas } from "@/components/DecisionCanvas";
import { ClaimsLedger, Transcript } from "@/components/Panels";
import { useEventStream, type Source } from "@/lib/useEventStream";

export default function Page() {
  const [source, setSource] = useState<Source>({ kind: "replay", name: "demo" });
  const {
    state,
    playing,
    setPlaying,
    speed,
    setSpeed,
    connected,
    flash,
    restart,
  } = useEventStream(source);

  // Brief red wash on every intercept.
  const [wash, setWash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    setWash(true);
    const id = setTimeout(() => setWash(false), 700);
    return () => clearTimeout(id);
  }, [flash]);

  const live = source.kind === "live";

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#08090b] text-white">
      {wash && (
        <div className="pointer-events-none fixed inset-0 z-50 animate-[fade_0.7s_ease-out] bg-red-600/12 ring-2 ring-inset ring-red-500/50" />
      )}

      {/* ---------------------------------------------------------- top bar */}
      <header className="flex shrink-0 items-center gap-5 border-b border-white/[0.07] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-sm bg-gradient-to-br from-sky-400 to-emerald-400" />
          <span className="text-[15px] font-semibold tracking-tight">
            Sentinel
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-baseline gap-2 text-[12px]">
          <span className="text-white/40">{state.insurer ?? "—"}</span>
          <span className="font-mono text-white/70">
            {state.policyId ?? "no policy"}
          </span>
          {state.holder && (
            <span className="text-white/35">· {state.holder}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-5">
          <Stat label="verified" value={verifiedCount(state)} tone="emerald" />
          <Stat label="intercepted" value={state.stats.intercepts} tone="red" />
          <Stat
            label="unverifiable"
            value={state.stats.unverifiable}
            tone="amber"
          />

          <div className="h-4 w-px bg-white/10" />

          <button
            onClick={() =>
              setSource(live ? { kind: "replay", name: "demo" } : { kind: "live" })
            }
            className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60 transition-colors hover:bg-white/5"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected
                  ? live
                    ? "animate-pulse bg-red-400"
                    : "bg-emerald-400"
                  : "bg-white/25"
              }`}
            />
            {live ? "live" : "replay"}
          </button>

          {!live && (
            <div className="flex items-center gap-1">
              <Ctl onClick={() => setPlaying(!playing)}>
                {playing ? "❚❚" : "▶"}
              </Ctl>
              <Ctl onClick={restart}>↻</Ctl>
              <Ctl onClick={() => setSpeed(speed === 1 ? 2 : 1)}>
                {speed}×
              </Ctl>
            </div>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------ body */}
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-[1.25] flex-col border-r border-white/[0.07]">
          <PanelHead
            title="Decision path"
            note={state.product ?? "policy pack"}
          />
          <div className="min-h-0 flex-1 p-3">
            <DecisionCanvas state={state} intercepting={wash} />
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-[1.05] flex-col overflow-hidden border-b border-white/[0.07]">
            <PanelHead title="Transcript" note="agent · caller" />
            <div className="min-h-0 flex-1 overflow-hidden">
              <Transcript state={state} />
            </div>
          </div>

          <div className="flex min-h-0 flex-[1.15] flex-col overflow-hidden">
            <PanelHead
              title="Claims ledger"
              note="adjudicated against policy record"
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <ClaimsLedger state={state} />
            </div>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------- footer */}
      <footer className="flex shrink-0 items-center gap-3 border-t border-white/[0.07] px-5 py-1.5 font-mono text-[10px] text-white/30">
        <span>
          extraction: fuzzy · adjudication: exact lookup · the model never votes
        </span>
        {state.ended && (
          <span className="ml-auto text-white/45">
            call ended — {state.ended.reason} · {state.stats.claims} claims ·{" "}
            {state.stats.intercepts} intercepted
          </span>
        )}
      </footer>
    </main>
  );
}

function verifiedCount(s: { claims: { verdict: string }[] }) {
  return s.claims.filter((c) => c.verdict === "verified").length;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "red" | "amber";
}) {
  const color = {
    emerald: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
  }[tone];
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-[15px] font-semibold tabular-nums ${color}`}>
        {value}
      </span>
      <span className="font-mono text-[9.5px] uppercase tracking-wider text-white/35">
        {label}
      </span>
    </div>
  );
}

function Ctl({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-6 min-w-6 rounded border border-white/10 px-1.5 font-mono text-[10px] text-white/60 transition-colors hover:bg-white/5"
    >
      {children}
    </button>
  );
}

function PanelHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex shrink-0 items-baseline gap-2 border-b border-white/[0.05] px-4 py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">
        {title}
      </span>
      {note && <span className="text-[10px] text-white/20">{note}</span>}
    </div>
  );
}
