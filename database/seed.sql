-- ============================================================
-- TallerOS — Datos de ejemplo (Venezuela)
-- Ejecutar DESPUÉS de schema.sql:
--   psql -U postgres -d talleros -f seed.sql
-- Nota: los USUARIOS con contraseña se crean con `npm run seed`
--       (backend) porque requieren hash bcrypt.
-- ============================================================

-- Configuración de moneda
INSERT INTO config (id, moneda_sym, moneda_nombre, moneda_codigo)
VALUES (1, 'Bs.', 'Bolívar', 'VES')
ON CONFLICT (id) DO NOTHING;

-- Catálogos
INSERT INTO config_catalogo (tipo, valor) VALUES
 ('doc','Cédula V'),('doc','Cédula E'),('doc','RIF'),('doc','Pasaporte'),
 ('seguro','RCV'),('seguro','Cobertura Amplia'),('seguro','APS'),('seguro','Sin seguro'),
 ('motivo','Mantenimiento programado'),('motivo','Ruido anormal'),('motivo','Falla intermitente'),
 ('motivo','Pérdida de potencia'),('motivo','Fuga de fluido'),('motivo','Luz de tablero encendida'),
 ('motivo','Frenado deficiente'),('motivo','Sobrecalentamiento'),('motivo','Choque / golpe'),
 ('trabajo','Cambio de aceite'),('trabajo','Frenos'),('trabajo','Suspensión'),('trabajo','Embrague'),
 ('trabajo','Diagnóstico'),('trabajo','Sistema eléctrico'),('trabajo','Mantenimiento preventivo'),
 ('trabajo','Mantenimiento correctivo'),('trabajo','Pintura y carrocería');

INSERT INTO config_catalogo (tipo, valor, extra) VALUES
 ('marca','Toyota','{"modelos":["Hilux","Corolla","Yaris","Fortuner","4Runner","Camry"]}'),
 ('marca','Chevrolet','{"modelos":["Aveo","Optra","Captiva","Silverado","Cruze","Spark"]}'),
 ('marca','Hyundai','{"modelos":["Tucson","Accent","Elantra","Santa Fe","Getz"]}'),
 ('marca','Kia','{"modelos":["Sportage","Rio","Sorento","Picanto","Cerato"]}'),
 ('marca','Ford','{"modelos":["Fiesta","Explorer","F-150","EcoSport","Focus"]}'),
 ('marca','Nissan','{"modelos":["Sentra","Frontier","X-Trail","Versa","Tiida"]}');

-- Clientes
INSERT INTO clientes (nombre, tipo_doc, documento, telefono, correo, direccion) VALUES
 ('Carlos Mendoza','Cédula V','V-12.345.678','+58 412 555 0134','carlos.m@gmail.com','Av. Bolívar, Caracas'),
 ('Ana Quispe','Cédula V','V-18.220.115','+58 414 555 0290','ana.q@gmail.com','Calle 5, Maracaibo'),
 ('Roberto Salas','RIF','J-40551223-7','+58 424 555 0771','r.salas@empresa.com','Urb. La Viña, Valencia'),
 ('Miguel Torres','Cédula V','V-9.880.442','+58 412 555 0908','m.torres@gmail.com','Av. Las Delicias, Maracay');

-- Mecánicos
INSERT INTO mecanicos (nombre, especialidad, documento, telefono, rating) VALUES
 ('Diego Cárdenas','Motor y transmisión','V-14.500.221','+58 412 333 1001',5),
 ('Jorge Ramos','Frenos y suspensión','V-16.220.554','+58 414 333 1002',4),
 ('Andrés Pinto','Diagnóstico general','V-12.998.110','+58 424 333 1003',4),
 ('Elena Vargas','Sistema eléctrico','V-19.443.872','+58 412 333 1004',5);

-- Vehículos
INSERT INTO vehiculos (cliente_id, marca, modelo, anio, placa, color, tipo_seguro, nro_poliza) VALUES
 (1,'Toyota','Hilux','2021','ABC-742','Plata','RCV','RCV-00128'),
 (3,'Kia','Sportage','2020','JKL-330','Blanco','Cobertura Amplia','CA-55012'),
 (2,'Nissan','Sentra','2019','DEF-115','Gris','RCV','RCV-00210');

-- Una orden de ejemplo en proceso
INSERT INTO ordenes (vehiculo_id, mecanico_id, estado, motivo, trabajo, prioridad, avance, costo)
VALUES (1,1,'en_proceso','Ruido anormal','Frenos','Alta',40, 1850.00);
