/**
 * Seed Complete Gravitee Cascade Model Data
 * 
 * This script populates the database with the full Gravitee dataset
 * extracted from the Excel spreadsheet, including all historical quarters.
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { readFileSync } from "fs";

// Database connection
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
const db = drizzle(process.env.DATABASE_URL);

// Load extracted data
const extractedData = JSON.parse(
  readFileSync("/home/ubuntu/gravitee_extracted_data.json", "utf-8")
);

// Demo user OpenID
const DEMO_USER_OPENID = "demo_user_gravitee";

async function seedGraviteeData() {
  console.log("🌱 Starting Gravitee complete data seed...\n");

  try {
    // 1. Create or get demo user
    console.log("Creating demo user...");
    await db.insert(schema.users).values({
      openId: DEMO_USER_OPENID,
      name: "Gravitee Demo User",
      email: "demo@gravitee.io",
      role: "admin",
    }).onDuplicateKeyUpdate({ set: { name: "Gravitee Demo User" } });

    const [user] = await db.select().from(schema.users)
      .where(eq(schema.users.openId, DEMO_USER_OPENID)).limit(1);
    
    if (!user) {
      throw new Error("Failed to create or find demo user");
    }
    const userId = user.id;
    console.log(`✓ User ID: ${userId}\n`);

    // 2. Create company
    console.log("Creating Gravitee company...");
    
    // Check if company already exists
    const existingCompanies = await db.select().from(schema.companies)
      .where(eq(schema.companies.userId, userId)).limit(1);
    
    let companyId;
    if (existingCompanies.length > 0) {
      companyId = existingCompanies[0].id;
      console.log(`✓ Using existing company ID: ${companyId}\n`);
    } else {
      const [company] = await db.insert(schema.companies).values({
        userId,
        name: "Gravitee",
        description: "API Management Platform - Complete Cascade Model with Historical Data (Q4 2024 - Q4 2028)",
      });
      companyId = company.insertId;
      console.log(`✓ Company created with ID: ${companyId}\n`);
    }

    // 3. Create regions
    console.log("Creating regions...");
    const regionIds = {};
    const regionDisplayNames = {
      'NORAM': 'North America',
      'EMESA_NORTH': 'EMESA North',
      'EMESA_SOUTH': 'EMESA South',
    };

    for (const regionName of extractedData.regions) {
      const [result] = await db.insert(schema.regions).values({
        companyId,
        name: regionName,
        displayName: regionDisplayNames[regionName],
        enabled: true,
      }).onDuplicateKeyUpdate({ set: { enabled: true } });
      
      // Get the region ID
      const [region] = await db.select().from(schema.regions)
        .where(eq(schema.regions.companyId, companyId))
        .where(eq(schema.regions.name, regionName))
        .limit(1);
      
      regionIds[regionName] = region.id;
      console.log(`✓ Region: ${regionDisplayNames[regionName]} (ID: ${region.id})`);
    }
    console.log("");

    // 4. Create SQL types
    console.log("Creating SQL types...");
    const sqlTypeIds = {};
    const sqlTypeDisplayNames = {
      'INBOUND': 'Inbound',
      'OUTBOUND': 'Outbound',
      'ILO': 'ILO (Inside Lead Owned)',
      'EVENT': 'Event',
      'PARTNER': 'Partner',
    };

    for (const sqlTypeName of extractedData.sqlTypes) {
      const [result] = await db.insert(schema.sqlTypes).values({
        companyId,
        name: sqlTypeName,
        displayName: sqlTypeDisplayNames[sqlTypeName],
        enabled: true,
      }).onDuplicateKeyUpdate({ set: { enabled: true } });
      
      // Get the SQL type ID
      const [sqlType] = await db.select().from(schema.sqlTypes)
        .where(eq(schema.sqlTypes.companyId, companyId))
        .where(eq(schema.sqlTypes.name, sqlTypeName))
        .limit(1);
      
      sqlTypeIds[sqlTypeName] = sqlType.id;
      console.log(`✓ SQL Type: ${sqlTypeDisplayNames[sqlTypeName]} (ID: ${sqlType.id})`);
    }
    console.log("");

    // 5. Create historical SQL data
    console.log("Creating historical SQL data...");
    let sqlCount = 0;
    for (const record of extractedData.historicalSQLs) {
      await db.insert(schema.sqlHistory).values({
        companyId,
        regionId: regionIds[record.region],
        sqlTypeId: sqlTypeIds[record.sqlType],
        year: record.year,
        quarter: record.quarter,
        volume: record.volume,
      }).onDuplicateKeyUpdate({ set: { volume: record.volume } });
      sqlCount++;
    }
    console.log(`✓ Created/updated ${sqlCount} historical SQL records\n`);

    // 6. Create conversion rates
    console.log("Creating conversion rates...");
    let convCount = 0;
    for (const record of extractedData.conversionRates) {
      await db.insert(schema.conversionRates).values({
        companyId,
        regionId: regionIds[record.region],
        sqlTypeId: sqlTypeIds[record.sqlType],
        oppCoverageRatio: record.oppCoverageRatio,
        winRateNew: record.winRateNew,
        winRateUpsell: record.winRateUpsell,
      }).onDuplicateKeyUpdate({ 
        set: { 
          oppCoverageRatio: record.oppCoverageRatio,
          winRateNew: record.winRateNew,
          winRateUpsell: record.winRateUpsell,
        } 
      });
      convCount++;
    }
    console.log(`✓ Created/updated ${convCount} conversion rate records\n`);

    // 7. Create deal economics
    console.log("Creating deal economics...");
    let dealCount = 0;
    for (const record of extractedData.dealEconomics) {
      if (record.acvNew && record.acvUpsell) {
        await db.insert(schema.dealEconomics).values({
          companyId,
          regionId: regionIds[record.region],
          acvNew: record.acvNew,
          acvUpsell: record.acvUpsell,
        }).onDuplicateKeyUpdate({ 
          set: { 
            acvNew: record.acvNew,
            acvUpsell: record.acvUpsell,
          } 
        });
        dealCount++;
      }
    }
    console.log(`✓ Created/updated ${dealCount} deal economics records\n`);

    // 8. Create time distributions
    console.log("Creating time distributions...");
    let timeCount = 0;
    for (const record of extractedData.timeDistributions) {
      await db.insert(schema.timeDistributions).values({
        companyId,
        sqlTypeId: sqlTypeIds[record.sqlType],
        sameQuarterPct: record.sameQuarterPct,
        nextQuarterPct: record.nextQuarterPct,
        twoQuarterPct: record.twoQuarterPct,
      }).onDuplicateKeyUpdate({ 
        set: { 
          sameQuarterPct: record.sameQuarterPct,
          nextQuarterPct: record.nextQuarterPct,
          twoQuarterPct: record.twoQuarterPct,
        } 
      });
      timeCount++;
    }
    console.log(`✓ Created/updated ${timeCount} time distribution records\n`);

    // 9. Run cascade forecast calculation
    console.log("Running cascade forecast calculation...");
    const { runCascadeForecast } = await import("../server/cascadeEngine.ts");
    const forecastCount = await runCascadeForecast(companyId);
    console.log(`✓ Generated ${forecastCount} forecast entries\n`);

    console.log("✅ Gravitee complete data seed finished successfully!");
    console.log(`\nCompany ID: ${companyId}`);
    console.log("You can now view the complete Gravitee cascade model with all historical data.\n");

  } catch (error) {
    console.error("❌ Error seeding Gravitee data:", error);
    throw error;
  }
}

// Run the seed
seedGraviteeData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
