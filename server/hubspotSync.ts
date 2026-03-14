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
  regionAliases?: Record<string, string>;
  sqlTypeAliases?: Record<string, string>;
  fallbackRegion?: string;
  fallbackSqlType?: string;
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
  filters: Array<{ propertyName: string; operator: string; value?: string }> = [],
): Promise<HubSpotRecord[]> {
  const client = api();
  const all: HubSpotRecord[] = [];
  let after: string | undefined;

  const NO_VALUE_OPERATORS = new Set(["HAS_PROPERTY", "NOT_HAS_PROPERTY"]);

  for (let page = 0; page < MAX_PAGES; page++) {
    const sanitizedFilters = filters.map(f =>
      NO_VALUE_OPERATORS.has(f.operator)
        ? { propertyName: f.propertyName, operator: f.operator }
        : f
    );
    const body: Record<string, unknown> = {
      filterGroups: sanitizedFilters.length > 0 ? [{ filters: sanitizedFilters }] : [],
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
  const key = raw.trim().toLowerCase();
  if (cfg.regionAliases?.[key]) return cfg.regionAliases[key];
  return cfg.contactRegionMap[key] ?? cfg.fallbackRegion ?? null;
}

function mapDealRegion(raw: string | null | undefined, cfg: MappingConfig): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (cfg.regionAliases?.[key]) return cfg.regionAliases[key];
  return cfg.dealRegionMap[key] ?? cfg.fallbackRegion ?? null;
}

function mapSqlType(raw: string | null | undefined, cfg: MappingConfig): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (cfg.sqlTypeAliases?.[key]) return cfg.sqlTypeAliases[key];
  return cfg.sqlTypeMap[key] ?? cfg.fallbackSqlType ?? null;
}

function toQuarter(dateStr: string | null | undefined): { year: number; quarter: number } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), quarter: Math.ceil((d.getMonth() + 1) / 3) };
}

// ── Sync result ─────────────────────────────────────────────────────────

