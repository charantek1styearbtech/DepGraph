// app/api/packages/[id]/route.js — package intelligence payload.
// Optional ?version=x.y.z to inspect dependencies of a specific release.

import { getPackageDetail } from "@/lib/queries/packages.js";
import { requireString, route, searchParamsOf } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request, context) => {
  const params = searchParamsOf(request);
  const { id } = await context.params;
  const packageId = requireString(decodeURIComponent(id), "packageId", { max: 200 });
  const version = params.get("version");

  return Response.json(await getPackageDetail(packageId, { version }));
});
