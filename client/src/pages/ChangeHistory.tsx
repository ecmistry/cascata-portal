import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  RefreshCw,
  Wrench,
  Trash2,
  Shield,
  Bug,
  Settings,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface ChangeItem {
  text: string;
}

interface ChangeSection {
  type: "Added" | "Changed" | "Fixed" | "Removed" | "Security" | "Technical";
  items: ChangeItem[];
}

interface VersionEntry {
  version: string;
  date: string;
  sections: ChangeSection[];
}

const changelog: VersionEntry[] = [
  {
    version: "1.7.0",
    date: "2026-03-15",
    sections: [
      {
        type: "Added",
        items: [
          { text: 'Configurable model defaults: New "Model Defaults" section on the Configuration page for SQL timing distribution, opp win timing distribution, and default conversion rate — used as fallbacks when fewer than 5 data points exist for a motion' },
          { text: "True SQL→Opp conversion: Opportunities are now counted from contacts with opp dates (not from closed-won deals), giving an accurate SQL→Opportunity conversion rate per quarter" },
          { text: "Win rate in opp cascade: The combined win rate (new business + upsell) is now applied before the opp timing distribution, ensuring the right-panel cascade shows expected won deals rather than total opportunities" },
          { text: "Cascade engine alignment: Engine now uses per-quarter conversion rates from actuals, opp win timing from oppTimingJson, and data-driven quarter range from SQL history (instead of fixed 2024 Q1 start)" },
        ],
      },
      {
        type: "Changed",
        items: [
          { text: "Conversion rate semantics: oppCoverageRatio in conversionRates table is now true SQL→Opp (contacts with opp date / contacts with SQL date). winRateNew and winRateUpsell are now true win rates (won deals / total opportunities)" },
          { text: "Actuals table: actualOpps is now populated from contacts with opp dates (keyed by SQL date quarter), separate from actualRevenue which remains keyed by deal close date quarter" },
          { text: "Cascade engine: Rewrote core calculation to match cascade sheet logic — per-quarter conversion, full SQL + Opp timing cascade, win rate application, and per-motion ACV split" },
          { text: "Documentation: Updated to reflect true conversion semantics, win rate in opp cascade, configurable defaults, and updated glossary" },
        ],
      },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-03-14",
    sections: [
      {
        type: "Added",
        items: [
          { text: "Two-panel cascade layout: Cascade sheets now display the SQL → Opportunity cascade and Opportunity → Deal Won cascade side by side with a red vertical divider, matching the Excel spreadsheet format" },
          { text: "Opportunity cascade engine: New cascade stage that takes total opportunities per quarter from the SQL cascade and applies opp win timing probabilities to project when deals close across future quarters" },
          { text: "Opp win timing distribution: Calculated from deal create date → close date for closed-won deals, stored as JSON array in timeDistributions.oppTimingJson, with up to 7 quarter offsets" },
          { text: 'Quarter range filter: "From" and "To" quarter selectors on each cascade sheet allow narrowing the displayed range to a specific time period, with a Reset button to return to full view' },
          { text: "Database migration (0007_add_opp_timing.sql): Added oppTimingJson TEXT column to timeDistributions table" },
        ],
      },
      {
        type: "Changed",
        items: [
          { text: "Cascade sheet layout: Replaced stacked vertical layout with side-by-side horizontal scroll container — both panels share a single scrollbar" },
          { text: "Documentation page: Updated to cover both cascades, two-panel layout, probability matrices, quarter range filter, opp win timing distributions, and updated glossary" },
          { text: "Cascade engine: Added Step 5 (Opp → Deal Won) and Step 6 (Revenue), expanding from 5 to 6 steps" },
        ],
      },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-03-14",
    sections: [
      {
        type: "Added",
        items: [
          { text: "Extended data quality checks: Timing distribution gaps, deal amount anomalies, date anomalies, sparse region/motion combination warnings, and timing sample size per motion" },
          { text: "Deal skip reason tracking: Full breakdown of why closed-won deals are excluded — missing Deal Pod, unmapped region/SQL type, missing close date — with per-value unmapped counts" },
          { text: "Data flow waterfall view: Replaced simple summary cards with visual waterfall showing exactly how HubSpot records flow through filtering stages into the cascade model" },
          { text: 'Discrepancy explanation section: New "Understanding the Discrepancies" card on the Data Quality page explaining why numbers may differ from HubSpot reports' },
          { text: "117 data quality tests: Comprehensive test coverage for alias mapping, fallback logic, deal skip tracking, timing gaps, deal amount analysis, date anomalies, sparse combinations" },
        ],
      },
      {
        type: "Changed",
        items: [
          { text: "Contact fetch filter: Changed from filtering by lifecyclestage to HAS_PROPERTY on SQL date field, increasing fetched count from ~444 to ~2,268 — matching HubSpot report totals exactly" },
          { text: "Deal fetch filter: Changed from fetching all deals (4,387) to only fetching closed-won deals (1,638) server-side" },
          { text: "Removed lifecycle stage gate: Contact processing no longer checks lifecycle stage — if a contact has an SQL date, it's counted as an SQL" },
          { text: "HAS_PROPERTY operator support: Updated fetchAllRecords to correctly handle HubSpot Search API operators that don't accept a value parameter" },
        ],
      },
      {
        type: "Fixed",
        items: [
          { text: "SQL count alignment with HubSpot: Portal SQL volumes now align with HubSpot's contact pod report totals (2,268 contacts fetched = HubSpot report total)" },
        ],
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-03-14",
    sections: [
      {
        type: "Added",
        items: [
          { text: "HubSpot sync on Refresh: The top-bar Refresh button now triggers a live delta sync from HubSpot CRM, pulling fresh contacts and deals, with toast notifications showing sync results" },
          { text: "cascade.triggerSync API endpoint: New tRPC mutation to trigger HubSpot sync from the frontend" },
        ],
      },
      {
        type: "Changed",
        items: [
          { text: 'Top bar navigation: Replaced "How it Works" link with "Documentation" button (BookOpen icon), matching the sidebar link' },
          { text: 'Documentation restructured: Moved Timing Distributions into Section 1 ("What Cascata Does") per PM feedback — this is the heart of the cascade model' },
          { text: 'ILO renamed: Display name changed from "ILO (Inside Lead Owned)" to "Inbound Led Outbound" across database, documentation, and glossary' },
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-03-14",
    sections: [
      {
        type: "Added",
        items: [
          { text: "Comprehensive documentation page: In-portal documentation covering the full cascade model — 10 sections with linked table of contents and visual engine explanation" },
          { text: "Deal Classification configuration: Closed-Won Stage IDs, New Business Deal Types, Upsell/Renewal Deal Types with contextual help" },
          { text: "Configurable sync engine: Sync now reads mapping from saved company config instead of hardcoded values, with syncConfig JSON column and API endpoints" },
        ],
      },
      {
        type: "Changed",
        items: [
          { text: "SQL date property: Sync now uses configurable SQL date field instead of generic createdate for accurate quarter assignment" },
          { text: "Timing distributions from real data: SQL→Opp timing probabilities now calculated from actual SQL date to Opportunity date pairs per SQL type" },
          { text: "Configurable deal properties: Deal amount, close date, closed-won stages, and type values are all configurable from the UI" },
          { text: "Configure Cascata page rebuilt: Streamlined from 10 questions to 8 purposeful ones plus 3 deal classification settings" },
        ],
      },
      {
        type: "Removed",
        items: [
          { text: "Redundant configuration questions replaced by purposeful configurable equivalents" },
        ],
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-03-12",
    sections: [
      {
        type: "Added",
        items: [
          { text: "HubSpot ELT sync engine: Full Extract-Load-Transform pipeline from HubSpot CRM API with delta sync support, automated region/SQL type discovery, and daily cron job" },
          { text: "Cascade sheets: Quarter-by-quarter cascade model visualization with dynamic sheets, per-quarter conversion rates, SQL timing probability matrix, and win rates from closed-won deals" },
          { text: "Dynamic sidebar navigation: Cascade sheets auto-discovered from database data" },
          { text: "Technical monitoring on Portal Stats page: CPU, memory, disk, database usage, sync status" },
          { text: "Admin login from .env: Admin credentials read from environment variables on startup" },
          { text: "Backfill scripts for initial data population" },
        ],
      },
      {
        type: "Changed",
        items: [
          { text: "Cascade sheets use dynamic URL routing (/cascade/:motion/:region)" },
          { text: "Conversion rates derived from actual actualOpps / actualSqls per quarter" },
          { text: "Contact and deal team properties updated to contact_pod and deal_pod" },
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-11",
    sections: [
      {
        type: "Added",
        items: [
          { text: "Direct HubSpot API integration: Replaced BigQuery data source with direct HubSpot CRM API v3 calls using private app access token, with paginated fetching and property name cache" },
          { text: "Comprehensive test suite (147 tests across 10 files): Security headers, CSRF protection, rate limiting, input validation, SQL injection prevention, authentication, authorization, cookie security, performance benchmarks, HubSpot client validation" },
        ],
      },
      {
        type: "Changed",
        items: [
          { text: "CSP updated to allow Google Fonts via style-src, style-src-elem, and font-src directives" },
          { text: "Cascata Configuration page now reads contacts and deals directly from HubSpot API instead of BigQuery" },
        ],
      },
      {
        type: "Security",
        items: [
          { text: "Added CSRF protection middleware using Double Submit Cookie pattern" },
          { text: "Added security headers middleware (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, CSP)" },
          { text: "Added request ID tracking middleware for request correlation" },
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-15",
    sections: [
      {
        type: "Added",
        items: [
          { text: "Cascata Configuration Page: HubSpot field mapping with searchable column selection dropdowns, default field mappings, and server-side pagination" },
        ],
      },
      {
        type: "Changed",
        items: [
          { text: "Moved Configure Cascata Environment to top-level navigation" },
          { text: 'Updated Dashboard "All Companies" filter to correctly aggregate data' },
          { text: "Fixed Cascade Flow visualization refresh issue when switching between company demos" },
          { text: "Fixed What-If Analysis baseline calculation to correctly aggregate data by quarter" },
        ],
      },
      {
        type: "Removed",
        items: [
          { text: "Removed old documentation files (CODE_REVIEW.md, COMPREHENSIVE_CODE_REVIEW_FIXES.md, FIXES_SUMMARY.md, SECURITY_REVIEW.md)" },
        ],
      },
    ],
  },
];

function getSectionIcon(type: ChangeSection["type"]) {
  switch (type) {
    case "Added": return <Plus className="h-3.5 w-3.5" />;
    case "Changed": return <RefreshCw className="h-3.5 w-3.5" />;
    case "Fixed": return <Bug className="h-3.5 w-3.5" />;
    case "Removed": return <Trash2 className="h-3.5 w-3.5" />;
    case "Security": return <Shield className="h-3.5 w-3.5" />;
    case "Technical": return <Settings className="h-3.5 w-3.5" />;
  }
}

function getSectionColor(type: ChangeSection["type"]) {
  switch (type) {
    case "Added": return "bg-green-100 text-green-700 border-green-200";
    case "Changed": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Fixed": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Removed": return "bg-red-100 text-red-700 border-red-200";
    case "Security": return "bg-purple-100 text-purple-700 border-purple-200";
    case "Technical": return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getSectionBorder(type: ChangeSection["type"]) {
  switch (type) {
    case "Added": return "border-l-green-500";
    case "Changed": return "border-l-blue-500";
    case "Fixed": return "border-l-amber-500";
    case "Removed": return "border-l-red-500";
    case "Security": return "border-l-purple-500";
    case "Technical": return "border-l-slate-500";
  }
}

export default function ChangeHistory() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Change History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All notable changes to Cascata Portal, following{" "}
            <a href="https://semver.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Semantic Versioning
            </a>.
          </p>
        </div>

        <div className="space-y-8">
          {changelog.map((entry, idx) => (
            <Card key={entry.version} className={idx === 0 ? "ring-2 ring-blue-200" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">
                    v{entry.version}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-mono">
                    {entry.date}
                  </Badge>
                  {idx === 0 && (
                    <Badge className="bg-blue-600 text-white text-[10px]">Latest</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {entry.sections.map((section) => (
                  <div key={section.type} className={`border-l-4 ${getSectionBorder(section.type)} pl-4`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${getSectionColor(section.type)}`}>
                        {getSectionIcon(section.type)}
                        {section.type}
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {section.items.map((item, i) => {
                        const colonIdx = item.text.indexOf(":");
                        const hasTitle = colonIdx > 0 && colonIdx < 60;
                        return (
                          <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                            <span className="text-muted-foreground/40 mr-2">&bull;</span>
                            {hasTitle ? (
                              <>
                                <strong className="text-foreground font-medium">{item.text.slice(0, colonIdx)}</strong>
                                {item.text.slice(colonIdx)}
                              </>
                            ) : (
                              item.text
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
