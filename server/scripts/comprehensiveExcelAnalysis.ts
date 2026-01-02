/**
 * Comprehensive Excel Analysis
 * Extracts SQL volumes, opportunities, conversion rates, and validates calculations
 */

import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const EXCEL_FILE_PATH = path.resolve(process.cwd(), "Gravitee_C_SSP_BRAND_ADJ_2_ACO_AE_SPLIT.xlsx");

interface ExcelData {
  sqlVolumes: Array<{
    region: string;
    sqlType: string;
    year: number;
    quarter: number;
    volume: number;
  }>;
  opportunities: Array<{
    region: string;
    sqlType: string;
    year: number;
    quarter: number;
    volume: number;
  }>;
  conversionRates: Array<{
    region: string;
    sqlType: string;
    sqlToOppRatio: number; // Actual ratio from Excel
    oppCoverageRatio: number; // In basis points
  }>;
}

function parseQuarter(header: string): { year: number; quarter: number } | null {
  const match = String(header).match(/Q([1-4])\s+(\d{2})/);
  if (match) {
    const quarter = parseInt(match[1]);
    let year = parseInt(match[2]);
    if (year < 50) {
      year = 2000 + year;
    } else {
      year = 1900 + year;
    }
    return { year, quarter };
  }
  return null;
}

