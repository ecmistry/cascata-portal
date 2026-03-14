import { useMemo } from "react";
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
import { TrendingUp, Percent, DollarSign, Target, AlertCircle } from "lucide-react";

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

  // If no motion/region in URL, redirect to the first available sheet
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

  const visibleRange = useMemo(() => {
    if (!cascadeData) return { start: 0, end: 0 };
    const firstDataIdx = cascadeData.rows.findIndex(r => r.sqls > 0);
    const start = Math.max(0, firstDataIdx - 1);
    const lastDataIdx = cascadeData.rows.findLastIndex(r => r.sqls > 0);
    const end = Math.min(cascadeData.quarterColumns.length, Math.max(lastDataIdx + 5, start + 12));
    return { start, end };
  }, [cascadeData]);

  const visibleQuarters = useMemo(() => {
    if (!cascadeData) return [];
    return cascadeData.quarterColumns.slice(visibleRange.start, visibleRange.end);
  }, [cascadeData, visibleRange]);

  const visibleRows = useMemo(() => {
    if (!cascadeData) return [];
    return cascadeData.rows.slice(visibleRange.start, visibleRange.end);
  }, [cascadeData, visibleRange]);

  const visibleTotals = useMemo(() => {
    if (!cascadeData) return [];
    return cascadeData.totalOppsPerQuarter.slice(visibleRange.start, visibleRange.end);
  }, [cascadeData, visibleRange]);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {currentSheet?.label ?? `${cascadeData.motionDisplay} ${cascadeData.regionDisplay}`}
            </h1>
            <p className="text-muted-foreground mt-1">
              {cascadeData.motionDisplay} motion &middot; {cascadeData.regionDisplay}
            </p>
          </div>
          <Select
            value={sheetKey}
            onValueChange={(v) => setLocation(`/cascade/${v}`)}
          >
            <SelectTrigger className="w-[280px]">
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
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pctFmt(cascadeData.conversionRate)}</div>
              <p className="text-xs text-muted-foreground">SQL &rarr; Opportunity (avg)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate (New)</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pctFmt(cascadeData.winRateNew)}</div>
              <p className="text-xs text-muted-foreground">New business</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg ACV (New)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currFmt(cascadeData.acvNew)}</div>
              <p className="text-xs text-muted-foreground">New deal average</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg ACV (Upsell)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currFmt(cascadeData.acvUpsell)}</div>
              <p className="text-xs text-muted-foreground">Upsell deal average</p>
            </CardContent>
          </Card>
        </div>

        {/* Probability Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">SQL Timing Probability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {cascadeData.sqlProbabilities.map((p, i) => (
                <Badge
                  key={i}
                  variant={i === 0 ? "default" : "secondary"}
                  className="text-sm px-3 py-1"
                >
                  {i === 0 ? "Same Qtr" : i === 1 ? "+1 Qtr" : `+${i} Qtr`}: {(p * 100).toFixed(0)}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cascade Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cascade Model</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="sticky left-0 z-10 bg-muted/60 text-left p-2 font-semibold border-r min-w-[70px]">
                      Quarter
                    </th>
                    <th className="text-right p-2 font-semibold border-r min-w-[55px]">
                      SQLs
                    </th>
                    <th className="text-right p-2 font-semibold border-r min-w-[50px]">
                      Conv
                    </th>
                    {visibleQuarters.map((q) => (
                      <th
                        key={q.label}
                        className="text-right p-2 font-semibold min-w-[62px] border-r last:border-r-0"
                      >
                        {q.label}
                      </th>
                    ))}
                    <th className="text-right p-2 font-semibold min-w-[65px] bg-blue-50 border-l-2 border-blue-200">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, rowIdx) => {
                    const globalRowIdx = visibleRange.start + rowIdx;
                    const hasData = row.sqls > 0;

                    return (
                      <tr
                        key={row.quarter.label}
                        className={`border-t hover:bg-muted/20 ${!hasData ? "text-muted-foreground/50" : ""}`}
                      >
                        <td className="sticky left-0 z-10 bg-white p-2 font-medium border-r">
                          {row.quarter.label}
                        </td>
                        <td className="text-right p-2 font-mono border-r">
                          {row.sqls > 0 ? row.sqls : ""}
                        </td>
                        <td className="text-right p-2 font-mono border-r">
                          {row.sqls > 0 ? pctFmt(row.conversionRate) : ""}
                        </td>
                        {visibleQuarters.map((colQ, colIdx) => {
                          const globalColIdx = visibleRange.start + colIdx;
                          const value = row.cascadeValues[globalColIdx] || 0;
                          const isDiagonal = globalColIdx >= globalRowIdx &&
                            globalColIdx < globalRowIdx + cascadeData.sqlProbabilities.length;
                          const isSameQuarter = globalColIdx === globalRowIdx;

                          return (
                            <td
                              key={colQ.label}
                              className={`text-right p-2 font-mono border-r last:border-r-0 ${
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
                        <td className="text-right p-2 font-mono font-semibold bg-blue-50 border-l-2 border-blue-200">
                          {fmt(row.totalOpps)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals Row */}
                  <tr className="border-t-2 border-black bg-muted/40 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted/40 p-2 border-r" colSpan={3}>
                      Total Opps Created
                    </td>
                    {visibleQuarters.map((q, colIdx) => {
                      const total = visibleTotals[colIdx] || 0;
                      return (
                        <td key={q.label} className="text-right p-2 font-mono border-r last:border-r-0">
                          {fmt(total)}
                        </td>
                      );
                    })}
                    <td className="text-right p-2 font-mono bg-blue-100 border-l-2 border-blue-200">
                      {fmt(visibleTotals.reduce((s, v) => s + v, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
