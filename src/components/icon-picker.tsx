"use client";

import { Ban, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICON_GROUPS, iconGroup, iconLabelKey, isIconKey, searchIcons, type IconGroup, type IconKey } from "@/lib/domain/icons";
import { cn } from "@/lib/utils";
import { SubjectIcon } from "./subject-icon";

type IconPickerProps = {
  id?: string;
  value: string | null;
  onChange: (icon: IconKey | null) => void;
  /** Clase `subj-<color>` para ver el ícono con el color elegido. */
  colorClass?: string;
  labelledBy?: string;
};

/**
 * El botón de la fila de arriba o de abajo más cercano a `from`, comparando el borde izquierdo:
 * así la flecha sigue la columna aunque los grupos dejen filas incompletas (y "Sin ícono", que
 * ocupa la fila entera, cae en la primera columna).
 */
function verticalNeighbor(buttons: HTMLElement[], from: HTMLElement, direction: 1 | -1): HTMLElement | undefined {
  const origin = from.getBoundingClientRect();
  let best: HTMLElement | undefined;
  let bestRow = Number.POSITIVE_INFINITY;
  let bestDx = Number.POSITIVE_INFINITY;
  for (const button of buttons) {
    const rect = button.getBoundingClientRect();
    const dy = (rect.top - origin.top) * direction;
    if (dy < origin.height / 2) continue;
    const dx = Math.abs(rect.left - origin.left);
    if (dy < bestRow - 1 || (Math.abs(dy - bestRow) <= 1 && dx < bestDx)) {
      best = button;
      bestRow = dy;
      bestDx = dx;
    }
  }
  return best;
}

/**
 * Selector de ícono: un botón con el ícono actual que abre la grilla agrupada (radiogroup) con un
 * buscador arriba. Las flechas se mueven por la grilla; desde el buscador, la flecha abajo entra en ella.
 */
export function IconPicker({ id, value, onChange, colorClass, labelledBy }: IconPickerProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const current = isIconKey(value) ? value : null;
  const nameOf = (icon: IconKey | null) => (icon ? t(iconLabelKey(icon) as "icon_book_open") : t("icon_none"));
  const groupName = (group: IconGroup) => t(`icon_group_${group}`);

  const results = useMemo(
    () =>
      query.trim()
        ? searchIcons(query, (icon) => ({
            label: t(iconLabelKey(icon) as "icon_book_open"),
            keywords: `${t(`icon_group_${iconGroup(icon)}`)} ${t(`icon_tags_${iconGroup(icon)}`)}`,
          }))
        : null,
    [query, t],
  );
  // La opción que recibe el Tab: la elegida si está a la vista; si no, la primera.
  const shown: (IconKey | null)[] = results ?? [null, ...ICON_GROUPS.flatMap((group) => group.icons)];
  const tabStop = shown.includes(current) ? current : shown[0];

  function choose(icon: IconKey | null) {
    onChange(icon);
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setQuery("");
  }

  const radios = () => [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = radios();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const moves: Record<string, () => HTMLElement | undefined> = {
      ArrowRight: () => buttons[index + 1],
      ArrowLeft: () => buttons[index - 1],
      ArrowDown: () => verticalNeighbor(buttons, buttons[index], 1),
      ArrowUp: () => verticalNeighbor(buttons, buttons[index], -1) ?? searchRef.current ?? undefined,
      Home: () => buttons[0],
      End: () => buttons[buttons.length - 1],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move()?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      radios()[0]?.focus();
    } else if (event.key === "Enter") {
      // Enter elige el primer resultado.
      event.preventDefault();
      if (results?.[0]) choose(results[0]);
    }
  }

  const option = (icon: IconKey | null) => (
    <button
      key={icon ?? "none"}
      type="button"
      role="radio"
      className={cn("icon-option", !icon && "is-none")}
      aria-checked={icon === current}
      aria-label={nameOf(icon)}
      title={icon ? nameOf(icon) : undefined}
      tabIndex={icon === tabStop ? 0 : -1}
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

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
      <PopoverContent
        className="popover-pad icon-popover"
        aria-label={t("icon")}
        onOpenAutoFocus={(event) => {
          // Con mouse y teclado se arranca escribiendo; con el dedo, el teclado del teléfono taparía la
          // grilla: el foco va a la opción elegida.
          event.preventDefault();
          if (window.matchMedia("(pointer: fine)").matches) {
            searchRef.current?.focus();
            gridRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: "nearest" });
          } else {
            gridRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
          }
        }}
      >
        <label className="icon-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            className="input"
            value={query}
            placeholder={t("icon_search_ph")}
            aria-label={t("icon_search")}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
          />
        </label>
        <div className="icon-scroll">
          <div ref={gridRef} className={cn("icon-grid", colorClass)} role="radiogroup" aria-label={t("icon")} onKeyDown={onGridKeyDown}>
            {results
              ? results.map(option)
              : [
                  option(null),
                  ...ICON_GROUPS.map((group) => (
                    <Fragment key={group.key}>
                      <span className="icon-group-label" aria-hidden="true">
                        {groupName(group.key)}
                      </span>
                      {group.icons.map(option)}
                    </Fragment>
                  )),
                ]}
          </div>
          {results && results.length === 0 ? <p className="icon-empty">{t("icon_search_empty", { query: query.trim() })}</p> : null}
        </div>
        <span className="visually-hidden" role="status">
          {results ? t("icon_results", { n: results.length }) : ""}
        </span>
      </PopoverContent>
    </Popover>
  );
}
