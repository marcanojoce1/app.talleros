// Genera el PDF usando un navegador real (Chromium headless) en el servidor —
// el mismo motor de renderizado que ya sabemos que funciona perfecto cuando el
// usuario abre "Acta imprimible" y le da Ctrl+P, pero automatizado por completo.
// Reemplaza el intento anterior de imitar un navegador con html2canvas en el
// cliente, que nunca terminó de comportarse igual que un navegador de verdad.
let _browserPromise = null;

function getBrowser() {
  if (!_browserPromise) {
    const puppeteer = require('puppeteer');
    _browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }).catch((e) => { _browserPromise = null; throw e; });
  }
  return _browserPromise;
}

// Convierte un HTML completo (el mismo que genera acta.js) a un Buffer PDF real,
// respetando de verdad @page, page-break-inside/before, etc. — como un navegador.
async function generarPDFDesdeHTML(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return buffer;
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { generarPDFDesdeHTML };
