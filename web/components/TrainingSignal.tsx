"use client";

import * as React from "react";
import {
  annotate,
  embeddingPreview,
  vectorStats,
  type EntityLabel,
  type Span,
} from "../lib/annotate";

type Palette = { fg: string; bg: string; border: string };

const COLORS: Record<EntityLabel, Palette> = {
  COVERAGE: { fg: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
  MONEY: { fg: "#067647", bg: "#ecfdf3", border: "#abefc6" },
  DURATION: { fg: "#175cd3", bg: "#eff8ff", border: "#b2ddff" },
  POLICY_ID: { fg: "#101828", bg: "#f2f4f7", border: "#e4e7ec" },
  FLIGHT: { fg: "#6938ef", bg: "#f4f3ff", border: "#d9d6fe" },
  COMMITMENT: { fg: "#b42318", bg: "#fef3f2", border: "#fecdca" },
  HEDGE: { fg: "#b54708", bg: "#fffaeb", border: "#fedf89" },
};

type Piece =
  | { kind: "text"; text: string }
  | { kind: "span"; span: Span };

function toPieces(text: string, spans: Span[]): Piece[] {
  const pieces: Piece[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) pieces.push({ kind: "text", text: text.slice(cursor, s.start) });
    pieces.push({ kind: "span", span: s });
    cursor = s.end;
  }
  if (cursor < text.length) pieces.push({ kind: "text", text: text.slice(cursor) });
  return pieces;
}

export function TrainingSignal({ text }: { text: string }) {
  const spans = React.useMemo(() => annotate(text), [text]);
  const vector = React.useMemo(() => embeddingPreview(text, 12), [text]);
  const stats = React.useMemo(() => vectorStats(spans), [spans]);
  const pieces = React.useMemo(() => toPieces(text, spans), [text, spans]);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e4e7ec",
        borderRadius: 10,
        padding: 16,
        color: "#101828",
        fontSize: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#667085",
          marginBottom: 10,
        }}
      >
        Training signal · entity labelling preview
      </div>

      {/* Annotated utterance */}
      <p style={{ lineHeight: 2.1, margin: 0, wordBreak: "break-word" }}>
        {pieces.map((p, i) =>
          p.kind === "text" ? (
            <span key={i}>{p.text}</span>
          ) : (
            <span
              key={i}
              title={`${p.span.label} · ${(p.span.confidence * 100).toFixed(0)}%`}
              style={{
                position: "relative",
                display: "inline-block",
                background: COLORS[p.span.label].bg,
                color: COLORS[p.span.label].fg,
                border: `1px solid ${COLORS[p.span.label].border}`,
                borderRadius: 10,
                padding: "1px 6px",
                margin: "0 1px",
                whiteSpace: "nowrap",
              }}
            >
              {p.span.text}
              <sup
                style={{
                  marginLeft: 4,
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  opacity: 0.85,
                }}
              >
                {p.span.label}
              </sup>
            </span>
          ),
        )}
      </p>

      {/* Label counts */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 16,
          alignItems: "center",
        }}
      >
        {Object.entries(stats.labels).map(([label, count]) => {
          const c = COLORS[label as EntityLabel] ?? COLORS.POLICY_ID;
          return (
            <span
              key={label}
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              {label} · {count}
            </span>
          );
        })}
        {spans.length === 0 && (
          <span style={{ color: "#667085", fontSize: 12 }}>No entities detected</span>
        )}
      </div>

      {/* Vector sparkline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 11, color: "#667085", fontWeight: 600 }}>
          {vector.length}-dim vector
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 2,
            height: 28,
            padding: "0 4px",
            background: "#f9fafb",
            border: "1px solid #e4e7ec",
            borderRadius: 10,
          }}
        >
          {vector.map((v, i) => (
            <div
              key={i}
              title={v.toFixed(3)}
              style={{
                width: 5,
                height: Math.max(2, Math.round(Math.abs(v) * 22)),
                borderRadius: 2,
                background: v >= 0 ? "#4f46e5" : "#b42318",
                opacity: 0.85,
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#667085" }}>
          {spans.length} spans · {stats.tokens} tokens · density {stats.density.toFixed(2)}
        </span>
      </div>

      <p style={{ marginTop: 14, marginBottom: 0, fontSize: 11, color: "#667085" }}>
        Spans and vectors are captured for supervised fine-tuning of a domain adjudication
        model. Preview only - no training runs from this demo.
      </p>
    </div>
  );
}

export default TrainingSignal;
