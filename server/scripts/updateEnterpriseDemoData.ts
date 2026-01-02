/**
 * Update Enterprise Sales Demo data to match Excel spreadsheet
 * Fixes conversion rates to ensure opportunities < SQLs
 */

import * as db from "../db";
import * as dotenv from "dotenv";

dotenv.config();

async function updateEnterpriseDemo(companyId: number) {
  console.log("=".repeat(80));
  console.log("Updating Enterprise Sales Demo Data");
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

    // Find or create regions
    console.log("Setting up regions...");
    const regions = [
      { name: "NORAM", displayName: "North America" },
      { name: "EMESA_NORTH", displayName: "EMESA North" },
    ];

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

    // Find or create SQL types
    console.log("Setting up SQL types...");
    const sqlTypes = [
      { name: "INBOUND", displayName: "Inbound" },
      { name: "OUTBOUND", displayName: "Outbound" },
      { name: "ILO", displayName: "ILO (Inside Lead Owned)" },
    ];

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

    // Update conversion rates - realistic values for POC demonstration
    console.log("Updating conversion rates...");
    const conversionRates = [
      // NORAM - Enterprise sales typically have lower conversion than SaaS
      { region: "NORAM", sqlType: "INBOUND", oppCoverage: 350, winRateNew: 2800, winRateUpsell: 3000 },
      { region: "NORAM", sqlType: "OUTBOUND", oppCoverage: 200, winRateNew: 2200, winRateUpsell: 2500 },
      { region: "NORAM", sqlType: "ILO", oppCoverage: 250, winRateNew: 2400, winRateUpsell: 2700 },
      
      // EMESA North
      { region: "EMESA_NORTH", sqlType: "INBOUND", oppCoverage: 320, winRateNew: 2700, winRateUpsell: 2900 },
      { region: "EMESA_NORTH", sqlType: "OUTBOUND", oppCoverage: 180, winRateNew: 2100, winRateUpsell: 2400 },
      { region: "EMESA_NORTH", sqlType: "ILO", oppCoverage: 220, winRateNew: 2300, winRateUpsell: 2600 },
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
    console.log(`  ✓ Conversion rates now ensure opportunities < SQLs`);
    console.log();

    // Add historical SQL data for all SQL types
    console.log("Adding historical SQL data...");
    const quarters = [
      { year: 2024, quarter: 4 },
      { year: 2025, quarter: 1 },
      { year: 2025, quarter: 2 },
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 4 },
    ];

    // Realistic SQL volumes for Enterprise Sales Demo
    const sqlVolumes: Record<string, Record<string, number>> = {
      NORAM: {
        INBOUND: 45,   // Higher volume for inbound
        OUTBOUND: 80,  // Primary source for enterprise
        ILO: 30,       // Moderate ILO volume
      },
      EMESA_NORTH: {
        INBOUND: 35,
        OUTBOUND: 60,
        ILO: 25,
      },
    };

    let sqlCount = 0;
    for (const q of quarters) {
      for (const region of regions) {
        for (const sqlType of sqlTypes) {
          const volume = sqlVolumes[region.name]?.[sqlType.name] || 0;
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
    console.log(`  ✓ Added ${sqlCount} historical SQL records`);
    console.log();

    // Update deal economics
    console.log("Updating deal economics...");
    const dealEconomics = [
      { region: "NORAM", acvNew: 5000000, acvUpsell: 4000000 }, // $50k / $40k
      { region: "EMESA_NORTH", acvNew: 4500000, acvUpsell: 3500000 }, // $45k / $35k
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
    console.log("✅ Enterprise Sales Demo data updated successfully!");
    console.log("=".repeat(80));
    console.log();
    console.log("Next steps:");
    console.log("  1. Clear old forecasts for this company");
    console.log("  2. Click 'Recalculate' to generate new forecasts");
    console.log("  3. Verify: Opportunities should now be LESS than SQLs");
    console.log();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error updating demo data:", message);
    throw error;
  }
}

const companyIdArg = process.argv[2];
if (!companyIdArg) {
  console.log("Usage: npx tsx server/scripts/updateEnterpriseDemoData.ts <companyId>");
  process.exit(1);
}

updateEnterpriseDemo(parseInt(companyIdArg))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Update failed:", error);
    process.exit(1);
  });

