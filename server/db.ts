import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, User, users,
  companies, Company, InsertCompany,
  regions, Region, InsertRegion,
  sqlTypes, SqlType, InsertSqlType,
  sqlHistory, SqlHistory, InsertSqlHistory,
  conversionRates, ConversionRate, InsertConversionRate,
  dealEconomics, DealEconomics, InsertDealEconomics,
  timeDistributions, TimeDistribution, InsertTimeDistribution,
  forecasts, Forecast, InsertForecast,
  actuals, Actual, InsertActual,
  scenarios, Scenario, InsertScenario
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { ERROR_MESSAGES } from '@shared/const';

let _db: ReturnType<typeof drizzle> | null = null;

// In-memory store for development mode when database is not available
const devStore = {
  companies: new Map<number, Company>(),
  regions: new Map<number, Region>(),
  sqlTypes: new Map<number, SqlType>(),
  sqlHistory: new Map<number, SqlHistory>(),
  conversionRates: new Map<number, ConversionRate>(),
  dealEconomics: new Map<number, DealEconomics>(),
  timeDistributions: new Map<number, TimeDistribution>(),
  forecasts: new Map<number, Forecast>(),
  actuals: new Map<number, Actual>(),
  nextCompanyId: 1,
  nextRegionId: 1,
  nextSqlTypeId: 1,
  nextHistoryId: 1,
  nextConversionRateId: 1,
  nextDealEconomicsId: 1,
  nextTimeDistributionId: 1,
  nextForecastId: 1,
  nextActualId: 1,
};

/**
 * Helper function to handle database operations with dev store fallback
 * @param dbOperation - Function to execute if database is available
 * @param devStoreOperation - Function to execute in development mode if database is unavailable
 * @returns Result of the operation
 */
async function withDbOrDevStore<T>(
  dbOperation: (db: NonNullable<ReturnType<typeof drizzle>>) => Promise<T>,
  devStoreOperation: () => T
): Promise<T> {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Dev Store] Using in-memory store");
      return devStoreOperation();
    }
    throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
  }
  return dbOperation(db);
}

/**
 * Get database connection instance
 * @returns Database instance or null if unavailable
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Database] Failed to connect:", error);
      } else {
        console.error("[Database] Failed to connect in production:", error);
      }
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// User Management
// ============================================================================

/**
 * Upsert a user in the database
 * @param user - User data to insert or update
 * @throws Error if database is unavailable in production
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[Database] Cannot upsert user: database not available");
    }
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      console.error("[Database] Failed to upsert user:", error);
    } else {
      console.error("[Database] Failed to upsert user:", errorMessage);
    }
    throw error;
  }
}

/**
 * Get user by OpenID
 * @param openId - User's OpenID identifier
 * @returns User or undefined if not found
 * @throws Error if database is unavailable in production
 */
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[Database] Cannot get user: database not available");
    }
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user by email address
 * @param email - User's email address
 * @returns User or undefined if not found
 * @throws Error if database is unavailable in production
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[Database] Cannot get user: database not available");
    }
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// Company Management
// ============================================================================

/**
 * Create a new company
 * @param data - Company data to insert
 * @returns Created company ID
 * @throws Error if database is unavailable in production
 */
export async function createCompany(data: InsertCompany) {
  return withDbOrDevStore(
    async (db) => {
      const result = await db.insert(companies).values(data);
      return result[0].insertId;
    },
    () => {
      const id = devStore.nextCompanyId++;
      const company: Company = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Company;
      devStore.companies.set(id, company);
      if (process.env.NODE_ENV === "development") {
        console.log("[Dev Store] Created company:", company);
      }
      return id;
    }
  );
}

/**
 * Get all companies owned by a user
 * @param userId - User ID to filter by
 * @returns Array of companies owned by the user
 * @throws Error if database is unavailable in production
 */
