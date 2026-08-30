"use client";

import type { CallState, Verdict } from "@/lib/stream";

export type Claim = CallState["claims"][number];

const BORDER = "#e4e7ec";
const TEXT = "#101828";
const SECONDARY = "#475467";
const MUTED = "#667085";
const ACCENT = "#4f46e5";
const ACCENT_BG = "#eef2ff";

const VERDICT_COLORS: Record<Verdict, { fg: string; bg: string }> = {
  verified: { fg: "#067647", bg: "#ecfdf3" },
  contradicted: { fg: "#b42318", bg: "#fef3f2" },
  unverifiable: { fg: "#b54708", bg: "#fffaeb" },
  incomplete: { fg: "#175cd3", bg: "#eff8ff" },
};

function Chip({
  children,
  fg,
  bg,
}: {
  children: React.ReactNode;
  fg?: string;
  bg?: string;
}) {
  return (
    <code
      style={{
        display: "inline-block",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
        fontSize: 11.5,
        lineHeight: "16px",
        padding: "1px 6px",
        borderRadius: 6,
        border: `1px solid ${BORDER}`,
        background: bg ?? "#f9fafb",
        color: fg ?? TEXT,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      {children}
    </code>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

type Stage = {
  title: string;
  why: string;
  chip: React.ReactNode;
  money?: boolean;
  caption?: string;
};

export function AdjudicationTrace({ claim }: { claim: Claim }) {
  const coverage = claim.coverage ?? "unmatched";
  const vc = VERDICT_COLORS[claim.verdict] ?? { fg: SECONDARY, bg: "#f9fafb" };
  const covered = claim.verdict === "verified";
  const acted = claim.verdict === "contradicted";

  const stages: Stage[] = [
    {
      title: "Utterance captured",
      why: "on_agent_speech fires once per completed sentence",
      chip: <Chip>{truncate(claim.text, 60)}</Chip>,
    },
    {
      title: "Rule matched",
      why: "regex detect + affirm patterns over the active policy pack",
      chip: <Chip>{coverage}</Chip>,
    },
    {
      title: "Ground truth lookup",
      why: "exact dictionary lookup against the policy — no model involved",
      chip: (
        <Chip>{`policy.coverages["${coverage}"].covered => ${covered}`}</Chip>
      ),
      money: true,
      caption: "the model never votes here",
    },
    {
      title: "Verdict",
      why: "deterministic comparison of claim assertion vs. ground truth",
      chip: (
        <Chip fg={vc.fg} bg={vc.bg}>
          {claim.verdict}
        </Chip>
      ),
    },
    {
      title: "Action",
      why: "send_instruction() when contradicted, otherwise stay silent",
      chip: <Chip>{acted ? "send_instruction()" : "no action"}</Chip>,
    },
  ];

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: "10px 12px",
        color: TEXT,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {stages.map((s, i) => (
          <div key={s.title} style={{ display: "flex", gap: 8 }}>
            {/* badge + connector rail */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 18,
                flex: "0 0 18px",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: s.money ? ACCENT : ACCENT_BG,
                  color: s.money ? "#fff" : ACCENT,
                  fontSize: 10.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                }}
              >
                {i + 1}
              </div>
              {i < stages.length - 1 && (
                <div
                  style={{ width: 1, flex: 1, background: BORDER, minHeight: 10 }}
                />
              )}
            </div>

            {/* body */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                paddingBottom: i < stages.length - 1 ? 8 : 0,
                paddingLeft: s.money ? 8 : 0,
                borderLeft: s.money ? `2px solid ${ACCENT}` : undefined,
                marginLeft: s.money ? -2 : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, lineHeight: "18px" }}>
                  {s.title}
                </span>
                <span style={{ fontSize: 11, color: MUTED }}>{s.why}</span>
              </div>
              <div style={{ marginTop: 2, minWidth: 0, overflow: "hidden" }}>
                {s.chip}
              </div>
              {s.caption && (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: ACCENT,
                  }}
                >
                  {s.caption}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* footer */}
      <div
        style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          fontSize: 11,
          color: SECONDARY,
        }}
      >
        <span>
          adjudicated in{" "}
          <strong style={{ color: TEXT }}>
            {(claim.latencyMs ?? 0).toFixed(2)}ms
          </strong>
        </span>
        {claim.citation && (
          <>
            <span style={{ color: BORDER }}>|</span>
            <span style={{ color: MUTED }}>policy citation</span>
            <Chip>{truncate(claim.citation, 72)}</Chip>
          </>
        )}
      </div>
    </div>
  );
}

export default AdjudicationTrace;
