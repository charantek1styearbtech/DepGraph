// app/api/projects/route.js — project cards for /projects.

import { listProjects } from "@/lib/queries/projects.js";
import { intParam, route } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const limit = intParam(new URL(request.url).searchParams, "limit", 50);
  const projects = await listProjects({ limit });
  return Response.json({ projects });
});
