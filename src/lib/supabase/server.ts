import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

/**
 * Cliente de Supabase para servidor: Server Components, Server Actions y
 * Route Handlers. Lee y escribe la sesión en las cookies de la petición.
 *
 * Va tipado con `Database`, que se genera desde el esquema con `npm run db:types`:
 * gracias a eso el editor conoce las columnas de cada tabla y los argumentos de
 * cada función.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
