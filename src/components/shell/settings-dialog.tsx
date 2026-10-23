"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useProfile, useSessionUser, useUpdateProfile } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { setAccentPreference, useAccentPreference } from "@/hooks/use-accent";
import { Link } from "@/i18n/navigation";
import { localePrefix } from "@/i18n/routing";
import type { Weekday } from "@/lib/domain/dates";
import { clearCache } from "@/lib/offline/cache";
import { outbox } from "@/lib/offline/outbox";
import { purgeSavedPages } from "@/lib/offline/service-worker";
import { getSupabase } from "@/lib/supabase/client";
import { AccentSwatches } from "./accent-swatches";
import { LocaleSelect, ThemeSegmented } from "./preferences";

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

type SettingsDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** Ajustes: idioma, tema, color de acento, días visibles del Horario, anticipación de las entregas, menú por borde, cerrar sesión y borrar la cuenta. */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const user = useSessionUser();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const accent = useAccentPreference();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const letters = t("wd_letter").split(",");
  const names = t("wd_long").split(",");

  function toggleDay(day: Weekday) {
    const visible = profile.visible_weekdays;
    const next = visible.includes(day) ? visible.filter((d) => d !== day) : [...visible, day].sort((a, b) => a - b);
    if (next.length > 0) updateProfile.mutate({ visible_weekdays: next });
  }

  async function signOut() {
    const pending = outbox.getSnapshot().pending;
    if (pending > 0) {
      const ok = await confirm({
        title: t("signout_pending_q"),
        body: t("signout_pending_body", { n: pending }),
        confirmLabel: t("signout_anyway"),
        danger: true,
      });
      if (!ok) return;
    }
    setSigningOut(true);
    // Sin conexión no se puede avisar al servidor: igual se cierra la sesión de este dispositivo.
    await getSupabase().auth.signOut({ scope: navigator.onLine ? "global" : "local" }).catch(() => undefined);
    await leave();
  }

  /** Borra la cuenta en el servidor (y con ella todos sus datos) y después todo lo del dispositivo. */
  async function deleteAccount() {
    if (!navigator.onLine) return toast(t("delete_account_offline"));
    const ok = await confirm({
      title: t("delete_account_q"),
      body: t("delete_account_body"),
      confirmLabel: t("delete_account_confirm"),
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    const { error } = await getSupabase().rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      return toast(t("delete_account_error"));
    }
    // El usuario ya no existe: alcanza con olvidar la sesión en este dispositivo.
    await getSupabase().auth.signOut({ scope: "local" }).catch(() => undefined);
    await leave("?deleted=1");
  }

  /** Nada de esta cuenta queda guardado en el dispositivo; vuelve a la landing. */
  async function leave(query = "") {
    outbox.clear();
    clearCache(user.id);
    await purgeSavedPages();
    queryClient.clear();
    window.location.assign((localePrefix(locale) || "/") + query);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("settings")}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("menu-btn")?.focus();
        }}
      >
        <DialogBody>
          <Field label={t("language")} htmlFor="settings-language">
            <LocaleSelect id="settings-language" onSaved={(next) => updateProfile.mutate({ locale: next })} />
          </Field>
          <Field label={t("theme")}>
            <ThemeSegmented className="seg-fill" onSaved={(theme) => updateProfile.mutate({ theme })} />
          </Field>
          <Field label={t("accent_color")} labelId="settings-accent">
            <AccentSwatches
              value={accent}
              labelledBy="settings-accent"
              onChange={(next) => {
                setAccentPreference(next);
                updateProfile.mutate({ accent_color: next });
              }}
            />
          </Field>
          <Field label={t("visible_days")} hint={t("visible_days_hint")}>
            <div className="daychips" role="group" aria-label={t("visible_days")}>
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className="daychip"
                  aria-pressed={profile.visible_weekdays.includes(day)}
                  aria-label={names[day - 1]}
                  onClick={() => toggleDay(day)}
                >
                  {letters[day - 1]}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("default_lead")} htmlFor="settings-lead" hint={t("default_lead_hint")}>
            <div className="lead-row">
              <input
                id="settings-lead"
                className="input input-number tnum"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                key={profile.default_task_lead_days}
                defaultValue={profile.default_task_lead_days}
                onBlur={(event) => {
                  const value = Math.max(0, Math.min(30, Math.trunc(Number(event.target.value)) || 0));
                  event.target.value = String(value);
                  if (value !== profile.default_task_lead_days) updateProfile.mutate({ default_task_lead_days: value });
                }}
              />
              <span>{t("default_lead_suffix")}</span>
            </div>
          </Field>
          <Field label={t("menu")} hint={t("edge_menu_hint")}>
            <Switch checked={profile.edge_menu} onChange={(value) => updateProfile.mutate({ edge_menu: value })}>
              {t("edge_menu")}
            </Switch>
          </Field>
          <div className="menu-sep" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{user.email}</div>
              <div className="field-hint">{t("signed_in_google")}</div>
            </div>
            <Button variant="danger-ghost" loading={signingOut} onClick={signOut}>
              <LogOut size={18} />
              {t("sign_out")}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{t("delete_account")}</div>
              <div className="field-hint">{t("delete_account_hint")}</div>
            </div>
            <Button variant="danger-ghost" loading={deleting} onClick={deleteAccount}>
              <Trash2 size={18} />
              {t("delete_account")}
            </Button>
          </div>
          <nav className="foot-links settings-links" aria-label={t("footer_nav")}>
            <Link href="/privacy">{t("footer_privacy")}</Link>
            <Link href="/terms">{t("footer_terms")}</Link>
          </nav>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
