// app/(main)/packages/[id]/page.jsx — package intelligence with tabs.
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowUpRight, Boxes, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { EmptyState, SeverityBadge, SeverityDot } from "@/components/shared/display.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import { cn } from "@/lib/utils.js";

function PackageDetailInner() {
  const params = useParams();
  const packageId = decodeURIComponent(params.id);

  const [data, setData] = React.useState(undefined);
  const [failed, setFailed] = React.useState(false);
  const [dependents, setDependents] = React.useState(undefined);

  React.useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setFailed(false);
    setDependents(undefined);
    fetch(`/api/packages/${encodeURIComponent(packageId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json())?.error?.message ?? "failed");
        return res.json();
      })
      .then((payload) => !cancelled && setData(payload))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  React.useEffect(() => {
    // Fire once package metadata is in — do NOT gate on a specific stat field:
    // an engine quirk previously left stats empty and silently skipped this.
    if (!data) return;
    fetch(`/api/packages/${encodeURIComponent(packageId)}/dependents`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then(setDependents)
      .catch(() => setDependents(null));
  }, [packageId, data]);

  if (failed) {
    return (
      <ErrorState
        title="Could not load package"
        message="The graph may be unavailable, or this package does not exist."
      />
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const stats = data.stats ?? {};
  const hasAdvisories = (data.vulnerabilities?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{data.pkg.id}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest release{" "}
            <span className="font-mono">{stats.latestVersion}</span>
            {data.license ? (
              <>
                {" · license "}
                <Link href="#" className="underline decoration-dotted underline-offset-2">
                  {data.license.spdx}
                </Link>
              </>
            ) : null}
            {data.technologies?.length ? ` · ${data.technologies.join(", ")}` : ""}
          </p>
        </div>
        {hasAdvisories ? (
          <Badge variant="destructive" className="bg-red-600 text-white dark:bg-red-700">
            <ShieldAlert className="size-3" aria-hidden /> {data.vulnerabilities.length} advisories
          </Badge>
        ) : (
          <Badge variant="success">no known advisories</Badge>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="dependents">Dependents</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Versions" value={data.versions?.length ?? 0} />
            <Stat label="Dependencies (latest)" value={data.dependencies?.length ?? 0} />
            <Stat label="Dependent versions" value={stats.dependentVersions ?? "—"} />
            <Stat label="Direct dependent projects" value={stats.directProjects ?? "—"} />
          </div>
          <p className="mt-4 rounded-xl border border-dashed bg-card/50 p-4 text-sm text-muted-foreground">
            Package intelligence is served live from the CognoDB graph. Reverse analysis lives in
            the Dependents tab; advisory history in Vulnerabilities.
          </p>
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Release</th>
                    <th className="px-4 py-2.5 font-medium">Published</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.versions ?? []).map((v) => (
                    <tr key={v.number} className="border-t">
                      <td className="px-4 py-2.5 font-mono">{v.number}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{v.publishedAt}</td>
                      <td className="px-4 py-2.5">
                        {v.isLatest ? <Badge variant="secondary">latest</Badge> : null}{" "}
                        {v.vulnerable ? (
                          <Badge variant="destructive" className="bg-red-600 text-white dark:bg-red-700">
                            affected
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">patched / clean</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependencies">
          {(data.dependencies?.length ?? 0) === 0 ? (
            <EmptyState icon={Boxes} title="No runtime dependencies" message="This release is a leaf package." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.dependencies.map((dep, index) => (
                <Link
                  key={`${dep.id}-${index}`}
                  href={`/packages/${encodeURIComponent(dep.id)}`}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-mono font-medium">{dep.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {dep.range}
                    {dep.vulnerable ? <SeverityDot severity="CRITICAL" /> : null}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dependents">
          {dependents === undefined ? (
            <p className="text-sm text-muted-foreground">Running reverse analysis…</p>
          ) : dependents === null ? (
            <ErrorState title="Reverse analysis failed" message="Please retry in a moment." />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Total dependent projects" value={dependents.total} />
                <Stat label="Direct dependents" value={dependents.directCount} />
                <Stat label="Transitive dependents" value={dependents.transitiveCount} />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Reverse graph</CardTitle>
                  <CardDescription>
                    Who depends on this package (level 1) and their own parents (level 2).
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {(dependents.layers ?? []).map((layer) => (
                    <div key={layer.depth}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Level {layer.depth}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {layer.packages.map((p) => (
                          <Link
                            key={p.id}
                            href={`/packages/${encodeURIComponent(p.id)}`}
                            className="rounded-md border bg-background px-2 py-1 font-mono text-xs hover:bg-accent"
                          >
                            {p.name}
                            <ArrowUpRight className="inline size-3" aria-hidden />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <DependentCard title="Direct dependents" rows={dependents.direct} direct />
              <DependentCard title="Transitive dependents" rows={dependents.transitive} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="vulnerabilities">
          {hasAdvisories ? (
            <div className="space-y-2">
              {data.vulnerabilities.map((cve) => (
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
                  <span className="font-mono text-xs text-muted-foreground">@{cve.versionNumber}</span>
                  {cve.fixedIn ? <Badge variant="outline">fixed v{cve.fixedIn}</Badge> : null}
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="No advisories"
              message="Clean across all tracked releases."
            />
          )}
        </TabsContent>

        <TabsContent value="projects">
          <p className="text-sm text-muted-foreground">
            Project exposure is best answered per advisory — open the{" "}
            <Link href="/analyzer" className="underline underline-offset-2">
              Impact Analyzer
            </Link>{" "}
            or a specific advisory to see exactly which projects resolve into this package, and
            through which path.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DependentCard({ title, rows, direct = false }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/projects/${row.id}`}
            className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            {row.name}
            <span className="ml-1.5 text-muted-foreground">
              {direct ? "direct" : `${row.hops} hops`}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PackageDetailPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading package…</div>}>
      <PackageDetailInner />
    </Suspense>
  );
}


