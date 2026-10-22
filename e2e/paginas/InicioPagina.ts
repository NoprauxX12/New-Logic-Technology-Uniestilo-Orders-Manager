import { expect, type Locator, type Page } from "@playwright/test";

/** Pantalla de inicio `/`: los botones dependen del rol de quien entró. */
export class InicioPagina {
  readonly titulo: Locator;

  constructor(private readonly page: Page) {
    this.titulo = page.getByRole("heading", {
      name: "Uniestilo · Gestor de órdenes",
    });
  }

  async esperarCargada(nombreDeLaPersona: string) {
    await expect(this.titulo).toBeVisible();
    await expect(
      this.page.getByText(`Hola, ${nombreDeLaPersona}`),
    ).toBeVisible();
  }

  /** Pulsa uno de los botones grandes del inicio, por su texto. */
  async abrir(boton: string) {
    await this.page.getByRole("link", { name: boton }).click();
  }
}
