/**
 * Extract detailed data from Excel Cascade Model
 * Focuses on "Overall Performance" sheet and individual cascade sheets
 */

import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const EXCEL_FILE_PATH = path.resolve(process.cwd(), "Gravitee_C_SSP_BRAND_ADJ_2_ACO_AE_SPLIT.xlsx");

interface ExtractedData {
  historicalSqls: Array<{
    region: string;
    sqlType: string;
    year: number;
    quarter: number;
    volume: number;
  }>;
  conversionRates: Array<{
    region: string;
    sqlType: string;
    oppCoverageRatio: number; // basis points
    winRateNew: number; // basis points
    winRateUpsell: number; // basis points
  }>;
  dealEconomics: Array<{
    region: string;
    acvNew: number; // cents
    acvUpsell: number; // cents
  }>;
  timeDistributions: {
    sameQuarterPct: number; // basis points
    nextQuarterPct: number; // basis points
    twoQuarterPct: number; // basis points
  };
}

/**
 * Extract data from Overall Performance sheet
 */
function extractOverallPerformance(workbook: XLSX.WorkBook): Partial<ExtractedData> {
  const sheetName = "Overall Performance";
  if (!workbook.SheetNames.includes(sheetName)) {
    console.log(`⚠️  Sheet "${sheetName}" not found`);
    return {};
  }

  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  console.log(`\n📊 Analyzing "${sheetName}" sheet...`);
  console.log(`   Rows: ${jsonData.length}, Columns: ${jsonData[0]?.length || 0}`);

  const result: Partial<ExtractedData> = {
    historicalSqls: [],
    conversionRates: [],
    dealEconomics: [],
  };

  // Find header row (likely contains quarter information)
  let headerRowIndex = -1;
  let currentRegion = "";
  let currentSqlType = "";

  for (let i = 0; i < Math.min(50, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const rowString = row.map((cell: any) => String(cell || "")).join(" ");

    // Identify region rows
    if (rowString.includes("NORAM") && !rowString.includes("EMESA")) {
      currentRegion = "NORAM";
      console.log(`   Found region: ${currentRegion} at row ${i + 1}`);
    } else if (rowString.includes("EMESA") && rowString.includes("NORTH")) {
      currentRegion = "EMESA_NORTH";
      console.log(`   Found region: ${currentRegion} at row ${i + 1}`);
    } else if (rowString.includes("EMESA") && rowString.includes("SOUTH")) {
      currentRegion = "EMESA_SOUTH";
      console.log(`   Found region: ${currentRegion} at row ${i + 1}`);
    }

    // Identify SQL type rows
    if (rowString.toLowerCase().includes("inbound") && rowString.toLowerCase().includes("sql")) {
      currentSqlType = "INBOUND";
    } else if (rowString.toLowerCase().includes("outbound") && rowString.toLowerCase().includes("sql")) {
      currentSqlType = "OUTBOUND";
    } else if (rowString.toLowerCase().includes("ilo") && rowString.toLowerCase().includes("sql")) {
      currentSqlType = "ILO";
    } else if (rowString.toLowerCase().includes("event") && rowString.toLowerCase().includes("sql")) {
      currentSqlType = "EVENT";
    } else if (rowString.toLowerCase().includes("partner") && rowString.toLowerCase().includes("sql")) {
      currentSqlType = "PARTNER";
    }

    // Look for quarter headers (Q1, Q2, Q3, Q4 followed by year)
    if (rowString.match(/Q[1-4]\s+\d{4}/)) {
      headerRowIndex = i;
      console.log(`   Found header row at ${i + 1}`);
      break;
    }
  }

  // Extract SQL volume data
  if (headerRowIndex >= 0 && currentRegion) {
    const headerRow = jsonData[headerRowIndex];
    const quarters: Array<{ year: number; quarter: number; colIndex: number }> = [];

    // Parse quarter headers
    for (let col = 0; col < headerRow.length; col++) {
      const cell = String(headerRow[col] || "");
      const match = cell.match(/Q([1-4])\s+(\d{4})/);
      if (match) {
        quarters.push({
          quarter: parseInt(match[1]),
          year: parseInt(match[2]),
          colIndex: col,
        });
      }
    }

    console.log(`   Found ${quarters.length} quarters:`, quarters.map(q => `Q${q.quarter} ${q.year}`).join(", "));

    // Extract SQL volumes for each region/SQL type combination
    for (let rowIdx = headerRowIndex + 1; rowIdx < Math.min(headerRowIndex + 20, jsonData.length); rowIdx++) {
      const row = jsonData[rowIdx];
      if (!row || row.length === 0) continue;

      const rowString = row.map((cell: any) => String(cell || "")).join(" ").toLowerCase();
      
      let sqlType = "";
      if (rowString.includes("inbound") && rowString.includes("sql")) {
        sqlType = "INBOUND";
      } else if (rowString.includes("outbound") && rowString.includes("sql")) {
        sqlType = "OUTBOUND";
      } else if (rowString.includes("ilo") && rowString.includes("sql")) {
        sqlType = "ILO";
      } else if (rowString.includes("event") && rowString.includes("sql")) {
        sqlType = "EVENT";
      } else if (rowString.includes("partner") && rowString.includes("sql")) {
        sqlType = "PARTNER";
      }

      if (sqlType && currentRegion) {
        // Extract volumes for each quarter
        for (const q of quarters) {
          const volume = Number(row[q.colIndex]);
          if (!isNaN(volume) && volume > 0) {
            result.historicalSqls!.push({
              region: currentRegion,
              sqlType,
              year: q.year,
              quarter: q.quarter,
              volume: Math.round(volume),
            });
          }
        }
      }
    }
  }

  return result;
}

/**
 * Extract data from individual cascade sheets
 */
function extractCascadeSheet(workbook: XLSX.WorkBook, sheetName: string): any {
  if (!workbook.SheetNames.includes(sheetName)) {
    return null;
  }

  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  // Parse sheet name to get region and SQL type
  const nameParts = sheetName.split(" ");
  let region = "";
  let sqlType = "";

  if (nameParts.includes("NORAM")) {
    region = "NORAM";
  } else if (nameParts.includes("EMESA") && nameParts.includes("NORTH")) {
    region = "EMESA_NORTH";
  } else if (nameParts.includes("EMESA") && nameParts.includes("SOUTH")) {
    region = "EMESA_SOUTH";
  } else if (nameParts.includes("EMESA")) {
    region = "EMESA_NORTH"; // Default for EMESA
  }

  if (nameParts.includes("Inbound")) {
    sqlType = "INBOUND";
  } else if (nameParts.includes("Outbound")) {
    sqlType = "OUTBOUND";
  } else if (nameParts.includes("ILO")) {
    sqlType = "ILO";
  } else if (nameParts.includes("Event")) {
    sqlType = "EVENT";
  } else if (nameParts.includes("Partner")) {
    sqlType = "PARTNER";
  }

  // Look for SQL volumes, opportunities, and revenue data
  const data: any = {
    region,
    sqlType,
    sqls: [],
    opportunities: [],
    revenue: [],
  };

  // Find rows with "SQLs" label
  for (let i = 0; i < Math.min(100, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row || row.length < 3) continue;

    const firstCell = String(row[0] || "").toLowerCase();
    const secondCell = String(row[1] || "").toLowerCase();

    // Look for SQL volumes
    if (firstCell.includes("sql") || secondCell.includes("sql")) {
      // Extract quarter data
      for (let col = 2; col < Math.min(20, row.length); col++) {
        const value = Number(row[col]);
        if (!isNaN(value) && value > 0) {
          // Try to determine quarter from column position or header
          data.sqls.push(value);
        }
      }
    }

    // Look for opportunities
    if (firstCell.includes("opp") || secondCell.includes("opp")) {
      for (let col = 2; col < Math.min(20, row.length); col++) {
        const value = Number(row[col]);
        if (!isNaN(value) && value > 0) {
          data.opportunities.push(value);
        }
      }
    }

    // Look for revenue
    if (firstCell.includes("revenue") || firstCell.includes("rev")) {
      for (let col = 2; col < Math.min(20, row.length); col++) {
        const value = Number(row[col]);
        if (!isNaN(value) && value > 0) {
          data.revenue.push(value);
        }
      }
    }
  }

  return data;
}

/**
 * Main extraction function
 */
async function extractExcelData() {
  console.log("=".repeat(80));
  console.log("Excel Data Extraction");
  console.log("=".repeat(80));

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ Excel file not found: ${EXCEL_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`✅ Reading: ${EXCEL_FILE_PATH}\n`);

  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const result: ExtractedData = {
    historicalSqls: [],
    conversionRates: [],
    dealEconomics: [],
    timeDistributions: {
      sameQuarterPct: 8900, // Default 89%
      nextQuarterPct: 1000, // Default 10%
      twoQuarterPct: 100, // Default 1%
    },
  };

  // Extract from Overall Performance
  const overallData = extractOverallPerformance(workbook);
  if (overallData.historicalSqls) {
    result.historicalSqls.push(...overallData.historicalSqls);
  }

  // Extract from individual cascade sheets
  const cascadeSheets = workbook.SheetNames.filter(name => 
    name.includes("Cascade") && 
    (name.includes("NORAM") || name.includes("EMESA"))
  );

  console.log(`\n📈 Found ${cascadeSheets.length} cascade sheets`);
  for (const sheetName of cascadeSheets.slice(0, 5)) { // Analyze first 5
    const cascadeData = extractCascadeSheet(workbook, sheetName);
    if (cascadeData) {
      console.log(`   ${sheetName}: ${cascadeData.region} - ${cascadeData.sqlType}`);
    }
  }

  // Save results
  const outputPath = path.resolve(process.cwd(), "server/scripts/extractedExcelData.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ Extracted data saved to: ${outputPath}`);
  console.log(`\nSummary:`);
  console.log(`   Historical SQLs: ${result.historicalSqls.length} records`);
  console.log(`   Conversion Rates: ${result.conversionRates.length} records`);
  console.log(`   Deal Economics: ${result.dealEconomics.length} records`);

  return result;
}

extractExcelData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Extraction failed:", error);
    process.exit(1);
  });

