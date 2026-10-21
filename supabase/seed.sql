-- Datos de prueba de la base local. Los aplica `npx supabase db reset` después
-- de las migraciones.
--
-- Para qué sirve: que cualquiera del equipo clone, corra un comando y tenga la
-- misma base que los demás, con órdenes ya paradas en cada punto del flujo. Sin
-- esto, quien trabaja en marcar un checkpoint tiene que registrar una orden y
-- hacerle clic a medio proceso cada vez que reinicia la base.
--
-- NADA DE ESTO ES REAL. Los clientes, las personas y las órdenes son
-- inventados; los correos usan el dominio `.test`, reservado por el RFC 2606
-- para pruebas, así que no puede existir de verdad. Lo que sí es real es el
-- proceso: los nueve checkpoints en su orden, marcados por el rol dueño de cada
-- uno según `src/features/workflow/checkpoints.ts`.
--
-- Solo corre en local. La contraseña de abajo no sirve en ningún otro lado.

-- ---------------------------------------------------------------------------
-- Cuentas de autenticación
-- ---------------------------------------------------------------------------
-- `usuario.id` es el mismo de `auth.users`, así que las cuentas van primero.
-- El login llega en HU-16; por ahora estas filas existen para que los perfiles
-- tengan a qué apuntar y para que el día que haya login ya se pueda entrar.
--
-- Contraseña de todos, solo en local: uniestilo123

-- Los cuatro `*_token`/`email_change` van en `''` y no se omiten: GoTrue los
-- lee como texto no nulo, y un NULL aquí tumba el login con un genérico
-- "Database error querying schema" (ver HU-16) que no dice cuál es la columna.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@uniestilo.test',      extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'secretaria@uniestilo.test', extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'diseno@uniestilo.test',     extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', 'corte@uniestilo.test',      extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', 'logistica@uniestilo.test',  extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', 'marcacion@uniestilo.test',  extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a7', 'authenticated', 'authenticated', 'terminacion@uniestilo.test',  extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, '', '', '', '');

-- ---------------------------------------------------------------------------
-- Perfiles: uno por rol
-- ---------------------------------------------------------------------------

insert into public.usuario (id, nombre, email, rol) values
  ('00000000-0000-0000-0000-0000000000a1', 'Diana Restrepo', 'admin@uniestilo.test',      'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Paula Henao',    'secretaria@uniestilo.test', 'secretaria'),
  ('00000000-0000-0000-0000-0000000000a3', 'Andrés Mejía',   'diseno@uniestilo.test',     'diseno'),
  ('00000000-0000-0000-0000-0000000000a4', 'Jorge Cardona',  'corte@uniestilo.test',      'corte'),
  ('00000000-0000-0000-0000-0000000000a5', 'Luis Betancur',  'logistica@uniestilo.test',  'logistica'),
  ('00000000-0000-0000-0000-0000000000a6', 'Sandra Vélez',   'marcacion@uniestilo.test',  'marcacion'),
  ('00000000-0000-0000-0000-0000000000a7', 'Marcela Osorio', 'terminacion@uniestilo.test', 'terminacion');

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
-- Los NIT van escritos de las dos maneras a propósito, con puntos y sin ellos,
-- para que se vea que la deduplicación por NIT normalizado los distingue bien.

insert into public.cliente (id, nit, razon_social, contacto_nombre, contacto_celular) values
  ('00000000-0000-0000-0000-0000000000c1', '900.111.222-3', 'Colegio San Ignacio',        'Marta Ochoa',   '300 111 2233'),
  ('00000000-0000-0000-0000-0000000000c2', '9014445556',    'Transportes La Mesa S.A.S.', 'Fabio Ramírez', '311 444 5566'),
  ('00000000-0000-0000-0000-0000000000c3', '890.777.888-9', 'Clínica del Norte',          'Elena Zapata',  '321 777 8899');

-- ---------------------------------------------------------------------------
-- Órdenes
-- ---------------------------------------------------------------------------
-- Las fechas son relativas a hoy para que el seed no se venza: el semáforo del
-- tablero (HU-14) marca atrasada si la entrega ya pasó y en riesgo si faltan 3
-- días o menos, así que aquí hay de las tres clases.
--
-- Cada orden está parada en un punto distinto del flujo. La columna de la
-- derecha dice qué historia puede trabajar con ella.

-- Las que ya pasaron por diseño llevan su hoja de programación y su turno
-- dentro de ella (HU-03). Hay dos hojas armadas, como las de papel: la #1 con
-- tres órdenes y la #2 con otras tres, cada una numerada de 1 en adelante. Las
-- tres sin programar son las que esperan a secretaría en /ordenes/programacion,
-- y la siguiente hoja que arme será la #3.

