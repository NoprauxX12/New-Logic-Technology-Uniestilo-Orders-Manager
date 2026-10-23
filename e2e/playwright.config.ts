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
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    // Plazos cortos: un paso que no ocurre debe fallar en segundos, no al final
    // de un tiempo máximo de minutos.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
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
    // Siempre se prueba lo compilado, que es lo que corre en producción. El modo
    // desarrollo compila cada ruta al visitarla por primera vez y recarga la
    // página en caliente: en una prueba larga eso da carreras intermitentes
    // (un clic que cae en medio de una recarga, una pantalla que tarda en
    // compilarse). Si ya tienes un servidor corriendo en el puerto, se reutiliza.
    command: "npm run build && npm run start",
    url: `${BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    cwd: "..",
  },
});
