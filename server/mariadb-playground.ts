/**
 * MariaDB Playground Functions for Cascata Test Dashboard
 * Functions to query HubSpot contacts and deals from MariaDB
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";
import { mysqlTable, varchar, bigint, datetime, text, int, decimal, json, boolean, index } from 'drizzle-orm/mysql-core';

// Import schema definitions directly (since we can't easily import from connector)
const hubspotContacts = mysqlTable('hubspot_contacts', {
  id: varchar('id', { length: 50 }).primaryKey(),
  email: varchar('email', { length: 255 }),
  firstname: varchar('firstname', { length: 255 }),
  lastname: varchar('lastname', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  company: varchar('company', { length: 255 }),
  website: varchar('website', { length: 255 }),
  lifecyclestage: varchar('lifecyclestage', { length: 100 }),
  jobtitle: varchar('jobtitle', { length: 255 }),
  createdate: datetime('createdate'),
  lastmodifieddate: datetime('lastmodifieddate'),
  hsLastmodifieddate: bigint('hs_lastmodifieddate', { mode: 'number' }),
  propertiesJson: json('properties_json'),
  syncedAt: datetime('synced_at').notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

const hubspotDeals = mysqlTable('hubspot_deals', {
  id: varchar('id', { length: 50 }).primaryKey(),
  dealname: varchar('dealname', { length: 255 }),
  dealstage: varchar('dealstage', { length: 100 }),
  pipeline: varchar('pipeline', { length: 100 }),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  closedate: datetime('closedate'),
  createdate: datetime('createdate'),
  lastmodifieddate: datetime('lastmodifieddate'),
  hsLastmodifieddate: bigint('hs_lastmodifieddate', { mode: 'number' }),
  hubspotOwnerId: varchar('hubspot_owner_id', { length: 50 }),
  dealtype: varchar('dealtype', { length: 100 }),
  propertiesJson: json('properties_json'),
  syncedAt: datetime('synced_at').notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

const dealStage = mysqlTable('deal_stage', {
  id: int('id').primaryKey().autoincrement(),
  dealId: varchar('deal_id', { length: 50 }).notNull(),
  stageId: varchar('stage_id', { length: 50 }),
  value: varchar('value', { length: 255 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Database connection
let db: ReturnType<typeof drizzle> | null = null;

function getDatabase() {
  if (!db) {
    // Parse DATABASE_URL if available, otherwise use individual env vars
    let connectionConfig: mysql.PoolOptions;
    
    if (process.env.DATABASE_URL) {
      // DATABASE_URL format: mysql://user:password@host:port/database
      const url = new URL(process.env.DATABASE_URL);
      connectionConfig = {
        host: url.hostname,
        port: parseInt(url.port || "3306"),
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading '/'
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };
    } else {
      connectionConfig = {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "3306"),
        user: process.env.DB_USER || "cascade_user",
        password: process.env.DB_PASSWORD || "cascade_password_2024",
        database: process.env.DB_NAME || "cascade_portal",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };
    }
    
    const connection = mysql.createPool(connectionConfig);
    db = drizzle(connection);
  }
  return db;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * Pagination result
 */
export interface PaginationResult {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationResult;
}

/**
 * HubSpot Contact interface
 */
export interface HubSpotContact {
  [key: string]: unknown;
}

/**
 * HubSpot Contact response
 */
export interface HubSpotContactsResponse extends PaginatedResult<HubSpotContact> {}

/**
 * HubSpot Deal interface
 */
export interface HubSpotDeal {
  [key: string]: unknown;
}

/**
 * HubSpot Deals response
 */
export interface HubSpotDealsResponse extends PaginatedResult<HubSpotDeal> {}

/**
 * Extract properties from JSON and flatten them
 * Removes 'property_' prefix from property names
 */
function extractProperties(row: any): any {
  const result: any = { ...row };
  
  // Extract properties from propertiesJson if it exists
  if (row.propertiesJson && typeof row.propertiesJson === 'object') {
    const props = row.propertiesJson;
    for (const [key, value] of Object.entries(props)) {
      // Remove 'property_' prefix if present, otherwise use key as-is
      const cleanKey = key.startsWith('property_') ? key.substring(9) : key;
      result[cleanKey] = value;
    }
  }
  
  // Remove propertiesJson from result as we've extracted it
  delete result.propertiesJson;
  
  return result;
}

/**
 * Get HubSpot contacts with pagination
 */
