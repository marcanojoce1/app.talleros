// Selector automático de base de datos:
//  - Si existe DATABASE_URL (ej. Render con PostgreSQL) -> usa PostgreSQL (datos permanentes).
//  - Si no -> usa SQLite (archivo local, para tu PC).
module.exports = process.env.DATABASE_URL
  ? require('./db.pg')
  : require('./db.sqlite');
