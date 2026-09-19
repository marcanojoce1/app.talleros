// Herramienta de rescate: reinicia la contraseña de un usuario (por defecto, el superadmin).
// Uso:
//   node --experimental-sqlite src/reset-pass.js                 -> superadmin con clave "super1234"
//   node --experimental-sqlite src/reset-pass.js MiClave         -> superadmin con la clave que indiques
//   node --experimental-sqlite src/reset-pass.js MiClave usuario -> cambia la clave de ese usuario
// En Render: pestaña "Shell" del servicio.
try { require('dotenv').config(); } catch (e) {}
const bcrypt = require('bcryptjs');
const { query, init } = require('./db');

async function main() {
  const nueva = process.argv[2] || 'super1234';
  const usuario = process.argv[3] || 'superadmin';
  await init();
  const { rows } = await query('SELECT id, usuario, rol FROM usuarios WHERE usuario=$1', [usuario]);
  const hash = await bcrypt.hash(nueva, 10);
  if (!rows.length) {
    if (usuario !== 'superadmin') { console.log('No existe el usuario "' + usuario + '".'); process.exit(1); }
    await query('INSERT INTO usuarios (nombre,usuario,correo,password,rol,activo) VALUES ($1,$2,$3,$4,$5,1)',
      ['Super Administrador', 'superadmin', 'super@talleros.ve', hash, 'superadmin']);
    console.log('Super Admin recreado.  usuario: superadmin   clave: ' + nueva);
    process.exit(0);
  }
  await query('UPDATE usuarios SET password=$2, activo=1 WHERE id=$1', [rows[0].id, hash]);
  console.log('Contrasena actualizada.');
  console.log('  usuario: ' + rows[0].usuario + '  (' + rows[0].rol + ')');
  console.log('  clave nueva: ' + nueva);
  process.exit(0);
}
main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
