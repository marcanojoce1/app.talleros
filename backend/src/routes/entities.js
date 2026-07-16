// Rutas CRUD para entidades simples (clientes, vehiculos, mecanicos, usuarios)
const express = require('express');
const { query } = require('../db');
const { auth, requireRole, hashPassword } = require('../auth');

const router = express.Router();

// Definición de columnas editables por entidad
const TABLES = {
  clientes: ['nombre', 'tipo_doc', 'documento', 'telefono', 'correo', 'direccion', 'activo'],
  vehiculos: ['cliente_id', 'marca', 'modelo', 'anio', 'placa', 'color', 'tipo_seguro', 'nro_poliza', 'activo'],
  mecanicos: ['nombre', 'especialidad', 'documento', 'telefono', 'rating', 'activo'],
};

function crud(tabla, cols) {
  const r = express.Router();

  // Listar
  r.get('/', auth, async (req, res) => {
    const { rows } = await query(`SELECT * FROM ${tabla} ORDER BY id DESC`);
    res.json(rows);
  });

  // Obtener uno
  r.get('/:id', auth, async (req, res) => {
    const { rows } = await query(`SELECT * FROM ${tabla} WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  });

  // Crear (solo administrador)
  r.post('/', auth, requireRole('administrador'), async (req, res) => {
    const keys = cols.filter((c) => req.body[c] !== undefined);
    const vals = keys.map((k) => req.body[k]);
    const ph = keys.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await query(
      `INSERT INTO ${tabla} (${keys.join(',')}) VALUES (${ph}) RETURNING *`,
      vals
    );
    req.app.get('io')?.emit('cambio', { tabla });
    res.status(201).json(rows[0]);
  });

  // Actualizar
  r.put('/:id', auth, requireRole('administrador'), async (req, res) => {
    const keys = cols.filter((c) => req.body[c] !== undefined);
    if (!keys.length) return res.status(400).json({ error: 'Nada que actualizar' });
    const set = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
    const vals = keys.map((k) => req.body[k]);
    vals.push(req.params.id);
    const { rows } = await query(
      `UPDATE ${tabla} SET ${set} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    req.app.get('io')?.emit('cambio', { tabla });
    res.json(rows[0]);
  });

  // Inactivar (borrado lógico)
  r.delete('/:id', auth, requireRole('administrador'), async (req, res) => {
    await query(`UPDATE ${tabla} SET activo=0 WHERE id=$1`, [req.params.id]);
    req.app.get('io')?.emit('cambio', { tabla });
    res.json({ ok: true });
  });

  return r;
}

router.use('/clientes', crud('clientes', TABLES.clientes));
router.use('/vehiculos', crud('vehiculos', TABLES.vehiculos));
router.use('/mecanicos', crud('mecanicos', TABLES.mecanicos));

// Usuarios: CRUD propio (la contraseña requiere hash)
const u = express.Router();
u.get('/', auth, requireRole('administrador'), async (req, res) => {
  const { rows } = await query(
    'SELECT id,nombre,usuario,correo,rol,telefono,activo,twofa FROM usuarios ORDER BY id'
  );
  res.json(rows);
});
u.post('/', auth, requireRole('administrador'), async (req, res) => {
  const { nombre, usuario, correo, rol, telefono, password } = req.body;
  if (!nombre || !usuario || !correo || !rol)
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  const hash = await hashPassword(password || 'cambiar123');
  const { rows } = await query(
    `INSERT INTO usuarios (nombre,usuario,correo,rol,telefono,password)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id,nombre,usuario,correo,rol,telefono,activo`,
    [nombre, usuario, correo, rol, telefono || null, hash]
  );
  res.status(201).json(rows[0]);
});
u.put('/:id', auth, requireRole('administrador'), async (req, res) => {
  const { nombre, usuario, correo, rol, telefono, activo, password } = req.body;
  const sets = [], vals = [];
  const add = (k, v) => { vals.push(v); sets.push(`${k}=$${vals.length}`); };
  if (nombre !== undefined) add('nombre', nombre);
  if (usuario !== undefined) add('usuario', usuario);
  if (correo !== undefined) add('correo', correo);
  if (rol !== undefined) add('rol', rol);
  if (telefono !== undefined) add('telefono', telefono);
  if (activo !== undefined) add('activo', activo);
  if (password) add('password', await hashPassword(password));
  if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
  vals.push(req.params.id);
  const { rows } = await query(
    `UPDATE usuarios SET ${sets.join(',')} WHERE id=$${vals.length}
     RETURNING id,nombre,usuario,correo,rol,telefono,activo`,
    vals
  );
  res.json(rows[0]);
});
u.delete('/:id', auth, requireRole('administrador'), async (req, res) => {
  await query('UPDATE usuarios SET activo=0 WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});
router.use('/usuarios', u);

module.exports = router;
