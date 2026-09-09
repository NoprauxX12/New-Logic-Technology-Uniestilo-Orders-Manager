# Uniestilo · Gestor de órdenes de producción

Plataforma web para registrar y seguir las órdenes de producción de **Uniestilo S.A.S.** (confección, Marinilla, Antioquia): cada área marca su parte del proceso y el administrador ve el avance de todas las órdenes en un tablero en tiempo real. Reemplaza los cuadernos y el WhatsApp.

Proyecto Integrador 2 · Universidad EAFIT · 2026-2 · Equipo **New Logic Technology**.

## Equipo

| Integrante             | Rol                                    |
| ---------------------- | -------------------------------------- |
| Juan José Díaz         | Ingeniero de Datos & Backend           |
| Jerónimo Campuzano     | Scrum Master & Ingeniero IA            |
| Leidy D. Roldán        | Ingeniera Frontend & Testing           |
| Juan José Escobar      | Ingeniero de Infraestructura & Backend |
| Juan Sebastián Lizcano | Ingeniero Backend & Frontend           |

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres + RLS, Auth, Storage, Realtime) · Vercel.

## Empezar

Requisitos: Node 22 (`nvm use` lee `.nvmrc`), npm y Docker (solo para Supabase local).

```bash
npm ci
cp .env.example .env.local   # completar con las llaves del proyecto de Supabase
npm run dev                  # http://localhost:3000
```

Base de datos local con la CLI de Supabase (recomendado para no tocar datos reales):

```bash
npx supabase start           # Postgres, Auth y Studio en Docker
npx supabase db reset        # aplica migraciones y seed
npm run db:types             # regenera src/types/database.types.ts
```

`npx supabase init` ya no hace falta: la configuración está versionada en
`supabase/config.toml` y volver a inicializarla la dejaría distinta a la del
resto del equipo. El `start` imprime las llaves que van en `.env.local`.

Para mirar las tablas y correr consultas está **Supabase Studio**, el panel web
que levanta el `start`: http://127.0.0.1:54323

## Datos de prueba

`npx supabase db reset` aplica las migraciones y carga `supabase/seed.sql`. Todo lo que trae es inventado —clientes, personas y órdenes— sobre el proceso real de Uniestilo. Los correos usan el dominio `.test`, reservado para pruebas.

Hay una persona por rol. **Nadie "entra" con estas cuentas: todavía no hay pantalla de login**, llega en HU-16. Existen porque `avance_seccion.usuario_id` es obligatorio y los avances necesitan autor, así que mientras tanto quien construya una historia de marcado escoge uno de estos ids a mano en su código. Cómo lo va a saber la aplicación cuando haya usuarios de verdad es una decisión abierta del equipo.

El seed también les crea la cuenta de autenticación, con la contraseña `uniestilo123` igual para todas. Hoy no sirve para nada —no hay dónde escribirla— pero deja el terreno listo para HU-16.

| Rol          | Id en `usuario`                        | Correo                      | Marca                                      |
| ------------ | -------------------------------------- | --------------------------- | ------------------------------------------ |
| `admin`      | `00000000-0000-0000-0000-0000000000a1` | `admin@uniestilo.test`      | Registra órdenes y ve el tablero completo  |
| `secretaria` | `00000000-0000-0000-0000-0000000000a2` | `secretaria@uniestilo.test` | Cotización, programación, tela y cierre    |
| `diseno`     | `00000000-0000-0000-0000-0000000000a3` | `diseno@uniestilo.test`     | Ficha técnica                              |
| `corte`      | `00000000-0000-0000-0000-0000000000a4` | `corte@uniestilo.test`      | Corte completado                           |
| `logistica`  | `00000000-0000-0000-0000-0000000000a5` | `logistica@uniestilo.test`  | Recogido y bordado, lotes a taller         |
| `marcacion`  | `00000000-0000-0000-0000-0000000000a6` | `marcacion@uniestilo.test`  | Llegada a marcación y lista para despachar |

Y hay siete órdenes, cada una parada en un punto distinto del flujo, para que nadie tenga que hacerle clic a medio proceso solo para llegar a su pantalla:

| Orden     | Avances | Le sigue             | Sirve para                                     |
| --------- | ------- | -------------------- | ---------------------------------------------- |
| `OC-5001` | 0       | Cotización aprobada  | El comienzo del flujo (HU-02)                  |
| `OC-5002` | 4       | Corte completado     | HU-08                                          |
| `OC-5003` | 5       | Recogido y bordado   | HU-09, y tiene un lote todavía en el taller    |
| `OC-5004` | 6       | Llegada a marcación  | HU-12, y tiene un lote recibido incompleto     |
| `OC-5005` | 7       | Lista para despachar | HU-19. Va atrasada: sirve para el semáforo     |
| `OC-5006` | 8       | Orden cerrada        | HU-13                                          |
| `OC-5007` | 9       | —                    | Flujo completo, para el tablero y el histórico |

HU-10 despacha un lote nuevo desde cualquier orden que ya tenga el corte hecho (`OC-5003` en adelante); HU-11 confirma los lotes que el seed dejó abiertos.

## Marcar un avance

La secuencia de checkpoints y el rol dueño de cada uno viven en un solo archivo: `src/features/workflow/checkpoints.ts`. **Ninguna action inserta en `avance_seccion` por su cuenta** (regla 2 de `CLAUDE.md`): primero le pregunta al motor.

```ts
import { puedeMarcar } from "@/features/workflow/transiciones";

const veredicto = puedeMarcar({
  checkpoint: "corte_completado",
  marcados,
  rol,
});
if (!veredicto.permitido) return { ok: false, mensaje: veredicto.mensaje };
```

`marcados` son los checkpoints que la orden ya tiene; `rol` es el de quien marca. El motor verifica que no esté ya marcado, que sea el siguiente de la secuencia y que el rol sea el dueño, y devuelve el mensaje listo para mostrar. La base respalda lo primero por su cuenta con un índice único sobre `(orden_id, checkpoint)`.

Falta definir de dónde sale el usuario que marca mientras no exista el login (HU-16): `avance_seccion.usuario_id` es obligatorio.

## Comandos

| Comando            | Qué hace                                                      |
| ------------------ | ------------------------------------------------------------- |
| `npm run dev`      | Servidor de desarrollo                                        |
| `npm run build`    | Build de producción                                           |
| `npm run check`    | Formato + lint + tipos + tests. Correrlo antes de abrir un PR |
| `npm run lint:fix` | Arregla lo que ESLint pueda arreglar solo                     |
| `npm run format`   | Formatea todo con Prettier                                    |
| `npm test`         | Tests en modo watch                                           |

## Documentación

- [`CLAUDE.md`](CLAUDE.md): estándares de código, estructura del proyecto y reglas del dominio. Lectura obligatoria.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): ramas, commits, PRs y releases.
- [`docs/adr/`](docs/adr/): decisiones de arquitectura.
- Backlog: https://github.com/users/NoprauxX12/projects/7/views/3
