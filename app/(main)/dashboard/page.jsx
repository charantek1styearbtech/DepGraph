// app/(main)/dashboard/page.jsx — graph overview + risk highlights.
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  FolderGit2,
  Network,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  getDashboardStats,
  getHighestRiskProjects,
  getSeverityDistribution,
  getTopVulnerablePackages,
} from "@/lib/queries/dashboard.js";
import { PageHeader, SeverityDot, StatCard } from "@/components/shared/display.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { SEVERITY_ORDER } from "@/lib/severity.js";

export const dynamic = "force-dynamic";

const SEVERITY_BAR_CLASS = {
  CRITICAL: "bg-red-600 dark:bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400 dark:bg-amber-500",
  LOW: "bg-sky-500",
};

export default async function DashboardPage() {
  let data;
  try {
    const [stats, severityDistribution, topVulnerablePackages, highestRiskProjects] =
      await Promise.all([
        getDashboardStats(),
        getSeverityDistribution(),
        getTopVulnerablePackages({ limit: 6 }),
        getHighestRiskProjects({ limit: 6 }),
      ]);
    data = { stats, severityDistribution, topVulnerablePackages, highestRiskProjects };
  } catch {
    return <ErrorState />;
  }

  const severityMap = Object.fromEntries(
    data.severityDistribution.map((row) => [row.severity, row.count]),
  );
  const totalAdvisories = Object.values(severityMap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Live statistics from the CognoDB dependency graph."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Projects" value={data.stats.projects} icon={FolderGit2} />
        <StatCard label="Packages" value={data.stats.packages} icon={Boxes} />
        <StatCard
          label="Dependency relationships"
          value={data.stats.relationships}
          icon={Network}
          hint="DIRECT_DEPENDS_ON · HAS_VERSION · DEPENDS_ON"
        />
        <StatCard
          label="Vulnerabilities"
          value={data.stats.vulnerabilities}
          icon={ShieldAlert}
          accent="text-red-600 dark:text-red-400"
        />
        <StatCard
          label="Affected projects"
          value={data.stats.affectedProjects}
          icon={Users}
          hint="Reach at least one demo advisory"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vulnerability severity</CardTitle>
            <CardDescription>Distribution across all demo advisories.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {SEVERITY_ORDER.map((severity) => {
                const count = severityMap[severity] ?? 0;
                if (!count) return null;
                return (
                  <div
                    key={severity}
                    className={SEVERITY_BAR_CLASS[severity]}
                    style={{ width: `${(count / totalAdvisories) * 100}%` }}
                    title={`${severity}: ${count}`}
                  />
                );
              })}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SEVERITY_ORDER.map((severity) => (
                <div key={severity} className="rounded-lg border p-3">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <SeverityDot severity={severity} /> {severity}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold">{severityMap[severity] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects with highest dependency risk</CardTitle>
            <CardDescription>Ranked by advisories reachable through resolved versions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.highestRiskProjects.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No risk data yet.</p>
            )}
            {data.highestRiskProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{project.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {project.vulnerablePackages.join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-destructive">
                  {project.vulnerabilities}
                  <ShieldAlert className="size-4" aria-hidden />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most impactful vulnerable packages</CardTitle>
          <CardDescription>Advisory count and direct project exposure.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.topVulnerablePackages.map((pkg) => (
              <Link
                key={pkg.id}
                href={`/packages/${encodeURIComponent(pkg.id)}`}
                className="group rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <p className="flex items-center justify-between text-sm font-semibold">
                  {pkg.name}
                  <ArrowRight
                    className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  latest {pkg.latestVersion} · {pkg.directProjects} direct projects
                </p>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold">{pkg.vulnerabilityCount}</span>
                  <span className="text-xs text-muted-foreground">advisories</span>
                </p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

