"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore, type ReactNode } from "react";
import { Button } from "./button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "./dialog";

type ConfirmOptions = { title: string; body: ReactNode; confirmLabel: string; danger?: boolean };
type ConfirmState = (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;

let current: ConfirmState = null;
const listeners = new Set<() => void>();

function emit(state: ConfirmState) {
  current = state;
  listeners.forEach((listener) => listener());
}

/** Pide confirmación en un diálogo. Resuelve true solo si se confirma. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => emit({ ...options, resolve }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ConfirmHost() {
  const t = useTranslations();
  const state = useSyncExternalStore(subscribe, () => current, () => null);

  function settle(ok: boolean) {
    const pending = current;
    emit(null);
    pending?.resolve(ok);
  }

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && settle(false)}>
      {state ? (
        <DialogContent size="sm" title={state.title} role="alertdialog">
          <DialogBody>
            <p className="muted">{state.body}</p>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => settle(false)}>{t("cancel")}</Button>
            <Button variant={state.danger ? "danger" : "primary"} autoFocus onClick={() => settle(true)}>
              {state.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
