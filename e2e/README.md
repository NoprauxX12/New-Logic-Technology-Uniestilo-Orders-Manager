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

Si ya tienes `npm run dev` corriendo se reutiliza; si no, Playwright lo levanta.
En CI corre el job `E2E` con la aplicación compilada.

**Solo corren contra localhost.** `fixtures/entorno.ts` se niega a arrancar si
`E2E_BASE_URL` o `NEXT_PUBLIC_SUPABASE_URL` (de `.env.local`) no son locales:
las pruebas crean órdenes y entran con la contraseña pública del seed.

## Estructura

```
e2e/
├── playwright.config.ts   URL, navegador, proyectos y servidor
├── fixtures/              piezas que reutilizan los flujos
│   ├── entorno.ts         candado: solo localhost
│   ├── cuentas.ts         usuarios del seed
│   ├── datos.ts           generadores (número de orden único, fechas, prendas)
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

Imports con el alias `@e2e/` (por ejemplo `@e2e/paginas/LoginPagina`).

## Flujos actuales

| Flujo                | HU    | Casos                                                                                                                             |
| -------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| `01-registrar-orden` | HU-01 | Feliz: login → registrar con 2 prendas → ver en el tablero. Alternativos: número repetido; formulario vacío                       |
| `02-filtrar-tablero` | HU-14 | Feliz: buscar una orden y abrir su trazabilidad. Alternativos: búsqueda por cliente sin tildes; botón «Atrasadas»; sin resultados |
