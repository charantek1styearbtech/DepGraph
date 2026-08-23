// tests/e2e/demo-flow.spec.js — the assignment's final demo workflow.
//
//   Open app → Explore demo project → ShopStack → Dependency Explorer →
//   select vulnerable package → Analyze → dependency path → affected projects.
//
// The suite skips itself when no app server / database is reachable so CI
// without credentials stays green.

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const health = await request.get("/api/health");
  test.skip(health.status() !== 200, "CognoDB unavailable — skipping E2E demo flow");
});

test("demo walkthrough: project → explorer → analyzer → path", async ({ page }) => {
  // Step 1–3 · landing → ShopStack
  await page.goto("/");
  await page.getByRole("link", { name: /explore demo project/i }).click();
  await expect(page.getByRole("heading", { name: "ShopStack" })).toBeVisible();

  // Step 4 · counts band shows direct deps + vulnerabilities
  await expect(page.getByText(/direct deps/i).first()).toBeVisible();

  // Step 5–6 · open the dependency explorer for this project
  await page.getByRole("link", { name: /dependency explorer/i }).click();
  await expect(page.getByRole("heading", { name: "Dependency Explorer" })).toBeVisible();

  // React Flow canvas renders nodes (project + packages)
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 20_000 });

  // Step 7 · impact analyzer for the flagship advisory
  await page.goto("/analyzer?project=shopstack");
  await page.getByLabel("Vulnerability").selectOption("CVE-DEMO-2026-001");
  await page.getByRole("button", { name: /analyze impact/i }).click();

  // Step 8 · summary + path stepper appear with the vulnerable release
  await expect(page.getByText(/impact summary/i)).toBeVisible();
  await expect(page.getByText(/transitive/i).first()).toBeVisible();
  const steps = page.locator("ol li");
  await expect(steps.first()).toContainText("ShopStack");

  // Step 9–10 · path finder confirms multi-hop route + reverse analysis exists
  await page.goto("/path-finder?project=shopstack&target=lodash");
  await page.getByRole("button", { name: /find dependency path/i }).click();
  await expect(page.getByText(/hops/i).first()).toBeVisible();

  await page.goto("/packages/lodash");
  await page.getByRole("tab", { name: "Dependents" }).click();
  await expect(page.getByText(/dependent projects/i).first()).toBeVisible();
});
