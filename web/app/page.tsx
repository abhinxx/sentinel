"use client";

import { useEffect, useState } from "react";
import { CallPanel } from "@/components/CallPanel";
import { DecisionCanvas } from "@/components/DecisionCanvas";
import { ClaimsLedger, Transcript } from "@/components/Panels";
import { useEventStream, type Source } from "@/lib/useEventStream";

export default function Page() {
  const [source, setSource] = useState<Source>({ kind: "replay", name: "demo" });
  const { state, playing, setPlaying, speed, setSpeed, connected, flash, restart } =
    useEventStream(source);

  const [wash, setWash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    setWash(true);
    const id = setTimeout(() => setWash(false), 800);
    return () => clearTimeout(id);
  }, [flash]);

  const live = source.kind === "live";
  const verified = state.claims.filter((c) => c.verdict === "verified").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {wash && (
        <div className="pointer-events-none fixed inset-0 z-50 animate-[fade_0.8s_ease-out] bg-[#f04438]/[0.07] ring-2 ring-inset ring-[#f04438]/40" />
      )}

      <div className="shrink-0 space-y-3 border-b border-[#e4e7ec] bg-white px-5 py-3">
        <CallPanel />

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-[#101828]">
              {state.insurer ?? "No active call"}
            </span>
            {state.policyId && (
              <span className="rounded bg-[#f2f4f7] px-1.5 py-0.5 text-[11.5px] tabular-nums text-[#475467]">
                {state.policyId}
              </span>
            )}
            {state.holder && (
              <span className="text-[12px] text-[#667085]">{state.holder}</span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4">
            <Stat label="Verified" value={verified} tone="green" />
            <Stat label="Intercepted" value={state.stats.intercepts} tone="red" />
            <Stat
              label="Unverifiable"
              value={state.stats.unverifiable}
              tone="amber"
            />

            <div className="h-5 w-px bg-[#e4e7ec]" />

            <button
              onClick={() =>
                setSource(
                  live ? { kind: "replay", name: "demo" } : { kind: "live" },
                )
              }
              className="flex items-center gap-1.5 rounded-md border border-[#d0d5dd] px-2.5 py-1 text-[11.5px] font-medium text-[#344054] transition-colors hover:bg-[#f9fafb]"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected
                    ? live
                      ? "animate-pulse bg-[#f04438]"
                      : "bg-[#12b76a]"
                    : "bg-[#d0d5dd]"
                }`}
              />
              {live ? "Live call" : "Replay"}
            </button>

            {!live && (
              <div className="flex items-center gap-1">
                <Ctl onClick={() => setPlaying(!playing)}>
                  {playing ? "Pause" : "Play"}
                </Ctl>
                <Ctl onClick={restart}>Restart</Ctl>
                <Ctl onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{speed}×</Ctl>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-[1.25] flex-col border-r border-[#e4e7ec] bg-white">
          <PanelHead
            title="Decision path"
            note={state.product ?? "no policy pack loaded"}
          />
          <div className="min-h-0 flex-1 p-3">
            <DecisionCanvas state={state} intercepting={wash} />
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="flex min-h-0 flex-[1.05] flex-col overflow-hidden border-b border-[#e4e7ec]">
            <PanelHead title="Transcript" note="agent · caller" />
            <div className="min-h-0 flex-1 overflow-hidden">
              <Transcript state={state} />
            </div>
          </div>

          <div className="flex min-h-0 flex-[1.15] flex-col overflow-hidden">
            <PanelHead
              title="Claims ledger"
              note="adjudicated against the policy record"
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <ClaimsLedger state={state} />
            </div>
          </div>
        </section>
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-[#e4e7ec] bg-white px-5 py-1.5 text-[11px] text-[#98a2b3]">
        <span>
          Extraction is fuzzy · adjudication is an exact policy lookup · the model
          never votes on a verdict
        </span>
        {state.ended && (
          <span className="ml-auto text-[#667085]">
            Call ended — {state.ended.reason} · {state.stats.claims} claims ·{" "}
            {state.stats.intercepts} intercepted
          </span>
        )}
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "amber";
}) {
  const color = {
    green: "text-[#067647]",
    red: "text-[#b42318]",
    amber: "text-[#b54708]",
  }[tone];
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-[16px] font-semibold tabular-nums ${color}`}>
        {value}
      </span>
      <span className="text-[11px] font-medium text-[#667085]">{label}</span>
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
      className="rounded-md border border-[#d0d5dd] px-2 py-1 text-[11.5px] font-medium text-[#344054] transition-colors hover:bg-[#f9fafb]"
    >
      {children}
    </button>
  );
}

function PanelHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex shrink-0 items-baseline gap-2 border-b border-[#e4e7ec] bg-[#f9fafb] px-4 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#475467]">
        {title}
      </span>
      {note && <span className="text-[11px] text-[#98a2b3]">{note}</span>}
    </div>
  );
}
