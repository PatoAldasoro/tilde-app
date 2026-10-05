import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { normalizeFeedUrl } from "@/lib/domain/calendar-import";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Un calendario con años de historia pesa unos pocos MB. */
const MAX_BYTES = 6_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

const bodySchema = z.object({ url: z.string().min(1).max(2000) });

export type IcalError = "unauthorized" | "invalid_url" | "unreachable" | "too_large" | "not_calendar";

const fail = (error: IcalError, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** Lee el cuerpo hasta MAX_BYTES; null si lo supera. */
async function readLimited(response: Response): Promise<string | null> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/**
 * POST /api/ical { url } → { ics }
 *
 * Descarga un calendario vinculado (la dirección privada .ics de Google Calendar y similares).
 * Los navegadores no pueden pedirla directamente (CORS), así que la trae el servidor. Para que
 * esto no sirva de pasarela hacia cualquier lado: exige sesión, solo acepta los servicios de
 * `normalizeFeedUrl`, valida cada redirección y corta por tamaño y por tiempo. La dirección
 * viaja en el cuerpo (no queda en la URL ni en los registros) y no se guarda nada.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return fail("unauthorized", 401);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return fail("unauthorized", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const first = parsed.success ? normalizeFeedUrl(parsed.data.url) : null;
  if (!first) return fail("invalid_url", 400);
  let url: string = first;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response: Response = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location: string | null = response.headers.get("location");
        const next: string | null = location ? normalizeFeedUrl(new URL(location, url).toString()) : null;
        if (!next) return fail("unreachable", 502);
        url = next;
        continue;
      }
      if (!response.ok) return fail("unreachable", 502);
      const text = await readLimited(response);
      if (text === null) return fail("too_large", 413);
      if (!/^﻿?\s*BEGIN:VCALENDAR/i.test(text)) return fail("not_calendar", 422);
      return NextResponse.json({ ics: text }, { headers: { "Cache-Control": "no-store" } });
    }
    return fail("unreachable", 502);
  } catch {
    return fail("unreachable", 502);
  }
}
