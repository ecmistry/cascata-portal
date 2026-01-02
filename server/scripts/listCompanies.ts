/**
 * List all companies to find demo company IDs
 */

import * as db from "../db";
import * as dotenv from "dotenv";

dotenv.config();

async function listCompanies() {
  try {
    // Get all companies (assuming admin user ID is 1)
    const companies = await db.getCompaniesByUser(1);
    
    console.log("\n" + "=".repeat(80));
    console.log("Available Companies:");
    console.log("=".repeat(80));
    
    if (companies.length === 0) {
      console.log("  No companies found.");
    } else {
      companies.forEach(c => {
        console.log(`  ID: ${c.id} - ${c.name}`);
      });
    }
    
    console.log("=".repeat(80));
    console.log();
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error listing companies:", message);
    throw error;
  }
}

listCompanies()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

