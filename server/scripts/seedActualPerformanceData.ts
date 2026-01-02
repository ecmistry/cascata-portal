/**
 * Seed Actual Performance Data for Demo Companies
 * 
 * Creates realistic actual performance data based on forecasts
 * to enable Performance page demonstrations.
 */

import * as db from "../db";
import * as dotenv from "dotenv";
import { companies } from "../../drizzle/schema";

dotenv.config();

/**
 * Seed actual performance data for a company based on forecasts
 * Creates actuals that are 85-115% of predicted to show realistic variance
 */
async function seedActualsForCompany(companyId: number) {
  console.log(`\n📊 Seeding actual performance data for company ${companyId}...`);

  // Get all forecasts for this company
  const forecasts = await db.getForecastsByCompany(companyId);
  
  if (forecasts.length === 0) {
    console.log(`⚠️  No forecasts found for company ${companyId}. Skipping actuals.`);
    return;
  }

  console.log(`Found ${forecasts.length} forecast records`);

  // Get regions and SQL types for this company
  const regions = await db.getRegionsByCompany(companyId);
  const sqlTypes = await db.getSqlTypesByCompany(companyId);

  const regionMap = new Map(regions.map(r => [r.id, r]));
  const sqlTypeMap = new Map(sqlTypes.map(st => [st.id, st]));

  let createdCount = 0;
  let updatedCount = 0;

  // For each forecast, create a corresponding actual with realistic variance
  for (const forecast of forecasts) {
    // Skip future quarters (only create actuals for past/current quarters)
    const now = new Date();
    const forecastDate = new Date(forecast.year, (forecast.quarter - 1) * 3, 1);
    const quartersAhead = Math.floor((now.getTime() - forecastDate.getTime()) / (1000 * 60 * 60 * 24 * 90));
    
    // Only create actuals for quarters that have passed or are current
    if (quartersAhead < -1) {
      continue; // Skip future quarters
    }

    // Calculate actual revenue with realistic variance (85-115% of predicted)
    // Use a deterministic but varied multiplier based on company/region/quarter
    const seed = companyId * 1000 + forecast.regionId * 100 + forecast.sqlTypeId * 10 + forecast.year * 4 + forecast.quarter;
    const random = (Math.sin(seed) * 10000) % 1; // Deterministic "random" between -1 and 1
    const varianceMultiplier = 0.85 + (random + 1) * 0.15; // Between 0.85 and 1.15

    const predictedRevenue = (forecast.predictedRevenueNew || 0) + (forecast.predictedRevenueUpsell || 0);
    const actualRevenue = Math.round(predictedRevenue * varianceMultiplier);

    // Calculate actual opportunities with similar variance
    const predictedOpps = Math.round((forecast.predictedOpps || 0) / 100);
    const actualOpps = Math.round(predictedOpps * varianceMultiplier);

    // Calculate actual SQLs (usually closer to predicted, less variance)
    const sqlVarianceMultiplier = 0.90 + (random + 1) * 0.10; // Between 0.90 and 1.10
    const actualSqls = Math.round((forecast.predictedSqls || 0) * sqlVarianceMultiplier);

    // Check if actual already exists
    const existingActuals = await db.getActualsByCompany(companyId);
    const existingActual = existingActuals.find(
      a => a.regionId === forecast.regionId &&
           a.sqlTypeId === forecast.sqlTypeId &&
           a.year === forecast.year &&
           a.quarter === forecast.quarter
    );

    if (existingActual) {
      // Update existing actual
      await db.upsertActual({
        companyId,
        regionId: forecast.regionId,
        sqlTypeId: forecast.sqlTypeId,
        year: forecast.year,
        quarter: forecast.quarter,
        actualSqls,
        actualOpps,
        actualRevenue,
      });
      updatedCount++;
    } else {
      // Create new actual
      await db.upsertActual({
        companyId,
        regionId: forecast.regionId,
        sqlTypeId: forecast.sqlTypeId,
        year: forecast.year,
        quarter: forecast.quarter,
        actualSqls,
        actualOpps,
        actualRevenue,
      });
      createdCount++;
    }
  }

  console.log(`✓ Created ${createdCount} new actual records`);
  console.log(`✓ Updated ${updatedCount} existing actual records`);
  console.log(`✓ Total actual records: ${createdCount + updatedCount}`);
}

/**
 * Main function to seed actuals for all demo companies
 */
async function seedActualPerformanceData() {
  console.log("=".repeat(80));
  console.log("Seeding Actual Performance Data for Demo Companies");
  console.log("=".repeat(80));

  try {
    // Get all companies - query the database directly
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      throw new Error("Database not available");
    }
    
    const companiesList = await dbInstance.select().from(companies);
    
    if (companiesList.length === 0) {
      console.log("⚠️  No companies found. Please seed companies first.");
      return;
    }

    console.log(`Found ${companiesList.length} companies\n`);

    // Seed actuals for each company
    for (const company of companiesList) {
      console.log(`\nProcessing: ${company.name} (ID: ${company.id})`);
      await seedActualsForCompany(company.id);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ Actual performance data seeding completed!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Error seeding actual performance data:", error);
    throw error;
  }
}

// Run if called directly (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedActualPerformanceData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedActualPerformanceData, seedActualsForCompany };

