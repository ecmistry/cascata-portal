/**
 * BigQuery Playground Functions for Cascata Test Dashboard
 * Functions to query HubSpot contacts and deals from BigQuery
 */

import { BigQuery } from "@google-cloud/bigquery";
import * as fs from "fs";
import * as path from "path";

// Default BigQuery configuration for playground
const DEFAULT_PROJECT_ID = "reporting-299920";
const DEFAULT_DATASET_ID = "hubspot";
const CREDENTIALS_PATH = path.resolve(process.cwd(), "credentials", "reporting-299920-803fa8e5405b.json");

/**
 * BigQuery Row type - can contain any fields
 */
export type BigQueryRow = {
  [key: string]: unknown;
};

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalResults: number;
    totalPages: number;
  };
}

/**
 * Create BigQuery client with default credentials
 */
function createPlaygroundBigQueryClient(): BigQuery {
  let credentials: object | undefined;
  
  if (fs.existsSync(CREDENTIALS_PATH)) {
    try {
      const credsContent = fs.readFileSync(CREDENTIALS_PATH, "utf8");
      credentials = JSON.parse(credsContent);
    } catch (error) {
      console.error("[BigQuery Playground] Failed to load credentials:", error);
      throw new Error("Failed to load BigQuery credentials");
    }
  } else {
    // Try to use default credentials from environment
    console.warn("[BigQuery Playground] Credentials file not found, using default credentials");
  }

  return new BigQuery({
    projectId: DEFAULT_PROJECT_ID,
    credentials,
  });
}

/**
 * Normalize BigQuery rows to handle BigQuery types (dates, timestamps, etc.)
 */
export function normalizeBigQueryRows<T extends BigQueryRow>(rows: T[]): T[] {
  return rows.map((row) => {
    const normalized: BigQueryRow = {};
    for (const [key, value] of Object.entries(row)) {
      // Handle BigQuery Date objects
      if (value && typeof value === "object" && "value" in value && "constructor" in value && value.constructor.name === "Date") {
        normalized[key] = (value as Date).toISOString();
      }
      // Handle BigQuery Timestamp objects
      else if (value && typeof value === "object" && "value" in value && "constructor" in value && value.constructor.name === "Timestamp") {
        normalized[key] = (value as { value: string }).value;
      }
      // Handle BigQuery BigNumeric/BigDecimal
      else if (value && typeof value === "object" && "value" in value && typeof (value as { value: unknown }).value === "string") {
        const numValue = parseFloat((value as { value: string }).value);
        normalized[key] = isNaN(numValue) ? (value as { value: string }).value : numValue;
      }
      // Handle nested objects recursively
      else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        normalized[key] = normalizeBigQueryRows([value as T])[0] || value;
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        normalized[key] = value.map((item) => 
          item && typeof item === "object" && !Array.isArray(item) && !(item instanceof Date)
            ? normalizeBigQueryRows([item as T])[0] || item
            : item
        );
      }
      // Keep primitive values as-is
      else {
        normalized[key] = value;
      }
    }
    return normalized as T;
  });
}

/**
 * Paginate a BigQuery query with LIMIT and OFFSET
 */
export async function paginateQueryWithLimit<T extends BigQueryRow>(
  queryString: string,
  options: PaginationOptions,
  bypassCache: boolean = false
): Promise<PaginatedResult<T>> {
  const { page, pageSize } = options;
  const offset = (page - 1) * pageSize;

  const client = createPlaygroundBigQueryClient();

  // First, get total count
  const countQuery = `SELECT COUNT(*) as total FROM (${queryString})`;
  const [countResult] = await client.query({ query: countQuery, useLegacySql: false });
  const totalResults = Number((countResult[0] as { total: number }).total) || 0;
  const totalPages = Math.ceil(totalResults / pageSize);

  // Then, get paginated results
  const paginatedQuery = `${queryString} LIMIT ${pageSize} OFFSET ${offset}`;
  const [rows] = await client.query({ 
    query: paginatedQuery, 
    useLegacySql: false,
    useQueryCache: !bypassCache,
  });

  return {
    data: rows as T[],
    pagination: {
      page,
      pageSize,
      totalResults,
      totalPages,
    },
  };
}

/**
 * HubSpot Contact interface
 */
export interface HubSpotContact extends BigQueryRow {
  [key: string]: unknown;
}

export interface HubSpotContactsResponse extends PaginatedResult<HubSpotContact> {}

/**
 * Get HubSpot contacts with pagination
 * Filters out deleted contacts (_fivetran_deleted = false)
 */
export async function getHubSpotContacts(
  page: number = 1,
  pageSize: number = 25,
  bypassCache: boolean = false
): Promise<HubSpotContactsResponse> {
  try {
    console.log("[BigQuery Playground] Querying HubSpot contacts", { page, pageSize, bypassCache });

    const queryString = `
      SELECT *
      FROM \`${DEFAULT_PROJECT_ID}.${DEFAULT_DATASET_ID}.contact\`
      WHERE _fivetran_deleted = false
    `;

    const result = await paginateQueryWithLimit<HubSpotContact>(
      queryString,
      { page, pageSize },
      bypassCache
    );

    // Normalize rows to handle BigQuery types
    const normalizedData = normalizeBigQueryRows(result.data);

    console.log("[BigQuery Playground] HubSpot contacts query completed", {
      page: result.pagination.page,
      pageSize: result.pagination.pageSize,
      totalResults: result.pagination.totalResults,
      totalPages: result.pagination.totalPages,
      resultsInPage: normalizedData.length,
    });

    return {
      data: normalizedData,
      pagination: result.pagination,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[BigQuery Playground] Error in getHubSpotContacts", err);
    throw err;
  }
}

/**
 * HubSpot Deal interface
 */
export interface HubSpotDeal extends BigQueryRow {
  [key: string]: unknown;
  deal_stage_value?: string; // Added for the joined field
}

export interface HubSpotDealsResponse extends PaginatedResult<HubSpotDeal> {}

/**
 * Get HubSpot deals with pagination
 * Includes LEFT JOIN with deal_stage table to get deal_stage_value
 */
export async function getHubSpotDeals(
  page: number = 1,
  pageSize: number = 25,
  bypassCache: boolean = false
): Promise<HubSpotDealsResponse> {
  try {
    console.log("[BigQuery Playground] Querying HubSpot deals with deal_stage join", { page, pageSize, bypassCache });

    const queryString = `
      SELECT
        d.*,
        ds.value AS deal_stage_value
      FROM \`${DEFAULT_PROJECT_ID}.${DEFAULT_DATASET_ID}.deal\` d
      LEFT JOIN \`${DEFAULT_PROJECT_ID}.${DEFAULT_DATASET_ID}.deal_stage\` ds
        ON d.deal_id = ds.deal_id
    `;

    const result = await paginateQueryWithLimit<HubSpotDeal>(
      queryString,
      { page, pageSize },
      bypassCache
    );

    // Normalize rows to handle BigQuery types
    const normalizedData = normalizeBigQueryRows(result.data);

    console.log("[BigQuery Playground] HubSpot deals query completed", {
      page: result.pagination.page,
      pageSize: result.pagination.pageSize,
      totalResults: result.pagination.totalResults,
      totalPages: result.pagination.totalPages,
      resultsInPage: normalizedData.length,
    });

    return {
      data: normalizedData,
      pagination: result.pagination,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[BigQuery Playground] Error in getHubSpotDeals", err);
    throw err;
  }
}

