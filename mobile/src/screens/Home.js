import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, Alert, ScrollView, TextInput, Image, Modal, Linking, Share, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, getState, putState, clearSession, getApiUrl } from '../api';
import { compartirActaPDF, abrirEnNavegador, urlDocumento } from '../acta';
import { ProgressSlider , colorMarca, marcaDe, BotonAjustes, AjustesModal, Calendario } from '../ui';

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

// Mini calendario para elegir el día de una cita. Devuelve 'YYYY-MM-DD'.
function CalendarioCita({ valor, onSelect, bloqueados = [] }) {
  const hoy = new Date();
  const [ver, setVer] = React.useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const a = ver.getFullYear(), m = ver.getMonth();
  const primerDia = new Date(a, m, 1).getDay();
  const diasMes = new Date(a, m + 1, 0).getDate();
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(d);
  const fmt = (d) => a + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  return (
    <View style={cc.wrap}>
      <View style={cc.head}>
        <TouchableOpacity onPress={() => setVer(new Date(a, m - 1, 1))} style={cc.nav}><Text style={cc.navT}>‹</Text></TouchableOpacity>
        <Text style={cc.mes}>{MESES[m]} {a}</Text>
        <TouchableOpacity onPress={() => setVer(new Date(a, m + 1, 1))} style={cc.nav}><Text style={cc.navT}>›</Text></TouchableOpacity>
      </View>
      <View style={cc.semana}>{DIAS.map((d, i) => <Text key={i} style={cc.diaSem}>{d}</Text>)}</View>
      <View style={cc.grid}>
        {celdas.map((d, i) => {
          if (!d) return <View key={i} style={cc.celda} />;
          const fechaStr = fmt(d);
          const fechaObj = new Date(a, m, d);
          const pasado = fechaObj < hoy0;
          const bloq = bloqueados.includes(fechaStr);
          const sel = valor === fechaStr;
          return (
            <TouchableOpacity key={i} style={cc.celda} disabled={pasado || bloq} onPress={() => onSelect(fechaStr)}>
              <View style={[cc.diaBox, sel && cc.diaSel, bloq && { backgroundColor: '#cbd2da' }, pasado && { opacity: 0.3 }]}>
                <Text style={[cc.diaT, sel && { color: '#fff' }, bloq && { color: '#8b95a1' }]}>{d}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const cc = StyleSheet.create({
  wrap: { backgroundColor: '#f7f8fa', borderRadius: 12, padding: 10, marginTop: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  nav: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  navT: { fontSize: 20, color: '#2563EB', fontWeight: '800' },
  mes: { fontSize: 15, fontWeight: '800', color: '#16191d' },
  semana: { flexDirection: 'row' },
  diaSem: { flex: 1, textAlign: 'center', fontSize: 11, color: '#9aa3ad', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  diaBox: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  diaSel: { backgroundColor: '#2563EB' },
  diaT: { fontSize: 14, color: '#3a4048', fontWeight: '600' },
});


export default function HomeScreen({ navigation, route }) {
  const me = route.params?.me || {};
  const talleresParam = route.params?.talleres || [];
  const esTécnico = me.rol === 'mecanico';
  const [taller, setTaller] = useState(talleresParam[0] || null);

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(null);   // id del trabajo desplegado
  const [tecTab, setTecTab] = useState('trabajos'); // pestaña del técnico: trabajos | pagos
  const [toast, setToastRaw] = useState(null);
  const setToast = useCallback((msg) => {
    setToastRaw(msg);
    if (msg) setTimeout(() => setToastRaw((cur) => (cur === msg ? null : cur)), 3000);
  }, []);
  const [notifOpen, setNotifOpen] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosVeh, setSosVeh] = useState(null);
  const [sosDesc, setSosDesc] = useState('');
  const [sosUbi, setSosUbi] = useState('');
  const [sosCoords, setSosCoords] = useState(null);
  const [sosGPS, setSosGPS] = useState(false);
  const [sosEnviando, setSosEnviando] = useState(false);

  // ===== CITAS =====
  const SERVICIOS_CITA = ['Cambio de aceite', 'Frenos', 'Motor', 'Suspensión', 'Sistema eléctrico', 'Aire acondicionado', 'Latonería y pintura', 'Alineación y balanceo', 'Diagnóstico'];
  const [citaOpen, setCitaOpen] = useState(false);
  const [citaPaso, setCitaPaso] = useState(1); // 1: fecha/hora, 2: servicio+obs
  const [citaFecha, setCitaFecha] = useState(null);
  const [citaHora, setCitaHora] = useState(null);
  const [citaServicio, setCitaServicio] = useState('');
  const [citaObs, setCitaObs] = useState('');
  const [citaVeh, setCitaVeh] = useState(null);
  const [citaEnviando, setCitaEnviando] = useState(false);
  const [citaVer, setCitaVer] = useState(null); // cotización (de cita) que el cliente está revisando
  const [cotizaVer, setCotizaVer] = useState(null); // cotización (directa) que el cliente está revisando

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
      if (!t) { setError('Tu cuenta aún no está ligada a un taller. Pide al administrador que te registre como ' + (esTécnico ? 'técnico' : 'cliente') + ' en su taller.'); setLoading(false); return; }
      const d = await getState(t.id); setData(d || {});
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [taller, esTécnico]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (nuevo) => {
    setData(nuevo);
    try { await putState(taller.id, nuevo); } catch (e) { Alert.alert('Error al sincronizar', e.message); }
  };
  const salir = async () => { await clearSession(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); };
  const [ajustesOpen, setAjustesOpen] = useState(false);

  const vehicles = data.vehicles || [];
  const history = data.history || [];
  const notifs = data.notifs || [];
  const cur = (data.config && data.config.currency && data.config.currency.sym) || 'Bs.';

  // Trabajos del técnico: los asignados a él y no cerrados
  const misTrabajos = vehicles.filter((v) => v.recepcion && !v.cerrada && (v.mech === me.nombre || !v.mech));
  // Vehículos del cliente
  const misVehiculos = vehicles.filter((v) => (v.owner || '') === me.nombre);
  const todasCitas = data.citas || [];
  const misCitas = todasCitas.filter((c) => c.cliente === me.nombre);
  const citasPendientes = misCitas.filter((c) => c.estado === 'cotizada'); // esperan mi respuesta
  const ocupadas = todasCitas.filter((c) => c.estado !== 'rechazada' && c.estado !== 'cancelada'); // día+hora tomados
  const HORAS_CITA = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
  const horaOcupada = (fecha, hora) => ocupadas.some((c) => c.fecha === fecha && c.hora === hora);
  const miHistorial = history.filter((h) => (h.cliente || '') === me.nombre);
  const misNotifs = notifs.filter((n) => (n.owner || '') === me.nombre);
  const misCotizacionesPendientes = (data.cotizaciones || []).filter((c) => c.cliente === me.nombre && c.estado !== 'aprobada' && c.estado !== 'inactiva');
  const sinLeer = misNotifs.filter((n) => !n.read || mantVigente(n)).length;

  const fondo = esTécnico ? '#f3f5f7' : '#eef3fb'; // el cliente ve un fondo azulado
  const primerNombre = String(me.nombre || '').split(' ')[0] || '';
  const Header = ({ titulo, sub }) => (
    <View style={[s.top, !esTécnico && { backgroundColor: '#12203a' }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.kicker, !esTécnico && { color: '#8fa3c4' }]}>{esTécnico ? 'APP DEL TÉCNICO' : 'APP DEL CLIENTE'}</Text>
        <Text style={s.hola}>Hola, {primerNombre || 'bienvenido'} 👋</Text>
        <Text style={[s.h1, !esTécnico && { color: '#fff' }]}>{titulo}</Text>
        {!!sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {!esTécnico && (
          <>
            <TouchableOpacity style={s.hbtn} onPress={abrirSOS} activeOpacity={0.85}>
              <Text style={[s.hbtnT, { color: '#dc2626' }]}>SOS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.hbtn} onPress={abrirCita} activeOpacity={0.85}>
              <Text style={{ fontSize: 17 }}>📅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.hbtn} onPress={() => setNotifOpen(true)}>
              <Text style={{ fontSize: 17 }}>🔔</Text>
              {sinLeer ? <View style={s.badge}><Text style={s.badgeT}>{sinLeer}</Text></View> : null}
            </TouchableOpacity>
          </>
        )}
        <BotonAjustes color={esTécnico ? '#16191d' : '#fff'} onPress={() => setAjustesOpen(true)} />
        <TouchableOpacity style={s.hbtn} onPress={salir}><Text style={s.hbtnT}>Salir</Text></TouchableOpacity>
      </View>
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

  if (loading && !data.vehicles) {
    return (
      <View style={[s.wrap, { backgroundColor: fondo, justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <ActivityIndicator color="#F5B700" size="large" />
        <Text style={{ color: esTécnico ? '#16191d' : '#fff', fontWeight: '700', marginTop: 14, textAlign: 'center' }}>Conectando con el servidor…</Text>
        <Text style={{ color: esTécnico ? '#6b7480' : 'rgba(255,255,255,.7)', fontSize: 12.5, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>Si es la primera vez que entras en un rato, puede tardar hasta un minuto en despertar. Espera un momento.</Text>
      </View>
    );
  }

  /* ==================== TÉCNICO ==================== */
  if (esTécnico) {
    const trabajosHechos = (data.history || []).filter((h) => h.mech === me.nombre).map((h) => ({ ...h, cobrado: !!h.honorario }));
    const misPagos = trabajosHechos.filter((h) => h.cobrado);
    const totalPagado = misPagos.reduce((a, h) => a + (+h.honorario.monto || 0), 0);
    const totalTrabajos = trabajosHechos.length;
    return (
      <View style={[s.wrap, { backgroundColor: fondo }]}>
        {toast ? (
          <View style={s.toastWrap} pointerEvents="none">
            <View style={s.toastBox}><Text style={s.toastT}>{toast}</Text></View>
          </View>
        ) : null}
        <Header titulo={tecTab === 'pagos' ? 'Mis pagos' : 'Mis trabajos'} sub={`${misTrabajos.length} activo(s) · ${taller ? taller.nombre : ''}`} />
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10 }}>
          {[['trabajos', '🔧 Trabajos'], ['pagos', '💵 Mis pagos']].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setTecTab(k)} style={[{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: tecTab === k ? '#16191d' : '#e7ebef' }]}>
              <Text style={{ fontWeight: '800', color: tecTab === k ? '#fff' : '#6b7480', fontSize: 13 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tecTab === 'pagos' ? (
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargar} />}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1, backgroundColor: '#0F6E56', borderRadius: 14, padding: 16 }}>
                <Text style={{ color: '#b6e5d7', fontSize: 12, fontWeight: '700' }}>Total ganado</Text>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>{cur} {totalPagado.toLocaleString('es-VE')}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#16191d', borderRadius: 14, padding: 16 }}>
                <Text style={{ color: '#9aa3ad', fontSize: 12, fontWeight: '700' }}>Trabajos hechos</Text>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>{totalTrabajos}</Text>
              </View>
            </View>
            <Text style={[s.label2 || {}, { fontSize: 14, fontWeight: '800', color: '#16191d', marginBottom: 10 }]}>Trabajos hechos</Text>
            {trabajosHechos.length ? trabajosHechos.map((h, i) => (
              <View key={i} style={s.pagoCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '800', color: '#16191d' }}>{h.veh}{h.numOrden ? ' · OS' + String(h.numOrden).padStart(4, '0') : ''}</Text>
                  {h.cobrado ? <Text style={{ fontWeight: '800', color: '#0F6E56' }}>{cur} {(+h.honorario.monto).toLocaleString('es-VE')}</Text> : null}
                </View>
                <Text style={s.muted}>{h.trabajo}</Text>
                {h.cobrado ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={{ backgroundColor: '#e8f6ec', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: '#0F6E56', fontWeight: '800', fontSize: 11 }}>✅ Cobrado</Text></View>
                    <Text style={s.muted}>{h.honorario.fecha} · {h.honorario.pct}% de lo cobrado</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: '#fdf3e0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 }}><Text style={{ color: '#b45309', fontWeight: '800', fontSize: 11 }}>⏳ Pendiente de pago</Text></View>
                )}
              </View>
            )) : <Text style={s.muted}>Aún no tienes trabajos hechos registrados.</Text>}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={cargar} />}>
            {misTrabajos.length ? misTrabajos.map((v, i) => (
              <TrabajoCard key={v.id} v={v} i={i} tallerId={taller.id} cliente={(data.clients || []).find((c) => c.n === v.owner)} abierto={abierto === v.id}
                onToggle={() => setAbierto(abierto === v.id ? null : v.id)}
                data={data} guardar={guardar} me={me} cur={cur} onTerminado={() => setToast('✅ Trabajo marcado como terminado')} />
            )) : <Text style={s.muted}>No tienes trabajos asignados ahora mismo.</Text>}
          </ScrollView>
        )}
        <AjustesModal visible={ajustesOpen} onClose={() => setAjustesOpen(false)} />
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
  const abrirCita = () => {
    setCitaPaso(1); setCitaFecha(null); setCitaHora(null); setCitaServicio('');
    setCitaObs(''); setCitaVeh(misVehiculos.length === 1 ? misVehiculos[0] : null); setCitaOpen(true);
  };
  const enviarCita = async () => {
    if (!citaFecha || !citaHora) { Alert.alert('Falta', 'Elige la fecha y la hora.'); return; }
    if (!citaServicio) { Alert.alert('Falta', 'Elige el tipo de servicio.'); return; }
    setCitaEnviando(true);
    const v = citaVeh || misVehiculos[0] || {};
    try {
      await api('/api/state/cita?taller=' + taller.id, {
        method: 'POST',
        body: JSON.stringify({
          fecha: citaFecha, hora: citaHora, servicio: citaServicio, observaciones: citaObs.trim(),
          vehId: v.id || null, vehiculo: v.model || '', placa: v.plate || '',
        }),
      });
      setCitaOpen(false); setCitaEnviando(false);
      Alert.alert('Cita solicitada 📅', 'El taller revisará tu solicitud y te enviará una cotización. Te avisaremos aquí.');
      cargar();
    } catch (e) {
      setCitaEnviando(false);
      Alert.alert('No se pudo agendar', (e && e.message) || 'Revisa tu conexión e intenta de nuevo.');
    }
  };
  const responderCita = async (cita, aceptada) => {
    try {
      await api('/api/state/cita-responder?taller=' + taller.id, { method: 'POST', body: JSON.stringify({ id: cita.id, aceptada }) });
      setCitaVer(null);
      Alert.alert(aceptada ? '¡Cita confirmada! ✅' : 'Cita rechazada', aceptada ? 'Tu cita quedó agendada para el ' + cita.fecha + ' a las ' + cita.hora + '.' : 'Se notificó al taller que no aceptas la cotización.');
      cargar();
    } catch (e) { Alert.alert('Error', (e && e.message) || 'No se pudo responder.'); }
  };
  const aprobarCotizacion = async (cot) => {
    const arr = (data.cotizaciones || []).map((c) => (c.id === cot.id ? { ...c, estado: 'aprobada', aprobadoPor: 'cliente', fechaAprobacion: new Date().toLocaleDateString('es-VE') } : c));
    await guardar({ ...data, cotizaciones: arr });
    setCotizaVer(null);
    Alert.alert('¡Cotización aprobada! ✅', 'El taller ya puede proceder con el trabajo.');
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

        {citasPendientes.map((c) => (
          <TouchableOpacity key={c.id} style={s.citaAviso} onPress={() => setCitaVer(c)}>
            <Text style={{ fontSize: 24 }}>💰</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: '#166534', fontSize: 14 }}>Cotización lista para tu cita</Text>
              <Text style={{ color: '#3a4048', fontSize: 12.5, marginTop: 2 }}>{c.servicio} · {c.fecha} {c.hora} · {cur} {(+c.monto || 0).toLocaleString('es-VE')} — toca para revisar</Text>
            </View>
          </TouchableOpacity>
        ))}

        {misCotizacionesPendientes.map((c) => (
          <TouchableOpacity key={c.id} style={s.citaAviso} onPress={() => setCotizaVer(c)}>
            <Text style={{ fontSize: 24 }}>🧾</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: '#166534', fontSize: 14 }}>Tienes una cotización por aprobar</Text>
              <Text style={{ color: '#3a4048', fontSize: 12.5, marginTop: 2 }}>{c.vehiculo || ''} · {cur} {(+c.monto || 0).toLocaleString('es-VE')} — toca para revisar</Text>
            </View>
          </TouchableOpacity>
        ))}

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
                <Text style={[s.heroLbl, { marginTop: 12 }]}>🔧 Técnico: {v.mech || 'por asignar'}</Text>
              </View>

              {/* Técnico asignado + seguimiento */}
              <View style={s.card}>
                <Text style={s.cardH}>Técnico asignado</Text>
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
                      : 'Podrás descargar el acta de conformidad cuando el trabajo esté terminado y pagado. Mientras tanto puedes ver los avances del técnico.');
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
      <Modal visible={citaOpen} transparent animationType="slide" onRequestClose={() => setCitaOpen(false)}>
        <View style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>📅 Agendar cita — Paso {citaPaso} de 2</Text>
              <TouchableOpacity onPress={() => setCitaOpen(false)}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 460 }}>
              {citaPaso === 1 ? (
                <>
                  <Text style={s.citaLabel}>Elige el día</Text>
                  <CalendarioCita valor={citaFecha} bloqueados={data.diasBloqueados || []} onSelect={(f) => { setCitaFecha(f); setCitaHora(null); }} />
                  {citaFecha ? (
                    <>
                      <Text style={s.citaLabel}>Horas disponibles — {citaFecha}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {HORAS_CITA.map((h) => {
                          const ocup = horaOcupada(citaFecha, h);
                          const sel = citaHora === h;
                          return (
                            <TouchableOpacity key={h} disabled={ocup} onPress={() => setCitaHora(h)}
                              style={[s.horaChip, ocup && s.horaOcupada, sel && s.horaSel]}>
                              <Text style={[s.horaChipT, ocup && { color: '#9aa3ad' }, sel && { color: '#fff' }]}>{h}{ocup ? ' 🔒' : ''}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={{ fontSize: 11, color: '#9aa3ad', marginTop: 8 }}>🔒 = ya reservado por otro cliente</Text>
                    </>
                  ) : null}
                  <TouchableOpacity style={[s.citaBtn, (!citaFecha || !citaHora) && { opacity: 0.5 }]} disabled={!citaFecha || !citaHora} onPress={() => setCitaPaso(2)}>
                    <Text style={s.citaBtnT}>Siguiente →</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {misVehiculos.length > 1 ? (
                    <>
                      <Text style={s.citaLabel}>¿Para cuál vehículo?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {misVehiculos.map((v) => (
                          <TouchableOpacity key={v.id} onPress={() => setCitaVeh(v)} style={[s.horaChip, citaVeh && citaVeh.id === v.id && s.horaSel]}>
                            <Text style={[s.horaChipT, citaVeh && citaVeh.id === v.id && { color: '#fff' }]}>{v.model} · {v.plate}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : null}
                  <Text style={s.citaLabel}>Tipo de servicio</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {SERVICIOS_CITA.map((sv) => (
                      <TouchableOpacity key={sv} onPress={() => setCitaServicio(sv)} style={[s.horaChip, citaServicio === sv && s.horaSel]}>
                        <Text style={[s.horaChipT, citaServicio === sv && { color: '#fff' }]}>{sv}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.citaLabel}>Observaciones (opcional)</Text>
                  <TextInput style={s.citaInput} value={citaObs} onChangeText={setCitaObs} multiline placeholder="Cuéntanos más sobre lo que necesitas…" placeholderTextColor="#9aa3ad" />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <TouchableOpacity style={[s.citaBtn, { flex: 0, paddingHorizontal: 20, backgroundColor: '#eef0f2' }]} onPress={() => setCitaPaso(1)}>
                      <Text style={[s.citaBtnT, { color: '#3a4048' }]}>← Atrás</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.citaBtn, { flex: 1 }, citaEnviando && { opacity: 0.6 }]} disabled={citaEnviando} onPress={enviarCita}>
                      <Text style={s.citaBtnT}>{citaEnviando ? 'Enviando…' : 'Solicitar cita'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!citaVer} transparent animationType="slide" onRequestClose={() => setCitaVer(null)}>
        <View style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>💰 Cotización de tu cita</Text>
              <TouchableOpacity onPress={() => setCitaVer(null)}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
            </View>
            {citaVer ? (
              <ScrollView style={{ maxHeight: 460 }}>
                <View style={s.cotizaFila}><Text style={s.cotizaK}>Servicio</Text><Text style={s.cotizaV}>{citaVer.servicio}</Text></View>
                <View style={s.cotizaFila}><Text style={s.cotizaK}>Vehículo</Text><Text style={s.cotizaV}>{citaVer.vehiculo} {citaVer.placa ? '· ' + citaVer.placa : ''}</Text></View>
                <View style={s.cotizaFila}><Text style={s.cotizaK}>Fecha</Text><Text style={s.cotizaV}>{citaVer.fecha} · {citaVer.hora}</Text></View>
                {citaVer.observaciones ? <View style={s.cotizaFila}><Text style={s.cotizaK}>Notas</Text><Text style={s.cotizaV}>{citaVer.observaciones}</Text></View> : null}
                <Text style={[s.citaLabel, { marginTop: 14 }]}>Repuestos y trabajos</Text>
                {(citaVer.repuestos || []).length ? (citaVer.repuestos || []).map((r, i) => (
                  <View key={i} style={s.repuestoFila}>
                    <Text style={{ flex: 1, color: '#3a4048' }}>{r.n}</Text>
                    <Text style={{ fontWeight: '700', color: '#16191d' }}>{cur} {(+r.p || 0).toLocaleString('es-VE')}</Text>
                  </View>
                )) : <Text style={s.muted}>Sin repuestos detallados.</Text>}
                <View style={s.totalFila}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#16191d' }}>TOTAL</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F6E56' }}>{cur} {(+citaVer.monto || 0).toLocaleString('es-VE')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                  <TouchableOpacity style={[s.citaBtn, { flex: 1, backgroundColor: '#dc2626' }]} onPress={() => responderCita(citaVer, false)}>
                    <Text style={s.citaBtnT}>Rechazar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.citaBtn, { flex: 1, backgroundColor: '#16a34a' }]} onPress={() => responderCita(citaVer, true)}>
                    <Text style={s.citaBtnT}>Aceptar cita</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={!!cotizaVer} transparent animationType="slide" onRequestClose={() => setCotizaVer(null)}>
        <View style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>🧾 Cotización</Text>
              <TouchableOpacity onPress={() => setCotizaVer(null)}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
            </View>
            {cotizaVer ? (
              <ScrollView style={{ maxHeight: 460 }}>
                {cotizaVer.num ? <View style={s.cotizaFila}><Text style={s.cotizaK}>N°</Text><Text style={s.cotizaV}>P-{String(cotizaVer.num).padStart(6, '0')}</Text></View> : null}
                {cotizaVer.vehiculo ? <View style={s.cotizaFila}><Text style={s.cotizaK}>Vehículo</Text><Text style={s.cotizaV}>{cotizaVer.vehiculo} {cotizaVer.placa ? '· ' + cotizaVer.placa : ''}</Text></View> : null}
                <Text style={[s.citaLabel, { marginTop: 14 }]}>Servicios y repuestos</Text>
                {(cotizaVer.items || []).length ? (cotizaVer.items || []).map((r, i) => (
                  <View key={i} style={s.repuestoFila}>
                    <Text style={{ flex: 1, color: '#3a4048' }}>{r.tipo === 'repuesto' ? '🔩' : '🔧'} {r.n}</Text>
                    <Text style={{ fontWeight: '700', color: '#16191d' }}>{cur} {(+r.p || 0).toLocaleString('es-VE')}</Text>
                  </View>
                )) : <Text style={s.muted}>Sin ítems detallados.</Text>}
                <View style={s.totalFila}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#16191d' }}>TOTAL</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F6E56' }}>{cur} {(+cotizaVer.monto || 0).toLocaleString('es-VE')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                  <TouchableOpacity style={[s.citaBtn, { flex: 1, backgroundColor: '#16a34a' }]} onPress={() => aprobarCotizacion(cotizaVer)}>
                    <Text style={s.citaBtnT}>✅ Aprobar cotización</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <AjustesModal visible={ajustesOpen} onClose={() => setAjustesOpen(false)} />

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

/* ============ TARJETA DE TRABAJO DEL TÉCNICO (se despliega debajo) ============ */
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

// Fondo muy suave derivado del color de la marca, para que la tarjeta no se vea plana
function tintMarca(nombre) {
  const c = colorMarca(nombre);
  if (c && c.startsWith('hsl')) return c.replace(/(\d+)%\)$/, '96%)').replace(',55%,', ',60%,');
  // hex -> rgba muy tenue
  const h = (c || '#888').replace('#', '');
  if (h.length === 6) { const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16); return `rgba(${r},${g},${b},0.07)`; }
  return '#fff';
}
const fechaCorta = (f) => {
  if (!f) return '—';
  try { const d = new Date(f); if (!isNaN(d)) return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) {}
  return String(f);
};

function TrabajoCard({ v, i, tallerId, cliente, abierto, onToggle, data, guardar, me, cur, onTerminado }) {
  const [mantOpen, setMantOpen] = useState(false);
  const [mantTipo, setMantTipo] = useState('');
  const [mantKm, setMantKm] = useState('');
  const [mantFecha, setMantFecha] = useState('');
  const [calMantOpen, setCalMantOpen] = useState(false);
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
  const miMecanico = (data.mecanicos || []).find((m) => m.n === me.nombre);
  const notificaDirecto = !!(miMecanico && miMecanico.notificarCliente);
  const aplicar = (cambios, avance, notif) => {
    const vehicles = (data.vehicles || []).map((x) => {
      if (x.id !== v.id) return x;
      const nv = { ...x, ...cambios };
      if (avance) nv.advances = [...(x.advances || []), { ...avance, notificadoCliente: notif ? notificaDirecto : true, pendienteRevision: !!(notif && !notificaDirecto) }];
      return nv;
    });
    let notifs = data.notifs || [];
    if (notif && notificaDirecto) notifs = [...notifs, { owner: v.owner, veh: v.model, text: notif.text, time: 'ahora', read: false, atencion: !!notif.atencion, listo: !!notif.listo }];
    guardar({ ...data, vehicles, notifs });
  };

  const cambiarEstado = (code) => {
    const st2 = STATUS[code];
    const cambios = { status: code };
    if (code === 'term') cambios.progress = 100;
    if (code === 'rep' && !v.progress) cambios.progress = 10;
    aplicar(cambios,
      { t: st2.l, m: 'Actualizado por ' + (me.nombre || 'el técnico'), type: code === 'term' ? 'term' : 'estado', ago: 'ahora' },
      code === 'term' ? { text: '✅ Tu vehículo está listo para retirar', listo: true } : { text: 'Estado actualizado: ' + st2.l });
    if (code === 'term') { setMantOpen(true); if (onTerminado) onTerminado(); } // pedir el próximo mantenimiento + avisar
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
      { t: txt.trim() || 'Avance actualizado', m: (me.nombre || 'Técnico') + ' · ' + prog + '% completado', type: 'nota', ago: 'ahora', foto },
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
      <TouchableOpacity style={[s.jobRow, { borderLeftWidth: 6, borderLeftColor: colorMarca(marcaDe(v)), backgroundColor: tintMarca(marcaDe(v)) }]} onPress={onToggle} activeOpacity={0.75}>
        <View style={[s.avatar, { backgroundColor: colorMarca(marcaDe(v)) }]}>
          <Text style={s.avatarT}>{v.ini || inits(v.model)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.jobTitle}>{v.model}</Text>
          <View style={s.plate}><Text style={s.plateT}>{v.plate}</Text></View>
          <Text style={s.jobSub}>{v.motivo || 'Sin trabajo definido'}</Text>
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
          <TouchableOpacity style={s.mantInput} onPress={() => setCalMantOpen(true)}>
            <Text style={{ color: mantFecha ? '#16191d' : '#9aa3ad', fontSize: 14 }}>{mantFecha || 'Toca para elegir la fecha en el calendario'}</Text>
          </TouchableOpacity>
          <Calendario visible={calMantOpen} valor={mantFecha} titulo="Próximo mantenimiento" onSelect={setMantFecha} onClose={() => setCalMantOpen(false)} />

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
  toastWrap: { position: 'absolute', top: 50, right: 14, zIndex: 999, elevation: 20 },
  toastBox: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  toastT: { color: '#fff', fontWeight: '800', fontSize: 13 },
  top: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: '#eef0f3', flexDirection: 'row', alignItems: 'flex-start' },
  kicker: { color: '#9aa3ad', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  hola: { color: '#F5B700', fontSize: 15, fontWeight: '800', marginTop: 3 },
  h1: { color: '#16191d', fontSize: 27, fontWeight: '800', marginTop: 2 },
  sub: { color: '#6b7480', fontSize: 12, marginTop: 3 },
  hbtn: { minWidth: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  hbtnT: { color: '#16191d', fontSize: 13, fontWeight: '800' },
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
  sosChip: { backgroundColor: '#dc2626', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginRight: 8 },
  sosChipT: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
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
  citaLabel: { fontSize: 13, fontWeight: '800', color: '#16191d', marginTop: 16, marginBottom: 8 },
  citaBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  citaBtnT: { color: '#fff', fontWeight: '800', fontSize: 15 },
  citaInput: { backgroundColor: '#f7f8fa', borderRadius: 12, padding: 12, minHeight: 70, textAlignVertical: 'top', fontSize: 14, color: '#16191d' },
  horaChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#f0f2f5', borderWidth: 1, borderColor: '#e3e7ec' },
  horaChipT: { fontSize: 13, fontWeight: '700', color: '#3a4048' },
  horaSel: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  horaOcupada: { backgroundColor: '#e3e7ec', borderColor: '#d3d8de' },
  cotizaFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f0f2f5' },
  cotizaK: { color: '#6b7480', fontSize: 13 },
  cotizaV: { color: '#16191d', fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  repuestoFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f0f2f5' },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 2, borderColor: '#e3e7ec' },
  pagoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#eef0f2' },
  citaAviso: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#e8f6ec', borderRadius: 16, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#16a34a' },
});
