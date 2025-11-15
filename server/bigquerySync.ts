/**
 * BigQuery Sync Service
 * 
 * Orchestrates syncing data from BigQuery to local database
 * while preserving demo data and existing records.
 */

import * as bigquery from './bigquery';
import * as db from './db';

interface SyncResult {
  success: boolean;
  message: string;
  stats: {
    sqlHistoryImported: number;
    conversionRatesImported: number;
    actualsImported: number;
  };
}

/**
 * Sync all data from BigQuery for a company
 */
export async function syncCompanyData(companyId: number): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    message: '',
    stats: {
      sqlHistoryImported: 0,
      conversionRatesImported: 0,
      actualsImported: 0,
    },
  };

  try {
    // Get company BigQuery configuration
    const company = await db.getCompanyById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    if (!company.bigqueryEnabled) {
      throw new Error('BigQuery integration not enabled for this company');
    }

    const config: bigquery.BigQueryConfig = {
      projectId: company.bigqueryProjectId || '',
      datasetId: company.bigqueryDatasetId || '',
      credentials: company.bigqueryCredentials || undefined,
      tables: {
        sqlHistory: company.bigquerySqlHistoryTable || undefined,
        conversionRates: company.bigqueryConversionRatesTable || undefined,
        actuals: company.bigqueryActualsTable || undefined,
      },
    };

    // Sync SQL History
    if (config.tables.sqlHistory) {
      try {
        const sqlHistoryRows = await bigquery.syncSQLHistory(config);
        const regions = await db.getRegionsByCompany(companyId);
        const sqlTypes = await db.getSqlTypesByCompany(companyId);
        
        const regionMap = new Map(regions.map(r => [r.name.toLowerCase(), r.id]));
        const sqlTypeMap = new Map(sqlTypes.map(s => [s.name.toLowerCase(), s.id]));

        for (const row of sqlHistoryRows) {
          const regionId = regionMap.get(row.region.toLowerCase());
          const sqlTypeId = sqlTypeMap.get(row.sql_type.toLowerCase());
          
          if (regionId && sqlTypeId) {
            await db.upsertSqlHistoryFromBQ({
              companyId,
              regionId,
              sqlTypeId,
              year: row.year,
              quarter: row.quarter,
              volume: row.volume,
            });
            result.stats.sqlHistoryImported++;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV === "development") {
          console.error('[BigQuerySync] SQL History sync failed:', error);
        } else {
          console.error('[BigQuerySync] SQL History sync failed:', message);
        }
      }
    }

    // Sync Conversion Rates
    if (config.tables.conversionRates) {
      try {
        const conversionRateRows = await bigquery.syncConversionRates(config);
        const regions = await db.getRegionsByCompany(companyId);
        const sqlTypes = await db.getSqlTypesByCompany(companyId);
        
        const regionMap = new Map(regions.map(r => [r.name.toLowerCase(), r.id]));
        const sqlTypeMap = new Map(sqlTypes.map(s => [s.name.toLowerCase(), s.id]));

        for (const row of conversionRateRows) {
          const regionId = regionMap.get(row.region.toLowerCase());
          const sqlTypeId = sqlTypeMap.get(row.sql_type.toLowerCase());
          
          if (regionId && sqlTypeId) {
            await db.upsertConversionRateFromBQ({
              companyId,
              regionId,
              sqlTypeId,
              oppCoverageRatio: Math.round(row.opp_coverage_ratio * 10000), // Convert to basis points
              winRateNew: Math.round(row.win_rate_new * 10000),
              winRateUpsell: Math.round(row.win_rate_upsell * 10000),
            });
            result.stats.conversionRatesImported++;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV === "development") {
          console.error('[BigQuerySync] Conversion Rates sync failed:', error);
        } else {
          console.error('[BigQuerySync] Conversion Rates sync failed:', message);
        }
      }
    }

    // Sync Actuals
    if (config.tables.actuals) {
      try {
        const actualRows = await bigquery.syncActuals(config);
        const regions = await db.getRegionsByCompany(companyId);
        const sqlTypes = await db.getSqlTypesByCompany(companyId);
        
        const regionMap = new Map(regions.map(r => [r.name.toLowerCase(), r.id]));
        const sqlTypeMap = new Map(sqlTypes.map(s => [s.name.toLowerCase(), s.id]));

        for (const row of actualRows) {
          const regionId = regionMap.get(row.region.toLowerCase());
          const sqlTypeId = sqlTypeMap.get(row.sql_type.toLowerCase());
          
          if (regionId && sqlTypeId) {
            await db.upsertActualFromBQ({
              companyId,
              regionId,
              sqlTypeId,
              year: row.year,
              quarter: row.quarter,
              actualRevenue: Math.round(row.actual_revenue * 100), // Convert to cents
            });
            result.stats.actualsImported++;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV === "development") {
          console.error('[BigQuerySync] Actuals sync failed:', error);
        } else {
          console.error('[BigQuerySync] Actuals sync failed:', message);
        }
      }
    }

    // Update last sync timestamp
    await db.updateCompanyBigQuerySync(companyId, new Date());

    result.success = true;
    result.message = `Successfully synced ${result.stats.sqlHistoryImported} SQL records, ${result.stats.conversionRatesImported} conversion rates, and ${result.stats.actualsImported} actuals`;
    
    return result;
  } catch (error) {
    result.success = false;
    const message = error instanceof Error ? error.message : String(error);
    result.message = message;
    return result;
  }
}

/**
 * Test BigQuery connection for a company
 */
export async function testConnection(companyId: number): Promise<{ success: boolean; message: string }> {
  try {
    const company = await db.getCompanyById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    if (!company.bigqueryProjectId || !company.bigqueryDatasetId) {
      throw new Error('BigQuery configuration incomplete');
    }

    const config: bigquery.BigQueryConfig = {
      projectId: company.bigqueryProjectId,
      datasetId: company.bigqueryDatasetId,
      credentials: company.bigqueryCredentials || undefined,
      tables: {},
    };

    return await bigquery.testBigQueryConnection(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message,
    };
  }
}

/**
 * List available tables in BigQuery dataset
 */
export async function listTables(companyId: number): Promise<string[]> {
  const company = await db.getCompanyById(companyId);
  if (!company) {
    throw new Error('Company not found');
  }

  if (!company.bigqueryProjectId || !company.bigqueryDatasetId) {
    throw new Error('BigQuery configuration incomplete');
  }

  const config: bigquery.BigQueryConfig = {
    projectId: company.bigqueryProjectId,
    datasetId: company.bigqueryDatasetId,
    credentials: company.bigqueryCredentials || undefined,
    tables: {},
  };

  return await bigquery.listAvailableTables(config);
}
