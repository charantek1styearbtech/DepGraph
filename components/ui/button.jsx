// components/ui/button.jsx
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "./variants.js";
import { cn } from "@/lib/utils.js";

const Button = React.forwardRef(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { Button };

