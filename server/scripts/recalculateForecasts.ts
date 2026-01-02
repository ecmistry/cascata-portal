/**
 * Programmatically recalculate forecasts for a company
 * This triggers the same calculation that happens when clicking "Recalculate" in the portal
 */

import * as db from "../db";
import { runCascadeForecast } from "../cascadeEngine";
import * as dotenv from "dotenv";

dotenv.config();

async function recalculateForecasts(companyId: number) {
  console.log("=".repeat(80));
  console.log("Recalculating Forecasts");
  console.log("=".repeat(80));
  console.log(`Company ID: ${companyId}\n`);

  try {
    const company = await db.getCompanyById(companyId);
    if (!company) {
      console.log(`❌ Company with ID ${companyId} not found.`);
      return;
    }
    console.log(`✓ Found company: ${company.name}\n`);

    // Check data availability
    const regions = await db.getRegionsByCompany(companyId);
    const sqlTypes = await db.getSqlTypesByCompany(companyId);
    const sqlHistory = await db.getSqlHistoryByCompany(companyId);
    const conversionRates = await db.getConversionRatesByCompany(companyId);

    console.log("Data availability:");
    console.log(`  Regions: ${regions.length}`);
    console.log(`  SQL Types: ${sqlTypes.length}`);
    console.log(`  SQL History records: ${sqlHistory.length}`);
    console.log(`  Conversion Rates: ${conversionRates.length}`);
    console.log();

    if (sqlHistory.length === 0) {
      console.log("⚠️  No SQL history data found. Cannot calculate forecasts.");
      return;
    }

    if (conversionRates.length === 0) {
      console.log("⚠️  No conversion rates found. Cannot calculate forecasts.");
      return;
    }

    // Show sample conversion rates
    console.log("Sample conversion rates:");
    for (const cr of conversionRates.slice(0, 3)) {
      const region = regions.find(r => r.id === cr.regionId);
      const sqlType = sqlTypes.find(t => t.id === cr.sqlTypeId);
      console.log(`  ${region?.displayName || 'Unknown'} ${sqlType?.displayName || 'Unknown'}: ${(cr.oppCoverageRatio / 100).toFixed(2)}%`);
    }
    console.log();

    // Calculate forecasts
    console.log("Calculating forecasts...");
    const count = await runCascadeForecast(companyId);
    console.log(`✓ Generated ${count} forecast records\n`);

    // Verify results
    const forecasts = await db.getForecastsByCompany(companyId);
    const totalSqls = forecasts.reduce((sum, f) => sum + (f.predictedSqls || 0), 0);
    const totalOpps = forecasts.reduce((sum, f) => sum + (f.predictedOpps || 0), 0) / 100; // Divide by 100 for precision
    const totalRevenue = forecasts.reduce((sum, f) => sum + (f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0), 0) / 100;

    console.log("=".repeat(80));
    console.log("✅ Forecasts calculated successfully!");
    console.log("=".repeat(80));
    console.log();
    console.log("Summary:");
    console.log(`  Total Forecast Records: ${forecasts.length}`);
    console.log(`  Total SQLs: ${totalSqls}`);
    console.log(`  Total Opportunities: ${totalOpps.toFixed(1)}`);
    console.log(`  Total Revenue: $${(totalRevenue / 100).toLocaleString()}`);
    console.log();
    
    if (totalOpps > 0 && totalSqls > 0) {
      const conversionRate = (totalOpps / totalSqls) * 100;
      console.log(`  Overall Conversion Rate: ${conversionRate.toFixed(2)}%`);
      if (totalOpps < totalSqls) {
        console.log(`  ✅ Opportunities < SQLs (CORRECT!)`);
      } else {
        console.log(`  ⚠️  Opportunities > SQLs (This shouldn't happen!)`);
      }
    }
    console.log();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error calculating forecasts:", message);
    console.error(error);
    throw error;
  }
}

async function recalculateBoth() {
  // Recalculate SaaS Company Demo
  await recalculateForecasts(1);
  console.log("\n\n");
  
  // Recalculate Enterprise Sales Demo
  await recalculateForecasts(2);
}

recalculateBoth()
  .then(() => {
    console.log("=".repeat(80));
    console.log("✅ Both companies recalculated!");
    console.log("=".repeat(80));
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Recalculation failed:", error);
    process.exit(1);
  });

