import { describe, expect, it } from "vitest";
import { z } from "zod";

import { adjuntarFichaSchema } from "@/features/fichas/schemas";
import { TAMANO_MAXIMO_FICHA } from "@/lib/storage/fichas";

const ORDEN_ID = "00000000-0000-0000-0000-0000000000f1";

type ErroresPorCampo = Record<string, string[] | undefined>;

function erroresDe(entrada: unknown): ErroresPorCampo {
  const resultado = adjuntarFichaSchema.safeParse(entrada);
  if (resultado.success) return {};
  return z.flattenError(resultado.error).fieldErrors as ErroresPorCampo;
}

function pdf(nombre = "ficha.pdf", contenido = "contenido"): File {
  return new File([contenido], nombre, { type: "application/pdf" });
}

describe("adjuntarFichaSchema", () => {
  it("acepta un PDF con una orden del seed", () => {
    const resultado = adjuntarFichaSchema.safeParse({
      ordenId: ORDEN_ID,
      archivo: pdf(),
    });

    expect(resultado.success).toBe(true);
  });

  it("acepta un JPG", () => {
    const resultado = adjuntarFichaSchema.safeParse({
      ordenId: ORDEN_ID,
      archivo: new File(["x"], "ficha.jpg", { type: "image/jpeg" }),
    });

    expect(resultado.success).toBe(true);
  });

  it("rechaza una orden que no tiene forma de identificador", () => {
    const errores = erroresDe({
      ordenId: "la-ficha",
      archivo: pdf(),
    });

    expect(errores.ordenId).toContain("No se sabe de qué orden es esta ficha");
  });

  it("pide el archivo si no se eligió ninguno", () => {
    const errores = erroresDe({
      ordenId: ORDEN_ID,
      archivo: new File([], "ficha.pdf", { type: "application/pdf" }),
    });

    expect(errores.archivo).toContain("Elige el archivo de la ficha técnica");
  });

  it("acepta un Excel", () => {
    const resultado = adjuntarFichaSchema.safeParse({
      ordenId: ORDEN_ID,
      archivo: new File(["x"], "ficha.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    });

    expect(resultado.success).toBe(true);
  });

  it("acepta un Excel viejo aunque el navegador no mande el tipo", () => {
    const resultado = adjuntarFichaSchema.safeParse({
      ordenId: ORDEN_ID,
      archivo: new File(["x"], "ficha.xls", { type: "" }),
    });

    expect(resultado.success).toBe(true);
  });

  it("rechaza un archivo que no es PDF, JPG, PNG ni Excel", () => {
    const errores = erroresDe({
      ordenId: ORDEN_ID,
      archivo: new File(["x"], "ficha.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    });

    expect(errores.archivo).toContain(
      "La ficha tiene que ser un PDF, un JPG, un PNG o un Excel",
    );
  });

  it("rechaza un archivo más pesado de 10 MB", () => {
    const errores = erroresDe({
      ordenId: ORDEN_ID,
      archivo: new File(
        [new Uint8Array(TAMANO_MAXIMO_FICHA + 1)],
        "ficha.pdf",
        {
          type: "application/pdf",
        },
      ),
    });

    expect(errores.archivo).toContain("La ficha no puede pesar más de 10 MB");
  });

  it("ignora un usuarioId que llegue en el formulario: quién sube sale de la sesión", () => {
    const resultado = adjuntarFichaSchema.safeParse({
      ordenId: ORDEN_ID,
      archivo: pdf(),
      usuarioId: "00000000-0000-0000-0000-0000000000a3",
    });

    expect(resultado.success).toBe(true);
    expect(resultado.success && "usuarioId" in resultado.data).toBe(false);
  });
});
