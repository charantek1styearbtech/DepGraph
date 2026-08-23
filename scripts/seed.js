#!/usr/bin/env node
// scripts/seed.js — deterministic demo dataset loader for CognoDB.
//
//   npm run seed
//
// Steps: verify connection → apply schema (best effort) → wipe managed
// labels → insert nodes/relationships via UNWIND batches → print statistics.
// Running the seed twice yields an identical graph (fixed-seed generation +
// full wipe before insert ⇒ effectively idempotent).

import { isDatabaseConfigured, runWrite, closeDriver } from "../lib/db.js";
import { applySchema, wipeManagedLabels, collectStats } from "../lib/admin.js";
import { buildDataset } from "../data/dataset.js";

const NODE_INSERTS = [
  ["Organization", "organizations"],
  ["License", "licenses"],
  ["Technology", "technologies"],
  ["Developer", "developers"],
  ["Repository", "repositories"],
  ["Package", "packages"],
  ["Version", "versions"],
  ["Project", "projects"],
  ["Vulnerability", "vulnerabilities"],
];

const REL_INSERTS = [
  [
    "MAINTAINED_BY",
    "maintainedBy",
    `UNWIND $rows AS row
     MATCH (r:Repository {id: row.repositoryId})
     MATCH (o:Organization {id: row.organizationId})
     CREATE (r)-[:MAINTAINED_BY]->(o)`,
  ],
  [
    "HAS_REPOSITORY",
    "hasRepository",
    `UNWIND $rows AS row
     MATCH (p:Project {id: row.projectId})
     MATCH (r:Repository {id: row.repositoryId})
     CREATE (p)-[:HAS_REPOSITORY]->(r)`,
  ],
  [
    "HAS_VERSION",
    "hasVersion",
    `UNWIND $rows AS row
     MATCH (k:Package {id: row.packageId})
     MATCH (v:Version {id: row.versionId})
     CREATE (k)-[:HAS_VERSION]->(v)`,
  ],
  [
    "DEPENDS_ON",
    "dependsOn",
    `UNWIND $rows AS row
     MATCH (v:Version {id: row.fromVersionId})
     MATCH (k:Package {id: row.toPackageId})
     CREATE (v)-[:DEPENDS_ON {range: row.range, resolvedVersion: row.resolvedVersion}]->(k)`,
  ],
  [
    "AFFECTED_BY",
    "affectedBy",
    `UNWIND $rows AS row
     MATCH (v:Version {id: row.versionId})
     MATCH (c:Vulnerability {id: row.vulnerabilityId})
     CREATE (v)-[:AFFECTED_BY]->(c)`,
  ],
  [
    "DIRECT_DEPENDS_ON",
    "directDependsOn",
    `UNWIND $rows AS row
     MATCH (p:Project {id: row.projectId})
     MATCH (k:Package {id: row.packageId})
     CREATE (p)-[:DIRECT_DEPENDS_ON {versionSpec: row.versionSpec, resolvedVersion: row.resolvedVersion}]->(k)`,
  ],
  [
    "USES_LICENSE",
    "usesLicense",
    `UNWIND $rows AS row
     MATCH (k:Package {id: row.packageId})
     MATCH (l:License {id: row.licenseId})
     CREATE (k)-[:USES_LICENSE]->(l)`,
  ],
  [
    "USES_TECHNOLOGY",
    "usesTechnology",
    `UNWIND $rows AS row
     MATCH (k:Package {id: row.packageId})
     MATCH (t:Technology {id: row.technologyId})
     CREATE (k)-[:USES_TECHNOLOGY]->(t)`,
  ],
  [
    "CONTRIBUTES_TO",
    "contributesTo",
    `UNWIND $rows AS row
     MATCH (d:Developer {id: row.developerId})
     MATCH (r:Repository {id: row.repositoryId})
     CREATE (d)-[:CONTRIBUTES_TO {commits: row.commits}]->(r)`,
  ],
];

async function main() {
  if (!isDatabaseConfigured()) {
    console.error(
      "\n✖ CognoDB is not configured.\n\n" +
        "  1. Copy .env.example → .env.local\n" +
        "  2. Fill in COGNODB_URI, COGNODB_USERNAME, COGNODB_PASSWORD\n" +
        "  3. Re-run: npm run seed\n",
    );
    process.exit(1);
  }

  const startedAt = Date.now();
  console.log("→ Applying schema constraints/indexes…");
  const schema = await applySchema();
  console.log(`  ✔ ${schema.applied.length} applied, ${schema.skipped.length} skipped (unsupported features are tolerated)`);

  console.log("→ Clearing existing demo data…");
  await wipeManagedLabels();

  console.log("→ Building deterministic dataset…");
  const dataset = buildDataset();

  console.log("→ Inserting nodes:");
  for (const [label, key] of NODE_INSERTS) {
    const rows = dataset.nodes[key];
    await runWrite(`UNWIND $rows AS row CREATE (n:\`${label}\`) SET n = row`, { rows });
    console.log(`  · ${label.padEnd(14)} ${String(rows.length).padStart(5)}`);
  }

  console.log("→ Inserting relationships:");
  let totalRels = 0;
  for (const [type, key, query] of REL_INSERTS) {
    const rows = dataset.rels[key];
    await runWrite(query, { rows });
    totalRels += rows.length;
    console.log(`  · ${type.padEnd(18)} ${String(rows.length).padStart(5)}`);
  }

  const stats = await collectStats();
  const nodeTotal = Object.values(stats.nodes).reduce((a, b) => a + b, 0);
  const relTotal = Object.values(stats.relationships).reduce((a, b) => a + b, 0);

  console.log("\n──────────── Graph statistics ────────────");
  for (const [label, count] of Object.entries(stats.nodes)) {
    console.log(`  ${label.padEnd(14)} ${String(count).padStart(5)}`);
  }
  console.log(`  ${"-".repeat(24)}`);
  console.log(`  nodes total     ${nodeTotal}`);
  console.log(`  rels inserted   ${totalRels}`);
  console.log(`  rels in graph   ${relTotal}`);
  console.log(`  elapsed         ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log("");
  console.log("✔ Seed complete. Start the app with: npm run dev");
}

main()
  .catch((err) => {
    console.error("\n✖ Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => closeDriver());
