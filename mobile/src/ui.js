import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, PanResponder, Image } from 'react-native';
import Svg, { Path, G, Rect, Circle, Ellipse, Line } from 'react-native-svg';

/* Acepta opciones como texto ('Toyota') o como objeto ({marca:'Toyota', modelos:[...]}) */
export const etiqueta = (o) => (typeof o === 'string' ? o : (o && (o.marca || o.nombre || o.n || o.name)) || '');

/* ================= LISTA DESPLEGABLE (como la web) =================
   - Se abre como lista vertical, con buscador
   - Opción "＋ Agregar…" al final para crear uno nuevo ahí mismo
*/
export function Dropdown({ label, value, onChange, options, onAdd, placeholder, obligatorio, deshabilitado, textoVacio }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [agregando, setAgregando] = useState(false);
  const opts = (options || []).map(etiqueta).filter(Boolean);
  const filtradas = opts.filter((o) => !q.trim() || o.toLowerCase().includes(q.toLowerCase()));

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
        style={[d.select, deshabilitado && { backgroundColor: '#f1f3f5' }]}
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

            {opts.length > 6 && (
              <TextInput style={d.search} value={q} onChangeText={setQ} placeholder="Buscar…" autoCorrect={false} />
            )}

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {filtradas.length ? filtradas.map((o) => (
                <TouchableOpacity key={o} style={[d.item, value === o && d.itemOn]} onPress={() => elegir(o)}>
                  <Text style={[d.itemT, value === o && { fontWeight: '800' }]}>{o}</Text>
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
export function FirmaVista({ trazos, alto = 70 }) {
  if (!trazos || !trazos.length) return null;
  return (
    <View style={{ height: alto, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 8 }}>
      <Svg width="100%" height="100%" viewBox="0 0 300 120">
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
    <Image source={src} style={{ width, height }} resizeMode="contain" />
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
