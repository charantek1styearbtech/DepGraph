// data/dataset.js — deterministic dataset assembler.
//
// Turns the raw pipe-delimited tables in data/*.data.js into fully-resolved
// node/relationship bundles ready for UNWIND-based insertion (see
// scripts/seed.js). Tables are validated loudly (DatasetError) so typos fail
// the seed immediately, and every random choice flows through fixed-seed
// PRNG streams so repeated runs produce an identical graph.

import { createRng } from "./prng.js";
import { LICENSE_ROWS, TECHNOLOGIES, ORGANIZATIONS, DEVELOPERS } from "./taxonomy.js";
import { VULNERABLE_CAPABLE_PACKAGE_ROWS } from "./packages-security.data.js";
import { CORE_PACKAGE_ROWS, DEMO_PACKAGE_ROWS } from "./packages.data.js";
import { VULNERABILITY_ROWS } from "./vulnerabilities.data.js";
import { EDGE_ROWS } from "./edges.data.js";
import { PROJECT_ROWS, DEMO_PROJECT_SLUG } from "./projects.data.js";

export { DEMO_PROJECT_SLUG };

class DatasetError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatasetError";
  }
}

const DAY_MS = 86_400_000;
const PUBLISHED_BASE = Date.UTC(2020, 0, 1);

/** First field of every taxonomy license row ("id|spdx|name"). */
const KNOWN_LICENSE_IDS = new Set(LICENSE_ROWS.map((row) => row.split("|")[0]));

/** Build Package nodes + their Version nodes (+ lookup maps). */
function buildPackages(rng) {
  const packages = [];
  const versions = [];
  const versionByKey = new Map();
  const latestByName = new Map();

  const rows = [
    ...VULNERABLE_CAPABLE_PACKAGE_ROWS,
    ...CORE_PACKAGE_ROWS,
    ...DEMO_PACKAGE_ROWS,
  ];

  for (const row of rows) {
    const [name, licenseId, techCsv, versionCsv] = row.split("|");
    const techs = techCsv ? techCsv.split(",") : [];
    for (const tech of techs) {
      if (!TECHNOLOGIES.includes(tech)) {
        throw new DatasetError(`Package ${name}: unknown technology "${tech}"`);
      }
    }
    if (!KNOWN_LICENSE_IDS.has(licenseId)) {
      throw new DatasetError(`Package ${name}: unknown license "${licenseId}"`);
    }
    const numbers = versionCsv.split(",");
    if (numbers.length < 2) {
      throw new DatasetError(`Package ${name}: needs at least two versions`);
    }

    const pkg = {
      id: name,
      name,
      licenseId,
      techs,
      latest: numbers[numbers.length - 1],
      isDemoChain: name.startsWith("package-"),
    };
    packages.push(pkg);

    numbers.forEach((number, index) => {
      const id = `${name}@${number}`;
      if (versionByKey.has(id)) throw new DatasetError(`Duplicate version ${id}`);
      const publishedAt = new Date(PUBLISHED_BASE + rng.int(0, 1600) * DAY_MS)
        .toISOString()
        .slice(0, 10);
      const version = {
        id,
        packageId: name,
        number,
        isLatest: index === numbers.length - 1,
        publishedAt,
        vulnerable: false,
      };
      versions.push(version);
      versionByKey.set(id, version);
    });
    latestByName.set(name, versionByKey.get(`${name}@${pkg.latest}`));
  }

  return {
    packages,
    versions,
    versionByKey,
    latestByName,
    packageByName: new Map(packages.map((p) => [p.name, p])),
  };
}

/** Build Vulnerability nodes + AFFECTED_BY links; flag vulnerable versions. */
function buildVulnerabilities(ctx) {
  const vulnerabilities = [];
  const affectedBy = [];

  VULNERABILITY_ROWS.forEach((row, index) => {
    const [packageId, number, severity, cvss, fixedIn, title, description] = row.split("|");
    const versionId = `${packageId}@${number}`;
    if (!ctx.versionByKey.has(versionId)) {
      throw new DatasetError(`Advisory #${index + 1}: unknown version ${versionId}`);
    }
    const id = `CVE-DEMO-2026-${String(index + 1).padStart(3, "0")}`;
    vulnerabilities.push({
      id,
      severity,
      cvss: Number(cvss),
      title,
      description,
      fixedIn: fixedIn && fixedIn !== "null" ? fixedIn : null,
      packageId,
      versionId,
      publishedAt: new Date(PUBLISHED_BASE + 700 * DAY_MS + index * 9 * DAY_MS)
        .toISOString()
        .slice(0, 10),
    });
    ctx.versionByKey.get(versionId).vulnerable = true;
    affectedBy.push({ vulnerabilityId: id, versionId });
  });

  return { vulnerabilities, affectedBy };
}

