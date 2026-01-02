/**
 * Extract actual SQL volumes and calculate proper demo data
 * Based on the Excel spreadsheet structure
 */

import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const EXCEL_FILE_PATH = path.resolve(process.cwd(), "Gravitee_C_SSP_BRAND_ADJ_2_ACO_AE_SPLIT.xlsx");

interface QuarterData {
  year: number;
  quarter: number;
  colIndex: number;
}

interface SQLData {
  region: string;
  sqlType: string;
  year: number;
  quarter: number;
  volume: number;
}

/**
 * Parse quarter from header (e.g., "Q1 23" -> {year: 2023, quarter: 1})
 */
function parseQuarter(header: string): { year: number; quarter: number } | null {
  const match = String(header).match(/Q([1-4])\s+(\d{2})/);
  if (match) {
    const quarter = parseInt(match[1]);
    let year = parseInt(match[2]);
    // Assume 20xx for years < 50, 19xx for years >= 50
    if (year < 50) {
      year = 2000 + year;
    } else {
      year = 1900 + year;
    }
    return { year, quarter };
  }
  return null;
}

/**
 * Extract SQL data from Overall Performance sheet
 */
function extractSQLData(): SQLData[] {
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const worksheet = workbook.Sheets["Overall Performance"];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  const sqlData: SQLData[] = [];
  const quarters: QuarterData[] = [];

  // Parse header row to get quarters
  const headerRow = jsonData[0];
  for (let col = 0; col < headerRow.length; col++) {
    const quarter = parseQuarter(headerRow[col]);
    if (quarter) {
      quarters.push({
        year: quarter.year,
        quarter: quarter.quarter,
        colIndex: col,
      });
    }
  }

  console.log(`Found ${quarters.length} quarters`);
  console.log(`Quarters: ${quarters.map(q => `Q${q.quarter} ${q.year}`).join(", ")}\n`);

  let currentRegion = "";
  let currentSqlType = "";

  // Process data rows
  for (let rowIdx = 1; rowIdx < jsonData.length; rowIdx++) {
    const row = jsonData[rowIdx];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || "").trim();
    const secondCell = String(row[1] || "").trim().toLowerCase();

    // Identify region
    if (firstCell === "NORAM" || firstCell === "EMESA N" || firstCell === "EMESA S") {
      if (firstCell === "NORAM") {
        currentRegion = "NORAM";
      } else if (firstCell === "EMESA N") {
        currentRegion = "EMESA_NORTH";
      } else if (firstCell === "EMESA S") {
        currentRegion = "EMESA_SOUTH";
      }
      continue;
    }

    // Identify SQL type
    if (secondCell.includes("inbound") && secondCell.includes("sql")) {
      currentSqlType = "INBOUND";
    } else if (secondCell.includes("outbound") && secondCell.includes("sql")) {
      currentSqlType = "OUTBOUND";
    } else if (secondCell.includes("ilo") && secondCell.includes("sql")) {
      currentSqlType = "ILO";
    } else if (secondCell.includes("event") && secondCell.includes("sql")) {
      currentSqlType = "EVENT";
    } else if (secondCell.includes("partner") && secondCell.includes("sql")) {
      currentSqlType = "PARTNER";
    } else {
      // Reset SQL type if we hit a non-SQL row
      if (!secondCell.includes("sql") && !secondCell.includes("opp") && !secondCell.includes("total")) {
        currentSqlType = "";
      }
      continue;
    }

    // Extract SQL volumes for each quarter
    if (currentRegion && currentSqlType) {
      for (const q of quarters) {
        const volume = Number(row[q.colIndex]);
        if (!isNaN(volume) && volume > 0) {
          sqlData.push({
            region: currentRegion,
            sqlType: currentSqlType,
            year: q.year,
            quarter: q.quarter,
            volume: Math.round(volume),
          });
        }
      }
    }
  }

  return sqlData;
}

/**
 * Main extraction
 */
async function extractData() {
  console.log("=".repeat(80));
  console.log("Extracting SQL Data from Excel");
  console.log("=".repeat(80));
  console.log();

  const sqlData = extractSQLData();

  // Group by region and SQL type for summary
  const summary: Record<string, Record<string, number>> = {};
  for (const data of sqlData) {
    const key = `${data.region}_${data.sqlType}`;
    if (!summary[data.region]) {
      summary[data.region] = {};
    }
    if (!summary[data.region][data.sqlType]) {
      summary[data.region][data.sqlType] = 0;
    }
    summary[data.region][data.sqlType] += data.volume;
  }

  console.log("\nSummary by Region and SQL Type:");
  console.log("-".repeat(80));
  for (const region of Object.keys(summary)) {
    console.log(`\n${region}:`);
    for (const sqlType of Object.keys(summary[region])) {
      console.log(`  ${sqlType}: ${summary[region][sqlType]} total SQLs`);
    }
  }

  // Save extracted data
  const outputPath = path.resolve(process.cwd(), "server/scripts/extractedSQLData.json");
  fs.writeFileSync(outputPath, JSON.stringify({ sqlData, summary }, null, 2));
  console.log(`\n✅ Extracted ${sqlData.length} SQL records`);
  console.log(`✅ Saved to: ${outputPath}`);

  // Show sample data
  console.log("\nSample Data (first 20 records):");
  console.log("-".repeat(80));
  for (const data of sqlData.slice(0, 20)) {
    console.log(`${data.region} | ${data.sqlType} | Q${data.quarter} ${data.year} | ${data.volume} SQLs`);
  }

  return sqlData;
}

extractData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Extraction failed:", error);
    process.exit(1);
  });

