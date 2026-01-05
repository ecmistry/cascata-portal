import { db } from '../config/database.js';
import { hubspotDealPipelines, hubspotDealStages } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { parseHubSpotDate } from '../utils/date-utils.js';
import { getPipelines } from './hubspot-api.js';
import {
  initializeSyncState,
  markSyncRunning,
  updateSyncState,
  markSyncFailed,
} from './sync-state.js';

interface HubSpotPipeline {
  id: string;
  label: string;
  displayOrder: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  stages: HubSpotStage[];
}

interface HubSpotStage {
  id: string;
  label: string;
  displayOrder: number;
  metadata?: {
    probability?: string;
    isClosed?: string;
    [key: string]: any;
  };
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Transform HubSpot pipeline to database format
 */
function transformPipeline(pipeline: HubSpotPipeline) {
  return {
    id: pipeline.id,
    label: pipeline.label,
    displayOrder: pipeline.displayOrder,
    active: pipeline.active !== false,
    createdAtHubspot: parseHubSpotDate(pipeline.createdAt),
    updatedAtHubspot: parseHubSpotDate(pipeline.updatedAt),
    syncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Transform HubSpot stage to database format
 */
function transformStage(stage: HubSpotStage, pipelineId: string) {
  return {
    id: stage.id,
    pipelineId,
    label: stage.label,
    displayOrder: stage.displayOrder,
    metadataJson: stage.metadata || null,
    active: stage.active !== false,
    createdAtHubspot: parseHubSpotDate(stage.createdAt),
    updatedAtHubspot: parseHubSpotDate(stage.updatedAt),
    syncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Upsert pipelines into database
 */
async function upsertPipelines(pipelines: HubSpotPipeline[]): Promise<void> {
  if (pipelines.length === 0) return;
  
  logger.info(`Upserting ${pipelines.length} pipelines`);
  
  for (const pipeline of pipelines) {
    const transformedPipeline = transformPipeline(pipeline);
    
    try {
      await db
        .insert(hubspotDealPipelines)
        .values(transformedPipeline)
        .onDuplicateKeyUpdate({
          set: {
            label: transformedPipeline.label,
            displayOrder: transformedPipeline.displayOrder,
            active: transformedPipeline.active,
            createdAtHubspot: transformedPipeline.createdAtHubspot,
            updatedAtHubspot: transformedPipeline.updatedAtHubspot,
            syncedAt: transformedPipeline.syncedAt,
            updatedAt: transformedPipeline.updatedAt,
          },
        });
      
      logger.debug(`Upserted pipeline: ${pipeline.label}`);
    } catch (error) {
      logger.error(`Failed to upsert pipeline ${pipeline.id}`, error);
      throw error;
    }
  }
}

/**
 * Upsert stages into database
 */
async function upsertStages(pipelines: HubSpotPipeline[]): Promise<void> {
  let totalStages = 0;
  
  for (const pipeline of pipelines) {
    if (!pipeline.stages || pipeline.stages.length === 0) continue;
    
    for (const stage of pipeline.stages) {
      const transformedStage = transformStage(stage, pipeline.id);
      
      try {
        await db
          .insert(hubspotDealStages)
          .values(transformedStage)
          .onDuplicateKeyUpdate({
            set: {
              pipelineId: transformedStage.pipelineId,
              label: transformedStage.label,
              displayOrder: transformedStage.displayOrder,
              metadataJson: transformedStage.metadataJson,
              active: transformedStage.active,
              createdAtHubspot: transformedStage.createdAtHubspot,
              updatedAtHubspot: transformedStage.updatedAtHubspot,
              syncedAt: transformedStage.syncedAt,
              updatedAt: transformedStage.updatedAt,
            },
          });
        
        totalStages++;
      } catch (error) {
        logger.error(`Failed to upsert stage ${stage.id}`, error);
        throw error;
      }
    }
  }
  
  logger.info(`Upserted ${totalStages} stages`);
}

/**
 * Sync deal pipelines and stages from HubSpot to MariaDB
 */
export async function syncPipelines(): Promise<void> {
  const objectType = 'deal_pipelines';
  
  try {
    logger.info('=== Starting pipelines sync ===');
    
    // Initialize sync state if needed
    await initializeSyncState(objectType);
    
    // Mark sync as running
    await markSyncRunning(objectType);
    
    // Get all pipelines (pipelines are relatively static, so we always do full refresh)
    const pipelines = await getPipelines('deals');
    
    logger.info(`Fetched ${pipelines.length} pipelines from HubSpot`);
    
    // Upsert pipelines
    await upsertPipelines(pipelines);
    
    // Upsert stages
    await upsertStages(pipelines);
    
    // Count total stages
    const totalStages = pipelines.reduce((sum, p) => sum + (p.stages?.length || 0), 0);
    const totalRecords = pipelines.length + totalStages;
    
    // Update sync state
    await updateSyncState(objectType, totalRecords, 'success');
    
    logger.info('=== Pipelines sync completed successfully ===', {
      pipelines: pipelines.length,
      stages: totalStages,
      totalRecords,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markSyncFailed(objectType, errorMessage);
    logger.error('=== Pipelines sync failed ===', error);
    throw error;
  }
}
