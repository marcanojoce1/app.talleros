import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, PanResponder, Image } from 'react-native';
import Svg, { Path, G, Rect, Circle, Ellipse, Line } from 'react-native-svg';

/* Acepta opciones como texto ('Toyota') o como objeto ({marca:'Toyota', modelos:[...]}) */
export const etiqueta = (o) => (typeof o === 'string' ? o : (o && (o.marca || o.nombre || o.n || o.name)) || '');

/* ================= LISTA DESPLEGABLE (como la web) =================
   - Se abre como lista vertical, con buscador
   - Opción "＋ Agregar…" al final para crear uno nuevo ahí mismo
*/
export function Dropdown({ label, value, onChange, options, onAdd, placeholder, obligatorio, deshabilitado, textoVacio, meta, error }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [agregando, setAgregando] = useState(false);
  const opts = (options || []).map(etiqueta).filter(Boolean);
  const norm = (t) => (t == null ? '' : String(t)).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const textoDe = (o) => norm(o + ' ' + ((meta && meta[o]) || ''));
  const filtradas = opts.filter((o) => {
    if (!q.trim()) return true;
    const t = textoDe(o);
    return norm(q).split(/\s+/).filter(Boolean).every((w) => t.includes(w));
  });

  const elegir = (o) => { onChange(o); setOpen(false); setQ(''); setAgregando(false); setNuevo(''); };
  const confirmarNuevo = () => {
    const t = (nuevo || '').trim();
    if (!t) return;
    if (!opts.includes(t) && onAdd) onAdd(t);
    elegir(t);
  };

  return (
    <View>
      {!!label && <Text style={d.label}>{label}{obligatorio ? ' *' : ''}</Text>}
      <TouchableOpacity
        style={[d.select, deshabilitado && { backgroundColor: '#f1f3f5' }, error && { borderWidth: 2, borderColor: '#dc2626', backgroundColor: '#fff5f5' }]}
        activeOpacity={0.7}
        onPress={() => { if (!deshabilitado) setOpen(true); }}>
        <Text style={[d.selectT, !value && { color: '#9aa3ad' }]} numberOfLines={1}>
          {value || placeholder || 'Selecciona…'}
        </Text>
        <Text style={d.caret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={d.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={d.sheet} activeOpacity={1}>
            <View style={d.sheetHead}>
              <Text style={d.sheetTitle}>{label || 'Selecciona'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
            </View>

            {opts.length > 1 && (
              <TextInput style={d.search} value={q} onChangeText={setQ}
                placeholder="Buscar por nombre, cédula, teléfono…" autoCorrect={false} autoCapitalize="none" />
            )}

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {filtradas.length ? filtradas.map((o) => (
                <TouchableOpacity key={o} style={[d.item, value === o && d.itemOn]} onPress={() => elegir(o)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[d.itemT, value === o && { fontWeight: '800' }]}>{o}</Text>
                    {meta && meta[o] ? <Text style={{ fontSize: 11.5, color: '#6b7480', marginTop: 2 }}>{meta[o]}</Text> : null}
                  </View>
                  {value === o && <Text style={{ color: '#16A34A', fontWeight: '800' }}>✓</Text>}
                </TouchableOpacity>
              )) : (
                <Text style={d.vacio}>{textoVacio || 'Sin opciones. Agrega una nueva abajo.'}</Text>
              )}
            </ScrollView>

            {onAdd && (agregando ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TextInput style={[d.search, { flex: 1, marginBottom: 0 }]} value={nuevo} onChangeText={setNuevo}
                  placeholder={'Nuevo(a) ' + String(label || '').toLowerCase()} autoFocus />
                <TouchableOpacity style={d.addOk} onPress={confirmarNuevo}><Text style={d.addOkT}>Agregar</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={d.addBtn} onPress={() => setAgregando(true)}>
                <Text style={d.addBtnT}>＋ Agregar nuevo</Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ================= FIRMA (el cliente firma con el dedo) ================= */
export function FirmaPad({ visible, titulo, onClose, onGuardar }) {
  const [trazos, setTrazos] = useState([]);   // trazos ya terminados
  const actual = useRef([]);                  // trazo en curso
  const [tick, setTick] = useState(0);        // fuerza el redibujo

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        actual.current = [`M${e.nativeEvent.locationX.toFixed(1)},${e.nativeEvent.locationY.toFixed(1)}`];
        setTick((t) => t + 1);
      },
      onPanResponderMove: (e) => {
        actual.current.push(`L${e.nativeEvent.locationX.toFixed(1)},${e.nativeEvent.locationY.toFixed(1)}`);
        setTick((t) => t + 1);
      },
      onPanResponderRelease: () => {
        const p = actual.current.join(' ');
        if (p) setTrazos((prev) => [...prev, p]);
        actual.current = [];
        setTick((t) => t + 1);
      },
    })
  ).current;

  const limpiar = () => { setTrazos([]); actual.current = []; setTick((t) => t + 1); };
  const guardar = () => {
    const todos = [...trazos, actual.current.join(' ')].filter(Boolean);
    if (!todos.length) { onClose(); return; }
    onGuardar(todos); // se guardan los trazos de la firma
    limpiar();
  };

  const enCurso = actual.current.join(' ');

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={d.backdrop}>
        <View style={d.firmaCard}>
          <View style={d.sheetHead}>
            <Text style={d.sheetTitle}>{titulo || 'Firma'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: '#6b7480', marginBottom: 8 }}>Firme con el dedo dentro del recuadro.</Text>

          <View style={d.lienzo} {...pan.panHandlers}>
            <Svg width="100%" height="100%">
              {trazos.map((p, i) => (
                <Path key={i} d={p} stroke="#16191d" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {!!enCurso && <Path d={enCurso} stroke="#16191d" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            </Svg>
            {!trazos.length && !enCurso && <Text style={d.lienzoHint}>Firme aquí</Text>}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={d.btnGris} onPress={limpiar}><Text style={d.btnGrisT}>Borrar</Text></TouchableOpacity>
            <TouchableOpacity style={d.btnOk} onPress={guardar}><Text style={d.btnOkT}>Guardar firma</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* Muestra una firma ya guardada (miniatura) */
// Calcula el rectángulo que ocupa la firma para que nunca se vea cortada
// Convierte los trazos de la firma (rutas SVG) en una imagen real (data URI) que el Acta
// en PDF sí puede mostrar con <img> — antes se guardaban los trazos "en crudo" y el PDF
// (generado en el servidor) no sabía leerlos, por eso la firma salía en blanco.
export function firmaADataUri(trazos) {
  if (!trazos || !trazos.length) return '';
  const c = cajaFirma(trazos);
  const paths = trazos.map((p) => `<path d="${p}" stroke="#16191d" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.x} ${c.y} ${c.w} ${c.h}">${paths}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function cajaFirma(trazos) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  (trazos || []).forEach((p) => {
    const nums = String(p).match(/-?\d+(\.\d+)?/g) || [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = parseFloat(nums[i]), y = parseFloat(nums[i + 1]);
      if (isNaN(x) || isNaN(y)) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  });
  if (!isFinite(minX)) return { x: 0, y: 0, w: 300, h: 120 };
  const m = 8; // margen para que no toque el borde
  return { x: minX - m, y: minY - m, w: Math.max(20, maxX - minX + m * 2), h: Math.max(20, maxY - minY + m * 2) };
}

export function FirmaVista({ trazos, alto = 70 }) {
  if (!trazos || !trazos.length) return null;
  const c = cajaFirma(trazos);
  return (
    <View style={{ height: alto, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 8 }}>
      <Svg width="100%" height="100%" viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`} preserveAspectRatio="xMidYMid meet">
        {trazos.map((p, i) => (<Path key={i} d={p} stroke="#16191d" strokeWidth={2.2} fill="none" strokeLinecap="round" />))}
      </Svg>
    </View>
  );
}

/* ================= DESLIZADOR DE AVANCE (0-100%) ================= */
export function ProgressSlider({ value, onChange }) {
  const [w, setW] = useState(0);
  const pct = Math.max(0, Math.min(100, value || 0));
  const set = (x) => { if (!w) return; onChange(Math.round(Math.max(0, Math.min(1, x / w)) * 100)); };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
      onPanResponderMove: (e) => set(e.nativeEvent.locationX),
    })
  ).current;
  return (
    <View>
      <View style={d.sliderTrack} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
        <View style={d.sliderBase} />
        <View style={[d.sliderFill, { width: pct + '%' }]} />
        <View style={[d.sliderKnob, { left: `${pct}%` }]} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {[25, 50, 75, 100].map((p) => (
          <TouchableOpacity key={p} style={d.qbtn} onPress={() => onChange(p)}><Text style={d.qbtnT}>{p}%</Text></TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* Carro real (imagen comprada) — 4 vistas */
const CAR_IMGS = {
  sup: require('../assets/car/sup.png'),
  front: require('../assets/car/front.png'),
  post: require('../assets/car/post.png'),
  izq: require('../assets/car/izq.png'),
  der: require('../assets/car/izq.png'), // el contenedor lo espeja
};

export function CarroSVG({ lado, width = 300, height = 210 }) {
  const src = CAR_IMGS[lado] || CAR_IMGS.sup;
  return (
    <Image source={src} style={{ width, height }} resizeMode="stretch" />
  );
}

const d = StyleSheet.create({
  sliderTrack: { height: 34, justifyContent: 'center', backgroundColor: 'transparent' },
  sliderBase: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: '#e7e9ec' },
  sliderFill: { position: 'absolute', left: 0, height: 8, borderRadius: 4, backgroundColor: '#F5B700' },
  sliderKnob: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: '#16191d', marginLeft: -13, borderWidth: 3, borderColor: '#fff' },
  qbtn: { flex: 1, borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 9, paddingVertical: 8, alignItems: 'center', backgroundColor: '#fff' },
  qbtnT: { fontWeight: '700', fontSize: 12, color: '#16191d' },
  label: { fontSize: 12, fontWeight: '700', color: '#3a4048', marginTop: 12, marginBottom: 6 },
  select: { borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 11, paddingVertical: 13, paddingHorizontal: 13, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectT: { fontSize: 15, color: '#16191d', flex: 1 },
  caret: { color: '#6b7480', fontSize: 14, marginLeft: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', padding: 18 },
  sheet: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#16191d' },
  search: { borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 10, padding: 11, fontSize: 14, marginBottom: 8, backgroundColor: '#fff' },
  item: { paddingVertical: 13, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: '#f1f3f5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemOn: { backgroundColor: '#fff8e3' },
  itemT: { fontSize: 15, color: '#16191d' },
  vacio: { color: '#6b7480', fontSize: 13, padding: 14, textAlign: 'center' },
  addBtn: { marginTop: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2563EB', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  addBtnT: { color: '#2563EB', fontWeight: '800', fontSize: 14 },
  addOk: { backgroundColor: '#16191d', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addOkT: { color: '#fff', fontWeight: '800' },
  firmaCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  lienzo: { height: 210, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#c9d1da', borderRadius: 12, backgroundColor: '#fbfcfd', justifyContent: 'center', alignItems: 'center' },
  lienzoHint: { position: 'absolute', color: '#c2c9d2', fontSize: 15 },
  btnGris: { flex: 1, backgroundColor: '#eef0f2', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnGrisT: { fontWeight: '800', color: '#16191d' },
  btnOk: { flex: 2, backgroundColor: '#F5B700', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnOkT: { fontWeight: '800', color: '#16191d' },
});

/* ============ DISTINTIVO DE MARCA (sin logos registrados) ============ */
const COLOR_MARCA = {
  toyota: '#EB0A1E', kia: '#05141F', hyundai: '#002C5F', ford: '#003478', chevrolet: '#D1A650',
  nissan: '#C3002F', honda: '#CC0000', mazda: '#101010', volkswagen: '#001E50', renault: '#FFCC33',
  peugeot: '#00615F', fiat: '#941E32', jeep: '#0B4C34', mitsubishi: '#E60012', suzuki: '#E30613',
  bmw: '#0066B1', mercedes: '#00ADEF', audi: '#BB0A30', dodge: '#B5121B', chery: '#C8102E',
  byd: '#003E7E', jac: '#0072BC', great: '#C8102E', changan: '#004B87', geely: '#0B2C5F',
  encava: '#0057A6', iveco: '#003B7E', mack: '#B4975A', volvo: '#003057', scania: '#041E42',
};
export function marcaDe(veh) {
  const t = String((veh && (veh.marca || veh.model)) || '').trim();
  return t.split(/[\s/·-]+/)[0] || '';
}
export function colorMarca(nombre) {
  const k = String(nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const m in COLOR_MARCA) if (k.startsWith(m)) return COLOR_MARCA[m];
  let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 360;
  return 'hsl(' + h + ',55%,32%)';
}

/* ============ CALENDARIO VISUAL (sin librerías, funciona siempre) ============ */
export function Calendario({ visible, valor, onSelect, onClose, titulo }) {
  const hoy = new Date();
  const parseVal = () => {
    if (!valor) return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const t = String(valor).trim();
    let a, m, d;
    if (t.includes('-')) { const p = t.split('-'); if (p[0].length === 4) { a = +p[0]; m = +p[1]; d = +p[2]; } }
    else if (t.includes('/')) { const p = t.split('/'); d = +p[0]; m = +p[1]; a = +p[2]; }
    if (a && m) return new Date(a, m - 1, d || 1);
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  };
  const [ver, setVer] = React.useState(parseVal());
  React.useEffect(() => { if (visible) setVer(parseVal()); }, [visible]);

  const anio = ver.getFullYear(), mes = ver.getMonth();
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const primerDia = new Date(anio, mes, 1).getDay();
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= totalDias; d++) celdas.push(d);
  const esHoy = (d) => d && anio === hoy.getFullYear() && mes === hoy.getMonth() && d === hoy.getDate();
  const cambiarMes = (delta) => setVer(new Date(anio, mes + delta, 1));
  const elegir = (d) => { onSelect(d + '/' + (mes + 1) + '/' + anio); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cal.wrap}>
        <View style={cal.card}>
          <Text style={cal.tit}>{titulo || 'Selecciona la fecha'}</Text>
          <View style={cal.nav}>
            <TouchableOpacity onPress={() => cambiarMes(-1)} style={cal.navBtn}><Text style={cal.navT}>‹</Text></TouchableOpacity>
            <Text style={cal.mesT}>{MESES[mes]} {anio}</Text>
            <TouchableOpacity onPress={() => cambiarMes(1)} style={cal.navBtn}><Text style={cal.navT}>›</Text></TouchableOpacity>
          </View>
          <View style={cal.semana}>
            {DIAS.map((d, i) => <Text key={i} style={cal.diaSem}>{d}</Text>)}
          </View>
          <View style={cal.grid}>
            {celdas.map((d, i) => (
              <TouchableOpacity key={i} disabled={!d} style={cal.celda} onPress={() => d && elegir(d)}>
                {d ? <View style={[cal.diaBox, esHoy(d) && cal.diaHoy]}><Text style={[cal.diaT, esHoy(d) && cal.diaHoyT]}>{d}</Text></View> : null}
              </TouchableOpacity>
            ))}
          </View>
          <View style={cal.pie}>
            <TouchableOpacity onPress={() => { const h = new Date(); onSelect(h.getDate() + '/' + (h.getMonth() + 1) + '/' + h.getFullYear()); onClose(); }}>
              <Text style={cal.hoyBtn}>Hoy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}><Text style={cal.cerrar}>Cerrar</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const cal = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', padding: 26 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18 },
  tit: { fontSize: 15, fontWeight: '800', color: '#16191d', marginBottom: 12, textAlign: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f2f5', alignItems: 'center', justifyContent: 'center' },
  navT: { fontSize: 24, color: '#16191d', fontWeight: '700', lineHeight: 26 },
  mesT: { fontSize: 15, fontWeight: '700', color: '#16191d' },
  semana: { flexDirection: 'row', marginBottom: 4 },
  diaSem: { flex: 1, textAlign: 'center', fontSize: 11, color: '#9aa3ad', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  diaBox: { width: '100%', height: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  diaHoy: { backgroundColor: '#F5B700' },
  diaT: { fontSize: 14, color: '#16191d' },
  diaHoyT: { fontWeight: '800', color: '#16191d' },
  pie: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#eef0f2' },
  hoyBtn: { color: '#2563EB', fontWeight: '800', fontSize: 14 },
  cerrar: { color: '#6b7480', fontWeight: '700', fontSize: 14 },
});

/* =================== AJUSTES / VERSIÓN =================== */
import { Linking, Platform, Alert } from 'react-native';
import { APP_VERSION, APP_BUILD } from './version';
import { getApiUrl } from './api';

export function BotonAjustes({ color = '#fff', onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={aj.btn} accessibilityLabel="Ajustes">
      <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={color} strokeWidth={2}>
        <Circle cx="12" cy="12" r="3" />
        <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </Svg>
    </TouchableOpacity>
  );
}

export function AjustesModal({ visible, onClose }) {
  const [buscando, setBuscando] = useState(false);
  const [estado, setEstado] = useState(null); // {hay, msg, apk, version}
  const [bajando, setBajando] = useState(false);
  const [pct, setPct] = useState(0);
  const buscarActualizacion = async () => {
    setBuscando(true); setEstado(null);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(getApiUrl() + '/api/version', { signal: ctrl.signal });
      clearTimeout(t);
      const d = await r.json();
      const buildServidor = +d.appBuild || 0;
      if (buildServidor > APP_BUILD) {
        setEstado({ hay: true, msg: '¡Hay una versión nueva! (v' + (d.appVersion || '') + ')' + (d.notas ? '\n' + d.notas : ''), apk: d.apk, version: d.appVersion });
      } else {
        setEstado({ hay: false, msg: 'Ya tienes la última versión instalada. ✓' });
      }
    } catch (e) {
      setEstado({ hay: false, msg: 'No se pudo verificar. Revisa tu conexión.' });
    }
    setBuscando(false);
  };
  const descargarEInstalar = async () => {
    if (!estado || !estado.apk) return;
    if (Platform.OS !== 'android') { Linking.openURL(estado.apk).catch(() => {}); return; }
    let FS, IntentLauncher;
    try { FS = require('expo-file-system'); IntentLauncher = require('expo-intent-launcher'); } catch (e) { FS = null; }
    if (!FS) { Linking.openURL(estado.apk).catch(() => {}); return; } // sin librería: abrir en navegador
    setBajando(true); setPct(0);
    try {
      const destino = FS.cacheDirectory + 'talleros-update.apk';
      try { await FS.deleteAsync(destino, { idempotent: true }); } catch (e) {}
      const dl = FS.createDownloadResumable(estado.apk, destino, {}, (p) => {
        if (p.totalBytesExpectedToWrite > 0) setPct(Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100));
      });
      const res = await dl.downloadAsync();
      setBajando(false);
      if (!res || !res.uri) { Alert.alert('Error', 'No se pudo descargar la actualización.'); return; }
      // El servidor puede responder 404 (el APK no está publicado ahí todavía) y aun así
      // "descargar" una página de error como si fuera el archivo — validamos antes de instalar.
      if (res.status && res.status !== 200) {
        Alert.alert('El servidor no tiene el APK publicado', 'La descarga respondió con error ' + res.status + ' — verifica que backend/apk/talleros.apk exista en el servidor y coincida con version.json.');
        return;
      }
      const info = await FS.getInfoAsync(res.uri);
      if (!info.exists || info.size < 1000000) { // un APK real pesa varios MB, no unos pocos KB
        Alert.alert('El archivo descargado no es válido', 'Parece que el servidor no está sirviendo el APK correctamente (el archivo descargado pesa muy poco). Revisa que el APK esté subido en backend/apk/talleros.apk.');
        return;
      }
      // Abrir el instalador de Android con el APK descargado
      const contentUri = await FS.getContentUriAsync(res.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: contentUri, flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    } catch (e) {
      setBajando(false);
      // Mostramos el error real (antes se ocultaba) para poder diagnosticar qué falló de verdad
      Alert.alert('No se pudo instalar automáticamente', (e && e.message) || 'Error desconocido', [
        { text: 'Abrir en el navegador', onPress: () => Linking.openURL(estado.apk).catch(() => {}) },
        { text: 'Cerrar', style: 'cancel' },
      ]);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={aj.wrap}>
        <View style={aj.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={aj.title}>⚙️ Ajustes</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>

          <View style={aj.fila}><Text style={aj.k}>Versión</Text><Text style={aj.v}>TallerOS v{APP_VERSION}</Text></View>
          <View style={aj.fila}><Text style={aj.k}>Build</Text><Text style={aj.v}>{APP_BUILD}</Text></View>
          <View style={aj.fila}><Text style={aj.k}>Sistema</Text><Text style={aj.v}>{Platform.OS === 'android' ? 'Android' : Platform.OS}</Text></View>

          <TouchableOpacity style={[aj.actualizar, buscando && { opacity: 0.6 }]} disabled={buscando || bajando} onPress={buscarActualizacion}>
            <Text style={aj.actualizarT}>{buscando ? 'Buscando…' : '🔄 Buscar actualización'}</Text>
          </TouchableOpacity>

          {estado ? (
            <View style={[aj.aviso, estado.hay ? { backgroundColor: '#fdf1e1' } : { backgroundColor: '#e8f6ec' }]}>
              <Text style={{ color: estado.hay ? '#9a6a12' : '#166534', fontSize: 13, textAlign: 'center' }}>{estado.msg}</Text>
              {estado.hay ? (
                bajando ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ textAlign: 'center', color: '#9a6a12', fontWeight: '700' }}>Descargando… {pct}%</Text>
                    <View style={{ height: 8, backgroundColor: '#f0e2c8', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                      <View style={{ height: 8, width: pct + '%', backgroundColor: '#D97706' }} />
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={aj.descargar} onPress={descargarEInstalar}>
                    <Text style={aj.descargarT}>⬇️ Actualizar ahora</Text>
                  </TouchableOpacity>
                )
              ) : null}
            </View>
          ) : null}

          <Text style={aj.pie}>TallerOS — gestión de taller</Text>
        </View>
      </View>
    </Modal>
  );
}
const aj = StyleSheet.create({
  btn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)' },
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#16191d' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderColor: '#f0f2f5' },
  k: { color: '#6b7480', fontSize: 14 },
  v: { color: '#16191d', fontSize: 14, fontWeight: '700' },
  actualizar: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  actualizarT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  aviso: { borderRadius: 12, padding: 12, marginTop: 12 },
  descargar: { backgroundColor: '#D97706', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  descargarT: { color: '#fff', fontWeight: '800' },
  pie: { textAlign: 'center', color: '#9aa3ad', fontSize: 11.5, marginTop: 14 },
});
