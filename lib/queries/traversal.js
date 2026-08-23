// lib/queries/traversal.js — exact multi-hop traversal engine.
//
// Why not a single `*1..8` pattern here? openCypher variable-length hops
// cannot carry a per-step "lockfile-resolved version" condition, so exact
// answers loop ONE small parameterized expansion query per BFS level under
// hard depth/node caps. Package-granularity questions that don't care which
// version resolved DO use native variable-length MATCHes — see
// lib/queries/dependencies.js and cypher/examples.cypher.

import { runQuery } from "../db.js";

export const DEFAULT_MAX_DEPTH = 8;
export const DEFAULT_MAX_NODES = 400;

/** Canonical gate: match the version the project actually resolves. */
export const RESOLVED_GATE =
  "(d.resolvedVersion IS NULL AND v.isLatest) OR v.number = d.resolvedVersion";

/** lodash@4.17.21 → "4.17.21" · works for scoped ids (@scope/pkg@1.0.0). */
export function versionNumberFromId(versionId) {
  return versionId.slice(versionId.lastIndexOf("@") + 1);
}

/** Resolved root dependencies of a project (DIRECT_DEPENDS_ON, gated). */
export async function getProjectRoots(projectId) {
  return runQuery(
    `MATCH (p:Project {id: $projectId})-[d:DIRECT_DEPENDS_ON]->(k:Package)-[:HAS_VERSION]->(v:Version)
     WHERE ${RESOLVED_GATE}
     RETURN k.id AS packageId, k.name AS name,
            v.id AS versionId, v.vulnerable AS vulnerable,
            d.versionSpec AS versionSpec
     ORDER BY k.name`,
    { projectId },
  );
}

/**
 * One hop outward from a set of Version nodes.
 *
 * NOTE: the resolution gate is applied IN JAVASCRIPT, not in a Cypher WHERE.
 * Some openCypher engines mishandle property-existence predicates inside
 * UNWIND-driven patterns (observed live on CognoDB); filtering the raw fields
 * client-side is equally cheap and universally correct. Empty input → [].
 */
export async function expandVersions(versionIds) {
  if (versionIds.length === 0) return [];

  const rows = await runQuery(
    `UNWIND $versionIds AS vid
     MATCH (v:Version {id: vid})-[d:DEPENDS_ON]->(k:Package)-[:HAS_VERSION]->(next:Version)
     RETURN v.id AS fromVersionId,
            k.id AS packageId, k.name AS packageName,
            next.id AS toVersionId,
            next.isLatest AS nextIsLatest, next.vulnerable AS vulnerable,
            next.number AS nextNumber,
            d.range AS range, d.resolvedVersion AS pin
     ORDER BY packageName`,
    { versionIds },
  );

  return rows.filter(
    (row) => row.pin != null ? row.nextNumber === row.pin : row.nextIsLatest === true,
  );
}

/**
 * Breadth-first dependency closure of a project.
 * Returns { roots, levels, nodes }: nodes is Map<versionId, info>, levels
 * record per-depth discovery + traversed edges in stable order.
 */
export async function getDependencyClosure(
  projectId,
  { maxDepth = DEFAULT_MAX_DEPTH, maxNodes = DEFAULT_MAX_NODES } = {},
) {
  const roots = await getProjectRoots(projectId);
  const nodes = new Map();
  const levels = [];

  let frontier = [];
  for (const root of roots) {
    nodes.set(root.versionId, {
      versionId: root.versionId,
      packageId: root.packageId,
      name: root.name,
      vulnerable: root.vulnerable,
      depth: 0,
      direct: true,
    });
    frontier.push(root.versionId);
  }
  levels.push({ depth: 0, nodes: [...frontier], edges: [] });

  let discovered = nodes.size;
  for (
    let depth = 1;
    depth <= maxDepth && frontier.length > 0 && discovered < maxNodes;
    depth += 1
  ) {
    const expansions = await expandVersions(frontier);
    const levelNodes = [];
    const levelEdges = [];

    for (const row of expansions) {
      levelEdges.push(row);
      if (!nodes.has(row.toVersionId)) {
        nodes.set(row.toVersionId, {
          versionId: row.toVersionId,
          packageId: row.packageId,
          name: row.packageName,
          vulnerable: row.vulnerable,
          range: row.range,
          depth,
          direct: false,
        });
        levelNodes.push(row.toVersionId);
        discovered += 1;
        if (discovered >= maxNodes) break;
      }
    }

    levels.push({ depth, nodes: levelNodes, edges: levelEdges });
    frontier = levelNodes;
  }

  return { roots, levels, nodes };
}

/** Transitive dependency count = closure size minus the direct roots. */
export function countTransitiveDependencies(closure) {
  return Math.max(0, closure.nodes.size - closure.roots.length);
}

/** Adjacency map from the closure's recorded edges — no extra round-trips. */
function buildAdjacency(closure) {
  const adjacency = new Map();
  for (const level of closure.levels) {
    for (const edge of level.edges) {
      if (!adjacency.has(edge.fromVersionId)) adjacency.set(edge.fromVersionId, []);
      adjacency.get(edge.fromVersionId).push(edge);
    }
  }
  return adjacency;
}

/**
 * Enumerate up to `maxPaths` distinct chains from the project's roots down
 * to `targetVersionId`. Each path lists closure entries from the first
 * direct package through the target; shortest first.
 */
export function enumeratePathsToVersion(closure, targetVersionId, maxPaths = 20) {
  const adjacency = buildAdjacency(closure);
  const paths = [];

  const walk = (versionId, chain, onPath) => {
    if (paths.length >= maxPaths) return;
    chain.push(closure.nodes.get(versionId));
    onPath.add(versionId);

    if (versionId === targetVersionId) {
      paths.push(chain.map((entry) => ({ ...entry })));
    } else {
      for (const edge of adjacency.get(versionId) ?? []) {
        if (!onPath.has(edge.toVersionId)) walk(edge.toVersionId, chain, onPath);
        if (paths.length >= maxPaths) break;
      }
    }

    chain.pop();
    onPath.delete(versionId);
  };

  for (const root of closure.roots) {
    walk(root.versionId, [], new Set());
  }

  return paths.sort((a, b) => a.length - b.length);
}
