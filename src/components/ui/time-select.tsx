"use client";

import type { ComponentProps } from "react";
import { timeOptions } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

type TimeSelectProps = Omit<ComponentProps<"select">, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** Límites en minutos desde la medianoche. */
  from: number;
  to: number;
  step?: number;
};

/** Selector de hora propio: siempre 24 h, sin depender del formato del sistema operativo. */
export function TimeSelect({ value, onChange, from, to, step = 30, className, ...props }: TimeSelectProps) {
  const options = timeOptions(from, to, step);
  return (
    <select className={cn("select tnum", className)} value={value} onChange={(event) => onChange(event.target.value)} {...props}>
      {options.includes(value) ? null : <option value={value}>{value}</option>}
      {options.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}
