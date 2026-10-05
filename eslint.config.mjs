import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import React from "react";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-plugin-react (viene con eslint-config-next) detecta la versión de React con una API
  // que ESLint 10 ya no tiene: se la pasamos resuelta.
  { settings: { react: { version: React.version } } },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "design/**",
    "playwright-report/**",
    "test-results/**",
    "src/lib/supabase/database.types.ts",
  ]),
]);

export default eslintConfig;
