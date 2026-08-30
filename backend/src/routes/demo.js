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

router.post('/solicitar', async (req, res) => {
  const { nombre, correo, telefono, tallerNombre, pais, volumen, interes } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Escribe tu nombre' });
  if (!correo || !correo.trim() || !correo.includes('@')) return res.status(400).json({ error: 'Escribe un correo válido' });

  const usuario = generarUsuario(correo.split('@')[0]);
  const clave = generarClave();
  const hash = await hashPassword(clave);
  const expira = new Date(Date.now() + DEMO_DIAS * 24 * 60 * 60 * 1000);
  const nombreTaller = (tallerNombre && tallerNombre.trim()) || `Demo — ${nombre.trim()}`;

  // Crea el taller de demo (versión Premium, para que se vean todas las funciones)
  const t = (await query(
    'INSERT INTO talleres (nombre, activo, demo_expira) VALUES ($1,1,$2) RETURNING id',
    [nombreTaller, expira]
  )).rows[0];

  // Crea el usuario administrador de ese taller
  const u = (await query(
    'INSERT INTO usuarios (nombre, usuario, correo, telefono, password, rol) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [nombre.trim(), usuario, correo.trim(), telefono || null, hash, 'administrador']
  )).rows[0];
  await query('INSERT INTO taller_admins (taller_id, usuario_id) VALUES ($1,$2)', [t.id, u.id]);

  const fechaLimite = expira.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  const html = plantillaCorreo({
    titulo: '¡Tu demo de TallerOS está lista!',
    nombre: nombre.trim(),
    mensaje: `Tienes acceso completo por ${DEMO_DIAS} días (hasta el ${fechaLimite}). Descarga la app o entra desde la web con estos datos:`,
    destacado: [`USUARIO: ${usuario}`, `CONTRASEÑA: ${clave}`],
    contacto: `¿Preguntas o quieres continuar después del demo? Escríbenos — <a href="mailto:soporte@mjservices.app" style="color:#16406b">soporte@mjservices.app</a> · +51 917 024 656`,
  });
  try {
    await sendEmail(
      correo.trim(),
      'Tu demo de TallerOS está lista',
      `Hola ${nombre.trim()},\n\nTu acceso de demostración a TallerOS está listo, válido por ${DEMO_DIAS} días.\n\nUsuario: ${usuario}\nContraseña: ${clave}\n\nEntra en https://taller.mjservices.app o descarga la app.\n\n¿Preguntas? soporte@mjservices.app / +51 917 024 656`,
      html
    );
  } catch (e) {
    console.error('[demo] No se pudo enviar el correo:', e.message);
    return res.status(500).json({ error: 'Se creó tu demo pero no se pudo enviar el correo. Contáctanos directamente.' });
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
      contacto: 'Recuerda revisar si agendó una reunión virtual en Calendly.',
    });
    await sendEmail(
      'soporte@mjservices.app',
      'Nueva solicitud de demo de TallerOS',
      `Nueva solicitud de demo:\n\nNombre: ${nombre.trim()}\nCorreo: ${correo.trim()}\nTeléfono: ${telefono || '—'}\nTaller: ${nombreTaller}\nPaís: ${pais || '—'}\nVolumen: ${volumen || '—'}\nInterés: ${interes || '—'}`,
      htmlLead
    );
  } catch (e) {
    console.error('[demo] No se pudo notificar al super administrador:', e.message);
  }
  res.json({ ok: true, mensaje: 'Revisa tu correo — te enviamos tu usuario y contraseña.' });
});

module.exports = router;
