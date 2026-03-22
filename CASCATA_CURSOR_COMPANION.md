# CASCATA PORTAL — Cursor Implementation Companion

> **Companion to:** Cascata v2.0 Requirements Document | 22 March 2026
> **Load BOTH this file and the requirements doc into Cursor as context.**
> **Also load the source files listed in Section 10.**

---

## 1. Critical Rules for Cursor

**Before writing ANY code, understand these PM-confirmed rules:**

- **Historical quarters = actuals.** Never show model predictions for completed quarters. Current quarter = forecast. This is not configurable.
- **6-quarter ONE-TIME average for future projections.** NOT a rolling average. Compute mean of last 6 completed quarters' actuals at forecast time. Apply that fixed number to ALL future quarters. Only recalculates on next sync/forecast trigger.
- **RAG = model output vs actuals.** The `forecasts` table IS the target. Compare actual values against model predictions. Green ≥90%, Amber 70–90%, Red <70%. **No separate targets table.**
- **R-score: numeric only, no RAG colour.** Computed per region + globally. NOT per pod/motion. Displayed as a plain number.
- **Existing patterns:** All new code must use tRPC procedures, Zod validation, Drizzle ORM, and the `companyProtectedProcedure` pattern. All monetary values in cents. All percentages in basis points (10000 = 100%).
- **Region names stay as NORAM/EMESA.** No display name changes.
- **Minimum 18 months (6 quarters) of HubSpot data.** Can fall back to 12 months (4 quarters). No edge case handling for fewer than 4 quarters needed.

---

## 2. Step 1: Schema Changes (drizzle/schema.ts)

Apply these changes first. They are prerequisites for everything else.

### 2.1 Add `actualWins` to actuals table

Location: `drizzle/schema.ts`, inside the `actuals` mysqlTable definition (~line 214). Add after `actualRevenue`:

```typescript
actualWins: int("actualWins").notNull().default(0), // closed-won deal count
```

Then run: `pnpm db:push`

### 2.2 Add `quarterlyMetrics` table

Add after the `dataQualityReports` table definition:

```typescript
export const quarterlyMetrics = mysqlTable("quarterlyMetrics", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  regionId: int("regionId").notNull(),
  sqlTypeId: int("sqlTypeId").notNull(),
  year: int("year").notNull(),
  quarter: int("quarter").notNull(),
  pipelineCoverRatio: int("pipelineCoverRatio").notNull().default(0), // basis points
  avgAcvNew: int("avgAcvNew").notNull().default(0), // cents
  avgAcvUpsell: int("avgAcvUpsell").notNull().default(0), // cents
  totalClosedWon: int("totalClosedWon").notNull().default(0),
  totalClosedLost: int("totalClosedLost").notNull().default(0),
  customerCount: int("customerCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueQuarterlyMetric: unique().on(
    table.companyId, table.regionId, table.sqlTypeId, table.year, table.quarter
  ),
}));

export type QuarterlyMetric = typeof quarterlyMetrics.$inferSelect;
export type InsertQuarterlyMetric = typeof quarterlyMetrics.$inferInsert;
```

### 2.3 Add `rScoreHistory` table

```typescript
export const rScoreHistory = mysqlTable("rScoreHistory", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  metricType: mysqlEnum("metricType", ["ocr", "owr", "overall"]).notNull(),
  regionId: int("regionId"), // null = global
  year: int("year").notNull(),
  quarter: int("quarter").notNull(),
  rScore: decimal("rScore", { precision: 6, scale: 4 }).notNull(),
  sampleSize: int("sampleSize").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RScoreHistoryRow = typeof rScoreHistory.$inferSelect;
export type InsertRScoreHistory = typeof rScoreHistory.$inferInsert;
```

### 2.4 Update SyncConfig interface

Add these fields to the existing `SyncConfig` interface (~line 50):

