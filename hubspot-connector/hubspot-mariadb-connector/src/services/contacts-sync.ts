import { db } from '../config/database.js';
import { hubspotContacts } from '../db/schema.js';
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

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    website?: string;
    lifecyclestage?: string;
    jobtitle?: string;
    createdate?: string;
    lastmodifieddate?: string;
    hs_lastmodifieddate?: string;
    [key: string]: any;
  };
}

// Fetch all properties - HubSpot API will return all available properties
// We'll request common ones explicitly, but the API returns all properties by default
const CONTACT_PROPERTIES = [
  'email',
  'firstname',
  'lastname',
  'phone',
  'company',
  'website',
  'lifecyclestage',
  'jobtitle',
  'createdate',
  'lastmodifieddate',
  'hs_lastmodifieddate',
  // User-requested properties
  'admin___first_became_a_sql_date',
  'admin_pod',
  'sql_type',
  'admin___first_became_an_opportunity_date',
  // Add any other common properties you need
];

/**
 * Transform HubSpot contact to database format
 */
function transformContact(contact: HubSpotContact) {
  const props = contact.properties;
  
  return {
    id: contact.id,
    email: props.email || null,
    firstname: props.firstname || null,
    lastname: props.lastname || null,
    phone: props.phone || null,
    company: props.company || null,
    website: props.website || null,
    lifecyclestage: props.lifecyclestage || null,
    jobtitle: props.jobtitle || null,
    createdate: parseHubSpotDate(props.createdate),
    lastmodifieddate: parseHubSpotDate(props.lastmodifieddate),
    hsLastmodifieddate: props.hs_lastmodifieddate ? parseInt(props.hs_lastmodifieddate) : null,
    propertiesJson: props,
    syncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Upsert contacts into database
 */
async function upsertContacts(contacts: HubSpotContact[]): Promise<void> {
  if (contacts.length === 0) return;
  
  logger.info(`Upserting ${contacts.length} contacts`);
  
  // Process in batches
  const batchSize = syncConfig.batchSize;
  
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const transformedBatch = batch.map(transformContact);
    
    try {
      // Use INSERT ... ON DUPLICATE KEY UPDATE
      for (const contact of transformedBatch) {
        await db
          .insert(hubspotContacts)
          .values(contact)
          .onDuplicateKeyUpdate({
            set: {
              email: contact.email,
              firstname: contact.firstname,
              lastname: contact.lastname,
              phone: contact.phone,
              company: contact.company,
              website: contact.website,
              lifecyclestage: contact.lifecyclestage,
              jobtitle: contact.jobtitle,
              createdate: contact.createdate,
              lastmodifieddate: contact.lastmodifieddate,
              hsLastmodifieddate: contact.hsLastmodifieddate,
              propertiesJson: contact.propertiesJson,
              syncedAt: contact.syncedAt,
              updatedAt: contact.updatedAt,
            },
          });
      }
      
      logger.debug(`Upserted batch of ${batch.length} contacts`);
    } catch (error) {
      logger.error(`Failed to upsert contacts batch`, error);
      throw error;
    }
  }
}

/**
 * Fetch contacts in batches and process them immediately to reduce memory usage
 * This replicates the getAllObjects logic but processes batches as they're fetched
 */
async function fetchAndProcessContactsInBatches(
  properties: string[],
  batchCallback: (contacts: HubSpotContact[]) => Promise<void>
): Promise<number> {
  let totalCount = 0;
  let after: string | undefined;
  const safeLimit = 50; // HubSpot API safe limit
  
  // Rate limiting tracker (simplified version)
  const rateLimitRequests: number[] = [];
  const rateLimitWindowMs = 10000; // 10 seconds
  const maxRequestsPerWindow = 100;
  
  async function makeRequestWithRetry<T>(url: string, retries = 3): Promise<T> {
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
        const response = await fetch(url, { headers });
        
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
    const url = new URL(`${hubspotConfig.baseUrl}/crm/v3/objects/contacts`);
    url.searchParams.set('limit', safeLimit.toString());
    url.searchParams.set('properties', properties.join(','));
    
    if (after) {
      url.searchParams.set('after', after);
    }
    
    const response = await makeRequestWithRetry<{
      results: HubSpotContact[];
      paging?: { next?: { after: string } };
    }>(url.toString());
    
    const batch = response.results;
    if (batch.length > 0) {
      await batchCallback(batch);
      totalCount += batch.length;
      logger.info(`Fetched and processed ${batch.length} contacts, total: ${totalCount}`);
    }
    
    after = response.paging?.next?.after;
  } while (after);
  
  return totalCount;
}

/**
 * Perform full sync of all contacts
 * This will replace all existing data by deleting old records first
 * Contacts are processed in batches to reduce memory usage
 */
async function fullSync(): Promise<number> {
  logger.info('Starting full sync of contacts');
  
  // Delete all existing contacts first to ensure complete replacement
  logger.info('Deleting all existing contacts to replace with fresh data');
  await db.delete(hubspotContacts);
  logger.info('All existing contacts deleted');
  
  // Fetch all available properties from HubSpot
  const allProperties = await getAllProperties('contacts');
  const propertiesToFetch = allProperties.length > 0 ? allProperties : CONTACT_PROPERTIES;
  
  logger.info(`Fetching contacts with ${propertiesToFetch.length} properties (processing in batches)`);
  
  // Fetch and process contacts in batches to reduce memory usage
  const totalCount = await fetchAndProcessContactsInBatches(
    propertiesToFetch,
    async (batch) => {
      await upsertContacts(batch);
    }
  );
  
  logger.info(`Full sync completed: ${totalCount} contacts`);
  return totalCount;
}

/**
 * Perform incremental sync of modified contacts
 */
async function incrementalSync(sinceTimestamp: number): Promise<number> {
  logger.info('Starting incremental sync of contacts', { sinceTimestamp });
  
  // Fetch all available properties from HubSpot
  const allProperties = await getAllProperties('contacts');
  const propertiesToFetch = allProperties.length > 0 ? allProperties : CONTACT_PROPERTIES;
  
  logger.info(`Fetching modified contacts with ${propertiesToFetch.length} properties`);
  
  const contacts = await getRecentlyModifiedObjects<HubSpotContact>(
    'contacts',
    propertiesToFetch,
    sinceTimestamp
  );
  
  await upsertContacts(contacts);
  
  logger.info(`Incremental sync completed: ${contacts.length} contacts`);
  return contacts.length;
}

/**
 * Sync contacts from HubSpot to MariaDB
 */
export async function syncContacts(): Promise<void> {
  const objectType = 'contacts';
  
  try {
    logger.info('=== Starting contacts sync ===');
    
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
      logger.info(`[INCREMENTAL SYNC REPORT] Contacts: ${recordsSynced} records synced (FULL SYNC)`);
    } else {
      const lastSyncTimestamp = await getLastSyncTimestampWithBuffer(
        objectType,
        syncConfig.bufferMinutes
      );
      
      if (lastSyncTimestamp) {
        syncType = 'incremental';
        recordsSynced = await incrementalSync(lastSyncTimestamp);
        logger.info(`[INCREMENTAL SYNC REPORT] Contacts: ${recordsSynced} records synced (INCREMENTAL - since ${new Date(lastSyncTimestamp).toISOString()})`);
      } else {
        // Fallback to full sync if timestamp is missing
        syncType = 'full';
        recordsSynced = await fullSync();
        logger.info(`[INCREMENTAL SYNC REPORT] Contacts: ${recordsSynced} records synced (FULL SYNC - no timestamp)`);
      }
    }
    
    // Update sync state
    await updateSyncState(objectType, recordsSynced, 'success');
    
    logger.info('=== Contacts sync completed successfully ===', { recordsSynced, syncType });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markSyncFailed(objectType, errorMessage);
    logger.error('=== Contacts sync failed ===', error);
    throw error;
  }
}
