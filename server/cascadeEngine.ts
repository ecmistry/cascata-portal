/**
 * Cascade Model Calculation Engine
 * 
 * This module implements the core cascade logic:
 * 1. SQL → Opportunity conversion with time-based probability distribution
 * 2. Opportunity → Revenue conversion with win rates and ACVs
 */

import * as db from "./db";
import { 
  forecasts,
} from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { CASCADE_CONSTANTS, ERROR_MESSAGES } from '@shared/const';

export interface QuarterKey {
  year: number;
  quarter: number;
}

export interface CascadeInput {
  companyId: number;
  startYear: number;
  startQuarter: number;
  forecastYears: number; // Number of years to forecast
}

export interface CascadeResult {
  region: string;
  sqlType: string;
  year: number;
  quarter: number;
  sqlVolume: number;
  opportunities: number;
  revenue: number; // in cents (total = new + upsell)
  revenueNew: number; // in cents
  revenueUpsell: number; // in cents (attach_rate x customer_count x avg_upsell_ACV)
}

/**
 * Get next quarter
 */
function getNextQuarter(year: number, quarter: number): QuarterKey {
  if (quarter === 4) {
    return { year: year + 1, quarter: 1 };
  }
  return { year, quarter: quarter + 1 };
}

/**
 * Get quarter N periods ahead
 */
function getQuarterAhead(year: number, quarter: number, periods: number): QuarterKey {
  let result = { year, quarter };
  for (let i = 0; i < periods; i++) {
    result = getNextQuarter(result.year, result.quarter);
  }
  return result;
}

/**
 * Compute one-time average of a metric over the last N completed quarters.
 * This is NOT a rolling average -- computed once at forecast time and applied
 * to all future quarters uniformly.
 */
function computeSixQuarterAverage(
  quarterlyValues: Map<string, number>,
  currentYear: number,
  currentQuarter: number,
  windowSize: number = 6
): number | null {
  const completed: { key: string; val: number }[] = [];
  for (const [key, val] of quarterlyValues) {
    const [yStr, qStr] = key.split("-");
    const y = Number(yStr);
    const q = Number(qStr);
    if (y < currentYear || (y === currentYear && q <= currentQuarter)) {
      completed.push({ key, val });
    }
  }

  completed.sort((a, b) => a.key.localeCompare(b.key));
  const window = completed.slice(-windowSize);

  if (window.length === 0) return null;

  return window.reduce((sum, item) => sum + item.val, 0) / window.length;
}

function isHistorical(y: number, q: number, curY: number, curQ: number): boolean {
  return y < curY || (y === curY && q <= curQ);
}

/**
 * Calculate cascade forecast for a company
 */
