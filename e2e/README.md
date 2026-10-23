# Pruebas E2E

Un navegador real (Playwright + Chromium) hace lo que haría una persona contra la
aplicación y Supabase **locales**. Complementan, no reemplazan, a las pruebas
unitarias (Vitest) y a las de la base (pgTAP): son las únicas que prueban que la
pantalla, la Server Action y la base funcionan **juntas**.

## Cómo correrlas

```bash
npx supabase start && npx supabase db reset   # base local con el seed
npm run test:e2e                              # todos los flujos
npm run test:e2e:ui                           # modo visual
npx playwright test --config e2e/playwright.config.ts e2e/flujos/01-registrar-orden.spec.ts   # un flujo
npx playwright show-report playwright-report  # reporte del último intento
```

Playwright compila la aplicación y la levanta (`npm run build && npm run start`,
~25 s), igual que el job `E2E` del CI. Si ya hay un servidor en el puerto 3000 lo
reutiliza y se salta el build.

Se prueba lo compilado a propósito: el servidor de desarrollo compila cada ruta
al visitarla por primera vez y recarga la página en caliente, y en una prueba
larga eso da fallos intermitentes (un clic que cae en medio de una recarga).

**Solo corren contra localhost.** `fixtures/entorno.ts` se niega a arrancar si
`E2E_BASE_URL` o `NEXT_PUBLIC_SUPABASE_URL` (de `.env.local`) no son locales:
las pruebas crean órdenes y entran con la contraseña pública del seed.

## Si algo falla

- **Con tu propio `npm run dev` corriendo en el puerto 3000** las pruebas lo
  reutilizan y heredan sus carreras. Si ves fallos intermitentes, detenlo y deja
  que Playwright levante la versión compilada.
- **El clic nunca se completa y el log dice `element was detached from the DOM` /
  `navigated to .../login` una y otra vez**: la página se está recargando sola en
  bucle (cientos de veces por segundo). No es un fallo de la prueba: es la caché
  de Turbopack de la carpeta `.next`, generada con otra versión de Next, que no
  coincide con la instalada (pasó al subir de Next 16.2 a 16.4). En el log del
  servidor se ve `✓ Compiled in 0ms` seguido de `GET /login` sin parar.
  Arreglo: detén `npm run dev`, borra `.next` y vuelve a correr.

  ```bash
  rm -rf .next && npm run test:e2e
  ```

  Conviene hacerlo siempre que cambie la versión de `next` en `package.json`.

- **`E2E: ... no es local`**: el candado de `fixtures/entorno.ts` detectó que
  `E2E_BASE_URL` o `NEXT_PUBLIC_SUPABASE_URL` no apuntan a localhost. Es a propósito.
- **Falla el login del paso de preparación**: la base local no tiene el seed.
  Corre `npx supabase db reset`.
- **Ver qué pasó**: `npx playwright show-report playwright-report` o, para una
  prueba, `npx playwright show-trace test-results/<carpeta>/trace.zip`.

## Estructura

```
e2e/
├── playwright.config.ts   URL, navegador, proyectos y servidor
├── fixtures/              piezas que reutilizan los flujos
│   ├── entorno.ts         candado: solo localhost
│   ├── cuentas.ts         las 7 cuentas del seed, una por rol
│   ├── sesion.ts          entrarComo(browser, cuenta): login real de una persona
│   ├── acciones.ts        pulsarYEsperarGuardado(): espera la respuesta del servidor
│   ├── datos.ts           generadores (número de orden único, fechas, prendas)
│   ├── ficha-tecnica.pdf  archivo de prueba para subir
│   └── preparacion.setup.ts   entra una vez como admin y guarda la sesión
├── paginas/               una clase por pantalla: solo ella conoce los selectores
└── flujos/                una prueba por flujo, escrita como historia
```

## Cómo agregar un flujo

1. Si la pantalla es nueva, crea su clase en `paginas/` con los textos y roles
   accesibles de la pantalla (`getByRole`, `getByLabel`), no clases CSS.
2. Crea `flujos/NN-nombre.spec.ts` con **un caso feliz y al menos un alternativo**
   (lo que pide la materia para cada funcionalidad).
3. Usa `step` para que el reporte se lea como la historia de usuario.
4. Los datos que crees deben ser únicos por corrida (`fixtures/datos.ts`): así las
   pruebas se repiten sin reiniciar la base.
5. Los flujos empiezan con la sesión de administración ya iniciada. Si el flujo
   _es_ el login, usa `test.use({ storageState: { cookies: [], origins: [] } })`.
   Para pasar de una persona a otra (el ciclo completo) usa
   `entrarComo(browser, CUENTAS.rol)`.
6. **Después de pulsar un botón que guarda, espera la respuesta del servidor**
   (`pulsarYEsperarGuardado`), no «a que el botón desaparezca»: mientras guarda,
   el botón cambia su texto a «Guardando…» y deja de coincidir con su nombre, así
   que esa espera termina antes de tiempo y el flujo sigue con la acción todavía
   en camino.

Imports con el alias `@e2e/` (por ejemplo `@e2e/paginas/LoginPagina`).

## Flujos actuales

| Flujo                            | HU            | Casos                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-registrar-orden`             | HU-01         | Feliz: login → registrar con 2 prendas → ver en el tablero. Alternativos: número repetido; formulario vacío                                                                                                                                                                                                                                                                               |
| `02-filtrar-tablero`             | HU-14         | Feliz: buscar una orden y abrir su trazabilidad. Alternativos: búsqueda por cliente sin tildes; botón «Atrasadas»; sin resultados                                                                                                                                                                                                                                                         |
| `03-ciclo-completo-de-una-orden` | HU-01 a HU-19 | Una orden de la creación al cierre: Diana la registra y, cada una con su cuenta, Paula (cotización, programación, tela, cierre), Andrés (ficha), Jorge (corte), Luis (recogido, taller, recepción), Sandra (marcación) y Marcela (lista para despachar) marcan lo suyo; cada rol ve la ficha técnica de la orden en su pantalla; al final se comprueban las 13 etapas firmadas por su rol |
