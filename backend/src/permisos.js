// Definición central de módulos, acciones y permisos por defecto según el rol.
const MODULOS = ['dashboard', 'recepcion', 'ordenes', 'trabajos', 'clientes', 'vehiculos', 'mecanicos', 'facturacion', 'config', 'talleres', 'usuarios', 'auditoria'];
const ACCIONES = ['ver', 'crear', 'editar', 'eliminar', 'imprimir', 'exportar', 'aprobar'];

function todo(v) { const o = {}; ACCIONES.forEach((a) => { o[a] = v ? 1 : 0; }); return o; }

function defaultPerms(rol) {
  const p = {};
  MODULOS.forEach((m) => { p[m] = todo(false); });
  if (rol === 'superadmin') {
    MODULOS.forEach((m) => { p[m] = todo(true); });
    return p;
  }
  if (rol === 'administrador') {
    ['dashboard', 'recepcion', 'ordenes', 'trabajos', 'clientes', 'vehiculos', 'mecanicos', 'facturacion', 'config', 'usuarios', 'auditoria'].forEach((m) => { p[m] = todo(true); });
    p.talleres = todo(false); // el admin no administra talleres
    return p;
  }
  if (rol === 'mecanico') {
    p.dashboard = { ...todo(false), ver: 1 };
    p.ordenes = { ...todo(false), ver: 1, editar: 1 };
    p.trabajos = { ...todo(false), ver: 1 };
    p.recepcion = { ...todo(false), ver: 1 };
    p.vehiculos = { ...todo(false), ver: 1 };
    return p;
  }
  if (rol === 'cliente') {
    p.trabajos = { ...todo(false), ver: 1 };
    p.vehiculos = { ...todo(false), ver: 1 };
    p.facturacion = { ...todo(false), ver: 1 };
    return p;
  }
  return p;
}

// Combina los permisos guardados (si hay) con los del rol como respaldo.
function resolverPerms(rol, guardadosJson) {
  const base = defaultPerms(rol);
  if (!guardadosJson) return base;
  let g = guardadosJson;
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch { return base; } }
  if (!g || typeof g !== 'object') return base;
  const out = {};
  MODULOS.forEach((m) => { out[m] = { ...base[m], ...(g[m] || {}) }; });
  return out;
}

module.exports = { MODULOS, ACCIONES, defaultPerms, resolverPerms };
