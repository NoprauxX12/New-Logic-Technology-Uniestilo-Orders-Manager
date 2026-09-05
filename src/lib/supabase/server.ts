import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para servidor: Server Components, Server Actions y
 * Route Handlers. Lee y escribe la sesión en las cookies de la petición.
 *
 * Cuando exista `src/types/database.types.ts`, pasar el genérico:
 * `createServerClient<Database>(...)`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Un Server Component no puede escribir cookies. No es un error:
            // el proxy (src/proxy.ts) se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