```typescript
// Add after existing fields:
companyCustomerField?: string;     // HubSpot Company property identifying customers
companyCustomerValues?: string[];  // Values meaning 'is customer' e.g. ['customer']
rollingWindowQuarters?: number;    // default 6
```

### 2.5 NO targets table

**Do NOT create a targets table.** The `forecasts` table already contains the model's predictions which serve as RAG targets. PM confirmed: "RAG targets are derived directly from the cascade output."

---

## 3. Step 2: Pearson R-Score Engine

**Create:** `server/pearsonEngine.ts`

### 3.1 TypeScript Interfaces

```typescript
export interface RScoreResult {
  metricType: "ocr" | "owr" | "overall";
  regionId: number | null;  // null = global
  regionName: string | null;
  rScore: number;           // -1.0 to +1.0
  sampleSize: number;       // number of quarters used
}

export interface RScoreResponse {
  perRegion: RScoreResult[];  // one per region per metric type
  global: {
    ocr: number;   // weighted average R across regions
    owr: number;
    overall: number;
  };
}
```

### 3.2 Core Functions

```typescript
/**
 * Compute Pearson R between two number arrays.
 * Returns NaN if arrays too short or zero variance.
 */
export function pearsonR(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 4) return NaN;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
  const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return NaN;
  return numerator / denominator;
}

/**
 * Compute R-scores for a company.
 * Uses last `windowSize` completed quarters (default 6, minimum 4).
 * Computes per region + globally. NOT per pod/motion.
 */
export async function computeRScores(
  companyId: number,
  windowSize?: number  // default 6, minimum 4
): Promise<RScoreResponse> {
  // Implementation steps:
  // 1. Get current quarter (determines historical boundary)
  // 2. Get all enabled regions for company
  // 3. For each region, aggregate forecasts and actuals across ALL sqlTypes
  //    for the last `windowSize` completed quarters
  // 4. Compute pearsonR(modelValues, actualValues) for OCR and OWR
  // 5. Compute global R as weighted average (weight = sample size per region)
  // 6. Return RScoreResponse
}
```

### 3.3 Worked Example

```
Region: NORAM, Metric: OCR (opportunities)

Last 6 completed quarters:
  Model predictions (forecasts.predictedOpps / 100): [120, 135, 128, 142, 138, 145]
  Actuals          (actuals.actualOpps):             [115, 140, 125, 138, 142, 148]

n = 6
Σx = 808, Σy = 808
Σxy = 109,234
Σx² = 109,458, Σy² = 109,438

R = (6×109234 - 808×808) / sqrt((6×109458 - 808²)(6×109438 - 808²))
R = 2540 / sqrt(3884 × 3764)
R = 2540 / 3822.5
R = 0.665

Displayed as: "0.67" (no RAG colour)
```

### 3.4 How to Get Model vs Actual Data

```typescript
// For OCR R-score:
//   Model = forecasts.predictedOpps (÷ OPPORTUNITY_PRECISION_MULTIPLIER which is 100)
//   Actual = actuals.actualOpps

// For OWR R-score:
//   Model = derived from cascade engine (totalWonPerQuarter)
//   Actual = actuals.actualWins (the new column)

// Match on: companyId, regionId, year, quarter
// AGGREGATE across ALL sqlTypes within each region (sum model, sum actual)
// This is why R-score is per-region, not per-motion — we sum motions together

// Global R = weighted average of per-region Rs (weight = sampleSize)
```

### 3.5 tRPC Router Integration

Add to `server/routers.ts` inside the `dashboard` router:

```typescript
rScores: companyProtectedProcedure
  .input(z.object({ companyId: z.number().int().min(1) }))
  .query(async ({ input }) => {
    const { computeRScores } = await import("./pearsonEngine");
    return await computeRScores(input.companyId);
  }),
```

---

## 4. Step 3: Performance RAG Engine

**Create:** `server/ragEngine.ts`

### 4.1 TypeScript Interfaces

