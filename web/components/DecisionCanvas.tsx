"use client";

import { layout, type CallState, type Tree } from "@/lib/stream";

const W = 208;
const H = 74;
const GAP_X = 268;
const GAP_Y = 108;

const STATE_STYLE = {
  idle: { box: "fill-white/[0.02] stroke-white/10", text: "fill-white/35" },
  active: { box: "fill-sky-400/10 stroke-sky-400", text: "fill-sky-100" },
  pass: { box: "fill-emerald-400/10 stroke-emerald-400/70", text: "fill-emerald-50" },
  fail: { box: "fill-red-500/15 stroke-red-500", text: "fill-red-50" },
} as const;

export function DecisionCanvas({
  state,
  intercepting,
}: {
  state: CallState;
  intercepting: boolean;
}) {
  const tree = state.tree as Tree | undefined;
  if (!tree?.nodes) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/25">
        waiting for call…
      </div>
    );
  }

  const { pos, edges } = layout(tree);
  const xs = Object.values(pos).map((p) => p.x);
  const ys = Object.values(pos).map((p) => p.y);
  const minY = Math.min(...ys);
  const cols = Math.max(...xs) + 1;
  const rows = Math.max(...ys) - minY + 1;

  const px = (n: string) => 28 + pos[n].x * GAP_X;
  const py = (n: string) => 28 + (pos[n].y - minY) * GAP_Y;

  const width = 28 + (cols - 1) * GAP_X + W + 28;
  const height = 28 + (rows - 1) * GAP_Y + H + 28;

  const activeNode = Object.entries(state.nodes).find(
    ([, v]) => v.state === "active",
  )?.[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="arrow"
          markerWidth="7"
          markerHeight="7"
          refX="6.5"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0, 7 2.5, 0 5" className="fill-white/25" />
        </marker>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {edges.map(({ from, to, label }, i) => {
        if (!pos[from] || !pos[to]) return null;
        const taken =
          state.path.includes(from) && state.path.includes(to);
        const x1 = px(from) + W;
        const y1 = py(from) + H / 2;
        const x2 = px(to);
        const y2 = py(to) + H / 2;
        const mid = (x1 + x2) / 2;
        // Only label a branch when siblings actually diverge; parallel edges
        // into the same node would otherwise stack labels on top of each other.
        const showLabel =
          !!label && edges.filter((e) => e.from === from).length > 1 && y1 !== y2;
        return (
          <g key={i} opacity={taken ? 1 : 0.16}>
            <path
              d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
              fill="none"
              className={taken ? "stroke-sky-400/70" : "stroke-white/30"}
              strokeWidth={taken ? 2 : 1.2}
              markerEnd="url(#arrow)"
            />
            {showLabel && (
              <text
                x={mid}
                y={(y1 + y2) / 2 - 7}
                textAnchor="middle"
                className="fill-white/40 font-mono"
                fontSize={10}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      {Object.entries(tree.nodes).map(([id, node]) => {
        if (!pos[id]) return null;
        const st = state.nodes[id]?.state ?? "idle";
        const style = STATE_STYLE[st];
        const value = state.nodes[id]?.value;
        const isActive = st === "active";
        const halo = intercepting && id === activeNode;

        return (
          <g key={id} transform={`translate(${px(id)}, ${py(id)})`}>
            {halo && (
              <rect
                width={W}
                height={H}
                rx={10}
                className="fill-red-500/20 stroke-red-500"
                strokeWidth={3}
                filter="url(#glow)"
              />
            )}
            <rect
              width={W}
              height={H}
              rx={10}
              className={`${style.box} transition-all duration-300`}
              strokeWidth={isActive || st === "fail" ? 2 : 1}
              filter={isActive ? "url(#glow)" : undefined}
            >
              {isActive && (
                <animate
                  attributeName="opacity"
                  values="1;0.55;1"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              )}
            </rect>
            <text
              x={14}
              y={value ? 25 : 36}
              className={`${style.text} font-medium`}
              fontSize={13}
            >
              {node.label}
            </text>
            {value && (
              <text
                x={14}
                y={44}
                className="fill-emerald-300/90 font-mono"
                fontSize={11}
              >
                {value.length > 24 ? value.slice(0, 24) + "…" : value}
              </text>
            )}
            {st === "pass" && (
              <text x={W - 20} y={24} className="fill-emerald-400" fontSize={14}>
                ✓
              </text>
            )}
            {st === "fail" && (
              <text x={W - 20} y={24} className="fill-red-400" fontSize={14}>
                ✕
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
