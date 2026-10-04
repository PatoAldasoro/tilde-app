/**
 * Google Picker para "Agregar desde Drive".
 *
 * El token se pide aparte del login, con Google Identity Services (initTokenClient) y solo el
 * scope drive.file: no se usa el provider_token de Supabase, que no se renueva. drive.file da acceso
 * únicamente a los archivos que el usuario elige en el selector, así que no dispara la verificación
 * pesada de Google.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";

/** Sin las tres variables (docs/SETUP.md) el botón no se muestra y queda solo "Pegar link". */
export const isPickerConfigured = CLIENT_ID !== "" && API_KEY !== "" && APP_ID !== "";

export type PickedFile = { id: string; name: string; url: string; mimeType: string | null };

// ---- Tipos mínimos de las dos librerías de Google que se cargan por <script> ----

type TokenResponse = { access_token?: string; expires_in?: string | number; error?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type PickerDocument = { id: string; name: string; url: string; mimeType?: string };
type PickerResponse = { action: string; docs?: PickerDocument[] };
type PickerView = {
  setIncludeFolders: (value: boolean) => PickerView;
  setSelectFolderEnabled: (value: boolean) => PickerView;
  setMode: (mode: unknown) => PickerView;
};
type PickerBuilder = {
  addView: (view: PickerView) => PickerBuilder;
  enableFeature: (feature: unknown) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setLocale: (locale: string) => PickerBuilder;
  setCallback: (callback: (response: PickerResponse) => void) => PickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};
type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type: string }) => void;
      }) => TokenClient;
    };
  };
  picker: {
    DocsView: new (viewId: unknown) => PickerView;
    PickerBuilder: new () => PickerBuilder;
    ViewId: { DOCS: unknown };
    DocsViewMode: { LIST: unknown };
    Feature: { MULTISELECT_ENABLED: unknown };
    Action: { PICKED: string; CANCEL: string };
  };
};
type GapiGlobal = { load: (name: string, options: { callback: () => void; onerror: () => void }) => void };

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: GapiGlobal;
  }
}

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let pending = scripts.get(src);
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scripts.delete(src);
        reject(new Error(`No se pudo cargar ${src}`));
      };
      document.head.appendChild(script);
    });
    scripts.set(src, pending);
  }
  return pending;
}

/** Precarga las librerías para que el popup de Google se abra dentro del gesto del usuario. */
export function preloadPicker() {
  if (!isPickerConfigured) return;
  void loadScript(GIS_SRC).catch(() => undefined);
  void loadScript(GAPI_SRC).catch(() => undefined);
}

let token: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  await loadScript(GIS_SRC);
  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "sin token"));
          return;
        }
        token = { value: response.access_token, expiresAt: Date.now() + Number(response.expires_in ?? 3600) * 1000 };
        resolve(token.value);
      },
      error_callback: (error) => reject(new Error(error.type)),
    });
    // Tras el primer consentimiento, Google renueva el token sin volver a preguntar.
    client.requestAccessToken(token ? { prompt: "" } : undefined);
  });
}

async function loadPickerApi(): Promise<void> {
  await loadScript(GAPI_SRC);
  await new Promise<void>((resolve, reject) => {
    window.gapi!.load("picker", { callback: resolve, onerror: () => reject(new Error("No se pudo cargar el Picker")) });
  });
}

/**
 * Abre el selector de Drive. Devuelve los archivos elegidos, o null si se canceló.
 * Lanza un error si falla la autorización o la carga de las librerías.
 */
export async function pickDriveFiles(locale: string): Promise<PickedFile[] | null> {
  if (!isPickerConfigured) throw new Error("Google Picker sin configurar");
  const accessToken = await getAccessToken();
  await loadPickerApi();
  const { picker } = window.google!;

  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMode(picker.DocsViewMode.LIST);
    new picker.PickerBuilder()
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setLocale(locale)
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED) {
          resolve(
            (response.docs ?? []).map((doc) => ({ id: doc.id, name: doc.name, url: doc.url, mimeType: doc.mimeType ?? null })),
          );
        } else if (response.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build()
      .setVisible(true);
  });
}