```typescript
export type RagStatus = "green" | "amber" | "red";

export interface RagResult {
  metric: "sql" | "ocr" | "owr";
  level: "global" | "region" | "motion";
  regionId?: number;
  regionName?: string;
  sqlTypeId?: number;
  sqlTypeName?: string;
  year: number;
  quarter: number;
  modelValue: number;   // from forecasts table
  actualValue: number;  // from actuals table
  attainment: number;   // actual / model as percentage (0-100+)
  status: RagStatus;
}
```

### 4.2 Core Function

```typescript
export function computeRag(actual: number, model: number): RagStatus {
  if (model === 0) return "green"; // no target to miss
  const attainment = (actual / model) * 100;
  if (attainment >= 90) return "green";
  if (attainment >= 70) return "amber";
  return "red";
}
```

### 4.3 Aggregation at Each Hierarchy Level

This is a critical design decision:

- **Motion level (Level 3):** Direct comparison. `forecasts` row for this companyId/regionId/sqlTypeId/year/quarter vs matching `actuals` row.
- **Region level (Level 2):** SUM all forecasts for this regionId across all sqlTypes for the quarter. SUM all actuals for same. Compute RAG on the sums.
- **Global level (Level 1):** SUM all forecasts across all regions and sqlTypes. SUM all actuals. Compute RAG on the totals.

**This means:** Global RAG might be Green even if one motion is Red, because the total attainment could still be above 90%.

### 4.4 Worked Example

```
Quarter: Q2 2026, Region: NORAM, Metric: OCR (opportunities)

Motion-level:
  Inbound:  model=80,  actual=85  → 106% → GREEN
  Outbound: model=40,  actual=25  →  63% → RED
  ILO:      model=30,  actual=28  →  93% → GREEN

Region-level (NORAM):
  model_sum = 80+40+30 = 150
  actual_sum = 85+25+28 = 138
  attainment = 138/150 = 92% → GREEN

Note: Region is GREEN even though Outbound motion is RED,
because total attainment is above 90%.
```

### 4.5 Data Source

```typescript
// For SQL RAG:  model = forecasts.predictedSqls,           actual = actuals.actualSqls
// For OCR RAG:  model = forecasts.predictedOpps / 100,     actual = actuals.actualOpps
// For OWR RAG:  model = derived wins from cascade,         actual = actuals.actualWins

// Match forecasts to actuals on: companyId + regionId + sqlTypeId + year + quarter

// RAG only applies to HISTORICAL quarters (where actuals exist).
// Future quarters have no actuals, so no RAG indicator.
```

---

## 5. Step 4: Enhanced Cascade Engine (cascadeEngine.ts)

### 5.1 The 6-Quarter One-Time Average

**This replaces the current fallback logic at lines 126–137 of cascadeEngine.ts.**

```typescript
/**
 * Compute one-time average of a metric over the last N completed quarters.
 * This is NOT a rolling average — computed once at forecast time.
 *
 * @param quarterlyValues Map of "YYYY-Q" → value for completed quarters
 * @param currentYear current year
 * @param currentQuarter current quarter (this Q is forecast, not included)
 * @param windowSize number of quarters to average (default 6, minimum 4)
 * @returns The fixed average to apply to all future quarters, or null if insufficient data
 */
function computeSixQuarterAverage(
  quarterlyValues: Map<string, number>,
  currentYear: number,
  currentQuarter: number,
  windowSize: number = 6
): number | null {
  // 1. Build sorted list of completed quarters (BEFORE current Q)
  const completed: { key: string; val: number }[] = [];
  for (const [key, val] of quarterlyValues) {
    const [y, q] = key.split("-").map(Number);
    if (y < currentYear || (y === currentYear && q < currentQuarter)) {
      completed.push({ key, val });
    }
  }

  // 2. Sort by time (most recent last)
  completed.sort((a, b) => a.key.localeCompare(b.key));

  // 3. Take last `windowSize` entries
  const window = completed.slice(-windowSize);

  // 4. Need minimum 4 quarters
  if (window.length < 4) return null;

  // 5. Arithmetic mean
  return window.reduce((sum, item) => sum + item.val, 0) / window.length;
}
```

