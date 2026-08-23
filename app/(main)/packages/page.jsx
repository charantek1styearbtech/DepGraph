// app/(main)/packages/page.jsx — searchable package catalogue.
import Link from "next/link";
import { Box, Search } from "lucide-react";
import { listPackages } from "@/lib/queries/packages.js";
import { EmptyState, PageHeader } from "@/components/shared/display.jsx";
import ErrorState from "@/components/shared/ErrorState.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Input } from "@/components/ui/primitives.jsx";
import { buttonVariants } from "@/components/ui/variants.js";
import { cn } from "@/lib/utils.js";

export const dynamic = "force-dynamic";

export default async function PackagesPage({ searchParams }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";

  let data;
  try {
    data = await listPackages({ q, limit: 60 });
  } catch {
    return <ErrorState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description={`${data.total} packages tracked in the graph.`}
      >
        <form action="/packages" className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Filter packages…"
            className="w-56 pl-8"
            aria-label="Filter packages"
          />
        </form>
      </PageHeader>

      {data.packages.length === 0 ? (
        <EmptyState icon={Box} title="No packages match" message={`Nothing found for “${q}”.`} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/packages/${encodeURIComponent(pkg.id)}`}
              className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md"
            >
              <p className="truncate font-mono text-sm font-semibold" title={pkg.name}>
                {pkg.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                latest {pkg.latestVersion} · {pkg.versionCount} versions
              </p>
              <div className="mt-3 flex items-center gap-2">
                {pkg.vulnerabilityCount > 0 ? (
                  <Badge variant="destructive" className="bg-red-600 text-white dark:bg-red-700">
                    {pkg.vulnerabilityCount} advisories
                  </Badge>
                ) : (
                  <Badge variant="success">clean</Badge>
                )}
                <span
                  className={cn(
                    "ml-auto text-xs opacity-0 transition-opacity group-hover:opacity-100",
                    buttonVariants({ variant: "link", size: "sm" }),
                  )}
                >
                  details →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


