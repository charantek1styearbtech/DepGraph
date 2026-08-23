// app/api/vulnerabilities/[id]/route.js — advisory detail.
// Pass ?include=projects for exact affected-project verification (costlier).

import { getVulnerabilityDetail } from "@/lib/queries/vulnerabilities.js";
import { getAffectedProjects } from "@/lib/queries/dependencies.js";
import { requireString, route } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request, context) => {
  const { id } = await context.params;
  const vulnerabilityId = requireString(decodeURIComponent(id), "vulnerabilityId", {
    max: 120,
  });

  const detail = await getVulnerabilityDetail(vulnerabilityId);

  const includeProjects =
    new URL(request.url).searchParams.get("include") === "projects";
  if (includeProjects) {
    const affected = await getAffectedProjects(vulnerabilityId);
    detail.affectedProjects = affected.projects;
  }

  return Response.json(detail);
});