### 5.2 Where to Apply the Average

The one-time average replaces FOUR different values in the cascade:

1. **SQL→OCR conversion rate:** Currently uses `overallConvRate` (lines 135–137). Replace with 6Q average of per-quarter actual conversion rates for future quarters.
2. **OCR→OWR win rate:** Currently uses `conversion.winRateNew` (line 154). Replace with 6Q average of per-quarter actual win rates for future quarters.
3. **Pipeline cover ratio:** Currently uses static `oppCoverageRatio` (line 138). Replace with 6Q average of per-quarter actual ratios from `quarterlyMetrics` for future quarters.
4. **ACV:** Currently uses static `dealEcon.acvNew` (line 159). Replace with 6Q average of per-quarter actual ACV from `quarterlyMetrics` for future quarters.

### 5.3 Worked Example: Conversion Rate

```
Region: NORAM, Motion: Inbound
Current quarter: Q3 2026 (this is the forecast boundary)

Last 6 completed quarters of actual SQL→OCR conversion:
  Q1 25: 45%  (actualOpps / actualSqls for this region+motion)
  Q2 25: 52%
  Q3 25: 48%
  Q4 25: 51%
  Q1 26: 47%
  Q2 26: 50%

One-time average = (45 + 52 + 48 + 51 + 47 + 50) / 6 = 48.8%

This 48.8% is used for Q3 26, Q4 26, Q1 27, Q2 27, etc.
ALL future quarters get the SAME 48.8%.
It does NOT change until the next sync/forecast recalculation.

Historical quarters (Q1 25 through Q2 26) keep their actual per-quarter values.
```

### 5.4 Key Change to `calculateCascade()`

The main loop (lines 162–182) currently computes `baseOpps` per quarter. Here is the change:

```typescript
// BEFORE (current code, lines 172–180):
// Uses per-quarter actual conversion OR overallConvRate fallback for every quarter

// AFTER:
// 1. Determine the current quarter boundary
const now = new Date();
const currentYear = now.getFullYear();
const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

// 2. Build per-quarter conversion rates map from actuals
const perQConvRates = new Map<string, number>();
for (const a of actualsData) {
  if (a.regionId === region.id && a.sqlTypeId === sqlType.id && a.actualSqls > 0) {
    const rate = Math.min(Math.round((a.actualOpps / a.actualSqls) * 10000), 10000);
    perQConvRates.set(`${a.year}-${a.quarter}`, rate);
  }
}

// 3. Compute the ONE-TIME 6Q average (computed once, used for all future Qs)
const sixQConvRate = computeSixQuarterAverage(
  perQConvRates, currentYear, currentQuarter
);

// 4. In the per-quarter loop:
for (let qo = 0; qo < totalQuarters; qo++) {
  const q = getQuarterAhead(startYear, startQuarter, qo);
  const isHistorical = q.year < currentYear ||
    (q.year === currentYear && q.quarter < currentQuarter);

  let convRate: number;
  if (isHistorical) {
    // Historical: use actual per-quarter conversion (existing logic)
    const aKey = `${region.id}-${sqlType.id}-${q.year}-${q.quarter}`;
    const actualData = quarterActualsMap.get(aKey);
    convRate = (actualData && actualData.sqls > 0)
      ? Math.min(Math.round((actualData.opps / actualData.sqls) * 10000), 10000)
      : overallConvRate;
  } else {
    // Future: use the fixed 6Q one-time average
    convRate = sixQConvRate ?? overallConvRate;
  }

  baseOpps.push((sqlVolume * convRate) / 10000);
}
```

**Apply the same pattern** for win rate, pipeline cover ratio, and ACV — compute the 6Q average once before the loop, then use the fixed average for all future quarters.

