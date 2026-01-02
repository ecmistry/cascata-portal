/**
 * Analyze a specific cascade sheet to understand the calculation flow
 */

import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const EXCEL_FILE_PATH = path.resolve(process.cwd(), "Gravitee_C_SSP_BRAND_ADJ_2_ACO_AE_SPLIT.xlsx");
const SHEET_NAME = "Inbound Cascade NORAM"; // Change this to analyze different sheets

const workbook = XLSX.readFile(EXCEL_FILE_PATH);
const worksheet = workbook.Sheets[SHEET_NAME];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

console.log(`Analyzing: ${SHEET_NAME}`);
console.log(`Rows: ${jsonData.length}\n`);

// Find key rows
let sqlRow = -1;
let oppRow = -1;
let revenueRow = -1;
let conversionRateRow = -1;

for (let i = 0; i < Math.min(200, jsonData.length); i++) {
  const row = jsonData[i];
  if (!row || row.length < 3) continue;

  const rowString = row.map((cell: any) => String(cell || "").toLowerCase()).join(" ");

  if (rowString.includes("sql") && sqlRow === -1) {
    sqlRow = i;
    console.log(`SQL row found at ${i + 1}:`, row.slice(0, 10).map((c: any) => String(c || "")).join(" | "));
  }
  if (rowString.includes("opp") && !rowString.includes("coverage") && oppRow === -1) {
    oppRow = i;
    console.log(`Opportunity row found at ${i + 1}:`, row.slice(0, 10).map((c: any) => String(c || "")).join(" | "));
  }
  if (rowString.includes("revenue") || rowString.includes("rev")) {
    revenueRow = i;
    console.log(`Revenue row found at ${i + 1}:`, row.slice(0, 10).map((c: any) => String(c || "")).join(" | "));
  }
  if (rowString.includes("coverage") || rowString.includes("ocr")) {
    conversionRateRow = i;
    console.log(`Conversion rate row found at ${i + 1}:`, row.slice(0, 10).map((c: any) => String(c || "")).join(" | "));
  }
}

// Extract quarter headers
const headerRow = jsonData[0];
const quarters: Array<{ year: number; quarter: number; colIndex: number }> = [];

for (let col = 0; col < headerRow.length; col++) {
  const cell = String(headerRow[col] || "");
  const match = cell.match(/Q([1-4])\s+(\d{2})/);
  if (match) {
    const q = parseInt(match[1]);
    let y = parseInt(match[2]);
    if (y < 50) y = 2000 + y;
    else y = 1900 + y;
    quarters.push({ year: y, quarter: q, colIndex: col });
  }
}

console.log(`\nFound ${quarters.length} quarters`);

// Extract SQLs, Opportunities, and calculate conversion
if (sqlRow >= 0 && oppRow >= 0) {
  const sqlRowData = jsonData[sqlRow];
  const oppRowData = jsonData[oppRow];

  console.log("\nSQL → Opportunity Conversion:");
  console.log("-".repeat(80));

  for (const q of quarters.slice(0, 10)) { // First 10 quarters
    const sqls = Number(sqlRowData[q.colIndex]);
    const opps = Number(oppRowData[q.colIndex]);

    if (!isNaN(sqls) && sqls > 0) {
      const conversionRate = !isNaN(opps) && opps > 0 ? (opps / sqls) * 100 : 0;
      console.log(`Q${q.quarter} ${q.year}: ${sqls} SQLs → ${opps.toFixed(2)} Opps (${conversionRate.toFixed(2)}%)`);
    }
  }
}

// Show more rows for context
console.log("\n\nFirst 50 rows of data:");
console.log("-".repeat(80));
for (let i = 0; i < Math.min(50, jsonData.length); i++) {
  const row = jsonData[i];
  if (!row || row.length === 0) continue;
  const preview = row.slice(0, 12).map((c: any) => {
    const str = String(c || "");
    return str.length > 12 ? str.substring(0, 12) : str.padEnd(12);
  }).join(" | ");
  console.log(`Row ${i + 1}: ${preview}`);
}

