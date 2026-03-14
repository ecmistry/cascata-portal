import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ArrowDown,
  Database,
  RefreshCw,
  Settings,
  Layers,
  BarChart3,
  Clock,
  GitBranch,
  HelpCircle,
  CheckCircle2,
  Zap,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-20" />;
}

export default function Home() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container py-8 md:py-12">
          <div className="mx-auto max-w-4xl">

            {/* Header */}
            <div className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight mb-3">Cascata Portal Documentation</h1>
              <p className="text-lg text-muted-foreground">
                A detailed guide to how Cascata forecasts revenue from your HubSpot CRM data.
              </p>
            </div>

            {/* Table of Contents */}
            <Card className="mb-12">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Contents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-1.5">
                  {[
                    ["overview", "1. What Cascata Does"],
                    ["data-pipeline", "2. Data Pipeline (HubSpot ELT Sync)"],
                    ["configuration", "3. Configuration Page"],
                    ["cascade-engine", "4. The Cascade Calculation Engine"],
                    ["cascade-sheets", "5. Reading the Cascade Sheets"],
                    ["deal-classification", "6. Deal Classification Explained"],
                    ["timing", "7. Timing Distributions"],
                    ["data-model", "8. Internal Data Model"],
                    ["daily-sync", "9. Daily Sync & Keeping Data Fresh"],
                    ["glossary", "10. Glossary"],
                  ].map(([id, title]) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline py-0.5"
                    >
                      {title}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 1. Overview */}
            <SectionAnchor id="overview" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                1. What Cascata Does
              </h2>
              <div className="prose max-w-none">
                <p className="text-muted-foreground mb-4">
                  Cascata is a revenue forecasting platform that connects directly to your HubSpot CRM and answers one central question:
                </p>
                <Card className="bg-blue-50 border-blue-200 mb-6">
                  <CardContent className="pt-5">
                    <p className="text-base font-medium text-blue-900 italic text-center">
                      "Given the SQLs we're generating today, how many opportunities and how much revenue can we expect in the coming quarters?"
                    </p>
                  </CardContent>
                </Card>
                <p className="text-muted-foreground mb-4">
                  It does this by building a <strong>cascade model</strong> -- a quarter-by-quarter projection that takes your historical
                  Sales Qualified Leads (SQLs) and models how they convert into opportunities over time, using probability
                  distributions derived from your own data.
                </p>
                <p className="text-muted-foreground mb-4">
                  The model is broken down by <strong>motion</strong> (how the SQL was generated -- Inbound, Outbound, Event, Partner, etc.)
                  and <strong>region/pod</strong> (which team or geography owns the SQL). Each combination gets its own cascade sheet
                  because conversion rates, timing, and deal values differ across these dimensions.
                </p>

                <h3 className="text-lg font-semibold mt-6 mb-3">The Two Cascade Moments</h3>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <Card className="text-center">
                    <CardContent className="pt-5">
                      <Badge variant="outline" className="mb-2 text-blue-600 border-blue-300">Stage 1</Badge>
                      <p className="font-semibold text-sm">SQL Created</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        A contact reaches Sales Qualified Lead status in HubSpot
                      </p>
                    </CardContent>
                  </Card>
                  <div className="flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1">
                      <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />
                      <ArrowDown className="h-5 w-5 text-muted-foreground md:hidden" />
                      <span className="text-xs text-muted-foreground">Conversion %</span>
                      <span className="text-xs text-muted-foreground">+ Timing</span>
                    </div>
                  </div>
                  <Card className="text-center">
                    <CardContent className="pt-5">
                      <Badge variant="outline" className="mb-2 text-green-600 border-green-300">Stage 2</Badge>
                      <p className="font-semibold text-sm">Opportunity Created</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The SQL converts to a deal/opportunity in the pipeline
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <p className="text-muted-foreground text-sm">
                  Once opportunities exist, Cascata also tracks <strong>win rates</strong> (new business vs upsell)
                  and <strong>average contract values (ACV)</strong> to project revenue.
                </p>
              </div>
            </div>

            {/* 2. Data Pipeline */}
            <SectionAnchor id="data-pipeline" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-500" />
                2. Data Pipeline (HubSpot ELT Sync)
              </h2>
              <p className="text-muted-foreground mb-4">
                Cascata pulls data directly from HubSpot's CRM API using an Extract-Load-Transform (ELT) process.
                This runs automatically every day and supports incremental (delta) syncs.
              </p>

              <div className="space-y-3 mb-6">
                {[
                  {
                    step: "Extract",
                    color: "bg-blue-500",
                    desc: "Fetches contacts at the SQL lifecycle stage and all deals from HubSpot's Search API. Uses configurable property names from the Configuration page.",
                  },
                  {
                    step: "Load",
                    color: "bg-purple-500",
                    desc: "Upserts the raw data into the local MariaDB database, deduplicating by region, SQL type, year, and quarter.",
                  },
                  {
                    step: "Transform",
                    color: "bg-green-500",
                    desc: "Calculates SQL volumes, conversion rates, win rates, deal economics (ACV), and timing distributions. Then runs the cascade forecast engine to project future quarters.",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3 items-start">
                    <div className={`${item.color} text-white text-xs font-bold rounded px-2.5 py-1 mt-0.5 shrink-0 w-20 text-center`}>
                      {item.step}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-2">What gets synced into the database:</h4>
                  <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>SQL History</strong> -- volume of SQLs per quarter, per motion, per region</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Actuals</strong> -- actual SQLs, opportunities, and revenue per quarter</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Conversion Rates</strong> -- SQL→Opp ratio and win rates (new/upsell)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Deal Economics</strong> -- average ACV for new business and upsell</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Timing Distributions</strong> -- probability of SQL converting in same/next/+2 quarter</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Forecasts</strong> -- projected opportunities and revenue per quarter</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 3. Configuration */}
            <SectionAnchor id="configuration" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-500" />
                3. Configuration Page
              </h2>
              <p className="text-muted-foreground mb-4">
                The <strong>Configure Cascata Environment</strong> page is where you tell Cascata which HubSpot properties
                to use. Every HubSpot portal is different, so this page lets you map your specific property names to the
                concepts Cascata needs. The configuration is saved and used by the daily sync.
              </p>

              <h3 className="text-lg font-semibold mt-6 mb-3">Contact Properties (4 questions)</h3>
              <div className="space-y-3 mb-6">
                {[
                  {
                    q: "Which field determines when someone became an SQL?",
                    why: "This is the anchor date for the entire cascade. It determines which quarter an SQL falls into. Using the actual SQL date (rather than create date) ensures accuracy when contacts were created earlier in the funnel.",
                    example: "admin___first_became_a_sql_date",
                  },
                  {
                    q: "How do you identify contact teams/regions?",
                    why: "This groups SQLs into separate cascade sheets per team. Each team may have different conversion characteristics. The sync reads the distinct values from this property and creates a cascade sheet for each.",
                    example: "contact_pod",
                  },
                  {
                    q: "What field tracks the type of SQL?",
                    why: "Different go-to-market motions (Inbound, Outbound, Event, Partner) have very different conversion profiles. This property splits the cascade into one sheet per motion.",
                    example: "type_of_sql",
                  },
                  {
                    q: "What date field tracks conversion to opportunity?",
                    why: "By comparing the SQL date to the opportunity date, Cascata calculates the actual timing distribution -- what percentage of SQLs convert in the same quarter, next quarter, or later. This replaces hardcoded assumptions with your real data.",
                    example: "admin___first_became_an_opportunity_date",
                  },
                ].map((item, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-sm font-medium mb-1">{item.q}</p>
                      <p className="text-xs text-muted-foreground mb-2">{item.why}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs font-mono">{item.example}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <h3 className="text-lg font-semibold mt-6 mb-3">Deal Properties (4 questions)</h3>
              <div className="space-y-3 mb-6">
                {[
                  {
                    q: "How do you identify deal teams/regions?",
                    why: "Links deals back to regions so revenue and win rates can be calculated per team. Must correspond to the same team structure used for contacts.",
                    example: "deal_pod",
                  },
                  {
                    q: "Where do you track the SQL type on deals?",
                    why: "Connects deals back to the original SQL motion. This is critical for calculating per-motion conversion rates and win rates accurately.",
                    example: "type_of_sql_associated_to_deal",
                  },
                  {
                    q: "What field captures deal value (ARR/ACV)?",
                    why: "Used to calculate average contract values for new business and upsell deals. This directly feeds into the revenue forecast.",
                    example: "amount",
                  },
                  {
                    q: "What field tracks the close date?",
                    why: "Determines which quarter a closed-won deal falls into, so that actual revenue can be correctly assigned by time period.",
                    example: "closedate",
                  },
                ].map((item, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-sm font-medium mb-1">{item.q}</p>
                      <p className="text-xs text-muted-foreground mb-2">{item.why}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs font-mono">{item.example}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <h3 className="text-lg font-semibold mt-6 mb-3">Deal Classification (3 settings)</h3>
              <p className="text-muted-foreground text-sm mb-3">
                See <a href="#deal-classification" className="text-blue-600 hover:underline">Section 6</a> for a detailed explanation.
              </p>
            </div>

            {/* 4. Cascade Engine */}
            <SectionAnchor id="cascade-engine" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                4. The Cascade Calculation Engine
              </h2>
              <p className="text-muted-foreground mb-4">
                This is the mathematical core of Cascata. For each motion + region combination, the engine runs the following steps:
              </p>

              <div className="space-y-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2">Step 1: Load SQL Volumes</h4>
                    <p className="text-xs text-muted-foreground">
                      Fetch historical SQL counts per quarter from the database. For example, Q1 2024 might have 45 Inbound SQLs for NORAM.
                      These are actual counts from HubSpot based on the configured SQL date field.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2">Step 2: Determine Conversion Rates</h4>
                    <p className="text-xs text-muted-foreground">
                      For each quarter, calculate the SQL→Opportunity conversion rate from actual data:
                      <code className="bg-muted px-1 py-0.5 rounded text-xs ml-1">
                        conversion rate = actual opportunities / actual SQLs
                      </code>
                      (capped at 100%). If a future quarter has no actuals yet, the overall historical average is used.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2">Step 3: Apply Timing Distribution</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      Not all converted SQLs become opportunities in the same quarter. The timing distribution
                      (derived from actual SQL date → Opportunity date pairs) splits them:
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">Same Quarter: ~89%</Badge>
                      <Badge variant="outline" className="text-xs">Next Quarter: ~10%</Badge>
                      <Badge variant="outline" className="text-xs">+2 Quarters: ~1%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      So 45 SQLs at 50% conversion = 22.5 expected opps, distributed as ~20 this quarter, ~2.25 next quarter, ~0.225 two quarters later.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2">Step 4: Sum Columns (The Cascade Effect)</h4>
                    <p className="text-xs text-muted-foreground">
                      Each quarter column in the cascade receives contributions from multiple source quarters (the current one plus
                      spillover from previous quarters). Summing down each column gives the total expected opportunities for that quarter.
                      This is the "cascade" -- SQL cohorts from different quarters cascading forward in time.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2">Step 5: Calculate Revenue</h4>
                    <p className="text-xs text-muted-foreground">
                      Opportunities are multiplied by win rates (separately for new business and upsell) and then by
                      average contract values (ACV) to produce revenue forecasts. Win rates and ACVs are calculated
                      from your actual closed-won deals in HubSpot.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 5. Cascade Sheets */}
            <SectionAnchor id="cascade-sheets" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                5. Reading the Cascade Sheets
              </h2>
              <p className="text-muted-foreground mb-4">
                The sidebar dynamically generates one cascade sheet for each motion + region combination that has data.
                These are not hardcoded -- they are discovered from your actual HubSpot data.
              </p>

              <Card className="mb-4">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">Anatomy of a Cascade Sheet</h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">Header</Badge>
                      <span>Shows the motion/region name, overall conversion rate, win rates (new/upsell), and average contract values.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">Probabilities</Badge>
                      <span>The SQL timing distribution -- what percentage of converted SQLs land in same/next/+2 quarter. These are calculated from your actual data when enough samples exist (5+ contacts with both SQL and Opp dates).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">Table</Badge>
                      <span>Rows = source quarters (when SQLs were created). Columns = destination quarters (when opportunities land). The diagonal pattern shows the cascade effect. Column totals at the bottom show total expected opportunities per quarter.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">Dropdown</Badge>
                      <span>Switch between different motion/region sheets to compare how Inbound NORAM differs from Outbound EMESA, for example.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 6. Deal Classification */}
            <SectionAnchor id="deal-classification" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-red-500" />
                6. Deal Classification Explained
              </h2>
              <p className="text-muted-foreground mb-4">
                The Deal Classification section on the Configuration page controls how deals in your HubSpot pipeline
                are categorised for the cascade model. This is critical because Cascata needs to know:
              </p>

              <div className="space-y-4">
                <Card className="border-l-4 border-l-red-400">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-red-400" />
                      Closed-Won Stage IDs
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>What it is:</strong> The internal HubSpot deal stage identifiers that represent a "won" deal.
                      Every HubSpot pipeline has different stage IDs -- some use names like "closedwon", others use
                      numeric IDs like "19291292".
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>Why it matters:</strong> This determines which deals count as actual revenue. Only deals in these stages
                      are used to calculate win rates, actual revenue, conversion rates, and average contract values.
                      If this is wrong, your revenue numbers will be incorrect.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>How to find yours:</strong> In HubSpot, go to Settings → Objects → Deals → Pipelines. Click on
                      your pipeline and look at the stage names. The internal ID is visible in the URL when you click on a stage,
                      or you can check your deal data in the Configure page to see what values appear in the "dealstage" property.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-400">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-blue-400" />
                      New Business Deal Types
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>What it is:</strong> The values in HubSpot's "Deal Type" property that represent landing a brand new customer.
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>Why it matters:</strong> Cascata calculates separate win rates and ACVs for new business vs upsell.
                      New business deals typically have lower win rates but potentially higher contract values. This split
                      gives you a more accurate revenue forecast.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Common values:</strong> "newbusiness", "New Business", "new_business"
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-400">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-green-400" />
                      Upsell/Renewal Deal Types
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>What it is:</strong> Deal type values for expanding revenue within existing customers -- upsells, cross-sells, and renewals.
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>Why it matters:</strong> Upsell deals typically have higher win rates but may have different
                      average contract values. Tracking them separately ensures the cascade model doesn't inflate
                      new business projections with upsell win rates or vice versa.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Common values:</strong> "existingbusiness", "customerrenewal", "Existing Business", "Renewal"
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 7. Timing Distributions */}
            <SectionAnchor id="timing" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-500" />
                7. Timing Distributions
              </h2>
              <p className="text-muted-foreground mb-4">
                The timing distribution is what makes the cascade a cascade. It answers: "When an SQL converts to
                an opportunity, how quickly does that happen?"
              </p>

              <Card className="mb-4">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">How it's calculated</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    During each sync, Cascata looks at every contact that has both a <strong>SQL date</strong> and an
                    <strong> Opportunity date</strong>. It calculates the quarter difference between these two dates and
                    builds a probability distribution:
                  </p>
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between p-2.5 bg-teal-50 rounded border border-teal-100">
                      <span className="text-sm font-medium text-teal-900">Same Quarter (0 quarter gap)</span>
                      <span className="text-sm font-semibold text-teal-700">Typically 85-95%</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-teal-50/60 rounded border border-teal-100">
                      <span className="text-sm font-medium text-teal-800">Next Quarter (1 quarter gap)</span>
                      <span className="text-sm font-semibold text-teal-600">Typically 5-12%</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-teal-50/30 rounded border border-teal-100">
                      <span className="text-sm font-medium text-teal-700">Two Quarters Later (2+ quarter gap)</span>
                      <span className="text-sm font-semibold text-teal-500">Typically 1-3%</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A minimum of 5 contacts with both dates is required per SQL type to generate a custom distribution.
                    Below that threshold, a default of 89% / 10% / 1% is used. Each SQL type (motion) gets its own
                    distribution -- Inbound SQLs may convert faster than Outbound, for example.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 8. Data Model */}
            <SectionAnchor id="data-model" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-slate-500" />
                8. Internal Data Model
              </h2>
              <p className="text-muted-foreground mb-4">
                The database stores the following tables, all populated automatically from HubSpot:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2.5 font-semibold border-b">Table</th>
                      <th className="text-left p-2.5 font-semibold border-b">Content</th>
                      <th className="text-left p-2.5 font-semibold border-b">Granularity</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">sqlHistory</td>
                      <td className="p-2.5">Number of SQLs generated</td>
                      <td className="p-2.5">Per quarter, per SQL type, per region</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">actuals</td>
                      <td className="p-2.5">Actual SQLs, opportunities, and revenue</td>
                      <td className="p-2.5">Per quarter, per SQL type, per region</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">conversionRates</td>
                      <td className="p-2.5">SQL→Opp ratio, new/upsell win rates</td>
                      <td className="p-2.5">Per SQL type, per region (aggregate)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">dealEconomics</td>
                      <td className="p-2.5">Average ACV for new business and upsell</td>
                      <td className="p-2.5">Per region</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">timeDistributions</td>
                      <td className="p-2.5">Probability of same/next/+2 quarter conversion</td>
                      <td className="p-2.5">Per SQL type</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">regions</td>
                      <td className="p-2.5">Teams/pods (NORAM, EMESA North, etc.)</td>
                      <td className="p-2.5">Per company</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">sqlTypes</td>
                      <td className="p-2.5">SQL motions (Inbound, Outbound, etc.)</td>
                      <td className="p-2.5">Per company</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-xs">companies.syncConfig</td>
                      <td className="p-2.5">Saved configuration from the config page</td>
                      <td className="p-2.5">Per company (JSON)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 9. Daily Sync */}
            <SectionAnchor id="daily-sync" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-cyan-500" />
                9. Daily Sync & Keeping Data Fresh
              </h2>
              <p className="text-muted-foreground mb-4">
                The HubSpot sync runs automatically every day via cron at 2:00 AM UTC. It performs a delta sync,
                only fetching records modified since the last successful sync.
              </p>

              <Card className="mb-4">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">Delta Sync Logic</h4>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <strong>Contacts:</strong> Filtered by <code className="bg-muted px-1 rounded">lastmodifieddate &gt;= last sync time</code>.
                      Only contacts at the SQL lifecycle stage are fetched.
                    </p>
                    <p>
                      <strong>Deals:</strong> Filtered by <code className="bg-muted px-1 rounded">hs_lastmodifieddate &gt;= last sync time</code>.
                      All deals are fetched (filtering happens during transformation).
                    </p>
                    <p>
                      <strong>Full sync:</strong> Can be triggered manually to re-process all historical data. This is useful after changing
                      the configuration or if data seems out of date.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">Monitoring</h4>
                  <p className="text-xs text-muted-foreground">
                    The <strong>Portal Stats</strong> page (under Settings in the sidebar) shows the last sync time, records processed,
                    database size, CPU/memory usage, and any sync errors. Use this to verify the sync is running correctly.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 10. Glossary */}
            <SectionAnchor id="glossary" />
            <div className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                10. Glossary
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2.5 font-semibold border-b w-[180px]">Term</th>
                      <th className="text-left p-2.5 font-semibold border-b">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ["SQL", "Sales Qualified Lead -- a contact that has been qualified by sales as a genuine opportunity to pursue."],
                      ["Motion", "The channel or method that generated the SQL: Inbound (marketing-sourced), Outbound (BDR-generated), Event, Partner, ILO (Inbound-Led Outbound)."],
                      ["Region / Pod", "The sales team, geographic territory, or pod that owns the SQL or deal."],
                      ["Cascade", "A quarter-by-quarter matrix showing how SQL cohorts flow forward through the pipeline over time."],
                      ["Conversion Rate", "The percentage of SQLs that become opportunities. Calculated per quarter from actual HubSpot data."],
                      ["Timing Distribution", "The probability split of when converted SQLs become opportunities (same quarter, next quarter, or later)."],
                      ["Win Rate", "The percentage of opportunities that close as won deals. Tracked separately for new business and upsell."],
                      ["ACV", "Average Contract Value -- the mean deal value, calculated from closed-won deals. Separate values for new business and upsell."],
                      ["ELT Sync", "Extract-Load-Transform -- the process of pulling data from HubSpot, loading it into the database, and transforming it into the cascade model."],
                      ["Delta Sync", "An incremental sync that only processes records modified since the last sync, reducing API calls and processing time."],
                      ["Closed-Won", "A deal stage indicating the customer has signed and the deal is complete. Revenue is recognised at this stage."],
                    ].map(([term, def]) => (
                      <tr key={term} className="border-b">
                        <td className="p-2.5 font-semibold text-foreground">{term}</td>
                        <td className="p-2.5">{def}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
