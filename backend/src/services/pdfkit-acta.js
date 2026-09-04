// Genera el Acta y el informe de Trabajo Realizado como PDF real, dibujado
// directamente con PDFKit — sin necesitar Chrome/Puppeteer para nada. Al controlar
// manualmente cada salto de página, el Acta SIEMPRE queda en la hoja 1, y las fotos
// NUNCA se cortan a la mitad (se decide explícitamente cuándo empieza cada hoja).
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const PAGE_W = 595.28, PAGE_H = 841.89; // A4 en puntos (72pt = 1 pulgada)
const M = 24; // margen
const IMG_DIR = path.join(__dirname, '..', '..', '..', 'web-admin', 'img');

const CAR_IMG = { Superior: 'car-sup.png', Frontal: 'car-front.png', 'Lateral Izquierdo': 'car-izq.png', 'Lateral Derecho': 'car-izq.png', Posterior: 'car-post.png' };
const SEV_COLOR = { leve: '#2563eb', moderado: '#d97706', grave: '#dc2626' };

function bufferDeBase64(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') return null;
  const m = dataUri.match(/^data:image\/\w+;base64,(.+)$/);
  if (!m) return null;
  try { return Buffer.from(m[1], 'base64'); } catch (e) { return null; }
}

function caja(doc, x, y, w, h, titulo) {
  doc.rect(x, y, w, h).stroke('#111');
  if (titulo) {
    doc.rect(x, y, Math.min(140, w), 15).fill('#111');
    doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold').text(titulo, x + 5, y + 4, { width: w - 10 });
    doc.fillColor('#111');
  }
}

function textoCampo(doc, x, y, label, valor, wLabel, w) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111').text(label + ':', x, y, { continued: false });
  doc.font('Helvetica').fontSize(9).text(valor || '', x + wLabel, y, { width: w - wLabel });
}

