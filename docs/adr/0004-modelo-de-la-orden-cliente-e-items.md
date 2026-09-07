# 0004. Modelo de la orden: cliente aparte e ítems por prenda

Fecha: 2026-09-07 · Estado: Aceptada

## Contexto

HU-01 enumera doce campos como si la orden fuera una sola cosa plana: número de orden de compra, razón social, NIT, fechas, contacto, celular, descripción, cantidad, tallas, valor y observaciones. El diagrama entidad-relación del equipo, en cambio, separa el cliente en su propia entidad y pone la prenda en una tabla aparte.

Había que cerrarlo antes de escribir la primera migración, porque cinco de las ocho historias del Sprint 1 marcan avances sobre órdenes que tienen que existir primero: quien construya HU-01 construye la base de la que dependen las demás.

## Decisión

Tres tablas: `cliente`, `orden` e `item_orden`.

**El cliente se separa y se identifica por NIT**, que lleva restricción `unique`. Al registrar una orden no hay que dar de alta el cliente por separado: se escriben sus datos en el mismo formulario y, si el NIT ya existe, se reutiliza el cliente que está —sin sobrescribirle los datos con lo que se haya escrito esta vez, para no pisar su ficha sin querer. Hoy en el cuaderno el mismo cliente aparece escrito de varias formas distintas; esto lo unifica.

**Una orden tiene varias prendas.** Descripción, cantidad, tallas y valor describen prendas, no la orden, y una orden real trae camisas _y_ pantalones. Lo confirman el propio backlog —HU-05 programa la tela "de cada ítem", HU-03 pide totales "por referencia"— y el ejemplo de commit del `CONTRIBUTING.md`, que dice "registrar orden con sus ítems".

**Las tallas van como texto libre** (`"S:20, M:40, L:30"`), que es como se escriben hoy. Ninguna historia del backlog exige contar por talla.

**Observaciones existe en los dos niveles:** en la orden, porque HU-01 la cuenta entre sus doce campos, y en la prenda, como la tiene el diagrama.

**No hay columna `estado`**, según la regla 1 de `CLAUDE.md`: el estado se deriva de `avance_seccion`. Una orden sin ningún avance es, por definición, una orden "Registrada".

Se dejan creadas y vacías las columnas que llenan otras historias: `numero_orden_programacion` (HU-03), `numero_factura` (HU-13), `orden_original_id` (HU-18) y `creado_por` (HU-16). Es más barato que una migración por cada una.

## Consecuencias

- Los datos del cliente dejan de repetirse en cada orden, y HU-03 —que arma listas de clientes— ya tiene de dónde leerlos.
- Nadie valida que las tallas sumen la cantidad. Si la PO lo pide, se agrega una tabla de tallas sin tocar lo anterior.
- El tablero de HU-14 tiene que ajustar su tipo: hoy asume una sola prenda por orden, un `numeroOrden` interno que no existe, y campos de taller y ubicación que viven en otras tablas o en ninguna.
- Las políticas RLS de las tres tablas quedan abiertas hasta HU-17, porque sin login (HU-16) no hay usuario que identificar. Están activadas y marcadas en la migración; mientras existan, la base no está protegida.
- Falta confirmar con la PO si el número de orden de compra es único en todo el sistema o solo por cliente. Se implementó como único global, que es lo que dice el criterio de aceptación de HU-01.
