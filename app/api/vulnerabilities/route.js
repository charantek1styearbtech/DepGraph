// app/api/vulnerabilities/route.js — advisory list.

import { listVulnerabilities } from "@/lib/queries/vulnerabilities.js";
import { intParam, route, searchParamsOf } from "@/lib/api.js";

export const dynamic = "force-dynamic";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const GET = route(async (request) => {
  const params = searchParamsOf(request);
  const rawSeverity = params.get("severity");
  const severity =
    rawSeverity && SEVERITIES.includes(rawSeverity) ? rawSeverity : null;
  const page = intParam(params, "page", 1, { max: 100 });
  const pageSize = intParam(params, "pageSize", 40, { max: 100 });

  const result = await listVulnerabilities({
    severity,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return Response.json({ ...result, severity, page, pageSize });
});
