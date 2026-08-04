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

module.exports = router;
