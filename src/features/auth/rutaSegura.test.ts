import { describe, expect, it } from "vitest";

import { rutaSegura } from "@/features/auth/rutaSegura";

/**
 * HU-16 · Adónde volver después de entrar.
 *
 * El valor llega en la URL (`?next=`) y lo puede escribir cualquiera, así que
 * solo se acepta una ruta interna de esta aplicación. Lo demás vuelve a `/`.
 */

describe("rutaSegura · rutas internas", () => {
  it("acepta una ruta de la aplicación", () => {
    expect(rutaSegura("/ordenes/corte")).toBe("/ordenes/corte");
  });

  it("conserva la query de la ruta", () => {
    expect(rutaSegura("/tablero?orden=1")).toBe("/tablero?orden=1");
  });

  it("vuelve a la portada cuando no viene nada", () => {
    expect(rutaSegura(null)).toBe("/");
    expect(rutaSegura("")).toBe("/");
  });
});

describe("rutaSegura · intentos de sacar a la persona del sitio", () => {
  it("rechaza una URL absoluta", () => {
    expect(rutaSegura("https://otro-sitio.com")).toBe("/");
  });

  it("rechaza una ruta sin barra inicial", () => {
    expect(rutaSegura("otro-sitio.com")).toBe("/");
  });

  it("rechaza las dos barras, que el navegador lee como otro dominio", () => {
    expect(rutaSegura("//otro-sitio.com")).toBe("/");
  });

  it("rechaza la barra invertida, que el navegador normaliza a dos barras", () => {
    expect(rutaSegura("/\\otro-sitio.com")).toBe("/");
    expect(rutaSegura("\\otro-sitio.com")).toBe("/");
  });

  it("rechaza un archivo subido en vez de texto", () => {
    expect(rutaSegura(new File([], "x"))).toBe("/");
  });
});
