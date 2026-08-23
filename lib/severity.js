// lib/severity.js — severity presentation tokens shared across components.

export const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const SEVERITY_STYLES = {
  CRITICAL: {
    badge:
      "border-transparent bg-red-600 text-white dark:bg-red-700",
    dot: "bg-red-600 dark:bg-red-500",
    bar: "bg-red-600 dark:bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  HIGH: {
    badge:
      "border-transparent bg-orange-500 text-white dark:bg-orange-600",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
  },
  MEDIUM: {
    badge:
      "border-transparent bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950",
    dot: "bg-amber-400 dark:bg-amber-500",
    bar: "bg-amber-400 dark:bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  LOW: {
    badge:
      "border-transparent bg-sky-500 text-white dark:bg-sky-600",
    dot: "bg-sky-500",
    bar: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
};

export function severityStyle(severity) {
  return SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.LOW;
}
