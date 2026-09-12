// Servidor principal de TallerOS (versión local con SQLite).
// Crea la base de datos automáticamente y sirve la web del administrador.
require('dotenv').config();

// Protección: si un cliente sube una foto/video y cancela o pierde la conexión a
// medias, Node puede lanzar un error FUERA del ciclo normal de la petición (no lo
// atrapa el middleware de errores de Express) y sin esto, tumba TODO el servidor —
// causando que se reinicie y que, mientras tanto, todo el mundo vea el dashboard
// lento o en blanco. Con esto, se registra el error y el servidor sigue de pie.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException (el servidor sigue corriendo):', err && err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection (el servidor sigue corriendo):', err && err.message);
});

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
// Política de privacidad (requerida por Google Play Console)
app.use(express.static(path.join(__dirname, '..', 'public')));
// Carpeta con el APK para actualización OTA (descarga directa)
const APK_DIR = path.join(__dirname, '..', 'apk');
try { if (!fs.existsSync(APK_DIR)) fs.mkdirSync(APK_DIR, { recursive: true }); } catch (e) {}
app.use('/apk', express.static(APK_DIR));

// Versión más reciente publicada. Se lee de apk/version.json para poder
// actualizar SIN tocar el código: solo subes el APK y editas ese JSON.
function versionActual() {
  const def = { appVersion: '1.0.1', appBuild: 84, apk: '', notas: '' };
  try {
    const p = path.join(APK_DIR, 'version.json');
    if (fs.existsSync(p)) {
      let contenido = fs.readFileSync(p, 'utf8');
      if (contenido.charCodeAt(0) === 0xFEFF) contenido = contenido.slice(1); // quita el BOM si lo trae
      return { ...def, ...JSON.parse(contenido) };
    }
  } catch (e) {
    console.error('[version] No se pudo leer/parsear apk/version.json, usando valores por defecto:', e.message);
  }
  return def;
}
app.get('/api/version', (req, res) => {
  const v = versionActual();
  // Si el JSON no trae URL de APK, se asume /apk/talleros.apk
  const host = req.protocol + '://' + req.get('host');
  const apkUrl = v.apk ? (v.apk.startsWith('http') ? v.apk : host + v.apk) : (host + '/apk/talleros.apk');
  res.json({ appVersion: v.appVersion, appBuild: v.appBuild, apk: apkUrl, notas: v.notas || '' });
});

// API
app.get('/api/health', (req, res) => { const v = versionActual(); res.json({ ok: true, servicio: 'TallerOS API', hora: new Date(), appVersion: v.appVersion, appBuild: v.appBuild }); });
app.use('/api/auth', require('./routes/auth'));
app.use('/api/talleres', require('./routes/talleres'));
app.use('/api/demo', require('./routes/demo'));
app.use('/api/state', require('./routes/state'));
app.use('/api', require('./routes/acta'));
app.use('/api', require('./routes/entities'));
app.use('/api', require('./routes/ordenes'));
app.use('/api/config', require('./routes/config'));
app.use('/api/branding', require('./routes/branding'));
app.use('/api/media', require('./routes/media'));

// Servir la web del administrador y las apps (PWA) desde el mismo servidor
const pick = (a, b) => (fs.existsSync(a) ? a : b);
// Una sola copia de la plataforma web (antes había una copia duplicada en
// backend/web-admin que causaba que los cambios "no se vieran" si solo se
// actualizaba la de la raíz — ahora hay una sola fuente real).
app.use('/', express.static(path.join(__dirname, '..', '..', 'web-admin')));
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
  // Muchos proveedores de PostgreSQL "pausan" la base de datos sola tras unos
  // minutos sin uso (aunque el backend esté en un plan de pago) — el primer
  // usuario que llega después paga 20-30 segundos mientras despierta. Con esta
  // consulta liviana cada 4 minutos, la base nunca llega a quedarse inactiva.
  try {
    const { query } = require('./db');
    setInterval(() => { query('SELECT 1').catch(() => {}); }, 4 * 60 * 1000);
  } catch (e) { /* si falla, no afecta el arranque del servidor */ }
}).catch((e) => { console.error('Error al iniciar:', e); process.exit(1); });
