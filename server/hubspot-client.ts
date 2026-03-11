/**
 * HubSpot API Client for Cascata Test Dashboard
 * Fetches contacts and deals directly from HubSpot CRM API v3
 * using the private app access token from HUBSPOT_TOKEN env var.
 *
 * Uses the Search API for offset-based pagination so we don't
 * need to load all records into memory.
 */

import axios, { type AxiosInstance } from "axios";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

function getToken(): string {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token || token === "your-hubspot-token-here") {
    throw new Error(
      "HUBSPOT_TOKEN is not configured. Set it in your .env file with a valid HubSpot private app access token."
    );
  }
  return token;
}

function hubspotApi(): AxiosInstance {
  return axios.create({
    baseURL: HUBSPOT_API_BASE,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

export type HubSpotRow = { [key: string]: unknown };

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalResults: number;
    totalPages: number;
  };
}

export interface HubSpotContact extends HubSpotRow {}
export interface HubSpotDeal extends HubSpotRow {}
export interface HubSpotContactsResponse extends PaginatedResult<HubSpotContact> {}
export interface HubSpotDealsResponse extends PaginatedResult<HubSpotDeal> {}

const propsCache: Record<string, { ts: number; names: string[] }> = {};
const PROPS_CACHE_TTL = 10 * 60 * 1000;

async function getPropertyNames(objectType: string): Promise<string[]> {
  if (propsCache[objectType] && Date.now() - propsCache[objectType].ts < PROPS_CACHE_TTL) {
    return propsCache[objectType].names;
  }

  const api = hubspotApi();
  const { data } = await api.get(`/crm/v3/properties/${objectType}`);
  const names = (data.results as { name: string }[]).map((p) => p.name);
  propsCache[objectType] = { ts: Date.now(), names };
  return names;
}

function flattenResult(result: { id: string; properties?: Record<string, unknown> }): HubSpotRow {
  const flat: HubSpotRow = { id: result.id };
  if (result.properties) {
    for (const [k, v] of Object.entries(result.properties)) {
      flat[`property_${k}`] = v;
    }
  }
  return flat;
}

/**
 * Fetch a single page of objects using the HubSpot Search API.
 * The Search API supports offset-based pagination via the `after` param.
 */
async function fetchPage(
  objectType: string,
  page: number,
  pageSize: number,
  properties: string[]
): Promise<{ rows: HubSpotRow[]; total: number }> {
  const api = hubspotApi();
  const after = (page - 1) * pageSize;

  const body: Record<string, unknown> = {
    filterGroups: [],
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
    properties,
    limit: pageSize,
    after,
  };

  const { data } = await api.post(`/crm/v3/objects/${objectType}/search`, body);
  const rows = (data.results ?? []).map(flattenResult);
  const total = data.total ?? 0;

  return { rows, total };
}

/**
 * Get HubSpot contacts with pagination
 */
export async function getHubSpotContacts(
  page: number = 1,
  pageSize: number = 25,
  bypassCache: boolean = false
): Promise<HubSpotContactsResponse> {
  console.log("[HubSpot API] Querying contacts", { page, pageSize, bypassCache });

  const properties = await getPropertyNames("contacts");
  const { rows, total } = await fetchPage("contacts", page, pageSize, properties);
  const totalPages = Math.ceil(total / pageSize);

  console.log("[HubSpot API] Contacts query completed", {
    page,
    pageSize,
    totalResults: total,
    totalPages,
    resultsInPage: rows.length,
  });

  return {
    data: rows,
    pagination: { page, pageSize, totalResults: total, totalPages },
  };
}

/**
 * Get HubSpot deals with pagination.
 * Includes deal_stage_value derived from the dealstage property.
 */
export async function getHubSpotDeals(
  page: number = 1,
  pageSize: number = 25,
  bypassCache: boolean = false
): Promise<HubSpotDealsResponse> {
  console.log("[HubSpot API] Querying deals", { page, pageSize, bypassCache });

  const properties = await getPropertyNames("deals");
  const { rows, total } = await fetchPage("deals", page, pageSize, properties);

  const enriched = rows.map((row) => ({
    ...row,
    deal_stage_value: row.property_dealstage ?? null,
  }));

  const totalPages = Math.ceil(total / pageSize);

  console.log("[HubSpot API] Deals query completed", {
    page,
    pageSize,
    totalResults: total,
    totalPages,
    resultsInPage: enriched.length,
  });

  return {
    data: enriched,
    pagination: { page, pageSize, totalResults: total, totalPages },
  };
}
