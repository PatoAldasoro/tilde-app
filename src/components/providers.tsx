"use client";

import { IsRestoringProvider, QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "@/components/ui/toast";
import { setAccentPreference } from "@/hooks/use-accent";
import { useHydrated } from "@/hooks/use-hydrated";
import { setThemePreference } from "@/hooks/use-theme";
import { toAccent } from "@/lib/accent";
import { minutesInTimeZone, todayInTimeZone, type IsoDate } from "@/lib/domain/dates";
import { persistCache, restoreCache } from "@/lib/offline/cache";
import { outbox, useOutbox } from "@/lib/offline/outbox";
import { registerServiceWorker } from "@/lib/offline/service-worker";
import { prefetchAllTables } from "@/lib/queries/table";
import { getSupabase } from "@/lib/supabase/client";
import type { ProfileRow, Update } from "@/lib/supabase/types";
import { isThemePreference } from "@/lib/theme";

export type SessionUser = { id: string; name: string; email: string; avatarUrl: string | null };

type SessionValue = { user: SessionUser; serverNow: string; serverProfile: ProfileRow };

const SessionContext = createContext<SessionValue | null>(null);

function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession fuera de <AppProviders>");
  return value;
}

export function useSessionUser(): SessionUser {
  return useSession().user;
}

const PROFILE_KEY = ["profiles"];

export function useProfile(): ProfileRow {
  const { serverProfile } = useSession();
  const { data } = useQuery<ProfileRow>({ queryKey: PROFILE_KEY, staleTime: Infinity, queryFn: fetchProfile });
  // Durante la hidratación, el perfil con el que el servidor armó la página; después, el de la caché
  // (que puede traer cambios guardados en el dispositivo todavía sin subir).
  const hydrated = useHydrated();
  return hydrated && data ? data : serverProfile;
}

async function fetchProfile(): Promise<ProfileRow> {
  // Con cambios del perfil sin subir, el servidor todavía tiene el anterior.
  await outbox.whenIdle();
  const { data, error } = await getSupabase().from("profiles").select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

/** Guarda cambios del perfil (idioma, tema, días visibles, anticipación): al instante en pantalla y a la cola de cambios. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutate(patch: Update<"profiles">) {
        queryClient.setQueryData<ProfileRow>(PROFILE_KEY, (profile) => (profile ? { ...profile, ...patch } : profile));
        outbox.enqueue([{ kind: "profile", patch }]);
      },
    }),
    [queryClient],
  );
}

// ---------- reloj: "hoy" y "ahora" en la zona del usuario ----------

function subscribeClock(listener: () => void) {
  const interval = setInterval(listener, 15_000);
  document.addEventListener("visibilitychange", listener);
  window.addEventListener("focus", listener);
  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", listener);
    window.removeEventListener("focus", listener);
  };
}

/** El día de hoy (YYYY-MM-DD) en la zona horaria del perfil. Cambia solo a medianoche. */
export function useToday(): IsoDate {
  const { serverNow } = useSession();
  const timeZone = useProfile().timezone;
  return useSyncExternalStore(
    subscribeClock,
    () => todayInTimeZone(timeZone),
    () => todayInTimeZone(timeZone, new Date(serverNow)),
  );
}

/** Minutos desde la medianoche en la zona del perfil (línea de "ahora" del Horario). */
export function useNowMinutes(): number {
  const { serverNow } = useSession();
  const timeZone = useProfile().timezone;
  return useSyncExternalStore(
    subscribeClock,
    () => minutesInTimeZone(timeZone),
    () => minutesInTimeZone(timeZone, new Date(serverNow)),
  );
}

/** El tema y el color de acento guardados en el perfil mandan sobre los del dispositivo (se aplican al entrar). */
function ProfileThemeSync() {
  const { theme, accent_color: accent } = useProfile();
  useEffect(() => {
    if (isThemePreference(theme)) setThemePreference(theme);
  }, [theme]);
  useEffect(() => {
    setAccentPreference(toAccent(accent));
  }, [accent]);
  return null;
}

/**
 * Lo que hace que la app se pueda usar sin conexión: carga lo guardado en el dispositivo antes de
 * que las pantallas lean datos, lo mantiene al día, sube los cambios pendientes y avisa lo que pasa.
 */
function useOfflineData(queryClient: QueryClient, userId: string, serverNow: string): boolean {
  const t = useTranslations();
  const locale = useLocale();
  const { ready, online } = useOutbox();
  const translate = useRef(t);
  useEffect(() => {
    translate.current = t;
  });

  useEffect(() => {
    restoreCache(queryClient, userId, { profileKey: PROFILE_KEY, serverNow, hasPending: outbox.pendingFor(userId) > 0 });
    const stopPersisting = persistCache(queryClient, userId);
    const stopOutbox = outbox.start(userId, {
      onSettled(tables, info) {
        tables.forEach((name) => void queryClient.invalidateQueries({ queryKey: [name] }));
        // Un solo aviso por tanda (hay un toast a la vez): lo rechazado importa más que lo subido.
        // Lo subido solo se avisa si había quedado esperando (sin conexión o sin respuesta).
        if (info.rejected > 0) toast(translate.current("sync_rejected", { n: info.rejected }));
        else if (info.delayed && info.synced > 0) toast(translate.current("sync_done", { n: info.synced }));
      },
    });
    return () => {
      stopOutbox();
      stopPersisting();
    };
  }, [queryClient, userId, serverNow]);

  // Con conexión, en un rato libre, se traen todas las tablas: así cualquier sección abre sin red.
  useEffect(() => {
    if (!ready || !online) return;
    const timer = setTimeout(() => prefetchAllTables(queryClient), 2500);
    return () => clearTimeout(timer);
  }, [ready, online, queryClient]);

  useEffect(() => registerServiceWorker(locale), [locale]);

  // Avisa una vez al quedarse sin conexión.
  const wasOnline = useRef(true);
  useEffect(() => {
    if (wasOnline.current && !online) toast(translate.current("offline_toast"));
    wasOnline.current = online;
  }, [online]);

  return ready;
}

type AppProvidersProps = { user: SessionUser; profile: ProfileRow; serverNow: string; children: ReactNode };

export function AppProviders({ user, profile, serverNow, children }: AppProvidersProps) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      // gcTime infinito: lo leído queda en memoria (y en la copia del dispositivo) aunque la pantalla que lo usa esté cerrada.
      defaultOptions: { queries: { staleTime: 30_000, gcTime: Infinity, retry: 1, refetchOnWindowFocus: true } },
    });
    client.setQueryData(PROFILE_KEY, profile);
    return client;
  });
  const ready = useOfflineData(queryClient, user.id, serverNow);
  return (
    <QueryClientProvider client={queryClient}>
      {/* Hasta cargar lo guardado en el dispositivo las consultas esperan: si no, pedirían al servidor lo que ya está acá. */}
      <IsRestoringProvider value={!ready}>
        <SessionContext.Provider value={{ user, serverNow, serverProfile: profile }}>
          <ProfileThemeSync />
          {children}
        </SessionContext.Provider>
      </IsRestoringProvider>
    </QueryClientProvider>
  );
}
