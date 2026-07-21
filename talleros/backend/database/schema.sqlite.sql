-- Esquema de TallerOS para SQLite (versión local, sin servidor de base de datos)

DROP TABLE IF EXISTS notificaciones;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS danos;
DROP TABLE IF EXISTS recepciones;
DROP TABLE IF EXISTS ordenes;
DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS vehiculos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS mecanicos;
DROP TABLE IF EXISTS reset_codes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS config_catalogo;
DROP TABLE IF EXISTS config;

CREATE TABLE usuarios (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  usuario   TEXT UNIQUE NOT NULL,
  correo    TEXT UNIQUE NOT NULL,
  password  TEXT NOT NULL,
  rol       TEXT NOT NULL CHECK (rol IN ('superadmin','administrador','mecanico','cliente')),
  telefono  TEXT,
  activo    INTEGER NOT NULL DEFAULT 1,
  twofa     INTEGER NOT NULL DEFAULT 0,
  taller_id INTEGER,
  permisos  TEXT,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reset_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  codigo     TEXT NOT NULL,
  metodo     TEXT NOT NULL,
  expira_en  TEXT NOT NULL,
  usado      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE clientes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  tipo_doc  TEXT,
  documento TEXT,
  telefono  TEXT,
  correo    TEXT,
  direccion TEXT,
  activo    INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mecanicos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT NOT NULL,
  especialidad TEXT,
  documento    TEXT,
  telefono     TEXT,
  rating       INTEGER DEFAULT 5,
  activo       INTEGER NOT NULL DEFAULT 1,
  creado_en    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehiculos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id  INTEGER REFERENCES clientes(id),
  marca       TEXT,
  modelo      TEXT,
  anio        TEXT,
  placa       TEXT,
  color       TEXT,
  tipo_seguro TEXT,
  nro_poliza  TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ordenes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id INTEGER REFERENCES vehiculos(id),
  mecanico_id INTEGER REFERENCES mecanicos(id),
  estado      TEXT NOT NULL DEFAULT 'espera',
  motivo      TEXT,
  trabajo     TEXT,
  prioridad   TEXT DEFAULT 'Media',
  avance      INTEGER DEFAULT 0,
  costo       REAL DEFAULT 0,
  ingreso_en  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cierre      TEXT,
  cerrado_en  TEXT
);

CREATE TABLE recepciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id      INTEGER REFERENCES ordenes(id),
  motivo        TEXT,
  trabajo       TEXT,
  prioridad     TEXT,
  combustible   TEXT,
  km            TEXT,
  accesorios    TEXT DEFAULT '[]',
  documentos    TEXT DEFAULT '[]',
  observaciones TEXT,
  firma_cliente INTEGER DEFAULT 0,
  firma_recep   INTEGER DEFAULT 0,
  via           TEXT,
  editada       INTEGER DEFAULT 0,
  editada_en    TEXT,
  creado_en     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE danos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recepcion_id INTEGER REFERENCES recepciones(id),
  numero       INTEGER,
  tipo         TEXT,
  severidad    TEXT,
  ubicacion    TEXT
);

CREATE TABLE media (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id  INTEGER REFERENCES ordenes(id),
  tipo      TEXT,
  url       TEXT NOT NULL,
  autor     TEXT,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE citas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id  INTEGER REFERENCES clientes(id),
  vehiculo_id INTEGER REFERENCES vehiculos(id),
  tipo        TEXT,
  fecha       TEXT,
  hora        TEXT,
  estado      TEXT DEFAULT 'pendiente',
  creado_en   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notificaciones (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  texto      TEXT NOT NULL,
  leida      INTEGER DEFAULT 0,
  creado_en  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE config (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  moneda_sym    TEXT DEFAULT 'Bs.',
  moneda_nombre TEXT DEFAULT 'Bolívar',
  moneda_codigo TEXT DEFAULT 'VES'
);

CREATE TABLE config_catalogo (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo  TEXT NOT NULL,
  valor TEXT NOT NULL,
  extra TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS talleres (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  rif       TEXT,
  direccion TEXT,
  telefono  TEXT,
  logo      TEXT,
  rubro     TEXT,
  condiciones TEXT,
  pie       TEXT,
  activo    INTEGER NOT NULL DEFAULT 1,
  motivo_inactivo TEXT,
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taller_admins (
  taller_id  INTEGER NOT NULL REFERENCES talleres(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  PRIMARY KEY (taller_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS app_state (
  taller_id  INTEGER PRIMARY KEY REFERENCES talleres(id),
  data       TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_veh_cliente   ON vehiculos(cliente_id);
CREATE INDEX idx_ord_estado    ON ordenes(estado);
CREATE INDEX idx_ord_vehiculo  ON ordenes(vehiculo_id);
CREATE INDEX idx_media_orden   ON media(orden_id);
CREATE INDEX idx_notif_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_cat_tipo      ON config_catalogo(tipo);

CREATE TABLE IF NOT EXISTS auditoria (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id     INTEGER,
  usuario_nombre TEXT,
  rol            TEXT,
  accion         TEXT,
  modulo         TEXT,
  detalle        TEXT,
  ip             TEXT,
  dispositivo    TEXT,
  taller_id      INTEGER,
  fecha          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
