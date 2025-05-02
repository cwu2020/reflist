import { exec } from "child_process";

/**
 * This script runs the commission partner backfill migration
 */
console.log("Starting commission partner backfill...");

exec("npx tsx scripts/migrations/backfill-commission-partners.ts", (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  
  console.log(stdout);
  console.log("Commission partner backfill complete!");
}); 