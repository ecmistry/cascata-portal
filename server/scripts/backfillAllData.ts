/**
 * Comprehensive data backfill for the Cascata portal.
 *
 * Populates:
 *   1. Historical SQL volumes for Q1 2024 through Q1 2026 (9 quarters)
 *   2. Cascade forecasts (via the engine)
 *   3. Actual performance data for past/current quarters
 */

import * as dotenv from "dotenv";
dotenv.config();

import * as db from "../db";
import { runCascadeForecast } from "../cascadeEngine";
import { seedActualsForCompany } from "./seedActualPerformanceData";
import { sqlHistory } from "../../drizzle/schema";
import { sql as drizzleSql, and, eq } from "drizzle-orm";

const COMPANY_ID = 1;

// Region IDs (from DB)
const NORAM = 1;
const EMESA_NORTH = 2;
const EMESA_SOUTH = 3;

// SQL Type IDs (from DB)
const INBOUND = 1;
const OUTBOUND = 2;
const ILO = 3;
const EVENT = 4;
const PARTNER = 5;

/**
 * Realistic quarterly SQL volumes with growth trends.
 * Based on the existing Q4 2024 baseline, we work backward for earlier
 * quarters and forward through 2025 with natural growth.
 */
const historicalVolumes: Array<{
  regionId: number;
  sqlTypeId: number;
  year: number;
  quarter: number;
  volume: number;
}> = [
  // ── Q1 2024 ──────────────────────────────────────────
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2024, quarter: 1, volume: 18 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2024, quarter: 1, volume: 7 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2024, quarter: 1, volume: 14 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2024, quarter: 1, volume: 20 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2024, quarter: 1, volume: 0 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2024, quarter: 1, volume: 12 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2024, quarter: 1, volume: 5 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2024, quarter: 1, volume: 18 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2024, quarter: 1, volume: 19 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2024, quarter: 1, volume: 0 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2024, quarter: 1, volume: 10 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2024, quarter: 1, volume: 3 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2024, quarter: 1, volume: 8 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2024, quarter: 1, volume: 12 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2024, quarter: 1, volume: 0 },

  // ── Q2 2024 ──────────────────────────────────────────
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2024, quarter: 2, volume: 20 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2024, quarter: 2, volume: 8 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2024, quarter: 2, volume: 16 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2024, quarter: 2, volume: 22 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2024, quarter: 2, volume: 0 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2024, quarter: 2, volume: 14 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2024, quarter: 2, volume: 6 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2024, quarter: 2, volume: 20 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2024, quarter: 2, volume: 22 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2024, quarter: 2, volume: 0 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2024, quarter: 2, volume: 12 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2024, quarter: 2, volume: 4 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2024, quarter: 2, volume: 10 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2024, quarter: 2, volume: 15 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2024, quarter: 2, volume: 0 },

  // ── Q3 2024 ──────────────────────────────────────────
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2024, quarter: 3, volume: 22 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2024, quarter: 3, volume: 9 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2024, quarter: 3, volume: 18 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2024, quarter: 3, volume: 24 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2024, quarter: 3, volume: 0 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2024, quarter: 3, volume: 16 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2024, quarter: 3, volume: 6 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2024, quarter: 3, volume: 22 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2024, quarter: 3, volume: 24 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2024, quarter: 3, volume: 0 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2024, quarter: 3, volume: 13 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2024, quarter: 3, volume: 4 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2024, quarter: 3, volume: 11 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2024, quarter: 3, volume: 16 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2024, quarter: 3, volume: 0 },

  // ── Q4 2024 (already exists; will upsert) ───────────
  // Keeping original seeded values
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2024, quarter: 4, volume: 24 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2024, quarter: 4, volume: 10 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2024, quarter: 4, volume: 20 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2024, quarter: 4, volume: 26 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2024, quarter: 4, volume: 0 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2024, quarter: 4, volume: 18 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2024, quarter: 4, volume: 7 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2024, quarter: 4, volume: 25 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2024, quarter: 4, volume: 26 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2024, quarter: 4, volume: 0 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2024, quarter: 4, volume: 15 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2024, quarter: 4, volume: 5 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2024, quarter: 4, volume: 12 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2024, quarter: 4, volume: 18 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2024, quarter: 4, volume: 0 },

  // ── Q1 2025 (growth ~8-12% QoQ) ─────────────────────
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2025, quarter: 1, volume: 26 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2025, quarter: 1, volume: 11 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2025, quarter: 1, volume: 22 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2025, quarter: 1, volume: 28 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2025, quarter: 1, volume: 2 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2025, quarter: 1, volume: 20 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2025, quarter: 1, volume: 8 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2025, quarter: 1, volume: 27 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2025, quarter: 1, volume: 28 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2025, quarter: 1, volume: 1 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2025, quarter: 1, volume: 17 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2025, quarter: 1, volume: 6 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2025, quarter: 1, volume: 14 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2025, quarter: 1, volume: 20 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2025, quarter: 1, volume: 1 },

  // ── Q2 2025 ──────────────────────────────────────────
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2025, quarter: 2, volume: 28 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2025, quarter: 2, volume: 12 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2025, quarter: 2, volume: 24 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2025, quarter: 2, volume: 30 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2025, quarter: 2, volume: 3 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2025, quarter: 2, volume: 22 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2025, quarter: 2, volume: 9 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2025, quarter: 2, volume: 29 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2025, quarter: 2, volume: 30 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2025, quarter: 2, volume: 2 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2025, quarter: 2, volume: 18 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2025, quarter: 2, volume: 7 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2025, quarter: 2, volume: 15 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2025, quarter: 2, volume: 22 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2025, quarter: 2, volume: 2 },

  // ── Q3 2025 ──────────────────────────────────────────
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2025, quarter: 3, volume: 30 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2025, quarter: 3, volume: 13 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2025, quarter: 3, volume: 26 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2025, quarter: 3, volume: 32 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2025, quarter: 3, volume: 4 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2025, quarter: 3, volume: 24 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2025, quarter: 3, volume: 10 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2025, quarter: 3, volume: 31 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2025, quarter: 3, volume: 32 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2025, quarter: 3, volume: 3 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2025, quarter: 3, volume: 20 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2025, quarter: 3, volume: 7 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2025, quarter: 3, volume: 17 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2025, quarter: 3, volume: 24 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2025, quarter: 3, volume: 3 },

  // ── Q4 2025 ──────────────────────────────────────────
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2025, quarter: 4, volume: 32 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2025, quarter: 4, volume: 14 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2025, quarter: 4, volume: 28 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2025, quarter: 4, volume: 34 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2025, quarter: 4, volume: 5 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2025, quarter: 4, volume: 26 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2025, quarter: 4, volume: 11 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2025, quarter: 4, volume: 33 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2025, quarter: 4, volume: 34 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2025, quarter: 4, volume: 4 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2025, quarter: 4, volume: 22 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2025, quarter: 4, volume: 8 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2025, quarter: 4, volume: 19 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2025, quarter: 4, volume: 26 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2025, quarter: 4, volume: 4 },

  // ── Q1 2026 (current quarter, in-progress) ──────────
  { regionId: NORAM, sqlTypeId: INBOUND, year: 2026, quarter: 1, volume: 34 },
  { regionId: NORAM, sqlTypeId: OUTBOUND, year: 2026, quarter: 1, volume: 15 },
  { regionId: NORAM, sqlTypeId: ILO, year: 2026, quarter: 1, volume: 30 },
  { regionId: NORAM, sqlTypeId: EVENT, year: 2026, quarter: 1, volume: 36 },
  { regionId: NORAM, sqlTypeId: PARTNER, year: 2026, quarter: 1, volume: 6 },
  { regionId: EMESA_NORTH, sqlTypeId: INBOUND, year: 2026, quarter: 1, volume: 28 },
  { regionId: EMESA_NORTH, sqlTypeId: OUTBOUND, year: 2026, quarter: 1, volume: 12 },
  { regionId: EMESA_NORTH, sqlTypeId: ILO, year: 2026, quarter: 1, volume: 35 },
  { regionId: EMESA_NORTH, sqlTypeId: EVENT, year: 2026, quarter: 1, volume: 36 },
  { regionId: EMESA_NORTH, sqlTypeId: PARTNER, year: 2026, quarter: 1, volume: 5 },
  { regionId: EMESA_SOUTH, sqlTypeId: INBOUND, year: 2026, quarter: 1, volume: 24 },
  { regionId: EMESA_SOUTH, sqlTypeId: OUTBOUND, year: 2026, quarter: 1, volume: 9 },
  { regionId: EMESA_SOUTH, sqlTypeId: ILO, year: 2026, quarter: 1, volume: 21 },
  { regionId: EMESA_SOUTH, sqlTypeId: EVENT, year: 2026, quarter: 1, volume: 28 },
  { regionId: EMESA_SOUTH, sqlTypeId: PARTNER, year: 2026, quarter: 1, volume: 5 },
];