---

## 6. Step 5: HubSpot Sync Enhancements (hubspotSync.ts)

No new HubSpot API calls for Phase 1. Changes happen during existing deal processing.

### 6.1 Compute Per-Quarter Metrics During Deal Sync

After the existing deal processing loop (~line 475–530), add aggregation:

```typescript
// Build per-quarter aggregates from the deals already fetched
const qMetrics = new Map<string, {
  closedWon: number;
  closedLost: number;
  wonAmountSum: number;   // sum of deal amounts for won deals (new business)
  wonAmountCount: number;
  upsellAmountSum: number;
  upsellAmountCount: number;
}>();

for (const deal of deals) {
  const region = mapDealRegion(deal.properties[cfg.dealRegionProperty], cfg);
  const sqlType = mapSqlType(deal.properties[cfg.dealSqlTypeProperty], cfg);
  const qtr = toQuarter(deal.properties[cfg.dealCloseDateProperty]);
  if (!region || !sqlType || !qtr) continue;

  const key = `${region}|${sqlType}|${qtr.year}|${qtr.quarter}`;
  const m = qMetrics.get(key) ?? {
    closedWon: 0, closedLost: 0,
    wonAmountSum: 0, wonAmountCount: 0,
    upsellAmountSum: 0, upsellAmountCount: 0
  };

  const amount = parseFloat(deal.properties[cfg.dealAmountProperty] ?? "0") || 0;
  const amountCents = Math.round(amount * 100);
  const dealType = (deal.properties.dealtype ?? "").toLowerCase();
  const isWon = cfg.closedWonStageIds.includes(deal.properties.dealstage ?? "");

  if (isWon) {
    m.closedWon++;
    if (cfg.newDealTypeValues.some(v => dealType.includes(v.toLowerCase()))) {
      m.wonAmountSum += amountCents;
      m.wonAmountCount++;
    } else {
      m.upsellAmountSum += amountCents;
      m.upsellAmountCount++;
    }
  } else {
    m.closedLost++;
  }
  qMetrics.set(key, m);
}

// Write to quarterlyMetrics table (upsert pattern)
for (const [key, m] of qMetrics) {
  const [regionName, sqlTypeName, yearStr, quarterStr] = key.split("|");
  const regionId = regionMap.get(regionName);
  const sqlTypeId = sqlTypeMap.get(sqlTypeName);
  if (!regionId || !sqlTypeId) continue;

  const ratio = m.closedWon > 0
    ? Math.round(((m.closedWon + m.closedLost) / m.closedWon) * 10000)
    : 0; // basis points

  const avgAcvNew = m.wonAmountCount > 0
    ? Math.round(m.wonAmountSum / m.wonAmountCount)
    : 0; // cents

  const avgAcvUpsell = m.upsellAmountCount > 0
    ? Math.round(m.upsellAmountSum / m.upsellAmountCount)
    : 0;

  await db.upsertQuarterlyMetric({
    companyId,
    regionId,
    sqlTypeId,
    year: parseInt(yearStr),
    quarter: parseInt(quarterStr),
    pipelineCoverRatio: ratio,
    avgAcvNew,
    avgAcvUpsell,
    totalClosedWon: m.closedWon,
    totalClosedLost: m.closedLost,
    customerCount: 0, // Phase 2
  });
}
```

### 6.2 Populate `actualWins` During Actuals Upsert

In the existing actuals upsert logic, add the closed-won deal count:

```typescript
// Current actuals upsert sets: actualSqls, actualOpps, actualRevenue
// Add: actualWins = closedWon count for this Q/region/sqlType
// Source: qMetrics[key].closedWon computed above
```

---

## 7. Step 6: Hierarchical Cascade UI

**Create:** `client/src/components/HierarchicalCascade.tsx`

### 7.1 Data Structure from Server

New tRPC procedure returns this shape:

```typescript
// Response from dashboard.hierarchicalData
interface HierarchicalData {
  quarters: { year: number; quarter: number; label: string }[];
  global: HierarchyRow;
  regions: HierarchyRow[];       // one per enabled region
  motions: HierarchyRow[][];     // motions[regionIndex][motionIndex]
}

interface HierarchyRow {
  id: string;                     // "global" | "region-NORAM" | "motion-NORAM-INBOUND"
  label: string;                  // "All Regions" | "NORAM" | "Inbound"
  level: 1 | 2 | 3;
  regionId?: number;
  sqlTypeId?: number;
  quarters: HierarchyQuarter[];
  rScore?: number;                // only on level 1 (global) and level 2 (region)
}

interface HierarchyQuarter {
  year: number;
  quarter: number;
  isHistorical: boolean;          // true = show actuals + RAG, false = forecast only
  sql:  { model: number; actual: number | null; rag: RagStatus | null };
  ocr:  { model: number; actual: number | null; rag: RagStatus | null };
  owr:  { model: number; actual: number | null; rag: RagStatus | null };
}

type RagStatus = "green" | "amber" | "red";
```

### 7.2 Component Structure

```tsx
import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface Props {
  data: HierarchicalData;
  isLoading: boolean;
}

export function HierarchicalCascade({ data, isLoading }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2 w-48">Level</th>
            {data.quarters.map(q => (
              <th key={q.label} colSpan={6} className="text-center p-1 border-l">
                {q.label}
                <div className="flex text-xs text-muted-foreground">
                  <span className="flex-1 bg-purple-50">SQL</span>
                  <span className="flex-1 bg-purple-50">OCR</span>
                  <span className="flex-1 bg-emerald-50">OWR</span>
                </div>
                <div className="flex text-[10px] text-muted-foreground">
                  <span className="flex-1">M</span><span className="flex-1">A</span>
                  <span className="flex-1">M</span><span className="flex-1">A</span>
                  <span className="flex-1">M</span><span className="flex-1">A</span>
                </div>
              </th>
            ))}
            <th className="text-center p-1 w-20">R-Score</th>
          </tr>
        </thead>
        <tbody>
          {/* Level 1: Global row */}
          <HierarchyRowComponent
            row={data.global}
            expanded={expanded}
            onToggle={toggleExpand}
            depth={0}
          />

          {/* Level 2: Region rows (if global expanded) */}
          {expanded.has("global") && data.regions.map((region, ri) => (
            <Fragment key={region.id}>
              <HierarchyRowComponent
                row={region}
                expanded={expanded}
                onToggle={toggleExpand}
                depth={1}
              />

              {/* Level 3: Motion rows (if region expanded) */}
              {expanded.has(region.id) && data.motions[ri].map(motion => (
                <HierarchyRowComponent
                  key={motion.id}
                  row={motion}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  depth={2}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 7.3 Column Layout

```
| Label      | Q1 SQL    | Q1 OCR    | Q1 OWR    | Q2 SQL    | ... | R-Score |
|            | Mod | Act | Mod | Act | Mod | Act | Mod | Act |     |         |
|------------|-----|-----|-----|-----|-----|-----|-----|-----|-----|---------|
| ▶ Global   | 120 | 115 |  55 |  52 |  14 |  12 | ... | ... | ... |  0.67   |
|   ▶ NORAM  |  80 |  78 |  35 |  33 |   9 |   8 | ... | ... | ... |  0.72   |
|     Inbound|  50 |  48 |  22 |  20 |   6 |   5 | ... | ... | ... |         |
|     Outbnд |  30 |  30 |  13 |  13 |   3 |   3 | ... | ... | ... |         |
```

**Colours:**
- SQL and OCR columns: `bg-purple-50/60 text-purple-900` (Tailwind)
- OWR columns: `bg-emerald-50/60 text-emerald-900`
- RAG badges: small coloured dot next to actual value. Use `bg-green-500`, `bg-amber-500`, `bg-red-500` as 8px circles.
- R-score column: plain numeric text, no colour. Only on Level 1 and Level 2 rows.

### 7.4 tRPC Procedure for Hierarchical Data

Add to `server/routers.ts`:

```typescript
hierarchicalData: companyProtectedProcedure
  .input(z.object({ companyId: z.number().int().min(1) }))
  .query(async ({ input }) => {
    // 1. Get regions, sqlTypes, forecasts, actuals for this company
    // 2. Determine current quarter (historical boundary)
    // 3. For each quarter:
    //    - Global row: sum forecasts across all regions+sqlTypes, sum actuals
    //    - Region rows: sum forecasts per region across sqlTypes, sum actuals
    //    - Motion rows: direct forecast + actual per region+sqlType
    // 4. Compute RAG for each cell where isHistorical=true
    // 5. Compute R-scores per region + globally (delegate to pearsonEngine)
    // 6. Return HierarchicalData shape
  }),
