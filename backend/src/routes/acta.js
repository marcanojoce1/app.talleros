// GET /api/acta/:tallerId/:vehId  → devuelve el ACTA en HTML (imprimible / PDF)
const express = require('express');
const { query } = require('../db');
const { generarActaHTML } = require('../services/acta');

const router = express.Router();

router.get('/acta/:tallerId/:vehId', async (req, res) => {
  const tallerId = Number(req.params.tallerId);
  const vehId = Number(req.params.vehId);
  try {
    const taller = (await query('SELECT * FROM talleres WHERE id=$1', [tallerId])).rows[0] || { nombre: 'TallerOS' };
    const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
    let d = st ? st.data : {}; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }

    const veh = (d.vehicles || []).find((v) => v.id === vehId);
    if (!veh) return res.status(404).send('<h3>Vehículo no encontrado</h3>');
    const cli = (d.clients || []).find((c) => c.n === veh.owner) || { n: veh.owner };

    // Precio: si ya hay historial (trabajo cobrado), úsalo
    const hist = (d.history || []).find((h) => h.vehId === vehId);
    const precio = hist ? hist.total : (veh.cost || '');

    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${proto}://${req.get('host')}`;

    let html = generarActaHTML({
      taller,
      cliente: cli,
      vehiculo: veh,
      recepcion: veh.recepcion || {},
      damages: veh.recepDamages || [],
      lados: veh.recepLados || [],
      orden: veh.id,
      precio,
      servicios: hist && hist.servicios ? hist.servicios : [{ desc: (veh.recepcion && veh.recepcion.trabajo) || veh.motivo || '', precio }],
      baseUrl,
    });
    // ?raw=1 → sin la barra de botones (para generar PDF desde la app)
    if (req.query.raw) html = html.replace(/<!--TOOLBAR_START-->[\s\S]*?<!--TOOLBAR_END-->/, '');
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (e) {
    res.status(500).send('<h3>Error al generar el acta: ' + e.message + '</h3>');
  }
});

module.exports = router;
