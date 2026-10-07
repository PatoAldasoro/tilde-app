"use client";

import { Check } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  size?: "md" | "sm";
  /** Círculo de selección (modo "Seleccionar"). */
  variant?: "check" | "select";
  /** Motivo por el que no se puede marcar. Se muestra como tooltip al pasar, enfocar o tocar. */
  blockedReason?: string;
  onBlocked?: () => void;
  className?: string;
};

/**
 * Checkbox del diseño. Bloqueado usa aria-disabled (no disabled) para que siga
 * recibiendo foco y tap y pueda explicar por qué no se puede completar.
 *
 * El motivo va en un tooltip que se dibuja fuera del contenedor (portal): así no se recorta
 * cuando la casilla está en un panel con scroll, como "Tareas de hoy".
 */
export function Checkbox({ checked, onChange, label, size = "md", variant = "check", blockedReason, onBlocked, className }: CheckboxProps) {
  const [tipOpen, setTipOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const blocked = Boolean(blockedReason);

  const button = (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={blocked || undefined}
      aria-label={blocked ? `${label}. ${blockedReason}` : label}
      data-blocked-reason={blockedReason}
      className={cn("check", size === "sm" && "check-sm", variant === "select" && "check-select", className)}
      onClick={(event) => {
        if (!blocked) return onChange(!checked);
        // El tooltip se cierra solo al hacer clic: acá queda abierto un momento (en táctil no hay hover).
        event.preventDefault();
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
  if (!blocked) return button;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={tipOpen} onOpenChange={setTipOpen}>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip" side="top" align="start" sideOffset={6} collisionPadding={8}>
            {blockedReason}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
