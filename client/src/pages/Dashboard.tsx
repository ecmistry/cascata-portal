import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Plus, TrendingUp, TrendingDown, DollarSign, Target, Zap, BarChart3, Filter, Home } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ConversionFunnel } from "@/components/ConversionFunnel";
import DashboardLayout from "@/components/DashboardLayout";

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

  // Fetch data for analytics
  const { data: allForecasts = [] } = trpc.forecast.list.useQuery(
    { companyId: selectedCompany === "all" ? (companies[0]?.id || 1) : selectedCompany },
    { enabled: isAuthenticated && companies.length > 0 }
  );

  const { data: allRegions = [] } = trpc.region.list.useQuery(
    { companyId: selectedCompany === "all" ? (companies[0]?.id || 1) : selectedCompany },
    { enabled: isAuthenticated && companies.length > 0 }
  );

  const { data: allSqlTypes = [] } = trpc.sqlType.list.useQuery(
    { companyId: selectedCompany === "all" ? (companies[0]?.id || 1) : selectedCompany },
    { enabled: isAuthenticated && companies.length > 0 }
  );

  const { data: sqlHistory = [] } = trpc.sqlHistory.list.useQuery(
    { companyId: selectedCompany === "all" ? (companies[0]?.id || 1) : selectedCompany },
    { enabled: isAuthenticated && companies.length > 0 }
  );

  const { data: conversionRates = [] } = trpc.conversionRate.list.useQuery(
    { companyId: selectedCompany === "all" ? (companies[0]?.id || 1) : selectedCompany },
    { enabled: isAuthenticated && companies.length > 0 }
  );

  // Calculate overview KPIs
  const kpis = useMemo(() => {
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
    const avgConversionRate = totalSQLs > 0 ? (totalOpps / totalSQLs) * 100 : 0;
    const avgDealSize = totalOpps > 0 ? totalRevenue / totalOpps : 0;

    // Calculate trends (compare last 2 quarters)
    const sortedForecasts = [...forecasts].sort((a: any, b: any) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });

    const lastQuarter = sortedForecasts.slice(0, Math.floor(sortedForecasts.length / 4));
    const prevQuarter = sortedForecasts.slice(Math.floor(sortedForecasts.length / 4), Math.floor(sortedForecasts.length / 2));

    const lastQuarterRevenue = lastQuarter.reduce((sum: number, f: any) => 
      sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
    );
    const prevQuarterRevenue = prevQuarter.reduce((sum: number, f: any) => 
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
  }, [allForecasts, selectedRegion, selectedSqlType, allRegions, allSqlTypes]);

  // Regional performance data
  const regionalData = useMemo(() => {
    return allRegions.map((region: any) => {
      const regionForecasts = allForecasts.filter((f: any) => f.regionId === region.id);
      const revenue = regionForecasts.reduce((sum: number, f: any) => 
        sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
      );
      const sqls = regionForecasts.reduce((sum: number, f: any) => sum + (f.predictedSqls || 0), 0);
      
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

    return [
      { name: 'SQLs', value: totalSQLs, percentage: 100, color: '#3b82f6' },
      { name: 'Opportunities', value: totalOpps, percentage: totalSQLs > 0 ? (totalOpps / totalSQLs) * 100 : 0, color: '#8b5cf6' },
      { name: 'Revenue', value: totalRevenue, percentage: totalSQLs > 0 ? (totalRevenue / totalSQLs) * 100 : 0, color: '#10b981' },
    ];
  }, [allForecasts, selectedRegion, selectedSqlType, allRegions, allSqlTypes]);

  // SQL type effectiveness data
  const sqlTypeData = useMemo(() => {
    return allSqlTypes.map((sqlType: any) => {
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
        revenue: Math.round(revenue),
        sqls,
        conversionRate: conversionRate.toFixed(2),
      };
    });
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
          </p>
        </div>
        {/* Filters - Simplified */}
        {companies.length > 0 && (
          <Card className="mb-4 border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription className="text-sm">Filter analytics by company, region, or SQL type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview KPIs - Clean Simple Cards */}
        {companies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <CardDescription className="text-sm text-muted-foreground mb-2">Total SQLs</CardDescription>
                <div className="text-3xl font-semibold text-foreground">{kpis.totalSQLs.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <CardDescription className="text-sm text-muted-foreground mb-2">Opportunities</CardDescription>
                <div className="text-3xl font-semibold text-foreground">{kpis.totalOpps.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <CardDescription className="text-sm text-muted-foreground mb-2">Total Revenue</CardDescription>
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
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sqlTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${formatCurrency(entry.revenue)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="revenue"
                    >
                      {sqlTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
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
