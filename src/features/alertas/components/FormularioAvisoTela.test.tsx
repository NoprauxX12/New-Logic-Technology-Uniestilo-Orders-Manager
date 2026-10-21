import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoFormularioAviso } from "@/features/alertas/actions";
import { FormularioAvisoTela } from "@/features/alertas/components/FormularioAvisoTela";
import { ENTRADA_AVISO_VACIA } from "@/features/alertas/formulario";

/**
 * HU-06 · El formulario del aviso de falta de tela.
 *
 * La action de verdad importa `server-only` y el cliente de Supabase, que no se
 * cargan en jsdom, así que aquí se reemplaza por una función falsa. Se prueba
 * el formulario: que mande lo escrito con la orden oculta, que no pregunte
 * quién avisa ni a quién, y que pinte lo que la action responda.
 */

const avisarFaltaDeTela = vi.hoisted(() => vi.fn());

vi.mock("@/features/alertas/actions", () => ({ avisarFaltaDeTela }));

const ORDEN_ID = "00000000-0000-0000-0000-0000000000f1";

const ESTADO_OK: EstadoFormularioAviso = {
  ok: true,
  mensaje: "Aviso enviado a administración por la orden OC-5001.",
  errores: {},
  valores: ENTRADA_AVISO_VACIA,
};

function escribirYEnviar(detalle: string) {
  fireEvent.change(screen.getByLabelText("¿Qué tela falta?"), {
    target: { value: detalle },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Avisar a administración" }),
  );
}

describe("FormularioAvisoTela", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    avisarFaltaDeTela.mockResolvedValue(ESTADO_OK);
  });

  it("no pregunta quién avisa ni a quién le llega: eso lo decide el sistema", () => {
    render(<FormularioAvisoTela ordenId={ORDEN_ID} />);

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("manda el detalle con la orden en un campo oculto", async () => {
    render(<FormularioAvisoTela ordenId={ORDEN_ID} />);

    escribirYEnviar("Faltan 40 metros de tela impermeable azul");

    await waitFor(() => expect(avisarFaltaDeTela).toHaveBeenCalledTimes(1));

    const [, formData] = avisarFaltaDeTela.mock.calls[0] as [
      EstadoFormularioAviso,
      FormData,
    ];

    expect(formData.get("detalle")).toBe(
      "Faltan 40 metros de tela impermeable azul",
    );
    expect(formData.get("ordenId")).toBe(ORDEN_ID);
    expect(formData.get("destinatarioId")).toBeNull();
  });

  it("confirma el aviso cuando la action responde que sí", async () => {
    render(<FormularioAvisoTela ordenId={ORDEN_ID} />);

    escribirYEnviar("Faltan 40 metros");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Aviso enviado a administración",
    );
  });

  it("pinta el error del detalle debajo del campo y lo enlaza a él", async () => {
    avisarFaltaDeTela.mockResolvedValue({
      ok: false,
      mensaje: "Revisa el campo marcado en rojo.",
      errores: { detalle: ["Escribe qué tela falta y cuánta"] },
      valores: ENTRADA_AVISO_VACIA,
    } satisfies EstadoFormularioAviso);

    render(<FormularioAvisoTela ordenId={ORDEN_ID} />);

    escribirYEnviar("   ");

    expect(
      await screen.findByText("Escribe qué tela falta y cuánta"),
    ).toBeInTheDocument();

    const campo = screen.getByLabelText("¿Qué tela falta?");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription(/Escribe qué tela falta/);
  });

  it("avisa cuando otra persona ya mandó el aviso de esa orden", async () => {
    avisarFaltaDeTela.mockResolvedValue({
      ok: false,
      mensaje: "Otra persona ya avisó que falta tela en esta orden.",
      errores: {},
      valores: ENTRADA_AVISO_VACIA,
    } satisfies EstadoFormularioAviso);

    render(<FormularioAvisoTela ordenId={ORDEN_ID} />);

    escribirYEnviar("Faltan 40 metros");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Otra persona ya avisó",
    );
  });
});
