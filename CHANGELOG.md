# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.1] - 2026-03-11

### Added
- **Auto-creation of regions and SQL types**: HubSpot sync now automatically creates new regions and SQL types discovered in contact/deal data, eliminating the need to pre-configure them manually
- **Granular pod mapping**: Region mapping now preserves sub-pods as separate regions (NORAM East, NORAM West, EMESA DACH, Others) instead of collapsing them into parent regions

### Changed
- **Pod count expanded**: 3 regions → 7 regions (NORAM, NORAM East, NORAM West, EMESA North, EMESA South, EMESA DACH, Others) after resync with granular mapping
- **Forecast volume increased**: 480 → 1,120 forecast records due to additional region granularity
- **Actuals volume increased**: 155 → 243 actual records now flowing through the model

## [2.6.0] - 2026-03-11

### Changed
- **Hierarchical cascade redesigned**: New drill-down structure: Global → Metric (SQLs, Opp Coverage Ratio, Opp Win Rate, Opportunities, NB Wins, Avg ACV, New Bookings) → Pod → Method. Each metric is its own expandable row showing per-quarter values, replacing the old compact multi-metric cell layout
- **R-score overall calculation fixed**: Overall R-score no longer averages in OWR when the model doesn't produce explicit win predictions (OWR model data is always 0), so overall now correctly reflects OCR accuracy (~0.92 instead of ~0.46)
- **Additional metrics in hierarchy data**: Server now returns `oppCount`, `nbWins`, `avgAcvNew` per quarter for each hierarchy level, sourced from forecasts, actuals, and deal economics tables

## [2.5.0] - 2026-03-11

### Added
- **Self-service registration**: New "Create Account" flow on the login page — users provide name, email, password, and company name to self-register and are auto-redirected to setup
- **Password reset flow**: "Forgot Password?" link on the login page with a confirmation flow (email delivery to be wired in production)
- **Per-company HubSpot token storage**: `hubspotToken` column on companies table; Integrations page now saves/removes tokens per-company with connected/disconnected badge
- **Getting Started documentation page** (`/docs`): Step-by-step onboarding guide covering prerequisites, HubSpot Private App creation, property mapping, first sync, dashboard tour, cascade sheets, revenue planning, and FAQ
- **Integrations page overhaul**: Functional HubSpot token management with save, remove, sync buttons, and deep link to property configuration
- **Sidebar: Integrations link**: Quick access to the Integrations page from the main sidebar
- **Sidebar: Getting Started & Technical Docs**: Settings section now has separate links for the getting-started guide and the technical documentation
- **`auth.register` tRPC route**: Creates user + company in one step with session auto-login
- **`company.saveHubspotToken` / `company.removeHubspotToken`** tRPC routes for per-company token management
- **Schema migration `0012`**: Adds `hubspotToken` column to companies table

### Changed
- **Dashboard empty-state CTA**: Now routes to `/setup` (onboarding wizard) instead of `/configure-cascata`
- **Setup wizard post-create redirect**: After creating a model, users are sent to `/integrations` to connect HubSpot as the next onboarding step
- **Top bar Docs link**: Now points to `/docs` (Getting Started) instead of `/how-it-works`
- **Login page redesigned**: Multi-view layout supporting sign-in, registration, and password reset from the same page

## [2.4.0] - 2026-03-11

### Added
- **R-Score History Persistence**: R-scores are now computed and saved to `rScoreHistory` table after every sync, enabling trend tracking over time
- **R-Score Trend Card**: Dashboard headline card "Model Accuracy (R-Score)" now shows a sparkline bar chart of historical R-score values with quarter-over-quarter trend indicator (pp change)
- **Data Coverage Card**: New dashboard headline card showing the percentage of HubSpot contacts and deals that pass data quality checks (region/sqlType mapping), sourced from the latest sync's data quality report
- **tRPC routes**: `dashboard.rScoreHistory` returns global overall R-score trend; `dashboard.dataCoverage` returns latest sync quality metrics

