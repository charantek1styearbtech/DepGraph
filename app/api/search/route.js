// app/api/search/route.js — categorized global search.

import { searchEntities } from "@/lib/queries/search.js";
import { requireString, route, searchParamsOf } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParamsOf(request);
  const q = requireString(params.get("q") ?? "", "q", { max: 100 });
  return Response.json(await searchEntities(q));
});