function extractOverallPerformance(): ExcelData {
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const worksheet = workbook.Sheets["Overall Performance"];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  const result: ExcelData = {
    sqlVolumes: [],
    opportunities: [],
    conversionRates: [],
  };

  // Parse quarters from header
  const headerRow = jsonData[0];
  const quarters: Array<{ year: number; quarter: number; colIndex: number }> = [];
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

  console.log(`Found ${quarters.length} quarters in Overall Performance sheet\n`);

  let currentRegion = "";
  let currentSqlType = "";

  // Process rows
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
      currentSqlType = ""; // Reset SQL type when region changes
      continue;
    }

    // Identify SQL type and extract data
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
    } else if (secondCell.includes("opp") && !secondCell.includes("sql")) {
      // This is an opportunities row
      if (currentRegion && currentSqlType) {
        for (const q of quarters) {
          const volume = Number(row[q.colIndex]);
          if (!isNaN(volume) && volume > 0) {
            result.opportunities.push({
              region: currentRegion,
              sqlType: currentSqlType,
              year: q.year,
              quarter: q.quarter,
              volume: Math.round(volume),
            });
          }
        }
      }
      continue;
    } else {
      if (!secondCell.includes("sql") && !secondCell.includes("opp") && !secondCell.includes("total") && secondCell !== "") {
        currentSqlType = "";
      }
      continue;
    }

    // Extract SQL volumes
    if (currentRegion && currentSqlType) {
      for (const q of quarters) {
        const volume = Number(row[q.colIndex]);
        if (!isNaN(volume) && volume > 0) {
          result.sqlVolumes.push({
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

  // Calculate conversion rates from actual data
  const conversionMap = new Map<string, { sqls: number[]; opps: number[] }>();
  
  for (const sql of result.sqlVolumes) {
    const key = `${sql.region}_${sql.sqlType}`;
    if (!conversionMap.has(key)) {
      conversionMap.set(key, { sqls: [], opps: [] });
    }
    conversionMap.get(key)!.sqls.push(sql.volume);
  }

  for (const opp of result.opportunities) {
    const key = `${opp.region}_${opp.sqlType}`;
    if (conversionMap.has(key)) {
      conversionMap.get(key)!.opps.push(opp.volume);
    }
  }

  // Calculate average conversion rates
  for (const [key, data] of Array.from(conversionMap.entries())) {
    if (data.sqls.length > 0 && data.opps.length > 0) {
      const avgSqls = data.sqls.reduce((a: number, b: number) => a + b, 0) / data.sqls.length;
      const avgOpps = data.opps.reduce((a: number, b: number) => a + b, 0) / data.opps.length;
      const ratio = avgOpps / avgSqls;
      const [region, sqlType] = key.split("_");
      
      result.conversionRates.push({
        region,
        sqlType,
        sqlToOppRatio: ratio,
        oppCoverageRatio: Math.round(ratio * 10000), // Convert to basis points
      });
    }
  }

  return result;
}

function extractCascadeSheet(sheetName: string): any {
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return null;

  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
  
  // Look for SQL and Opportunity rows
  let sqlRow = -1;
  let oppRow = -1;
  
  for (let i = 0; i < Math.min(50, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row) continue;
    
    const rowString = row.map((cell: any) => String(cell || "")).join(" ").toLowerCase();
    
    if (rowString.includes("sql") && !rowString.includes("opp") && sqlRow === -1) {
      sqlRow = i;
    }
    if (rowString.includes("opp") && !rowString.includes("sql") && oppRow === -1) {
      oppRow = i;
    }
  }

  if (sqlRow === -1 || oppRow === -1) return null;

  // Extract quarter headers
  const headerRow = jsonData[0] || [];
  const quarters: Array<{ year: number; quarter: number; colIndex: number }> = [];
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

  // Extract SQL and Opportunity values
  const sqlData: number[] = [];
  const oppData: number[] = [];

  for (const q of quarters) {
    const sqlVal = Number(jsonData[sqlRow]?.[q.colIndex]);
    const oppVal = Number(jsonData[oppRow]?.[q.colIndex]);
    
    if (!isNaN(sqlVal) && sqlVal > 0) sqlData.push(sqlVal);
    if (!isNaN(oppVal) && oppVal > 0) oppData.push(oppVal);
  }

  if (sqlData.length === 0 || oppData.length === 0) return null;

  // Calculate conversion rate
  const avgSqls = sqlData.reduce((a, b) => a + b, 0) / sqlData.length;
  const avgOpps = oppData.reduce((a, b) => a + b, 0) / oppData.length;
  const conversionRate = avgOpps / avgSqls;

  return {
    sheetName,
    avgSqls: Math.round(avgSqls * 100) / 100,
    avgOpps: Math.round(avgOpps * 100) / 100,
    conversionRate: Math.round(conversionRate * 10000) / 100, // Percentage
    oppCoverageRatio: Math.round(conversionRate * 10000), // Basis points
    sampleData: {
      sqls: sqlData.slice(0, 5),
      opps: oppData.slice(0, 5),
    },
  };
}

async function analyzeExcel() {
  console.log("=".repeat(80));
  console.log("COMPREHENSIVE EXCEL ANALYSIS");
  console.log("=".repeat(80));
  console.log();

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ Excel file not found: ${EXCEL_FILE_PATH}`);
    process.exit(1);
  }

  // Extract from Overall Performance
  console.log("1. Extracting from 'Overall Performance' sheet...");
  console.log("-".repeat(80));
  const overallData = extractOverallPerformance();
  
  console.log(`   SQL Volumes: ${overallData.sqlVolumes.length} records`);
  console.log(`   Opportunities: ${overallData.opportunities.length} records`);
  console.log(`   Conversion Rates: ${overallData.conversionRates.length} calculated\n`);

  // Show conversion rates
  console.log("   Conversion Rates (from Overall Performance):");
  for (const cr of overallData.conversionRates) {
    console.log(`   ${cr.region} ${cr.sqlType}: ${cr.sqlToOppRatio.toFixed(4)} (${cr.oppCoverageRatio} bp)`);
  }
  console.log();

  // Extract from individual cascade sheets
  console.log("2. Extracting from individual Cascade sheets...");
  console.log("-".repeat(80));
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const cascadeSheets = workbook.SheetNames.filter(name => 
    name.includes("Cascade") && 
    (name.includes("NORAM") || name.includes("EMESA"))
  );

  const cascadeData: any[] = [];
  for (const sheetName of cascadeSheets) {
    const data = extractCascadeSheet(sheetName);
    if (data) {
      cascadeData.push(data);
      console.log(`   ${sheetName}:`);
      console.log(`     Avg SQLs: ${data.avgSqls}, Avg Opps: ${data.avgOpps}`);
      console.log(`     Conversion: ${data.conversionRate}% (${data.oppCoverageRatio} bp)`);
    }
  }
  console.log();

  // Save results
  const outputPath = path.resolve(process.cwd(), "server/scripts/comprehensiveExcelData.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    overallPerformance: overallData,
    cascadeSheets: cascadeData,
  }, null, 2));

  console.log("=".repeat(80));
  console.log("✅ Analysis complete!");
  console.log(`✅ Results saved to: ${outputPath}`);
  console.log("=".repeat(80));

  // Summary
  console.log("\nSUMMARY:");
  console.log("-".repeat(80));
  console.log(`Total SQL records: ${overallData.sqlVolumes.length}`);
  console.log(`Total Opportunity records: ${overallData.opportunities.length}`);
  console.log(`Conversion rates calculated: ${overallData.conversionRates.length}`);
  console.log(`Cascade sheets analyzed: ${cascadeData.length}`);
}

analyzeExcel()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Analysis failed:", error);
    process.exit(1);
  });

