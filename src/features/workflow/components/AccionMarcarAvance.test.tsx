import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buscarCheckpoint,
  CHECKPOINTS,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { AccionMarcarAvance } from "@/features/workflow/components/AccionMarcarAvance";
import { puedeMarcar } from "@/features/workflow/transiciones";

/**
 * Qué ve quien abre una orden, según lo que diga el motor: el criterio 2 de
 * HU-19 hecho pantalla.
 *
 * La action se sustituye porque importarla arrastra `queries.ts`, que lleva
 * `server-only` y revienta fuera del servidor. Aquí no se prueba el envío del
 * formulario —eso es un flujo completo, y va a Playwright—, sino la decisión de
 * qué se pinta.
 *
 * Los veredictos se piden al motor de verdad en vez de escribirlos a mano: así
 * el test comprueba el cableado motor→pantalla y no una copia de las reglas.
 */

vi.mock("@/features/workflow/actions", () => ({
  marcarAvance: vi.fn(),
}));

const SECUENCIA = CHECKPOINTS.map((checkpoint) => checkpoint.id);
const ORDEN_ID = "00000000-0000-0000-0000-0000000000f5";
const { etiqueta, rolDueno } = buscarCheckpoint("lista_despacho");
const ACCION = `Marcar ${etiqueta.toLowerCase()}`;

/** Lo marcado por una orden que recorrió los pasos previos a `hasta`. */
function marcadosAntesDe(hasta: CheckpointId): CheckpointId[] {
  return SECUENCIA.slice(0, SECUENCIA.indexOf(hasta));
}

function pintar(marcados: CheckpointId[], rol = rolDueno) {
  render(
    <AccionMarcarAvance
      ordenId={ORDEN_ID}
      checkpoint="lista_despacho"
      veredicto={puedeMarcar({
        checkpoint: "lista_despacho",
        marcados,
        rol,
      })}
    />,
  );
}

describe("AccionMarcarAvance · qué ve quien abre la orden", () => {
  it("ofrece marcar cuando la orden ya llegó a marcación", () => {
    pintar(marcadosAntesDe("lista_despacho"));

    expect(screen.getByRole("button", { name: ACCION })).toBeEnabled();
  });

  it("no deja marcar mientras falte un paso, y dice cuál falta", () => {
    pintar(marcadosAntesDe("llegada_marcacion"));

    const boton = screen.getByRole("button", { name: ACCION });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(
      new RegExp(buscarCheckpoint("llegada_marcacion").etiqueta),
    );
  });

  it("no deja marcar lo que le toca a otra sección, y dice a quién", () => {
    pintar(marcadosAntesDe("lista_despacho"), "logistica");

    const boton = screen.getByRole("button", { name: ACCION });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/Marcación/);
  });

  it("no ofrece nada cuando la orden ya está lista para despachar", () => {
    pintar([...marcadosAntesDe("lista_despacho"), "lista_despacho"]);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
