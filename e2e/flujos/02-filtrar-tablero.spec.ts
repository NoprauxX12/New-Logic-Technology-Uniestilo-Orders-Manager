import { expect, test } from "@playwright/test";

import { DetalleOrdenPagina } from "@e2e/paginas/DetalleOrdenPagina";
import { TableroPagina } from "@e2e/paginas/TableroPagina";

/**
 * Flujo 2 · Filtrar el tablero y entrar a una orden (HU-14).
 *
 * Usa las órdenes del seed local: OC-5004 (en producción), OC-5005 (atrasada) y
 * OC-5007 (cerrada, ya entregada). Las pruebas del flujo 1 agregan órdenes al
 * tablero, así que los conteos totales no se fijan: se comprueba qué filas
 * aparecen y cuáles no.
 */

test.describe("camino feliz: buscar una orden y abrir su trazabilidad", () => {
  test("la búsqueda deja solo la orden pedida y se entra a su detalle", async ({
    page,
  }) => {
    const tablero = new TableroPagina(page);
    const detalle = new DetalleOrdenPagina(page);

    await tablero.abrir();
    await tablero.buscar("OC-5004");

    await expect(tablero.fila("OC-5004")).toBeVisible();
    await expect(tablero.fila("OC-5001")).toBeHidden();
    await expect(tablero.contador).toHaveText(/^1 de \d+ órdenes?$/);

    await tablero.abrirTrazabilidad("OC-5004");

    await expect(page).toHaveURL(/\/tablero\/[0-9a-f-]{36}$/);
    await expect(detalle.titulo("OC-5004")).toBeVisible();
    await expect(detalle.lineaDeTiempo).toBeVisible();
  });
});

test.describe("flujos alternativos", () => {
  test("encuentra por cliente sin importar tildes ni mayúsculas", async ({
    page,
  }) => {
    const tablero = new TableroPagina(page);

    await tablero.abrir();
    // Clínica del Norte es el cliente de OC-5005, OC-5006 y OC-5009.
    await tablero.buscar("CLINICA del norte");

    await expect(tablero.fila("OC-5005")).toBeVisible();
    await expect(tablero.fila("OC-5006")).toBeVisible();
    await expect(tablero.fila("OC-5001")).toBeHidden();
  });

  test("el botón «Atrasadas» muestra las atrasadas y no las ya entregadas", async ({
    page,
  }) => {
    const tablero = new TableroPagina(page);

    await tablero.abrir();
    await tablero.filtro("Atrasadas").click();

    await expect(tablero.filtro("Atrasadas")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(tablero.fila("OC-5005")).toBeVisible();
    // OC-5007 está cerrada: su fecha pasó, pero ya se entregó.
    await expect(tablero.fila("OC-5007")).toBeHidden();

    await tablero.limpiar.click();
    await expect(tablero.fila("OC-5007")).toBeVisible();
  });

  test("sin coincidencias avisa y permite quitar los filtros", async ({
    page,
  }) => {
    const tablero = new TableroPagina(page);

    await tablero.abrir();
    await tablero.buscar("zzz-no-existe");

    await expect(tablero.sinResultados).toBeVisible();
    await expect(tablero.fila("OC-5004")).toBeHidden();

    await tablero.quitarFiltros.click();

    await expect(page).toHaveURL(/\/tablero$/);
    await expect(tablero.fila("OC-5004")).toBeVisible();
  });
});
