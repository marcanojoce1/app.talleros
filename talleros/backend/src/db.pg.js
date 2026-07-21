// Base de datos PERMANENTE con PostgreSQL (para producción, ej. Render).
// Se activa automáticamente cuando existe la variable de entorno DATABASE_URL.
try { require('dotenv').config(); } catch (e) {}
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url && !url.includes('localhost') && !url.includes('127.0.0.1') ? { rejectUnauthorized: false } : false,
});

// Ajusta valores JS a los tipos que espera la base (igual criterio que el modo SQLite)
function sanitize(v) {
  if (v === true) return 1;
  if (v === false) return 0;
  if (v === undefined) return null;
  if (v instanceof Date) return v; // PostgreSQL maneja Date nativamente
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}
async function query(text, params = []) {
  return pool.query(text, (params || []).map(sanitize));
}

async function init() {
  const cand = [path.join(__dirname, '..', 'database'), path.join(__dirname, '..', '..', 'database')];
  const dir = cand.find((d) => fs.existsSync(path.join(d, 'schema.pg.sql'))) || cand[0];
  const schema = fs.readFileSync(path.join(dir, 'schema.pg.sql'), 'utf8');
  await pool.query(schema);
  // Migración para bases ya existentes: agrega la columna si falta (no borra datos)
  await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS taller_id INTEGER');
  await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos TEXT');
  await pool.query('ALTER TABLE talleres ADD COLUMN IF NOT EXISTS rubro TEXT');
  await pool.query('ALTER TABLE talleres ADD COLUMN IF NOT EXISTS condiciones TEXT');
  await pool.query('ALTER TABLE talleres ADD COLUMN IF NOT EXISTS pie TEXT');
  const r = await pool.query('SELECT 1 FROM usuarios LIMIT 1');
  if (r.rows.length) { console.log('Base PostgreSQL lista (ya tenía datos).'); return; }
  const hash = await bcrypt.hash('super1234', 10);
  await pool.query(
    'INSERT INTO usuarios (nombre,usuario,correo,password,rol,telefono) VALUES ($1,$2,$3,$4,$5,$6)',
    ['Super Administrador', 'superadmin', 'super@talleros.ve', hash, 'superadmin', '+58 000 000 0000']);
  console.log('Base lista (PostgreSQL). Super Admin -> usuario: superadmin  clave: super1234');
}

module.exports = { pool, query, db: null, init };
