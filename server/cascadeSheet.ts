/**
 * Cascade Sheet Calculator
 *
 * For a given motion (SQL type) and region, builds a quarter-by-quarter
 * cascade showing how SQLs convert to Opps over time using probability
 * distributions derived from HubSpot data.
 *
 * Data sources (all from HubSpot via ELT sync):
 *   - sql_history:       SQL volumes per quarter/type/region
 *   - actuals:           actual opps per quarter (used for per-quarter conversion rates)
 *   - conversion_rates:  aggregate win rates
 *   - time_distributions: probability matrix for SQL→Opp timing
 *   - deal_economics:    ACV data
 */

import * as db from "./db";

interface QuarterLabel {
  year: number;
  quarter: number;
  label: string; // "Q1 24"
}

interface CascadeRow {
  quarter: QuarterLabel;
  sqls: number;
  conversionRate: number; // 0–1
  cascadeValues: number[]; // one value per column quarter
  totalOpps: number;
}

export interface CascadeSheetData {
  motion: string;
  motionDisplay: string;
  region: string;
  regionDisplay: string;
  quarterColumns: QuarterLabel[];
  sqlProbabilities: number[]; // e.g. [0.89, 0.10, 0.01]
  rows: CascadeRow[];
  totalOppsPerQuarter: number[];
  conversionRate: number;
  winRateNew: number;
  winRateUpsell: number;
  acvNew: number;
  acvUpsell: number;
}

function makeLabel(year: number, quarter: number): string {
  return `Q${quarter} ${String(year).slice(2)}`;
}

function buildQuarterRange(startYear: number, startQ: number, endYear: number, endQ: number): QuarterLabel[] {
  const quarters: QuarterLabel[] = [];
  let y = startYear, q = startQ;
  while (y < endYear || (y === endYear && q <= endQ)) {
    quarters.push({ year: y, quarter: q, label: makeLabel(y, q) });
    q++;
    if (q > 4) { q = 1; y++; }
  }
  return quarters;
}

function qKey(year: number, quarter: number): string {
  return `${year}-${quarter}`;
}

