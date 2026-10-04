# Puesta en marcha

Lo único que no se puede automatizar son los pasos con credenciales. Todo es gratis.
Al terminar quedan completas las variables de `.env.local` (local) y de Vercel (producción).

| Variable | De dónde sale | Dónde va |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | La URL pública de la app | local y Vercel |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | local y Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (`anon` / publishable) | local y Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (`service_role`) | **solo local**, para seed, e2e y screenshots |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Cliente OAuth de Google (paso 2) | local y Vercel (solo para el Picker) |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | API key de Google (paso 3) | local y Vercel (solo para el Picker) |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | Número del proyecto de Google Cloud (paso 3) | local y Vercel (solo para el Picker) |

```bash
cp .env.example .env.local   # y completar
npm install
npm run dev
```

## 1. Proyecto de Supabase

1. Crear un proyecto en <https://supabase.com/dashboard> (plan Free). Anotar el **Project ref** (`abcd1234…`).
2. Copiar la URL y la clave `anon` a `.env.local`.
3. Aplicar las migraciones:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   Crea todas las tablas con RLS y el trigger que arma el perfil al registrarse.
4. **Authentication → URL Configuration**
   - Site URL: `https://<tu-app>.vercel.app` (mientras se desarrolla, `http://localhost:3000`).
   - Redirect URLs (una por línea):
     - `http://localhost:3000/auth/callback`
     - `https://<tu-app>.vercel.app/auth/callback`

> En el plan gratuito, Supabase **pausa el proyecto tras una semana sin actividad**. Se reactiva desde el panel
> (botón "Restore project"); los datos no se pierden.

## 2. Cliente OAuth de Google (login)

1. En <https://console.cloud.google.com/> crear un proyecto (o usar uno existente).
2. **APIs y servicios → Pantalla de consentimiento de OAuth**
   - Tipo de usuario: **Externo**. Nombre de la app, correo de asistencia y correo del desarrollador.
   - Permisos (scopes): `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` y, para el Picker,
     `https://www.googleapis.com/auth/drive.file`. **No agregar otros scopes de Drive**: `drive.file` no es
     sensible ni restringido, así que no dispara la verificación pesada de Google.
   - Mientras la app esté en modo "Prueba", agregar las cuentas que van a entrar en **Usuarios de prueba**.
     Para abrirla a cualquiera: **Publicar la app**.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**
   - Orígenes de JavaScript autorizados (los usa el Picker):
     - `http://localhost:3000`
     - `https://<tu-app>.vercel.app`
   - URI de redireccionamiento autorizados (los usa el login, vía Supabase):
     - `https://<project-ref>.supabase.co/auth/v1/callback`
     - `http://127.0.0.1:54321/auth/v1/callback` (solo si se quiere probar el login con el Supabase local)
4. En Supabase: **Authentication → Providers → Google** → habilitar y pegar el **Client ID** y el **Client secret**.
5. Copiar el Client ID a `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (el secret **no** va en la app: solo en Supabase).

Con esto ya funciona "Continuar con Google": la app llama a Supabase, Google vuelve a
`https://<project-ref>.supabase.co/auth/v1/callback` y Supabase redirige a `/auth/callback` de la app.

## 3. Google Picker (agregar documentos desde Drive)

Opcional: sin estas variables, en los documentos de una materia queda solo "Pegar link".

1. **APIs y servicios → Biblioteca** → habilitar **Google Picker API** y **Google Drive API**.
2. **Credenciales → Crear credenciales → Clave de API**. Restringirla:
   - Restricción de aplicación: **Sitios web** → `http://localhost:3000/*` y `https://<tu-app>.vercel.app/*`.
   - Restricción de API: **Google Picker API**.
   - Copiarla a `NEXT_PUBLIC_GOOGLE_API_KEY`.
3. `NEXT_PUBLIC_GOOGLE_APP_ID` es el **número del proyecto** (Panel → Información del proyecto, o la primera
   parte del Client ID antes del guion).

> **Estado:** el Picker está implementado (`src/lib/google-picker.ts`) siguiendo la documentación de Google,
> pero **no se pudo probar de punta a punta** porque necesita estas credenciales. Al cargarlas, verificar:
> que el popup de Google pida solo "ver y administrar los archivos que abras con esta app", que el selector
> se abra sobre el panel de la materia y que los archivos elegidos aparezcan en la lista. "Pegar link" sí está
> cubierto por tests.

Cómo funciona: el token del Picker se pide aparte del login con Google Identity Services
(`google.accounts.oauth2.initTokenClient`, scope `drive.file` únicamente) cada vez que se abre el selector.
No se usa el `provider_token` de Supabase, que no se renueva. Tilde solo guarda la referencia
(nombre, URL, id y tipo), nunca el archivo.

## 4. Vercel

1. Importar el repo en <https://vercel.com/new> (framework: Next.js; sin cambios de build).
2. **Settings → Environment Variables**: cargar las variables `NEXT_PUBLIC_*` de la tabla. **No cargar
   `SUPABASE_SERVICE_ROLE_KEY`.**
3. Tras el primer deploy, volver a los pasos 1.4, 2.3 y 3.2 y reemplazar `<tu-app>.vercel.app` por el dominio real.

> El plan **Hobby de Vercel es solo para uso personal y no comercial**. Si el proyecto se monetiza hay que
> pasar a un plan pago (o a otro hosting).

## 5. Supabase local (tests, seed y screenshots)

Hace falta Docker o Podman.

```bash
# Con Podman (Fedora, etc.):
systemctl --user start podman.socket
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock

npm run db:start                 # levanta Postgres, Auth y la API en 127.0.0.1:54321
npx supabase status -o env       # muestra API_URL, ANON_KEY y SERVICE_ROLE_KEY
```

Copiar esos tres valores a `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`). Después:

```bash
npm run test          # incluye el test de RLS (se saltea si el Supabase local no está)
npm run test:e2e      # Playwright
npm run seed:demo     # cuenta demo con datos de ejemplo
npm run screenshots   # capturas de la landing en public/landing/
```

El login de Google no se puede automatizar: los tests y las capturas crean una sesión con el service role
(`scripts/lib/test-session.ts`). Ese atajo solo existe en scripts, se niega a correr en producción y contra
cualquier Supabase que no sea el local (salvo `TILDE_ALLOW_REMOTE_TEST=1` con un proyecto de test dedicado).

Para probar el login real de Google contra el Supabase local: en `supabase/config.toml` poner
`enabled = true` en `[auth.external.google]`, exportar `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, y reiniciar con `npm run db:stop && npm run db:start`.
