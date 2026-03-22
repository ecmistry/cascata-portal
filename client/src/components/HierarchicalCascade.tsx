import { useState, useMemo, Fragment } from "react";
import { ChevronRight, ChevronDown, TrendingUp } from "lucide-react";

type RagStatus = "green" | "amber" | "red";

interface MetricCell {
  model: number;
  actual: number | null;
  rag: RagStatus | null;
}

interface HierarchyQuarter {
  year: number;
  quarter: number;
  label: string;
  isHistorical: boolean;
  sql: MetricCell;
  ocr: MetricCell;
  owr: MetricCell;
  oppCount: MetricCell;
  nbWins: MetricCell;
  revenueNew: number;
  revenueUpsell: number;
  actualRevenueNew: number | null;
  actualRevenueUpsell: number | null;
  customerCount: number;
  attachRate: number;
  avgAcvNew: number;
  target: {
    sqls: number;
    opps: number;
    wins: number;
    revenueNew: number;
    revenueUpsell: number;
    revenueTotal: number;
  } | null;
  targetRag: {
    sql: RagStatus | null;
    ocr: RagStatus | null;
    revenue: RagStatus | null;
  } | null;
}

interface HierarchyRow {
  id: string;
  label: string;
  level: 1 | 2 | 3;
  regionId?: number;
  sqlTypeId?: number;
  quarters: HierarchyQuarter[];
  rScore?: number;
}

interface Props {
  quarters: Array<{ year: number; quarter: number; label: string }>;
  global: HierarchyRow;
  regions: HierarchyRow[];
  motions: HierarchyRow[][];
}

type MetricKey = "sql" | "ocr" | "owr" | "oppCount" | "nbWins" | "avgAcv" | "newBookings";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "sql", label: "SQLs" },
  { key: "ocr", label: "Opp Coverage Ratio" },
  { key: "owr", label: "Opp Win Rate" },
  { key: "oppCount", label: "Opportunities" },
  { key: "nbWins", label: "NB Wins" },
  { key: "avgAcv", label: "Avg ACV" },
  { key: "newBookings", label: "New Bookings" },
];

function RagDot({ status }: { status: RagStatus | null }) {
  if (!status) return null;
  const colors: Record<RagStatus, string> = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]} ml-1`} />;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtPct(val: number | null | undefined): string {
  if (val == null || val === 0) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toFixed(0)}`;
}

function getMetricValue(q: HierarchyQuarter, metric: MetricKey, which: "model" | "actual"): { display: string; raw: number } {
  switch (metric) {
    case "sql": {
      const v = which === "model" ? q.sql.model : (q.sql.actual ?? 0);
      return { display: fmtNum(v), raw: v };
    }
    case "ocr": {
      const v = which === "model" ? q.ocr.model : (q.ocr.actual ?? 0);
      return { display: fmtPct(q.sql.model > 0 && which === "model" ? q.ocr.model / q.sql.model : (q.sql.actual && q.sql.actual > 0 && which === "actual" ? (q.ocr.actual ?? 0) / q.sql.actual : 0)), raw: v };
    }
    case "owr": {
      const oppVal = which === "model" ? q.ocr.model : (q.ocr.actual ?? 0);
      const winVal = which === "model" ? q.nbWins.model : (q.nbWins.actual ?? 0);
      const rate = oppVal > 0 ? winVal / oppVal : 0;
      return { display: fmtPct(rate), raw: rate };
    }
    case "oppCount": {
      const v = which === "model" ? q.oppCount.model : (q.oppCount.actual ?? 0);
      return { display: fmtNum(v), raw: v };
    }
    case "nbWins": {
      const v = which === "model" ? q.nbWins.model : (q.nbWins.actual ?? 0);
      return { display: fmtNum(v), raw: v };
    }
    case "avgAcv": {
      const v = q.avgAcvNew;
      return { display: fmtMoney(v), raw: v };
    }
    case "newBookings": {
      const v = which === "model" ? q.revenueNew : (q.actualRevenueNew ?? 0);
      return { display: fmtMoney(v), raw: v };
    }
  }
}

function getMetricRag(q: HierarchyQuarter, metric: MetricKey): RagStatus | null {
  if (!q.isHistorical) return null;
  switch (metric) {
    case "sql": return q.sql.rag;
    case "ocr": return q.ocr.rag;
    case "oppCount": return q.oppCount.rag;
    case "nbWins": return q.nbWins.rag;
    case "newBookings": return q.targetRag?.revenue ?? null;
    default: return null;
  }
}