### Changed
- Dashboard headline grid expanded from 5 to 6 cards: Model Accuracy (with trend), Opp Coverage R, Win Rate R, RAG Attainment, Upsell Forecast, Data Coverage

## [2.3.1] - 2026-03-11

### Added
- **Automatic churn from HubSpot**: Churn data is now sourced directly from HubSpot by fetching renewal-type deals (`customerrenewal`, `Fixed Renewal`) with closed-lost stage. 86 churn deals -> 21 quarterly churn records auto-populated
- **Resync utility**: `scripts/resync.ts` for triggering HubSpot sync outside the server process

### Changed
- **Upsell deal classification narrowed**: `upsellDealTypeValues` changed from `["existingbusiness", "customerrenewal", ...]` to `["Fixed Add On Business"]` only — renewals are now correctly excluded from upsell revenue
- **Upsell deals no longer require SQL type**: Add-on deals missing `type_of_sql_associated_to_deal` now fall back to the first available SQL type instead of being silently dropped (69 add-on deals now flow through)
- **Fallback region for missing deal_pod**: Upsell and churn deals without `deal_pod` are assigned to a fallback region instead of being skipped
- **Company customer detection**: HubSpot Company object `type = CUSTOMER` now correctly identifies 365 customer companies (uppercase match)
- **Forecast range extended**: Forecasts now dynamically cover at least 2 years into the future from the current date, fixing missing 2026+ data
- **Current quarter included in projections**: `isHistorical` and `computeSixQuarterAverage` now include the current quarter's data, enabling upsell metrics to project forward immediately
- **Customer count uses latest snapshot**: Future quarter projections use the latest known customer count (stock measure) rather than averaging it over the 6Q window
- **6Q average minimum threshold lowered**: Reduced from 4 quarters to 1 quarter minimum, allowing newly-tracked metrics (like upsells) to project forward without a multi-quarter warm-up period

### Fixed
- Upsell revenue forecast was $0 across all quarters due to four compounding issues: wrong customer type value (case sensitivity), SQL type requirement on add-on deals, current quarter excluded from historical data, and 6Q average requiring 4+ quarters of data

## [2.3.0] - 2026-03-11

### Added
- **Actual revenue split**: `actualRevenueNew` and `actualRevenueUpsell` columns on the `actuals` table, populated during HubSpot sync by splitting closed-won deal amounts by deal type (new business vs upsell)
- **Full target model**: Extended `revenueTargets` table with `targetSqls`, `targetOpps`, `targetWins` columns alongside existing revenue targets — enables pipeline-level target tracking (not just revenue)
- **Target Planning UI**: Revenue Planning page now shows 6 target rows per region: SQLs, Opps, Wins, $ New Biz, $ Upsell, $ Total — a full cascade target model
- **Actuals vs Targets RAG**: Hierarchical cascade view now shows RAG indicators comparing actual performance against targets at every level — SQL RAG (S), Opp RAG (O), and Revenue RAG dot
- **Actual revenue in hierarchy**: Hierarchical cascade view now shows actual revenue (new + upsell) on a second line below model forecast for historical quarters, with emerald colouring to distinguish from model values
- **Rich tooltips**: Hovering on revenue cells now shows three layers — Model Forecast, Actuals, and Target — with full breakdowns

### Changed
- **HubSpot sync**: `unifiedActuals` map now carries `revenueNew` and `revenueUpsell` from `qMetrics` deal type classification, written to the enriched `actuals` columns
- **Database schema**: Two new columns on `actuals` (`actualRevenueNew`, `actualRevenueUpsell`), three on `revenueTargets` (`targetSqls`, `targetOpps`, `targetWins`) via migration `0011_phase4_actuals_targets_enrichment.sql`
- **tRPC routes**: Target upsert/bulkUpsert now accept `targetSqls`, `targetOpps`, `targetWins`; `hierarchicalData` loads target data and computes target-vs-actual RAG
- **Hierarchical cascade**: Column headers updated to "M/A · Rev · Tgt" to reflect three-layer data display

