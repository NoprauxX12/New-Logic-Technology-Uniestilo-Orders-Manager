import { loadEnvConfig } from "@next/env";

/**
 * Candado de seguridad de las pruebas E2E.
 *
 * Estas pruebas registran órdenes de verdad y entran con las cuentas del seed
 * (`uniestilo123`, una contraseña pública que solo existe en local). Si alguien
 * las apuntara a producción —con `E2E_BASE_URL`, o dejando en `.env.local` las
 * llaves del proyecto hospedado— llenarían la base real de órdenes de mentira.
 * Por eso se niegan a correr si la aplicación o Supabase no son locales.
 */

const SERVIDORES_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function esLocal(url: string): boolean {
  try {
    return SERVIDORES_LOCALES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** La URL de la aplicación que se va a probar. */
export function urlBase(): string {
  return process.env.E2E_BASE_URL ?? "http://localhost:3000";
}

/** Falla con un mensaje claro si el entorno no es local. */
export function exigirEntornoLocal(): void {
  // Las mismas variables que lee la aplicación: `.env.local` incluido.
  loadEnvConfig(process.cwd());

  const base = urlBase();
  if (!esLocal(base)) {
    throw new Error(
      `E2E: la aplicación a probar (${base}) no es local. Estas pruebas crean datos y solo corren contra localhost.`,
    );
  }

  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!esLocal(supabase)) {
    throw new Error(
      `E2E: NEXT_PUBLIC_SUPABASE_URL (${supabase || "vacía"}) no es local. Levanta Supabase local (npx supabase start) y usa su URL en .env.local.`,
    );
  }
}
