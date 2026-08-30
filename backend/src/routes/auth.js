// Rutas: /api/auth  (login, recuperación de contraseña por correo/WhatsApp)
const express = require('express');
const { query } = require('../db');
const { hashPassword, checkPassword, signToken, auth } = require('../auth');
const { sendWhatsApp } = require('../services/whatsapp');
const { sendEmail } = require('../services/email');
const { plantillaCorreo } = require('../services/emailTemplate');
const { resolverPerms } = require('../permisos');
const { registrar } = require('../audit');

// Evita que alguien presione "enviar código" varias veces seguidas — eso es lo que
// hace que Gmail bloquee la conexión temporalmente (error 421). Con esto, avisamos
// claro cuánto falta en vez de dejar que el intento choque con el bloqueo de Google.
const ULTIMO_ENVIO = new Map(); // identificador -> timestamp del último envío
const ESPERA_REENVIO_MS = 30 * 1000; // 30 segundos

const router = express.Router();

// RESCATE DE ACCESO (para cuando se olvida la clave del Super Admin y no hay consola).
// Solo funciona si en Render existe la variable de entorno RESCATE_CLAVE.
// Uso: abrir en el navegador
//   https://TU-URL/api/auth/rescate?secreto=LA_CLAVE_SECRETA&nueva=MiClaveNueva
router.get('/rescate', async (req, res) => {
  const secreto = process.env.RESCATE_CLAVE;
  if (!secreto) return res.status(404).json({ error: 'Rescate no habilitado' });
  if ((req.query.secreto || '') !== secreto) {
    registrar({ req, user: {}, accion: 'Intento de rescate fallido', modulo: 'auth' });
    return res.status(403).json({ error: 'Clave secreta incorrecta' });
  }
  const nueva = String(req.query.nueva || '').trim();
  const usuario = String(req.query.usuario || 'superadmin').trim();
  if (nueva.length < 6) return res.status(400).json({ error: 'Indica una clave nueva de al menos 6 caracteres (parámetro "nueva")' });

  const hash = await hashPassword(nueva);
  const { rows } = await query('SELECT id, usuario, rol FROM usuarios WHERE usuario=$1', [usuario]);
  if (!rows.length) {
    if (usuario !== 'superadmin') return res.status(404).json({ error: 'No existe ese usuario' });
    await query('INSERT INTO usuarios (nombre,usuario,correo,password,rol,activo) VALUES ($1,$2,$3,$4,$5,1)',
      ['Super Administrador', 'superadmin', 'super@talleros.ve', hash, 'superadmin']);
    registrar({ req, user: {}, accion: 'Rescate: superadmin recreado', modulo: 'auth' });
    return res.json({ ok: true, mensaje: 'Super Admin recreado. Ya puedes iniciar sesión.', usuario: 'superadmin' });
  }
  await query('UPDATE usuarios SET password=$2, activo=1 WHERE id=$1', [rows[0].id, hash]);
  registrar({ req, user: {}, accion: 'Rescate de contraseña', modulo: 'auth', detalle: usuario });
  res.json({ ok: true, mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.', usuario: rows[0].usuario, rol: rows[0].rol });
});

// POST /api/auth/mi-clave  { actual, nueva }  — cualquier usuario cambia SU propia contraseña
router.post('/mi-clave', auth, async (req, res) => {
  const { actual, nueva } = req.body;
  if (!actual || !nueva) return res.status(400).json({ error: 'Indica tu contraseña actual y la nueva' });
  if (String(nueva).length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  const u = (await query('SELECT id, password FROM usuarios WHERE id=$1', [req.user.id])).rows[0];
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  const ok = await checkPassword(actual, u.password);
  if (!ok) {
    registrar({ req, accion: 'Cambio de clave fallido', modulo: 'auth' });
    return res.status(403).json({ error: 'Tu contraseña actual no es correcta' });
  }
  const hash = await hashPassword(nueva);
  await query('UPDATE usuarios SET password=$2, must_change=0 WHERE id=$1', [u.id, hash]);
  registrar({ req, accion: 'Cambió su contraseña', modulo: 'auth' });
  res.json({ ok: true, mensaje: 'Contraseña actualizada' });
});

// POST /api/auth/login  { usuario, password }
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Faltan credenciales' });
  const { rows } = await query(
    'SELECT * FROM usuarios WHERE (usuario=$1 OR correo=$1) AND activo=1',
    [usuario]
  );
  const u = rows[0];
  if (!u || !(await checkPassword(password, u.password)))
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  // Talleres a los que tiene acceso
  let talleres = [];
  if (u.rol === 'superadmin') {
    talleres = (await query('SELECT id, nombre FROM talleres WHERE activo=1 ORDER BY nombre')).rows;
  } else if (u.rol === 'administrador') {
    talleres = (await query(
      `SELECT t.id, t.nombre, t.activo, t.motivo_inactivo, t.logo FROM talleres t
       JOIN taller_admins ta ON ta.taller_id = t.id
       WHERE ta.usuario_id=$1 ORDER BY t.nombre`, [u.id])).rows;
  } else if ((u.rol === 'mecanico' || u.rol === 'cliente') && u.taller_id) {
    talleres = (await query(
      'SELECT id, nombre, activo, motivo_inactivo, logo FROM talleres WHERE id=$1', [u.taller_id])).rows;
  }
  // Si es una cuenta de demo y ya venció, no dejar entrar (evita que un demo de prueba
  // quede activo para siempre).
  if (u.rol !== 'superadmin' && talleres.length) {
    const ahora = new Date();
    const vigentes = [];
    for (const t of talleres) {
      const info = (await query('SELECT demo_expira FROM talleres WHERE id=$1', [t.id])).rows[0];
      if (info && info.demo_expira && new Date(info.demo_expira) < ahora) continue; // demo vencido, se excluye
      vigentes.push(t);
    }
    if (!vigentes.length && talleres.length) {
      return res.status(403).json({ error: 'Tu demo de TallerOS ya venció. Escríbenos a soporte@mjservices.app si quieres continuar.' });
    }
    talleres = vigentes;
  }
  registrar({ req, user: { id: u.id, nombre: u.nombre, rol: u.rol }, accion: 'Inicio de sesión', modulo: 'auth', taller_id: (talleres[0] && talleres[0].id) || null });
  res.json({
    token: signToken(u),
    user: { id: u.id, nombre: u.nombre, rol: u.rol, usuario: u.usuario, permisos: resolverPerms(u.rol, u.permisos), mustChange: !!u.must_change },
    talleres,
  });
});

// POST /api/auth/recover  { identificador, metodo:'correo'|'whatsapp' }
// Genera un código de 6 dígitos y lo envía.
router.post('/recover', async (req, res) => {
  const { identificador, metodo = 'correo' } = req.body;
  if (!identificador || !identificador.trim()) return res.status(400).json({ error: 'Escribe tu correo, usuario o teléfono' });
  const clave = identificador.trim().toLowerCase();
  const ultimo = ULTIMO_ENVIO.get(clave);
  if (ultimo && Date.now() - ultimo < ESPERA_REENVIO_MS) {
    const faltan = Math.ceil((ESPERA_REENVIO_MS - (Date.now() - ultimo)) / 1000);
    return res.status(429).json({ error: `Espera ${faltan} segundo${faltan === 1 ? '' : 's'} antes de volver a intentar.` });
  }
  const { rows } = await query(
    'SELECT * FROM usuarios WHERE usuario=$1 OR correo=$1 OR telefono=$1',
    [identificador.trim()]
  );
  const u = rows[0];
  if (!u) return res.status(404).json({ error: 'Ese correo, usuario o teléfono no está registrado.' });
  ULTIMO_ENVIO.set(clave, Date.now());
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await query(
    'INSERT INTO reset_codes (usuario_id, codigo, metodo, expira_en) VALUES ($1,$2,$3,$4)',
    [u.id, codigo, metodo, expira]
  );
  const msg = `TallerOS: tu código de verificación es ${codigo}. Vence en 10 minutos.`;
  const html = plantillaCorreo({
    titulo: 'Código de verificación',
    nombre: u.nombre,
    mensaje: 'Usa este código para recuperar el acceso a tu cuenta. Vence en 10 minutos.',
    destacado: [`<span style="font-size:26px;letter-spacing:.15em">${codigo}</span>`],
  });
  try {
    if (metodo === 'whatsapp' && u.telefono) await sendWhatsApp(u.telefono, msg);
    else await sendEmail(u.correo, 'Código de verificación — TallerOS', msg, html);
  } catch (e) {
    console.error('Error enviando código:', e.message);
    return res.status(500).json({ error: 'No se pudo enviar el código. Intenta de nuevo en un momento.' });
  }
  res.json({ ok: true, mensaje: 'Se envió un código de verificación.' });
});

// POST /api/auth/verify-code  { identificador, codigo } — valida el código SIN gastarlo,
// para que la app solo muestre el paso de "contraseña nueva" si el código es correcto.
router.post('/verify-code', async (req, res) => {
  const { identificador, codigo } = req.body;
  const { rows } = await query(
    `SELECT rc.* FROM reset_codes rc
     JOIN usuarios u ON u.id = rc.usuario_id
     WHERE (u.usuario=$1 OR u.correo=$1 OR u.telefono=$1) AND rc.codigo=$2
       AND rc.usado=0 AND rc.expira_en > now()
     ORDER BY rc.id DESC LIMIT 1`,
    [identificador, codigo]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Código inválido o vencido' });
  res.json({ ok: true });
});

// POST /api/auth/reset  { identificador, codigo, nueva }
router.post('/reset', async (req, res) => {
  const { identificador, codigo, nueva } = req.body;
  if (!nueva || nueva.length < 4) return res.status(400).json({ error: 'Contraseña muy corta' });
  const { rows } = await query(
    `SELECT rc.id, rc.usuario_id, u.usuario AS u_usuario, u.correo AS u_correo FROM reset_codes rc
     JOIN usuarios u ON u.id = rc.usuario_id
     WHERE (u.usuario=$1 OR u.correo=$1 OR u.telefono=$1) AND rc.codigo=$2
       AND rc.usado=0 AND rc.expira_en > now()
     ORDER BY rc.id DESC LIMIT 1`,
    [identificador, codigo]
  );
  const rc = rows[0];
  if (!rc) return res.status(400).json({ error: 'Código inválido o expirado' });
  const hash = await hashPassword(nueva);
  await query('UPDATE usuarios SET password=$1 WHERE id=$2', [hash, rc.usuario_id]);
  await query('UPDATE reset_codes SET usado=1 WHERE id=$1', [rc.id]);
  // Aviso de confirmación al correo del usuario, con su usuario y la contraseña nueva
  console.log('[reset] usuario_id=' + rc.usuario_id + ' u_usuario=' + rc.u_usuario + ' u_correo=' + rc.u_correo);
  if (rc.u_correo) {
    try {
      const contactoCorreo = 'soporte@mjservices.app';
      const contactoTel = '+51 917 024 656';
      const html = plantillaCorreo({
        titulo: '¡Tu contraseña fue actualizada con éxito!',
        nombre: rc.u_usuario,
        destacado: [`USUARIO: ${rc.u_usuario}`, `CONTRASEÑA NUEVA: ${nueva}`],
        contacto: `Si no fuiste tú quien hizo este cambio, contacta al administrador de tu taller de inmediato — <a href="mailto:${contactoCorreo}" style="color:#16406b">${contactoCorreo}</a> · ${contactoTel}`,
      });
      const envio = await sendEmail(
        rc.u_correo,
        'Tu contraseña de TallerOS fue cambiada',
        `Hola,\n\nTu contraseña de TallerOS se actualizó correctamente.\n\nUsuario: ${rc.u_usuario}\nContraseña nueva: ${nueva}\n\nSi no fuiste tú quien hizo este cambio, contacta al administrador de tu taller de inmediato: ${contactoCorreo} / ${contactoTel}`,
        html
      );
      console.log('[reset] correo de confirmacion enviado ->', envio);
    } catch (e) {
      console.error('[reset] No se pudo enviar el correo de confirmación:', e.message);
    }
  } else {
    console.warn('[reset] el usuario no tiene correo registrado, no se envió confirmación');
  }
  res.json({ ok: true, mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
});

module.exports = router;
