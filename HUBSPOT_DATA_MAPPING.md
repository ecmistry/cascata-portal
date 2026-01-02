# HubSpot to Cascata Portal Data Mapping Guide

This document outlines the HubSpot entities and properties you need to extract via Fivetran into BigQuery to feed the Cascata Portal with real data.

## Overview

The Cascata Portal requires three main data tables:
1. **SQL History** - Historical SQL volumes by region, SQL type, and time period
2. **Conversion Rates** - SQL to Opportunity conversion rates and win rates (can be calculated from historical data)
3. **Actuals** - Actual performance data (SQLs, Opportunities, Revenue)

Additionally, the portal needs:
- **Deal Economics** - Average Contract Value (ACV) for new business vs upsells
- **Time Distributions** - How SQLs convert to opportunities over time (typically 89%/10%/1%)

---

## 1. SQL History Data

### Purpose
Tracks historical SQL volumes by region, SQL type, year, and quarter to feed the forecast model.

### Required BigQuery Table Schema
```sql
CREATE TABLE sql_history (
  region STRING,        -- e.g., "NORAM", "EMESA_NORTH", "EMESA_SOUTH"
  sql_type STRING,      -- e.g., "INBOUND", "OUTBOUND", "ILO", "EVENT", "PARTNER"
  year INT64,           -- e.g., 2024
  quarter INT64,        -- 1, 2, 3, or 4
  volume INT64          -- Number of SQLs in that period
);
```

### HubSpot Source Data

#### Primary Entity: `contact` (or `deal` if SQLs are tracked as deals)

**Key HubSpot Properties Needed:**
- `hs_createdate` or `createdate` - Contact/deal creation date (to derive year/quarter)
- `lifecyclestage` or `dealstage` - To identify SQL stage
- `hs_lead_status` or custom property for SQL status
- `region` or `hs_analytics_source_data_1` - Region classification
- `lead_source` or `hs_analytics_source` - SQL type classification (Inbound/Outbound/ILO)

**SQL Type Mapping:**
- **INBOUND**: Contacts/deals where `lead_source` contains "inbound", "organic", "website", "form"
- **OUTBOUND**: Contacts/deals where `lead_source` contains "outbound", "sales", "cold", "prospecting"
- **ILO**: Contacts/deals where `lead_source` contains "ilo", "inside", "sdr", "bdr"
- **EVENT**: Contacts/deals where `lead_source` contains "event", "webinar", "conference"
- **PARTNER**: Contacts/deals where `lead_source` contains "partner", "referral", "channel"

**Region Mapping:**
Map your HubSpot region property to portal regions (e.g., "North America" → "NORAM", "EMEA North" → "EMESA_NORTH")

### Recommended BigQuery View/Query

```sql
-- Example view to create SQL History from HubSpot contacts
CREATE OR REPLACE VIEW `reporting-299920.hubspot.sql_history` AS
SELECT
  CASE 
    WHEN c.region = 'North America' THEN 'NORAM'
    WHEN c.region = 'EMEA North' THEN 'EMESA_NORTH'
    WHEN c.region = 'EMEA South' THEN 'EMESA_SOUTH'
    ELSE UPPER(REGEXP_REPLACE(c.region, '[^A-Z0-9]', '_'))
  END AS region,
  CASE
    WHEN LOWER(c.lead_source) LIKE '%inbound%' OR 
         LOWER(c.lead_source) LIKE '%organic%' OR
         LOWER(c.lead_source) LIKE '%website%' OR
         LOWER(c.lead_source) LIKE '%form%' THEN 'INBOUND'
    WHEN LOWER(c.lead_source) LIKE '%outbound%' OR
         LOWER(c.lead_source) LIKE '%sales%' OR
         LOWER(c.lead_source) LIKE '%cold%' OR
         LOWER(c.lead_source) LIKE '%prospecting%' THEN 'OUTBOUND'
    WHEN LOWER(c.lead_source) LIKE '%ilo%' OR
         LOWER(c.lead_source) LIKE '%inside%' OR
         LOWER(c.lead_source) LIKE '%sdr%' OR
         LOWER(c.lead_source) LIKE '%bdr%' THEN 'ILO'
    WHEN LOWER(c.lead_source) LIKE '%event%' OR
         LOWER(c.lead_source) LIKE '%webinar%' OR
         LOWER(c.lead_source) LIKE '%conference%' THEN 'EVENT'
    WHEN LOWER(c.lead_source) LIKE '%partner%' OR
         LOWER(c.lead_source) LIKE '%referral%' OR
         LOWER(c.lead_source) LIKE '%channel%' THEN 'PARTNER'
    ELSE 'UNKNOWN'
  END AS sql_type,
  EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', c.hs_createdate)) AS year,
  EXTRACT(QUARTER FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', c.hs_createdate)) AS quarter,
  COUNT(*) AS volume
FROM `reporting-299920.hubspot.contact` c
WHERE 
  -- Filter for SQL stage (adjust based on your HubSpot lifecycle stages)
  (c.lifecyclestage = 'SQL' OR c.hs_lead_status = 'SQL')
  -- Only include last 2-3 years of data
  AND EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', c.hs_createdate)) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 2
  AND c.region IS NOT NULL
  AND c.lead_source IS NOT NULL
GROUP BY region, sql_type, year, quarter
ORDER BY year DESC, quarter DESC;
```

