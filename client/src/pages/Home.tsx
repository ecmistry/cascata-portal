import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Zap, TrendingUp, BarChart3, Calculator, Sliders, Target, Database, Download, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container py-8 md:py-12">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-4xl font-bold text-center mb-4">How It Works</h1>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              A comprehensive guide to using Cascata for revenue forecasting and analysis
            </p>

            {/* Core Workflow */}
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-6">Core Workflow</h2>
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-500" />
                      </div>
                      <CardTitle className="text-xl">1. Input Your Data</CardTitle>
                    </div>
                    <CardDescription>
                      Provide historical SQL volumes, conversion rates, and deal economics through our guided questionnaire or import from BigQuery.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Configure regions and SQL types</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Enter historical SQL volumes by quarter</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Set conversion rates and deal economics</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-purple-500" />
                      </div>
                      <CardTitle className="text-xl">2. Automatic Calculation</CardTitle>
                    </div>
                    <CardDescription>
                      Our engine applies time-based conversion probabilities to generate accurate revenue forecasts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm font-medium">Same Quarter</span>
                        <span className="text-sm font-bold text-purple-600">89%</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm font-medium">Next Quarter</span>
                        <span className="text-sm font-bold text-purple-600">10%</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm font-medium">Two Quarters Later</span>
                        <span className="text-sm font-bold text-purple-600">1%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      </div>
                      <CardTitle className="text-xl">3. Visual Forecasts</CardTitle>
                    </div>
                    <CardDescription>
                      Explore interactive cascade flow diagrams, revenue projections, and performance charts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Cascade flow visualization (SQL → Opportunity → Revenue)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Revenue projections by quarter and region</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Regional performance and SQL type effectiveness</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <Target className="h-5 w-5 text-orange-500" />
                      </div>
                      <CardTitle className="text-xl">4. Track Performance</CardTitle>
                    </div>
                    <CardDescription>
                      Compare actual vs predicted results and monitor forecast accuracy over time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Variance analysis by quarter</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Forecast accuracy metrics</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Actual vs predicted revenue charts</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Advanced Features */}
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-6">Advanced Features</h2>
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                      <Sliders className="h-6 w-6 text-blue-500" />
                    </div>
                    <CardTitle>What-If Analysis</CardTitle>
                    <CardDescription>
                      Adjust key assumptions and see real-time impact on revenue forecasts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li>• Adjust conversion rate multipliers</li>
                      <li>• Modify ACV (Average Contract Value)</li>
                      <li>• Shift time distribution percentages</li>
                      <li>• Save scenarios for comparison</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                      <Calculator className="h-6 w-6 text-purple-500" />
                    </div>
                    <CardTitle>Recalculate Forecasts</CardTitle>
                    <CardDescription>
                      Update forecasts when your data changes or assumptions are refined.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li>• Recalculate after data updates</li>
                      <li>• Refresh forecasts with new parameters</li>
                      <li>• Automatic cache management</li>
                      <li>• Real-time calculation updates</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                      <BarChart3 className="h-6 w-6 text-green-500" />
                    </div>
                    <CardTitle>Scenario Management</CardTitle>
                    <CardDescription>
                      Save, compare, and analyze different forecasting scenarios.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li>• Save What-If scenarios</li>
                      <li>• Compare multiple scenarios side-by-side</li>
                      <li>• Track scenario performance</li>
                      <li>• Export scenario data</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3">
                      <Database className="h-6 w-6 text-orange-500" />
                    </div>
                    <CardTitle>BigQuery Integration</CardTitle>
                    <CardDescription>
                      Connect to your data warehouse for automated data synchronization.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li>• Sync SQL history automatically</li>
                      <li>• Import conversion rates</li>
                      <li>• Pull actual revenue data</li>
                      <li>• Scheduled data updates</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                      <Download className="h-6 w-6 text-blue-500" />
                    </div>
                    <CardTitle>Export & Reporting</CardTitle>
                    <CardDescription>
                      Export your forecasts and analysis in multiple formats.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li>• Export to Excel (.xlsx)</li>
                      <li>• Generate PDF reports</li>
                      <li>• Include all forecast data</li>
                      <li>• Share with stakeholders</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                      <Target className="h-6 w-6 text-purple-500" />
                    </div>
                    <CardTitle>Performance Tracking</CardTitle>
                    <CardDescription>
                      Monitor forecast accuracy and identify areas for improvement.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li>• Forecast accuracy metrics</li>
                      <li>• Variance analysis by period</li>
                      <li>• Actual vs predicted charts</li>
                      <li>• Performance trends over time</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Key Concepts */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-6">Key Concepts</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Two Cascade Moments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="font-semibold text-sm mb-1">SQL → Opportunity</p>
                      <p className="text-sm text-muted-foreground">
                        Sales Qualified Leads convert to Opportunities with time-based probability distribution (89% same quarter, 10% next, 1% later).
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1">Opportunity → Revenue</p>
                      <p className="text-sm text-muted-foreground">
                        Opportunities convert to Closed Won deals based on win rates, generating revenue from Average Contract Values (ACV).
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Multi-Dimensional Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="font-semibold text-sm mb-1">By Region</p>
                      <p className="text-sm text-muted-foreground">
                        Analyze performance across different geographic regions (NORAM, EMESA North, EMESA South).
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1">By SQL Type</p>
                      <p className="text-sm text-muted-foreground">
                        Track effectiveness of different lead sources (Inbound, Outbound, ILO, Event, Partner).
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
