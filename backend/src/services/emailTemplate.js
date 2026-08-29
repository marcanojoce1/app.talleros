// Plantilla de correo con formato bonito para TallerOS (estilo tarjeta, como el
// ejemplo de referencia: encabezado de color, ícono, nombre, mensaje destacado).
function plantillaCorreo({ titulo, nombre, mensaje, destacado, contacto }) {
  const filasDestacado = (destacado || [])
    .map((d) => `<div style="font-weight:700;color:#16406b;margin:4px 0">${d}</div>`)
    .join('');
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.08)">
  <div style="background:#16406b;padding:22px;text-align:center">
    <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:.02em">🔧 TallerOS</span>
  </div>
  <div style="padding:30px 26px;text-align:center">
    ${nombre ? `<div style="font-size:17px;font-weight:800;color:#16406b;margin-bottom:6px">${nombre}</div>` : ''}
    <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:18px">${titulo}</div>
    ${mensaje ? `<div style="font-size:13.5px;color:#4b5563;margin-bottom:16px;line-height:1.5">${mensaje}</div>` : ''}
    ${filasDestacado ? `<div style="background:#f7f8fa;border-radius:10px;padding:16px;margin-bottom:16px">${filasDestacado}</div>` : ''}
    ${contacto ? `<div style="font-size:11.5px;color:#8a919c;margin-top:18px;line-height:1.6;border-top:1px solid #eee;padding-top:16px">${contacto}</div>` : ''}
  </div>
</div>
</body></html>`;
}

module.exports = { plantillaCorreo };
