/**
 * What-If Analysis Scenario Calculator
 * 
 * Allows users to adjust key assumptions and see real-time impact on forecasts:
 * - Conversion rate adjustments (multipliers)
 * - Deal economics adjustments (ACV changes)
 * - Time distribution adjustments (probability shifts)
 */

import { getDb } from '../db';
import * as db from '../db';
import { 
  regions, 
  sqlTypes, 
  sqlHistory, 
  conversionRates, 
  dealEconomics,
  timeDistributions,
  forecasts 
} from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Scenario adjustment parameters
 */
export interface ScenarioAdjustments {
  // Conversion rate multipliers (e.g., 1.1 = +10%, 0.9 = -10%)
  conversionRateMultiplier?: number;
  
  // ACV adjustments by deal type (absolute changes in cents)
  acvAdjustments?: {
    newBusinessAcv?: number; // Change in cents
    upsellAcv?: number;      // Change in cents
  };
  
  // Time distribution adjustments (percentage point shifts in basis points)
  timeDistributionAdjustments?: {
    sameQuarter?: number;    // e.g., +500 means shift from 89% to 94% (500 basis points = 5%)
    nextQuarter?: number;    // e.g., -300 means shift from 10% to 7% (-300 basis points = -3%)
    twoQuarter?: number;     // e.g., -200 means shift from 1% to -1% (clamped to 0)
  };
}

/**
 * Calculate What-If scenario by applying adjustments to baseline assumptions
 */
export async function calculateWhatIfScenario(
  companyId: number,
  adjustments: ScenarioAdjustments
): Promise<{
  baseline: any[];
  adjusted: any[];
  impact: {
    totalRevenueChange: number;
    totalRevenueChangePercent: number;
    totalOpportunitiesChange: number;
    totalOpportunitiesChangePercent: number;
    quarterlyImpact: Array<{
      quarter: string;
      revenueChange: number;
      revenueChangePercent: number;
    }>;
  };
}> {
  // Get baseline forecasts (current assumptions) - use db function which supports dev store
  const baselineForecastsRaw = await db.getForecastsByCompany(companyId);
  
  // Group baseline forecasts by quarter and sum them (matching the adjusted forecast structure)
  const baselineByQuarter = new Map<string, { year: number; quarter: number; revenue: number; opportunities: number }>();
  
  for (const f of baselineForecastsRaw) {
    const key = `${f.year}-Q${f.quarter}`;
    const existing = baselineByQuarter.get(key);
    
    if (existing) {
      existing.revenue += (f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0);
      existing.opportunities += Math.round((f.predictedOpps || 0) / 100);
    } else {
      baselineByQuarter.set(key, {
        year: f.year,
        quarter: f.quarter,
        revenue: (f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0),
        opportunities: Math.round((f.predictedOpps || 0) / 100),
      });
    }
  }
  
  // Transform to array format matching adjusted forecasts
  const baselineForecasts = Array.from(baselineByQuarter.values()).map(b => ({
    quarter: `${b.year}-Q${b.quarter}`,
    year: b.year,
    quarterNum: b.quarter,
    revenue: b.revenue,
    opportunities: b.opportunities,
  }));

  // Apply adjustments to create adjusted scenario
  const adjustedForecasts = await calculateAdjustedForecasts(
    companyId,
    adjustments
  );

  // Calculate impact metrics
  const impact = calculateImpact(baselineForecasts, adjustedForecasts);

  return {
    baseline: baselineForecasts,
    adjusted: adjustedForecasts,
    impact,
  };
}

/**
 * Calculate forecasts with adjusted assumptions
 */