## [2.2.0] - 2026-03-11

### Added
- **Revenue Targets / Quotas**: New `revenueTargets` table and UI for setting per-region, per-quarter targets with New Biz and Upsell breakdown. Targets drive attainment RAG on the Dashboard
- **Churn & Adjustments tracking**: New `churnData` table with per-region, per-quarter fields for churn amount, M&A ARR, and manual adjustments — feeds the CARR waterfall
- **Headcount tracking**: New `headcount` table with AM and AE count per region/quarter, enabling bookings-per-head productivity metrics
- **CARR Engine**: New `server/carrEngine.ts` computes Closing CARR = Opening + Bookings - Churn + M&A + Adjustments as a rolling waterfall across quarters
- **Revenue Planning page**: Dedicated `/revenue-planning` page with tabbed interface for Targets/Quotas, Churn & Adjustments, and Headcount entry — all editable per region and quarter
- **Dashboard CARR waterfall**: Interactive table showing Opening CARR → Bookings → Churn → M&A → Adjustments → Closing CARR per quarter with colour-coded rows
- **Dashboard attainment cards**: Quota Attainment, Total Bookings, and Bookings/Head cards with RAG-coloured attainment percentages
- **Cascade Sheet revenue summary**: Revenue Summary strip below cascade panels showing New Bookings, Upsell Bookings, Churn, Closing CARR, and Attainment per quarter
- **Sidebar navigation**: Revenue Planning link added between Configure and Cascade Sheets sections
- **tRPC routes**: New `revenueTarget.*`, `churnData.*`, `headcount.*`, and `carr.summary` procedures with bulk upsert support

### Changed
- **Database schema**: Three new tables (`revenueTargets`, `churnData`, `headcount`) via migration `0010_phase3_targets_churn_headcount.sql`
- **Dashboard layout**: CARR waterfall section inserted between hierarchical cascade and classic analytics
- **Sidebar**: Added TrendingUp icon import and Revenue Planning menu item

## [2.1.0] - 2026-03-11

### Added
- **HubSpot Company object integration**: New `fetchCustomerCompanies()` in `hubspotSync.ts` fetches Companies from HubSpot using configurable `companyCustomerField` and `companyCustomerValues` to identify active customers, mapped to regions via `companyRegionProperty`
- **Customer count tracking**: Customer counts per region are written to `quarterlyMetrics.customerCount` during sync, enabling the upsell attach rate calculation
- **Upsell cascade engine**: New formula `attach_rate × customer_count × avg_upsell_ACV` for upsell bookings, computed separately from the pipeline-driven new business cascade. Attach rate and customer count use 6Q one-time averages for future quarters
- **Upsell-specific win tracking**: Deals are now classified as upsell vs new business at the per-quarter level, with separate `totalUpsellWon` in `quarterlyMetrics` and `actualUpsellWins` in `actuals`
- **Upsell attach rate**: `quarterlyMetrics.upsellAttachRate` (basis points) stores `upsellWon / customerCount` per quarter/region/motion
- **Revenue breakdown in hierarchy**: Hierarchical cascade view now shows New Biz + Upsell revenue per quarter with tooltips showing customer count and attach rate
- **Upsell forecast card**: Dashboard headline row includes a new "Upsell Forecast" card showing total future upsell bookings and percentage of total forecast
- **Company Object configuration UI**: New "Company Object (Upsell & Customer Tracking)" section on the Configure page with fields for `companyCustomerField`, `companyCustomerValues`, and `companyRegionProperty`

