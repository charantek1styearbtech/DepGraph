// app/api/dashboard/route.js — aggregated dashboard payload.

import {
  getDashboardStats,
  getHighestRiskProjects,
  getSeverityDistribution,
  getTopVulnerablePackages,
} from "@/lib/queries/dashboard.js";
import { intParam, route, searchParamsOf } from "@/lib/api.js";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParamsOf(request);
  const limit = intParam(params, "limit", 8, { max: 25 });

  const [stats, severityDistribution, topVulnerablePackages, highestRiskProjects] =
    await Promise.all([
      getDashboardStats(),
      getSeverityDistribution(),
      getTopVulnerablePackages({ limit }),
      getHighestRiskProjects({ limit }),
    ]);

  return Response.json({
    stats,
    severityDistribution,
    topVulnerablePackages,
    highestRiskProjects,
  });
});
