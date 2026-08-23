// app/(main)/projects/[id]/page.jsx — project overview & risk summary.
import Link from "next/link";
import { ArrowUpRight, Boxes, ExternalLink, Network, ShieldCheck, Siren } from "lucide-react";
import { getProjectDetail } from "@/lib/queries/projects.js";
import { EmptyState, PageHeader, SeverityBadge } from "@/components/shared/display.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { buttonVariants } from "@/components/ui/variants.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { cn } from "@/lib/utils.js";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }) {
  const { id } = await params;

  let detail;
  try {
    detail = await getProjectDetail(decodeURIComponent(id));
  } catch (error) {
    if (error?.status === 404) {
      return (
        <EmptyState
          icon={Boxes}
          title="Project not found"
          message="This project does not exist in the demo graph. Try ShopStack from the projects list."
          action={
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to projects
            </Link>
          }
        />
      );
    }
    return <ErrorState />;
  }

  const { counts } = detail;
  const repoUrl = detail.project.url ?? detail.repository?.url;

  return (
    <div className="space-y-6">
      <PageHeader title={detail.project.name} description={detail.project.description}>
        <Link
          href={`/explorer?project=${detail.project.id}`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Network className="size-4" aria-hidden /> Dependency Explorer
        </Link>
        <Link
          href={`/analyzer?project=${detail.project.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Siren className="size-4" aria-hidden /> Analyze Risk
        </Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="p-5 pt-5">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Repository</dt>
                <dd>
                  {repoUrl ? (
                    <a
                      href={repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium hover:underline"
                    >
                      {detail.repository?.fullName ?? repoUrl}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <Row label="Organization" value={detail.organization?.login ?? "—"} />
              <Row label="Language" value={detail.project.language ?? "—"} />
              <Row label="Stars" value={(detail.project.stars ?? 0).toLocaleString()} />
            </dl>
            <a
              href={`/api/projects/${detail.project.id}`}
              className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View JSON API <ArrowUpRight className="size-3" aria-hidden />
            </a>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <Metric label="Direct deps" value={counts.directDependencies} />
          <Metric label="Transitive deps" value={counts.transitiveDependencies} />
          <Metric
            label="Vulnerabilities"
            value={counts.vulnerabilities}
            tone={counts.vulnerabilities > 0 ? "danger" : "ok"}
          />
          <Metric label="Critical" value={counts.critical} tone={counts.critical ? "danger" : undefined} />
          <Metric label="High" value={counts.high} tone={counts.high ? "warn" : undefined} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vulnerabilities affecting this project</CardTitle>
          <CardDescription>Resolved-version aware — patched pins do not appear here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.vulnerabilities.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No vulnerabilities found"
              message="This project currently has no vulnerabilities in the available demo dataset."
            />
          ) : (
            detail.vulnerabilities.map((cve) => (
              <Link
                key={cve.id}
                href={`/vulnerabilities/${cve.id}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <SeverityBadge severity={cve.severity} />
                <span className="font-mono text-sm font-medium">{cve.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {cve.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  via {cve.packageId}@{cve.versionNumber}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Direct dependencies ({detail.directDependencies.length})
          </CardTitle>
          <CardDescription>Declared range → lockfile-resolved release.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Package</th>
                  <th className="px-4 py-2 font-medium">Specified</th>
                  <th className="px-4 py-2 font-medium">Resolved</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.directDependencies.map((dep) => (
                  <tr key={dep.id} className="border-t">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/packages/${encodeURIComponent(dep.id)}`}
                        className="font-medium hover:underline"
                      >
                        {dep.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {dep.versionSpec ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{dep.resolvedVersion ?? "?"}</td>
                    <td className="px-4 py-2.5">
                      {dep.resolvedVersion == null ? (
                        <span className="text-xs text-muted-foreground">unresolved</span>
                      ) : dep.vulnerable ? (
                        <span className="inline-flex items-center rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white dark:bg-red-700">
                          VULNERABLE
                        </span>
                      ) : dep.vulnerabilityIds?.length ? (
                        <span className="text-xs text-muted-foreground">
                          other versions affected
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          safe
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold",
          tone === "danger" && "text-red-600 dark:text-red-400",
          tone === "warn" && "text-orange-500",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}