### Changed
- **Cascade engine**: Revenue split is now data-driven — new business revenue comes from the pipeline cascade (SQL→Opp→Win), upsell revenue from the attach rate formula. Replaces the previous fixed-proportion split
- **HubSpot sync**: Per-quarter deal metrics now track `upsellWon` separately; `unifiedActuals` includes `upsellWins`
- **Forecast storage**: `predictedRevenueNew` and `predictedRevenueUpsell` in the `forecasts` table are now populated from the separate cascade calculations
- **Database schema**: Added `totalUpsellWon`, `upsellAttachRate` to `quarterlyMetrics`; added `actualUpsellWins` to `actuals` via migration `0009_phase2_upsell_schema.sql`
- **tRPC routers**: `saveSyncConfig` and `getSyncConfig` now support Company object fields; `hierarchicalData` returns revenue, customer count, and attach rate per quarter
- **Dashboard layout**: Headline cards expanded to a 5-column grid including the new Upsell Forecast card

## [2.0.0] - 2026-03-22

### Added
- **Pearson R-score engine** (`server/pearsonEngine.ts`): Computes per-region and global Pearson correlation coefficients for Opportunity Coverage Rate (OCR) and Opportunity Win Rate (OWR) between model forecasts and actuals
- **RAG performance engine** (`server/ragEngine.ts`): Red/Amber/Green status indicators comparing model output vs actuals at Global, Region, and Motion hierarchy levels (Green >= 90%, Amber >= 70%, Red < 70%)
- **Hierarchical cascade component** (`HierarchicalCascade.tsx`): Three-level expandable tree view (Global -> Region -> Motion) with Model/Actual dual values, RAG dot indicators, and R-score badges
- **Dashboard overhaul**: R-score headline cards, RAG attainment summary, and hierarchical performance view replace the previous KPI cards as the primary dashboard view. Classic analytics (time series, regional charts) moved to a collapsible section
- **6-quarter one-time average**: Cascade engine now computes a fixed average from the last 6 completed quarters for conversion rate, win rate, pipeline cover ratio, and ACV — applied uniformly to all future quarters
- **Quarterly metrics table** (`quarterlyMetrics`): Stores per-quarter aggregated metrics (pipeline cover ratio, avg ACV new/upsell, closed won/lost counts) populated during HubSpot sync
- **R-score history table** (`rScoreHistory`): Stores historical Pearson R values per region and globally for trend tracking
- **actualWins column**: `actuals` table now tracks closed-won deal counts per quarter/region/motion
- **Model|Actual cascade columns**: Cascade sheets now show an "Act" column alongside model values for historical quarters, with green-highlighted actual data
- **tRPC procedures**: `dashboard.rScores` and `dashboard.hierarchicalData` for the new dashboard components
- **SyncConfig extensions**: `companyCustomerField`, `companyCustomerValues`, `rollingWindowQuarters` for future phase support

### Changed
- **Cascade engine**: Uses historical actuals for past quarters and 6Q one-time averages for future quarters (conversion, win rate, ACV) instead of uniform rates
- **HubSpot sync**: Now aggregates per-quarter deal metrics and writes to `quarterlyMetrics` table; populates `actualWins` in actuals upsert
- **Database schema**: Added `quarterlyMetrics`, `rScoreHistory` tables and `actualWins` column via migration `0008_v2_schema.sql`
- **Dashboard layout**: Primary view is now the hierarchical cascade with R-score and RAG cards; existing charts are in a collapsible "Classic Analytics" section

## [1.7.0] - 2026-03-15

### Added
- **Configurable model defaults**: New "Model Defaults" section on the Configuration page for SQL timing distribution, opp win timing distribution, and default conversion rate — used as fallbacks when fewer than 5 data points exist for a motion
- **True SQL→Opp conversion**: Opportunities are now counted from contacts with opp dates (not from closed-won deals), giving an accurate SQL→Opportunity conversion rate per quarter
- **Win rate in opp cascade**: The combined win rate (new business + upsell) is now applied before the opp timing distribution, ensuring the right-panel cascade shows expected won deals rather than total opportunities
- **Cascade engine alignment**: Engine now uses per-quarter conversion rates from actuals, opp win timing from `oppTimingJson`, and data-driven quarter range from SQL history (instead of fixed 2024 Q1 start)

