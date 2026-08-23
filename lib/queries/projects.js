// lib/queries/projects.js — project listing & detail views.

import { runQuery } from "../db.js";
import { NotFoundError } from "../errors.js";
import {
  countTransitiveDependencies,
  getDependencyClosure,
} from "./traversal.js";

/** Project cards for /projects — direct-dep + advisory counts per project. */
export async function listProjects({ limit = 50 } = {}) {
  const rows = await runQuery(
    `MATCH (p:Project)
     OPTIONAL MATCH (p)-[:DIRECT_DEPENDS_ON]->(k:Package)
     WITH p, count(k) AS directDependencies
     OPTIONAL MATCH (p)-[d:DIRECT_DEPENDS_ON]->(k2:Package)-[:HAS_VERSION]->(v:Version)-[:AFFECTED_BY]->(c:Vulnerability)
       WHERE (d.resolvedVersion IS NULL AND v.isLatest) OR v.number = d.resolvedVersion
     WITH p, directDependencies,
          count(DISTINCT c) AS vulnerabilities,
          collect(DISTINCT c.severity) AS severities
     RETURN p{
       .*,
       directDependencies,
       vulnerabilities,
       criticalCount: size([s IN severities WHERE s = "CRITICAL"]),
       highCount: size([s IN severities WHERE s = "HIGH"])
     } AS project
     ORDER BY p.name
     LIMIT $limit`,
    { limit },
  );

  // Flatten the `{project: {...}}` record wrapper → plain project objects.
  return rows.map((row) => row.project);
}

/**
 * Full project overview: identity + repo/org context, resolved direct
 * dependencies (with advisory flags), reachable advisories, and transitive
 * dependency count via bounded BFS.
 */
export async function getProjectDetail(projectId, { maxDepth = 8 } = {}) {
  const baseRecords = await runQuery(
    `MATCH (p:Project {id: $projectId})
     OPTIONAL MATCH (p)-[:HAS_REPOSITORY]->(r:Repository)
     OPTIONAL MATCH (r)-[:MAINTAINED_BY]->(o:Organization)
     RETURN p{.*} AS project,
            r{.*} AS repository,
            o{.*} AS organization`,
    { projectId },
  );
  if (!baseRecords[0]) throw new NotFoundError("Project not found");

  const directRecords = await runQuery(
    `MATCH (p:Project {id: $projectId})-[d:DIRECT_DEPENDS_ON]->(k:Package)
     OPTIONAL MATCH (k)-[:HAS_VERSION]->(rv:Version)
       WHERE (d.resolvedVersion IS NULL AND rv.isLatest) OR rv.number = d.resolvedVersion
     OPTIONAL MATCH (rv)-[:AFFECTED_BY]->(rc:Vulnerability)
     RETURN k.id AS id, k.name AS name,
            d.versionSpec AS versionSpec,
            rv.number AS resolvedVersion,
            rv.vulnerable AS vulnerable,
            [x IN collect(DISTINCT rc.id) WHERE x IS NOT NULL] AS vulnerabilityIds
     ORDER BY k.name`,
    { projectId },
  );

  // Advisories reachable through the FULL resolved dependency graph —
  // including transitive routes (e.g. ShopStack ▸ recharts ▸ lodash), not
  // just advisories sitting on direct dependencies.
  const closure = await getDependencyClosure(projectId, { maxDepth });

  const vulnerableVersionIds = [...closure.nodes.values()]
    .filter((node) => node.vulnerable)
    .map((node) => node.versionId);

  let vulnerabilities = [];
  if (vulnerableVersionIds.length > 0) {
    const links = await runQuery(
      `UNWIND $vids AS vid
       MATCH (v:Version {id: vid})-[:AFFECTED_BY]->(c:Vulnerability)
       RETURN v.id AS versionId, c.id AS cveId`,
      { vids: vulnerableVersionIds },
    );

    const cveIds = [...new Set(links.map((link) => link.cveId))];
    const cveRows = cveIds.length
      ? await runQuery(
          `UNWIND $ids AS cid
           MATCH (c:Vulnerability {id: cid})
           RETURN c{.*} AS cve`,
          { ids: cveIds },
        )
      : [];

    const cveById = new Map(cveRows.map((row) => [row.cve.id, row.cve]));
    const nodeById = new Map(
      [...closure.nodes.values()].map((node) => [node.versionId, node]),
    );

    vulnerabilities = links
      .map((link) => {
        const cve = cveById.get(link.cveId);
        const node = nodeById.get(link.versionId);
        if (!cve || !node) return null;
        return {
          ...cve,
          packageId: node.packageId,
          packageName: node.name,
          versionNumber: node.versionId.slice(node.versionId.lastIndexOf("@") + 1),
          viaDirect: Boolean(node.direct),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.cvss - a.cvss);
  }

  return {
    ...baseRecords[0],
    directDependencies: directRecords,
    vulnerabilities,
    counts: {
      directDependencies: directRecords.length,
      transitiveDependencies: countTransitiveDependencies(closure),
      vulnerabilities: vulnerabilities.length,
      critical: vulnerabilities.filter((c) => c.severity === "CRITICAL").length,
      high: vulnerabilities.filter((c) => c.severity === "HIGH").length,
    },
  };
}
