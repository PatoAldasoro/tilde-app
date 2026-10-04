"use client";

import type { ComponentProps } from "react";

type CommitInputProps = Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange"> & {
  value: string;
  /** Se llama al salir del campo (o con Enter) si el texto cambió. Devolver false lo revierte. */
  onCommit: (value: string) => boolean | void;
};

/** Input que guarda al salir del campo: edición en el lugar, sin botón de guardar. */
export function CommitInput({ value, onCommit, onKeyDown, ...props }: CommitInputProps) {
  return (
    <input
      key={value}
      defaultValue={value}
      onBlur={(event) => {
        const next = event.target.value.trim();
        if (next === value) {
          event.target.value = value;
          return;
        }
        if (onCommit(next) === false) event.target.value = value;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape" && event.currentTarget.value !== value) {
          event.stopPropagation();
          event.currentTarget.value = value;
        }
        onKeyDown?.(event);
      }}
      {...props}
    />
  );
}