export async function getCompaniesByUser(userId: number) {
  return withDbOrDevStore(
    async (db) => {
      // Filter by userId to ensure users only see their own companies
      return await db.select()
        .from(companies)
        .where(eq(companies.userId, userId))
        .orderBy(desc(companies.createdAt));
    },
    () => {
      return Array.from(devStore.companies.values())
        .filter(c => c.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
  );
}

/**
 * Get company by ID
 * @param id - Company ID
 * @returns Company or undefined if not found
 * @throws Error if database is unavailable in production
 */
export async function getCompanyById(id: number) {
  return withDbOrDevStore(
    async (db) => {
      const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
      return result[0];
    },
    () => {
      return devStore.companies.get(id);
    }
  );
}

// ============================================================================
// Region Management
// ============================================================================

/**
 * Create a new region
 * @param data - Region data to insert
 * @returns Created region ID
 * @throws Error if database is unavailable in production
 */
export async function createRegion(data: InsertRegion) {
  return withDbOrDevStore(
    async (db) => {
      const result = await db.insert(regions).values(data);
      return result[0].insertId;
    },
    () => {
      const id = devStore.nextRegionId++;
      const region: Region = { id, ...data, createdAt: new Date() } as Region;
      devStore.regions.set(id, region);
      return id;
    }
  );
}

/**
 * Get all regions for a company
 * @param companyId - Company ID
 * @returns Array of regions
 * @throws Error if database is unavailable in production
 */
export async function getRegionsByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(regions).where(eq(regions.companyId, companyId));
    },
    () => {
      return Array.from(devStore.regions.values()).filter(r => r.companyId === companyId);
    }
  );
}

// ============================================================================
// SQL Type Management
// ============================================================================

/**
 * Create a new SQL type
 * @param data - SQL type data to insert
 * @returns Created SQL type ID
 * @throws Error if database is unavailable in production
 */
export async function createSqlType(data: InsertSqlType) {
  return withDbOrDevStore(
    async (db) => {
      const result = await db.insert(sqlTypes).values(data);
      return result[0].insertId;
    },
    () => {
      const id = devStore.nextSqlTypeId++;
      const sqlType: SqlType = { id, ...data, createdAt: new Date() } as SqlType;
      devStore.sqlTypes.set(id, sqlType);
      return id;
    }
  );
}

/**
 * Get all SQL types for a company
 * @param companyId - Company ID
 * @returns Array of SQL types
 * @throws Error if database is unavailable in production
 */
export async function getSqlTypesByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(sqlTypes).where(eq(sqlTypes.companyId, companyId));
    },
    () => {
      return Array.from(devStore.sqlTypes.values()).filter(s => s.companyId === companyId);
    }
  );
}

// ============================================================================
// SQL History Management
// ============================================================================

export async function upsertSqlHistory(data: InsertSqlHistory) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "development") {
      const key = `${data.companyId}-${data.regionId}-${data.sqlTypeId}-${data.year}-${data.quarter}`;
      const existing = Array.from(devStore.sqlHistory.values()).find(h => 
        h.companyId === data.companyId && h.regionId === data.regionId && 
        h.sqlTypeId === data.sqlTypeId && h.year === data.year && h.quarter === data.quarter
      );
      if (existing) {
        existing.volume = data.volume ?? 0;
        existing.updatedAt = new Date();
      } else {
        const id = devStore.nextHistoryId++;
        const history = { id, ...data, volume: data.volume ?? 0, createdAt: new Date(), updatedAt: new Date() };
        devStore.sqlHistory.set(id, history);
      }
      return;
    }
    throw new Error("Database not available");
  }

  await db.insert(sqlHistory).values(data).onDuplicateKeyUpdate({
    set: {
      volume: data.volume,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get SQL history for a company
 * @param companyId - Company ID
 * @returns Array of SQL history records
 * @throws Error if database is unavailable in production
 */
export async function getSqlHistoryByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(sqlHistory).where(eq(sqlHistory.companyId, companyId));
    },
    () => {
      return Array.from(devStore.sqlHistory.values()).filter(h => h.companyId === companyId);
    }
  );
}

// ============================================================================
// Conversion Rates Management
// ============================================================================

