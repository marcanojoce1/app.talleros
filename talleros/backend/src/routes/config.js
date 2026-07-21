// Rutas: configuración (moneda) y catálogos (documentos, seguros, motivos, trabajos, marcas)
const express = require('express');
const { query } = require('../db');
const { auth, requireRole } = require('../auth');

const router = express.Router();

// Configuración general (moneda) — pública para que apps muestren montos
router.get('/', auth, async (req, res) => {
  const cfg = await query('SELECT * FROM config WHERE id=1');
  const cat = await query('SELECT tipo, valor, extra FROM config_catalogo ORDER BY id');
  const grupos = {};
  for (const c of cat.rows) {
    let extra = {};
    try { extra = typeof c.extra === 'string' ? JSON.parse(c.extra) : (c.extra || {}); } catch { extra = {}; }
    (grupos[c.tipo] = grupos[c.tipo] || []).push(Object.keys(extra).length ? { valor: c.valor, ...extra } : c.valor);
  }
  res.json({ moneda: cfg.rows[0] || {}, catalogos: grupos });
});

// Actualizar moneda
router.put('/moneda', auth, requireRole('administrador'), async (req, res) => {
  const { moneda_sym, moneda_nombre, moneda_codigo } = req.body;
  const { rows } = await query(
    `UPDATE config SET moneda_sym=COALESCE($1,moneda_sym),
       moneda_nombre=COALESCE($2,moneda_nombre),
       moneda_codigo=COALESCE($3,moneda_codigo) WHERE id=1 RETURNING *`,
    [moneda_sym, moneda_nombre, moneda_codigo]
  );
  res.json(rows[0]);
});

// Agregar item a un catálogo  { tipo, valor, extra }
router.post('/catalogo', auth, requireRole('administrador'), async (req, res) => {
  const { tipo, valor, extra } = req.body;
  const { rows } = await query(
    'INSERT INTO config_catalogo (tipo,valor,extra) VALUES ($1,$2,$3) RETURNING *',
    [tipo, valor, JSON.stringify(extra || {})]
  );
  res.status(201).json(rows[0]);
});

// Eliminar item de catálogo
router.delete('/catalogo/:id', auth, requireRole('administrador'), async (req, res) => {
  await query('DELETE FROM config_catalogo WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
