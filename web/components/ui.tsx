"use client";

import * as React from "react";

/* ---------- design tokens ---------- */
export const T = {
  pageBg: "#f7f8fa",
  cardBg: "#ffffff",
  border: "#e4e7ec",
  radius: 10,
  text: "#101828",
  text2: "#475467",
  muted: "#667085",
  accent: "#4f46e5",
  accentBg: "#eef2ff",
  shadow: "0 1px 2px rgba(16,24,40,.05)",
} as const;

export type Tone = "green" | "red" | "amber" | "blue" | "gray";

const TONES: Record<Tone, { fg: string; bg: string; bd: string }> = {
  green: { fg: "#067647", bg: "#ecfdf3", bd: "#abefc6" },
  red: { fg: "#b42318", bg: "#fef3f2", bd: "#fecdca" },
  amber: { fg: "#b54708", bg: "#fffaeb", bd: "#fedf89" },
  blue: { fg: "#175cd3", bg: "#eff8ff", bd: "#b2ddff" },
  gray: { fg: "#475467", bg: "#f9fafb", bd: "#e4e7ec" },
};

/* ---------- Card ---------- */
export function Card({
  children,
  style,
  className,
  onClick,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: T.cardBg,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        boxShadow: T.shadow,
        color: T.text,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- StatCard ---------- */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: T.muted,
          letterSpacing: ".02em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 28,
          lineHeight: 1.15,
          fontWeight: 600,
          color: T.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 4, fontSize: 12, color: T.text2 }}>{hint}</div>
      ) : null}
    </Card>
  );
}

/* ---------- Pill ---------- */
export function Pill({
  tone = "gray",
  children,
}: {
  tone?: Tone;
  children?: React.ReactNode;
}) {
  const c = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: "18px",
        color: c.fg,
        background: c.bg,
        border: `1px solid ${c.bd}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* ---------- Table ---------- */
export function Table({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          color: T.text,
        }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  style,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 16px",
        fontSize: 12,
        fontWeight: 600,
        color: T.muted,
        background: "#f9fafb",
        borderBottom: `1px solid ${T.border}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  nums,
  style,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  nums?: boolean;
  style?: React.CSSProperties;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align,
        padding: "12px 16px",
        borderBottom: `1px solid ${T.border}`,
        color: T.text2,
        fontVariantNumeric: nums ? "tabular-nums" : undefined,
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "28px 20px",
        textAlign: "center",
        background: "#fffaeb",
        border: "1px solid #fedf89",
        borderRadius: T.radius,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#b54708" }}>
        {title}
      </div>
      {hint ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "#93370d",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- PageHeader ---------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-.01em",
            color: T.text,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p style={{ margin: "6px 0 0", fontSize: 14, color: T.text2 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- page shell helper ---------- */
export function PageShell({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        // Not 100vh: this sits *below* the app header inside a scroll
        // container, so 100vh would overflow and create a second scrollbar.
        minHeight: "100%",
        background: T.pageBg,
        color: T.text,
        padding: "32px 28px 64px",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
