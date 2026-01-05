import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, TrendingUp, DollarSign, Target, Calculator, Download, Database, Sliders, FolderOpen, Home, LogOut } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useMemo, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { CascadeSankey } from "@/components/CascadeSankey";
import { EditSQLHistory } from "@/components/EditSQLHistory";
import { EditConversionRates } from "@/components/EditConversionRates";
import { EditDealEconomics } from "@/components/EditDealEconomics";
import { ImportCSV } from "@/components/ImportCSV";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import DashboardLayout from "@/components/DashboardLayout";
import type { Forecast } from "@/types/api";

/**
 * Model Page Component
 * 
 * Main page for viewing and managing a company's revenue forecasting model.
 * Displays:
 * - Cascade Sankey diagram showing SQL → Opportunity → Revenue flow
 * - Historical SQL data with editing capabilities
 * - Conversion rates configuration
 * - Deal economics (ACV) settings
 * - Forecast calculation and recalculation
 * - Time-series charts and tables
 * - Export functionality (Excel, PDF)
 * 
 * Features:
 * - Real-time forecast calculation
 * - What-If analysis capabilities
 * - CSV import for historical data
 * - Interactive data visualization
 * 
 * @returns A page component displaying the complete revenue forecasting model
 */
export default function Model() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/model/:id");
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

  // Get company ID from URL parameter
  const companyId = params?.id ? parseInt(params.id) : 1;

  // Note: React Query automatically refetches when query keys change (companyId is part of the key)
  // The refetchOnMount: true option ensures fresh data is fetched even if cached data exists

  // Fetch all data - refetch when companyId changes
  const { data: company, isLoading: companyLoading } = trpc.company.get.useQuery(
    { id: companyId },
    { 
      enabled: isAuthenticated,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: regions = [], isLoading: regionsLoading } = trpc.region.list.useQuery(
    { companyId },
    { 
      enabled: isAuthenticated,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: sqlTypes = [], isLoading: sqlTypesLoading } = trpc.sqlType.list.useQuery(
    { companyId },
    { 
      enabled: isAuthenticated,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: sqlHistory = [], isLoading: sqlHistoryLoading } = trpc.sqlHistory.list.useQuery(
    { companyId },
    { 
      enabled: isAuthenticated,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: forecasts = [], isLoading: forecastsLoading } = trpc.forecast.list.useQuery(
    { companyId },
    { 
      enabled: isAuthenticated,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: conversionRates = [], isLoading: conversionRatesLoading } = trpc.conversionRate.list.useQuery(
    { companyId },
    { 
      enabled: isAuthenticated,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: dealEconomics = [], isLoading: dealEconomicsLoading } = trpc.dealEconomics.list.useQuery(
    { companyId },
    { 
      enabled: isAuthenticated,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Calculate forecast mutation
  const calculateForecast = trpc.forecast.calculate.useMutation({
    onSuccess: () => {
      toast.success("Forecasts calculated successfully!");
      window.location.reload();
    },
    onError: () => {
      toast.error("Failed to calculate forecasts");
    },
  });

  // Prepare chart data
  interface QuarterData {
    quarter: string;
    year: number;
    q: number;
    totalSQLs: number;
    totalOpps: number;
    totalRevenue: number;
  }

  const chartData = useMemo(() => {
    if (!forecasts.length || !regions.length || !sqlTypes.length) return [];

    // Group by quarter
    const quarterMap = new Map<string, QuarterData>();

    forecasts.forEach((f: Forecast) => {
      const quarterKey = `Q${f.quarter} ${f.year}`;
      
      if (!quarterMap.has(quarterKey)) {
        quarterMap.set(quarterKey, {
          quarter: quarterKey,
          year: f.year,
          q: f.quarter,
          totalSQLs: 0,
          totalOpps: 0,
          totalRevenue: 0,
        });
      }

      const entry = quarterMap.get(quarterKey);
      if (entry) {
        entry.totalSQLs += f.predictedSqls || 0;
        entry.totalOpps += (f.predictedOpps || 0) / 100; // Convert from stored format
        entry.totalRevenue += ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100000; // Convert to thousands
      }
    });

    return Array.from(quarterMap.values())
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.q - b.q;
      });
  }, [forecasts, regions, sqlTypes]);

  // Calculate summary metrics
  interface SqlHistoryRecord {
    volume: number;
  }

  interface ConversionRateRecord {
    oppCoverageRatio: number;
  }

  const summary = useMemo(() => {
    const totalSQLs = sqlHistory.reduce((sum: number, h: SqlHistoryRecord) => sum + (h.volume || 0), 0);
    const totalForecasts = forecasts.length;
    const totalRevenue = forecasts.reduce((sum: number, f: Forecast) => 
      sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
    );
    const avgConversionRate = conversionRates.length > 0
      ? conversionRates.reduce((sum: number, c: ConversionRateRecord) => sum + (c.oppCoverageRatio || 0), 0) / conversionRates.length / 100
      : 0;

    return {
      totalSQLs,
      totalForecasts,
      totalRevenue,
      avgConversionRate,
    };
  }, [sqlHistory, forecasts, conversionRates]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Authentication disabled for localhost development

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        {/* Header */}
        <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{company?.name || "Loading..."}</h1>
                  <p className="text-sm text-slate-600">
                    {company?.description}
                    {forecasts.length > 0 && (() => {
                      const sorted = [...forecasts].sort((a: Forecast, b: Forecast) => {
                        if (a.year !== b.year) return a.year - b.year;
                        return a.quarter - b.quarter;
                      });
                      const first = sorted[0];
                      const last = sorted[sorted.length - 1];
                      return (
                        <span className="ml-2 text-primary font-medium">
                          ({`Q${first.quarter} ${first.year}`} - {`Q${last.quarter} ${last.year}`})
                        </span>
                      );
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/performance/${companyId}`)}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Performance
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/whatif/${companyId}`)}
              >
                <Sliders className="w-4 h-4 mr-2" />
                What-If Analysis
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/scenarios/${companyId}`)}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Scenarios
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => calculateForecast.mutate({ companyId })}
                disabled={calculateForecast.isPending}
              >
                <Calculator className="w-4 h-4 mr-2" />
                {calculateForecast.isPending ? "Calculating..." : "Recalculate"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => {
                    const exportData = {
                      company: { name: company?.name || '', description: company?.description || undefined },
                      forecasts: forecasts.map(f => ({
                        year: f.year,
                        quarter: f.quarter,
                        region: regions.find(r => r.id === f.regionId)?.name || '',
                        sqlType: sqlTypes.find(s => s.id === f.sqlTypeId)?.name || '',
                        predictedSqls: f.predictedSqls,
                        predictedOpps: f.predictedOpps,
                        predictedRevenueNew: f.predictedRevenueNew,
                        predictedRevenueUpsell: f.predictedRevenueUpsell,
                      })),
                      sqlHistory: sqlHistory.map(h => ({
                        year: h.year,
                        quarter: h.quarter,
                        region: regions.find(r => r.id === h.regionId)?.name || '',
                        sqlType: sqlTypes.find(s => s.id === h.sqlTypeId)?.name || '',
                        volume: h.volume,
                      })),
                      conversionRates: conversionRates.map(r => ({
                        region: regions.find(reg => reg.id === r.regionId)?.name || '',
                        sqlType: sqlTypes.find(s => s.id === r.sqlTypeId)?.name || '',
                        oppCoverageRatio: r.oppCoverageRatio,
                        winRateNew: r.winRateNew,
                        winRateUpsell: r.winRateUpsell,
                      })),
                      dealEconomics: dealEconomics.map(e => ({
                        region: regions.find(r => r.id === e.regionId)?.name || '',
                        acvNew: e.acvNew,
                        acvUpsell: e.acvUpsell,
                      })),
                    };
                    exportToExcel(exportData);
                    toast.success('Excel file downloaded');
                  }}>
                    Export to Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const exportData = {
                      company: { name: company?.name || '', description: company?.description || undefined },
                      forecasts: forecasts.map(f => ({
                        year: f.year,
                        quarter: f.quarter,
                        region: regions.find(r => r.id === f.regionId)?.name || '',
                        sqlType: sqlTypes.find(s => s.id === f.sqlTypeId)?.name || '',
                        predictedSqls: f.predictedSqls,
                        predictedOpps: f.predictedOpps,
                        predictedRevenueNew: f.predictedRevenueNew,
                        predictedRevenueUpsell: f.predictedRevenueUpsell,
                      })),
                      sqlHistory: sqlHistory.map(h => ({
                        year: h.year,
                        quarter: h.quarter,
                        region: regions.find(r => r.id === h.regionId)?.name || '',
                        sqlType: sqlTypes.find(s => s.id === h.sqlTypeId)?.name || '',
                        volume: h.volume,
                      })),
                      conversionRates: conversionRates.map(r => ({
                        region: regions.find(reg => reg.id === r.regionId)?.name || '',
                        sqlType: sqlTypes.find(s => s.id === r.sqlTypeId)?.name || '',
                        oppCoverageRatio: r.oppCoverageRatio,
                        winRateNew: r.winRateNew,
                        winRateUpsell: r.winRateUpsell,
                      })),
                      dealEconomics: dealEconomics.map(e => ({
                        region: regions.find(r => r.id === e.regionId)?.name || '',
                        acvNew: e.acvNew,
                        acvUpsell: e.acvUpsell,
                      })),
                    };
                    exportToPDF(exportData);
                    toast.success('PDF report opened in new window');
                  }}>
                    Export to PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Historical SQLs</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalSQLs.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Across {sqlHistory.length} records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgConversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                SQL → Opportunity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Forecast Periods</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalForecasts}</div>
              <p className="text-xs text-muted-foreground">
                Calculated entries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projected Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                Total forecast
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
            <TabsTrigger value="historical">Historical Data</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Sankey Diagram */}
            {sqlHistory.length > 0 && conversionRates.length > 0 && (() => {
              // Calculate values once and use in both key and props
              const totalSqlVolume = sqlHistory.reduce((sum, h) => sum + h.volume, 0);
              const totalOpportunityVolume = forecasts.reduce((sum, f) => sum + (f.predictedOpps || 0) / 100, 0);
              const totalRevenueAmount = forecasts.reduce((sum, f) => sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0);
              
              // Create a key that includes companyId and data values to force remount when data changes
              const cascadeKey = `${companyId}-${totalSqlVolume}-${totalOpportunityVolume}-${totalRevenueAmount}`;
              
              return (
                <CascadeSankey
                  key={cascadeKey} // Force remount when company or data changes
                  sqlVolume={totalSqlVolume}
                  opportunityVolume={totalOpportunityVolume}
                  revenueAmount={totalRevenueAmount}
                  conversionRate={conversionRates.length > 0 ? Math.round(conversionRates.reduce((sum, c) => sum + c.oppCoverageRatio, 0) / conversionRates.length) : 580}
                  winRate={conversionRates.length > 0 ? Math.round(conversionRates.reduce((sum, c) => sum + (c.winRateNew + c.winRateUpsell) / 2, 0) / conversionRates.length) : 5000}
                  timeDistribution={{
                    sameQuarter: 8900,
                    nextQuarter: 1000,
                    twoQuartersLater: 100,
                  }}
                />
              );
            })()}

          </TabsContent>

          {/* Historical Data Tab */}
          <TabsContent value="historical" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Historical SQL Data</h3>
              <div className="flex gap-2">
                <ImportCSV companyId={companyId} />
                <EditSQLHistory
                  companyId={companyId}
                  regions={regions}
                  sqlTypes={sqlTypes}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>SQL Volume Trend</CardTitle>
                <CardDescription>Forecasted SQL volumes by quarter</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="totalSQLs" stroke="#3b82f6" name="SQLs" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Forecast</CardTitle>
                <CardDescription>Projected revenue by quarter (in thousands)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value * 1000)} />
                    <Legend />
                    <Bar dataKey="totalRevenue" fill="#10b981" name="Revenue ($K)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Regions</CardTitle>
                  <CardDescription>{regions.length} active regions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {regions.map((region: any) => (
                      <div key={region.id} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-medium">{region.displayName}</span>
                        <Badge variant={region.enabled ? "default" : "secondary"}>
                          {region.enabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SQL Types</CardTitle>
                  <CardDescription>{sqlTypes.length} configured types</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sqlTypes.map((type: any) => (
                      <div key={type.id} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-medium">{type.displayName}</span>
                        <Badge variant={type.enabled ? "default" : "secondary"}>
                          {type.enabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Forecasts Tab */}
          <TabsContent value="forecasts">
            <Card>
              <CardHeader>
                <CardTitle>Forecast Details</CardTitle>
                <CardDescription>Detailed forecast breakdown by region, SQL type, and quarter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quarter</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>SQL Type</TableHead>
                        <TableHead className="text-right">Predicted SQLs</TableHead>
                        <TableHead className="text-right">Predicted Opps</TableHead>
                        <TableHead className="text-right">Revenue (New)</TableHead>
                        <TableHead className="text-right">Revenue (Upsell)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecasts.slice(0, 20).map((forecast: any) => {
                        const region = regions.find((r: any) => r.id === forecast.regionId);
                        const sqlType = sqlTypes.find((t: any) => t.id === forecast.sqlTypeId);
                        return (
                          <TableRow key={forecast.id}>
                            <TableCell>Q{forecast.quarter} {forecast.year}</TableCell>
                            <TableCell>{region?.displayName || "Unknown"}</TableCell>
                            <TableCell>{sqlType?.displayName || "Unknown"}</TableCell>
                            <TableCell className="text-right">{forecast.predictedSqls}</TableCell>
                            <TableCell className="text-right">{((forecast.predictedOpps || 0) / 100).toFixed(1)}</TableCell>
                            <TableCell className="text-right">{formatCurrency((forecast.predictedRevenueNew || 0) / 100)}</TableCell>
                            <TableCell className="text-right">{formatCurrency((forecast.predictedRevenueUpsell || 0) / 100)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {forecasts.length > 20 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Showing 20 of {forecasts.length} forecasts
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Historical Data Tab */}
          <TabsContent value="historical">
            <Card>
              <CardHeader>
                <CardTitle>Historical SQL Volumes</CardTitle>
                <CardDescription>Actual SQL volumes by region, type, and quarter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quarter</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>SQL Type</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sqlHistory.slice(0, 30).map((history: any) => {
                        const region = regions.find((r: any) => r.id === history.regionId);
                        const sqlType = sqlTypes.find((t: any) => t.id === history.sqlTypeId);
                        return (
                          <TableRow key={history.id}>
                            <TableCell>Q{history.quarter} {history.year}</TableCell>
                            <TableCell>{region?.displayName || "Unknown"}</TableCell>
                            <TableCell>{sqlType?.displayName || "Unknown"}</TableCell>
                            <TableCell className="text-right font-medium">{history.volume}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {sqlHistory.length > 30 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Showing 30 of {sqlHistory.length} historical records
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Conversion Rates Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Conversion Rates</h3>
                <EditConversionRates
                  companyId={companyId}
                  regions={regions}
                  sqlTypes={sqlTypes}
                />
              </div>
            </div>

            {/* Deal Economics Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Deal Economics</h3>
                <EditDealEconomics
                  companyId={companyId}
                  regions={regions}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Rates</CardTitle>
                <CardDescription>SQL to Opportunity conversion rates by region and type</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region</TableHead>
                      <TableHead>SQL Type</TableHead>
                      <TableHead className="text-right">Coverage Ratio</TableHead>
                      <TableHead className="text-right">Win Rate (New)</TableHead>
                      <TableHead className="text-right">Win Rate (Upsell)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversionRates.map((rate: any) => {
                      const region = regions.find((r: any) => r.id === rate.regionId);
                      const sqlType = sqlTypes.find((t: any) => t.id === rate.sqlTypeId);
                      return (
                        <TableRow key={rate.id}>
                          <TableCell>{region?.displayName || "Unknown"}</TableCell>
                          <TableCell>{sqlType?.displayName || "Unknown"}</TableCell>
                          <TableCell className="text-right">{((rate.oppCoverageRatio || 0) / 100).toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{((rate.winRateNew || 0) / 100).toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{((rate.winRateUpsell || 0) / 100).toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deal Economics</CardTitle>
                <CardDescription>Average Contract Values by region</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region</TableHead>
                      <TableHead className="text-right">ACV (New Business)</TableHead>
                      <TableHead className="text-right">ACV (Upsell)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealEconomics.map((deal: any) => {
                      const region = regions.find((r: any) => r.id === deal.regionId);
                      return (
                        <TableRow key={deal.id}>
                          <TableCell>{region?.displayName || "Unknown"}</TableCell>
                          <TableCell className="text-right">{formatCurrency((deal.acvNew || 0) / 100)}</TableCell>
                          <TableCell className="text-right">{formatCurrency((deal.acvUpsell || 0) / 100)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </DashboardLayout>
  );
}
