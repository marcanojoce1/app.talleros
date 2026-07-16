// Crea los usuarios iniciales con contraseña cifrada (bcrypt).
// Uso:  npm run seed
// Contraseña de todos los usuarios demo:  demo1234
require('dotenv').config();
const { pool } = require('./db');
const bcrypt = require('bcryptjs');

const USERS = [
  { nombre: 'J. Ramírez',      usuario: 'jramirez',  correo: 'admin@talleros.ve',     rol: 'administrador', telefono: '+58 412 555 0001' },
  { nombre: 'M. Salazar',      usuario: 'msalazar',  correo: 'gerencia@talleros.ve',  rol: 'administrador', telefono: '+58 412 555 0002' },
  { nombre: 'Diego Cárdenas',  usuario: 'dcardenas', correo: 'dcardenas@talleros.ve', rol: 'mecanico',      telefono: '+58 412 333 1001' },
  { nombre: 'Carlos Mendoza',  usuario: 'cmendoza',  correo: 'carlos.m@gmail.com',    rol: 'cliente',       telefono: '+58 412 555 0134' },
];

async function run() {
  const hash = await bcrypt.hash('demo1234', 10);
  for (const u of USERS) {
    await pool.query(
      `INSERT INTO usuarios (nombre,usuario,correo,password,rol,telefono)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (usuario) DO NOTHING`,
      [u.nombre, u.usuario, u.correo, hash, u.rol, u.telefono]
    );
  }
  console.log('✓ Usuarios creados. Contraseña de todos: demo1234');
  console.log('  Admin:    jramirez / demo1234');
  console.log('  Mecánico: dcardenas / demo1234');
  console.log('  Cliente:  cmendoza / demo1234');
  await pool.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
