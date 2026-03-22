import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CheckCircle2, Rocket, Plug, Database, Settings, RefreshCw,
  LayoutDashboard, TrendingUp, HelpCircle, BookOpen, Layers, BarChart3,
} from "lucide-react";

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-20" />;
}

export default function Docs() {
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container px-4 sm:px-6 py-6 md:py-10">
          <div className="mx-auto max-w-3xl">

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Getting Started with Cascata</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                A step-by-step guide to connecting your CRM, configuring the model, and generating your first forecast.
              </p>
            </div>

            {/* Quick-start flow */}
            <Card className="mb-10 border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-blue-600" />
                  Quick Start (5 minutes)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: 1, title: "Create your account", desc: "Sign up with your email and company name.", action: "Create Account", href: "/login" },
                    { step: 2, title: "Connect HubSpot", desc: "Add your HubSpot Private App token on the Integrations page.", action: "Go to Integrations", href: "/integrations" },
                    { step: 3, title: "Map your properties", desc: "Tell Cascata which HubSpot fields to use for SQL dates, regions, and deal data.", action: "Configure Properties", href: "/configure-cascata" },
                    { step: 4, title: "Run your first sync", desc: "Hit 'Refresh' to pull contacts and deals from HubSpot and generate forecasts.", action: null, href: null },
                    { step: 5, title: "Explore your dashboard", desc: "View cascade sheets, R-scores, CARR waterfall, and hierarchical drill-downs.", action: "Go to Dashboard", href: "/" },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 items-start">
                      <div className="h-7 w-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {item.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        {item.action && item.href && (
                          <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs text-blue-600" onClick={() => setLocation(item.href!)}>
                            {item.action} <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Table of Contents */}
            <Card className="mb-10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Contents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-1.5">
                  {[
                    ["prereqs", "1. Prerequisites"],
                    ["create-hubspot-app", "2. Creating a HubSpot Private App"],
                    ["connect", "3. Connecting HubSpot to Cascata"],
                    ["configure", "4. Configuring Property Mapping"],
                    ["first-sync", "5. Running Your First Sync"],
                    ["dashboard-tour", "6. Dashboard Overview"],
                    ["cascade-sheets", "7. Reading Cascade Sheets"],
                    ["revenue-planning", "8. Revenue Planning & Targets"],
                    ["ongoing", "9. Ongoing Use & Data Refresh"],
                    ["faq", "10. FAQ"],
                  ].map(([id, title]) => (
                    <a key={id} href={`#${id}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline py-0.5">{title}</a>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 1. Prerequisites */}
            <SectionAnchor id="prereqs" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                1. Prerequisites
              </h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Before getting started, make sure you have:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Admin or Super Admin access</strong> to your HubSpot portal (needed to create a Private App).</li>
                  <li><strong>SQL dates on contacts</strong> — your HubSpot contacts should have a property that records when they became a Sales Qualified Lead (e.g. <code className="bg-muted px-1 rounded text-xs">admin___first_became_a_sql_date</code>).</li>
                  <li><strong>Deal data</strong> — closed-won deals with a deal value, close date, and a deal type property that distinguishes new business from upsell/renewals.</li>
                  <li><strong>Region/Pod fields</strong> — a property on contacts and deals that identifies which team or territory owns the record.</li>
                </ul>
              </div>
            </div>

            {/* 2. Creating a HubSpot Private App */}
            <SectionAnchor id="create-hubspot-app" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Plug className="h-5 w-5 text-orange-500" />
                2. Creating a HubSpot Private App
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Cascata connects via a <strong>HubSpot Private App token</strong> (not OAuth). Here's how to create one:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>In HubSpot, go to <strong>Settings → Integrations → Private Apps</strong>.</li>
                  <li>Click <strong>"Create a private app"</strong> and give it a name (e.g. "Cascata Integration").</li>
                  <li>Under <strong>Scopes</strong>, enable these read permissions:
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="secondary" className="text-xs font-mono">crm.objects.contacts.read</Badge>
                      <Badge variant="secondary" className="text-xs font-mono">crm.objects.deals.read</Badge>
                      <Badge variant="secondary" className="text-xs font-mono">crm.objects.companies.read</Badge>
                    </div>
                  </li>
                  <li>Click <strong>"Create app"</strong> and <strong>copy the access token</strong> (starts with <code className="bg-muted px-1 rounded">pat-</code>).</li>
                </ol>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-amber-800"><strong>Important:</strong> Store this token securely. It grants read-only access to your CRM data. You can regenerate it at any time from HubSpot if compromised.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 3. Connecting HubSpot */}
            <SectionAnchor id="connect" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-500" />
                3. Connecting HubSpot to Cascata
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-sm" onClick={() => setLocation("/integrations")}>Integrations</Button> in the sidebar.</li>
                  <li>Paste your HubSpot Private App token and click <strong>Save</strong>.</li>
                  <li>The badge should change to <Badge variant="default" className="bg-green-100 text-green-800 border-green-300 text-xs">Connected</Badge>.</li>
                </ol>
              </div>
            </div>

            {/* 4. Configuring Property Mapping */}
            <SectionAnchor id="configure" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Settings className="h-5 w-5 text-slate-500" />
                4. Configuring Property Mapping
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Every HubSpot portal uses different property names. The <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-sm" onClick={() => setLocation("/configure-cascata")}>Configure Cascata Environment</Button> page lets you map your specific properties.</p>
                <p>You'll answer questions like:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Contact properties:</strong> SQL date field, region/pod field, SQL type field, opportunity date field</li>
                  <li><strong>Deal properties:</strong> Deal region/pod, SQL type on deals, deal value (ARR/ACV), close date, create date</li>
                  <li><strong>Deal classification:</strong> Which stage IDs are "closed-won", which deal types are "new business" vs "upsell"</li>
                  <li><strong>Model defaults:</strong> Fallback timing distributions and conversion rates when data is sparse</li>
                </ul>
                <p>For more detail on each field, see the <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-sm" onClick={() => setLocation("/how-it-works")}>Technical Documentation</Button> page.</p>
              </div>
            </div>

            {/* 5. First Sync */}
            <SectionAnchor id="first-sync" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-cyan-500" />
                5. Running Your First Sync
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Once your properties are configured:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Click the <strong>Refresh</strong> button in the top navigation bar (or use the button on the Integrations page).</li>
                  <li>Cascata will fetch contacts and deals from HubSpot, calculate conversion rates, timing distributions, and generate cascade forecasts.</li>
                  <li>A toast notification will confirm how many contacts and deals were synced.</li>
                  <li>The sidebar will populate with cascade sheet links for each motion/region combination found in your data.</li>
                </ol>
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-blue-800"><strong>Tip:</strong> The first sync is a full sync and may take 30-60 seconds depending on data volume. Subsequent syncs are incremental and much faster.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 6. Dashboard Tour */}
            <SectionAnchor id="dashboard-tour" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-blue-500" />
                6. Dashboard Overview
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>The dashboard provides a high-level view of your forecast accuracy and revenue performance:</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { title: "R-Score Trend", desc: "Pearson correlation showing how well the model tracks actuals. 1.0 = perfect." },
                    { title: "Opp Coverage R / Win Rate R", desc: "Separate R-scores for opportunity coverage and win rate accuracy." },
                    { title: "Quota Attainment", desc: "Actual total bookings vs revenue targets you've set." },
                    { title: "Total Bookings", desc: "Sum of all new business + upsell closed-won revenue." },
                    { title: "Data Coverage", desc: "How much of your HubSpot data was successfully used by the model." },
                    { title: "CARR Waterfall", desc: "Opening CARR + New + Upsell - Churn = Closing CARR, quarter by quarter." },
                  ].map((item) => (
                    <Card key={item.title} className="bg-muted/30">
                      <CardContent className="pt-3 pb-2.5">
                        <p className="text-xs font-semibold mb-0.5">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p>Below the cards, a <strong>hierarchical drill-down table</strong> lets you expand regions, quarters, and motions to see detailed model vs actual vs target comparisons with RAG indicators.</p>
              </div>
            </div>

            {/* 7. Cascade Sheets */}
            <SectionAnchor id="cascade-sheets" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                7. Reading Cascade Sheets
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Each cascade sheet shows the full staircase model for one motion + region combination. The sheet has two panels side by side:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 mt-0.5 text-blue-600 border-blue-300 text-xs">Left</Badge>
                    <span><strong>SQL → Opportunity</strong> — Shows how SQLs convert to opportunities over time, with timing probabilities and actuals.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 mt-0.5 text-emerald-600 border-emerald-300 text-xs">Right</Badge>
                    <span><strong>Opportunity → Revenue</strong> — Shows how opportunities close as deals, with win rates, ACVs, and revenue forecasts.</span>
                  </div>
                </div>
                <p>Rows represent source quarters, columns represent destination quarters. The diagonal staircase pattern shows each cohort cascading forward.</p>
                <p>Use the <strong>quarter range filter</strong> above the table to focus on specific time periods.</p>
              </div>
            </div>

            {/* 8. Revenue Planning */}
            <SectionAnchor id="revenue-planning" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                8. Revenue Planning & Targets
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>The <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-sm" onClick={() => setLocation("/revenue-planning")}>Revenue Planning</Button> page lets you set targets and track performance:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Revenue Targets:</strong> Set quarterly targets for SQLs, Opps, Wins, and Revenue (New/Upsell/Total) by region.</li>
                  <li><strong>Churn & Adjustments:</strong> Record churn amounts, M&A ARR additions, and manual adjustments per quarter.</li>
                  <li><strong>Headcount:</strong> Track AM and AE headcount per quarter to calculate bookings-per-head metrics.</li>
                </ul>
                <p>Targets feed into the dashboard's RAG indicators (Red/Amber/Green) comparing actuals vs targets, and into the CARR waterfall.</p>
              </div>
            </div>

            {/* 9. Ongoing Use */}
            <SectionAnchor id="ongoing" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-teal-500" />
                9. Ongoing Use & Data Refresh
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Auto sync:</strong> Cascata syncs from HubSpot automatically every day at 2:00 AM UTC.</li>
                  <li><strong>Manual refresh:</strong> Click the Refresh button in the top bar any time for an immediate delta sync.</li>
                  <li><strong>Data quality:</strong> Check the <strong>Data Quality</strong> page (under Settings) to see how many contacts/deals were used vs skipped.</li>
                  <li><strong>Portal stats:</strong> The <strong>Portal Stats</strong> page shows sync history, database size, and system health.</li>
                </ul>
              </div>
            </div>

            {/* 10. FAQ */}
            <SectionAnchor id="faq" />
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-500" />
                10. FAQ
              </h2>
              <div className="space-y-4">
                {[
                  { q: "How long does the first sync take?", a: "Usually 30-60 seconds. It depends on the number of contacts and deals in your HubSpot portal." },
                  { q: "What if I change my HubSpot property names?", a: "Go to Configure Cascata Environment and update the mapping. Then run a manual refresh to re-sync with the new configuration." },
                  { q: "Can multiple people access the same company data?", a: "Currently each account is linked to one company. Multi-user access to the same company is on the roadmap." },
                  { q: "What HubSpot plan do I need?", a: "Any HubSpot plan that supports Private Apps (Professional or Enterprise). The free CRM doesn't support Private Apps." },
                  { q: "Is my HubSpot data stored?", a: "Cascata stores aggregated metrics (SQL counts, conversion rates, deal economics) — not individual contact or deal records. Your token is encrypted at rest." },
                  { q: "What's the difference between the Documentation page and this page?", a: "This page is a getting-started guide. The Documentation page (under Settings > Documentation) covers the cascade engine math and data model in technical detail." },
                ].map((item) => (
                  <Card key={item.q}>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-sm font-medium mb-1">{item.q}</p>
                      <p className="text-xs text-muted-foreground">{item.a}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Footer CTA */}
            <Card className="border-blue-200 bg-blue-50/40">
              <CardContent className="pt-5 pb-4 text-center">
                <p className="text-sm font-medium mb-2">Ready to get started?</p>
                <div className="flex justify-center gap-3">
                  <Button size="sm" onClick={() => setLocation("/integrations")}>
                    <Plug className="h-4 w-4 mr-1.5" /> Connect HubSpot
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setLocation("/how-it-works")}>
                    <BookOpen className="h-4 w-4 mr-1.5" /> Technical Docs
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
