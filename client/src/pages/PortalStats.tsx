import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Activity, Database, Users, TrendingUp, Clock, Server, Zap } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import type { Forecast } from "@/types/api";

export default function PortalStats() {
  const { data: companies = [] } = trpc.company.list.useQuery();
  const { data: allForecasts = [] } = trpc.forecast.list.useQuery(undefined, {
    enabled: companies.length > 0,
  });

  const stats = useMemo(() => {
    const totalModels = companies.length;
    const totalForecasts = allForecasts.length;
    // Note: User count will be available when user management API is implemented
    const totalUsers = 1;
    const totalRegions = new Set(allForecasts.map((f: Forecast) => f.regionId)).size;
    const totalSqlTypes = new Set(allForecasts.map((f: Forecast) => f.sqlTypeId)).size;
    
    // Calculate total SQLs and revenue across all forecasts
    const totalSQLs = allForecasts.reduce((sum: number, f: Forecast) => sum + (f.predictedSqls || 0), 0);
    const totalRevenue = allForecasts.reduce((sum: number, f: Forecast) => 
      sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
    );

    return {
      totalModels,
      totalForecasts,
      totalUsers,
      totalRegions,
      totalSqlTypes,
      totalSQLs,
      totalRevenue,
    };
  }, [companies, allForecasts]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portal Stats</h1>
          <p className="text-muted-foreground mt-2">
            Performance metrics and usage statistics for the Cascata portal
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Models</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalModels}</div>
              <p className="text-xs text-muted-foreground">
                Active cascade models
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Forecasts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalForecasts}</div>
              <p className="text-xs text-muted-foreground">
                Forecast calculations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Portal users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Regions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRegions}</div>
              <p className="text-xs text-muted-foreground">
                Unique regions configured
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Data Coverage</CardTitle>
              <CardDescription>Geographic and type distribution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Regions</span>
                <span className="text-sm font-medium">{stats.totalRegions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">SQL Types</span>
                <span className="text-sm font-medium">{stats.totalSqlTypes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total SQLs</span>
                <span className="text-sm font-medium">{stats.totalSQLs.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
              <CardDescription>Total forecasted revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(stats.totalRevenue)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Across all models and forecasts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Portal configuration and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Environment</span>
              </div>
              <span className="text-sm font-medium">
                {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Version</span>
              </div>
              <span className="text-sm font-medium">1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Last Updated</span>
              </div>
              <span className="text-sm font-medium">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

