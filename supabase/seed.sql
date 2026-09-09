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
  raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@uniestilo.test',      extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'secretaria@uniestilo.test', extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'diseno@uniestilo.test',     extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', 'corte@uniestilo.test',      extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', 'logistica@uniestilo.test',  extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', 'marcacion@uniestilo.test',  extensions.crypt('uniestilo123', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

-- ---------------------------------------------------------------------------
-- Perfiles: uno por rol
-- ---------------------------------------------------------------------------

insert into public.usuario (id, nombre, email, rol) values
  ('00000000-0000-0000-0000-0000000000a1', 'Diana Restrepo', 'admin@uniestilo.test',      'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Paula Henao',    'secretaria@uniestilo.test', 'secretaria'),
  ('00000000-0000-0000-0000-0000000000a3', 'Andrés Mejía',   'diseno@uniestilo.test',     'diseno'),
  ('00000000-0000-0000-0000-0000000000a4', 'Jorge Cardona',  'corte@uniestilo.test',      'corte'),
  ('00000000-0000-0000-0000-0000000000a5', 'Luis Betancur',  'logistica@uniestilo.test',  'logistica'),
  ('00000000-0000-0000-0000-0000000000a6', 'Sandra Vélez',   'marcacion@uniestilo.test',  'marcacion');

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

insert into public.orden (
  id, numero_orden_compra, cliente_id, fecha_ingreso, fecha_entrega,
  observaciones, numero_factura, creado_por
) values
  -- Recién registrada, sin ningún avance.
  ('00000000-0000-0000-0000-0000000000f1', 'OC-5001', '00000000-0000-0000-0000-0000000000c1', current_date - 2,  current_date + 25, 'Dotación de profesores, primer semestre', null, '00000000-0000-0000-0000-0000000000a1'),
  -- Con la tela programada: le sigue el corte (HU-08).
  ('00000000-0000-0000-0000-0000000000f2', 'OC-5002', '00000000-0000-0000-0000-0000000000c1', current_date - 20, current_date + 12, null, null, '00000000-0000-0000-0000-0000000000a1'),
  -- Con el corte hecho: se puede despachar a taller (HU-10).
  ('00000000-0000-0000-0000-0000000000f3', 'OC-5003', '00000000-0000-0000-0000-0000000000c2', current_date - 28, current_date + 6,  'El cliente pidió bordado en el bolsillo', null, '00000000-0000-0000-0000-0000000000a1'),
  -- Recogida y bordada: le sigue la llegada a marcación (HU-12). En riesgo.
  ('00000000-0000-0000-0000-0000000000f4', 'OC-5004', '00000000-0000-0000-0000-0000000000c2', current_date - 35, current_date + 2,  null, null, '00000000-0000-0000-0000-0000000000a1'),
  -- En marcación: le sigue lista para despachar (HU-19). Atrasada.
  ('00000000-0000-0000-0000-0000000000f5', 'OC-5005', '00000000-0000-0000-0000-0000000000c3', current_date - 45, current_date - 3,  'Reprogramada dos veces por falta de tela', null, '00000000-0000-0000-0000-0000000000a1'),
  -- Lista para despachar: le sigue el cierre (HU-13).
  ('00000000-0000-0000-0000-0000000000f6', 'OC-5006', '00000000-0000-0000-0000-0000000000c3', current_date - 40, current_date + 9,  null, null, '00000000-0000-0000-0000-0000000000a1'),
  -- Cerrada: sirve para ver el flujo completo y el histórico.
  ('00000000-0000-0000-0000-0000000000f7', 'OC-5007', '00000000-0000-0000-0000-0000000000c1', current_date - 60, current_date - 10, null, 'FV-2214', '00000000-0000-0000-0000-0000000000a1');

-- ---------------------------------------------------------------------------
-- Prendas
-- ---------------------------------------------------------------------------

insert into public.item_orden (orden_id, descripcion, cantidad, tallas, valor, observaciones) values
  ('00000000-0000-0000-0000-0000000000f1', 'Camisas ejecutivas blancas manga larga', 240, 'S:60, M:100, L:80',  18500000.00, null),
  ('00000000-0000-0000-0000-0000000000f1', 'Pantalones de paño gris',               240, 'S:60, M:100, L:80',  22000000.00, 'Bota recta'),
  ('00000000-0000-0000-0000-0000000000f2', 'Chaquetas impermeables azules',           80, 'M:30, L:30, XL:20',  16400000.00, null),
  ('00000000-0000-0000-0000-0000000000f3', 'Camisetas tipo polo verdes',             500, 'S:150, M:200, L:150', 21000000.00, 'Bordado en el bolsillo izquierdo'),
  ('00000000-0000-0000-0000-0000000000f4', 'Overoles de dotación',                   120, 'M:40, L:50, XL:30',  19800000.00, null),
  ('00000000-0000-0000-0000-0000000000f5', 'Batas blancas de laboratorio',           200, 'S:70, M:80, L:50',   14500000.00, 'Tela antifluidos'),
  ('00000000-0000-0000-0000-0000000000f6', 'Uniformes quirúrgicos',                  300, 'S:100, M:120, L:80', 27000000.00, null),
  ('00000000-0000-0000-0000-0000000000f7', 'Camisas escolares blancas',              450, 'XS:150, S:200, M:100', 25200000.00, null);

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
  ('00000000-0000-0000-0000-0000000000f2', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '18 days', null),
  ('00000000-0000-0000-0000-0000000000f2', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '16 days', null),
  ('00000000-0000-0000-0000-0000000000f2', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '14 days', null),
  ('00000000-0000-0000-0000-0000000000f2', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '10 days', 'Llegó completa el martes'),

  -- OC-5003: hasta el corte.
  ('00000000-0000-0000-0000-0000000000f3', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '26 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '24 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '22 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '18 days', null),
  ('00000000-0000-0000-0000-0000000000f3', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '6 days',  'Sobró tela para 12 unidades'),

  -- OC-5004: recogida y bordada.
  ('00000000-0000-0000-0000-0000000000f4', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '33 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '31 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '29 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '25 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '15 days', null),
  ('00000000-0000-0000-0000-0000000000f4', 'recogido_bordado',    '00000000-0000-0000-0000-0000000000a5', now() - interval '4 days',  null),

  -- OC-5005: en marcación, y atrasada.
  ('00000000-0000-0000-0000-0000000000f5', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '43 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '41 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '39 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '30 days', 'Se atrasó el proveedor de la tela'),
  ('00000000-0000-0000-0000-0000000000f5', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '20 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'recogido_bordado',    '00000000-0000-0000-0000-0000000000a5', now() - interval '12 days', null),
  ('00000000-0000-0000-0000-0000000000f5', 'llegada_marcacion',   '00000000-0000-0000-0000-0000000000a6', now() - interval '5 days',  null),

  -- OC-5006: lista para despachar.
  ('00000000-0000-0000-0000-0000000000f6', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '38 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '36 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '34 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '30 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '18 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'recogido_bordado',    '00000000-0000-0000-0000-0000000000a5', now() - interval '10 days', null),
  ('00000000-0000-0000-0000-0000000000f6', 'llegada_marcacion',   '00000000-0000-0000-0000-0000000000a6', now() - interval '6 days',  null),
  ('00000000-0000-0000-0000-0000000000f6', 'lista_despacho',      '00000000-0000-0000-0000-0000000000a6', now() - interval '2 days',  null),

  -- OC-5007: el flujo completo, hasta el cierre.
  ('00000000-0000-0000-0000-0000000000f7', 'cotizacion_aprobada', '00000000-0000-0000-0000-0000000000a2', now() - interval '58 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'programada_diseno',   '00000000-0000-0000-0000-0000000000a2', now() - interval '56 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'ficha_adjunta',       '00000000-0000-0000-0000-0000000000a3', now() - interval '54 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'tela_programada',     '00000000-0000-0000-0000-0000000000a2', now() - interval '50 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'corte_completado',    '00000000-0000-0000-0000-0000000000a4', now() - interval '40 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'recogido_bordado',    '00000000-0000-0000-0000-0000000000a5', now() - interval '30 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'llegada_marcacion',   '00000000-0000-0000-0000-0000000000a6', now() - interval '20 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'lista_despacho',      '00000000-0000-0000-0000-0000000000a6', now() - interval '14 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'etiquetas',           '00000000-0000-0000-0000-0000000000a2', now() - interval '13 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'documentos_despacho', '00000000-0000-0000-0000-0000000000a2', now() - interval '12 days', null),
  ('00000000-0000-0000-0000-0000000000f7', 'factura_generada',    '00000000-0000-0000-0000-0000000000a2', now() - interval '11 days', 'Factura FV-2214'),
  ('00000000-0000-0000-0000-0000000000f7', 'cerrada',             '00000000-0000-0000-0000-0000000000a2', now() - interval '11 days', 'Despachada y facturada');

-- ---------------------------------------------------------------------------
-- Fichas técnicas
-- ---------------------------------------------------------------------------
-- La ruta apunta a Storage; el archivo no existe en la base local, pero sirve
-- para que HU-04 tenga contra qué probar la lectura.

insert into public.ficha_tecnica (orden_id, archivo_ruta, subida_por) values
  ('00000000-0000-0000-0000-0000000000f3', 'fichas/00000000-0000-0000-0000-0000000000f3/ficha-polo-verde.pdf', '00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000f6', 'fichas/00000000-0000-0000-0000-0000000000f6/ficha-quirurgicos.pdf', '00000000-0000-0000-0000-0000000000a3');

-- ---------------------------------------------------------------------------
-- Lotes a taller
-- ---------------------------------------------------------------------------
-- Uno todavía afuera, para que HU-11 tenga qué confirmar, y uno ya recibido
-- incompleto, que es el caso que HU-11 tiene que saber mostrar.

insert into public.lote_taller (
  orden_id, taller, descripcion_prendas, fecha_envio, enviado_por,
  recibido_completo, fecha_recepcion, recibido_por, observaciones_recepcion
) values
  ('00000000-0000-0000-0000-0000000000f3', 'Taller Marinilla Centro', '250 polos verdes talla S y M', now() - interval '5 days', '00000000-0000-0000-0000-0000000000a5', null, null, null, null),
  ('00000000-0000-0000-0000-0000000000f4', 'Confecciones El Retiro',  '120 overoles completos',       now() - interval '12 days', '00000000-0000-0000-0000-0000000000a5', false, now() - interval '5 days', '00000000-0000-0000-0000-0000000000a5', 'Llegaron 115; faltan 5 talla XL');

-- ---------------------------------------------------------------------------
-- Alertas
-- ---------------------------------------------------------------------------

insert into public.alerta (tipo, orden_id, destinatario_id, detalle, estado, fecha_creacion, fecha_atencion) values
  ('falta_tela',         '00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000a2', 'La tela antifluidos lleva 3 semanas sin llegar', 'pendiente', now() - interval '7 days', null),
  ('proximidad_entrega', '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 'Entrega en 2 días y el lote del taller llegó incompleto', 'pendiente', now() - interval '1 day', null),
  ('proximidad_entrega', '00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000a1', 'Entrega la próxima semana', 'atendida', now() - interval '25 days', now() - interval '24 days');
