// lib/queries/dashboard.js — aggregate statistics for the dashboard.
//
// Every query here is parameterized (even where parameters are unused today)
// and relies only on plain openCypher — no APOC, no CALL subqueries.

import { runQuery } from "../db.js";

/** Headline counts: projects/packages/versions/vulns + affected projects. */
export async function getDashboardStats() {
  const records = await runQuery(
    `MATCH (p:Project)
     WITH count(p) AS projects
     MATCH (k:Package)
     WITH projects, count(k) AS packages
     MATCH (v:Version)
     WITH projects, packages, count(v) AS versions
     MATCH (c:Vulnerability)
     WITH projects, packages, versions, count(c) AS vulnerabilities
     OPTIONAL MATCH (ap:Project)-[:DIRECT_DEPENDS_ON]->(:Package)-[:HAS_VERSION]->(:Version)-[:AFFECTED_BY]->(:Vulnerability)
     RETURN projects, packages, versions, vulnerabilities,
            count(DISTINCT ap) AS affectedProjects`,
  );

  const relRecords = await runQuery(`MATCH ()-[r]->() RETURN count(r) AS total`);

  return {
    ...records[0],
    relationships: relRecords[0]?.total ?? 0,
  };
}

/** Vulnerability count grouped by severity. */
export async function getSeverityDistribution() {
  return runQuery(
    `MATCH (c:Vulnerability)
     RETURN c.severity AS severity, count(*) AS count
     ORDER BY count DESC`,
  );
}

/**
 * Most impactful vulnerable packages, ranked by how many advisories they
 * carry and how many projects depend on them directly.
 */
export async function getTopVulnerablePackages({ limit = 8 } = {}) {
  return runQuery(
    `MATCH (k:Package)-[:HAS_VERSION]->(v:Version)-[:AFFECTED_BY]->(c:Vulnerability)
     WITH k,
          count(DISTINCT c) AS vulnerabilityCount,
          collect(DISTINCT c.severity) AS severities
     OPTIONAL MATCH (:Project)-[:DIRECT_DEPENDS_ON]->(k)
     WITH k, vulnerabilityCount, severities, count(*) AS directProjects
     RETURN k.id AS id,
            k.name AS name,
            [(k)-[:HAS_VERSION]->(lv) WHERE lv.isLatest | lv.number][0] AS latestVersion,
            vulnerabilityCount,
            directProjects,
            severities
     ORDER BY vulnerabilityCount DESC, directProjects DESC
     LIMIT $limit`,
    { limit },
  );
}

/**
 * Projects with the highest dependency risk.
 * The WHERE clause is the canonical "resolved-version gate": a project is
 * only matched with the version its lockfile resolves (latest unless pinned).
 */
export async function getHighestRiskProjects({ limit = 8 } = {}) {
  return runQuery(
    `MATCH (p:Project)-[d:DIRECT_DEPENDS_ON]->(k:Package)-[:HAS_VERSION]->(v:Version)-[:AFFECTED_BY]->(c:Vulnerability)
     WHERE (d.resolvedVersion IS NULL AND v.isLatest) OR v.number = d.resolvedVersion
     WITH p,
          count(DISTINCT c) AS vulnerabilities,
          collect(DISTINCT c.severity) AS severities,
          collect(DISTINCT k.name)[..4] AS vulnerablePackages
     RETURN p.id AS id,
            p.name AS name,
            p.language AS language,
            p.stars AS stars,
            vulnerabilities,
            severities,
            vulnerablePackages
     ORDER BY vulnerabilities DESC, p.stars DESC
     LIMIT $limit`,
    { limit },
  );
}
