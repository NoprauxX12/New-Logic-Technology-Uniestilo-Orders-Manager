import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormularioInsumos } from "@/features/insumos/components/FormularioInsumos";

/**
 * HU-23 · El formulario con el que secretaría valida los insumos.
 *
 * La action de verdad importa `server-only` y Supabase, que no cargan en jsdom:
 * se reemplaza por una función falsa. Se prueba lo que ve y manda la pantalla.
 */

const validarInsumos = vi.hoisted(() => vi.fn());

vi.mock("@/features/insumos/actions", () => ({ validarInsumos }));

const ORDEN = "00000000-0000-0000-0000-0000000000f2";

function marcar(nombre: string) {
  fireEvent.click(screen.getByRole("checkbox", { name: nombre }));
}

describe("FormularioInsumos", () => {
  beforeEach(() => {
    validarInsumos.mockReset();
  });

  it("muestra los siete insumos y el botón apagado hasta marcar uno", () => {
    render(<FormularioInsumos ordenId={ORDEN} alValidar={vi.fn()} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: "Marcar insumos validados" }),
    ).toBeDisabled();
  });

  it("al marcar un insumo pide cuánto y cómo, con un ejemplo", () => {
    render(<FormularioInsumos ordenId={ORDEN} alValidar={vi.fn()} />);

    expect(screen.queryByLabelText("Cuánto y cómo: botón")).toBeNull();
    marcar("Botón");

    const detalle = screen.getByLabelText("Cuánto y cómo: botón");
    expect(detalle).toBeRequired();
    expect(detalle).toHaveAttribute(
      "placeholder",
      "Ejemplo: 1.500 botones blancos de 4 huecos",
    );
    expect(
      screen.getByRole("button", { name: "Marcar insumos validados" }),
    ).toBeEnabled();
  });

  it("manda solo lo marcado con su detalle y avisa a la lista al validar", async () => {
    validarInsumos.mockResolvedValue({
      ok: true,
      mensaje: "Insumos validados. La orden ya puede pasar a corte.",
    });
    const alValidar = vi.fn();
    render(<FormularioInsumos ordenId={ORDEN} alValidar={alValidar} />);

    marcar("Hilo");
    marcar("Cierre");
    fireEvent.change(screen.getByLabelText("Cuánto y cómo: hilo"), {
      target: { value: "10 conos" },
    });
    fireEvent.change(screen.getByLabelText("Cuánto y cómo: cierre"), {
      target: { value: "80 cierres" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar insumos validados" }),
    );

    await waitFor(() =>
      expect(alValidar).toHaveBeenCalledWith(
        "Insumos validados. La orden ya puede pasar a corte.",
      ),
    );

    const datos = validarInsumos.mock.calls[0][1] as FormData;
    expect(datos.get("ordenId")).toBe(ORDEN);
    expect(datos.getAll("insumo")).toEqual(["hilo", "cierre"]);
    expect(datos.get("detalle.hilo")).toBe("10 conos");
    expect(datos.get("detalle.cierre")).toBe("80 cierres");
  });

  it("si la action rechaza, muestra el motivo y no avisa a la lista", async () => {
    validarInsumos.mockResolvedValue({
      ok: false,
      mensaje: 'Antes hay que marcar "Tela programada".',
    });
    const alValidar = vi.fn();
    render(<FormularioInsumos ordenId={ORDEN} alValidar={alValidar} />);

    marcar("Hilo");
    fireEvent.change(screen.getByLabelText("Cuánto y cómo: hilo"), {
      target: { value: "10 conos" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar insumos validados" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Antes hay que marcar "Tela programada".',
    );
    expect(alValidar).not.toHaveBeenCalled();
  });
});
