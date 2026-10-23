"use client";

// Las tipografías de los temas: solo se descargan cuando un tema las usa.
import "@fontsource-variable/caveat";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/nunito";
import "@fontsource-variable/space-grotesk";
import { CalendarClock, Download, Laptop, Maximize2, Monitor, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { CommitInput } from "@/components/ui/commit-input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import type { WeekItem } from "@/lib/domain/schedule";
import type { SubjectBadge } from "@/lib/domain/subjects";
import { minutesToTime } from "@/lib/domain/time";
import {
  deviceWallpaperSize,
  hasOffGridTimes,
  isPortrait,
  normalizeHexColor,
  WALLPAPER_FORMAT_KEYS,
  WALLPAPER_FORMATS,
  wallpaperLayout,
  wallpaperSize,
  type WallpaperFormat,
} from "@/lib/domain/wallpaper";
import { WALLPAPER_THEMES, wallpaperTheme, type FontRole } from "@/lib/domain/wallpaper-themes";
import { downloadCanvas, drawWallpaper, loadWallpaperFont, readAppTokens, type WallpaperBlockInfo } from "@/lib/wallpaper-canvas";
import { readWallpaperPrefs, writeWallpaperPrefs, type WallpaperPrefs } from "@/lib/wallpaper-prefs";
import { WallpaperThemePicker } from "./wallpaper-theme-picker";

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
  device: <MonitorSmartphone size={16} />,
  "16x9": <Monitor size={16} />,
  "16x10": <Laptop size={16} />,
  "9x16": <Tablet size={16} />,
  "9x19.5": <Smartphone size={16} />,
};

const FONT_ROLES: FontRole[] = ["sans", "serif", "mono", "rounded", "grotesk", "hand"];

// La pantalla (en CSS y su densidad) cambia si la ventana pasa a otro monitor o se gira el teléfono.
function subscribeScreen(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}
const screenSnapshot = () => `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}`;

