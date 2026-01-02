import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, unique } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }), // For simple login
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Companies/Organizations using the cascade model
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Owner of this company model
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // BigQuery integration configuration
  bigqueryEnabled: boolean("bigqueryEnabled").default(false).notNull(),
  bigqueryProjectId: varchar("bigqueryProjectId", { length: 255 }),
  bigqueryDatasetId: varchar("bigqueryDatasetId", { length: 255 }),
  bigqueryCredentials: text("bigqueryCredentials"), // JSON key file
  bigquerySqlHistoryTable: varchar("bigquerySqlHistoryTable", { length: 255 }),
  bigqueryConversionRatesTable: varchar("bigqueryConversionRatesTable", { length: 255 }),
  bigqueryActualsTable: varchar("bigqueryActualsTable", { length: 255 }),
  bigqueryLastSync: timestamp("bigqueryLastSync"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Geographic regions for each company
 */
export const regions = mysqlTable("regions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // NORAM, EMESA North, EMESA South
  displayName: varchar("displayName", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueCompanyRegion: unique().on(table.companyId, table.name),
}));

export type Region = typeof regions.$inferSelect;
export type InsertRegion = typeof regions.$inferInsert;

/**
 * SQL types for each company
 */
export const sqlTypes = mysqlTable("sqlTypes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // Inbound, Outbound, ILO, Event, Partner
  displayName: varchar("displayName", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  uniqueCompanySqlType: unique().on(table.companyId, table.name),
}));

export type SqlType = typeof sqlTypes.$inferSelect;
export type InsertSqlType = typeof sqlTypes.$inferInsert;

/**
 * Historical SQL volume data
 */
export const sqlHistory = mysqlTable("sqlHistory", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  regionId: int("regionId").notNull(),
  sqlTypeId: int("sqlTypeId").notNull(),
  year: int("year").notNull(),
  quarter: int("quarter").notNull(), // 1, 2, 3, 4
  volume: int("volume").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueHistoryEntry: unique().on(table.companyId, table.regionId, table.sqlTypeId, table.year, table.quarter),
}));

export type SqlHistory = typeof sqlHistory.$inferSelect;
export type InsertSqlHistory = typeof sqlHistory.$inferInsert;

/**
 * Conversion rates: SQL -> Opportunity
 * Opportunity Coverage Ratio by region and SQL type
 */
export const conversionRates = mysqlTable("conversionRates", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  regionId: int("regionId").notNull(),
  sqlTypeId: int("sqlTypeId").notNull(),
  oppCoverageRatio: int("oppCoverageRatio").notNull().default(500), // Stored as basis points (5.0% = 500)
  winRateNew: int("winRateNew").notNull().default(2500), // Win rate for new business (25% = 2500)
  winRateUpsell: int("winRateUpsell").notNull().default(3000), // Win rate for upsells (30% = 3000)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueConversionRate: unique().on(table.companyId, table.regionId, table.sqlTypeId),
}));

export type ConversionRate = typeof conversionRates.$inferSelect;
export type InsertConversionRate = typeof conversionRates.$inferInsert;

/**
 * Deal economics: Average Contract Values
 */
export const dealEconomics = mysqlTable("dealEconomics", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  regionId: int("regionId").notNull(),
  acvNew: int("acvNew").notNull().default(100000), // Average ACV for new business (in cents)
  acvUpsell: int("acvUpsell").notNull().default(50000), // Average ACV for upsells (in cents)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueDealEconomics: unique().on(table.companyId, table.regionId),
}));

export type DealEconomics = typeof dealEconomics.$inferSelect;
export type InsertDealEconomics = typeof dealEconomics.$inferInsert;

/**
 * Time distribution: SQL -> Opportunity conversion timing
 */
export const timeDistributions = mysqlTable("timeDistributions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  sqlTypeId: int("sqlTypeId").notNull(),
  sameQuarterPct: int("sameQuarterPct").notNull().default(8900), // 89% = 8900 basis points
  nextQuarterPct: int("nextQuarterPct").notNull().default(1000), // 10% = 1000 basis points
  twoQuarterPct: int("twoQuarterPct").notNull().default(100), // 1% = 100 basis points
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueTimeDistribution: unique().on(table.companyId, table.sqlTypeId),
}));

export type TimeDistribution = typeof timeDistributions.$inferSelect;
export type InsertTimeDistribution = typeof timeDistributions.$inferInsert;

/**
 * Forecasts: Cached calculation results
 */
export const forecasts = mysqlTable("forecasts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  regionId: int("regionId").notNull(),
  sqlTypeId: int("sqlTypeId").notNull(),
  year: int("year").notNull(),
  quarter: int("quarter").notNull(),
  predictedSqls: int("predictedSqls").notNull().default(0),
  predictedOpps: int("predictedOpps").notNull().default(0), // Stored as integer (multiply by 100 for precision)
  predictedRevenueNew: int("predictedRevenueNew").notNull().default(0), // Revenue in cents
  predictedRevenueUpsell: int("predictedRevenueUpsell").notNull().default(0), // Revenue in cents
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueForecast: unique().on(table.companyId, table.regionId, table.sqlTypeId, table.year, table.quarter),
}));

export type Forecast = typeof forecasts.$inferSelect;
export type InsertForecast = typeof forecasts.$inferInsert;

/**
 * Actual performance data for tracking
 */
export const actuals = mysqlTable("actuals", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  regionId: int("regionId").notNull(),
  sqlTypeId: int("sqlTypeId").notNull(),
  year: int("year").notNull(),
  quarter: int("quarter").notNull(),
  actualSqls: int("actualSqls").notNull().default(0),
  actualOpps: int("actualOpps").notNull().default(0),
  actualRevenue: int("actualRevenue").notNull().default(0), // Revenue in cents
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniqueActual: unique().on(table.companyId, table.regionId, table.sqlTypeId, table.year, table.quarter),
}));

export type Actual = typeof actuals.$inferSelect;
export type InsertActual = typeof actuals.$inferInsert;

/**
 * Saved What-If scenarios for comparison and sharing
 */
export const scenarios = mysqlTable("scenarios", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  userId: int("userId").notNull(), // Creator of the scenario
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // Adjustment parameters stored as JSON
  conversionRateMultiplier: int("conversionRateMultiplier"), // Stored as basis points (1.0 = 10000)
  acvNewAdjustment: int("acvNewAdjustment"), // In cents
  acvUpsellAdjustment: int("acvUpsellAdjustment"), // In cents
  sameQuarterAdjustment: int("sameQuarterAdjustment"), // In basis points
  nextQuarterAdjustment: int("nextQuarterAdjustment"), // In basis points
  twoQuarterAdjustment: int("twoQuarterAdjustment"), // In basis points
  // Calculated results (cached for quick comparison)
  totalRevenueChange: int("totalRevenueChange"), // In cents
  totalRevenueChangePercent: int("totalRevenueChangePercent"), // In basis points
  totalOpportunitiesChange: int("totalOpportunitiesChange"),
  totalOpportunitiesChangePercent: int("totalOpportunitiesChangePercent"), // In basis points
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = typeof scenarios.$inferInsert;
