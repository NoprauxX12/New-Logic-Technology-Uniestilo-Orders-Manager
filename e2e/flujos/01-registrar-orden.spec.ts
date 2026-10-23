import { expect, test } from "@playwright/test";

import { CUENTAS } from "@e2e/fixtures/cuentas";
import { ordenValida, totalDePrenda } from "@e2e/fixtures/datos";
import { InicioPagina } from "@e2e/paginas/InicioPagina";
import { LoginPagina } from "@e2e/paginas/LoginPagina";
import { NuevaOrdenPagina } from "@e2e/paginas/NuevaOrdenPagina";
import { TableroPagina } from "@e2e/paginas/TableroPagina";

/**
 * Flujo 1 · Registrar una orden (HU-01).
 *
 * Camino feliz: entrar por el login, pulsar «Registrar una orden», llenar el
 * pedido con dos prendas, guardar, y comprobar que quedó en el tablero.
 * Alternativos: un número de orden repetido y un formulario vacío.
 */

test.describe("camino feliz: desde el login hasta ver la orden en el tablero", () => {
  // Este flujo arranca desde el login, sin la sesión que usan los demás.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("entra, registra una orden con dos prendas y la encuentra en el tablero", async ({
    page,
  }) => {
    const orden = ordenValida();
    const login = new LoginPagina(page);
    const inicio = new InicioPagina(page);
    const nueva = new NuevaOrdenPagina(page);
    const tablero = new TableroPagina(page);

    await test.step("entrar al sistema por el login", async () => {
      await login.abrir();
      await login.entrar(CUENTAS.admin);
      await page.waitForURL("**/");
      await inicio.esperarCargada(CUENTAS.admin.nombre);
    });

    await test.step("ir a «Registrar una orden»", async () => {
      await inicio.abrir("Registrar una orden");
      await expect(page).toHaveURL(/\/ordenes\/nueva$/);
    });

    await test.step("llenar el pedido con dos prendas", async () => {
      await nueva.llenar(orden);

      // La prenda con tallaje suma sola: 20 + 40 + 30.
      await expect(nueva.totalDePrenda(1)).toHaveText(
        `Total: ${totalDePrenda(orden.prendas[0])} prendas`,
      );
    });

    await test.step("guardar la orden", async () => {
      await nueva.guardar.click();
      await expect(nueva.mensajeDeExito(orden.numeroOrdenCompra)).toBeVisible();
    });

    await test.step("comprobar que quedó guardada: aparece en el tablero", async () => {
      await tablero.abrir();
      await tablero.buscar(orden.numeroOrdenCompra);
      await expect(tablero.fila(orden.numeroOrdenCompra)).toBeVisible();
      await expect(tablero.contador).toHaveText(/^1 de \d+ órdenes?$/);
    });
  });
});

test.describe("flujos alternativos", () => {
  test("no deja registrar dos órdenes con el mismo número", async ({
    page,
  }) => {
    const orden = ordenValida();
    const nueva = new NuevaOrdenPagina(page);

    await nueva.abrir();
    await nueva.registrar(orden);
    await expect(nueva.mensajeDeExito(orden.numeroOrdenCompra)).toBeVisible();

    // Mismo número otra vez: la base lo rechaza y la pantalla lo explica.
    await nueva.registrar(orden);
    await expect(
      page.getByText(
        "Ya hay una orden registrada con ese número de orden de compra",
      ),
    ).toBeVisible();
    await expect(nueva.mensajeDeExito(orden.numeroOrdenCompra)).toBeHidden();
  });

  test("con el formulario vacío marca lo que falta y no guarda nada", async ({
    page,
  }) => {
    const nueva = new NuevaOrdenPagina(page);

    await nueva.abrir();
    await nueva.guardar.click();

    await expect(nueva.avisoGeneral()).toHaveText(
      "Revisa los campos marcados en rojo.",
    );
    await expect(
      page.getByText("Escribe el número de la orden de compra"),
    ).toBeVisible();
    await expect(page.getByText("Escribe qué prenda es")).toBeVisible();
    await expect(page).toHaveURL(/\/ordenes\/nueva$/);
    await expect(page.getByText(/registrada\.$/)).toBeHidden();
  });
});
