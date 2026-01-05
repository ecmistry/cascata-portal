import dotenv from 'dotenv';
import { pool } from './config/database.js';
import { logger } from './utils/logger.js';
import { startScheduler, runAllSyncsOnce } from './scheduler.js';

// Load environment variables
dotenv.config();

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = ['HUBSPOT_API_KEY', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Test database connection
 */
async function testDatabaseConnection(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    logger.info('Database connection successful');
    connection.release();
  } catch (error) {
    logger.error('Database connection failed', error);
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await pool.end();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    logger.info('=================================================');
    logger.info('HubSpot to MariaDB Connector Starting...');
    logger.info('=================================================');
    
    // Validate environment
    validateEnvironment();
    logger.info('Environment variables validated');
    
    // Test database connection
    await testDatabaseConnection();
    
    // Check if we should run once or start scheduler
    const runOnce = process.argv.includes('--once');
    const disableScheduler = process.env.DISABLE_SCHEDULER === 'true' || process.env.DISABLE_SCHEDULER === '1';
    
    if (runOnce) {
      logger.info('Running in one-time sync mode');
      await runAllSyncsOnce();
      logger.info('One-time sync completed, exiting...');
      await pool.end();
      process.exit(0);
    } else {
      logger.info('Starting sync mode');
      
      // Run initial sync
      logger.info('Running initial sync...');
      await runAllSyncsOnce();
      
      // Start scheduler only if not disabled
      if (!disableScheduler) {
        startScheduler();
        logger.info('Scheduler enabled - automatic retries will run every 15 minutes');
      } else {
        logger.info('Scheduler DISABLED - automatic retries are turned off');
        logger.info('Current sync will continue, but no automatic retries will occur');
      }
      
      logger.info('=================================================');
      logger.info('HubSpot to MariaDB Connector Running');
      logger.info('Press Ctrl+C to stop');
      logger.info('=================================================');
    }
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Fatal error during startup', error);
    process.exit(1);
  }
}

// Run the application
main();
