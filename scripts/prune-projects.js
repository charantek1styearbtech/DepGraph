#!/usr/bin/env node
// scripts/prune-projects.js — delete every Project EXCEPT the ids passed in.
//
//   node scripts/prune-projects.js <keep-id-1> <keep-id-2> ...
//
// Project nodes are detach-deleted (their DIRECT_DEPENDS_ON and
// HAS_REPOSITORY edges go with them). Repositories — and organizations left
// without any repository — are cleaned up too, since they are 1:1 project
// metadata. Packages, versions and advisories are intentionally KEPT: they
// form the shared ecosystem graph that future imports merge into, and
// `npm run seed` restores the full 20-project demo at any time.

import { closeDriver, runQuery, runWrite } from "../lib/db.js";
import { collectStats } from "../lib/admin.js";

async function main() {
  const keep = process.argv.slice(2);
  if (keep.length === 0) {
    console.error(
      "\nUsage: node scripts/prune-projects.js <project-id-to-keep> [more...]\n" +
        'Example: node scripts/prune-projects.js shopstack charantek1styearbtech--terminal-mcp\n',
    );
    process.exit(1);
  }

  const all = await runQuery("MATCH (p:Project) RETURN p.id AS id ORDER BY id");
  const doomed = all.map((row) => row.id).filter((id) => !keep.includes(id));

  const unknown = keep.filter((id) => !all.some((row) => row.id === id));
  if (unknown.length > 0) {
    console.warn(`⚠ keep-list ids not present in graph: ${unknown.join(", ")}`);
  }

  if (doomed.length === 0) {
    console.log("Nothing to delete — every project is in the keep list.");
    return;
  }

  console.log(`→ Deleting ${doomed.length} project(s):`);
  for (const id of doomed) console.log("  · " + id);

  await runWrite(
    `UNWIND $ids AS id
     MATCH (p:Project {id: id})
     DETACH DELETE p`,
    { ids: doomed },
  );

  // Repositories that no longer belong to any project.
  const orphanRepos = await runQuery(
    `MATCH (r:Repository)
     OPTIONAL MATCH (:Project)-[:HAS_REPOSITORY]->(r)
     WITH r, count(*) AS inbound
     WHERE inbound = 0
     RETURN r.id AS id`,
  );
  if (orphanRepos.length > 0) {
    const ids = orphanRepos.map((row) => row.id);
    await runWrite(
      `UNWIND $ids AS id MATCH (r:Repository {id: id}) DETACH DELETE r`,
      { ids },
    );
    console.log(`→ Removed ${ids.length} orphaned repositories`);
  }

  // Organizations that no longer maintain anything.
  const orphanOrgs = await runQuery(
    `MATCH (o:Organization)
     OPTIONAL MATCH (:Repository)-[:MAINTAINED_BY]->(o)
     WITH o, count(*) AS inbound
     WHERE inbound = 0
     RETURN o.id AS id`,
  );
  if (orphanOrgs.length > 0) {
    const ids = orphanOrgs.map((row) => row.id);
    await runWrite(
      `UNWIND $ids AS id MATCH (o:Organization {id: id}) DETACH DELETE o`,
      { ids },
    );
    console.log(`→ Removed ${ids.length} orphaned organizations`);
  }

  const stats = await collectStats();
  const nodeTotal = Object.values(stats.nodes).reduce((a, b) => a + b, 0);
  const relTotal = Object.values(stats.relationships).reduce((a, b) => a + b, 0);

  console.log(
    `\n✔ Pruned. Graph now: ${stats.nodes.Project} projects · ` +
      `${stats.nodes.Package} packages · ${nodeTotal} nodes · ${relTotal} relationships.`,
  );
  console.log("  Packages/versions/advisories were kept (shared ecosystem).");
  console.log("  Run `npm run seed` anytime to restore the full 20-project demo.");
}

main()
  .catch((err) => {
    console.error("\n✖ Prune failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => closeDriver());