**Alternative: If SQLs are tracked as deals in HubSpot:**
```sql
-- If SQLs are tracked as deals in a specific pipeline stage
CREATE OR REPLACE VIEW `reporting-299920.hubspot.sql_history` AS
SELECT
  CASE 
    WHEN d.region = 'North America' THEN 'NORAM'
    WHEN d.region = 'EMEA North' THEN 'EMESA_NORTH'
    WHEN d.region = 'EMEA South' THEN 'EMESA_SOUTH'
    ELSE UPPER(REGEXP_REPLACE(d.region, '[^A-Z0-9]', '_'))
  END AS region,
  CASE
    WHEN LOWER(d.lead_source) LIKE '%inbound%' THEN 'INBOUND'
    WHEN LOWER(d.lead_source) LIKE '%outbound%' THEN 'OUTBOUND'
    WHEN LOWER(d.lead_source) LIKE '%ilo%' THEN 'ILO'
    -- ... (similar mapping as above)
    ELSE 'UNKNOWN'
  END AS sql_type,
  EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.createdate)) AS year,
  EXTRACT(QUARTER FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.createdate)) AS quarter,
  COUNT(*) AS volume
FROM `reporting-299920.hubspot.deal` d
WHERE 
  d.dealstage = 'SQL'  -- Adjust to your SQL stage name
  AND EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.createdate)) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 2
  AND d.region IS NOT NULL
  AND d.lead_source IS NOT NULL
GROUP BY region, sql_type, year, quarter
ORDER BY year DESC, quarter DESC;
```

---

## 2. Conversion Rates Data

### Purpose
Tracks SQL to Opportunity conversion rates and win rates by region and SQL type. This can be **calculated from historical data** rather than stored directly in HubSpot.

### Required BigQuery Table Schema
```sql
CREATE TABLE conversion_rates (
  region STRING,
  sql_type STRING,
  opp_coverage_ratio FLOAT64,  -- e.g., 0.45 for 45% (SQL to Opportunity)
  win_rate_new FLOAT64,         -- e.g., 0.28 for 28% (Opportunity to Closed Won - New Business)
  win_rate_upsell FLOAT64       -- e.g., 0.35 for 35% (Opportunity to Closed Won - Upsell)
);
```

### HubSpot Source Data

#### Primary Entities: `contact` (for SQLs) and `deal` (for Opportunities and Closed Won)

**Key HubSpot Properties:**
- `contact.hs_createdate` - SQL creation date
- `deal.createdate` - Opportunity creation date
- `deal.closedate` - Deal close date (for win rate calculation)
- `deal.dealstage` - Deal stage (to identify opportunities vs closed won)
- `deal.dealtype` or `deal.hs_deal_amount_calculation_preference` - To distinguish new vs upsell
- `contact.region` / `deal.region` - Region classification
- `contact.lead_source` / `deal.lead_source` - SQL type classification

### Recommended BigQuery View/Query

