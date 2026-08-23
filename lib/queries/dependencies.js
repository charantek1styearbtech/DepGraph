// lib/queries/dependencies.js — dependency-path & impact services.
//
// Deliberately mixes two traversal styles:
//   • EXACT version-aware analysis (impact analyzer, path finder, explorer)
//     built on lib/queries/traversal.js level-by-level BFS.
//   • NATIVE openCypher variable-length MATCHes for package-granularity
//     questions (reverse dependents, candidate pre-filtering) where version
//     resolution is irrelevant. Both styles are documented in the README.

import { runQuery } from "../db.js";
import { NotFoundError } from "../errors.js";
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  enumeratePathsToVersion,
  getDependencyClosure,
  versionNumberFromId,
} from "./traversal.js";

/** Convert an enumerated closure path into UI stepper steps. */
export function pathToSteps(pathEntries, project) {
  return [
    { type: "project", id: project.id, label: project.name },
    ...pathEntries.map((node) => ({
      type: "package",
      id: node.packageId,
      label: node.name,
      version: versionNumberFromId(node.versionId),
      vulnerable: Boolean(node.vulnerable),
      direct: Boolean(node.direct),
    })),
  ];
}

/**
 * Dependency Path Finder — every chain Project ▸ … ▸ Package.
 * Returns { project, paths: [{ steps, hops }], totalPaths }.
 */
export async function findDependencyPaths(
  projectId,
  targetPackageId,
  { maxPaths = 12, maxDepth = DEFAULT_MAX_DEPTH } = {},
) {
  const [projectRecords, closure] = await Promise.all([
    runQuery(`MATCH (p:Project {id: $projectId}) RETURN p{.*} AS project`, { projectId }),
    getDependencyClosure(projectId, { maxDepth }),
  ]);
  if (!projectRecords[0]) throw new NotFoundError("Project not found");
  const project = projectRecords[0].project;

  const targetVersions = [...closure.nodes.values()].filter(
    (node) => node.packageId === targetPackageId,
  );
  if (targetVersions.length === 0) {
    return { project, targetPackageId, paths: [], totalPaths: 0 };
  }

  const enumerated = [];
  for (const target of targetVersions) {
    for (const entries of enumeratePathsToVersion(closure, target.versionId, maxPaths)) {
      enumerated.push(entries);
    }
  }
  enumerated.sort((a, b) => a.length - b.length);

  const paths = enumerated.slice(0, maxPaths).map((entries) => ({
    steps: pathToSteps(entries, project),
    // Hop semantics per assignment example: ShopStack▸next▸webpack▸pkg-x▸
    // lodash reads as "4 hops".
    hops: entries.length,
  }));

  return { project, targetPackageId, paths, totalPaths: paths.length };
}

/**
 * Dependency Graph Explorer payload — layered, ReactFlow-ready subgraph.
 * Depth defaults to 3 (assignment §30); expansion beyond that happens via
 * /api/graph/explore calls from the client.
 */
