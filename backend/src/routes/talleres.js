// Rutas: /api/talleres — gestión multi-taller (Super Admin) y acceso de administradores.
const express = require('express');
const { query } = require('../db');
const { auth, requireRole, hashPassword } = require('../auth');
const { MODULOS, ACCIONES, resolverPerms } = require('../permisos');
const { registrar } = require('../audit');

const router = express.Router();
router.use(auth); // todas requieren sesión

// Lista de talleres según el rol: superadmin ve todos; admin ve los suyos.
router.get('/', async (req, res) => {
  if (req.user.rol === 'superadmin') {
    const { rows } = await query('SELECT * FROM talleres ORDER BY nombre');
    return res.json(rows);
  }
  if (req.user.rol === 'administrador') {
    const { rows } = await query(
      `SELECT t.* FROM talleres t JOIN taller_admins ta ON ta.taller_id=t.id
       WHERE ta.usuario_id=$1 ORDER BY t.nombre`, [req.user.id]);
    return res.json(rows);
  }
  res.json([]);
});

// Crear taller (solo superadmin)
router.post('/', requireRole('superadmin'), async (req, res) => {
  const { nombre, rif, direccion, telefono, logo } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del taller es obligatorio' });
  const { rows } = await query(
    'INSERT INTO talleres (nombre, rif, direccion, telefono, logo) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [nombre.trim(), rif || null, direccion || null, telefono || null, logo || null]);
  registrar({ req, accion: 'Creó taller', modulo: 'talleres', detalle: rows[0].nombre, taller_id: rows[0].id });
  res.status(201).json(rows[0]);
});

// Editar / activar-inactivar taller (solo superadmin)
router.put('/:id', requireRole('superadmin'), async (req, res) => {
  const { nombre, rif, direccion, telefono, activo, motivo_inactivo, logo, rubro, condiciones, pie } = req.body;
  const { rows } = await query(
    `UPDATE talleres SET nombre=COALESCE($2,nombre), rif=COALESCE($3,rif),
       direccion=COALESCE($4,direccion), telefono=COALESCE($5,telefono),
       activo=COALESCE($6,activo), motivo_inactivo=$7, logo=COALESCE($8,logo),
       rubro=COALESCE($9,rubro), condiciones=COALESCE($10,condiciones), pie=COALESCE($11,pie) WHERE id=$1 RETURNING *`,
    [req.params.id, nombre, rif, direccion, telefono,
     activo == null ? null : (activo ? 1 : 0),
     activo === false || activo === 0 ? (motivo_inactivo || 'Taller desactivado') : null,
     logo || null, rubro || null, condiciones || null, pie || null]);
  if (!rows[0]) return res.status(404).json({ error: 'Taller no encontrado' });
  res.json(rows[0]);
});

// Lista de TODOS los administradores con los talleres que tiene cada uno (superadmin)
router.get('/admins/all', requireRole('superadmin'), async (req, res) => {
  const us = (await query("SELECT id,nombre,usuario,correo,activo FROM usuarios WHERE rol='administrador' ORDER BY nombre")).rows;
  const rels = (await query('SELECT taller_id, usuario_id FROM taller_admins')).rows;
  res.json(us.map(u => ({ ...u, talleres: rels.filter(r => r.usuario_id === u.id).map(r => r.taller_id) })));
});

// Reemplazar los talleres de un administrador (marcar/desmarcar)
router.put('/admins/:uid/talleres', requireRole('superadmin'), async (req, res) => {
  const uid = Number(req.params.uid);
  const talleres = Array.isArray(req.body.talleres) ? req.body.talleres : [];
  await query('DELETE FROM taller_admins WHERE usuario_id=$1', [uid]);
  for (const tid of talleres) {
    const t = (await query('SELECT id FROM talleres WHERE id=$1', [tid])).rows[0];
    if (t) await query('INSERT INTO taller_admins (taller_id, usuario_id) VALUES ($1,$2)', [tid, uid]);
  }
  res.json({ ok: true, talleres: talleres.length });
});

// Administradores de un taller (superadmin, o admin dueño del taller)
router.get('/:id/admins', async (req, res) => {
  if (req.user.rol !== 'superadmin') {
    const own = (await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [req.params.id, req.user.id])).rows[0];
    if (req.user.rol !== 'administrador' || !own) return res.status(403).json({ error: 'Sin permiso para este taller' });
  }
  const { rows } = await query(
    `SELECT u.id,u.nombre,u.usuario,u.correo,u.activo FROM usuarios u
     JOIN taller_admins ta ON ta.usuario_id=u.id
     WHERE ta.taller_id=$1 ORDER BY u.nombre`, [req.params.id]);
  res.json(rows);
});

