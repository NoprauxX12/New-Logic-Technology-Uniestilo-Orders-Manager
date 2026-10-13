## HU

HU-XX — <título de la historia>. Cierra #<número de issue>.

## Qué cambia

-

## Cómo probarlo

1.

## Checklist

- [ ] La rama y el título del PR referencian el HU (`feat(HU-XX): ...`)
- [ ] `npm run check` pasa en local (formato, lint, tipos y tests)
- [ ] Si toca la base de datos: migración en `supabase/migrations/`, políticas RLS y `database.types.ts` regenerado
- [ ] Si toca la UI: captura en celular y en escritorio
- [ ] Se cumplen los criterios de aceptación del HU
