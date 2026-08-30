/**
 * annotate.ts — pure, dependency-free, deterministic transcript annotation layer.
 *
 * Extracts labelled entity spans from a single utterance and produces a
 * deterministic pseudo-embedding preview for visualisation.
 *
 * NOTE: nothing here trains or calls a model. It is a data-labelling preview.
 */

export type EntityLabel =
  | "COVERAGE"
  | "MONEY"
  | "DURATION"
  | "POLICY_ID"
  | "FLIGHT"
  | "COMMITMENT"
  | "HEDGE";

export type Span = {
  start: number;
  end: number;
  text: string;
  label: EntityLabel;
  confidence: number;
};

const CONFIDENCE: Record<EntityLabel, number> = {
  POLICY_ID: 0.99,
  FLIGHT: 0.97,
  MONEY: 0.96,
  DURATION: 0.94,
  COVERAGE: 0.91,
  COMMITMENT: 0.88,
  HEDGE: 0.82,
};

const RULES: { label: EntityLabel; re: RegExp }[] = [
  { label: "POLICY_ID", re: /\b[A-Z]{2,4}-\d{4}-\d{4,6}\b/g },
  { label: "FLIGHT", re: /\b[A-Z]{2}-?\d{2,4}\b/g },
  { label: "MONEY", re: /\$\s?\d[\d,]*(\.\d+)?|\b\d[\d,]*\s?(dollars|usd)\b/gi },
  {
    label: "DURATION",
    re: /\b\d+\s?(hour|hours|hr|hrs|day|days|minute|minutes)\b/gi,
  },
  {
    label: "COVERAGE",
    re: /\b(hotel|accommodation|baggage|luggage|meal|voucher|delay|deductible|contents|mold|flood|rebooking)\w*/gi,
  },
  {
    label: "COMMITMENT",
    re: /\b(we'll|we will|i'll|i will|you'?re entitled|guarantee|absolutely|of course|definitely|certainly)\b/gi,
  },
  {
    label: "HEDGE",
    re: /\b(probably|should|roughly|about|approximately|usually|typically|i think|likely|around)\b/gi,
  },
];

/** Extract non-overlapping labelled spans from one utterance. */
export function annotate(text: string): Span[] {
  const candidates: Span[] = [];

  for (const { label, re } of RULES) {
    const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      if (m[0].length === 0) {
        rx.lastIndex++;
        continue;
      }
      candidates.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        label,
        confidence: CONFIDENCE[label],
      });
    }
  }

  // Higher confidence wins; ties broken by longer span, then earlier start.
  candidates.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start,
  );

  const kept: Span[] = [];
  for (const c of candidates) {
    const overlaps = kept.some((k) => c.start < k.end && k.start < c.end);
    if (!overlaps) kept.push(c);
  }

  kept.sort((a, b) => a.start - b.start);
  return kept;
}

/**
 * Deterministic pseudo-embedding.
 * VISUAL PLACEHOLDER ONLY — this is not a real learned embedding, it is a
 * stable hash projection purely so the demo can render consistent bars.
 */
export function embeddingPreview(text: string, dims = 12): number[] {
  const out: number[] = [];
  for (let d = 0; d < dims; d++) {
    let h = 2166136261 ^ (d * 0x9e3779b1);
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i) + d;
      h = Math.imul(h, 16777619);
      h = (h << 13) | (h >>> 19);
    }
    const norm = ((h >>> 0) % 20001) / 10000 - 1; // [-1, 1]
    out.push(Math.round(norm * 1000) / 1000);
  }
  return out;
}

export function vectorStats(spans: Span[]): {
  labels: Record<string, number>;
  tokens: number;
  density: number;
} {
  const labels: Record<string, number> = {};
  let tokens = 0;
  for (const s of spans) {
    labels[s.label] = (labels[s.label] ?? 0) + 1;
    tokens += s.text.trim().split(/\s+/).filter(Boolean).length;
  }
  const density = spans.length === 0 ? 0 : Math.round((tokens / spans.length) * 1000) / 1000;
  return { labels, tokens, density };
}

/** Asserts core invariants. Throws on failure. */
export function selfCheck(): string {
  const sample =
    "We'll cover your hotel up to $500 for 5 hours, policy MTC-2026-44817 flight MR-448";
  const spans = annotate(sample);
  const found = new Set(spans.map((s) => s.label));
  const required: EntityLabel[] = [
    "COMMITMENT",
    "COVERAGE",
    "MONEY",
    "DURATION",
    "POLICY_ID",
    "FLIGHT",
  ];
  for (const r of required) {
    if (!found.has(r)) {
      throw new Error(`selfCheck: missing label ${r} in [${[...found].join(", ")}]`);
    }
  }
  for (let i = 1; i < spans.length; i++) {
    const prev = spans[i - 1]!;
    const cur = spans[i]!;
    if (cur.start < prev.end) {
      throw new Error(`selfCheck: overlapping spans ${prev.text} / ${cur.text}`);
    }
  }
  const a = embeddingPreview(sample);
  const b = embeddingPreview(sample);
  if (a.join(",") !== b.join(",")) throw new Error("selfCheck: embedding not deterministic");
  if (a.length !== 12) throw new Error("selfCheck: wrong dims");
  if (a.some((v) => v < -1 || v > 1)) throw new Error("selfCheck: value out of range");

  return spans.map((s) => `${s.label}:${s.text}`).join(" | ");
}
