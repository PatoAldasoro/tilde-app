"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function Switch({ checked, onChange, children, disabled, className }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} className={cn("switch", className)} onClick={() => onChange(!checked)}>
      <span className="switch-track" />
      <span>{children}</span>
    </button>
  );
}
