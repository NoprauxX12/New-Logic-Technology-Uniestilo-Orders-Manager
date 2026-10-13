# Cómo contribuir

Estándares de código, estructura y reglas del dominio: `CLAUDE.md`. Este archivo cubre ramas, commits, PRs y releases.

## Ramas

| Rama                        | Para qué                                                                        | Quién escribe    |
| --------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| `main`                      | Producción (Vercel). Solo recibe releases desde `develop`                       | Nadie directo    |
| `develop`                   | Integración del sprint (preview de Vercel). Rama por defecto para los PRs       | Nadie directo    |
| `feature/HU-XX-descripcion` | Trabajo de un HU                                                                | Su responsable   |
| `fix/HU-XX-descripcion`     | Corrección de un bug de un HU                                                   | Quien lo arregla |
| `chore/…`, `docs/…`, `ci/…` | Cambios sin HU: tooling, documentación, CI                                      | Cualquiera       |
| `hotfix/descripcion`        | Arreglo urgente en producción. Sale de `main`; se mezcla a `main` y a `develop` | Quien lo arregla |

`main` y `develop` están protegidas por rulesets (`scripts/github/protect-branches.sh`): sin push directo, sin force push, sin borrado, PR con 1 aprobación, hilos de revisión resueltos y CI en verde. Aplica también para el dueño del repo. Si hay que apagar la protección por una emergencia, se apaga en Settings → Rules y se vuelve a encender el mismo día.

## Flujo de un HU

```bash
git checkout develop && git pull
git checkout -b feature/HU-01-registrar-orden
# trabajo en commits pequeños
npm run check
git push -u origin feature/HU-01-registrar-orden
gh pr create --base develop --fill   # o desde la web
```

1. Abre el PR contra `develop` con la plantilla. Título: `feat(HU-01): registrar orden con sus ítems`.
2. Pide revisión a un compañero, idealmente quien toca código vecino. Nadie aprueba su propio PR.
3. Atiende los comentarios con commits nuevos, sin amend ni force push, para que el revisor vea qué cambió.
4. Con aprobación y CI en verde: **Squash and merge**. El mensaje del squash es el título del PR. La rama se borra sola.
5. `develop` se despliega al preview de Vercel: verifica ahí tu HU.

Si `develop` avanzó mucho mientras trabajabas: `git merge develop` en tu rama (no rebase, para no reescribir lo que ya revisaron).

## Commits

Conventional Commits, en español, en minúscula y en imperativo:

```
feat(HU-01): registrar orden con sus ítems
fix(HU-08): impedir marcar corte dos veces
test(HU-11): cubrir recepción parcial de lote
chore: configurar husky y lint-staged
docs: agregar ADR de estructura por features
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`. En `feat` y `fix` el scope es obligatorio y es el HU. Lo valida `commitlint` en el hook `commit-msg`; `pre-commit` corre Prettier y ESLint sobre lo staged.

## Revisión: qué mirar

- ¿Cumple los criterios de aceptación del HU?
- ¿Respeta las reglas del dominio de `CLAUDE.md` (estado derivado, motor de workflow, auditoría inmutable, RLS)?
- ¿La migración trae políticas RLS y `database.types.ts` regenerado?
- ¿Hay tests de las reglas nuevas?
- ¿Se ve bien en celular?
- ¿Hay algo que una persona del taller no entendería?

## Cierre de sprint (release)

1. Congelar `develop` el día anterior a la demo: solo entran `fix`.
2. PR `develop` → `main` con título `release: sprint N`. Lo revisan el Scrum Master y una persona más. Aquí se usa **Merge commit**, no squash, para que `main` y `develop` no diverjan.
3. Tag en `main`: `git tag -a v0.N.0 -m "Sprint N" && git push origin v0.N.0`.
4. Vercel despliega producción desde `main`.

## Entornos

| Entorno        | Rama      | Dónde                                       |
| -------------- | --------- | ------------------------------------------- |
| Producción     | `main`    | Dominio de producción configurado en Vercel |
| Preview        | `develop` | URL fija de preview que genera Vercel       |
| Preview por PR | cada PR   | Vercel la comenta en el PR                  |

Variables de entorno: `.env.example` documenta las necesarias; cada persona tiene su `.env.local`, que no se sube. En Vercel van en Settings → Environment Variables, separando Production y Preview. Lo ideal es un proyecto de Supabase para producción y otro para preview/desarrollo, para que las pruebas no ensucien los datos reales de Uniestilo.

## Configuración inicial del repo (una sola vez, con permisos de administrador)

```bash
gh auth login
git push -u origin develop
scripts/github/protect-branches.sh NoprauxX12/New-Logic-Technology-Uniestilo-Orders-Manager
```

Después: en Vercel importar el repo, marcar `main` como Production Branch y configurar las variables de entorno.
