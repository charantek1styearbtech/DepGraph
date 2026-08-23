// app/api/path/route.js — Dependency Path Finder (project ▸ … ▸ package).

import { findDependencyPaths } from "@/lib/queries/dependencies.js";
import { readJsonBody, requireString, route } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const body = await readJsonBody(request);
  const projectId = requireString(body.projectId, "projectId", { max: 120 });
  const targetPackageId = requireString(body.targetPackageId, "targetPackageId", {
    max: 200,
  });

  return Response.json(await findDependencyPaths(projectId, targetPackageId));
});