// Crear un administrador NUEVO y asignarlo al taller, o asignar uno existente.
// Lo puede hacer el superadmin, o un administrador que YA pertenece a ese taller.
router.post('/:id/admins', async (req, res) => {
  const tallerId = Number(req.params.id);
  if (req.user.rol !== 'superadmin') {
    const own = (await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [tallerId, req.user.id])).rows[0];
    if (req.user.rol !== 'administrador' || !own) return res.status(403).json({ error: 'Sin permiso para este taller' });
  }
  const taller = (await query('SELECT id FROM talleres WHERE id=$1', [tallerId])).rows[0];
  if (!taller) return res.status(404).json({ error: 'Taller no encontrado' });

  let usuarioId = req.body.usuario_id;

  if (!usuarioId) {
    const { nombre, usuario, correo, password } = req.body;
    if (!nombre || !usuario || !correo || !password)
      return res.status(400).json({ error: 'Faltan datos del administrador (nombre, usuario, correo, contraseña)' });
    // VALIDACIÓN DE DUPLICADOS
    const dup = (await query('SELECT id, usuario, correo FROM usuarios WHERE usuario=$1 OR correo=$2', [usuario, correo])).rows[0];
    if (dup) {
      if (dup.usuario === usuario) return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario' });
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    const hash = await hashPassword(password);
    const ins = await query(
      'INSERT INTO usuarios (nombre,usuario,correo,password,rol) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [nombre, usuario, correo, hash, 'administrador']);
    usuarioId = ins.rows[0].id;
  } else {
    const u = (await query('SELECT id FROM usuarios WHERE id=$1', [usuarioId])).rows[0];
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Asignar (sin duplicar la relación)
  const yaAsignado = (await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [tallerId, usuarioId])).rows[0];
  if (yaAsignado) return res.status(409).json({ error: 'Ese administrador ya está asignado a este taller' });
  await query('INSERT INTO taller_admins (taller_id, usuario_id) VALUES ($1,$2)', [tallerId, usuarioId]);
  res.status(201).json({ ok: true, usuario_id: usuarioId });
});

// Quitar un admin de un taller
router.delete('/:id/admins/:uid', requireRole('superadmin'), async (req, res) => {
  await query('DELETE FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [req.params.id, req.params.uid]);
  res.json({ ok: true });
});

// Crear un administrador NUEVO y asignarlo a VARIOS talleres a la vez.
// Body: { nombre, usuario, correo, password, talleres:[id,...] }
router.post('/admin', requireRole('superadmin'), async (req, res) => {
  const { nombre, usuario, correo, password, talleres } = req.body;
  if (!nombre || !usuario || !correo || !password)
    return res.status(400).json({ error: 'Faltan datos (nombre, usuario, correo, contraseña)' });
  if (!Array.isArray(talleres) || !talleres.length)
    return res.status(400).json({ error: 'Selecciona al menos un taller' });
  const dup = (await query('SELECT id, usuario, correo FROM usuarios WHERE usuario=$1 OR correo=$2', [usuario, correo])).rows[0];
  if (dup) {
    if (dup.usuario === usuario) return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario' });
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  }
  const hash = await hashPassword(password);
  const ins = await query(
    'INSERT INTO usuarios (nombre,usuario,correo,password,rol) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [nombre, usuario, correo, hash, 'administrador']);
  const uid = ins.rows[0].id;
  for (const tid of talleres) {
    const t = (await query('SELECT id FROM talleres WHERE id=$1', [tid])).rows[0];
    if (t) await query('INSERT INTO taller_admins (taller_id, usuario_id) VALUES ($1,$2)', [tid, uid]);
  }
  res.status(201).json({ ok: true, usuario_id: uid, asignados: talleres.length });
});

// ===== Gestión global de usuarios (solo Super Admin) =====
router.get('/users/all', requireRole('superadmin'), async (req, res) => {
  const { rows } = await query("SELECT id,nombre,usuario,correo,rol,activo,permisos FROM usuarios ORDER BY rol, nombre");
  res.json(rows.map((u) => ({ ...u, permisos: resolverPerms(u.rol, u.permisos) })));
});
// Actualizar permisos por módulo de un usuario (superadmin, o admin dueño del taller del usuario)
router.put('/users/:uid/permisos', async (req, res) => {
  const uid = Number(req.params.uid);
  const u = (await query('SELECT id, rol, taller_id FROM usuarios WHERE id=$1', [uid])).rows[0];
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (req.user.rol !== 'superadmin') {
    if (!u.taller_id) return res.status(403).json({ error: 'Sin permiso' });
    const own = (await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [u.taller_id, req.user.id])).rows[0];
    if (!own) return res.status(403).json({ error: 'Sin permiso sobre este usuario' });
  }
  const permisos = req.body.permisos || {};
  await query('UPDATE usuarios SET permisos=$2 WHERE id=$1', [uid, JSON.stringify(permisos)]);
  registrar({ req, accion: 'Cambió permisos', modulo: 'usuarios', detalle: 'usuario #' + uid, taller_id: u.taller_id });
  res.json({ ok: true, permisos: resolverPerms(u.rol, JSON.stringify(permisos)) });
});

// GET /auditoria — historial de acciones (superadmin: todo; admin: sus talleres y sus propias acciones)
router.get('/auditoria', async (req, res) => {
  if (req.user.rol === 'superadmin') {
    const { rows } = await query('SELECT * FROM auditoria ORDER BY id DESC LIMIT 200');
    return res.json(rows);
  }
  const ts = (await query('SELECT taller_id FROM taller_admins WHERE usuario_id=$1', [req.user.id])).rows.map((r) => r.taller_id);
  if (!ts.length) { const { rows } = await query('SELECT * FROM auditoria WHERE usuario_id=$1 ORDER BY id DESC LIMIT 200', [req.user.id]); return res.json(rows); }
  const ph = ts.map((_, i) => '$' + (i + 1)).join(',');
  const { rows } = await query('SELECT * FROM auditoria WHERE taller_id IN (' + ph + ') OR usuario_id=$' + (ts.length + 1) + ' ORDER BY id DESC LIMIT 200', [...ts, req.user.id]);
  res.json(rows);
});
router.post('/users/new', requireRole('superadmin'), async (req, res) => {
  const { nombre, usuario, correo, password, rol } = req.body;
  if (!nombre || !usuario || !correo || !password || !rol)
    return res.status(400).json({ error: 'Faltan datos (nombre, usuario, correo, contraseña, rol)' });
  if (!['superadmin', 'administrador', 'mecanico', 'cliente'].includes(rol))
    return res.status(400).json({ error: 'Rol no válido' });
  const dup = (await query('SELECT usuario,correo FROM usuarios WHERE usuario=$1 OR correo=$2', [usuario, correo])).rows[0];
  if (dup) return res.status(409).json({ error: dup.usuario === usuario ? 'Ya existe ese nombre de usuario' : 'Ya existe ese correo' });
  const hash = await hashPassword(password);
  const ins = await query('INSERT INTO usuarios (nombre,usuario,correo,password,rol) VALUES ($1,$2,$3,$4,$5) RETURNING id', [nombre, usuario, correo, hash, rol]);
  registrar({ req, accion: 'Creó usuario', modulo: 'usuarios', detalle: usuario + ' (' + rol + ')' });
  res.status(201).json({ ok: true, id: ins.rows[0].id });
});
router.put('/users/:uid/estado', requireRole('superadmin'), async (req, res) => {
  await query('UPDATE usuarios SET activo=$2 WHERE id=$1', [req.params.uid, req.body.activo ? 1 : 0]);
  res.json({ ok: true });
});
// Editar datos de un usuario (superadmin). password opcional.
router.put('/users/:uid', requireRole('superadmin'), async (req, res) => {
  const { nombre, correo, rol, password } = req.body;
  if (rol && !['superadmin', 'administrador', 'mecanico', 'cliente'].includes(rol))
    return res.status(400).json({ error: 'Rol no válido' });
  if (correo) {
    const dup = (await query('SELECT id FROM usuarios WHERE correo=$1 AND id<>$2', [correo, req.params.uid])).rows[0];
    if (dup) return res.status(409).json({ error: 'Ya existe otro usuario con ese correo' });
  }
  await query(
    'UPDATE usuarios SET nombre=COALESCE($2,nombre), correo=COALESCE($3,correo), rol=COALESCE($4,rol) WHERE id=$1',
    [req.params.uid, nombre || null, correo || null, rol || null]);
  if (password) await query('UPDATE usuarios SET password=$2 WHERE id=$1', [req.params.uid, await hashPassword(password)]);
  res.json({ ok: true });
});
// Editar datos de un admin de un taller (superadmin o admin dueño)
router.put('/:id/admins/:uid', async (req, res) => {
  if (req.user.rol !== 'superadmin') {
    const own = (await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [req.params.id, req.user.id])).rows[0];
    if (req.user.rol !== 'administrador' || !own) return res.status(403).json({ error: 'Sin permiso' });
  }
  const { nombre, correo, password } = req.body;
  if (correo) {
    const dup = (await query('SELECT id FROM usuarios WHERE correo=$1 AND id<>$2', [correo, req.params.uid])).rows[0];
    if (dup) return res.status(409).json({ error: 'Ya existe otro usuario con ese correo' });
  }
  await query('UPDATE usuarios SET nombre=COALESCE($2,nombre), correo=COALESCE($3,correo) WHERE id=$1', [req.params.uid, nombre || null, correo || null]);
  if (password) await query('UPDATE usuarios SET password=$2 WHERE id=$1', [req.params.uid, await hashPassword(password)]);
  res.json({ ok: true });
});

// Activar/inactivar un usuario admin de un taller (superadmin o admin dueño del taller)
router.put('/:id/admins/:uid/estado', async (req, res) => {
  if (req.user.rol !== 'superadmin') {
    const own = (await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [req.params.id, req.user.id])).rows[0];
    if (req.user.rol !== 'administrador' || !own) return res.status(403).json({ error: 'Sin permiso' });
  }
  await query('UPDATE usuarios SET activo=$2 WHERE id=$1', [req.params.uid, req.body.activo ? 1 : 0]);
  res.json({ ok: true });
});