async function calculateAdjustedForecasts(
  companyId: number,
  adjustments: ScenarioAdjustments
): Promise<any[]> {
  // Fetch all necessary data - use db functions which support dev store
  const [
    companyRegions,
    companySqlTypes,
    sqlHistoryData,
    conversionRatesData,
    dealEconomicsData,
    timeDistributionsData,
  ] = await Promise.all([
    db.getRegionsByCompany(companyId),
    db.getSqlTypesByCompany(companyId),
    db.getSqlHistoryByCompany(companyId),
    db.getConversionRatesByCompany(companyId),
    db.getDealEconomicsByCompany(companyId),
    db.getTimeDistributionsByCompany(companyId),
  ]);

  // Apply adjustments to conversion rates
  const adjustedConversionRates = conversionRatesData.map(rate => ({
    ...rate,
    oppCoverageRatio: adjustments.conversionRateMultiplier
      ? Math.round(rate.oppCoverageRatio * adjustments.conversionRateMultiplier)
      : rate.oppCoverageRatio,
    winRateNew: adjustments.conversionRateMultiplier
      ? Math.round(rate.winRateNew * adjustments.conversionRateMultiplier)
      : rate.winRateNew,
    winRateUpsell: adjustments.conversionRateMultiplier
      ? Math.round(rate.winRateUpsell * adjustments.conversionRateMultiplier)
      : rate.winRateUpsell,
  }));

  // Apply adjustments to deal economics
  const adjustedDealEconomics = dealEconomicsData.map(deal => ({
    ...deal,
    acvNew: adjustments.acvAdjustments?.newBusinessAcv !== undefined
      ? deal.acvNew + adjustments.acvAdjustments.newBusinessAcv
      : deal.acvNew,
    acvUpsell: adjustments.acvAdjustments?.upsellAcv !== undefined
      ? deal.acvUpsell + adjustments.acvAdjustments.upsellAcv
      : deal.acvUpsell,
  }));

  // Apply adjustments to time distributions
  const adjustedTimeDistributions = timeDistributionsData.map(dist => {
    if (!adjustments.timeDistributionAdjustments) return dist;

    let sameQuarterPct = dist.sameQuarterPct;
    let nextQuarterPct = dist.nextQuarterPct;
    let twoQuarterPct = dist.twoQuarterPct;

    if (adjustments.timeDistributionAdjustments.sameQuarter !== undefined) {
      sameQuarterPct += adjustments.timeDistributionAdjustments.sameQuarter;
    }
    if (adjustments.timeDistributionAdjustments.nextQuarter !== undefined) {
      nextQuarterPct += adjustments.timeDistributionAdjustments.nextQuarter;
    }
    if (adjustments.timeDistributionAdjustments.twoQuarter !== undefined) {
      twoQuarterPct += adjustments.timeDistributionAdjustments.twoQuarter;
    }

    // Ensure they sum to 10000 (100%) and are non-negative
    const total = sameQuarterPct + nextQuarterPct + twoQuarterPct;
    if (total !== 10000) {
      // Normalize to maintain 100%
      const scale = 10000 / total;
      sameQuarterPct = Math.round(sameQuarterPct * scale);
      nextQuarterPct = Math.round(nextQuarterPct * scale);
      twoQuarterPct = Math.round(twoQuarterPct * scale);
    }

    // Clamp to valid ranges
    sameQuarterPct = Math.max(0, Math.min(10000, sameQuarterPct));
    nextQuarterPct = Math.max(0, Math.min(10000, nextQuarterPct));
    twoQuarterPct = Math.max(0, Math.min(10000, twoQuarterPct));

    return {
      ...dist,
      sameQuarterPct,
      nextQuarterPct,
      twoQuarterPct,
    };
  });

  // Calculate forecasts using adjusted assumptions
  return calculateCascadeForecastsWithCustomParams(
    companyId,
    sqlHistoryData,
    adjustedConversionRates,
    adjustedDealEconomics,
    adjustedTimeDistributions
  );
}

/**
 * Calculate cascade forecasts with custom parameters (for What-If scenarios)
 */
