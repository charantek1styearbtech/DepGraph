// app/(main)/explorer/page.jsx — interactive dependency graph explorer.
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Route } from "lucide-react";
import DependencyGraphCanvas from "@/components/graph/DependencyGraphCanvas.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Select } from "@/components/ui/primitives.jsx";
import { cn } from "@/lib/utils.js";

const DEFAULT_PROJECT = "shopstack";
const OUTLINE_SM =
  "inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent";

function ExplorerInner() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = React.useState([]);
  const [projectId, setProjectId] = React.useState(
    searchParams.get("project") || DEFAULT_PROJECT,
  );
  const [depth, setDepth] = React.useState(3);
  const [graph, setGraph] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [trace, setTrace] = React.useState(null);
  const [tracing, setTracing] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("unavailable"))))
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setFailed(true));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    setTrace(null);
    fetch(`/api/graph/explore?projectId=${encodeURIComponent(projectId)}&depth=${depth}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json())?.error?.message ?? "failed");
        return res.json();
      })
      .then((data) => !cancelled && setGraph(data))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, depth]);

  async function tracePath(targetPackageId) {
    setTracing(true);
    setTrace(null);
    try {
      const res = await fetch("/api/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, targetPackageId }),
      });
      if (res.ok) setTrace(await res.json());
    } finally {
      setTracing(false);
    }
  }

  const highlightEdges = React.useMemo(() => {
    const steps = trace?.paths?.[0]?.steps ?? [];
    const set = new Set();
    for (let i = 0; i + 1 < steps.length; i += 1) {
      set.add(`${steps[i].id}|${steps[i + 1].id}`);
    }
    return set;
  }, [trace]);

  if (failed && !graph) {
    return (
      <ErrorState
        title="Database unavailable"
        message="We couldn't connect to the dependency graph. Please try again."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Dependency Explorer</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            aria-label="Project"
            className="w-56"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {[2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDepth(value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  depth === value
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground",
                )}
                aria-pressed={depth === value}
              >
                depth {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <DependencyGraphCanvas
          nodes={graph?.nodes ?? []}
          edges={graph?.edges ?? []}
          loading={loading}
          selectedId={selected?.id}
          highlightEdges={highlightEdges}
          onSelectNode={setSelected}
        />

        <aside className="space-y-3 rounded-xl border bg-card p-5">
          {!selected && (
            <p className="text-sm text-muted-foreground">
              Click a package node to inspect it. Red borders mark packages whose resolved version
              carries a demo advisory.
            </p>
          )}

          {selected && (
            <>
              <h2 className="truncate text-base font-semibold">{selected.label}</h2>
              {selected.version ? (
                <p className="font-mono text-xs text-muted-foreground">
                  resolved {selected.version} · depth {selected.depth}
                  {selected.direct ? " · direct" : ""}
                </p>
              ) : null}
              <p className="text-sm">
                {selected.vulnerable ? (
                  <span className="font-medium text-red-600 dark:text-red-400">
                    Vulnerable at this resolved version.
                  </span>
                ) : (
                  <span className="text-muted-foreground">No advisory on this release.</span>
                )}
              </p>

              <div className="flex flex-col gap-2 pt-1">
                {selected.kind === "package" && (
                  <>
                    <Button size="sm" variant="outline" loading={tracing} onClick={() => tracePath(selected.id)}>
                      <Route className="size-4" aria-hidden /> Trace dependency path
                    </Button>
                    <Link href={`/packages/${encodeURIComponent(selected.id)}`} className={cn(OUTLINE_SM)}>
                      Open package page
                    </Link>
                  </>
                )}
              </div>

              {trace?.paths?.length ? (
                <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
                  Shortest: {trace.paths[0].steps.map((step) => step.label).join(" ▸ ")} —{" "}
                  {trace.paths[0].hops} hops (edges highlighted).
                </div>
              ) : null}
              {trace && trace.paths.length === 0 && (
                <p className="text-xs text-muted-foreground">No path found within depth limits.</p>
              )}
            </>
          )}

          {graph ? (
            <dl className="mt-2 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
              <Stat label="nodes" value={graph.nodes.length} />
              <Stat label="edges" value={graph.edges.length} />
              <Stat label="depth" value={graph.depthReached} />
            </dl>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading explorer…</div>}>
      <ExplorerInner />
    </Suspense>
  );
}

