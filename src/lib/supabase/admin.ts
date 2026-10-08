import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Cliente de administración de Supabase. Usa `SUPABASE_SECRET_KEY`, que salta
 * RLS, así que solo existe para lo que no se puede hacer con la sesión de una
 * persona: hoy, crear y borrar cuentas en Supabase Auth (HU-24).
 *
 * Reglas: solo en servidor (`server-only` lo garantiza), nunca para leer ni
 * escribir tablas del dominio —eso va con `@/lib/supabase/server`, que respeta
 * RLS—, y quien lo llame verifica antes que la persona con sesión sea `admin`.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error(
      "Falta SUPABASE_SECRET_KEY o NEXT_PUBLIC_SUPABASE_URL en el servidor. Ver .env.example",
    );
  }

  return createSupabaseClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
