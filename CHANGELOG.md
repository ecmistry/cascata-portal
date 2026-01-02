# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Cascata Configuration Page**: Added new "Configure Cascata Environment" page for HubSpot field mapping configuration
  - Model Configuration table with questions for Contacts and Deals objects
  - Searchable column selection dropdowns for HubSpot fields
  - Default field mappings pre-configured and highlighted in yellow
  - Server-side pagination (25 rows per page)
  - BigQuery integration for querying HubSpot contacts and deals tables
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

### Security
- Added CSRF protection middleware using Double Submit Cookie pattern
- Added security headers middleware (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, Content-Security-Policy)
- Added request ID tracking middleware for request correlation
- Updated client-side tRPC to include CSRF token in requests

### Technical
- Created `server/bigquery-playground.ts` with BigQuery pagination and normalization utilities
- Added BigQuery functions: `getHubSpotContacts()` and `getHubSpotDeals()` with pagination support
- Created `client/src/pages/playground/CascataTest.tsx` component
- Updated `server/routers.ts` to include playground router endpoints
- Updated `client/src/App.tsx` to include new route
- Updated `client/src/components/DashboardLayout.tsx` to include new navigation item

### Removed
- Removed old documentation files (CODE_REVIEW.md, COMPREHENSIVE_CODE_REVIEW_FIXES.md, FIXES_SUMMARY.md, SECURITY_REVIEW.md)

