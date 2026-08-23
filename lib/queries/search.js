// lib/queries/search.js — categorized global search (projects/packages/CVEs).
//
// Uses CONTAINS scans; the optional fulltext index created by the seed is a
// future optimisation kept out of the hot path for portability.

import { runQuery } from "../db.js";

export async function searchEntities(rawQuery, { limitPerType = 5 } = {}) {
  const q = String(rawQuery ?? "").trim().toLowerCase();
  if (q.length < 2) {
    return { projects: [], packages: [], vulnerabilities: [] };
  }

  const rows = await runQuery(
    `MATCH (p:Project) WHERE toLower(p.name) CONTAINS $q OR toLower(p.id) CONTAINS $q
     RETURN 'project' AS type, p.id AS id, p.name AS title, p.language AS detail
     UNION ALL
     MATCH (k:Package) WHERE toLower(k.name) CONTAINS $q
     RETURN 'package' AS type, k.id AS id, k.name AS title, [(k)-[:HAS_VERSION]->(lv) WHERE lv.isLatest | lv.number][0] AS detail
     UNION ALL
     MATCH (k2:Package)-[:HAS_VERSION]->(:Version)-[:AFFECTED_BY]->(c:Vulnerability)
     WHERE toLower(k2.name) CONTAINS $q OR toLower(c.id) CONTAINS $q OR toLower(c.title) CONTAINS $q
     WITH DISTINCT c, head(collect(k2.name)) AS packageName
     RETURN 'vulnerability' AS type, c.id AS id, c.id + ' · ' + c.title AS title, c.severity + ' · ' + packageName AS detail`,
    { q },
  );

  const bucket = { project: [], package: [], vulnerability: [] };
  for (const row of rows) {
    if (bucket[row.type] && bucket[row.type].length < limitPerType) {
      bucket[row.type].push({ id: row.id, title: row.title, detail: row.detail ?? "" });
    }
  }
  return {
    projects: bucket.project,
    packages: bucket.package,
    vulnerabilities: bucket.vulnerability,
  };
}
