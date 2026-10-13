import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/**
 * Proxy de Next 16 (lo que antes era middleware). En cada petición refresca la
 * sesión de Supabase y, si no hay nadie identificado, manda a `/login` (HU-16).
 *
 * Es solo la primera capa: exige sesión, no rol. Que cada pantalla sea del rol
 * que le toca —corte no puede entrar a `/ordenes/cierre`— es HU-17. `/ordenes/nueva`
 * ya lo hace por su cuenta (verifica el rol en la action) porque esa historia
 * lo pidió antes de que existiera esta.
 */

/** Rutas que se ven sin haber iniciado sesión. */
const RUTAS_PUBLICAS = new Set(["/", "/login"]);

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (!user && !RUTAS_PUBLICAS.has(request.nextUrl.pathname)) {
    const destino = new URL("/login", request.url);
    destino.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }

  return response;
}

export const config = {
  matcher: [
    // Todo excepto assets estáticos, imágenes y el health check.
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
