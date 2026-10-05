"use client";

import { CalendarClock, Download, Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";
import type { WeekItem } from "@/lib/domain/schedule";
import type { SubjectBadge } from "@/lib/domain/subjects";
import { WALLPAPER_SIZE, wallpaperLayout, type WallpaperFormat } from "@/lib/domain/wallpaper";
import { downloadCanvas, drawWallpaper, loadWallpaperFonts, readWallpaperColors, type WallpaperBackground, type WallpaperBlockInfo } from "@/lib/wallpaper-canvas";

type WallpaperDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La semana tipo (typicalWeek). */
  week: WeekItem[];
  subjects: Map<string, SubjectBadge>;
  /** Días que se dibujan: los visibles en el Horario. */
  weekdays: number[];
};

/** Exporta el horario como imagen 16:9 para usar de fondo de pantalla. */
export function WallpaperDialog({ open, onOpenChange, week, subjects, weekdays }: WallpaperDialogProps) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent size="lg" title={t("wallpaper_title")} description={t("wallpaper_desc")}>
          <WallpaperForm week={week} subjects={subjects} weekdays={weekdays} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

type Theme = "light" | "dark";

function WallpaperForm({ week, subjects, weekdays, onDone }: Omit<WallpaperDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useTranslations();
  const [format, setFormat] = useState<WallpaperFormat>("landscape");
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
  const [background, setBackground] = useState<WallpaperBackground>("glow");
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);

  const weekdayLabels = t("wd_short");
  const layout = useMemo(() => wallpaperLayout(week, weekdays, format), [week, weekdays, format]);
  const isEmpty = layout.blocks.length === 0;
  const size = WALLPAPER_SIZE[format];

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
        colorKey: item.kind === "class" ? (subject?.color_key ?? "grafito") : item.event.color_key,
        icon: icon ? (iconsRef.current?.querySelector<SVGElement>(`svg[data-icon="${icon}"]`) ?? null) : null,
      };
    };
    void loadWallpaperFonts(colors).then(() => {
      if (!cancelled) drawWallpaper(canvas, layout, { colors, background, weekdayLabels: weekdayLabels.split(","), info });
    });
    return () => {
      cancelled = true;
    };
  }, [layout, theme, background, subjects, weekdayLabels]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      await downloadCanvas(canvas, `${t("wallpaper_file")}-${format === "landscape" ? "16x9" : "9x16"}.png`);
      toast(t("wallpaper_downloaded"));
      onDone();
    } catch {
      toast(t("wallpaper_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogBody>
        <div className="wallpaper-options">
          <Field label={t("wallpaper_format")}>
            <Segmented
              label={t("wallpaper_format")}
              value={format}
              onChange={setFormat}
              options={[
                { value: "landscape", label: t("wallpaper_landscape"), icon: <Monitor size={16} /> },
                { value: "portrait", label: t("wallpaper_portrait"), icon: <Smartphone size={16} /> },
              ]}
            />
          </Field>
          <Field label={t("theme")}>
            <Segmented
              label={t("theme")}
              value={theme}
              onChange={setTheme}
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
              onChange={setBackground}
              options={[
                { value: "glow", label: t("wallpaper_bg_glow") },
                { value: "plain", label: t("wallpaper_bg_plain") },
              ]}
            />
          </Field>
        </div>

        <div className="wallpaper-preview" data-format={format}>
          <canvas ref={canvasRef} role="img" aria-label={t("wallpaper_preview_alt")} data-testid="wallpaper-canvas" />
        </div>
        {isEmpty ? (
          <p className="notice">
            <CalendarClock size={18} className="flex-none" />
            <span>{t("wallpaper_empty")}</span>
          </p>
        ) : (
          <p className="field-hint -mt-2">{t("wallpaper_note")}</p>
        )}

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
        <span className="field-hint tnum">{t("wallpaper_size", { width: String(size.width), height: String(size.height) })}</span>
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
