import { describe, expect, it } from "vitest";

import { usuarioActual } from "@/features/auth/usuarioActual";
import {
  CHECKPOINTS,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { puedeMarcar } from "@/features/workflow/transiciones";

/**
 * El usuario provisional que marca mientras llega el login (HU-16).
 *
 * Un solo caso, pero es el que avisa: si alguien resuelve el PENDIENTE de
 * `checkpoints.ts` y le cambia el rol dueño a `lista_despacho` —por ejemplo
 * creando el rol "terminación"—, esto se pone rojo señalando el archivo que
 * hay que actualizar, en vez de que HU-19 se rompa en silencio en producción.
 */

const SECUENCIA = CHECKPOINTS.map((checkpoint) => checkpoint.id);

/** Lo que tiene marcado una orden a la que solo le falta salir a despacho. */
function listaParaDespachar(): CheckpointId[] {
  return SECUENCIA.slice(0, SECUENCIA.indexOf("lista_despacho"));
}

describe("usuarioActual · quién marca mientras llega el login", () => {
  it("le devuelve al motor un rol que puede marcar la salida a despacho", async () => {
    const usuario = await usuarioActual();

    const veredicto = puedeMarcar({
      checkpoint: "lista_despacho",
      marcados: listaParaDespachar(),
      rol: usuario.rol,
    });

    expect(veredicto.permitido).toBe(true);
  });

  it("identifica a quien marca, porque el avance no puede quedar sin autor", async () => {
    const usuario = await usuarioActual();

    expect(usuario.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(usuario.nombre.trim()).not.toBe("");
  });
});
