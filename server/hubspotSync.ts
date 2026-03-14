/**
 * HubSpot → Cascata ELT Sync Engine
 *
 * Incrementally extracts contacts and deals from HubSpot CRM API,
 * transforms them into the cascade model's data structures, and
 * loads them into the local MariaDB database.
 *
 * Supports delta syncs via HubSpot's `lastmodifieddate` filter.
 */

import axios, { type AxiosInstance } from "axios";
import * as db from "./db";
import { runCascadeForecast } from "./cascadeEngine";

const HUBSPOT_API_BASE = "https://api.hubapi.com";
const PAGE_LIMIT = 100;
const MAX_PAGES = 100; // safety cap: 10 000 records per object type

// ── Region & SQL type mapping (matches HUBSPOT_DATA_MAPPING.md) ──────────

interface MappingConfig {
  contactSqlDateProperty: string;
  contactRegionProperty: string;
  contactSqlTypeProperty: string;
  contactOppDateProperty: string;
  dealRegionProperty: string;
  dealSqlTypeProperty: string;
  dealAmountProperty: string;
  dealCloseDateProperty: string;
  dealCreatedDateProperty: string;
  contactRegionMap: Record<string, string>;
  dealRegionMap: Record<string, string>;
  sqlTypeMap: Record<string, string>;
  sqlLifecycleStages: string[];
  closedWonStageIds: string[];
  newDealTypeValues: string[];
  upsellDealTypeValues: string[];
}

/**
 * Mapping config derived from Gravitee's actual HubSpot property
 * names and enumeration values (see inspectHubSpotValues.ts output).
 */
const DEFAULT_MAPPING: MappingConfig = {
  contactSqlDateProperty: "admin___first_became_a_sql_date",
  contactRegionProperty: "contact_pod",
  contactSqlTypeProperty: "type_of_sql",
  contactOppDateProperty: "admin___first_became_an_opportunity_date",
  dealRegionProperty: "deal_pod",
  dealSqlTypeProperty: "type_of_sql_associated_to_deal",
  dealAmountProperty: "amount",
  dealCloseDateProperty: "closedate",
  dealCreatedDateProperty: "createdate",

  contactRegionMap: {
    "noram": "NORAM",
    "noram east": "NORAM",
    "noram west": "NORAM",
    "emesa": "EMESA_NORTH",
    "emesa north": "EMESA_NORTH",
    "emesa dach": "EMESA_NORTH",
    "emesa south": "EMESA_SOUTH",
    "others": "NORAM",
  },

  dealRegionMap: {
    "noram": "NORAM",
    "noram east": "NORAM",
    "noram west": "NORAM",
    "emesa": "EMESA_NORTH",
    "emesa north": "EMESA_NORTH",
    "emesa dach": "EMESA_NORTH",
    "emesa south": "EMESA_SOUTH",
    "others": "NORAM",
  },

  sqlTypeMap: {
    "direct sql": "INBOUND",
    "product generated sql": "INBOUND",
    "bdr generated sql": "ILO",
    "sales generated sql": "OUTBOUND",
    "event generated sql": "EVENT",
    "partner generated sql": "PARTNER",
  },

  sqlLifecycleStages: ["salesqualifiedlead"],
  closedWonStageIds: ["closedwon", "19291292", "96740205"],
  newDealTypeValues: ["newbusiness"],
  upsellDealTypeValues: ["existingbusiness", "customerrenewal", "Fixed Add On Business", "Fixed Renewal", "Renewal Uplift"],
};

// ── HubSpot API helpers ──────────────────────────────────────────────────

function getToken(): string {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token || token === "your-hubspot-token-here") {
    throw new Error("HUBSPOT_TOKEN not configured");
  }
  return token;
}

function api(): AxiosInstance {
  return axios.create({
    baseURL: HUBSPOT_API_BASE,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    timeout: 30_000,
  });
}

interface HubSpotRecord {
  id: string;
  properties: Record<string, string | null>;
}

interface SearchResponse {
  total: number;
  results: HubSpotRecord[];
  paging?: { next?: { after: string } };
}

async function fetchAllRecords(
  objectType: string,
  properties: string[],
  filters: Array<{ propertyName: string; operator: string; value: string }> = [],
): Promise<HubSpotRecord[]> {
  const client = api();
  const all: HubSpotRecord[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      filterGroups: filters.length > 0 ? [{ filters }] : [],
      sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      properties,
      limit: PAGE_LIMIT,
      ...(after ? { after } : {}),
    };

    const { data } = await client.post<SearchResponse>(
      `/crm/v3/objects/${objectType}/search`,
      body,
    );

    all.push(...data.results);

    if (!data.paging?.next?.after || data.results.length < PAGE_LIMIT) break;
    after = data.paging.next.after;
  }

  return all;
}

