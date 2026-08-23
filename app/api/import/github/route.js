// app/api/import/github/route.js — repository import endpoint.

import { analyzeGitHubRepository } from "@/lib/import/github.js";
import { readJsonBody, requireString, route } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const body = await readJsonBody(request);
  const url = requireString(body.url, "url", { max: 300 });
  const summary = await analyzeGitHubRepository(url);
  return Response.json(summary);
});