async function backfill() {
  console.log("=".repeat(80));
  console.log("  Cascata Portal - Comprehensive Data Backfill");
  console.log("=".repeat(80));
  console.log();

  const database = await db.getDb();
  if (!database) {
    console.error("Database not available. Check DATABASE_URL.");
    process.exit(1);
  }

  // ── Step 1: Backfill SQL history ─────────────────────
  console.log("Step 1/4: Backfilling historical SQL volumes...");
  console.log(`  Inserting ${historicalVolumes.length} records (Q1 2024 - Q1 2026)`);

  let inserted = 0;
  let updated = 0;

  for (const rec of historicalVolumes) {
    try {
      await database.insert(sqlHistory).values({
        companyId: COMPANY_ID,
        regionId: rec.regionId,
        sqlTypeId: rec.sqlTypeId,
        year: rec.year,
        quarter: rec.quarter,
        volume: rec.volume,
      }).onDuplicateKeyUpdate({ set: { volume: rec.volume } });

      inserted++;
    } catch (err) {
      console.error(`  Error inserting ${rec.year} Q${rec.quarter} region=${rec.regionId} type=${rec.sqlTypeId}:`, err);
    }
  }

  console.log(`  Done: ${inserted} records upserted\n`);

  // ── Step 2: Run cascade forecast ─────────────────────
  console.log("Step 2/4: Running cascade forecast engine...");

  const forecastCount = await runCascadeForecast(COMPANY_ID);
  console.log(`  Generated ${forecastCount} forecast records\n`);

  // ── Step 3: Seed actual performance data ─────────────
  console.log("Step 3/4: Seeding actual performance data...");
  await seedActualsForCompany(COMPANY_ID);
  console.log();

  // ── Step 4: Verify ───────────────────────────────────
  console.log("Step 4/4: Verifying data...");

  const history = await db.getSqlHistoryByCompany(COMPANY_ID);
  const fcs = await db.getForecastsByCompany(COMPANY_ID);
  const acts = await db.getActualsByCompany(COMPANY_ID);
  const regs = await db.getRegionsByCompany(COMPANY_ID);
  const types = await db.getSqlTypesByCompany(COMPANY_ID);
  const convRates = await db.getConversionRatesByCompany(COMPANY_ID);
  const dealEcon = await db.getDealEconomicsByCompany(COMPANY_ID);
  const timeDist = await db.getTimeDistributionsByCompany(COMPANY_ID);

  console.log();
  console.log("  Data Summary:");
  console.log("  " + "-".repeat(40));
  console.log(`  Regions:              ${regs.length}`);
  console.log(`  SQL Types:            ${types.length}`);
  console.log(`  SQL History records:  ${history.length}`);
  console.log(`  Conversion Rates:     ${convRates.length}`);
  console.log(`  Deal Economics:       ${dealEcon.length}`);
  console.log(`  Time Distributions:   ${timeDist.length}`);
  console.log(`  Forecast records:     ${fcs.length}`);
  console.log(`  Actual records:       ${acts.length}`);

  // Quarterly history breakdown
  const quarterMap = new Map<string, number>();
  for (const h of history) {
    const key = `${h.year} Q${h.quarter}`;
    quarterMap.set(key, (quarterMap.get(key) || 0) + h.volume);
  }
  console.log();
  console.log("  SQL Volume by Quarter:");
  console.log("  " + "-".repeat(40));
  for (const [key, vol] of [...quarterMap.entries()].sort()) {
    console.log(`  ${key}: ${vol} total SQLs`);
  }

  // Revenue summary
  const totalRevenueNew = fcs.reduce((s, f) => s + (f.predictedRevenueNew || 0), 0);
  const totalRevenueUpsell = fcs.reduce((s, f) => s + (f.predictedRevenueUpsell || 0), 0);
  console.log();
  console.log("  Forecast Revenue Summary:");
  console.log("  " + "-".repeat(40));
  console.log(`  New Business:  $${(totalRevenueNew / 100).toLocaleString()}`);
  console.log(`  Upsell:        $${(totalRevenueUpsell / 100).toLocaleString()}`);
  console.log(`  Total:         $${((totalRevenueNew + totalRevenueUpsell) / 100).toLocaleString()}`);

  console.log();
  console.log("=".repeat(80));
  console.log("  Backfill complete! The Cascata workflow is ready.");
  console.log("=".repeat(80));
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
