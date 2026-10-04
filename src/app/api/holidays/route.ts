import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import backup2026 from "../../../../data/feriados-2026.json";
import backup2027 from "../../../../data/feriados-2027.json";
import { normalizeHolidays, type Holiday, type RawHoliday } from "@/lib/domain/holidays";

const SOURCE = "https://api.argentinadatos.com/v1/feriados";
const ONE_DAY = 86_400;

/** Respaldo en el repo por si la API falla (ver data/README.md). */
const BACKUPS: Record<number, RawHoliday[]> = { 2026: backup2026, 2027: backup2027 };

const rawSchema = z.array(z.object({ fecha: z.string(), tipo: z.string(), nombre: z.string() }));

export type HolidaysResponse = { year: number; source: "api" | "backup" | "none"; holidays: Holiday[] };

async function fromApi(year: number): Promise<RawHoliday[] | null> {
  try {
    const response = await fetch(`${SOURCE}/${year}`, {
      // Caché del servidor: una consulta por año y por día como mucho.
      next: { revalidate: ONE_DAY },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const parsed = rawSchema.safeParse(await response.json());
    return parsed.success && parsed.data.length > 0 ? parsed.data : null;
  } catch {
    return null;
  }
}

/** GET /api/holidays?year=2026 → feriados nacionales del año (sin puentes). */
export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }

  const live = await fromApi(year);
  const raw = live ?? BACKUPS[year] ?? null;
  const body: HolidaysResponse = {
    year,
    source: live ? "api" : raw ? "backup" : "none",
    holidays: raw ? normalizeHolidays(raw) : [],
  };
  return NextResponse.json(body, {
    headers: {
      // Si respondió el respaldo se reintenta pronto; si no, un día de caché en el CDN.
      "Cache-Control": live
        ? `public, s-maxage=${ONE_DAY}, stale-while-revalidate=${ONE_DAY * 7}`
        : "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
