// app/(main)/path-finder/page.jsx — Dependency Path Finder.
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Route } from "lucide-react";
import PathStepper from "@/components/shared/PathStepper.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { EmptyState, PageHeader } from "@/components/shared/display.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Label, Input, Select } from "@/components/ui/primitives.jsx";

function PathFinderInner() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = React.useState([]);
  const [projectId, setProjectId] = React.useState(searchParams.get("project") || "shopstack");
  const [target, setTarget] = React.useState(searchParams.get("target") || "lodash");
  const [result, setResult] = React.useState(undefined);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("db"))))
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setFailed(true));
  }, []);

  async function find() {
    setLoading(true);
    setResult(undefined);
    try {
      const res = await fetch("/api/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, targetPackageId: target.trim() }),
      });
      setResult(res.ok ? await res.json() : { error: true });
    } catch {
      setResult({ error: true });
    } finally {
      setLoading(false);
    }
  }

  if (failed) return <ErrorState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dependency Path Finder"
        description="How does a package reach a project? Shortest route first, alternates after."
      />

      <Card>
        <CardContent className="grid gap-4 p-5 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="path-project">Source project</Label>
            <Select id="path-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="path-target">Target package</Label>
            <Input
              id="path-target"
              value={target}
              placeholder="e.g. lodash"
              onChange={(event) => setTarget(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && find()}
            />
          </div>
          <Button onClick={find} loading={loading} disabled={!target.trim()}>
            {!loading && <Route className="size-4" aria-hidden />} Find Dependency Path
          </Button>
        </CardContent>
      </Card>

      {result && !result.error ? (
        result.paths.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {result.totalPaths} path{result.totalPaths === 1 ? "" : "s"} · shortest{" "}
                {result.paths[0].hops} hops
              </CardTitle>
              <CardDescription>Package-level routes under lockfile resolution.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              {result.paths.map((path, index) => (
                <div key={index} className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Path {index + 1} · {path.hops} hops
                  </p>
                  <PathStepper steps={path.steps} />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Route}
            title="No dependency path found"
            message={
              <>
                {result.project?.name ?? "This project"} does not reach “{target}” within the
                traversal depth limit. Try{" "}
                <Link href={`/packages/${encodeURIComponent(target.trim())}`} className="underline">
                  the package page
                </Link>{" "}
                to inspect it directly.
              </>
            }
          />
        )
      ) : null}

      {result?.error ? <ErrorState title="Lookup failed" message="Please try again." /> : null}
    </div>
  );
}

export default function PathFinderPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <PathFinderInner />
    </Suspense>
  );
}
