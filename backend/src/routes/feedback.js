// Rutas: /api/feedback — comentarios de los testers (prueba cerrada de Google Play).
// POST /api/feedback  (público)  -> guarda un comentario (con límite anti-spam por IP).
// GET  /api/feedback  (superadmin) -> lista los comentarios recibidos.
const express = require('express');
const { query } = require('../db');
const { auth, requireRole } = require('../auth');

const router = express.Router();

let tablaLista = null;
function asegurarTabla() {
  if (!tablaLista) {
    const pg = !!process.env.DATABASE_URL;
    const sql = pg
      ? `CREATE TABLE IF NOT EXISTS comentarios_prueba (
          id SERIAL PRIMARY KEY, nombre TEXT, contacto TEXT, tipo TEXT, rol TEXT,
          dispositivo TEXT, mensaje TEXT NOT NULL, ip TEXT, fecha TIMESTAMPTZ DEFAULT now())`
      : `CREATE TABLE IF NOT EXISTS comentarios_prueba (
          id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, contacto TEXT, tipo TEXT, rol TEXT,
          dispositivo TEXT, mensaje TEXT NOT NULL, ip TEXT, fecha TEXT DEFAULT CURRENT_TIMESTAMP)`;
    tablaLista = query(sql).catch((e) => { tablaLista = null; throw e; });
  }
  return tablaLista;
}

// Límite simple en memoria: máx. 8 comentarios por IP cada 10 minutos.
const intentos = new Map();
function limite(ip) {
  const ahora = Date.now();
  const lista = (intentos.get(ip) || []).filter((t) => ahora - t < 10 * 60 * 1000);
  if (lista.length >= 8) { intentos.set(ip, lista); return false; }
  lista.push(ahora); intentos.set(ip, lista);
  if (intentos.size > 5000) intentos.clear();
  return true;
}
const corta = (v, n) => (v == null ? '' : String(v).trim().slice(0, n));

router.post('/', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  if (!limite(ip)) return res.status(429).json({ error: 'Has enviado muchos comentarios seguidos. Intenta de nuevo en unos minutos.' });
  const b = req.body || {};
  if (b.web) return res.json({ ok: true }); // campo trampa anti-bots
  const mensaje = corta(b.mensaje, 3000);
  if (mensaje.length < 3) return res.status(400).json({ error: 'Escribe tu comentario' });
  await asegurarTabla();
  await query(
    'INSERT INTO comentarios_prueba (nombre, contacto, tipo, rol, dispositivo, mensaje, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [corta(b.nombre, 100), corta(b.contacto, 150), corta(b.tipo, 30), corta(b.rol, 30), corta(b.dispositivo, 120), mensaje, ip]
  );
  // Aviso por correo (si el envío está configurado). Si falla, el comentario ya quedó guardado.
  try {
    if (process.env.RESEND_API_KEY || process.env.SMTP_HOST) {
      const { sendEmail } = require('../services/email');
      const para = process.env.FEEDBACK_TO || 'soporte@mjservices.app';
      await sendEmail(para, 'Nuevo comentario de prueba TallerOS',
        `Tipo: ${corta(b.tipo, 30)}\nRol: ${corta(b.rol, 30)}\nNombre: ${corta(b.nombre, 100)}\nContacto: ${corta(b.contacto, 150)}\nDispositivo: ${corta(b.dispositivo, 120)}\n\n${mensaje}`);
    }
  } catch (e) { console.error('[feedback] correo:', e.message); }
  res.json({ ok: true });
});

router.get('/', auth, requireRole('superadmin'), async (req, res) => {
  await asegurarTabla();
  const { rows } = await query('SELECT * FROM comentarios_prueba ORDER BY id DESC LIMIT 500');
  res.json(rows);
});

module.exports = router;
