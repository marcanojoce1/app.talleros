import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, Alert, ScrollView, TextInput, Image, Modal, Linking, Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, getState, putState, clearSession, API_URL } from '../api';
import { compartirActaPDF } from '../acta';
import { ProgressSlider } from '../ui';

const STATUS = {
  espera: { l: 'En espera', c: '#64748B', bg: '#eef0f2' },
  rep: { l: 'En reparación', c: '#D97706', bg: '#fdf1e1' },
  wait: { l: 'Esperando repuestos', c: '#D97706', bg: '#fdf1e1' },
  reprog: { l: 'Reprogramado', c: '#7c3aed', bg: '#f2ecfd' },
  term: { l: 'Terminado', c: '#16A34A', bg: '#e8f6ec' },
  dev: { l: 'Devolución', c: '#dc2626', bg: '#fdecec' },
  ent: { l: 'Entregado', c: '#2563EB', bg: '#e9f0fe' },
};
const AVCOLORS = ['#2563EB', '#D97706', '#16A34A', '#7c3aed', '#be185d', '#0891b2'];
const inits = (s) => (s || '').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

export default function HomeScreen({ navigation, route }) {
  const me = route.params?.me || {};
  const talleresParam = route.params?.talleres || [];
  const esMecanico = me.rol === 'mecanico';
  const [taller, setTaller] = useState(talleresParam[0] || null);

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(null);   // id del trabajo desplegado
  const [notifOpen, setNotifOpen] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      // Resolver el taller (repara cuentas viejas sin taller_id)
      let t = taller;
      if (!t) {
        const r = await api('/api/state/mi-taller');
        t = r && r.taller;
        if (t) setTaller(t);
      }
      if (!t) { setError('Tu cuenta aún no está ligada a un taller. Pide al administrador que te registre como ' + (esMecanico ? 'mecánico' : 'cliente') + ' en su taller.'); setLoading(false); return; }
      const d = await getState(t.id); setData(d || {});
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [taller, esMecanico]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (nuevo) => {
    setData(nuevo);
    try { await putState(taller.id, nuevo); } catch (e) { Alert.alert('Error al sincronizar', e.message); }
  };
  const salir = async () => { await clearSession(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); };

  const vehicles = data.vehicles || [];
  const history = data.history || [];
  const notifs = data.notifs || [];
  const cur = (data.config && data.config.currency && data.config.currency.sym) || 'Bs.';

  // Trabajos del mecánico: los asignados a él y no cerrados
  const misTrabajos = vehicles.filter((v) => v.recepcion && !v.cerrada && (v.mech === me.nombre || !v.mech));
  // Vehículos del cliente
  const misVehiculos = vehicles.filter((v) => (v.owner || '') === me.nombre);
  const miHistorial = history.filter((h) => (h.cliente || '') === me.nombre);
  const misNotifs = notifs.filter((n) => (n.owner || '') === me.nombre);
  const sinLeer = misNotifs.filter((n) => !n.read).length;

  const Header = ({ titulo, sub }) => (
    <View style={s.top}>
      <View style={{ flex: 1 }}>
        <Text style={s.kicker}>{esMecanico ? 'APP DEL MECÁNICO' : 'APP DEL CLIENTE'}</Text>
        <Text style={s.h1}>{titulo}</Text>
        {!!sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {!esMecanico && (
        <TouchableOpacity style={s.bell} onPress={() => setNotifOpen(true)}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
          {sinLeer ? <View style={s.badge}><Text style={s.badgeT}>{sinLeer}</Text></View> : null}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={s.logout} onPress={salir}><Text style={{ color: '#16191d', fontSize: 12, fontWeight: '700' }}>Salir</Text></TouchableOpacity>
    </View>
  );

  if (error) {
    return (
      <View style={s.wrap}><Header titulo={me.nombre || 'Bienvenido'} />
        <Text style={s.err}>{error}</Text>
        <TouchableOpacity style={s.retry} onPress={cargar}><Text style={{ fontWeight: '800' }}>Reintentar</Text></TouchableOpacity>
      </View>
    );
  }

  /* ==================== MECÁNICO ==================== */
  if (esMecanico) {
    return (
      <View style={s.wrap}>
        <Header titulo="Mis trabajos" sub={`${misTrabajos.length} trabajo(s) · ${taller ? taller.nombre : ''}`} />
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={cargar} />}>
          {misTrabajos.length ? misTrabajos.map((v, i) => (
            <TrabajoCard key={v.id} v={v} i={i} tallerId={taller.id} cliente={(data.clients || []).find((c) => c.n === v.owner)} abierto={abierto === v.id}
              onToggle={() => setAbierto(abierto === v.id ? null : v.id)}
              data={data} guardar={guardar} me={me} cur={cur} />
          )) : <Text style={s.muted}>No tienes trabajos asignados ahora mismo.</Text>}
        </ScrollView>
      </View>
    );
  }

  /* ==================== CLIENTE ==================== */
  const enTaller = misVehiculos.filter((v) => v.recepcion && !v.cerrada);
  const marcarLeidas = async () => {
    // Marca localmente y usa el endpoint que no requiere permiso de escritura
    setData({ ...data, notifs: (data.notifs || []).map((n) => (n.owner === me.nombre ? { ...n, read: true } : n)) });
    try { await api('/api/state/mis-notifs-leidas?taller=' + taller.id, { method: 'POST' }); } catch (e) { /* silencioso */ }
  };
  return (
    <View style={s.wrap}>
      <Header titulo="Mi vehículo" sub={taller ? taller.nombre : ''} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={cargar} />}>

        {sinLeer ? (
          <TouchableOpacity style={s.avisoBar} onPress={() => setNotifOpen(true)}>
            <Text style={s.avisoBarT}>🔔 Tienes {sinLeer} aviso(s) nuevo(s) — toca para ver</Text>
          </TouchableOpacity>
        ) : null}

        {enTaller.length ? enTaller.map((v) => {
          const st = STATUS[v.status] || STATUS.espera;
          const hist = miHistorial.find((h) => h.vehId === v.id);
          return (
            <View key={v.id}>
              {/* Tarjeta oscura principal */}
              <View style={s.heroCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.heroPlate}>{v.plate}</Text>
                  <View style={[s.pill, { backgroundColor: st.bg }]}><Text style={[s.pillT, { color: st.c }]}>● {st.l}</Text></View>
                </View>
                <Text style={s.heroModel}>{v.model}</Text>
                <Text style={s.heroLbl}>Progreso de la reparación</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={s.heroPct}>{v.progress || 0}%</Text>
                  <View style={s.heroBar}><View style={[s.heroFill, { width: (v.progress || 0) + '%' }]} /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 26, marginTop: 16 }}>
                  <View><Text style={s.heroLbl}>Entrega estimada</Text><Text style={s.heroVal}>{v.entrega || 'Por confirmar'}</Text></View>
                  <View><Text style={s.heroLbl}>Costo estimado</Text><Text style={[s.heroVal, { color: '#F5B700' }]}>{cur} {(+v.cost || 0).toLocaleString('es-VE')}</Text></View>
                </View>
              </View>

              {/* Mecánico asignado + seguimiento */}
              <View style={s.card}>
                <Text style={s.cardH}>Mecánico asignado</Text>
                <Text style={s.cardTxt}>{v.mech || 'Por asignar'}{v.motivo ? ' · ' + v.motivo : ''}</Text>

                <Text style={[s.cardH, { marginTop: 16 }]}>Seguimiento</Text>
                {(v.advances || []).length ? [...(v.advances || [])].reverse().map((a, i) => (
                  <View key={i} style={s.timeRow}>
                    <View style={[s.timeIcon, { backgroundColor: a.type === 'nota' ? '#e9f0fe' : a.type === 'atencion' ? '#fdecec' : '#fdf1e1' }]}>
                      <Text style={{ fontSize: 14 }}>{a.type === 'nota' ? '📝' : a.type === 'atencion' ? '⚠️' : '🔧'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.timeT}>{a.t}</Text>
                      <Text style={s.timeM}>{a.m}{a.ago ? ' · ' + a.ago : ''}</Text>
                      {a.foto ? <Image source={{ uri: a.foto }} style={s.timeFoto} /> : null}
                    </View>
                  </View>
                )) : <Text style={s.muted}>Aún no hay avances registrados.</Text>}
              </View>

              {hist && +hist.saldo > 0 ? (
                <View style={[s.card, { borderColor: '#f3d79a', backgroundColor: '#fffaf0' }]}>
                  <Text style={s.cardH}>Saldo pendiente</Text>
                  <Text style={[s.heroVal, { color: '#D97706', fontSize: 20 }]}>{cur} {(+hist.saldo).toLocaleString('es-VE')}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[s.actaBtn, v.status !== 'term' && v.status !== 'ent' && { opacity: 0.5 }]}
                onPress={() => {
                  if (v.status !== 'term' && v.status !== 'ent') { Alert.alert('Aún no disponible', 'Podrás descargar el acta cuando el trabajo esté terminado.'); return; }
                  compartirActaPDF(taller.id, v);
                }}>
                <Text style={s.actaBtnT}>📄 {v.status !== 'term' && v.status !== 'ent' ? 'Acta (al terminar)' : 'Descargar / compartir acta (PDF)'}</Text>
              </TouchableOpacity>
            </View>
          );
        }) : <Text style={s.muted}>No tienes vehículos en el taller ahora mismo.</Text>}

        {/* Historial */}
        <Text style={[s.secTitle, { marginTop: 18 }]}>Mi historial ({miHistorial.length})</Text>
        {miHistorial.length ? miHistorial.map((h) => (
          <View key={h.id} style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.cardH}>{h.veh}</Text>
              <Text style={[s.pillT, { color: +h.saldo > 0 ? '#D97706' : '#16A34A' }]}>{+h.saldo > 0 ? 'Debe ' + cur + ' ' + (+h.saldo).toLocaleString('es-VE') : 'Pagado ✓'}</Text>
            </View>
            <Text style={s.cardTxt}>{h.fecha} · {h.trabajo}</Text>
          </View>
        )) : <Text style={s.muted}>Aún no tienes servicios registrados.</Text>}
      </ScrollView>

      {/* Panel de notificaciones */}
      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <View style={s.modalWrap}><View style={s.modalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={s.cardH}>Avisos del taller</Text>
            <TouchableOpacity onPress={() => setNotifOpen(false)}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 380 }}>
            {misNotifs.length ? [...misNotifs].reverse().map((n, i) => (
              <View key={i} style={[s.notifRow, !n.read && { backgroundColor: '#fffaf0' }]}>
                <Text style={{ fontSize: 18, marginRight: 10 }}>{n.atencion ? '⚠️' : n.listo ? '✅' : '🔔'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.notifT}>{n.text}</Text>
                  <Text style={s.notifM}>{n.veh}{n.time ? ' · ' + n.time : ''}</Text>
                </View>
              </View>
            )) : <Text style={s.muted}>No tienes avisos.</Text>}
          </ScrollView>
          {sinLeer ? <TouchableOpacity style={s.btn} onPress={() => { marcarLeidas(); setNotifOpen(false); }}><Text style={s.btnT}>Marcar como leídos</Text></TouchableOpacity> : null}
        </View></View>
      </Modal>
    </View>
  );
}

