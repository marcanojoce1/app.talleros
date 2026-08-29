// Envío de correo — usa Resend (HTTP, recomendado, sin líos de SMTP/Google) si está
// configurado; si no, cae a SMTP tradicional (nodemailer); si tampoco, modo demo (consola).
require('dotenv').config();
const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendEmail(to, subject, text, html) {
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'TallerOS <onboarding@resend.dev>',
        to: [to],
        subject,
        text,
        html: html || undefined,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Resend: ' + (data.message || 'no se pudo enviar el correo'));
    return { ok: true, provider: 'resend', id: data.id };
  }
  if (!transporter) {
    console.log(`\n[CORREO DEMO] Para ${to} — ${subject}:\n${text}\n`);
    return { ok: true, provider: 'demo' };
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'TallerOS <no-reply@talleros.com>',
    to,
    subject,
    text,
    html: html || undefined,
  });
  return { ok: true, provider: 'smtp' };
}

module.exports = { sendEmail };
