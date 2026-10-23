import { expect, type Locator, type Page } from "@playwright/test";

import { pulsarYEsperarGuardado } from "@e2e/fixtures/acciones";

/** Pantalla `/ordenes/tela` (HU-05): la tela que lleva cada prenda. */
export class TelaPagina {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/ordenes/tela");
  }

  /** La tarjeta de una orden: su formulario aparece al pulsar «Ver ítems…». */
  tarjeta(numeroOrdenCompra: string): Locator {
    return this.page.getByRole("article").filter({
      has: this.page.getByRole("heading", {
        name: numeroOrdenCompra,
        exact: true,
      }),
    });
  }

  /** Abre el formulario, llena la tela de cada prenda (por su descripción) y programa. */
  async programarTela(
    numeroOrdenCompra: string,
    telas: Record<
      string,
      { tipo: string; cantidad: string; unidad: "Metros" | "Kilos" }
    >,
  ) {
    const tarjeta = this.tarjeta(numeroOrdenCompra);
    await tarjeta
      .getByRole("button", { name: "Ver ítems y programar tela" })
      .click();

    for (const [descripcion, tela] of Object.entries(telas)) {
      const prenda = tarjeta.getByRole("group", {
        name: descripcion,
        exact: true,
      });
      await prenda.getByLabel("Tipo de tela").fill(tela.tipo);
      await prenda.getByLabel("Cantidad total de tela").fill(tela.cantidad);
      await prenda.getByLabel("Unidad").selectOption({ label: tela.unidad });
    }

    await pulsarYEsperarGuardado(
      this.page,
      tarjeta.getByRole("button", { name: "Programar tela" }),
    );
    // Con la tela programada la orden sale de la lista de pendientes.
    await expect(tarjeta).toBeHidden();
  }
}
