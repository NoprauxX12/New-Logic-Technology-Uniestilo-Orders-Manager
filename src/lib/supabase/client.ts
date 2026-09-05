import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador. Usar SOLO dentro de componentes
 * marcados con "use client". En servidor, usar `@/lib/supabase/server`.
 *
 * Cuando exista `src/types/database.types.ts`, pasar el genérico:
 * `createBrowserClient<Database>(...)`.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