// ── Mapping helpers ─────────────────────────────────────────────────────

function mapContactRegion(raw: string | null | undefined, cfg: MappingConfig): string | null {
  if (!raw) return null;
  return cfg.contactRegionMap[raw.trim().toLowerCase()] ?? null;
}

function mapDealRegion(raw: string | null | undefined, cfg: MappingConfig): string | null {
  if (!raw) return null;
  return cfg.dealRegionMap[raw.trim().toLowerCase()] ?? null;
}

function mapSqlType(raw: string | null | undefined, cfg: MappingConfig): string | null {
  if (!raw) return null;
  return cfg.sqlTypeMap[raw.trim().toLowerCase()] ?? null;
}

function toQuarter(dateStr: string | null | undefined): { year: number; quarter: number } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), quarter: Math.ceil((d.getMonth() + 1) / 3) };
}

// ── Sync result ─────────────────────────────────────────────────────────

export interface SyncStats {
  contactsFetched: number;
  dealsFetched: number;
  sqlHistoryUpserted: number;
  conversionRatesUpserted: number;
  dealEconomicsUpserted: number;
  actualsUpserted: number;
  forecastsGenerated: number;
  timingDistributionsUpserted: number;
  errors: string[];
  durationMs: number;
}

// ── Main sync function ──────────────────────────────────────────────────

