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
            -[:AFFECTED_BY]->(v:Version)
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
 * All projects genuinely affected by an advisory.
 *
 * Stage 1 (native variable-length MATCH): cheap package-level candidate
 * pre-filter — any project whose dependency subgraph touches the package.
 * Stage 2 (exact BFS per candidate, early-exit): confirm it reaches the
 * specific AFFECTED VERSION under lockfile-resolution semantics.
 */
export async function getAffectedProjects(vulnerabilityId, { limit = 100 } = {}) {
  const vulnRecords = await runQuery(
    `MATCH (c:Vulnerability {id: $vulnerabilityId})-[:AFFECTED_BY]->(v:Version)<-[:HAS_VERSION]-(k:Package)
     RETURN c.severity AS severity, v.id AS versionId, k.id AS packageId`,
    { vulnerabilityId },
  );
  if (!vulnRecords[0]) throw new NotFoundError("Vulnerability not found");
  const { versionId, packageId } = vulnRecords[0];

  const candidates = await runQuery(
    `MATCH (p:Project)-[:DIRECT_DEPENDS_ON]->(:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON*0..8]->(target:Package {id: $packageId})
     RETURN DISTINCT p.id AS id
     ORDER BY id`,
    { packageId },
  );

  const verified = [];
  for (const candidate of candidates) {
    const closure = await getDependencyClosure(candidate.id, {
      maxDepth: DEFAULT_MAX_DEPTH,
      maxNodes: 300,
    });
    if (closure.nodes.has(versionId)) {
      verified.push({ ...candidate });
    }
    if (verified.length >= limit) break;
  }

  return { versionId, packageId, projects: verified };
}

/**
 * Reverse dependents of a package (assignment Query 4, native var-length).
 * Distance semantics: path length 2 ⇒ direct dependent, longer ⇒ transitive.
 */
export async function findDependents(packageId, { limit = 100 } = {}) {
  const records = await runQuery(
    `MATCH path =
       (p:Project)-[:DIRECT_DEPENDS_ON]->(:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON*0..8]->(target:Package {id: $packageId})
     WITH p, min(length(path)) AS distance
     RETURN p.id AS id, p.name AS name, p.language AS language, distance
     ORDER BY distance, p.name
     LIMIT $limit`,
    { packageId, limit },
  );

  const direct = records.filter((row) => row.distance <= 2);
  const transitive = records.filter((row) => row.distance > 2);
  return {
    total: records.length,
    directCount: direct.length,
    transitiveCount: transitive.length,
    direct,
    transitive: transitive.map((row) => ({ ...row, hops: row.distance - 2 })),
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
       WHERE NOT parentPkg.id IN $seen
       RETURN DISTINCT parentPkg.id AS id, parentPkg.name AS name
       ORDER BY name`,
      { frontier, seen: [...seen] },
    );
    layers.push({ depth, packages: rows.map(({ id, name }) => ({ id, name })) });
    frontier = rows.map((row) => row.id);
    for (const id of frontier) seen.add(id);
  }

  return { packageId, layers };
}

