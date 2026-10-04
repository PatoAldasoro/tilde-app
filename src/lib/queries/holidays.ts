"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { HolidaysResponse } from "@/app/api/holidays/route";
import type { Holiday } from "@/lib/domain/holidays";

async function fetchHolidays(year: number): Promise<Holiday[]> {
  const response = await fetch(`/api/holidays?year=${year}`);
  if (!response.ok) throw new Error(`holidays ${year}: ${response.status}`);
  return ((await response.json()) as HolidaysResponse).holidays;
}

/** Feriados nacionales de los años pedidos (el visible y sus vecinos). No se guardan en la base. */
export function useHolidays(years: number[]): Holiday[] {
  const results = useQueries({
    queries: years.map((year) => ({
      queryKey: ["holidays", year],
      queryFn: () => fetchHolidays(year),
      staleTime: 12 * 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
    })),
    combine: (queries) => queries.map((query) => query.data),
  });
  return useMemo(() => results.flatMap((holidays) => holidays ?? []), [results]);
}
