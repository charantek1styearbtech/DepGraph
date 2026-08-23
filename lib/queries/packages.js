// lib/queries/packages.js — package intelligence (overview/tabs data).

import { runQuery } from "../db.js";
import { NotFoundError } from "../errors.js";

/** Package grid/list with search + pagination.
 *
 * Engine note: CognoDB mis-evaluates `WHERE $p = '' OR <predicate>`-style
 * clauses, so the filtered/unfiltered variants are branched in JS instead.
 */
export async function listPackages({ q = "", limit = 24, offset = 0 } = {}) {
  const filter = String(q ?? "").trim();
  const predicate = filter
    ? "WHERE toLower(k.name) CONTAINS toLower($filter)"
    : "";

  const totalRecords = await runQuery(
    `MATCH (k:Package) ${predicate}
     RETURN count(k) AS total`,
    { filter },
  );

  const baseRecords = await runQuery(
    `MATCH (k:Package) ${predicate}
     WITH k ORDER BY k.name SKIP $offset LIMIT $limit
     RETURN k.id AS id, k.name AS name`,
    { filter, limit, offset },
  );

  const ids = baseRecords.map((row) => row.id);
  let aggregates = new Map();
  if (ids.length > 0) {
    const [versionRows, vulnRows, latestRows] = await Promise.all([
      runQuery(
        `UNWIND $ids AS pid
         OPTIONAL MATCH (k:Package {id: pid})-[:HAS_VERSION]->(v:Version)
         RETURN pid AS id, count(v) AS versionCount`,
        { ids },
      ),
      runQuery(
        `UNWIND $ids AS pid
         OPTIONAL MATCH (:Package {id: pid})-[:HAS_VERSION]->(:Version)-[:AFFECTED_BY]->(c:Vulnerability)
         RETURN pid AS id, count(DISTINCT c) AS vulnerabilityCount`,
        { ids },
      ),
      runQuery(
        `UNWIND $ids AS pid
         MATCH (k:Package {id: pid})-[:HAS_VERSION]->(lv:Version {isLatest: true})
         RETURN pid AS id, lv.number AS latestVersion`,
        { ids },
      ),
    ]);

    const latestById = new Map(latestRows.map((row) => [row.id, row.latestVersion]));
    aggregates = new Map(
      versionRows.map((row, index) => [
        row.id,
        {
          versionCount: row.versionCount,
          vulnerabilityCount: vulnRows[index]?.vulnerabilityCount ?? 0,
          latestVersion: latestById.get(row.id) ?? null,
        },
      ]),
    );
  }

  const packages = baseRecords.map((row) => {
    const agg = aggregates.get(row.id) ?? {};
    return {
      id: row.id,
      name: row.name,
      versionCount: agg.versionCount ?? 0,
      vulnerabilityCount: agg.vulnerabilityCount ?? 0,
    };
  });

  return { total: totalRecords[0]?.total ?? 0, packages };
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
