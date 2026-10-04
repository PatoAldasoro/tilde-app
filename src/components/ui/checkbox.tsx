"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  size?: "md" | "sm";
  /** Círculo de selección (modo "Seleccionar"). */
  variant?: "check" | "select";
  /** Motivo por el que no se puede marcar. Se muestra como tooltip al enfocar o tocar. */
  blockedReason?: string;
  onBlocked?: () => void;
  className?: string;
};

/**
 * Checkbox del diseño. Bloqueado usa aria-disabled (no disabled) para que siga
 * recibiendo foco y tap y pueda explicar por qué no se puede completar.
 */
export function Checkbox({ checked, onChange, label, size = "md", variant = "check", blockedReason, onBlocked, className }: CheckboxProps) {
  const [tipOpen, setTipOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const blocked = Boolean(blockedReason);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={blocked || undefined}
      aria-label={blocked ? `${label}. ${blockedReason}` : label}
      data-tip={blockedReason}
      className={cn("check", size === "sm" && "check-sm", variant === "select" && "check-select", tipOpen && "tip-open", className)}
      onClick={() => {
        if (!blocked) return onChange(!checked);
        setTipOpen(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setTipOpen(false), 2200);
        onBlocked?.();
      }}
    >
      <span className="check-box">
        <Check size={14} strokeWidth={3} />
      </span>
    </button>
  );
}