export async function getProjectGraph(
  projectId,
  { maxDepth = 3, maxNodes = DEFAULT_MAX_NODES } = {},
) {
  const [projectRecords, closure] = await Promise.all([
    runQuery(
      `MATCH (p:Project {id: $projectId})
       RETURN p.id AS id, p.name AS name, p.language AS language, p.stars AS stars`,
      { projectId },
    ),
    getDependencyClosure(projectId, { maxDepth, maxNodes }),
  ]);
  if (!projectRecords[0]) throw new NotFoundError("Project not found");

  const nodeMap = new Map();
  nodeMap.set(projectId, {
    id: projectId,
    kind: "project",
    label: projectRecords[0].name,
    vulnerable: false,
    depth: 0,
  });

  const edgeMap = new Map();
  for (const root of closure.roots) {
    nodeMap.set(root.packageId, {
      id: root.packageId,
      kind: "package",
      label: root.name,
      version: versionNumberFromId(root.versionId),
      vulnerable: Boolean(root.vulnerable),
      direct: true,
      depth: 1,
    });
    edgeMap.set(`${projectId}|${root.packageId}`, {
      source: projectId,
      target: root.packageId,
      label: root.versionSpec ?? "",
    });
  }

  for (const [, info] of closure.nodes) {
    if (info.direct) continue;
    nodeMap.set(info.packageId, {
      id: info.packageId,
      kind: "package",
      label: info.name,
      version: versionNumberFromId(info.versionId),
      vulnerable: Boolean(info.vulnerable),
      direct: false,
      depth: info.depth + 1,
    });
  }

  for (const level of closure.levels) {
    for (const edge of level.edges) {
      const source = edge.fromVersionId.slice(0, edge.fromVersionId.lastIndexOf("@"));
      const key = `${source}|${edge.packageId}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source, target: edge.packageId, label: edge.range ?? "" });
      }
    }
  }

  return {
    project: projectRecords[0],
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    depthReached: closure.levels.length - 1,
    truncated: closure.nodes.size >= maxNodes,
  };
}

/**
 * Vulnerability Impact Analyzer (the flagship feature).
 * Answers, for one project × one advisory:
 *   severity, affected package/version, direct-vs-transitive, depth,
 *   number of paths, and every concrete path Project ▸ … ▸ CVE.
 */
export async function impactOfVulnerability(
  projectId,
  vulnerabilityId,
  { maxPaths = 20, maxDepth = DEFAULT_MAX_DEPTH } = {},
) {
  const vulnRecords = await runQuery(
    `MATCH (c:Vulnerability {id: $vulnerabilityId})
            <-[:AFFECTED_BY]-(v:Version)
            <-[:HAS_VERSION]-(k:Package)
     RETURN c.id AS id, c.severity AS severity, c.cvss AS cvss,
            c.title AS title, c.description AS description,
            c.fixedIn AS fixedIn,
            v.id AS versionId, v.number AS versionNumber,
            k.id AS packageId, k.name AS packageName`,
    { vulnerabilityId },
  );
  if (!vulnRecords[0]) throw new NotFoundError("Vulnerability not found");
  const vulnerability = vulnRecords[0];

  const [projectRecords, closure] = await Promise.all([
    runQuery(`MATCH (p:Project {id: $projectId}) RETURN p{.*} AS project`, { projectId }),
    getDependencyClosure(projectId, { maxDepth, maxNodes: maxNodesFor(maxDepth) }),
  ]);
  if (!projectRecords[0]) throw new NotFoundError("Project not found");
  const project = projectRecords[0].project;

  const enumerated = enumeratePathsToVersion(closure, vulnerability.versionId, maxPaths);
  const paths = enumerated.map((entries) => ({
    steps: pathToSteps(entries, project),
    hops: entries.length,
  }));

  return {
    project,
    vulnerability,
    affected: paths.length > 0,
    reach: paths.length > 0
      ? {
          // A pinned root equal to the affected package is "direct".
          direct: closure.roots.some((r) => r.packageId === vulnerability.packageId),
          minHops: Math.min(...paths.map((p) => p.hops)),
          pathCount: paths.length,
        }
      : null,
    paths,
  };
}

function maxNodesFor(depth) {
  return Math.min(DEFAULT_MAX_NODES * 2, 400 * Math.max(1, Math.ceil(depth / 4)));
}

/**
 * Reverse dependency BFS at package granularity.
 *
 * Replaces the previous native `DEPENDS_ON*0..8` MATCH: CognoDB returned
 * impossible path lengths for variable-length patterns, while iterative
 * UNWIND expansion behaves correctly. Returns Map<packageId, hopsToTarget>.
 */
async function reverseDependencyDepths(packageId, { maxDepth = DEFAULT_MAX_DEPTH } = {}) {
  const depths = new Map([[packageId, 0]]);
  let frontier = [packageId];

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const rows = await runQuery(
      `UNWIND $frontier AS pkgId
       MATCH (parent:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON]->(:Package {id: pkgId})
       RETURN DISTINCT parent.id AS id`,
      { frontier },
    );

    frontier = [...new Set(rows.map((row) => row.id))].filter((id) => !depths.has(id));
    for (const id of frontier) depths.set(id, depth);
  }

  return depths;
}

/**
 * All projects genuinely affected by an advisory.
 *
 * Stage 1: reverse dependency BFS from the affected package → every package
 * that can reach it, with hop counts (portable, no var-length patterns).
 * Stage 2: exact closure check per candidate project — it must resolve a
 * dependency path to the SPECIFIC affected version under lockfile semantics.
 */
export async function getAffectedProjects(vulnerabilityId, { limit = 100 } = {}) {
  const vulnRecords = await runQuery(
    `MATCH (c:Vulnerability {id: $vulnerabilityId})
            <-[:AFFECTED_BY]-(v:Version)
            <-[:HAS_VERSION]-(k:Package)
     RETURN c.severity AS severity, v.id AS versionId, k.id AS packageId`,
    { vulnerabilityId },
  );
  if (!vulnRecords[0]) throw new NotFoundError("Vulnerability not found");
  const { versionId, packageId } = vulnRecords[0];

  const depths = await reverseDependencyDepths(packageId);

  const pairs = await runQuery(
    `MATCH (p:Project)-[:DIRECT_DEPENDS_ON]->(k:Package)
     RETURN p.id AS projectId, collect(k.id) AS directPackages`,
  );

  const candidates = pairs
    .filter((row) => row.directPackages.some((pkgId) => depths.has(pkgId)))
    .map((row) => row.projectId);

  const verified = [];
  for (const candidate of candidates) {
    const closure = await getDependencyClosure(candidate, {
      maxDepth: DEFAULT_MAX_DEPTH,
      maxNodes: 300,
    });
    if (closure.nodes.has(versionId)) {
      verified.push({ id: candidate });
    }
    if (verified.length >= limit) break;
  }

  return { versionId, packageId, projects: verified };
}

/**
 * Reverse dependents of a package.
 *
 * Implemented with the portable reverse BFS (see reverseDependencyDepths)
 * instead of a native variable-length MATCH, which proved unreliable on
 * CognoDB. Distance semantics preserved: 2 ⇒ direct dependent, >2 ⇒ transitive.
 */
export async function findDependents(packageId, { limit = 200 } = {}) {
  const depths = await reverseDependencyDepths(packageId);

  const pairs = await runQuery(
    `MATCH (p:Project)-[:DIRECT_DEPENDS_ON]->(k:Package)
     RETURN p.id AS projectId, p.name AS projectName, k.id AS packageId`,
  );

  const perProject = new Map();
  for (const row of pairs) {
    const entry = perProject.get(row.projectId) ?? {
      id: row.projectId,
      name: row.projectName,
      isDirect: false,
      bestHopsToTarget: Infinity,
    };
    if (row.packageId === packageId) entry.isDirect = true;
    if (depths.has(row.packageId)) {
      entry.bestHopsToTarget = Math.min(entry.bestHopsToTarget, depths.get(row.packageId));
    }
    perProject.set(row.projectId, entry);
  }

  const rows = [...perProject.values()]
    .filter((entry) => entry.isDirect || Number.isFinite(entry.bestHopsToTarget))
    .sort(
      (a, b) =>
        Number(b.isDirect) - Number(a.isDirect) ||
        a.bestHopsToTarget - b.bestHopsToTarget ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      language: undefined,
      distance: entry.isDirect ? 2 : entry.bestHopsToTarget + 2,
    }));

  const direct = rows.filter((row) => row.distance <= 2);
  const transitive = rows
    .filter((row) => row.distance > 2)
    .map((row) => ({ ...row, hops: row.distance - 2 }));

  return {
    total: rows.length,
    directCount: direct.length,
    transitiveCount: transitive.length,
    direct,
    transitive,
  };
}

/**
 * Layered reverse package graph for visualisation: which packages depend ON
 * this package (level 1), and their own parents (level 2).
 */
export async function getReverseNeighborhood(packageId, { levels = 2 } = {}) {
  const layers = [];
  let frontier = [packageId];
  const seen = new Set(frontier);

  for (let depth = 1; depth <= levels && frontier.length > 0; depth += 1) {
    const rows = await runQuery(
      `UNWIND $frontier AS pkgId
       MATCH (parentPkg:Package)-[:HAS_VERSION]->(pv:Version)-[:DEPENDS_ON]->(pkg:Package {id: pkgId})
       RETURN DISTINCT parentPkg.id AS id, parentPkg.name AS name`,
      { frontier },
    );

    frontier = rows
      .map((row) => row.id)
      .filter((id) => !seen.has(id));
    const layerPackages = rows.filter((row) => frontier.includes(row.id));
    layers.push({ depth, packages: layerPackages });
    for (const id of frontier) seen.add(id);
  }

  return { packageId, layers };
}

