"use client";

import { useRef } from "react";

/**
 * Los diálogos se abren por estado (sin <Trigger>), así que Radix no sabe a quién devolverle
 * el foco al cerrar. Este hook recuerda el elemento que tenía el foco al abrir y lo restaura.
 */
export function useReturnFocus() {
  const previous = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (previous.current?.isConnected) previous.current.focus();
    },
  };
}
