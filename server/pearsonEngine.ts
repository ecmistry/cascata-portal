import * as db from "./db";
import { CASCADE_CONSTANTS } from "@shared/const";

export interface RScoreResult {
  metricType: "ocr" | "owr" | "overall";
  regionId: number | null;
  regionName: string | null;
  rScore: number;
  sampleSize: number;
}

export interface RScoreResponse {
  perRegion: RScoreResult[];
  global: {
    ocr: number;
    owr: number;
    overall: number;
  };
}

/**
 * Pearson correlation coefficient between two arrays.
 * Returns NaN if fewer than 4 data points or zero variance.
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

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  };
}

function isBeforeQuarter(y: number, q: number, refY: number, refQ: number): boolean {
  return y < refY || (y === refY && q < refQ);
}

/**
 * Compute R-scores for a company.
 * Uses last `windowSize` completed quarters (default 6, minimum 4).
 * Computes per region + globally. NOT per pod/motion.
 */
export async function computeRScores(
  companyId: number,
  windowSize: number = 6
): Promise<RScoreResponse> {
  const { year: curYear, quarter: curQ } = getCurrentQuarter();
  const allRegions = await db.getRegionsByCompany(companyId);
  const enabledRegions = allRegions.filter((r) => r.enabled);
  const forecastsData = await db.getForecastsByCompany(companyId);
  const actualsData = await db.getActualsByCompany(companyId);

  const perRegion: RScoreResult[] = [];

  for (const region of enabledRegions) {
    // Aggregate across all sqlTypes per quarter for this region
    const quarterAgg = new Map<
      string,
      { modelOpps: number; actualOpps: number; modelWins: number; actualWins: number }
    >();

    for (const f of forecastsData) {
      if (f.regionId !== region.id) continue;
      if (!isBeforeQuarter(f.year, f.quarter, curYear, curQ)) continue;

      const key = `${f.year}-${f.quarter}`;
      const agg = quarterAgg.get(key) ?? { modelOpps: 0, actualOpps: 0, modelWins: 0, actualWins: 0 };
      agg.modelOpps += f.predictedOpps / CASCADE_CONSTANTS.OPPORTUNITY_PRECISION_MULTIPLIER;
      quarterAgg.set(key, agg);
    }

    for (const a of actualsData) {
      if (a.regionId !== region.id) continue;
      if (!isBeforeQuarter(a.year, a.quarter, curYear, curQ)) continue;

      const key = `${a.year}-${a.quarter}`;
      const agg = quarterAgg.get(key) ?? { modelOpps: 0, actualOpps: 0, modelWins: 0, actualWins: 0 };
      agg.actualOpps += a.actualOpps;
      agg.actualWins += a.actualWins;
      quarterAgg.set(key, agg);
    }

    // Sort quarters and take last windowSize
    const sortedKeys = Array.from(quarterAgg.keys()).sort();
    const windowKeys = sortedKeys.slice(-windowSize);

    // Only include quarters that have both model and actual data
    const validEntries = windowKeys
      .map((k) => quarterAgg.get(k)!)
      .filter((e) => e.modelOpps > 0 || e.actualOpps > 0);

    const modelOppsArr = validEntries.map((e) => e.modelOpps);
    const actualOppsArr = validEntries.map((e) => e.actualOpps);
    const modelWinsArr = validEntries.map((e) => e.modelWins);
    const actualWinsArr = validEntries.map((e) => e.actualWins);

    const ocrR = pearsonR(modelOppsArr, actualOppsArr);
    const owrR = pearsonR(modelWinsArr, actualWinsArr);

    const validOcr = isFinite(ocrR) ? ocrR : 0;
    const validOwr = isFinite(owrR) ? owrR : 0;
    // OWR model predictions aren't stored directly, so only include OWR
    // in the overall when we actually have model wins data
    const hasModelWins = modelWinsArr.some(v => v > 0);
    const overall = hasModelWins
      ? (validOcr + validOwr) / 2
      : validOcr;

    perRegion.push({
      metricType: "ocr",
      regionId: region.id,
      regionName: region.displayName,
      rScore: isFinite(ocrR) ? ocrR : NaN,
      sampleSize: validEntries.length,
    });
    perRegion.push({
      metricType: "owr",
      regionId: region.id,
      regionName: region.displayName,
      rScore: isFinite(owrR) ? owrR : NaN,
      sampleSize: validEntries.length,
    });
    perRegion.push({
      metricType: "overall",
      regionId: region.id,
      regionName: region.displayName,
      rScore: isFinite(overall) ? overall : NaN,
      sampleSize: validEntries.length,
    });
  }

  // Global R: weighted average of per-region Rs (weight = sampleSize)
  const globalOcr = weightedAverage(
    perRegion.filter((r) => r.metricType === "ocr" && isFinite(r.rScore))
  );
  const globalOwr = weightedAverage(
    perRegion.filter((r) => r.metricType === "owr" && isFinite(r.rScore))
  );
  const globalOverall = weightedAverage(
    perRegion.filter((r) => r.metricType === "overall" && isFinite(r.rScore))
  );

  return {
    perRegion,
    global: {
      ocr: globalOcr,
      owr: globalOwr,
      overall: globalOverall,
    },
  };
}

function weightedAverage(results: RScoreResult[]): number {
  if (results.length === 0) return NaN;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const r of results) {
    if (!isFinite(r.rScore)) continue;
    weightedSum += r.rScore * r.sampleSize;
    totalWeight += r.sampleSize;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : NaN;
}
