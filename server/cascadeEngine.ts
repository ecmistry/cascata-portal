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
  revenue: number; // in cents
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
 * Calculate cascade forecast for a company
 */
export async function calculateCascade(input: CascadeInput): Promise<CascadeResult[]> {
  const { companyId, startYear, startQuarter, forecastYears } = input;

  // Fetch all necessary data - use db functions which support dev store
  const [
    regionsList,
    sqlTypesList,
    sqlHistoryData,
    conversionRatesData,
    dealEconomicsData,
    timeDistData,
  ] = await Promise.all([
    db.getRegionsByCompany(companyId).then(regions => regions.filter(r => r.enabled)),
    db.getSqlTypesByCompany(companyId).then(types => types.filter(t => t.enabled)),
    db.getSqlHistoryByCompany(companyId),
    db.getConversionRatesByCompany(companyId),
    db.getDealEconomicsByCompany(companyId),
    db.getTimeDistributionsByCompany(companyId),
  ]);

  // Build lookup maps
  const conversionMap = new Map<string, typeof conversionRatesData[0]>();
  conversionRatesData.forEach(cr => {
    const key = `${cr.regionId}-${cr.sqlTypeId}`;
    conversionMap.set(key, cr);
  });

  const dealEconomicsMap = new Map<number, typeof dealEconomicsData[0]>();
  dealEconomicsData.forEach(de => {
    dealEconomicsMap.set(de.regionId, de);
  });

  const timeDistMap = new Map<number, typeof timeDistData[0]>();
  timeDistData.forEach(td => {
    timeDistMap.set(td.sqlTypeId, td);
  });

  // Default time distribution if not specified (89/10/1%)
  const defaultTimeDist = {
    sameQuarterPct: CASCADE_CONSTANTS.DEFAULT_SAME_QUARTER_PCT,
    nextQuarterPct: CASCADE_CONSTANTS.DEFAULT_NEXT_QUARTER_PCT,
    twoQuarterPct: CASCADE_CONSTANTS.DEFAULT_TWO_QUARTER_PCT,
  };

  const results: CascadeResult[] = [];

  // Generate forecast for each region, SQL type, and quarter
  const totalQuarters = forecastYears * 4;

  for (let quarterOffset = 0; quarterOffset < totalQuarters; quarterOffset++) {
    const currentQuarter = getQuarterAhead(startYear, startQuarter, quarterOffset);

    for (const region of regionsList) {
      for (const sqlType of sqlTypesList) {
        // Get SQL volume for this quarter (from history or projection)
        const historyRecord = sqlHistoryData.find(
          h =>
            h.regionId === region.id &&
            h.sqlTypeId === sqlType.id &&
            h.year === currentQuarter.year &&
            h.quarter === currentQuarter.quarter
        );

        const sqlVolume = historyRecord?.volume || 0;

        // Get conversion rate
        const convKey = `${region.id}-${sqlType.id}`;
        const conversion = conversionMap.get(convKey);
        const coverageRatio = conversion?.oppCoverageRatio || CASCADE_CONSTANTS.DEFAULT_COVERAGE_RATIO_BP;

        // Get time distribution
        const timeDist = timeDistMap.get(sqlType.id) || defaultTimeDist;

        // Calculate opportunities created from SQLs in this quarter
        const baseOpportunities = (sqlVolume * coverageRatio) / 10000; // Convert basis points

        // Calculate opportunities that appear in THIS quarter
        // This includes:
        // 1. Opportunities from current quarter's SQLs (89%)
        // 2. Opportunities from previous quarter's SQLs (10%)
        // 3. Opportunities from two quarters ago SQLs (1%)
        let totalOpportunities = 0;

        // Opportunities from current quarter's SQLs
        const oppFromCurrentQuarter = (baseOpportunities * timeDist.sameQuarterPct) / 10000;
        totalOpportunities += oppFromCurrentQuarter;

        // Opportunities from previous quarter's SQLs (flowing into this quarter)
        if (quarterOffset > 0) {
          const prevQuarter = getQuarterAhead(startYear, startQuarter, quarterOffset - 1);
          const prevHistoryRecord = sqlHistoryData.find(
            h =>
              h.regionId === region.id &&
              h.sqlTypeId === sqlType.id &&
              h.year === prevQuarter.year &&
              h.quarter === prevQuarter.quarter
          );
          if (prevHistoryRecord) {
            const prevBaseOpps = (prevHistoryRecord.volume * coverageRatio) / 10000;
            const oppFromPrevQuarter = (prevBaseOpps * timeDist.nextQuarterPct) / 10000;
            totalOpportunities += oppFromPrevQuarter;
          }
        }

        // Opportunities from two quarters ago SQLs (flowing into this quarter)
        if (quarterOffset > 1) {
          const twoQuartersAgo = getQuarterAhead(startYear, startQuarter, quarterOffset - 2);
          const twoQuartersAgoRecord = sqlHistoryData.find(
            h =>
              h.regionId === region.id &&
              h.sqlTypeId === sqlType.id &&
              h.year === twoQuartersAgo.year &&
              h.quarter === twoQuartersAgo.quarter
          );
          if (twoQuartersAgoRecord) {
            const twoQuartersAgoBaseOpps = (twoQuartersAgoRecord.volume * coverageRatio) / 10000;
            const oppFromTwoQuartersAgo = (twoQuartersAgoBaseOpps * timeDist.twoQuarterPct) / 10000;
            totalOpportunities += oppFromTwoQuartersAgo;
          }
        }

        // Calculate revenue
        const dealEcon = dealEconomicsMap.get(region.id);
        const winRate = conversion?.winRateNew || CASCADE_CONSTANTS.DEFAULT_WIN_RATE_BP;
        const avgAcv = dealEcon?.acvNew || CASCADE_CONSTANTS.DEFAULT_ACV_CENTS;

        const closedWonOpps = (totalOpportunities * winRate) / 10000;
        const revenue = Math.round(closedWonOpps * avgAcv);

        results.push({
          region: region.name,
          sqlType: sqlType.name,
          year: currentQuarter.year,
          quarter: currentQuarter.quarter,
          sqlVolume,
          opportunities: Math.round(totalOpportunities),
          revenue,
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
      predictedRevenueNew: Math.round(result.revenue * CASCADE_CONSTANTS.NEW_BUSINESS_REVENUE_SPLIT),
      predictedRevenueUpsell: Math.round(result.revenue * CASCADE_CONSTANTS.UPSELL_REVENUE_SPLIT),
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
  startYear: number = CASCADE_CONSTANTS.DEFAULT_START_YEAR,
  startQuarter: number = CASCADE_CONSTANTS.DEFAULT_START_QUARTER,
  forecastYears: number = CASCADE_CONSTANTS.DEFAULT_FORECAST_YEARS
): Promise<number> {
  const input: CascadeInput = {
    companyId,
    startYear,
    startQuarter,
    forecastYears,
  };

  const results = await calculateCascade(input);
  await saveCascadeResults(companyId, results);

  return results.length;
}
