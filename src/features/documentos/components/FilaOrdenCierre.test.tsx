import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/documentos/actions", () => ({
  reportarParteDelCierre: vi.fn(),
  reportarFactura: vi.fn(),
  cerrarOrden: vi.fn(),
}));

import {
  FilaOrdenCierre,
  type OrdenEnCierre,
} from "@/features/documentos/components/FilaOrdenCierre";

/**
 * Secretaría cierra la orden con la ficha técnica a la mano: de qué orden se
 * trata es lo que le da contexto a las etiquetas y a los documentos de despacho.
 */

const orden = (cambios: Partial<OrdenEnCierre> = {}): OrdenEnCierre => ({
  id: "orden-1",
  numeroOrdenCompra: "OC-9001",
  razonSocial: "Clínica del Norte",
  fechaEntrega: "2026-11-01",
  numeroFactura: null,
  marcados: [],
  fichas: [],
  ...cambios,
});

describe("FilaOrdenCierre · ficha técnica", () => {
  it("muestra la ficha de la orden para abrirla", () => {
    render(
      <ul>
        <FilaOrdenCierre
          orden={orden({
            fichas: [
              {
                id: "f1",
                nombre: "ficha-quirurgicos.pdf",
                url: "https://firmada/f1",
                subidaPor: "Andrés Mejía",
                fechaSubida: "2026-10-20T10:00:00Z",
              },
            ],
          })}
        />
      </ul>,
    );

    expect(
      screen.getByRole("link", { name: /ficha-quirurgicos\.pdf/ }),
    ).toHaveAttribute("href", "https://firmada/f1");
  });

  it("si la orden no tiene ficha lo dice, en vez de dejar el espacio vacío", () => {
    render(
      <ul>
        <FilaOrdenCierre orden={orden()} />
      </ul>,
    );

    expect(
      screen.getByText("Todavía no hay ficha técnica en esta orden."),
    ).toBeInTheDocument();
  });
});