export interface DataQualityReport {
  contactsFetched: number;
  contactsUsed: number;
  contactsSkipped: number;
  skippedNoRegion: number;
  skippedNoSqlType: number;
  skippedNoSqlDate: number;
  skippedUnmappedRegion: number;
  skippedUnmappedSqlType: number;
  unmappedRegionValues: Record<string, number>;
  unmappedSqlTypeValues: Record<string, number>;
  dealsFetched: number;
  dealsUsed: number;
  dealsSkipped: number;
  dealsSkippedNoRegion: number;
  dealsSkippedNoSqlType: number;
  dealsSkippedNoCloseDate: number;
  dealsSkippedUnmappedRegion: number;
  dealsSkippedUnmappedSqlType: number;
  dealsUnmappedRegionValues: Record<string, number>;
  dealsUnmappedSqlTypeValues: Record<string, number>;
  coveragePct: number;
  // Timing distribution quality
  contactsWithSqlDate: number;
  contactsWithOppDate: number;
  contactsMissingOppDate: number;
  timingSamplesByMotion: Record<string, number>;
  // Deal economics quality
  dealsClosedWon: number;
  dealsZeroAmount: number;
  dealsNoAmount: number;
  dealsNoDealType: number;
  dealAmountOutliers: number;
  dealAmountMin: number;
  dealAmountMax: number;
  dealAmountMedian: number;
  // Date anomalies
  contactsFutureSqlDate: number;
  contactsOldSqlDate: number;
  dealsFutureCloseDate: number;
  dealsOldCloseDate: number;
  // Sparse combinations
  sparseCombinations: Array<{ motion: string; region: string; sqlCount: number }>;
}

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
  dataQuality: DataQualityReport;
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
      regionAliases: storedConfig.regionAliases,
      sqlTypeAliases: storedConfig.sqlTypeAliases,
      fallbackRegion: storedConfig.fallbackRegion,
      fallbackSqlType: storedConfig.fallbackSqlType,
    } : {}),
    ...opts.mapping,
  };
  const dq: DataQualityReport = {
    contactsFetched: 0, contactsUsed: 0, contactsSkipped: 0,
    skippedNoRegion: 0, skippedNoSqlType: 0, skippedNoSqlDate: 0,
    skippedUnmappedRegion: 0, skippedUnmappedSqlType: 0,
    unmappedRegionValues: {}, unmappedSqlTypeValues: {},
    dealsFetched: 0, dealsUsed: 0, dealsSkipped: 0,
    dealsSkippedNoRegion: 0, dealsSkippedNoSqlType: 0, dealsSkippedNoCloseDate: 0,
    dealsSkippedUnmappedRegion: 0, dealsSkippedUnmappedSqlType: 0,
    dealsUnmappedRegionValues: {}, dealsUnmappedSqlTypeValues: {},
    coveragePct: 0,
    contactsWithSqlDate: 0, contactsWithOppDate: 0, contactsMissingOppDate: 0,
    timingSamplesByMotion: {},
    dealsClosedWon: 0, dealsZeroAmount: 0, dealsNoAmount: 0, dealsNoDealType: 0,
    dealAmountOutliers: 0, dealAmountMin: 0, dealAmountMax: 0, dealAmountMedian: 0,
    contactsFutureSqlDate: 0, contactsOldSqlDate: 0,
    dealsFutureCloseDate: 0, dealsOldCloseDate: 0,
    sparseCombinations: [],
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
    dataQuality: dq,
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
  // Fetch all contacts that have an SQL date set, regardless of current
  // lifecycle stage.  This captures contacts who were SQLs but have since
  // progressed to Opportunity, Customer, etc.

  console.log("[HubSpot Sync] Fetching contacts (any with SQL date)...");
  const contactProps = ["createdate", "lastmodifieddate", "lifecyclestage", "hs_lead_status", cfg.contactRegionProperty, cfg.contactSqlTypeProperty, cfg.contactSqlDateProperty, cfg.contactOppDateProperty];
  let contacts: HubSpotRecord[] = [];
  try {
    contacts = await fetchAllRecords("contacts", contactProps, [
      ...contactModifiedFilter,
      { propertyName: cfg.contactSqlDateProperty, operator: "HAS_PROPERTY", value: "" },
    ]);
    stats.contactsFetched = contacts.length;
    console.log(`[HubSpot Sync] Fetched ${contacts.length} contacts with SQL date`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`Contact fetch failed: ${msg}`);
    console.error("[HubSpot Sync] Contact fetch failed:", msg);
  }

  // ── Extract deals (closed-won stages only) ─────────────────────────

  console.log("[HubSpot Sync] Fetching closed-won deals...");
  const dealProps = ["createdate", "lastmodifieddate", "hs_lastmodifieddate", "dealstage", "dealtype", cfg.dealAmountProperty, cfg.dealCloseDateProperty, cfg.dealCreatedDateProperty, cfg.dealRegionProperty, cfg.dealSqlTypeProperty];
  let deals: HubSpotRecord[] = [];
  try {
    for (const stageId of cfg.closedWonStageIds) {
      const stageDeals = await fetchAllRecords("deals", dealProps, [
        ...dealModifiedFilter,
        { propertyName: "dealstage", operator: "EQ", value: stageId },
      ]);
      deals.push(...stageDeals);
    }
    stats.dealsFetched = deals.length;
    console.log(`[HubSpot Sync] Fetched ${deals.length} closed-won deals`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`Deal fetch failed: ${msg}`);
    console.error("[HubSpot Sync] Deal fetch failed:", msg);
  }

  // ── Transform: SQL History (contacts at SQL lifecycle stage) ─────────

  console.log("[HubSpot Sync] Building SQL history...");
  const sqlVolumes = new Map<string, number>(); // "regionName|sqlTypeName|year|quarter" → volume
  dq.contactsFetched = contacts.length;

  for (const c of contacts) {
    const rawRegion = c.properties[cfg.contactRegionProperty];
    const rawSqlType = c.properties[cfg.contactSqlTypeProperty];
    const region = mapContactRegion(rawRegion, cfg);
    const sqlType = mapSqlType(rawSqlType, cfg);
    const sqlDateRaw = c.properties[cfg.contactSqlDateProperty] || c.properties.createdate;
    const qtr = toQuarter(sqlDateRaw);

    if (!rawRegion) { dq.skippedNoRegion++; dq.contactsSkipped++; continue; }
    if (!region) {
      dq.skippedUnmappedRegion++;
      dq.unmappedRegionValues[rawRegion] = (dq.unmappedRegionValues[rawRegion] || 0) + 1;
      dq.contactsSkipped++; continue;
    }
    if (!rawSqlType) { dq.skippedNoSqlType++; dq.contactsSkipped++; continue; }
    if (!sqlType) {
      dq.skippedUnmappedSqlType++;
      dq.unmappedSqlTypeValues[rawSqlType] = (dq.unmappedSqlTypeValues[rawSqlType] || 0) + 1;
      dq.contactsSkipped++; continue;
    }
    if (!qtr) { dq.skippedNoSqlDate++; dq.contactsSkipped++; continue; }
    if (!regionByName.has(region) || !sqlTypeByName.has(sqlType)) { dq.contactsSkipped++; continue; }

    // Date anomaly checks
    const now = new Date();
    const sqlDateParsed = new Date(sqlDateRaw!);
    if (!isNaN(sqlDateParsed.getTime())) {
      dq.contactsWithSqlDate++;
      if (sqlDateParsed > now) dq.contactsFutureSqlDate++;
      if (sqlDateParsed.getFullYear() < 2015) dq.contactsOldSqlDate++;
    }

    // Timing gap: has SQL date but no Opp date
    const oppDateRaw = c.properties[cfg.contactOppDateProperty];
    if (oppDateRaw && !isNaN(new Date(oppDateRaw).getTime())) {
      dq.contactsWithOppDate++;
    } else {
      dq.contactsMissingOppDate++;
    }

    dq.contactsUsed++;
    const key = `${region}|${sqlType}|${qtr.year}|${qtr.quarter}`;
    sqlVolumes.set(key, (sqlVolumes.get(key) || 0) + 1);
  }

  dq.coveragePct = dq.contactsFetched > 0 ? Math.round((dq.contactsUsed / dq.contactsFetched) * 10000) / 100 : 0;
  console.log(`[HubSpot Sync] Contact data quality: ${dq.contactsUsed}/${dq.contactsFetched} used (${dq.coveragePct}%), ${dq.contactsSkipped} skipped`);

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

  dq.dealsFetched = deals.length;
  dq.dealsClosedWon = deals.length;

  // Collect deal amounts for outlier/median analysis
  const allDealAmounts: number[] = [];
  for (const d of deals) {
    const amtRaw = d.properties[cfg.dealAmountProperty];
    if (!amtRaw || amtRaw === "") { dq.dealsNoAmount++; continue; }
    const amt = parseFloat(amtRaw) || 0;
    if (amt === 0) { dq.dealsZeroAmount++; }
    else { allDealAmounts.push(amt); }
    if (!d.properties.dealtype || d.properties.dealtype === "") dq.dealsNoDealType++;
  }
  // Amount stats
  if (allDealAmounts.length > 0) {
    allDealAmounts.sort((a, b) => a - b);
    dq.dealAmountMin = allDealAmounts[0];
    dq.dealAmountMax = allDealAmounts[allDealAmounts.length - 1];
    const mid = Math.floor(allDealAmounts.length / 2);
    dq.dealAmountMedian = allDealAmounts.length % 2 === 0
      ? (allDealAmounts[mid - 1] + allDealAmounts[mid]) / 2
      : allDealAmounts[mid];
    // Outlier detection: >3x median or <0.1x median
    const medianVal = dq.dealAmountMedian;
    if (medianVal > 0) {
      dq.dealAmountOutliers = allDealAmounts.filter(a => a > medianVal * 3 || a < medianVal * 0.1).length;
    }
  }

  for (const d of deals) {
    const rawDealRegion = d.properties[cfg.dealRegionProperty];
    const region = mapDealRegion(rawDealRegion, cfg);
    const sqlType = mapSqlType(d.properties[cfg.dealSqlTypeProperty], cfg);
    const qtr = toQuarter(d.properties[cfg.dealCloseDateProperty]);
    const amount = parseFloat(d.properties[cfg.dealAmountProperty] ?? "0") || 0;

    if (!rawDealRegion) { dq.dealsSkippedNoRegion++; }
    else if (!region) {
      dq.dealsSkippedUnmappedRegion++;
      dq.dealsUnmappedRegionValues[rawDealRegion] = (dq.dealsUnmappedRegionValues[rawDealRegion] || 0) + 1;
    }
    const rawDealSqlType = d.properties[cfg.dealSqlTypeProperty];
    if (!rawDealSqlType) { dq.dealsSkippedNoSqlType++; }
    else if (!sqlType) {
      dq.dealsSkippedUnmappedSqlType++;
      dq.dealsUnmappedSqlTypeValues[rawDealSqlType] = (dq.dealsUnmappedSqlTypeValues[rawDealSqlType] || 0) + 1;
    }
    if (!qtr) { dq.dealsSkippedNoCloseDate++; }

    // Deal date anomalies
    const closeDateRaw = d.properties[cfg.dealCloseDateProperty];
    if (closeDateRaw) {
      const closeDate = new Date(closeDateRaw);
      if (!isNaN(closeDate.getTime())) {
        const now = new Date();
        if (closeDate > now) dq.dealsFutureCloseDate++;
        if (closeDate.getFullYear() < 2015) dq.dealsOldCloseDate++;
      }
    }

    if (!region || !sqlType || !qtr) { dq.dealsSkipped++; continue; }
    if (!regionByName.has(region) || !sqlTypeByName.has(sqlType)) { dq.dealsSkipped++; continue; }
    dq.dealsUsed++;

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

  for (const d of deals) {
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
  // Record timing sample counts per motion (SQL type name)
  for (const [sqlTypeId, bucket] of timingBuckets) {
    const sqlTypeName = [...sqlTypeByName.entries()].find(([, id]) => id === sqlTypeId)?.[0];
    if (sqlTypeName) dq.timingSamplesByMotion[sqlTypeName] = bucket.total;
  }

  console.log(`[HubSpot Sync] Upserted ${stats.timingDistributionsUpserted} timing distributions (from ${timingBuckets.size} SQL types with data)`);

  // ── Detect sparse region/motion combinations ──────────────────────
  const comboCounts = new Map<string, number>();
  for (const [key, count] of sqlVolumes) {
    const [region, sqlType] = key.split("|");
    const comboKey = `${sqlType}|${region}`;
    comboCounts.set(comboKey, (comboCounts.get(comboKey) || 0) + count);
  }
  for (const [comboKey, count] of comboCounts) {
    if (count < 5) {
      const [motion, region] = comboKey.split("|");
      dq.sparseCombinations.push({ motion, region, sqlCount: count });
    }
  }

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

  // ── Persist data quality report ─────────────────────────────────────

  try {
    await db.insertDataQualityReport({
      companyId,
      reportJson: JSON.stringify(dq),
      contactsFetched: dq.contactsFetched,
      contactsUsed: dq.contactsUsed,
      contactsSkipped: dq.contactsSkipped,
      coveragePct: Math.round(dq.coveragePct * 100),
      dealsFetched: dq.dealsFetched,
      dealsUsed: dq.dealsUsed,
      dealsSkipped: dq.dealsSkipped,
    });
  } catch (err) {
    stats.errors.push(`Data quality report persist: ${err instanceof Error ? err.message : err}`);
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
