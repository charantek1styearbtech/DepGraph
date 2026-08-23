// scripts/diagnose.js — pinpoint openCypher engine differences on live CognoDB.
// Usage: node scripts/diagnose.js
import { closeDriver, runQuery } from "../lib/db.js";

const probes = [
  ["a · vulnerability ids sample",
   `MATCH (c:Vulnerability) RETURN c.id AS id LIMIT 3`],
  ["b · flagship CVE by exact id",
   `MATCH (c:Vulnerability {id: $vid}) RETURN count(c) AS hits`, { vid: "CVE-DEMO-2026-001" }],
  ["c · CVE → version edge count",
   `MATCH (c:Vulnerability {id: $vid})-[:AFFECTED_BY]->(v) RETURN count(v) AS hits`, { vid: "CVE-DEMO-2026-001" }],
  ["d · latest versions count",
   `MATCH (v:Version {isLatest: true}) RETURN count(v) AS n`],
  ["e · UNWIND expansion from next@14.2.5",
   `UNWIND $ids AS vid
    MATCH (v:Version {id: vid})-[d:DEPENDS_ON]->(k:Package)-[:HAS_VERSION]->(nxt:Version)
    RETURN v.id AS from, k.name AS pkg, nxt.id AS to,
           d.resolvedVersion AS pin, nxt.isLatest AS latest LIMIT 8`,
   { ids: ["next@14.2.5"] }],
  ["f · DEPENDS_ON totals + props",
   `MATCH ()-[d:DEPENDS_ON]->()
    RETURN count(d) AS total, count(d.range) AS withRange, count(d.resolvedVersion) AS pinned`],
  ["g · shopstack resolved roots",
   `MATCH (p:Project {id: 'shopstack'})-[d:DIRECT_DEPENDS_ON]->(k:Package)-[:HAS_VERSION]->(v)
    WHERE (d.resolvedVersion IS NULL AND v.isLatest) OR v.number = d.resolvedVersion
    RETURN k.name AS pkg, v.number AS ver ORDER BY pkg LIMIT 15`],
  ["h · map projection with override",
   `MATCH (k:Package {name: 'lodash'})
    RETURN k{.*, probe: 'override'} AS pkg`],
  ["i · native var-length into lodash",
   `MATCH path = (p:Project)-[:DIRECT_DEPENDS_ON]->(:Package)-[:HAS_VERSION]->(:Version)
                  -[:DEPENDS_ON*0..8]->(t:Package {name: 'lodash'})
    WITH p, min(length(path)) AS dist RETURN p.id AS id, dist ORDER BY dist LIMIT 20`],
];

for (const [label, query, params] of probes) {
  try {
    const rows = await runQuery(query, params ?? {});
    console.log(`\n● ${label}`);
    console.log(JSON.stringify(rows, null, 1).slice(0, 900));
  } catch (err) {
    console.log(`\n● ${label}\n  ERROR ${err.code ?? ""} ${err.message}`);
  }
}

await closeDriver();