function WallpaperForm({ week, subjects, weekdays, onDone }: Omit<WallpaperDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useTranslations();
  const id = useId();
  const [prefs, setPrefs] = useState<WallpaperPrefs>(() => readWallpaperPrefs(document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
  // Los tokens de la app, en claro y en oscuro: de ahí salen los colores de las materias de cada tema.
  const [tokens] = useState(readAppTokens);
  const [fontsReady, setFontsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);
  const { format, background, color } = prefs;

  // Las opciones se recuerdan en este dispositivo para la próxima vez.
  const update = (patch: Partial<WallpaperPrefs>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writeWallpaperPrefs(next);
      return next;
    });

  const screen = useSyncExternalStore(subscribeScreen, screenSnapshot, () => "");
  const device = useMemo(() => {
    const match = /^([\d.]+)x([\d.]+)@([\d.]+)$/.exec(screen);
    return match ? deviceWallpaperSize({ width: Number(match[1]), height: Number(match[2]) }, Number(match[3])) : null;
  }, [screen]);
  const size = wallpaperSize(format, device);
  const themes = useMemo(() => WALLPAPER_THEMES.map((key) => wallpaperTheme(key, tokens.light, tokens.dark)), [tokens]);
  const theme = themes.find((entry) => entry.key === prefs.theme) ?? themes[0];

  const weekdayLabels = t("wd_short");
  const timeLabel = t("time");
  const layout = useMemo(() => wallpaperLayout(week, weekdays, size), [week, weekdays, size]);
  const isEmpty = layout.blocks.length === 0;
  // Sin elegir, el horario se escribe solo si algún bloque no cae en la media hora.
  const showTimes = prefs.times ?? hasOffGridTimes(layout.blocks.map(({ item }) => item));

  // Íconos que hacen falta: se dibujan ocultos y el canvas copia sus trazos.
  const iconOf = (item: WeekItem) => (item.kind === "class" ? subjects.get(item.block.subject_id)?.icon : item.event.icon) ?? null;
  const icons = [...new Set(week.map(iconOf).filter((icon): icon is string => Boolean(icon)))];

  // Todas las tipografías, para las muestras de los temas (cada una pesa poco y queda guardada).
  useEffect(() => {
    let cancelled = false;
    void Promise.all(FONT_ROLES.map((role) => loadWallpaperFont(role, tokens.fontSans))).then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tokens.fontSans]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const info = (item: WeekItem): WallpaperBlockInfo => {
      const subject = item.kind === "class" ? subjects.get(item.block.subject_id) : undefined;
      const icon = item.kind === "class" ? subject?.icon : item.event.icon;
      return {
        title: item.kind === "class" ? (subject?.name ?? "") : item.event.title,
        room: item.kind === "class" ? item.block.room : null,
        badge: subject?.commission?.trim() || null,
        time: `${minutesToTime(item.start)}–${minutesToTime(item.end)}`,
        colorKey: item.kind === "class" ? (subject?.color_key ?? "grafito") : item.event.color_key,
        icon: icon ? (iconsRef.current?.querySelector<SVGElement>(`svg[data-icon="${icon}"]`) ?? null) : null,
      };
    };
    void loadWallpaperFont(theme.font, tokens.fontSans).then(() => {
      if (cancelled) return;
      drawWallpaper(canvas, layout, {
        theme,
        fontSans: tokens.fontSans,
        background,
        customColor: color,
        showTimes,
        weekdayLabels: weekdayLabels.split(","),
        timeLabel,
        info,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [layout, theme, background, color, showTimes, subjects, weekdayLabels, timeLabel, tokens.fontSans]);

  const fileName = `${t("wallpaper_file")}-${format === "device" ? `${size.width}x${size.height}` : format}.png`;

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      await downloadCanvas(canvas, fileName);
      toast(t("wallpaper_downloaded"));
      setZoomed(false);
      onDone();
    } catch {
      toast(t("wallpaper_error"));
    } finally {
      setSaving(false);
    }
  }

  const formatLabel = (key: WallpaperFormat) =>
    key === "device" ? (
      t("wallpaper_device")
    ) : (
      <>
        <span className="visually-hidden">{isPortrait(WALLPAPER_FORMATS[key]) ? t("wallpaper_vertical") : t("wallpaper_horizontal")} </span>
        {t(`wallpaper_ratio_${key.replace(".", "_") as "16x9" | "16x10" | "9x16" | "9x19_5"}`)}
      </>
    );
  // "Este dispositivo" no necesita explicación: su medida está al pie.
  const formatHint = format === "device" ? undefined : t(`wallpaper_hint_${format.replace(".", "_") as "16x9" | "16x10" | "9x16" | "9x19_5"}`);
  const formats: WallpaperFormat[] = device ? ["device", ...WALLPAPER_FORMAT_KEYS] : WALLPAPER_FORMAT_KEYS;

  return (
    <>
      <DialogBody>
        <div className="wallpaper-layout">
          <div className="wallpaper-main">
            <div className="wallpaper-preview" data-portrait={isPortrait(size) || undefined}>
              <canvas ref={canvasRef} role="img" aria-label={t("wallpaper_preview_alt")} data-testid="wallpaper-canvas" />
              <Button icon variant="ghost" className="wallpaper-zoom" aria-label={t("wallpaper_zoom")} data-tip={t("wallpaper_zoom")} onClick={() => setZoomed(true)}>
                <Maximize2 size={18} />
              </Button>
            </div>
            <Field label={t("wallpaper_theme")} labelId={`${id}-theme`}>
              <WallpaperThemePicker
                themes={themes}
                value={theme.key}
                onChange={(next) => update({ theme: next })}
                fontSans={tokens.fontSans}
                fontsReady={fontsReady}
                labelledBy={`${id}-theme`}
              />
            </Field>
          </div>

          <div className="wallpaper-options">
            <Field label={t("wallpaper_format")} hint={formatHint}>
              <Segmented
                label={t("wallpaper_format")}
                value={format === "device" && !device ? "16x9" : format}
                onChange={(next) => update({ format: next })}
                options={formats.map((key) => ({ value: key, label: formatLabel(key), icon: FORMAT_ICON[key] }))}
              />
            </Field>
            <Field label={t("wallpaper_background")}>
              <Segmented
                label={t("wallpaper_background")}
                value={background}
                onChange={(next) => update({ background: next })}
                options={[
                  { value: "theme", label: t("wallpaper_bg_theme") },
                  { value: "glow", label: t("wallpaper_bg_glow") },
                  { value: "custom", label: t("wallpaper_bg_custom") },
                ]}
              />
            </Field>
            {background === "custom" ? (
              <Field label={t("wallpaper_color")} htmlFor={`${id}-hex`}>
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
            <Switch checked={showTimes} onChange={(next) => update({ times: next })}>
              {t("wallpaper_times")}
            </Switch>
          </div>
        </div>
        {isEmpty ? (
          <p className="notice">
            <CalendarClock size={18} className="flex-none" />
            <span>{t("wallpaper_empty")}</span>
          </p>
        ) : null}

        {/* Fuera de la vista: de acá salen los trazos de los íconos. */}
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

      <PreviewZoom
        open={zoomed}
        onOpenChange={setZoomed}
        source={canvasRef}
        sizeLabel={t("wallpaper_size", { width: String(size.width), height: String(size.height) })}
        canDownload={!isEmpty}
        saving={saving}
        onDownload={() => void download()}
      />
    </>
  );
}

type PreviewZoomProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: RefObject<HTMLCanvasElement | null>;
  sizeLabel: string;
  canDownload: boolean;
  saving: boolean;
  onDownload: () => void;
};

/**
 * La vista previa en pantalla completa: la imagen ajustada a la pantalla o, tocándola, en su
 * tamaño real (con desplazamiento) para revisar los detalles.
 */
function PreviewZoom({ open, onOpenChange, source, sizeLabel, canDownload, saving, onDownload }: PreviewZoomProps) {
  const t = useTranslations();
  const [actual, setActual] = useState(false);
  const copy = (node: HTMLCanvasElement | null) => {
    const from = source.current;
    if (!node || !from) return;
    node.width = from.width;
    node.height = from.height;
    node.getContext("2d")?.drawImage(from, 0, 0);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setActual(false);
      }}
    >
      {open ? (
        <DialogContent size="full" className="preview-zoom" title={t("wallpaper_zoom_title")}>
          <div className={actual ? "zoom-stage is-actual" : "zoom-stage"}>
            <canvas ref={copy} role="img" aria-label={t("wallpaper_preview_alt")} data-testid="wallpaper-zoom" onClick={() => setActual((value) => !value)} />
          </div>
          <DialogFooter>
            <span className="field-hint tnum self-center">{sizeLabel}</span>
            <span className="spacer" />
            <Button aria-pressed={actual} onClick={() => setActual((value) => !value)}>
              {actual ? t("wallpaper_zoom_fit") : t("wallpaper_zoom_actual")}
            </Button>
            <Button variant="primary" loading={saving} disabled={!canDownload} onClick={onDownload}>
              <Download size={18} />
              {t("wallpaper_download")}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
