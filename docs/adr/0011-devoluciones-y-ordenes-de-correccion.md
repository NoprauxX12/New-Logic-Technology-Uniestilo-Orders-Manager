# 0011. Una devolución anula avances sin borrarlos; una corrección es una orden nueva con etapa inicial

Fecha: 2026-10-21 · Estado: Aceptada

## Contexto

HU-18 pide dos salidas ante un defecto que el chequeo de calidad detecta:

- **Durante el flujo**: administración devuelve la orden a la etapa que debe rehacerse, y el track tiene que mostrar que eso pasó.
- **Después del cierre**: se crea una orden de corrección enlazada a la original.

La bitácora `avance_seccion` es inmutable (regla 3, RNF-05): una fila dice quién marcó qué y cuándo y no se edita ni se borra. Devolver una orden choca de frente con eso: la orden tiene que _volver a_ una etapa, pero lo que se marcó después de ella pasó de verdad y debe seguir contándose.

## Decisión

### Devolver a una etapa: avances anulados, no borrados

- Tabla nueva **`reproceso`** (orden, etapa de destino, motivo, quién —de `auth.uid()`—, cuándo). Inmutable, con RLS de lectura para quien tiene sesión y **sin** permiso de insert, update ni delete para nadie con sesión: la única vía de alta es la función de abajo. Una fila de `reproceso` sin sus avances anulados sería una devolución falsa en el track.
- Columna **`avance_seccion.anulado_por`** (nulo = vigente). Es la **única transición permitida** sobre un avance: de nulo a un reproceso de la misma orden, una sola vez, sin tocar ningún otro dato. La fila conserva su quién y su cuándo originales. Un trigger rechaza cualquier otro `UPDATE` y todo `DELETE` (`UE014`), y además se le quita a `authenticated` el permiso de update y delete sobre la tabla.
- El índice único `(orden_id, checkpoint)` pasa a ser **parcial sobre los vigentes**: una etapa puede tener varios avances anulados y uno vigente, y por eso se puede volver a marcar.
- **`devolver_orden_a_etapa(orden, etapa, motivo)`**, `SECURITY DEFINER` con `search_path` vacío (nadie con sesión puede escribir `reproceso` ni actualizar avances, así que tiene que correr con permisos de su dueño; por eso hace ella misma lo que haría RLS: exige sesión y rol `admin`). Atómica. La regla de destino: tiene que ser una etapa que la orden tiene **vigente**; se anulan esa y todas las vigentes que la siguen en el flujo. Devolver a la última marcada es válido (rehacer solo esa). Una orden cerrada no se devuelve. Si el destino es la programación a diseño o anterior, la hoja y el turno de la orden quedan libres (`orden.numero_orden_programacion`, `posicion_programacion`) para poder programarla de nuevo; el dato histórico sigue en la observación del avance anulado.
- **Todo lo que lee avances ignora los anulados.** En TypeScript el filtro es una constante (`AVANCE_VIGENTE` en `lib/ordenes/vigentes.ts`, usada como `.is(AVANCE_VIGENTE, null)`) y un test recorre `src/` y falla si una consulta lee avances sin él. En SQL se redefinieron los triggers y funciones que leían avances. Con eso el motor de workflow no necesita ningún caso especial: recibe los avances vigentes, y la siguiente etapa de la orden vuelve a ser el destino. El detalle de la orden es la excepción: lee también los anulados para pintarlos como "Devuelta".

### Orden de corrección: etapa inicial, no avances falsos

- La corrección es una **orden nueva** enlazada con `orden.orden_original_id` (columna que existe desde HU-01). La original no se toca. Número: el de la original + `-C` + consecutivo (`OC-5007-C1`), saltando los ocupados sin distinguir mayúsculas.
- Entra al flujo por una etapa elegida por administración (por defecto el corte), guardada en **`orden.etapa_inicial`**. Las etapas anteriores se muestran como "No aplicó", que es el concepto que ya existía para una etapa sin marcar por detrás del avance de la orden. El motor (`etapasQueNoAplicaron`, `siguienteCheckpoint`, `puedeMarcar`) recibe la etapa inicial como parámetro opcional.
- Prendas: administración elige cuáles de las de la original, cuántas (1 hasta la cantidad original) y de qué tallas, en **texto libre** (`tallaje = 'otro'`). **Valor 0**: es trabajo repetido sobre prendas ya cobradas en la original; un valor proporcional inventaría una cifra que nadie pidió.
- **`crear_orden_de_correccion`**, `SECURITY INVOKER` como `registrar_orden` (ADR 0005): `orden` e `item_orden` solo permiten el alta a administración y la política exige `creado_por = auth.uid()`, así que RLS sigue siendo la barrera y la función agrega el aviso claro de rol y las reglas de negocio (original cerrada, cantidades, etapa de entrada, fecha).

## Alternativas descartadas

- **Un avance de "devolución" y recalcular el estado en cada lectura** (el avance vigente sería el último por etapa): obliga a cada consulta a reconstruir la historia con lógica temporal, imposible de filtrar con PostgREST, y el índice único por etapa dejaría de servir. Con `anulado_por` el filtro es una sola condición.
- **Borrar o editar los avances de la devolución**: viola RNF-05; es justo lo que la bitácora existe para impedir.
- **Una tabla `reproceso` con `insert` para administración desde la API** (alta directa): permitiría crear una devolución sin anular nada, o anular sin dejar el motivo. Se dejó una sola vía atómica.
- **Fabricar avances "heredados" en la corrección, firmados por administración, para las etapas que no le aplican**: la bitácora diría que administración marcó etapas de otras secciones, el track las mostraría como completadas y habría que corregir "Reportado por X (Rol)", que calcula el rol desde el dueño de la etapa. `etapa_inicial` no inventa nada y reutiliza "No aplicó".
- **Valor proporcional en la corrección**: ver arriba.

## Consecuencias

- La regla 3 (auditoría inmutable) tiene ahora una excepción controlada y única: `anulado_por`, de nulo a un reproceso, desde `devolver_orden_a_etapa`. `CLAUDE.md` lo dice.
- Una consulta nueva que lea `avance_seccion` tiene que filtrar con `AVANCE_VIGENTE`; el test lo vigila. Una función de Postgres nueva que lea avances tiene que incluir `anulado_por is null`; eso lo vigilan las pruebas pgTAP de `supabase/tests/hu18_*.sql`.
- Los lotes a taller y las alertas de tela no se tocan al devolver: son entidades propias. Un lote ya despachado sigue existiendo si se devuelve la orden a una etapa anterior al bordado; administración decide qué hacer con él.
- Devolver una orden no vuelve a disparar ni borra alertas de entrega: el área destinataria cambia según la etapa vigente y la alerta nueva llega a quien corresponda.
- Corregir una corrección es posible: se numera sobre el número de la corrección (`OC-5007-C1-C1`) y se enlaza a ella.
