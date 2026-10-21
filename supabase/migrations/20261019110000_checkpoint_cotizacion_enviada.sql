-- HU-02 · La cotización se envía y después se aprueba: son dos marcas.
--
-- El issue pide marcar que la cotización se envió y que el cliente la aprobó.
-- Hasta hoy el flujo solo tenía la aprobación. La etapa nueva va justo antes;
-- su dueño se declara en la migración siguiente porque Postgres no deja usar un
-- valor de enum en la misma transacción que lo crea.

alter type public.checkpoint add value if not exists 'cotizacion_enviada' before 'cotizacion_aprobada';
