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
// IMPORTANTE: antes esto REEMPLAZABA todo el estado de golpe. Si dos sesiones trabajan
// casi al mismo tiempo (la web y la app, o dos pestañas), la que guarda de último borraba
// silenciosamente lo que la otra había agregado mientras tanto (ej. una cotización nueva
// desaparecía si luego la app guardaba un cambio de vehículo desde una copia más vieja).
// Ahora se fusiona por "id" en cada colección: se agregan/actualizan los elementos que
// llegan, pero nunca se pierde uno que ya existía en el servidor y que el cliente que
// guarda no conocía todavía.
function fusionarPorId(actual, entrante, fusionarItem) {
  if (!Array.isArray(entrante)) return Array.isArray(actual) ? actual : [];
  if (!Array.isArray(actual)) return entrante;
  const mapa = new Map(actual.map((x) => [x && x.id, x]));
  entrante.forEach((x) => {
    if (x && x.id != null) {
      const previo = mapa.get(x.id);
      mapa.set(x.id, (previo && fusionarItem) ? fusionarItem(previo, x) : x);
    }
  });
  return Array.from(mapa.values());
}
// Los vehículos guardan su historial de avances (fotos, videos, notas del técnico) DENTRO
// del propio objeto. Si dos dispositivos guardan casi al mismo tiempo con copias del
// vehículo ligeramente distintas (uno no se enteró todavía del último avance del otro),
// reemplazar el vehículo completo borraba en silencio esos avances. Aquí se fusiona el
// arreglo de avances en vez de reemplazarlo — nunca se pierde uno que un lado no conocía.
function fusionarVehiculo(actualV, entranteV) {
  const merged = { ...actualV, ...entranteV };
  const advA = actualV.advances || [];
  const advE = entranteV.advances || [];
  if (advA.length || advE.length) {
    const base = advE.length >= advA.length ? [...advE] : [...advA];
    const otro = advE.length >= advA.length ? advA : advE;
    otro.forEach((a) => { if (!base.some((b) => JSON.stringify(a) === JSON.stringify(b))) base.push(a); });
    merged.advances = base;
  }
  return merged;
}
const COLECCIONES_POR_ID = ['clients', 'vehicles', 'mecanicos', 'usuarios', 'history', 'citas', 'cotizaciones', 'notifs', 'facturas', 'sos'];
const FUSIONES_ITEM = { vehicles: fusionarVehiculo };

router.put('/', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (!(await puedeAcceder(req.user, tallerId, true))) return res.status(403).json({ error: 'Sin permiso para modificar este taller' });
  const entrante = req.body.data || {};

  const filaActual = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
  let actual = {};
  if (filaActual && filaActual.data) { try { actual = JSON.parse(filaActual.data); } catch { actual = {}; } }

  const fusionado = { ...actual, ...entrante };
  COLECCIONES_POR_ID.forEach((k) => { fusionado[k] = fusionarPorId(actual[k], entrante[k], FUSIONES_ITEM[k]); });
  // config se fusiona por clave (no se reemplaza completo) — si no, guardar solo el plan
  // desde "Editar taller" borraría en silencio los motivos, marcas, moneda, etc. que el
  // taller ya tenía configurados.
  fusionado.config = { ...(actual.config || {}), ...(entrante.config || {}) };
  fusionado.diasBloqueados = entrante.diasBloqueados || actual.diasBloqueados || [];

  const data = JSON.stringify(fusionado);
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

// POST /api/state/sos?taller=ID — el cliente pide auxilio vial (no requiere permiso de escritura)
router.post('/sos', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (!(await puedeAcceder(req.user, tallerId, false))) return res.status(403).json({ error: 'Sin acceso' });
  const { vehId, vehiculo, placa, descripcion, ubicacionTexto, lat, lng, telefono } = req.body || {};
  if (!descripcion || !String(descripcion).trim()) return res.status(400).json({ error: 'Describe la avería' });

  const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
  let d = st ? st.data : {}; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  if (!st) await query('INSERT INTO app_state (taller_id, data) VALUES ($1,$2)', [tallerId, JSON.stringify({})]);

  const ahora = new Date();
  const sos = {
    id: Date.now(),
    cliente: req.user.nombre || '',
    telefono: telefono || '',
    vehId: vehId || null,
    vehiculo: vehiculo || '',
    placa: placa || '',
    descripcion: String(descripcion).trim(),
    ubicacionTexto: ubicacionTexto || '',
    lat: lat || null,
    lng: lng || null,
    fecha: ahora.toLocaleDateString('es-VE'),
    hora: ahora.toTimeString().slice(0, 5),
    creado: ahora.toISOString(),
    estado: 'abierto', // abierto | atendido | cerrado
  };
  d.sos = [...(d.sos || []), sos];
  d.notifs = [...(d.notifs || []), {
    owner: '__taller__', veh: sos.vehiculo,
    text: '🚨 AUXILIO VIAL: ' + sos.cliente + ' — ' + sos.vehiculo + ' (' + sos.placa + ')',
    time: 'ahora', read: false, sos: true,
  }];
  await query('UPDATE app_state SET data=$2, updated_at=CURRENT_TIMESTAMP WHERE taller_id=$1', [tallerId, JSON.stringify(d)]);
  res.json({ ok: true, sos });
});

