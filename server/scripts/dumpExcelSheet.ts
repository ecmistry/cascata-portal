/**
 * Dump Excel sheet data for detailed analysis
 */

import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const EXCEL_FILE_PATH = path.resolve(process.cwd(), "Gravitee_C_SSP_BRAND_ADJ_2_ACO_AE_SPLIT.xlsx");
const SHEET_NAME = "Overall Performance";

const workbook = XLSX.readFile(EXCEL_FILE_PATH);
const worksheet = workbook.Sheets[SHEET_NAME];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

console.log(`Sheet: ${SHEET_NAME}`);
console.log(`Rows: ${jsonData.length}`);
console.log(`\nFirst 100 rows:\n`);

// Print first 100 rows with row numbers
for (let i = 0; i < Math.min(100, jsonData.length); i++) {
  const row = jsonData[i];
  if (!row || row.length === 0) continue;
  
  // Show first 15 columns
  const rowData = row.slice(0, 15).map((cell: any, idx: number) => {
    if (cell === null || cell === undefined) return "";
    const str = String(cell);
    // Truncate long strings
    return str.length > 20 ? str.substring(0, 20) + "..." : str;
  });
  
  console.log(`Row ${i + 1}:`, rowData.join(" | "));
}

// Save full data to JSON
const outputPath = path.resolve(process.cwd(), "server/scripts/overallPerformanceDump.json");
fs.writeFileSync(outputPath, JSON.stringify(jsonData.slice(0, 200), null, 2));
console.log(`\n✅ Full data (first 200 rows) saved to: ${outputPath}`);

