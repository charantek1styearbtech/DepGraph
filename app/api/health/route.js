// app/api/health/route.js — CognoDB liveness probe (`RETURN 1`).
// Drives the global "Database unavailable" banner and retry flows.

import { checkConnection, isDatabaseConfigured } from "@/lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return Response.json(
      { status: "unconfigured", message: "COGNODB_* environment variables are not set" },
      { status: 503 },
    );
  }
  const ok = await checkConnection();
  return Response.json({ status: ok ? "ok" : "unavailable" }, { status: ok ? 200 : 503 });
}
