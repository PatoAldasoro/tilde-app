"use client";

import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "@/components/ui/toast";
import { setThemePreference } from "@/hooks/use-theme";
import { minutesInTimeZone, todayInTimeZone, type IsoDate } from "@/lib/domain/dates";
import { getSupabase } from "@/lib/supabase/client";
import type { ProfileRow, Update } from "@/lib/supabase/types";
import { isThemePreference } from "@/lib/theme";

export type SessionUser = { id: string; name: string; email: string; avatarUrl: string | null };

type SessionValue = { user: SessionUser; serverNow: string };

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
  const { data } = useQuery<ProfileRow>({ queryKey: PROFILE_KEY, staleTime: Infinity, queryFn: fetchProfile });
  // initialData se carga en AppProviders: siempre hay perfil.
  return data as ProfileRow;
}

async function fetchProfile(): Promise<ProfileRow> {
  const { data, error } = await getSupabase().from("profiles").select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

/** Guarda cambios del perfil (idioma, tema, días visibles, anticipación) con update optimista. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const t = useTranslations();
  return useMutation({
    mutationFn: async (patch: Update<"profiles">) => {
      const current = queryClient.getQueryData<ProfileRow>(PROFILE_KEY);
      const { error } = await getSupabase().from("profiles").update(patch).eq("user_id", current!.user_id);
      if (error) throw new Error(error.message);
    },
    onMutate: async (patch) => {
      const previous = queryClient.getQueryData<ProfileRow>(PROFILE_KEY);
      queryClient.setQueryData<ProfileRow>(PROFILE_KEY, (profile) => (profile ? { ...profile, ...patch } : profile));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(PROFILE_KEY, context.previous);
      toast(t("error_generic"));
    },
  });
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

/** El tema guardado en el perfil manda sobre el del dispositivo (se aplica al entrar). */
function ProfileThemeSync() {
  const theme = useProfile().theme;
  useEffect(() => {
    if (isThemePreference(theme)) setThemePreference(theme);
  }, [theme]);
  return null;
}

type AppProvidersProps = { user: SessionUser; profile: ProfileRow; serverNow: string; children: ReactNode };

export function AppProviders({ user, profile, serverNow, children }: AppProvidersProps) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
    });
    client.setQueryData(PROFILE_KEY, profile);
    return client;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={{ user, serverNow }}>
        <ProfileThemeSync />
        {children}
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}
