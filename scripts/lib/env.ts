import { existsSync } from "node:fs";

/** Carga .env.local (si existe) para los scripts y tests que corren fuera de Next. */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name} (ver .env.example y docs/SETUP.md).`);
  return value;
}
