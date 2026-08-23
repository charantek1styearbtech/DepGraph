"use client";

// app/(main)/error.jsx — last-resort error boundary for the product area.

import ErrorState from "@/components/shared/ErrorState.jsx";

export default function MainError() {
  return (
    <ErrorState
      title="Something went wrong"
      message="The page failed to load its graph data. This is usually a temporary connection issue with CognoDB."
    />
  );
}
