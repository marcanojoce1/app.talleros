import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, Alert, ScrollView, TextInput, Image, Modal, Linking, Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, getState, putState, clearSession, getApiUrl } from '../api';
import { compartirActaPDF, abrirEnNavegador, urlDocumento } from '../acta';
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
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosVeh, setSosVeh] = useState(null);
  const [sosDesc, setSosDesc] = useState('');
  const [sosUbi, setSosUbi] = useState('');
  const [sosCoords, setSosCoords] = useState(null);
  const [sosGPS, setSosGPS] = useState(false);
  const [sosEnviando, setSosEnviando] = useState(false);

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
  const sinLeer = misNotifs.filter((n) => !n.read || mantVigente(n)).length;

  const fondo = esMecanico ? '#f3f5f7' : '#eef3fb'; // el cliente ve un fondo azulado
  const Header = ({ titulo, sub }) => (
    <View style={[s.top, !esMecanico && { backgroundColor: '#12203a' }]}>
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
      <View style={[s.wrap, { backgroundColor: fondo }]}><Header titulo={me.nombre || 'Bienvenido'} />
        <Text style={s.err}>{error}</Text>
        <TouchableOpacity style={s.retry} onPress={cargar}><Text style={{ fontWeight: '800' }}>Reintentar</Text></TouchableOpacity>
      </View>
    );
  }

  /* ==================== MECÁNICO ==================== */
  if (esMecanico) {
    return (
      <View style={[s.wrap, { backgroundColor: fondo }]}>
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
    setData({ ...data, notifs: (data.notifs || []).map((n) => (n.owner === me.nombre && !mantVigente(n) ? { ...n, read: true } : n)) });
    try { await api('/api/state/mis-notifs-leidas?taller=' + taller.id, { method: 'POST' }); } catch (e) { /* silencioso */ }
  };
  const responderAtencion = async (veh, avance, autorizado) => {
    // Actualiza localmente
    const vehicles = (data.vehicles || []).map((x) => {
      if (x.id !== veh.id) return x;
      return { ...x, advances: (x.advances || []).map((a) => (a === avance || (a.t === avance.t && a.m === avance.m) ? { ...a, respondido: true, autorizado } : a)) };
    });
    setData({ ...data, vehicles });
    try { await api('/api/state/mi-autorizacion?taller=' + taller.id, { method: 'POST', body: JSON.stringify({ vehId: veh.id, texto: avance.m, autorizado }) }); } catch (e) { /* silencioso */ }
    Alert.alert(autorizado ? 'Autorizado' : 'Denegado', autorizado ? 'El taller puede proceder con el trabajo.' : 'Se notificó al taller que no autorizas el trabajo.');
  };

  // ===== AUXILIO VIAL =====
  const abrirSOS = () => {
    setSosVeh(misVehiculos.length === 1 ? misVehiculos[0] : null);
    setSosDesc(''); setSosUbi(''); setSosCoords(null); setSosOpen(true);
  };
  const tomarUbicacion = async () => {
    setSosGPS(true);
    try {
      let Location = null;
      try { Location = require('expo-location'); } catch (e) { Location = null; }
      if (!Location || !Location.requestForegroundPermissionsAsync) {
        Alert.alert('Ubicación no disponible', 'Escribe la dirección manualmente.'); setSosGPS(false); return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso denegado', 'Activa el permiso de ubicación o escribe la dirección.'); setSosGPS(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setSosCoords({ lat: latitude, lng: longitude });
      if (!sosUbi.trim()) setSosUbi('Ubicación GPS: ' + latitude.toFixed(5) + ', ' + longitude.toFixed(5));
      Alert.alert('Ubicación tomada', 'Se adjuntó tu ubicación actual.');
    } catch (e) {
      Alert.alert('No se pudo obtener', 'Escribe la dirección manualmente.');
    }
    setSosGPS(false);
  };
  const enviarSOS = async () => {
    if (!sosDesc.trim()) { Alert.alert('Falta', 'Describe qué le pasó al vehículo.'); return; }
    if (misVehiculos.length > 1 && !sosVeh) { Alert.alert('Falta', 'Selecciona el vehículo.'); return; }
    if (!sosUbi.trim() && !sosCoords) { Alert.alert('Falta la ubicación', 'Escribe dónde estás o adjunta tu ubicación.'); return; }
    setSosEnviando(true);
    const v = sosVeh || misVehiculos[0] || {};
    try {
      await api('/api/state/sos?taller=' + taller.id, {
        method: 'POST',
        body: JSON.stringify({
          vehId: v.id || null, vehiculo: v.model || '', placa: v.plate || '',
          descripcion: sosDesc.trim(), ubicacionTexto: sosUbi.trim(),
          lat: sosCoords ? sosCoords.lat : null, lng: sosCoords ? sosCoords.lng : null,
          telefono: ((data.clients || []).find((c) => c.n === me.nombre) || {}).tel || '',
        }),
      });
      setSosOpen(false); setSosEnviando(false);
      Alert.alert('Auxilio solicitado 🚨', 'El taller recibió tu solicitud y verá tu ubicación. Te contactarán pronto.');
      cargar();
    } catch (e) {
      setSosEnviando(false);
      Alert.alert('No se pudo enviar', (e && e.message) || 'Revisa tu conexión e intenta de nuevo.');
    }
  };
  return (
    <View style={[s.wrap, { backgroundColor: fondo }]}>
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
                <View style={{ flexDirection: 'row', gap: 26, marginTop: 14 }}>
                  <View><Text style={s.heroLbl}>Fecha de ingreso</Text><Text style={s.heroVal}>{fechaCorta(v.ingreso)}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.heroLbl}>Último avance</Text><Text style={s.heroVal} numberOfLines={1}>{(v.advances || []).length ? ((v.advances[v.advances.length - 1].ago) || (v.advances[v.advances.length - 1].t) || '—') : 'Sin avances'}</Text></View>
                </View>
                <Text style={[s.heroLbl, { marginTop: 12 }]}>🔧 Mecánico: {v.mech || 'por asignar'}</Text>
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
                      {a.foto ? <TouchableOpacity onPress={() => setFotoAmpliada(a.foto)}><Image source={{ uri: a.foto }} style={s.timeFoto} /><Text style={s.verFoto}>👁 Toca para ampliar</Text></TouchableOpacity> : null}
                      {a.type === 'atencion' && !a.respondido ? (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity style={s.autBtn} onPress={() => responderAtencion(v, a, true)}><Text style={s.autBtnT}>✓ Autorizar</Text></TouchableOpacity>
                          <TouchableOpacity style={[s.autBtn, { backgroundColor: '#dc2626' }]} onPress={() => responderAtencion(v, a, false)}><Text style={s.autBtnT}>✕ Denegar</Text></TouchableOpacity>
                        </View>
                      ) : a.type === 'atencion' && a.respondido ? (
                        <Text style={[s.timeM, { color: a.autorizado ? '#16A34A' : '#dc2626', fontWeight: '700', marginTop: 4 }]}>{a.autorizado ? '✓ Autorizado por ti' : '✕ Denegado por ti'}</Text>
                      ) : null}
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
                style={[s.actaBtn, v.status !== 'ent' && { opacity: 0.5 }]}
                onPress={() => {
                  if (v.status !== 'ent') {
                    Alert.alert('Aún no disponible', v.status === 'term'
                      ? 'El trabajo está listo. Podrás descargar el acta de conformidad una vez registrado el pago en el taller.'
                      : 'Podrás descargar el acta de conformidad cuando el trabajo esté terminado y pagado. Mientras tanto puedes ver los avances del mecánico.');
                    return;
                  }
                  compartirActaPDF(taller.id, v, 'trabajo');
                }}>
                <Text style={s.actaBtnT}>📄 {v.status !== 'ent' ? (v.status === 'term' ? 'Acta (pendiente de pago)' : 'Acta (al terminar y pagar)') : 'Descargar acta de conformidad (PDF)'}</Text>
              </TouchableOpacity>
            </View>
          );
        }) : <Text style={s.muted}>No tienes vehículos en el taller ahora mismo.</Text>}

        {/* Historial */}
        <TouchableOpacity style={s.sosBtn} onPress={abrirSOS} activeOpacity={0.85}>
          <Text style={s.sosBtnIco}>🚨</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.sosBtnT}>Vehículo averiado</Text>
            <Text style={s.sosBtnS}>Solicita auxilio vial al taller</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        <Text style={[s.secTitle, { marginTop: 18 }]}>Mi historial ({miHistorial.length})</Text>
        {miHistorial.length ? miHistorial.map((h) => (
          <View key={h.id} style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.cardH}>{h.veh}</Text>
              <Text style={[s.pillT, { color: +h.saldo > 0 ? '#D97706' : '#16A34A' }]}>{+h.saldo > 0 ? 'Debe ' + cur + ' ' + (+h.saldo).toLocaleString('es-VE') : 'Pagado ✓'}</Text>
            </View>
            <Text style={s.cardTxt}>{h.fecha} · {h.trabajo}</Text>
            <Text style={[s.cardTxt, { marginTop: 2 }]}>Total {cur} {(+h.total || 0).toLocaleString('es-VE')} · Pagado {cur} {(+h.pagado || 0).toLocaleString('es-VE')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
              <TouchableOpacity onPress={() => abrirEnNavegador(taller.id, { id: h.vehId, model: h.veh }, 'trabajo')}>
                <Text style={s.histLink}>👁 Ver acta y trabajo →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => compartirActaPDF(taller.id, { id: h.vehId, model: h.veh }, 'trabajo')}>
                <Text style={s.histLink}>📄 Compartir (PDF) →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                const txt = 'Servicio en ' + (taller ? taller.nombre : 'el taller') + '\n'
                  + h.veh + ' (' + h.placa + ')\n' + h.fecha + ' · ' + h.trabajo + '\n'
                  + 'Total: ' + cur + ' ' + (+h.total || 0).toLocaleString('es-VE') + '\n'
                  + 'Pagado: ' + cur + ' ' + (+h.pagado || 0).toLocaleString('es-VE') + '\n'
                  + (+h.saldo > 0 ? 'Saldo: ' + cur + ' ' + (+h.saldo).toLocaleString('es-VE') : 'PAGADO ✓') + '\n\n'
                  + 'Informe: ' + urlDocumento(taller.id, h.vehId, 'trabajo');
                Linking.openURL('https://wa.me/?text=' + encodeURIComponent(txt)).catch(() => Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp.'));
              }}>
                <Text style={[s.histLink, { color: '#16A34A' }]}>💬 WhatsApp →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )) : <Text style={s.muted}>Aún no tienes servicios registrados.</Text>}
      </ScrollView>

      {/* Panel de notificaciones */}
      {/* ===== AUXILIO VIAL ===== */}
      <Modal visible={sosOpen} transparent animationType="slide" onRequestClose={() => setSosOpen(false)}>
        <View style={s.mantWrap}><View style={[s.mantCard, { maxHeight: '92%' }]}>
          <ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 26 }}>🚨</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.mantTit}>Solicitar auxilio vial</Text>
                <Text style={s.mantSub}>El taller recibirá tu solicitud de inmediato.</Text>
              </View>
              <TouchableOpacity onPress={() => setSosOpen(false)}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
            </View>

            <View style={s.sosDatos}>
              <Text style={s.sosDato}><Text style={s.sosDatoL}>Cliente: </Text>{me.nombre}</Text>
              <Text style={s.sosDato}><Text style={s.sosDatoL}>Fecha: </Text>{new Date().toLocaleDateString('es-VE')}</Text>
              <Text style={s.sosDato}><Text style={s.sosDatoL}>Hora: </Text>{new Date().toTimeString().slice(0, 5)}</Text>
            </View>

            {misVehiculos.length > 1 ? (
              <>
                <Text style={s.mantLbl}>¿Cuál vehículo? *</Text>
                {misVehiculos.map((v) => (
                  <TouchableOpacity key={v.id} style={[s.sosVeh, sosVeh && sosVeh.id === v.id && s.sosVehOn]} onPress={() => setSosVeh(v)}>
                    <Text style={[s.sosVehT, sosVeh && sosVeh.id === v.id && { fontWeight: '800' }]}>{v.model}</Text>
                    <Text style={s.sosVehS}>{v.plate}{v.color ? ' · ' + v.color : ''}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : misVehiculos.length === 1 ? (
              <>
                <Text style={s.mantLbl}>Vehículo</Text>
                <View style={[s.sosVeh, s.sosVehOn]}>
                  <Text style={[s.sosVehT, { fontWeight: '800' }]}>{misVehiculos[0].model}</Text>
                  <Text style={s.sosVehS}>{misVehiculos[0].plate}</Text>
                </View>
              </>
            ) : (
              <Text style={[s.muted, { marginTop: 10 }]}>No tienes vehículos registrados en este taller.</Text>
            )}

            <Text style={s.mantLbl}>¿Qué le pasó al vehículo? *</Text>
            <TextInput style={[s.mantInput, { height: 90, textAlignVertical: 'top' }]} value={sosDesc} onChangeText={setSosDesc}
              placeholder="Ej. Se apagó en la vía y no arranca" placeholderTextColor="#9aa3ad" multiline />

            <Text style={s.mantLbl}>¿Dónde estás? *</Text>
            <TextInput style={s.mantInput} value={sosUbi} onChangeText={setSosUbi}
              placeholder="Ej. Autopista Regional, km 12, sentido este" placeholderTextColor="#9aa3ad" />

            <TouchableOpacity style={s.sosGPSBtn} onPress={tomarUbicacion} disabled={sosGPS}>
              <Text style={s.sosGPSBtnT}>{sosGPS ? 'Obteniendo ubicación…' : (sosCoords ? '📍 Ubicación adjunta ✓ (tocar para actualizar)' : '📍 Adjuntar mi ubicación actual')}</Text>
            </TouchableOpacity>
            {sosCoords ? <Text style={s.sosCoords}>Lat {sosCoords.lat.toFixed(5)} · Lng {sosCoords.lng.toFixed(5)}</Text> : null}

            <TouchableOpacity style={[s.sosEnviar, sosEnviando && { opacity: 0.6 }]} onPress={enviarSOS} disabled={sosEnviando}>
              <Text style={s.sosEnviarT}>{sosEnviando ? 'Enviando…' : '🚨 Enviar solicitud de auxilio'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSosOpen(false)}>
              <Text style={s.mantSkip}>Cancelar</Text>
            </TouchableOpacity>
            <View style={{ height: 10 }} />
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={!!fotoAmpliada} transparent animationType="fade" onRequestClose={() => setFotoAmpliada(null)}>
        <TouchableOpacity style={s.fotoModalWrap} activeOpacity={1} onPress={() => setFotoAmpliada(null)}>
          {fotoAmpliada ? <Image source={{ uri: fotoAmpliada }} style={s.fotoModalImg} resizeMode="contain" /> : null}
          <Text style={s.fotoModalCerrar}>Toca para cerrar</Text>
        </TouchableOpacity>
      </Modal>

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
// Convierte d/m/aaaa o aaaa-mm-dd a número AAAAMMDD
const aNumF = (f) => {
  if (!f) return 0;
  const t = String(f).trim(); let d, m, a;
  if (t.includes('/')) { const p = t.split('/'); d = +p[0]; m = +p[1]; a = +p[2]; }
  else if (t.includes('-')) { const p = t.split('-'); if (p[0].length === 4) { a = +p[0]; m = +p[1]; d = +p[2]; } else { d = +p[0]; m = +p[1]; a = +p[2]; } }
  else return 0;
  if (!a || !m || !d) return 0;
  if (a < 100) a += 2000;
  return a * 10000 + m * 100 + d;
};
const hoyNum = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
// Un aviso de mantenimiento sigue activo hasta que llega su fecha
const mantVigente = (n) => n && n.mantenimiento && n.vence && aNumF(n.vence) > hoyNum();

const fechaCorta = (f) => {
  if (!f) return '—';
  try { const d = new Date(f); if (!isNaN(d)) return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) {}
  return String(f);
};

function TrabajoCard({ v, i, tallerId, cliente, abierto, onToggle, data, guardar, me, cur }) {
  const [mantOpen, setMantOpen] = useState(false);
  const [mantTipo, setMantTipo] = useState('');
  const [mantKm, setMantKm] = useState('');
  const [mantFecha, setMantFecha] = useState('');
  const avs = v.advances || [];
  const ultimoAvance = avs.length ? (avs[avs.length - 1].ago || avs[avs.length - 1].t || '') : '';
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
    if (code === 'term') setMantOpen(true); // pedir el próximo mantenimiento
  };

  // Guarda el próximo mantenimiento y avisa al cliente
  const guardarMantenimiento = () => {
    if (!mantFecha.trim()) { Alert.alert('Falta la fecha', 'Indica cuándo debe volver el vehículo.'); return; }
    const prox = { tipo: mantTipo || 'Mantenimiento general', km: mantKm || '—', fecha: mantFecha.trim(), creado: new Date().toLocaleDateString('es-VE'), mech: me.nombre || '' };
    const vehicles = (data.vehicles || []).map((x) => (x.id === v.id ? { ...x, proximoMant: prox } : x));
    const notifs = [...(data.notifs || []), {
      owner: v.owner, veh: v.model,
      text: '🔔 Próximo mantenimiento: ' + prox.tipo + ' · ' + (prox.km !== '—' ? prox.km + ' km · ' : '') + 'para el ' + prox.fecha,
      time: 'ahora', read: false, mantenimiento: true, vence: prox.fecha,
    }];
    guardar({ ...data, vehicles, notifs });
    setMantOpen(false); setMantTipo(''); setMantKm(''); setMantFecha('');
    Alert.alert('Listo', 'Trabajo terminado y próximo mantenimiento programado.\n\nSe notificó al cliente.');
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
      <TouchableOpacity style={[s.jobRow, { borderLeftWidth: 5, borderLeftColor: st.c }]} onPress={onToggle} activeOpacity={0.75}>
        <View style={[s.avatar, { backgroundColor: AVCOLORS[i % AVCOLORS.length] }]}>
          <Text style={s.avatarT}>{v.ini || inits(v.model)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.jobTitle}>{v.model}</Text>
          <View style={s.plate}><Text style={s.plateT}>{v.plate}</Text></View>
          <Text style={s.jobSub}>{v.motivo || 'Sin trabajo definido'}</Text>
          <Text style={s.jobCli}>👤 {v.owner || 'Cliente'}{cliente && cliente.tel ? ' · 📞 ' + cliente.tel : ''}</Text>
          <Text style={s.jobFecha}>📅 Ingresó {fechaCorta(v.ingreso)}{ultimoAvance ? '  ·  🔧 Último avance: ' + ultimoAvance : ''}</Text>
          <View style={s.progBar}><View style={[s.progFill, { width: (v.progress || 0) + '%', backgroundColor: st.c }]} /></View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <View style={[s.pill, { backgroundColor: st.bg }]}><Text style={[s.pillT, { color: st.c }]}>● {st.l}</Text></View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: st.c }}>{v.progress || 0}%</Text>
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

          <TouchableOpacity style={s.actaBtn} onPress={() => compartirActaPDF(tallerId, v, 'acta')}>
            <Text style={s.actaBtnT}>📄 Compartir acta (PDF)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actaBtn, { backgroundColor: '#2563EB', marginTop: 8 }]} onPress={() => compartirActaPDF(tallerId, v, 'trabajo')}>
            <Text style={s.actaBtnT}>📋 Trabajo realizado con fotos (PDF)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actaBtn, { backgroundColor: '#16191d', marginTop: 8 }]} onPress={() => abrirEnNavegador(tallerId, v, 'acta')}>
            <Text style={s.actaBtnT}>🌐 Ver acta en el navegador</Text>
          </TouchableOpacity>

          {v.proximoMant ? (
            <View style={s.mantAviso}>
              <Text style={s.mantAvisoT}>🔔 Próximo mantenimiento</Text>
              <Text style={s.mantAvisoS}>{v.proximoMant.tipo} · {v.proximoMant.km !== '—' ? v.proximoMant.km + ' km · ' : ''}para el {v.proximoMant.fecha}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Formulario de próximo mantenimiento (al terminar el trabajo) */}
      <Modal visible={mantOpen} transparent animationType="slide" onRequestClose={() => setMantOpen(false)}>
        <View style={s.mantWrap}><View style={s.mantCard}>
          <Text style={s.mantTit}>Próximo mantenimiento</Text>
          <Text style={s.mantSub}>El trabajo quedó terminado. Programa cuándo debe volver {v.model} ({v.plate}).</Text>

          <Text style={s.mantLbl}>Tipo de mantenimiento</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            {['Cambio de aceite', 'Frenos', 'Afinamiento', 'Revisión general', 'Alineación'].map((t) => (
              <TouchableOpacity key={t} style={[s.mantChip, mantTipo === t && s.mantChipOn]} onPress={() => setMantTipo(t)}>
                <Text style={[s.mantChipT, mantTipo === t && { color: '#16191d', fontWeight: '800' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={s.mantInput} value={mantTipo} onChangeText={setMantTipo} placeholder="O escribe otro tipo…" placeholderTextColor="#9aa3ad" />

          <Text style={s.mantLbl}>Kilometraje para el próximo</Text>
          <TextInput style={s.mantInput} value={mantKm} onChangeText={setMantKm} placeholder="Ej. 90000" placeholderTextColor="#9aa3ad" keyboardType="numeric" />

          <Text style={s.mantLbl}>Fecha sugerida *</Text>
          <TextInput style={s.mantInput} value={mantFecha} onChangeText={setMantFecha} placeholder="Ej. 20/1/2027" placeholderTextColor="#9aa3ad" />

          <TouchableOpacity style={s.mantBtn} onPress={guardarMantenimiento}>
            <Text style={s.mantBtnT}>Guardar y avisar al cliente</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMantOpen(false)}>
            <Text style={s.mantSkip}>Omitir por ahora</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>
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
  jobCli: { color: '#16191d', fontSize: 12, marginTop: 6, fontWeight: '600' },
  jobFecha: { color: '#8b929b', fontSize: 11, marginTop: 3 },
  histLink: { color: '#2563EB', fontWeight: '700', fontSize: 12.5 },
  sosBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#dc2626', borderRadius: 16, padding: 16, marginTop: 18 },
  sosBtnIco: { fontSize: 26 },
  sosBtnT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  sosBtnS: { color: '#ffd9d9', fontSize: 12, marginTop: 2 },
  sosDatos: { backgroundColor: '#f5f7f9', borderRadius: 12, padding: 12, marginTop: 10 },
  sosDato: { fontSize: 12.5, color: '#16191d', marginBottom: 3 },
  sosDatoL: { color: '#6b7480' },
  sosVeh: { borderWidth: 1, borderColor: '#e2e5ea', borderRadius: 12, padding: 12, marginTop: 8 },
  sosVehOn: { borderColor: '#dc2626', backgroundColor: '#fff5f5' },
  sosVehT: { fontSize: 14, color: '#16191d' },
  sosVehS: { fontSize: 12, color: '#6b7480', marginTop: 2 },
  sosGPSBtn: { backgroundColor: '#16191d', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  sosGPSBtnT: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sosCoords: { fontSize: 11.5, color: '#6b7480', textAlign: 'center', marginTop: 6 },
  sosEnviar: { backgroundColor: '#dc2626', borderRadius: 13, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  sosEnviarT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  mantWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'flex-end' },
  mantCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
  mantTit: { fontSize: 18, fontWeight: '800', color: '#16191d' },
  mantSub: { fontSize: 12.5, color: '#6b7480', marginTop: 4, marginBottom: 14 },
  mantLbl: { fontSize: 12.5, fontWeight: '700', color: '#16191d', marginTop: 12, marginBottom: 6 },
  mantInput: { borderWidth: 1, borderColor: '#e2e5ea', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: '#16191d', backgroundColor: '#fafbfc' },
  mantChip: { borderWidth: 1, borderColor: '#e2e5ea', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  mantChipOn: { backgroundColor: '#F5B700', borderColor: '#F5B700' },
  mantChipT: { fontSize: 12.5, color: '#6b7480' },
  mantBtn: { backgroundColor: '#16A34A', borderRadius: 13, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  mantBtnT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  mantSkip: { textAlign: 'center', color: '#6b7480', marginTop: 14, fontSize: 13 },
  mantAviso: { backgroundColor: '#fff8e6', borderWidth: 1, borderColor: '#f3d79a', borderRadius: 12, padding: 12, marginTop: 12 },
  mantAvisoT: { fontWeight: '800', fontSize: 13, color: '#8a6d1f' },
  mantAvisoS: { fontSize: 12.5, color: '#8a6d1f', marginTop: 3 },
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
  verFoto: { fontSize: 11, color: '#2563EB', fontWeight: '700', marginTop: 4, textAlign: 'center' },
  autBtn: { flex: 1, backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  autBtnT: { color: '#fff', fontWeight: '800', fontSize: 13 },
  fotoModalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.92)', justifyContent: 'center', alignItems: 'center' },
  fotoModalImg: { width: '95%', height: '80%' },
  fotoModalCerrar: { color: '#fff', marginTop: 16, fontSize: 14 },
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
