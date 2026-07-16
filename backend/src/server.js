// Servidor principal de TallerOS (versión local con SQLite).
// Crea la base de datos automáticamente y sirve la web del administrador.
require('dotenv').config();
const express = require('express');
require('express-async-errors');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const { init } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*' } });
app.set('io', io);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

// API
app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'TallerOS API', hora: new Date() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/talleres', require('./routes/talleres'));
app.use('/api/state', require('./routes/state'));
app.use('/api', require('./routes/acta'));
app.use('/api', require('./routes/entities'));
app.use('/api', require('./routes/ordenes'));
app.use('/api/config', require('./routes/config'));

// Servir la web del administrador y las apps (PWA) desde el mismo servidor
const pick = (a, b) => (fs.existsSync(a) ? a : b);
app.use('/', express.static(pick(path.join(__dirname, '..', 'web-admin'), path.join(__dirname, '..', '..', 'web-admin'))));
app.use('/app', express.static(pick(path.join(__dirname, '..', 'apps'), path.join(__dirname, '..', '..', 'apps'))));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message || 'Error interno' }); });

io.on('connection', (socket) => { socket.on('disconnect', () => {}); });

const PORT = process.env.PORT || 4000;
init().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('  TallerOS esta corriendo');
    console.log('  Abre en tu navegador:  http://localhost:' + PORT);
    console.log('  Usuario: jramirez   Clave: demo1234');
    console.log('========================================\n');
  });
}).catch((e) => { console.error('Error al iniciar:', e); process.exit(1); });
