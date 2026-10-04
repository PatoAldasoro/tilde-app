import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type ProgressProps = {
  /** 0–100 */
  value: number;
  label: string;
  size?: "xs" | "md" | "lg";
  /** Color de la barra (por defecto, el acento). */
  bar?: string;
  className?: string;
};

export function Progress({ value, label, size = "md", bar, className }: ProgressProps) {
  const style = { "--value": `${value}%`, ...(bar ? { "--bar": bar } : {}) } as CSSProperties;
  return (
    <div
      className={cn("progress", size === "xs" && "progress-xs", size === "lg" && "progress-lg", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      style={style}
    >
      <i />
    </div>
  );
}
