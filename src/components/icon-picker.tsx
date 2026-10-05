"use client";

import { Ban, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICON_KEYS, iconLabelKey, isIconKey, type IconKey } from "@/lib/domain/icons";
import { cn } from "@/lib/utils";
import { SubjectIcon } from "./subject-icon";

const COLUMNS = 8;

type IconPickerProps = {
  id?: string;
  value: string | null;
  onChange: (icon: IconKey | null) => void;
  /** Clase `subj-<color>` para ver el ícono con el color elegido. */
  colorClass?: string;
  labelledBy?: string;
};

/** Selector de ícono: un botón con el ícono actual que abre la grilla (radiogroup, flechas para moverse). */
export function IconPicker({ id, value, onChange, colorClass, labelledBy }: IconPickerProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const current = isIconKey(value) ? value : null;
  // Posición 0 = "Sin ícono"; después, los íconos en orden.
  const options: (IconKey | null)[] = [null, ...ICON_KEYS];
  const selectedIndex = options.indexOf(current);
  const nameOf = (icon: IconKey | null) => (icon ? t(iconLabelKey(icon) as "icon_book_open") : t("icon_none"));

  function choose(icon: IconKey | null) {
    onChange(icon);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const focused = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const from = focused < 0 ? Math.max(selectedIndex, 0) : focused;
    // "Sin ícono" ocupa la primera fila entera; debajo, la grilla de COLUMNS por fila.
    const moves: Record<string, number> = {
      ArrowRight: from + 1,
      ArrowLeft: from - 1,
      ArrowDown: from === 0 ? 1 : from + COLUMNS,
      ArrowUp: from <= COLUMNS ? 0 : from - COLUMNS,
      Home: 0,
      End: options.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(options.length - 1, target))]?.focus();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" id={id} className={cn("icon-trigger", colorClass)} aria-labelledby={labelledBy ? `${labelledBy} ${id}-value` : undefined}>
          <span className="subject-tile" aria-hidden="true">
            {current ? <SubjectIcon icon={current} size={18} /> : <Ban size={16} />}
          </span>
          <span className="flex-1 truncate" id={id ? `${id}-value` : undefined}>
            {nameOf(current)}
          </span>
          <ChevronDown size={16} className="subtle flex-none" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="popover-pad icon-popover">
        <div className={cn("icon-grid", colorClass)} role="radiogroup" aria-label={t("icon")} onKeyDown={onKeyDown}>
          {options.map((icon, index) => {
            const selected = icon === current;
            return (
              <button
                key={icon ?? "none"}
                type="button"
                role="radio"
                className={cn("icon-option", !icon && "is-none")}
                aria-checked={selected}
                aria-label={nameOf(icon)}
                title={icon ? nameOf(icon) : undefined}
                tabIndex={index === Math.max(selectedIndex, 0) ? 0 : -1}
                onClick={() => choose(icon)}
              >
                {icon ? (
                  <SubjectIcon icon={icon} size={20} />
                ) : (
                  <>
                    <Ban size={18} />
                    <span>{nameOf(null)}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
