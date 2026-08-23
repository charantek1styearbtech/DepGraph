// components/shared/display.jsx - server-safe presentational helpers.

import { cn } from "@/lib/utils.js";
import { severityStyle } from "@/lib/severity.js";
export function SeverityBadge({ severity, className }) {
  const styles = severityStyle(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide",
        styles.badge,
        className,
      )}
    >
      {severity}
    </span>
  );
}

export function SeverityDot({ severity, className }) {
  return <span className={cn("inline-block size-2 rounded-full", severityStyle(severity).dot, className)} aria-hidden />;
}

export function StatCard({ label, value, hint, icon: Icon, accent = "text-foreground" }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", accent)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center">
      {Icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold">{title}</h3>
      {message ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

