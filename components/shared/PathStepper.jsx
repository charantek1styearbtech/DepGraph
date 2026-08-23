// components/shared/PathStepper.jsx — vertical Project ▸ … ▸ target chain.
import Link from "next/link";
import { ArrowDown, FolderGit2, Box } from "lucide-react";
import { cn } from "@/lib/utils.js";

export default function PathStepper({ steps }) {
  return (
    <ol className="space-y-1">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const Icon = step.type === "project" ? FolderGit2 : Box;
        const href =
          step.type === "project"
            ? `/projects/${step.id}`
            : `/packages/${encodeURIComponent(step.id)}`;
        return (
          <li key={`${step.id}-${index}`}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent",
                isLast && step.vulnerable !== false && step.type === "package"
                  ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                  : "",
              )}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className={cn("truncate font-medium", step.vulnerable && "text-red-600 dark:text-red-400")}>
                {step.label}
                {step.version ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">@{step.version}</span>
                ) : null}
              </span>
              {step.hops != null && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{step.hops} hops</span>
              )}
            </Link>
            {!isLast && (
              <div className="flex justify-start pl-6">
                <ArrowDown className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
