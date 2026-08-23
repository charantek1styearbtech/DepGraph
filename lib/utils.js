import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names while resolving Tailwind conflicts.
 * Standard shadcn/ui helper (JS edition).
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
