"use client";

import { Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";

type ToastAction = { label: string; onAction: () => void };
type ToastState = { id: number; message: string; action?: ToastAction; duration: number } | null;

/** Duración de los toasts con "Deshacer" (ms). */
export const UNDO_TOAST_MS = 8000;
const DEFAULT_TOAST_MS = 6000;

let current: ToastState = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit(state: ToastState) {
  current = state;
  listeners.forEach((listener) => listener());
}

/** Muestra un toast (uno a la vez, abajo al centro). */
export function toast(message: string, options?: { action?: ToastAction; duration?: number }) {
  emit({
    id: nextId++,
    message,
    action: options?.action,
    duration: options?.duration ?? (options?.action ? UNDO_TOAST_MS : DEFAULT_TOAST_MS),
  });
}

export function dismissToast() {
  emit(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Toaster() {
  const t = useTranslations();
  const state = useSyncExternalStore(subscribe, () => current, () => null);

  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => {
      if (current?.id === state.id) emit(null);
    }, state.duration);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="toast-layer" role="status" aria-live="polite">
      {state ? (
        <div className="toast" key={state.id}>
          <span>{state.message}</span>
          {state.action ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm toast-action"
              onClick={() => {
                const { onAction } = state.action!;
                emit(null);
                onAction();
              }}
            >
              <Undo2 size={16} />
              {state.action.label}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("close")} onClick={() => emit(null)}>
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
