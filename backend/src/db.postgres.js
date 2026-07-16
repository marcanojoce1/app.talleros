// VERSIÓN PARA PRODUCCIÓN CON POSTGRESQL (referencia).
// Para usarla: 1) npm install pg   2) renombra este archivo a db.js
// 3) define DATABASE_URL en .env   4) corre schema.sql y seed.sql en tu Postgres.
require('dotenv').config();
const { Pool } = require('pg');
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } })
  : new Pool();
async function query(text, params) { return pool.query(text, params); }
module.exports = { pool, query };
