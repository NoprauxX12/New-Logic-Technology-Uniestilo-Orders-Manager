-- HU-23 · Secretaría valida los insumos de la orden.
--
-- Hilo, resorte, cierre, botón, hilo de bordar, sublimado y estampado: lo que
-- lleva la orden además de la tela. La validación es una etapa del flujo y va
-- justo después de la tela, antes del corte: secretaría valida los materiales
-- de una vez (Reunión 2 con Néstor: la validación de material va antes del
-- corte). Su dueño y el resto de la historia se declaran en la migración
-- siguiente porque Postgres no deja usar un valor de enum en la misma
-- transacción que lo crea.
--
-- Ver `docs/adr/0013`.

alter type public.checkpoint add value if not exists 'insumos_validados' after 'tela_programada';
