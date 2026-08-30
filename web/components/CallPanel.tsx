"use client";

import { useEffect, useState } from "react";

export const ENGINE =
  process.env.NEXT_PUBLIC_SENTINEL_API ?? "http://localhost:8787";

/** Fallback so the panel still shows a real number when the engine is offline. */
const FALLBACK_NUMBER = "+14842707493";

function pretty(n: string) {
  const d = n.replace(/[^0-9]/g, "");
  if (d.length === 11 && d.startsWith("1"))
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return n;
}

export function CallPanel() {
  const [agentNumber, setAgentNumber] = useState(FALLBACK_NUMBER);
  const [online, setOnline] = useState(false);
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" | "calling" | "ok" | "err"; msg?: string }
  >({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let dead = false;
    fetch(`${ENGINE}/api/health`)
      .then((r) => r.json())
      .then((j) => {
        if (dead) return;
        setOnline(true);
        if (j.agent_number) setAgentNumber(j.agent_number);
      })
      .catch(() => !dead && setOnline(false));
    return () => {
      dead = true;
    };
  }, []);

  const valid = /^\+[1-9][0-9]{7,14}$/.test(to.trim());
  const usOnly = valid && !to.trim().startsWith("+1");

  async function placeCall() {
    if (!valid) return;
    setStatus({ kind: "calling" });
    try {
      // Same-origin route: works on the deployed site with no laptop.
      const r = await fetch(`/api/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_number: to.trim() }),
      });
      const j = await r.json();
      setStatus(
        r.ok && j.ok
          ? { kind: "ok", msg: `Calling ${pretty(to.trim())} — pick up.` }
          : { kind: "err", msg: j.error ?? "Call failed" },
      );
    } catch {
      setStatus({
        kind: "err",
        msg: "Could not reach the call service.",
      });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* --- inbound: call us -------------------------------------------- */}
      <div className="rounded-[10px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.05)]">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
            Call the agent
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${online ? "bg-[#12b76a]" : "bg-[#d0d5dd]"}`}
            title={online ? "engine online" : "engine offline"}
          />
        </div>
        <p className="mb-3 text-[12.5px] leading-relaxed text-[#475467]">
          Dial this number from your phone and try to make the agent promise
          something the policy doesn&apos;t cover.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-[#f9fafb] px-3 py-2.5 text-[17px] font-semibold tabular-nums text-[#101828] ring-1 ring-inset ring-[#e4e7ec]">
            {pretty(agentNumber)}
          </code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(agentNumber);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
            className="rounded-lg border border-[#d0d5dd] px-3 py-2.5 text-[12.5px] font-medium text-[#344054] transition-colors hover:bg-[#f9fafb]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={`tel:${agentNumber}`}
            className="rounded-lg bg-[#4f46e5] px-3.5 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#4338ca]"
          >
            Call
          </a>
        </div>
      </div>

      {/* --- outbound: we call you ---------------------------------------- */}
      <div className="rounded-[10px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.05)]">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
          Get a call back
        </div>
        <p className="mb-3 text-[12.5px] leading-relaxed text-[#475467]">
          Enter your number in E.164 format and the agent will ring you now.
        </p>
        <div className="flex items-center gap-2">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && placeCall()}
            placeholder="+14155550123"
            inputMode="tel"
            className="min-w-0 flex-1 rounded-lg border border-[#d0d5dd] px-3 py-2.5 text-[14px] tabular-nums text-[#101828] outline-none transition-shadow placeholder:text-[#98a2b3] focus:border-[#4f46e5] focus:ring-2 focus:ring-[#eef2ff]"
          />
          <button
            onClick={placeCall}
            disabled={!valid || usOnly || status.kind === "calling"}
            className="shrink-0 rounded-lg bg-[#4f46e5] px-4 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:bg-[#d0d5dd]"
          >
            {status.kind === "calling" ? "Ringing…" : "Call me"}
          </button>
        </div>
        {status.msg && (
          <div
            className={`mt-2 rounded-md px-2.5 py-1.5 text-[12px] ${
              status.kind === "ok"
                ? "bg-[#ecfdf3] text-[#067647]"
                : "bg-[#fef3f2] text-[#b42318]"
            }`}
          >
            {status.msg}
          </div>
        )}
        {usOnly && (
          <div className="mt-2 rounded-md bg-[#fffaeb] px-2.5 py-1.5 text-[12px] text-[#b54708]">
            This account can only dial +1 (US/Canada). A +33 number is rejected
            by the carrier — dial the agent number on the left instead.
          </div>
        )}
        {!status.msg && !usOnly && to && !valid && (
          <div className="mt-2 text-[12px] text-[#b54708]">
            Use E.164 format, e.g. +14155550123
          </div>
        )}
      </div>
    </div>
  );
}