// ===== Facturas de TODOS los talleres (solo Super Admin) =====
router.get('/facturas/all', requireRole('superadmin'), async (req, res) => {
  const talleres = (await query('SELECT id,nombre FROM talleres')).rows;
  const out = [];
  for (const t of talleres) {
    const st = (await query('SELECT data FROM app_state WHERE taller_id=$1', [t.id])).rows[0];
    if (!st) continue;
    let data = {};
    try { data = typeof st.data === 'string' ? JSON.parse(st.data) : (st.data || {}); } catch (e) {}
    (data.facturas || []).forEach(f => out.push({ ...f, taller_id: t.id, taller_nombre: t.nombre }));
  }
  out.sort((a, b) => (b.id || 0) - (a.id || 0));
  res.json({ facturas: out, pendientes: out.filter(f => f.estado !== 'pagada').length });
});

// POST /:id/cuenta — crea la cuenta de acceso de un cliente o mecánico ligada al taller
router.post('/:id/cuenta', async (req, res) => {
  const tallerId = Number(req.params.id);
  if (req.user.rol !== 'superadmin') {
    const own = (await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [tallerId, req.user.id])).rows[0];
    if (!own) return res.status(403).json({ error: 'Sin permiso sobre este taller' });
  }
  const { nombre, usuario, correo, password, rol, telefono } = req.body;
  if (!nombre || !usuario || !correo || !password || !rol) return res.status(400).json({ error: 'Faltan datos (nombre, usuario, correo, contraseña, rol)' });
  if (!['cliente', 'mecanico'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const dup = (await query('SELECT usuario, correo FROM usuarios WHERE usuario=$1 OR correo=$2', [usuario, correo])).rows[0];
  if (dup) {
    if (dup.usuario === usuario) return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    return res.status(409).json({ error: 'Ese correo ya existe' });
  }
  const hash = await hashPassword(password);
  const ins = await query(
    'INSERT INTO usuarios (nombre,usuario,correo,password,rol,telefono,taller_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [nombre, usuario, correo, hash, rol, telefono || null, tallerId]);
  registrar({ req, accion: 'Creó cuenta ' + rol, modulo: 'usuarios', detalle: usuario, taller_id: tallerId });
  res.json({ ok: true, id: ins.rows[0].id });
});

// PUT /:id/cuenta — crea o actualiza las credenciales de un cliente/mecánico existente
router.put('/:id/cuenta', async (req, res) => {
  const tallerId = Number(req.params.id);
  if (req.user.rol !== 'superadmin') {
    const own = (await query('SELECT 1 FROM taller_admins WHERE taller_id=$1 AND usuario_id=$2', [tallerId, req.user.id])).rows[0];
    if (!own) return res.status(403).json({ error: 'Sin permiso sobre este taller' });
  }
  const { nombre, usuario, correo, password, rol, telefono, usuarioAnterior } = req.body;
  if (!usuario || !rol) return res.status(400).json({ error: 'Faltan datos' });
  if (!['cliente', 'mecanico'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

  // Busca la cuenta por el usuario anterior (si cambió) o por el actual
  const buscar = usuarioAnterior || usuario;
  const existente = (await query('SELECT id FROM usuarios WHERE usuario=$1 AND taller_id=$2', [buscar, tallerId])).rows[0];

  // Verifica que el nuevo nombre de usuario no lo tenga otra persona
  const choque = (await query('SELECT id FROM usuarios WHERE usuario=$1', [usuario])).rows[0];
  if (choque && (!existente || choque.id !== existente.id)) return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });

  if (!existente) {
    // No tenía cuenta: la crea (requiere contraseña)
    if (!password) return res.status(400).json({ error: 'Indica una contraseña para crear el acceso' });
    if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    if (!correo) return res.status(400).json({ error: 'Indica el correo' });
    const hash = await hashPassword(password);
    const ins = await query('INSERT INTO usuarios (nombre,usuario,correo,password,rol,telefono,taller_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [nombre, usuario, correo, hash, rol, telefono || null, tallerId]);
    registrar({ req, accion: 'Creó cuenta ' + rol, modulo: 'usuarios', detalle: usuario, taller_id: tallerId });
    return res.json({ ok: true, id: ins.rows[0].id, creado: true });
  }

  // Actualiza los datos; la contraseña solo si se indicó una nueva
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const hash = await hashPassword(password);
    await query('UPDATE usuarios SET nombre=$2, usuario=$3, correo=COALESCE($4,correo), telefono=$5, password=$6 WHERE id=$1',
      [existente.id, nombre, usuario, correo || null, telefono || null, hash]);
  } else {
    await query('UPDATE usuarios SET nombre=$2, usuario=$3, correo=COALESCE($4,correo), telefono=$5 WHERE id=$1',
      [existente.id, nombre, usuario, correo || null, telefono || null]);
  }
  registrar({ req, accion: 'Actualizó cuenta ' + rol, modulo: 'usuarios', detalle: usuario, taller_id: tallerId });
  res.json({ ok: true, id: existente.id, actualizado: true });
});

module.exports = router;
