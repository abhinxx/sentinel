"use client";

import * as React from "react";
import {
  Card,
  EmptyState,
  PageHeader,
  PageShell,
  Pill,
  Table,
  Td,
  Th,
  T,
} from "../../components/ui";

const ENGINE =
  process.env.NEXT_PUBLIC_SENTINEL_API ?? "http://localhost:8787";

type PackSummary = {
  pack_id?: string;
  id?: string;
  product?: string;
  insurer?: string;
  policy_id?: string;
  holder?: string;
  coverages_count?: number;
  rules_count?: number;
};

type Coverage = {
  key?: string;
  coverage?: string;
  covered?: boolean;
  limit?: number | string | null;
  currency?: string;
  reason?: string | null;
};

type Rule = {
  rule_id?: string;
  id?: string;
  coverage?: string;
  severity?: string;
  citation?: string;
};

type Unverifiable = { id?: string; claim_id?: string; note?: string };

type PackDetail = PackSummary & {
  coverages?: Coverage[];
  rules?: Rule[];
  unverifiable?: Unverifiable[];
};

const SAMPLE_PACK: PackDetail = {
  pack_id: "pack_mtc_44817",
  product: "Flight Delay & Trip Disruption",
  insurer: "Meridian Travel Cover",
  policy_id: "MTC-2026-44817",
  holder: "Dana Whitfield",
  coverages: [
    {
      key: "delay_over_3h",
      covered: true,
      limit: 600,
      currency: "USD",
      reason: null,
    },
    {
      key: "hotel_accommodation",
      covered: false,
      limit: null,
      reason: "Excluded unless the delay exceeds 12 hours overnight.",
    },
    {
      key: "baggage_delay",
      covered: true,
      limit: 500,
      currency: "USD",
      reason: null,
    },
  ],
  rules: [
    {
      rule_id: "R-101",
      coverage: "delay_over_3h",
      severity: "critical",
      citation: "§4.2 Delay Benefit Schedule",
    },
    {
      rule_id: "R-118",
      coverage: "hotel_accommodation",
      severity: "critical",
      citation: "§7.1 Accommodation Exclusions",
    },
    {
      rule_id: "R-204",
      coverage: "baggage_delay",
      severity: "advisory",
      citation: "§5.6 Baggage Provisions",
    },
  ],
  unverifiable: [
    {
      id: "U-01",
      note: "Reimbursement processing time is not stated in the policy document.",
    },
    {
      id: "U-02",
      note: "Whether meal receipts are required is not specified.",
    },
  ],
};

function packKey(p: PackSummary): string {
  return String(p.pack_id ?? p.id ?? p.policy_id ?? "");
}

function countOf(p: PackSummary, kind: "coverages" | "rules"): number {
  const explicit =
    kind === "coverages" ? p.coverages_count : p.rules_count;
  if (typeof explicit === "number") return explicit;
  const arr = (p as Record<string, unknown>)[kind];
  return Array.isArray(arr) ? arr.length : 0;
}

function sevTone(s?: string) {
  const v = (s || "").toLowerCase();
  if (v === "critical") return "red" as const;
  if (v === "advisory") return "amber" as const;
  return "blue" as const;
}

function fmtLimit(c: Coverage): string {
  if (c.limit === null || c.limit === undefined || c.limit === "") return "—";
  const n = Number(c.limit);
  if (!isNaN(n)) return `${c.currency ?? "USD"} ${n.toLocaleString()}`;
  return String(c.limit);
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: T.muted,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  margin: "0 0 10px",
};

