#!/usr/bin/env node
// scripts/reset.js — safely clear the DepGraph demo dataset.
//
//   npm run reset
//
// Only nodes carrying one of the nine managed labels are detached-deleted,
// so anything else living in the same CognoDB instance is untouched.

import { isDatabaseConfigured, closeDriver } from "../lib/db.js";
import { wipeManagedLabels, collectStats } from "../lib/admin.js";

async function main() {
  if (!isDatabaseConfigured()) {
    console.error(
      "\n✖ CognoDB is not configured.\n\n" +
        "  1. Copy .env.example → .env.local\n" +
        "  2. Fill in COGNODB_URI, COGNODB_USERNAME, COGNODB_PASSWORD\n" +
        "  3. Re-run: npm run reset\n",
    );
    process.exit(1);
  }

  console.log("→ Removing DepGraph demo data (managed labels only)…");
  await wipeManagedLabels();

  const stats = await collectStats();
  const nodeTotal = Object.values(stats.nodes).reduce((a, b) => a + b, 0);
  const relTotal = Object.values(stats.relationships).reduce((a, b) => a + b, 0);

  console.log(
    `✔ Reset complete. Managed graph now contains ${nodeTotal} nodes / ${relTotal} relationships.`,
  );
}

main()
  .catch((err) => {
    console.error("\n✖ Reset failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => closeDriver());
