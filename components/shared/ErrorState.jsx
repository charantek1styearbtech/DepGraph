// components/shared/ErrorState.jsx — friendly failure card with Retry.
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";

/**
 * Database-unavailable / unexpected-failure presentation.
 * Per assignment §23 the technical cause is never shown here — it lives in
 * server logs. The Retry action re-runs the server component tree.
 */
export default function ErrorState({
  title = "Database unavailable",
  message = "We couldn't connect to the dependency graph. Please try again.",
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <TriangleAlert className="size-6 text-destructive" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button
        className="mt-5"
        loading={pending}
        onClick={() => {
          setPending(true);
          router.refresh();
          setTimeout(() => setPending(false), 1500);
        }}
      >
        {!pending && <RefreshCw aria-hidden />}
        Retry
      </Button>
    </div>
  );
}
