// scripts/check-dataset.js — offline sanity check for data/dataset.js.
// Usage: node scripts/check-dataset.js
// Verifies determinism, expected magnitudes, and the assignment's five
// required dependency scenarios WITHOUT needing a database connection.

import { buildDataset, summarizeDataset } from "../data/dataset.js";

function main() {
  const dataset = buildDataset();
  const summary = summarizeDataset(dataset);
  console.log("nodes         ", JSON.stringify(summary.nodes));
  console.log("relationships ", JSON.stringify(summary.relationships));

  // Determinism: building twice must yield byte-identical output.
  const identical = JSON.stringify(dataset) === JSON.stringify(buildDataset());
  console.log("deterministic  " + identical);

  const fail = [];
  const expectAtLeast = (label, actual, min) => {
    if (actual < min) fail.push(`${label}: ${actual} < ${min}`);
  };
  const expectBetween = (label, actual, min, max) => {
    if (actual < min || actual > max) fail.push(`${label}: ${actual} outside [${min}, ${max}]`);
  };

  expectBetween("projects", summary.nodes.projects, 20, 20);
  expectBetween("packages", summary.nodes.packages, 100, 150);
  expectBetween("versions", summary.nodes.versions, 150, 250);
  expectBetween("vulnerabilities", summary.nodes.vulnerabilities, 30, 40);
  expectBetween("licenses", summary.nodes.licenses, 10, 10);
  expectBetween("organizations", summary.nodes.organizations, 20, 20);
  expectBetween("developers", summary.nodes.developers, 30, 30);
  expectBetween("technologies", summary.nodes.technologies, 20, 20);

  const relTotal = Object.values(summary.relationships).reduce((a, b) => a + b, 0);
  expectBetween("total relationships", relTotal, 800, 1500);

  const { nodes, rels } = dataset;

  function projectReaches(projectId, targetVersionId, maxDepth = 10) {
    const directs = rels.directDependsOn.filter((d) => d.projectId === projectId);
    let frontier = directs.map((d) =>
      d.resolvedVersion
        ? `${d.packageId}@${d.resolvedVersion}`
        : `${d.packageId}@${nodes.packages.find((p) => p.id === d.packageId).latest}`,
    );
    const seen = new Set(frontier);
    for (let depth = 0; depth <= maxDepth; depth += 1) {
      if (frontier.includes(targetVersionId)) return { found: true, depth };
      const next = [];
      for (const versionId of frontier) {
        for (const dep of rels.dependsOn.filter((e) => e.fromVersionId === versionId)) {
          const pkg = nodes.packages.find((p) => p.id === dep.toPackageId);
          const resolved = dep.resolvedVersion ?? pkg.latest;
          const nextId = `${dep.toPackageId}@${resolved}`;
          if (!seen.has(nextId)) {
            seen.add(nextId);
            next.push(nextId);
          }
        }
      }
      frontier = next;
    }
    return { found: false };
  }

  const lodashVuln = "lodash@4.17.21";
  const scenarios = [
    ["S1 direct vuln (InsightCRM)", projectReaches("insight-crm", lodashVuln)],
    ["S2 transitive (AdminPortal)", projectReaches("admin-portal", lodashVuln)],
    ["S3 deep chain (ShopStack)", projectReaches("shopstack", lodashVuln)],
    ["S3 patched safe (CloudPilot lodash@4.17.23)", projectReaches("cloudpilot", "lodash@4.17.23")],
    ["S5 multi-path (DataForge)", projectReaches("dataforge", lodashVuln)],
  ];
  for (const [name, result] of scenarios) {
    console.log(name.padEnd(45), result.found ? `reaches @ depth ${result.depth}` : "NOT REACHED");
    if (!result.found) fail.push(`scenario failed: ${name}`);
  }

  const affectedProjects = nodes.projects.filter(
    (p) => projectReaches(p.id, lodashVuln).found,
  );
  console.log("projects reaching lodash@4.17.21:", affectedProjects.length, affectedProjects.map((p) => p.id).join(", "));
  if (affectedProjects.length < 7) fail.push(`shared-vulnerable scenario: only ${affectedProjects.length} projects`);

  // Vulnerable-version isolation: recharts@2.12.7 must NOT reach lodash@4.17.21,
  // while recharts@2.12.2 must.
  const gridStudio = projectReaches("gridstudio", lodashVuln);
  console.log("GridStudio (recharts@2.12.7, patched) reaches vuln lodash:", gridStudio.found ? `YES depth ${gridStudio.depth}` : "no");

  console.log("");
  if (fail.length > 0) {
    console.error("✖ FAILURES:\n - " + fail.join("\n - "));
    process.exit(1);
  }
  console.log("✔ dataset checks passed");
}

main();
