"use client";

import * as React from "react";
import {
  Card,
  EmptyState,
  PageHeader,
  PageShell,
  Pill,
  StatCard,
  Table,
  Td,
  Th,
  T,
} from "../../components/ui";

const ENGINE =
  process.env.NEXT_PUBLIC_SENTINEL_API ?? "http://localhost:8787";

type Conversation = {
  id: string | number;
  call_id: string;
  ts: string | number;
  direction: string;
  from_number: string;
  to_number: string;
  duration_sec: number;
  termination_reason: string;
};

type TranscriptLine = {
  who?: string;
  role?: string;
  speaker?: string;
  text?: string;
  content?: string;
  t?: number;
  ts?: number | string;
};

const SAMPLE: Conversation[] = [
  {
    id: 1,
    call_id: "call_9f21ab",
    ts: "2026-08-28T14:32:10Z",
    direction: "inbound",
    from_number: "+1 (415) 555-0182",
    to_number: "+1 (888) 555-0100",
    duration_sec: 254,
    termination_reason: "resolved",
  },
  {
    id: 2,
    call_id: "call_7c04de",
    ts: "2026-08-28T13:05:44Z",
    direction: "outbound",
    from_number: "+1 (888) 555-0100",
    to_number: "+1 (206) 555-0147",
    duration_sec: 131,
    termination_reason: "callback_scheduled",
  },
  {
    id: 3,
    call_id: "call_3ba88f",
    ts: "2026-08-28T11:47:02Z",
    direction: "inbound",
    from_number: "+1 (312) 555-0163",
    to_number: "+1 (888) 555-0100",
    duration_sec: 402,
    termination_reason: "escalated",
  },
];

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function fmtDate(ts: string | number): string {
  const d = new Date(typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function outcomeTone(reason: string) {
  const r = (reason || "").toLowerCase();
  if (r.includes("resolved") || r.includes("complete")) return "green" as const;
  if (r.includes("escalat") || r.includes("fail") || r.includes("drop"))
    return "red" as const;
  if (r.includes("callback") || r.includes("pending")) return "amber" as const;
  return "gray" as const;
}

export default function CallsPage() {
  const [rows, setRows] = React.useState<Conversation[]>([]);
  const [offline, setOffline] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [transcripts, setTranscripts] = React.useState<
    Record<string, { loading: boolean; lines: TranscriptLine[]; error?: string }>
  >({});

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/calls`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { conversations?: Conversation[] };
        if (!alive) return;
        const list = Array.isArray(json?.conversations)
          ? json.conversations
          : [];
        if (list.length === 0) {
          setRows(SAMPLE);
          setOffline(true);
        } else {
          setRows(list);
          setOffline(false);
        }
      } catch {
        if (!alive) return;
        setRows(SAMPLE);
        setOffline(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const stats = React.useMemo(() => {
    const total = rows.length;
    const inbound = rows.filter(
      (r) => (r.direction || "").toLowerCase() === "inbound",
    ).length;
    const outbound = total - inbound;
    const avg =
      total === 0
        ? 0
        : rows.reduce((a, r) => a + (Number(r.duration_sec) || 0), 0) / total;
    return { total, inbound, outbound, avg };
  }, [rows]);

  async function toggleRow(callId: string) {
    if (openId === callId) {
      setOpenId(null);
      return;
    }
    setOpenId(callId);
    if (transcripts[callId]) return;
    setTranscripts((p) => ({ ...p, [callId]: { loading: true, lines: [] } }));
    try {
      const res = await fetch(
        `/api/calls/${encodeURIComponent(callId)}/transcript`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      let lines: TranscriptLine[] = [];
      if (Array.isArray(json)) lines = json as TranscriptLine[];
      else if (json && typeof json === "object") {
        const o = json as Record<string, unknown>;
        const cand = o.transcript ?? o.lines ?? o.messages ?? o.events;
        if (Array.isArray(cand)) lines = cand as TranscriptLine[];
      }
      setTranscripts((p) => ({ ...p, [callId]: { loading: false, lines } }));
    } catch {
      setTranscripts((p) => ({
        ...p,
        [callId]: {
          loading: false,
          lines: [],
          error: "Transcript unavailable — engine offline.",
        },
      }));
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Call history"
        subtitle="Every supervised conversation handled by the Sentinel voice agent."
        actions={
          <Pill tone={offline ? "amber" : "green"}>
            {offline ? "Sample data" : "Live"}
          </Pill>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <StatCard label="Total calls" value={stats.total} hint="All time" />
        <StatCard
          label="Avg duration"
          value={mmss(stats.avg)}
          hint="Minutes per call"
        />
        <StatCard
          label="Inbound"
          value={stats.inbound}
          hint={`${stats.total ? Math.round((stats.inbound / stats.total) * 100) : 0}% of volume`}
        />
        <StatCard
          label="Outbound"
          value={stats.outbound}
          hint={`${stats.total ? Math.round((stats.outbound / stats.total) * 100) : 0}% of volume`}
        />
      </div>

      {offline && !loading ? (
        <div style={{ marginBottom: 20 }}>
          <EmptyState
            title="No calls yet — showing sample data"
            hint="Place a call and it will appear here."
          />
        </div>
      ) : null}

      <Card style={{ overflow: "hidden" }}>
        <Table>
          <thead>
            <tr>
              <Th>Date / Time</Th>
              <Th>Direction</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th align="right">Duration</Th>
              <Th>Outcome</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td colSpan={6} align="center" style={{ color: T.muted }}>
                  Loading calls…
                </Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td colSpan={6} align="center" style={{ color: T.muted }}>
                  No calls recorded yet.
                </Td>
              </tr>
            ) : (
              rows.map((r) => {
                const open = openId === r.call_id;
                const tr = transcripts[r.call_id];
                return (
                  <React.Fragment key={String(r.id ?? r.call_id)}>
                    <tr
                      onClick={() => toggleRow(r.call_id)}
                      style={{
                        cursor: "pointer",
                        background: open ? T.accentBg : undefined,
                      }}
                    >
                      <Td style={{ color: T.text, fontWeight: 500 }} nums>
                        {fmtDate(r.ts)}
                      </Td>
                      <Td>
                        <Pill
                          tone={
                            (r.direction || "").toLowerCase() === "inbound"
                              ? "blue"
                              : "gray"
                          }
                        >
                          {r.direction || "unknown"}
                        </Pill>
                      </Td>
                      <Td nums>{r.from_number}</Td>
                      <Td nums>{r.to_number}</Td>
                      <Td align="right" nums>
                        {mmss(r.duration_sec)}
                      </Td>
                      <Td>
                        <Pill tone={outcomeTone(r.termination_reason)}>
                          {r.termination_reason || "—"}
                        </Pill>
                      </Td>
                    </tr>
                    {open ? (
                      <tr>
                        <Td colSpan={6} style={{ background: "#fcfcfd" }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: T.muted,
                              textTransform: "uppercase",
                              letterSpacing: ".02em",
                              marginBottom: 10,
                            }}
                          >
                            Transcript · {r.call_id}
                          </div>
                          {tr?.loading ? (
                            <div style={{ color: T.muted, fontSize: 13 }}>
                              Loading transcript…
                            </div>
                          ) : tr?.error ? (
                            <div style={{ color: "#b42318", fontSize: 13 }}>
                              {tr.error}
                            </div>
                          ) : tr && tr.lines.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                              }}
                            >
                              {tr.lines.map((l, i) => {
                                const who =
                                  l.who ?? l.role ?? l.speaker ?? "agent";
                                const isAgent = who
                                  .toLowerCase()
                                  .includes("agent");
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      alignItems: "flex-start",
                                    }}
                                  >
                                    <div style={{ minWidth: 72 }}>
                                      <Pill tone={isAgent ? "blue" : "gray"}>
                                        {who}
                                      </Pill>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 14,
                                        color: T.text,
                                        lineHeight: 1.55,
                                      }}
                                    >
                                      {l.text ?? l.content ?? ""}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ color: T.muted, fontSize: 13 }}>
                              No transcript lines for this call.
                            </div>
                          )}
                        </Td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>
    </PageShell>
  );
}
