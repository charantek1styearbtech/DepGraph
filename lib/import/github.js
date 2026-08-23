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

async function fetchJson(url, { optional = false, notFoundMessage = null } = {}) {
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
      notFoundMessage ??
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

/**
 * Repository metadata via the GitHub API. Lets us tell these apart:
 *   • repo missing / private            → 404 on the API itself
 *   • repo exists but isn't Node.js     → no root package.json (+ language hint)
 * and gives us the real default branch instead of guessing HEAD.
 */
async function fetchRepoMeta(owner, repo) {
  let response;
  try {
    response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        "User-Agent": "DepGraph-Demo",
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (cause) {
    throw new UpstreamError("Could not reach GitHub", { cause });
  }
  if (response.status === 404) {
    throw new UpstreamError(
      `Repository ${owner}/${repo} was not found or is private — public repositories are currently supported.`,
    );
  }
  if (response.status === 403) {
    throw new UpstreamError("GitHub rate limit reached — please retry shortly.");
  }
  if (!response.ok) throw new UpstreamError(`GitHub responded with ${response.status}`);

  const json = await response.json().catch(() => null);
  return {
    defaultBranch: json?.default_branch ?? "HEAD",
    language: json?.language ?? null,
    description: json?.description ?? null,
  };
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
/** All package.json locations in the repo (root + subdirs, node_modules skipped). */
async function fetchManifestPaths(owner, repo, defaultBranch) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: {
          "User-Agent": "DepGraph-Demo",
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) return ["package.json"];

    const json = await response.json().catch(() => null);
    const paths = (json?.tree ?? [])
      .filter(
        (entry) =>
          entry.type === "blob" &&
          !entry.path.includes("node_modules/") &&
          (entry.path === "package.json" || entry.path.endsWith("/package.json")),
      )
      .map((entry) => entry.path);

    // Root manifest first, then shallowest → deepest.
    return paths.sort((a, b) => {
      if (a === "package.json") return -1;
      if (b === "package.json") return 1;
      return a.length - b.length || a.localeCompare(b);
    });
  } catch {
    return ["package.json"]; // trees API unavailable → behave like before
  }
}

function directoryOf(manifestPath) {
  return manifestPath.includes("/")
    ? manifestPath.slice(0, manifestPath.lastIndexOf("/"))
    : "";
}

/**
 * Write one resolved package-graph into CognoDB (MERGE-based ⇒ idempotent).
 * Re-importing the same sub-project starts clean at its Project node while
 * shared packages/versions are merged into the ecosystem.
 */
async function importProjectGraph({
  projectId,
  owner,
  repo,
  dir,
  manifest,
  directRows,
  lockedByPackageId,
  versionRows,
  dependencyEdges,
}) {
  await runWrite(`MATCH (p:Project {id: $projectId}) DETACH DELETE p`, { projectId });

  const repoId = `repo:${projectId}`;
  const url = `https://github.com/${owner}/${repo}${dir ? "/" + dir : ""}`;
  const fullName = `${owner}/${repo}${dir ? "/" + dir : ""}`;

  await runWrite(
    `MERGE (o:Organization {id: $owner}) ON CREATE SET o.login = $owner
     MERGE (r:Repository {id: $repoId})
       ON CREATE SET r.fullName = $fullName, r.url = $url, r.defaultBranch = "main"
     MERGE (p:Project {id: $projectId})
       ON CREATE SET p.source = "github"
     SET p.name = $name,
         p.url = $url,
         p.description = coalesce($description, "Imported from GitHub"),
         p.language = coalesce($language, "JavaScript"),
         p.stars = 0
     MERGE (p)-[:HAS_REPOSITORY]->(r)
     MERGE (r)-[:MAINTAINED_BY]->(o)`,
    {
      owner,
      repoId,
      fullName,
      url,
      projectId,
      name: dir ? `${repo}/${dir}` : repo,
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
}

const MAX_MANIFESTS = 5;

function noManifestMessage(meta) {
  const label = meta?.language;
  return (
    "Repository exists, but contains no root package.json" +
    (label && label !== "JavaScript" && label !== "TypeScript"
      ? ` — detected primary language: ${label}. `
      : ". ") +
    "DepGraph currently imports public Node.js repositories."
  );
}

export async function analyzeGitHubRepository(rawUrl) {
  const { owner, repo } = parseGitHubUrl(rawUrl);

  const meta = await fetchRepoMeta(owner, repo);
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${meta.defaultBranch}`;

  // Monorepo support: every package.json in the tree becomes its own Project
  // (root first, then subdirectories like backend/, frontend/, …).
  const manifestPaths = (
    await fetchManifestPaths(owner, repo, meta.defaultBranch)
  ).slice(0, MAX_MANIFESTS);

  if (manifestPaths.length === 0 && !meta.language) {
    throw new UpstreamError(
      "No package.json found — DepGraph currently imports public Node.js repositories.",
    );
  }

  const imported = [];
  let hadLockfile = false;

  for (const manifestPath of manifestPaths) {
    const dir = directoryOf(manifestPath);
    const prefix = dir ? `${dir}/` : "";
    const slugSuffix = dir
      ? "--" +
        dir
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      : "";
    const projectId = `${owner}--${repo}${slugSuffix}`.toLowerCase();

    const manifest = await fetchJson(`${rawBase}/${manifestPath}`, {
      optional: true,
    });
    if (!manifest) continue;

    const lock = await fetchJson(
      `${rawBase}/${prefix}package-lock.json`,
      { optional: true },
    );
    hadLockfile = hadLockfile || Boolean(lock);

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

    await importProjectGraph({
      projectId,
      owner,
      repo,
      dir,
      manifest,
      directRows,
      lockedByPackageId,
      versionRows,
      dependencyEdges,
    });

    imported.push({
      projectId,
      path: dir || "(root)",
      name: dir ? `${repo}/${dir}` : repo,
      directDependencies: directRows.length,
      lockedPackages: versionRows.length,
      dependencyEdges: dependencyEdges.length,
      truncated:
        directRows.length >= MAX_PACKAGES || lockEntries.length >= MAX_PACKAGES,
    });
  }

  if (imported.length === 0) {
    throw new UpstreamError(noManifestMessage(meta));
  }

  return {
    repository: `${owner}/${repo}`,
    // Backward-compatible primary handle (root / shallowest manifest):
    projectId: imported[0].projectId,
    projects: imported,
    directDependencies: imported.reduce((sum, p) => sum + p.directDependencies, 0),
    lockedPackages: imported.reduce((sum, p) => sum + p.lockedPackages, 0),
    dependencyEdges: imported.reduce((sum, p) => sum + p.dependencyEdges, 0),
    truncated:
      imported.some((p) => p.truncated) || manifestPaths.length > MAX_MANIFESTS,
    hadLockfile,
  };
}


