/**
 * Seed Demo Data for Cascata - Transform Forecasting
 * 
 * This script populates the database with Gravitee's cascade model data
 * from the Excel spreadsheet for demonstration purposes.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";

// Database connection
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
const db = drizzle(process.env.DATABASE_URL);

// Demo user OpenID (replace with actual user if needed)
const DEMO_USER_OPENID = "demo_user_gravitee";

async function seedDemoData() {
  console.log("🌱 Starting demo data seed...\n");

  try {
    // 1. Create demo user
    console.log("Creating demo user...");
    await db.insert(schema.users).values({
      openId: DEMO_USER_OPENID,
      name: "Gravitee Demo User",
      email: "demo@gravitee.io",
      role: "admin",
    }).onDuplicateKeyUpdate({ set: { name: "Gravitee Demo User" } });

    // Get user ID
    const [user] = await db.select().from(schema.users).where(eq(schema.users.openId, DEMO_USER_OPENID)).limit(1);
    if (!user) {
      throw new Error("Failed to create or find demo user");
    }
    const userId = user.id;

    // 2. Create company
    console.log("Creating Gravitee company...");
    const [company] = await db.insert(schema.companies).values({
      userId,
      name: "Gravitee",
      description: "API Management Platform - Cascade Model Demo",
    }).onDuplicateKeyUpdate({ set: { name: "Gravitee" } });

    const companyId = company.insertId;
    console.log(`✓ Company created with ID: ${companyId}\n`);

    // 3. Create regions
    console.log("Creating regions...");
    const regions = [
      { name: "NORAM", displayName: "North America" },
      { name: "EMESA_NORTH", displayName: "EMESA North" },
      { name: "EMESA_SOUTH", displayName: "EMESA South" },
    ];

    const regionIds = {};
    for (const region of regions) {
      const [result] = await db.insert(schema.regions).values({
        companyId,
        name: region.name,
        displayName: region.displayName,
        enabled: true,
      });
      regionIds[region.name] = result.insertId;
      console.log(`✓ Region: ${region.displayName}`);
    }
    console.log("");

    // 4. Create SQL types
    console.log("Creating SQL types...");
    const sqlTypesData = [
      { name: "INBOUND", displayName: "Inbound" },
      { name: "OUTBOUND", displayName: "Outbound" },
      { name: "ILO", displayName: "ILO (Inside Lead Owned)" },
      { name: "EVENT", displayName: "Event" },
      { name: "PARTNER", displayName: "Partner" },
    ];

    const sqlTypeIds = {};
    for (const sqlType of sqlTypesData) {
      const [result] = await db.insert(schema.sqlTypes).values({
        companyId,
        name: sqlType.name,
        displayName: sqlType.displayName,
        enabled: true,
      });
      sqlTypeIds[sqlType.name] = result.insertId;
      console.log(`✓ SQL Type: ${sqlType.displayName}`);
    }
    console.log("");

    // 5. Create historical SQL data (Q4 2024 - sample data)
    console.log("Creating historical SQL data...");
    const historicalData = [
      // NORAM
      { region: "NORAM", sqlType: "INBOUND", year: 2024, quarter: 4, volume: 24 },
      { region: "NORAM", sqlType: "OUTBOUND", year: 2024, quarter: 4, volume: 10 },
      { region: "NORAM", sqlType: "ILO", year: 2024, quarter: 4, volume: 20 },
      { region: "NORAM", sqlType: "EVENT", year: 2024, quarter: 4, volume: 26 },
      { region: "NORAM", sqlType: "PARTNER", year: 2024, quarter: 4, volume: 0 },
      
      // EMESA NORTH
      { region: "EMESA_NORTH", sqlType: "INBOUND", year: 2024, quarter: 4, volume: 18 },
      { region: "EMESA_NORTH", sqlType: "OUTBOUND", year: 2024, quarter: 4, volume: 7 },
      { region: "EMESA_NORTH", sqlType: "ILO", year: 2024, quarter: 4, volume: 25 },
      { region: "EMESA_NORTH", sqlType: "EVENT", year: 2024, quarter: 4, volume: 26 },
      { region: "EMESA_NORTH", sqlType: "PARTNER", year: 2024, quarter: 4, volume: 0 },
      
      // EMESA SOUTH
      { region: "EMESA_SOUTH", sqlType: "INBOUND", year: 2024, quarter: 4, volume: 15 },
      { region: "EMESA_SOUTH", sqlType: "OUTBOUND", year: 2024, quarter: 4, volume: 5 },
      { region: "EMESA_SOUTH", sqlType: "ILO", year: 2024, quarter: 4, volume: 12 },
      { region: "EMESA_SOUTH", sqlType: "EVENT", year: 2024, quarter: 4, volume: 18 },
      { region: "EMESA_SOUTH", sqlType: "PARTNER", year: 2024, quarter: 4, volume: 0 },
    ];

    for (const data of historicalData) {
      await db.insert(schema.sqlHistory).values({
        companyId,
        regionId: regionIds[data.region],
        sqlTypeId: sqlTypeIds[data.sqlType],
        year: data.year,
        quarter: data.quarter,
        volume: data.volume,
      });
    }
    console.log(`✓ Created ${historicalData.length} historical SQL records\n`);

    // 6. Create conversion rates
    console.log("Creating conversion rates...");
    const conversionRatesData = [
      // NORAM - varying by SQL type
      { region: "NORAM", sqlType: "INBOUND", oppCoverage: 500, winRateNew: 2500, winRateUpsell: 3000 },
      { region: "NORAM", sqlType: "OUTBOUND", oppCoverage: 1000, winRateNew: 2000, winRateUpsell: 2500 },
      { region: "NORAM", sqlType: "ILO", oppCoverage: 400, winRateNew: 3000, winRateUpsell: 3500 },
      { region: "NORAM", sqlType: "EVENT", oppCoverage: 300, winRateNew: 2800, winRateUpsell: 3200 },
      { region: "NORAM", sqlType: "PARTNER", oppCoverage: 600, winRateNew: 2200, winRateUpsell: 2800 },
      
      // EMESA NORTH
      { region: "EMESA_NORTH", sqlType: "INBOUND", oppCoverage: 500, winRateNew: 2500, winRateUpsell: 3000 },
      { region: "EMESA_NORTH", sqlType: "OUTBOUND", oppCoverage: 800, winRateNew: 2000, winRateUpsell: 2500 },
      { region: "EMESA_NORTH", sqlType: "ILO", oppCoverage: 400, winRateNew: 3000, winRateUpsell: 3500 },
      { region: "EMESA_NORTH", sqlType: "EVENT", oppCoverage: 300, winRateNew: 2800, winRateUpsell: 3200 },
      { region: "EMESA_NORTH", sqlType: "PARTNER", oppCoverage: 600, winRateNew: 2200, winRateUpsell: 2800 },
      
      // EMESA SOUTH
      { region: "EMESA_SOUTH", sqlType: "INBOUND", oppCoverage: 500, winRateNew: 2500, winRateUpsell: 3000 },
      { region: "EMESA_SOUTH", sqlType: "OUTBOUND", oppCoverage: 700, winRateNew: 2000, winRateUpsell: 2500 },
      { region: "EMESA_SOUTH", sqlType: "ILO", oppCoverage: 400, winRateNew: 3000, winRateUpsell: 3500 },
      { region: "EMESA_SOUTH", sqlType: "EVENT", oppCoverage: 300, winRateNew: 2800, winRateUpsell: 3200 },
      { region: "EMESA_SOUTH", sqlType: "PARTNER", oppCoverage: 600, winRateNew: 2200, winRateUpsell: 2800 },
    ];

    for (const data of conversionRatesData) {
      await db.insert(schema.conversionRates).values({
        companyId,
        regionId: regionIds[data.region],
        sqlTypeId: sqlTypeIds[data.sqlType],
        oppCoverageRatio: data.oppCoverage,
        winRateNew: data.winRateNew,
        winRateUpsell: data.winRateUpsell,
      });
    }
    console.log(`✓ Created ${conversionRatesData.length} conversion rate records\n`);

    // 7. Create deal economics
    console.log("Creating deal economics...");
    const dealEconomicsData = [
      { region: "NORAM", acvNew: 11000000, acvUpsell: 4375400 }, // $110k, $43.75k
      { region: "EMESA_NORTH", acvNew: 8122400, acvUpsell: 3540300 }, // $81.22k, $35.40k
      { region: "EMESA_SOUTH", acvNew: 5884500, acvUpsell: 3540300 }, // $58.85k, $35.40k
    ];

    for (const data of dealEconomicsData) {
      await db.insert(schema.dealEconomics).values({
        companyId,
        regionId: regionIds[data.region],
        acvNew: data.acvNew,
        acvUpsell: data.acvUpsell,
      });
    }
    console.log(`✓ Created ${dealEconomicsData.length} deal economics records\n`);

    // 8. Create time distributions (89/10/1%)
    console.log("Creating time distributions...");
    for (const sqlType of Object.keys(sqlTypeIds)) {
      await db.insert(schema.timeDistributions).values({
        companyId,
        sqlTypeId: sqlTypeIds[sqlType],
        sameQuarterPct: 8900, // 89%
        nextQuarterPct: 1000, // 10%
        twoQuarterPct: 100, // 1%
      });
    }
    console.log(`✓ Created time distribution records\n`);

    console.log("✅ Demo data seed completed successfully!");
    console.log(`\nCompany ID: ${companyId}`);
    console.log("You can now log in and view the Gravitee cascade model.\n");

  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}

// Run the seed
seedDemoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