export async function syncFromHubSpot(
  companyId: number,
  opts: { sinceDate?: Date; fullSync?: boolean; mapping?: Partial<MappingConfig> } = {},
): Promise<SyncStats> {
  const t0 = Date.now();

  // Load config from DB, fall back to defaults
  const company = await db.getCompanyById(companyId);
  const storedConfig = company ? db.parseSyncConfig(company) : null;
  const cfg: MappingConfig = {
    ...DEFAULT_MAPPING,
    ...(storedConfig ? {
      contactSqlDateProperty: storedConfig.contactSqlDateProperty,
      contactRegionProperty: storedConfig.contactRegionProperty,
      contactSqlTypeProperty: storedConfig.contactSqlTypeProperty,
      contactOppDateProperty: storedConfig.contactOppDateProperty,
      dealRegionProperty: storedConfig.dealRegionProperty,
      dealSqlTypeProperty: storedConfig.dealSqlTypeProperty,
      dealAmountProperty: storedConfig.dealAmountProperty,
      dealCloseDateProperty: storedConfig.dealCloseDateProperty,
      dealCreatedDateProperty: storedConfig.dealCreatedDateProperty ?? "createdate",
      closedWonStageIds: storedConfig.closedWonStageIds,
      newDealTypeValues: storedConfig.newDealTypeValues,
      upsellDealTypeValues: storedConfig.upsellDealTypeValues,
    } : {}),
    ...opts.mapping,
  };
  const stats: SyncStats = {
    contactsFetched: 0,
    dealsFetched: 0,
    sqlHistoryUpserted: 0,
    conversionRatesUpserted: 0,
    dealEconomicsUpserted: 0,
    actualsUpserted: 0,
    forecastsGenerated: 0,
    timingDistributionsUpserted: 0,
    errors: [],
    durationMs: 0,
  };

  const regions = await db.getRegionsByCompany(companyId);
  const sqlTypes = await db.getSqlTypesByCompany(companyId);
  const regionByName = new Map(regions.map((r) => [r.name, r.id]));
  const sqlTypeByName = new Map(sqlTypes.map((t) => [t.name, t.id]));

  // Determine delta filters (property name differs between contacts and deals)
  const contactModifiedFilter: Array<{ propertyName: string; operator: string; value: string }> = [];
  const dealModifiedFilter: Array<{ propertyName: string; operator: string; value: string }> = [];
  if (opts.sinceDate && !opts.fullSync) {
    const sinceMs = opts.sinceDate.getTime().toString();
    contactModifiedFilter.push({
      propertyName: "lastmodifieddate",
      operator: "GTE",
      value: sinceMs,
    });
    dealModifiedFilter.push({
      propertyName: "hs_lastmodifieddate",
      operator: "GTE",
      value: sinceMs,
    });
  }

  // ── Extract contacts ────────────────────────────────────────────────

  console.log("[HubSpot Sync] Fetching contacts (SQL lifecycle stage only)...");
  const contactProps = ["createdate", "lastmodifieddate", "lifecyclestage", "hs_lead_status", cfg.contactRegionProperty, cfg.contactSqlTypeProperty, cfg.contactSqlDateProperty, cfg.contactOppDateProperty];
  let contacts: HubSpotRecord[] = [];
  try {
    // Filter server-side to only get contacts at SQL lifecycle stage
    for (const stage of cfg.sqlLifecycleStages) {
      const sqlContacts = await fetchAllRecords("contacts", contactProps, [
        ...contactModifiedFilter,
        { propertyName: "lifecyclestage", operator: "EQ", value: stage },
      ]);
      contacts.push(...sqlContacts);
    }
    stats.contactsFetched = contacts.length;
    console.log(`[HubSpot Sync] Fetched ${contacts.length} SQL contacts`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`Contact fetch failed: ${msg}`);
    console.error("[HubSpot Sync] Contact fetch failed:", msg);
  }

  // ── Extract deals ───────────────────────────────────────────────────

  console.log("[HubSpot Sync] Fetching deals...");
  const dealProps = ["createdate", "lastmodifieddate", "hs_lastmodifieddate", "dealstage", "dealtype", cfg.dealAmountProperty, cfg.dealCloseDateProperty, cfg.dealCreatedDateProperty, cfg.dealRegionProperty, cfg.dealSqlTypeProperty];
  let deals: HubSpotRecord[] = [];
  try {
    deals = await fetchAllRecords("deals", dealProps, dealModifiedFilter);
    stats.dealsFetched = deals.length;
    console.log(`[HubSpot Sync] Fetched ${deals.length} deals`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`Deal fetch failed: ${msg}`);
    console.error("[HubSpot Sync] Deal fetch failed:", msg);
  }

  // ── Transform: SQL History (contacts at SQL lifecycle stage) ─────────

  console.log("[HubSpot Sync] Building SQL history...");
  const sqlVolumes = new Map<string, number>(); // "regionName|sqlTypeName|year|quarter" → volume

  for (const c of contacts) {
    const stage = (c.properties.lifecyclestage ?? c.properties.hs_lead_status ?? "").toLowerCase();
    if (!cfg.sqlLifecycleStages.includes(stage)) continue;

    const region = mapContactRegion(c.properties[cfg.contactRegionProperty], cfg);
    const sqlType = mapSqlType(c.properties[cfg.contactSqlTypeProperty], cfg);
    // Use configured SQL date field; fall back to createdate
    const sqlDateRaw = c.properties[cfg.contactSqlDateProperty] || c.properties.createdate;
    const qtr = toQuarter(sqlDateRaw);
    if (!region || !sqlType || !qtr) continue;
    if (!regionByName.has(region) || !sqlTypeByName.has(sqlType)) continue;

    const key = `${region}|${sqlType}|${qtr.year}|${qtr.quarter}`;
    sqlVolumes.set(key, (sqlVolumes.get(key) || 0) + 1);
  }

  for (const [key, volume] of sqlVolumes) {
    const [region, sqlType, yearStr, quarterStr] = key.split("|");
    try {
      await db.upsertSqlHistoryFromBQ({
        companyId,
        regionId: regionByName.get(region)!,
        sqlTypeId: sqlTypeByName.get(sqlType)!,
        year: Number(yearStr),
        quarter: Number(quarterStr),
        volume,
      });
      stats.sqlHistoryUpserted++;
    } catch (err) {
      stats.errors.push(`SQL history upsert (${key}): ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`[HubSpot Sync] Upserted ${stats.sqlHistoryUpserted} SQL history records`);

  // ── Transform: Actuals (closed-won deals → revenue by quarter) ──────

  console.log("[HubSpot Sync] Building actuals...");
  const actualRevenues = new Map<string, { revenue: number; sqls: number; opps: number }>();

  const closedWonDeals = deals.filter((d) =>
    cfg.closedWonStageIds.includes((d.properties.dealstage ?? "").toLowerCase()),
  );

  for (const d of closedWonDeals) {
    const region = mapDealRegion(d.properties[cfg.dealRegionProperty], cfg);
    const sqlType = mapSqlType(d.properties[cfg.dealSqlTypeProperty], cfg);
    const qtr = toQuarter(d.properties[cfg.dealCloseDateProperty]);
    const amount = parseFloat(d.properties[cfg.dealAmountProperty] ?? "0") || 0;
    if (!region || !sqlType || !qtr) continue;
    if (!regionByName.has(region) || !sqlTypeByName.has(sqlType)) continue;

    const key = `${region}|${sqlType}|${qtr.year}|${qtr.quarter}`;
    const existing = actualRevenues.get(key) || { revenue: 0, sqls: 0, opps: 0 };
    existing.revenue += Math.round(amount * 100); // dollars → cents
    existing.opps += 1;
    actualRevenues.set(key, existing);
  }

  // Add SQL counts to actuals from SQL history we already computed
  for (const [key, volume] of sqlVolumes) {
    const act = actualRevenues.get(key);
    if (act) act.sqls = volume;
  }

  for (const [key, act] of actualRevenues) {
    const [region, sqlType, yearStr, quarterStr] = key.split("|");
    try {
      await db.upsertActual({
        companyId,
        regionId: regionByName.get(region)!,
        sqlTypeId: sqlTypeByName.get(sqlType)!,
        year: Number(yearStr),
        quarter: Number(quarterStr),
        actualSqls: act.sqls,
        actualOpps: act.opps,
        actualRevenue: act.revenue,
      });
      stats.actualsUpserted++;
    } catch (err) {
      stats.errors.push(`Actual upsert (${key}): ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`[HubSpot Sync] Upserted ${stats.actualsUpserted} actual records`);

  // ── Transform: Conversion Rates ─────────────────────────────────────

  console.log("[HubSpot Sync] Calculating conversion rates...");

  // Count SQLs, opportunities, and closed-won by region × sqlType
  const crData = new Map<string, { sqls: number; opps: number; wonNew: number; wonUpsell: number }>();

  // SQLs
  for (const [key, volume] of sqlVolumes) {
    const parts = key.split("|");
    const crKey = `${parts[0]}|${parts[1]}`;
    const existing = crData.get(crKey) || { sqls: 0, opps: 0, wonNew: 0, wonUpsell: 0 };
    existing.sqls += volume;
    crData.set(crKey, existing);
  }

  // Opportunities and closed-won from deals
  for (const d of deals) {
    const region = mapDealRegion(d.properties[cfg.dealRegionProperty], cfg);
    const sqlType = mapSqlType(d.properties[cfg.dealSqlTypeProperty], cfg);
    if (!region || !sqlType) continue;
    if (!regionByName.has(region) || !sqlTypeByName.has(sqlType)) continue;

    const crKey = `${region}|${sqlType}`;
    const existing = crData.get(crKey) || { sqls: 0, opps: 0, wonNew: 0, wonUpsell: 0 };

    const stage = (d.properties.dealstage ?? "").toLowerCase();
    if (cfg.closedWonStageIds.includes(stage)) {
      existing.opps += 1;
      const dealType = d.properties.dealtype ?? "";
      if (cfg.upsellDealTypeValues.includes(dealType)) {
        existing.wonUpsell += 1;
      } else if (cfg.newDealTypeValues.includes(dealType)) {
        existing.wonNew += 1;
      } else {
        existing.wonNew += 1; // default to new
      }
    } else if (stage && stage !== "closedlost" && stage !== "closed lost") {
      existing.opps += 1;
    }

    crData.set(crKey, existing);
  }

  for (const [crKey, data] of crData) {
    const [region, sqlType] = crKey.split("|");
    if (data.sqls === 0) continue;

    const oppCoverageRatio = Math.round((data.opps / data.sqls) * 10000); // basis points
    const winRateNew = data.opps > 0 ? Math.round((data.wonNew / data.opps) * 10000) : 0;
    const winRateUpsell = data.opps > 0 ? Math.round((data.wonUpsell / data.opps) * 10000) : 0;

    try {
      await db.upsertConversionRateFromBQ({
        companyId,
        regionId: regionByName.get(region)!,
        sqlTypeId: sqlTypeByName.get(sqlType)!,
        oppCoverageRatio,
        winRateNew,
        winRateUpsell,
      });
      stats.conversionRatesUpserted++;
    } catch (err) {
      stats.errors.push(`Conversion rate upsert (${crKey}): ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`[HubSpot Sync] Upserted ${stats.conversionRatesUpserted} conversion rate records`);

  // ── Transform: Deal Economics (ACV by region) ───────────────────────

  console.log("[HubSpot Sync] Calculating deal economics...");

  const acvData = new Map<string, { newTotal: number; newCount: number; upsellTotal: number; upsellCount: number }>();

  for (const d of closedWonDeals) {
    const region = mapDealRegion(d.properties[cfg.dealRegionProperty], cfg);
    if (!region || !regionByName.has(region)) continue;

    const amount = parseFloat(d.properties[cfg.dealAmountProperty] ?? "0") || 0;
    if (amount <= 0) continue;

    const existing = acvData.get(region) || { newTotal: 0, newCount: 0, upsellTotal: 0, upsellCount: 0 };
    const dealType = d.properties.dealtype ?? "";

    if (cfg.upsellDealTypeValues.includes(dealType)) {
      existing.upsellTotal += amount;
      existing.upsellCount += 1;
    } else {
      existing.newTotal += amount;
      existing.newCount += 1;
    }
    acvData.set(region, existing);
  }

  for (const [region, data] of acvData) {
    const acvNew = data.newCount > 0 ? Math.round((data.newTotal / data.newCount) * 100) : 0; // cents
    const acvUpsell = data.upsellCount > 0 ? Math.round((data.upsellTotal / data.upsellCount) * 100) : 0;

    if (acvNew === 0 && acvUpsell === 0) continue;

    try {
      await db.upsertDealEconomics({
        companyId,
        regionId: regionByName.get(region)!,
        acvNew: acvNew || undefined as any,
        acvUpsell: acvUpsell || undefined as any,
      });
      stats.dealEconomicsUpserted++;
    } catch (err) {
      stats.errors.push(`Deal economics upsert (${region}): ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`[HubSpot Sync] Upserted ${stats.dealEconomicsUpserted} deal economics records`);

  // ── Calculate timing distributions from SQL date → Opp date ─────────

  console.log("[HubSpot Sync] Calculating timing distributions from SQL→Opp dates...");

  const timingBuckets = new Map<number, { sameQ: number; nextQ: number; twoQ: number; total: number }>();

  for (const c of contacts) {
    const stage = (c.properties.lifecyclestage ?? c.properties.hs_lead_status ?? "").toLowerCase();
    if (!cfg.sqlLifecycleStages.includes(stage)) continue;

    const sqlType = mapSqlType(c.properties[cfg.contactSqlTypeProperty], cfg);
    if (!sqlType || !sqlTypeByName.has(sqlType)) continue;
    const sqlTypeId = sqlTypeByName.get(sqlType)!;

    const sqlDateRaw = c.properties[cfg.contactSqlDateProperty] || c.properties.createdate;
    const oppDateRaw = c.properties[cfg.contactOppDateProperty];
    if (!sqlDateRaw || !oppDateRaw) continue;

    const sqlDate = new Date(sqlDateRaw);
    const oppDate = new Date(oppDateRaw);
    if (isNaN(sqlDate.getTime()) || isNaN(oppDate.getTime())) continue;

    const sqlQtr = Math.ceil((sqlDate.getMonth() + 1) / 3);
    const sqlYear = sqlDate.getFullYear();
    const oppQtr = Math.ceil((oppDate.getMonth() + 1) / 3);
    const oppYear = oppDate.getFullYear();
    const qtrDiff = (oppYear - sqlYear) * 4 + (oppQtr - sqlQtr);

    const bucket = timingBuckets.get(sqlTypeId) || { sameQ: 0, nextQ: 0, twoQ: 0, total: 0 };
    if (qtrDiff <= 0) bucket.sameQ++;
    else if (qtrDiff === 1) bucket.nextQ++;
    else bucket.twoQ++;
    bucket.total++;
    timingBuckets.set(sqlTypeId, bucket);
  }

  for (const [sqlTypeId, bucket] of timingBuckets) {
    if (bucket.total < 5) continue; // need minimum sample size
    const sameQPct = Math.round((bucket.sameQ / bucket.total) * 10000);
    const nextQPct = Math.round((bucket.nextQ / bucket.total) * 10000);
    const twoQPct = Math.max(0, 10000 - sameQPct - nextQPct);

    try {
      await db.upsertTimeDistribution({
        companyId,
        sqlTypeId,
        sameQuarterPct: sameQPct,
        nextQuarterPct: nextQPct,
        twoQuarterPct: twoQPct,
      });
      stats.timingDistributionsUpserted++;
    } catch (err) {
      stats.errors.push(`Timing distribution upsert (type ${sqlTypeId}): ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`[HubSpot Sync] Upserted ${stats.timingDistributionsUpserted} timing distributions (from ${timingBuckets.size} SQL types with data)`);

  // ── Recalculate forecasts ───────────────────────────────────────────

  console.log("[HubSpot Sync] Recalculating cascade forecasts...");
  try {
    stats.forecastsGenerated = await runCascadeForecast(companyId);
    console.log(`[HubSpot Sync] Generated ${stats.forecastsGenerated} forecast records`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`Forecast calculation: ${msg}`);
    console.error("[HubSpot Sync] Forecast calculation failed:", msg);
  }

  // ── Update sync timestamp ──────────────────────────────────────────

  try {
    await db.updateCompanyBigQuerySync(companyId, new Date());
  } catch {
    // non-critical
  }

  stats.durationMs = Date.now() - t0;
  return stats;
}