/* ============ TARJETA DE TRABAJO DEL MECÁNICO (se despliega debajo) ============ */
function TrabajoCard({ v, i, tallerId, cliente, abierto, onToggle, data, guardar, me, cur }) {
  const st = STATUS[v.status] || STATUS.espera;
  const [prog, setProg] = useState(v.progress || 0);
  const [txt, setTxt] = useState('');
  const [foto, setFoto] = useState(null);
  const [adicional, setAdicional] = useState(false);
  const [txtAd, setTxtAd] = useState('');
  const [obsActa, setObsActa] = useState((v.recepcion && v.recepcion.obs) || '');
  useEffect(() => { setProg(v.progress || 0); }, [v.progress]);

  const tomarDeCamara = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso', 'Se necesita acceso a la cámara.'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.35, base64: true });
    if (!r.canceled && r.assets && r.assets[0]) setFoto('data:image/jpeg;base64,' + r.assets[0].base64);
  };
  const elegirDeGaleria = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso', 'Se necesita acceso a las fotos.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.35, base64: true });
    if (!r.canceled && r.assets && r.assets[0]) setFoto('data:image/jpeg;base64,' + r.assets[0].base64);
  };
  const pickFoto = () => {
    Alert.alert('Agregar foto', '¿De dónde quieres tomar la foto?', [
      { text: '📷 Cámara', onPress: tomarDeCamara },
      { text: '🖼️ Galería', onPress: elegirDeGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // Actualiza el vehículo y (opcional) agrega un aviso para el cliente
  const aplicar = (cambios, avance, notif) => {
    const vehicles = (data.vehicles || []).map((x) => {
      if (x.id !== v.id) return x;
      const nv = { ...x, ...cambios };
      if (avance) nv.advances = [...(x.advances || []), avance];
      return nv;
    });
    let notifs = data.notifs || [];
    if (notif) notifs = [...notifs, { owner: v.owner, veh: v.model, text: notif.text, time: 'ahora', read: false, atencion: !!notif.atencion, listo: !!notif.listo }];
    guardar({ ...data, vehicles, notifs });
  };

  const cambiarEstado = (code) => {
    const st2 = STATUS[code];
    const cambios = { status: code };
    if (code === 'term') cambios.progress = 100;
    if (code === 'rep' && !v.progress) cambios.progress = 10;
    aplicar(cambios,
      { t: st2.l, m: 'Actualizado por ' + (me.nombre || 'el mecánico'), type: code === 'term' ? 'term' : 'estado', ago: 'ahora' },
      code === 'term' ? { text: '✅ Tu vehículo está listo para retirar', listo: true } : { text: 'Estado actualizado: ' + st2.l });
    if (code === 'term') Alert.alert('Trabajo terminado', 'Se notificó al cliente que su vehículo está listo.');
  };

  const guardarAvance = () => {
    if (!txt.trim() && prog === (v.progress || 0) && !foto) { Alert.alert('Nada que registrar', 'Escribe el avance, cambia el porcentaje o adjunta una foto.'); return; }
    aplicar({ progress: prog },
      { t: txt.trim() || 'Avance actualizado', m: (me.nombre || 'Mecánico') + ' · ' + prog + '% completado', type: 'nota', ago: 'ahora', foto },
      { text: 'Nuevo avance en tu vehículo (' + prog + '%)' });
    setTxt(''); setFoto(null);
    Alert.alert('Listo', 'Avance registrado. El cliente ya puede verlo.');
  };

  const guardarObsActa = () => {
    if (!obsActa.trim()) { Alert.alert('Falta', 'Escribe la observación.'); return; }
    // Actualiza la observación DENTRO de la recepción (el acta), sin crear un avance
    const vehicles = (data.vehicles || []).map((x) => {
      if (x.id !== v.id) return x;
      return { ...x, recepcion: { ...(x.recepcion || {}), obs: obsActa.trim() } };
    });
    guardar({ ...data, vehicles });
    Alert.alert('Guardado en el acta', 'La observación quedó registrada en el acta del vehículo (visible en web y al descargar el acta).');
  };

  const reportarAdicional = () => {
    if (!txtAd.trim()) { Alert.alert('Falta', 'Describe el trabajo adicional.'); return; }
    aplicar({ status: 'wait' },
      { t: '⚠️ Requiere autorización del cliente', m: txtAd.trim(), type: 'atencion', ago: 'ahora' },
      { text: '⚠️ Se requiere tu atención: ' + txtAd.trim(), atencion: true });
    setTxtAd(''); setAdicional(false);
    Alert.alert('Enviado', 'Se notificó al cliente que se requiere su atención.');
  };

  return (
    <View style={s.jobWrap}>
      {/* Fila de la lista */}
      <TouchableOpacity style={s.jobRow} onPress={onToggle} activeOpacity={0.75}>
        <View style={[s.avatar, { backgroundColor: AVCOLORS[i % AVCOLORS.length] }]}>
          <Text style={s.avatarT}>{v.ini || inits(v.model)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.jobTitle}>{v.model}</Text>
          <View style={s.plate}><Text style={s.plateT}>{v.plate}</Text></View>
          <Text style={s.jobSub}>{v.motivo || 'Sin trabajo definido'}</Text>
          <View style={s.progBar}><View style={[s.progFill, { width: (v.progress || 0) + '%' }]} /></View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <View style={[s.pill, { backgroundColor: st.bg }]}><Text style={[s.pillT, { color: st.c }]}>● {st.l}</Text></View>
          <Text style={{ color: '#9aa3ad', fontSize: 16 }}>{abierto ? '▴' : '▾'}</Text>
        </View>
      </TouchableOpacity>

      {/* Detalle desplegado DEBAJO */}
      {abierto && (
        <View style={s.jobDetail}>
          <View style={s.cliBox}>
            <Text style={s.cliTitle}>{v.model} · {v.plate}</Text>
            <Text style={s.cliSub}>{v.motivo || 'Sin trabajo definido'}{v.color ? ' · ' + v.color : ''}</Text>
            <Text style={[s.cliSub, { marginTop: 6 }]}>Cliente: {v.owner || '—'}</Text>
            {cliente && cliente.tel ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={s.telBtn} onPress={() => Linking.openURL('tel:' + cliente.tel)}>
                  <Text style={s.telBtnT}>📞 Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.telBtn, { backgroundColor: '#25D366' }]} onPress={() => Linking.openURL('https://wa.me/' + (cliente.tel || '').replace(/[^0-9]/g, ''))}>
                  <Text style={[s.telBtnT, { color: '#fff' }]}>💬 WhatsApp</Text>
                </TouchableOpacity>
              </View>
            ) : <Text style={s.cliSub}>Sin teléfono registrado</Text>}
          </View>

          <Text style={s.cardH}>Estado del trabajo</Text>
          <View style={s.estGrid}>
            {[['rep', '▶ En curso'], ['wait', '⏸ Repuestos'], ['term', '✓ Terminado'], ['espera', '↻ En espera']].map(([k, l]) => (
              <TouchableOpacity key={k} style={[s.estBtn, v.status === k && s.estBtnOn]} onPress={() => cambiarEstado(k)}>
                <Text style={[s.estBtnT, v.status === k && { color: '#fff' }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.cardH, { marginTop: 16 }]}>Avance del trabajo: {prog}%</Text>
          <ProgressSlider value={prog} onChange={setProg} />

          <Text style={[s.cardH, { marginTop: 16 }]}>Registrar avance</Text>
          <TextInput style={s.input} value={txt} onChangeText={setTxt} placeholder="Describe el avance…" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={s.addAv} onPress={guardarAvance}><Text style={s.addAvT}>+ Avance</Text></TouchableOpacity>
            <TouchableOpacity style={s.camBtn} onPress={pickFoto}><Text style={{ fontSize: 20 }}>{foto ? '✅' : '📷'}</Text></TouchableOpacity>
          </View>
          {foto ? (
            <View style={{ marginTop: 10 }}>
              <Image source={{ uri: foto }} style={s.prev} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 12.5, flex: 1 }}>✓ Foto cargada — se enviará con el avance</Text>
                <TouchableOpacity onPress={() => setFoto(null)}><Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 12.5 }}>Quitar</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}

          <Text style={[s.cardH, { marginTop: 16 }]}>Observación para el acta</Text>
          <Text style={{ fontSize: 11.5, color: '#6b7480', marginBottom: 6 }}>Esto se guarda en el acta del vehículo (no es un avance).</Text>
          <TextInput style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} value={obsActa} onChangeText={setObsActa} multiline placeholder="Ej. Se encontró fuga de aceite en el motor…" />
          <TouchableOpacity style={[s.addAv, { marginTop: 10, backgroundColor: '#2563EB' }]} onPress={guardarObsActa}><Text style={s.addAvT}>Guardar en el acta</Text></TouchableOpacity>

          {!adicional ? (
            <TouchableOpacity style={s.adBtn} onPress={() => setAdicional(true)}>
              <Text style={s.adBtnT}>⚠️ Reportar trabajo adicional</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Text style={s.cardH}>Trabajo adicional (requiere autorización)</Text>
              <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} value={txtAd} onChangeText={setTxtAd} multiline
                placeholder="Ej. Los discos están desgastados, se requiere rectificado" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity style={[s.addAv, { backgroundColor: '#D97706' }]} onPress={reportarAdicional}><Text style={[s.addAvT, { color: '#fff' }]}>Notificar al cliente</Text></TouchableOpacity>
                <TouchableOpacity style={s.camBtn} onPress={() => setAdicional(false)}><Text style={{ fontWeight: '700' }}>✕</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {(v.advances || []).length ? (
            <>
              <Text style={[s.cardH, { marginTop: 18 }]}>Historial del trabajo</Text>
              {[...(v.advances || [])].reverse().map((a, k) => (
                <View key={k} style={s.histRow}>
                  <View style={[s.histIcon, { backgroundColor: a.type === 'nota' ? '#e9f0fe' : a.type === 'atencion' ? '#fdecec' : a.type === 'term' ? '#e8f6ec' : '#fdf1e1' }]}>
                    <Text style={{ fontSize: 13 }}>{a.type === 'nota' ? '📝' : a.type === 'atencion' ? '⚠️' : a.type === 'term' ? '✅' : '🔧'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.avT}>{a.t}</Text>
                    <Text style={s.avM}>{a.m}{a.ago ? ' · ' + a.ago : ''}</Text>
                    {a.foto ? <Image source={{ uri: a.foto }} style={s.histFoto} /> : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {v.recepcion && v.recepcion.obs ? (
            <View style={s.obsBox}>
              <Text style={s.obsBoxT}>Observación en el acta:</Text>
              <Text style={s.obsBoxM}>{v.recepcion.obs}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={s.actaBtn} onPress={() => compartirActaPDF(tallerId, v)}>
            <Text style={s.actaBtnT}>📄 Compartir acta (PDF)</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#eef0f3' },
  top: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: '#eef0f3', flexDirection: 'row', alignItems: 'flex-start' },
  kicker: { color: '#9aa3ad', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  h1: { color: '#16191d', fontSize: 27, fontWeight: '800', marginTop: 2 },
  sub: { color: '#6b7480', fontSize: 12, marginTop: 3 },
  bell: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  badge: { position: 'absolute', top: -3, right: -3, backgroundColor: '#dc2626', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeT: { color: '#fff', fontSize: 10, fontWeight: '800' },
  logout: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },

  jobWrap: { marginBottom: 14 },
  jobRow: { backgroundColor: '#fff', borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  jobTitle: { fontSize: 16, fontWeight: '800', color: '#16191d' },
  plate: { alignSelf: 'flex-start', backgroundColor: '#16191d', borderRadius: 7, paddingVertical: 3, paddingHorizontal: 9, marginTop: 5 },
  plateT: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  jobSub: { color: '#6b7480', fontSize: 13, marginTop: 7 },
  progBar: { height: 8, backgroundColor: '#e7e9ec', borderRadius: 4, marginTop: 9, overflow: 'hidden' },
  progFill: { height: 8, backgroundColor: '#F5B700', borderRadius: 4 },
  pill: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 11 },
  pillT: { fontSize: 11.5, fontWeight: '700' },

  jobDetail: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 8, borderTopWidth: 3, borderColor: '#F5B700' },
  cliBox: { backgroundColor: '#f6f8fa', borderRadius: 12, padding: 13, marginBottom: 14 },
  cliTitle: { fontSize: 15, fontWeight: '800', color: '#16191d' },
  cliSub: { fontSize: 12.5, color: '#6b7480', marginTop: 3 },
  telBtn: { flex: 1, backgroundColor: '#16191d', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  telBtnT: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cardH: { fontSize: 14.5, fontWeight: '800', color: '#16191d' },
  estGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  estBtn: { width: '47%', borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff' },
  estBtnOn: { backgroundColor: '#16191d', borderColor: '#16191d' },
  estBtnT: { fontWeight: '700', fontSize: 13, color: '#16191d' },
  input: { borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 12, padding: 13, fontSize: 14, marginTop: 8, backgroundColor: '#fff' },
  addAv: { flex: 1, backgroundColor: '#16191d', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addAvT: { color: '#fff', fontWeight: '800' },
  camBtn: { width: 56, borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  prev: { width: '100%', height: 150, borderRadius: 12, marginTop: 10 },
  adBtn: { borderWidth: 1.5, borderColor: '#f3d79a', backgroundColor: '#fffaf0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  adBtnT: { color: '#D97706', fontWeight: '800' },
  avRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f1f3f5' },
  avT: { fontWeight: '700', fontSize: 13, color: '#16191d' },
  avM: { color: '#6b7480', fontSize: 12, marginTop: 2 },
  histRow: { flexDirection: 'row', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f3f5' },
  histIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  histFoto: { width: '100%', height: 150, borderRadius: 10, marginTop: 8 },
  obsBox: { backgroundColor: '#eef4ff', borderRadius: 12, padding: 13, marginTop: 14, borderLeftWidth: 3, borderColor: '#2563EB' },
  obsBoxT: { fontWeight: '800', fontSize: 12.5, color: '#2563EB' },
  obsBoxM: { color: '#16191d', fontSize: 13, marginTop: 4 },

  heroCard: { backgroundColor: '#16191d', borderRadius: 20, padding: 20, marginBottom: 14 },
  heroPlate: { color: '#9aa3ad', fontSize: 13, fontWeight: '600' },
  heroModel: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  heroLbl: { color: '#9aa3ad', fontSize: 12, marginTop: 14 },
  heroPct: { color: '#fff', fontSize: 30, fontWeight: '800' },
  heroBar: { flex: 1, height: 10, backgroundColor: '#2b3138', borderRadius: 5, overflow: 'hidden' },
  heroFill: { height: 10, backgroundColor: '#F5B700', borderRadius: 5 },
  heroVal: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 3 },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e7e9ec' },
  cardTxt: { color: '#6b7480', fontSize: 13.5, marginTop: 5 },
  timeRow: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderColor: '#f1f3f5' },
  timeIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  timeT: { fontWeight: '700', fontSize: 14, color: '#16191d' },
  timeM: { color: '#6b7480', fontSize: 12.5, marginTop: 2 },
  timeFoto: { width: '100%', height: 130, borderRadius: 10, marginTop: 8 },
  secTitle: { fontSize: 14, fontWeight: '800', color: '#16191d', marginBottom: 10 },
  muted: { color: '#6b7480', fontSize: 13.5, padding: 6 },
  avisoBar: { backgroundColor: '#fffaf0', borderWidth: 1.5, borderColor: '#f3d79a', borderRadius: 12, padding: 13, marginBottom: 14 },
  avisoBarT: { color: '#D97706', fontWeight: '800', fontSize: 13 },
  err: { color: '#dc2626', padding: 18, fontSize: 14 },
  retry: { alignSelf: 'flex-start', marginLeft: 18, backgroundColor: '#F5B700', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  actaBtn: { backgroundColor: '#16191d', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  actaBtnT: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btn: { backgroundColor: '#F5B700', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  btnT: { fontWeight: '800', color: '#16191d' },
  notifRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 1, borderColor: '#f1f3f5', alignItems: 'center' },
  notifT: { fontWeight: '700', fontSize: 13.5, color: '#16191d' },
  notifM: { color: '#6b7480', fontSize: 12, marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34 },
});
