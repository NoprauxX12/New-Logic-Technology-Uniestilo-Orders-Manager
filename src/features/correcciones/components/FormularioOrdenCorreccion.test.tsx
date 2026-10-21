import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { crearOrdenDeCorreccion } from "@/features/correcciones/actions";
import { FormularioOrdenCorreccion } from "@/features/correcciones/components/FormularioOrdenCorreccion";

vi.mock("@/features/correcciones/actions", () => ({
  crearOrdenDeCorreccion: vi.fn(async () => ({
    ok: false,
    mensaje: "",
    errores: {},
    valores: {
      ordenOriginalId: "",
      fechaEntrega: "",
      motivo: "",
      etapaInicial: "corte_completado",
      items: [],
    },
  })),
}));

const CAMISAS = "00000000-0000-0000-0000-0000000001aa";
const PANTALONES = "00000000-0000-0000-0000-0000000001bb";

const ORDEN = {
  id: "00000000-0000-0000-0000-0000000000f7",
  numeroOrdenCompra: "OC-5007",
  correccionesCreadas: 1,
  numerosOcupados: ["OC-5007-C1"],
  prendas: [
    {
      id: CAMISAS,
      descripcion: "Camisas escolares",
      cantidad: 450,
      tallas: "S:450",
    },
    {
      id: PANTALONES,
      descripcion: "Pantalones",
      cantidad: 20,
      tallas: "32:20",
    },
  ],
};

function pintar() {
  return render(<FormularioOrdenCorreccion orden={ORDEN} hoy="2026-10-21" />);
}

describe("FormularioOrdenCorreccion", () => {
  it("anuncia el número que va a tener la corrección", () => {
    pintar();

    expect(
      screen.getByRole("button", { name: "Crear OC-5007-C2" }),
    ).toBeEnabled();
  });

  it("pide cantidad y tallas solo de las prendas que se marcan", () => {
    pintar();

    expect(screen.queryByLabelText("¿Cuántas salieron mal?")).toBeNull();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Camisas escolares/ }),
    );

    expect(screen.getByLabelText("¿Cuántas salieron mal?")).toBeInTheDocument();
    expect(screen.getByLabelText("¿De qué tallas?")).toBeInTheDocument();
    expect(screen.getAllByLabelText("¿Cuántas salieron mal?")).toHaveLength(1);
  });

  it("entra por el corte por defecto y ofrece solo etapas hasta el despacho", () => {
    pintar();

    const etapa = screen.getByLabelText("¿Por qué etapa entra?");
    expect(etapa).toHaveValue("corte_completado");

    const opciones = [...etapa.querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    expect(opciones).toContain("Lista para despachar");
    expect(opciones).not.toContain("Orden cerrada");
    expect(opciones).not.toContain("Factura generada");
  });

  it("la fecha de entrega no deja escoger días anteriores a hoy", () => {
    pintar();

    expect(screen.getByLabelText("¿Para cuándo se entrega?")).toHaveAttribute(
      "min",
      "2026-10-21",
    );
  });

  it("envía las prendas marcadas con su cantidad y sus tallas, y ningún usuario", async () => {
    pintar();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Camisas escolares/ }),
    );
    fireEvent.change(screen.getByLabelText("¿Cuántas salieron mal?"), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText("¿De qué tallas?"), {
      target: { value: "S:8, M:4" },
    });
    fireEvent.change(screen.getByLabelText("¿Qué defecto tienen?"), {
      target: { value: "Costura abierta" },
    });
    fireEvent.change(screen.getByLabelText("¿Para cuándo se entrega?"), {
      target: { value: "2026-11-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear OC-5007-C2" }));

    await waitFor(() => expect(crearOrdenDeCorreccion).toHaveBeenCalled());
    const datos = vi.mocked(crearOrdenDeCorreccion).mock.calls[0][1];

    expect(datos.get("ordenOriginalId")).toBe(ORDEN.id);
    expect(datos.getAll("incluir")).toEqual([CAMISAS]);
    expect(datos.get(`cantidad.${CAMISAS}`)).toBe("12");
    expect(datos.get(`tallas.${CAMISAS}`)).toBe("S:8, M:4");
    expect(datos.get("etapaInicial")).toBe("corte_completado");
    expect(datos.get("fechaEntrega")).toBe("2026-11-05");
    expect(datos.get("motivo")).toBe("Costura abierta");
    expect([...datos.keys()]).not.toContain("usuarioId");
  });
});
