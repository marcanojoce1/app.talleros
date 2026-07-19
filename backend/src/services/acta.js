// Genera el ACTA DE INSPECCIÓN, RECEPCIÓN Y ENTREGA DE VEHÍCULO en HTML.
// Mismo formato para web y apps. Muestra SOLO las vistas del vehículo marcadas.

const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Rutas de las imágenes del carro (las mismas que usa la recepción)
const CAR_VIEWS = {
  sup: { img: 'car-sup.png', label: 'Superior' },
  front: { img: 'car-front.png', label: 'Frontal' },
  post: { img: 'car-post.png', label: 'Posterior' },
  izq: { img: 'car-izq.png', label: 'Lateral Izquierdo' },
  der: { img: 'car-izq.png', label: 'Lateral Derecho' }, // se espeja por CSS
};
const LADO_KEY = { 'Superior': 'sup', 'Frontal': 'front', 'Posterior': 'post', 'Lat. Izq.': 'izq', 'Lateral Izquierdo': 'izq', 'Lat. Der.': 'der', 'Lateral Derecho': 'der' };

function checkbox(marcado) {
  return `<span style="display:inline-block;width:11px;height:11px;border:1.3px solid #333;border-radius:2px;vertical-align:middle;text-align:center;line-height:10px;font-size:9px;margin-right:4px">${marcado ? '✔' : ''}</span>`;
}

