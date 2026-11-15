// Genera URLs firmadas para que la app (foto/video de avances) suba directo a
// Cloudflare R2 (compatible con S3), sin pasar el archivo por el servidor —
// importante porque el plan del servidor tiene poca RAM y los videos pesan.
const express = require('express');
const crypto = require('crypto');
const { auth } = require('../auth');

const router = express.Router();

let s3Client = null;
function getClient() {
  if (s3Client) return s3Client;
  const { S3Client } = require('@aws-sdk/client-s3');
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) return null;
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return s3Client;
}

// POST /api/media/upload-url  { tipo: 'foto'|'video'|'miniatura', ext: 'jpg'|'mp4' }
// Devuelve { uploadUrl, publicUrl } — la app hace PUT a uploadUrl con el archivo,
// y luego guarda publicUrl como el link permanente para ver el archivo.
router.post('/upload-url', auth, async (req, res) => {
  const client = getClient();
  if (!client) return res.status(500).json({ error: 'El almacenamiento de fotos/videos (R2) no está configurado en el servidor todavía.' });
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (!bucket || !publicBase) return res.status(500).json({ error: 'Falta configurar R2_BUCKET_NAME o R2_PUBLIC_URL en el servidor.' });

  const { tipo, ext } = req.body || {};
  const extLimpia = String(ext || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5) || 'jpg';
  const carpeta = tipo === 'video' ? 'videos' : tipo === 'miniatura' ? 'miniaturas' : 'fotos';
  const nombre = `${carpeta}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extLimpia}`;

  try {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: nombre, ContentType: req.body.contentType || 'application/octet-stream' });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 300 }); // 5 minutos para subir
    const publicUrl = `${publicBase}/${nombre}`;
    res.json({ uploadUrl, publicUrl });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo preparar la subida: ' + e.message });
  }
});


// ---- Migración automática: fotos antiguas guardadas dentro del estado (base64) -> R2 ----
// Las fotos de avances viejas pesan varios MB cada una DENTRO del estado del taller, y eso
// hace que la app tarde mucho en abrir ("Actualizando datos…"). Aquí se suben a R2 y en su
// lugar queda solo el enlace. Si R2 no está configurado o algo falla, la foto se deja como estaba.
async function subirBase64(dataUri) {
  const client = getClient();
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (!client || !bucket || !publicBase) return null;
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUri);
  if (!m) return null;
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const ext = m[1].toLowerCase().includes('png') ? 'png' : 'jpg';
  const nombre = `fotos/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: nombre, Body: Buffer.from(m[2], 'base64'), ContentType: m[1] }));
  return `${publicBase}/${nombre}`;
}
// Recorre los avances de los vehículos; devuelve cuántas fotos pasó a R2 (máx. `max` por llamada).
async function migrarFotosEstado(data, max = 12) {
  let n = 0;
  if (!data || !Array.isArray(data.vehicles)) return 0;
  for (const v of data.vehicles) {
    for (const a of (v && v.advances) || []) {
      if (n >= max) return n;
      if (a && typeof a.foto === 'string' && a.foto.startsWith('data:image/') && a.foto.length > 20000) {
        try { const url = await subirBase64(a.foto); if (url) { a.foto = url; n++; } } catch (e) { console.error('migrar foto:', e.message); }
      }
    }
  }
  return n;
}
function tieneFotosBase64(data) {
  return !!(data && Array.isArray(data.vehicles) && data.vehicles.some((v) => ((v && v.advances) || []).some((a) => a && typeof a.foto === 'string' && a.foto.startsWith('data:image/') && a.foto.length > 20000)));
}

module.exports = router;
module.exports.migrarFotosEstado = migrarFotosEstado;
module.exports.tieneFotosBase64 = tieneFotosBase64;
