// app/api/packages/[id]/dependents/route.js — reverse dependency analysis.

import { findDependents, getReverseNeighborhood } from "@/lib/queries/dependencies.js";
import { requireString, route } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request, context) => {
  const { id } = await context.params;
  const packageId = requireString(decodeURIComponent(id), "packageId", { max: 200 });

  const [dependents, reverseGraph] = await Promise.all([
    findDependents(packageId),
    getReverseNeighborhood(packageId, { levels: 2 }),
  ]);

  return Response.json({ ...dependents, layers: reverseGraph.layers });
});
