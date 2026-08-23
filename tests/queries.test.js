// tests/queries.test.js — live CognoDB query-layer tests.
//
// Skips automatically (with a notice) when COGNODB_* credentials are absent
// or the instance is unreachable, so `npm test` stays green offline.
// The connectivity probe runs at module top level because describe.skipIf()
// is evaluated during collection — before any beforeAll could run.

import { afterAll, describe, expect, it } from "vitest";

import { checkConnection, closeDriver } from "../lib/db.js";
import { getDashboardStats } from "../lib/queries/dashboard.js";
import { getProjectDetail } from "../lib/queries/projects.js";
import { getPackageDetail, listPackages } from "../lib/queries/packages.js";
import { listVulnerabilities } from "../lib/queries/vulnerabilities.js";
import {
  findDependents,
  findDependencyPaths,
  impactOfVulnerability,
} from "../lib/queries/dependencies.js";
import { searchEntities } from "../lib/queries/search.js";

const FLAGSHIP_CVE = "CVE-DEMO-2026-001"; // lodash 4.17.21 prototype pollution

const online = await checkConnection();

if (!online) {
  console.warn(
    "\n⚠ CognoDB unreachable — live query tests skipped. " +
      "Configure .env.local and run `npm run seed` to exercise them.\n",
  );
}

afterAll(async () => {
  if (online) await closeDriver();
});

describe.skipIf(!online)("query layer (live CognoDB)", () => {
  it("dashboard stats reflect the seeded graph", async () => {
    const stats = await getDashboardStats();
    // Imports grow the graph, so exact equality only holds on a fresh seed.
    expect(stats.projects).toBeGreaterThanOrEqual(20);
    expect(stats.packages).toBeGreaterThanOrEqual(100);
    expect(stats.vulnerabilities).toBe(36);
    expect(stats.relationships).toBeGreaterThan(800);
    expect(stats.affectedProjects).toBeGreaterThan(5);
  });

  it("project lookup returns ShopStack with counts", async () => {
    const detail = await getProjectDetail("shopstack");
    expect(detail.project.name).toBe("ShopStack");
    expect(detail.counts.directDependencies).toBe(12);
    expect(detail.counts.transitiveDependencies).toBeGreaterThan(10);
    expect(detail.vulnerabilities.length).toBeGreaterThan(0);
  });

  it("impact analyzer traces the flagship CVE into ShopStack", async () => {
    const impact = await impactOfVulnerability("shopstack", FLAGSHIP_CVE);
    expect(impact.affected).toBe(true);
    expect(impact.vulnerability.packageId).toBe("lodash");
    expect(impact.vulnerability.versionNumber).toBe("4.17.21");
    expect(impact.reach.direct).toBe(false);
    // Shortest route runs through ShopStack's DIRECT recharts@2.12.2 pin…
    expect(impact.reach.minHops).toBe(2);
    expect(impact.reach.pathCount).toBeGreaterThan(1);
    // …while the assignment's canonical deep chain also exists among paths:
    // next ▸ webpack ▸ package-x ▸ lodash.
    const hasDeepChain = impact.paths.some(
      (path) =>
        path.steps.some((step) => step.label === "webpack") &&
        path.steps.some((step) => step.label === "package-x"),
    );
    expect(hasDeepChain).toBe(true);
    expect(impact.paths[0].steps[0].type).toBe("project");
    const last = impact.paths[0].steps.at(-1);
    expect(last.id).toBe("lodash");
    expect(last.version).toBe("4.17.21");
  });

  it("impact analyzer reports patched pins as unaffected", async () => {
    // CloudPilot pins lodash ^4.17.23 — the vulnerable release is unreachable
    // through its own pin, but next still drags 4.17.21 in, so use GridStudio
    // whose recharts@2.12.7 dropped the vulnerable pin.
    const impact = await impactOfVulnerability("gridstudio", FLAGSHIP_CVE);
    expect(impact.affected).toBe(false);
  });

  it("path finder returns multiple distinct lodash routes for DataForge", async () => {
    const result = await findDependencyPaths("dataforge", "lodash");
    expect(result.paths.length).toBeGreaterThanOrEqual(2);
    const signatures = result.paths.map((p) =>
      p.steps.map((s) => s.id).join(">"),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("reverse dependents finds direct and transitive lodash consumers", async () => {
    const dependents = await findDependents("lodash");
    expect(dependents.total).toBeGreaterThanOrEqual(7);
    expect(dependents.directCount).toBeGreaterThan(0);
    expect(dependents.transitiveCount).toBeGreaterThan(0);
  });

  it("package detail exposes versions, deps and advisories", async () => {
    const pkg = await getPackageDetail("axios");
    expect(pkg.versions.length).toBe(3);
    expect(pkg.vulnerabilities.length).toBe(1); // only 0.21.1 carries the demo SSRF
    expect(pkg.dependencies.length).toBeGreaterThan(0);
  });

  it("listings paginate and filter", async () => {
    const critical = await listVulnerabilities({ severity: "CRITICAL" });
    expect(critical.total).toBe(6);

    const filtered = await listPackages({ q: "react" });
    expect(filtered.packages.length).toBeGreaterThan(0);
    expect(
      filtered.packages.every((p) => p.name.toLowerCase().includes("react")),
    ).toBe(true);
  });

  it("global search categorizes results", async () => {
    const results = await searchEntities("lodash");
    expect(results.packages.some((r) => r.id === "lodash")).toBe(true);
    expect(results.vulnerabilities.length).toBeGreaterThan(0);

    // No project is named after lodash, so project matches need their own probe.
    const shop = await searchEntities("shop");
    expect(shop.projects.length).toBeGreaterThan(0);
  });
});
