import { useMemo, useState, useRef, useEffect, useCallback } from "react";
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
import { TrendingUp, Percent, DollarSign, Target, AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
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
    skippedNoRegion?: number;
    skippedNoSqlType?: number;
    skippedNoSqlDate?: number;
    skippedUnmappedRegion?: number;
    skippedUnmappedSqlType?: number;
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
            {dq.contactsSkipped > 0 && (
              <p className="text-amber-600">{dq.contactsSkipped} contacts skipped</p>
            )}
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

function getYearOptions(quarters: Array<{ year: number }>): number[] {
  const years = new Set(quarters.map(q => q.year));
  return Array.from(years).sort();
}

// The column width for quarter cells (px)
const COL_W = 58;
const LABEL_COL_W = 64;
const SQLS_COL_W = 48;
const CONV_COL_W = 44;

/**
 * CascadePanel renders a single cascade panel (SQL or Opp) in the Excel format:
 *   Top section: Diagonal probability matrix (yellow/neutral bg)
 *   Separator:   Cyan header row
 *   Bottom:      Cascade data rows
 *   Footer:      Cyan totals row
 */
function CascadePanel({
  title,
  subtitle,
  probabilities,
  quarters,
  rows,
  totals,
  showSqlsCols,
  variant,
  scrollRef,
  onScroll,
}: {
  title: string;
  subtitle: string;
  probabilities: number[];
  quarters: QLabel[];
  rows: Array<{
    quarter: QLabel;
    inputValue: number;
    inputLabel: string;
    conversionRate?: number;
    cascadeValues: number[];
  }>;
  totals: number[];
  showSqlsCols: boolean;
  variant: "sql" | "opp";
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}) {
  const isSql = variant === "sql";
  const probBg = isSql ? "bg-yellow-50/60" : "bg-gray-50/60";
  const diagColor = isSql ? "bg-blue-100 text-blue-900" : "bg-emerald-100 text-emerald-900";
  const diagFaintColor = isSql ? "bg-blue-50/70 text-blue-700" : "bg-emerald-50/70 text-emerald-700";
  const labelBg = isSql ? "bg-yellow-50/50 text-yellow-900" : "bg-cyan-50/50 text-cyan-900";
  const headerBg = "bg-cyan-100/70";
  const totalBg = "bg-cyan-100/70";

  // Only show rows that have data or have cascade values
  const visibleRows = rows.filter(
    r => r.inputValue > 0 || r.cascadeValues.some(v => v > 0)
  );

  // Only show prob matrix rows that overlap with the quarter columns
  const probMatrixRows = quarters.filter((_q: QLabel, idx: number) => {
    for (let p = 0; p < probabilities.length; p++) {
      if (idx + p < quarters.length) return true;
    }
    return false;
  });

  return (
    <Card className={`overflow-hidden ${!isSql ? "border-l-4 border-l-red-500" : ""}`}>
      <CardHeader className={`pb-2 border-b ${isSql ? "bg-amber-50/50" : "bg-red-50/30"}`}>
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span dangerouslySetInnerHTML={{ __html: title }} />
          <Badge variant="outline" className="text-[10px] font-normal">
            {isSql ? "SQL Cascade" : "Opp Cascade"}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className="overflow-x-auto"
          ref={scrollRef}
          onScroll={onScroll}
        >
          <table className="text-[9px] sm:text-[10px] border-collapse" style={{ minWidth: LABEL_COL_W + (showSqlsCols ? SQLS_COL_W + CONV_COL_W : SQLS_COL_W) + quarters.length * COL_W }}>
            {/* ── Top Section: Probability Matrix (diagonal staircase) ── */}
            <thead>
              <tr className={probBg}>
                <th className={`sticky left-0 z-10 text-left p-1 font-semibold border-r ${probBg}`} style={{ minWidth: LABEL_COL_W }}>
                  Probability
                </th>
                {showSqlsCols && (
                  <>
                    <th className={`p-1 border-r ${probBg}`} style={{ minWidth: SQLS_COL_W }}></th>
                    <th className={`p-1 border-r ${probBg}`} style={{ minWidth: CONV_COL_W }}></th>
                  </>
                )}
                {!showSqlsCols && (
                  <th className={`p-1 border-r ${probBg}`} style={{ minWidth: SQLS_COL_W }}></th>
                )}
                {quarters.map((q: QLabel) => (
                  <th key={`ph-${q.label}`} className={`text-right p-1 font-semibold border-r last:border-r-0 ${probBg}`} style={{ minWidth: COL_W }}>
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {probMatrixRows.map((rowQ: QLabel, rowIdx: number) => (
                <tr key={`prob-${rowQ.label}`} className={`border-t ${probBg}`}>
                  <td className={`sticky left-0 z-10 p-1 font-medium border-r ${labelBg}`} style={{ minWidth: LABEL_COL_W }}>
                    {rowQ.label}
                  </td>
                  {showSqlsCols && (
                    <>
                      <td className={`p-1 border-r ${probBg}`}></td>
                      <td className={`p-1 border-r ${probBg}`}></td>
                    </>
                  )}
                  {!showSqlsCols && (
                    <td className={`p-1 border-r ${probBg}`}></td>
                  )}
                  {quarters.map((_colQ: QLabel, colIdx: number) => {
                    const offset = colIdx - rowIdx;
                    const isProb = offset >= 0 && offset < probabilities.length;
                    const probVal = isProb ? probabilities[offset] : 0;
                    const isFirst = offset === 0;

                    return (
                      <td
                        key={`prob-${rowQ.label}-${_colQ.label}`}
                        className={`text-right p-1 font-mono border-r last:border-r-0 ${
                          isFirst && probVal > 0 ? diagColor + " font-semibold" :
                          isProb && probVal > 0 ? diagFaintColor :
                          probBg
                        }`}
                        style={{ minWidth: COL_W }}
                      >
                        {isProb && probVal > 0 ? (probVal * 100).toFixed(0) + "%" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* ── Separator / Header Row (cyan) ── */}
              <tr className={`${headerBg} border-t-2 border-black`}>
                <td className={`sticky left-0 z-10 p-1.5 font-semibold border-r ${headerBg}`} style={{ minWidth: LABEL_COL_W }}>
                </td>
                {showSqlsCols ? (
                  <>
                    <td className={`text-right p-1.5 font-semibold border-r ${headerBg}`} style={{ minWidth: SQLS_COL_W }}>SQLs</td>
                    <td className={`text-right p-1.5 font-semibold border-r ${headerBg}`} style={{ minWidth: CONV_COL_W }}>Conv</td>
                  </>
                ) : (
                  <td className={`text-right p-1.5 font-semibold border-r ${headerBg}`} style={{ minWidth: SQLS_COL_W }}>Opps</td>
                )}
                {quarters.map((q: QLabel) => (
                  <td key={`hdr-${q.label}`} className={`text-right p-1.5 font-semibold border-r last:border-r-0 ${headerBg}`} style={{ minWidth: COL_W }}>
                    {q.label}
                  </td>
                ))}
              </tr>

              {/* ── Bottom Section: Cascade Data ── */}
              {visibleRows.map((row) => {
                const globalRowIdx = quarters.findIndex(
                  (q: QLabel) => q.year === row.quarter.year && q.quarter === row.quarter.quarter
                );
                const hasData = row.inputValue > 0;

                return (
                  <tr
                    key={`data-${row.quarter.label}`}
                    className={`border-t hover:bg-muted/20 ${!hasData ? "text-muted-foreground/40" : ""}`}
                  >
                    <td className={`sticky left-0 z-10 p-1 font-medium border-r ${isSql ? "bg-cyan-50/30 text-cyan-900" : "bg-cyan-50/30 text-cyan-900"}`} style={{ minWidth: LABEL_COL_W }}>
                      {row.quarter.label}
                    </td>
                    {showSqlsCols ? (
                      <>
                        <td className="text-right p-1 font-mono border-r" style={{ minWidth: SQLS_COL_W }}>
                          {hasData ? row.inputValue : ""}
                        </td>
                        <td className="text-right p-1 font-mono border-r" style={{ minWidth: CONV_COL_W }}>
                          {hasData && row.conversionRate !== undefined ? pctFmt(row.conversionRate) : ""}
                        </td>
                      </>
                    ) : (
                      <td className="text-right p-1 font-mono border-r" style={{ minWidth: SQLS_COL_W }}>
                        {hasData ? fmt(row.inputValue) : ""}
                      </td>
                    )}
                    {quarters.map((_colQ: QLabel, colIdx: number) => {
                      const value = row.cascadeValues[colIdx] || 0;
                      const offset = colIdx - globalRowIdx;
                      const isDiagonal = offset >= 0 && offset < probabilities.length;
                      const isFirst = offset === 0;

                      return (
                        <td
                          key={`val-${row.quarter.label}-${_colQ.label}`}
                          className={`text-right p-1 font-mono border-r last:border-r-0 ${
                            isFirst && value > 0 ? diagColor + " font-semibold" :
                            isDiagonal && value > 0 ? diagFaintColor :
                            ""
                          }`}
                          style={{ minWidth: COL_W }}
                        >
                          {fmt(value)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* ── Totals Row (cyan) ── */}
              <tr className={`border-t-2 border-black ${totalBg} font-semibold`}>
                <td
                  className={`sticky left-0 z-10 p-1.5 border-r ${totalBg} text-[8px] sm:text-[10px]`}
                  colSpan={showSqlsCols ? 3 : 2}
                  style={{ minWidth: LABEL_COL_W }}
                >
                  {isSql ? "Total Opps Created" : "Total Deals Won"}
                </td>
                {quarters.map((q: QLabel, colIdx: number) => (
                  <td key={`tot-${q.label}`} className={`text-right p-1.5 font-mono border-r last:border-r-0 ${totalBg}`} style={{ minWidth: COL_W }}>
                    {fmt(totals[colIdx])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CascadeSheet() {
  const params = useParams<{ motion?: string; region?: string }>();
  const [, setLocation] = useLocation();

  const { data: companies = [], isLoading: companiesLoading } = trpc.company.list.useQuery();
  const companyId = companies[0]?.id ?? 1;

  const { data: sheetsData, isLoading: sheetsLoading } = trpc.cascade.availableSheets.useQuery(
    { companyId },
  );

  const sheets = sheetsData?.sheets ?? [];
  const motion = params.motion;
  const region = params.region;

  if (!motion && !region && sheets.length > 0) {
    return <Redirect to={`/cascade/${sheets[0].motion}/${sheets[0].region}`} />;
  }

  const currentSheet = sheets.find(s => s.motion === motion && s.region === region);

  const { data: cascadeData, isLoading, error } = trpc.cascade.sheet.useQuery(
    motion && region
      ? { companyId, motion, region }
      : { companyId, motion: "_", region: "_" },
    { enabled: !!motion && !!region, retry: 1 },
  );

  const { data: dqData } = trpc.cascade.dataQuality.useQuery({ companyId });

  const yearOptions = useMemo(() => {
    if (!cascadeData) return [];
    return getYearOptions(cascadeData.quarterColumns);
  }, [cascadeData]);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const activeYear = useMemo(() => {
    if (selectedYear !== null) return selectedYear;
    if (!cascadeData) return currentYear;
    const yearsWithData = cascadeData.rows
      .filter(r => r.sqls > 0)
      .map(r => r.quarter.year);
    if (yearsWithData.length === 0) return currentYear;
    const latestDataYear = Math.max(...yearsWithData);
    return yearOptions.includes(currentYear) ? currentYear : latestDataYear;
  }, [selectedYear, cascadeData, yearOptions, currentYear]);

  // Scroll refs for synchronized scrolling between panels
  const sqlScrollRef = useRef<HTMLDivElement>(null);
  const oppScrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  const handleSqlScroll = useCallback(() => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    if (sqlScrollRef.current && oppScrollRef.current) {
      oppScrollRef.current.scrollLeft = sqlScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isScrolling.current = false; });
  }, []);

  const handleOppScroll = useCallback(() => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    if (oppScrollRef.current && sqlScrollRef.current) {
      sqlScrollRef.current.scrollLeft = oppScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isScrolling.current = false; });
  }, []);

  // Scroll to the selected year when it changes
  useEffect(() => {
    if (!cascadeData) return;
    const idx = cascadeData.quarterColumns.findIndex(
      (q: QLabel) => q.year === activeYear && q.quarter === 1
    );
    if (idx === -1) return;
    const fixedCols = LABEL_COL_W + SQLS_COL_W + CONV_COL_W;
    const scrollPos = idx * COL_W - 20;
    setTimeout(() => {
      sqlScrollRef.current?.scrollTo({ left: scrollPos, behavior: "smooth" });
      oppScrollRef.current?.scrollTo({ left: scrollPos, behavior: "smooth" });
    }, 100);
  }, [activeYear, cascadeData]);

  // Build panel data
  const sqlPanelRows = useMemo(() => {
    if (!cascadeData) return [];
    return cascadeData.rows.map(r => ({
      quarter: r.quarter,
      inputValue: r.sqls,
      inputLabel: "SQLs",
      conversionRate: r.conversionRate,
      cascadeValues: r.cascadeValues,
    }));
  }, [cascadeData]);

  const oppPanelRows = useMemo(() => {
    if (!cascadeData) return [];
    return cascadeData.oppRows.map(r => ({
      quarter: r.quarter,
      inputValue: r.opps,
      inputLabel: "Opps",
      cascadeValues: r.cascadeValues,
    }));
  }, [cascadeData]);

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
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No cascade data available. Run a HubSpot sync first to populate SQL history.
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">{currentSheet?.label ?? "Cascade Sheet"}</h1>
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Failed to load cascade data</p>
                  <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!cascadeData) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No data for this combination.
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const sheetKey = `${motion}/${region}`;
  const canGoPrev = yearOptions.indexOf(activeYear) > 0;
  const canGoNext = yearOptions.indexOf(activeYear) < yearOptions.length - 1;

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
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={sheetKey}
              onValueChange={(v) => setLocation(`/cascade/${v}`)}
            >
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((s) => (
                  <SelectItem key={`${s.motion}/${s.region}`} value={`${s.motion}/${s.region}`}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year Navigator */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={!canGoPrev}
                onClick={() => {
                  const idx = yearOptions.indexOf(activeYear);
                  if (idx > 0) setSelectedYear(yearOptions[idx - 1]);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={String(activeYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={!canGoNext}
                onClick={() => {
                  const idx = yearOptions.indexOf(activeYear);
                  if (idx < yearOptions.length - 1) setSelectedYear(yearOptions[idx + 1]);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                Scroll to year
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

        {/* Four-Quadrant Cascade Layout */}
        <div className="space-y-4">
          <CascadePanel
            title="SQL &rarr; Opportunity Cascade"
            subtitle="How SQLs convert to opportunities over time (left of red bar)"
            probabilities={cascadeData.sqlProbabilities}
            quarters={cascadeData.quarterColumns}
            rows={sqlPanelRows}
            totals={cascadeData.totalOppsPerQuarter}
            showSqlsCols={true}
            variant="sql"
            scrollRef={sqlScrollRef}
            onScroll={handleSqlScroll}
          />

          <CascadePanel
            title="Opportunity &rarr; Deal Win Cascade"
            subtitle="How opportunities convert to won deals over time (right of red bar)"
            probabilities={cascadeData.oppProbabilities}
            quarters={cascadeData.quarterColumns}
            rows={oppPanelRows}
            totals={cascadeData.totalWonPerQuarter}
            showSqlsCols={false}
            variant="opp"
            scrollRef={oppScrollRef}
            onScroll={handleOppScroll}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
