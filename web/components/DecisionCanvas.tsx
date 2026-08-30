"use client";

import { layout, type CallState, type Tree } from "@/lib/stream";

const W = 200;
const H = 72;
const GAP_X = 262;
const GAP_Y = 106;

const STATE_STYLE = {
  idle: { box: "fill-white stroke-[#e4e7ec]", text: "fill-[#98a2b3]" },
  active: { box: "fill-[#eef2ff] stroke-[#4f46e5]", text: "fill-[#101828]" },
  pass: { box: "fill-[#ecfdf3] stroke-[#12b76a]", text: "fill-[#054f31]" },
  fail: { box: "fill-[#fef3f2] stroke-[#f04438]", text: "fill-[#912018]" },
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
      <div className="flex h-full items-center justify-center text-[13px] text-[#98a2b3]">
        Loading the replay…
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
          <polygon points="0 0, 7 2.5, 0 5" className="fill-[#98a2b3]" />
        </marker>
      </defs>

      {edges.map(({ from, to, label }, i) => {
        if (!pos[from] || !pos[to]) return null;
        const taken = state.path.includes(from) && state.path.includes(to);
        const x1 = px(from) + W;
        const y1 = py(from) + H / 2;
        const x2 = px(to);
        const y2 = py(to) + H / 2;
        const mid = (x1 + x2) / 2;
        const showLabel =
          !!label && edges.filter((e) => e.from === from).length > 1 && y1 !== y2;
        return (
          <g key={i} opacity={taken ? 1 : 0.32}>
            <path
              d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
              fill="none"
              className={taken ? "stroke-[#4f46e5]" : "stroke-[#d0d5dd]"}
              strokeWidth={taken ? 2 : 1.3}
              markerEnd="url(#arrow)"
            />
            {showLabel && (
              <text
                x={mid}
                y={(y1 + y2) / 2 - 7}
                textAnchor="middle"
                className="fill-[#667085]"
                fontSize={10.5}
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
                x={-4}
                y={-4}
                width={W + 8}
                height={H + 8}
                rx={13}
                className="fill-none stroke-[#f04438]"
                strokeWidth={3}
                opacity={0.8}
              />
            )}
            <rect
              width={W}
              height={H}
              rx={10}
              className={`${style.box} transition-all duration-300`}
              strokeWidth={isActive || st === "fail" ? 2 : 1.2}
            />
            <text
              x={14}
              y={value ? 27 : 41}
              className={`${style.text} font-medium`}
              fontSize={13.5}
            >
              {node.label}
            </text>
            {value && (
              <text x={14} y={47} className="fill-[#475467]" fontSize={11.5}>
                {value.length > 26 ? value.slice(0, 26) + "…" : value}
              </text>
            )}
            {st === "pass" && (
              <text
                x={W - 22}
                y={26}
                className="fill-[#12b76a]"
                fontSize={15}
                fontWeight="bold"
              >
                ✓
              </text>
            )}
            {st === "fail" && (
              <text
                x={W - 22}
                y={26}
                className="fill-[#f04438]"
                fontSize={15}
                fontWeight="bold"
              >
                ✕
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
