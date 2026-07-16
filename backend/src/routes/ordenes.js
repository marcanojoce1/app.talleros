// Rutas: órdenes de taller, recepciones, daños, media, citas, notificaciones
const express = require('express');
const path = require('path');
const multer = require('multer');
const { query, pool } = require('../db');
const { auth, requireRole } = require('../auth');
const { sendWhatsApp } = require('../services/whatsapp');

const router = express.Router();

const ESTADOS = ['espera', 'en_proceso', 'espera_repuesto', 'reprogramado', 'terminado', 'devolucion', 'entregado'];

// Notifica al cliente del vehículo de la orden (WhatsApp) y guarda notificación
async function notificarCliente(ordenId, texto) {
  const { rows } = await query(
    `SELECT c.telefono, u.id AS usuario_id
     FROM ordenes o JOIN vehiculos v ON v.id=o.vehiculo_id
     JOIN clientes c ON c.id=v.cliente_id
     LEFT JOIN usuarios u ON u.correo=c.correo
     WHERE o.id=$1`, [ordenId]
  );
  const info = rows[0];
  if (info?.telefono) { try { await sendWhatsApp(info.telefono, texto); } catch (e) { console.error(e.message); } }
  if (info?.usuario_id) await query('INSERT INTO notificaciones (usuario_id,texto) VALUES ($1,$2)', [info.usuario_id, texto]);
}

// ---------- ÓRDENES ----------
router.get('/ordenes', auth, async (req, res) => {
  const { rows } = await query(
    `SELECT o.*, v.marca, v.modelo, v.placa, c.nombre AS cliente, m.nombre AS mecanico
     FROM ordenes o
     JOIN vehiculos v ON v.id=o.vehiculo_id
     LEFT JOIN clientes c ON c.id=v.cliente_id
     LEFT JOIN mecanicos m ON m.id=o.mecanico_id
     ORDER BY o.ingreso_en DESC`
  );
  res.json(rows);
});

