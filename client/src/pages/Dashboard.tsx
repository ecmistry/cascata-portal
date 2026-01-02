import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Plus, TrendingUp, TrendingDown, DollarSign, Target, Zap, BarChart3, Filter, Home } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ConversionFunnel } from "@/components/ConversionFunnel";
import DashboardLayout from "@/components/DashboardLayout";
import type { Forecast, Region, SqlType, SqlHistory, ConversionRate } from "@/types/api";

/**
 * Dashboard Page Component
 * 
 * Main dashboard providing an overview of all companies and their forecasting metrics.
 * Displays:
 * - Overview KPIs (SQLs, Opportunities, Revenue, Conversion Rate, Deal Size)
 * - Revenue trends and comparisons
 * - Regional performance breakdown
 * - Conversion funnel visualization
 * - Time-series charts for SQLs, Opportunities, and Revenue
 * - Filtering by company, region, and SQL type
 * 
 * Features:
 * - Multi-company aggregation
 * - Real-time data updates
 * - Interactive filtering and drill-down
 * - Visual trend analysis
 * 
 * @returns A dashboard page component with comprehensive metrics and visualizations
 */
export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: companies = [], isLoading: companiesLoading } = trpc.company.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Filters
  const [selectedCompany, setSelectedCompany] = useState<number | "all">("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedSqlType, setSelectedSqlType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedQuarter, setSelectedQuarter] = useState<number | "all">("all");

  // When "all" is selected, fetch data for all companies and aggregate
  // When a specific company is selected, fetch only that company's data
  const companyIdsToFetch = selectedCompany === "all" 
    ? companies.map(c => c.id)
    : [selectedCompany];

  const utils = trpc.useUtils();

  // Fetch data for all companies when "all" is selected
  // Use Promise.all to fetch all companies' data in parallel
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
    if (!isAuthenticated || companies.length === 0) return;

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

      // Aggregate all data
      const allForecasts = results.flatMap(r => r.forecasts);
      
      // Deduplicate regions and SQL types by name
      const regionMap = new Map<string, Region>();
      results.forEach(r => {
        r.regions.forEach((region: Region) => {
          if (!regionMap.has(region.name)) {
            regionMap.set(region.name, region);
          }
        });
      });

      const sqlTypeMap = new Map<string, SqlType>();
      results.forEach(r => {
        r.sqlTypes.forEach((sqlType: SqlType) => {
          if (!sqlTypeMap.has(sqlType.name)) {
            sqlTypeMap.set(sqlType.name, sqlType);
          }
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
  }, [companyIdsToFetch.join(','), isAuthenticated, companies.length, utils]);

  const allForecasts = aggregatedData.forecasts;
  const allRegions = aggregatedData.regions;
  const allSqlTypes = aggregatedData.sqlTypes;
  const sqlHistory = aggregatedData.sqlHistory;
  const conversionRates = aggregatedData.conversionRates;

  // Get available years and quarters from forecasts
  const availableYears = useMemo(() => {
    const years = new Set(allForecasts.map((f: Forecast) => f.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [allForecasts]);

  const availableQuarters = useMemo(() => {
    const quarters = new Set(allForecasts.map((f: Forecast) => f.quarter));
    return Array.from(quarters).sort((a, b) => a - b);
  }, [allForecasts]);

  // Get time range of data
  const timeRange = useMemo(() => {
    if (allForecasts.length === 0) return null;
    const sorted = [...allForecasts].sort((a: Forecast, b: Forecast) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.quarter - b.quarter;
    });
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return {
      start: `Q${first.quarter} ${first.year}`,
      end: `Q${last.quarter} ${last.year}`,
    };
  }, [allForecasts]);

  // Calculate overview KPIs
  const kpis = useMemo(() => {
    let forecasts: Forecast[] = allForecasts;
    
    // Apply filters
    if (selectedRegion !== "all") {
      const regionId = allRegions.find((r: Region) => r.name === selectedRegion)?.id;
      forecasts = forecasts.filter((f: Forecast) => f.regionId === regionId);
    }
    if (selectedSqlType !== "all") {
      const sqlTypeId = allSqlTypes.find((s: SqlType) => s.name === selectedSqlType)?.id;
      forecasts = forecasts.filter((f: Forecast) => f.sqlTypeId === sqlTypeId);
    }

    const totalSQLs = forecasts.reduce((sum: number, f: Forecast) => sum + (f.predictedSqls || 0), 0);
    const totalOpps = forecasts.reduce((sum: number, f: Forecast) => sum + (f.predictedOpps || 0), 0) / 100;
    const totalRevenue = forecasts.reduce((sum: number, f: Forecast) => 
      sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
    );
    const avgConversionRate = totalSQLs > 0 ? (totalOpps / totalSQLs) * 100 : 0;
    const avgDealSize = totalOpps > 0 ? totalRevenue / totalOpps : 0;

    // Calculate trends (compare last 2 quarters)
    const sortedForecasts = [...forecasts].sort((a: Forecast, b: Forecast) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });

    const lastQuarter = sortedForecasts.slice(0, Math.floor(sortedForecasts.length / 4));
    const prevQuarter = sortedForecasts.slice(Math.floor(sortedForecasts.length / 4), Math.floor(sortedForecasts.length / 2));

    const lastQuarterRevenue = lastQuarter.reduce((sum: number, f: Forecast) => 
      sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
    );
    const prevQuarterRevenue = prevQuarter.reduce((sum: number, f: Forecast) => 
      sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
    );

    const revenueTrend = prevQuarterRevenue > 0 
      ? ((lastQuarterRevenue - prevQuarterRevenue) / prevQuarterRevenue) * 100 
      : 0;

    return {
      totalSQLs,
      totalOpps: Math.round(totalOpps),
      totalRevenue,
      avgConversionRate,
      avgDealSize,
      revenueTrend,
    };
  }, [allForecasts, selectedRegion, selectedSqlType, selectedYear, selectedQuarter, allRegions, allSqlTypes]);

  // Time-series data for charts
  const timeSeriesData = useMemo(() => {
    let forecasts: Forecast[] = allForecasts;
    
    // Apply filters (except time filters for time series)
    if (selectedRegion !== "all") {
      const regionId = allRegions.find((r: Region) => r.name === selectedRegion)?.id;
      forecasts = forecasts.filter((f: Forecast) => f.regionId === regionId);
    }
    if (selectedSqlType !== "all") {
      const sqlTypeId = allSqlTypes.find((s: SqlType) => s.name === selectedSqlType)?.id;
      forecasts = forecasts.filter((f: Forecast) => f.sqlTypeId === sqlTypeId);
    }

    // Group by quarter
    const quarterMap = new Map<string, {
      period: string;
      year: number;
      quarter: number;
      sqls: number;
      opps: number;
      revenue: number;
    }>();

    forecasts.forEach((f: Forecast) => {
      const key = `${f.year}-Q${f.quarter}`;
      const existing = quarterMap.get(key) || {
        period: `Q${f.quarter} ${f.year}`,
        year: f.year,
        quarter: f.quarter,
        sqls: 0,
        opps: 0,
        revenue: 0,
      };
      existing.sqls += f.predictedSqls || 0;
      existing.opps += (f.predictedOpps || 0) / 100;
      existing.revenue += ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100;
      quarterMap.set(key, existing);
    });

    return Array.from(quarterMap.values())
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.quarter - b.quarter;
      });
  }, [allForecasts, selectedRegion, selectedSqlType, allRegions, allSqlTypes]);

  // Regional performance data
  const regionalData = useMemo(() => {
    return allRegions.map((region: Region) => {
      const regionForecasts = allForecasts.filter((f: Forecast) => f.regionId === region.id);
      const revenue = regionForecasts.reduce((sum: number, f: Forecast) => 
        sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
      );
      const sqls = regionForecasts.reduce((sum: number, f: Forecast) => sum + (f.predictedSqls || 0), 0);
      
      return {
        name: region.name,
        revenue: Math.round(revenue),
        sqls,
      };
    });
  }, [allRegions, allForecasts]);

  // Conversion funnel data
  const funnelData = useMemo(() => {
    let forecasts = allForecasts;
    
    // Apply filters
    if (selectedRegion !== "all") {
      const regionId = allRegions.find((r: any) => r.name === selectedRegion)?.id;
      forecasts = forecasts.filter((f: any) => f.regionId === regionId);
    }
    if (selectedSqlType !== "all") {
      const sqlTypeId = allSqlTypes.find((s: any) => s.name === selectedSqlType)?.id;
      forecasts = forecasts.filter((f: any) => f.sqlTypeId === sqlTypeId);
    }

    const totalSQLs = forecasts.reduce((sum: number, f: any) => sum + (f.predictedSqls || 0), 0);
    const totalOpps = forecasts.reduce((sum: number, f: any) => sum + (f.predictedOpps || 0), 0) / 100;
    const totalRevenue = forecasts.reduce((sum: number, f: any) => 
      sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
    );

    // Calculate percentages relative to SQLs (baseline)
    // Revenue percentage doesn't make sense (dollars vs count), so we'll show revenue per SQL instead
    const revenuePerSQL = totalSQLs > 0 ? totalRevenue / totalSQLs : 0;
    
    return [
      { name: 'SQLs', value: totalSQLs, percentage: 100, color: '#3b82f6' },
      { name: 'Opportunities', value: totalOpps, percentage: totalSQLs > 0 ? (totalOpps / totalSQLs) * 100 : 0, color: '#8b5cf6' },
      { name: 'Revenue', value: totalRevenue, percentage: 0, revenuePerSQL: revenuePerSQL, color: '#10b981' },
    ];
  }, [allForecasts, selectedRegion, selectedSqlType, selectedYear, selectedQuarter, allRegions, allSqlTypes]);

  // SQL type effectiveness data
  const sqlTypeData = useMemo(() => {
    // Map all SQL types and calculate their revenue contribution
    const data = allSqlTypes.map((sqlType: any) => {
      const typeForecasts = allForecasts.filter((f: any) => f.sqlTypeId === sqlType.id);
      const typeHistory = sqlHistory.filter((h: any) => h.sqlTypeId === sqlType.id);
      const typeConversion = conversionRates.find((c: any) => c.sqlTypeId === sqlType.id);
      
      const revenue = typeForecasts.reduce((sum: number, f: any) => 
        sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
      );
      const sqls = typeHistory.reduce((sum: number, h: any) => sum + (h.volume || 0), 0);
      const conversionRate = typeConversion ? typeConversion.oppCoverageRatio / 100 : 0;
      
      return {
        name: sqlType.name,
        displayName: sqlType.displayName || sqlType.name,
        revenue: Math.round(revenue),
        sqls,
        conversionRate: conversionRate.toFixed(2),
        hasData: revenue > 0 || sqls > 0, // Track if this SQL type has any data
      };
    });
    
    // Sort by revenue descending, but include all SQL types (even with zero revenue)
    return data.sort((a, b) => b.revenue - a.revenue);
  }, [allSqlTypes, allForecasts, sqlHistory, conversionRates]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  if (loading || companiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Authentication disabled for localhost development

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white">
        <div className="container mx-auto p-4">
        {/* Clean Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-foreground mb-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of cascade model analytics and forecasts
            {timeRange && (
              <span className="ml-2 text-primary font-medium">
                ({timeRange.start} - {timeRange.end})
              </span>
            )}
          </p>
        </div>
        {/* Filters - Simplified */}
        {companies.length > 0 && (
          <Card className="mb-4 border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription className="text-sm">Filter analytics by company, region, SQL type, year, or quarter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Company</label>
                  <Select value={selectedCompany.toString()} onValueChange={(v) => setSelectedCompany(v === "all" ? "all" : parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map((company: any) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Region</label>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {allRegions.map((region: any) => (
                        <SelectItem key={region.id} value={region.name}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">SQL Type</label>
                  <Select value={selectedSqlType} onValueChange={setSelectedSqlType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {allSqlTypes.map((sqlType: any) => (
                        <SelectItem key={sqlType.id} value={sqlType.name}>
                          {sqlType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Year</label>
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(v === "all" ? "all" : parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {availableYears.map((year: number) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Quarter</label>
                  <Select value={selectedQuarter.toString()} onValueChange={(v) => setSelectedQuarter(v === "all" ? "all" : parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Quarters</SelectItem>
                      {availableQuarters.map((quarter: number) => (
                        <SelectItem key={quarter} value={quarter.toString()}>
                          Q{quarter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview KPIs - Clean Simple Cards */}
        {companies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <CardDescription className="text-sm text-muted-foreground mb-2">
                  Total SQLs
                  {(selectedYear !== "all" || selectedQuarter !== "all") && (
                    <span className="ml-1 text-xs">
                      {selectedYear !== "all" && selectedQuarter !== "all" 
                        ? `(${selectedYear} Q${selectedQuarter})`
                        : selectedYear !== "all"
                        ? `(${selectedYear})`
                        : `(Q${selectedQuarter})`}
                    </span>
                  )}
                </CardDescription>
                <div className="text-3xl font-semibold text-foreground">{kpis.totalSQLs.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <CardDescription className="text-sm text-muted-foreground mb-2">
                  Opportunities
                  {(selectedYear !== "all" || selectedQuarter !== "all") && (
                    <span className="ml-1 text-xs">
                      {selectedYear !== "all" && selectedQuarter !== "all" 
                        ? `(${selectedYear} Q${selectedQuarter})`
                        : selectedYear !== "all"
                        ? `(${selectedYear})`
                        : `(Q${selectedQuarter})`}
                    </span>
                  )}
                </CardDescription>
                <div className="text-3xl font-semibold text-foreground">{kpis.totalOpps.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <CardDescription className="text-sm text-muted-foreground mb-2">
                  Total Revenue
                  {(selectedYear !== "all" || selectedQuarter !== "all") && (
                    <span className="ml-1 text-xs">
                      {selectedYear !== "all" && selectedQuarter !== "all" 
                        ? `(${selectedYear} Q${selectedQuarter})`
                        : selectedYear !== "all"
                        ? `(${selectedYear})`
                        : `(Q${selectedQuarter})`}
                    </span>
                  )}
                </CardDescription>
                <div className="text-3xl font-semibold text-foreground">{formatCurrency(kpis.totalRevenue)}</div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <CardDescription className="text-sm text-muted-foreground mb-2">Conversion Rate</CardDescription>
                <div className="text-3xl font-semibold text-foreground">{kpis.avgConversionRate.toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Conversion Funnel */}
        {companies.length > 0 && (
          <div className="mb-4">
            <ConversionFunnel stages={funnelData} />
          </div>
        )}

        {/* Time Series Chart */}
        {companies.length > 0 && timeSeriesData.length > 0 && (
          <Card className="mb-4 border border-border">
            <CardHeader>
              <CardTitle className="text-base">Time Series Analysis</CardTitle>
              <CardDescription className="text-sm">SQLs, Opportunities, and Revenue over time by quarter</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === "Revenue ($)") {
                        return [`$${value.toLocaleString()}`, name];
                      }
                      return [value.toLocaleString(), name];
                    }}
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="sqls" 
                    stroke="#3b82f6" 
                    name="SQLs"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="opps" 
                    stroke="#8b5cf6" 
                    name="Opportunities"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    name="Revenue ($)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Regional Performance & SQL Type Effectiveness */}
        {companies.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-base">Regional Performance</CardTitle>
                <CardDescription className="text-sm">Revenue and SQL volume by region</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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

            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-base">SQL Type Effectiveness</CardTitle>
                <CardDescription className="text-sm">Revenue contribution by SQL type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={sqlTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="revenue"
                      >
                        {sqlTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => label}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value, entry: any) => {
                          const revenue = entry.payload?.revenue || 0;
                          return `${value}: ${formatCurrency(revenue)}`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Additional breakdown list for clarity - shows all SQL types */}
                  <div className="space-y-2 pt-2 border-t">
                    {sqlTypeData.length > 0 ? (
                      sqlTypeData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{entry.displayName || entry.name}</span>
                            {!entry.hasData && (
                              <span className="text-xs text-muted-foreground italic">(no data)</span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(entry.revenue)}</div>
                            <div className="text-xs text-muted-foreground">
                              {kpis.totalRevenue > 0 
                                ? `${((entry.revenue / kpis.totalRevenue) * 100).toFixed(1)}% of total`
                                : '0% of total'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-2">
                        No SQL types found
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {companies.length === 0 && (
          <Card className="text-center py-8">
            <CardContent>
              <Target className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Create your first model</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating a cascade model for your company
              </p>
              <Button onClick={() => setLocation("/setup")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Model
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
