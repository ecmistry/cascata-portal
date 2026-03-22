import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Plus, TrendingUp, TrendingDown, DollarSign, Target, Zap, BarChart3, Filter, Home, ChevronDown, ChevronRight, Activity, Users } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ConversionFunnel } from "@/components/ConversionFunnel";
import DashboardLayout from "@/components/DashboardLayout";
import HierarchicalCascade from "@/components/HierarchicalCascade";
import type { Forecast, Region, SqlType, SqlHistory, ConversionRate } from "@/types/api";

function RScoreCard({ score, label }: { score: number | undefined; label: string }) {
  const isValid = score != null && isFinite(score);
  const pct = isValid ? Math.round(score * 100) : 0;
  const isGood = isValid && score >= 0.7;
  const isFair = isValid && score >= 0.4;
  const borderColor = !isValid ? "border-slate-200" :
    isGood ? "border-emerald-300" : isFair ? "border-amber-300" : "border-red-300";
  const textColor = !isValid ? "text-slate-400" :
    isGood ? "text-emerald-700" : isFair ? "text-amber-700" : "text-red-700";

  return (
    <Card className={`border-2 ${borderColor}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <div className={`text-2xl font-bold ${textColor}`}>
          {isValid ? `${pct}%` : "N/A"}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {!isValid ? "Insufficient data" : isGood ? "Strong correlation" : isFair ? "Moderate correlation" : "Weak correlation"}
        </p>
      </CardContent>
    </Card>
  );
}

function UpsellSummaryCard({ data }: { data: any }) {
  if (!data) return null;

  const allQuarters = data.global?.quarters ?? [];
  const futureQ = allQuarters.filter((q: any) => !q.isHistorical);
  const nextQ = futureQ.length > 0 ? futureQ[0] : null;

  const totalFutureUpsell = futureQ.reduce((sum: number, q: any) => sum + (q.revenueUpsell ?? 0), 0);
  const totalFutureNew = futureQ.reduce((sum: number, q: any) => sum + (q.revenueNew ?? 0), 0);
  const pct = (totalFutureNew + totalFutureUpsell) > 0
    ? Math.round((totalFutureUpsell / (totalFutureNew + totalFutureUpsell)) * 100)
    : 0;

  const fmtDollars = (cents: number) => {
    const d = cents / 100;
    if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
    if (d >= 1_000) return `$${(d / 1_000).toFixed(0)}K`;
    return `$${d.toFixed(0)}`;
  };

  return (
    <Card className="border-2 border-violet-200">
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-1">Upsell Forecast</p>
        <div className="text-2xl font-bold text-violet-700">
          {totalFutureUpsell > 0 ? fmtDollars(totalFutureUpsell) : "N/A"}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {pct > 0 ? `${pct}% of total forecast` : "No upsell data"}
          {nextQ?.customerCount > 0 && ` · ${nextQ.customerCount} customers`}
        </p>
      </CardContent>
    </Card>
  );
}

function RagSummaryCard({ data }: { data: any }) {
  if (!data) return null;

  const allQuarters = data.global?.quarters ?? [];
  const historicalQ = allQuarters.filter((q: any) => q.isHistorical);
  const latestQ = historicalQ.length > 0 ? historicalQ[historicalQ.length - 1] : null;

  if (!latestQ) return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground">No historical quarters for RAG</p>
      </CardContent>
    </Card>
  );

  const sqlRag = latestQ.sql?.rag;
  const ocrRag = latestQ.ocr?.rag;
  const ragColors: Record<string, string> = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };
  const ragLabels: Record<string, string> = { green: "On Track", amber: "At Risk", red: "Off Track" };

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-2">Latest Quarter Attainment ({latestQ.label})</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-full ${ragColors[sqlRag] ?? "bg-slate-300"}`} />
            <span className="text-xs font-medium">SQLs: {ragLabels[sqlRag] ?? "N/A"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-full ${ragColors[ocrRag] ?? "bg-slate-300"}`} />
            <span className="text-xs font-medium">Opps: {ragLabels[ocrRag] ?? "N/A"}</span>
          </div>
        </div>
        {latestQ.sql?.actual != null && (
          <p className="text-[10px] text-muted-foreground mt-1">
            SQLs: {latestQ.sql.actual} actual vs {latestQ.sql.model} model
            {latestQ.ocr?.actual != null && ` | Opps: ${latestQ.ocr.actual} vs ${Math.round(latestQ.ocr.model)}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CarrSummarySection({ companyId }: { companyId: number }) {
  const { data: carrData, isLoading } = trpc.carr.summary.useQuery(
    { companyId },
    { enabled: companyId > 0 },
  );

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardContent className="py-6 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!carrData || carrData.quarters.length === 0 || carrData.global.length === 0) {
    return null;
  }

  const fmtD = (cents: number) => {
    const d = cents / 100;
    if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
    if (Math.abs(d) >= 1_000) return `$${(d / 1_000).toFixed(0)}K`;
    return `$${d.toFixed(0)}`;
  };

  const latestGlobal = carrData.global[carrData.global.length - 1];
  const totalBookings = carrData.global.reduce((s, q) => s + q.newBookings + q.upsellBookings, 0);
  const totalTarget = carrData.global.reduce((s, q) => s + q.targetTotal, 0);
  const globalAttainment = totalTarget > 0 ? Math.round((totalBookings / totalTarget) * 100) : 0;
  const totalHc = carrData.global.reduce((s, q) => s + q.amCount + q.aeCount, 0);
  const avgHcPerQ = carrData.quarters.length > 0 ? totalHc / carrData.quarters.length : 0;
  const avgBookingsPerHead = avgHcPerQ > 0 ? Math.round(totalBookings / avgHcPerQ) : 0;

  const hasTargets = totalTarget > 0;
  const hasHeadcount = totalHc > 0;

  if (!hasTargets && !hasHeadcount && latestGlobal.closingCarr === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-2 border-emerald-200">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Closing CARR</p>
            <div className="text-2xl font-bold text-emerald-700">
              {latestGlobal.closingCarr > 0 ? fmtD(latestGlobal.closingCarr) : "N/A"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {latestGlobal.label} projected
            </p>
          </CardContent>
        </Card>

        {hasTargets && (
          <Card className={`border-2 ${globalAttainment >= 90 ? "border-emerald-200" : globalAttainment >= 70 ? "border-amber-200" : "border-red-200"}`}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground mb-1">Quota Attainment</p>
              <div className={`text-2xl font-bold ${globalAttainment >= 90 ? "text-emerald-700" : globalAttainment >= 70 ? "text-amber-700" : "text-red-700"}`}>
                {globalAttainment}%
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {fmtD(totalBookings)} of {fmtD(totalTarget)} target
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-2 border-blue-200">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Total Bookings</p>
            <div className="text-2xl font-bold text-blue-700">
              {fmtD(totalBookings)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {fmtD(carrData.global.reduce((s, q) => s + q.newBookings, 0))} new + {fmtD(carrData.global.reduce((s, q) => s + q.upsellBookings, 0))} upsell
            </p>
          </CardContent>
        </Card>

        {hasHeadcount && (
          <Card className="border-2 border-indigo-200">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground mb-1">Bookings / Head</p>
              <div className="text-2xl font-bold text-indigo-700">
                {fmtD(avgBookingsPerHead)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Avg {Math.round(avgHcPerQ)} heads/quarter
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* CARR Waterfall by Quarter */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            CARR Waterfall
          </CardTitle>
          <CardDescription className="text-sm">
            Opening + Bookings - Churn + M&A + Adjustments = Closing CARR
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2 w-36 sticky left-0 bg-muted/40 z-10">Metric</th>
                  {carrData.quarters.map(q => (
                    <th key={q.label} className="text-right p-2 min-w-[90px] border-l">{q.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 font-medium sticky left-0 bg-white z-10">Opening CARR</td>
                  {carrData.global.map((q, i) => (
                    <td key={i} className="p-2 text-right border-l">{fmtD(q.openingCarr)}</td>
                  ))}
                </tr>
                <tr className="border-b bg-blue-50/40">
                  <td className="p-2 text-blue-700 sticky left-0 bg-blue-50/40 z-10">+ New Bookings</td>
                  {carrData.global.map((q, i) => (
                    <td key={i} className="p-2 text-right text-blue-700 border-l">{fmtD(q.newBookings)}</td>
                  ))}
                </tr>
                <tr className="border-b bg-violet-50/40">
                  <td className="p-2 text-violet-700 sticky left-0 bg-violet-50/40 z-10">+ Upsell Bookings</td>
                  {carrData.global.map((q, i) => (
                    <td key={i} className="p-2 text-right text-violet-700 border-l">{fmtD(q.upsellBookings)}</td>
                  ))}
                </tr>
                <tr className="border-b bg-red-50/40">
                  <td className="p-2 text-red-700 sticky left-0 bg-red-50/40 z-10">- Churn</td>
                  {carrData.global.map((q, i) => (
                    <td key={i} className="p-2 text-right text-red-700 border-l">{q.churn > 0 ? `-${fmtD(q.churn)}` : "$0"}</td>
                  ))}
                </tr>
                <tr className="border-b bg-green-50/40">
                  <td className="p-2 text-green-700 sticky left-0 bg-green-50/40 z-10">+ M&A ARR</td>
                  {carrData.global.map((q, i) => (
                    <td key={i} className="p-2 text-right text-green-700 border-l">{fmtD(q.maaArr)}</td>
                  ))}
                </tr>
                <tr className="border-b bg-amber-50/40">
                  <td className="p-2 text-amber-700 sticky left-0 bg-amber-50/40 z-10">+/- Adjustments</td>
                  {carrData.global.map((q, i) => (
                    <td key={i} className="p-2 text-right text-amber-700 border-l">
                      {q.adjustment !== 0 ? (q.adjustment > 0 ? `+${fmtD(q.adjustment)}` : `-${fmtD(Math.abs(q.adjustment))}`) : "$0"}
                    </td>
                  ))}
                </tr>
                <tr className="border-b-2 border-t bg-muted/30 font-bold">
                  <td className="p-2 sticky left-0 bg-muted/30 z-10">Closing CARR</td>
                  {carrData.global.map((q, i) => (
                    <td key={i} className="p-2 text-right border-l">{fmtD(q.closingCarr)}</td>
                  ))}
                </tr>
                {hasTargets && (
                  <>
                    <tr className="border-b bg-purple-50/30">
                      <td className="p-2 text-purple-700 sticky left-0 bg-purple-50/30 z-10">Target (Quota)</td>
                      {carrData.global.map((q, i) => (
                        <td key={i} className="p-2 text-right text-purple-700 border-l">{q.targetTotal > 0 ? fmtD(q.targetTotal) : "—"}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sticky left-0 bg-white z-10">Attainment</td>
                      {carrData.global.map((q, i) => {
                        const bookings = q.newBookings + q.upsellBookings;
                        const att = q.targetTotal > 0 ? Math.round((bookings / q.targetTotal) * 100) : 0;
                        const color = att >= 90 ? "text-emerald-700" : att >= 70 ? "text-amber-700" : att > 0 ? "text-red-700" : "text-muted-foreground";
                        return (
                          <td key={i} className={`p-2 text-right border-l font-semibold ${color}`}>
                            {q.targetTotal > 0 ? `${att}%` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}
                {hasHeadcount && (
                  <>
                    <tr className="border-b bg-indigo-50/30">
                      <td className="p-2 text-indigo-700 sticky left-0 bg-indigo-50/30 z-10">Headcount (AM+AE)</td>
                      {carrData.global.map((q, i) => (
                        <td key={i} className="p-2 text-right text-indigo-700 border-l">
                          {(q.amCount + q.aeCount) > 0 ? `${q.amCount + q.aeCount}` : "—"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 sticky left-0 bg-white z-10">Bookings / Head</td>
                      {carrData.global.map((q, i) => (
                        <td key={i} className="p-2 text-right border-l">
                          {q.bookingsPerHead > 0 ? fmtD(q.bookingsPerHead) : "—"}
                        </td>
                      ))}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: companies = [], isLoading: companiesLoading } = trpc.company.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const companyId = companies[0]?.id ?? 1;
  const [showLegacy, setShowLegacy] = useState(false);

  // New v2 hierarchical data query
  const { data: hierarchicalData, isLoading: hierarchicalLoading } = trpc.dashboard.hierarchicalData.useQuery(
    { companyId },
    { enabled: isAuthenticated && companies.length > 0 }
  );

  // Legacy data fetching for collapsible section
  const [selectedCompany, setSelectedCompany] = useState<number | "all">("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedSqlType, setSelectedSqlType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedQuarter, setSelectedQuarter] = useState<number | "all">("all");

  const companyIdsToFetch = selectedCompany === "all" 
    ? companies.map(c => c.id)
    : [selectedCompany];

  const utils = trpc.useUtils();

  const [aggregatedData, setAggregatedData] = useState<{
    forecasts: Forecast[];
    regions: Region[];
    sqlTypes: SqlType[];
    sqlHistory: SqlHistory[];
    conversionRates: ConversionRate[];
  }>({
    forecasts: [],
    regions: [],
    sqlTypes: [],
    sqlHistory: [],
    conversionRates: [],
  });

  useEffect(() => {
    if (!isAuthenticated || companies.length === 0 || !showLegacy) return;

    const fetchAllData = async () => {
      const results = await Promise.all(
        companyIdsToFetch.map(async (companyId) => {
          const [forecasts, regions, sqlTypes, sqlHistory, conversionRates] = await Promise.all([
            utils.forecast.list.fetch({ companyId }),
            utils.region.list.fetch({ companyId }),
            utils.sqlType.list.fetch({ companyId }),
            utils.sqlHistory.list.fetch({ companyId }),
            utils.conversionRate.list.fetch({ companyId }),
          ]);
          return { forecasts, regions, sqlTypes, sqlHistory, conversionRates };
        })
      );

      const allForecasts = results.flatMap(r => r.forecasts);
      const regionMap = new Map<string, Region>();
      results.forEach(r => {
        r.regions.forEach((region: Region) => {
          if (!regionMap.has(region.name)) regionMap.set(region.name, region);
        });
      });
      const sqlTypeMap = new Map<string, SqlType>();
      results.forEach(r => {
        r.sqlTypes.forEach((sqlType: SqlType) => {
          if (!sqlTypeMap.has(sqlType.name)) sqlTypeMap.set(sqlType.name, sqlType);
        });
      });

      setAggregatedData({
        forecasts: allForecasts,
        regions: Array.from(regionMap.values()),
        sqlTypes: Array.from(sqlTypeMap.values()),
        sqlHistory: results.flatMap(r => r.sqlHistory),
        conversionRates: results.flatMap(r => r.conversionRates),
      });
    };

    fetchAllData();
  }, [companyIdsToFetch.join(','), isAuthenticated, companies.length, utils, showLegacy]);

  const allForecasts = aggregatedData.forecasts;
  const allRegions = aggregatedData.regions;
  const allSqlTypes = aggregatedData.sqlTypes;
  const sqlHistory = aggregatedData.sqlHistory;
  const conversionRates = aggregatedData.conversionRates;

  const timeSeriesData = useMemo(() => {
    if (!showLegacy) return [];
    let forecasts: Forecast[] = allForecasts;
    if (selectedRegion !== "all") {
      const regionId = allRegions.find((r: Region) => r.name === selectedRegion)?.id;
      forecasts = forecasts.filter((f: Forecast) => f.regionId === regionId);
    }
    if (selectedSqlType !== "all") {
      const sqlTypeId = allSqlTypes.find((s: SqlType) => s.name === selectedSqlType)?.id;
      forecasts = forecasts.filter((f: Forecast) => f.sqlTypeId === sqlTypeId);
    }

    const quarterMap = new Map<string, { period: string; year: number; quarter: number; sqls: number; opps: number; revenue: number }>();
    forecasts.forEach((f: Forecast) => {
      const key = `${f.year}-Q${f.quarter}`;
      const existing = quarterMap.get(key) || { period: `Q${f.quarter} ${f.year}`, year: f.year, quarter: f.quarter, sqls: 0, opps: 0, revenue: 0 };
      existing.sqls += f.predictedSqls || 0;
      existing.opps += (f.predictedOpps || 0) / 100;
      existing.revenue += ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100;
      quarterMap.set(key, existing);
    });

    return Array.from(quarterMap.values())
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter);
  }, [allForecasts, selectedRegion, selectedSqlType, allRegions, allSqlTypes, showLegacy]);

  const regionalData = useMemo(() => {
    if (!showLegacy) return [];
    return allRegions.map((region: Region) => {
      const regionForecasts = allForecasts.filter((f: Forecast) => f.regionId === region.id);
      const revenue = regionForecasts.reduce((sum: number, f: Forecast) =>
        sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0);
      const sqls = regionForecasts.reduce((sum: number, f: Forecast) => sum + (f.predictedSqls || 0), 0);
      return { name: region.name, revenue: Math.round(revenue), sqls };
    });
  }, [allRegions, allForecasts, showLegacy]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  if (loading || companiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const rScores = hierarchicalData?.rScores;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white">
        <div className="container mx-auto p-4">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-1">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Model accuracy, performance attainment, and hierarchical cascade view with upsell tracking
            </p>
          </div>

          {companies.length > 0 && (
            <>
              {/* R-Score + RAG + Upsell Headline Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                <RScoreCard score={rScores?.global?.overall} label="Overall R-Score" />
                <RScoreCard score={rScores?.global?.ocr} label="Opp Coverage R" />
                <RScoreCard score={rScores?.global?.owr} label="Opp Win Rate R" />
                <RagSummaryCard data={hierarchicalData} />
                <UpsellSummaryCard data={hierarchicalData} />
              </div>

              {/* Hierarchical Cascade View (primary) */}
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Hierarchical Performance
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Global &rarr; Region &rarr; Motion drill-down with Model vs Actual and RAG indicators
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {hierarchicalLoading ? (
                    <div className="h-40 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : hierarchicalData ? (
                    <HierarchicalCascade
                      quarters={hierarchicalData.quarters}
                      global={hierarchicalData.global}
                      regions={hierarchicalData.regions}
                      motions={hierarchicalData.motions}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground py-4">No hierarchical data available. Run a sync first.</p>
                  )}
                </CardContent>
              </Card>

              {/* CARR / Attainment / Productivity Summary */}
              <CarrSummarySection companyId={companyId} />

              {/* Collapsible Legacy Analytics */}
              <Card className="mb-4 border border-border">
                <CardHeader className="cursor-pointer" onClick={() => setShowLegacy(!showLegacy)}>
                  <CardTitle className="text-base flex items-center gap-2">
                    {showLegacy ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <BarChart3 className="h-4 w-4" />
                    Classic Analytics
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Time series, regional breakdown, and conversion funnel charts
                  </CardDescription>
                </CardHeader>
                {showLegacy && (
                  <CardContent className="space-y-4 pt-0">
                    {/* Time Series Chart */}
                    {timeSeriesData.length > 0 && (
                      <Card className="border border-border">
                        <CardHeader>
                          <CardTitle className="text-sm">Time Series Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={timeSeriesData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="period" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                              <YAxis yAxisId="left" />
                              <YAxis yAxisId="right" orientation="right" />
                              <Tooltip formatter={(value: number, name: string) => {
                                if (name === "Revenue ($)") return [`$${value.toLocaleString()}`, name];
                                return [value.toLocaleString(), name];
                              }} />
                              <Legend />
                              <Line yAxisId="left" type="monotone" dataKey="sqls" stroke="#3b82f6" name="SQLs" strokeWidth={2} dot={{ r: 3 }} />
                              <Line yAxisId="left" type="monotone" dataKey="opps" stroke="#8b5cf6" name="Opportunities" strokeWidth={2} dot={{ r: 3 }} />
                              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue ($)" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {/* Regional Performance */}
                    {regionalData.length > 0 && (
                      <Card className="border border-border">
                        <CardHeader>
                          <CardTitle className="text-sm">Regional Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={regionalData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis yAxisId="left" />
                              <YAxis yAxisId="right" orientation="right" />
                              <Tooltip />
                              <Legend />
                              <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue ($)" />
                              <Bar yAxisId="right" dataKey="sqls" fill="#8b5cf6" name="SQLs" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {timeSeriesData.length === 0 && regionalData.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">Loading analytics data...</p>
                    )}
                  </CardContent>
                )}
              </Card>
            </>
          )}

          {/* Empty State */}
          {companies.length === 0 && (
            <Card className="overflow-hidden border border-border shadow-sm">
              <CardContent className="p-0">
                <div className="flex flex-col items-center px-6 py-10 sm:py-14">
                  <img
                    src="/logo.png"
                    alt="Cascata - Transform Forecasting"
                    className="w-full max-w-2xl mb-8 drop-shadow-lg"
                  />
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 text-center">
                    Transform Your Revenue Forecasting
                  </h3>
                  <p className="text-muted-foreground text-center max-w-lg mb-6 text-sm sm:text-base leading-relaxed">
                    Cascata turns your HubSpot data into quarter-by-quarter cascade forecasts, showing exactly how SQLs convert to opportunities and revenue over time.
                  </p>
                  <Button size="lg" onClick={() => setLocation("/configure-cascata")} className="px-8">
                    <Plus className="w-4 h-4 mr-2" />
                    Configure Cascata Environment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
