"use client";

import { ArrowDownWideNarrow, Pin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { TASK_SORTS, type TaskSort } from "@/lib/domain/tasks";
import { setTaskSort } from "@/lib/task-sort-prefs";
import { cn } from "@/lib/utils";

type TaskSortMenuProps = {
  sort: TaskSort;
  /** "Guardar como mi orden": deja el criterio elegido como orden propio. */
  onSave: () => void;
  canSave: boolean;
  /** Versión chica, para el panel de la sesión de estudio. */
  compact?: boolean;
};

/**
 * Menú con los criterios de orden de las tareas. El criterio es uno solo para Tareas y para la
 * sesión de estudio (se guarda en el dispositivo): elegirlo en un lado lo cambia en el otro.
 */
export function TaskSortMenu({ sort, onSave, canSave, compact }: TaskSortMenuProps) {
  const t = useTranslations();
  const manual = sort === "manual";
  return (
    <Menu>
      <MenuTrigger className={cn("btn btn-ghost", compact && "btn-sm sort-trigger")} aria-label={t("sort_current", { name: t(`sort_${sort}`) })}>
        <ArrowDownWideNarrow size={compact ? 16 : 18} />
        {compact ? null : <span className="btn-label">{t("sort")}</span>}
        {manual ? null : <span className="badge badge-accent">{t(`sort_${sort}`)}</span>}
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{t("sort_heading")}</MenuLabel>
        <MenuRadioGroup value={sort} onValueChange={(value) => setTaskSort(value as TaskSort)}>
          {TASK_SORTS.map((key) => (
            <MenuRadioItem key={key} value={key}>
              {t(`sort_${key}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        {manual ? null : (
          <>
            <MenuSeparator />
            <MenuItem icon={<Pin size={18} />} disabled={!canSave} onSelect={onSave}>
              {t("sort_save")}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
