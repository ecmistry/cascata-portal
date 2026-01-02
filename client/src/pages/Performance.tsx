import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, TrendingUp, TrendingDown, Target } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { getLoginUrl } from "@/const";
import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import DashboardLayout from "@/components/DashboardLayout";

export default function Performance() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/performance/:id");
  const { isAuthenticated, loading: authLoading } = useAuth();

  const companyId = params?.id ? parseInt(params.id) : 0;

  const { data: company } = trpc.company.get.useQuery(
    { id: companyId },
    { refetchOnMount: true, refetchOnWindowFocus: false }
  );
  const { data: forecasts = [] } = trpc.forecast.list.useQuery(
    { companyId },
    { refetchOnMount: true, refetchOnWindowFocus: false }
  );
  const { data: actuals = [] } = trpc.actual.list.useQuery(
    { companyId },
    { refetchOnMount: true, refetchOnWindowFocus: false }
  );

  // Calculate variance metrics - must be before any early returns
  const varianceData = useMemo(() => {
    const grouped = new Map<string, { predicted: number; actual: number }>();
    
    forecasts.forEach(f => {
      const key = `${f.year}-Q${f.quarter}`;
      const existing = grouped.get(key) || { predicted: 0, actual: 0 };
      existing.predicted += f.predictedRevenueNew + f.predictedRevenueUpsell;
      grouped.set(key, existing);
    });

    actuals.forEach((a: any) => {
      const key = `${a.year}-Q${a.quarter}`;
      const existing = grouped.get(key) || { predicted: 0, actual: 0 };
      existing.actual += a.actualRevenue;
      grouped.set(key, existing);
    });

    return Array.from(grouped.entries())
      .map(([period, data]) => ({
        period,
        predicted: data.predicted / 100, // Convert from cents
        actual: data.actual / 100,
        variance: data.actual - data.predicted,
        variancePercent: data.predicted > 0 ? ((data.actual - data.predicted) / data.predicted) * 100 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [forecasts, actuals]);

  const totalPredicted = varianceData.reduce((sum, d) => sum + d.predicted, 0);
  const totalActual = varianceData.reduce((sum, d) => sum + d.actual, 0);
  const totalVariance = totalActual - totalPredicted;
  const totalVariancePercent = totalPredicted > 0 ? (totalVariance / totalPredicted) * 100 : 0;

  const accuracy = totalPredicted > 0 ? 100 - Math.abs(totalVariancePercent) : 0;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Authentication disabled for localhost development

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Company not found</h2>
          <Button onClick={() => setLocation("/")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="container py-4">
        <div className="mb-4">
          <h1 className="text-3xl font-bold">Performance</h1>
          <p className="text-muted-foreground mt-1">{company.name} - Actual vs Predicted</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4 mb-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Forecast Accuracy</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accuracy.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Model prediction accuracy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Predicted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(totalPredicted / 1000).toFixed(0)}K</div>
              <p className="text-xs text-muted-foreground">
                Forecasted revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(totalActual / 1000).toFixed(0)}K</div>
              <p className="text-xs text-muted-foreground">
                Actual revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Variance</CardTitle>
              {totalVariance >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalVariance >= 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                ${(Math.abs(totalVariance) / 1000).toFixed(0)}K {totalVariance >= 0 ? 'above' : 'below'} forecast
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actual vs Predicted Chart */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Actual vs Predicted Revenue</CardTitle>
            <CardDescription>Quarterly comparison of forecasted and actual performance</CardDescription>
          </CardHeader>
          <CardContent>
            {varianceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={varianceData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                      return `$${value.toFixed(0)}`;
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number) => {
                      if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
                      if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
                      return `$${value.toFixed(0)}`;
                    }}
                    labelStyle={{ fontSize: 12 }}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="predicted" fill="hsl(var(--primary))" name="Predicted" />
                  <Bar dataKey="actual" fill="hsl(var(--chart-2))" name="Actual" />
                  <Line 
                    type="monotone" 
                    dataKey="variance" 
                    stroke="hsl(var(--chart-3))" 
                    name="Variance"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                No performance data available. Add actual results to see variance analysis.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Variance Analysis</CardTitle>
            <CardDescription>Period-by-period breakdown of forecast accuracy</CardDescription>
          </CardHeader>
          <CardContent>
            {varianceData.length > 0 ? (
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Period</th>
                      <th className="text-right p-2">Predicted</th>
                      <th className="text-right p-2">Actual</th>
                      <th className="text-right p-2">Variance ($)</th>
                      <th className="text-right p-2">Variance (%)</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {varianceData.map((row) => (
                      <tr key={row.period} className="border-b">
                        <td className="p-2 font-medium">{row.period}</td>
                        <td className="text-right p-2">${row.predicted.toFixed(0)}</td>
                        <td className="text-right p-2">${row.actual.toFixed(0)}</td>
                        <td className={`text-right p-2 ${row.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.variance >= 0 ? '+' : ''}${row.variance.toFixed(0)}
                        </td>
                        <td className={`text-right p-2 ${row.variancePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.variancePercent >= 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%
                        </td>
                        <td className="text-center p-2">
                          {Math.abs(row.variancePercent) < 10 ? (
                            <Badge variant="default" className="bg-green-500">On Track</Badge>
                          ) : Math.abs(row.variancePercent) < 20 ? (
                            <Badge variant="secondary">Acceptable</Badge>
                          ) : (
                            <Badge variant="destructive">Off Target</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No variance data available
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      </div>
    </DashboardLayout>
  );
}
