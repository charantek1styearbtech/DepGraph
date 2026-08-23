// app/(main)/projects/page.jsx — all demo projects with risk at a glance.
import Link from "next/link";
import { ArrowRight, FolderGit2, Star } from "lucide-react";
import { listProjects } from "@/lib/queries/projects.js";
import { EmptyState, PageHeader, SeverityDot } from "@/components/shared/display.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { Badge } from "@/components/ui/badge.jsx";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  let projects;
  try {
    projects = await listProjects({ limit: 100 });
  } catch {
    return <ErrorState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every seeded repository with its resolved dependency risk."
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          message="Run npm run seed to load the demo dataset, or import a GitHub repository."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold leading-tight">{project.name}</h2>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Star className="size-3.5" aria-hidden />
                  {(project.stars ?? 0).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {project.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{project.language ?? "JavaScript"}</Badge>
                <Badge variant="secondary">{project.directDependencies} direct deps</Badge>
                {project.vulnerabilities > 0 ? (
                  <Badge variant="destructive" className="bg-red-600 text-white dark:bg-red-700">
                    <SeverityDot severity="CRITICAL" /> {project.vulnerabilities} vulnerabilities
                  </Badge>
                ) : (
                  <Badge variant="success">no known advisories</Badge>
                )}
              </div>

              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                View details <ArrowRight className="size-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
