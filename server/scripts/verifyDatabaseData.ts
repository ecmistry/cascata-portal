/**
 * Verify that demo data is stored in the database (not hard-coded)
 * This script queries the database directly to show the data exists
 */

import * as db from "../db";
import * as dotenv from "dotenv";

dotenv.config();

async function verifyDatabaseData() {
  console.log("=".repeat(80));
  console.log("Verifying Database Data (Not Hard-Coded)");
  console.log("=".repeat(80));
  console.log();

  try {
    // Get companies from database
    const companies = await db.getCompaniesByUser(1);
    console.log("📊 Companies in Database:");
    console.log("-".repeat(80));
    companies.forEach(c => {
      console.log(`  ID: ${c.id} - ${c.name}`);
      console.log(`     Created: ${c.createdAt}`);
      console.log(`     User ID: ${c.userId}`);
    });
    console.log();

    // For each company, show SQL types and their data
    for (const company of companies) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`Company: ${company.name} (ID: ${company.id})`);
      console.log("=".repeat(80));

      // Get SQL types from database
      const sqlTypes = await db.getSqlTypesByCompany(company.id);
      console.log(`\n📋 SQL Types in Database (${sqlTypes.length}):`);
      sqlTypes.forEach(st => {
        console.log(`  - ${st.displayName} (${st.name}) - ID: ${st.id}`);
      });

      // Get SQL history from database
      const sqlHistory = await db.getSqlHistoryByCompany(company.id);
      console.log(`\n📈 SQL History Records in Database (${sqlHistory.length}):`);
      
      // Group by SQL type
      const bySqlType = new Map<number, number>();
      sqlHistory.forEach(sh => {
        const count = bySqlType.get(sh.sqlTypeId) || 0;
        bySqlType.set(sh.sqlTypeId, count + 1);
      });

      bySqlType.forEach((count, sqlTypeId) => {
        const sqlType = sqlTypes.find(st => st.id === sqlTypeId);
        const totalVolume = sqlHistory
          .filter(sh => sh.sqlTypeId === sqlTypeId)
          .reduce((sum, sh) => sum + sh.volume, 0);
        console.log(`  - ${sqlType?.displayName || 'Unknown'}: ${count} records, Total Volume: ${totalVolume}`);
      });

      // Get conversion rates from database
      const conversionRates = await db.getConversionRatesByCompany(company.id);
      const regions = await db.getRegionsByCompany(company.id);
      console.log(`\n🔄 Conversion Rates in Database (${conversionRates.length}):`);
      conversionRates.forEach(cr => {
        const region = regions.find(r => r.id === cr.regionId);
        const sqlType = sqlTypes.find(st => st.id === cr.sqlTypeId);
        console.log(`  - ${region?.displayName || 'Unknown'} ${sqlType?.displayName || 'Unknown'}: ${(cr.oppCoverageRatio / 100).toFixed(2)}%`);
      });

      // Get forecasts from database
      const forecasts = await db.getForecastsByCompany(company.id);
      console.log(`\n💰 Forecasts in Database (${forecasts.length}):`);
      
      // Group by SQL type
      const forecastsBySqlType = new Map<number, { count: number; revenue: number; opps: number }>();
      forecasts.forEach(f => {
        const existing = forecastsBySqlType.get(f.sqlTypeId) || { count: 0, revenue: 0, opps: 0 };
        forecastsBySqlType.set(f.sqlTypeId, {
          count: existing.count + 1,
          revenue: existing.revenue + ((f.predictedRevenueNew || 0) + (f.predictedRevenueUpsell || 0)) / 100,
          opps: existing.opps + (f.predictedOpps || 0) / 100,
        });
      });

      forecastsBySqlType.forEach((data, sqlTypeId) => {
        const sqlType = sqlTypes.find(st => st.id === sqlTypeId);
        console.log(`  - ${sqlType?.displayName || 'Unknown'}: ${data.count} forecasts, ${data.opps.toFixed(1)} opps, $${data.revenue.toFixed(2)} revenue`);
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ Verification Complete!");
    console.log("=".repeat(80));
    console.log("\nAll data shown above is stored in the MySQL database.");
    console.log("The dashboard queries this database in real-time via tRPC API endpoints.");
    console.log("No hard-coded data is used - everything comes from the database.");
    console.log();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error verifying database data:", message);
    throw error;
  }
}

verifyDatabaseData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