// Dibuja la hoja 1: el Acta de recepción completa.
function dibujarActa(doc, o) {
  const taller = o.taller || {};
  const cli = o.cliente || {};
  const v = o.vehiculo || {};
  const r = o.recepcion || {};
  const mon = o.moneda || 'Bs.';
  let y = M;

  // Cada sección va protegida por separado — si una falla (dato raro, imagen que no
  // carga, etc.) las demás secciones se siguen dibujando igual, en vez de perderse
  // todo lo que viene después.
  const seccion = (nombre, fn) => { try { fn(); } catch (e) { console.error('[pdfkit] Error en sección "' + nombre + '":', e.message); } };

  // --- Encabezado ---
  seccion('encabezado', () => {
    const hEnc = 62;
    doc.rect(M, y, PAGE_W - 2 * M, hEnc).stroke('#111');
    doc.moveTo(M + 130, y).lineTo(M + 130, y + hEnc).stroke('#111');
    const logoBuf = bufferDeBase64(taller.logo);
    if (logoBuf) { try { doc.image(logoBuf, M + 6, y + 6, { fit: [50, 30] }); } catch (e) {} }
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(taller.nombre || 'TallerOS', M + 6, y + 40, { width: 118 });
    doc.font('Helvetica').fontSize(7).fillColor('#666').text('TALLER AUTOMOTRIZ', M + 6, y + 52);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text('ACTA DE INSPECCIÓN, RECEPCIÓN Y ENTREGA DE VEHÍCULO', M + 140, y + 6, { width: PAGE_W - 2 * M - 146, align: 'center' });
    const now = new Date();
    const infoY = y + 34;
    const colW = (PAGE_W - 2 * M - 130) / 4;
    [['FECHA', now.toLocaleDateString('es-VE')], ['HORA', now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })], ['LOCAL', taller.nombre || '-'], ['N ORDEN', o.orden || '']].forEach(([lbl, val], i) => {
      const cx = M + 140 + i * colW;
      doc.moveTo(cx, y + 26).lineTo(cx, y + hEnc).stroke('#ccc');
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#666').text(lbl, cx + 4, infoY - 8);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text(String(val || ''), cx + 4, infoY + 3, { width: colW - 8 });
    });
    y += hEnc;
  });

  // --- Cliente / Vehículo ---
  const hCV = 74, wMid = (PAGE_W - 2 * M) / 2;
  seccion('cliente-vehiculo', () => {
    caja(doc, M, y, wMid, hCV, 'Datos del Cliente');
    caja(doc, M + wMid, y, wMid, hCV, 'Datos del Vehículo');
    let yy = y + 20;
    textoCampo(doc, M + 6, yy, 'Nombre', cli.n || '', 42, wMid - 12); yy += 12;
    textoCampo(doc, M + 6, yy, 'Cedula', cli.doc || '', 42, wMid - 12); yy += 12;
    textoCampo(doc, M + 6, yy, 'Celular', cli.tel || '', 42, wMid - 12); yy += 12;
    textoCampo(doc, M + 6, yy, 'Email', cli.correo || '', 42, wMid - 12);
    yy = y + 20;
    textoCampo(doc, M + wMid + 6, yy, 'Marca/Modelo', String(v.model || ''), 62, wMid - 12); yy += 12;
    textoCampo(doc, M + wMid + 6, yy, 'Placa', String(v.plate || ''), 62, wMid - 12); yy += 12;
    textoCampo(doc, M + wMid + 6, yy, 'Tipo/Color', String(r.tipoVeh || v.tipoVeh || '') + ' - ' + String(r.color || v.color || ''), 62, wMid - 12); yy += 12;
    textoCampo(doc, M + wMid + 6, yy, 'Km', String(v.km || r.km || ''), 62, wMid - 12);
  });
  y += hCV;

  // --- Accesorios / Documentos / Combustible-Prioridad-Batería ---
  const hAcc = 60, wDer = 130, wIzq = PAGE_W - 2 * M - wDer;
  seccion('accesorios-combustible', () => {
    caja(doc, M, y, wIzq, hAcc, 'Accesorios / Documentos');
    const acc = [].concat(r.accesorios || []).concat(r.documentos || []).filter((x) => typeof x === 'string');
    let ax = M + 6, ay = y + 20, col = 0;
    acc.slice(0, 8).forEach((a) => {
      doc.font('Helvetica').fontSize(7.5).fillColor('#111').text('[X] ' + a, ax + (col % 2) * (wIzq / 2), ay, { width: wIzq / 2 - 8 });
      col++; if (col % 2 === 0) ay += 10;
    });
    caja(doc, M + wIzq, y, wDer, hAcc, 'Combustible');
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#111').text(String(r.combustible || '1/2'), M + wIzq, y + 18, { width: wDer, align: 'center' });
    doc.font('Helvetica').fontSize(7).fillColor('#666').text('Prioridad: ' + String(r.prioridad || 'Media'), M + wIzq + 6, y + 40);
    if (r.bateria) doc.font('Helvetica').fontSize(6.5).fillColor('#666').text('Bateria: ' + String(r.bateriaMarca || '') + ' ' + (r.bateriaAmperaje ? r.bateriaAmperaje + 'A' : ''), M + wIzq + 6, y + 50, { width: wDer - 10 });
  });
  y += hAcc;

  // --- Inspección visual (diagramas del vehículo) ---
  const lados = o.lados || [];
  if (lados.length) {
    seccion('inspeccion-visual', () => {
      const hTit = 14;
      doc.rect(M, y, PAGE_W - 2 * M, hTit).fill('#111');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text('Inspeccion visual - vistas registradas', M + 5, y + 3);
      doc.fillColor('#111');
      y += hTit;
      const porFila = 3, wCelda = (PAGE_W - 2 * M) / porFila, hCelda = 78;
      lados.slice(0, 6).forEach((lado, i) => {
        const cx = M + (i % porFila) * wCelda, cy = y + Math.floor(i / porFila) * hCelda;
        doc.rect(cx, cy, wCelda, hCelda).stroke('#ccc');
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#666').text(String(lado || ''), cx, cy + 3, { width: wCelda, align: 'center' });
        const img = CAR_IMG[lado];
        if (img) { try { doc.image(path.join(IMG_DIR, img), cx + wCelda / 2 - 30, cy + 14, { width: 60 }); } catch (e) {} }
      });
      y += Math.ceil(lados.length / porFila) * hCelda;
    });
  }

  // --- Daños registrados ---
  const damages = o.damages || [];
  if (damages.length) {
    seccion('danos', () => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('Danos registrados (' + damages.length + '):', M, y + 4);
      y += 14;
      damages.slice(0, 6).forEach((d, i) => {
        const col = i % 2, fila = Math.floor(i / 2);
        const sev = String(d.sev || 'leve').toLowerCase();
        doc.circle(M + col * 280 + 3, y + fila * 10 + 3, 3).fill(SEV_COLOR[sev] || '#2563eb');
        doc.fillColor('#111').font('Helvetica').fontSize(7.5).text('#' + (i + 1) + ' ' + String(d.tipo || '') + ' - ' + String(d.lado || '') + ' (' + String(d.sev || '') + ')', M + col * 280 + 10, y + fila * 10);
      });
      y += Math.ceil(damages.length / 2) * 10 + 6;
    });
  }

  // --- Servicios / Autorización ---
  const hServ = 70;
  seccion('servicios-autorizacion', () => {
    caja(doc, M, y, wMid, hServ, 'Servicios Solicitados');
    const servicios = o.servicios || [];
    let sy = y + 20;
    servicios.slice(0, 3).forEach((s) => {
      doc.font('Helvetica').fontSize(8).fillColor('#111').text(String((s && s.desc) || ''), M + 6, sy, { width: wMid - 70 });
      doc.text(s && s.precio ? mon + ' ' + Number(s.precio).toLocaleString('es-VE') : '', M + wMid - 60, sy, { width: 54, align: 'right' });
      sy += 12;
    });
    caja(doc, M + wMid, y, wMid, hServ, 'Autorizacion');
    doc.font('Helvetica').fontSize(6.5).fillColor('#333').text('Estoy de acuerdo con las condiciones de servicio y autorizo la reparacion con el material necesario.', M + wMid + 6, y + 18, { width: wMid - 12 });
    const firmaCliBuf = bufferDeBase64(r.firmaCliImg), firmaRecBuf = bufferDeBase64(r.firmaRecImg);
    const fw = (wMid - 20) / 2;
    if (firmaCliBuf) { try { doc.image(firmaCliBuf, M + wMid + 6, y + 36, { fit: [fw, 24] }); } catch (e) {} }
    if (firmaRecBuf) { try { doc.image(firmaRecBuf, M + wMid + 12 + fw, y + 36, { fit: [fw, 24] }); } catch (e) {} }
    doc.moveTo(M + wMid + 6, y + hServ - 10).lineTo(M + wMid + 6 + fw, y + hServ - 10).stroke('#999');
    doc.moveTo(M + wMid + 12 + fw, y + hServ - 10).lineTo(M + wMid + 6 + 2 * fw + 6, y + hServ - 10).stroke('#999');
    doc.font('Helvetica').fontSize(6).fillColor('#666').text('Firma del Cliente', M + wMid + 6, y + hServ - 8, { width: fw, align: 'center' });
    doc.font('Helvetica').fontSize(6).text('Firma del Recepcionista', M + wMid + 12 + fw, y + hServ - 8, { width: fw, align: 'center' });
  });
  y += hServ;

  // --- Observaciones ---
  if (r.obs && r.obs !== '-' && r.obs !== '—') {
    seccion('observaciones', () => {
      const hObs = 40;
      doc.rect(M, y, PAGE_W - 2 * M, hObs).stroke('#111');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111').text('Observaciones:', M + 6, y + 5, { continued: true });
      doc.font('Helvetica').fontSize(7.5).text(' ' + String(r.obs), { width: PAGE_W - 2 * M - 12 });
      y += hObs;
    });
  }

  // --- Condiciones del servicio ---
  seccion('condiciones', () => {
    const cond = taller.condiciones || '1) Si el vehiculo no se recoge una vez terminado el trabajo, se cobrara resguardo por dia. 2) Es necesario liquidar el 100% del servicio para entregar la unidad.';
    const hCond = 50;
    doc.rect(M, y, PAGE_W - 2 * M, hCond).stroke('#111');
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#111').text('Condiciones del Servicio:', M + 6, y + 5);
    doc.font('Helvetica').fontSize(6.5).fillColor('#444').text(String(cond), M + 6, y + 15, { width: PAGE_W - 2 * M - 12, height: hCond - 20, ellipsis: true });
  });
}