### Changed
- **Conversion rate semantics**: `oppCoverageRatio` in `conversionRates` table is now true SQL→Opp (contacts with opp date / contacts with SQL date). `winRateNew` and `winRateUpsell` are now true win rates (won deals / total opportunities)
- **Actuals table**: `actualOpps` is now populated from contacts with opp dates (keyed by SQL date quarter), separate from `actualRevenue` which remains keyed by deal close date quarter
- **Cascade engine**: Rewrote core calculation to match cascade sheet logic — per-quarter conversion, full SQL + Opp timing cascade, win rate application, and per-motion ACV split
- **Documentation**: Updated to reflect true conversion semantics, win rate in opp cascade, configurable defaults, and updated glossary

## [1.6.0] - 2026-03-14

### Added
- **Two-panel cascade layout**: Cascade sheets now display the SQL → Opportunity cascade and Opportunity → Deal Won cascade side by side with a red vertical divider, matching the Excel spreadsheet format
- **Opportunity cascade engine**: New cascade stage that takes total opportunities per quarter from the SQL cascade and applies opp win timing probabilities to project when deals close across future quarters
- **Opp win timing distribution**: Calculated from deal create date → close date for closed-won deals, stored as JSON array in `timeDistributions.oppTimingJson`, with up to 7 quarter offsets
- **Quarter range filter**: "From" and "To" quarter selectors on each cascade sheet allow narrowing the displayed range to a specific time period, with a Reset button to return to full view
- **Database migration** (`0007_add_opp_timing.sql`): Added `oppTimingJson` TEXT column to `timeDistributions` table

### Changed
- **Cascade sheet layout**: Replaced stacked vertical layout with side-by-side horizontal scroll container — both panels share a single scrollbar
- **Documentation page**: Updated to cover both cascades, two-panel layout, probability matrices, quarter range filter, opp win timing distributions, and updated glossary
- **Cascade engine**: Added Step 5 (Opp → Deal Won) and Step 6 (Revenue), expanding from 5 to 6 steps

## [1.5.0] - 2026-03-14

### Added
- **Extended data quality checks**: Timing distribution gaps (contacts with SQL date but no Opp date), deal amount anomalies (zero/missing amounts, outliers, unclassified deal types), date anomalies (future/pre-2015 dates), sparse region/motion combination warnings, and timing sample size per motion
- **Deal skip reason tracking**: Full breakdown of why closed-won deals are excluded — missing Deal Pod, unmapped region/SQL type, missing close date — with per-value unmapped counts
- **Data flow waterfall view**: Replaced simple summary cards with visual waterfall showing exactly how HubSpot records flow through filtering stages into the cascade model, with counts and percentages at each step
- **Discrepancy explanation section**: New "Understanding the Discrepancies" card on the Data Quality page explaining why numbers may differ from HubSpot reports, with specific improvement recommendations
- **117 data quality tests**: Comprehensive test coverage for alias mapping, fallback logic, deal skip tracking, timing gaps, deal amount analysis, date anomalies, sparse combinations, and extended report validation

### Changed
- **Contact fetch filter**: Changed from filtering by `lifecyclestage = salesqualifiedlead` to `HAS_PROPERTY` on SQL date field. Now captures contacts who progressed past SQL stage (to Opportunity, Customer, etc.), increasing fetched count from ~444 to ~2,268 — matching HubSpot report totals exactly
- **Deal fetch filter**: Changed from fetching all deals (4,387) to only fetching closed-won deals (1,638) server-side, reducing unnecessary API calls and making data quality metrics more accurate
- **Removed lifecycle stage gate**: Contact processing no longer checks lifecycle stage — if a contact has an SQL date, it's counted as an SQL regardless of current stage
- **HAS_PROPERTY operator support**: Updated `fetchAllRecords` to correctly handle HubSpot Search API operators that don't accept a `value` parameter

### Fixed
- **SQL count alignment with HubSpot**: Portal SQL volumes now align with HubSpot's contact pod report totals (2,268 contacts fetched = HubSpot report total)

## [1.4.0] - 2026-03-14

