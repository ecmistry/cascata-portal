/**
 * Update both demo companies with ACTUAL conversion rates from Excel
 * This ensures we match the spreadsheet exactly
 */

import * as db from "../db";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// Load Excel conversion rates
const excelRatesPath = path.resolve(process.cwd(), "server/scripts/excelConversionRates.json");
let excelRates: any = { summary: {} };

if (fs.existsSync(excelRatesPath)) {
  excelRates = JSON.parse(fs.readFileSync(excelRatesPath, "utf8"));
  console.log(`✅ Loaded Excel conversion rates from: ${excelRatesPath}`);
} else {
  console.log("⚠️  Excel conversion rates not found. Run extractExcelConversionRates.ts first.");
  process.exit(1);
}

/**
 * Get average conversion rate from Excel for a region/SQL type combination
 */
function getExcelConversionRate(region: string, sqlType: string): number {
  const key = `${region}_${sqlType}`;
  const summary = excelRates.summary[key];
  
  if (summary) {
    return summary.avgOppCoverageRatio; // Already in basis points
  }
  
  // Fallback to defaults if not found in Excel
  console.log(`⚠️  No Excel rate found for ${key}, using default`);
  if (sqlType === "INBOUND") return 4500; // 45% average from Excel
  if (sqlType === "OUTBOUND") return 1500; // 15% from Excel
  if (sqlType === "ILO") return 4300; // 43% average from Excel
  if (sqlType === "EVENT") return 1500; // 15% from Excel
  if (sqlType === "PARTNER") return 500; // 5% default
  
  return 500; // 5% default
}

async function updateCompanyWithExcelRates(companyId: number, companyName: string) {
  console.log("=".repeat(80));
  console.log(`Updating ${companyName} with Excel Conversion Rates`);
  console.log("=".repeat(80));
  console.log(`Company ID: ${companyId}\n`);

  try {
    const company = await db.getCompanyById(companyId);
    if (!company) {
      console.log(`❌ Company with ID ${companyId} not found.`);
      return;
    }
    console.log(`✓ Found company: ${company.name}\n`);

    // Get existing regions and SQL types
    const existingRegions = await db.getRegionsByCompany(companyId);
    const existingSqlTypes = await db.getSqlTypesByCompany(companyId);

    const regionIds: Record<string, number> = {};
    const sqlTypeIds: Record<string, number> = {};

    // Map regions
    for (const region of existingRegions) {
      if (region.name === "NORAM" || region.displayName === "North America") {
        regionIds["NORAM"] = region.id;
      } else if (region.name === "EMESA_NORTH" || region.displayName === "EMESA North") {
        regionIds["EMESA_NORTH"] = region.id;
      } else if (region.name === "EMESA_SOUTH" || region.displayName === "EMESA South") {
        regionIds["EMESA_SOUTH"] = region.id;
      }
    }

    // Map SQL types
    for (const sqlType of existingSqlTypes) {
      if (sqlType.name === "INBOUND" || sqlType.displayName === "Inbound") {
        sqlTypeIds["INBOUND"] = sqlType.id;
      } else if (sqlType.name === "OUTBOUND" || sqlType.displayName === "Outbound") {
        sqlTypeIds["OUTBOUND"] = sqlType.id;
      } else if (sqlType.name === "ILO" || sqlType.displayName?.includes("ILO")) {
        sqlTypeIds["ILO"] = sqlType.id;
      } else if (sqlType.name === "EVENT" || sqlType.displayName === "Event") {
        sqlTypeIds["EVENT"] = sqlType.id;
      } else if (sqlType.name === "PARTNER" || sqlType.displayName === "Partner") {
        sqlTypeIds["PARTNER"] = sqlType.id;
      }
    }

    console.log("Updating conversion rates with Excel values...");
    console.log("-".repeat(80));

    let updatedCount = 0;

    // Update conversion rates using Excel averages
    for (const [regionName, regionId] of Object.entries(regionIds)) {
      for (const [sqlTypeName, sqlTypeId] of Object.entries(sqlTypeIds)) {
        const excelRate = getExcelConversionRate(regionName, sqlTypeName);
        const excelSummary = excelRates.summary[`${regionName}_${sqlTypeName}`];
        
        console.log(`  ${regionName} ${sqlTypeName}:`);
        if (excelSummary) {
          console.log(`    Excel Avg: ${(excelSummary.avgConversionRate * 100).toFixed(2)}% (${excelRate} bp)`);
          console.log(`    Range: ${(excelSummary.minConversionRate * 100).toFixed(1)}% - ${(excelSummary.maxConversionRate * 100).toFixed(1)}%`);
        } else {
          console.log(`    Using default: ${(excelRate / 100).toFixed(2)}% (${excelRate} bp)`);
        }

        // Use realistic win rates based on SQL type
        let winRateNew = 2500; // 25% default
        let winRateUpsell = 2800; // 28% default
        
        if (sqlTypeName === "INBOUND") {
          winRateNew = 2500; // 25%
          winRateUpsell = 2800; // 28%
        } else if (sqlTypeName === "OUTBOUND") {
          winRateNew = 2200; // 22%
          winRateUpsell = 2500; // 25%
        } else if (sqlTypeName === "ILO") {
          winRateNew = 2300; // 23%
          winRateUpsell = 2600; // 26%
        } else if (sqlTypeName === "EVENT") {
          winRateNew = 2000; // 20%
          winRateUpsell = 2400; // 24%
        } else if (sqlTypeName === "PARTNER") {
          winRateNew = 1800; // 18%
          winRateUpsell = 2200; // 22%
        }

        await db.upsertConversionRate({
          companyId,
          regionId,
          sqlTypeId,
          oppCoverageRatio: excelRate,
          winRateNew,
          winRateUpsell,
        });
        
        updatedCount++;
        console.log();
      }
    }

    console.log("=".repeat(80));
    console.log(`✅ Updated ${updatedCount} conversion rate records with Excel values!`);
    console.log("=".repeat(80));
    console.log();
    console.log("⚠️  IMPORTANT: Excel uses MUCH higher conversion rates than we were using:");
    console.log("   - INBOUND: 32-62.5% (we were using 4.5%)");
    console.log("   - OUTBOUND: 15% (we were using 2%)");
    console.log("   - ILO: 40-50% (we were using 2%)");
    console.log("   - EVENT: 15% (we were using 1%)");
    console.log();
    console.log("Next steps:");
    console.log("  1. Clear old forecasts");
    console.log("  2. Click 'Recalculate' in portal");
    console.log("  3. Opportunities should now match Excel!");
    console.log();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error updating conversion rates:", message);
    throw error;
  }
}

async function updateBothCompanies() {
  // Update SaaS Company Demo
  await updateCompanyWithExcelRates(1, "SaaS Company Demo");
  console.log("\n");
  
  // Update Enterprise Sales Demo
  await updateCompanyWithExcelRates(2, "Enterprise Sales Demo");
}

updateBothCompanies()
  .then(() => {
    console.log("=".repeat(80));
    console.log("✅ Both companies updated with Excel conversion rates!");
    console.log("=".repeat(80));
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Update failed:", error);
    process.exit(1);
  });

