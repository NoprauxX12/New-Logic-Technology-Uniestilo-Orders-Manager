-- HU-19 · Un rol propio para terminación.
--
-- El issue dice que "lista para despachar" la marca terminación (Marcela), que
-- no es marcación (Sandra): son dos personas de dos secciones. Mientras el
-- modelo tenía seis roles, la etapa quedó en `marcacion` de forma provisional.
-- Aquí nace el séptimo rol; el cambio de dueño va en la migración siguiente
-- porque Postgres no deja usar un valor de enum en la misma transacción que lo
-- crea.

alter type public.rol add value if not exists 'terminacion';
