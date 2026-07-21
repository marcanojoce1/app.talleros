// (Opcional) Recrea las tablas manualmente. Normalmente NO hace falta:
// el servidor crea la base solo la primera vez que haces "npm start".
const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const dir = path.join(__dirname, '..', '..', 'database');
console.log('Creando tablas...');
db.exec(fs.readFileSync(path.join(dir, 'schema.sqlite.sql'), 'utf8'));
db.exec(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
console.log('Listo. Ahora ejecuta:  npm run seed   (crea los usuarios)');