export async function upsertConversionRate(data: InsertConversionRate) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "development") {
      const existing = Array.from(devStore.conversionRates.values()).find(cr => 
        cr.companyId === data.companyId && cr.regionId === data.regionId && cr.sqlTypeId === data.sqlTypeId
      );
      if (existing) {
        existing.oppCoverageRatio = data.oppCoverageRatio ?? 500;
        existing.winRateNew = data.winRateNew ?? 2500;
        existing.winRateUpsell = data.winRateUpsell ?? 3000;
        existing.updatedAt = new Date();
      } else {
        const id = devStore.nextConversionRateId++;
        const rate = {
          id,
          ...data,
          oppCoverageRatio: data.oppCoverageRatio ?? 500,
          winRateNew: data.winRateNew ?? 2500,
          winRateUpsell: data.winRateUpsell ?? 3000,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        devStore.conversionRates.set(id, rate);
      }
      return;
    }
    throw new Error("Database not available");
  }

  await db.insert(conversionRates).values(data).onDuplicateKeyUpdate({
    set: {
      oppCoverageRatio: data.oppCoverageRatio,
      winRateNew: data.winRateNew,
      winRateUpsell: data.winRateUpsell,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get conversion rates for a company
 * @param companyId - Company ID
 * @returns Array of conversion rates
 * @throws Error if database is unavailable in production
 */
export async function getConversionRatesByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(conversionRates).where(eq(conversionRates.companyId, companyId));
    },
    () => {
      return Array.from(devStore.conversionRates.values()).filter(cr => cr.companyId === companyId);
    }
  );
}

// ============================================================================
// Deal Economics Management
// ============================================================================

export async function upsertDealEconomics(data: InsertDealEconomics) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "development") {
      const existing = Array.from(devStore.dealEconomics.values()).find(de => 
        de.companyId === data.companyId && de.regionId === data.regionId
      );
      if (existing) {
        existing.acvNew = data.acvNew ?? 100000;
        existing.acvUpsell = data.acvUpsell ?? 50000;
        existing.updatedAt = new Date();
      } else {
        const id = devStore.nextDealEconomicsId++;
        const economics = {
          id,
          ...data,
          acvNew: data.acvNew ?? 100000,
          acvUpsell: data.acvUpsell ?? 50000,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        devStore.dealEconomics.set(id, economics);
      }
      return;
    }
    throw new Error("Database not available");
  }

  await db.insert(dealEconomics).values(data).onDuplicateKeyUpdate({
    set: {
      acvNew: data.acvNew,
      acvUpsell: data.acvUpsell,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get deal economics for a company
 * @param companyId - Company ID
 * @returns Array of deal economics records
 * @throws Error if database is unavailable in production
 */
export async function getDealEconomicsByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(dealEconomics).where(eq(dealEconomics.companyId, companyId));
    },
    () => {
      return Array.from(devStore.dealEconomics.values()).filter(de => de.companyId === companyId);
    }
  );
}

// ============================================================================
// Time Distribution Management
// ============================================================================

export async function upsertTimeDistribution(data: InsertTimeDistribution) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "development") {
      const existing = Array.from(devStore.timeDistributions.values()).find(td => 
        td.companyId === data.companyId && td.sqlTypeId === data.sqlTypeId
      );
      if (existing) {
        existing.sameQuarterPct = data.sameQuarterPct ?? 8900;
        existing.nextQuarterPct = data.nextQuarterPct ?? 1000;
        existing.twoQuarterPct = data.twoQuarterPct ?? 100;
        existing.updatedAt = new Date();
      } else {
        const id = devStore.nextTimeDistributionId++;
        const dist = {
          id,
          ...data,
          sameQuarterPct: data.sameQuarterPct ?? 8900,
          nextQuarterPct: data.nextQuarterPct ?? 1000,
          twoQuarterPct: data.twoQuarterPct ?? 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        devStore.timeDistributions.set(id, dist);
      }
      return;
    }
    throw new Error("Database not available");
  }

  await db.insert(timeDistributions).values(data).onDuplicateKeyUpdate({
    set: {
      sameQuarterPct: data.sameQuarterPct,
      nextQuarterPct: data.nextQuarterPct,
      twoQuarterPct: data.twoQuarterPct,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get time distributions for a company
 * @param companyId - Company ID
 * @returns Array of time distribution records
 * @throws Error if database is unavailable in production
 */
export async function getTimeDistributionsByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(timeDistributions).where(eq(timeDistributions.companyId, companyId));
    },
    () => {
      return Array.from(devStore.timeDistributions.values()).filter(td => td.companyId === companyId);
    }
  );
}

