import { useMemo, useState, useRef } from "react";
import { useParams, useLocation, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, Percent, DollarSign, Target, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type QLabel = { year: number; quarter: number; label: string };

function fmt(n: number, decimals = 1): string {
  if (n === 0) return "";
  return n.toFixed(decimals);
}

function pctFmt(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function currFmt(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

interface DqData {
  coveragePct: number;
  contactsFetched: number;
  contactsUsed: number;
  contactsSkipped: number;
  dealsFetched: number;
  dealsUsed: number;
  dealsSkipped: number;
  syncTimestamp: string | Date;
  report?: {
    unmappedRegionValues?: Record<string, number>;
    unmappedSqlTypeValues?: Record<string, number>;
  } | null;
}

function DataCoverageBadge({ dq }: { dq: DqData }) {
  const pct = dq.coveragePct;
  const isGood = pct >= 90;
  const isWarning = pct >= 70 && pct < 90;
  const isBad = pct < 70;
  const badgeVariant = isGood ? "default" : isWarning ? "secondary" : "destructive";
  const Icon = isGood ? CheckCircle2 : isBad ? AlertCircle : AlertTriangle;
  const unmappedRegions = dq.report?.unmappedRegionValues ?? {};
  const unmappedSqlTypes = dq.report?.unmappedSqlTypeValues ?? {};
  const hasUnmapped = Object.keys(unmappedRegions).length > 0 || Object.keys(unmappedSqlTypes).length > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={badgeVariant} className={`cursor-help gap-1 text-xs ${isGood ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}`}>
            <Icon className="h-3 w-3" />
            {pct.toFixed(0)}% data coverage
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <p className="font-semibold">Data Quality Summary</p>
            <p>Contacts: {dq.contactsUsed} of {dq.contactsFetched} used ({pct.toFixed(1)}%)</p>
            <p>Deals: {dq.dealsUsed} of {dq.dealsFetched} used</p>
            {hasUnmapped && (
              <div className="border-t pt-1.5 mt-1.5">
                {Object.entries(unmappedRegions).length > 0 && (
                  <p className="text-amber-600">Unmapped regions: {Object.entries(unmappedRegions).map(([k,v]) => `${k} (${v})`).join(", ")}</p>
                )}
                {Object.entries(unmappedSqlTypes).length > 0 && (
                  <p className="text-amber-600">Unmapped SQL types: {Object.entries(unmappedSqlTypes).map(([k,v]) => `${k} (${v})`).join(", ")}</p>
                )}
              </div>
            )}
            {!isGood && (
              <p className="border-t pt-1.5 mt-1.5 text-muted-foreground">
                Visit Data Quality page for details and fixes
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const COL_W = 56;

interface PanelRow {
  quarter: QLabel;
  inputValue: number;
  conversionRate?: number;
  cascadeValues: number[];
  actualInput?: number | null;
  isHistorical?: boolean;
}

/**
 * Renders a cascade table (no Card wrapper) for embedding side-by-side.
 */
function CascadeTable({
  label,
  probabilities,
  quarters,
  rows,
  totals,
  actualTotals,
  showSqlsCols,
  variant,
}: {
  label: string;
  probabilities: number[];
  quarters: QLabel[];
  rows: PanelRow[];
  totals: number[];
  actualTotals?: (number | null)[];
  showSqlsCols: boolean;
  variant: "sql" | "opp";
}) {
  const isSql = variant === "sql";
  const probBg = isSql ? "bg-yellow-50/60" : "bg-gray-50/60";
  const diagColor = isSql ? "bg-blue-100 text-blue-900" : "bg-emerald-100 text-emerald-900";
  const diagFaint = isSql ? "bg-blue-50/70 text-blue-700" : "bg-emerald-50/70 text-emerald-700";
  const labelBg = isSql ? "bg-yellow-50/50 text-yellow-900" : "bg-cyan-50/50 text-cyan-900";
  const cyanBg = "bg-cyan-100/70";

  const visibleRows = rows.filter(r => r.inputValue > 0 || r.cascadeValues.some(v => v > 0));
  const probRows = quarters.filter((_: QLabel, idx: number) => idx + probabilities.length - 1 < quarters.length);

  const hasActuals = rows.some(r => r.actualInput != null);
  const fixedW = showSqlsCols ? (hasActuals ? 190 : 150) : (hasActuals ? 148 : 108);
  const totalW = fixedW + quarters.length * COL_W;

  return (
    <table className="text-[9px] sm:text-[10px] border-collapse" style={{ width: totalW, minWidth: totalW }}>
      {/* Panel label row */}
      <thead>
        <tr>
          <th
            colSpan={(showSqlsCols ? 3 : 2) + (hasActuals ? 1 : 0) + quarters.length}
            className={`text-left p-1.5 text-xs font-bold border-b ${isSql ? "bg-amber-50/70 text-amber-900" : "bg-red-50/50 text-red-900"}`}
          >
            {label}
          </th>
        </tr>
        {/* Probability matrix header */}
        <tr className={probBg}>
          <th className={`text-left p-1 font-semibold border-r ${probBg}`} style={{ width: 60, minWidth: 60 }}>
            Prob.
          </th>
          {showSqlsCols && (
            <>
              <th className={`p-1 border-r ${probBg}`} style={{ width: 45, minWidth: 45 }}></th>
              <th className={`p-1 border-r ${probBg}`} style={{ width: 42, minWidth: 42 }}></th>
            </>
          )}
          {!showSqlsCols && (
            <th className={`p-1 border-r ${probBg}`} style={{ width: 45, minWidth: 45 }}></th>
          )}
          {hasActuals && <th className={`p-1 border-r ${probBg}`} style={{ width: 40, minWidth: 40 }}></th>}
          {quarters.map((q: QLabel) => (
            <th key={`ph-${q.label}`} className={`text-right p-1 font-semibold border-r last:border-r-0 ${probBg}`} style={{ width: COL_W, minWidth: COL_W }}>
              {q.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* Probability matrix rows */}
        {probRows.map((rowQ: QLabel, rowIdx: number) => (
          <tr key={`p-${rowQ.label}`} className={`border-t ${probBg}`}>
            <td className={`p-1 font-medium border-r ${labelBg}`}>{rowQ.label}</td>
            {showSqlsCols ? <><td className={`p-1 border-r ${probBg}`}></td><td className={`p-1 border-r ${probBg}`}></td></> :
             <td className={`p-1 border-r ${probBg}`}></td>}
            {hasActuals && <td className={`p-1 border-r ${probBg}`}></td>}
            {quarters.map((_: QLabel, colIdx: number) => {
              const off = colIdx - rowIdx;
              const isP = off >= 0 && off < probabilities.length;
              const val = isP ? probabilities[off] : 0;
              return (
                <td key={`p-${rowQ.label}-${colIdx}`}
                  className={`text-right p-1 font-mono border-r last:border-r-0 ${
                    off === 0 && val > 0 ? diagColor + " font-semibold" :
                    isP && val > 0 ? diagFaint : probBg
                  }`}
                  style={{ width: COL_W, minWidth: COL_W }}
                >
                  {isP && val > 0 ? (val * 100).toFixed(0) + "%" : ""}
                </td>
              );
            })}
          </tr>
        ))}

        {/* Cyan header separator */}
        <tr className={`${cyanBg} border-t-2 border-black`}>
          <td className={`p-1.5 font-semibold border-r ${cyanBg}`}></td>
          {showSqlsCols ? (
            <>
              <td className={`text-right p-1.5 font-semibold border-r ${cyanBg}`}>SQLs</td>
              <td className={`text-right p-1.5 font-semibold border-r ${cyanBg}`}>Conv</td>
            </>
          ) : (
            <td className={`text-right p-1.5 font-semibold border-r ${cyanBg}`}>Opps</td>
          )}
          {hasActuals && <td className={`text-right p-1.5 font-semibold border-r ${cyanBg} text-emerald-700`}>Act</td>}
          {quarters.map((q: QLabel) => (
            <td key={`h-${q.label}`} className={`text-right p-1.5 font-semibold border-r last:border-r-0 ${cyanBg}`}>{q.label}</td>
          ))}
        </tr>

        {/* Cascade data rows */}
        {visibleRows.map((row) => {
          const gIdx = quarters.findIndex((q: QLabel) => q.year === row.quarter.year && q.quarter === row.quarter.quarter);
          const has = row.inputValue > 0;
          return (
            <tr key={`d-${row.quarter.label}`} className={`border-t hover:bg-muted/20 ${!has ? "text-muted-foreground/40" : ""}`}>
              <td className="p-1 font-medium border-r bg-cyan-50/30 text-cyan-900">{row.quarter.label}</td>
              {showSqlsCols ? (
                <>
                  <td className="text-right p-1 font-mono border-r">{has ? row.inputValue : ""}</td>
                  <td className="text-right p-1 font-mono border-r">{has && row.conversionRate !== undefined ? pctFmt(row.conversionRate) : ""}</td>
                </>
              ) : (
                <td className="text-right p-1 font-mono border-r">{has ? fmt(row.inputValue) : ""}</td>
              )}
              {hasActuals && (
                <td className={`text-right p-1 font-mono border-r ${row.isHistorical ? "font-medium text-emerald-700" : "text-muted-foreground/40"}`}>
                  {row.isHistorical && row.actualInput != null ? fmt(row.actualInput, 0) : "—"}
                </td>
              )}
              {quarters.map((_: QLabel, cIdx: number) => {
                const v = row.cascadeValues[cIdx] || 0;
                const off = cIdx - gIdx;
                const isD = off >= 0 && off < probabilities.length;
                return (
                  <td key={`v-${row.quarter.label}-${cIdx}`}
                    className={`text-right p-1 font-mono border-r last:border-r-0 ${
                      off === 0 && v > 0 ? diagColor + " font-semibold" :
                      isD && v > 0 ? diagFaint : ""
                    }`}
                  >{fmt(v)}</td>
                );
              })}
            </tr>
          );
        })}

        {/* Totals row */}
        <tr className={`border-t-2 border-black ${cyanBg} font-semibold`}>
          <td className={`p-1.5 border-r ${cyanBg} text-[8px] sm:text-[10px]`} colSpan={(showSqlsCols ? 3 : 2) + (hasActuals ? 1 : 0)}>
            {isSql ? "Total Opps Created" : "Total Deals Won"}
          </td>
          {quarters.map((q: QLabel, i: number) => (
            <td key={`t-${q.label}`} className={`text-right p-1.5 font-mono border-r last:border-r-0 ${cyanBg}`}>{fmt(totals[i])}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export default function CascadeSheet() {
  const params = useParams<{ motion?: string; region?: string }>();
  const [, setLocation] = useLocation();

  const { data: companies = [], isLoading: companiesLoading } = trpc.company.list.useQuery();
  const companyId = companies[0]?.id ?? 1;

  const { data: sheetsData, isLoading: sheetsLoading } = trpc.cascade.availableSheets.useQuery({ companyId });
  const sheets = sheetsData?.sheets ?? [];
  const motion = params.motion;
  const region = params.region;

  if (!motion && !region && sheets.length > 0) {
    return <Redirect to={`/cascade/${sheets[0].motion}/${sheets[0].region}`} />;
  }

  const currentSheet = sheets.find(s => s.motion === motion && s.region === region);

  const { data: cascadeData, isLoading, error } = trpc.cascade.sheet.useQuery(
    motion && region ? { companyId, motion, region } : { companyId, motion: "_", region: "_" },
    { enabled: !!motion && !!region, retry: 1 },
  );

  const { data: dqData } = trpc.cascade.dataQuality.useQuery({ companyId });

  // Quarter range filter
  const [startQKey, setStartQKey] = useState<string>("all");
  const [endQKey, setEndQKey] = useState<string>("all");

  const quarterOptions = useMemo(() => {
    if (!cascadeData) return [];
    return cascadeData.quarterColumns.map((q: QLabel) => ({ key: `${q.year}-${q.quarter}`, label: q.label }));
  }, [cascadeData]);

  const filteredQuarters = useMemo(() => {
    if (!cascadeData) return [];
    const all = cascadeData.quarterColumns;
    if (startQKey === "all" && endQKey === "all") return all;
    let si = 0, ei = all.length - 1;
    if (startQKey !== "all") {
      const [sy, sq] = startQKey.split("-").map(Number);
      const idx = all.findIndex((q: QLabel) => q.year === sy && q.quarter === sq);
      if (idx !== -1) si = idx;
    }
    if (endQKey !== "all") {
      const [ey, eq] = endQKey.split("-").map(Number);
      const idx = all.findIndex((q: QLabel) => q.year === ey && q.quarter === eq);
      if (idx !== -1) ei = idx;
    }
    if (si > ei) [si, ei] = [ei, si];
    return all.slice(si, ei + 1);
  }, [cascadeData, startQKey, endQKey]);

  const { sqlRows, oppRows, sqlTotals, oppTotals } = useMemo(() => {
    if (!cascadeData || filteredQuarters.length === 0)
      return { sqlRows: [], oppRows: [], sqlTotals: [], oppTotals: [] };
    const allQ = cascadeData.quarterColumns;
    const gi = filteredQuarters.map((fq: QLabel) => allQ.findIndex((q: QLabel) => q.year === fq.year && q.quarter === fq.quarter));
    return {
      sqlRows: cascadeData.rows.map((r: any) => ({
        quarter: r.quarter,
        inputValue: r.sqls,
        conversionRate: r.conversionRate,
        cascadeValues: gi.map(i => r.cascadeValues[i] || 0),
        actualInput: r.actualSqls ?? null,
        isHistorical: r.isHistorical ?? false,
      })),
      oppRows: cascadeData.oppRows.map((r: any) => ({
        quarter: r.quarter,
        inputValue: r.opps,
        cascadeValues: gi.map(i => r.cascadeValues[i] || 0),
        actualInput: r.actualWins ?? null,
        isHistorical: r.isHistorical ?? false,
      })),
      sqlTotals: gi.map(i => cascadeData.totalOppsPerQuarter[i] || 0),
      oppTotals: gi.map(i => cascadeData.totalWonPerQuarter[i] || 0),
    };
  }, [cascadeData, filteredQuarters]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isFiltered = startQKey !== "all" || endQKey !== "all";

  if (isLoading || companiesLoading || sheetsLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-96" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </DashboardLayout>
    );
  }

  if (sheets.length === 0) {
    return (
      <DashboardLayout>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          No cascade data available. Run a HubSpot sync first to populate SQL history.
        </CardContent></Card>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">{currentSheet?.label ?? "Cascade Sheet"}</h1>
          <Card className="border-destructive"><CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Failed to load cascade data</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
            </div>
          </CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!cascadeData) {
    return (
      <DashboardLayout>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          No data for this combination.
        </CardContent></Card>
      </DashboardLayout>
    );
  }

  const sheetKey = `${motion}/${region}`;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {currentSheet?.label ?? `${cascadeData.motionDisplay} ${cascadeData.regionDisplay}`}
              </h1>
              {dqData && <DataCoverageBadge dq={dqData} />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {cascadeData.motionDisplay} motion &middot; {cascadeData.regionDisplay}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
            <Select value={sheetKey} onValueChange={(v) => setLocation(`/cascade/${v}`)}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((s) => (
                  <SelectItem key={`${s.motion}/${s.region}`} value={`${s.motion}/${s.region}`}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">From:</span>
              <Select value={startQKey} onValueChange={setStartQKey}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {quarterOptions.map(qo => <SelectItem key={`f-${qo.key}`} value={qo.key}>{qo.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs font-medium text-muted-foreground">To:</span>
              <Select value={endQKey} onValueChange={setEndQKey}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {quarterOptions.map(qo => <SelectItem key={`t-${qo.key}`} value={qo.key}>{qo.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {isFiltered && (
                <Button variant="ghost" size="sm" className="h-9 text-xs"
                  onClick={() => { setStartQKey("all"); setEndQKey("all"); }}>
                  Reset
                </Button>
              )}
              <span className="text-[10px] text-muted-foreground hidden md:inline">
                {filteredQuarters.length} of {cascadeData.quarterColumns.length} quarters
              </span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Conversion Rate</CardTitle>
              <Percent className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{pctFmt(cascadeData.conversionRate)}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">SQL &rarr; Opp (avg)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Win Rate (New)</CardTitle>
              <Target className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{pctFmt(cascadeData.winRateNew)}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">New business</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Avg ACV (New)</CardTitle>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{currFmt(cascadeData.acvNew)}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">New deal average</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Avg ACV (Upsell)</CardTitle>
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold">{currFmt(cascadeData.acvUpsell)}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Upsell deal average</p>
            </CardContent>
          </Card>
        </div>

        {/* Side-by-side Cascade Panels with single horizontal scroll */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto" ref={scrollRef}>
              <div className="flex flex-row">
                {/* SQL Cascade (left of red bar) */}
                <div className="flex-shrink-0">
                  <CascadeTable
                    label="SQL → Opportunity Cascade"
                    probabilities={cascadeData.sqlProbabilities}
                    quarters={filteredQuarters}
                    rows={sqlRows}
                    totals={sqlTotals}
                    showSqlsCols={true}
                    variant="sql"
                  />
                </div>

                {/* Red vertical divider */}
                <div className="flex-shrink-0 w-1.5 bg-red-500 self-stretch" />

                {/* Opp Cascade (right of red bar) */}
                <div className="flex-shrink-0">
                  <CascadeTable
                    label="Opportunity → Deal Win Cascade"
                    probabilities={cascadeData.oppProbabilities}
                    quarters={filteredQuarters}
                    rows={oppRows}
                    totals={oppTotals}
                    showSqlsCols={false}
                    variant="opp"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Summary Strip */}
        <CascadeRevenueSummary companyId={companyId} quarters={filteredQuarters} />
      </div>
    </DashboardLayout>
  );
}

function CascadeRevenueSummary({ companyId, quarters }: { companyId: number; quarters: QLabel[] }) {
  const { data: carrData } = trpc.carr.summary.useQuery(
    { companyId },
    { enabled: companyId > 0 },
  );

  if (!carrData || carrData.global.length === 0 || quarters.length === 0) return null;

  const qKeySet = new Set(quarters.map(q => `${q.year}-${q.quarter}`));
  const filteredGlobal = carrData.global.filter(g => qKeySet.has(`${g.year}-${g.quarter}`));
  if (filteredGlobal.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Revenue Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-1.5 w-32 sticky left-0 bg-muted/40 z-10">Metric</th>
                {filteredGlobal.map(q => (
                  <th key={q.label} className="text-right p-1.5 min-w-[80px] border-l">{q.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-blue-50/30">
                <td className="p-1.5 text-blue-700 font-medium sticky left-0 bg-blue-50/30 z-10">New Bookings</td>
                {filteredGlobal.map((q, i) => (
                  <td key={i} className="p-1.5 text-right text-blue-700 border-l">{currFmt(q.newBookings / 100)}</td>
                ))}
              </tr>
              <tr className="border-b bg-violet-50/30">
                <td className="p-1.5 text-violet-700 font-medium sticky left-0 bg-violet-50/30 z-10">Upsell Bookings</td>
                {filteredGlobal.map((q, i) => (
                  <td key={i} className="p-1.5 text-right text-violet-700 border-l">{currFmt(q.upsellBookings / 100)}</td>
                ))}
              </tr>
              <tr className="border-b bg-red-50/30">
                <td className="p-1.5 text-red-700 font-medium sticky left-0 bg-red-50/30 z-10">Churn</td>
                {filteredGlobal.map((q, i) => (
                  <td key={i} className="p-1.5 text-right text-red-700 border-l">{q.churn > 0 ? `-${currFmt(q.churn / 100)}` : "$0"}</td>
                ))}
              </tr>
              <tr className="border-b-2 border-t bg-muted/30 font-bold">
                <td className="p-1.5 sticky left-0 bg-muted/30 z-10">Closing CARR</td>
                {filteredGlobal.map((q, i) => (
                  <td key={i} className="p-1.5 text-right border-l">{currFmt(q.closingCarr / 100)}</td>
                ))}
              </tr>
              {filteredGlobal.some(q => q.targetTotal > 0) && (
                <tr className="border-b">
                  <td className="p-1.5 text-purple-700 font-medium sticky left-0 bg-white z-10">Attainment</td>
                  {filteredGlobal.map((q, i) => {
                    const bookings = q.newBookings + q.upsellBookings;
                    const att = q.targetTotal > 0 ? Math.round((bookings / q.targetTotal) * 100) : 0;
                    const color = att >= 90 ? "text-emerald-700" : att >= 70 ? "text-amber-700" : att > 0 ? "text-red-700" : "text-muted-foreground";
                    return (
                      <td key={i} className={`p-1.5 text-right border-l font-semibold ${color}`}>
                        {q.targetTotal > 0 ? `${att}%` : "—"}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
