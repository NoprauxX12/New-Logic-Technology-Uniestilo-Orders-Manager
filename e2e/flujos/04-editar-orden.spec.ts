import { expect, test } from "@playwright/test";

import { pulsarYEsperarGuardado } from "@e2e/fixtures/acciones";
import { ordenValida } from "@e2e/fixtures/datos";
import { DetalleOrdenPagina } from "@e2e/paginas/DetalleOrdenPagina";
import { NuevaOrdenPagina } from "@e2e/paginas/NuevaOrdenPagina";
import { TableroPagina } from "@e2e/paginas/TableroPagina";

/**
 * Flujo 4 · Editar una orden que todavía no pasa a diseño (`docs/adr/0012`).
 *
 * Camino feliz: administración abre la orden, corrige un dato, guarda y ve el
 * rastro de lo que cambió. Alternativo: guardar sin cambiar nada no deja rastro.
 */

test("administración corrige una orden recién registrada y queda el rastro", async ({
  page,
}) => {
  const orden = ordenValida();
  const nueva = new NuevaOrdenPagina(page);
  const tablero = new TableroPagina(page);
  const detalle = new DetalleOrdenPagina(page);
  const guardarCambios = page.getByRole("button", { name: "Guardar cambios" });

  await test.step("registrar la orden y abrir su detalle", async () => {
    await nueva.abrir();
    await nueva.registrar(orden);
    await expect(nueva.mensajeDeExito(orden.numeroOrdenCompra)).toBeVisible();

    await tablero.abrir();
    await tablero.buscar(orden.numeroOrdenCompra);
    await tablero.abrirTrazabilidad(orden.numeroOrdenCompra);
    await expect(detalle.titulo(orden.numeroOrdenCompra)).toBeVisible();
  });

  await test.step("guardar sin cambiar nada no es una edición", async () => {
    await page.getByRole("link", { name: "Editar orden" }).click();
    await expect(nueva.numeroOrdenCompra).toHaveValue(orden.numeroOrdenCompra);

    await pulsarYEsperarGuardado(page, guardarCambios);
    await expect(
      page.getByText("No cambiaste ningún dato de la orden."),
    ).toBeVisible();
  });

  await test.step("corregir el número y guardar", async () => {
    const corregido = `${orden.numeroOrdenCompra}-B`;
    await nueva.numeroOrdenCompra.fill(corregido);
    await guardarCambios.click();

    await expect(detalle.titulo(corregido)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ediciones" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        `Número de orden de compra: ${orden.numeroOrdenCompra} → ${corregido}`,
      ),
    ).toBeVisible();
  });
});
