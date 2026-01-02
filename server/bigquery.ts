import { BigQuery, type BigQueryOptions } from "@google-cloud/bigquery";
import { ERROR_MESSAGES } from '@shared/const';

export interface BigQueryConfig {
  projectId: string;
  datasetId: string;
  credentials?: string | object;
  tables: {
    sqlHistory?: string;
    conversionRates?: string;
    actuals?: string;
  };
}

export type SQLHistoryRow = {
  region: string;
  sql_type: string;
  year: number;
  quarter: number;
  volume: number;
};

export type ConversionRateRow = {
  region: string;
  sql_type: string;
  opp_coverage_ratio: number;
  win_rate_new: number;
  win_rate_upsell: number;
};

export type ActualRow = {
  year: number;
  quarter: number;
  region: string;
  sql_type: string;
  actual_revenue: number;
};

/**
 * Sanitize BigQuery identifier to prevent SQL injection
 * 
 * Note: Individual identifiers (projectId, datasetId, tableName) cannot contain dots.
 * Dots are only used in query templates to construct fully qualified names like `project.dataset.table`.
 * This ensures that user-provided identifiers cannot inject SQL through dot notation.
 */
function sanitizeIdentifier(identifier: string): string {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid identifier: must be a non-empty string');
  }
  
  // Only allow alphanumeric, underscore, and dash for security
  // Dots are NOT allowed in individual identifiers - they are hardcoded in query templates
  if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
    throw new Error(`Invalid identifier format: ${identifier}. Only alphanumeric, underscore, and dash are allowed.`);
  }
  
  // Additional length check
  if (identifier.length > 1024) {
    throw new Error('Identifier too long');
  }
  
  return identifier;
}

/**
 * Create BigQuery client from configuration
 */
export function createBigQueryClient(config: BigQueryConfig): BigQuery {
  if (!config.projectId) {
    throw new Error('BigQuery project ID is required');
  }

  const options: Partial<BigQueryOptions> = {
    projectId: sanitizeIdentifier(config.projectId),
  };

  if (config.credentials) {
    try {
      // Parse credentials JSON if it's a string
      const creds = typeof config.credentials === 'string' 
        ? JSON.parse(config.credentials) 
        : config.credentials;
      options.credentials = creds;
    } catch (error) {
      throw new Error('Invalid BigQuery credentials format');
    }
  }

  return new BigQuery(options);
}

/**
 * Sync historical SQL volumes from BigQuery
 * 
 * Expected BigQuery table schema:
 * - region: STRING (e.g., "North America", "EMESA North")
 * - sql_type: STRING (e.g., "Inbound", "Outbound", "ILO", "Event", "Partner")
 * - year: INTEGER (e.g., 2024)
 * - quarter: INTEGER (1-4)
 * - volume: INTEGER (number of SQLs)
 */
export async function syncSQLHistory(config: BigQueryConfig): Promise<SQLHistoryRow[]> {
  if (!config.tables.sqlHistory) {
    throw new Error('SQL History table not configured');
  }

  const client = createBigQueryClient(config);
  
  // Sanitize all identifiers to prevent SQL injection
  const projectId = sanitizeIdentifier(config.projectId);
  const datasetId = sanitizeIdentifier(config.datasetId);
  const tableName = sanitizeIdentifier(config.tables.sqlHistory);
  
  const query = `
    SELECT 
      region,
      sql_type,
      year,
      quarter,
      volume
    FROM \`${projectId}.${datasetId}.${tableName}\`
    WHERE year >= EXTRACT(YEAR FROM DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR))
    ORDER BY year DESC, quarter DESC
  `;

  try {
    const [rows] = await client.query({ query });
    return rows as SQLHistoryRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      console.error('[BigQuery] Failed to sync SQL history:', error);
    } else {
      console.error('[BigQuery] Failed to sync SQL history:', message);
    }
    throw new Error(`${ERROR_MESSAGES.BIGQUERY_SYNC_FAILED}: ${message}`);
  }
}

/**
 * Sync conversion rates from BigQuery
 * 
 * Expected BigQuery table schema:
 * - region: STRING
 * - sql_type: STRING
 * - opp_coverage_ratio: FLOAT (e.g., 0.058 for 5.8%)
 * - win_rate_new: FLOAT (e.g., 0.28 for 28%)
 * - win_rate_upsell: FLOAT (e.g., 0.35 for 35%)
 */