export async function calculateCascade(input: CascadeInput): Promise<CascadeResult[]> {
  const { companyId, startYear, startQuarter, forecastYears } = input;

  const [
    regionsList,
    sqlTypesList,
    sqlHistoryData,
    conversionRatesData,
    dealEconomicsData,
    timeDistData,
    actualsData,
    quarterlyMetricsData,
    company,
  ] = await Promise.all([
    db.getRegionsByCompany(companyId).then(regions => regions.filter(r => r.enabled)),
    db.getSqlTypesByCompany(companyId).then(types => types.filter(t => t.enabled)),
    db.getSqlHistoryByCompany(companyId),
    db.getConversionRatesByCompany(companyId),
    db.getDealEconomicsByCompany(companyId),
    db.getTimeDistributionsByCompany(companyId),
    db.getActualsByCompany(companyId),
    db.getQuarterlyMetricsByCompany(companyId),
    db.getCompanyById(companyId),
  ]);

  const syncConfig = company ? db.parseSyncConfig(company) : null;
  const windowSize = syncConfig?.rollingWindowQuarters ?? 6;

  // Current quarter boundary: historical vs forecast
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  const conversionMap = new Map<string, typeof conversionRatesData[0]>();
  conversionRatesData.forEach(cr => {
    conversionMap.set(`${cr.regionId}-${cr.sqlTypeId}`, cr);
  });

  const dealEconomicsMap = new Map<number, typeof dealEconomicsData[0]>();
  dealEconomicsData.forEach(de => {
    dealEconomicsMap.set(de.regionId, de);
  });

  const timeDistMap = new Map<number, typeof timeDistData[0]>();
  timeDistData.forEach(td => {
    timeDistMap.set(td.sqlTypeId, td);
  });

  // Build per-quarter actuals lookup
  const quarterActualsMap = new Map<string, { sqls: number; opps: number; wins: number }>();
  for (const a of actualsData) {
    const key = `${a.regionId}-${a.sqlTypeId}-${a.year}-${a.quarter}`;
    const existing = quarterActualsMap.get(key) || { sqls: 0, opps: 0, wins: 0 };
    existing.sqls += a.actualSqls ?? 0;
    existing.opps += a.actualOpps ?? 0;
    existing.wins += a.actualWins ?? 0;
    quarterActualsMap.set(key, existing);
  }

  // Build per-quarter metrics lookup (pipeline cover ratio, ACV)
  const qmMap = new Map<string, typeof quarterlyMetricsData[0]>();
  for (const qm of quarterlyMetricsData) {
    qmMap.set(`${qm.regionId}-${qm.sqlTypeId}-${qm.year}-${qm.quarter}`, qm);
  }

  // Configurable defaults from sync config
  const defaultSameQ = syncConfig?.defaultSqlTimingSameQ ?? CASCADE_CONSTANTS.DEFAULT_SAME_QUARTER_PCT;
  const defaultNextQ = syncConfig?.defaultSqlTimingNextQ ?? CASCADE_CONSTANTS.DEFAULT_NEXT_QUARTER_PCT;
  const defaultTwoQ = syncConfig?.defaultSqlTimingTwoQ ?? CASCADE_CONSTANTS.DEFAULT_TWO_QUARTER_PCT;
  const defaultConvRate = syncConfig?.defaultConversionRate ?? CASCADE_CONSTANTS.DEFAULT_COVERAGE_RATIO_BP;

  const results: CascadeResult[] = [];
  const totalQuarters = forecastYears * 4;

  for (const region of regionsList) {
    for (const sqlType of sqlTypesList) {
      const convKey = `${region.id}-${sqlType.id}`;
      const conversion = conversionMap.get(convKey);

      // Build per-quarter conversion rate map for 6Q average
      const perQConvRates = new Map<string, number>();
      for (const a of actualsData) {
        if (a.regionId === region.id && a.sqlTypeId === sqlType.id && (a.actualSqls ?? 0) > 0) {
          const rate = Math.min(Math.round(((a.actualOpps ?? 0) / a.actualSqls) * 10000), 10000);
          perQConvRates.set(`${a.year}-${a.quarter}`, rate);
        }
      }

      // Build per-quarter win rate map for 6Q average
      const perQWinRates = new Map<string, number>();
      for (const a of actualsData) {
        if (a.regionId === region.id && a.sqlTypeId === sqlType.id && (a.actualOpps ?? 0) > 0) {
          const rate = Math.min(Math.round(((a.actualWins ?? 0) / a.actualOpps) * 10000), 10000);
          perQWinRates.set(`${a.year}-${a.quarter}`, rate);
        }
      }

      // Build per-quarter ACV map for 6Q average
      const perQAcvNew = new Map<string, number>();
      const perQAcvUpsell = new Map<string, number>();
      const perQAttachRate = new Map<string, number>();
      const perQCustomerCount = new Map<string, number>();
      for (const qm of quarterlyMetricsData) {
        if (qm.regionId === region.id && qm.sqlTypeId === sqlType.id) {
          if (qm.avgAcvNew > 0) perQAcvNew.set(`${qm.year}-${qm.quarter}`, qm.avgAcvNew);
          if (qm.avgAcvUpsell > 0) perQAcvUpsell.set(`${qm.year}-${qm.quarter}`, qm.avgAcvUpsell);
          if (qm.upsellAttachRate > 0) perQAttachRate.set(`${qm.year}-${qm.quarter}`, qm.upsellAttachRate);
          if (qm.customerCount > 0) perQCustomerCount.set(`${qm.year}-${qm.quarter}`, qm.customerCount);
        }
      }

      // Compute 6Q one-time averages (fixed for all future quarters)
      const sixQConvRate = computeSixQuarterAverage(perQConvRates, currentYear, currentQuarter, windowSize);
      const sixQWinRate = computeSixQuarterAverage(perQWinRates, currentYear, currentQuarter, windowSize);
      const sixQAcvNew = computeSixQuarterAverage(perQAcvNew, currentYear, currentQuarter, windowSize);
      const sixQAcvUpsell = computeSixQuarterAverage(perQAcvUpsell, currentYear, currentQuarter, windowSize);
      const sixQAttachRate = computeSixQuarterAverage(perQAttachRate, currentYear, currentQuarter, windowSize);

      // Customer count is a stock/snapshot, not a flow — use latest known value, not average
      let latestCustomerCount = 0;
      for (const [, count] of perQCustomerCount) {
        if (count > latestCustomerCount) latestCustomerCount = count;
      }

      // Overall fallback conversion rate (all-time average)
      let totalActualSqls = 0;
      let totalActualOpps = 0;
      for (const a of actualsData) {
        if (a.regionId === region.id && a.sqlTypeId === sqlType.id) {
          totalActualSqls += a.actualSqls ?? 0;
          totalActualOpps += a.actualOpps ?? 0;
        }
      }
      const overallConvRate = totalActualSqls > 0
        ? Math.min(Math.round((totalActualOpps / totalActualSqls) * 10000), 10000)
        : (conversion?.oppCoverageRatio || defaultConvRate);

      const timeDist = timeDistMap.get(sqlType.id);
      const sameQ = timeDist?.sameQuarterPct ?? defaultSameQ;
      const nextQ = timeDist?.nextQuarterPct ?? defaultNextQ;
      const twoQ = timeDist?.twoQuarterPct ?? defaultTwoQ;

      // Opp win timing
      let oppProbs: number[] = syncConfig?.defaultOppTiming ?? [0.14, 0.33, 0.25, 0.15, 0.07, 0.04, 0.02];
      if (timeDist?.oppTimingJson) {
        try {
          const parsed = JSON.parse(timeDist.oppTimingJson);
          if (Array.isArray(parsed) && parsed.length >= 2) oppProbs = parsed;
        } catch { /* use default */ }
      }

      // Default win rates from conversion table
      const defaultWinRateNew = (conversion?.winRateNew ?? CASCADE_CONSTANTS.DEFAULT_WIN_RATE_BP) / 10000;
      const defaultWinRateUpsell = (conversion?.winRateUpsell ?? 0) / 10000;
      const defaultCombinedWinRate = defaultWinRateNew + defaultWinRateUpsell;

      const dealEcon = dealEconomicsMap.get(region.id);
      const defaultAcvNew = dealEcon?.acvNew || CASCADE_CONSTANTS.DEFAULT_ACV_CENTS;
      const defaultAcvUpsell = dealEcon?.acvUpsell || CASCADE_CONSTANTS.DEFAULT_ACV_CENTS;

      // Pre-calculate base opps per quarter (SQL volume × conversion rate)
      const baseOpps: number[] = [];
      for (let qo = 0; qo < totalQuarters; qo++) {
        const q = getQuarterAhead(startYear, startQuarter, qo);
        const historyRecord = sqlHistoryData.find(
          h => h.regionId === region.id && h.sqlTypeId === sqlType.id &&
               h.year === q.year && h.quarter === q.quarter
        );
        const sqlVolume = historyRecord?.volume || 0;

        let convRate: number;
        if (isHistorical(q.year, q.quarter, currentYear, currentQuarter)) {
          // Historical: use actual per-quarter conversion
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

      // Apply SQL timing distribution: spread opps across quarters
      const totalOppsPerQ = new Array(totalQuarters).fill(0);
      for (let qo = 0; qo < totalQuarters; qo++) {
        const bo = baseOpps[qo];
        if (bo === 0) continue;
        if (qo < totalQuarters) totalOppsPerQ[qo] += bo * sameQ / 10000;
        if (qo + 1 < totalQuarters) totalOppsPerQ[qo + 1] += bo * nextQ / 10000;
        if (qo + 2 < totalQuarters) totalOppsPerQ[qo + 2] += bo * twoQ / 10000;
      }

      // Apply opp win timing: spread expected wins across quarters
      const totalWinsPerQ = new Array(totalQuarters).fill(0);
      for (let qo = 0; qo < totalQuarters; qo++) {
        const q = getQuarterAhead(startYear, startQuarter, qo);
        let combinedWinRate: number;
        if (isHistorical(q.year, q.quarter, currentYear, currentQuarter)) {
          const qWinRate = perQWinRates.get(`${q.year}-${q.quarter}`);
          combinedWinRate = qWinRate !== undefined ? qWinRate / 10000 : defaultCombinedWinRate;
        } else {
          combinedWinRate = sixQWinRate !== null ? sixQWinRate / 10000 : defaultCombinedWinRate;
        }
        const expectedWins = totalOppsPerQ[qo] * (combinedWinRate > 0 ? combinedWinRate : 1);
        for (let p = 0; p < oppProbs.length; p++) {
          if (qo + p < totalQuarters) {
            totalWinsPerQ[qo + p] += expectedWins * oppProbs[p];
          }
        }
      }

      // Build results with revenue (use 6Q ACV average for future, actual for historical)
      for (let qo = 0; qo < totalQuarters; qo++) {
        const q = getQuarterAhead(startYear, startQuarter, qo);
        const historyRecord = sqlHistoryData.find(
          h => h.regionId === region.id && h.sqlTypeId === sqlType.id &&
               h.year === q.year && h.quarter === q.quarter
        );

        const qmKey = `${region.id}-${sqlType.id}-${q.year}-${q.quarter}`;
        const qm = qmMap.get(qmKey);

        let acvNew: number, acvUpsell: number;
        let attachRate: number, customerCount: number;
        if (isHistorical(q.year, q.quarter, currentYear, currentQuarter)) {
          acvNew = (qm && qm.avgAcvNew > 0) ? qm.avgAcvNew : defaultAcvNew;
          acvUpsell = (qm && qm.avgAcvUpsell > 0) ? qm.avgAcvUpsell : defaultAcvUpsell;
          attachRate = (qm?.upsellAttachRate ?? 0) / 10000;
          customerCount = qm?.customerCount ?? 0;
        } else {
          acvNew = sixQAcvNew ?? defaultAcvNew;
          acvUpsell = sixQAcvUpsell ?? defaultAcvUpsell;
          attachRate = sixQAttachRate !== null ? sixQAttachRate / 10000 : 0;
          customerCount = latestCustomerCount;
        }

        // New business revenue: pipeline-driven (SQL → Opp → Win cascade)
        const wins = totalWinsPerQ[qo];
        const combinedWR = defaultCombinedWinRate;
        const revenueNew = combinedWR > 0
          ? Math.round(wins * (defaultWinRateNew / combinedWR) * acvNew)
          : 0;

        // Upsell revenue: attach_rate x customer_count x avg_upsell_ACV
        const revenueUpsell = Math.round(attachRate * customerCount * acvUpsell);

        results.push({
          region: region.name,
          sqlType: sqlType.name,
          year: q.year,
          quarter: q.quarter,
          sqlVolume: historyRecord?.volume || 0,
          opportunities: Math.round(totalOppsPerQ[qo]),
          revenue: revenueNew + revenueUpsell,
          revenueNew,
          revenueUpsell,
        });
      }
    }
  }

  return results;
}

/**
 * Save cascade results to database using batch insert for performance
 * @param companyId - Company ID
 * @param results - Cascade calculation results
 * @throws Error if invalid region or SQL type
 */
export async function saveCascadeResults(companyId: number, results: CascadeResult[]): Promise<void> {
  // Get region and SQL type IDs - use db functions which support dev store
  const [regionsList, sqlTypesList] = await Promise.all([
    db.getRegionsByCompany(companyId),
    db.getSqlTypesByCompany(companyId),
  ]);

  const regionMap = new Map(regionsList.map(r => [r.name, r.id]));
  const sqlTypeMap = new Map(sqlTypesList.map(st => [st.name, st.id]));

  // Delete existing forecasts for this company
  await db.deleteForecastsByCompany(companyId);

  // Prepare batch insert
  const forecastsToInsert: Array<{
    companyId: number;
    regionId: number;
    sqlTypeId: number;
    year: number;
    quarter: number;
    predictedSqls: number;
    predictedOpps: number;
    predictedRevenueNew: number;
    predictedRevenueUpsell: number;
  }> = [];

  // Build insert array
  for (const result of results) {
    const regionId = regionMap.get(result.region);
    const sqlTypeId = sqlTypeMap.get(result.sqlType);

    if (!regionId || !sqlTypeId) {
      throw new Error(`${ERROR_MESSAGES.INVALID_REGION_OR_SQL_TYPE}: ${result.region}, ${result.sqlType}`);
    }

    forecastsToInsert.push({
      companyId,
      regionId,
      sqlTypeId,
      year: result.year,
      quarter: result.quarter,
      predictedSqls: result.sqlVolume,
      predictedOpps: Math.round(result.opportunities * CASCADE_CONSTANTS.OPPORTUNITY_PRECISION_MULTIPLIER),
      predictedRevenueNew: result.revenueNew,
      predictedRevenueUpsell: result.revenueUpsell,
    });
  }

  // Batch insert all forecasts
  if (forecastsToInsert.length > 0) {
    const database = await db.getDb();
    if (database) {
      // Use batch insert with onDuplicateKeyUpdate
      // Note: MySQL's onDuplicateKeyUpdate requires VALUES() function
      await database.insert(forecasts).values(forecastsToInsert).onDuplicateKeyUpdate({
        set: {
          predictedSqls: sql`VALUES(predictedSqls)`,
          predictedOpps: sql`VALUES(predictedOpps)`,
          predictedRevenueNew: sql`VALUES(predictedRevenueNew)`,
          predictedRevenueUpsell: sql`VALUES(predictedRevenueUpsell)`,
          updatedAt: sql`NOW()`,
        },
      });
    } else {
      // Fallback to individual inserts for dev store
      for (const forecast of forecastsToInsert) {
        await db.upsertForecast(forecast);
      }
    }
  }
}

/**
 * Calculate and save cascade forecast
 * @param companyId - Company ID
 * @param startYear - Optional start year (defaults to CASCADE_CONSTANTS.DEFAULT_START_YEAR)
 * @param startQuarter - Optional start quarter (defaults to CASCADE_CONSTANTS.DEFAULT_START_QUARTER)
 * @param forecastYears - Optional number of years to forecast (defaults to CASCADE_CONSTANTS.DEFAULT_FORECAST_YEARS)
 * @returns Number of forecast records created
 */
export async function runCascadeForecast(
  companyId: number,
  startYear?: number,
  startQuarter?: number,
  forecastYears: number = CASCADE_CONSTANTS.DEFAULT_FORECAST_YEARS
): Promise<number> {
  // Data-driven quarter range: start from earliest SQL history if not specified
  let resolvedStartYear = startYear ?? CASCADE_CONSTANTS.DEFAULT_START_YEAR;
  let resolvedStartQuarter = startQuarter ?? CASCADE_CONSTANTS.DEFAULT_START_QUARTER;

  if (!startYear || !startQuarter) {
    const history = await db.getSqlHistoryByCompany(companyId);
    if (history.length > 0) {
      const earliest = history.reduce((min, h) => {
        const hVal = h.year * 4 + h.quarter;
        const mVal = min.year * 4 + min.quarter;
        return hVal < mVal ? { year: h.year, quarter: h.quarter } : min;
      }, { year: history[0].year, quarter: history[0].quarter });
      resolvedStartYear = earliest.year;
      resolvedStartQuarter = earliest.quarter;
    }
  }

  // Ensure forecast covers at least 2 years into the future from now
  const currentYear = new Date().getFullYear();
  const minEndYear = currentYear + 2;
  const yearsNeeded = minEndYear - resolvedStartYear + 1;
  const resolvedForecastYears = Math.max(forecastYears, yearsNeeded);

  const input: CascadeInput = {
    companyId,
    startYear: resolvedStartYear,
    startQuarter: resolvedStartQuarter,
    forecastYears: resolvedForecastYears,
  };

  const results = await calculateCascade(input);
  await saveCascadeResults(companyId, results);

  return results.length;
}
