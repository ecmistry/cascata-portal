import cron from 'node-cron';
import { syncContacts } from './services/contacts-sync.js';
import { syncDeals } from './services/deals-sync.js';
import { syncPipelines } from './services/pipelines-sync.js';
import { logger } from './utils/logger.js';
import { syncConfig } from './config/hubspot.js';

let isContactsSyncing = false;
let isDealsSyncing = false;
let isPipelinesSyncing = false;

/**
 * Sync contacts with lock to prevent concurrent runs
 */
async function syncContactsWithLock(): Promise<void> {
  if (isContactsSyncing) {
    logger.warn('Contacts sync already running, skipping this run');
    return;
  }
  
  isContactsSyncing = true;
  
  try {
    await syncContacts();
  } catch (error) {
    logger.error('Contacts sync failed', error);
  } finally {
    isContactsSyncing = false;
  }
}

/**
 * Sync deals with lock to prevent concurrent runs
 */
async function syncDealsWithLock(): Promise<void> {
  if (isDealsSyncing) {
    logger.warn('Deals sync already running, skipping this run');
    return;
  }
  
  isDealsSyncing = true;
  
  try {
    await syncDeals();
  } catch (error) {
    logger.error('Deals sync failed', error);
  } finally {
    isDealsSyncing = false;
  }
}

/**
 * Sync pipelines with lock to prevent concurrent runs
 */
async function syncPipelinesWithLock(): Promise<void> {
  if (isPipelinesSyncing) {
    logger.warn('Pipelines sync already running, skipping this run');
    return;
  }
  
  isPipelinesSyncing = true;
  
  try {
    await syncPipelines();
  } catch (error) {
    logger.error('Pipelines sync failed', error);
  } finally {
    isPipelinesSyncing = false;
  }
}

/**
 * Start the scheduler
 */
export function startScheduler(): void {
  const intervalMinutes = syncConfig.intervalMinutes;
  
  logger.info(`Starting scheduler with ${intervalMinutes}-minute interval`);
  
  // Create cron expression for the specified interval
  const cronExpression = `*/${intervalMinutes} * * * *`;
  
  // Schedule contacts sync at minute 0 of each interval
  cron.schedule(cronExpression, async () => {
    logger.info('Scheduler triggered: Starting contacts sync');
    await syncContactsWithLock();
  });
  
  // Schedule deals sync at minute 5 of each interval (staggered to avoid rate limits)
  const dealsOffset = Math.min(5, Math.floor(intervalMinutes / 3));
  const dealsCronExpression = `${dealsOffset},${dealsOffset + intervalMinutes},${dealsOffset + intervalMinutes * 2} * * * *`;
  
  cron.schedule(dealsCronExpression, async () => {
    logger.info('Scheduler triggered: Starting deals sync');
    await syncDealsWithLock();
  });
  
  // Schedule pipelines sync at minute 10 of each interval (staggered)
  const pipelinesOffset = Math.min(10, Math.floor((intervalMinutes * 2) / 3));
  const pipelinesCronExpression = `${pipelinesOffset},${pipelinesOffset + intervalMinutes},${pipelinesOffset + intervalMinutes * 2} * * * *`;
  
  cron.schedule(pipelinesCronExpression, async () => {
    logger.info('Scheduler triggered: Starting pipelines sync');
    await syncPipelinesWithLock();
  });
  
  logger.info('Scheduler started successfully');
  logger.info(`Contacts sync: ${cronExpression}`);
  logger.info(`Deals sync: ${dealsCronExpression}`);
  logger.info(`Pipelines sync: ${pipelinesCronExpression}`);
}

/**
 * Run all syncs once immediately
 */
export async function runAllSyncsOnce(): Promise<void> {
  logger.info('Running all syncs once...');
  
  try {
    await syncContactsWithLock();
    
    // Wait a bit to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await syncDealsWithLock();
    
    // Wait a bit to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await syncPipelinesWithLock();
    
    logger.info('All syncs completed');
  } catch (error) {
    logger.error('Error running syncs', error);
    throw error;
  }
}
