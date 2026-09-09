-- HU-13 · Las tres cosas que hay que reportar antes de cerrar una orden.
--
-- El cierre no es un solo acto: la secretaria asigna las etiquetas, genera los
-- documentos de despacho y factura en el sistema externo, y esas tres cosas
-- ocurren en momentos distintos. La historia pide reportarlas por separado y no
-- dar la orden por completada hasta que estén las tres.
--
-- Van como checkpoints y no como una tabla aparte porque son exactamente eso:
-- alguien reporta que algo se hizo, y queda quién y cuándo. Guardarlas en
-- `avance_seccion` mantiene la regla 1 —el estado se deriva de una sola tabla—
-- y el modelo del dominio del Sprint 0 tampoco tiene ninguna entidad de cierre.
--
-- Al quedar dentro de la secuencia, el motor de workflow se encarga solo de dos
-- criterios de aceptación: no deja marcar `cerrada` si falta alguna de las tres,
-- y no deja reportarlas si la orden no llegó a `lista_despacho`.
--
-- `ADD VALUE` no se puede usar en la misma transacción que lo agrega, por eso
-- esta migración solo amplía el tipo: quien lo use son las siguientes.

alter type public.checkpoint add value if not exists 'etiquetas' before 'cerrada';

alter type public.checkpoint add value if not exists 'documentos_despacho' before 'cerrada';

alter type public.checkpoint add value if not exists 'factura_generada' before 'cerrada';
