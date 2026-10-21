import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetalleOrdenView } from "@/features/tablero/components/DetalleOrdenView";
import type { DetalleOrden, EtapaTablero } from "@/lib/ordenes/types";
import { CHECKPOINTS, type Checkpoint } from "@/features/workflow/checkpoints";

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
  anulados: [],
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
    estadoTalleres: "Todavía no ha salido a ningún taller.",
    lotesEnTaller: 0,
    tieneFicha: false,
    etapaInicial: null,
    ordenOriginal: null,
    correcciones: [],
    devoluciones: [],
    semaforo: "a_tiempo",
    etapas: ETAPAS_PENDIENTES,
    etapasCompletadas: 0,
    etapasTotales: ETAPAS_PENDIENTES.length,
    avances: [],
    fichas: [],
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
    const sinRuta = (CHECKPOINTS as readonly Checkpoint[]).filter(
      (c) => c.ruta === null,
    );
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

  it("muestra el enlace a la ficha técnica cuando hay archivo", () => {
    render(
      <DetalleOrdenView
        orden={{
          ...ordenDePrueba(),
          tieneFicha: true,
          fichas: [
            {
              id: "ficha-1",
              nombre: "ficha-polo-verde.pdf",
              url: "https://example.com/ficha.pdf",
              subidaPor: "Camila Diseño",
              fechaSubida: "2026-09-01T10:00:00Z",
            },
          ],
        }}
      />,
    );

    const enlace = screen.getByRole("link", {
      name: /ver ficha-polo-verde\.pdf/i,
    });
    expect(enlace).toHaveAttribute("href", "https://example.com/ficha.pdf");
    expect(screen.getByText(/Camila Diseño/)).toBeInTheDocument();
  });

  it("avisa cuando la orden todavía no tiene ficha técnica", () => {
    render(<DetalleOrdenView orden={ordenDePrueba()} />);

    expect(
      screen.getByText(/todavía no hay ficha técnica/i),
    ).toBeInTheDocument();
  });

  it("distingue las etapas de otros sprints de las que están pendientes", () => {
    const sinPantalla = CHECKPOINTS.filter((c) => !c.disponible);
    if (sinPantalla.length === 0) return;

    render(<DetalleOrdenView orden={ordenDePrueba()} />);

    expect(screen.getAllByText("Todavía no disponible")).toHaveLength(
      sinPantalla.length,
    );
  });

  it("dice quién reportó la etapa con el rol que la marca", () => {
    const orden = ordenDePrueba();
    orden.etapas = orden.etapas.map((etapa) =>
      etapa.seccion === "cotizacion_aprobada"
        ? {
            ...etapa,
            estado: "completada" as const,
            avance: {
              seccion: etapa.seccion,
              usuarioId: "u1",
              usuarioNombre: "Paula Henao",
              fechaHora: "2026-09-01T15:00:00Z",
            },
          }
        : etapa,
    );

    render(<DetalleOrdenView orden={orden} />);

    expect(screen.getByText(/Paula Henao \(Secretaría\)/)).toBeInTheDocument();
  });
});

describe("DetalleOrdenView · devoluciones y correcciones (HU-18)", () => {
  const devolucion = {
    id: "d1",
    destino: "corte_completado" as const,
    motivo: "El corte salió con la manga corta",
    porNombre: "Diana Restrepo",
    fechaHora: "2026-10-13T15:00:00Z",
  };

  function ordenDevuelta(): DetalleOrden {
    const base = ordenDePrueba();
    return {
      ...base,
      devoluciones: [devolucion],
      etapas: base.etapas.map((etapa) =>
        etapa.seccion === "corte_completado"
          ? {
              ...etapa,
              anulados: [
                {
                  seccion: "corte_completado" as const,
                  usuarioId: "u4",
                  usuarioNombre: "Jorge Cardona",
                  fechaHora: "2026-10-10T10:00:00Z",
                  devolucionId: "d1",
                },
              ],
            }
          : etapa,
      ),
    };
  }

  it("la etapa devuelta se ve como 'Devuelta' con el motivo, quién y cuándo", () => {
    render(<DetalleOrdenView orden={ordenDevuelta()} />);

    expect(screen.getByText("Devuelta")).toBeInTheDocument();
    expect(
      screen.getAllByText(/El corte salió con la manga corta/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Diana Restrepo/).length).toBeGreaterThan(0);
    // La bitácora original sigue visible: quién la había marcado.
    expect(screen.getByText(/Jorge Cardona \(Corte\)/)).toBeInTheDocument();
  });

  it("lista las devoluciones de la orden antes de la línea de tiempo", () => {
    render(<DetalleOrdenView orden={ordenDevuelta()} />);

    expect(
      screen.getByRole("heading", { name: "Devoluciones" }),
    ).toBeInTheDocument();
  });

  it("una orden sin devoluciones no muestra ese bloque", () => {
    render(<DetalleOrdenView orden={ordenDePrueba()} />);

    expect(screen.queryByRole("heading", { name: "Devoluciones" })).toBeNull();
  });

  it("la corrección enlaza a su original, y la original a sus correcciones", () => {
    const { rerender } = render(
      <DetalleOrdenView
        orden={{
          ...ordenDePrueba(),
          etapaInicial: "corte_completado",
          ordenOriginal: { id: "f7", numeroOrdenCompra: "OC-5007" },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "OC-5007" })).toHaveAttribute(
      "href",
      "/tablero/f7",
    );
    expect(
      screen.getByText(/entra por «Corte completado»/),
    ).toBeInTheDocument();

    rerender(
      <DetalleOrdenView
        orden={{
          ...ordenDePrueba(),
          correcciones: [{ id: "fb", numeroOrdenCompra: "OC-5007-C1" }],
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "OC-5007-C1" })).toHaveAttribute(
      "href",
      "/tablero/fb",
    );
  });

  it("monta lo que administración puede hacer ante un defecto", () => {
    render(
      <DetalleOrdenView
        orden={ordenDePrueba()}
        correccion={<p>Devolver la orden a una etapa</p>}
      />,
    );

    expect(
      screen.getByText("Devolver la orden a una etapa"),
    ).toBeInTheDocument();
  });
});