async function calculateCascadeForecastsWithCustomParams(
  companyId: number,
  sqlHistoryData: any[],
  conversionRatesData: any[],
  dealEconomicsData: any[],
  timeDistributionsData: any[]
): Promise<any[]> {
  const forecastResults: any[] = [];

  // Group SQL history by quarter
  const sqlByQuarter = new Map<string, any[]>();
  for (const sql of sqlHistoryData) {
    const key = `${sql.year}-Q${sql.quarter}`;
    if (!sqlByQuarter.has(key)) {
      sqlByQuarter.set(key, []);
    }
    sqlByQuarter.get(key)!.push(sql);
  }

  // Get unique quarters and sort them
  const quarters = Array.from(sqlByQuarter.keys()).sort();
  if (quarters.length === 0) return [];

  // Generate forecasts for next 16 quarters (4 years)
  const lastQuarter = quarters[quarters.length - 1];
  const [lastYear, lastQ] = lastQuarter.split('-Q').map(Number);
  
  for (let i = 1; i <= 16; i++) {
    const forecastYear = lastYear + Math.floor((lastQ - 1 + i) / 4);
    const forecastQ = ((lastQ - 1 + i) % 4) + 1;
    const forecastQuarter = `${forecastYear}-Q${forecastQ}`;

    // Calculate opportunities from SQLs in previous quarters
    let totalOpportunities = 0;
    let totalRevenue = 0;

    // Look back at SQL history to calculate opportunities
    const quarterEntries = Array.from(sqlByQuarter.entries());
    for (const [sqlQuarter, sqls] of quarterEntries) {
      const [sqlYear, sqlQ] = sqlQuarter.split('-Q').map(Number);
      const quarterDiff = (forecastYear - sqlYear) * 4 + (forecastQ - sqlQ);

      // Apply time distribution
      for (const sql of sqls) {
        const convRate = conversionRatesData.find(
          cr => cr.regionId === sql.regionId && cr.sqlTypeId === sql.sqlTypeId
        );
        const timeDist = timeDistributionsData.find(
          td => td.sqlTypeId === sql.sqlTypeId
        );

        if (!convRate || !timeDist) continue;

        let probability = 0;
        if (quarterDiff === 0) probability = timeDist.sameQuarterPct / 10000;
        else if (quarterDiff === 1) probability = timeDist.nextQuarterPct / 10000;
        else if (quarterDiff === 2) probability = timeDist.twoQuarterPct / 10000;

        if (probability > 0) {
          const opportunities = sql.volume * (convRate.oppCoverageRatio / 10000) * probability;
          totalOpportunities += opportunities;

          // Calculate revenue from these opportunities
          const dealEcon = dealEconomicsData.find(de => de.regionId === sql.regionId);
          if (dealEcon) {
            const avgWinRate = (convRate.winRateNew + convRate.winRateUpsell) / 2 / 10000;
            const avgAcv = (dealEcon.acvNew + dealEcon.acvUpsell) / 2;
            const revenue = opportunities * avgWinRate * avgAcv;
            totalRevenue += revenue;
          }
        }
      }
    }

    forecastResults.push({
      quarter: forecastQuarter,
      year: forecastYear,
      quarterNum: forecastQ,
      opportunities: Math.round(totalOpportunities),
      revenue: Math.round(totalRevenue),
    });
  }

  return forecastResults;
}

/**
 * Calculate impact metrics comparing baseline to adjusted scenario
 */
function calculateImpact(baseline: any[], adjusted: any[]): any {
  let baselineTotalRevenue = 0;
  let adjustedTotalRevenue = 0;
  let baselineTotalOpportunities = 0;
  let adjustedTotalOpportunities = 0;

  const quarterlyImpact: Array<{
    quarter: string;
    revenueChange: number;
    revenueChangePercent: number;
  }> = [];

  // Create a map for easier lookup
  const baselineMap = new Map<string, any>();
  for (const b of baseline) {
    // Use the quarter string directly if available, otherwise construct it
    const key = b.quarter || `${b.year}-Q${b.quarterNum || b.quarter}`;
    baselineMap.set(key, b);
  }

  for (const adj of adjusted) {
    const key = adj.quarter;
    const base = baselineMap.get(key);

    if (base) {
      baselineTotalRevenue += base.revenue || 0;
      baselineTotalOpportunities += base.opportunities || 0;
    }

    adjustedTotalRevenue += adj.revenue || 0;
    adjustedTotalOpportunities += adj.opportunities || 0;

    const baseRevenue = base?.revenue || 0;
    const revenueChange = (adj.revenue || 0) - baseRevenue;
    const revenueChangePercent = baseRevenue > 0
      ? (revenueChange / baseRevenue) * 100
      : 0;

    quarterlyImpact.push({
      quarter: key,
      revenueChange,
      revenueChangePercent,
    });
  }

  const totalRevenueChange = adjustedTotalRevenue - baselineTotalRevenue;
  const totalRevenueChangePercent = baselineTotalRevenue > 0
    ? (totalRevenueChange / baselineTotalRevenue) * 100
    : 0;

  const totalOpportunitiesChange = adjustedTotalOpportunities - baselineTotalOpportunities;
  const totalOpportunitiesChangePercent = baselineTotalOpportunities > 0
    ? (totalOpportunitiesChange / baselineTotalOpportunities) * 100
    : 0;

  return {
    totalRevenueChange,
    totalRevenueChangePercent,
    totalOpportunitiesChange,
    totalOpportunitiesChangePercent,
    quarterlyImpact,
  };
}
