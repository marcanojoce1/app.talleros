// Envío de notificaciones push (las que aparecen arriba del teléfono sin abrir
// la app) usando el servicio gratuito de Expo — no requiere cuenta de pago ni
// configurar Firebase/Apple por separado.
const { query } = require('../db');

async function enviarPush(usuarioId, titulo, cuerpo, datos) {
  if (!usuarioId) return;
  const u = (await query('SELECT push_token FROM usuarios WHERE id=$1', [usuarioId])).rows[0];
  if (!u || !u.push_token) return; // el usuario no tiene la app instalada / no dio permiso
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: u.push_token,
        title: titulo,
        body: cuerpo,
        data: datos || {},
        sound: 'default',
      }),
    });
  } catch (e) {
    console.error('[push] No se pudo enviar la notificación:', e.message);
  }
}

// Manda la misma notificación a varios usuarios de una vez (ej. todos los
// administradores de un taller).
async function enviarPushVarios(usuarioIds, titulo, cuerpo, datos) {
  for (const id of usuarioIds) await enviarPush(id, titulo, cuerpo, datos);
}

module.exports = { enviarPush, enviarPushVarios };
