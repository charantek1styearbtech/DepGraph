// app/api/packages/route.js — searchable package list with pagination.

import { listPackages } from "@/lib/queries/packages.js";
import { intParam, route, searchParamsOf } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParamsOf(request);
  const page = intParam(params, "page", 1, { max: 200 });
  const pageSize = intParam(params, "pageSize", 24, { max: 100 });

  const result = await listPackages({
    q: params.get("q") ?? "",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return Response.json({ ...result, page, pageSize });
});
