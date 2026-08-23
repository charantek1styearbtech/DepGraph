// app/(main)/vulnerabilities/[id]/page.jsx — advisory detail + blast radius.
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  getVulnerabilityDetail,
} from "@/lib/queries/vulnerabilities.js";
import { getAffectedProjects } from "@/lib/queries/dependencies.js";
import { EmptyState, PageHeader, SeverityBadge, SeverityDot } from "@/components/shared/display.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { buttonVariants } from "@/components/ui/variants.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { cn } from "@/lib/utils.js";

export const dynamic = "force-dynamic";

export default async function VulnerabilityDetailPage({ params }) {
  const { id } = await params;
  const vulnerabilityId = decodeURIComponent(id);

  let detail;
  let affected;
  try {
    detail = await getVulnerabilityDetail(vulnerabilityId);
    affected = await getAffectedProjects(vulnerabilityId);
  } catch (error) {
    if (error?.status === 404) {
      return (
        <EmptyState
          title="Advisory not found"
          message="This demo advisory does not exist in the graph."
          action={
            <Link href="/vulnerabilities" className={cn(buttonVariants({ variant: "outline" }))}>
              All advisories
            </Link>
          }
        />
      );
    }
    return <ErrorState />;
  }

  const { vulnerability, version, pkg, fixedRelease } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title={vulnerability.id}
        description={
          <>
            <SeverityBadge severity={vulnerability.severity} className="mr-2" />
            CVSS {vulnerability.cvss?.toFixed(1)} · published {vulnerability.publishedAt}
          </>
        }
      >
        {affected.projects[0] ? (
          <Link
            href={`/analyzer?project=${affected.projects[0].id}&package=${encodeURIComponent(pkg.id)}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Analyze impact <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{vulnerability.description}</p>
            <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
              Demo advisory generated for the DepGraph dataset. It is intentionally prefixed with
              CVE-DEMO and does not represent a real vulnerability.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Affected release</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Package">
              <Link href={`/packages/${encodeURIComponent(pkg.id)}`} className="font-medium hover:underline">
                {pkg.id}
              </Link>
            </Row>
            <Row label="Affected version" value={version.number} mono />
            <Row label="Fixed in" value={vulnerability.fixedIn ?? "no fix available"} mono />
            {fixedRelease ? (
              <p className="text-xs text-muted-foreground">
                Patched release {fixedRelease.number} published {fixedRelease.publishedAt}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Affected projects ({affected.projects.length})
          </CardTitle>
          <CardDescription>
            Exact verification: each project resolves a dependency path to{" "}
            <span className="font-mono">{pkg.id}@{version.number}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {affected.projects.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No affected projects"
              message="No seeded project reaches this vulnerable release."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {affected.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{project.name}</span>
                  <SeverityDot severity={vulnerability.severity} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

