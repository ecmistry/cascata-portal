/**
 * Test script to establish BigQuery connection and validate query
 * Tests connection to reporting-299920.hubspot.company table
 * Does not fetch actual data - only validates connection and query syntax
 */

import { BigQuery } from "@google-cloud/bigquery";
import * as fs from "fs";
import * as path from "path";

// Configuration
const CREDENTIALS_PATH = path.resolve(process.cwd(), "credentials", "reporting-299920-803fa8e5405b.json");
const PROJECT_ID = "reporting-299920";
const DATASET_ID = "hubspot";
const TABLE_NAME = "company";
const TEST_QUERY = `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_NAME}\``;

/**
 * Test BigQuery connection and query
 */
async function testBigQueryConnection() {
  console.log("=".repeat(60));
  console.log("BigQuery Connection Test");
  console.log("=".repeat(60));
  console.log();

  // Step 1: Check credentials file exists
  console.log("Step 1: Checking credentials file...");
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`❌ Credentials file not found at: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }
  console.log(`✅ Credentials file found: ${CREDENTIALS_PATH}`);
  console.log();

  // Step 2: Load credentials
  console.log("Step 2: Loading credentials...");
  let credentials;
  try {
    const credsContent = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    credentials = JSON.parse(credsContent);
    console.log(`✅ Credentials loaded successfully`);
    console.log(`   Project ID: ${credentials.project_id || "N/A"}`);
    console.log(`   Client Email: ${credentials.client_email || "N/A"}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to load credentials: ${message}`);
    process.exit(1);
  }
  console.log();

  // Step 3: Create BigQuery client
  console.log("Step 3: Creating BigQuery client...");
  let client: BigQuery;
  try {
    client = new BigQuery({
      projectId: PROJECT_ID,
      credentials: credentials,
    });
    console.log(`✅ BigQuery client created successfully`);
    console.log(`   Project: ${PROJECT_ID}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to create BigQuery client: ${message}`);
    process.exit(1);
  }
  console.log();

  // Step 4: Test connection by listing datasets
  console.log("Step 4: Testing connection (listing datasets)...");
  try {
    const [datasets] = await client.getDatasets();
    console.log(`✅ Connection successful!`);
    console.log(`   Found ${datasets.length} dataset(s) in project`);
    
    // Check if hubspot dataset exists
    const hubspotDataset = datasets.find(ds => ds.id === DATASET_ID);
    if (hubspotDataset) {
      console.log(`   ✅ Dataset '${DATASET_ID}' found`);
    } else {
      console.log(`   ⚠️  Dataset '${DATASET_ID}' not found in project`);
      console.log(`   Available datasets: ${datasets.map(ds => ds.id).join(", ")}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Connection test failed: ${message}`);
    process.exit(1);
  }
  console.log();

  // Step 5: Check if table exists
  console.log("Step 5: Checking if table exists...");
  try {
    const dataset = client.dataset(DATASET_ID);
    const [tables] = await dataset.getTables();
    const companyTable = tables.find(t => t.id === TABLE_NAME);
    
    if (companyTable) {
      console.log(`✅ Table '${TABLE_NAME}' found in dataset '${DATASET_ID}'`);
      
      // Get table metadata
      const [metadata] = await companyTable.getMetadata();
      console.log(`   Table size: ${metadata.numRows || 0} rows`);
      console.log(`   Created: ${metadata.creationTime || "N/A"}`);
      console.log(`   Last modified: ${metadata.lastModifiedTime || "N/A"}`);
    } else {
      console.log(`⚠️  Table '${TABLE_NAME}' not found in dataset '${DATASET_ID}'`);
      console.log(`   Available tables: ${tables.map(t => t.id).join(", ")}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to check table: ${message}`);
    process.exit(1);
  }
  console.log();

  // Step 6: Validate query syntax (without fetching data)
  console.log("Step 6: Validating query syntax...");
  console.log(`   Query: ${TEST_QUERY}`);
  try {
    // Run query with LIMIT 0 to validate syntax without fetching data
    const [job] = await client.createQueryJob({
      query: `${TEST_QUERY} LIMIT 0`,
      useLegacySql: false,
    });
    
    // Wait for job to complete
    const [metadata] = await job.getMetadata();
    if (metadata.status?.state === "DONE") {
      if (metadata.status.errors && metadata.status.errors.length > 0) {
        console.error(`❌ Query validation failed:`);
        metadata.status.errors.forEach((err: any) => {
          console.error(`   ${err.message}`);
        });
        process.exit(1);
      } else {
        console.log(`✅ Query syntax is valid`);
        console.log(`   Job ID: ${job.id}`);
        console.log(`   Total bytes processed: ${metadata.statistics?.totalBytesProcessed || 0}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Query validation failed: ${message}`);
    process.exit(1);
  }
  console.log();

  // Step 7: Test query with a count (to verify table is accessible)
  console.log("Step 7: Testing table accessibility (counting rows)...");
  try {
    const countQuery = `SELECT COUNT(*) as row_count FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_NAME}\``;
    const [rows] = await client.query({ query: countQuery });
    
    if (rows && rows.length > 0) {
      const rowCount = (rows[0] as any).row_count;
      console.log(`✅ Table is accessible`);
      console.log(`   Total rows in table: ${rowCount?.toLocaleString() || 0}`);
    } else {
      console.log(`⚠️  Query returned no results`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to count rows: ${message}`);
    process.exit(1);
  }
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("✅ All tests passed!");
  console.log("=".repeat(60));
  console.log();
  console.log("Summary:");
  console.log(`  ✅ Credentials loaded successfully`);
  console.log(`  ✅ BigQuery client created`);
  console.log(`  ✅ Connection established`);
  console.log(`  ✅ Dataset '${DATASET_ID}' accessible`);
  console.log(`  ✅ Table '${TABLE_NAME}' exists and is accessible`);
  console.log(`  ✅ Query syntax validated`);
  console.log();
  console.log(`Ready to query: ${TEST_QUERY}`);
  console.log();
}

// Run the test
testBigQueryConnection()
  .then(() => {
    console.log("Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Test failed:", message);
    process.exit(1);
  });

