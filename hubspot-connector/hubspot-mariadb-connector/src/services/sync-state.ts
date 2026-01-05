import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { syncState } from '../db/schema.js';
import { getCurrentTimestamp, timestampToDate } from '../utils/date-utils.js';
import { logger } from '../utils/logger.js';

export type ObjectType = 'contacts' | 'deals' | 'deal_pipelines';
export type SyncStatus = 'success' | 'failed' | 'running';

export interface SyncStateRecord {
  id: number;
  objectType: ObjectType;
  lastSyncTimestamp: number | null;
  lastSyncDate: Date | null;
  status: SyncStatus;
  recordsSynced: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get sync state for an object type
 */
export async function getSyncState(objectType: ObjectType): Promise<SyncStateRecord | null> {
  try {
    const result = await db
      .select()
      .from(syncState)
      .where(eq(syncState.objectType, objectType))
      .limit(1);
    
    return (result[0] as SyncStateRecord) || null;
  } catch (error) {
    logger.error(`Failed to get sync state for ${objectType}`, error);
    throw error;
  }
}

/**
 * Initialize sync state for an object type
 */
export async function initializeSyncState(objectType: ObjectType): Promise<void> {
  try {
    const existing = await getSyncState(objectType);
    
    if (!existing) {
      await db.insert(syncState).values({
        objectType,
        lastSyncTimestamp: null,
        lastSyncDate: null,
        status: 'success',
        recordsSynced: 0,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      logger.info(`Initialized sync state for ${objectType}`);
    }
  } catch (error) {
    logger.error(`Failed to initialize sync state for ${objectType}`, error);
    throw error;
  }
}

/**
 * Update sync state after successful sync
 */
export async function updateSyncState(
  objectType: ObjectType,
  recordsSynced: number,
  status: SyncStatus = 'success',
  errorMessage: string | null = null
): Promise<void> {
  try {
    const now = getCurrentTimestamp();
    const nowDate = timestampToDate(now);
    
    await db
      .update(syncState)
      .set({
        lastSyncTimestamp: now,
        lastSyncDate: nowDate,
        status,
        recordsSynced,
        errorMessage,
        updatedAt: nowDate,
      })
      .where(eq(syncState.objectType, objectType));
    
    logger.info(`Updated sync state for ${objectType}`, {
      status,
      recordsSynced,
      timestamp: now,
    });
  } catch (error) {
    logger.error(`Failed to update sync state for ${objectType}`, error);
    throw error;
  }
}

/**
 * Mark sync as running
 */
export async function markSyncRunning(objectType: ObjectType): Promise<void> {
  try {
    await db
      .update(syncState)
      .set({
        status: 'running',
        updatedAt: new Date(),
      })
      .where(eq(syncState.objectType, objectType));
    
    logger.debug(`Marked sync as running for ${objectType}`);
  } catch (error) {
    logger.error(`Failed to mark sync as running for ${objectType}`, error);
    throw error;
  }
}

/**
 * Mark sync as failed
 */
export async function markSyncFailed(
  objectType: ObjectType,
  errorMessage: string
): Promise<void> {
  try {
    await db
      .update(syncState)
      .set({
        status: 'failed',
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(syncState.objectType, objectType));
    
    logger.error(`Marked sync as failed for ${objectType}`, { errorMessage });
  } catch (error) {
    logger.error(`Failed to mark sync as failed for ${objectType}`, error);
    throw error;
  }
}

/**
 * Check if this is the first sync for an object type
 */
export async function isFirstSync(objectType: ObjectType): Promise<boolean> {
  const state = await getSyncState(objectType);
  return !state || state.lastSyncTimestamp === null;
}

/**
 * Get last sync timestamp with buffer
 */
export async function getLastSyncTimestampWithBuffer(
  objectType: ObjectType,
  bufferMinutes: number
): Promise<number | null> {
  const state = await getSyncState(objectType);
  
  if (!state || state.lastSyncTimestamp === null) {
    return null;
  }
  
  // Subtract buffer to catch any records that might have been missed
  return state.lastSyncTimestamp - (bufferMinutes * 60 * 1000);
}