export async function getHubSpotContacts(
  page: number = 1,
  pageSize: number = 25,
  bypassCache: boolean = false
): Promise<HubSpotContactsResponse> {
  try {
    console.log("[MariaDB Playground] Querying HubSpot contacts", { page, pageSize, bypassCache });

    const db = getDatabase();
    const offset = (page - 1) * pageSize;

    // Get total count with timeout
    const totalResult = await Promise.race([
      db.select({ count: sql<number>`count(*)` }).from(hubspotContacts),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 10000))
    ]) as Array<{ count: number }>;
    
    const totalResults = Number(totalResult[0]?.count || 0);
    const totalPages = Math.ceil(totalResults / pageSize);

    // Get paginated results with timeout
    const rows = await Promise.race([
      db.select().from(hubspotContacts).limit(pageSize).offset(offset),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 10000))
    ]) as any[];

    // Extract properties from JSON and flatten
    const normalizedData = rows.map(extractProperties);

    console.log("[MariaDB Playground] HubSpot contacts query completed", {
      page,
      pageSize,
      totalResults,
      totalPages,
      resultsInPage: normalizedData.length,
    });

    return {
      data: normalizedData,
      pagination: {
        page,
        pageSize,
        totalResults,
        totalPages,
      },
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[MariaDB Playground] Error in getHubSpotContacts", err);
    throw err;
  }
}

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
    console.log("[MariaDB Playground] Querying HubSpot deals with deal_stage join", { page, pageSize, bypassCache });

    const db = getDatabase();
    const offset = (page - 1) * pageSize;

    // Get total count with join
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(hubspotDeals)
      .leftJoin(dealStage, sql`${hubspotDeals.id} = ${dealStage.dealId}`);
    
    const totalResults = Number(totalResult[0]?.count || 0);
    const totalPages = Math.ceil(totalResults / pageSize);

    // Get paginated results with join
    const rows = await db
      .select({
        deal: hubspotDeals,
        dealStageValue: dealStage.value,
      })
      .from(hubspotDeals)
      .leftJoin(dealStage, sql`${hubspotDeals.id} = ${dealStage.dealId}`)
      .limit(pageSize)
      .offset(offset);

    // Extract properties from JSON and flatten, add deal_stage_value
    const normalizedData = rows.map((row) => {
      const deal = extractProperties(row.deal);
      if (row.dealStageValue) {
        deal.deal_stage_value = row.dealStageValue;
      }
      return deal;
    });

    console.log("[MariaDB Playground] HubSpot deals query completed", {
      page,
      pageSize,
      totalResults,
      totalPages,
      resultsInPage: normalizedData.length,
    });

    return {
      data: normalizedData,
      pagination: {
        page,
        pageSize,
        totalResults,
        totalPages,
      },
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[MariaDB Playground] Error in getHubSpotDeals", err);
    throw err;
  }
}

/**
 * Get all available property keys from contacts JSON column
 * This queries a sample of records to extract all unique property keys
 */
export async function getAllContactPropertyKeys(): Promise<string[]> {
  try {
    console.log("[MariaDB Playground] Fetching all contact property keys");

    const db = getDatabase();
    
    // Query a sample of records to get all property keys
    // We'll query multiple records to ensure we get all properties
    const sampleSize = 100; // Sample 100 records to get all property keys
    const rows = await db.select({ propertiesJson: hubspotContacts.propertiesJson })
      .from(hubspotContacts)
      .limit(sampleSize) as Array<{ propertiesJson: any }>;

    const propertyKeysSet = new Set<string>();
    
    // Extract all property keys from the JSON
    rows.forEach((row) => {
      let props = row.propertiesJson;
      
      // Debug: log the type of propertiesJson
      if (rows.length > 0 && rows.indexOf(row) === 0) {
        console.log("[MariaDB Playground] propertiesJson type:", typeof props, "is object:", typeof props === 'object', "is array:", Array.isArray(props));
      }
      
      // Parse JSON if it's a string
      if (typeof props === 'string') {
        try {
          props = JSON.parse(props);
        } catch (e) {
          console.error("[MariaDB Playground] Failed to parse propertiesJson as JSON", e);
          return;
        }
      }
      
      if (props && typeof props === 'object' && !Array.isArray(props)) {
        const keys = Object.keys(props);
        if (rows.length > 0 && rows.indexOf(row) === 0) {
          console.log("[MariaDB Playground] Found keys in first row:", keys.length, "Sample:", keys.slice(0, 5));
        }
        keys.forEach((key) => {
          // Properties are stored without 'property_' prefix in JSON
          // But extractProperties removes it if present, so we match that behavior
          const cleanKey = key.startsWith('property_') ? key.substring(9) : key;
          propertyKeysSet.add(cleanKey);
        });
      }
    });

    // Also include standard database columns
    propertyKeysSet.add('id');
    propertyKeysSet.add('email');
    propertyKeysSet.add('firstname');
    propertyKeysSet.add('lastname');
    propertyKeysSet.add('phone');
    propertyKeysSet.add('company');
    propertyKeysSet.add('website');
    propertyKeysSet.add('lifecyclestage');
    propertyKeysSet.add('jobtitle');
    propertyKeysSet.add('createdate');
    propertyKeysSet.add('lastmodifieddate');
    propertyKeysSet.add('hsLastmodifieddate');
    propertyKeysSet.add('syncedAt');
    propertyKeysSet.add('createdAt');
    propertyKeysSet.add('updatedAt');

    const allKeys = Array.from(propertyKeysSet).sort();
    
    console.log("[MariaDB Playground] Found contact property keys", { count: allKeys.length });
    
    return allKeys;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[MariaDB Playground] Error in getAllContactPropertyKeys", err);
    throw err;
  }
}

