// lib/admin.js — schema + maintenance operations shared by seed/reset/tests.
//
// NOTE on Cypher parameters: labels and relationship types cannot be
// parameterized in openCypher. Every label/type used here comes from the
// static allow-lists below — never from user input.

import fs from "node:fs";
import path from "node:path";
import { runQuery, runWrite } from "./db.js";

export const MANAGED_LABELS = [
  "Project",
  "Package",
  "Version",
  "Vulnerability",
  "Repository",
  "Organization",
  "License",
  "Developer",
  "Technology",
];

export const MANAGED_REL_TYPES = [
  "DIRECT_DEPENDS_ON",
  "HAS_VERSION",
  "DEPENDS_ON",
  "AFFECTED_BY",
  "USES_LICENSE",
  "USES_TECHNOLOGY",
  "HAS_REPOSITORY",
  "MAINTAINED_BY",
  "CONTRIBUTES_TO",
];

/**
 * Apply cypher/schema.cypher statement-by-statement. Constraints/indexes are
 * best-effort: a CognoDB tier without fulltext support simply skips that
 * statement while core uniqueness constraints still land.
 */
export async function applySchema() {
  const file = path.join(process.cwd(), "cypher", "schema.cypher");
  const raw = fs.readFileSync(file, "utf8");

  const statements = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .split(";")
    .map((stmt) => stmt.trim())
    .filter(Boolean);

  const applied = [];
  const skipped = [];

  for (const statement of statements) {
    try {
      await runWrite(statement);
      applied.push(statement.split("\n")[0].replace(/^CREATE\s+/i, "").slice(0, 60));
    } catch (err) {
      skipped.push(err.code ?? err.message);
    }
  }
  return { applied, skipped };
}

/** Detach-delete every node carrying a managed label. Destructive! */
export async function wipeManagedLabels() {
  const where = MANAGED_LABELS.map((label) => `n:${label}`).join(" OR ");
  await runWrite(`MATCH (n) WHERE ${where} DETACH DELETE n`);
}

/** Live counts per managed label / relationship type (for seed output + tests). */
export async function collectStats() {
  const nodes = {};
  for (const label of MANAGED_LABELS) {
    const records = await runQuery(`MATCH (n:${label}) RETURN count(n) AS count`);
    nodes[label] = records[0]?.count ?? 0;
  }

  const relationships = {};
  for (const type of MANAGED_REL_TYPES) {
    const records = await runQuery(`MATCH ()-[r:${type}]->() RETURN count(r) AS count`);
    relationships[type] = records[0]?.count ?? 0;
  }

  return { nodes, relationships };
}

