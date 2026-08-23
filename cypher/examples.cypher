// ─────────────────────────────────────────────────────────────────────────────
// DepGraph · core Cypher queries (openCypher on CognoDB)
//
// Every application query lives in lib/queries/* and is executed through
// lib/db.js runQuery()/runWrite() — ALWAYS parameterized ($params), never
// string-interpolated. The queries below are the canonical reference set;
// comments explain why each is graph-native.
// ─────────────────────────────────────────────────────────────────────────────

// ── Query 1 · Project dependencies (direct) ──────────────────────────────────
// One hop: exactly what package.json declares (resolved release annotated on
// the relationship). Trivial in a graph; a recursive CTE in SQL.
MATCH (p:Project {id: $projectId})-[d:DIRECT_DEPENDS_ON]->(pkg:Package)
OPTIONAL MATCH (pkg)-[:HAS_VERSION]->(rv:Version)
  WHERE (d.resolvedVersion IS NULL AND rv.isLatest) OR rv.number = d.resolvedVersion
RETURN pkg.id AS id,
       pkg.name AS name,
       d.versionSpec AS specified,
       rv.number AS resolved
ORDER BY pkg.name;

// ── Query 2 · Multi-hop transitive dependencies ──────────────────────────────
// Native variable-length traversal at PACKAGE granularity (version resolution
// is irrelevant when asking "which packages are in the closure"). Depth is
// bounded to keep plans tight.
MATCH path =
  (p:Project {id: $projectId})
  -[:DIRECT_DEPENDS_ON]->(:Package)
  -[:HAS_VERSION]->(:Version)
  -[:DEPENDS_ON*0..8]->
  (transitive:Package)
WHERE NOT (p)-[:DIRECT_DEPENDS_ON]->(transitive)
RETURN DISTINCT transitive.id AS packageId, transitive.name AS name
ORDER BY name
LIMIT 500;

// ── Query 3 · Vulnerability impact (exact paths project ▸ … ▸ CVE) ───────────
// Version-aware reachability. lib/queries/traversal.js drives this hop-by-hop
// so each step respects lockfile resolution; the shape below is the single-hop
// expansion it executes per BFS level:
UNWIND $frontierVersionIds AS vid
MATCH (v:Version {id: vid})-[d:DEPENDS_ON]->(k:Package)-[:HAS_VERSION]->(next:Version)
WHERE (d.resolvedVersion IS NULL AND next.isLatest) OR next.number = d.resolvedVersion
RETURN v.id            AS fromVersionId,
       k.id            AS packageId,
       k.name          AS packageName,
       next.id         AS toVersionId,
       next.vulnerable AS vulnerable,
       d.range         AS range;

// Impact answer assembled by lib/queries/dependencies.js · impactOfVulnerability:
//   { severity, affectedPackage/Version, direct|transitive, minHops,
//     pathCount, paths:[Project ▸ pkg@ver ▸ … ▸ CVE] }

// ── Query 4 · Reverse dependents of a package ────────────────────────────────
// Variable-depth REVERSE traversal — the query relational schemas handle with
// recursive CTEs and self-joins. distance 2 ⇒ direct dependent, >2 ⇒ transitiv.
MATCH path =
  (p:Project)
  -[:DIRECT_DEPENDS_ON]->(:Package)
  -[:HAS_VERSION]->(:Version)
  -[:DEPENDS_ON*0..8]->
  (target:Package {id: $packageId})
WITH p, min(length(path)) AS distance
RETURN p.id AS id, p.name AS name, distance
ORDER BY distance, p.name
LIMIT 100;

// ── Query 5 · Shortest dependency path between project and package ───────────
// shortestPath() keeps this O(1 hop-expression); exact multi-path enumeration
// is layered on top by findDependencyPaths().
MATCH path = shortestPath(
  (p:Project {id: $projectId})
  -[:DIRECT_DEPENDS_ON|HAS_VERSION|DEPENDS_ON*1..20]->
  (target:Package {id: $packageId})
)
RETURN path, length(path) AS hops;

// ── Query 6 · Dashboard statistics ────────────────────────────────────────────
// Counts chain through WITH instead of CALL subqueries for portability.
MATCH (p:Project)
WITH count(p) AS projects
MATCH (k:Package)
WITH projects, count(k) AS packages
MATCH (v:Version)
WITH projects, packages, count(v) AS versions
MATCH (c:Vulnerability)
WITH projects, packages, versions, count(c) AS vulnerabilities
OPTIONAL MATCH (ap:Project)-[:DIRECT_DEPENDS_ON]->(:Package)-[:HAS_VERSION]->(:Version)-[:AFFECTED_BY]->(:Vulnerability)
RETURN projects, packages, versions, vulnerabilities, count(DISTINCT ap) AS affectedProjects;

// ── Bonus · Global search (categorized UNION) ────────────────────────────────
MATCH (p:Project) WHERE toLower(p.name) CONTAINS $q
RETURN 'project' AS type, p.id AS id, p.name AS title
UNION ALL
MATCH (k:Package) WHERE toLower(k.name) CONTAINS $q
RETURN 'package' AS type, k.id AS id, k.name AS title
UNION ALL
MATCH (c:Vulnerability) WHERE toLower(c.id) CONTAINS $q OR toLower(c.title) CONTAINS $q
RETURN 'vulnerability' AS type, c.id AS id, c.title AS title;
