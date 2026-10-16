# 0008. La programación a diseño son dos columnas de la orden, no una entidad nueva

Fecha: 2026-10-09 · Estado: Aceptada

## Contexto

HU-03 pide que secretaría arme la lista de órdenes que diseño debe trabajar, en el orden en que deben trabajarse, con el número de orden de programación, la razón social, las referencias y el total por referencia.

Eso se puede modelar de dos maneras. Una es una entidad propia —una hoja de programación con su fecha y sus renglones, como `lote_taller` para los talleres (regla 7)—. La otra es guardar en cada orden el número y la posición que le tocaron.

Tres datos inclinan la decisión. El modelo de datos entregado en el Sprint 0 tiene ocho entidades y ninguna de programación. `orden.numero_orden_programacion` existe desde HU-01, con un comentario que la reserva para esta historia. Y la Product Owner aclaró que "cinco o seis" no es un tope: la secretaria va agregando órdenes a diseño conforme las necesita, hoy tres y mañana ocho, y en rondas distintas; no arma un documento cerrado.

Si la lista no se cierra, una entidad "hoja" tendría un solo registro creciendo para siempre, o uno por ronda sin que nadie distinga las rondas. No describe el proceso.

## Decisión

**La programación son dos columnas de `orden`**: `numero_orden_programacion`, que escribe la secretaria porque es el número de su hoja, y `posicion_programacion`, que pone el sistema.

**La posición es un contador global creciente**, `max + 1` al momento de programar. Así lo que se agrega después queda después, sin que la secretaria tenga que numerar nada. Un índice único sobre la columna impide dos órdenes en la misma posición y, de paso, vuelve segura la asignación por contador: si dos personas programan a la vez, la segunda choca en vez de empatar.

**No se deriva del `fecha_hora` del avance.** Varias órdenes programadas en el mismo acto comparten el `now()` de la transacción y no habría con qué desempatar el orden de trabajo.

**El avance sigue siendo el estado.** La etapa `programada_diseno` se marca en `avance_seccion` como cualquier otra (regla 1), así que el tablero y el motor de workflow no necesitan saber nada de estas dos columnas. Son el dato de la hoja, no el estado.

**Sin tope de órdenes por ronda.** La validación exige al menos una, que ninguna esté dos veces y que ningún número se repita. El "cinco o seis" de la historia es el ejemplo de lo que cabe en la hoja física.

La escritura va en `programar_ordenes_a_diseno`, una función de Postgres, porque toca `orden` y `avance_seccion` (ADR 0005): o queda la programación completa o no queda nada.

**Feature propia**, `src/features/programacion/`, y no dentro de `ordenes/`: es dueña de su pantalla, su validación y su consulta, y lo único que importa de otra feature es el motor de workflow, que es lo que las reglas de ubicación permiten.

## Consecuencias

- El modelo de datos entregado en el Sprint 0 sigue valiendo: una columna más y ninguna entidad nueva.
- Reordenar la hoja después de programada no es posible sin una historia nueva. Nadie lo pidió, y cambiar la posición de una orden ya programada movería el orden de trabajo de diseño sin dejar rastro, lo que choca con la bitácora inmutable (RNF-05).
- `orden` ya no se escribe solo al cerrar: HU-13 había revocado el update sobre la tabla y concedido únicamente `numero_factura`, así que esta migración suma su propio `grant update (numero_orden_programacion, posicion_programacion)`. La política `"secretaria registra la factura"` (HU-17) ya autoriza el update a secretaría y queda con un nombre que no la describe del todo; cuando una tercera historia escriba en `orden` vale la pena renombrarla.
- Al poner `programada_diseno` como disponible, el motor la exige antes del corte: una orden recién registrada ya no pasa a corte hasta que secretaría la programe. Es el proceso real, pero cambia el camino de las pruebas de las demás historias.
- La condición "una orden sin programar" se consulta por `posicion_programacion is null`, y el check `orden_programacion_completa` garantiza que número y posición van juntos.
