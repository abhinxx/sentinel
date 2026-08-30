export type Verdict = "verified" | "contradicted" | "unverifiable" | "incomplete";
export type Severity = "critical" | "advisory" | "info";

export type TreeNode = {
  label: string;
  field?: string;
  next?: string[];
  branches?: Record<string, string>;
  terminal?: boolean;
};
export type Tree = { root: string; nodes: Record<string, TreeNode> };

export type SentinelEvent = {
  t: number;
  seq: number;
  type:
    | "call_start"
    | "agent_speech"
    | "caller_speech"
    | "node_enter"
    | "node_resolve"
    | "claim"
    | "intercept"
    | "correction"
    | "call_end";
  [k: string]: unknown;
};

/** Derived view of the stream. Pure function of the events seen so far. */
export type CallState = {
  policyId?: string;
  holder?: string;
  product?: string;
  insurer?: string;
  currency?: string;
  tree?: Tree;
  facts?: Record<string, unknown>;
  transcript: {
    seq: number;
    t: number;
    who: "agent" | "caller";
    text: string;
    intercepted: boolean;
  }[];
  nodes: Record<string, { state: "idle" | "active" | "pass" | "fail"; value?: string }>;
  path: string[];
  claims: {
    claimId: string;
    t: number;
    text: string;
    coverage?: string;
    verdict: Verdict;
    severity: Severity;
    citation?: string;
    latencyMs?: number;
    correction?: string;
  }[];
  lastIntercept?: { seq: number; claimId: string; citation?: string };
  stats: { claims: number; intercepts: number; unverifiable: number };
  ended?: { reason: string };
};

export const EMPTY: CallState = {
  transcript: [],
  nodes: {},
  path: [],
  claims: [],
  stats: { claims: 0, intercepts: 0, unverifiable: 0 },
};

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

/** Fold one event into the state. Immutable; safe for React. */
export function reduce(s: CallState, e: SentinelEvent): CallState {
  switch (e.type) {
    case "call_start":
      return {
        ...EMPTY,
        policyId: str(e.policy_id),
        holder: str(e.holder),
        product: str(e.product),
        insurer: str(e.insurer),
        currency: str(e.currency),
        tree: e.tree as Tree | undefined,
        facts: (e.facts as Record<string, unknown>) ?? {},
      };

    case "agent_speech":
    case "caller_speech":
      return {
        ...s,
        transcript: [
          ...s.transcript,
          {
            seq: e.seq,
            t: e.t,
            who: e.type === "agent_speech" ? "agent" : "caller",
            text: str(e.text) ?? "",
            intercepted: false,
          },
        ],
      };

    case "node_enter": {
      const node = str(e.node)!;
      return {
        ...s,
        nodes: { ...s.nodes, [node]: { state: "active" } },
        path: s.path.includes(node) ? s.path : [...s.path, node],
      };
    }

    case "node_resolve": {
      const node = str(e.node)!;
      return {
        ...s,
        nodes: {
          ...s.nodes,
          [node]: {
            state: e.outcome === "fail" ? "fail" : "pass",
            value: str(e.value),
          },
        },
      };
    }

    case "claim": {
      const verdict = str(e.verdict) as Verdict;
      return {
        ...s,
        claims: [
          ...s.claims,
          {
            claimId: str(e.claim_id)!,
            t: e.t,
            text: str(e.text) ?? "",
            coverage: str(e.coverage),
            verdict,
            severity: (str(e.severity) as Severity) ?? "info",
            citation: str(e.citation),
            latencyMs: num(e.latency_ms),
          },
        ],
        stats: {
          claims: s.stats.claims + 1,
          intercepts: s.stats.intercepts,
          unverifiable:
            s.stats.unverifiable + (verdict === "unverifiable" ? 1 : 0),
        },
      };
    }

    case "intercept": {
      const claimId = str(e.claim_id)!;
      // The agent utterance that triggered this is the most recent agent line.
      const transcript = [...s.transcript];
      for (let i = transcript.length - 1; i >= 0; i--) {
        if (transcript[i].who === "agent") {
          transcript[i] = { ...transcript[i], intercepted: true };
          break;
        }
      }
      return {
        ...s,
        transcript,
        claims: s.claims.map((c) =>
          c.claimId === claimId ? { ...c, correction: str(e.correction) } : c,
        ),
        lastIntercept: { seq: e.seq, claimId, citation: str(e.citation) },
        stats: { ...s.stats, intercepts: s.stats.intercepts + 1 },
      };
    }

    case "call_end":
      return { ...s, ended: { reason: str(e.reason) ?? "unknown" } };

    default:
      return s;
  }
}

export function reduceAll(events: SentinelEvent[]): CallState {
  return events.reduce(reduce, EMPTY);
}

/** Layered layout: column = depth from root, row = order within depth. */
export function layout(tree: Tree) {
  const depth: Record<string, number> = {};
  const visit = (id: string, d: number, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    depth[id] = Math.max(depth[id] ?? 0, d);
    const n = tree.nodes[id];
    if (!n) return;
    const targets = [...(n.next ?? []), ...Object.values(n.branches ?? {})];
    targets.forEach((t) => visit(t, d + 1, seen));
  };
  visit(tree.root, 0, new Set());

  const byDepth: Record<number, string[]> = {};
  Object.entries(depth).forEach(([id, d]) => {
    (byDepth[d] ??= []).push(id);
  });

  const pos: Record<string, { x: number; y: number }> = {};
  Object.entries(byDepth).forEach(([d, ids]) => {
    ids.forEach((id, i) => {
      pos[id] = { x: Number(d), y: i - (ids.length - 1) / 2 };
    });
  });

  const edges: { from: string; to: string; label?: string }[] = [];
  Object.entries(tree.nodes).forEach(([id, n]) => {
    (n.next ?? []).forEach((to) => edges.push({ from: id, to }));
    Object.entries(n.branches ?? {}).forEach(([label, to]) =>
      edges.push({ from: id, to, label }),
    );
  });

  return { pos, edges, maxDepth: Math.max(...Object.values(depth), 0) };
}
