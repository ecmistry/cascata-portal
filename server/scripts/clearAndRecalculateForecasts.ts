/**
 * Clear old forecasts and recalculate with updated data
 * This ensures forecasts match the new conversion rates and SQL volumes
 */

import * as db from "../db";
import * as dotenv from "dotenv";

dotenv.config();

async function clearAndRecalculate(companyId: number) {
  console.log("=".repeat(80));
  console.log("Clearing Old Forecasts and Recalculating");
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

    // Delete all existing forecasts
    console.log("Deleting old forecasts...");
    await db.deleteForecastsByCompany(companyId);
    console.log("✓ Deleted all old forecasts\n");

    console.log("=".repeat(80));
    console.log("✅ Old forecasts cleared successfully!");
    console.log("=".repeat(80));
    console.log();
    console.log("Next steps:");
    console.log("  1. Go to the portal and navigate to this company");
    console.log("  2. Click 'Recalculate' to generate new forecasts with updated data");
    console.log("  3. The new forecasts will use:");
    console.log("     - Updated SQL volumes from Excel");
    console.log("     - Correct conversion rates (opportunities < SQLs)");
    console.log("     - Proper time distribution (89/10/1%)");
    console.log();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", message);
    throw error;
  }
}

const companyIdArg = process.argv[2];
if (!companyIdArg) {
  console.log("Usage: npx tsx server/scripts/clearAndRecalculateForecasts.ts <companyId>");
  process.exit(1);
}

const companyId = parseInt(companyIdArg);
if (isNaN(companyId)) {
  console.log("❌ Invalid company ID. Please provide a number.");
  process.exit(1);
}

clearAndRecalculate(companyId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });

