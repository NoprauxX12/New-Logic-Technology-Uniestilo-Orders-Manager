import { defineConfig, devices } from "@playwright/test";

import { exigirEntornoLocal, urlBase } from "@e2e/fixtures/entorno";

/**
 * Pruebas E2E de Uniestilo: un navegador real hace lo que haría una persona.
 *
 * Necesitan Supabase local con el seed (`npx supabase start` y
 * `npx supabase db reset`) y la aplicación. Si ya tienes `npm run dev`
 * corriendo se reutiliza; si no, Playwright lo levanta.
 */

exigirEntornoLocal();

const BASE = urlBase();
const SESION_ADMIN = "e2e/.auth/admin.json";

export default defineConfig({
  testDir: "./flujos",
  outputDir: "../test-results",
  // Comparten una sola base y registran datos: de a una es más estable.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "../playwright-report" }],
  ],
  use: {
    baseURL: BASE,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // Entra una vez como administración y guarda la sesión para los demás.
      name: "preparacion",
      testMatch: /preparacion\.setup\.ts/,
      testDir: "./fixtures",
    },
    {
      name: "escritorio",
      dependencies: ["preparacion"],
      use: { ...devices["Desktop Chrome"], storageState: SESION_ADMIN },
    },
  ],
  webServer: {
    // En CI se prueba lo compilado, que es lo que corre en producción; en local
    // basta el modo desarrollo (y si ya lo tienes corriendo, se reutiliza).
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: `${BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    cwd: "..",
  },
});
