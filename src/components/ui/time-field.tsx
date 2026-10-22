"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { matchTimeOption, parseTimeInput, timeOptions, timeToMinutes } from "@/lib/domain/time";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "./popover";

type TimeFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Límites en minutos desde la medianoche (incluidos). */
  from: number;
  to: number;
  /** Paso de las horas que se ofrecen en la lista (se puede escribir cualquier otra). */
  step?: number;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Hora con lista (combobox): se elige una de la lista, cada media hora, o se escribe cualquiera
 * ("18:50", "1850"). Siempre 24 h. Lo que no es una hora, o queda fuera de los límites, vuelve al
 * valor anterior al salir del campo.
 */
export function TimeField({ id, value, onChange, from, to, step = 30, className, ...aria }: TimeFieldProps) {
  const t = useTranslations();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Lo que se está escribiendo; null = muestra el valor.
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = timeOptions(Math.ceil(from / step) * step, to, step);
  const text = draft ?? value;

  /** La opción a resaltar al abrir: la del valor o la siguiente. */
  const nearest = () => {
    const minutes = timeToMinutes(value);
    const index = options.findIndex((option) => timeToMinutes(option) >= minutes);
    return index < 0 ? options.length - 1 : index;
  };

  function show(index = nearest()) {
    setActive(index);
    setOpen(true);
  }

  function choose(option: string) {
    onChange(option);
    setDraft(null);
    setOpen(false);
  }

  /**
   * Acepta lo escrito si es una hora dentro de los límites; si está a medio escribir ("18:3"),
   * la opción resaltada; si no, vuelve al valor.
   */
  function commit() {
    setOpen(false);
    if (draft === null) return;
    const parsed = parseTimeInput(draft);
    setDraft(null);
    const next = parsed && parsed !== "invalid" && timeToMinutes(parsed) >= from && timeToMinutes(parsed) <= to ? parsed : active >= 0 ? options[active] : null;
    if (next && next !== value) onChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) return show();
        // Moverse por la lista escribe la opción en el campo (Tab o salir la confirman).
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const index = Math.max(0, Math.min(options.length - 1, (active < 0 ? nearest() - (delta > 0 ? 1 : 0) : active) + delta));
        setActive(index);
        setDraft(options[index]);
        return;
      }
      case "Enter":
        // Sin nada a medio escribir, Enter envía el formulario; si no, confirma la hora (así no se
        // envía con la anterior).
        if (!open && draft === null) return;
        event.preventDefault();
        if (open && active >= 0 && options[active]) choose(options[active]);
        else commit();
        return;
      case "Escape":
        if (!open && draft === null) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setDraft(null);
        return;
      case "Tab":
        commit();
        return;
    }
  }

  const activeId = open && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <Popover open={open} onOpenChange={(next) => (next ? show() : setOpen(false))}>
      <PopoverAnchor asChild>
        <div className="time-field">
          <input
            ref={inputRef}
            id={id}
            className={cn("input tnum", className)}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={activeId}
            aria-autocomplete="none"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            maxLength={5}
            placeholder="HH:MM"
            value={text}
            {...aria}
            onFocus={(event) => event.currentTarget.select()}
            onClick={() => (open ? null : show())}
            onChange={(event) => {
              setDraft(event.target.value);
              const match = matchTimeOption(options, event.target.value);
              setActive(match);
              setOpen(true);
            }}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="time-field-toggle"
            tabIndex={-1}
            aria-label={t("time_show_options")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              inputRef.current?.focus();
              if (open) setOpen(false);
              else show();
            }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="time-list"
        aria-label={t("time_options")}
        sideOffset={4}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // Tocar el propio campo no cierra la lista (el campo decide).
          if (event.target instanceof Node && inputRef.current?.parentElement?.contains(event.target)) event.preventDefault();
        }}
      >
        {/* La lista es la que se desplaza: es la que controla el campo (aria-controls). */}
        <div role="listbox" id={listId} className="time-scroll" aria-label={t("time_options")}>
          {options.map((option, index) => (
            <div
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option === value}
              className={cn("time-option tnum", index === active && "is-active")}
              ref={index === active ? (node) => node?.scrollIntoView({ block: "center" }) : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
