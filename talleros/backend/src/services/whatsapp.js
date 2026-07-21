// Envío de WhatsApp. Soporta Twilio, Meta Cloud API, o modo demo (consola).
require('dotenv').config();

async function sendWhatsApp(to, text) {
  const provider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();

  // ----- TWILIO -----
  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    const body = new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: text });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!r.ok) throw new Error('Twilio: ' + (await r.text()));
    return { ok: true, provider: 'twilio' };
  }

  // ----- META (WhatsApp Cloud API) -----
  if (provider === 'meta') {
    const phoneId = process.env.META_PHONE_ID;
    const tokenM = process.env.META_TOKEN;
    const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenM}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/[^0-9]/g, ''),
        type: 'text',
        text: { body: text },
      }),
    });
    if (!r.ok) throw new Error('Meta: ' + (await r.text()));
    return { ok: true, provider: 'meta' };
  }

  // ----- DEMO (sin credenciales) -----
  console.log(`\n[WHATSAPP DEMO] Para ${to}:\n${text}\n`);
  return { ok: true, provider: 'demo' };
}

module.exports = { sendWhatsApp };
