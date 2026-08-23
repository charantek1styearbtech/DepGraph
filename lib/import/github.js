// lib/import/github.js — public repository import (package.json + lockfile).
//
// Flow (assignment §17): fetch files → parse manifest → parse package-lock
// (v1/v2/v3) → resolve hoisted versions → MERGE Project/Package/Version nodes
// plus DIRECT_DEPENDS_ON/DEPENDS_ON edges → return a summary.
// No OAuth; private repos surface a friendly message via 404 mapping.

import { runWrite } from "../db.js";
import { UpstreamError, ValidationError } from "../errors.js";

const GITHUB_URL =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;
const MAX_PACKAGES = 300;
const MAX_EDGES = 600;

export function parseGitHubUrl(url) {
  if (typeof url !== "string") throw new ValidationError("Repository URL is required");
  const match = GITHUB_URL.exec(url.trim());
  if (!match) {
    throw new ValidationError(
      "Enter a valid public repository URL such as https://github.com/owner/repo",
    );
  }
  return { owner: match[1], repo: match[2] };
}

async function fetchJson(url, { optional = false } = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "DepGraph-Demo" },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (cause) {
    throw new UpstreamError("Could not reach GitHub", { cause });
  }
  if (response.status === 404) {
    if (optional) return null;
    throw new UpstreamError(
      "Repository or package.json not found — public repositories are currently supported.",
    );
  }
  if (response.status === 403) {
    throw new UpstreamError("GitHub rate limit reached — please retry shortly.");
  }
  if (!response.ok) throw new UpstreamError(`GitHub responded with ${response.status}`);
  try {
    return await response.json();
  } catch (cause) {
    throw new UpstreamError("GitHub returned an unreadable file", { cause });
  }
}

/** Normalize lockfiles (v1 nested tree, v2/v3 flat map) to flat entries. */
export function collectLockEntries(lock) {
  const entries = [];
  if (!lock) return entries;

  if (lock.packages && typeof lock.packages === "object") {
    // Shallowest path first so the hoisted root resolution wins per name.
    const keys = Object.keys(lock.packages).sort(
      (a, b) => a.split("node_modules/").length - b.split("node_modules/").length,
    );
    for (const key of keys) {
      const name = key.split("node_modules/").pop();
      const meta = lock.packages[key] ?? {};
      if (name) {
        entries.push({
          name,
          version: meta.version,
          requires: meta.dependencies ?? {},
        });
      }
    }
  } else if (lock.dependencies && typeof lock.dependencies === "object") {
    const walk = (deps) => {
      for (const [name, meta] of Object.entries(deps)) {
        entries.push({ name, version: meta.version, requires: meta.requires ?? {} });
        if (meta.dependencies) walk(meta.dependencies);
      }
    };
    walk(lock.dependencies);
  }

  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.name || !entry.version || seen.has(entry.name)) return false;
    seen.add(entry.name);
    return true;
  });
}

/**
 * Import a public Node.js repository into the graph.
 * Fully MERGE-based ⇒ re-importing the same repository is idempotent.
 */
export async function analyzeGitHubRepository(rawUrl) {
  const { owner, repo } = parseGitHubUrl(rawUrl);
  const projectId = `${owner}--${repo}`.toLowerCase();
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`;

  const manifest = await fetchJson(`${base}/package.json`);
  const lock = await fetchJson(`${base}/package-lock.json`, { optional: true });

  const directRows = Object.entries({
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  })
    .slice(0, MAX_PACKAGES)
    .map(([name, versionSpec]) => ({ name, versionSpec }));

  const lockEntries = collectLockEntries(lock).slice(0, MAX_PACKAGES);
  const lockedByPackageId = new Map(
    lockEntries.map((entry) => [entry.name, entry.version]),
  );

  const versionRows = lockEntries.map((entry) => ({
    packageId: entry.name,
    versionId: `${entry.name}@${entry.version}`,
    number: entry.version,
  }));

  const dependencyEdges = [];
  for (const entry of lockEntries) {
    for (const [toPackageId, range] of Object.entries(entry.requires)) {
      const resolvedVersion = lockedByPackageId.get(toPackageId);
      if (!resolvedVersion) continue;
      dependencyEdges.push({
        fromVersionId: `${entry.name}@${entry.version}`,
        toPackageId,
        range,
        resolvedVersion,
      });
      if (dependencyEdges.length >= MAX_EDGES) break;
    }
    if (dependencyEdges.length >= MAX_EDGES) break;
  }

  // Re-import starts clean at the project node; shared packages are MERGED.
  await runWrite(
    `MATCH (p:Project {id: $projectId}) DETACH DELETE p`,
    { projectId },
  );

  await runWrite(
    `MERGE (o:Organization {id: $owner}) ON CREATE SET o.login = $owner
     MERGE (r:Repository {id: $repoId})
       ON CREATE SET r.fullName = $fullName, r.url = $url, r.defaultBranch = "main"
     MERGE (p:Project {id: $projectId})
       ON CREATE SET p.source = "github"
     SET p.name = $repo, p.url = $url,
         p.description = coalesce($description, "Imported from GitHub"),
         p.language = coalesce($language, "JavaScript"), p.stars = 0
     MERGE (p)-[:HAS_REPOSITORY]->(r)
     MERGE (r)-[:MAINTAINED_BY]->(o)`,
    {
      owner,
      repoId: `repo:${projectId}`,
      fullName: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}`,
      projectId,
      repo,
      description: manifest.description ?? null,
      language: "JavaScript",
    },
  );

  if (versionRows.length > 0) {
    await runWrite(
      `UNWIND $rows AS row
       MERGE (k:Package {id: row.packageId})
         ON CREATE SET k.name = row.packageId, k.isImported = true
       MERGE (v:Version {id: row.versionId})
         ON CREATE SET v.number = row.number, v.packageId = row.packageId,
                       v.publishedAt = toString(date()), v.vulnerable = false
       MERGE (k)-[:HAS_VERSION]->(v)`,
      { rows: versionRows },
    );
  }

  await runWrite(
    `UNWIND $rows AS row
     MATCH (p:Project {id: $projectId})
     MERGE (k:Package {id: row.name})
       ON CREATE SET k.name = row.name, k.isImported = true
     MERGE (p)-[rel:DIRECT_DEPENDS_ON]->(k)
       ON CREATE SET rel.versionSpec = row.versionSpec,
                     rel.resolvedVersion = row.resolvedVersion`,
    {
      projectId,
      rows: directRows.map((row) => ({
        ...row,
        resolvedVersion: lockedByPackageId.get(row.name) ?? null,
      })),
    },
  );

  if (dependencyEdges.length > 0) {
    await runWrite(
      `UNWIND $rows AS row
       MATCH (v:Version {id: row.fromVersionId})
       MATCH (k:Package {id: row.toPackageId})
       MERGE (v)-[rel:DEPENDS_ON]->(k)
         ON CREATE SET rel.range = row.range, rel.resolvedVersion = row.resolvedVersion`,
      { rows: dependencyEdges },
    );
  }

  return {
    projectId,
    repository: `${owner}/${repo}`,
    directDependencies: directRows.length,
    lockedPackages: versionRows.length,
    dependencyEdges: dependencyEdges.length,
    truncated:
      directRows.length >= MAX_PACKAGES || lockEntries.length >= MAX_PACKAGES,
    hadLockfile: Boolean(lock),
  };
}

