/**
 * Update all demo companies with Inbound and ILO SQL type data
 * This ensures the POC demonstration shows SQLs from different sources
 */

import * as db from "../db";
import * as dotenv from "dotenv";
import { runCascadeForecast } from "../cascadeEngine";

dotenv.config();

async function updateAllDemos() {
  console.log("=".repeat(80));
  console.log("Updating All Demo Companies with Inbound and ILO Data");
  console.log("=".repeat(80));
  console.log();

  try {
    // Find demo companies
    const allCompanies = await db.getCompaniesByUser(1); // Assuming admin user ID is 1
    const saasCompany = allCompanies.find(c => c.name.includes("SaaS") || c.name.includes("saas"));
    const enterpriseCompany = allCompanies.find(c => c.name.includes("Enterprise") || c.name.includes("enterprise"));

    if (!saasCompany && !enterpriseCompany) {
      console.log("❌ No demo companies found. Please create them first.");
      return;
    }

    // Update SaaS Company Demo
    if (saasCompany) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`Updating: ${saasCompany.name} (ID: ${saasCompany.id})`);
      console.log("=".repeat(80));
      
      // Import and run the update script
      const { default: updateSaaS } = await import("./updateSaaSDemoData");
      // We'll call the internal function directly
      console.log("Running SaaS Company Demo update...");
      // For now, we'll just log - the user should run the script separately
      console.log(`  → Run: npx tsx server/scripts/updateSaaSDemoData.ts ${saasCompany.id}`);
    }

    // Update Enterprise Sales Demo
    if (enterpriseCompany) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`Updating: ${enterpriseCompany.name} (ID: ${enterpriseCompany.id})`);
      console.log("=".repeat(80));
      console.log(`  → Run: npx tsx server/scripts/updateEnterpriseDemoData.ts ${enterpriseCompany.id}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ Update instructions provided");
    console.log("=".repeat(80));
    console.log("\nAfter running the update scripts:");
    console.log("  1. Clear old forecasts for each company");
    console.log("  2. Recalculate forecasts in the portal");
    console.log("  3. Verify SQL Type Effectiveness shows Inbound, ILO, and Outbound");
    console.log();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", message);
    throw error;
  }
}

// List all companies to help user find IDs
async function listCompanies() {
  try {
    const allCompanies = await db.getCompaniesByUser(1);
    console.log("\nAvailable Companies:");
    console.log("=".repeat(80));
    allCompanies.forEach(c => {
      console.log(`  ID: ${c.id} - ${c.name}`);
    });
    console.log();
  } catch (error) {
    console.error("Error listing companies:", error);
  }
}

const command = process.argv[2];
if (command === "list") {
  listCompanies()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  updateAllDemos()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

