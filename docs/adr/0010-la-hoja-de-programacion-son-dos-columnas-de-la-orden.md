# 0010. La hoja de programación son dos columnas de la orden, no una entidad nueva

Fecha: 2026-10-16 · Estado: Aceptada

## Contexto

HU-03 pide que secretaría arme la lista de órdenes que diseño debe trabajar, en el orden en que deben trabajarse, con el número de orden de programación, la razón social, las referencias y el total por referencia.

La hoja de papel que usan hoy aclaró la forma: se titula **"PROGRAMACION # 24"**, numera las órdenes de 1 a 9 por dentro, pone una fila por referencia con su cantidad y cierra con el total de prendas de la hoja. O sea que son dos números distintos —el de la hoja y el turno de cada orden dentro de ella— y el de la hoja es un consecutivo que ya va en 24.

Esa misma hoja lleva tres columnas más, TELA / CORTE / CONFECCION, que van chuleando a mano: es el tablero manual de la empresa.

La Product Owner aclaró además que "cinco o seis" no es un tope. La secretaria va agregando órdenes conforme las necesita, y la hoja real llega a nueve.

Quedaban dos maneras de modelarlo: una entidad propia para la hoja, con sus renglones, como `lote_taller` para los talleres (regla 7); o guardar en cada orden a qué hoja pertenece y en qué turno.

## Decisión

**La programación son dos columnas de `orden`**: `numero_orden_programacion`, que es la hoja a la que pertenece —la misma para todas las órdenes de esa tanda—, y `posicion_programacion`, que es su turno dentro de la hoja. No se crea ninguna entidad: el modelo del dominio del Sprint 0 no tiene ninguna de programación, y la primera columna ya estaba reservada en `orden` desde HU-01 para este momento.

`numero_orden_programacion` pasa de texto a **entero**: es un consecutivo que lleva el sistema, se necesita `max() + 1`, y como texto la hoja 10 iría antes de la 9 al ordenar. La columna estaba sin usar, así que la conversión no toca datos.

**Los dos números los pone el sistema.** El de la hoja es el siguiente del contador; el turno sale del orden en que la secretaria dejó las órdenes en pantalla. Ella no escribe ninguno. La numeración arranca en 1 y no en 25: cuando el sistema entre en operación, la empresa reinicia su cuaderno.

**Reordenar se hace con flechas, no arrastrando.** Cada orden de la hoja tiene ↑ y ↓ que la mueven un puesto. Se descartó arrastrar con pulsación larga (difícil en táctil para quien no es digital, exige una librería que el proyecto no tiene, sin accesibilidad por teclado y no se puede probar con Vitest) y se descartó escribir el turno a mano (le mete aritmética a la secretaria y abre validaciones de números repetidos o fuera de rango). Las flechas no necesitan ninguna de las dos cosas.

**El tope es una constante del código**, `MAXIMO_POR_HOJA` en `features/programacion/reglas.ts`, con el mismo criterio que `DIAS_EN_RIESGO` en `lib/ordenes/reglas.ts`. No es variable de entorno: cambiarla costaría lo mismo —entrar a Vercel y redesplegar— pero el valor quedaría fuera del repo, sin historial ni revisión, y además el tope lo necesitan el servidor y la pantalla, así que tocaría exponerla como `NEXT_PUBLIC_*` o pasarla como prop, y ponerle un valor por defecto de todos modos. El tope no es el tamaño de una tanda: es una barrera contra un error de dedo.

**El avance sigue siendo el estado.** La etapa `programada_diseno` se marca en `avance_seccion` como cualquier otra (regla 1), una fila por orden de la hoja. El tablero sigue mostrando progreso por orden; la hoja es cómo se agruparon, no una unidad de estado. Por eso las columnas TELA / CORTE / CONFECCION del papel **no** se replican en la hoja del sistema: eso es el tablero (HU-14), y tenerlo en dos lados serían dos verdades.

La escritura va en `programar_ordenes_a_diseno`, una función de Postgres, porque toca `orden` y `avance_seccion` (ADR 0005): o queda la hoja completa o no queda nada. Un índice único sobre `(hoja, turno)` impide dos órdenes en el mismo puesto y vuelve segura la asignación por contador: si dos personas programan a la vez, la segunda choca en vez de crear una hoja repetida.

**Feature propia**, `src/features/programacion/`, y no dentro de `ordenes/`: es dueña de su pantalla, su validación y su consulta, y lo único que importa de otra feature es el motor de workflow, que es lo que las reglas de ubicación permiten.

## Consecuencias

- El modelo de datos entregado en el Sprint 0 sigue valiendo: una columna más, un cambio de tipo y ninguna entidad nueva.
- La hoja queda como unidad visible: se puede mostrar "Programación #3 · 9 órdenes · 420 prendas" y, más adelante, responder si una tanda está completa. Esa pregunta no se podía hacer con un turno global.
- Reordenar una hoja ya programada no es posible sin una historia nueva. Nadie lo pidió, y mover el turno de una orden ya entregada a diseño cambiaría su orden de trabajo sin dejar rastro, lo que choca con la bitácora inmutable (RNF-05).
- `orden` ya no se escribe solo al cerrar, pero la hoja y el turno **no** se conceden a `authenticated`: con un `grant update` de las dos columnas, secretaría podía cambiar la hoja de cualquier orden desde la API sin dejar rastro, porque la política de update de `orden` no distingue filas ni columnas. La única vía es `programar_ordenes_a_diseno`, `SECURITY DEFINER`, que exige sesión y rol de secretaría y solo escribe órdenes sin programar.
- Al poner `programada_diseno` como disponible, el motor la exige antes del corte: una orden recién registrada ya no pasa a corte hasta que secretaría la programe. Es el proceso real, pero cambia el camino de las pruebas de las demás historias.
- La condición "una orden sin programar" se consulta por `posicion_programacion is null`, y el check `orden_programacion_completa` garantiza que hoja y turno van juntos.
- Diseño no puede abrir `/ordenes/programacion`: la ruta es de secretaría y administración. Cuando HU-04 necesite la hoja tendrá que abrirle la ruta, escribir su propia consulta, o mover la lectura a `src/lib/`, que es lo que ya se hizo con el estado de la orden para el asistente.
