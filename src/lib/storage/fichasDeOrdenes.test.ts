import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));

// Firmar es hablar con Storage: aquí solo importa que se le pasen las filas.
const firmarFichas = vi.fn();
vi.mock("@/lib/storage/firmarFichas", () => ({
  firmarFichas: (...args: unknown[]) => firmarFichas(...args),
}));

import { fichasDeOrdenes } from "@/lib/storage/fichasDeOrdenes";

/**
 * Todos los roles ven la ficha técnica de la orden con la que trabajan (HU-04):
 * este es el helper que cada pantalla llama. Debe hacer una sola consulta para
 * toda la lista, agrupar por orden y dejar la más reciente primero.
 */

type Fila = {
  id: string;
  orden_id: string;
  archivo_ruta: string;
  fecha_subida: string;
  usuario: { nombre: string } | null;
};

function clienteCon(resultado: { data: Fila[] | null; error: unknown }) {
  const llamadas: { metodo: string; args: unknown[] }[] = [];
  const consulta = {
    select: (...args: unknown[]) => (
      llamadas.push({ metodo: "select", args }),
      consulta
    ),
    in: (...args: unknown[]) => (
      llamadas.push({ metodo: "in", args }),
      consulta
    ),
    order: (...args: unknown[]) => (
      llamadas.push({ metodo: "order", args }),
      resultado
    ),
  };
  const from = vi.fn(() => consulta);
  return {
    cliente: { from } as unknown as SupabaseClient<Database>,
    from,
    llamadas,
  };
}

const fila = (id: string, ordenId: string, ruta: string): Fila => ({
  id,
  orden_id: ordenId,
  archivo_ruta: ruta,
  fecha_subida: "2026-10-20T10:00:00Z",
  usuario: { nombre: "Andrés Mejía" },
});

beforeEach(() => {
  firmarFichas.mockReset();
  firmarFichas.mockImplementation(async (_cliente, filas: Fila[]) =>
    filas.map((f) => ({
      id: f.id,
      nombre: f.archivo_ruta,
      url: `https://firmada/${f.id}`,
      subidaPor: f.usuario?.nombre ?? "Sin nombre",
      fechaSubida: f.fecha_subida,
    })),
  );
});

describe("fichasDeOrdenes", () => {
  it("sin órdenes no consulta nada", async () => {
    const { cliente, from } = clienteCon({ data: [], error: null });

    const resultado = await fichasDeOrdenes(cliente, []);

    expect(resultado.size).toBe(0);
    expect(from).not.toHaveBeenCalled();
    expect(firmarFichas).not.toHaveBeenCalled();
  });

  it("hace una sola consulta para toda la lista y agrupa las fichas por orden", async () => {
    const { cliente, from, llamadas } = clienteCon({
      data: [
        fila("f1", "orden-A", "a/uno.pdf"),
        fila("f2", "orden-B", "b/dos.pdf"),
        fila("f3", "orden-A", "a/tres.pdf"),
      ],
      error: null,
    });

    const resultado = await fichasDeOrdenes(cliente, ["orden-A", "orden-B"]);

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("ficha_tecnica");
    expect(llamadas.find((l) => l.metodo === "in")?.args).toEqual([
      "orden_id",
      ["orden-A", "orden-B"],
    ]);
    expect(resultado.get("orden-A")?.map((ficha) => ficha.id)).toEqual([
      "f1",
      "f3",
    ]);
    expect(resultado.get("orden-B")?.map((ficha) => ficha.id)).toEqual(["f2"]);
  });

  it("pide la más reciente primero", async () => {
    const { cliente, llamadas } = clienteCon({ data: [], error: null });

    await fichasDeOrdenes(cliente, ["orden-A"]);

    expect(llamadas.find((l) => l.metodo === "order")?.args).toEqual([
      "fecha_subida",
      { ascending: false },
    ]);
  });

  it("una orden sin ficha no aparece en el resultado", async () => {
    const { cliente } = clienteCon({
      data: [fila("f1", "orden-A", "a/uno.pdf")],
      error: null,
    });

    const resultado = await fichasDeOrdenes(cliente, ["orden-A", "orden-sin"]);

    expect(resultado.has("orden-sin")).toBe(false);
  });

  it("si la consulta falla, lo dice en lugar de mostrar la orden sin ficha", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente } = clienteCon({ data: null, error: { message: "boom" } });

    await expect(fichasDeOrdenes(cliente, ["orden-A"])).rejects.toThrow(
      "No se pudieron consultar las fichas técnicas.",
    );

    consola.mockRestore();
  });
});
