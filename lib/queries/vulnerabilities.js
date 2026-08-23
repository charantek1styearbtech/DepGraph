// lib/queries/vulnerabilities.js — advisory listing & detail.

import { runQuery } from "../db.js";
import { NotFoundError } from "../errors.js";

/** Advisory list with optional severity filter + pagination. */
export async function listVulnerabilities({
  severity = null,
  limit = 40,
  offset = 0,
} = {}) {
  const totalRecords = await runQuery(
    `MATCH (c:Vulnerability)
     WHERE $severity IS NULL OR c.severity = $severity
     RETURN count(c) AS total`,
    { severity },
  );

  const rows = await runQuery(
    `MATCH (c:Vulnerability)
     WHERE $severity IS NULL OR c.severity = $severity
     WITH c ORDER BY c.cvss DESC SKIP $offset LIMIT $limit
     MATCH (c)-[:AFFECTED_BY]->(v:Version)<-[:HAS_VERSION]-(k:Package)
     RETURN c{
       .*,
       packageId: k.id,
       packageName: k.name,
       versionNumber: v.number
     } AS vulnerability`,
    { severity, limit, offset },
  );

  return {
    total: totalRecords[0]?.total ?? 0,
    vulnerabilities: rows.map((row) => row.vulnerability),
  };
}

/** Advisory detail incl. affected/patched version context. */
export async function getVulnerabilityDetail(vulnerabilityId) {
  const records = await runQuery(
    `MATCH (c:Vulnerability {id: $vulnerabilityId})
           -[:AFFECTED_BY]->(v:Version)
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
