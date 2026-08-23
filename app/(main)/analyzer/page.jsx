// app/(main)/analyzer/page.jsx — Vulnerability Impact Analyzer (flagship).
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Siren } from "lucide-react";
import PathStepper from "@/components/shared/PathStepper.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { EmptyState, PageHeader, SeverityBadge } from "@/components/shared/display.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Label, Select } from "@/components/ui/primitives.jsx";

function AnalyzerInner() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = React.useState([]);
  const [vulnerabilities, setVulnerabilities] = React.useState([]);
  const [projectId, setProjectId] = React.useState(searchParams.get("project") || "shopstack");
  const [vulnerabilityId, setVulnerabilityId] = React.useState("");
  const [result, setResult] = React.useState(undefined);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => (r.ok ? r.json() : Promise.reject(new Error("db")))),
      fetch("/api/vulnerabilities?pageSize=100").then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("db")),
      ),
    ])
      .then(([projectData, vulnData]) => {
        setProjects(projectData.projects ?? []);
        setVulnerabilities(vulnData.vulnerabilities ?? []);
        const pkgParam = searchParams.get("package");
        if (pkgParam) {
          const match = (vulnData.vulnerabilities ?? []).find((c) => c.packageId === pkgParam);
          if (match) setVulnerabilityId(match.id);
        }
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyze() {
    setLoading(true);
    setResult(undefined);
    try {
      const res = await fetch("/api/impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, vulnerabilityId }),
      });
      setResult(res.ok ? await res.json() : { error: true });
    } catch {
      setResult({ error: true });
    } finally {
      setLoading(false);
    }
  }

  if (failed) return <ErrorState />;

  const selectedVuln = vulnerabilities.find((c) => c.id === vulnerabilityId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vulnerability Impact Analyzer"
        description="Choose a project and an advisory to trace exactly how the risk reaches the code."
      />

      <Card>
        <CardContent className="grid gap-4 p-5 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="analyzer-project">Source project</Label>
            <Select id="analyzer-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analyzer-vuln">Vulnerability</Label>
            <Select
              id="analyzer-vuln"
              value={vulnerabilityId}
              onChange={(e) => setVulnerabilityId(e.target.value)}
            >
              <option value="">Select an advisory…</option>
              {vulnerabilities.map((cve) => (
                <option key={cve.id} value={cve.id}>
                  {cve.id} · {cve.severity} · {cve.packageName}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={analyze} disabled={!vulnerabilityId || !projectId} loading={loading}>
            {!loading && <Siren className="size-4" aria-hidden />} Analyze Impact
          </Button>
        </CardContent>
      </Card>

      {selectedVuln ? (
        <p className="text-sm text-muted-foreground">
          {selectedVuln.id} — {selectedVuln.title}
        </p>
      ) : null}

      {result && !result.error
        ? result.affected
          ? renderAffected(result)
          : renderClean(result)
        : null}

      {result?.error ? (
        <ErrorState title="Analysis failed" message="Please try again." />
      ) : null}
    </div>
  );
}

function renderAffected(result) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impact summary</CardTitle>
          <CardDescription>
            {result.project.name} is affected via{" "}
            {result.reach.direct ? "a direct dependency" : `${result.reach.minHops} dependency hops`}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <SummaryRow label="Severity">
            <SeverityBadge severity={result.vulnerability.severity} />
            <span className="ml-2 text-xs text-muted-foreground">CVSS {result.vulnerability.cvss}</span>
          </SummaryRow>
          <SummaryRow label="Affected package">
            <Link
              href={`/packages/${encodeURIComponent(result.vulnerability.packageId)}`}
              className="font-medium hover:underline"
            >
              {result.vulnerability.packageId}
            </Link>
            <span className="ml-1 font-mono text-xs text-muted-foreground">
              @{result.vulnerability.versionNumber}
            </span>
          </SummaryRow>
          <SummaryRow label="Reach" value={result.reach.direct ? "Direct" : "Transitive"} />
          <SummaryRow label="Dependency depth" value={`${result.reach.minHops} hops`} />
          <SummaryRow label="Paths found" value={result.reach.pathCount} />
          {result.vulnerability.fixedIn ? (
            <SummaryRow label="Fixed in" value={`v${result.vulnerability.fixedIn}`} />
          ) : null}
          <p className="border-t pt-3 text-xs text-muted-foreground">
            {result.paths.length < result.reach.pathCount
              ? `Showing ${result.paths.length} of ${result.reach.pathCount} paths.`
              : "All discovered paths shown."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dependency path</CardTitle>
          <CardDescription>Every hop from project to the affected release.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.paths.slice(0, 3).map((path, index) => (
            <div key={index} className="space-y-1">
              {result.paths.length > 1 && (
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Path {index + 1}
                </p>
              )}
              <PathStepper steps={path.steps} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function renderClean(result) {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="Not affected in demo data"
      message={`No resolved-version path connects ${
        result.project?.name ?? "this project"
      } to the selected advisory.`}
    />
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center font-medium">{children}</span>
    </div>
  );
}

export default function AnalyzerPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading analyzer…</div>}>
      <AnalyzerInner />
    </Suspense>
  );
}

