# 0013. La validación de insumos es una etapa del flujo con su listado inmutable

Fecha: 2026-11-10 · Estado: Aceptada

## Contexto

HU-23 pide que secretaría, al validar los insumos de una orden (hilo, resorte, cierre, botón, hilo de bordar, sublimado, estampado), pueda **sacar el listado según la orden de compra** y **marcarlos como validados**. Sin alerta: a diferencia de la tela (HU-06), los insumos se consiguen en un día, así que nadie tiene que enterarse de que faltan.

Había que decidir tres cosas:

1. Si validar insumos es una etapa del flujo (un checkpoint en `avance_seccion`) o un dato suelto de la orden que no frena nada.
2. En qué punto del flujo va.
3. Dónde vive el listado y qué pasa con él cuando la orden se devuelve (HU-18).

## Decisión

**Es una etapa: `insumos_validados`, de secretaría, entre «Tela programada» y «Corte completado».** El documento de contexto ya la ponía entre las responsabilidades de secretaría junto con la tela, y en la Reunión 2 con Néstor la validación de materiales quedó antes del corte. Como etapa, entra sola al tablero (HU-14), al semáforo, a los avisos de entrega (HU-20, que ahora dicen «está en Validación de insumos») y al asistente, sin que ninguno de ellos sepa de insumos. Como dato suelto habría que enseñárselo a cada uno.

Las órdenes que ya iban más adelante el día que se enciende la etapa no se trancan: el motor la muestra como «No aplicó», igual que pasó con la cotización enviada (HU-02). Una corrección que entra por el corte o después tampoco pasa por ella. Las etapas de entrada de las correcciones (`ETAPAS_DE_ENTRADA`) no cambian.

**El listado es una tabla propia, `insumo_orden`, colgada del avance que lo validó** (`avance_id`), con el insumo (enum `tipo_insumo`, los siete de la historia) y un detalle libre en palabras del taller («200 botones blancos de 4 huecos»). Quién validó y cuándo salen del avance, no se repiten en la fila.

- **Inmutable.** Ni update ni delete para nadie. Una devolución anula el avance (`anulado_por`) y el listado queda atrás con él; la validación siguiente crea filas nuevas con su propio avance. El listado vigente es el del avance vigente. Es la misma regla de la bitácora (RNF-05, ADR 0011).
- **Se escribe solo en la transacción que marca la etapa.** `validar_insumos` es `SECURITY INVOKER` (ADR 0005). La política de insert de `insumo_orden` exige que el avance sea el `insumos_validados` vigente de esa orden, firmado por quien inserta y con `fecha_hora = now()`, que solo se cumple dentro de la misma transacción. Así nadie le agrega un insumo después a una validación ya hecha, ni con una llamada directa a la API, y no hace falta otra función `SECURITY DEFINER`.
- **Sin listado no hay validación.** Un trigger de restricción diferido rechaza al confirmar cualquier avance `insumos_validados` que no tenga al menos un insumo. Cubre la acción genérica del motor y las llamadas directas.

**Un solo botón guarda el listado y marca la etapa.** No hay borrador: menos estados para alguien poco digital (RNF-08) y nada que se quede a medias. Para ir a revisar la bodega antes de validar está el listado para imprimir (`/ordenes/insumos/<orden>`), que muestra los datos de la orden de compra y sus prendas aunque los insumos todavía no estén validados.

**El catálogo de insumos es fijo.** Son los siete de la historia, en `src/features/insumos/catalogo.ts` y en el enum de la base. `catalogo.test.ts` verifica que digan lo mismo. Un insumo nuevo es una migración y una línea en el catálogo.

## Consecuencias

- El flujo pasa de 13 a 14 etapas. Una orden con la tela programada ya no va directo a corte: primero secretaría valida los insumos. Es un paso más para secretaría, pero es el mismo rol que acaba de programar la tela.
- Las copias SQL que nombran etapas (`rol_dueno` y el área de `generar_alertas_proximidad_entrega`) se redefinen en `20261110100100_validar_insumos.sql`. `rlsPorRol.test.ts` y las pruebas pgTAP las vigilan.
- El listado de una orden devuelta queda en la base aunque ya no cuente. Ocupa poco y es justamente el rastro que se perdía en los cuadernos.
- El detalle es texto libre, no cantidad y unidad. Es lo que se escribe hoy en papel. Si la PO pide inventario de insumos, eso es otra historia y otro modelo.
