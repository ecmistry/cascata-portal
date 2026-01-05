import { db } from '../config/database.js';
import { hubspotDeals, dealStage } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { parseHubSpotDate } from '../utils/date-utils.js';
import {
  getAllObjects,
  getRecentlyModifiedObjects,
  getAllProperties,
} from './hubspot-api.js';
import { hubspotConfig } from '../config/hubspot.js';
import {
  initializeSyncState,
  isFirstSync,
  getLastSyncTimestampWithBuffer,
  markSyncRunning,
  updateSyncState,
  markSyncFailed,
} from './sync-state.js';
import { syncConfig } from '../config/hubspot.js';
import { eq } from 'drizzle-orm';

interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    pipeline?: string;
    amount?: string;
    closedate?: string;
    createdate?: string;
    lastmodifieddate?: string;
    hs_lastmodifieddate?: string;
    hubspot_owner_id?: string;
    dealtype?: string;
    [key: string]: any;
  };
}

// Fetch all properties - HubSpot API will return all available properties
const DEAL_PROPERTIES = [
  'dealname',
  'dealstage',
  'pipeline',
  'amount',
  'closedate',
  'createdate',
  'lastmodifieddate',
  'hs_lastmodifieddate',
  'hubspot_owner_id',
  'dealtype',
  // User-requested properties
  'deal_geo_pods',
  'amount_in_home_currency',
  'type_of_sql_associated_to_deal',
  // Add any other common properties you need
];

/**
 * Transform HubSpot deal to database format
 */
