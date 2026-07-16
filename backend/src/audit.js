// Registro de auditoría: guarda quién hizo qué, cuándo, con IP y dispositivo.
const { query } = require('./db');

async function registrar({ req, user, accion, modulo, detalle, taller_id }) {
  try {
    const u = user || (req && req.user) || {};
    let ip = '';
    if (req) {
      ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || (req.socket && req.socket.remoteAddress) || '';
    }
    const disp = req ? (req.headers['user-agent'] || '') : '';
    await query(
      'INSERT INTO auditoria (usuario_id,usuario_nombre,rol,accion,modulo,detalle,ip,dispositivo,taller_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [u.id || null, u.nombre || u.usuario || '', u.rol || '', accion || '', modulo || '', detalle || '', ip, disp, taller_id || null]);
  } catch (e) {
    // La auditoría nunca debe romper la operación principal
    console.log('auditoria error:', e.message);
  }
}

module.exports = { registrar };
