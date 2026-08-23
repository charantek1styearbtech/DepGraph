// lib/queries/vulnerabilities.js — advisory listing & detail.

import { runQuery } from "../db.js";
import { NotFoundError } from "../errors.js";
import { DEFAULT_MAX_DEPTH, getDependencyClosure } from "./traversal.js";

const ACTIVE_CACHE_TTL_MS = 60_000;
let activeCountsCache = { computedAt: 0, counts: new Map() };

/**
 * Live "affected project" count per advisory, computed exactly over the
 * CURRENT project set (seed + imports) using the same resolved-version BFS
 * the impact analyzer uses. Cached for ACTIVE_CACHE_TTL_MS because it walks
 * every project's closure.
 */
async function getAdvisoryAffectedCounts() {
  if (Date.now() - activeCountsCache.computedAt < ACTIVE_CACHE_TTL_MS) {
    return activeCountsCache.counts;
  }

  const cveVersionRows = await runQuery(
    `MATCH (c:Vulnerability)<-[:AFFECTED_BY]-(v:Version)
     RETURN c.id AS cveId, v.id AS versionId`,
  );
  const versionOfCve = new Map(
    cveVersionRows.map((row) => [row.cveId, row.versionId]),
  );

  const projectRows = await runQuery("MATCH (p:Project) RETURN p.id AS id");
  const counts = new Map();
  for (const project of projectRows) {
    const closure = await getDependencyClosure(project.id, { maxDepth: DEFAULT_MAX_DEPTH });
    const reached = new Set(
      [...closure.nodes.values()].filter((n) => n.vulnerable).map((n) => n.versionId),
    );
    for (const [cveId, versionId] of versionOfCve) {
      if (reached.has(versionId)) {
        counts.set(cveId, (counts.get(cveId) ?? 0) + 1);
      }
    }
  }

  activeCountsCache = { computedAt: Date.now(), counts };
  return counts;
}

/**
 * Advisory list with optional severity filter + pagination.
 *
 * `activeOnly: true` returns only advisories that currently affect at least
 * one project in the graph (exact, version-resolved), annotated with the
 * live affected-project count.
 */
export async function listVulnerabilities({
  severity = null,
  limit = 40,
  offset = 0,
  activeOnly = false,
} = {}) {
  const severityFilter = severity === null ? "" : "WHERE c.severity = $severity";

  const totalRecords = await runQuery(
    `MATCH (c:Vulnerability) ${severityFilter}
     RETURN count(c) AS total`,
    { severity },
  );

  // Edge direction: (Version)-[:AFFECTED_BY]->(Vulnerability).
  const rows = await runQuery(
    `MATCH (c:Vulnerability)
     ${severityFilter}
     WITH c ORDER BY c.cvss DESC SKIP $offset LIMIT $limit
     MATCH (v:Version)-[:AFFECTED_BY]->(c)
     MATCH (k:Package)-[:HAS_VERSION]->(v)
     RETURN c{
       .*,
       packageId: k.id,
       packageName: k.name,
       versionNumber: v.number,
       versionId: v.id
     } AS vulnerability`,
    { severity, limit, offset },
  );

  const counts = await getAdvisoryAffectedCounts();

  let vulnerabilities = rows
    .map((row) => ({
      ...row.vulnerability,
      affectedProjectCount: counts.get(row.vulnerability.id) ?? 0,
    }))
    // Active-first, then by severity.
    .sort((a, b) => b.affectedProjectCount - a.affectedProjectCount || b.cvss - a.cvss);

  if (activeOnly) {
    vulnerabilities = vulnerabilities.filter((c) => c.affectedProjectCount > 0);
  }

  return {
    total:
      activeOnly
        ? vulnerabilities.length
        : (totalRecords[0]?.total ?? 0),
    vulnerabilities,
    activeOnly,
  };
}

/** Advisory detail incl. affected/patched version context. */
export async function getVulnerabilityDetail(vulnerabilityId) {
  const records = await runQuery(
    `MATCH (c:Vulnerability {id: $vulnerabilityId})
           <-[:AFFECTED_BY]-(v:Version)
           <-[:HAS_VERSION]-(k:Package)
     RETURN c{.*} AS vulnerability,
            v{.*} AS version,
            k{.*} AS package`,
    { vulnerabilityId },
  );
  if (!records[0]) throw new NotFoundError("Vulnerability not found");

  const { vulnerability, version, pkg } = records[0];

  // Patched-release context for the "fixed in" callout.
  const fixedRecords = await runQuery(
    `MATCH (k:Package {id: $packageId})-[:HAS_VERSION]->(fv:Version)
     WHERE fv.number = $fixedIn
     RETURN fv.number AS number, fv.publishedAt AS publishedAt`,
    { packageId: pkg.id, fixedIn: vulnerability.fixedIn },
  );

  return {
    vulnerability,
    version,
    package: pkg,
    fixedRelease: fixedRecords[0] ?? null,
  };
}
