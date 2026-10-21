import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";

/**
 * Red de seguridad de HU-18: un avance anulado por una devolución tiene que
 * ser invisible para todo lo que decide algo con los avances de una orden.
 *
 * El filtro se aplica en cada consulta (`.is(AVANCE_VIGENTE, null)`), y es fácil
 * que una consulta nueva lo olvide. Este test recorre `src/` y falla si algún
 * archivo lee `avance_seccion` sin el filtro y sin leer `anulado_por` para
 * separar los anulados a mano (como hace el detalle de la orden).
 */

const RAIZ = join(process.cwd(), "src");

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)
      ? [ruta]
      : [];
  });
}

/** Archivos que leen avances: un `avance_seccion ( … )` anidado en un select. */
const LECTORES = archivos(RAIZ).filter((ruta) => {
  if (ruta.endsWith("database.types.ts")) return false;
  return /avance_seccion\s*\(/.test(readFileSync(ruta, "utf8"));
});

describe("lecturas de avance_seccion", () => {
  it("encuentra las consultas que leen avances (si no, el test no vigila nada)", () => {
    expect(LECTORES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(LECTORES.map((ruta) => [ruta.replace(RAIZ, "src"), ruta]))(
    "%s ignora los avances anulados",
    (_nombre, ruta) => {
      const texto = readFileSync(ruta, "utf8");
      const filtra = texto.includes("AVANCE_VIGENTE");
      const separaAMano = /anulado_por/.test(texto);

      expect(
        filtra || separaAMano,
        "Esta consulta lee avance_seccion sin filtrar los anulados (HU-18): agrega .is(AVANCE_VIGENTE, null)",
      ).toBe(true);
    },
  );

  it("el filtro apunta a la columna que anula", () => {
    expect(AVANCE_VIGENTE).toBe("avance_seccion.anulado_por");
  });
});