export default function PoliciesPage() {
  const [packs, setPacks] = React.useState<PackSummary[]>([]);
  const [offline, setOffline] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PackDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${ENGINE}/api/packs`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: unknown = await res.json();
        let list: PackSummary[] = [];
        if (Array.isArray(json)) list = json as PackSummary[];
        else if (json && typeof json === "object") {
          const o = json as Record<string, unknown>;
          const cand = o.packs ?? o.items ?? o.results;
          if (Array.isArray(cand)) list = cand as PackSummary[];
        }
        if (!alive) return;
        if (list.length === 0) {
          setPacks([SAMPLE_PACK]);
          setDetail(SAMPLE_PACK);
          setSelected(packKey(SAMPLE_PACK));
          setOffline(true);
        } else {
          setPacks(list);
          setOffline(false);
        }
      } catch {
        if (!alive) return;
        setPacks([SAMPLE_PACK]);
        setDetail(SAMPLE_PACK);
        setSelected(packKey(SAMPLE_PACK));
        setOffline(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function openPack(p: PackSummary) {
    const key = packKey(p);
    if (selected === key) {
      setSelected(null);
      return;
    }
    setSelected(key);
    if (offline) {
      setDetail(SAMPLE_PACK);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await fetch(`${ENGINE}/api/packs/${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PackDetail;
      setDetail(json && typeof json === "object" ? json : SAMPLE_PACK);
    } catch {
      setDetail(SAMPLE_PACK);
    } finally {
      setDetailLoading(false);
    }
  }

  const coverages = detail?.coverages ?? [];
  const rules = detail?.rules ?? [];
  const unverifiable = detail?.unverifiable ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Policy packs"
        subtitle="Machine-readable coverage maps the supervisor checks every agent claim against."
        actions={
          <Pill tone={offline ? "amber" : "green"}>
            {offline ? "Sample pack" : "Live"}
          </Pill>
        }
      />

      {offline && !loading ? (
        <div style={{ marginBottom: 20 }}>
          <EmptyState
            title="Engine offline — showing a sample policy pack"
            hint="start it with uv run python run_live.py --serve-only"
          />
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {loading ? (
          <Card style={{ padding: 18, color: T.muted, fontSize: 14 }}>
            Loading packs…
          </Card>
        ) : (
          packs.map((p) => {
            const key = packKey(p);
            const active = selected === key;
            return (
              <Card
                key={key}
                onClick={() => openPack(p)}
                style={{
                  padding: 18,
                  cursor: "pointer",
                  borderColor: active ? T.accent : T.border,
                  background: active ? T.accentBg : T.cardBg,
                }}
              >
                <div
                  style={{ fontSize: 15, fontWeight: 600, color: T.text }}
                >
                  {p.product ?? "Untitled product"}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: T.text2 }}>
                  {p.insurer ?? "Unknown insurer"}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: T.muted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <div>Policy {p.policy_id ?? "—"}</div>
                  <div>Holder {p.holder ?? "—"}</div>
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <Pill tone="blue">{countOf(p, "coverages")} coverages</Pill>
                  <Pill tone="gray">{countOf(p, "rules")} rules</Pill>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {selected && detail ? (
        <Card style={{ padding: 22 }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.text }}>
              {detail.product ?? "Policy pack"}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: T.text2 }}>
              {detail.insurer ?? "—"} · {detail.policy_id ?? "—"} ·{" "}
              {detail.holder ?? "—"}
            </div>
          </div>

          {detailLoading ? (
            <div style={{ color: T.muted, fontSize: 14 }}>Loading pack…</div>
          ) : (
            <>
              <section style={{ marginBottom: 26 }}>
                <h2 style={SECTION_TITLE}>Coverages</h2>
                <div
                  style={{
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                    overflow: "hidden",
                  }}
                >
                  <Table>
                    <thead>
                      <tr>
                        <Th>Coverage</Th>
                        <Th>Covered</Th>
                        <Th align="right">Limit</Th>
                        <Th>Reason</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverages.length === 0 ? (
                        <tr>
                          <Td colSpan={4} align="center">
                            No coverages defined.
                          </Td>
                        </tr>
                      ) : (
                        coverages.map((c, i) => (
                          <tr key={i}>
                            <Td style={{ color: T.text, fontWeight: 500 }}>
                              {c.key ?? c.coverage ?? "—"}
                            </Td>
                            <Td>
                              <Pill tone={c.covered ? "green" : "red"}>
                                {c.covered ? "Covered" : "Not covered"}
                              </Pill>
                            </Td>
                            <Td align="right" nums>
                              {fmtLimit(c)}
                            </Td>
                            <Td>{c.reason ?? "—"}</Td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              </section>

              <section style={{ marginBottom: 26 }}>
                <h2 style={SECTION_TITLE}>Supervisor rules</h2>
                <div
                  style={{
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                    overflow: "hidden",
                  }}
                >
                  <Table>
                    <thead>
                      <tr>
                        <Th>Rule</Th>
                        <Th>Coverage</Th>
                        <Th>Severity</Th>
                        <Th>Citation</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.length === 0 ? (
                        <tr>
                          <Td colSpan={4} align="center">
                            No rules defined.
                          </Td>
                        </tr>
                      ) : (
                        rules.map((r, i) => (
                          <tr key={i}>
                            <Td style={{ color: T.text, fontWeight: 500 }} nums>
                              {r.rule_id ?? r.id ?? "—"}
                            </Td>
                            <Td>{r.coverage ?? "—"}</Td>
                            <Td>
                              <Pill tone={sevTone(r.severity)}>
                                {r.severity ?? "info"}
                              </Pill>
                            </Td>
                            <Td>{r.citation ?? "—"}</Td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              </section>

              <section>
                <h2 style={SECTION_TITLE}>Unverifiable claims</h2>
                {unverifiable.length === 0 ? (
                  <div style={{ fontSize: 14, color: T.muted }}>
                    Nothing flagged as unverifiable.
                  </div>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {unverifiable.map((u, i) => (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          padding: "12px 14px",
                          border: `1px solid ${T.border}`,
                          borderRadius: T.radius,
                          background: "#fcfcfd",
                        }}
                      >
                        <Pill tone="amber">{u.id ?? u.claim_id ?? "—"}</Pill>
                        <span style={{ fontSize: 14, color: T.text2 }}>
                          {u.note ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </Card>
      ) : null}
    </PageShell>
  );
}
