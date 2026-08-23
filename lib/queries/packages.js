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

  // Engine note: a single multi-WITH query returning k{.*, computed…} proved
  // unreliable on CognoDB (the projected map sometimes comes back empty), so
  // stats are assembled from small aggregate queries returning scalar columns.
  const [dependentVersionRows, directProjectRows, vulnStatRows, latestRows] = await Promise.all([
    runQuery(
      `MATCH (:Version)-[:DEPENDS_ON]->(k:Package {id: $packageId})
       RETURN count(*) AS dependentVersions`,
      { packageId },
    ),
    runQuery(
      `MATCH (:Project)-[:DIRECT_DEPENDS_ON]->(k:Package {id: $packageId})
       RETURN count(*) AS directProjects`,
      { packageId },
    ),
    runQuery(
      `MATCH (k:Package {id: $packageId})-[:HAS_VERSION]->(av:Version)-[:AFFECTED_BY]->(c:Vulnerability)
       RETURN count(DISTINCT c) AS vulnerabilityCount`,
      { packageId },
    ),
    runQuery(
      `MATCH (k:Package {id: $packageId})-[:HAS_VERSION]->(lv:Version {isLatest: true})
       RETURN lv.number AS latestVersion`,
      { packageId },
    ),
  ]);

  const stats = {
    dependentVersions: dependentVersionRows[0]?.dependentVersions ?? 0,
    directProjects: directProjectRows[0]?.directProjects ?? 0,
    vulnerabilityCount: vulnStatRows[0]?.vulnerabilityCount ?? 0,
    latestVersion: latestRows[0]?.latestVersion ?? null,
  };

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
  const dependencyRecordsRaw = await runQuery(
    `MATCH (k:Package {id: $packageId})-[:HAS_VERSION]->(lv:Version)
     WHERE ($version IS NULL AND lv.isLatest) OR lv.number = $version
     MATCH (lv)-[d:DEPENDS_ON]->(dep:Package)
     OPTIONAL MATCH (dep)-[:HAS_VERSION]->(dv:Version {isLatest: true})
     RETURN dep.id AS id, dep.name AS name,
            d.range AS range,
            coalesce(d.resolvedVersion, dv.number) AS resolvedVersion,
            dv.number AS latestNumber,
            dv.vulnerable AS vulnerable
     ORDER BY dep.name`,
    { packageId, version },
  );

  // Imported graphs can carry parallel DEPENDS_ON edges (e.g. a stale pin next
  // to the fresh resolution), which would surface as duplicate React keys.
  // Keep one row per package — prefer the edge that resolves to that
  // dependency's own latest release; between candidates, prefer the higher
  // resolved version (the dataset can flag two releases isLatest).
  const versionRank = (v) =>
    String(v ?? "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);

  const outRanksVersion = (a, b) => {
    const ra = versionRank(a);
    const rb = versionRank(b);
    for (let i = 0; i < Math.max(ra.length, rb.length); i += 1) {
      const diff = (ra[i] ?? 0) - (rb[i] ?? 0);
      if (diff !== 0) return diff > 0;
    }
    return false;
  };

  const depsById = new Map();
  for (const row of dependencyRecordsRaw) {
    const existing = depsById.get(row.id);
    if (!existing) {
      depsById.set(row.id, row);
      continue;
    }
    const rowExact =
      row.latestNumber != null && row.resolvedVersion === row.latestNumber;
    const existingExact =
      existing.latestNumber != null &&
      existing.resolvedVersion === existing.latestNumber;

    let preferRow;
    if (rowExact !== existingExact) {
      preferRow = rowExact; // an exact-to-latest edge always beats a stale pin
    } else {
      // Both exact or both inexact: keep the fresher resolution deterministically
      preferRow = outRanksVersion(row.resolvedVersion, existing.resolvedVersion);
    }
    if (preferRow) depsById.set(row.id, row);
  }
  const dependencyRecords = [...depsById.values()].map(
    // latestNumber is internal to dedupe — don't leak it into the payload.
    ({ latestNumber: _ignored, ...row }) => row,
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
    stats,
    versions: versionRecords,
    dependencies: dependencyRecords,
    vulnerabilities: vulnerabilityRecords.map((row) => row.vulnerability),
  };
}
