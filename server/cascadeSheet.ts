/**
 * Cascade Sheet Calculator
 *
 * Builds a two-panel cascade model mirroring the Excel spreadsheet:
 *
 * LEFT PANEL (SQL Cascade):
 *   SQL timing probabilities (diagonal matrix) + SQL counts × conversion rate
 *   → cascaded opportunity values per quarter
 *
 * RIGHT PANEL (Opportunity Cascade):
 *   Opp win timing probabilities (diagonal matrix) + Total Opps from SQL cascade
 *   → cascaded won deals per quarter
 *
 * Data sources (all from HubSpot via ELT sync):
 *   - sql_history:        SQL volumes per quarter/type/region
 *   - actuals:            actual opps per quarter (for per-quarter conversion rates)
 *   - conversion_rates:   aggregate win rates
 *   - time_distributions: probability matrices for SQL→Opp and Opp→Deal timing
 *   - deal_economics:     ACV data
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
  conversionRate: number;
  cascadeValues: number[];
  totalOpps: number;
  actualSqls: number | null;
  actualOpps: number | null;
  isHistorical: boolean;
}

interface OppCascadeRow {
  quarter: QuarterLabel;
  opps: number;
  cascadeValues: number[];
  totalWon: number;
  actualWins: number | null;
  isHistorical: boolean;
}

export interface CascadeSheetData {
  motion: string;
  motionDisplay: string;
  region: string;
  regionDisplay: string;
  quarterColumns: QuarterLabel[];

  // SQL Cascade (left panel)
  sqlProbabilities: number[];
  rows: CascadeRow[];
  totalOppsPerQuarter: number[];

  // Opportunity Cascade (right panel)
  oppProbabilities: number[];
  oppRows: OppCascadeRow[];
  totalWonPerQuarter: number[];

  // Summary metrics
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

const DEFAULT_OPP_TIMING = [0.14, 0.33, 0.25, 0.15, 0.07, 0.04, 0.02];

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

  // Load configurable defaults from sync config
  const company = await db.getCompanyById(companyId);
  const syncConfig = company ? db.parseSyncConfig(company) : null;

  const sqlType = sqlTypes.find(t => t.name === sqlTypeName);
  if (!sqlType) throw new Error(`SQL type "${sqlTypeName}" not found`);

  const matchingRegions = regions.filter(r => regionNames.includes(r.name));
  if (matchingRegions.length === 0) throw new Error(`No regions found for ${regionNames.join(", ")}`);

  const regionIds = new Set(matchingRegions.map(r => r.id));
  const primaryRegion = matchingRegions[0];

  // ── SQL timing probabilities ───────────────────────────────────────
  const timeDist = allTimeDist.find(td => td.sqlTypeId === sqlType.id);
  const defaultSqlProbs = [
    (syncConfig?.defaultSqlTimingSameQ ?? 8900) / 10000,
    (syncConfig?.defaultSqlTimingNextQ ?? 1000) / 10000,
    (syncConfig?.defaultSqlTimingTwoQ ?? 100) / 10000,
  ];
  const sqlProbs = timeDist
    ? [timeDist.sameQuarterPct / 10000, timeDist.nextQuarterPct / 10000, timeDist.twoQuarterPct / 10000]
    : defaultSqlProbs;

  // ── Opp win timing probabilities ──────────────────────────────────
  const defaultOppProbs = syncConfig?.defaultOppTiming ?? DEFAULT_OPP_TIMING;
  let oppProbs = defaultOppProbs;
  if (timeDist?.oppTimingJson) {
    try {
      const parsed = JSON.parse(timeDist.oppTimingJson);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        oppProbs = parsed;
      }
    } catch { /* use default */ }
  }

  // ── Per-quarter conversion rates from actuals ─────────────────────
  const relevantActuals = allActuals.filter(
    a => a.sqlTypeId === sqlType.id && regionIds.has(a.regionId)
  );

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

  const defaultConvRate = (syncConfig?.defaultConversionRate ?? 5000) / 10000;
  const overallConvRate = totalActualSqls > 0
    ? Math.min(totalActualOpps / totalActualSqls, 1.0)
    : defaultConvRate;

  // ── Win rates ─────────────────────────────────────────────────────
  const matchingConvRates = allConvRates.filter(
    cr => cr.sqlTypeId === sqlType.id && regionIds.has(cr.regionId)
  );
  let winNew = 0;
  let winUpsell = 0;
  if (matchingConvRates.length > 0) {
    winNew = matchingConvRates.reduce((s, cr) => s + (cr.winRateNew ?? 0), 0) / matchingConvRates.length / 10000;
    winUpsell = matchingConvRates.reduce((s, cr) => s + (cr.winRateUpsell ?? 0), 0) / matchingConvRates.length / 10000;
  }

  // ── Deal economics (ACV) ──────────────────────────────────────────
  const matchingDealEcon = allDealEcon.filter(de => regionIds.has(de.regionId));
  const acvNew = matchingDealEcon.length > 0
    ? matchingDealEcon.reduce((s, de) => s + ((de.acvNew ?? 0) / 100), 0) / matchingDealEcon.length
    : 0;
  const acvUpsell = matchingDealEcon.length > 0
    ? matchingDealEcon.reduce((s, de) => s + ((de.acvUpsell ?? 0) / 100), 0) / matchingDealEcon.length
    : 0;

  // ── SQL volumes per quarter ───────────────────────────────────────
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

  // ── Current quarter boundary (historical vs forecast) ──────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  // Build per-quarter actuals lookup including wins
  const quarterActualsWithWins = new Map<string, { sqls: number; opps: number; wins: number }>();
  for (const a of relevantActuals) {
    const key = qKey(a.year, a.quarter);
    const prev = quarterActualsWithWins.get(key) || { sqls: 0, opps: 0, wins: 0 };
    prev.sqls += a.actualSqls ?? 0;
    prev.opps += a.actualOpps ?? 0;
    prev.wins += a.actualWins ?? 0;
    quarterActualsWithWins.set(key, prev);
  }

  // ── Build SQL cascade rows ────────────────────────────────────────
  const rows: CascadeRow[] = [];

  for (const qCol of quarterColumns) {
    const key = qKey(qCol.year, qCol.quarter);
    const sqls = volumeMap.get(key) || 0;
    const isHist = qCol.year < currentYear || (qCol.year === currentYear && qCol.quarter < currentQuarter);

    const actualData = quarterActuals.get(key);
    let conv: number;
    if (actualData && actualData.sqls > 0) {
      conv = Math.min(actualData.opps / actualData.sqls, 1.0);
    } else {
      conv = overallConvRate;
    }

    const convertedOpps = sqls * conv;

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
    const qActual = quarterActualsWithWins.get(key);

    rows.push({
      quarter: qCol,
      sqls,
      conversionRate: conv,
      cascadeValues,
      totalOpps,
      actualSqls: isHist ? (qActual?.sqls ?? null) : null,
      actualOpps: isHist ? (qActual?.opps ?? null) : null,
      isHistorical: isHist,
    });
  }

  // Total opps per quarter column (sum down each column)
  const totalOppsPerQuarter = new Array(quarterColumns.length).fill(0);
  for (const row of rows) {
    for (let c = 0; c < quarterColumns.length; c++) {
      totalOppsPerQuarter[c] += row.cascadeValues[c];
    }
  }

  // ── Build Opportunity cascade rows ────────────────────────────────
  // Apply combined win rate: opps are now true opportunities (from contacts),
  // so we multiply by win rate before distributing with opp timing.
  const combinedWinRate = winNew + winUpsell;
  const oppRows: OppCascadeRow[] = [];

  for (let i = 0; i < quarterColumns.length; i++) {
    const qCol = quarterColumns[i];
    const opps = totalOppsPerQuarter[i];
    const expectedWins = opps * (combinedWinRate > 0 ? combinedWinRate : 1);
    const isHist = qCol.year < currentYear || (qCol.year === currentYear && qCol.quarter < currentQuarter);

    const cascadeValues = new Array(quarterColumns.length).fill(0);

    for (let p = 0; p < oppProbs.length; p++) {
      const targetIdx = i + p;
      if (targetIdx < quarterColumns.length) {
        cascadeValues[targetIdx] = expectedWins * oppProbs[p];
      }
    }

    const totalWon = cascadeValues.reduce((s, v) => s + v, 0);
    const qActual = quarterActualsWithWins.get(qKey(qCol.year, qCol.quarter));

    oppRows.push({
      quarter: qCol,
      opps,
      cascadeValues,
      totalWon,
      actualWins: isHist ? (qActual?.wins ?? null) : null,
      isHistorical: isHist,
    });
  }

  // Total won per quarter column
  const totalWonPerQuarter = new Array(quarterColumns.length).fill(0);
  for (const row of oppRows) {
    for (let c = 0; c < quarterColumns.length; c++) {
      totalWonPerQuarter[c] += row.cascadeValues[c];
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
    oppProbabilities: oppProbs,
    oppRows,
    totalWonPerQuarter,
    conversionRate: overallConvRate,
    winRateNew: winNew,
    winRateUpsell: winUpsell,
    acvNew,
    acvUpsell,
  };
}
