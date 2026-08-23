// app/api/impact/route.js — Vulnerability Impact Analyzer (flagship feature).

import { impactOfVulnerability } from "@/lib/queries/dependencies.js";
import { readJsonBody, requireString, route } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const body = await readJsonBody(request);
  const projectId = requireString(body.projectId, "projectId", { max: 120 });
  const vulnerabilityId = requireString(body.vulnerabilityId, "vulnerabilityId", {
    max: 120,
  });

  return Response.json(await impactOfVulnerability(projectId, vulnerabilityId));
});
