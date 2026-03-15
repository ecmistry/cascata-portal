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
        <div className="container px-4 sm:px-6 py-6 md:py-12">
          <div className="mx-auto max-w-4xl">

            {/* Header */}
            <div className="mb-8 sm:mb-12">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-3">Cascata Portal Documentation</h1>
              <p className="text-sm sm:text-lg text-muted-foreground">
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
                    ["overview", "1. What Cascata Does & Timing Distributions"],
                    ["data-pipeline", "2. Data Pipeline (HubSpot ELT Sync)"],
                    ["configuration", "3. Configuration Page"],
                    ["cascade-engine", "4. The Cascade Calculation Engine (6 Steps)"],
                    ["cascade-sheets", "5. Reading the Cascade Sheets (Two-Panel Layout)"],
                    ["deal-classification", "6. Deal Classification Explained"],
                    ["data-model", "7. Internal Data Model"],
                    ["daily-sync", "8. Daily Sync & Keeping Data Fresh"],
                    ["glossary", "9. Glossary"],
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
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
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

                <h3 className="text-lg font-semibold mt-6 mb-3">The Two Cascades</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  The cascade model has two stages, each with its own timing distribution, shown side by side
                  on each cascade sheet separated by a <strong className="text-red-600">red vertical bar</strong>:
                </p>
                <div className="grid md:grid-cols-5 gap-3 mb-4">
                  <Card className="text-center">
                    <CardContent className="pt-5">
                      <Badge variant="outline" className="mb-2 text-blue-600 border-blue-300">Stage 1</Badge>
                      <p className="font-semibold text-sm">SQL Created</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        A contact reaches SQL status
                      </p>
                    </CardContent>
                  </Card>
                  <div className="flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1">
                      <ArrowRight className="h-5 w-5 text-blue-400 hidden md:block" />
                      <ArrowDown className="h-5 w-5 text-blue-400 md:hidden" />
                      <span className="text-[10px] text-muted-foreground">SQL Timing</span>
                    </div>
                  </div>
                  <Card className="text-center">
                    <CardContent className="pt-5">
                      <Badge variant="outline" className="mb-2 text-green-600 border-green-300">Stage 2</Badge>
                      <p className="font-semibold text-sm">Opportunity Created</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        SQL converts to an opportunity
                      </p>
                    </CardContent>
                  </Card>
                  <div className="flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1">
                      <ArrowRight className="h-5 w-5 text-emerald-400 hidden md:block" />
                      <ArrowDown className="h-5 w-5 text-emerald-400 md:hidden" />
                      <span className="text-[10px] text-muted-foreground">Opp Timing</span>
                    </div>
                  </div>
                  <Card className="text-center">
                    <CardContent className="pt-5">
                      <Badge variant="outline" className="mb-2 text-emerald-600 border-emerald-300">Stage 3</Badge>
                      <p className="font-semibold text-sm">Deal Won</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Opportunity closes as won
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <h3 className="text-lg font-semibold mt-8 mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-teal-500" />
                  Timing Distributions -- The Heart of the Cascade
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  There are <strong>two timing distributions</strong>, one for each cascade:
                </p>

                <h4 className="text-sm font-semibold mt-4 mb-2 text-blue-800">1. SQL Timing (SQL &rarr; Opportunity)</h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Calculated from contacts that have both a <strong>SQL date</strong> and an <strong>Opportunity date</strong>.
                  The quarter difference between these dates builds the probability distribution:
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded border border-blue-100">
                    <span className="text-sm font-medium text-blue-900">Same Quarter</span>
                    <span className="text-sm font-semibold text-blue-700">Typically 85-95%</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-blue-50/60 rounded border border-blue-100">
                    <span className="text-sm font-medium text-blue-800">Next Quarter</span>
                    <span className="text-sm font-semibold text-blue-600">Typically 5-12%</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-blue-50/30 rounded border border-blue-100">
                    <span className="text-sm font-medium text-blue-700">+2 Quarters</span>
                    <span className="text-sm font-semibold text-blue-500">Typically 1-3%</span>
                  </div>
                </div>

                <h4 className="text-sm font-semibold mt-4 mb-2 text-emerald-800">2. Opp Win Timing (Opportunity &rarr; Deal Won)</h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Calculated from closed-won deals by comparing the <strong>deal create date</strong> to the
                  <strong> deal close date</strong>. This typically spans more quarters since deals take longer to close:
                </p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 rounded border border-emerald-100">
                    <span className="text-sm font-medium text-emerald-900">Same Quarter</span>
                    <span className="text-sm font-semibold text-emerald-700">Typically 10-20%</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded border border-emerald-100">
                    <span className="text-sm font-medium text-emerald-800">+1 Quarter</span>
                    <span className="text-sm font-semibold text-emerald-600">Typically 30-40%</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50/40 rounded border border-emerald-100">
                    <span className="text-sm font-medium text-emerald-700">+2 to +6 Quarters</span>
                    <span className="text-sm font-semibold text-emerald-500">Remaining %</span>
                  </div>
                </div>

                <p className="text-muted-foreground text-sm mb-4">
                  A minimum of 5 data points is required per SQL type to generate custom distributions.
                  Below that, defaults are used. Each SQL type (motion) gets its own distributions --
                  Inbound SQLs may convert faster and close sooner than Outbound, for example.
                </p>
                <p className="text-muted-foreground text-sm">
                  These timing distributions create the "cascade" (staircase) pattern: values from one quarter
                  spill forward into subsequent quarters based on the probabilities, and each cascade sheet
                  shows this diagonal pattern clearly.
                </p>
              </div>
            </div>

            {/* 2. Data Pipeline */}
            <SectionAnchor id="data-pipeline" />
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
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
                    desc: "Fetches contacts that have an SQL date (HAS_PROPERTY filter) and closed-won deals from HubSpot's Search API. Uses configurable property names from the Configuration page.",
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
                      <span><strong>Actuals</strong> -- actual SQLs (from contacts), opportunities (contacts with opp date), and revenue (closed-won deals) per quarter</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Conversion Rates</strong> -- true SQL→Opp ratio (from contacts) and win rates (won deals / opportunities)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Deal Economics</strong> -- average ACV for new business and upsell</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>SQL Timing</strong> -- probability of SQL converting in same/next/+2 quarter</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span><strong>Opp Win Timing</strong> -- probability of deal closing in each quarter after opportunity creation</span>
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
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
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

              <h3 className="text-lg font-semibold mt-6 mb-3">Deal Properties (5 questions)</h3>
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
                  {
                    q: "What field tracks when a deal was created?",
                    why: "Determines when a deal entered the pipeline. Used for timing analysis to understand deal velocity and pipeline entry points.",
                    example: "createdate",
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

              <h3 className="text-lg font-semibold mt-6 mb-3">Model Defaults (3 settings)</h3>
              <div className="space-y-3 mb-6">
                {[
                  {
                    q: "SQL Timing Distribution defaults",
                    why: "When a motion has fewer than 5 contacts with both SQL and Opp dates, these fallback probabilities are used instead. Values are in basis points (8900 = 89%). The three values (same quarter, next quarter, +2 quarters) must sum to 10000.",
                    example: "8900 / 1000 / 100",
                  },
                  {
                    q: "Opp Win Timing Distribution defaults",
                    why: "When a motion has fewer than 5 closed-won deals with create and close dates, these fallback probabilities are used. Enter comma-separated percentages for each quarter offset (e.g. 14%, 33%, 25%, 15%, 7%, 4%, 2%).",
                    example: "14, 33, 25, 15, 7, 4, 2",
                  },
                  {
                    q: "Default Conversion Rate",
                    why: "When a quarter has no actual data to derive a SQL→Opp conversion rate, this fallback is used. Value in basis points (5000 = 50%). Override this based on your historical average.",
                    example: "5000",
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
            </div>

            {/* 4. Cascade Engine */}
            <SectionAnchor id="cascade-engine" />
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
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
                      For each quarter, calculate the true SQL→Opportunity conversion rate:
                      <code className="bg-muted px-1 py-0.5 rounded text-xs ml-1">
                        conversion rate = contacts with opp date / contacts with SQL date
                      </code>
                      (capped at 100%). Opportunities are counted from contacts that have an opportunity date, not from
                      closed-won deals, giving a true SQL→Opp rate. If a future quarter has no actuals, the overall
                      historical average is used, falling back to the configurable default (50% by default).
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
                      These percentages are derived from your data when enough samples exist (5+); otherwise configurable defaults from the settings page are used.
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
                    <h4 className="font-semibold text-sm mb-2">Step 5: Opportunity Cascade (Opp &rarr; Deal Won)</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      The "Total Opps Created" from each quarter column feeds into the second cascade. First, the
                      combined win rate (new business + upsell) is applied to convert opportunities into expected wins.
                      Then the opp win timing distribution spreads those expected wins across future quarters:
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">Same Quarter: ~14%</Badge>
                      <Badge variant="outline" className="text-xs">+1 Quarter: ~33%</Badge>
                      <Badge variant="outline" className="text-xs">+2 Quarters: ~25%</Badge>
                      <Badge variant="outline" className="text-xs">+3 to +6 Quarters: remaining</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-pink-500">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold text-sm mb-2">Step 6: Calculate Revenue</h4>
                    <p className="text-xs text-muted-foreground">
                      Won deals are multiplied by win rates (separately for new business and upsell) and then by
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
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                5. Reading the Cascade Sheets
              </h2>
              <p className="text-muted-foreground mb-4">
                The sidebar dynamically generates one cascade sheet for each motion + region combination that has data.
                These are not hardcoded -- they are discovered from your actual HubSpot data.
              </p>

              <Card className="mb-4">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">Two-Panel Side-by-Side Layout</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Each cascade sheet displays two panels placed <strong>side by side</strong> within a single horizontally
                    scrollable container:
                  </p>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5 text-blue-600 border-blue-300">Left Panel</Badge>
                      <span><strong>SQL &rarr; Opportunity Cascade</strong> -- Shows SQL volumes, the SQL timing probability matrix (diagonal), and how SQLs cascade forward into opportunities by quarter.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge className="shrink-0 mt-0.5 bg-red-500 text-white border-red-500">Red Bar</Badge>
                      <span>A red vertical divider separates the two cascades, mirroring the Excel spreadsheet format.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5 text-emerald-600 border-emerald-300">Right Panel</Badge>
                      <span><strong>Opportunity &rarr; Deal Won Cascade</strong> -- Takes the "Total Opps Created" from the left panel, applies the combined win rate, then cascades forward using the opp win timing distribution to predict when deals close.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-4">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">Anatomy of Each Panel</h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">Header</Badge>
                      <span>Shows the motion/region name, overall conversion rate, win rates (new/upsell), and average contract values.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">Probability Matrix</Badge>
                      <span>A diagonal matrix showing the timing probabilities. For the SQL cascade this is 3 values (same/next/+2 quarter). For the Opp cascade this can span 4-7+ quarters since deals take longer to close.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">Cascade Table</Badge>
                      <span>Rows = source quarters. Columns = destination quarters. The staircase pattern shows each cohort cascading forward. Column totals at the bottom show totals per quarter.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">Dropdown</Badge>
                      <span>Switch between different motion/region sheets to compare performance across segments.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-4">
                <CardContent className="pt-5">
                  <h4 className="text-sm font-semibold mb-3">Quarter Range Filter</h4>
                  <p className="text-xs text-muted-foreground">
                    Above the cascade table, "From" and "To" quarter selectors let you narrow the displayed range.
                    By default, all available quarters are shown. Select specific start and end quarters to focus on
                    a particular time period. Click "Reset" to return to the full view. This is useful for comparing
                    like-for-like periods or focusing on recent quarters.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 6. Deal Classification */}
            <SectionAnchor id="deal-classification" />
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
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

            {/* 7. Data Model */}
            <SectionAnchor id="data-model" />
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-slate-500" />
                7. Internal Data Model
              </h2>
              <p className="text-muted-foreground mb-4">
                The database stores the following tables, all populated automatically from HubSpot:
              </p>

              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 sm:p-2.5 font-semibold border-b">Table</th>
                      <th className="text-left p-2 sm:p-2.5 font-semibold border-b">Content</th>
                      <th className="text-left p-2 sm:p-2.5 font-semibold border-b">Granularity</th>
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
                      <td className="p-2.5">True SQL→Opp ratio (from contacts), win rates = won deals / opportunities (new/upsell)</td>
                      <td className="p-2.5">Per SQL type, per region (aggregate)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">dealEconomics</td>
                      <td className="p-2.5">Average ACV for new business and upsell</td>
                      <td className="p-2.5">Per region</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2.5 font-mono text-xs">timeDistributions</td>
                      <td className="p-2.5">SQL timing (same/next/+2 quarter) + opp win timing (JSON array of quarter probabilities)</td>
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

            {/* 8. Daily Sync */}
            <SectionAnchor id="daily-sync" />
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-cyan-500" />
                8. Daily Sync & Keeping Data Fresh
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
                      Only contacts that have the SQL date property set (<code className="bg-muted px-1 rounded">HAS_PROPERTY</code> filter) are fetched.
                    </p>
                    <p>
                      <strong>Deals:</strong> Filtered by <code className="bg-muted px-1 rounded">hs_lastmodifieddate &gt;= last sync time</code>.
                      Only closed-won deals are fetched (filtered by configured closed-won stage IDs).
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

            {/* 9. Glossary */}
            <SectionAnchor id="glossary" />
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                9. Glossary
              </h2>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[400px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 sm:p-2.5 font-semibold border-b w-[120px] sm:w-[180px]">Term</th>
                      <th className="text-left p-2 sm:p-2.5 font-semibold border-b">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ["SQL", "Sales Qualified Lead -- a contact that has been qualified by sales as a genuine opportunity to pursue."],
                      ["Motion", "The channel or method that generated the SQL: Inbound (marketing-sourced), Outbound (BDR-generated), Event, Partner, Inbound Led Outbound (ILO)."],
                      ["Region / Pod", "The sales team, geographic territory, or pod that owns the SQL or deal."],
                      ["Cascade", "A quarter-by-quarter matrix showing how SQL cohorts flow forward through the pipeline over time."],
                      ["Conversion Rate", "The percentage of SQLs that become opportunities. Calculated per quarter from contacts with opp dates divided by contacts with SQL dates. Uses configurable fallback when no data exists."],
                      ["SQL Timing", "The probability split of when converted SQLs become opportunities (same quarter, next quarter, or later). Shown in the left panel."],
                      ["Opp Win Timing", "The probability split of when opportunities close as won deals, spanning multiple quarters. Calculated from deal create date to close date. Shown in the right panel."],
                      ["Win Rate", "The percentage of opportunities that close as won deals (won deals / contacts with opp date). Tracked separately for new business and upsell. Combined win rate is applied in the opp cascade before timing distribution."],
                      ["ACV", "Average Contract Value -- the mean deal value, calculated from closed-won deals. Separate values for new business and upsell."],
                      ["ELT Sync", "Extract-Load-Transform -- the process of pulling data from HubSpot, loading it into the database, and transforming it into the cascade model."],
                      ["Delta Sync", "An incremental sync that only processes records modified since the last sync, reducing API calls and processing time."],
                      ["Quarter Range Filter", "From/To quarter selectors on cascade sheets that let you narrow the displayed columns to a specific time period."],
                      ["Model Defaults", "Configurable fallback values (SQL timing, opp timing, conversion rate) used when fewer than 5 data points exist for a motion. Set on the Configuration page."],
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
