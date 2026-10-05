"use client";

import { CalendarClock, Download, Laptop, Monitor, Moon, Smartphone, Sun, Tablet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { CommitInput } from "@/components/ui/commit-input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";
import type { WeekItem } from "@/lib/domain/schedule";
import type { SubjectBadge } from "@/lib/domain/subjects";
import { isPortrait, normalizeHexColor, WALLPAPER_FORMAT_KEYS, WALLPAPER_FORMATS, wallpaperLayout, type WallpaperFormat } from "@/lib/domain/wallpaper";
import { downloadCanvas, drawWallpaper, loadWallpaperFonts, readWallpaperColors, type WallpaperBlockInfo } from "@/lib/wallpaper-canvas";
import { readWallpaperPrefs, writeWallpaperPrefs, type WallpaperPrefs } from "@/lib/wallpaper-prefs";

type WallpaperSubject = SubjectBadge & { commission?: string | null };

type WallpaperDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La semana tipo (typicalWeek). */
  week: WeekItem[];
  subjects: Map<string, WallpaperSubject>;
  /** Días que se dibujan: los visibles en el Horario. */
  weekdays: number[];
};

/** Exporta el horario como imagen para usar de fondo de pantalla. */
export function WallpaperDialog({ open, onOpenChange, week, subjects, weekdays }: WallpaperDialogProps) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent size="lg" className="dialog-xl" title={t("wallpaper_title")} description={t("wallpaper_desc")}>
          <WallpaperForm week={week} subjects={subjects} weekdays={weekdays} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

const FORMAT_ICON: Record<WallpaperFormat, ReactNode> = {
  "16x9": <Monitor size={16} />,
  "16x10": <Laptop size={16} />,
  "9x16": <Tablet size={16} />,
  "9x19.5": <Smartphone size={16} />,
};

