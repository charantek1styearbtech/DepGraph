// components/layout/GlobalSearch.jsx - Cmd+K / Ctrl+K command palette.
"use client";

import * as React from "react";
import Link from "next/link";
import { Box, FolderGit2, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils.js";

const TYPE_META = {
  projects: { label: "Projects", icon: FolderGit2, href: (r) => `/projects/${r.id}` },
  packages: { label: "Packages", icon: Box, href: (r) => `/packages/${encodeURIComponent(r.id)}` },
  vulnerabilities: {
    label: "Vulnerabilities",
    icon: ShieldAlert,
    href: (r) => `/vulnerabilities/${r.id}`,
  },
};

export default function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setResults(null); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        setResults(res.ok ? await res.json() : null);
      } catch { /* aborted or offline */ }
      finally { setLoading(false); }
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query]);

  const close = () => { setOpen(false); setQuery(""); setResults(null); };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 w-56 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:w-72"
        aria-label="Open search">
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">Search projects, packages...</span>
        <kbd className="pointer-events-none hidden rounded border bg-background px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>
    );
  }

  const hasResults = results && ["projects", "packages", "vulnerabilities"].some((k) => results[k]?.length);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Global search">
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="absolute left-1/2 top-20 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-lg">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search packages, projects, vulnerabilities..."
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {loading && <span className="text-xs text-muted-foreground" role="status">...</span>}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {!hasResults && query.trim().length >= 2 && !loading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>
          )}
          {query.trim().length < 2 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Try lodash, shopstack or CVE.</p>
          )}
          {results && Object.entries(TYPE_META).map(([key, meta]) => {
            const rows = results[key] ?? [];
            if (rows.length === 0) return null;
            const Icon = meta.icon;
            return (
              <div key={key} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{meta.label}</p>
                {rows.map((row) => (
                  <Link key={row.id} href={meta.href(row)} onClick={close}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{row.title}</span>
                    {row.detail ? <span className="ml-auto truncate text-xs text-muted-foreground">{row.detail}</span> : null}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">Esc to close · Results come live from the CognoDB graph</div>
      </div>
    </div>
  );
}
