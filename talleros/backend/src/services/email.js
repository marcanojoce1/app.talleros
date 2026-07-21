// Envío de correo vía SMTP (nodemailer) o modo demo (consola).
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

async function sendEmail(to, subject, text) {
  if (!transporter) {
    console.log(`\n[CORREO DEMO] Para ${to} — ${subject}:\n${text}\n`);
    return { ok: true, provider: 'demo' };
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'TallerOS <no-reply@talleros.com>',
    to,
    subject,
    text,
  });
  return { ok: true, provider: 'smtp' };
}

module.exports = { sendEmail };
