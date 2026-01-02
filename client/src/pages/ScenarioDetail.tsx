import React from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, Home } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatDistanceToNow } from "date-fns";

export default function ScenarioDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const scenarioId = parseInt(params.id || "0");

  // Fetch scenario
  const { data: scenario, isLoading } = trpc.scenario.get.useQuery(
    { id: scenarioId },
    { enabled: scenarioId > 0 }
  );

  // Recalculate the scenario to get full forecast data
  const scenarioCalculation = trpc.whatif.calculate.useMutation();
  
  // Trigger calculation when scenario loads
  React.useEffect(() => {
    if (scenario) {
      scenarioCalculation.mutate({
        companyId: scenario.companyId,
        adjustments: {
          conversionRateMultiplier:
            scenario.conversionRateMultiplier !== null
              ? scenario.conversionRateMultiplier / 10000
              : undefined,
          acvAdjustments:
            scenario.acvNewAdjustment !== null || scenario.acvUpsellAdjustment !== null
              ? {
                  newBusinessAcv: scenario.acvNewAdjustment || undefined,
                  upsellAcv: scenario.acvUpsellAdjustment || undefined,
                }
              : undefined,
          timeDistributionAdjustments:
            scenario.sameQuarterAdjustment !== null ||
            scenario.nextQuarterAdjustment !== null ||
            scenario.twoQuarterAdjustment !== null
              ? {
                  sameQuarter: scenario.sameQuarterAdjustment || undefined,
                  nextQuarter: scenario.nextQuarterAdjustment || undefined,
                  twoQuarter: scenario.twoQuarterAdjustment || undefined,
                }
              : undefined,
        },
      });
    }
  }, [scenario?.id]);

  if (isLoading || !scenario) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Prepare chart data
  const chartData = scenarioCalculation.data
    ? scenarioCalculation.data.baseline.map((b: any, idx: number) => {
        const adj = scenarioCalculation.data?.adjusted[idx];
        return {
          quarter: b.quarter || `${b.year}-Q${b.quarterNum}`,
          baseline: (b.revenue || 0) / 100,
          adjusted: (adj?.revenue || 0) / 100,
        };
      })
    : [];

  const formatAdjustment = (value: number | null, divisor: number, unit: string) => {
    if (value === null || value === 0) return "No change";
    const actualValue = value / divisor;
    const sign = actualValue > 0 ? "+" : "";
    return `${sign}${actualValue}${unit}`;
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/scenarios/${scenario.companyId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Scenarios
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{scenario.name}</h1>
            {scenario.description && (
              <p className="text-muted-foreground mt-2">{scenario.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Created {formatDistanceToNow(new Date(scenario.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>

      {/* Impact Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue Impact</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                ${Math.abs((scenario.totalRevenueChange || 0) / 100).toLocaleString()}
              </div>
              {(scenario.totalRevenueChange || 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
            </div>
            <p
              className={`text-sm mt-1 ${
                (scenario.totalRevenueChange || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {(scenario.totalRevenueChangePercent || 0) >= 0 ? "+" : ""}
              {((scenario.totalRevenueChangePercent || 0) / 100).toFixed(1)}% vs baseline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Opportunities Impact</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {(scenario.totalOpportunitiesChange || 0) >= 0 ? "+" : ""}
                {Math.round(scenario.totalOpportunitiesChange || 0)}
              </div>
              {(scenario.totalOpportunitiesChange || 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
            </div>
            <p
              className={`text-sm mt-1 ${
                (scenario.totalOpportunitiesChange || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {(scenario.totalOpportunitiesChangePercent || 0) >= 0 ? "+" : ""}
              {((scenario.totalOpportunitiesChangePercent || 0) / 100).toFixed(1)}% vs baseline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversion Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scenario.conversionRateMultiplier !== null &&
              scenario.conversionRateMultiplier !== 10000
                ? `${(((scenario.conversionRateMultiplier / 10000) - 1) * 100).toFixed(0)}%`
                : "No change"}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {scenario.conversionRateMultiplier !== null &&
              scenario.conversionRateMultiplier > 10000
                ? "Increased conversion"
                : scenario.conversionRateMultiplier !== null &&
                  scenario.conversionRateMultiplier < 10000
                ? "Decreased conversion"
                : "Baseline"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ACV Adjustment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scenario.acvNewAdjustment !== null || scenario.acvUpsellAdjustment !== null
                ? `$${Math.max(
                    Math.abs((scenario.acvNewAdjustment || 0) / 100),
                    Math.abs((scenario.acvUpsellAdjustment || 0) / 100)
                  )}`
                : "No change"}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {(scenario.acvNewAdjustment || 0) > 0 || (scenario.acvUpsellAdjustment || 0) > 0
                ? "Increased deal size"
                : (scenario.acvNewAdjustment || 0) < 0 || (scenario.acvUpsellAdjustment || 0) < 0
                ? "Decreased deal size"
                : "Baseline"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Adjustments Detail */}
      <Card>
        <CardHeader>
          <CardTitle>Scenario Adjustments</CardTitle>
          <CardDescription>All parameter changes from baseline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Conversion Rates
              </p>
              <Badge variant="secondary">
                Multiplier:{" "}
                {scenario.conversionRateMultiplier !== null
                  ? `${(scenario.conversionRateMultiplier / 10000).toFixed(2)}x`
                  : "1.00x"}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Deal Economics</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  New ACV: {formatAdjustment(scenario.acvNewAdjustment, 100, "")}
                </Badge>
                <Badge variant="secondary">
                  Upsell ACV: {formatAdjustment(scenario.acvUpsellAdjustment, 100, "")}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Time Distribution
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  Same Q: {formatAdjustment(scenario.sameQuarterAdjustment, 100, "%")}
                </Badge>
                <Badge variant="secondary">
                  Next Q: {formatAdjustment(scenario.nextQuarterAdjustment, 100, "%")}
                </Badge>
                <Badge variant="secondary">
                  +2 Q: {formatAdjustment(scenario.twoQuarterAdjustment, 100, "%")}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecast Comparison</CardTitle>
          <CardDescription>Baseline vs This Scenario</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                  labelStyle={{ color: "#000" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Baseline"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="adjusted"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  name="This Scenario"
                  dot={{ r: 4 }}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </DashboardLayout>
  );
}
