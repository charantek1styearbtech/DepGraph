// app/api/projects/[id]/route.js — single project overview.

import { getProjectDetail } from "@/lib/queries/projects.js";
import { requireString, route } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request, context) => {
  const { id } = await context.params;
  const projectId = requireString(decodeURIComponent(id), "projectId", { max: 120 });
  return Response.json(await getProjectDetail(projectId));
});
