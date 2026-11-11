# 0012. Editar una orden hasta cotización aprobada

Fecha: 2026-10-31 · Estado: Aceptada

## Contexto

Una orden registrada no se podía editar: un error de digitación solo se corregía con una orden de corrección (HU-18), que es para defectos de una orden ya cerrada. Antes de pasar a diseño nadie ha trabajado todavía sobre la orden, así que corregirla no contradice nada de lo que marcó el taller.

La regla tiene que sostenerse aunque alguien llame directo a la API (regla 5, RNF-04), y cada edición tiene que dejar quién, cuándo y qué (RNF-05). `cliente` además es compartido entre órdenes.

## Decisión

Solo administración edita, y solo mientras la orden no tenga un avance **vigente** de `programada_diseno` ni de una etapa posterior. Una devolución (HU-18) que anule esos avances la vuelve editable. Una orden de corrección que entra después de la programación ya pasó diseño y no se edita, aunque no tenga avances.

**Una sola vía de escritura.** Nadie tiene permiso directo para cambiar estos datos: ni administración. `editar_orden` (SECURITY DEFINER, como `programar_ordenes_a_diseno`) verifica rol y estado después de tomar un candado sobre la orden. Se quitó el INSERT y el DELETE directos de `item_orden`, porque por ahí administración podía agregarle prendas a una orden en producción y sin rastro. Por eso `registrar_orden` y `crear_orden_de_correccion` pasan también a SECURITY DEFINER y exigen el rol en su cuerpo: es otra excepción a la regla del ADR 0005. Se prefirió a políticas RLS por columna porque RLS no distingue columnas y una política de UPDATE para administración abriría también `numero_factura`.

**Rastro en una tabla propia.** `edicion_orden` guarda una fila por edición con quién, cuándo y un JSON con solo lo que cambió (antes y después). Sin UPDATE, DELETE ni INSERT directo, igual que `reproceso`. Se descartó un trigger de auditoría genérico porque el registro y las escrituras de otras etapas (tela, hoja, factura) también tocan estas tablas y habría que separarlas. Con una sola vía de escritura, la función basta. `avance_seccion` no cambia.

**El cliente no cambia en silencio.**

- Con otro NIT, la orden pasa al cliente de ese NIT, o a uno nuevo si no existe. Si ya existe, conserva sus datos, igual que al registrar.
- Con el mismo NIT y otra razón social o contacto, se corrige el cliente solo si esta es su única orden. Si tiene más, se rechaza con un mensaje.

## Consecuencias

- Una llamada directa a la API no puede saltarse ni la regla ni el rastro.
- La lógica de la edición queda en PL/pgSQL, y la regla repetida en `edicion.ts` para los mensajes. Un test verifica que las dos cortan en la misma etapa.
- La razón social de un cliente con varias órdenes no se puede corregir desde ninguna pantalla: hoy no existe una de clientes. Si hace falta, será una acción explícita sobre el cliente, que diga cuántas órdenes afecta.
- El texto de las alertas ya creadas conserva el número de orden y la fecha que tenían.