// data: { taller, cliente, tecnico, vehiculo, recepcion, damages, lados, servicios, baseUrl }
function generarActaHTML(o = {}) {
  const taller = o.taller || {};
  const cli = o.cliente || {};
  const veh = o.vehiculo || {};
  const r = o.recepcion || {};
  const damages = o.damages || [];
  const baseUrl = o.baseUrl || '';
  const mon = o.moneda || 'Bs.';
  const pago = o.pago || null;

  // Vistas seleccionadas: SOLO las que tienen daño marcado (o las indicadas en r.lados)
  const seleccion = new Set();
  (o.lados || r.lados || []).forEach((l) => { const k = LADO_KEY[l] || l; if (CAR_VIEWS[k]) seleccion.add(k); });
  damages.forEach((d) => { const k = LADO_KEY[d.lado] || d.lado; if (CAR_VIEWS[k]) seleccion.add(k); });
  const vistas = [...seleccion];

  // Accesorios: SOLO los que el usuario marcó (no la lista completa)
  const accMarcados = (r.accesorios || []);
  const docsMarcados = (r.documentos || []);

  const combN = { 'E': 0, 'Vacío': 0, 'Vacio': 0, '¼': 25, '1/4': 25, '½': 50, '1/2': 50, '¾': 75, '3/4': 75, 'F': 100, 'Lleno': 100 };
  const combPct = combN[r.combustible] != null ? combN[r.combustible] : 50;

  // Servicios: solo el trabajo seleccionado (más los adicionales si los hay)
  const servicios = (o.servicios && o.servicios.length) ? o.servicios : [{ desc: r.trabajo || r.motivo || '', precio: o.precio || '' }];

  const vistaImgs = vistas.map((k) => {
    const v = CAR_VIEWS[k];
    const mirror = k === 'der' ? 'transform:scaleX(-1);' : '';
    const dañosVista = damages.filter((d) => (LADO_KEY[d.lado] || d.lado) === k);
    const pins = dañosVista.map((d, i) => {
      const left = (d.x != null ? d.x : 50) + '%';
      const top = (d.y != null ? d.y : 50) + '%';
      return `<span class="pin" style="left:${left};top:${top};transform:translate(-50%,-50%)">${d.n || i + 1}</span>`;
    }).join('');
    return `<div class="carbox">
      <div class="carlbl">${esc(v.label)}</div>
      <div class="carimg">${baseUrl ? `<img src="${baseUrl}/img/${v.img}" style="${mirror}max-width:100%;max-height:150px"/>` : `<div style="color:#999;padding:30px">${esc(v.label)}</div>`}
        <div class="pins">${pins}</div></div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Acta de Inspección — ${esc(veh.plate || '')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 0; padding: 14px; font-size: 12px; background: #fff; }
  .sheet { max-width: 780px; margin: 0 auto; border: 2px solid #111; }
  .head { display: flex; border-bottom: 2px solid #111; }
  .brand { padding: 12px 14px; border-right: 2px solid #111; min-width: 190px; }
  .brand h1 { margin: 0; font-size: 20px; letter-spacing: .5px; }
  .brand .sub { font-size: 9px; color: #555; letter-spacing: 1px; }
  .brand .sub2 { font-size: 9px; color: #666; margin-top: 1px; }
  .titlebox { flex: 1; display: flex; flex-direction: column; }
  .titlebox .t { flex: 1; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 15px; text-align: center; padding: 8px; }
  .meta { display: flex; border-top: 1.5px solid #111; }
  .meta > div { flex: 1; padding: 5px 8px; border-right: 1px solid #111; font-size: 10px; }
  .meta > div:last-child { border-right: 0; }
  .meta b { display: block; font-size: 9px; color: #444; }
  .row { display: flex; border-bottom: 1.5px solid #111; }
  .col { flex: 1; padding: 8px 10px; border-right: 1.5px solid #111; }
  .col:last-child { border-right: 0; }
  .col h3 { margin: 0 0 6px; font-size: 12px; background: #111; color: #fff; padding: 3px 7px; display: inline-block; }
  .fld { font-size: 11px; padding: 2px 0; border-bottom: 1px dotted #999; margin-bottom: 3px; }
  .fld span { color: #555; }
  .cars { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px; justify-content: center; }
  .carbox { border: 1px solid #ccc; border-radius: 6px; padding: 6px; text-align: center; background: #fbfbfb; min-width: 150px; }
  .carlbl { font-size: 9px; font-weight: bold; color: #666; letter-spacing: 1px; margin-bottom: 4px; }
  .carimg { position: relative; display: inline-block; }
  .pins { position: absolute; inset: 0; }
  .pin { position: absolute; background: #dc2626; color: #fff; border-radius: 50%; width: 16px; height: 16px; font-size: 9px; line-height: 16px; text-align: center; font-weight: bold; }
  .acc { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 14px; font-size: 10px; padding: 8px 10px; }
  .acc .item { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 1px 0; }
  .sino { white-space: nowrap; }
  .serv table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .serv td, .serv th { border: 1px solid #999; padding: 4px 6px; }
  .fuel { text-align: center; font-size: 10px; }
  .cond { font-size: 8.5px; color: #444; padding: 8px 10px; line-height: 1.4; border-top: 1.5px solid #111; }
  .firma { border-top: 1px solid #333; margin-top: 6px; padding-top: 3px; text-align: center; font-size: 9px; }
  .firmaimg { min-height: 52px; display:flex; align-items:flex-end; justify-content:center; overflow:visible; }
  @media print { .noprint { display: none; } body { padding: 0; } }
  .toolbar { max-width: 780px; margin: 0 auto 10px; display: flex; gap: 8px; }
  .toolbar button { flex: 1; padding: 12px; border: 0; border-radius: 10px; font-weight: bold; font-size: 14px; cursor: pointer; }
  .btnPrint { background: #F5B700; color: #16191d; }
</style></head>
<body>
  <!--TOOLBAR_START--><div class="toolbar noprint">
    <button class="btnPrint" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  </div><!--TOOLBAR_END-->
  <div class="sheet">
    <div class="head">
      <div class="brand">
        ${taller.logo ? `<img src="${esc(taller.logo)}" style="max-height:44px;max-width:170px;margin-bottom:4px"/>` : ''}
        <h1>${esc(taller.nombre || 'TallerOS')}</h1>
        <div class="sub">${esc(taller.rubro || 'TALLER AUTOMOTRIZ')}</div>
        ${taller.telefono ? `<div class="sub2">Tel: ${esc(taller.telefono)}</div>` : ''}
        ${taller.direccion ? `<div class="sub2">${esc(taller.direccion)}</div>` : ''}
        ${taller.rif ? `<div class="sub2">RIF: ${esc(taller.rif)}</div>` : ''}
      </div>
      <div class="titlebox">
        <div class="t">ACTA DE INSPECCIÓN, RECEPCIÓN Y<br/>ENTREGA DE VEHÍCULO</div>
        <div class="meta">
          <div><b>FECHA</b>${esc(r.fecha || '')}</div>
          <div><b>HORA</b>${esc(r.hora || '')}</div>
          <div><b>LOCAL</b>${esc(taller.nombre || '')}</div>
          <div><b>N° ORDEN</b>${esc(o.orden || veh.id || '')}</div>
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col">
        <h3>Datos del Cliente</h3>
        <div class="fld"><span>Nombre:</span> ${esc(cli.n || cli.nombre || '')}</div>
        <div class="fld"><span>${esc(cli.tipoDoc || 'Documento')}:</span> ${esc(cli.doc || '')}</div>
        <div class="fld"><span>Celular / WhatsApp:</span> ${esc(cli.tel || '')}</div>
        <div class="fld"><span>Email:</span> ${esc(cli.correo || '')}</div>
      </div>
      <div class="col">
        <h3>Datos del Vehículo</h3>
        <div class="fld"><span>Marca / Modelo:</span> ${esc(veh.model || veh.marca || '')}</div>
        <div class="fld"><span>Placa:</span> ${esc(veh.plate || '')}</div>
        <div class="fld"><span>Tipo:</span> ${esc(r.tipoVeh || veh.tipoVeh || '')} &nbsp; <span>Color:</span> ${esc(r.color || veh.color || '')}</div>
        <div class="fld"><span>Kilometraje:</span> ${esc(r.km || '')} &nbsp; <span>Mecánico:</span> ${esc(veh.mech || '')}</div>
      </div>
    </div>

    <div class="row">
      <div class="col" style="flex:1.3">
        <h3>Accesorios recibidos</h3>
        ${accMarcados.length ? `<div class="acc">
          ${accMarcados.map((a) => `<div class="item"><span>${checkbox(true)} ${esc(a)}</span></div>`).join('')}
        </div>` : `<div style="padding:6px 10px;color:#888;font-size:11px">Ninguno marcado.</div>`}
        <h3 style="margin-top:10px">Documentos entregados</h3>
        ${docsMarcados.length ? `<div class="acc">
          ${docsMarcados.map((a) => `<div class="item"><span>${checkbox(true)} ${esc(a)}</span></div>`).join('')}
        </div>` : `<div style="padding:6px 10px;color:#888;font-size:11px">Ninguno marcado.</div>`}
      </div>
      <div class="col fuel" style="max-width:150px">
        <h3>Combustible</h3>
        <div style="margin-top:14px;font-size:22px;font-weight:bold">${esc(r.combustible || '½')}</div>
        <div style="height:8px;background:#eee;border-radius:4px;margin-top:8px;overflow:hidden"><div style="height:8px;width:${combPct}%;background:#F5B700"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;margin-top:3px"><span>E</span><span>F</span></div>
        ${r.prioridad ? `<div style="margin-top:14px"><b>Prioridad</b><br/>${esc(r.prioridad)}</div>` : ''}
      </div>
    </div>

    ${vistas.length ? `<div style="border-bottom:1.5px solid #111"><div style="background:#111;color:#fff;padding:3px 10px;font-size:11px;font-weight:bold">Inspección visual — vistas registradas</div>
      <div class="cars">${vistaImgs}</div>
      ${damages.length ? `<div style="padding:8px 12px"><b style="font-size:11px">Daños registrados (${damages.length}):</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:10.5px;margin-top:5px">${damages.map((d) => `<div>● <b>#${d.n}</b> ${esc(d.tipo || 'Daño')} — ${esc(d.lado || '')} <span style="color:#888">(${esc(d.sev === 'grave' ? 'Grave' : d.sev === 'mod' ? 'Moderado' : 'Leve')})</span></div>`).join('')}</div></div>` : ''}
      </div>` : ''}

    <div class="row serv">
      <div class="col">
        <h3>Servicios Solicitados</h3>
        <table><tr><th>Descripción</th><th style="width:90px">Precio</th></tr>
        ${servicios.map((sv) => `<tr><td>${esc(sv.desc || '')}</td><td>${sv.precio ? esc(mon) + ' ' + esc(sv.precio) : ''}</td></tr>`).join('')}
        ${Array(Math.max(0, 2 - servicios.length)).fill('<tr><td>&nbsp;</td><td></td></tr>').join('')}
        </table>
        ${pago ? `<table style="margin-top:6px">
          <tr><td style="text-align:right"><b>Total</b></td><td style="width:110px"><b>${esc(mon)} ${Number(pago.total).toLocaleString('es-VE')}</b></td></tr>
          <tr><td style="text-align:right;color:#16A34A">Pagado</td><td style="color:#16A34A">${esc(mon)} ${Number(pago.pagado).toLocaleString('es-VE')}</td></tr>
          ${pago.saldo > 0 ? `<tr><td style="text-align:right;color:#D97706"><b>Saldo pendiente</b></td><td style="color:#D97706"><b>${esc(mon)} ${Number(pago.saldo).toLocaleString('es-VE')}</b></td></tr>` : `<tr><td style="text-align:right;color:#16A34A"><b>Estado</b></td><td style="color:#16A34A"><b>PAGADO ✓</b></td></tr>`}
        </table>` : ''}
      </div>
      <div class="col">
        <h3>Autorización</h3>
        <div style="font-size:9.5px;line-height:1.4">Estoy de acuerdo con las condiciones de servicio y autorizo la reparación con el material necesario, y concedo permiso para operar la unidad con fines de inspección y prueba.</div>
        ${r.firmaCliImg ? `<div class="firmaimg"><img src="${esc(r.firmaCliImg)}" style="max-height:52px;max-width:200px;object-fit:contain"/></div>` : (r.firmaCli ? `<div class="firmaimg">${firmaSVG(r.firmaCli)}</div>` : '')}
        <div class="firma">Firma del Cliente</div>
      </div>
    </div>

    ${r.obs && r.obs !== '—' ? `<div style="padding:8px 10px;border-bottom:1.5px solid #111"><b>Observaciones:</b> ${esc(r.obs)}</div>` : ''}

    <div class="cond">
      <b>Condiciones del Servicio:</b><br/>
      ${taller.condiciones ? esc(taller.condiciones).replace(/\n/g, '<br/>') : `1) Si el vehículo no se recoge una vez terminado el trabajo, se cobrará resguardo por día.
      2) Es necesario liquidar el 100% del servicio para entregar la unidad.
      3) En caso de requerir servicio adicional, el cliente será notificado antes de realizarlo.
      4) El taller no se responsabiliza por objetos de valor no reportados al momento de la recepción.`}
    </div>
    ${taller.pie ? `<div style="text-align:center;font-size:9px;color:#666;padding:6px;border-top:1px solid #ccc">${esc(taller.pie)}</div>` : ''}
  </div>
</body></html>`;
}