router.post('/ordenes', auth, async (req, res) => {
  const { vehiculo_id, mecanico_id, motivo, trabajo, prioridad } = req.body;
  const { rows } = await query(
    `INSERT INTO ordenes (vehiculo_id,mecanico_id,motivo,trabajo,prioridad)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [vehiculo_id, mecanico_id || null, motivo, trabajo, prioridad || 'Media']
  );
  req.app.get('io')?.emit('cambio', { tabla: 'ordenes' });
  res.status(201).json(rows[0]);
});

// Cambiar estado de la orden
router.put('/ordenes/:id/estado', auth, async (req, res) => {
  const { estado, avance, costo } = req.body;
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  const cierre = ['terminado', 'devolucion'].includes(estado);
  const { rows } = await query(
    `UPDATE ordenes SET estado=$1,
        avance=COALESCE($2,avance),
        costo=COALESCE($3,costo),
        cierre=$4,
        cerrado_en=CASE WHEN $5 THEN now() ELSE cerrado_en END
     WHERE id=$6 RETURNING *`,
    [estado, avance ?? null, costo ?? null, cierre ? estado : null, cierre, req.params.id]
  );
  const labels = { en_proceso: 'En proceso', espera_repuesto: 'En espera de repuesto', reprogramado: 'Reprogramado', terminado: 'Terminado', devolucion: 'Devolución', entregado: 'Entregado', espera: 'En espera' };
  await notificarCliente(req.params.id, `Actualización de tu vehículo: ${labels[estado]}.`);
  req.app.get('io')?.emit('cambio', { tabla: 'ordenes' });
  res.json(rows[0]);
});

// ---------- RECEPCIÓN (acta) con daños, en una transacción ----------
router.post('/ordenes/:id/recepcion', auth, async (req, res) => {
  const { motivo, trabajo, prioridad, combustible, km, accesorios, documentos, observaciones, firma_cliente, firma_recep, via, danos } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rec = await client.query(
      `INSERT INTO recepciones (orden_id,motivo,trabajo,prioridad,combustible,km,accesorios,documentos,observaciones,firma_cliente,firma_recep,via)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.params.id, motivo, trabajo, prioridad, combustible, km,
       JSON.stringify(accesorios || []), JSON.stringify(documentos || []),
       observaciones, !!firma_cliente, !!firma_recep, via || 'Web']
    );
    for (const d of danos || []) {
      await client.query(
        'INSERT INTO danos (recepcion_id,numero,tipo,severidad,ubicacion) VALUES ($1,$2,$3,$4,$5)',
        [rec.rows[0].id, d.numero, d.tipo, d.severidad, d.ubicacion || null]
      );
    }
    await client.query('UPDATE ordenes SET motivo=$1, trabajo=$2 WHERE id=$3', [motivo, trabajo, req.params.id]);
    await client.query('COMMIT');
    await notificarCliente(req.params.id, `Tu vehículo fue recibido. Motivo: ${motivo}. Trabajo: ${trabajo}.`);
    req.app.get('io')?.emit('cambio', { tabla: 'ordenes' });
    res.status(201).json(rec.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.get('/ordenes/:id/recepcion', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM recepciones WHERE orden_id=$1 ORDER BY id DESC LIMIT 1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Sin recepción' });
  const danos = await query('SELECT * FROM danos WHERE recepcion_id=$1', [rows[0].id]);
  res.json({ ...rows[0], danos: danos.rows });
});

// ---------- MEDIA (foto/video) ----------
const upload = multer({ dest: process.env.UPLOAD_DIR || 'uploads' });
router.post('/ordenes/:id/media', auth, requireRole('mecanico', 'administrador'), upload.single('archivo'), async (req, res) => {
  const tipo = req.body.tipo === 'video' ? 'video' : 'foto';
  const url = req.file ? `/uploads/${path.basename(req.file.path)}` : req.body.url;
  const { rows } = await query(
    'INSERT INTO media (orden_id,tipo,url,autor) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, tipo, url, req.user.nombre]
  );
  await notificarCliente(req.params.id, `El mecánico subió ${tipo === 'video' ? 'un video' : 'una foto'} del trabajo en tu vehículo.`);
  req.app.get('io')?.emit('cambio', { tabla: 'media' });
  res.status(201).json(rows[0]);
});
router.get('/ordenes/:id/media', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM media WHERE orden_id=$1 ORDER BY id DESC', [req.params.id]);
  res.json(rows);
});

// ---------- CITAS ----------
router.get('/citas', auth, async (req, res) => {
  const { rows } = await query(
    `SELECT ci.*, c.nombre AS cliente FROM citas ci LEFT JOIN clientes c ON c.id=ci.cliente_id ORDER BY ci.fecha`
  );
  res.json(rows);
});
router.post('/citas', auth, async (req, res) => {
  const { cliente_id, vehiculo_id, tipo, fecha, hora } = req.body;
  const { rows } = await query(
    'INSERT INTO citas (cliente_id,vehiculo_id,tipo,fecha,hora) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [cliente_id, vehiculo_id || null, tipo, fecha, hora]
  );
  req.app.get('io')?.emit('cambio', { tabla: 'citas' });
  res.status(201).json(rows[0]);
});
router.put('/citas/:id', auth, requireRole('administrador'), async (req, res) => {
  const { estado } = req.body;
  const { rows } = await query('UPDATE citas SET estado=$1 WHERE id=$2 RETURNING *', [estado, req.params.id]);
  req.app.get('io')?.emit('cambio', { tabla: 'citas' });
  res.json(rows[0]);
});

// ---------- NOTIFICACIONES ----------
router.get('/notificaciones', auth, async (req, res) => {
  const { rows } = await query('SELECT * FROM notificaciones WHERE usuario_id=$1 ORDER BY id DESC', [req.user.id]);
  res.json(rows);
});
router.put('/notificaciones/:id/leida', auth, async (req, res) => {
  await query('UPDATE notificaciones SET leida=1 WHERE id=$1 AND usuario_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
