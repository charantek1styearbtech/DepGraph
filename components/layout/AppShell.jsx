// components/layout/AppShell.jsx â€” persistent developer-tool chrome.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderGit2,
  ExternalLink,
  LayoutDashboard,
  Network,
  Package,
  Search,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils.js";
import GlobalSearch from "./GlobalSearch.jsx";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderGit2 },
  { href: "/explorer", label: "Dependency Explorer", icon: Network },
  { href: "/packages", label: "Packages", icon: Package },
  { href: "/vulnerabilities", label: "Vulnerabilities", icon: ShieldAlert },
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Topbar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Network className="size-5" aria-hidden />
          DepGraph
        </Link>
        <span className="hidden rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
          CognoDB demo
        </span>

        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch />
          <a
            href="https://ExternalLink.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Source repository"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
          <div
            className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            aria-hidden
          >
            DG
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r bg-background py-4 md:block">
          <SidebarNav isActive={isActive} />
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>

      {/* Mobile nav strip */}
      <nav className="sticky bottom-0 z-40 overflow-x-auto border-t bg-background md:hidden">
        <div className="flex gap-1 p-2">
          <MobileNav isActive={isActive} />
        </div>
      </nav>
    </div>
  );
}

function SidebarNav({ isActive }) {
  return (
    <nav className="space-y-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(href)
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function MobileNav({ isActive }) {
  return (
    <>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium",
            isActive(href)
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </Link>
      ))}
    </>
  );
}

export function SearchTriggerHint() {
  return (
    <span className="pointer-events-none inline-flex select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      <Search className="size-3" /> K
    </span>
  );
}

