/**
 * Extract ACTUAL conversion rates from Excel cascade sheets
 * This will show us exactly what conversion rates Excel uses for each quarter
 */

import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const EXCEL_FILE_PATH = path.resolve(process.cwd(), "Gravitee_C_SSP_BRAND_ADJ_2_ACO_AE_SPLIT.xlsx");

interface ConversionRateData {
  region: string;
  sqlType: string;
  year: number;
  quarter: number;
  sqls: number;
  conversionRate: number; // As decimal (0.45 = 45%)
  oppCoverageRatio: number; // In basis points (4500 = 45%)
  opportunities: {
    sameQuarter: number;
    nextQuarter: number;
    twoQuartersLater: number;
  };
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

function extractConversionRatesFromSheet(sheetName: string): ConversionRateData[] {
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
  
  // Find SQL row (should have "SQLs" and "Conv" columns)
  let sqlRow = -1;
  for (let i = 0; i < Math.min(100, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row) continue;
    const rowString = row.map((c: any) => String(c || "").toLowerCase()).join(" ");
    if (rowString.includes("sqls") && rowString.includes("conv")) {
      sqlRow = i;
      break;
    }
  }

  if (sqlRow === -1) return [];

  // Parse region and SQL type from sheet name
  let region = "";
  let sqlType = "";
  if (sheetName.includes("NORAM")) region = "NORAM";
  else if (sheetName.includes("EMESA NORTH")) region = "EMESA_NORTH";
  else if (sheetName.includes("EMESA SOUTH")) region = "EMESA_SOUTH";

  if (sheetName.includes("Inbound")) sqlType = "INBOUND";
  else if (sheetName.includes("Outbound")) sqlType = "OUTBOUND";
  else if (sheetName.includes("ILO")) sqlType = "ILO";
  else if (sheetName.includes("Event")) sqlType = "EVENT";
  else if (sheetName.includes("Partner")) sqlType = "PARTNER";

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

  const results: ConversionRateData[] = [];

  // Extract SQL and conversion rate data
  // The SQL row format: [quarter label, "SQLs", "Conv", Q2 22 value, Q3 22 value, ...]
  for (let rowIdx = sqlRow + 1; rowIdx < Math.min(sqlRow + 50, jsonData.length); rowIdx++) {
    const row = jsonData[rowIdx];
    if (!row || row.length < 3) continue;

    // First cell should be a quarter label (Q1 22, Q2 22, etc.)
    const firstCell = String(row[0] || "").trim();
    const quarterMatch = parseQuarter(firstCell);
    if (!quarterMatch) continue;

    // Column 1 should be "SQLs" value, Column 2 should be "Conv" value
    const sqls = Number(row[1]);
    const conversionRate = Number(row[2]);

    if (isNaN(sqls) || sqls <= 0 || isNaN(conversionRate) || conversionRate <= 0) continue;

    // Find opportunities for this quarter in subsequent rows
    // Look for the row that has opportunities distributed across quarters
    let oppSameQuarter = 0;
    let oppNextQuarter = 0;
    let oppTwoQuartersLater = 0;

    // Find the quarter column index
    const quarterCol = quarters.find(q => 
      q.year === quarterMatch.year && q.quarter === quarterMatch.quarter
    );

    if (quarterCol) {
      // Look in the same row for opportunities in this quarter
      oppSameQuarter = Number(row[quarterCol.colIndex]) || 0;
      
      // Look for next quarter opportunities
      const nextQuarterCol = quarters.find(q => {
        if (quarterMatch.quarter < 4) {
          return q.year === quarterMatch.year && q.quarter === quarterMatch.quarter + 1;
        } else {
          return q.year === quarterMatch.year + 1 && q.quarter === 1;
        }
      });
      if (nextQuarterCol) {
        oppNextQuarter = Number(row[nextQuarterCol.colIndex]) || 0;
      }

      // Look for two quarters later
      const twoQuartersCol = quarters.find(q => {
        if (quarterMatch.quarter < 3) {
          return q.year === quarterMatch.year && q.quarter === quarterMatch.quarter + 2;
        } else if (quarterMatch.quarter === 3) {
          return q.year === quarterMatch.year + 1 && q.quarter === 1;
        } else {
          return q.year === quarterMatch.year + 1 && q.quarter === 2;
        }
      });
      if (twoQuartersCol) {
        oppTwoQuartersLater = Number(row[twoQuartersCol.colIndex]) || 0;
      }
    }

    results.push({
      region,
      sqlType,
      year: quarterMatch.year,
      quarter: quarterMatch.quarter,
      sqls,
      conversionRate,
      oppCoverageRatio: Math.round(conversionRate * 10000), // Convert to basis points
      opportunities: {
        sameQuarter: oppSameQuarter,
        nextQuarter: oppNextQuarter,
        twoQuartersLater: oppTwoQuartersLater,
      },
    });
  }

  return results;
}

async function extractAllConversionRates() {
  console.log("=".repeat(80));
  console.log("Extracting Conversion Rates from Excel Cascade Sheets");
  console.log("=".repeat(80));
  console.log();

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ Excel file not found: ${EXCEL_FILE_PATH}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const cascadeSheets = workbook.SheetNames.filter(name => 
    name.includes("Cascade") && 
    (name.includes("NORAM") || name.includes("EMESA"))
  );

  console.log(`Found ${cascadeSheets.length} cascade sheets\n`);

  const allRates: ConversionRateData[] = [];

  for (const sheetName of cascadeSheets) {
    console.log(`Extracting from: ${sheetName}`);
    const rates = extractConversionRatesFromSheet(sheetName);
    if (rates.length > 0) {
      allRates.push(...rates);
      console.log(`  ✓ Found ${rates.length} conversion rate records`);
      
      // Show sample
      const sample = rates[0];
      console.log(`  Sample: Q${sample.quarter} ${sample.year}: ${sample.sqls} SQLs, ${(sample.conversionRate * 100).toFixed(1)}% conversion`);
      console.log(`    → ${sample.opportunities.sameQuarter.toFixed(2)} opps same quarter`);
      console.log(`    → ${sample.opportunities.nextQuarter.toFixed(2)} opps next quarter`);
      console.log(`    → ${sample.opportunities.twoQuartersLater.toFixed(2)} opps two quarters later`);
    } else {
      console.log(`  ⚠️  No data found`);
    }
    console.log();
  }

  // Group by region and SQL type to show averages
  console.log("=".repeat(80));
  console.log("Summary by Region and SQL Type:");
  console.log("=".repeat(80));
  
  const grouped: Record<string, ConversionRateData[]> = {};
  for (const rate of allRates) {
    const key = `${rate.region}_${rate.sqlType}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rate);
  }

  for (const [key, rates] of Object.entries(grouped)) {
    const avgConversion = rates.reduce((sum, r) => sum + r.conversionRate, 0) / rates.length;
    const avgOppCoverage = Math.round(avgConversion * 10000);
    console.log(`\n${key}:`);
    console.log(`  Records: ${rates.length}`);
    console.log(`  Avg Conversion Rate: ${(avgConversion * 100).toFixed(2)}% (${avgOppCoverage} bp)`);
    console.log(`  Range: ${(Math.min(...rates.map(r => r.conversionRate)) * 100).toFixed(1)}% - ${(Math.max(...rates.map(r => r.conversionRate)) * 100).toFixed(1)}%`);
  }

  // Save results
  const outputPath = path.resolve(process.cwd(), "server/scripts/excelConversionRates.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    allRates,
    summary: Object.fromEntries(
      Object.entries(grouped).map(([key, rates]) => {
        const avgConversion = rates.reduce((sum, r) => sum + r.conversionRate, 0) / rates.length;
        return [key, {
          count: rates.length,
          avgConversionRate: avgConversion,
          avgOppCoverageRatio: Math.round(avgConversion * 10000),
          minConversionRate: Math.min(...rates.map(r => r.conversionRate)),
          maxConversionRate: Math.max(...rates.map(r => r.conversionRate)),
        }];
      })
    ),
  }, null, 2));

  console.log(`\n✅ Results saved to: ${outputPath}`);
  console.log(`✅ Total conversion rate records: ${allRates.length}`);
}

extractAllConversionRates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Extraction failed:", error);
    process.exit(1);
  });