```sql
-- Calculate conversion rates from historical HubSpot data
CREATE OR REPLACE VIEW `reporting-299920.hubspot.conversion_rates` AS
WITH sql_data AS (
  -- Count SQLs by region and SQL type
  SELECT
    CASE 
      WHEN c.region = 'North America' THEN 'NORAM'
      WHEN c.region = 'EMEA North' THEN 'EMESA_NORTH'
      WHEN c.region = 'EMEA South' THEN 'EMESA_SOUTH'
      ELSE UPPER(REGEXP_REPLACE(c.region, '[^A-Z0-9]', '_'))
    END AS region,
    CASE
      WHEN LOWER(c.lead_source) LIKE '%inbound%' THEN 'INBOUND'
      WHEN LOWER(c.lead_source) LIKE '%outbound%' THEN 'OUTBOUND'
      WHEN LOWER(c.lead_source) LIKE '%ilo%' THEN 'ILO'
      -- ... (similar mapping as SQL History)
      ELSE 'UNKNOWN'
    END AS sql_type,
    COUNT(*) AS sql_count
  FROM `reporting-299920.hubspot.contact` c
  WHERE 
    (c.lifecyclestage = 'SQL' OR c.hs_lead_status = 'SQL')
    AND EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', c.hs_createdate)) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 2
    AND c.region IS NOT NULL
    AND c.lead_source IS NOT NULL
  GROUP BY region, sql_type
),
opportunity_data AS (
  -- Count Opportunities by region and SQL type
  SELECT
    CASE 
      WHEN d.region = 'North America' THEN 'NORAM'
      WHEN d.region = 'EMEA North' THEN 'EMESA_NORTH'
      WHEN d.region = 'EMEA South' THEN 'EMESA_SOUTH'
      ELSE UPPER(REGEXP_REPLACE(d.region, '[^A-Z0-9]', '_'))
    END AS region,
    CASE
      WHEN LOWER(d.lead_source) LIKE '%inbound%' THEN 'INBOUND'
      WHEN LOWER(d.lead_source) LIKE '%outbound%' THEN 'OUTBOUND'
      WHEN LOWER(d.lead_source) LIKE '%ilo%' THEN 'ILO'
      -- ... (similar mapping)
      ELSE 'UNKNOWN'
    END AS sql_type,
    COUNT(*) AS opp_count
  FROM `reporting-299920.hubspot.deal` d
  WHERE 
    -- Opportunities are deals past SQL stage but not closed won yet
    d.dealstage NOT IN ('SQL', 'Closed Lost', 'Closed Won')
    AND EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.createdate)) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 2
    AND d.region IS NOT NULL
    AND d.lead_source IS NOT NULL
  GROUP BY region, sql_type
),
closed_won_new AS (
  -- Count Closed Won deals for NEW business
  SELECT
    CASE 
      WHEN d.region = 'North America' THEN 'NORAM'
      WHEN d.region = 'EMEA North' THEN 'EMESA_NORTH'
      WHEN d.region = 'EMEA South' THEN 'EMESA_SOUTH'
      ELSE UPPER(REGEXP_REPLACE(d.region, '[^A-Z0-9]', '_'))
    END AS region,
    CASE
      WHEN LOWER(d.lead_source) LIKE '%inbound%' THEN 'INBOUND'
      WHEN LOWER(d.lead_source) LIKE '%outbound%' THEN 'OUTBOUND'
      WHEN LOWER(d.lead_source) LIKE '%ilo%' THEN 'ILO'
      -- ... (similar mapping)
      ELSE 'UNKNOWN'
    END AS sql_type,
    COUNT(*) AS won_new_count
  FROM `reporting-299920.hubspot.deal` d
  WHERE 
    d.dealstage = 'Closed Won'
    AND (LOWER(d.dealtype) LIKE '%new%' OR d.dealtype IS NULL)  -- New business deals
    AND EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.closedate)) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 2
    AND d.region IS NOT NULL
    AND d.lead_source IS NOT NULL
  GROUP BY region, sql_type
),
closed_won_upsell AS (
  -- Count Closed Won deals for UPSELL/RENEWAL business
  SELECT
    CASE 
      WHEN d.region = 'North America' THEN 'NORAM'
      WHEN d.region = 'EMEA North' THEN 'EMESA_NORTH'
      WHEN d.region = 'EMEA South' THEN 'EMESA_SOUTH'
      ELSE UPPER(REGEXP_REPLACE(d.region, '[^A-Z0-9]', '_'))
    END AS region,
    CASE
      WHEN LOWER(d.lead_source) LIKE '%inbound%' THEN 'INBOUND'
      WHEN LOWER(d.lead_source) LIKE '%outbound%' THEN 'OUTBOUND'
      WHEN LOWER(d.lead_source) LIKE '%ilo%' THEN 'ILO'
      -- ... (similar mapping)
      ELSE 'UNKNOWN'
    END AS sql_type,
    COUNT(*) AS won_upsell_count
  FROM `reporting-299920.hubspot.deal` d
  WHERE 
    d.dealstage = 'Closed Won'
    AND (LOWER(d.dealtype) LIKE '%upsell%' OR LOWER(d.dealtype) LIKE '%renewal%' OR LOWER(d.dealtype) LIKE '%expansion%')
    AND EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.closedate)) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 2
    AND d.region IS NOT NULL
    AND d.lead_source IS NOT NULL
  GROUP BY region, sql_type
)
SELECT
  COALESCE(s.region, o.region) AS region,
  COALESCE(s.sql_type, o.sql_type) AS sql_type,
  -- SQL to Opportunity conversion rate
  CASE 
    WHEN s.sql_count > 0 THEN SAFE_DIVIDE(o.opp_count, s.sql_count)
    ELSE 0.0
  END AS opp_coverage_ratio,
  -- Opportunity to Closed Won (New Business) win rate
  CASE 
    WHEN o.opp_count > 0 THEN SAFE_DIVIDE(cwn.won_new_count, o.opp_count)
    ELSE 0.0
  END AS win_rate_new,
  -- Opportunity to Closed Won (Upsell) win rate
  CASE 
    WHEN o.opp_count > 0 THEN SAFE_DIVIDE(cwu.won_upsell_count, o.opp_count)
    ELSE 0.0
  END AS win_rate_upsell
FROM sql_data s
FULL OUTER JOIN opportunity_data o ON s.region = o.region AND s.sql_type = o.sql_type
LEFT JOIN closed_won_new cwn ON COALESCE(s.region, o.region) = cwn.region AND COALESCE(s.sql_type, o.sql_type) = cwn.sql_type
LEFT JOIN closed_won_upsell cwu ON COALESCE(s.region, o.region) = cwu.region AND COALESCE(s.sql_type, o.sql_type) = cwu.sql_type
WHERE COALESCE(s.sql_count, 0) > 0 OR COALESCE(o.opp_count, 0) > 0;
```

