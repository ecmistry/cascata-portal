import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, TrendingUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  revenueNew: number;
  revenueUpsell: number;
  actualRevenueNew: number | null;
  actualRevenueUpsell: number | null;
  customerCount: number;
  attachRate: number;
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

function RagDot({ status }: { status: RagStatus | null }) {
  if (!status) return <Minus className="h-2.5 w-2.5 text-muted-foreground/30" />;
  const colors: Record<RagStatus, string> = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status]}`} />;
}

function RScoreBadge({ score }: { score?: number }) {
  if (score == null || !isFinite(score)) return null;
  const pct = (score * 100).toFixed(0);
  const isGood = score >= 0.7;
  const isFair = score >= 0.4;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 cursor-help ${
              isGood ? "border-emerald-400 text-emerald-700" :
              isFair ? "border-amber-400 text-amber-700" :
              "border-red-400 text-red-700"
            }`}
          >
            R: {pct}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Pearson R = {score.toFixed(3)} ({isGood ? "strong" : isFair ? "moderate" : "weak"} correlation)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function fmt(n: number | null): string {
  if (n == null || n === 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function fmtRevenue(cents: number): string {
  if (cents === 0) return "";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toFixed(0)}`;
}

function fmtPct(basisPoints: number): string {
  if (basisPoints === 0) return "";
  return `${(basisPoints * 100).toFixed(1)}%`;
}

function MetricCellView({ cell, isHistorical }: { cell: MetricCell; isHistorical: boolean }) {
  return (
    <div className="flex items-center gap-1 justify-end">
      <span className="font-mono text-[10px]">{fmt(cell.model)}</span>
      {isHistorical && cell.actual != null && (
        <>
          <span className="text-muted-foreground text-[8px]">/</span>
          <span className="font-mono text-[10px] text-emerald-700 font-medium">{fmt(cell.actual)}</span>
          <RagDot status={cell.rag} />
        </>
      )}
    </div>
  );
}

export default function HierarchicalCascade({ quarters, global, regions, motions }: Props) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  const toggleRegion = (regionId: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });
  };

  // Show recent quarters (last 6 completed + 2 future)
  const visibleQuarters = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curQ = Math.ceil((now.getMonth() + 1) / 3);
    const sorted = [...quarters].sort((a, b) => (a.year * 4 + a.quarter) - (b.year * 4 + b.quarter));

    const histIdx = sorted.findIndex(q => q.year === curY && q.quarter === curQ);
    const endIdx = histIdx !== -1 ? Math.min(histIdx + 2, sorted.length) : sorted.length;
    const startIdx = Math.max(endIdx - 8, 0);
    return sorted.slice(startIdx, endIdx);
  }, [quarters]);

  const COL_W = 90;

  const renderRow = (row: HierarchyRow, indent: number, isExpandable: boolean, isExpanded: boolean, onToggle?: () => void) => {
    const rowQuarters = visibleQuarters.map(vq => {
      return row.quarters.find(rq => rq.year === vq.year && rq.quarter === vq.quarter);
    });

    const levelBg = row.level === 1 ? "bg-slate-100" : row.level === 2 ? "bg-slate-50" : "";
    const fontWeight = row.level <= 2 ? "font-semibold" : "font-normal";

    return (
      <tr key={row.id} className={`border-b hover:bg-muted/20 ${levelBg}`}>
        <td className={`p-1.5 border-r sticky left-0 z-10 ${levelBg || "bg-white"}`} style={{ paddingLeft: indent * 16 + 8 }}>
          <div className="flex items-center gap-1.5">
            {isExpandable ? (
              <button onClick={onToggle} className="p-0.5 rounded hover:bg-muted">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className={`text-[11px] ${fontWeight}`}>{row.label}</span>
            <RScoreBadge score={row.rScore} />
          </div>
        </td>
        {rowQuarters.map((rq, qi) => (
          <td key={qi} className="border-r p-1" style={{ minWidth: COL_W }}>
            {rq ? (
              <div className="space-y-0.5">
                <MetricCellView cell={rq.sql} isHistorical={rq.isHistorical} />
                <MetricCellView cell={rq.ocr} isHistorical={rq.isHistorical} />
                {(rq.revenueNew > 0 || rq.revenueUpsell > 0 || (rq.actualRevenueNew != null && rq.actualRevenueNew > 0)) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <div className="flex items-center gap-1 justify-end">
                            <span className="font-mono text-[10px] text-blue-700">{fmtRevenue(rq.revenueNew)}</span>
                            {rq.revenueUpsell > 0 && (
                              <>
                                <span className="text-muted-foreground text-[8px]">+</span>
                                <span className="font-mono text-[10px] text-violet-700">{fmtRevenue(rq.revenueUpsell)}</span>
                              </>
                            )}
                          </div>
                          {rq.isHistorical && rq.actualRevenueNew != null && (rq.actualRevenueNew > 0 || (rq.actualRevenueUpsell ?? 0) > 0) && (
                            <div className="flex items-center gap-1 justify-end">
                              <span className="font-mono text-[9px] text-emerald-700">{fmtRevenue(rq.actualRevenueNew)}</span>
                              {(rq.actualRevenueUpsell ?? 0) > 0 && (
                                <>
                                  <span className="text-muted-foreground text-[7px]">+</span>
                                  <span className="font-mono text-[9px] text-emerald-600">{fmtRevenue(rq.actualRevenueUpsell ?? 0)}</span>
                                </>
                              )}
                              {rq.targetRag?.revenue && <RagDot status={rq.targetRag.revenue} />}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs space-y-1">
                        <div className="font-semibold border-b pb-1 mb-1">Model Forecast</div>
                        <div>New Biz: {fmtRevenue(rq.revenueNew)}</div>
                        <div>Upsell: {fmtRevenue(rq.revenueUpsell)}</div>
                        {rq.isHistorical && rq.actualRevenueNew != null && (
                          <>
                            <div className="font-semibold border-b pb-1 mb-1 mt-2">Actuals</div>
                            <div>New Biz: {fmtRevenue(rq.actualRevenueNew)}</div>
                            <div>Upsell: {fmtRevenue(rq.actualRevenueUpsell ?? 0)}</div>
                          </>
                        )}
                        {rq.target && (
                          <>
                            <div className="font-semibold border-b pb-1 mb-1 mt-2">Target</div>
                            <div>Revenue: {fmtRevenue(rq.target.revenueTotal)}</div>
                            {rq.target.sqls > 0 && <div>SQLs: {rq.target.sqls}</div>}
                            {rq.target.opps > 0 && <div>Opps: {rq.target.opps}</div>}
                          </>
                        )}
                        {rq.customerCount > 0 && <div className="mt-1">Customers: {rq.customerCount}</div>}
                        {rq.attachRate > 0 && <div>Attach Rate: {fmtPct(rq.attachRate)}</div>}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {rq.target && rq.isHistorical && rq.targetRag && (
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    {rq.targetRag.sql && (
                      <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">S<RagDot status={rq.targetRag.sql} /></span>
                    )}
                    {rq.targetRag.ocr && (
                      <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">O<RagDot status={rq.targetRag.ocr} /></span>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b-2">
            <th className="text-left p-2 border-r sticky left-0 z-10 bg-slate-100 min-w-[180px]">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] font-semibold">Hierarchy</span>
              </div>
            </th>
            {visibleQuarters.map(q => (
              <th key={`${q.year}-${q.quarter}`} className="text-center p-2 border-r text-[10px] font-semibold" style={{ minWidth: COL_W }}>
                <div>{q.label}</div>
                <div className="flex justify-center gap-2 text-[8px] text-muted-foreground font-normal mt-0.5">
                  <span>M/A · Rev · Tgt</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Global row */}
          {renderRow(global, 0, regions.length > 0, true)}

          {/* Region rows + their motion children */}
          {regions.map((region, ri) => {
            const isExpanded = expandedRegions.has(region.id);
            return (
              <>{/* use Fragment instead of wrapping div */}
                {renderRow(region, 1, true, isExpanded, () => toggleRegion(region.id))}
                {isExpanded && motions[ri]?.map(motion =>
                  renderRow(motion, 2, false, false)
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