function transformDeal(deal: HubSpotDeal) {
  const props = deal.properties;
  
  return {
    id: deal.id,
    dealname: props.dealname || null,
    dealstage: props.dealstage || null,
    pipeline: props.pipeline || null,
    amount: props.amount ? props.amount : null,
    closedate: parseHubSpotDate(props.closedate),
    createdate: parseHubSpotDate(props.createdate),
    lastmodifieddate: parseHubSpotDate(props.lastmodifieddate),
    hsLastmodifieddate: props.hs_lastmodifieddate ? parseInt(props.hs_lastmodifieddate) : null,
    hubspotOwnerId: props.hubspot_owner_id || null,
    dealtype: props.dealtype || null,
    propertiesJson: props,
    syncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Upsert deal stage into deal_stage table
 */
async function upsertDealStage(dealId: string, dealstage: string | null): Promise<void> {
  if (!dealstage) return;
  
  try {
    // Check if record exists
    const existing = await db.select().from(dealStage).where(eq(dealStage.dealId, dealId)).limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      await db.update(dealStage)
        .set({
          value: dealstage,
          updatedAt: new Date(),
        })
        .where(eq(dealStage.dealId, dealId));
    } else {
      // Insert new record
      await db.insert(dealStage).values({
        dealId,
        value: dealstage,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    logger.error(`Failed to upsert deal_stage for deal ${dealId}`, error);
    // Don't throw - this is not critical
  }
}

/**
 * Upsert deals into database
 */
async function upsertDeals(deals: HubSpotDeal[]): Promise<void> {
  if (deals.length === 0) return;
  
  logger.info(`Upserting ${deals.length} deals`);
  
  // Process in batches
  const batchSize = syncConfig.batchSize;
  
  for (let i = 0; i < deals.length; i += batchSize) {
    const batch = deals.slice(i, i + batchSize);
    const transformedBatch = batch.map(transformDeal);
    
    try {
      // Use INSERT ... ON DUPLICATE KEY UPDATE
      for (const deal of transformedBatch) {
        await db
          .insert(hubspotDeals)
          .values(deal)
          .onDuplicateKeyUpdate({
            set: {
              dealname: deal.dealname,
              dealstage: deal.dealstage,
              pipeline: deal.pipeline,
              amount: deal.amount,
              closedate: deal.closedate,
              createdate: deal.createdate,
              lastmodifieddate: deal.lastmodifieddate,
              hsLastmodifieddate: deal.hsLastmodifieddate,
              hubspotOwnerId: deal.hubspotOwnerId,
              dealtype: deal.dealtype,
              propertiesJson: deal.propertiesJson,
              syncedAt: deal.syncedAt,
              updatedAt: deal.updatedAt,
            },
          });
        
        // Also update deal_stage table
        await upsertDealStage(deal.id, deal.dealstage);
      }
      
      logger.debug(`Upserted batch of ${batch.length} deals`);
    } catch (error) {
      logger.error(`Failed to upsert deals batch`, error);
      throw error;
    }
  }
}

/**
 * Fetch deals in batches and process them immediately to reduce memory usage
 * This replicates the getAllObjects logic but processes batches as they're fetched
 * Also avoids URL length issues when fetching many properties
 */
async function fetchAndProcessDealsInBatches(
  properties: string[],
  batchCallback: (deals: HubSpotDeal[]) => Promise<void>
): Promise<number> {
  let totalCount = 0;
  let after: string | undefined;
  const safeLimit = 50; // HubSpot API safe limit
  
  // Rate limiting tracker (simplified version)
  const rateLimitRequests: number[] = [];
  const rateLimitWindowMs = 10000; // 10 seconds
  const maxRequestsPerWindow = 100;
  
  async function makeRequestWithRetry<T>(url: string, options?: RequestInit, retries = 3): Promise<T> {
    // Simple rate limiting check
    const now = Date.now();
    const windowStart = now - rateLimitWindowMs;
    rateLimitRequests.push(now);
    rateLimitRequests.splice(0, rateLimitRequests.findIndex(t => t > windowStart));
    
    if (rateLimitRequests.length >= maxRequestsPerWindow) {
      const waitTime = rateLimitRequests[0] + rateLimitWindowMs - now;
      if (waitTime > 0) {
        logger.warn(`Rate limit approaching, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
    
    const headers = {
      'Authorization': `Bearer ${hubspotConfig.apiKey}`,
      'Content-Type': 'application/json',
    };
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, { 
          ...options,
          headers: {
            ...headers,
            ...(options?.headers || {}),
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HubSpot API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return await response.json() as T;
      } catch (error) {
        logger.warn(`Request failed (attempt ${attempt + 1}/${retries})`, { url, error });
        
        if (attempt === retries - 1) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Max retries exceeded');
  }
  
  do {
    // Use POST search endpoint to avoid URL length issues with many properties
    const url = `${hubspotConfig.baseUrl}/crm/v3/objects/deals/search`;
    
    const body = {
      filterGroups: [], // Empty filter to get all deals
      properties: properties,
      sorts: [
        {
          propertyName: 'hs_lastmodifieddate',
          direction: 'ASCENDING',
        },
      ],
      limit: safeLimit,
      after: after,
    };
    
    const response = await makeRequestWithRetry<{
      results: HubSpotDeal[];
      paging?: { next?: { after: string } };
    }>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    
    const batch = response.results;
    if (batch.length > 0) {
      await batchCallback(batch);
      totalCount += batch.length;
      logger.info(`Fetched and processed ${batch.length} deals, total: ${totalCount}`);
    }
    
    after = response.paging?.next?.after;
  } while (after);
  
  return totalCount;
}

/**
 * Perform full sync of all deals
 * This will replace all existing data by deleting old records first
 * Deals are processed in batches to reduce memory usage and avoid URL length issues
 */
async function fullSync(): Promise<number> {
  logger.info('Starting full sync of deals');
  
  // Delete all existing deals and deal_stage records first to ensure complete replacement
  logger.info('Deleting all existing deals and deal_stage records to replace with fresh data');
  await db.delete(dealStage);
  await db.delete(hubspotDeals);
  logger.info('All existing deals and deal_stage records deleted');
  
  // Fetch all available properties from HubSpot
  const allProperties = await getAllProperties('deals');
  const propertiesToFetch = allProperties.length > 0 ? allProperties : DEAL_PROPERTIES;
  
  logger.info(`Fetching deals with ${propertiesToFetch.length} properties (processing in batches)`);
  
  // Fetch and process deals in batches to reduce memory usage and avoid URL length issues
  const totalCount = await fetchAndProcessDealsInBatches(
    propertiesToFetch,
    async (batch) => {
      await upsertDeals(batch);
    }
  );
  
  logger.info(`Full sync completed: ${totalCount} deals`);
  return totalCount;
}

/**
 * Perform incremental sync of modified deals
 */
async function incrementalSync(sinceTimestamp: number): Promise<number> {
  logger.info('Starting incremental sync of deals', { sinceTimestamp });
  
  // Fetch all available properties from HubSpot
  const allProperties = await getAllProperties('deals');
  const propertiesToFetch = allProperties.length > 0 ? allProperties : DEAL_PROPERTIES;
  
  logger.info(`Fetching modified deals with ${propertiesToFetch.length} properties`);
  
  const deals = await getRecentlyModifiedObjects<HubSpotDeal>(
    'deals',
    propertiesToFetch,
    sinceTimestamp
  );
  
  await upsertDeals(deals);
  
  logger.info(`Incremental sync completed: ${deals.length} deals`);
  return deals.length;
}

/**
 * Sync deals from HubSpot to MariaDB
 */
export async function syncDeals(): Promise<void> {
  const objectType = 'deals';
  
  try {
    logger.info('=== Starting deals sync ===');
    
    // Initialize sync state if needed
    await initializeSyncState(objectType);
    
    // Mark sync as running
    await markSyncRunning(objectType);
    
    // Check if this is the first sync
    const firstSync = await isFirstSync(objectType);
    
    let recordsSynced: number;
    let syncType: 'full' | 'incremental' = 'full';
    
    if (firstSync) {
      syncType = 'full';
      recordsSynced = await fullSync();
      logger.info(`[INCREMENTAL SYNC REPORT] Deals: ${recordsSynced} records synced (FULL SYNC)`);
    } else {
      const lastSyncTimestamp = await getLastSyncTimestampWithBuffer(
        objectType,
        syncConfig.bufferMinutes
      );
      
      if (lastSyncTimestamp) {
        syncType = 'incremental';
        recordsSynced = await incrementalSync(lastSyncTimestamp);
        logger.info(`[INCREMENTAL SYNC REPORT] Deals: ${recordsSynced} records synced (INCREMENTAL - since ${new Date(lastSyncTimestamp).toISOString()})`);
      } else {
        // Fallback to full sync if timestamp is missing
        syncType = 'full';
        recordsSynced = await fullSync();
        logger.info(`[INCREMENTAL SYNC REPORT] Deals: ${recordsSynced} records synced (FULL SYNC - no timestamp)`);
      }
    }
    
    // Update sync state
    await updateSyncState(objectType, recordsSynced, 'success');
    
    logger.info('=== Deals sync completed successfully ===', { recordsSynced, syncType });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markSyncFailed(objectType, errorMessage);
    logger.error('=== Deals sync failed ===', error);
    throw error;
  }
}
