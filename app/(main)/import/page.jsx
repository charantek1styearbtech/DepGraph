// app/(main)/import/page.jsx â€” GitHub public repository import.
"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, GitBranch, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/display.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Input, Label } from "@/components/ui/primitives.jsx";

export default function ImportPage() {
  const [url, setUrl] = React.useState("");
  const [state, setState] = React.useState({ status: "idle" });

  async function submit(event) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/import/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await res.json();
      setState(
        res.ok
          ? { status: "done", summary: payload }
          : { status: "error", message: payload?.error?.message ?? "Import failed." },
      );
    } catch {
      setState({ status: "error", message: "Network error â€” please try again." });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add Project"
        description="Analyze a public Node.js repository and fold its dependency graph into CognoDB."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="size-4" aria-hidden /> GitHub repository
          </CardTitle>
          <CardDescription>
            Reads <span className="font-mono">package.json</span> and{" "}
            <span className="font-mono">package-lock.json</span> (v1/v2/v3). Public repositories
            only for now â€” private repositories require OAuth which is out of scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
            <Button type="submit" loading={state.status === "loading"} disabled={!url.trim()}>
              Analyze Repository
            </Button>
          </form>
        </CardContent>
      </Card>

      {state.status === "done" && (
        <Card className="border-emerald-300 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" aria-hidden /> Graph updated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Imported <span className="font-medium">{state.summary.repository}</span> as project{" "}
              <span className="font-mono">{state.summary.projectId}</span>.
            </p>
            <ul className="list-inside list-disc text-muted-foreground">
              <li>{state.summary.directDependencies} direct dependencies</li>
              <li>{state.summary.lockedPackages} locked package versions</li>
              <li>{state.summary.dependencyEdges} resolved DEPENDS_ON edges</li>
            </ul>
            {!state.summary.hadLockfile && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No package-lock.json found â€” transitive resolution is unavailable without a lockfile.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href={`/projects/${state.summary.projectId}`}
                className="text-sm font-medium underline underline-offset-2"
              >
                Open the new project â†’
              </Link>
              <Link
                href={`/explorer?project=${state.summary.projectId}`}
                className="text-sm font-medium underline underline-offset-2"
              >
                Explore its graph â†’
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {state.status === "error" && (
        <ErrorState
          title="Could not import"
          message={state.message}
        />
      )}

      {state.status !== "done" && state.status !== "error" ? null : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <TriangleAlert className="size-3.5" aria-hidden />
          Imports MERGE into the shared demo graph; re-running the seed restores the original dataset.
        </p>
      )}
    </div>
  );
}

