import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { skipToken } from "@tanstack/react-query";
import {
  Activity, Database, Users, TrendingUp, Clock, Server, Zap,
  Cpu, HardDrive, MemoryStick, RefreshCw, CircleDot, ArrowUpDown,
  Table2, Timer
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import type { Forecast } from "@/types/api";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusColor(percent: number): string {
  if (percent < 60) return "text-green-600";
  if (percent < 80) return "text-amber-500";
  return "text-red-500";
}

function progressColor(percent: number): string {
  if (percent < 60) return "[&>[data-slot=progress-indicator]]:bg-green-500";
  if (percent < 80) return "[&>[data-slot=progress-indicator]]:bg-amber-500";
  return "[&>[data-slot=progress-indicator]]:bg-red-500";
}

export default function PortalStats() {
  const { data: companies = [] } = trpc.company.list.useQuery();
  const firstCompanyId = companies[0]?.id;
  const { data: allForecasts = [] } = trpc.forecast.list.useQuery(
    firstCompanyId ? { companyId: firstCompanyId } : skipToken
  );

  const [refreshKey, setRefreshKey] = useState(0);
  const { data: metrics, isLoading: metricsLoading } = trpc.system.metrics.useQuery(
    undefined,
    { refetchInterval: 30_000, queryKey: ["system.metrics", refreshKey] as any }
  );

  const stats = useMemo(() => {
    const totalModels = companies.length;
    const totalForecasts = allForecasts.length;
    const totalUsers = 1;
    const totalRegions = new Set(allForecasts.map((f: Forecast) => f.regionId)).size;
    const totalSqlTypes = new Set(allForecasts.map((f: Forecast) => f.sqlTypeId)).size;
    const totalSQLs = allForecasts.reduce((sum: number, f: Forecast) => sum + (f.predictedSqls || 0), 0);
    const totalRevenue = allForecasts.reduce((sum: number, f: Forecast) =>
      sum + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100, 0
    );
    return { totalModels, totalForecasts, totalUsers, totalRegions, totalSqlTypes, totalSQLs, totalRevenue };
  }, [companies, allForecasts]);

  const systemHealth = useMemo(() => {
    if (!metrics) return null;
    const issues: string[] = [];
    if (metrics.system.cpu.percent > 85) issues.push(`High CPU usage (${metrics.system.cpu.percent}%)`);
    if (metrics.system.memoryUsedPercent > 90) issues.push(`High memory usage (${metrics.system.memoryUsedPercent}%)`);
    if (metrics.system.disk.usedPercent > 85) issues.push(`Disk space low (${metrics.system.disk.usedPercent}% used)`);
    if (metrics.process.heapUsedMb > 400) issues.push("High Node.js heap usage");
    return {
      healthy: issues.length === 0,
      issues,
    };
  }, [metrics]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Portal Stats & Performance</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              Monitor portal performance, system resources, and database health
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={metricsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Models</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalModels}</div>
              <p className="text-xs text-muted-foreground">Active cascade models</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Forecasts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalForecasts}</div>
              <p className="text-xs text-muted-foreground">Forecast calculations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Portal users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Regions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRegions}</div>
              <p className="text-xs text-muted-foreground">Unique regions configured</p>
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
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(stats.totalRevenue)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Across all models and forecasts</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Technical Stats ──────────────────────────────────── */}

        <div className="border-t pt-6">
          <h2 className="text-2xl font-bold tracking-tight mb-1">Infrastructure Health</h2>
          <p className="text-muted-foreground mb-6">Real-time EC2 instance, application process, and database metrics</p>
        </div>

        {/* System Health Banner */}
        {systemHealth && (
          <Card className={systemHealth.healthy ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CircleDot className={`h-5 w-5 ${systemHealth.healthy ? "text-green-600" : "text-amber-500"}`} />
                <div>
                  <p className="font-semibold">
                    {systemHealth.healthy ? "All Systems Healthy" : "Needs Attention"}
                  </p>
                  {systemHealth.issues.length > 0 && (
                    <ul className="text-sm text-muted-foreground mt-1">
                      {systemHealth.issues.map((issue, i) => <li key={i}>- {issue}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* EC2 Instance Resources */}
        {metrics && (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${statusColor(metrics.system.cpu.percent)}`}>
                    {metrics.system.cpu.percent}%
                  </div>
                  <p className="text-xs text-muted-foreground">{metrics.system.cpu.cores} cores</p>
                  <Progress value={metrics.system.cpu.percent} className={`mt-2 ${progressColor(metrics.system.cpu.percent)}`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Memory</CardTitle>
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${statusColor(metrics.system.memoryUsedPercent)}`}>
                    {metrics.system.memoryUsedPercent}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.system.usedMemoryMb}MB / {metrics.system.totalMemoryMb}MB
                  </p>
                  <Progress value={metrics.system.memoryUsedPercent} className={`mt-2 ${progressColor(metrics.system.memoryUsedPercent)}`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${statusColor(metrics.system.disk.usedPercent)}`}>
                    {metrics.system.disk.usedPercent}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.system.disk.usedGb}GB / {metrics.system.disk.totalGb}GB
                  </p>
                  <Progress value={metrics.system.disk.usedPercent} className={`mt-2 ${progressColor(metrics.system.disk.usedPercent)}`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Load Average</CardTitle>
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.system.load.load1}</div>
                  <p className="text-xs text-muted-foreground">
                    1m: {metrics.system.load.load1} / 5m: {metrics.system.load.load5} / 15m: {metrics.system.load.load15}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Process & System Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Node.js Process
                  </CardTitle>
                  <CardDescription>Application process metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Uptime</span>
                    <span className="text-sm font-medium">{formatUptime(metrics.process.uptimeSeconds)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Heap Used</span>
                    <span className="text-sm font-medium">{metrics.process.heapUsedMb}MB / {metrics.process.heapTotalMb}MB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">RSS Memory</span>
                    <span className="text-sm font-medium">{metrics.process.rssMb}MB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">External Memory</span>
                    <span className="text-sm font-medium">{metrics.process.externalMb}MB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Node Version</span>
                    <Badge variant="secondary">{metrics.process.nodeVersion}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">PID</span>
                    <span className="text-sm font-mono">{metrics.process.pid}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    EC2 Instance
                  </CardTitle>
                  <CardDescription>Server hardware and OS details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CPU Model</span>
                    <span className="text-sm font-medium truncate ml-4 max-w-[200px]" title={metrics.system.cpu.model}>
                      {metrics.system.cpu.model.split(" @")[0]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CPU Cores</span>
                    <span className="text-sm font-medium">{metrics.system.cpu.cores}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total RAM</span>
                    <span className="text-sm font-medium">{(metrics.system.totalMemoryMb / 1024).toFixed(1)} GB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Free RAM</span>
                    <span className="text-sm font-medium">{metrics.system.freeMemoryMb} MB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">OS Uptime</span>
                    <span className="text-sm font-medium">{formatUptime(metrics.system.osUptime)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Platform</span>
                    <Badge variant="secondary">{metrics.system.platform}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Database Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Usage
                </CardTitle>
                <CardDescription>MariaDB storage and table statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{metrics.database.sizeOnDiskMb} MB</div>
                    <p className="text-xs text-muted-foreground mt-1">Total DB Size</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{metrics.database.totalRows.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total Rows</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{metrics.database.tableStats.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Tables</p>
                  </div>
                </div>

                {metrics.database.tableStats.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">
                            <div className="flex items-center gap-1"><Table2 className="h-3.5 w-3.5" /> Table</div>
                          </th>
                          <th className="text-right p-3 font-medium">Rows</th>
                          <th className="text-right p-3 font-medium">Size</th>
                          <th className="text-left p-3 font-medium w-[120px]">Proportion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.database.tableStats.map((table) => {
                          const pct = metrics.database.sizeOnDiskMb > 0
                            ? Math.round((table.sizeMb / metrics.database.sizeOnDiskMb) * 100)
                            : 0;
                          return (
                            <tr key={table.name} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-3 font-mono text-xs">{table.name}</td>
                              <td className="p-3 text-right">{table.rows.toLocaleString()}</td>
                              <td className="p-3 text-right">{table.sizeMb} MB</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Progress value={pct} className="h-1.5 flex-1" />
                                  <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* HubSpot Sync & System Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5" />
                    HubSpot ELT Sync
                  </CardTitle>
                  <CardDescription>Data synchronisation status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={metrics.sync.syncEnabled ? "default" : "secondary"}>
                      {metrics.sync.syncEnabled ? "Enabled" : "Not Configured"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Sync</span>
                    <span className="text-sm font-medium">
                      {metrics.sync.lastSync
                        ? new Date(metrics.sync.lastSync).toLocaleString()
                        : "Never"
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Schedule</span>
                    <span className="text-sm font-medium">Daily at 04:00 UTC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Full Rebuild</span>
                    <span className="text-sm font-medium">Sundays at 03:00 UTC</span>
                  </div>
                </CardContent>
              </Card>

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
                    <Badge variant="secondary">
                      {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Version</span>
                    </div>
                    <span className="text-sm font-medium">1.1.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Hostname</span>
                    </div>
                    <span className="text-sm font-mono">{metrics.system.hostname}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Last Refreshed</span>
                    </div>
                    <span className="text-sm font-medium">{new Date().toLocaleTimeString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {metricsLoading && !metrics && (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-4">Loading system metrics...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

