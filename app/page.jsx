import Link from "next/link";
import {
  ArrowRight,
  Box,
  GitBranch,
  Network,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/variants.js";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card.jsx";
import { cn } from "@/lib/utils.js";

const DEMO_PROJECT = "/projects/shopstack";
const CHAIN = ["ShopStack", "next", "webpack", "package-x", "lodash", "CVE-DEMO-2026-001"];

const FEATURES = [
  {
    icon: Network,
    title: "Dependency Graph Explorer",
    body: "Zoom through Project → Package → Version chains with progressive expansion and depth limits.",
  },
  {
    icon: Siren,
    title: "Vulnerability Impact Analyzer",
    body: "Pick a project and an advisory — see every path that connects them, hop by hop.",
  },
  {
    icon: GitBranch,
    title: "Dependency Path Finder",
    body: "Ask for lodash from ShopStack and get shortest plus alternate multi-hop routes.",
  },
  {
    icon: ShieldCheck,
    title: "Reverse Dependents",
    body: "Flip any package around: who depends on it directly, transitively, and who is at risk.",
  },
  {
    icon: Box,
    title: "Package Intelligence",
    body: "Versions, licenses, technologies, dependents and advisories on one page per package.",
  },
  {
    icon: ShieldAlert,
    title: "GitHub Import",
    body: "Paste a public repository URL — we parse package.json and the lockfile into the graph.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <Network className="size-5" aria-hidden />
            DepGraph
          </span>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/dashboard" className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/vulnerabilities" className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              Vulnerabilities
            </Link>
            <Link href="/import" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Add Project
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {/* Hero */}
        <section className="py-20 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            Powered by CognoDB · openCypher over Bolt
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Is your project affected by a vulnerable dependency?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
            DepGraph maps direct and transitive dependencies as a property graph so you can trace
            exactly <em>how</em> a vulnerability reaches your code — not just that it might.
          </p>

          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-y-2 rounded-xl border bg-card p-4 shadow-sm">
            {CHAIN.map((label, index) => (
              <span key={label} className="contents">
                {index > 0 && <ArrowRight className="mx-1 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span
                  className={
                    index === 0
                      ? "rounded-md border px-2 py-1 text-xs font-semibold"
                      : index === CHAIN.length - 1
                        ? "rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                        : "rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                  }
                >
                  {label}
                </span>
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={DEMO_PROJECT} className={cn(buttonVariants({ size: "lg" }))}>
              Explore Demo Project <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Open Dashboard
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Demo dataset ships with clearly-labelled CVE-DEMO-* advisories — no real CVEs.
          </p>
        </section>

        {/* Features */}
        <section className="pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <CardContent className="p-5 pt-5">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <CardTitle className="mt-3 text-base">{title}</CardTitle>
                  <CardDescription className="mt-1.5 leading-relaxed">{body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground">
          DepGraph — open-source dependency risk graph. Next.js · React Flow · neo4j-driver · CognoDB.
        </div>
      </footer>
    </div>
  );
}