// ============================================================================
// Forecast Management
// ============================================================================

export async function upsertForecast(data: InsertForecast) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "development") {
      const existing = Array.from(devStore.forecasts.values()).find(f => 
        f.companyId === data.companyId && f.regionId === data.regionId && 
        f.sqlTypeId === data.sqlTypeId && f.year === data.year && f.quarter === data.quarter
      );
      if (existing) {
        existing.predictedSqls = data.predictedSqls ?? 0;
        existing.predictedOpps = data.predictedOpps ?? 0;
        existing.predictedRevenueNew = data.predictedRevenueNew ?? 0;
        existing.predictedRevenueUpsell = data.predictedRevenueUpsell ?? 0;
        existing.updatedAt = new Date();
      } else {
        const id = devStore.nextForecastId++;
        const forecast = {
          id,
          ...data,
          predictedSqls: data.predictedSqls ?? 0,
          predictedOpps: data.predictedOpps ?? 0,
          predictedRevenueNew: data.predictedRevenueNew ?? 0,
          predictedRevenueUpsell: data.predictedRevenueUpsell ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        devStore.forecasts.set(id, forecast);
      }
      return;
    }
    throw new Error("Database not available");
  }

  await db.insert(forecasts).values(data).onDuplicateKeyUpdate({
    set: {
      predictedSqls: data.predictedSqls,
      predictedOpps: data.predictedOpps,
      predictedRevenueNew: data.predictedRevenueNew,
      predictedRevenueUpsell: data.predictedRevenueUpsell,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get forecasts for a company
 * @param companyId - Company ID
 * @returns Array of forecast records
 * @throws Error if database is unavailable in production
 */
export async function getForecastsByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(forecasts).where(eq(forecasts.companyId, companyId));
    },
    () => {
      const forecasts = Array.from(devStore.forecasts.values()).filter(f => f.companyId === companyId);
      return forecasts;
    }
  );
}

export async function deleteForecastsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "development") {
      // Delete all forecasts for this company from dev store
      for (const [id, forecast] of Array.from(devStore.forecasts.entries())) {
        if (forecast.companyId === companyId) {
          devStore.forecasts.delete(id);
        }
      }
      return;
    }
    throw new Error("Database not available");
  }

  await db.delete(forecasts).where(eq(forecasts.companyId, companyId));
}

// ============================================================================
// Actuals Management
// ============================================================================

export async function upsertActual(data: InsertActual) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(actuals).values(data).onDuplicateKeyUpdate({
    set: {
      actualSqls: data.actualSqls,
      actualOpps: data.actualOpps,
      actualRevenue: data.actualRevenue,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get actual performance data for a company
 * @param companyId - Company ID
 * @returns Array of actual performance records
 * @throws Error if database is unavailable in production
 */
export async function getActualsByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(actuals).where(eq(actuals.companyId, companyId));
    },
    () => {
      return Array.from(devStore.actuals.values()).filter(a => a.companyId === companyId);
    }
  );
}

/**
 * Update BigQuery last sync timestamp for a company
 * @param companyId - Company ID
 * @param syncTime - Sync timestamp
 * @throws Error if database is unavailable in production
 */
export async function updateCompanyBigQuerySync(companyId: number, syncTime: Date) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    return;
  }
  await db.update(companies).set({ bigqueryLastSync: syncTime }).where(eq(companies.id, companyId));
}

/**
 * Upsert SQL history from BigQuery sync
 * @param data - SQL history data
 * @throws Error if database is unavailable in production
 */
export async function upsertSqlHistoryFromBQ(data: Omit<InsertSqlHistory, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    return;
  }
  const existing = await db.select().from(sqlHistory).where(and(eq(sqlHistory.companyId, data.companyId), eq(sqlHistory.regionId, data.regionId), eq(sqlHistory.sqlTypeId, data.sqlTypeId), eq(sqlHistory.year, data.year), eq(sqlHistory.quarter, data.quarter))).limit(1);
  if (existing.length > 0) {
    await db.update(sqlHistory).set({ volume: data.volume }).where(eq(sqlHistory.id, existing[0].id));
  } else {
    await db.insert(sqlHistory).values(data);
  }
}

