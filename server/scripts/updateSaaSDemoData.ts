/**
 * Update SaaS Company Demo data - Simplified version that works with existing company
 * This script can be run while the server is running and will update the existing company
 */

import * as db from "../db";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Load extracted SQL data
const extractedDataPath = path.resolve(process.cwd(), "server/scripts/extractedSQLData.json");
let extractedSQLData: any = { sqlData: [] };

if (fs.existsSync(extractedDataPath)) {
  extractedSQLData = JSON.parse(fs.readFileSync(extractedDataPath, "utf8"));
  console.log(`✅ Loaded ${extractedSQLData.sqlData.length} SQL records from Excel`);
} else {
  console.log("⚠️  No extracted SQL data found. Using default values.");
}

/**
 * Get SQL volume for a specific region, SQL type, year, and quarter
 */
function getSQLVolume(region: string, sqlType: string, year: number, quarter: number): number {
  const match = extractedSQLData.sqlData.find((d: any) =>
    d.region === region &&
    d.sqlType === sqlType &&
    d.year === year &&
    d.quarter === quarter
  );
  return match ? match.volume : 0;
}

/**
 * Update SaaS Company Demo - accepts companyId as parameter
 */
async function updateSaaSDemo(companyId: number) {
  console.log("=".repeat(80));
  console.log("Updating SaaS Company Demo Data from Excel");
  console.log("=".repeat(80));
  console.log(`Company ID: ${companyId}\n`);

  try {
    // Verify company exists
    const company = await db.getCompanyById(companyId);
    if (!company) {
      console.log(`❌ Company with ID ${companyId} not found.`);
      return;
    }
    console.log(`✓ Found company: ${company.name}\n`);

    // Get or create regions
    console.log("Setting up regions...");
    const regions = [
      { name: "NORAM", displayName: "North America" },
      { name: "EMESA_NORTH", displayName: "EMESA North" },
      { name: "EMESA_SOUTH", displayName: "EMESA South" },
    ];

    const regionIds: Record<string, number> = {};
    const existingRegions = await db.getRegionsByCompany(companyId);
    
    for (const region of regions) {
      let regionRecord = existingRegions.find(r => r.name === region.name);
      
      if (!regionRecord) {
        const regionId = await db.createRegion({
          companyId,
          name: region.name,
          displayName: region.displayName,
          enabled: true,
        });
        regionIds[region.name] = regionId;
        console.log(`  ✓ Created region: ${region.displayName}`);
      } else {
        regionIds[region.name] = regionRecord.id;
        console.log(`  ✓ Using existing region: ${region.displayName}`);
      }
    }
    console.log();

    // Get or create SQL types
    console.log("Setting up SQL types...");
    const sqlTypes = [
      { name: "INBOUND", displayName: "Inbound" },
      { name: "OUTBOUND", displayName: "Outbound" },
      { name: "ILO", displayName: "ILO" },
      { name: "EVENT", displayName: "Event" },
      { name: "PARTNER", displayName: "Partner" },
    ];

    const sqlTypeIds: Record<string, number> = {};
    const existingSqlTypes = await db.getSqlTypesByCompany(companyId);
    
    for (const sqlType of sqlTypes) {
      let sqlTypeRecord = existingSqlTypes.find(s => s.name === sqlType.name);
      
      if (!sqlTypeRecord) {
        const sqlTypeId = await db.createSqlType({
          companyId,
          name: sqlType.name,
          displayName: sqlType.displayName,
          enabled: true,
        });
        sqlTypeIds[sqlType.name] = sqlTypeId;
        console.log(`  ✓ Created SQL type: ${sqlType.displayName}`);
      } else {
        sqlTypeIds[sqlType.name] = sqlTypeRecord.id;
        console.log(`  ✓ Using existing SQL type: ${sqlType.displayName}`);
      }
    }
    console.log();

    // Update historical SQL data from Excel
    console.log("Updating historical SQL data from Excel...");
    const quarters = [
      { year: 2024, quarter: 4 },
      { year: 2025, quarter: 1 },
      { year: 2025, quarter: 2 },
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 4 },
    ];

    let sqlCount = 0;
    for (const q of quarters) {
      for (const region of regions) {
        for (const sqlType of sqlTypes) {
          // Get from Excel or use realistic defaults
          let volume = getSQLVolume(region.name, sqlType.name, q.year, q.quarter);
          
          if (volume === 0) {
            // Use realistic defaults based on Excel patterns - ensure INBOUND and ILO have data
            if (sqlType.name === "INBOUND") {
              volume = region.name === "NORAM" ? 40 : region.name === "EMESA_NORTH" ? 30 : region.name === "EMESA_SOUTH" ? 20 : 0;
            } else if (sqlType.name === "OUTBOUND") {
              volume = region.name === "NORAM" ? 25 : region.name === "EMESA_NORTH" ? 18 : region.name === "EMESA_SOUTH" ? 12 : 0;
            } else if (sqlType.name === "ILO") {
              volume = region.name === "NORAM" ? 35 : region.name === "EMESA_NORTH" ? 28 : region.name === "EMESA_SOUTH" ? 18 : 0;
            } else if (sqlType.name === "EVENT") {
              volume = region.name === "NORAM" ? 15 : region.name === "EMESA_NORTH" ? 12 : region.name === "EMESA_SOUTH" ? 8 : 0;
            } else if (sqlType.name === "PARTNER") {
              volume = region.name === "NORAM" ? 10 : region.name === "EMESA_NORTH" ? 8 : region.name === "EMESA_SOUTH" ? 5 : 0;
            } else {
              volume = 0;
            }
          }

          if (volume > 0) {
            await db.upsertSqlHistory({
              companyId,
              regionId: regionIds[region.name],
              sqlTypeId: sqlTypeIds[sqlType.name],
              year: q.year,
              quarter: q.quarter,
              volume,
            });
            sqlCount++;
          }
        }
      }
    }
    console.log(`  ✓ Updated ${sqlCount} historical SQL records`);
    console.log();

    // Update conversion rates (realistic: opportunities should be LESS than SQLs)
    // Adjusted to show meaningful differences between SQL types for POC
    console.log("Updating conversion rates...");
    const conversionRates = [
      // NORAM - SaaS typically has higher conversion rates
      // INBOUND: 40% (4000 bp) - highest for SaaS
      { region: "NORAM", sqlType: "INBOUND", oppCoverage: 4000, winRateNew: 2500, winRateUpsell: 2800 },
      // OUTBOUND: 18% (1800 bp) - moderate
      { region: "NORAM", sqlType: "OUTBOUND", oppCoverage: 1800, winRateNew: 2200, winRateUpsell: 2500 },
      // ILO: 22% (2200 bp) - good conversion
      { region: "NORAM", sqlType: "ILO", oppCoverage: 2200, winRateNew: 2300, winRateUpsell: 2600 },
      { region: "NORAM", sqlType: "EVENT", oppCoverage: 1200, winRateNew: 2000, winRateUpsell: 2400 },
      { region: "NORAM", sqlType: "PARTNER", oppCoverage: 800, winRateNew: 1800, winRateUpsell: 2200 },
      
      // EMESA NORTH
      { region: "EMESA_NORTH", sqlType: "INBOUND", oppCoverage: 3800, winRateNew: 2400, winRateUpsell: 2700 },
      { region: "EMESA_NORTH", sqlType: "OUTBOUND", oppCoverage: 1600, winRateNew: 2100, winRateUpsell: 2400 },
      { region: "EMESA_NORTH", sqlType: "ILO", oppCoverage: 2000, winRateNew: 2200, winRateUpsell: 2500 },
      { region: "EMESA_NORTH", sqlType: "EVENT", oppCoverage: 1000, winRateNew: 1900, winRateUpsell: 2300 },
      { region: "EMESA_NORTH", sqlType: "PARTNER", oppCoverage: 700, winRateNew: 1700, winRateUpsell: 2100 },
      
      // EMESA SOUTH
      { region: "EMESA_SOUTH", sqlType: "INBOUND", oppCoverage: 3500, winRateNew: 2300, winRateUpsell: 2600 },
      { region: "EMESA_SOUTH", sqlType: "OUTBOUND", oppCoverage: 1500, winRateNew: 2000, winRateUpsell: 2300 },
      { region: "EMESA_SOUTH", sqlType: "ILO", oppCoverage: 1800, winRateNew: 2100, winRateUpsell: 2400 },
      { region: "EMESA_SOUTH", sqlType: "EVENT", oppCoverage: 900, winRateNew: 1800, winRateUpsell: 2200 },
      { region: "EMESA_SOUTH", sqlType: "PARTNER", oppCoverage: 600, winRateNew: 1600, winRateUpsell: 2000 },
    ];

    for (const cr of conversionRates) {
      await db.upsertConversionRate({
        companyId,
        regionId: regionIds[cr.region],
        sqlTypeId: sqlTypeIds[cr.sqlType],
        oppCoverageRatio: cr.oppCoverage,
        winRateNew: cr.winRateNew,
        winRateUpsell: cr.winRateUpsell,
      });
    }
    console.log(`  ✓ Updated ${conversionRates.length} conversion rate records`);
    console.log();

    // Update deal economics
    console.log("Updating deal economics...");
    const dealEconomics = [
      { region: "NORAM", acvNew: 4500000, acvUpsell: 3500000 },
      { region: "EMESA_NORTH", acvNew: 4000000, acvUpsell: 3000000 },
      { region: "EMESA_SOUTH", acvNew: 3500000, acvUpsell: 2800000 },
    ];

    for (const de of dealEconomics) {
      await db.upsertDealEconomics({
        companyId,
        regionId: regionIds[de.region],
        acvNew: de.acvNew,
        acvUpsell: de.acvUpsell,
      });
    }
    console.log(`  ✓ Updated ${dealEconomics.length} deal economics records`);
    console.log();

    // Update time distributions
    console.log("Updating time distributions...");
    for (const sqlType of sqlTypes) {
      await db.upsertTimeDistribution({
        companyId,
        sqlTypeId: sqlTypeIds[sqlType.name],
        sameQuarterPct: 8900,
        nextQuarterPct: 1000,
        twoQuarterPct: 100,
      });
    }
    console.log(`  ✓ Updated ${sqlTypes.length} time distribution records`);
    console.log();

    console.log("=".repeat(80));
    console.log("✅ SaaS Company Demo data updated successfully!");
    console.log("=".repeat(80));
    console.log();
    console.log("Next steps:");
    console.log("  1. Go to the portal and navigate to this company");
    console.log("  2. Click 'Recalculate' to generate new forecasts");
    console.log("  3. Verify: Opportunities should now be LESS than SQLs");
    console.log();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error updating demo data:", message);
    throw error;
  }
}

// Get company ID from command line argument or use default
const companyIdArg = process.argv[2];
if (!companyIdArg) {
  console.log("Usage: npx tsx server/scripts/updateSaaSDemoData.ts <companyId>");
  console.log();
  console.log("To find your company ID:");
  console.log("  1. Log in to the portal");
  console.log("  2. Navigate to 'SaaS Company Demo'");
  console.log("  3. Check the URL - it should be /model/<companyId>");
  console.log("  4. Use that companyId as the argument");
  process.exit(1);
}

const companyId = parseInt(companyIdArg);
if (isNaN(companyId)) {
  console.log("❌ Invalid company ID. Please provide a number.");
  process.exit(1);
}

updateSaaSDemo(companyId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Update failed:", error);
    process.exit(1);
  });

