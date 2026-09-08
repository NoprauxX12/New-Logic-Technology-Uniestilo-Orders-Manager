-- HU-01 · El número de orden de compra es único sin distinguir mayúsculas.
--
-- La restricción `unique` de la columna compara el texto exacto, así que
-- `OC-A-650225` y `oc-a-650225` entraban como dos órdenes distintas para la
-- misma orden de compra del cliente. En el cuaderno de Uniestilo ese es un solo
-- número, y el criterio de aceptación de HU-01 es que no se repita.
--
-- Se reemplaza por un índice único sobre `upper(numero_orden_compra)`: la
-- comparación ignora mayúsculas y el valor se sigue guardando tal como lo
-- escribieron. El índice de la columna sale sobrando, porque uno sobre upper()
-- ya impide también el duplicado exacto.
--
-- Sigue levantando el error 23505 al repetirse, que es lo que la action traduce
-- al mensaje del campo.

alter table public.orden
  drop constraint orden_numero_orden_compra_key;

create unique index orden_numero_orden_compra_unico_idx
  on public.orden (upper(numero_orden_compra));
