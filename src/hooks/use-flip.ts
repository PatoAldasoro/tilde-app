"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * FLIP: cuando las filas marcadas con data-flip cambian de lugar (reordenar, completar),
 * se deslizan desde donde estaban. Con prefers-reduced-motion no se anima.
 */
export function useFlip(root: RefObject<HTMLElement | null>, enabled = true) {
  const positions = useRef(new Map<string, { top: number; left: number }>());

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, { top: number; left: number }>();
    element.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => {
      const key = node.dataset.flip!;
      const rect = node.getBoundingClientRect();
      const position = { top: rect.top + window.scrollY, left: rect.left + window.scrollX };
      next.set(key, position);
      const previous = positions.current.get(key);
      if (!enabled || reduceMotion || !previous) return;
      const dx = previous.left - position.left;
      const dy = previous.top - position.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: 260,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
    });
    positions.current = next;
  });
}
