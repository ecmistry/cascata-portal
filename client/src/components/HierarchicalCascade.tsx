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
                  <span>M/A</span>
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
