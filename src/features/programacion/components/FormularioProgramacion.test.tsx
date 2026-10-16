import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoProgramacion } from "@/features/programacion/actions";
import { FormularioProgramacion } from "@/features/programacion/components/FormularioProgramacion";
import { ENTRADA_VACIA } from "@/features/programacion/formulario";
import type { OrdenPorProgramar } from "@/features/programacion/queries";

/**
 * HU-03 · El formulario con el que se arma la programación.
 *
 * La action de verdad importa `server-only` y el cliente de Supabase, que no se
 * pueden cargar en jsdom, así que se reemplaza por una función falsa. Lo que se
 * prueba es el comportamiento de la pantalla: que las flechas acomoden la hoja,
 * que se pueda quitar una orden sin desarmar el resto, y que lo que se manda
 * sea la lista en el orden que quedó.
 */

const programarOrdenes = vi.hoisted(() => vi.fn());

vi.mock("@/features/programacion/actions", () => ({
  programarOrdenes,
  ESTADO_INICIAL: {
    ok: false,
    mensaje: "",
    errores: {},
    valores: { ordenes: [] },
  },
}));

const ESTADO_OK: EstadoProgramacion = {
  ok: true,
  mensaje: "Listo: la programación #3 quedó con 2 órdenes.",
  errores: {},
  valores: ENTRADA_VACIA,
};

const COLEGIO = "00000000-0000-0000-0000-0000000000f1";
const FERRETERIA = "00000000-0000-0000-0000-0000000000f8";
const CLINICA = "00000000-0000-0000-0000-0000000000f9";

function orden(
  id: string,
  razonSocial: string,
  referencias: { id: string; descripcion: string; cantidad: number }[],
): OrdenPorProgramar {
  return {
    id,
    numeroOrdenCompra: `OC-${id.slice(-2)}`,
    razonSocial,
    fechaIngreso: "2026-09-28",
    fechaEntrega: "2026-11-02",
    referencias,
    totalPrendas: referencias.reduce((total, r) => total + r.cantidad, 0),
    marcados: [],
  };
}

const ORDENES: OrdenPorProgramar[] = [
  orden(COLEGIO, "Colegio San Ignacio", [
    { id: "i1", descripcion: "Camisas blancas", cantidad: 120 },
    { id: "i2", descripcion: "Pantalones grises", cantidad: 120 },
  ]),
  orden(FERRETERIA, "Ferretería La 33", [
    { id: "i3", descripcion: "Camisa tipo polo", cantidad: 60 },
  ]),
  orden(CLINICA, "Clínica del Norte", [
    { id: "i4", descripcion: "Bata antifluido", cantidad: 40 },
  ]),
];

/** Toca la tarjeta de la izquierda: agrega o quita. */
function alternar(razonSocial: string) {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`${razonSocial} ·`) }),
  );
}

/** Los nombres de las órdenes de la hoja, en el orden en que están. */
function ordenDeLaHoja(): string[] {
  return screen
    .getAllByRole("button", { name: /^Subir / })
    .map((boton) => boton.getAttribute("aria-label")!.replace("Subir ", ""));
}

describe("FormularioProgramacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    programarOrdenes.mockResolvedValue(ESTADO_OK);
  });

  it("muestra las órdenes por programar con sus referencias y su total", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    expect(
      screen.getByRole("button", { name: /Colegio San Ignacio ·/ }),
    ).toHaveTextContent("2 referencias · 240 prendas");
  });

  it("no se puede guardar una programación vacía", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    expect(
      screen.getByRole("button", { name: "Programar a diseño" }),
    ).toBeDisabled();
  });

  it("las órdenes quedan en el orden en que se agregan", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    alternar("Clínica del Norte");
    alternar("Colegio San Ignacio");

    expect(ordenDeLaHoja()).toEqual([
      "Clínica del Norte",
      "Colegio San Ignacio",
    ]);
  });

  it("la flecha de subir acomoda la hoja sin desarmarla", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    alternar("Colegio San Ignacio");
    alternar("Ferretería La 33");
    alternar("Clínica del Norte");

    fireEvent.click(
      screen.getByRole("button", { name: "Subir Clínica del Norte" }),
    );

    expect(ordenDeLaHoja()).toEqual([
      "Colegio San Ignacio",
      "Clínica del Norte",
      "Ferretería La 33",
    ]);
  });

  it("dos toques llevan la última al primer puesto", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    alternar("Colegio San Ignacio");
    alternar("Ferretería La 33");
    alternar("Clínica del Norte");

    fireEvent.click(
      screen.getByRole("button", { name: "Subir Clínica del Norte" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Subir Clínica del Norte" }),
    );

    expect(ordenDeLaHoja()[0]).toBe("Clínica del Norte");
  });

  it("la primera no se puede subir y la última no se puede bajar", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    alternar("Colegio San Ignacio");
    alternar("Ferretería La 33");

    expect(
      screen.getByRole("button", { name: "Subir Colegio San Ignacio" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Bajar Ferretería La 33" }),
    ).toBeDisabled();
  });

  it("quitar una orden no desacomoda las demás", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    alternar("Colegio San Ignacio");
    alternar("Ferretería La 33");
    alternar("Clínica del Norte");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Quitar Ferretería La 33 de la programación",
      }),
    );

    expect(ordenDeLaHoja()).toEqual([
      "Colegio San Ignacio",
      "Clínica del Norte",
    ]);
  });

  it("manda las órdenes en el orden en que quedó la hoja", async () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    alternar("Colegio San Ignacio");
    alternar("Ferretería La 33");

    fireEvent.click(
      screen.getByRole("button", { name: "Subir Ferretería La 33" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Programar a diseño" }));

    await waitFor(() => expect(programarOrdenes).toHaveBeenCalled());

    const formData = programarOrdenes.mock.calls[0][1] as FormData;

    expect(formData.getAll("ordenId")).toEqual([FERRETERIA, COLEGIO]);
  });

  it("no pide escribir ningún número: los pone el sistema", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    alternar("Colegio San Ignacio");

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("pinta el error de la action junto a la orden que lo causó", async () => {
    programarOrdenes.mockResolvedValue({
      ok: false,
      mensaje: "Algunas órdenes de la hoja no se pueden programar todavía.",
      errores: { [COLEGIO]: ["Esta orden ya no existe."] },
      valores: { ordenes: [COLEGIO] },
    } satisfies EstadoProgramacion);

    render(<FormularioProgramacion ordenes={ORDENES} />);

    alternar("Colegio San Ignacio");
    fireEvent.click(screen.getByRole("button", { name: "Programar a diseño" }));

    expect(
      await screen.findByText("Esta orden ya no existe."),
    ).toBeInTheDocument();
  });

  it("no pide escoger quién programa: eso sale de la sesión", () => {
    render(<FormularioProgramacion ordenes={ORDENES} />);

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByLabelText(/quién programa/i)).toBeNull();
  });
});
