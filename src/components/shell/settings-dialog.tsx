"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useProfile, useSessionUser, useUpdateProfile } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { localePrefix } from "@/i18n/routing";
import type { Weekday } from "@/lib/domain/dates";
import { getSupabase } from "@/lib/supabase/client";
import { LocaleSegmented, ThemeSegmented } from "./preferences";

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

type SettingsDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** Ajustes: idioma, tema, días visibles del Horario, anticipación de las entregas, menú por borde y cerrar sesión. */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const user = useSessionUser();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const letters = t("wd_letter").split(",");
  const names = t("wd_long").split(",");

  function toggleDay(day: Weekday) {
    const visible = profile.visible_weekdays;
    const next = visible.includes(day) ? visible.filter((d) => d !== day) : [...visible, day].sort((a, b) => a - b);
    if (next.length > 0) updateProfile.mutate({ visible_weekdays: next });
  }

  async function signOut() {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    queryClient.clear();
    window.location.assign(localePrefix(locale) || "/");
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
          <Field label={t("language")}>
            <LocaleSegmented onSaved={(next) => updateProfile.mutate({ locale: next })} />
          </Field>
          <Field label={t("theme")} hint={t("theme_hint")}>
            <ThemeSegmented onSaved={(theme) => updateProfile.mutate({ theme })} />
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
