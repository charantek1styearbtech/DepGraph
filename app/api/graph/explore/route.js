// app/api/graph/explore/route.js — layered subgraph for the Dependency Explorer.

import { getProjectGraph } from "@/lib/queries/dependencies.js";
import { intParam, requireString, route, searchParamsOf } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParamsOf(request);
  const projectId = requireString(params.get("projectId") ?? "", "projectId", {
    max: 120,
  });
  const depth = intParam(params, "depth", 3, { min: 1, max: 8 });

  return Response.json(await getProjectGraph(projectId, { maxDepth: depth }));
});