// POST /api/state/sos-estado?taller=ID — el taller cambia el estado de una solicitud
router.post('/sos-estado', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (req.user.rol !== 'superadmin' && req.user.rol !== 'administrador' && req.user.rol !== 'mecanico') {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  if (!(await puedeAcceder(req.user, tallerId, true))) return res.status(403).json({ error: 'Sin permiso' });
  const { id, estado } = req.body || {};
  const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
  if (!st) return res.json({ ok: true });
  let d = st.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d.sos = (d.sos || []).map((x) => (x.id === id ? { ...x, estado, atendidoPor: req.user.nombre || '', atendidoEn: new Date().toISOString() } : x));
  // Avisar al cliente en su campana
  const sol = (d.sos || []).find((x) => x.id === id);
  if (sol && sol.cliente) {
    const texto = estado === 'atendido'
      ? '🚐 ¡Vamos en camino! El taller ya salió hacia tu ubicación (' + (sol.vehiculo || 'tu vehículo') + ').'
      : estado === 'cerrado'
        ? '✅ Tu solicitud de auxilio vial fue marcada como resuelta.'
        : 'Tu solicitud de auxilio vial fue actualizada.';
    d.notifs = [...(d.notifs || []), {
      owner: sol.cliente, veh: sol.vehiculo || '', text: texto,
      time: 'ahora', read: false, sosEstado: estado,
    }];
  }
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

// ============ CITAS ============
// POST /api/state/cita?taller=ID — el cliente solicita una cita (fecha, hora, servicio)
router.post('/cita', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (!(await puedeAcceder(req.user, tallerId, false))) return res.status(403).json({ error: 'Sin acceso' });
  const { fecha, hora, servicio, observaciones, vehId, vehiculo, placa } = req.body || {};
  if (!fecha || !hora) return res.status(400).json({ error: 'Indica la fecha y la hora' });
  if (!servicio) return res.status(400).json({ error: 'Indica el tipo de servicio' });

  const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
  let d = st ? st.data : {}; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  if (!st) await query('INSERT INTO app_state (taller_id, data) VALUES ($1,$2)', [tallerId, JSON.stringify({})]);

  // Verificar que ese día/hora no esté ya ocupado por una cita viva (no rechazada/cancelada)
  const ocupado = (d.citas || []).some((c) => c.fecha === fecha && c.hora === hora && c.estado !== 'rechazada' && c.estado !== 'cancelada');
  if (ocupado) return res.status(409).json({ error: 'Ese horario ya está reservado. Elige otro.' });
  // Rechazar si el día está bloqueado por el taller (no laborable)
  if ((d.diasBloqueados || []).includes(fecha)) return res.status(409).json({ error: 'El taller no atiende ese día. Elige otra fecha.' });

  const ahora = new Date();
  const cita = {
    id: Date.now(),
    cliente: req.user.nombre || '',
    vehId: vehId || null,
    vehiculo: vehiculo || '',
    placa: placa || '',
    fecha, hora,
    servicio,
    observaciones: observaciones || '',
    repuestos: [],
    monto: 0,
    estado: 'solicitada', // solicitada | cotizada | aceptada | rechazada | cancelada
    creado: ahora.toISOString(),
  };
  d.citas = [...(d.citas || []), cita];
  d.notifs = [...(d.notifs || []), {
    owner: '__taller__', veh: cita.vehiculo,
    text: '📅 NUEVA CITA: ' + cita.cliente + ' pidió ' + cita.servicio + ' el ' + fecha + ' a las ' + hora,
    time: 'ahora', read: false, cita: true,
  }];
  await query('UPDATE app_state SET data=$2, updated_at=CURRENT_TIMESTAMP WHERE taller_id=$1', [tallerId, JSON.stringify(d)]);
  res.json({ ok: true, cita });
});

// POST /api/state/cita-cotizar?taller=ID — el admin arma la cotización y la confirma
router.post('/cita-cotizar', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (req.user.rol !== 'superadmin' && req.user.rol !== 'administrador') return res.status(403).json({ error: 'Sin permiso' });
  if (!(await puedeAcceder(req.user, tallerId, true))) return res.status(403).json({ error: 'Sin permiso' });
  const { id, repuestos, monto } = req.body || {};
  const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
  if (!st) return res.json({ ok: true });
  let d = st.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  const cita = (d.citas || []).find((x) => x.id === id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
  d.citas = (d.citas || []).map((x) => (x.id === id ? { ...x, repuestos: repuestos || [], monto: monto || 0, estado: 'cotizada', cotizadoPor: req.user.nombre || '', cotizadoEn: new Date().toISOString() } : x));
  // Notificar al cliente
  d.notifs = [...(d.notifs || []), {
    owner: cita.cliente, veh: cita.vehiculo || '',
    text: '💰 Tu cita del ' + cita.fecha + ' está lista: cotización por ' + (monto || 0) + '. Revísala y confírmala.',
    time: 'ahora', read: false, citaCotizada: true,
  }];
  await query('UPDATE app_state SET data=$2, updated_at=CURRENT_TIMESTAMP WHERE taller_id=$1', [tallerId, JSON.stringify(d)]);
  res.json({ ok: true });
});

// POST /api/state/cita-responder?taller=ID — el cliente acepta o rechaza la cotización
router.post('/cita-responder', async (req, res) => {
  const tallerId = Number(req.query.taller);
  if (!tallerId) return res.status(400).json({ error: 'Falta el taller' });
  if (!(await puedeAcceder(req.user, tallerId, false))) return res.status(403).json({ error: 'Sin acceso' });
  const { id, aceptada } = req.body || {};
  const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [tallerId])).rows[0];
  if (!st) return res.json({ ok: true });
  let d = st.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  const nombre = req.user.nombre || '';
  const cita = (d.citas || []).find((x) => x.id === id && x.cliente === nombre);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
  d.citas = (d.citas || []).map((x) => (x.id === id && x.cliente === nombre ? { ...x, estado: aceptada ? 'aceptada' : 'rechazada', respondidoEn: new Date().toISOString() } : x));

  // Convertimos la cotización de la cita en una cotización real (con su propio código
  // P-000XXX), para que aparezca igual que cualquier otra en el historial, en la búsqueda
  // de "Recepción por Cotización", etc. — antes se quedaba "virtual" y no aparecía ahí.
  if (!d.config) d.config = {};
  const num = (d.config.ultimoNumCotiza || 0) + 1;
  d.config.ultimoNumCotiza = num;
  d.cotizaciones = [...(d.cotizaciones || []), {
    id: Date.now(), num,
    cliente: cita.cliente, doc: '', tel: '',
    vehiculo: cita.vehiculo || '', placa: cita.placa || '',
    items: cita.repuestos || [], monto: cita.monto || 0, descuento: cita.descuento || 0,
    estado: aceptada ? 'aprobada' : 'rechazada',
    aprobadoPor: aceptada ? 'cliente' : undefined,
    fechaAprobacion: new Date().toLocaleDateString('es-VE'),
    origen: 'cita', origenCitaId: cita.id,
    fecha: new Date().toLocaleDateString('es-VE'),
  }];

  // Si acepta, crear un mantenimiento programado para esa fecha
  if (aceptada) {
    d.mantenimientos = [...(d.mantenimientos || []), {
      id: Date.now(),
      cliente: cita.cliente,
      vehId: cita.vehId,
      vehiculo: cita.vehiculo,
      placa: cita.placa,
      fecha: cita.fecha,
      hora: cita.hora,
      servicio: cita.servicio,
      observaciones: cita.observaciones,
      monto: cita.monto,
      origen: 'cita',
    }];
  }
  d.notifs = [...(d.notifs || []), {
    owner: '__taller__', veh: cita.vehiculo || '',
    text: (aceptada ? '✓ ' + nombre + ' ACEPTÓ la cita del ' + cita.fecha + ' (' + cita.hora + ')' : '✕ ' + nombre + ' RECHAZÓ la cita del ' + cita.fecha),
    time: 'ahora', read: false,
  }];
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
  const pasos = [];
  const borrar = async (sql, etiqueta) => {
    try { const r = await query(sql); pasos.push(etiqueta + ': ok'); return r; }
    catch (e) { pasos.push(etiqueta + ': ' + e.message); }
  };
  // Orden importa por las llaves foráneas: primero lo que depende, luego lo principal
  await borrar('DELETE FROM app_state', 'app_state');
  await borrar('DELETE FROM taller_admins', 'taller_admins');
  await borrar('DELETE FROM auditoria', 'auditoria');
  // desligar usuarios de talleres antes de borrar talleres
  await borrar('UPDATE usuarios SET taller_id = NULL', 'desligar_usuarios');
  await borrar("DELETE FROM usuarios WHERE rol <> 'superadmin'", 'usuarios');
  await borrar('DELETE FROM talleres', 'talleres');
  // conteo final para verificar
  let quedan = {};
  try {
    quedan.usuarios = (await query('SELECT COUNT(*)::int AS c FROM usuarios')).rows[0].c;
    quedan.talleres = (await query('SELECT COUNT(*)::int AS c FROM talleres')).rows[0].c;
    quedan.app_state = (await query('SELECT COUNT(*)::int AS c FROM app_state')).rows[0].c;
  } catch (e) {}
  res.json({ ok: true, mensaje: 'Reset ejecutado. Quedan: ' + JSON.stringify(quedan), pasos, quedan });
});

module.exports = router;