// Convierte los trazos de firma (paths) a un pequeño SVG
function firmaSVG(trazos) {
  if (!Array.isArray(trazos) || !trazos.length) return '';
  const paths = trazos.map((p) => `<path d="${esc(p)}" stroke="#16191d" stroke-width="2" fill="none" stroke-linecap="round"/>`).join('');
  return `<svg viewBox="0 0 300 120" width="140" height="44">${paths}</svg>`;
}

// Informe de TRABAJO REALIZADO: ficha de recepción + todas las fotos y avances del mecánico
function generarTrabajoHTML(o = {}) {
  const acta = generarActaHTML(o); // reusa el acta completa
  const avances = o.avances || [];
  const mon = o.moneda || 'Bs.';

  // Sección extra: bitácora del mecánico con fotos
  const bitacora = avances.length ? avances.map((a) => `
    <div class="bit">
      <div class="bit-t">${esc(a.t || 'Avance')}</div>
      <div class="bit-m">${esc(a.m || '')}${a.ago ? ' · ' + esc(a.ago) : ''}</div>
      ${a.foto ? `<img src="${esc(a.foto)}" class="bit-foto"/>` : ''}
    </div>`).join('') : '<div style="color:#888;padding:10px">Sin avances registrados.</div>';

  const extra = `
    <div class="sheet" style="margin-top:16px">
      <div style="background:#111;color:#fff;padding:8px 12px;font-weight:bold;font-size:13px">TRABAJO REALIZADO — Bitácora del mecánico</div>
      <div style="padding:12px">${bitacora}</div>
    </div>
    <style>
      .bit { border-left: 3px solid #F5B700; padding: 8px 12px; margin-bottom: 12px; background: #fafafa; }
      .bit-t { font-weight: bold; font-size: 13px; }
      .bit-m { color: #666; font-size: 11px; margin-top: 2px; }
      .bit-foto { max-width: 100%; max-height: 260px; border-radius: 8px; margin-top: 8px; display: block; }
    </style>`;

  // Insertar la bitácora antes de cerrar el body
  return acta.replace('</body>', extra + '</body>');
}

module.exports = { generarActaHTML, generarTrabajoHTML };
