import type { NextConfig } from "next";

import { version } from "./package.json";

/**
 * Cabeceras de seguridad para toda respuesta. Son las que no dependen de la
 * aplicación: que nadie meta el sistema en un iframe de otro sitio, que el
 * navegador no adivine tipos de archivo, y que no se filtre la URL al salir.
 *
 * No hay Content-Security-Policy todavía: Next inyecta scripts en línea y una
 * CSP útil exige nonces por petición. Queda como pendiente en CLAUDE.md.
 */
const CABECERAS_DE_SEGURIDAD = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // La versión de package.json, para el pie del login.
  env: { NEXT_PUBLIC_VERSION: version },
  async headers() {
    return [{ source: "/(.*)", headers: CABECERAS_DE_SEGURIDAD }];
  },
};

export default nextConfig;