---

## 3. Actuals Data

### Purpose
Tracks actual performance data (SQLs, Opportunities, Revenue) for comparison against forecasts.

### Required BigQuery Table Schema
```sql
CREATE TABLE actuals (
  year INT64,
  quarter INT64,
  region STRING,
  sql_type STRING,
  actual_revenue FLOAT64  -- Revenue in dollars (from closed won deals)
);
```

**Note:** The portal also tracks `actualSqls` and `actualOpps`, but the current BigQuery sync only imports `actual_revenue`. You can extend this if needed.

### HubSpot Source Data

#### Primary Entity: `deal` (for closed won deals)

**Key HubSpot Properties:**
- `deal.closedate` - Deal close date (to derive year/quarter)
- `deal.amount` or `deal.hs_deal_amount` - Deal value
- `deal.region` - Region classification
- `deal.lead_source` - SQL type classification
- `deal.dealstage` - Must be "Closed Won"
- `deal.dealtype` - To distinguish new vs upsell (optional, for revenue breakdown)

### Recommended BigQuery View/Query

```sql
-- Create actuals from closed won deals
CREATE OR REPLACE VIEW `reporting-299920.hubspot.actuals` AS
SELECT
  EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.closedate)) AS year,
  EXTRACT(QUARTER FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.closedate)) AS quarter,
  CASE 
    WHEN d.region = 'North America' THEN 'NORAM'
    WHEN d.region = 'EMEA North' THEN 'EMESA_NORTH'
    WHEN d.region = 'EMEA South' THEN 'EMESA_SOUTH'
    ELSE UPPER(REGEXP_REPLACE(d.region, '[^A-Z0-9]', '_'))
  END AS region,
  CASE
    WHEN LOWER(d.lead_source) LIKE '%inbound%' THEN 'INBOUND'
    WHEN LOWER(d.lead_source) LIKE '%outbound%' THEN 'OUTBOUND'
    WHEN LOWER(d.lead_source) LIKE '%ilo%' THEN 'ILO'
    -- ... (similar mapping)
    ELSE 'UNKNOWN'
    END AS sql_type,
  SUM(CAST(d.amount AS FLOAT64)) AS actual_revenue  -- Sum revenue for the period
FROM `reporting-299920.hubspot.deal` d
WHERE 
  d.dealstage = 'Closed Won'
  AND d.closedate IS NOT NULL
  AND d.amount IS NOT NULL
  AND EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.closedate)) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 2
  AND d.region IS NOT NULL
  AND d.lead_source IS NOT NULL
GROUP BY year, quarter, region, sql_type
ORDER BY year DESC, quarter DESC;
```