export default function HierarchicalCascade({ quarters, global, regions, motions }: Props) {
  const [expandedMetrics, setExpandedMetrics] = useState<Set<MetricKey>>(new Set());
  const [expandedPods, setExpandedPods] = useState<Set<string>>(new Set());

  const toggleMetric = (key: MetricKey) => {
    setExpandedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const togglePod = (key: string) => {
    setExpandedPods(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const visibleQuarters = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curQ = Math.ceil((now.getMonth() + 1) / 3);
    const sorted = [...quarters].sort((a, b) => (a.year * 4 + a.quarter) - (b.year * 4 + b.quarter));
    const histIdx = sorted.findIndex(q => q.year === curY && q.quarter === curQ);
    const endIdx = histIdx !== -1 ? Math.min(histIdx + 3, sorted.length) : sorted.length;
    const startIdx = Math.max(endIdx - 10, 0);
    return sorted.slice(startIdx, endIdx);
  }, [quarters]);

  const COL_W = 110;

  const renderCell = (q: HierarchyQuarter | undefined, metric: MetricKey, isGlobalRow: boolean) => {
    if (!q) return <td key="empty" className="border-r p-1.5" style={{ minWidth: COL_W }} />;

    const modelVal = getMetricValue(q, metric, "model");
    const actualVal = q.isHistorical ? getMetricValue(q, metric, "actual") : null;
    const rag = getMetricRag(q, metric);

    return (
      <td className={`border-r p-1.5 text-right ${q.isHistorical ? "" : "bg-blue-50/30"}`} style={{ minWidth: COL_W }}>
        <div className="flex items-center justify-end gap-1">
          <span className={`font-mono text-[11px] ${isGlobalRow ? "font-semibold" : ""}`}>{modelVal.display}</span>
        </div>
        {q.isHistorical && actualVal && actualVal.raw > 0 && (
          <div className="flex items-center justify-end gap-0.5 mt-0.5">
            <span className="font-mono text-[10px] text-emerald-700">{actualVal.display}</span>
            <RagDot status={rag} />
          </div>
        )}
      </td>
    );
  };

  const renderMetricRow = (
    metric: MetricKey,
    metricLabel: string,
    row: HierarchyRow,
    indent: number,
    isExpandable: boolean,
    isExpanded: boolean,
    onToggle?: () => void,
    bold: boolean = false,
  ) => {
    const rowQuarters = visibleQuarters.map(vq => row.quarters.find(rq => rq.year === vq.year && rq.quarter === vq.quarter));
    const bgClass = indent === 0 ? "bg-slate-100" : indent === 1 ? "bg-slate-50/70" : "";

    return (
      <tr key={`${row.id}-${metric}`} className={`border-b hover:bg-muted/20 ${bgClass}`}>
        <td className={`p-1.5 border-r sticky left-0 z-10 ${bgClass || "bg-white"}`} style={{ paddingLeft: indent * 20 + 8 }}>
          <div className="flex items-center gap-1.5">
            {isExpandable ? (
              <button onClick={onToggle} className="p-0.5 rounded hover:bg-muted">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4.5" />
            )}
            <span className={`text-[11px] ${bold ? "font-semibold" : "font-normal"} truncate`}>{metricLabel}</span>
          </div>
        </td>
        {rowQuarters.map((rq, qi) => (
          <Fragment key={qi}>{renderCell(rq, metric, indent === 0)}</Fragment>
        ))}
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b-2">
            <th className="text-left p-2 border-r sticky left-0 z-10 bg-slate-100 min-w-[200px]">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] font-semibold">Cascade Hierarchy</span>
              </div>
            </th>
            {visibleQuarters.map(q => (
              <th key={`${q.year}-${q.quarter}`} className={`text-center p-2 border-r text-[11px] font-semibold ${q.label.includes(String(new Date().getFullYear()).slice(2)) ? "" : ""}`} style={{ minWidth: COL_W }}>
                <div>{q.label}</div>
                <div className="text-[8px] text-muted-foreground font-normal mt-0.5">Model / Actual</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map(({ key, label }) => {
            const isMetricExpanded = expandedMetrics.has(key);
            return (
              <Fragment key={key}>
                {/* Global row for this metric */}
                {renderMetricRow(key, label, global, 0, regions.length > 0, isMetricExpanded, () => toggleMetric(key), true)}

                {/* Pod (region) rows under this metric */}
                {isMetricExpanded && regions.map((region, ri) => {
                  const podKey = `${key}-${region.id}`;
                  const isPodExpanded = expandedPods.has(podKey);
                  const hasMotions = (motions[ri]?.length ?? 0) > 0;
                  return (
                    <Fragment key={podKey}>
                      {renderMetricRow(key, region.label, region, 1, hasMotions, isPodExpanded, () => togglePod(podKey))}

                      {/* Method (motion) rows under this pod */}
                      {isPodExpanded && motions[ri]?.map(motion => (
                        <Fragment key={`${podKey}-${motion.id}`}>
                          {renderMetricRow(key, motion.label, motion, 2, false, false)}
                        </Fragment>
                      ))}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
