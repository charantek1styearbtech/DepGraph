// app/(main)/vulnerabilities/page.jsx — advisory catalogue with filters.
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { listVulnerabilities } from "@/lib/queries/vulnerabilities.js";
import { EmptyState, PageHeader, SeverityBadge } from "@/components/shared/display.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { cn } from "@/lib/utils.js";

export const dynamic = "force-dynamic";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default async function VulnerabilitiesPage({ searchParams }) {
  const params = await searchParams;
  const severity = SEVERITIES.includes(params.severity) ? params.severity : null;

  let data;
  try {
    data = await listVulnerabilities({ severity, limit: 60 });
  } catch {
    return <ErrorState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vulnerabilities"
        description={`${data.total} demo advisories in the graph. Clearly labelled CVE-DEMO-* — never real CVE data.`}
      >
        <div className="flex flex-wrap items-center gap-1 rounded-lg border p-1">
          <FilterLink label="All" href="/vulnerabilities" active={!severity} />
          {SEVERITIES.map((level) => (
            <FilterLink
              key={level}
              label={level}
              href={`/vulnerabilities?severity=${level}`}
              active={severity === level}
            />
          ))}
        </div>
      </PageHeader>

      {data.vulnerabilities.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No advisories match"
          message="Try a different severity filter."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Advisory</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">CVSS</th>
                <th className="px-4 py-3 font-medium">Fixed in</th>
              </tr>
            </thead>
            <tbody>
              {data.vulnerabilities.map((cve) => (
                <tr key={cve.id} className="border-t transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <SeverityBadge severity={cve.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/vulnerabilities/${cve.id}`} className="font-mono font-medium hover:underline">
                      {cve.id}
                    </Link>
                    <span className="ml-2 text-muted-foreground">{cve.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/packages/${encodeURIComponent(cve.packageId)}`}
                      className="hover:underline"
                    >
                      {cve.packageId}@{cve.versionNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{cve.cvss.toFixed(1)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {cve.fixedIn ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterLink({ label, href, active }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium",
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
