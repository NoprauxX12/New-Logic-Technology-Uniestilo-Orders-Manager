import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Desactiva las reglas de estilo que chocan con Prettier. Va de último.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    // Generados por Playwright (npm run test:e2e)
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    // Generado por `npm run db:types`
    "src/types/database.types.ts",
  ]),
]);
