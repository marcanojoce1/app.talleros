// Conversión de colores claros -> oscuros (sin dependencias de React Native, para poder probarla aparte).
const CARD = '#18223A';      // tarjetas / modales
const PAGE = '#0E1627';      // fondo de pantalla, campos de texto y chips
const BORDE = '#2A3550';
const HEADER = '#0A101E';
export const TXT = '#E8ECF4';        // texto principal en oscuro
export const TXT_SUAVE = '#98A4B8';  // texto secundario
export const TXT_OSCURO = '#16191d'; // texto oscuro que se mantiene sobre botones de color

function parse(c) {
  if (typeof c !== 'string') return null;
  c = c.trim().toLowerCase();
  if (c === 'white') c = '#ffffff';
  else if (c === 'black') c = '#000000';
  if (c[0] !== '#') return null; // rgba(), transparent, etc. se dejan igual
  let h = c.slice(1);
  if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 255 };
}
function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}
function hslHex(h, s, l, a = 255) {
  const k = (n) => (n + h / 30) % 12;
  const f = (n) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + x(f(0)) + x(f(8)) + x(f(4)) + (a < 255 ? a.toString(16).padStart(2, '0') : '');
}
const conAlfa = (hex, a) => (a < 255 ? hex.slice(0, 7) + a.toString(16).padStart(2, '0') : hex);

export function esColorAcento(c) { // botón/chip de color vivo (amarillo, verde, azul…): su texto debe seguir oscuro/blanco
  const p = parse(c); if (!p || p.a < 255) return false;
  const { s, l } = toHsl(p);
  return s > 0.45 && l > 0.25 && l < 0.85;
}

export function fondoOscuro(c) {
  const p = parse(c); if (!p) return c;
  const { h, s, l } = toHsl(p);
  if (p.a === 0) return c;
  if (l >= 0.975 && s < 0.3) return conAlfa(CARD, p.a);
  if (l >= 0.86 && s < 0.25) return conAlfa(PAGE, p.a);
  if (l >= 0.78 && s >= 0.25) return conAlfa(hslHex(h, Math.min(s, 0.45), 0.17), p.a); // fondos pastel (verde, amarillo, rojo suave…)
  if (l >= 0.5 && s < 0.25) return conAlfa('#3A455C', p.a);   // grises medios (deshabilitado)
  if (l < 0.14 && s < 0.35) return conAlfa(HEADER, p.a);       // negros (cabeceras, botones oscuros)
  return c; // colores vivos: se quedan igual
}

export function textoOscuro(c) {
  const p = parse(c); if (!p) return c;
  const { h, s, l } = toHsl(p);
  if (l > 0.88) return c;                              // blanco: se queda
  if (s < 0.35) return l < 0.35 ? TXT : TXT_SUAVE;      // negro -> claro, gris -> gris claro
  if (l < 0.58) return hslHex(h, Math.min(1, s), 0.7, p.a); // azul/verde/ámbar oscuros -> versión clara
  return c;
}

export function bordeOscuro(c) {
  const p = parse(c); if (!p) return c;
  const { h, s, l } = toHsl(p);
  if (l > 0.75) return s < 0.25 ? conAlfa(BORDE, p.a) : conAlfa(hslHex(h, s * 0.6, 0.3), p.a);
  return c;
}