export async function syncConversionRates(config: BigQueryConfig): Promise<ConversionRateRow[]> {
  if (!config.tables.conversionRates) {
    throw new Error('Conversion Rates table not configured');
  }

  const client = createBigQueryClient(config);
  
  // Sanitize all identifiers to prevent SQL injection
  const projectId = sanitizeIdentifier(config.projectId);
  const datasetId = sanitizeIdentifier(config.datasetId);
  const tableName = sanitizeIdentifier(config.tables.conversionRates);
  
  const query = `
    SELECT 
      region,
      sql_type,
      opp_coverage_ratio,
      win_rate_new,
      win_rate_upsell
    FROM \`${projectId}.${datasetId}.${tableName}\`
  `;

  try {
    const [rows] = await client.query({ query });
    return rows as ConversionRateRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      console.error('[BigQuery] Failed to sync conversion rates:', error);
    } else {
      console.error('[BigQuery] Failed to sync conversion rates:', message);
    }
    throw new Error(`${ERROR_MESSAGES.BIGQUERY_SYNC_FAILED}: ${message}`);
  }
}

/**
 * Sync actual performance data from BigQuery
 * 
 * Expected BigQuery table schema:
 * - year: INTEGER
 * - quarter: INTEGER
 * - region: STRING
 * - sql_type: STRING
 * - actual_revenue: FLOAT (in dollars)
 */
export async function syncActuals(config: BigQueryConfig): Promise<ActualRow[]> {
  if (!config.tables.actuals) {
    throw new Error('Actuals table not configured');
  }

  const client = createBigQueryClient(config);
  
  // Sanitize all identifiers to prevent SQL injection
  const projectId = sanitizeIdentifier(config.projectId);
  const datasetId = sanitizeIdentifier(config.datasetId);
  const tableName = sanitizeIdentifier(config.tables.actuals);
  
  const query = `
    SELECT 
      year,
      quarter,
      region,
      sql_type,
      actual_revenue
    FROM \`${projectId}.${datasetId}.${tableName}\`
    WHERE year >= EXTRACT(YEAR FROM DATE_SUB(CURRENT_DATE(), INTERVAL 2 YEAR))
    ORDER BY year DESC, quarter DESC
  `;

  try {
    const [rows] = await client.query({ query });
    return rows as ActualRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      console.error('[BigQuery] Failed to sync actuals:', error);
    } else {
      console.error('[BigQuery] Failed to sync actuals:', message);
    }
    throw new Error(`${ERROR_MESSAGES.BIGQUERY_SYNC_FAILED}: ${message}`);
  }
}

/**
 * Test BigQuery connection and configuration
 */
export async function testBigQueryConnection(config: BigQueryConfig): Promise<{ success: boolean; message: string }> {
  try {
    const client = createBigQueryClient(config);
    
    // Sanitize identifiers
    const projectId = sanitizeIdentifier(config.projectId);
    const datasetId = sanitizeIdentifier(config.datasetId);
    
    // Simple query to test connection
    const query = `SELECT 1 as test FROM \`${projectId}.${datasetId}.__TABLES__\` LIMIT 1`;
    
    await client.query({ query });
    return { success: true, message: "Connection successful" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return { 
      success: false, 
      message
    };
  }
}

/**
 * List available tables in a BigQuery dataset
 * @param config - BigQuery configuration
 * @returns Array of table names
 */
export async function listAvailableTables(config: BigQueryConfig): Promise<string[]> {
  const client = createBigQueryClient(config);
  
  // Sanitize identifiers
  const projectId = sanitizeIdentifier(config.projectId);
  const datasetId = sanitizeIdentifier(config.datasetId);
  
  // Query INFORMATION_SCHEMA to list tables
  const query = `
    SELECT table_name 
    FROM \`${projectId}.${datasetId}.INFORMATION_SCHEMA.TABLES\`
    WHERE table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  
  try {
    const [rows] = await client.query({ query });
    interface BigQueryTableRow {
      table_name: string;
    }
    return rows.map((row: BigQueryTableRow) => row.table_name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      console.error('[BigQuery] Failed to list tables:', error);
    } else {
      console.error('[BigQuery] Failed to list tables:', message);
    }
    throw new Error(`Failed to list tables: ${message}`);
  }
}
