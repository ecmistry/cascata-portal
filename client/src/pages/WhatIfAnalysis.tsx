import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, TrendingDown, RotateCcw, Save } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { SaveScenarioDialog } from "@/components/SaveScenarioDialog";
import DashboardLayout from "@/components/DashboardLayout";

/**
 * What-If Analysis Component
 * 
 * Allows users to adjust key assumptions and see real-time impact on forecasts:
 * - Conversion rate multipliers
 * - ACV adjustments
 * - Time distribution shifts
 */
export default function WhatIfAnalysis() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const companyId = parseInt(params.id || "1");

  // Adjustment states
  const [conversionMultiplier, setConversionMultiplier] = useState(1.0);
  const [acvNewAdjustment, setAcvNewAdjustment] = useState(0);
  const [acvUpsellAdjustment, setAcvUpsellAdjustment] = useState(0);
  const [sameQuarterAdjustment, setSameQuarterAdjustment] = useState(0);
  const [nextQuarterAdjustment, setNextQuarterAdjustment] = useState(0);
  const [twoQuarterAdjustment, setTwoQuarterAdjustment] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Calculate scenario
  const calculateScenario = trpc.whatif.calculate.useMutation({
    onError: (error) => {
      toast.error(`Failed to calculate scenario: ${error.message}`);
    },
  });

  // Trigger calculation when adjustments change
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateScenario.mutate({
        companyId,
        adjustments: {
          conversionRateMultiplier: conversionMultiplier !== 1.0 ? conversionMultiplier : undefined,
          acvAdjustments:
            acvNewAdjustment !== 0 || acvUpsellAdjustment !== 0
              ? {
                  newBusinessAcv: acvNewAdjustment !== 0 ? acvNewAdjustment * 100 : undefined, // Convert to cents
                  upsellAcv: acvUpsellAdjustment !== 0 ? acvUpsellAdjustment * 100 : undefined,
                }
              : undefined,
          timeDistributionAdjustments:
            sameQuarterAdjustment !== 0 || nextQuarterAdjustment !== 0 || twoQuarterAdjustment !== 0
              ? {
                  sameQuarter: sameQuarterAdjustment !== 0 ? sameQuarterAdjustment * 100 : undefined, // Convert to basis points
                  nextQuarter: nextQuarterAdjustment !== 0 ? nextQuarterAdjustment * 100 : undefined,
                  twoQuarter: twoQuarterAdjustment !== 0 ? twoQuarterAdjustment * 100 : undefined,
                }
              : undefined,
        },
      });
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timer);
  }, [
    companyId,
    conversionMultiplier,
    acvNewAdjustment,
    acvUpsellAdjustment,
    sameQuarterAdjustment,
    nextQuarterAdjustment,
    twoQuarterAdjustment,
  ]);

  const resetAdjustments = () => {
    setConversionMultiplier(1.0);
    setAcvNewAdjustment(0);
    setAcvUpsellAdjustment(0);
    setSameQuarterAdjustment(0);
    setNextQuarterAdjustment(0);
    setTwoQuarterAdjustment(0);
    toast.success("Reset to baseline assumptions");
  };

  // Save scenario mutation
  const saveScenario = trpc.scenario.create.useMutation({
    onSuccess: () => {
      toast.success("Scenario saved successfully!");
      setSaveDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to save scenario: ${error.message}`);
    },
  });

  const handleSaveScenario = async (name: string, description: string) => {
    const impact = calculateScenario.data?.impact;
    if (!impact) {
      toast.error("No scenario data to save");
      return;
    }

    await saveScenario.mutateAsync({
      companyId,
      name,
      description,
      conversionRateMultiplier: conversionMultiplier !== 1.0 ? Math.round(conversionMultiplier * 10000) : undefined,
      acvNewAdjustment: acvNewAdjustment !== 0 ? acvNewAdjustment * 100 : undefined,
      acvUpsellAdjustment: acvUpsellAdjustment !== 0 ? acvUpsellAdjustment * 100 : undefined,
      sameQuarterAdjustment: sameQuarterAdjustment !== 0 ? sameQuarterAdjustment * 100 : undefined,
      nextQuarterAdjustment: nextQuarterAdjustment !== 0 ? nextQuarterAdjustment * 100 : undefined,
      twoQuarterAdjustment: twoQuarterAdjustment !== 0 ? twoQuarterAdjustment * 100 : undefined,
      totalRevenueChange: Math.round(impact.totalRevenueChange),
      totalRevenueChangePercent: Math.round(impact.totalRevenueChangePercent * 100),
      totalOpportunitiesChange: Math.round(impact.totalOpportunitiesChange),
      totalOpportunitiesChangePercent: Math.round(impact.totalOpportunitiesChangePercent * 100),
    });
  };

  // Prepare chart data
  const chartData = calculateScenario.data
    ? calculateScenario.data.baseline.map((b, idx) => {
        const adj = calculateScenario.data!.adjusted[idx];
        return {
          quarter: b.quarter || `${b.year}-Q${b.quarterNum}`,
          baseline: (b.revenue || 0) / 100, // Convert cents to dollars
          adjusted: (adj?.revenue || 0) / 100,
        };
      })
    : [];

  const impact = calculateScenario.data?.impact;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">What-If Analysis</h1>
            <p className="text-muted-foreground mt-2">
              Adjust assumptions and see real-time impact on revenue forecasts
            </p>
          </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetAdjustments}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={() => setSaveDialogOpen(true)} disabled={!calculateScenario.data}>
            <Save className="w-4 h-4 mr-2" />
            Save Scenario
          </Button>
        </div>
        </div>
      </div>

      {/* Impact Summary */}
      {impact && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue Impact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  ${(Math.abs(impact.totalRevenueChange) / 100).toLocaleString()}
                </div>
                {impact.totalRevenueChange >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p
                className={`text-sm mt-1 ${
                  impact.totalRevenueChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {impact.totalRevenueChangePercent >= 0 ? "+" : ""}
                {impact.totalRevenueChangePercent.toFixed(1)}% vs baseline
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
                  {impact.totalOpportunitiesChange >= 0 ? "+" : ""}
                  {Math.round(impact.totalOpportunitiesChange)}
                </div>
                {impact.totalOpportunitiesChange >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p
                className={`text-sm mt-1 ${
                  impact.totalOpportunitiesChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {impact.totalOpportunitiesChangePercent >= 0 ? "+" : ""}
                {impact.totalOpportunitiesChangePercent.toFixed(1)}% vs baseline
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversion Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {conversionMultiplier !== 1.0
                  ? `${((conversionMultiplier - 1) * 100).toFixed(0)}%`
                  : "No change"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {conversionMultiplier > 1.0
                  ? "Increased conversion"
                  : conversionMultiplier < 1.0
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
                {acvNewAdjustment !== 0 || acvUpsellAdjustment !== 0
                  ? `$${Math.max(Math.abs(acvNewAdjustment), Math.abs(acvUpsellAdjustment))}`
                  : "No change"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {acvNewAdjustment > 0 || acvUpsellAdjustment > 0
                  ? "Increased deal size"
                  : acvNewAdjustment < 0 || acvUpsellAdjustment < 0
                  ? "Decreased deal size"
                  : "Baseline"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Adjustment Controls */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rates</CardTitle>
              <CardDescription>Adjust SQL → Opportunity → Revenue conversion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Conversion Multiplier</Label>
                  <span className="text-sm font-medium">
                    {conversionMultiplier.toFixed(2)}x
                  </span>
                </div>
                <Slider
                  value={[conversionMultiplier]}
                  onValueChange={(val) => setConversionMultiplier(val[0])}
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  {conversionMultiplier > 1.0
                    ? `+${((conversionMultiplier - 1) * 100).toFixed(0)}% increase`
                    : conversionMultiplier < 1.0
                    ? `${((conversionMultiplier - 1) * 100).toFixed(0)}% decrease`
                    : "No change"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deal Economics</CardTitle>
              <CardDescription>Adjust average contract values</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>New Business ACV</Label>
                  <span className="text-sm font-medium">
                    {acvNewAdjustment >= 0 ? "+" : ""}${acvNewAdjustment}
                  </span>
                </div>
                <Slider
                  value={[acvNewAdjustment]}
                  onValueChange={(val) => setAcvNewAdjustment(val[0])}
                  min={-500}
                  max={500}
                  step={10}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Upsell ACV</Label>
                  <span className="text-sm font-medium">
                    {acvUpsellAdjustment >= 0 ? "+" : ""}${acvUpsellAdjustment}
                  </span>
                </div>
                <Slider
                  value={[acvUpsellAdjustment]}
                  onValueChange={(val) => setAcvUpsellAdjustment(val[0])}
                  min={-500}
                  max={500}
                  step={10}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time Distribution</CardTitle>
              <CardDescription>Adjust conversion timing (percentage points)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Same Quarter</Label>
                  <span className="text-sm font-medium">
                    {sameQuarterAdjustment >= 0 ? "+" : ""}
                    {sameQuarterAdjustment}%
                  </span>
                </div>
                <Slider
                  value={[sameQuarterAdjustment]}
                  onValueChange={(val) => setSameQuarterAdjustment(val[0])}
                  min={-10}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Baseline: 89% → {89 + sameQuarterAdjustment}%
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Next Quarter</Label>
                  <span className="text-sm font-medium">
                    {nextQuarterAdjustment >= 0 ? "+" : ""}
                    {nextQuarterAdjustment}%
                  </span>
                </div>
                <Slider
                  value={[nextQuarterAdjustment]}
                  onValueChange={(val) => setNextQuarterAdjustment(val[0])}
                  min={-10}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Baseline: 10% → {10 + nextQuarterAdjustment}%
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Two Quarters Later</Label>
                  <span className="text-sm font-medium">
                    {twoQuarterAdjustment >= 0 ? "+" : ""}
                    {twoQuarterAdjustment}%
                  </span>
                </div>
                <Slider
                  value={[twoQuarterAdjustment]}
                  onValueChange={(val) => setTwoQuarterAdjustment(val[0])}
                  min={-1}
                  max={5}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Baseline: 1% → {Math.max(0, 1 + twoQuarterAdjustment)}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Chart */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Revenue Forecast Comparison</CardTitle>
              <CardDescription>Baseline vs Adjusted Scenario</CardDescription>
            </CardHeader>
            <CardContent>
              {calculateScenario.isPending ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    />
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
                      name="Adjusted"
                      dot={{ r: 4 }}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-96 text-muted-foreground">
                  No forecast data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SaveScenarioDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveScenario}
        isSaving={saveScenario.isPending}
      />
      </div>
    </DashboardLayout>
  );
}
