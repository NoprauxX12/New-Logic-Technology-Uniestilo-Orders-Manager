import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CHECKPOINTS, ETIQUETAS_ROL } from "@/features/workflow/checkpoints";

/**
 * HU-17 · Las políticas RLS se derivan de `checkpoints.ts` (regla 4).
 *
 * La base no puede importar TypeScript, así que la función `rol_dueno` de la
 * migración repite el mapa checkpoint → rol en un `case`. Este test lee esa
 * migración y comprueba que diga exactamente lo mismo que la fuente única: si
 * alguien cambia el flujo en un solo lado, esto se pone rojo.
 */

const MIGRACIONES = join(process.cwd(), "supabase", "migrations");

function leerMigracionRls(): string {
  const archivo = readdirSync(MIGRACIONES).find((nombre) =>
    nombre.endsWith("_rls_por_rol.sql"),
  );

  if (!archivo) {
    throw new Error("No existe la migración *_rls_por_rol.sql");
  }

  return readFileSync(join(MIGRACIONES, archivo), "utf8");
}

/** Las parejas `when 'checkpoint' then 'rol'` del `case` de `rol_dueno`. */
function mapaEnSql(sql: string): Record<string, string> {
  const cuerpo = sql.match(
    /function public\.rol_dueno[\s\S]*?case p_checkpoint([\s\S]*?)end/i,
  );

  if (!cuerpo) {
    throw new Error("La migración no define `rol_dueno` con un `case`");
  }

  const mapa: Record<string, string> = {};
  for (const [, checkpoint, rol] of cuerpo[1].matchAll(
    /when\s+'([a-z_]+)'\s+then\s+'([a-z]+)'/g,
  )) {
    mapa[checkpoint] = rol;
  }

  return mapa;
}

describe("rol_dueno (SQL) · igual que checkpoints.ts", () => {
  const sql = leerMigracionRls();
  const mapa = mapaEnSql(sql);

  it("cubre todos los checkpoints de la secuencia", () => {
    expect(Object.keys(mapa).sort()).toEqual(
      CHECKPOINTS.map((checkpoint) => checkpoint.id).sort(),
    );
  });

  it("le asigna a cada checkpoint el mismo rol dueño", () => {
    for (const checkpoint of CHECKPOINTS) {
      expect(mapa[checkpoint.id]).toBe(checkpoint.rolDueno);
    }
  });

  it("solo usa roles que existen en el modelo", () => {
    for (const rol of Object.values(mapa)) {
      expect(Object.keys(ETIQUETAS_ROL)).toContain(rol);
    }
  });
});

describe("migración RLS · sin acceso anónimo", () => {
  const sql = leerMigracionRls();

  it("no crea ninguna política para anon", () => {
    const politicas = [...sql.matchAll(/create policy[\s\S]*?;/gi)].map(
      (coincidencia) => coincidencia[0],
    );

    expect(politicas.length).toBeGreaterThan(0);
    for (const politica of politicas) {
      expect(politica).not.toMatch(/\bto\s+[^;]*\banon\b/i);
    }
  });

  it("quita las políticas temporales de HU-17", () => {
    expect(sql).toMatch(
      /drop policy[^;]*"temporal HU-17: avance alta abierta"/,
    );
  });
});