---

## 4. Deal Economics (ACV Calculation)

### Purpose
Calculates Average Contract Value (ACV) for new business and upsells, used in revenue forecasting.

### HubSpot Source Data

#### Primary Entity: `deal` (closed won deals)

**Key HubSpot Properties:**
- `deal.amount` - Deal value
- `deal.dealtype` - To distinguish new vs upsell
- `deal.region` - Region classification
- `deal.closedate` - For time-based filtering

### Recommended BigQuery Query (for reference)

```sql
-- Calculate ACV by region and deal type
SELECT
  CASE 
    WHEN d.region = 'North America' THEN 'NORAM'
    WHEN d.region = 'EMEA North' THEN 'EMESA_NORTH'
    WHEN d.region = 'EMEA South' THEN 'EMESA_SOUTH'
    ELSE UPPER(REGEXP_REPLACE(d.region, '[^A-Z0-9]', '_'))
  END AS region,
  CASE
    WHEN LOWER(d.dealtype) LIKE '%new%' OR d.dealtype IS NULL THEN 'NEW'
    WHEN LOWER(d.dealtype) LIKE '%upsell%' OR LOWER(d.dealtype) LIKE '%renewal%' OR LOWER(d.dealtype) LIKE '%expansion%' THEN 'UPSELL'
    ELSE 'OTHER'
  END AS deal_type,
  AVG(CAST(d.amount AS FLOAT64)) AS avg_acv,
  COUNT(*) AS deal_count
FROM `reporting-299920.hubspot.deal` d
WHERE 
  d.dealstage = 'Closed Won'
  AND d.closedate IS NOT NULL
  AND d.amount IS NOT NULL
  AND EXTRACT(YEAR FROM PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.closedate)) >= EXTRACT(YEAR FROM CURRENT_DATE()) - 2
  AND d.region IS NOT NULL
GROUP BY region, deal_type;
```

**Note:** Deal Economics are typically configured manually in the portal based on this analysis, but you can create a view if you want to automate it.

---

## 5. Time Distributions

### Purpose
Tracks how SQLs convert to opportunities over time (typically 89% same quarter, 10% next quarter, 1% two quarters later).

### HubSpot Source Data

#### Primary Entities: `contact` (SQLs) and `deal` (Opportunities)

**Key HubSpot Properties:**
- `contact.hs_createdate` - SQL creation date
- `deal.createdate` - Opportunity creation date
- `contact.lead_source` / `deal.lead_source` - SQL type classification

### Recommended BigQuery Query (for analysis)

