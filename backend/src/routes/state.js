// Ruta: /api/state — estado completo de CADA taller (documento JSON independiente).
const express = require('express');
const { query, db } = require('../db');
const { auth } = require('../auth');

const router = express.Router();
router.use(auth); // requiere sesión

// ¿Puede el usuario acceder a este taller?
// escritura=true exige permiso para modificar (el cliente solo consulta).
async function puedeAcceder(user, tallerId, escritura = false) {
  if (user.rol === 'superadmin') return true;
  if (user.rol === 'administrador') {
    const r = await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [tallerId, user.id]);
    return !!r.rows[0];
  }
  if (user.rol === 'mecanico' || user.rol === 'cliente') {
    const r = await query('SELECT taller_id FROM usuarios WHERE id=$1', [user.id]);
    const suyo = r.rows[0] && Number(r.rows[0].taller_id) === Number(tallerId);
    if (!suyo) return false;
    if (escritura && user.rol === 'cliente') return false; // el cliente no modifica
    return true;
  }
  return false;
}

// GET /api/state/mi-taller — devuelve el taller del mecánico/cliente.
// Si la cuenta es vieja y no tiene taller_id, lo busca en los datos de los talleres y lo repara.
router.get('/mi-taller', async (req, res) => {
  const u = req.user;
  if (u.rol === 'superadmin' || u.rol === 'administrador') {
    return res.json({ taller: null, motivo: 'Este rol elige taller de otra forma' });
  }
  // 1) ¿ya tiene taller_id?
  let row = (await query('SELECT taller_id, nombre FROM usuarios WHERE id=$1', [u.id])).rows[0];
  if (row && row.taller_id) {
    const t = (await query('SELECT id, nombre, activo, logo FROM talleres WHERE id=$1', [row.taller_id])).rows[0];
    if (t) return res.json({ taller: t });
  }
  // 2) Reparar: buscar en app_state de cada taller un cliente/mecánico con su nombre
  const nombre = (row && row.nombre) || u.nombre || '';
  const estados = (await query('SELECT taller_id, data FROM app_state')).rows;
  for (const e of estados) {
    let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
    const lista = u.rol === 'mecanico' ? (d.mecanicos || []) : (d.clients || []);
    const hit = lista.find((x) => (x.n || '').toLowerCase() === nombre.toLowerCase() || (x.usuario || '') === u.usuario);
    if (hit) {
      await query('UPDATE usuarios SET taller_id=$2 WHERE id=$1', [u.id, e.taller_id]);
      const t = (await query('SELECT id, nombre, activo, logo FROM talleres WHERE id=$1', [e.taller_id])).rows[0];
      return res.json({ taller: t, reparado: true });
    }
  }
  // 3) Si solo hay un taller, asignarlo por defecto
  const todos = (await query('SELECT id, nombre, activo, logo FROM talleres WHERE activo=1')).rows;
  if (todos.length === 1) {
    await query('UPDATE usuarios SET taller_id=$2 WHERE id=$1', [u.id, todos[0].id]);
    return res.json({ taller: todos[0], reparado: true });
  }
  res.json({ taller: null, motivo: 'Tu cuenta no está ligada a ningún taller' });
});

// GET /api/state?taller=ID
router.get('/', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (!(await puedeAcceder(req.user, tallerId))) return res.status(403).json({ error: 'Sin acceso a este taller' });
  const { rows } = await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId]);
  let data = null;
  if (rows[0] && rows[0].data) { try { data = JSON.parse(rows[0].data); } catch { data = null; } }
  res.json({ data });
});

// PUT /api/state?taller=ID   { data: {...} }
router.put('/', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (!(await puedeAcceder(req.user, tallerId, true))) return res.status(403).json({ error: 'Sin permiso para modificar este taller' });
  const data = JSON.stringify(req.body.data || {});
  await query(
    `INSERT INTO app_state (taller_id, data, updated_at) VALUES ($1,$2,CURRENT_TIMESTAMP)
     ON CONFLICT (taller_id) DO UPDATE SET data=$2, updated_at=CURRENT_TIMESTAMP`,
    [tallerId, data]);
  res.json({ ok: true });
});

// POST /api/state/mis-notifs-leidas?taller=ID — el cliente/mecánico marca SUS avisos como leídos
// (no requiere permiso de escritura completa; solo toca sus propias notificaciones)
router.post('/mis-notifs-leidas', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (!(await puedeAcceder(req.user, tallerId, false))) return res.status(403).json({ error: 'Sin acceso a este taller' });
  const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
  if (!st) return res.json({ ok: true });
  let d = st.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  const nombre = req.user.nombre || '';
  d.notifs = (d.notifs || []).map((n) => (n.owner === nombre ? { ...n, read: true } : n));
  await query('UPDATE app_state SET data=$2, updated_at=CURRENT_TIMESTAMP WHERE taller_id=$1', [tallerId, JSON.stringify(d)]);
  res.json({ ok: true });
});

// POST /api/state/mi-autorizacion?taller=ID — cliente autoriza/deniega un trabajo adicional
router.post('/mi-autorizacion', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (!(await puedeAcceder(req.user, tallerId, false))) return res.status(403).json({ error: 'Sin acceso' });
  const { vehId, texto, autorizado } = req.body || {};
  const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
  if (!st) return res.json({ ok: true });
  let d = st.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  const nombre = req.user.nombre || '';
  d.vehicles = (d.vehicles || []).map((v) => {
    if (v.id !== vehId || v.owner !== nombre) return v;
    return { ...v, advances: (v.advances || []).map((a) => (a.type === 'atencion' && a.m === texto && !a.respondido ? { ...a, respondido: true, autorizado: !!autorizado } : a)) };
  });
  // Notificar al taller (aparece como aviso en la web)
  d.notifs = [...(d.notifs || []), { owner: '__taller__', veh: '', text: (autorizado ? '✓ Cliente AUTORIZÓ' : '✕ Cliente DENEGÓ') + ' un trabajo adicional', time: 'ahora', read: false }];
  await query('UPDATE app_state SET data=$2, updated_at=CURRENT_TIMESTAMP WHERE taller_id=$1', [tallerId, JSON.stringify(d)]);
  res.json({ ok: true });
});

// DELETE /api/state?taller=ID  (reiniciar ese taller)
router.delete('/', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (req.user.rol !== 'superadmin' && req.user.rol !== 'administrador') return res.status(403).json({ error: 'Sin permiso' });
  if (!(await puedeAcceder(req.user, tallerId, true))) return res.status(403).json({ error: 'Sin permiso' });
  await query('DELETE FROM app_state WHERE taller_id=$1', [tallerId]);
  res.json({ ok: true });
});

// POST /api/state/reset-total — SOLO superadmin. Borra todos los datos de prueba
// (talleres, estados, y usuarios que no sean superadmin). Conserva el superadmin.
router.post('/reset-total', async (req, res) => {
  if (req.user.rol !== 'superadmin') return res.status(403).json({ error: 'Solo el superadmin puede reiniciar todo' });
  try {
    await query('DELETE FROM app_state');
    await query('DELETE FROM taller_admins');
    try { await query('DELETE FROM auditoria'); } catch (e) {}
    await query("DELETE FROM usuarios WHERE rol <> 'superadmin'");
    await query('DELETE FROM talleres');
    res.json({ ok: true, mensaje: 'Todos los datos de prueba fueron borrados. Solo queda tu cuenta de superadmin.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