/**
 * Upsert conversion rate from BigQuery sync
 * @param data - Conversion rate data
 * @throws Error if database is unavailable in production
 */
export async function upsertConversionRateFromBQ(data: Omit<InsertConversionRate, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    return;
  }
  const existing = await db.select().from(conversionRates).where(and(eq(conversionRates.companyId, data.companyId), eq(conversionRates.regionId, data.regionId), eq(conversionRates.sqlTypeId, data.sqlTypeId))).limit(1);
  if (existing.length > 0) {
    await db.update(conversionRates).set({ oppCoverageRatio: data.oppCoverageRatio, winRateNew: data.winRateNew, winRateUpsell: data.winRateUpsell }).where(eq(conversionRates.id, existing[0].id));
  } else {
    await db.insert(conversionRates).values(data);
  }
}

/**
 * Upsert actual performance data from BigQuery sync
 * @param data - Actual performance data
 * @throws Error if database is unavailable in production
 */
export async function upsertActualFromBQ(data: Omit<InsertActual, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    return;
  }
  const existing = await db.select().from(actuals).where(and(eq(actuals.companyId, data.companyId), eq(actuals.regionId, data.regionId), eq(actuals.sqlTypeId, data.sqlTypeId), eq(actuals.year, data.year), eq(actuals.quarter, data.quarter))).limit(1);
  if (existing.length > 0) {
    await db.update(actuals).set({ actualRevenue: data.actualRevenue }).where(eq(actuals.id, existing[0].id));
  } else {
    await db.insert(actuals).values(data);
  }
}

/**
 * Update BigQuery configuration for a company
 * @param companyId - Company ID
 * @param config - BigQuery configuration
 * @throws Error if database is unavailable in production
 */
export async function updateCompanyBigQueryConfig(companyId: number, config: { bigqueryEnabled?: boolean; bigqueryProjectId?: string; bigqueryDatasetId?: string; bigqueryCredentials?: string; bigquerySqlHistoryTable?: string; bigqueryConversionRatesTable?: string; bigqueryActualsTable?: string }) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    return;
  }
  await db.update(companies).set(config).where(eq(companies.id, companyId));
}


// ============================================================================
// Scenario Management
// ============================================================================

export async function createScenario(data: Omit<InsertScenario, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(scenarios).values(data);
  return Number(result[0].insertId);
}

/**
 * Get all scenarios for a company
 * @param companyId - Company ID
 * @returns Array of scenarios
 * @throws Error if database is unavailable in production
 */
export async function getScenariosByCompany(companyId: number) {
  return withDbOrDevStore(
    async (db) => {
      return await db.select().from(scenarios).where(eq(scenarios.companyId, companyId)).orderBy(desc(scenarios.createdAt));
    },
    () => {
      return [];
    }
  );
}

/**
 * Get scenario by ID
 * @param id - Scenario ID
 * @returns Scenario or undefined if not found
 * @throws Error if database is unavailable in production
 */
export async function getScenarioById(id: number) {
  return withDbOrDevStore(
    async (db) => {
      const result = await db.select().from(scenarios).where(eq(scenarios.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    },
    () => {
      return undefined;
    }
  );
}

/**
 * Update a scenario
 * @param id - Scenario ID
 * @param data - Scenario data to update
 * @throws Error if database is unavailable in production
 */
export async function updateScenario(id: number, data: Partial<Omit<InsertScenario, 'id' | 'companyId' | 'userId' | 'createdAt'>>) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    return;
  }
  
  await db.update(scenarios).set(data).where(eq(scenarios.id, id));
}

/**
 * Delete a scenario
 * @param id - Scenario ID
 * @throws Error if database is unavailable in production
 */
export async function deleteScenario(id: number) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    }
    return;
  }
  
  await db.delete(scenarios).where(eq(scenarios.id, id));
}
