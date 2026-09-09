import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoFormularioDespacho } from "@/features/talleres/actions";
import { FormularioDespacharTaller } from "@/features/talleres/components/FormularioDespacharTaller";
import { ENTRADA_VACIA } from "@/features/talleres/formulario";

/**
 * HU-10 · El formulario de despacho.
 *
 * La action de verdad importa `server-only` y el cliente de Supabase, que no se
 * pueden cargar en jsdom, así que aquí se reemplaza por una función falsa. Lo
 * que se prueba es el formulario en sí: que mande lo que se escribió —incluida
 * la orden, que viaja oculta— y que pinte lo que la action responda.
 */

const despacharLote = vi.hoisted(() => vi.fn());

vi.mock("@/features/talleres/actions", () => ({ despacharLote }));

const ORDEN_ID = "00000000-0000-0000-0000-0000000000f3";
const LOGISTICA_ID = "00000000-0000-0000-0000-0000000000a5";

const PERSONAL = [{ id: LOGISTICA_ID, nombre: "Luis Betancur" }];

const ESTADO_OK: EstadoFormularioDespacho = {
  ok: true,
  mensaje: "Lote despachado a Taller Marinilla Centro.",
  errores: {},
  valores: ENTRADA_VACIA,
};

function llenarYEnviar() {
  fireEvent.change(screen.getByLabelText("¿A qué taller se envió?"), {
    target: { value: "Taller Marinilla Centro" },
  });
  fireEvent.change(screen.getByLabelText("¿Qué prendas se enviaron?"), {
    target: { value: "250 polos verdes" },
  });
  fireEvent.change(screen.getByLabelText("¿Quién hace el despacho?"), {
    target: { value: LOGISTICA_ID },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Marcar como despachado" }),
  );
}

describe("FormularioDespacharTaller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    despacharLote.mockResolvedValue(ESTADO_OK);
  });

  it("ofrece solo al personal de logística para despachar", () => {
    render(
      <FormularioDespacharTaller ordenId={ORDEN_ID} personal={PERSONAL} />,
    );

    expect(
      screen.getByRole("option", { name: "Luis Betancur" }),
    ).toBeInTheDocument();
  });

  it("manda lo que se escribió, con la orden en un campo oculto", async () => {
    render(
      <FormularioDespacharTaller ordenId={ORDEN_ID} personal={PERSONAL} />,
    );

    llenarYEnviar();

    await waitFor(() => expect(despacharLote).toHaveBeenCalledTimes(1));

    const [, formData] = despacharLote.mock.calls[0] as [
      EstadoFormularioDespacho,
      FormData,
    ];

    expect(formData.get("taller")).toBe("Taller Marinilla Centro");
    expect(formData.get("descripcionPrendas")).toBe("250 polos verdes");
    expect(formData.get("enviadoPor")).toBe(LOGISTICA_ID);
    expect(formData.get("ordenId")).toBe(ORDEN_ID);
  });

  it("confirma el despacho cuando la action responde que sí", async () => {
    render(
      <FormularioDespacharTaller ordenId={ORDEN_ID} personal={PERSONAL} />,
    );

    llenarYEnviar();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Lote despachado a Taller Marinilla Centro.",
    );
  });

  it("pinta el error del taller debajo de su campo", async () => {
    despacharLote.mockResolvedValue({
      ok: false,
      mensaje: "Revisa los campos marcados en rojo.",
      errores: { taller: ["Escribe a qué taller se envió el lote"] },
      valores: { ...ENTRADA_VACIA },
    } satisfies EstadoFormularioDespacho);

    render(
      <FormularioDespacharTaller ordenId={ORDEN_ID} personal={PERSONAL} />,
    );

    llenarYEnviar();

    expect(
      await screen.findByText("Escribe a qué taller se envió el lote"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("¿A qué taller se envió?"),
    ).toHaveAccessibleDescription(/Escribe a qué taller/);
  });

  it("avisa cuando la orden todavía no se puede despachar", async () => {
    despacharLote.mockResolvedValue({
      ok: false,
      mensaje: 'Antes hay que marcar "Corte completado".',
      errores: {},
      valores: { ...ENTRADA_VACIA },
    } satisfies EstadoFormularioDespacho);

    render(
      <FormularioDespacharTaller ordenId={ORDEN_ID} personal={PERSONAL} />,
    );

    llenarYEnviar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Corte completado",
    );
  });
});
