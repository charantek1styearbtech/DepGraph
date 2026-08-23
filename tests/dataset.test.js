// tests/dataset.test.js â€” offline guarantees for data/dataset.js.
import { describe, expect, it } from "vitest";

import { buildDataset, summarizeDataset } from "../data/dataset.js";

const dataset = buildDataset();
const summary = summarizeDataset(dataset);

describe("deterministic seed dataset", () => {
  it("produces byte-identical output on every run", () => {
    const second = JSON.stringify(buildDataset());
    expect(JSON.stringify(dataset)).toBe(second);
  });

  it("matches the assignment's target magnitudes", () => {
    expect(summary.nodes.projects).toBe(20);
    expect(summary.nodes.packages).toBeGreaterThanOrEqual(100).toBeLessThanOrEqual(151);
    expect(summary.nodes.versions).toBeGreaterThanOrEqual(150).toBeLessThanOrEqual(251);
    expect(summary.nodes.vulnerabilities).toBeGreaterThanOrEqual(30).toBeLessThanOrEqual(41);
    expect(summary.nodes.licenses).toBe(10);
    expect(summary.nodes.organizations).toBe(20);
    expect(summary.nodes.developers).toBe(30);
    expect(summary.nodes.technologies).toBe(20);

    const totalRelationships =
      Object.values(summary.relationships).reduce((a, b) => a + b, 0);
    expect(totalRelationships).toBeGreaterThanOrEqual(800).toBeLessThanOrEqual(1501);
  });

  it("flags exactly the versions referenced by advisories as vulnerable", () => {
    const flagged = dataset.nodes.versions.filter((v) => v.vulnerable).length;
    expect(flagged).toBe(summary.nodes.vulnerabilities);

    const lodash = dataset.nodes.versions.filter((v) => v.packageId === "lodash");
    const vulnerable = lodash.find((v) => v.number === "4.17.21");
    const patched = lodash.find((v) => v.number === "4.17.23");
    expect(vulnerable.vulnerable).toBe(true);
    expect(patched.vulnerable).toBe(false); // Version-as-node pays off here.
  });

  function projectReaches(projectId, targetVersionId, maxDepth = 10) {
    const latest = new Map(
      dataset.nodes.packages.map((p) => [p.id, p.latest]),
    );
    let frontier = dataset.rels.directDependsOn
      .filter((d) => d.projectId === projectId)
      .map((d) =>
        d.resolvedVersion
          ? `${d.packageId}@${d.resolvedVersion}`
          : `${d.packageId}@${latest.get(d.packageId)}`,
      );
    for (let depth = 0; depth <= maxDepth; depth += 1) {
      if (frontier.includes(targetVersionId)) return true;
      const next = [];
      for (const versionId of frontier) {
        for (const edge of dataset.rels.dependsOn.filter(
          (e) => e.fromVersionId === versionId,
        )) {
          const resolved = edge.resolvedVersion ?? latest.get(edge.toPackageId);
          next.push(`${edge.toPackageId}@${resolved}`);
        }
      }
      frontier = [...new Set(next)];
    }
    return false;
  }

  it("wires every required dependency scenario", () => {
    const vuln = "lodash@4.17.21";
    // S1 direct Â· InsightCRM pins the vulnerable release itself
    expect(projectReaches("insight-crm", vuln)).toBe(true);
    // S2 transitive Â· AdminPortal reaches it through webpack/package-x/recharts
    expect(projectReaches("admin-portal", vuln)).toBe(true);
    // S3 deep chain Â· ShopStack via next â†’ webpack â†’ package-x â†’ lodash
    expect(projectReaches("shopstack", vuln)).toBe(true);
    // S5 multi-path Â· DataForge has two independent routes to lodash
    expect(projectReaches("dataforge", vuln)).toBe(true);
    // CloudPilot resolves patched lodash but still touches vulnerable one via next
    expect(projectReaches("cloudpilot", vuln)).toBe(true);
  });

  it("gives at least 7 projects the shared vulnerable lodash release", () => {
    const affected = dataset.nodes.projects.filter((p) =>
      projectReaches(p.id, "lodash@4.17.21"),
    );
    expect(affected.length).toBeGreaterThanOrEqual(7);
  });
});

