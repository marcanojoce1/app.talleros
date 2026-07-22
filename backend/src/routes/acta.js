// GET /api/acta/:tallerId/:vehId  → devuelve el ACTA en HTML (imprimible / PDF)
const express = require('express');
const { query } = require('../db');
const { generarActaHTML, generarTrabajoHTML } = require('../services/acta');

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

    // El pago solo aplica si ESTE ingreso ya fue cobrado/entregado.
    // Una recepción nueva (aunque sea el mismo carro) NO debe mostrar el monto anterior.
    const yaCobrado = veh.cerrada === true || veh.entregado === true || veh.status === 'ent';
    const hist = yaCobrado ? (d.history || []).filter((h) => h.vehId === vehId).slice(-1)[0] : null;
    const precio = hist ? hist.total : '';
    const pago = hist ? { total: hist.total || 0, pagado: hist.pagado || 0, saldo: hist.saldo != null ? hist.saldo : Math.max(0, (hist.total || 0) - (hist.pagado || 0)) } : null;
    const moneda = (d.config && d.config.currency && d.config.currency.sym) || 'Bs.';

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
      pago,
      moneda,
      avances: veh.advances || [],
      baseUrl,
    });
    // ?raw=1 → sin la barra de botones (para generar PDF desde la app)
    if (req.query.raw) html = html.replace(/<!--TOOLBAR_START-->[\s\S]*?<!--TOOLBAR_END-->/, '');
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (e) {
    res.status(500).send('<h3>Error al generar el acta: ' + e.message + '</h3>');
  }
});

// GET /api/trabajo/:tallerId/:vehId → informe de TRABAJO REALIZADO (ficha + fotos + avances)
router.get('/trabajo/:tallerId/:vehId', async (req, res) => {
  const tallerId = Number(req.params.tallerId);
  const vehId = Number(req.params.vehId);
  try {
    const taller = (await query('SELECT * FROM talleres WHERE id=$1', [tallerId])).rows[0] || { nombre: 'TallerOS' };
    const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
    let d = st ? st.data : {}; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
    // buscar en vehículos activos o en historial
    let veh = (d.vehicles || []).find((v) => v.id === vehId);
    const yaCobrado = veh && (veh.cerrada === true || veh.entregado === true || veh.status === 'ent');
    const hist = yaCobrado ? (d.history || []).filter((h) => h.vehId === vehId).slice(-1)[0] : null;
    if (!veh && hist) veh = { id: vehId, model: hist.veh, plate: hist.placa, owner: hist.cliente, mech: hist.mech, motivo: hist.trabajo, recepcion: hist.recepcion, recepDamages: hist.damages, recepLados: hist.lados, advances: [] };
    if (!veh) return res.status(404).send('<h3>Vehículo no encontrado</h3>');
    const cli = (d.clients || []).find((c) => c.n === veh.owner) || { n: veh.owner };
    const moneda = (d.config && d.config.currency && d.config.currency.sym) || 'Bs.';
    const pago = hist ? { total: hist.total || 0, pagado: hist.pagado || 0, saldo: hist.saldo != null ? hist.saldo : Math.max(0, (hist.total || 0) - (hist.pagado || 0)) } : null;
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${proto}://${req.get('host')}`;
    let html = generarTrabajoHTML({
      taller, cliente: cli, vehiculo: veh, recepcion: veh.recepcion || {},
      damages: veh.recepDamages || [], lados: veh.recepLados || [], orden: veh.id,
      precio: hist ? hist.total : (veh.cost || ''),
      servicios: hist && hist.servicios ? hist.servicios : [{ desc: (veh.recepcion && veh.recepcion.trabajo) || veh.motivo || '', precio: hist ? hist.total : (veh.cost || '') }],
      pago, moneda, avances: veh.advances || [], baseUrl,
    });
    if (req.query.raw) html = html.replace(/<!--TOOLBAR_START-->[\s\S]*?<!--TOOLBAR_END-->/, '');
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (e) {
    res.status(500).send('<h3>Error al generar el informe: ' + e.message + '</h3>');
  }
});

module.exports = router;