/** Resolve a "pkg@ver" | "pkg@*" target spec to its concrete Version. */
function resolveTarget(ctx, spec) {
  const at = spec.lastIndexOf("@");
  const name = spec.slice(0, at);
  const ref = spec.slice(at + 1);
  const pkg = ctx.packageByName.get(name);
  if (!pkg) throw new DatasetError(`Unknown target package "${name}" (${spec})`);
  const version =
    ref === "*"
      ? ctx.latestByName.get(name)
      : ctx.versionByKey.get(`${name}@${ref}`);
  if (!version) throw new DatasetError(`Unknown target version (${spec})`);
  return { pkg, version };
}

function requireVersion(ctx, versionId) {
  const version = ctx.versionByKey.get(versionId);
  if (!version) throw new DatasetError(`Unknown version "${versionId}"`);
  return version;
}

/** Curated table rows → DEPENDS_ON relationship records. */
function buildCuratedEdges(ctx) {
  const dependsOn = [];
  const seenPairs = new Set();

  for (const row of EDGE_ROWS) {
    const [sourceSpec, targetSpec] = row.split(">");
    const sourceAt = sourceSpec.lastIndexOf("@");
    const sourceName = sourceSpec.slice(0, sourceAt);
    const sourceRef = sourceSpec.slice(sourceAt + 1);

    if (!ctx.packageByName.has(sourceName)) {
      throw new DatasetError(`Edge "${row}": unknown source package "${sourceName}"`);
    }

    const sourceVersions =
      sourceRef === "*"
        ? ctx.versions.filter((v) => v.packageId === sourceName)
        : [requireVersion(ctx, `${sourceName}@${sourceRef}`)];

    const target = resolveTarget(ctx, targetSpec);

    for (const from of sourceVersions) {
      const pairKey = `${from.id}|${target.pkg.id}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      dependsOn.push({
        fromVersionId: from.id,
        toPackageId: target.pkg.id,
        range: target.version.isLatest
          ? `^${target.version.number}`
          : target.version.number,
        resolvedVersion: target.version.isLatest ? null : target.version.number,
      });
    }
  }
  return { dependsOn, seenPairs };
}

/**
 * Deterministically enrich the graph with extra dependency edges so it
 * reaches realistic density (~1000+ relationships overall). Uses its own
 * PRNG stream so editing curated tables never shifts the outcome.
 */
function generateExtraEdges(ctx, seenPairs) {
  const rng = createRng(4242);
  const extras = [];
  const names = [...ctx.packageByName.keys()].sort();
  const sources = names.filter((n) => !ctx.packageByName.get(n).isDemoChain);
  let attempts = 0;

  while (extras.length < 140 && attempts < 800) {
    attempts += 1;
    const sourceName = rng.pick(sources);
    const from = rng.pick(ctx.versions.filter((v) => v.packageId === sourceName));
    const targetName = rng.pick(names);
    if (targetName === sourceName) continue;

    const pairKey = `${from.id}|${targetName}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const latest = ctx.latestByName.get(targetName);
    extras.push({
      fromVersionId: from.id,
      toPackageId: targetName,
      range: `^${latest.number}`,
      resolvedVersion: null,
    });
  }
  return extras;
}

/** Projects + DIRECT_DEPENDS_ON / HAS_REPOSITORY / MAINTAINED_BY edges. */
function buildProjects(ctx) {
  const projects = [];
  const repositories = [];
  const directDependsOn = [];
  const hasRepository = [];
  const maintainedBy = [];

  PROJECT_ROWS.forEach((row, index) => {
    const [name, slug, org, language, stars, description, directsCsv] = row.split("|");
    if (!ORGANIZATIONS.includes(org)) {
      throw new DatasetError(`Project ${slug}: unknown organization "${org}"`);
    }
    projects.push({
      id: slug,
      name,
      slug,
      language,
      stars: Number(stars),
      description,
      organizationId: org,
      url: `https://github.com/${org}/${slug}`,
    });

    const repoId = `repo:${slug}`;
    repositories.push({
      id: repoId,
      fullName: `${org}/${slug}`,
      url: `https://github.com/${org}/${slug}`,
      defaultBranch: "main",
      stars: Number(stars),
    });
    hasRepository.push({ projectId: slug, repositoryId: repoId });
    maintainedBy.push({ repositoryId: repoId, organizationId: org });

    for (const item of directsCsv.split(",")) {
      let segments = item.split("@");
      let packageName;
      if (segments[0] === "") {
        // scoped package: "@scope/name@spec[@resolved]"
        packageName = "@" + segments[1];
        segments = segments.slice(2);
      } else {
        packageName = segments[0];
        segments = segments.slice(1);
      }
      const versionSpec = segments[0];
      const resolvedVersion = segments[1] ?? null;

      if (!ctx.packageByName.has(packageName)) {
        throw new DatasetError(
          `Project #${index + 1} (${slug}): unknown dependency "${packageName}"`,
        );
      }
      if (resolvedVersion && !ctx.versionByKey.has(`${packageName}@${resolvedVersion}`)) {
        throw new DatasetError(
          `Project ${slug}: ${packageName} missing resolved version ${resolvedVersion}`,
        );
      }
      directDependsOn.push({
        projectId: slug,
        packageId: packageName,
        versionSpec,
        resolvedVersion,
      });
    }
  });

  // Developer contributions — deterministic per-repo sample.
  const rng = createRng(9001);
  const contributesTo = [];
  for (const project of projects) {
    for (const login of rng.sample(DEVELOPERS, rng.int(2, 4))) {
      contributesTo.push({
        developerId: login,
        repositoryId: `repo:${project.slug}`,
        commits: rng.int(15, 480),
      });
    }
  }

  return {
    projects,
    repositories,
    directDependsOn,
    hasRepository,
    maintainedBy,
    contributesTo,
  };
}

function buildUsageLinks(ctx) {
  const usesLicense = ctx.packages.map((pkg) => ({
    packageId: pkg.id,
    licenseId: pkg.licenseId,
  }));
  const usesTechnology = [];
  for (const pkg of ctx.packages) {
    for (const technologyId of pkg.techs) {
      usesTechnology.push({ packageId: pkg.id, technologyId });
    }
  }
  return { usesLicense, usesTechnology };
}

function buildTaxonomy() {
  return {
    licenses: LICENSE_ROWS.map((row) => {
      const [id, spdx, name] = row.split("|");
      return { id, spdx, name };
    }),
    technologies: TECHNOLOGIES.map((id) => ({ id, label: id })),
    organizations: ORGANIZATIONS.map((id) => ({ id, login: id })),
    developers: DEVELOPERS.map((login) => ({ id: login, login })),
  };
}

/** Assemble every node/relationship bundle for the seeder. */
export function buildDataset() {
  const ctx = buildPackages(createRng(11));
  const vulns = buildVulnerabilities(ctx);
  const curated = buildCuratedEdges(ctx);
  const extras = generateExtraEdges(ctx, curated.seenPairs);
  const proj = buildProjects(ctx);
  const usage = buildUsageLinks(ctx);
  const taxonomy = buildTaxonomy();

  return {
    nodes: {
      projects: proj.projects,
      packages: ctx.packages,
      versions: ctx.versions,
      vulnerabilities: vulns.vulnerabilities,
      repositories: proj.repositories,
      organizations: taxonomy.organizations,
      licenses: taxonomy.licenses,
      developers: taxonomy.developers,
      technologies: taxonomy.technologies,
    },
    rels: {
      directDependsOn: proj.directDependsOn,
      hasVersion: ctx.versions.map((v) => ({
        packageId: v.packageId,
        versionId: v.id,
      })),
      dependsOn: [...curated.dependsOn, ...extras],
      affectedBy: vulns.affectedBy,
      usesLicense: usage.usesLicense,
      usesTechnology: usage.usesTechnology,
      hasRepository: proj.hasRepository,
      maintainedBy: proj.maintainedBy,
      contributesTo: proj.contributesTo,
    },
  };
}

/** In-memory summary counts (mirrors collectStats() without a database). */
export function summarizeDataset(dataset) {
  const tally = (group) =>
    Object.fromEntries(
      Object.entries(dataset[group]).map(([key, list]) => [key, list.length]),
    );
  return { nodes: tally("nodes"), relationships: tally("rels") };
}