```

---

## 8. Step 7: Dashboard.tsx Migration

### 8.1 What to Keep
- Filter bar (company, region, sqlType, year, quarter selectors) — keep exactly as-is
- `DashboardLayout` wrapper — keep
- Auth checks and loading states — keep
- The `useEffect` data fetching pattern — keep but extend

### 8.2 What to Replace
- KPI summary cards at top (lines ~150–250) → replace with headline R-Score (numeric) + Overall RAG Status (coloured badge)
- Revenue trend LineChart → move to secondary "Charts" tab below hierarchy
- Regional breakdown BarChart → replaced by the hierarchy itself
- `ConversionFunnel` component → keep as secondary view

### 8.3 New Layout

```tsx
return (
  <DashboardLayout>
    {/* Existing filter bar — KEEP */}
    <FilterBar ... />

    {/* NEW: Headline metrics row */}
    <div className="grid grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader><CardTitle>Model Accuracy (R-Score)</CardTitle></CardHeader>
        <CardContent className="text-3xl font-bold">
          {rScores?.global.overall.toFixed(2) ?? "—"}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Overall Attainment</CardTitle></CardHeader>
        <CardContent>
          <RagBadge status={globalRag} attainment={globalAttainment} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Data Coverage</CardTitle></CardHeader>
        <CardContent><Badge>{coverage}%</Badge></CardContent>
      </Card>
    </div>

    {/* NEW: Hierarchical cascade (primary view) */}
    <Card>
      <CardHeader><CardTitle>Cascade Performance</CardTitle></CardHeader>
      <CardContent>
        <HierarchicalCascade data={hierarchyData} isLoading={loading} />
      </CardContent>
    </Card>

    {/* KEPT: Charts section (collapsible) */}
    <Collapsible>
      <CollapsibleTrigger>Charts & Visualisations</CollapsibleTrigger>
      <CollapsibleContent>
        <RevenueTrendChart ... />
        <ConversionFunnel ... />
      </CollapsibleContent>
    </Collapsible>
  </DashboardLayout>
);
```

### 8.4 New Data Fetches

```typescript
// Add alongside existing tRPC queries in Dashboard.tsx:
const { data: hierarchyData, isLoading: hierarchyLoading } =
  trpc.dashboard.hierarchicalData.useQuery(
    { companyId: selectedCompany as number },
    { enabled: isAuthenticated && typeof selectedCompany === "number" }
  );

const { data: rScores } =
  trpc.dashboard.rScores.useQuery(
    { companyId: selectedCompany as number },
    { enabled: isAuthenticated && typeof selectedCompany === "number" }
  );
```

---

## 9. Step 8: CascadeSheet Model|Actual Enhancement

### 9.1 Server Changes (cascadeSheet.ts)

Extend existing interfaces:

```typescript
// Update CascadeRow (line 30):
interface CascadeRow {
  quarter: QuarterLabel;
  sqls: number;
  conversionRate: number;
  cascadeValues: number[];
  totalOpps: number;
  // NEW:
  actualSqls: number | null;    // null if future quarter
  actualOpps: number | null;
  isHistorical: boolean;
}