```sql
-- Analyze time distribution from SQL to Opportunity
WITH sql_opp_pairs AS (
  SELECT
    c.hs_createdate AS sql_date,
    d.createdate AS opp_date,
    CASE
      WHEN LOWER(c.lead_source) LIKE '%inbound%' THEN 'INBOUND'
      WHEN LOWER(c.lead_source) LIKE '%outbound%' THEN 'OUTBOUND'
      WHEN LOWER(c.lead_source) LIKE '%ilo%' THEN 'ILO'
      ELSE 'UNKNOWN'
    END AS sql_type,
    DATE_DIFF(
      DATE(PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', d.createdate)),
      DATE(PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%E*S', c.hs_createdate)),
      QUARTER
    ) AS quarters_diff
  FROM `reporting-299920.hubspot.contact` c
  INNER JOIN `reporting-299920.hubspot.deal_contact` dc ON c.id = dc.contact_id
  INNER JOIN `reporting-299920.hubspot.deal` d ON dc.deal_id = d.id
  WHERE 
    (c.lifecyclestage = 'SQL' OR c.hs_lead_status = 'SQL')
    AND d.dealstage NOT IN ('SQL', 'Closed Lost')
    AND c.hs_createdate IS NOT NULL
    AND d.createdate IS NOT NULL
)
SELECT
  sql_type,
  COUNTIF(quarters_diff = 0) AS same_quarter_count,
  COUNTIF(quarters_diff = 1) AS next_quarter_count,
  COUNTIF(quarters_diff = 2) AS two_quarters_count,
  COUNT(*) AS total_count,
  SAFE_DIVIDE(COUNTIF(quarters_diff = 0), COUNT(*)) AS same_quarter_pct,
  SAFE_DIVIDE(COUNTIF(quarters_diff = 1), COUNT(*)) AS next_quarter_pct,
  SAFE_DIVIDE(COUNTIF(quarters_diff = 2), COUNT(*)) AS two_quarters_pct
FROM sql_opp_pairs
GROUP BY sql_type;
```

**Note:** Time distributions are typically configured manually in the portal based on this analysis, but you can create a view if you want to automate it.

---

## Summary: Required HubSpot Tables

Based on the Fivetran sync, you'll need access to these HubSpot tables in BigQuery:

### Essential Tables:
1. **`contact`** - For SQL identification and tracking
2. **`deal`** - For opportunities, closed won deals, and revenue
3. **`deal_contact`** (or `deal_company`) - To link deals to contacts/companies

### Optional but Recommended:
4. **`company`** - If region is stored at company level
5. **`deal_pipeline`** - To understand deal stages
6. **`contact_property_history`** - For historical lifecycle stage changes
7. **`deal_property_history`** - For historical deal stage changes

---

## Key HubSpot Properties to Ensure Are Synced

### Contact Properties:
- `hs_createdate` (or `createdate`)
- `lifecyclestage`
- `hs_lead_status`
- `region` (or custom property)
- `lead_source` (or `hs_analytics_source`)

### Deal Properties:
- `createdate`
- `closedate`
- `dealstage`
- `dealtype` (or custom property for new vs upsell)
- `amount` (or `hs_deal_amount`)
- `region` (or custom property)
- `lead_source` (or custom property)

---

## Next Steps

1. **Verify Fivetran Sync**: Ensure the above HubSpot tables and properties are being synced to BigQuery
2. **Create BigQuery Views**: Use the SQL queries above to create views that transform HubSpot data into the portal's required format
3. **Configure Portal**: In the portal's BigQuery configuration page, point to your created views:
   - SQL History: `hubspot.sql_history`
   - Conversion Rates: `hubspot.conversion_rates`
   - Actuals: `hubspot.actuals`
4. **Test Connection**: Use the portal's "Test Connection" feature to verify data is accessible
5. **Sync Data**: Run the initial sync to populate the portal with historical data

---

## Important Notes

- **Region Mapping**: You'll need to map your HubSpot region values to the portal's region names (NORAM, EMESA_NORTH, etc.)
- **SQL Type Mapping**: You'll need to map your HubSpot lead source values to the portal's SQL types (INBOUND, OUTBOUND, ILO, etc.)
- **Deal Stage Names**: Adjust the deal stage names in the queries to match your HubSpot pipeline stages
- **Data Quality**: Ensure `region` and `lead_source` properties are consistently populated in HubSpot
- **Time Periods**: The portal typically needs 2-3 years of historical data for accurate forecasting

