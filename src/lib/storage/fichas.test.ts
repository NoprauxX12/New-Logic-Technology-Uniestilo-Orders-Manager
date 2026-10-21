import { describe, expect, it } from "vitest";

import {
  nombreDeRuta,
  nombreSeguro,
  objetoDeRuta,
  rutaDeArchivo,
} from "@/lib/storage/fichas";

describe("objetoDeRuta", () => {
  it("quita el prefijo del bucket que dejó el seed viejo", () => {
    expect(
      objetoDeRuta("fichas/00000000-0000-0000-0000-0000000000f3/ficha.pdf"),
    ).toBe("00000000-0000-0000-0000-0000000000f3/ficha.pdf");
  });

  it("deja igual una ruta nueva, que ya es el objeto dentro del bucket", () => {
    expect(objetoDeRuta("00000000-0000-0000-0000-0000000000f3/ficha.pdf")).toBe(
      "00000000-0000-0000-0000-0000000000f3/ficha.pdf",
    );
  });
});

describe("nombreDeRuta", () => {
  it("enseña solo el archivo, sin la carpeta de la orden", () => {
    expect(
      nombreDeRuta("00000000-0000-0000-0000-0000000000f3/ficha-polo-verde.pdf"),
    ).toBe("ficha-polo-verde.pdf");
  });
});

describe("nombreSeguro", () => {
  it("quita tildes y espacios para que la ruta no se rompa", () => {
    expect(nombreSeguro("Ficha técnica polo.pdf")).toBe(
      "Ficha-tecnica-polo.pdf",
    );
  });

  it("no deja un nombre vacío si solo había caracteres raros", () => {
    expect(nombreSeguro("???")).toBe("ficha");
  });
});

describe("rutaDeArchivo", () => {
  it("guarda el archivo bajo la orden, con un sello de tiempo", () => {
    expect(
      rutaDeArchivo(
        "00000000-0000-0000-0000-0000000000f1",
        "ficha.pdf",
        1700000000000,
      ),
    ).toBe("00000000-0000-0000-0000-0000000000f1/1700000000000-ficha.pdf");
  });
});
