/**
 * Analyze Excel Cascade Model Spreadsheet
 * Extracts data from Gravitee_C_SSP_BRAND_ADJ_2_ACO_AE_SPLIT.xlsx
 * to understand the model structure and create accurate demo data
 */

import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const EXCEL_FILE_PATH = path.resolve(process.cwd(), "Gravitee_C_SSP_BRAND_ADJ_2_ACO_AE_SPLIT.xlsx");

interface SheetAnalysis {
  name: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  sampleData: any[][];
  keyData: Record<string, any>;
}

/**
 * Analyze the Excel file structure
 */
async function analyzeExcelFile() {
  console.log("=".repeat(80));
  console.log("Excel Cascade Model Analysis");
  console.log("=".repeat(80));
  console.log();

  // Check if file exists
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ Excel file not found at: ${EXCEL_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`✅ Excel file found: ${EXCEL_FILE_PATH}`);
  console.log();

  // Read the workbook
  console.log("Reading Excel workbook...");
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const sheetNames = workbook.SheetNames;
  console.log(`✅ Found ${sheetNames.length} sheet(s): ${sheetNames.join(", ")}`);
  console.log();

  // Analyze each sheet
  const analyses: SheetAnalysis[] = [];

  for (const sheetName of sheetNames) {
    console.log("-".repeat(80));
    console.log(`Analyzing sheet: "${sheetName}"`);
    console.log("-".repeat(80));

    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
    
    const analysis: SheetAnalysis = {
      name: sheetName,
      rowCount: jsonData.length,
      columnCount: jsonData[0]?.length || 0,
      headers: jsonData[0] || [],
      sampleData: jsonData.slice(0, 20), // First 20 rows
      keyData: {},
    };

    // Try to identify key data patterns
    if (jsonData.length > 0) {
      // Look for regions, SQL types, conversion rates, etc.
      const dataString = JSON.stringify(jsonData).toLowerCase();
      
      if (dataString.includes("noram") || dataString.includes("north america")) {
        analysis.keyData.hasRegions = true;
      }
      if (dataString.includes("inbound") || dataString.includes("outbound") || dataString.includes("ilo")) {
        analysis.keyData.hasSqlTypes = true;
      }
      if (dataString.includes("conversion") || dataString.includes("win rate") || dataString.includes("coverage")) {
        analysis.keyData.hasConversionRates = true;
      }
      if (dataString.includes("sql") || dataString.includes("sqs")) {
        analysis.keyData.hasSqlData = true;
      }
      if (dataString.includes("revenue") || dataString.includes("acv") || dataString.includes("deal")) {
        analysis.keyData.hasRevenueData = true;
      }
      if (dataString.includes("quarter") || dataString.includes("q1") || dataString.includes("q2")) {
        analysis.keyData.hasTimeData = true;
      }
    }

    console.log(`  Rows: ${analysis.rowCount}`);
    console.log(`  Columns: ${analysis.columnCount}`);
    console.log(`  Headers: ${analysis.headers.slice(0, 10).join(", ")}${analysis.headers.length > 10 ? "..." : ""}`);
    console.log(`  Key Data:`, analysis.keyData);
    console.log();

    // Show sample data
    if (analysis.sampleData.length > 0) {
      console.log("  Sample Data (first 5 rows):");
      for (let i = 0; i < Math.min(5, analysis.sampleData.length); i++) {
        const row = analysis.sampleData[i];
        if (row && row.length > 0) {
          const rowPreview = row.slice(0, 8).map((cell: any) => {
            if (cell === null || cell === undefined) return "";
            const str = String(cell);
            return str.length > 15 ? str.substring(0, 15) + "..." : str;
          }).join(" | ");
          console.log(`    Row ${i + 1}: ${rowPreview}`);
        }
      }
      console.log();
    }

    analyses.push(analysis);
  }

  // Find the main data sheet (likely contains SQLs, conversion rates, etc.)
  console.log("=".repeat(80));
  console.log("Key Findings:");
  console.log("=".repeat(80));
  
  const mainSheet = analyses.find(s => 
    s.keyData.hasSqlData || 
    s.keyData.hasConversionRates || 
    s.keyData.hasRegions
  ) || analyses[0];

  if (mainSheet) {
    console.log(`\nMain data sheet: "${mainSheet.name}"`);
    console.log(`\nExtracting structured data...`);
    
    // Try to extract structured data
    const extractedData = extractStructuredData(workbook, mainSheet.name);
    
    console.log("\n" + "=".repeat(80));
    console.log("Extracted Data Summary:");
    console.log("=".repeat(80));
    console.log(JSON.stringify(extractedData, null, 2));
    
    // Save extracted data to a JSON file for reference
    const outputPath = path.resolve(process.cwd(), "server/scripts/extractedExcelData.json");
    fs.writeFileSync(outputPath, JSON.stringify(extractedData, null, 2));
    console.log(`\n✅ Extracted data saved to: ${outputPath}`);
  }

  return analyses;
}

/**
 * Extract structured data from the main sheet
 */
function extractStructuredData(workbook: XLSX.WorkBook, sheetName: string): any {
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
  
  const result: any = {
    regions: [],
    sqlTypes: [],
    historicalSqls: [],
    conversionRates: [],
    dealEconomics: [],
    timeDistributions: [],
  };

  // Try to find data patterns
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const rowString = row.map((cell: any) => String(cell || "")).join(" ").toLowerCase();
    
    // Look for region names
    if (rowString.includes("noram") || rowString.includes("north america")) {
      result.regions.push("NORAM");
    }
    if (rowString.includes("emesa") && rowString.includes("north")) {
      result.regions.push("EMESA_NORTH");
    }
    if (rowString.includes("emesa") && rowString.includes("south")) {
      result.regions.push("EMESA_SOUTH");
    }

    // Look for SQL types
    if (rowString.includes("inbound")) {
      result.sqlTypes.push("INBOUND");
    }
    if (rowString.includes("outbound")) {
      result.sqlTypes.push("OUTBOUND");
    }
    if (rowString.includes("ilo")) {
      result.sqlTypes.push("ILO");
    }
    if (rowString.includes("event")) {
      result.sqlTypes.push("EVENT");
    }
    if (rowString.includes("partner")) {
      result.sqlTypes.push("PARTNER");
    }
  }

  // Remove duplicates
  result.regions = Array.from(new Set(result.regions));
  result.sqlTypes = Array.from(new Set(result.sqlTypes));

  // Try to extract numeric data (SQL volumes, conversion rates, etc.)
  // This is a simplified extraction - we'll need to refine based on actual structure
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length < 3) continue;

    // Look for numeric patterns that might be SQL volumes
    const numericValues = row.filter((cell: any) => {
      const num = Number(cell);
      return !isNaN(num) && num > 0 && num < 10000;
    });

    if (numericValues.length > 0) {
      // This might be SQL volume data
      // We'll need to see the actual structure to parse correctly
    }
  }

  return result;
}

// Run the analysis
analyzeExcelFile()
  .then(() => {
    console.log("\n✅ Analysis completed");
    process.exit(0);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Analysis failed:", message);
    console.error(error);
    process.exit(1);
  });

