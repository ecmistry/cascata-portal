import { useMemo, useState } from "react";
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

// Year options for the 4-quarter selector
function getYearOptions(quarters: Array<{ year: number }>): number[] {
  const years = new Set(quarters.map(q => q.year));
  return Array.from(years).sort();
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

  // Year selector for 4-quarter focus
  const yearOptions = useMemo(() => {
    if (!cascadeData) return [];
    return getYearOptions(cascadeData.quarterColumns);
  }, [cascadeData]);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Determine the active year (default to current year or latest with data)
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

  // Get the 4-quarter window indices
  type QLabel = { year: number; quarter: number; label: string };
  const fourQWindow = useMemo(() => {
    if (!cascadeData) return { start: 0, end: 0, quarters: [] as QLabel[] };
    const startIdx = cascadeData.quarterColumns.findIndex(
      q => q.year === activeYear && q.quarter === 1
    );
    if (startIdx === -1) return { start: 0, end: 4, quarters: cascadeData.quarterColumns.slice(0, 4) };
    const endIdx = Math.min(startIdx + 4, cascadeData.quarterColumns.length);
    return {
      start: startIdx,
      end: endIdx,
      quarters: cascadeData.quarterColumns.slice(startIdx, endIdx),
    };
  }, [cascadeData, activeYear]);

  // Get rows that have data relevant to this 4-quarter window
  // (rows whose cascade values overlap with the window columns)
  const sqlVisibleRows = useMemo(() => {
    if (!cascadeData) return [];
    const { start, end } = fourQWindow;
    const sqlSpread = cascadeData.sqlProbabilities.length;
    const firstRow = Math.max(0, start - sqlSpread + 1);
    const lastRow = Math.min(cascadeData.rows.length - 1, end + sqlSpread - 1);
    return cascadeData.rows.slice(firstRow, lastRow + 1).filter(
      r => r.sqls > 0 || r.cascadeValues.some((v, idx) => idx >= start && idx < end && v > 0)
    );
  }, [cascadeData, fourQWindow]);

  const oppVisibleRows = useMemo(() => {
    if (!cascadeData) return [];
    const { start, end } = fourQWindow;
    const oppSpread = cascadeData.oppProbabilities.length;
    const firstRow = Math.max(0, start - oppSpread + 1);
    const lastRow = Math.min(cascadeData.oppRows.length - 1, end + oppSpread - 1);
    return cascadeData.oppRows.slice(firstRow, lastRow + 1).filter(
      r => r.opps > 0 || r.cascadeValues.some((v, idx) => idx >= start && idx < end && v > 0)
    );
  }, [cascadeData, fourQWindow]);

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
  const { start: wStart, end: wEnd, quarters: windowQuarters } = fourQWindow;

  // Column totals for the visible window
  const sqlWindowTotals = windowQuarters.map((_: QLabel, i: number) => cascadeData.totalOppsPerQuarter[wStart + i] || 0);
  const oppWindowTotals = windowQuarters.map((_: QLabel, i: number) => cascadeData.totalWonPerQuarter[wStart + i] || 0);

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

        {/* Two-Panel Cascade */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* LEFT PANEL: SQL Cascade */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 bg-amber-50/50 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>SQL &rarr; Opportunity Cascade</span>
                <Badge variant="outline" className="text-[10px] font-normal">Left of red bar</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                How SQLs convert to opportunities over time
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {/* SQL Probability Distribution */}
              <div className="px-4 py-2 bg-yellow-50/40 border-b">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                  SQL Timing Probability
                </p>
                <div className="flex gap-2 flex-wrap">
                  {cascadeData.sqlProbabilities.map((p, i) => (
                    <Badge
                      key={i}
                      variant={i === 0 ? "default" : "secondary"}
                      className="text-[10px] px-2 py-0.5"
                    >
                      {i === 0 ? "Same Q" : i === 1 ? "+1 Q" : `+${i} Q`}: {(p * 100).toFixed(0)}%
                    </Badge>
                  ))}
                </div>
              </div>

              {/* SQL Cascade Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] sm:text-xs border-collapse min-w-[400px]">
                  <thead>
                    <tr className="bg-cyan-100/60">
                      <th className="sticky left-0 z-10 bg-cyan-100/60 text-left p-1.5 sm:p-2 font-semibold border-r min-w-[60px]">
                        Quarter
                      </th>
                      <th className="text-right p-1.5 sm:p-2 font-semibold border-r min-w-[45px]">
                        SQLs
                      </th>
                      <th className="text-right p-1.5 sm:p-2 font-semibold border-r min-w-[42px]">
                        Conv
                      </th>
                      {windowQuarters.map((q: QLabel) => (
                        <th key={q.label} className="text-right p-1.5 sm:p-2 font-semibold min-w-[55px] border-r last:border-r-0">
                          {q.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlVisibleRows.map((row) => {
                      const globalRowIdx = cascadeData.quarterColumns.findIndex(
                        (q: QLabel) => q.year === row.quarter.year && q.quarter === row.quarter.quarter
                      );
                      const hasData = row.sqls > 0;

                      return (
                        <tr
                          key={row.quarter.label}
                          className={`border-t hover:bg-muted/20 ${!hasData ? "text-muted-foreground/50" : ""}`}
                        >
                          <td className="sticky left-0 z-10 bg-white p-1.5 sm:p-2 font-medium border-r text-yellow-800 bg-yellow-50/30">
                            {row.quarter.label}
                          </td>
                          <td className="text-right p-1.5 sm:p-2 font-mono border-r">
                            {row.sqls > 0 ? row.sqls : ""}
                          </td>
                          <td className="text-right p-1.5 sm:p-2 font-mono border-r">
                            {row.sqls > 0 ? pctFmt(row.conversionRate) : ""}
                          </td>
                          {windowQuarters.map((colQ: QLabel, colIdx: number) => {
                            const globalColIdx = wStart + colIdx;
                            const value = row.cascadeValues[globalColIdx] || 0;
                            const isDiagonal = globalColIdx >= globalRowIdx &&
                              globalColIdx < globalRowIdx + cascadeData.sqlProbabilities.length;
                            const isSameQuarter = globalColIdx === globalRowIdx;

                            return (
                              <td
                                key={colQ.label}
                                className={`text-right p-1.5 sm:p-2 font-mono border-r last:border-r-0 ${
                                  isSameQuarter && value > 0
                                    ? "bg-blue-100 font-semibold text-blue-900"
                                    : isDiagonal && value > 0
                                      ? "bg-blue-50 text-blue-800"
                                      : ""
                                }`}
                              >
                                {fmt(value)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Totals Row */}
                    <tr className="border-t-2 border-black bg-cyan-100/60 font-semibold">
                      <td className="sticky left-0 z-10 bg-cyan-100/60 p-1.5 sm:p-2 border-r text-[9px] sm:text-xs" colSpan={3}>
                        Total Opps Created
                      </td>
                      {windowQuarters.map((q: QLabel, colIdx: number) => (
                        <td key={q.label} className="text-right p-1.5 sm:p-2 font-mono border-r last:border-r-0">
                          {fmt(sqlWindowTotals[colIdx])}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Vertical Red Bar (visible on xl screens) */}
          {/* On smaller screens the panels stack, so the red bar is horizontal */}

          {/* RIGHT PANEL: Opportunity Cascade */}
          <Card className="overflow-hidden border-l-4 border-l-red-500 xl:border-l-4">
            <CardHeader className="pb-2 bg-red-50/30 border-b">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Opportunity &rarr; Deal Win Cascade</span>
                <Badge variant="outline" className="text-[10px] font-normal">Right of red bar</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                How opportunities convert to won deals over time
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {/* Opp Probability Distribution */}
              <div className="px-4 py-2 bg-red-50/20 border-b">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                  Opp Win Timing Probability
                </p>
                <div className="flex gap-2 flex-wrap">
                  {cascadeData.oppProbabilities.map((p, i) => (
                    <Badge
                      key={i}
                      variant={i === 0 ? "default" : "secondary"}
                      className="text-[10px] px-2 py-0.5"
                    >
                      {i === 0 ? "Same Q" : i === 1 ? "+1 Q" : `+${i} Q`}: {(p * 100).toFixed(0)}%
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Opp Cascade Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] sm:text-xs border-collapse min-w-[400px]">
                  <thead>
                    <tr className="bg-cyan-100/60">
                      <th className="sticky left-0 z-10 bg-cyan-100/60 text-left p-1.5 sm:p-2 font-semibold border-r min-w-[60px]">
                        Quarter
                      </th>
                      <th className="text-right p-1.5 sm:p-2 font-semibold border-r min-w-[45px]">
                        Opps
                      </th>
                      {windowQuarters.map((q: QLabel) => (
                        <th key={q.label} className="text-right p-1.5 sm:p-2 font-semibold min-w-[55px] border-r last:border-r-0">
                          {q.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {oppVisibleRows.map((row) => {
                      const globalRowIdx = cascadeData.quarterColumns.findIndex(
                        (q: QLabel) => q.year === row.quarter.year && q.quarter === row.quarter.quarter
                      );
                      const hasData = row.opps > 0;

                      return (
                        <tr
                          key={row.quarter.label}
                          className={`border-t hover:bg-muted/20 ${!hasData ? "text-muted-foreground/50" : ""}`}
                        >
                          <td className="sticky left-0 z-10 bg-white p-1.5 sm:p-2 font-medium border-r text-cyan-800 bg-cyan-50/30">
                            {row.quarter.label}
                          </td>
                          <td className="text-right p-1.5 sm:p-2 font-mono border-r">
                            {row.opps > 0 ? fmt(row.opps) : ""}
                          </td>
                          {windowQuarters.map((colQ: QLabel, colIdx: number) => {
                            const globalColIdx = wStart + colIdx;
                            const value = row.cascadeValues[globalColIdx] || 0;
                            const isDiagonal = globalColIdx >= globalRowIdx &&
                              globalColIdx < globalRowIdx + cascadeData.oppProbabilities.length;
                            const isSameQuarter = globalColIdx === globalRowIdx;

                            return (
                              <td
                                key={colQ.label}
                                className={`text-right p-1.5 sm:p-2 font-mono border-r last:border-r-0 ${
                                  isSameQuarter && value > 0
                                    ? "bg-emerald-100 font-semibold text-emerald-900"
                                    : isDiagonal && value > 0
                                      ? "bg-emerald-50 text-emerald-800"
                                      : ""
                                }`}
                              >
                                {fmt(value)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Totals Row */}
                    <tr className="border-t-2 border-black bg-cyan-100/60 font-semibold">
                      <td className="sticky left-0 z-10 bg-cyan-100/60 p-1.5 sm:p-2 border-r text-[9px] sm:text-xs" colSpan={2}>
                        Total Deals Won
                      </td>
                      {windowQuarters.map((q: QLabel, colIdx: number) => (
                        <td key={q.label} className="text-right p-1.5 sm:p-2 font-mono border-r last:border-r-0">
                          {fmt(oppWindowTotals[colIdx])}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
