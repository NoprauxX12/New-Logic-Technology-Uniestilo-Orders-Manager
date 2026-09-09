import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetalleOrdenView } from "@/features/tablero/components/DetalleOrdenView";
import type { DetalleOrden, EtapaTablero } from "@/features/tablero/types";
import { CHECKPOINTS } from "@/features/workflow/checkpoints";

/**
 * La línea de tiempo de una orden ofrece el camino a la pantalla donde se marca
 * cada etapa.
 *
 * El contrato que prueba este archivo es el que le prometimos al equipo: para
 * que aparezca el botón de una etapa basta con ponerle su `ruta` en
 * `checkpoints.ts`, sin tocar este componente. Si alguien cambia la condición
 * del botón, esto se pone rojo.
 */

/** Todas las etapas pendientes, que es el caso donde puede haber botón. */
const ETAPAS_PENDIENTES: EtapaTablero[] = CHECKPOINTS.map((checkpoint) => ({
  seccion: checkpoint.id,
  etiqueta: checkpoint.etiqueta,
  estado: "pendiente",
  avance: null,
}));

function ordenDePrueba(): DetalleOrden {
  return {
    id: "00000000-0000-0000-0000-0000000000f2",
    numeroOrdenCompra: "OC-5002",
    razonSocial: "Colegio San Ignacio",
    prenda: "Chaquetas impermeables azules",
    cantidad: 80,
    fechaRecepcion: "2026-08-20",
    fechaEntrega: "2026-09-21",
    tallerNombre: null,
    semaforo: "a_tiempo",
    etapas: ETAPAS_PENDIENTES,
    etapasCompletadas: 0,
    etapasTotales: ETAPAS_PENDIENTES.length,
    avances: [],
  };
}

describe("DetalleOrdenView · ir a marcar", () => {
  it("enlaza a su pantalla las etapas que ya tienen ruta", () => {
    const conRuta = CHECKPOINTS.filter((c) => c.disponible && c.ruta !== null);
    expect(conRuta.length).toBeGreaterThan(0);

    render(<DetalleOrdenView orden={ordenDePrueba()} />);

    for (const checkpoint of conRuta) {
      const enlace = screen.getByRole("link", {
        name: new RegExp(`Ir a marcar ${checkpoint.etiqueta}`, "i"),
      });

      expect(enlace).toHaveAttribute("href", checkpoint.ruta);
    }
  });

  it("no ofrece botón a las etapas cuya pantalla todavía no existe", () => {
    const sinRuta = CHECKPOINTS.filter((c) => c.ruta === null);
    // Cuando todas tengan pantalla, este caso deja de existir.
    if (sinRuta.length === 0) return;

    render(<DetalleOrdenView orden={ordenDePrueba()} />);

    for (const checkpoint of sinRuta) {
      expect(
        screen.queryByRole("link", {
          name: new RegExp(`Ir a marcar ${checkpoint.etiqueta}`, "i"),
        }),
      ).toBeNull();
    }
  });

  it("distingue las etapas de otros sprints de las que están pendientes", () => {
    const sinPantalla = CHECKPOINTS.filter((c) => !c.disponible);
    if (sinPantalla.length === 0) return;

    render(<DetalleOrdenView orden={ordenDePrueba()} />);

    expect(screen.getAllByText("Todavía no disponible")).toHaveLength(
      sinPantalla.length,
    );
  });
});
