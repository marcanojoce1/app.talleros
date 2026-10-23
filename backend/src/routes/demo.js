// Rutas: /api/demo — solicitud pública de una cuenta de demostración de TallerOS.
// Sin autenticación (cualquiera puede pedir un demo). Crea un taller nuevo con un
// administrador de credenciales generadas automáticamente, válido por 3 días.
const express = require('express');
const { query } = require('../db');
const { hashPassword } = require('../auth');
const { sendEmail } = require('../services/email');
const { plantillaCorreo } = require('../services/emailTemplate');

const router = express.Router();

const DEMO_DIAS = 3;

function generarUsuario(base) {
  const limpio = (base || 'demo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 10) || 'demo';
  return limpio + Math.floor(1000 + Math.random() * 9000);
}
function generarClave() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Envía y, si falla, espera un poco y lo intenta una vez más.
async function sendEmailReintento(...args) {
  try { return await sendEmail(...args); }
  catch (e) { await new Promise((ok) => setTimeout(ok, 2000)); return await sendEmail(...args); }
}

router.post('/solicitar', async (req, res) => {
  const { nombre, correo, telefono, tallerNombre, pais, volumen, interes } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Escribe tu nombre' });
  if (!correo || !correo.trim() || !correo.includes('@')) return res.status(400).json({ error: 'Escribe un correo válido' });

  const correoLimpio = correo.trim();
  // Limpia demos "huérfanas" de intentos anteriores que fallaron (taller de demo sin administrador).
  try {
    await query('DELETE FROM talleres WHERE demo_expira IS NOT NULL AND id NOT IN (SELECT taller_id FROM taller_admins)');
  } catch (e) { console.error('[demo] limpieza de huérfanos:', e.message); }
  // Si ese correo ya tiene una cuenta (o una demo anterior) lo avisamos claro, sin dejar nada a medias.
  const existe = (await query('SELECT id FROM usuarios WHERE LOWER(correo) = LOWER($1) LIMIT 1', [correoLimpio])).rows[0];
  if (existe) {
    return res.status(409).json({ error: 'Este correo ya tiene una cuenta o una demo registrada. Inicia sesión con tu usuario, o escríbenos a soporte@mjservices.app / +51 917 024 656 y te ayudamos.' });
  }

  const clave = generarClave();
  const hash = await hashPassword(clave);
  const expira = new Date(Date.now() + DEMO_DIAS * 24 * 60 * 60 * 1000);
  const nombreTaller = (tallerNombre && tallerNombre.trim()) || `Demo — ${nombre.trim()}`;

  // Crea el taller de demo y su administrador; si algo falla, no deja un taller "huérfano".
  let t, u, usuario;
  try {
    t = (await query(
      'INSERT INTO talleres (nombre, activo, demo_expira, demo_pais, demo_volumen, demo_interes) VALUES ($1,1,$2,$3,$4,$5) RETURNING id',
      [nombreTaller, expira, pais || null, volumen || null, interes || null]
    )).rows[0];
    for (let intento = 0; intento < 6 && !u; intento++) {
      usuario = generarUsuario(correoLimpio.split('@')[0]);
      try {
        u = (await query(
          'INSERT INTO usuarios (nombre, usuario, correo, telefono, password, rol) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [nombre.trim(), usuario, correoLimpio, telefono || null, hash, 'administrador']
        )).rows[0];
      } catch (e) {
        if (!/usuarios_usuario_key|usuario/i.test(e.message || '') || intento === 5) throw e; // solo reintenta si el usuario generado ya existía
      }
    }
    await query('INSERT INTO taller_admins (taller_id, usuario_id) VALUES ($1,$2)', [t.id, u.id]);
  } catch (e) {
    console.error('[demo] error al crear la demo:', e.message);
    if (u && u.id) { try { await query('DELETE FROM usuarios WHERE id=$1', [u.id]); } catch (_) {} }
    if (t && t.id) { try { await query('DELETE FROM talleres WHERE id=$1', [t.id]); } catch (_) {} }
    const dup = /duplicate key|unique/i.test(e.message || '');
    return res.status(dup ? 409 : 500).json({ error: dup ? 'Este correo ya tiene una cuenta o una demo registrada. Escríbenos a soporte@mjservices.app y te ayudamos.' : 'No pudimos crear tu demo en este momento. Intenta de nuevo en unos minutos.' });
  }

  const fechaLimite = expira.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  const html = plantillaCorreo({
    titulo: '¡Tu demo de TallerOS está lista!',
    nombre: nombre.trim(),
    mensaje: `Tienes acceso completo por ${DEMO_DIAS} días (hasta el ${fechaLimite}). Descarga la app o entra desde la web con estos datos:`,
    destacado: [`USUARIO: ${usuario}`, `CONTRASEÑA: ${clave}`],
    contacto: `¿Preguntas o quieres continuar después del demo? Escríbenos — <a href="mailto:soporte@mjservices.app" style="color:#16406b">soporte@mjservices.app</a> · +51 917 024 656`,
  });
  let correoEnviado = true;
  try {
    await sendEmail(
      correo.trim(),
      'Tu demo de TallerOS está lista',
      `Hola ${nombre.trim()},\n\nTu acceso de demostración a TallerOS está listo, válido por ${DEMO_DIAS} días.\n\nUsuario: ${usuario}\nContraseña: ${clave}\n\nEntra en https://taller.mjservices.app o descarga la app.\n\n¿Preguntas? soporte@mjservices.app / +51 917 024 656`,
      html
    );
  } catch (e) {
    console.error('[demo] No se pudo enviar el correo:', e.message);
    correoEnviado = false;
    // No cortamos aquí: la cuenta ya está creada, seguimos y devolvemos las
    // credenciales igual — el usuario las puede recibir por WhatsApp en la
    // misma pantalla en vez de depender solo del correo.
  }
  // Avisa al super administrador de la nueva solicitud (nuevo lead)
  try {
    const htmlLead = plantillaCorreo({
      titulo: 'Nueva solicitud de demo — TallerOS',
      destacado: [
        `NOMBRE: ${nombre.trim()}`, `CORREO: ${correo.trim()}`, `TELÉFONO: ${telefono || '—'}`,
        `TALLER: ${nombreTaller}`, `PAÍS: ${pais || '—'}`, `VOLUMEN: ${volumen || '—'}`,
      ],
      mensaje: interes ? `Interés: ${interes}` : '',
      contacto: 'Contáctalo pronto — su demo dura solo 3 días.',
    });
    await new Promise((ok) => setTimeout(ok, 1200)); // pausa: los proveedores limitan envíos por segundo
    const envioLead = await sendEmailReintento(
      'soporte@mjservices.app',
      'Nueva solicitud de demo de TallerOS',
      `Nueva solicitud de demo:\n\nNombre: ${nombre.trim()}\nCorreo: ${correo.trim()}\nTeléfono: ${telefono || '—'}\nTaller: ${nombreTaller}\nPaís: ${pais || '—'}\nVolumen: ${volumen || '—'}\nInterés: ${interes || '—'}`,
      htmlLead
    );
    console.log('[demo] notificacion al superadministrador enviada ->', envioLead);
  } catch (e) {
    console.error('[demo] No se pudo notificar al super administrador:', e.message);
  }
  res.json({
    ok: true,
    mensaje: correoEnviado ? 'Revisa tu correo — te enviamos tu usuario y contraseña.' : 'Tu demo ya está lista. No pudimos enviarte el correo, pero aquí están tus datos — guárdalos o mándalos a tu WhatsApp.',
    correoEnviado, usuario, clave,
  });
});

module.exports = router;
