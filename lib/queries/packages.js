// lib/queries/packages.js — package intelligence (overview/tabs data).

import { runQuery } from "../db.js";
import { NotFoundError } from "../errors.js";

/** Package grid/list with search + pagination. */
export async function listPackages({ q = "", limit = 24, offset = 0 } = {}) {
  const filter = String(q ?? "").trim();

  const totalRecords = await runQuery(
    `MATCH (k:Package)
     WHERE $filter = '' OR toLower(k.name) CONTAINS toLower($filter)
     RETURN count(k) AS total`,
    { filter },
  );

  const rows = await runQuery(
    `MATCH (k:Package)
     WHERE $filter = '' OR toLower(k.name) CONTAINS toLower($filter)
     WITH k ORDER BY k.name SKIP $offset LIMIT $limit
     OPTIONAL MATCH (k)-[:HAS_VERSION]->(v:Version)
     WITH k, count(v) AS versionCount
     OPTIONAL MATCH (k)-[:HAS_VERSION]->(:Version)-[:AFFECTED_BY]->(c:Vulnerability)
     RETURN k{
       .*,
       versionCount,
       vulnerabilityCount: count(DISTINCT c),
       latestVersion: [(k)-[:HAS_VERSION]->(lv) WHERE lv.isLatest | lv.number][0]
     } AS package`,
    { filter, limit, offset },
  );

  return { total: totalRecords[0]?.total ?? 0, packages: rows.map((row) => row.package) };
}

/**
 * Everything the package page tabs need except reverse dependents (those are
 * served by lib/queries/dependencies.js · findDependents).
 */
export async function getPackageDetail(packageId, { version = null } = {}) {
  const pkgRecords = await runQuery(
    `MATCH (k:Package {id: $packageId})
     OPTIONAL MATCH (k)-[:USES_LICENSE]->(l:License)
     OPTIONAL MATCH (k)-[:USES_TECHNOLOGY]->(t:Technology)
     RETURN k{.*} AS pkg,
            l{.*} AS license,
            [x IN collect(DISTINCT t.id) WHERE x IS NOT NULL] AS technologies`,
    { packageId },
  );
  if (!pkgRecords[0]) throw new NotFoundError("Package not found");

  const statRecords = await runQuery(
    `MATCH (k:Package {id: $packageId})
     OPTIONAL MATCH (:Version)-[:DEPENDS_ON]->(k)
     WITH k, count(*) AS dependentVersions
     OPTIONAL MATCH (:Project)-[:DIRECT_DEPENDS_ON]->(k)
     WITH k, dependentVersions, count(*) AS directProjects
     OPTIONAL MATCH (k)-[:HAS_VERSION]->(av:Version)-[:AFFECTED_BY]->(:Vulnerability)
     RETURN k{
       .*,
       dependentVersions,
       directProjects,
       vulnerabilityCount: count(DISTINCT av),
       latestVersion: [(k)-[:HAS_VERSION]->(lv) WHERE lv.isLatest | lv.number][0]
     } AS stats`,
    { packageId },
  );

  const versionRecords = await runQuery(
    `MATCH (k:Package {id: $packageId})-[:HAS_VERSION]->(v:Version)
     OPTIONAL MATCH (v)-[:AFFECTED_BY]->(c:Vulnerability)
     RETURN v.number AS number, v.publishedAt AS publishedAt,
            v.isLatest AS isLatest, v.vulnerable AS vulnerable,
            [x IN collect(DISTINCT c.id) WHERE x IS NOT NULL] AS vulnerabilityIds
     ORDER BY v.publishedAt DESC`,
    { packageId },
  );

  // Dependencies of the requested (default: latest) release.
  const dependencyRecords = await runQuery(
    `MATCH (k:Package {id: $packageId})-[:HAS_VERSION]->(lv:Version)
     WHERE ($version IS NULL AND lv.isLatest) OR lv.number = $version
     MATCH (lv)-[d:DEPENDS_ON]->(dep:Package)
     OPTIONAL MATCH (dep)-[:HAS_VERSION]->(dv:Version {isLatest: true})
     RETURN dep.id AS id, dep.name AS name,
            d.range AS range,
            coalesce(d.resolvedVersion, dv.number) AS resolvedVersion,
            dv.vulnerable AS vulnerable
     ORDER BY dep.name`,
    { packageId, version },
  );

  const vulnerabilityRecords = await runQuery(
    `MATCH (k:Package {id: $packageId})-[:HAS_VERSION]->(v:Version)-[:AFFECTED_BY]->(c:Vulnerability)
     RETURN c{
       .*,
       versionId: v.id,
       versionNumber: v.number,
       isResolvedDefault: v.isLatest
     } AS vulnerability
     ORDER BY c.cvss DESC`,
    { packageId },
  );

  return {
    ...pkgRecords[0],
    stats: statRecords[0]?.stats ?? {},
    versions: versionRecords,
    dependencies: dependencyRecords,
    vulnerabilities: vulnerabilityRecords.map((row) => row.vulnerability),
  };
}
