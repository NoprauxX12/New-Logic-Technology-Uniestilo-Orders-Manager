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
