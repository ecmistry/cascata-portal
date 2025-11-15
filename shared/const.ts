export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365; // Keep for backward compatibility
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days (reduced from 1 year)
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
export const ACCESS_DENIED_ERR_MSG = 'Access denied (10003)';

// Error messages
export const ERROR_MESSAGES = {
  DATABASE_UNAVAILABLE: "Database connection unavailable. Please try again later.",
  COMPANY_NOT_FOUND: "Company not found or you don't have access.",
  INVALID_REGION_OR_SQL_TYPE: "Invalid region or SQL type specified.",
  BIGQUERY_SYNC_FAILED: "BigQuery sync failed. Please check your configuration.",
  INVALID_IDENTIFIER: "Invalid identifier format.",
} as const;

// Cascade calculation constants
export const CASCADE_CONSTANTS = {
  // Default conversion rates (in basis points: 1% = 100bp)
  DEFAULT_COVERAGE_RATIO_BP: 500, // 5% in basis points
  DEFAULT_WIN_RATE_BP: 2500, // 25% in basis points
  
  // Default time distribution (in basis points)
  DEFAULT_SAME_QUARTER_PCT: 8900, // 89%
  DEFAULT_NEXT_QUARTER_PCT: 1000, // 10%
  DEFAULT_TWO_QUARTER_PCT: 100, // 1%
  
  // Revenue split assumptions
  NEW_BUSINESS_REVENUE_SPLIT: 0.7, // 70% new business
  UPSELL_REVENUE_SPLIT: 0.3, // 30% upsell
  
  // Default ACV (in cents)
  DEFAULT_ACV_CENTS: 10000000, // $100,000
  
  // Forecast defaults
  DEFAULT_START_YEAR: 2024,
  DEFAULT_START_QUARTER: 1,
  DEFAULT_FORECAST_YEARS: 5,
  
  // Opportunity precision multiplier
  OPPORTUNITY_PRECISION_MULTIPLIER: 100,
} as const;
