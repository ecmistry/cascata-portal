#!/usr/bin/env tsx
/**
 * HubSpot → Cascata ELT Sync Runner
 *
 * Usage:
 *   npx tsx server/scripts/runHubSpotSync.ts              # delta sync (since last sync)
 *   npx tsx server/scripts/runHubSpotSync.ts --full        # full historical sync
 *   npx tsx server/scripts/runHubSpotSync.ts --days 7      # sync last 7 days
 *
 * Designed to run daily via cron:
 *   0 4 * * * cd /home/ec2-user/cascata-portal && /home/ec2-user/.nvm/versions/node/v20.20.1/bin/npx tsx server/scripts/runHubSpotSync.ts >> /var/log/cascata-sync.log 2>&1
 */

import * as dotenv from "dotenv";
dotenv.config();

import * as db from "../db";
import { syncFromHubSpot, type SyncStats } from "../hubspotSync";
import { companies } from "../../drizzle/schema";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "logs");

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function logToFile(message: string) {
  ensureLogDir();
  const logFile = join(LOG_DIR, "hubspot-sync.log");
  const ts = new Date().toISOString();
  appendFileSync(logFile, `[${ts}] ${message}\n`);
}

function parseArgs(): { fullSync: boolean; days?: number } {
  const args = process.argv.slice(2);
  if (args.includes("--full")) return { fullSync: true };
  const daysIdx = args.indexOf("--days");
  if (daysIdx !== -1 && args[daysIdx + 1]) {
    return { fullSync: false, days: parseInt(args[daysIdx + 1], 10) };
  }
  return { fullSync: false };
}

function formatStats(stats: SyncStats): string {
  const lines = [
    `  Contacts fetched:           ${stats.contactsFetched}`,
    `  Deals fetched:              ${stats.dealsFetched}`,
    `  SQL History upserted:       ${stats.sqlHistoryUpserted}`,
    `  Conversion Rates upserted:  ${stats.conversionRatesUpserted}`,
    `  Deal Economics upserted:    ${stats.dealEconomicsUpserted}`,
    `  Actuals upserted:           ${stats.actualsUpserted}`,
    `  Forecasts generated:        ${stats.forecastsGenerated}`,
    `  Duration:                   ${(stats.durationMs / 1000).toFixed(1)}s`,
  ];
  if (stats.errors.length > 0) {
    lines.push(`  Errors (${stats.errors.length}):`);
    for (const err of stats.errors) {
      lines.push(`    - ${err}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const { fullSync, days } = parseArgs();
  const mode = fullSync ? "FULL" : days ? `DELTA (last ${days} days)` : "DELTA (since last sync)";

  console.log("=".repeat(80));
  console.log(`  HubSpot → Cascata ELT Sync  [${mode}]`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log("=".repeat(80));
  console.log();

  logToFile(`Sync started [${mode}]`);

  const database = await db.getDb();
  if (!database) {
    const msg = "Database not available. Check DATABASE_URL.";
    console.error(msg);
    logToFile(`FAILED: ${msg}`);
    process.exit(1);
  }

  // Get all companies
  const companiesList = await database.select().from(companies);
  if (companiesList.length === 0) {
    const msg = "No companies found in database.";
    console.error(msg);
    logToFile(`FAILED: ${msg}`);
    process.exit(1);
  }

  let anyFailed = false;

  for (const company of companiesList) {
    console.log(`\nSyncing: ${company.name} (ID: ${company.id})`);
    console.log("-".repeat(60));

    let sinceDate: Date | undefined;
    if (!fullSync) {
      if (days) {
        sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      } else if (company.bigqueryLastSync && company.bigqueryLastSync.getTime() > 0) {
        // Reuse the bigqueryLastSync field as generic "last sync" timestamp
        sinceDate = company.bigqueryLastSync;
      }
    }

    if (sinceDate) {
      console.log(`  Delta since: ${sinceDate.toISOString()}`);
    } else {
      console.log("  Mode: full historical sync");
    }

    try {
      const stats = await syncFromHubSpot(company.id, {
        sinceDate,
        fullSync,
      });

      console.log("\n  Results:");
      console.log(formatStats(stats));

      if (stats.errors.length > 0) {
        anyFailed = true;
        logToFile(`Company ${company.id} (${company.name}): completed with ${stats.errors.length} errors in ${(stats.durationMs / 1000).toFixed(1)}s`);
      } else {
        logToFile(`Company ${company.id} (${company.name}): OK - ${stats.contactsFetched} contacts, ${stats.dealsFetched} deals, ${stats.forecastsGenerated} forecasts in ${(stats.durationMs / 1000).toFixed(1)}s`);
      }
    } catch (err) {
      anyFailed = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${msg}`);
      logToFile(`Company ${company.id} (${company.name}): FAILED - ${msg}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`  Sync completed: ${new Date().toISOString()}`);
  console.log("=".repeat(80));

  logToFile(`Sync completed (${anyFailed ? "with errors" : "success"})`);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  logToFile(`FATAL: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
