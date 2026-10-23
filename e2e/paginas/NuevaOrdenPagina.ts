import { expect, type Locator, type Page } from "@playwright/test";

import type { DatosOrden, DatosPrenda } from "@e2e/fixtures/datos";

/** Pantalla `/ordenes/nueva` (HU-01). */
export class NuevaOrdenPagina {
  readonly numeroOrdenCompra: Locator;
  readonly fechaIngreso: Locator;
  readonly fechaEntrega: Locator;
  readonly nit: Locator;
  readonly razonSocial: Locator;
  readonly contactoNombre: Locator;
  readonly contactoCelular: Locator;
  readonly agregarPrenda: Locator;
  readonly guardar: Locator;

  constructor(private readonly page: Page) {
    this.numeroOrdenCompra = page.getByLabel("Número de orden de compra");
    this.fechaIngreso = page.getByLabel("Fecha en que entró el pedido");
    this.fechaEntrega = page.getByLabel("Fecha de entrega");
    this.nit = page.getByLabel("NIT", { exact: true });
    this.razonSocial = page.getByLabel("Razón social");
    this.contactoNombre = page.getByLabel("Persona de contacto");
    this.contactoCelular = page.getByLabel("Celular");
    this.agregarPrenda = page.getByRole("button", {
      name: "Agregar otra prenda",
    });
    this.guardar = page.getByRole("button", { name: "Guardar orden" });
  }

  async abrir() {
    await this.page.goto("/ordenes/nueva");
  }

  /** El bloque de una prenda, contando desde 1: «Prenda 1», «Prenda 2»… */
  prenda(numero: number): Locator {
    return this.page.getByRole("group", {
      name: `Prenda ${numero}`,
      exact: true,
    });
  }

  /** Lo que dice el total de una prenda con tallaje: «Total: 90 prendas». */
  totalDePrenda(numero: number): Locator {
    return this.prenda(numero).getByRole("status");
  }

  /** Llena los datos del pedido y todas las prendas, sin guardar. */
  async llenar(orden: DatosOrden) {
    await this.numeroOrdenCompra.fill(orden.numeroOrdenCompra);
    await this.fechaIngreso.fill(orden.fechaIngreso);
    await this.fechaEntrega.fill(orden.fechaEntrega);
    await this.nit.fill(orden.nit);
    await this.razonSocial.fill(orden.razonSocial);
    await this.contactoNombre.fill(orden.contactoNombre);
    await this.contactoCelular.fill(orden.contactoCelular);

    for (const [indice, prenda] of orden.prendas.entries()) {
      if (indice > 0) await this.agregarPrenda.click();
      await this.llenarPrenda(indice + 1, prenda);
    }
  }

  private async llenarPrenda(numero: number, prenda: DatosPrenda) {
    const bloque = this.prenda(numero);
    await expect(bloque).toBeVisible();

    await bloque.getByLabel("¿Qué prenda es?").fill(prenda.descripcion);
    await bloque.getByLabel("Valor", { exact: true }).fill(prenda.valor);
    await bloque
      .getByLabel("¿Para qué tipo de prenda son las tallas?")
      .selectOption(prenda.tallaje);

    if (prenda.tallaje === "otro") {
      await bloque
        .getByLabel("Cantidad", { exact: true })
        .fill(prenda.cantidad);
      await bloque.getByLabel("Tallas", { exact: true }).fill(prenda.tallas);
      return;
    }

    for (const [talla, cantidad] of Object.entries(prenda.cantidadesPorTalla)) {
      await bloque.getByLabel(talla, { exact: true }).fill(cantidad);
    }
  }

  /** Llena todo y pulsa «Guardar orden». */
  async registrar(orden: DatosOrden) {
    await this.llenar(orden);
    await this.guardar.click();
  }

  /** «Orden OC-… registrada.» */
  mensajeDeExito(numeroOrdenCompra: string): Locator {
    return this.page.getByText(`Orden ${numeroOrdenCompra} registrada.`);
  }

  /** El aviso rojo general de arriba del formulario. */
  avisoGeneral(): Locator {
    return this.page.getByRole("alert").first();
  }
}
