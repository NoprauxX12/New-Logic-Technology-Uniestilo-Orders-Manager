# 0002. Flujo de ramas: main + develop con ramas por HU

Fecha: 2026-09-05 · Estado: Aceptada

## Contexto

Cinco personas trabajan en paralelo sobre HU distintos, con sprints de unas cinco semanas y una demo al cierre de cada uno. El repo nació con un solo commit en `main` y sin protección: cualquiera podía hacer push directo y romper la demo.

## Decisión

Git flow simplificado:

- `main` es producción y solo recibe un PR de release por sprint desde `develop`, con merge commit para que ambas ramas no diverjan.
- `develop` es la integración del sprint. Cada HU se trabaja en `feature/HU-XX-descripcion` y entra por PR con squash, de modo que `develop` tiene un commit por HU.
- Ambas ramas protegidas con rulesets de GitHub (sin push directo, sin force push, 1 aprobación, hilos resueltos, CI en verde). Sin actores que salten la regla.
- Commits en Conventional Commits con el HU como scope, validados por commitlint; Prettier y ESLint corren en pre-commit.

No se adoptó trunk-based (un solo `main`) porque la demo de cada sprint necesita una rama estable que no se mueva mientras el equipo sigue integrando; ni git flow completo (ramas `release/*` y `hotfix/*` obligatorias) porque para tres sprints es ceremonia de más. `hotfix/*` queda como excepción documentada.

## Consecuencias

- Nadie, ni el dueño del repo, mezcla sin revisión. Un PR necesita a otra persona: hay que pedir revisión temprano.
- La rama por defecto pasa a ser `develop`, para que los PRs apunten ahí sin pensar.
- `main` siempre refleja la última demo; `develop` siempre es desplegable a preview.
