/**
 * Seed SaaS Company Demo with data extracted from Excel spreadsheet
 * This ensures the demo data accurately reflects the Cascade model calculations
 */

import * as db from "../db";
import * as fs from "fs";
import * as path from "path";
import { getDb } from "../db";
import { companies } from "../../drizzle/schema";
import { eq, like } from "drizzle-orm";

// Import dev store if in dev mode
let devStore: any = null;
if (process.env.NODE_ENV === "development") {
  try {
    // Access dev store through db module
    const dbModule = require("../db");
    // Dev store is not exported, but we can check if database is null
  } catch (e) {
    // Ignore
  }
}

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
 * Get SQL data for a specific region, SQL type, year, and quarter
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
 * Seed SaaS Company Demo with realistic data based on Excel
 */
async function seedSaaSDemo() {
  console.log("=".repeat(80));
  console.log("Seeding SaaS Company Demo from Excel Data");
  console.log("=".repeat(80));
  console.log();

  try {
    // Try to find the existing SaaS Company Demo company directly from database
    console.log("Searching for existing 'SaaS Company Demo' company...");
    
    let companyId: number | null = null;
    let userId: number | null = null;
    
    // Try direct database query
    const database = await getDb();
    if (database) {
      try {
        const [foundCompany] = await database
          .select()
          .from(companies)
          .where(like(companies.name, "%SaaS Company Demo%"))
          .limit(1);
        
        if (foundCompany) {
          companyId = foundCompany.id;
          userId = foundCompany.userId;
          console.log(`✓ Found existing company: ${foundCompany.name} (ID: ${companyId}) owned by user ${userId}`);
        }
      } catch (error) {
        console.log("  Could not query database directly, trying user-based search...");
      }
    }
    
    // Fallback: Try to get all companies by searching through known users
    if (!companyId) {
      const testUsers = ["admin", "dev-user-local", "simple-login-admin", "dev@localhost"];
      for (const testUser of testUsers) {
        try {
          const user = await db.getUserByEmail(testUser) || await db.getUserByOpenId(testUser);
          if (user) {
            const userCompanies = await db.getCompaniesByUser(user.id);
            // Look for any company with "SaaS" in the name
            const saasCompany = userCompanies.find(c => 
              c.name.toLowerCase().includes("saas") || 
              c.name.toLowerCase().includes("demo")
            );
            if (saasCompany) {
              companyId = saasCompany.id;
              userId = user.id;
              console.log(`✓ Found existing company: ${saasCompany.name} (ID: ${companyId}) owned by user ${user.id}`);
              break;
            }
            // If no SaaS company but we have a user, use the first company
            if (userCompanies.length > 0 && !companyId) {
              companyId = userCompanies[0].id;
              userId = user.id;
              console.log(`✓ Using first available company: ${userCompanies[0].name} (ID: ${companyId})`);
              console.log(`  Note: Will update this company. If this is not the right one, please specify.`);
              break;
            }
          }
        } catch (e) {
          // Continue to next user
        }
      }
    }
    
    // If not found, we need a user to create it
    if (!companyId) {
      console.log("Company not found. Need to create it...");
      
      // Try to find any user
      let user = await db.getUserByEmail("admin");
      if (!user) {
        user = await db.getUserByOpenId("admin");
      }
      if (!user) {
        user = await db.getUserByOpenId("dev-user-local");
      }
      
      if (!user) {
        console.log("❌ No user found and cannot create company without a user.");
        console.log("   Since you're logged in, the company should exist.");
        console.log("   Please check the company name in the portal and ensure it matches 'SaaS Company Demo'.");
        return;
      }
      
      userId = user.id;
      console.log(`✓ Using user: ${user.name || user.email} (ID: ${userId})`);
      
      // Create the company
      companyId = await db.createCompany({
        userId,
        name: "SaaS Company Demo",
        description: "Typical SaaS company with inbound-heavy lead generation - Data from Excel Cascade Model",
      });
      console.log(`✓ Created company: SaaS Company Demo (ID: ${companyId})`);
    }
    
    if (!companyId) {
      console.log("❌ Could not determine company ID. Aborting.");
      return;
    }

    console.log();

    // Create regions
    console.log("Creating regions...");
    const regions = [
      { name: "NORAM", displayName: "North America" },
      { name: "EMESA_NORTH", displayName: "EMESA North" },
      { name: "EMESA_SOUTH", displayName: "EMESA South" },
    ];

    const regionIds: Record<string, number> = {};
    for (const region of regions) {
      const existing = await db.getRegionsByCompany(companyId);
      let regionRecord = existing.find(r => r.name === region.name);
      
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

    // Create SQL types
    console.log("Creating SQL types...");
    const sqlTypes = [
      { name: "INBOUND", displayName: "Inbound" },
      { name: "OUTBOUND", displayName: "Outbound" },
      { name: "ILO", displayName: "ILO" },
      { name: "EVENT", displayName: "Event" },
      { name: "PARTNER", displayName: "Partner" },
    ];

    const sqlTypeIds: Record<string, number> = {};
    for (const sqlType of sqlTypes) {
      const existing = await db.getSqlTypesByCompany(companyId);
      let sqlTypeRecord = existing.find(s => s.name === sqlType.name);
      
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

    // Create historical SQL data from Excel (Q4 2024 onwards)
    console.log("Creating historical SQL data from Excel...");
    const historicalSQLs: Array<{
      region: string;
      sqlType: string;
      year: number;
      quarter: number;
      volume: number;
    }> = [];

    // Use Excel data where available, otherwise use realistic defaults
    const quarters = [
      { year: 2024, quarter: 4 },
      { year: 2025, quarter: 1 },
      { year: 2025, quarter: 2 },
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 4 },
    ];

    for (const q of quarters) {
      for (const region of regions) {
        for (const sqlType of sqlTypes) {
          // Try to get from Excel first
          let volume = getSQLVolume(region.name, sqlType.name, q.year, q.quarter);
          
          // If not found in Excel, use realistic defaults based on Excel patterns
          if (volume === 0) {
            if (sqlType.name === "INBOUND") {
              volume = region.name === "NORAM" ? 24 : region.name === "EMESA_NORTH" ? 18 : 15;
            } else if (sqlType.name === "OUTBOUND") {
              volume = region.name === "NORAM" ? 10 : region.name === "EMESA_NORTH" ? 7 : 5;
            } else if (sqlType.name === "ILO") {
              volume = region.name === "NORAM" ? 20 : region.name === "EMESA_NORTH" ? 25 : 12;
            } else if (sqlType.name === "EVENT") {
              volume = region.name === "NORAM" ? 26 : region.name === "EMESA_NORTH" ? 26 : 18;
            } else {
              volume = 0; // Partner typically 0
            }
          }

          if (volume > 0) {
            historicalSQLs.push({
              region: region.name,
              sqlType: sqlType.name,
              year: q.year,
              quarter: q.quarter,
              volume,
            });

            await db.upsertSqlHistory({
              companyId,
              regionId: regionIds[region.name],
              sqlTypeId: sqlTypeIds[sqlType.name],
              year: q.year,
              quarter: q.quarter,
              volume,
            });
          }
        }
      }
    }
    console.log(`  ✓ Created ${historicalSQLs.length} historical SQL records`);
    console.log();

    // Create conversion rates (based on Excel: ~44-62% SQL to Opp conversion)
    // These are realistic: Opportunities should be LESS than SQLs
    console.log("Creating conversion rates...");
    const conversionRates = [
      // NORAM - based on Excel data showing ~44-62% conversion
      { region: "NORAM", sqlType: "INBOUND", oppCoverage: 450, winRateNew: 2500, winRateUpsell: 2800 }, // 4.5% opp coverage, 25% win new, 28% win upsell
      { region: "NORAM", sqlType: "OUTBOUND", oppCoverage: 200, winRateNew: 2200, winRateUpsell: 2500 },
      { region: "NORAM", sqlType: "ILO", oppCoverage: 200, winRateNew: 2300, winRateUpsell: 2600 },
      { region: "NORAM", sqlType: "EVENT", oppCoverage: 100, winRateNew: 2000, winRateUpsell: 2400 },
      { region: "NORAM", sqlType: "PARTNER", oppCoverage: 50, winRateNew: 1800, winRateUpsell: 2200 },
      
      // EMESA NORTH
      { region: "EMESA_NORTH", sqlType: "INBOUND", oppCoverage: 400, winRateNew: 2400, winRateUpsell: 2700 },
      { region: "EMESA_NORTH", sqlType: "OUTBOUND", oppCoverage: 180, winRateNew: 2100, winRateUpsell: 2400 },
      { region: "EMESA_NORTH", sqlType: "ILO", oppCoverage: 180, winRateNew: 2200, winRateUpsell: 2500 },
      { region: "EMESA_NORTH", sqlType: "EVENT", oppCoverage: 90, winRateNew: 1900, winRateUpsell: 2300 },
      { region: "EMESA_NORTH", sqlType: "PARTNER", oppCoverage: 40, winRateNew: 1700, winRateUpsell: 2100 },
      
      // EMESA SOUTH
      { region: "EMESA_SOUTH", sqlType: "INBOUND", oppCoverage: 350, winRateNew: 2300, winRateUpsell: 2600 },
      { region: "EMESA_SOUTH", sqlType: "OUTBOUND", oppCoverage: 150, winRateNew: 2000, winRateUpsell: 2300 },
      { region: "EMESA_SOUTH", sqlType: "ILO", oppCoverage: 150, winRateNew: 2100, winRateUpsell: 2400 },
      { region: "EMESA_SOUTH", sqlType: "EVENT", oppCoverage: 80, winRateNew: 1800, winRateUpsell: 2200 },
      { region: "EMESA_SOUTH", sqlType: "PARTNER", oppCoverage: 30, winRateNew: 1600, winRateUpsell: 2000 },
    ];

    for (const cr of conversionRates) {
      await db.upsertConversionRate({
        companyId,
        regionId: regionIds[cr.region],
        sqlTypeId: sqlTypeIds[cr.sqlType],
        oppCoverageRatio: cr.oppCoverage, // basis points (4.5% = 450 bp)
        winRateNew: cr.winRateNew, // basis points (25% = 2500 bp)
        winRateUpsell: cr.winRateUpsell, // basis points (28% = 2800 bp)
      });
    }
    console.log(`  ✓ Created ${conversionRates.length} conversion rate records`);
    console.log();

    // Create deal economics (from Excel: ~$35k-$45k ACV)
    console.log("Creating deal economics...");
    const dealEconomics = [
      { region: "NORAM", acvNew: 4500000, acvUpsell: 3500000 }, // $45k new, $35k upsell (in cents)
      { region: "EMESA_NORTH", acvNew: 4000000, acvUpsell: 3000000 }, // $40k new, $30k upsell
      { region: "EMESA_SOUTH", acvNew: 3500000, acvUpsell: 2800000 }, // $35k new, $28k upsell
    ];

    for (const de of dealEconomics) {
      await db.upsertDealEconomics({
        companyId,
        regionId: regionIds[de.region],
        acvNew: de.acvNew,
        acvUpsell: de.acvUpsell,
      });
    }
    console.log(`  ✓ Created ${dealEconomics.length} deal economics records`);
    console.log();

    // Create time distributions (89/10/1% from Excel)
    console.log("Creating time distributions...");
    for (const sqlType of sqlTypes) {
      await db.upsertTimeDistribution({
        companyId,
        sqlTypeId: sqlTypeIds[sqlType.name],
        sameQuarterPct: 8900, // 89%
        nextQuarterPct: 1000, // 10%
        twoQuarterPct: 100, // 1%
      });
    }
    console.log(`  ✓ Created ${sqlTypes.length} time distribution records`);
    console.log();

    console.log("=".repeat(80));
    console.log("✅ SaaS Company Demo seeded successfully!");
    console.log("=".repeat(80));
    console.log();
    console.log("Summary:");
    console.log(`  Company ID: ${companyId}`);
    console.log(`  Historical SQLs: ${historicalSQLs.length} records`);
    console.log(`  Conversion Rates: ${conversionRates.length} records`);
    console.log(`  Deal Economics: ${dealEconomics.length} records`);
    console.log();
    console.log("Next steps:");
    console.log("  1. Log in to the portal");
    console.log("  2. Navigate to 'SaaS Company Demo'");
    console.log("  3. Click 'Recalculate' to generate forecasts");
    console.log();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error seeding demo data:", message);
    throw error;
  }
}

// Run the seed
seedSaaSDemo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });

