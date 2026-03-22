import * as db from "./db";
import { CASCADE_CONSTANTS } from "@shared/const";

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
  modelValue: number;
  actualValue: number;
  attainment: number;
  status: RagStatus;
}

/**
 * Compute RAG status from actual vs model values.
 * Green: >= 90% attainment. Amber: 70-89%. Red: < 70%.
 */
export function computeRag(actual: number, model: number): RagStatus {
  if (model === 0) return "green";
  const attainment = (actual / model) * 100;
  if (attainment >= 90) return "green";
  if (attainment >= 70) return "amber";
  return "red";
}

export function computeAttainment(actual: number, model: number): number {
  if (model === 0) return 100;
  return (actual / model) * 100;
}

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  };
}

function isHistoricalQuarter(y: number, q: number, curY: number, curQ: number): boolean {
  return y < curY || (y === curY && q < curQ);
}

/**
 * Compute RAG results for a company across all hierarchy levels.
 * RAG targets come from the forecasts table (model output IS the target).
 * Only applies to historical quarters where actuals exist.
 */
export async function computeRagForCompany(
  companyId: number
): Promise<RagResult[]> {
  const { year: curYear, quarter: curQ } = getCurrentQuarter();
  const forecastsData = await db.getForecastsByCompany(companyId);
  const actualsData = await db.getActualsByCompany(companyId);
  const allRegions = await db.getRegionsByCompany(companyId);
  const allSqlTypes = await db.getSqlTypesByCompany(companyId);

  const regionMap = new Map(allRegions.map((r) => [r.id, r]));
  const sqlTypeMap = new Map(allSqlTypes.map((s) => [s.id, s]));

  // Build lookup maps
  const forecastMap = new Map<string, typeof forecastsData[0]>();
  for (const f of forecastsData) {
    forecastMap.set(`${f.regionId}-${f.sqlTypeId}-${f.year}-${f.quarter}`, f);
  }

  const actualMap = new Map<string, typeof actualsData[0]>();
  for (const a of actualsData) {
    actualMap.set(`${a.regionId}-${a.sqlTypeId}-${a.year}-${a.quarter}`, a);
  }

  const results: RagResult[] = [];

  // Collect unique historical quarters
  const historicalQuarters = new Set<string>();
  for (const a of actualsData) {
    if (isHistoricalQuarter(a.year, a.quarter, curYear, curQ)) {
      historicalQuarters.add(`${a.year}-${a.quarter}`);
    }
  }

  for (const qKey of historicalQuarters) {
    const [yearStr, quarterStr] = qKey.split("-");
    const year = Number(yearStr);
    const quarter = Number(quarterStr);

    // Motion level (Level 3)
    for (const a of actualsData) {
      if (a.year !== year || a.quarter !== quarter) continue;
      const fKey = `${a.regionId}-${a.sqlTypeId}-${year}-${quarter}`;
      const f = forecastMap.get(fKey);
      if (!f) continue;

      const region = regionMap.get(a.regionId);
      const sqlType = sqlTypeMap.get(a.sqlTypeId);

      const metrics: Array<{ metric: "sql" | "ocr" | "owr"; model: number; actual: number }> = [
        { metric: "sql", model: f.predictedSqls, actual: a.actualSqls },
        {
          metric: "ocr",
          model: f.predictedOpps / CASCADE_CONSTANTS.OPPORTUNITY_PRECISION_MULTIPLIER,
          actual: a.actualOpps,
        },
        { metric: "owr", model: 0, actual: a.actualWins },
      ];

      for (const m of metrics) {
        if (m.metric === "owr" && m.model === 0) continue;
        const attainment = computeAttainment(m.actual, m.model);
        results.push({
          metric: m.metric,
          level: "motion",
          regionId: a.regionId,
          regionName: region?.displayName,
          sqlTypeId: a.sqlTypeId,
          sqlTypeName: sqlType?.displayName,
          year,
          quarter,
          modelValue: m.model,
          actualValue: m.actual,
          attainment,
          status: computeRag(m.actual, m.model),
        });
      }
    }

    // Region level (Level 2): SUM across sqlTypes per region
    const regionAgg = new Map<
      number,
      { modelSql: number; actualSql: number; modelOcr: number; actualOcr: number; modelOwr: number; actualOwr: number }
    >();

    for (const a of actualsData) {
      if (a.year !== year || a.quarter !== quarter) continue;
      const f = forecastMap.get(`${a.regionId}-${a.sqlTypeId}-${year}-${quarter}`);
      if (!f) continue;

      const agg = regionAgg.get(a.regionId) ?? {
        modelSql: 0, actualSql: 0, modelOcr: 0, actualOcr: 0, modelOwr: 0, actualOwr: 0,
      };
      agg.modelSql += f.predictedSqls;
      agg.actualSql += a.actualSqls;
      agg.modelOcr += f.predictedOpps / CASCADE_CONSTANTS.OPPORTUNITY_PRECISION_MULTIPLIER;
      agg.actualOcr += a.actualOpps;
      agg.actualOwr += a.actualWins;
      regionAgg.set(a.regionId, agg);
    }

    for (const [regionId, agg] of regionAgg) {
      const region = regionMap.get(regionId);
      const regionMetrics: Array<{ metric: "sql" | "ocr"; model: number; actual: number }> = [
        { metric: "sql", model: agg.modelSql, actual: agg.actualSql },
        { metric: "ocr", model: agg.modelOcr, actual: agg.actualOcr },
      ];

      for (const m of regionMetrics) {
        results.push({
          metric: m.metric,
          level: "region",
          regionId,
          regionName: region?.displayName,
          year,
          quarter,
          modelValue: m.model,
          actualValue: m.actual,
          attainment: computeAttainment(m.actual, m.model),
          status: computeRag(m.actual, m.model),
        });
      }
    }

    // Global level (Level 1): SUM across all regions + sqlTypes
    let globalModelSql = 0, globalActualSql = 0;
    let globalModelOcr = 0, globalActualOcr = 0;

    for (const agg of regionAgg.values()) {
      globalModelSql += agg.modelSql;
      globalActualSql += agg.actualSql;
      globalModelOcr += agg.modelOcr;
      globalActualOcr += agg.actualOcr;
    }

    const globalMetrics: Array<{ metric: "sql" | "ocr"; model: number; actual: number }> = [
      { metric: "sql", model: globalModelSql, actual: globalActualSql },
      { metric: "ocr", model: globalModelOcr, actual: globalActualOcr },
    ];

    for (const m of globalMetrics) {
      results.push({
        metric: m.metric,
        level: "global",
        year,
        quarter,
        modelValue: m.model,
        actualValue: m.actual,
        attainment: computeAttainment(m.actual, m.model),
        status: computeRag(m.actual, m.model),
      });
    }
  }

  return results;
}
