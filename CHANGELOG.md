# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

