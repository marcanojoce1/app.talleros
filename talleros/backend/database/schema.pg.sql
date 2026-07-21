-- Esquema de TallerOS para SQLite (versión local, sin servidor de base de datos)


CREATE TABLE IF NOT EXISTS usuarios (
  id        SERIAL PRIMARY KEY,
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
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reset_codes (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  codigo     TEXT NOT NULL,
  metodo     TEXT NOT NULL,
  expira_en  TEXT NOT NULL,
  usado      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clientes (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  tipo_doc  TEXT,
  documento TEXT,
  telefono  TEXT,
  correo    TEXT,
  direccion TEXT,
  activo    INTEGER NOT NULL DEFAULT 1,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mecanicos (
  id           SERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL,
  especialidad TEXT,
  documento    TEXT,
  telefono     TEXT,
  rating       INTEGER DEFAULT 5,
  activo       INTEGER NOT NULL DEFAULT 1,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id          SERIAL PRIMARY KEY,
  cliente_id  INTEGER REFERENCES clientes(id),
  marca       TEXT,
  modelo      TEXT,
  anio        TEXT,
  placa       TEXT,
  color       TEXT,
  tipo_seguro TEXT,
  nro_poliza  TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordenes (
  id          SERIAL PRIMARY KEY,
  vehiculo_id INTEGER REFERENCES vehiculos(id),
  mecanico_id INTEGER REFERENCES mecanicos(id),
  estado      TEXT NOT NULL DEFAULT 'espera',
  motivo      TEXT,
  trabajo     TEXT,
  prioridad   TEXT DEFAULT 'Media',
  avance      INTEGER DEFAULT 0,
  costo       DOUBLE PRECISION DEFAULT 0,
  ingreso_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  cierre      TEXT,
  cerrado_en  TEXT
);

CREATE TABLE IF NOT EXISTS recepciones (
  id            SERIAL PRIMARY KEY,
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
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS danos (
  id           SERIAL PRIMARY KEY,
  recepcion_id INTEGER REFERENCES recepciones(id),
  numero       INTEGER,
  tipo         TEXT,
  severidad    TEXT,
  ubicacion    TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id        SERIAL PRIMARY KEY,
  orden_id  INTEGER REFERENCES ordenes(id),
  tipo      TEXT,
  url       TEXT NOT NULL,
  autor     TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS citas (
  id          SERIAL PRIMARY KEY,
  cliente_id  INTEGER REFERENCES clientes(id),
  vehiculo_id INTEGER REFERENCES vehiculos(id),
  tipo        TEXT,
  fecha       TEXT,
  hora        TEXT,
  estado      TEXT DEFAULT 'pendiente',
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  texto      TEXT NOT NULL,
  leida      INTEGER DEFAULT 0,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS config (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  moneda_sym    TEXT DEFAULT 'Bs.',
  moneda_nombre TEXT DEFAULT 'Bolívar',
  moneda_codigo TEXT DEFAULT 'VES'
);

CREATE TABLE IF NOT EXISTS config_catalogo (
  id    SERIAL PRIMARY KEY,
  tipo  TEXT NOT NULL,
  valor TEXT NOT NULL,
  extra TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS talleres (
  id        SERIAL PRIMARY KEY,
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
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS taller_admins (
  taller_id  INTEGER NOT NULL REFERENCES talleres(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  PRIMARY KEY (taller_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS app_state (
  taller_id  INTEGER PRIMARY KEY REFERENCES talleres(id),
  data       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veh_cliente   ON vehiculos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ord_estado    ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ord_vehiculo  ON ordenes(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_media_orden   ON media(orden_id);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cat_tipo      ON config_catalogo(tipo);

CREATE TABLE IF NOT EXISTS auditoria (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER,
  usuario_nombre TEXT,
  rol            TEXT,
  accion         TEXT,
  modulo         TEXT,
  detalle        TEXT,
  ip             TEXT,
  dispositivo    TEXT,
  taller_id      INTEGER,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT now()
);
