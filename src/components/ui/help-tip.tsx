"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Ayuda breve: tooltip con hover o foco; en táctil se abre al tocar. */
export function HelpTip({ label, text, position }: { label: string; text: string; position?: "bottom" | "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={cn("help-btn", open && "tip-open")}
      aria-label={`${label}: ${text}`}
      aria-expanded={open}
      data-tip={text}
      data-tip-pos={position}
      onClick={() => setOpen((value) => !value)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
    >
      <CircleHelp size={16} />
    </button>
  );
}
