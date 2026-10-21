import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ETAPAS_DE_ENTRADA } from "@/features/correcciones/reglas";
import { validarCierre, validarReporte } from "@/features/documentos/reglas";
import { puedeProgramar } from "@/features/programacion/reglas";
import {
  buscarCheckpoint,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import {
  puedeMarcar,
  siguienteCheckpoint,
} from "@/features/workflow/transiciones";

/**
 * HU-18 · Una orden de corrección nace SIN avances y entra por su etapa
 * inicial. Estos tests la recorren etapa por etapa como lo haría cada sección,
 * con las reglas de la base que el motor no ve (prerrequisitos en SQL), para
 * comprobar que desde cada etapa de entrada ofrecida se llega al cierre.
 */

type Resultado = { termina: true } | { termina: false; atascadaEn: string };

/**
 * Lo que la base exige además del motor:
 * - `programar_tela` pide la ficha técnica vigente.
 * - Un lote solo se despacha con el recogido y bordado vigente, y la llegada a
 *   marcación pide un lote recibido: sin recogido no hay recepción posible.
 */
function recorrer(entrada: CheckpointId): Resultado {
  const marcados: CheckpointId[] = [];

  for (let paso = 0; paso < 20; paso += 1) {
    const siguiente = siguienteCheckpoint(marcados, entrada);
    if (siguiente === null) return { termina: true };

    if (
      siguiente === "tela_programada" &&
      !marcados.includes("ficha_adjunta")
    ) {
      return { termina: false, atascadaEn: siguiente };
    }

    const veredicto =
      siguiente === "programada_diseno"
        ? puedeProgramar(marcados, "secretaria", entrada)
        : puedeMarcar({
            checkpoint: siguiente,
            marcados,
            rol: buscarCheckpoint(siguiente).rolDueno,
            etapaInicial: entrada,
            recepcionConfirmada: marcados.includes("recogido_bordado"),
          });

    if (!veredicto.permitido) {
      return { termina: false, atascadaEn: siguiente };
    }

    marcados.push(siguiente);
  }

  return { termina: false, atascadaEn: "demasiados pasos" };
}

describe("recorrido de una orden de corrección sin avances", () => {
  it.each(ETAPAS_DE_ENTRADA)(
    "entrando por %s, cada sección puede marcar lo suyo hasta cerrar",
    (entrada) => {
      expect(recorrer(entrada)).toEqual({ termina: true });
    },
  );

  it.each(["tela_programada", "llegada_marcacion"] as const)(
    "entrando por %s la orden quedaría atascada (por eso no se ofrece)",
    (entrada) => {
      expect(recorrer(entrada)).toMatchObject({ termina: false });
      expect(ETAPAS_DE_ENTRADA).not.toContain(entrada);
    },
  );

  it.each(ETAPAS_DE_ENTRADA)(
    "la primera acción de la pantalla de %s funciona con la etapa inicial",
    (entrada) => {
      const rol = buscarCheckpoint(entrada).rolDueno;
      const veredicto =
        entrada === "programada_diseno"
          ? puedeProgramar([], rol, entrada)
          : puedeMarcar({
              checkpoint: entrada,
              marcados: [],
              rol,
              etapaInicial: entrada,
            });

      expect(veredicto).toEqual({ permitido: true });
    },
  );

  it.each(ETAPAS_DE_ENTRADA.filter((etapa) => etapa !== "cotizacion_enviada"))(
    "sin pasar la etapa inicial, la acción de %s se rechazaba",
    (entrada) => {
      // Es el fallo que había: las actions no la pasaban al motor.
      const rol = buscarCheckpoint(entrada).rolDueno;
      const veredicto =
        entrada === "programada_diseno"
          ? puedeProgramar([], rol)
          : puedeMarcar({ checkpoint: entrada, marcados: [], rol });

      expect(veredicto).toMatchObject({
        permitido: false,
        mensaje: 'Antes hay que marcar "Cotización enviada".',
      });
    },
  );

  it("una corrección que entra después de la programación no aparece para programar", () => {
    expect(puedeProgramar([], "secretaria", "ficha_adjunta")).toMatchObject({
      permitido: false,
    });
  });

  it("el cierre parte de 'lista para despachar': no depende de la etapa inicial", () => {
    const hastaLista: CheckpointId[] = ["lista_despacho"];

    expect(
      validarReporte({
        ordenExiste: true,
        marcados: hastaLista,
        reporte: "etiquetas",
        rol: "secretaria",
      }),
    ).toEqual({ permitido: true });
    expect(
      validarCierre({
        ordenExiste: true,
        marcados: hastaLista,
        rol: "secretaria",
      }),
    ).toMatchObject({ permitido: false });
  });
});

describe("las etapas de entrada coinciden con la base", () => {
  it("la restricción y la función SQL listan exactamente las mismas etapas", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261021100100_orden_de_correccion.sql",
      ),
      "utf8",
    );

    const listas = [...sql.matchAll(/in\s*\(\s*((?:'[a-z_]+',?\s*)+)\)/g)].map(
      (coincidencia) =>
        [...coincidencia[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]),
    );

    expect(listas).toHaveLength(2);
    for (const lista of listas) {
      expect([...lista].sort()).toEqual([...ETAPAS_DE_ENTRADA].sort());
    }
  });
});
