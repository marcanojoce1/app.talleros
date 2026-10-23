// Modo claro / oscuro (☀️ / 🌙) para TODA la app.
// En vez de reescribir cada pantalla, convierte los colores al vuelo: cuando el modo oscuro está activo,
// cada elemento que se dibuja pasa por aquí y sus colores claros se cambian por sus equivalentes oscuros.
import React, { useSyncExternalStore } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fondoOscuro, textoOscuro, bordeOscuro, esColorAcento, TXT, TXT_OSCURO } from './themeColors';

let oscuro = false;
const subs = new Set();
const KEY = 'talleros_tema';

export const esOscuro = () => oscuro;
export function setOscuro(v) {
  oscuro = !!v;
  subs.forEach((f) => { try { f(); } catch (e) { /* nada */ } });
  AsyncStorage.setItem(KEY, oscuro ? 'oscuro' : 'claro').catch(() => {});
}
// Las pantallas llaman a useTema() para volver a dibujarse cuando cambia el modo.
const suscribir = (cb) => { subs.add(cb); return () => subs.delete(cb); };
const leer = () => oscuro;
export function useTema() {
  return useSyncExternalStore(suscribir, leer);
}
AsyncStorage.getItem(KEY).then((v) => { if (v === 'oscuro' && !oscuro) setOscuro(true); }).catch(() => {});

const BG = ['backgroundColor'];
const BORDES = ['borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'borderStartColor', 'borderEndColor'];
const cache = new WeakMap();
const cacheTxt = new WeakMap();

function mapear(flat, esTexto) {
  const out = { ...flat };
  let acento = false;
  for (const k of BG) {
    if (typeof out[k] === 'string') { if (esColorAcento(out[k])) acento = true; out[k] = fondoOscuro(out[k]); }
  }
  for (const k of BORDES) if (typeof out[k] === 'string') out[k] = bordeOscuro(out[k]);
  if (typeof out.color === 'string') out.color = textoOscuro(out.color);
  else if (esTexto) out.color = TXT;
  return { style: out, acento };
}
function convertir(style, esTexto) {
  const mapa = esTexto ? cacheTxt : cache;
  const clave = style && typeof style === 'object' ? style : null;
  if (clave && mapa.has(clave)) return mapa.get(clave);
  const r = mapear(StyleSheet.flatten(style) || {}, esTexto);
  if (clave) mapa.set(clave, r);
  return r;
}

// Dentro de un botón de color vivo (amarillo, verde…) el texto "oscuro" debe seguir siendo oscuro.
function arreglarHijos(ch, prof) {
  if (prof > 4 || ch == null) return ch;
  if (Array.isArray(ch)) { let cambio = false; const n = ch.map((c) => { const r = arreglarHijos(c, prof); if (r !== c) cambio = true; return r; }); return cambio ? n : ch; }
  if (!React.isValidElement(ch)) return ch;
  const p = ch.props || {};
  const hijos = p.children !== undefined ? arreglarHijos(p.children, prof + 1) : undefined;
  const st = p.style && StyleSheet.flatten(p.style);
  const fijar = st && st.color === TXT;
  if (!fijar && hijos === p.children) return ch;
  const nuevo = {};
  if (fijar) nuevo.style = [p.style, { color: TXT_OSCURO }];
  if (hijos !== p.children) nuevo.children = hijos;
  return React.cloneElement(ch, nuevo);
}

function parchear(orig) {
  return function (type, props, ...resto) {
    if (!oscuro || !props || typeof props !== 'object') return orig(type, props, ...resto);
    let hecho;
    try { hecho = transformar(type, props); } catch (e) { hecho = props; } // si algo falla, se dibuja normal
    return orig(type, hecho, ...resto);
  };
}
function transformar(type, props) {
  {
    const esTexto = type === Text || type === TextInput;
    let np = null, acento = false;
    if (props.style !== undefined || esTexto) {
      const r = convertir(props.style, esTexto);
      np = { ...props, style: r.style };
      acento = r.acento;
    }
    if (props.contentContainerStyle !== undefined) {
      np = np || { ...props };
      np.contentContainerStyle = convertir(props.contentContainerStyle, false).style;
    }
    if (type === TextInput) {
      np = np || { ...props };
      if (!np.placeholderTextColor) np.placeholderTextColor = '#7A869B';
      np.keyboardAppearance = 'dark';
    }
    if (acento && props.children !== undefined) {
      np = np || { ...props };
      np.children = arreglarHijos(props.children, 0);
    }
    return np || props;
  }
}

// Se instala una sola vez sobre el "dibujador" de React (jsx, jsxs, jsxDEV y createElement).
function instalar() {
  const mods = [];
  try { mods.push(require('react/jsx-runtime')); } catch (e) { /* nada */ }
  try { mods.push(require('react/jsx-dev-runtime')); } catch (e) { /* nada */ }
  mods.forEach((m) => {
    ['jsx', 'jsxs', 'jsxDEV'].forEach((n) => {
      if (typeof m[n] === 'function' && !m[n].__tema) { const p = parchear(m[n]); p.__tema = true; try { m[n] = p; } catch (e) { /* solo lectura */ } }
    });
  });
  if (!React.createElement.__tema) {
    const ce = React.createElement;
    const pc = function (type, props, ...hijos) {
      const base = (t, p) => ce(t, p, ...hijos);
      return parchear((t, p) => base(t, p))(type, props);
    };
    pc.__tema = true;
    try { React.createElement = pc; } catch (e) { /* solo lectura */ }
  }
}
instalar();

// Botón ☀️ / 🌙 para las cabeceras.
export function BotonTema({ claroEnCabecera = false }) {
  const o = useTema();
  return (
    <TouchableOpacity
      onPress={() => setOscuro(!o)}
      activeOpacity={0.7}
      accessibilityLabel={o ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: claroEnCabecera ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.15)', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 16 }}>{o ? '☀️' : '🌙'}</Text>
    </TouchableOpacity>
  );
}