/**
 * Get all available property keys from deals JSON column
 * This queries a sample of records to extract all unique property keys
 */
export async function getAllDealPropertyKeys(): Promise<string[]> {
  try {
    console.log("[MariaDB Playground] Fetching all deal property keys");

    const db = getDatabase();
    
    // Query a sample of records to get all property keys
    const sampleSize = 100; // Sample 100 records to get all property keys
    const rows = await db.select({ propertiesJson: hubspotDeals.propertiesJson })
      .from(hubspotDeals)
      .limit(sampleSize) as Array<{ propertiesJson: any }>;

    const propertyKeysSet = new Set<string>();
    
    // Extract all property keys from the JSON
    if (rows.length > 0) {
      rows.forEach((row) => {
        let props = row.propertiesJson;
        
        // Debug: log the type of propertiesJson
        if (rows.indexOf(row) === 0) {
          console.log("[MariaDB Playground] Deal propertiesJson type:", typeof props, "is object:", typeof props === 'object', "is array:", Array.isArray(props));
        }
        
        // Parse JSON if it's a string
        if (typeof props === 'string') {
          try {
            props = JSON.parse(props);
          } catch (e) {
            console.error("[MariaDB Playground] Failed to parse propertiesJson as JSON", e);
            return;
          }
        }
        
        if (props && typeof props === 'object' && !Array.isArray(props)) {
          const keys = Object.keys(props);
          if (rows.indexOf(row) === 0) {
            console.log("[MariaDB Playground] Found keys in first deal row:", keys.length, "Sample:", keys.slice(0, 5));
          }
          keys.forEach((key) => {
            // Properties are stored without 'property_' prefix in JSON
            // But extractProperties removes it if present, so we match that behavior
            const cleanKey = key.startsWith('property_') ? key.substring(9) : key;
            propertyKeysSet.add(cleanKey);
          });
        }
      });
    } else {
      console.log("[MariaDB Playground] No deals found in database yet, returning standard columns only");
    }

    // Always include standard database columns
    propertyKeysSet.add('id');
    propertyKeysSet.add('dealname');
    propertyKeysSet.add('dealstage');
    propertyKeysSet.add('pipeline');
    propertyKeysSet.add('amount');
    propertyKeysSet.add('closedate');
    propertyKeysSet.add('createdate');
    propertyKeysSet.add('lastmodifieddate');
    propertyKeysSet.add('hsLastmodifieddate');
    propertyKeysSet.add('hubspotOwnerId');
    propertyKeysSet.add('dealtype');
    // deal_stage_value is added from the join in getHubSpotDeals, so include it in the column list
    propertyKeysSet.add('deal_stage_value');
    propertyKeysSet.add('syncedAt');
    propertyKeysSet.add('createdAt');
    propertyKeysSet.add('updatedAt');

    const allKeys = Array.from(propertyKeysSet).sort();
    
    console.log("[MariaDB Playground] Found deal property keys", { count: allKeys.length, fromDatabase: rows.length > 0 });
    
    return allKeys;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[MariaDB Playground] Error in getAllDealPropertyKeys", err);
    throw err;
  }
}

