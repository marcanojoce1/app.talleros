-- ============================================================
-- TallerOS — Esquema de base de datos (PostgreSQL)
-- Ejecutar:  psql -U postgres -d talleros -f schema.sql
-- ============================================================

-- Limpieza (opcional, para reinstalar desde cero)
DROP TABLE IF EXISTS notificaciones, media, danos, recepciones, ordenes,
  citas, vehiculos, clientes, mecanicos, usuarios, config_catalogo, config CASCADE;

-- ---------- USUARIOS Y ACCESOS ----------
CREATE TABLE usuarios (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  usuario     TEXT UNIQUE NOT NULL,
  correo      TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,                      -- hash bcrypt
  rol         TEXT NOT NULL CHECK (rol IN ('administrador','mecanico','cliente')),
  telefono    TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  twofa       BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tokens de recuperación de contraseña (código por correo / WhatsApp)
CREATE TABLE reset_codes (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo      TEXT NOT NULL,
  metodo      TEXT NOT NULL CHECK (metodo IN ('correo','whatsapp')),
  expira_en   TIMESTAMPTZ NOT NULL,
  usado       BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------- CLIENTES ----------
CREATE TABLE clientes (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  tipo_doc    TEXT,                               -- Cédula V, RIF, etc.
  documento   TEXT,
  telefono    TEXT,
  correo      TEXT,
  direccion   TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- MECÁNICOS ----------
CREATE TABLE mecanicos (
  id            BIGSERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  especialidad  TEXT,
  documento     TEXT,
  telefono      TEXT,
  rating        INT DEFAULT 5,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- VEHÍCULOS ----------
CREATE TABLE vehiculos (
  id            BIGSERIAL PRIMARY KEY,
  cliente_id    BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  marca         TEXT,
  modelo        TEXT,
  anio          TEXT,
  placa         TEXT,
  color         TEXT,
  tipo_seguro   TEXT,
  nro_poliza    TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- ÓRDENES DE TALLER ----------
CREATE TABLE ordenes (
  id            BIGSERIAL PRIMARY KEY,
  vehiculo_id   BIGINT REFERENCES vehiculos(id) ON DELETE CASCADE,
  mecanico_id   BIGINT REFERENCES mecanicos(id) ON DELETE SET NULL,
  estado        TEXT NOT NULL DEFAULT 'espera'
                CHECK (estado IN ('espera','en_proceso','espera_repuesto',
                                  'reprogramado','terminado','devolucion','entregado')),
  motivo        TEXT,
  trabajo       TEXT,
  prioridad     TEXT DEFAULT 'Media',
  avance        INT  DEFAULT 0,
  costo         NUMERIC(14,2) DEFAULT 0,
  ingreso_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  cierre        TEXT,
  cerrado_en    TIMESTAMPTZ
);

-- ---------- RECEPCIONES (acta de ingreso) ----------
CREATE TABLE recepciones (
  id            BIGSERIAL PRIMARY KEY,
  orden_id      BIGINT REFERENCES ordenes(id) ON DELETE CASCADE,
  motivo        TEXT,
  trabajo       TEXT,
  prioridad     TEXT,
  combustible   TEXT,
  km            TEXT,
  accesorios    JSONB DEFAULT '[]',
  documentos    JSONB DEFAULT '[]',
  observaciones TEXT,
  firma_cliente BOOLEAN DEFAULT FALSE,
  firma_recep   BOOLEAN DEFAULT FALSE,
  via           TEXT,                              -- 'App 3D' | 'Web 2D'
  editada       BOOLEAN DEFAULT FALSE,
  editada_en    TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- DAÑOS REGISTRADOS EN RECEPCIÓN ----------
CREATE TABLE danos (
  id            BIGSERIAL PRIMARY KEY,
  recepcion_id  BIGINT REFERENCES recepciones(id) ON DELETE CASCADE,
  numero        INT,
  tipo          TEXT,
  severidad     TEXT,                              -- leve | mod | grave
  ubicacion     TEXT
);

-- ---------- MEDIA (fotos / videos del trabajo) ----------
CREATE TABLE media (
  id            BIGSERIAL PRIMARY KEY,
  orden_id      BIGINT REFERENCES ordenes(id) ON DELETE CASCADE,
  tipo          TEXT CHECK (tipo IN ('foto','video')),
  url           TEXT NOT NULL,
  autor         TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- CITAS ----------
CREATE TABLE citas (
  id            BIGSERIAL PRIMARY KEY,
  cliente_id    BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
  vehiculo_id   BIGINT REFERENCES vehiculos(id) ON DELETE SET NULL,
  tipo          TEXT,
  fecha         DATE,
  hora          TEXT,
  estado        TEXT DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','aprobada','rechazada')),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- NOTIFICACIONES ----------
CREATE TABLE notificaciones (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  texto         TEXT NOT NULL,
  leida         BOOLEAN DEFAULT FALSE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- CONFIGURACIÓN (moneda) ----------
CREATE TABLE config (
  id            INT PRIMARY KEY DEFAULT 1,
  moneda_sym    TEXT DEFAULT 'Bs.',
  moneda_nombre TEXT DEFAULT 'Bolívar',
  moneda_codigo TEXT DEFAULT 'VES',
  CHECK (id = 1)
);

-- ---------- CATÁLOGOS (documentos, seguros, motivos, trabajos, marcas) ----------
CREATE TABLE config_catalogo (
  id            BIGSERIAL PRIMARY KEY,
  tipo          TEXT NOT NULL,                     -- doc | seguro | motivo | trabajo | marca
  valor         TEXT NOT NULL,
  extra         JSONB DEFAULT '{}'                 -- para marca: { "modelos": [...] }
);

-- ---------- ESTADO COMPLETO DE LA APP (documento JSON) ----------
CREATE TABLE IF NOT EXISTS app_state (
  id         INT PRIMARY KEY DEFAULT 1,
  data       JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);

-- ---------- ÍNDICES ----------
CREATE INDEX idx_veh_cliente   ON vehiculos(cliente_id);
CREATE INDEX idx_ord_estado    ON ordenes(estado);
CREATE INDEX idx_ord_vehiculo  ON ordenes(vehiculo_id);
CREATE INDEX idx_media_orden   ON media(orden_id);
CREATE INDEX idx_notif_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_cat_tipo      ON config_catalogo(tipo);
