// Genera PDFs de verdad en el servidor usando Puppeteer (un Chrome real, sin
// interfaz) — a diferencia del método anterior (captura de pantalla + corte
// mecánico), esto respeta los saltos de página (page-break-inside, etc.) tal
// como los define el CSS, así que las fotos y el Acta nunca quedan cortadas.
let _browser = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  const puppeteer = require('puppeteer-core');
  const chromium = require('@sparticuz/chromium');
  _browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  return _browser;
}

// Convierte un HTML (como el que genera generarActaHTML/generarTrabajoHTML) a un
// PDF real en A4, respetando los saltos de página del CSS. Devuelve un Buffer.
async function htmlAPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
    return buffer;
  } finally {
    await page.close();
  }
}

module.exports = { htmlAPdf };