// Dibuja las hojas de "Trabajo realizado": movimientos y fotos (2 por hoja).
function dibujarBitacora(doc, avances, orden, veh) {
  const textoSolo = avances.filter((a) => !a.foto && !a.video);
  const conFoto = avances.filter((a) => a.foto || a.video);

  if (textoSolo.length) {
    doc.addPage({ size: 'A4', margin: 0 });
    let y = M;
    doc.rect(M, y, PAGE_W - 2 * M, 16).fill('#111');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9).text('TRABAJO REALIZADO - Movimientos', M + 6, y + 4);
    doc.fillColor('#111');
    y += 22;
    textoSolo.forEach((a) => {
      doc.rect(M, y, 3, 24).fill('#F5B700');
      doc.fillColor('#111').font('Helvetica-Bold').fontSize(8.5).text(a.t || 'Avance', M + 10, y + 2, { width: PAGE_W - 2 * M - 14 });
      doc.font('Helvetica').fontSize(7.5).fillColor('#666').text((a.m || '') + (a.ago ? ' · ' + a.ago : ''), M + 10, y + 13, { width: PAGE_W - 2 * M - 14 });
      y += 28;
    });
  }

  // Fotos: exactamente 2 por hoja, cada grupo en su propia página.
  for (let i = 0; i < conFoto.length; i += 2) {
    doc.addPage({ size: 'A4', margin: 0 });
    let y = M;
    doc.rect(M, y, PAGE_W - 2 * M, 16).fill('#111');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9).text('TRABAJO REALIZADO - Fotos', M + 6, y + 4);
    doc.fillColor('#111');
    y += 24;
    const grupo = conFoto.slice(i, i + 2);
    const wCelda = (PAGE_W - 2 * M - 14) / 2;
    const hCelda = 480;
    grupo.forEach((a, idx) => {
      const cx = M + idx * (wCelda + 14);
      doc.rect(cx, y, wCelda, hCelda).stroke('#ccc');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111').text(a.t || 'Avance', cx + 8, y + 8, { width: wCelda - 16 });
      doc.font('Helvetica').fontSize(7).fillColor('#666').text((a.m || '') + (a.ago ? ' · ' + a.ago : ''), cx + 8, y + 20, { width: wCelda - 16 });
      const buf = bufferDeBase64(a.foto) || bufferDeBase64(a.videoThumb);
      const fotoY = y + 34;
      const fotoH = a.video ? hCelda - 56 : hCelda - 42;
      if (buf) {
        try { doc.image(buf, cx + 8, fotoY, { fit: [wCelda - 16, fotoH], align: 'center', valign: 'center' }); } catch (e) {}
      } else if (a.foto && a.foto.startsWith('http')) {
        doc.font('Helvetica').fontSize(7).fillColor('#999').text('(foto alojada externamente, no se pudo incrustar)', cx + 8, fotoY + fotoH / 2, { width: wCelda - 16, align: 'center' });
      } else if (a.video) {
        doc.rect(cx + 8, fotoY, wCelda - 16, fotoH).fillAndStroke('#f2f4f7', '#ccc');
        doc.fillColor('#666').font('Helvetica').fontSize(9).text('Video', cx + 8, fotoY + fotoH / 2 - 5, { width: wCelda - 16, align: 'center' });
      }
      if (a.video) doc.font('Helvetica').fontSize(6.5).fillColor('#666').text('Video adjunto — ver desde la app', cx + 8, y + hCelda - 12, { width: wCelda - 16 });
    });
  }
}

function generarActaPDF(o) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      dibujarActa(doc, o);
      doc.end();
    } catch (e) { reject(e); }
  });
}

function generarTrabajoPDF(o) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      dibujarActa(doc, o);
      dibujarBitacora(doc, o.avances || [], o.orden, o.vehiculo);
      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { generarActaPDF, generarTrabajoPDF };