export async function calculateCascadeSheet(
  companyId: number,
  sqlTypeName: string,
  regionNames: string[],
): Promise<CascadeSheetData> {
  const regions = await db.getRegionsByCompany(companyId);
  const sqlTypes = await db.getSqlTypesByCompany(companyId);
  const allHistory = await db.getSqlHistoryByCompany(companyId);
  const allConvRates = await db.getConversionRatesByCompany(companyId);
  const allTimeDist = await db.getTimeDistributionsByCompany(companyId);
  const allDealEcon = await db.getDealEconomicsByCompany(companyId);
  const allActuals = await db.getActualsByCompany(companyId);

  const sqlType = sqlTypes.find(t => t.name === sqlTypeName);
  if (!sqlType) throw new Error(`SQL type "${sqlTypeName}" not found`);

  const matchingRegions = regions.filter(r => regionNames.includes(r.name));
  if (matchingRegions.length === 0) throw new Error(`No regions found for ${regionNames.join(", ")}`);

  const regionIds = new Set(matchingRegions.map(r => r.id));
  const primaryRegion = matchingRegions[0];

  // SQL timing probabilities
  const timeDist = allTimeDist.find(td => td.sqlTypeId === sqlType.id);
  const sqlProbs = timeDist
    ? [timeDist.sameQuarterPct / 10000, timeDist.nextQuarterPct / 10000, timeDist.twoQuarterPct / 10000]
    : [0.89, 0.10, 0.01];

  // ── Per-quarter conversion rates from actuals table ──────────────────
  // Calculate per-quarter SQL→Opp conversion from actual HubSpot data.
  // Also compute an overall average for quarters without actuals data.
  const relevantActuals = allActuals.filter(
    a => a.sqlTypeId === sqlType.id && regionIds.has(a.regionId)
  );

  // Aggregate actuals across sub-regions per quarter
  const quarterActuals = new Map<string, { sqls: number; opps: number }>();
  let totalActualSqls = 0;
  let totalActualOpps = 0;

  for (const a of relevantActuals) {
    const key = qKey(a.year, a.quarter);
    const prev = quarterActuals.get(key) || { sqls: 0, opps: 0 };
    prev.sqls += a.actualSqls ?? 0;
    prev.opps += a.actualOpps ?? 0;
    quarterActuals.set(key, prev);
    totalActualSqls += a.actualSqls ?? 0;
    totalActualOpps += a.actualOpps ?? 0;
  }

  // Overall average conversion rate (capped at 100%)
  const overallConvRate = totalActualSqls > 0
    ? Math.min(totalActualOpps / totalActualSqls, 1.0)
    : 0.50; // sensible default if no data

  // Win rates from conversion_rates table (these are correctly calculated)
  const matchingConvRates = allConvRates.filter(
    cr => cr.sqlTypeId === sqlType.id && regionIds.has(cr.regionId)
  );
  let winNew = 0;
  let winUpsell = 0;
  if (matchingConvRates.length > 0) {
    winNew = matchingConvRates.reduce((s, cr) => s + (cr.winRateNew ?? 0), 0) / matchingConvRates.length / 10000;
    winUpsell = matchingConvRates.reduce((s, cr) => s + (cr.winRateUpsell ?? 0), 0) / matchingConvRates.length / 10000;
  }

  // Deal economics (ACV)
  const matchingDealEcon = allDealEcon.filter(de => regionIds.has(de.regionId));
  const acvNew = matchingDealEcon.length > 0
    ? matchingDealEcon.reduce((s, de) => s + ((de.acvNew ?? 0) / 100), 0) / matchingDealEcon.length
    : 0;
  const acvUpsell = matchingDealEcon.length > 0
    ? matchingDealEcon.reduce((s, de) => s + ((de.acvUpsell ?? 0) / 100), 0) / matchingDealEcon.length
    : 0;

  // ── SQL volumes per quarter ──────────────────────────────────────────
  const history = allHistory.filter(
    h => h.sqlTypeId === sqlType.id && regionIds.has(h.regionId)
  );

  const volumeMap = new Map<string, number>();
  for (const h of history) {
    const key = qKey(h.year, h.quarter);
    volumeMap.set(key, (volumeMap.get(key) || 0) + (h.volume ?? 0));
  }

  // Determine quarter range
  const dataQuarters = Array.from(volumeMap.keys()).map(k => {
    const [y, q] = k.split("-").map(Number);
    return { year: y, quarter: q };
  });

  if (dataQuarters.length === 0) {
    const now = new Date();
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);
    dataQuarters.push({ year: now.getFullYear(), quarter: currentQ });
  }

  const minYear = Math.min(...dataQuarters.map(d => d.year));
  const minQ = Math.min(...dataQuarters.filter(d => d.year === minYear).map(d => d.quarter));
  const projectionEndYear = 2028;
  const projectionEndQ = 4;

  const quarterColumns = buildQuarterRange(minYear, minQ, projectionEndYear, projectionEndQ);

  // ── Build cascade rows ───────────────────────────────────────────────
  const rows: CascadeRow[] = [];

  for (const qCol of quarterColumns) {
    const key = qKey(qCol.year, qCol.quarter);
    const sqls = volumeMap.get(key) || 0;

    // Per-quarter conversion rate from actuals, falling back to overall average
    const actualData = quarterActuals.get(key);
    let conv: number;
    if (actualData && actualData.sqls > 0) {
      conv = Math.min(actualData.opps / actualData.sqls, 1.0);
    } else {
      conv = overallConvRate;
    }

    const convertedOpps = sqls * conv;

    // Distribute across future quarters using probability matrix
    const cascadeValues = new Array(quarterColumns.length).fill(0);
    const qIdx = quarterColumns.findIndex(
      q => q.year === qCol.year && q.quarter === qCol.quarter
    );

    for (let p = 0; p < sqlProbs.length; p++) {
      const targetIdx = qIdx + p;
      if (targetIdx < quarterColumns.length) {
        cascadeValues[targetIdx] = convertedOpps * sqlProbs[p];
      }
    }

    const totalOpps = cascadeValues.reduce((s, v) => s + v, 0);

    rows.push({
      quarter: qCol,
      sqls,
      conversionRate: conv,
      cascadeValues,
      totalOpps,
    });
  }

  // Calculate total opps per quarter column (sum down each column)
  const totalOppsPerQuarter = new Array(quarterColumns.length).fill(0);
  for (const row of rows) {
    for (let c = 0; c < quarterColumns.length; c++) {
      totalOppsPerQuarter[c] += row.cascadeValues[c];
    }
  }

  // Display names
  const regionDisplay = regionNames.length > 1
    ? regionNames.map(n => regions.find(r => r.name === n)?.displayName || n).join(" + ")
    : primaryRegion.displayName || primaryRegion.name;

  return {
    motion: sqlType.name,
    motionDisplay: sqlType.displayName || sqlType.name,
    region: regionNames.join("+"),
    regionDisplay,
    quarterColumns,
    sqlProbabilities: sqlProbs,
    rows,
    totalOppsPerQuarter,
    conversionRate: overallConvRate,
    winRateNew: winNew,
    winRateUpsell: winUpsell,
    acvNew,
    acvUpsell,
  };
}