insert into public.orden (
  id, numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega,
  observaciones, numero_orden_programacion, posicion_programacion,
  numero_factura, creado_por
) values
  -- Recién registrada, sin ningún avance: la primera candidata a programación (HU-03).
  ('00000000-0000-0000-0000-0000000000f1', 'OC-5001', '00000000-0000-0000-0000-0000000000c1', current_date - 2,  current_date + 25, 'Dotación de profesores, primer semestre', null, null, null, '00000000-0000-0000-0000-0000000000a1'),
  -- Con la tela programada: le sigue el corte (HU-08). Hoja 2, tercer turno.
  ('00000000-0000-0000-0000-0000000000f2', 'OC-5002', '00000000-0000-0000-0000-0000000000c1', current_date - 20, current_date + 12, null, 2, 3, null, '00000000-0000-0000-0000-0000000000a1'),
  -- Con el corte hecho: se puede despachar a taller (HU-10). Hoja 2, segundo turno.
  ('00000000-0000-0000-0000-0000000000f3', 'OC-5003', '00000000-0000-0000-0000-0000000000c2', current_date - 28, current_date + 6,  'El cliente pidió bordado en el bolsillo', 2, 2, null, '00000000-0000-0000-0000-0000000000a1'),
  -- Recogida y bordada: le sigue la llegada a marcación (HU-12). En riesgo. Hoja 2, primer turno.
  ('00000000-0000-0000-0000-0000000000f4', 'OC-5004', '00000000-0000-0000-0000-0000000000c2', current_date - 35, current_date + 2,  null, 2, 1, null, '00000000-0000-0000-0000-0000000000a1'),
  -- En marcación: le sigue lista para despachar (HU-19). Atrasada. Hoja 1, segundo turno.
  ('00000000-0000-0000-0000-0000000000f5', 'OC-5005', '00000000-0000-0000-0000-0000000000c3', current_date - 45, current_date - 3,  'Reprogramada dos veces por falta de tela', 1, 2, null, '00000000-0000-0000-0000-0000000000a1'),
  -- Lista para despachar: le sigue el cierre (HU-13). Hoja 1, tercer turno.
  ('00000000-0000-0000-0000-0000000000f6', 'OC-5006', '00000000-0000-0000-0000-0000000000c3', current_date - 40, current_date + 9,  null, 1, 3, null, '00000000-0000-0000-0000-0000000000a1'),
  -- Cerrada: sirve para ver el flujo completo y el histórico. Hoja 1, primer turno.
  ('00000000-0000-0000-0000-0000000000f7', 'OC-5007', '00000000-0000-0000-0000-0000000000c1', current_date - 60, current_date - 10, null, 1, 1, 'FV-2214', '00000000-0000-0000-0000-0000000000a1'),
  -- Sin programar, para que la próxima hoja de HU-03 tenga con qué llenarse.
  ('00000000-0000-0000-0000-0000000000f8', 'OC-5008', '00000000-0000-0000-0000-0000000000c2', current_date - 6,  current_date + 20, 'Pidieron reflectivo en la espalda', null, null, null, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f9', 'OC-5009', '00000000-0000-0000-0000-0000000000c3', current_date - 4,  current_date + 18, null, null, null, null, '00000000-0000-0000-0000-0000000000a1');

-- ---------------------------------------------------------------------------
-- Prendas
-- ---------------------------------------------------------------------------

-- Los pantalones de OC-5001 quedan sin tallaje a propósito: así hay una orden "anterior"
-- al tallaje (tallas escritas a mano, letras en una prenda inferior) para ver que se muestra igual.
insert into public.item_orden (orden_id, descripcion, cantidad, tallas, tallaje, valor, observaciones) values
  ('00000000-0000-0000-0000-0000000000f1', 'Camisas ejecutivas blancas manga larga', 240, 'S:60, M:100, L:80', 'superior_hombre',  18500000.00, null),
  ('00000000-0000-0000-0000-0000000000f1', 'Pantalones de paño gris',               240, 'S:60, M:100, L:80', null,  22000000.00, 'Bota recta'),
  ('00000000-0000-0000-0000-0000000000f2', 'Chaquetas impermeables azules',           80, 'M:30, L:30, XL:20', 'superior_hombre',  16400000.00, null),
  ('00000000-0000-0000-0000-0000000000f3', 'Camisetas tipo polo verdes',             500, 'S:150, M:200, L:150', 'superior_hombre', 21000000.00, 'Bordado en el bolsillo izquierdo'),
  ('00000000-0000-0000-0000-0000000000f4', 'Overoles de dotación',                   120, 'M:40, L:50, XL:30', 'superior_hombre',  19800000.00, null),
  ('00000000-0000-0000-0000-0000000000f5', 'Batas blancas de laboratorio',           200, 'S:70, M:80, L:50', 'superior_hombre',   14500000.00, 'Tela antifluidos'),
  ('00000000-0000-0000-0000-0000000000f6', 'Uniformes quirúrgicos',                  300, 'S:100, M:120, L:80', 'superior_hombre', 27000000.00, null),
  ('00000000-0000-0000-0000-0000000000f7', 'Camisas escolares blancas',              450, 'XS:150, S:200, M:100', 'superior_hombre', 25200000.00, null),
  ('00000000-0000-0000-0000-0000000000f8', 'Chalecos reflectivos',                    60, 'M:20, L:25, XL:15', 'superior_hombre',   4800000.00, 'Reflectivo en la espalda'),
  ('00000000-0000-0000-0000-0000000000f8', 'Camisas tipo polo grises',                60, 'M:20, L:25, XL:15', 'superior_hombre',   5400000.00, null),
  ('00000000-0000-0000-0000-0000000000f9', 'Batas antifluido verdes',                 40, 'S:15, M:15, L:10', 'superior_hombre',    3900000.00, null);

-- ---------------------------------------------------------------------------
-- Avances
-- ---------------------------------------------------------------------------
-- El rol que marca cada checkpoint es el que dice `checkpoints.ts`: secretaría
-- la cotización, la programación, la tela y el cierre; diseño la ficha; corte
-- el corte; logística el recogido y bordado; marcación la llegada y la salida.
--
-- Las fechas van hacia atrás en el tiempo respetando el orden del flujo, para
-- que la bitácora se lea como una historia y no como un montón de filas con la
-- misma hora.

insert into public.avance_seccion (orden_id, checkpoint, usuario_id, fecha_hora, observaciones) values
  -- OC-5002: hasta la tela programada.
  ('00000000-0000-0000-0000-0000000000f2', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '19 days', null),
  ('00000000-0000-0000-0000-0000000000f2', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '18 days', null),
  ('00000000-0000-0000-0000-0000000000f2', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '16 days', null),
  ('00000000-0000-0000-0000-0000000000f2', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '14 days', null),
  ('00000000-0000-0000-0000-0000000000f2', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '10 days', 'Llegó completa el martes'),

  -- OC-5003: hasta el corte.
  ('00000000-0000-0000-0000-0000000000f3', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '27 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '26 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '24 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '22 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '18 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '6 days',  'Sobró tela para 12 unidades'),

  -- OC-5004: recogida y bordada.
  ('00000000-0000-0000-0000-0000000000f4', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '34 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '33 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '31 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '29 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '25 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '15 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'recogido_bordado',    '00000000-0000-0000-0000-0000000000a5', now() - interval '13 days', null),

  -- OC-5005: en marcación, y atrasada.
  ('00000000-0000-0000-0000-0000000000f5', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '44 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '43 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '41 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '39 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '30 days', 'Se atrasó el proveedor de la tela'),
  ('00000000-0000-0000-0000-0000000000f5', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '20 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'recogido_bordado',    '00000000-0000-0000-0000-0000000000a5', now() - interval '12 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'llegada_marcacion',   '00000000-0000-0000-0000-0000000000a6', now() - interval '5 days',  null),

  -- OC-5006: lista para despachar.
  ('00000000-0000-0000-0000-0000000000f6', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '39 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '38 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '36 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '34 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '30 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '18 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'recogido_bordado',    '00000000-0000-0000-0000-0000000000a5', now() - interval '10 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'llegada_marcacion',   '00000000-0000-0000-0000-0000000000a6', now() - interval '6 days',  null),
  ('00000000-0000-0000-0000-0000000000f6', 'lista_despacho',      '00000000-0000-0000-0000-0000000000a7', now() - interval '2 days',  null),

  -- OC-5007: el flujo completo, hasta el cierre.
  ('00000000-0000-0000-0000-0000000000f7', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '59 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '58 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '56 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '54 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '50 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '40 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'recogido_bordado',    '00000000-0000-0000-0000-0000000000a5', now() - interval '30 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'llegada_marcacion',   '00000000-0000-0000-0000-0000000000a6', now() - interval '20 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'lista_despacho',      '00000000-0000-0000-0000-0000000000a7', now() - interval '14 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'etiquetas',           '00000000-0000-0000-0000-0000000000a2', now() - interval '13 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'documentos_despacho', '00000000-0000-0000-0000-0000000000a2', now() - interval '12 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'factura_generada',    '00000000-0000-0000-0000-0000000000a2', now() - interval '11 days', 'Factura FV-2214'),
  ('00000000-0000-0000-0000-0000000000f7', 'cerrada',             '00000000-0000-0000-0000-0000000000a2', now() - interval '11 days', 'Despachada y facturada'),

  -- HU-02: OC-5008 y OC-5009 ya tienen la cotización enviada y aprobada, para
  -- que la pantalla de programación a diseño (HU-03) siga teniendo órdenes por
  -- programar. OC-5001 queda sin ningún avance: es la de partida para probar
  -- HU-02 desde cero (enviada, aprobada y luego programada).
  ('00000000-0000-0000-0000-0000000000f8', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '5 days',  null),
  ('00000000-0000-0000-0000-0000000000f8', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '4 days',  null),
  ('00000000-0000-0000-0000-0000000000f9', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '3 days',  null),
  ('00000000-0000-0000-0000-0000000000f9', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '2 days',  null);

-- ---------------------------------------------------------------------------
-- Fichas técnicas
-- ---------------------------------------------------------------------------
-- La ruta es el objeto dentro del bucket `fichas` (`<orden_id>/<archivo>`).
-- En local, `config.toml` siembra los PDF de ejemplo al levantar Storage.

insert into public.ficha_tecnica (orden_id, archivo_ruta, subida_por) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f3/ficha-polo-verde.pdf', '00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000f6/ficha-quirurgicos.pdf', '00000000-0000-0000-0000-0000000000a3');

-- ---------------------------------------------------------------------------
-- Lotes a taller
-- ---------------------------------------------------------------------------
-- OC-5004 repartida en dos talleres (regla 6): uno ya recibido incompleto, que
-- es el caso que HU-11 tiene que saber mostrar, y otro todavía afuera, para que
-- HU-11 tenga qué confirmar. Los dos salen después del recogido y bordado: el
-- despacho lo exige (HU-09). OC-5003 no tiene lotes: espera su recogido.

insert into public.lote_taller (
  orden_id, taller, descripcion_prendas, fecha_envio, enviado_por,
  recibido_completo, fecha_recepcion, recibido_por, observaciones_recepcion
) values
  ('00000000-0000-0000-0000-0000000000f4', 'Confecciones El Retiro',  '90 overoles tallas M y L',     now() - interval '12 days', '00000000-0000-0000-0000-0000000000a5', false, now() - interval '5 days', '00000000-0000-0000-0000-0000000000a5', 'Llegaron 85; faltan 5 talla L'),
  ('00000000-0000-0000-0000-0000000000f4', 'Taller Marinilla Centro', '30 overoles talla XL',         now() - interval '3 days',  '00000000-0000-0000-0000-0000000000a5', null, null, null, null);

-- ---------------------------------------------------------------------------
-- Alertas
-- ---------------------------------------------------------------------------

-- Las de tela (HU-06) las envía secretaría y le llegan a administración. Una
-- abierta en OC-5002, que espera el corte, para que HU-07 tenga qué mostrar y
-- HU-22 qué liberar —mientras no llegue la tela, corte no puede marcarla—; y
-- una ya cerrada en OC-5005, cuya tela llegó (HU-22) antes de su corte. Las de
-- entrega (HU-20) las genera el sistema y no tienen quién las haya creado.

insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle, estado, fecha_creacion, fecha_atencion, tela_llegada_en, tela_recibida_por) values
  ('falta_tela',         '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'Faltan 40 metros de tela impermeable azul', 'pendiente', now() - interval '2 days', null, null, null),
  ('falta_tela',         '00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'La tela antifluidos lleva 3 semanas sin llegar', 'atendida', now() - interval '35 days', now() - interval '33 days', now() - interval '31 days', '00000000-0000-0000-0000-0000000000a2'),
  -- HU-20: entrega próxima. OC-5004 (entrega en 2 días, con un lote todavía en taller) avisa a
  -- administración y a logística; OC-5005 (vencida hace 3 días, le toca terminación) a administración.
  -- Marcación (OC-5004) y terminación (OC-5005) quedan sin aviso a propósito: correr
  -- `select public.generar_alertas_proximidad_entrega();` en local los crea, sin repetir estos.
  ('proximidad_entrega', '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', null, 'La orden OC-5004 de Transportes La Mesa S.A.S. entrega en 2 días (' || to_char(current_date + 2, 'DD/MM') || ') y está en el taller', 'pendiente', now() - interval '1 day', null, null, null),
  ('proximidad_entrega', '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a5', null, 'La orden OC-5004 de Transportes La Mesa S.A.S. entrega en 2 días (' || to_char(current_date + 2, 'DD/MM') || ') y está en el taller', 'pendiente', now() - interval '1 day', null, null, null),
  ('proximidad_entrega', '00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000a1', null, 'La orden OC-5005 de Clínica del Norte se venció hace 3 días (' || to_char(current_date - 3, 'DD/MM') || ') y está en Terminación', 'pendiente', now() - interval '1 day', null, null, null),
  -- Una ya atendida, de una orden que después se cerró (no recibe más avisos).
  ('proximidad_entrega', '00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000a1', null, 'La orden OC-5007 de Colegio San Ignacio entrega en 3 días y está en el cierre de la orden', 'atendida', now() - interval '25 days', now() - interval '24 days', null, null);

-- ---------------------------------------------------------------------------
-- HU-18: devolución durante el flujo y orden de corrección
-- ---------------------------------------------------------------------------
-- OC-5010 va en producción y tiene una devolución en su historial: el corte
-- salió con la manga corta, administración la devolvió a "Corte completado" y
-- corte lo rehízo. El primer corte queda en la bitácora como anulado (con su
-- quién y cuándo originales) y el track muestra la devolución con su motivo.
-- Le toca ahora recogido y bordado. Va en la hoja 2, cuarto turno.
--
-- OC-5007-C1 es una orden de corrección de OC-5007 (cerrada): 30 camisas con
-- defecto, que entran por el corte. Todavía no tiene avances; las etapas
-- anteriores se ven como "No aplicó".

insert into public.orden (
  id, numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega,
  observaciones, numero_orden_programacion, posicion_programacion,
  numero_factura, orden_original_id, etapa_inicial, creado_por
) values
  ('00000000-0000-0000-0000-0000000000fa', 'OC-5010', '00000000-0000-0000-0000-0000000000c2', current_date - 24, current_date + 8, 'Uniformes del turno de la noche', 2, 4, null, null, null, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000fb', 'OC-5007-C1', '00000000-0000-0000-0000-0000000000c1', current_date - 3, current_date + 14, 'Corrección de OC-5007. Motivo: 30 camisas llegaron con la costura del cuello abierta', null, null, null, '00000000-0000-0000-0000-0000000000f7', 'corte_completado', '00000000-0000-0000-0000-0000000000a1');

insert into public.item_orden (orden_id, descripcion, cantidad, tallas, tallaje, valor, observaciones) values
  ('00000000-0000-0000-0000-0000000000fa', 'Camisas de dotación azul oscuro', 150, 'M:50, L:60, XL:40', 'superior_hombre', 9600000.00, null),
  ('00000000-0000-0000-0000-0000000000fb', 'Camisas escolares blancas', 30, 'XS:10, S:20', 'otro', 0, 'Prenda defectuosa de OC-5007');

-- La devolución se registra primero: los avances anulados apuntan a ella.
insert into public.reproceso (id, orden_id, checkpoint_destino, motivo, creado_por, creado_en) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000fa', 'corte_completado', 'El corte salió con la manga 2 cm más corta que la ficha. Hay que repetirlo.', '00000000-0000-0000-0000-0000000000a1', now() - interval '8 days');

insert into public.avance_seccion (orden_id, checkpoint, usuario_id, fecha_hora, observaciones, anulado_por) values
  ('00000000-0000-0000-0000-0000000000fa', 'cotizacion_enviada',  '00000000-0000-0000-0000-0000000000a2', now() - interval '23 days', null, null),
  ('00000000-0000-0000-0000-0000000000fa', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '22 days', null, null),
  ('00000000-0000-0000-0000-0000000000fa', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '20 days', 'Programación 2', null),
  ('00000000-0000-0000-0000-0000000000fa', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '18 days', null, null),
  ('00000000-0000-0000-0000-0000000000fa', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '15 days', null, null),
  -- El primer corte: anulado por la devolución de hace 8 días.
  ('00000000-0000-0000-0000-0000000000fa', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '10 days', null, '00000000-0000-0000-0000-0000000000d1'),
  -- El corte rehecho, ya vigente.
  ('00000000-0000-0000-0000-0000000000fa', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '5 days',  'Repetido con la manga de la ficha', null);
