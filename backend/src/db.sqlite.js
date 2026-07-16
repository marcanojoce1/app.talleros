// Base de datos LOCAL con SQLite (un archivo, sin instalar nada).
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'talleros.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

function sanitize(v) {
  if (v === true) return 1;
  if (v === false) return 0;
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}
function translate(text, params) {
  const args = [];
  let sql = text.replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP');
  sql = sql.replace(/\$(\d+)/g, (_, n) => { args.push(sanitize(params[Number(n) - 1])); return '?'; });
  return { sql, args };
}
async function query(text, params = []) {
  const t = text.trim().toUpperCase();
  if (t === 'BEGIN' || t === 'COMMIT' || t === 'ROLLBACK') return { rows: [] };
  const { sql, args } = translate(text, params);
  const stmt = db.prepare(sql);
  const isRead = /^\s*(SELECT|WITH)/i.test(text) || /RETURNING/i.test(text);
  if (isRead) { const rows = stmt.all(...args); return { rows, rowCount: rows.length }; }
  const info = stmt.run(...args);
  return { rows: [], rowCount: Number(info.changes), lastID: info.lastInsertRowid };
}
const pool = { query, connect: async () => ({ query, release: () => {} }), end: async () => db.close() };

async function init() {
  let existe = false;
  try { db.prepare('SELECT 1 FROM usuarios LIMIT 1').get(); existe = true; } catch { existe = false; }
  if (existe) {
    try { db.exec('ALTER TABLE usuarios ADD COLUMN taller_id INTEGER'); } catch (e) {}
    try { db.exec('ALTER TABLE usuarios ADD COLUMN permisos TEXT'); } catch (e) {}
    try { db.exec('ALTER TABLE talleres ADD COLUMN rubro TEXT'); } catch (e) {}
    try { db.exec('ALTER TABLE talleres ADD COLUMN condiciones TEXT'); } catch (e) {}
    try { db.exec('ALTER TABLE talleres ADD COLUMN pie TEXT'); } catch (e) {}
    try { db.exec('CREATE TABLE IF NOT EXISTS auditoria (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER, usuario_nombre TEXT, rol TEXT, accion TEXT, modulo TEXT, detalle TEXT, ip TEXT, dispositivo TEXT, taller_id INTEGER, fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'); } catch (e) {}
    return;
  }
  console.log('Base de datos nueva (SQLite): creando tablas y datos de ejemplo...');
  const cand = [path.join(__dirname, '..', 'database'), path.join(__dirname, '..', '..', 'database')];
  const dir = cand.find((d) => fs.existsSync(path.join(d, 'schema.sqlite.sql'))) || cand[0];
  db.exec(fs.readFileSync(path.join(dir, 'schema.sqlite.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
  const hash = await bcrypt.hash('super1234', 10);
  db.prepare('INSERT INTO usuarios (nombre,usuario,correo,password,rol,telefono) VALUES (?,?,?,?,?,?)')
    .run('Super Administrador', 'superadmin', 'super@talleros.ve', hash, 'superadmin', '+58 000 000 0000');
  console.log('Base lista (SQLite). Super Admin -> usuario: superadmin  clave: super1234');
}

module.exports = { pool, query, db, init };
