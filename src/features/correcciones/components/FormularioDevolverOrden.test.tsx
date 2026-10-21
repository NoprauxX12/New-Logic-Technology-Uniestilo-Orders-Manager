import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { devolverOrden } from "@/features/correcciones/actions";
import { FormularioDevolverOrden } from "@/features/correcciones/components/FormularioDevolverOrden";
import type { CheckpointId } from "@/features/workflow/checkpoints";

/**
 * La action se sustituye: importarla arrastra `server-only`. Aquí se prueba lo
 * que la persona ve y lo que se envía, no la escritura en la base.
 */
vi.mock("@/features/correcciones/actions", () => ({
  devolverOrden: vi.fn(async () => ({
    ok: true,
    mensaje: "Listo",
    errores: {},
    valores: { ordenId: "", checkpoint: "", motivo: "" },
  })),
}));

const ORDEN_ID = "00000000-0000-0000-0000-0000000000f4";
const MARCADOS: CheckpointId[] = [
  "cotizacion_enviada",
  "cotizacion_aprobada",
  "programada_diseno",
  "ficha_adjunta",
  "tela_programada",
  "corte_completado",
  "recogido_bordado",
];

function pintar(marcados: CheckpointId[] = MARCADOS) {
  return render(
    <FormularioDevolverOrden ordenId={ORDEN_ID} marcados={marcados} />,
  );
}

describe("FormularioDevolverOrden", () => {
  it("ofrece solo las etapas que la orden tiene marcadas", () => {
    pintar();

    const opciones = screen
      .getAllByRole("option")
      .map((opcion) => opcion.textContent);

    expect(opciones).toContain("Corte completado");
    expect(opciones).toContain("Recogido y bordado");
    expect(opciones).not.toContain("Llegada a marcación");
  });

  it("no deja devolver hasta elegir la etapa", () => {
    pintar();

    expect(
      screen.getByRole("button", { name: "Devolver la orden" }),
    ).toBeDisabled();
  });

  it("dice con claridad qué etapas quedan devueltas y a quién le toca", () => {
    pintar();

    fireEvent.change(screen.getByLabelText("¿A qué etapa vuelve la orden?"), {
      target: { value: "corte_completado" },
    });

    const resumen = screen.getByTestId("resumen-devolucion");
    expect(resumen).toHaveTextContent(
      "«Corte completado» y «Recogido y bordado»",
    );
    expect(resumen).toHaveTextContent("No se borran");
    expect(resumen).toHaveTextContent("Ahora le toca a Corte");
    expect(
      screen.getByRole("button", { name: "Devolver a «Corte completado»" }),
    ).toBeEnabled();
  });

  it("envía la orden, la etapa y el motivo", async () => {
    pintar();

    fireEvent.change(screen.getByLabelText("¿A qué etapa vuelve la orden?"), {
      target: { value: "tela_programada" },
    });
    fireEvent.change(screen.getByLabelText("¿Por qué se devuelve?"), {
      target: { value: "La tela vino con otro tono" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Devolver a «Tela programada»" }),
    );

    await waitFor(() => expect(devolverOrden).toHaveBeenCalled());
    const datos = vi.mocked(devolverOrden).mock.calls[0][1];
    expect(datos.get("ordenId")).toBe(ORDEN_ID);
    expect(datos.get("checkpoint")).toBe("tela_programada");
    expect(datos.get("motivo")).toBe("La tela vino con otro tono");
    // Quién devuelve sale de la sesión: el formulario no manda ningún usuario.
    expect([...datos.keys()].sort()).toEqual([
      "checkpoint",
      "motivo",
      "ordenId",
    ]);
  });

  it("no pinta nada si la orden no tiene etapas marcadas", () => {
    const { container } = pintar([]);

    expect(container).toBeEmptyDOMElement();
  });
});
