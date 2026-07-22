// Rutas: imágenes del carrusel de login (branding). GET público, PUT solo superadmin.
const express = require('express');
const { query } = require('../db');
const { auth, requireRole } = require('../auth');

const router = express.Router();
let _lista = null; // caché en memoria

async function asegurarTabla() {
  try { await query('CREATE TABLE IF NOT EXISTS branding (clave TEXT PRIMARY KEY, data TEXT)'); } catch (e) {}
}
async function leer() {
  await asegurarTabla();
  try {
    const r = await query("SELECT data FROM branding WHERE clave='loginImgs'");
    if (r.rows[0]) { let d = r.rows[0].data; return typeof d === 'string' ? JSON.parse(d) : (d || []); }
  } catch (e) {}
  return [];
}

router.get('/login-imgs', async (req, res) => {
  try { const imgs = await leer(); res.json({ imgs }); }
  catch (e) { res.json({ imgs: [] }); }
});

router.put('/login-imgs', auth, requireRole('superadmin'), async (req, res) => {
  const imgs = Array.isArray(req.body.imgs) ? req.body.imgs.slice(0, 8) : [];
  try {
    await asegurarTabla();
    const payload = JSON.stringify(imgs);
    const upd = await query("UPDATE branding SET data=$1 WHERE clave='loginImgs'", [payload]);
    const n = upd.rowCount != null ? upd.rowCount : (upd.changes || 0);
    if (!n) await query("INSERT INTO branding (clave, data) VALUES ('loginImgs', $1)", [payload]);
    res.json({ ok: true, total: imgs.length });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar: ' + e.message }); }
});

module.exports = router;
