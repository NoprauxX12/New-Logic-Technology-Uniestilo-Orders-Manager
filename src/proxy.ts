import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/**
 * Proxy de Next 16 (lo que antes era middleware). Hoy solo refresca la sesión
 * de Supabase en cada petición. La redirección a /login para usuarios sin
 * sesión se agrega aquí en HU-16.
 */
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    // Todo excepto assets estáticos, imágenes y el health check.
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