function WallpaperForm({ week, subjects, weekdays, onDone }: Omit<WallpaperDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useTranslations();
  const id = useId();
  const [prefs, setPrefs] = useState<WallpaperPrefs>(() => readWallpaperPrefs(document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);
  const { format, theme, background, color, blocks } = prefs;

  // Las opciones se recuerdan en este dispositivo para la próxima vez.
  const update = (patch: Partial<WallpaperPrefs>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writeWallpaperPrefs(next);
      return next;
    });

  const weekdayLabels = t("wd_short");
  const timeLabel = t("time");
  const layout = useMemo(() => wallpaperLayout(week, weekdays, format), [week, weekdays, format]);
  const isEmpty = layout.blocks.length === 0;
  const size = WALLPAPER_FORMATS[format];

  // Íconos que hacen falta: se dibujan ocultos y el canvas copia sus trazos.
  const iconOf = (item: WeekItem) => (item.kind === "class" ? subjects.get(item.block.subject_id)?.icon : item.event.icon) ?? null;
  const icons = [...new Set(week.map(iconOf).filter((icon): icon is string => Boolean(icon)))];

  useEffect(() => {
    const canvas = canvasRef.current;
    const probe = probeRef.current;
    if (!canvas || !probe) return;
    let cancelled = false;
    const colors = readWallpaperColors(probe, theme === "dark");
    const info = (item: WeekItem): WallpaperBlockInfo => {
      const subject = item.kind === "class" ? subjects.get(item.block.subject_id) : undefined;
      const icon = item.kind === "class" ? subject?.icon : item.event.icon;
      return {
        title: item.kind === "class" ? (subject?.name ?? "") : item.event.title,
        room: item.kind === "class" ? item.block.room : null,
        badge: subject?.commission?.trim() || null,
        colorKey: item.kind === "class" ? (subject?.color_key ?? "grafito") : item.event.color_key,
        icon: icon ? (iconsRef.current?.querySelector<SVGElement>(`svg[data-icon="${icon}"]`) ?? null) : null,
      };
    };
    void loadWallpaperFonts(colors).then(() => {
      if (cancelled) return;
      drawWallpaper(canvas, layout, { colors, background, customColor: color, blockStyle: blocks, weekdayLabels: weekdayLabels.split(","), timeLabel, info });
    });
    return () => {
      cancelled = true;
    };
  }, [layout, theme, background, color, blocks, subjects, weekdayLabels, timeLabel]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      await downloadCanvas(canvas, `${t("wallpaper_file")}-${format}.png`);
      toast(t("wallpaper_downloaded"));
      onDone();
    } catch {
      toast(t("wallpaper_error"));
    } finally {
      setSaving(false);
    }
  }

  const formatLabel = (key: WallpaperFormat) => (
    <>
      <span className="visually-hidden">{isPortrait(key) ? t("wallpaper_vertical") : t("wallpaper_horizontal")} </span>
      {t(`wallpaper_ratio_${key.replace(".", "_") as "16x9" | "16x10" | "9x16" | "9x19_5"}`)}
    </>
  );

  return (
    <>
      <DialogBody>
        <div className="wallpaper-layout">
          <div className="wallpaper-options">
            <Field label={t("wallpaper_format")} hint={t(`wallpaper_hint_${format.replace(".", "_") as "16x9" | "16x10" | "9x16" | "9x19_5"}`)}>
              <Segmented
                label={t("wallpaper_format")}
                value={format}
                onChange={(next) => update({ format: next })}
                options={WALLPAPER_FORMAT_KEYS.map((key) => ({ value: key, label: formatLabel(key), icon: FORMAT_ICON[key] }))}
              />
            </Field>
            <Field label={t("theme")}>
              <Segmented
                label={t("theme")}
                value={theme}
                onChange={(next) => update({ theme: next })}
                options={[
                  { value: "light", label: t("theme_light"), icon: <Sun size={16} /> },
                  { value: "dark", label: t("theme_dark"), icon: <Moon size={16} /> },
                ]}
              />
            </Field>
            <Field label={t("wallpaper_background")}>
              <Segmented
                label={t("wallpaper_background")}
                value={background}
                onChange={(next) => update({ background: next })}
                options={[
                  { value: "plain", label: t("wallpaper_bg_plain") },
                  { value: "glow", label: t("wallpaper_bg_glow") },
                  { value: "custom", label: t("wallpaper_bg_custom") },
                ]}
              />
            </Field>
            {background === "custom" ? (
              <Field label={t("wallpaper_color")} htmlFor={`${id}-hex`} hint={t("wallpaper_color_hint")}>
                <div className="color-field">
                  <input
                    type="color"
                    className="color-input"
                    value={color}
                    aria-label={t("wallpaper_color_pick")}
                    onChange={(event) => update({ color: normalizeHexColor(event.target.value) ?? color })}
                  />
                  <CommitInput
                    id={`${id}-hex`}
                    className="input tnum"
                    value={color.toUpperCase()}
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    onCommit={(text) => {
                      const hex = normalizeHexColor(text);
                      if (!hex) return false;
                      update({ color: hex });
                    }}
                  />
                </div>
              </Field>
            ) : null}
            <Field label={t("wallpaper_blocks")}>
              <Segmented
                label={t("wallpaper_blocks")}
                value={blocks}
                onChange={(next) => update({ blocks: next })}
                options={[
                  { value: "solid", label: t("wallpaper_blocks_solid") },
                  { value: "soft", label: t("wallpaper_blocks_soft") },
                ]}
              />
            </Field>
          </div>

          <div className="wallpaper-preview" data-format={format}>
            <canvas ref={canvasRef} role="img" aria-label={t("wallpaper_preview_alt")} data-testid="wallpaper-canvas" />
          </div>
        </div>
        {isEmpty ? (
          <p className="notice">
            <CalendarClock size={18} className="flex-none" />
            <span>{t("wallpaper_empty")}</span>
          </p>
        ) : null}

        {/* Fuera de la vista: de acá salen los colores del tema elegido y los trazos de los íconos. */}
        <div data-theme={theme} hidden>
          <span ref={probeRef} />
        </div>
        <div ref={iconsRef} hidden>
          {icons.map((icon) => (
            <SubjectIcon key={icon} icon={icon} size={24} />
          ))}
        </div>
      </DialogBody>
      <DialogFooter>
        <span className="field-hint tnum self-center">{t("wallpaper_size", { width: String(size.width), height: String(size.height) })}</span>
        <span className="spacer" />
        <Button onClick={onDone}>{t("cancel")}</Button>
        <Button variant="primary" loading={saving} disabled={isEmpty} onClick={() => void download()}>
          <Download size={18} />
          {t("wallpaper_download")}
        </Button>
      </DialogFooter>
    </>
  );
}