// Update OppCascadeRow (line 38):
interface OppCascadeRow {
  quarter: QuarterLabel;
  opps: number;
  cascadeValues: number[];
  totalWon: number;
  // NEW:
  actualWins: number | null;
  isHistorical: boolean;
}
```

In `calculateCascadeSheet()`, after building each row, look up the matching actual:

```typescript
const actual = actualsData.find(a =>
  a.regionId === regionId &&
  a.sqlTypeId === sqlTypeId &&
  a.year === q.year &&
  a.quarter === q.quarter
);

row.actualSqls = isHistorical ? (actual?.actualSqls ?? null) : null;
row.actualOpps = isHistorical ? (actual?.actualOpps ?? null) : null;
row.isHistorical = isHistorical;
```

### 9.2 Client Changes (CascadeSheet.tsx)

In the `CascadeTable` component (line 111), for each cell showing a model value, add a parallel actual cell:

```tsx
{/* BEFORE: single cell */}
<td className="text-right p-1">{fmt(row.totalOpps)}</td>

{/* AFTER: Model | Actual */}
<td className="text-right p-1">{fmt(row.totalOpps)}</td>
<td className={`text-right p-1 ${row.isHistorical ? "font-medium" : "text-muted-foreground"}`}>
  {row.isHistorical && row.actualOpps != null ? fmt(row.actualOpps) : "—"}
</td>
```

---

## 10. Exact File Creation & Modification Order

**Execute in this order. Each step depends on the previous.**

1. **`drizzle/schema.ts`** — Add `actualWins`, `quarterlyMetrics` table, `rScoreHistory` table, update `SyncConfig`. Run `pnpm db:push`.
2. **`server/db.ts`** — Add CRUD functions for `quarterlyMetrics` and `rScoreHistory` (upsert, getByCompany, etc.).
3. **`server/pearsonEngine.ts`** — Create. `pearsonR()` + `computeRScores()`.
4. **`server/ragEngine.ts`** — Create. `computeRag()` function.
5. **`server/hubspotSync.ts`** — Add per-quarter metrics aggregation. Populate `actualWins`. Write to `quarterlyMetrics`.
6. **`server/cascadeEngine.ts`** — Add `computeSixQuarterAverage()`. Modify `calculateCascade()` to use 6Q one-time average for future, actuals for historical.
7. **`server/cascadeSheet.ts`** — Extend `CascadeRow` / `OppCascadeRow` with actual fields + `isHistorical` flag.
8. **`server/routers.ts`** — Add `dashboard.rScores`, `dashboard.hierarchicalData` procedures.
9. **`client/src/types/api.ts`** — Add `HierarchicalData`, `HierarchyRow`, `HierarchyQuarter`, `RScoreResponse`, `RagResult` types.
10. **`client/src/components/HierarchicalCascade.tsx`** — Create component.
11. **`client/src/pages/Dashboard.tsx`** — Replace KPIs with hierarchy, add R-score headline, add RAG indicators.
12. **`client/src/pages/CascadeSheet.tsx`** — Add Model|Actual dual columns.
13. **Run `pnpm check`, `pnpm test`, manual verification against test spec.**

**After each step:** Run `pnpm check` to verify TypeScript compiles. Fix type errors before proceeding.

---

## 11. Source Files to Load into Cursor

**Always load these alongside this document:**

**Backend (essential):**
- `server/cascadeEngine.ts`
- `server/cascadeSheet.ts`
- `server/hubspotSync.ts`
- `server/routers.ts`
- `server/db.ts`
- `drizzle/schema.ts`
- `shared/const.ts`

**Frontend (essential):**
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/CascadeSheet.tsx`
- `client/src/components/DashboardLayout.tsx`
- `client/src/App.tsx`
- `client/src/types/api.ts`
