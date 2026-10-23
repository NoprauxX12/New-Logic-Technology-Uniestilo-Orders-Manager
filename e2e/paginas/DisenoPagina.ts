import { expect, type Locator, type Page } from "@playwright/test";

import { pulsarYEsperarGuardado } from "@e2e/fixtures/acciones";

/** Pantalla `/ordenes/diseno` (HU-04): diseño sube la ficha técnica. */
export class DisenoPagina {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/ordenes/diseno");
  }

  tarjeta(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("article").filter({
      has: this.page.getByRole("heading", {
        name: numeroOrdenCompra,
        exact: true,
      }),
    });
  }

  /** Elige el archivo de la ficha y pulsa «Adjuntar ficha técnica». */
  async adjuntarFicha(numeroOrdenCompra: string, rutaDelArchivo: string) {
    const tarjeta = this.tarjeta(numeroOrdenCompra);

    await tarjeta
      .getByLabel("Archivo de la ficha técnica")
      .setInputFiles(rutaDelArchivo);
    await pulsarYEsperarGuardado(
      this.page,
      tarjeta.getByRole("button", { name: "Adjuntar ficha técnica" }),
    );

    // El aviso va arriba de la lista: al adjuntar, la orden cambia de grupo y su
    // tarjeta ya no está donde estaba.
    await expect(this.page.getByRole("status")).toContainText(
      "Ficha técnica adjuntada",
    );
  }
}
