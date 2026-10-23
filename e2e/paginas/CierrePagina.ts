import { expect, type Locator, type Page } from "@playwright/test";

import { pulsarYEsperarGuardado } from "@e2e/fixtures/acciones";

/** Pantalla `/ordenes/cierre` (HU-13): etiquetas, documentos, factura y cierre. */
export class CierrePagina {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/ordenes/cierre");
  }

  /** La orden en la lista de cierre: «Orden OC-…». */
  orden(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("listitem").filter({
      has: this.page.getByRole("heading", {
        name: `Orden ${numeroOrdenCompra}`,
        exact: true,
      }),
    });
  }

  /** El enlace a la ficha técnica en la orden a cerrar. */
  fichaDe(numeroOrdenCompra: string): Locator {
    return this.orden(numeroOrdenCompra).getByRole("link", {
      name: /ficha-tecnica\.pdf/,
    });
  }

  /** Reporta cada paso del cierre y da la orden por completada. */
  async cerrar(numeroOrdenCompra: string, numeroFactura: string) {
    const orden = this.orden(numeroOrdenCompra);
    await expect(orden).toBeVisible();

    for (const reporte of ["Reportar etiquetas", "Reportar documentos"]) {
      const boton = orden.getByRole("button", { name: reporte });
      await pulsarYEsperarGuardado(this.page, boton);
      await expect(boton).toBeHidden();
    }

    await orden.getByLabel("Número de la factura").fill(numeroFactura);
    const factura = orden.getByRole("button", { name: "Reportar factura" });
    await pulsarYEsperarGuardado(this.page, factura);
    await expect(factura).toBeHidden();

    await pulsarYEsperarGuardado(
      this.page,
      orden.getByRole("button", { name: "Dar la orden por completada" }),
    );
    // Cerrada, la orden sale de la lista.
    await expect(orden).toBeHidden();
  }
}