### Added
- **HubSpot sync on Refresh**: The top-bar Refresh button now triggers a live delta sync from HubSpot CRM, pulling fresh contacts and deals, with toast notifications showing sync results
- **`cascade.triggerSync` API endpoint**: New tRPC mutation to trigger HubSpot sync from the frontend

### Changed
- **Top bar navigation**: Replaced "How it Works" link with "Documentation" button (BookOpen icon), matching the sidebar link
- **Documentation restructured**: Moved Timing Distributions into Section 1 ("What Cascata Does") per PM feedback -- this is the heart of the cascade model. Reduced from 10 sections to 9.
- **ILO renamed**: Display name changed from "ILO (Inside Lead Owned)" to "Inbound Led Outbound" across database, documentation, and glossary
- **Glossary updated**: Motion definition now uses "Inbound Led Outbound (ILO)" terminology

## [1.3.0] - 2026-03-14

### Added
- **Comprehensive documentation page**: In-portal documentation covering the full cascade model, accessible via "Documentation" in sidebar and "How it Works" in top bar
  - 10 sections: overview, data pipeline, configuration guide, engine walkthrough, sheet anatomy, deal classification, timing distributions, data model, daily sync, glossary
  - Linked table of contents with anchor navigation
  - Visual step-by-step cascade engine explanation
- **Deal Classification configuration**: New section on Configure page with contextual help
  - Closed-Won Stage IDs (which deal stages count as revenue)
  - New Business Deal Types (for separate win rate/ACV)
  - Upsell/Renewal Deal Types (for separate win rate/ACV)
  - Colour-coded cards with "How to find" and "Typical values" guidance
- **Configurable sync engine**: Sync now reads mapping from saved company config instead of hardcoded values
  - New `syncConfig` JSON column on companies table
  - API endpoints `cascade.getSyncConfig` and `cascade.saveSyncConfig`
  - Configuration page saves directly to database and controls sync behaviour

### Changed
- **SQL date property**: Sync now uses configurable SQL date field (default: `admin___first_became_a_sql_date`) instead of generic `createdate` for accurate quarter assignment
- **Timing distributions from real data**: SQL→Opp timing probabilities now calculated from actual SQL date to Opportunity date pairs per SQL type (minimum 5 samples required)
- **Configurable deal properties**: Deal amount field, close date field, closed-won stages, and new/upsell type values are all configurable from the UI
- **Configure Cascata page rebuilt**: Streamlined from 10 questions to 8 purposeful ones plus 3 deal classification settings, with clear purpose explanations
- **Documentation page rewritten**: Replaced generic "How it Works" with detailed technical documentation accurate to current implementation

### Removed
- Redundant configuration questions (deal type selector, hardcoded ARR field, hardcoded close date, deal won field) replaced by purposeful configurable equivalents

## [1.2.0] - 2026-03-12

### Added
- **HubSpot ELT sync engine** (`server/hubspotSync.ts`): Full Extract-Load-Transform pipeline from HubSpot CRM API
  - Delta sync support via `lastmodifieddate` / `hs_lastmodifieddate` filters
  - Automated region and SQL type discovery and mapping
  - SQL history, actuals, conversion rates, and deal economics calculation
  - Daily cron job at 2:00 AM UTC
- **Cascade sheets** (`server/cascadeSheet.ts`, `client/src/pages/CascadeSheet.tsx`): Quarter-by-quarter cascade model visualization
  - Dynamic sheets generated from available motion × region combinations
  - Per-quarter conversion rates derived from actual HubSpot data
  - SQL timing probability matrix display
  - Win rates and ACV from closed-won deals
- **Dynamic sidebar navigation**: Cascade sheets auto-discovered from database data
- **Technical monitoring** on Portal Stats page: CPU, memory, disk, database usage, sync status
- **Admin login from .env**: Admin credentials (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) read from `.env` on startup
- **Backfill scripts**: `runHubSpotSync.ts` and `backfillAllData.ts` for initial data population

### Changed
- Cascade sheets use dynamic URL routing (`/cascade/:motion/:region`)
- Conversion rates derived from actual `actualOpps / actualSqls` per quarter instead of `oppCoverageRatio`
- Contact and deal team properties updated to `contact_pod` and `deal_pod`

## [1.1.0] - 2026-03-11

### Added
- **Direct HubSpot API integration**: Replaced BigQuery data source with direct HubSpot CRM API v3 calls using `HUBSPOT_TOKEN` private app access token
  - New `server/hubspot-client.ts` module with paginated contacts and deals fetching
  - Uses HubSpot Search API for efficient server-side pagination
  - 5-minute property name cache to reduce API calls
  - Automatic `deal_stage_value` enrichment on deals
- **Comprehensive test suite** (147 tests across 10 files):
  - Security headers validation (CSP, X-Frame-Options, MIME sniffing, etc.)
  - CSRF protection (double-submit cookie pattern, safe method exemption, token validation)
  - Rate limiting (login: 5 attempts/15 min, API: 100 req/15 min, per-IP isolation)
  - Input validation & sanitization (password complexity, field length limits, type enforcement)
  - SQL injection prevention (Zod type coercion, ORM parameterization, injection patterns)
  - Authentication & session security (JWT creation/verification, bcrypt, session expiry)
  - Authorization & access control (company ownership, admin role enforcement)
  - Cookie security (httpOnly, secure, sameSite, x-forwarded-proto)
  - Performance benchmarks (cascade calculations, Zod validation, JWT operations)
  - HubSpot client token validation

### Changed
- **CSP updated**: Content-Security-Policy now allows Google Fonts (`fonts.googleapis.com` for stylesheets, `fonts.gstatic.com` for font files) via `style-src`, `style-src-elem`, and `font-src` directives
- Cascata Configuration page now reads contacts and deals directly from HubSpot API instead of BigQuery
- tRPC endpoints `dashboard.playground.cascataTest` and `dashboard.playground.cascataTestDeals` now import from `hubspot-client` instead of `bigquery-playground`
- Vitest config updated with `@shared` path alias for shared module imports

### Security
- Added CSRF protection middleware using Double Submit Cookie pattern
- Added security headers middleware (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, Content-Security-Policy)
- Added request ID tracking middleware for request correlation
- Updated client-side tRPC to include CSRF token in requests
- Google Fonts added to CSP allowlist to resolve stylesheet blocking

## [1.0.0] - 2026-01-15

### Added
- **Cascata Configuration Page**: Added new "Configure Cascata Environment" page for HubSpot field mapping configuration
  - Model Configuration table with questions for Contacts and Deals objects
  - Searchable column selection dropdowns for HubSpot fields
  - Default field mappings pre-configured and highlighted in yellow
  - Server-side pagination (25 rows per page)
  - tRPC endpoints: `dashboard.playground.cascataTest` and `dashboard.playground.cascataTestDeals`
  - Route: `/configure-cascata`
  - Navigation menu item at top level of sidebar

### Changed
- Moved "Configure Cascata Environment" to top-level navigation (first item in sidebar)
- Moved "Create New Model" to second position in sidebar
- Updated Dashboard "All Companies" filter to correctly aggregate data from all companies
- Fixed Cascade Flow visualization refresh issue when switching between company demos
- Fixed What-If Analysis baseline calculation to correctly aggregate data by quarter
- Added `useEffect` import to Dashboard component to fix crash

### Technical
- Created `server/bigquery-playground.ts` with BigQuery pagination and normalization utilities
- Added BigQuery functions: `getHubSpotContacts()` and `getHubSpotDeals()` with pagination support
- Created `client/src/pages/playground/CascataTest.tsx` component
- Updated `server/routers.ts` to include playground router endpoints
- Updated `client/src/App.tsx` to include new route
- Updated `client/src/components/DashboardLayout.tsx` to include new navigation item

### Removed
- Removed old documentation files (CODE_REVIEW.md, COMPREHENSIVE_CODE_REVIEW_FIXES.md, FIXES_SUMMARY.md, SECURITY_REVIEW.md)

