import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert, ScrollView, TextInput, Image, Modal, Pressable, Linking, BackHandler } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, getState, putState, clearSession, getApiUrl } from '../api';
import { compartirActaPDF, abrirEnNavegador, compartirCotizacionPDF, compartirResumenEsperaPDF } from '../acta';
import { Dropdown, FirmaPad, FirmaVista, CarroSVG, etiqueta, colorMarca, marcaDe, Calendario, BotonAjustes, AjustesModal } from '../ui';

const STATUS = {
  espera: { l: 'En espera', c: '#64748B' }, rep: { l: 'En reparación', c: '#D97706' },
  wait: { l: 'Esp. repuestos', c: '#D97706' }, reprog: { l: 'Reprogramado', c: '#7c3aed' },
  term: { l: 'Terminado', c: '#16A34A' }, dev: { l: 'Devolución', c: '#dc2626' }, ent: { l: 'Entregado', c: '#2563EB' },
};
const LADOS = [['sup', 'Superior'], ['front', 'Frontal'], ['izq', 'Lat. Izq.'], ['der', 'Lat. Der.'], ['post', 'Posterior']];
function textoCredenciales({ nombreTaller, nombre, usuario, clave, rolTxt }) {
  let txt = '👋 ¡Bienvenido a ' + (nombreTaller || 'TallerOS') + '!\n\n'
    + 'Hola ' + nombre + ', se creó tu acceso como ' + (rolTxt || 'usuario') + '.\n\n'
    + '👤 Usuario: ' + usuario + '\n';
  if (clave) txt += '🔒 Contraseña: ' + clave + '\n';
  txt += '\nIngresa desde la app TallerOS.';
  if (clave) txt += '\nPor seguridad, cambia tu contraseña al entrar.';
  else txt += '\n(Si no recuerdas tu contraseña, pide al taller que la restablezca.)';
  return txt;
}
function compartirAcceso(datos) {
  const txt = textoCredenciales(datos);
  const num = (datos.tel || '').replace(/[^0-9]/g, '');
  const persona = (datos.rolTxt === 'técnico' ? 'al técnico' : 'al cliente');
  const opciones = [];
  if (num) opciones.push({ text: '📲 WhatsApp ' + persona, onPress: () => Linking.openURL('https://wa.me/' + num + '?text=' + encodeURIComponent(txt)).catch(() => Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp.')) });
  opciones.push({ text: '📤 Compartir…', onPress: async () => {
    try { const { Share } = require('react-native'); await Share.share({ message: txt, title: 'Acceso a TallerOS — ' + datos.nombre }); }
    catch (e) { Linking.openURL('https://wa.me/?text=' + encodeURIComponent(txt)).catch(() => {}); }
  } });
  opciones.push({ text: 'Cancelar', style: 'cancel' });
  Alert.alert('Compartir acceso de ' + datos.nombre, 'Elige cómo compartir usuario y contraseña:', opciones);
}
function CalendarioBloqueo({ bloqueados, onToggle }) {
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
    <View style={{ backgroundColor: '#f7f8fa', borderRadius: 12, padding: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <TouchableOpacity onPress={() => setVer(new Date(a, m - 1, 1))} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, color: '#7c3aed', fontWeight: '800' }}>‹</Text></TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#16191d' }}>{MESES[m]} {a}</Text>
        <TouchableOpacity onPress={() => setVer(new Date(a, m + 1, 1))} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, color: '#7c3aed', fontWeight: '800' }}>›</Text></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row' }}>{DIAS.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9aa3ad', fontWeight: '700' }}>{d}</Text>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {celdas.map((d, i) => {
          if (!d) return <View key={i} style={{ width: '14.28%', aspectRatio: 1 }} />;
          const fechaStr = fmt(d);
          const pasado = new Date(a, m, d) < hoy0;
          const bloq = bloqueados.includes(fechaStr);
          return (
            <TouchableOpacity key={i} style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 }} disabled={pasado} onPress={() => onToggle(fechaStr)}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: bloq ? '#64748B' : 'transparent', opacity: pasado ? 0.3 : 1 }}>
                <Text style={{ fontSize: 14, color: bloq ? '#fff' : '#3a4048', fontWeight: '600' }}>{d}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
function CampoClave({ value, onChangeText, placeholder }) {
  const [ver, setVer] = React.useState(false);
  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      <TextInput style={[s.input, { paddingRight: 46 }]} value={value} onChangeText={onChangeText} secureTextEntry={!ver} placeholder={placeholder} placeholderTextColor="#9aa3ad" autoCapitalize="none" />
      <TouchableOpacity style={{ position: 'absolute', right: 12, padding: 6 }} onPress={() => setVer(!ver)}>
        <Text style={{ fontSize: 17 }}>{ver ? '🙈' : '👁️'}</Text>
      </TouchableOpacity>
    </View>
  );
}
const LADO_NOMBRE = { sup: 'Superior', front: 'Frontal', izq: 'Lat. Izq.', der: 'Lat. Der.', post: 'Posterior' };
// Proporción real (ancho/alto) de cada imagen del carro, para que el pin caiga exacto
const CAR_RATIO = { sup: 2.60, front: 1.59, post: 1.42, izq: 3.04, der: 3.04 };

const TIPOS = ['Rayón', 'Abolladura', 'Golpe', 'Vidrio', 'Óxido', 'Faltante'];
const FUEL = ['E', '⅛', '¼', '½', '¾', '⅞', 'F'];
const ACCS = ['Radio', 'Gato', 'Llave cruz', 'Extintor', 'Triángulo', 'Repuesto', 'Alfombras', 'Antena'];
const DOCS_VEH = ['Documento de identidad', 'Carné de circulación', 'Seguro'];
const PRIOS = ['Baja', 'Media', 'Alta', 'Urgente'];
const TIPO_VEH = ['Automóvil', 'Camioneta / SUV', 'Motocicleta', 'Moto taxi', 'Camión', 'Bus', 'Van'];
const TIPO_DOC = ['Cédula V', 'Cédula E', 'RIF', 'Pasaporte'];
const PAISES = [
  { cod: '+58', nom: 'Venezuela', band: '🇻🇪', ej: '412 555 0134' },
  { cod: '+51', nom: 'Perú', band: '🇵🇪', ej: '987 654 321' },
  { cod: '+57', nom: 'Colombia', band: '🇨🇴', ej: '301 234 5678' },
  { cod: '+56', nom: 'Chile', band: '🇨🇱', ej: '9 1234 5678' },
  { cod: '+593', nom: 'Ecuador', band: '🇪🇨', ej: '99 123 4567' },
  { cod: '+591', nom: 'Bolivia', band: '🇧🇴', ej: '712 34567' },
  { cod: '+54', nom: 'Argentina', band: '🇦🇷', ej: '11 2345 6789' },
  { cod: '+52', nom: 'México', band: '🇲🇽', ej: '55 1234 5678' },
  { cod: '+1', nom: 'EE.UU./Panamá', band: '🇺🇸', ej: '305 123 4567' },
  { cod: '+34', nom: 'España', band: '🇪🇸', ej: '612 34 56 78' },
];
const TIPOS_VEH = ['Automóvil', 'Camioneta', 'SUV', 'Motocicleta', 'Moto taxi', 'Camión', 'Bus', 'Van'];
const COLORES = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Marrón', 'Beige', 'Dorado', 'Vino tinto', 'Celeste'];
const MOTIVOS_BASE = ['Ruido extraño', 'Revisión general', 'Falla eléctrica', 'Recalentamiento', 'Mantenimiento preventivo', 'Choque / golpe', 'No enciende', 'Fuga de aceite'];
const TRABAJOS_BASE = ['Cambio de aceite', 'Frenos', 'Motor', 'Suspensión', 'Sistema eléctrico', 'Aire acondicionado', 'Latonería y pintura', 'Alineación y balanceo', 'Diagnóstico'];
const ESP_BASE = ['General', 'Motor', 'Frenos', 'Electricidad', 'Suspensión', 'Latonería y pintura', 'Aire acondicionado', 'Diagnóstico'];
const MARCAS_BASE = ['Toyota', 'Chevrolet', 'Ford', 'Hyundai', 'Kia', 'Renault', 'Fiat', 'Jeep', 'Nissan', 'Mitsubishi'];
const nid = (arr) => Math.max(0, ...(arr || []).map((x) => +x.id || 0)) + 1;
// Selector de fecha: se carga una sola vez; si no está en el APK, queda null (no rompe)
// Calendario visual propio (no depende de librerías nativas)
const inits = (str) => (str || '').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

export default function AdminHomeScreen({ navigation, route }) {
  const me = route.params?.me || {};
  const esSuper = me.rol === 'superadmin';
  const [talleres, setTalleres] = useState(route.params?.talleres || []);
  const [taller, setTaller] = useState(null);
  const [data, setData] = useState({});
  const [tab, setTab] = useState('inicio');
  const [passPrompt, setPassPrompt] = useState(null); // { item, rol, rolTxt } | null
  const [passPromptValor, setPassPromptValor] = useState('');
  // El botón/gesto ATRÁS del teléfono: desde un menú vuelve al inicio; desde el inicio, comportamiento normal (salir)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'inicio') { setTab('inicio'); return true; } // true = ya lo manejamos
      return false; // en el inicio, dejar que el teléfono haga lo suyo
    });
    return () => sub.remove();
  }, [tab]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [qOrd, setQOrd] = useState('');
  const [resumenOpen, setResumenOpen] = useState(false);
  const [fCod, setFCod] = useState(''); const [fMonto, setFMonto] = useState(''); const [fFoto, setFFoto] = useState(null);

  useEffect(() => {
    (async () => {
      let list = talleres;
      if (esSuper) { try { const ts = await api('/api/talleres'); list = ts.filter((t) => t.activo); setTalleres(list); } catch (e) {} }
      const primero = (list || []).find((t) => t.activo !== 0 && t.activo !== false) || (list || [])[0];
      if (primero) seleccionar(primero);
    })();
  }, []);

  const seleccionar = useCallback(async (t) => {
    if (t.activo === 0 || t.activo === false) { Alert.alert('Taller desactivado', t.motivo_inactivo || 'Desactivado por el Super Administrador.'); return; }
    setTaller(t); setLoading(true); setError('');
    try { const d = await getState(t.id); setData(d || {}); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  const recargar = useCallback(async () => {
    if (!taller) return; setLoading(true);
    try { const d = await getState(taller.id); setData(d || {}); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [taller]);

  const guardar = useCallback(async (nuevo) => {
    setData(nuevo);
    try { await putState(taller.id, nuevo); } catch (e) { Alert.alert('Error al sincronizar', e.message); }
  }, [taller]);

  const toggleActivo = (tipo, item) => {
    const activar = item.activo === false;
    const arrKey = tipo === 'cliente' ? 'clients' : 'mecanicos';
    const arr = (data[arrKey] || []).map((x) => (x.id === item.id ? { ...x, activo: activar } : x));
    guardar({ ...data, [arrKey]: arr });
  };

  // La contraseña se guarda con hash en el servidor, así que no se puede "recuperar" la
  // original: se le pide al admin que escriba la contraseña que quiere compartir (ej. la
  // misma que siempre usa), se guarda, y se comparte esa — así el cliente/técnico entra
  // con una contraseña conocida y luego la puede cambiar.
  // Si nunca se guardó una contraseña (cuentas antiguas), se genera una automáticamente
  // sin preguntar nada, se guarda, y de ahí en adelante siempre se reutiliza esa misma.
  const asegurarClaveYCompartir = async (item, rol, rolTxt) => {
    let clave = item.claveActual;
    if (!clave) {
      clave = 'Taller' + Math.floor(1000 + Math.random() * 9000);
      try {
        await api('/api/talleres/' + taller.id + '/cuenta', {
          method: 'PUT',
          body: JSON.stringify({ usuario: item.usuario, nombre: item.n, rol, telefono: item.tel, password: clave }),
        });
        const arrKey = rol === 'cliente' ? 'clients' : 'mecanicos';
        const arr = (data[arrKey] || []).map((x) => (x.id === item.id ? { ...x, claveActual: clave } : x));
        guardar({ ...data, [arrKey]: arr });
      } catch (e) {
        Alert.alert('Error', 'No se pudo preparar el acceso: ' + e.message); return;
      }
    }
    compartirAcceso({ nombreTaller: taller && taller.nombre, nombre: item.n, usuario: item.usuario, clave, rolTxt, tel: item.tel });
  };
  const regenerarYCompartir = async (item, rol, rolTxt) => {
    const clave = (passPromptValor || '').trim();
    if (clave.length < 6) { Alert.alert('Contraseña muy corta', 'Debe tener al menos 6 caracteres.'); return; }
    try {
      await api('/api/talleres/' + taller.id + '/cuenta', {
        method: 'PUT',
        body: JSON.stringify({ usuario: item.usuario, nombre: item.n, rol, telefono: item.tel, password: clave }),
      });
      const arrKey = rol === 'cliente' ? 'clients' : 'mecanicos';
      const arr = (data[arrKey] || []).map((x) => (x.id === item.id ? { ...x, claveActual: clave } : x));
      guardar({ ...data, [arrKey]: arr });
      setPassPrompt(null); setPassPromptValor('');
      compartirAcceso({ nombreTaller: taller && taller.nombre, nombre: item.n, usuario: item.usuario, clave, rolTxt, tel: item.tel });
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar la contraseña: ' + e.message);
    }
  };

  const salir = async () => { await clearSession(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); };
  const [ajustesOpen, setAjustesOpen] = useState(false);

  const cur = (data.config && data.config.currency && data.config.currency.sym) || 'Bs.';
  const clients = data.clients || [];
  const vehicles = data.vehicles || [];
  const mecanicos = data.mecanicos || [];
  const V = vehicles.filter((v) => v.activo !== false && v.recepcion && !v.cerrada);

  const kpis = {
    espera: V.filter((v) => !v.status || v.status === 'espera' || v.status === 'reprog').length,
    rep: V.filter((v) => v.status === 'rep' || v.status === 'wait').length,
    term: V.filter((v) => v.status === 'term').length,
    entregados: (data.history || []).length,
    clientes: clients.filter((c) => c.activo !== false).length,
    mecanicos: mecanicos.filter((m) => m.activo !== false).length,
    ingresos: (data.history || []).reduce((a, h) => a + (+h.pagado || 0), 0),
  };

  const pickFoto = async (setter) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso', 'Se necesita acceso a las fotos.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.4, base64: true });
    if (!r.canceled && r.assets && r.assets[0]) setter('data:image/jpeg;base64,' + r.assets[0].base64);
  };
  const enviarFactura = async () => {
    if (!fCod || !fMonto) { Alert.alert('Faltan datos', 'Código y monto.'); return; }
    const nueva = { id: Date.now(), codigo: fCod, monto: +fMonto, fecha: new Date().toISOString().slice(0, 10), estado: 'pendiente', foto: fFoto, subidoPor: me.nombre || 'Administrador', taller: taller.nombre };
    await guardar({ ...data, facturas: [nueva, ...(data.facturas || [])] });
    setFCod(''); setFMonto(''); setFFoto(null); Alert.alert('Enviada', 'Factura enviada al Super Administrador.');
  };
  const marcarPagada = async (fid) => guardar({ ...data, facturas: (data.facturas || []).map((f) => (f.id === fid ? { ...f, estado: 'pagada' } : f)) });
  const cambiarEstadoOrden = (id, code) => {
    const vs = (data.vehicles || []).map((v) => {
      if (v.id !== id) return v;
      const nv = { ...v, status: code };
      if (code === 'rep' && (!nv.progress || nv.progress === 0)) nv.progress = 10;
      nv.advances = [...(v.advances || []), { t: (STATUS[code] || {}).l || code, m: 'Actualizado por ' + (me.nombre || 'Administrador'), type: code, ago: 'ahora' }];
      return nv;
    });
    guardar({ ...data, vehicles: vs });
  };

  const MODULOS = [
    { k: 'dash', ic: '📊', c: '#2563EB', t: 'Dashboard', s: 'Resumen del taller' },
    { k: 'recep', ic: '📋', c: '#0891b2', t: 'Recepción', s: 'Recibir vehículo' },
    { k: 'ordenes', ic: '🔧', c: '#D97706', t: 'Órdenes', s: V.length + ' activas' },
    { k: 'hist', ic: '✅', c: '#16A34A', t: 'Trabajos', s: (data.history || []).length + ' realizados' },
    { k: 'mant', ic: '🔔', c: '#ca8a04', t: 'Mantenimientos', s: vehicles.filter((v) => v.proximoMant).length + ' programados' },
    { k: 'sos', ic: '🚨', c: (data.sos || []).some((x) => x.estado === 'abierto') ? '#dc2626' : '#16A34A', t: 'Auxilio vial',
      s: (data.sos || []).filter((x) => x.estado === 'abierto').length ? '⚠ ' + (data.sos || []).filter((x) => x.estado === 'abierto').length + ' solicitando' : 'Sin solicitudes' },
    { k: 'citas', ic: '📅', c: (data.citas || []).some((x) => x.estado === 'solicitada') ? '#dc2626' : '#0891b2', t: 'Citas programadas',
      s: (data.citas || []).filter((x) => x.estado === 'solicitada').length ? '⚠ ' + (data.citas || []).filter((x) => x.estado === 'solicitada').length + ' por cotizar' : ((data.citas || []).length + ' citas') },
    { k: 'cotiza', ic: '🧾', c: '#0F6E56', t: 'Cotizaciones', s: (data.cotizaciones || []).filter((x) => x.estado !== 'inactiva').length + ' activas' },
    { k: 'cli', ic: '👥', c: '#7c3aed', t: 'Clientes', s: kpis.clientes + ' activos' },
    { k: 'veh', ic: '🚗', c: '#0f766e', t: 'Vehículos', s: vehicles.length + ' registrados' },
    { k: 'mec', ic: '🛠️', c: '#be185d', t: 'Técnicos', s: kpis.mecanicos + ' activos' },
    { k: 'fact', ic: '🧾', c: '#334155', t: 'Facturación', s: 'Pagos y facturas' },
    { k: 'usuarios', ic: '🔐', c: '#0f766e', t: 'Usuarios', s: 'Accesos' },
    { k: 'config', ic: '⚙️', c: '#64748b', t: 'Config', s: 'Parámetros' },
  ];
  if (esSuper) MODULOS.push({ k: 'talleres', ic: '🏭', c: '#16191d', t: 'Talleres', s: 'Administrar' });

  const TITULOS = { dash: 'Dashboard', recep: 'Recepción digital', ordenes: 'Órdenes de taller', hist: 'Trabajos realizados', mant: 'Próximos mantenimientos', sos: 'Auxilio vial', citas: 'Citas programadas', cotiza: 'Cotizaciones', cli: 'Clientes', veh: 'Vehículos', mec: 'Técnicos', fact: 'Facturación', usuarios: 'Usuarios y accesos', config: 'Configuración', talleres: 'Talleres' };

  // Barra superior con botón Regresar en todos los módulos
  const Top = () => (
    <View style={s.top}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        {tab !== 'inicio' && (
          <TouchableOpacity onPress={() => setTab('inicio')} style={s.back}><Text style={{ color: '#fff', fontWeight: '800' }}>←</Text></TouchableOpacity>
        )}
        {tab === 'inicio' && taller && taller.logo ? <Image source={{ uri: taller.logo }} style={s.logoImg} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={s.logo} numberOfLines={1}>{tab === 'inicio' ? (taller ? taller.nombre : 'TallerOS') : TITULOS[tab]}</Text>
          <Text style={s.role} numberOfLines={1}>{me.nombre} · {esSuper ? 'Super Admin' : 'Admin'}{tab !== 'inicio' && taller ? ' · ' + taller.nombre : ''}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BotonAjustes onPress={() => setAjustesOpen(true)} />
        <TouchableOpacity style={s.logout} onPress={salir}><Text style={{ color: '#fff', fontSize: 12 }}>Salir</Text></TouchableOpacity>
      </View>
      <AjustesModal visible={ajustesOpen} onClose={() => setAjustesOpen(false)} />
    </View>
  );

  return (
    <View style={s.wrap}>
      <Top />

      {(talleres.length > 1 || esSuper) && tab === 'inicio' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: 'center' }}>
          {talleres.map((t) => (
            <TouchableOpacity key={t.id} style={[s.chip, taller && taller.id === t.id && s.chipOn]} onPress={() => seleccionar(t)}>
              <Text style={[s.chipT, taller && taller.id === t.id && { color: '#16191d' }]}>🏭 {t.nombre}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!!error && (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text style={s.err}>{error}</Text>
          <TouchableOpacity style={[s.btn, { marginTop: 12, paddingHorizontal: 28 }]} onPress={() => (taller ? recargar() : setError(''))}>
            <Text style={s.btnT}>🔄 Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}
      {!taller && !error && <Text style={s.muted2}>Selecciona un taller para comenzar.</Text>}

      {/* ---------- INICIO: tarjetas por módulo ---------- */}
      {tab === 'inicio' && taller && <Inicio data={data} cur={cur} kpis={kpis} taller={taller} me={me} modulos={MODULOS} onNav={setTab} loading={loading} recargar={recargar} />}

      {tab === 'dash' && taller && <Dashboard data={data} cur={cur} kpis={kpis} V={V} loading={loading} recargar={recargar} />}
      {tab === 'recep' && taller && <Recepcion data={data} guardar={guardar} onListo={() => setTab('ordenes')} />}

      {tab === 'ordenes' && taller && (() => {
        const grupos = [
          { k: 'espera', t: 'En espera', filtro: (v) => !v.status || v.status === 'espera' || v.status === 'reprog' },
          { k: 'rep', t: 'Trabajando', filtro: (v) => v.status === 'rep' || v.status === 'wait' },
          { k: 'term', t: 'Terminado', filtro: (v) => v.status === 'term' },
        ];
        return (
          <>
          <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity style={[s.act, { flex: 1, backgroundColor: '#eef0f2', justifyContent: 'center' }]} onPress={() => setResumenOpen(true)}>
                <Text style={s.actT}>👁️ Ver Resumen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.act, { flex: 1, backgroundColor: '#e8f6ec', justifyContent: 'center' }]} onPress={() => taller && compartirResumenEsperaPDF(taller.id)}>
                <Text style={[s.actT, { color: '#0F6E56' }]}>💬 Compartir Resumen</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[s.input, { marginBottom: 14 }]} value={qOrd} onChangeText={setQOrd}
              placeholder="Buscar por N° de orden, vehículo, placa, cliente o técnico…" />
            {!V.length && !loading ? <Text style={s.muted}>Sin vehículos recibidos. Registra una recepción para generar la orden.</Text> : null}
            {grupos.map((g) => {
              const items = V.filter(g.filtro).filter((v) => coincide(v, qOrd));
              return (
                <View key={g.k} style={{ marginBottom: 18 }}>
                  <View style={s.secHead}>
                    <Text style={s.secHeadT}>{g.t}</Text>
                    <View style={s.secCount}><Text style={s.secCountT}>{items.length}</Text></View>
                  </View>
                  {items.length ? items.map((item) => {
                    const st = STATUS[item.status] || { l: item.status || '—', c: '#64748B' };
                    const cli = (data.clients || []).find((c) => c.n === item.owner);
                    const dias = item.ingreso ? Math.max(0, Math.floor((Date.now() - new Date(item.ingreso).getTime()) / 86400000)) : 0;
                    return (
                      <View key={item.id} style={s.ordCard}>
                        {item.numOrden ? <Text style={{ fontSize: 11, fontWeight: '800', color: '#0891b2', marginBottom: 2 }}>OS{String(item.numOrden).padStart(4, '0')}</Text> : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Text style={s.ordModel}>{item.model || 'Vehículo'}</Text>
                          <View style={s.ordPlate}><Text style={s.ordPlateT}>{item.plate || ''}</Text></View>
                        </View>
                        <Text style={s.ordWork}>{item.motivo || '—'}</Text>
                        <View style={[s.pill, { backgroundColor: (st.c || '#64748B') + '22', alignSelf: 'flex-start', marginTop: 6 }]}><Text style={[s.pillT, { color: st.c }]}>● {st.l}</Text></View>
                        <Text style={s.ordMeta}>👤 {item.owner || 'Cliente'}{cli && cli.tel ? '' : ''} · 🔧 {item.mech || 'sin técnico'}</Text>
                        <Text style={s.ordMeta}>📅 Ingresó {item.ingreso ? new Date(item.ingreso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} · {dias} día{dias !== 1 ? 's' : ''} en taller</Text>
                        {(item.status === 'rep' || item.status === 'wait') && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <View style={[s.progBar2, { flex: 1 }]}><View style={[s.progFill2, { width: (item.progress || 0) + '%' }]} /></View>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7480' }}>{item.progress || 0}%</Text>
                          </View>
                        )}
                        <View style={s.actions}>
                          <TouchableOpacity style={s.act} onPress={() => cambiarEstadoOrden(item.id, 'rep')}><Text style={s.actT}>Trabajando</Text></TouchableOpacity>
                          <TouchableOpacity style={s.act} onPress={() => cambiarEstadoOrden(item.id, 'wait')}><Text style={s.actT}>Esp. repuesto</Text></TouchableOpacity>
                          {item.status === 'term' ? (
                            <TouchableOpacity style={[s.act, s.actOk]} onPress={() => setModal({ tipo: 'pago', item })}><Text style={[s.actT, { color: '#fff' }]}>Cobrar / Culminar</Text></TouchableOpacity>
                          ) : (
                            <TouchableOpacity style={[s.act, { backgroundColor: '#16A34A', borderColor: '#16A34A' }]} onPress={() => cambiarEstadoOrden(item.id, 'term')}><Text style={[s.actT, { color: '#fff' }]}>Marcar listo</Text></TouchableOpacity>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 14, marginTop: 9 }}>
                          <TouchableOpacity onPress={() => setModal({ tipo: 'avances', item })}><Text style={[s.link, { color: '#F5B700' }]}>📸 Ver avances{(item.advances || []).filter((a) => a.foto).length ? ' (' + (item.advances || []).filter((a) => a.foto).length + ')' : ''} →</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => abrirEnNavegador(taller.id, item, 'acta')}><Text style={s.link}>Ver acta →</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => compartirActaPDF(taller.id, item)}><Text style={s.link}>Compartir acta (PDF) →</Text></TouchableOpacity>
                        </View>
                      </View>
                    );
                  }) : <Text style={s.mutedSmall}>Sin vehículos en este estado.</Text>}
                </View>
              );
            })}
          </ScrollView>
          <Modal visible={resumenOpen} transparent animationType="slide" onRequestClose={() => setResumenOpen(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 30, maxHeight: '80%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#16191d' }}>📋 Vehículos en espera</Text>
                  <TouchableOpacity onPress={() => setResumenOpen(false)}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
                </View>
                <ScrollView>
                  {V.filter((v) => !v.status || v.status === 'espera' || v.status === 'reprog').length ? V.filter((v) => !v.status || v.status === 'espera' || v.status === 'reprog').map((v) => {
                    const d = v.ingreso ? Math.max(0, Math.floor((Date.now() - new Date(v.ingreso).getTime()) / 86400000)) : 0;
                    return (
                      <View key={v.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f0f2f5' }}>
                        <Text style={{ fontWeight: '800', color: '#16191d' }}>{v.model} <Text style={{ color: '#6b7480', fontWeight: '600' }}>{v.plate}</Text></Text>
                        <Text style={s.muted}>{v.owner} · {v.motivo} · {d} día(s) en taller</Text>
                      </View>
                    );
                  }) : <Text style={s.muted}>No hay vehículos en espera.</Text>}
                </ScrollView>
              </View>
            </View>
          </Modal>
          </>
        );
      })()}

      {tab === 'hist' && taller && <Historial data={data} guardar={guardar} cur={cur} loading={loading} recargar={recargar} pickFoto={pickFoto} taller={taller} />}
      {tab === 'mant' && taller && <Mantenimientos data={data} guardar={guardar} cur={cur} loading={loading} recargar={recargar} taller={taller} />}
      {tab === 'sos' && taller && <AuxilioVial data={data} loading={loading} recargar={recargar} taller={taller} />}
      {tab === 'citas' && taller && <CitasProgramadas data={data} guardar={guardar} cur={cur} loading={loading} recargar={recargar} taller={taller} />}
      {tab === 'cotiza' && taller && <Cotizaciones data={data} guardar={guardar} cur={cur} loading={loading} recargar={recargar} taller={taller} onNav={setTab} />}

      {tab === 'cli' && taller && (
        <Listado titulo="＋ Nuevo cliente" onAdd={() => setModal({ tipo: 'cliente', item: null })} datos={clients} loading={loading} recargar={recargar} vacio="Sin clientes."
          render={(item) => (
            <TouchableOpacity style={s.card} onPress={() => {
              const opciones = [
                { text: 'Editar', onPress: () => setModal({ tipo: 'cliente', item }) },
              ];
              if (item.usuario) opciones.push({ text: '💬 Compartir acceso', onPress: () => asegurarClaveYCompartir(item, 'cliente', 'cliente') });
              opciones.push({ text: item.activo === false ? 'Activar' : 'Inactivar', style: item.activo === false ? 'default' : 'destructive', onPress: () => toggleActivo('cliente', item) });
              opciones.push({ text: 'Cancelar', style: 'cancel' });
              Alert.alert(item.n, item.usuario ? 'Acceso: ' + item.usuario : 'Sin acceso a la app', opciones);
            }}>
              <Text style={s.veh}>{item.n} {item.activo === false ? '· inactivo' : ''}</Text>
              <Text style={s.muted}>{item.tipoDoc || 'Cédula'} {item.doc || '—'} · {item.tel || ''}</Text>
              <Text style={s.muted}>{vehicles.filter((v) => v.owner === item.n).length} vehículo(s){item.usuario ? ' · acceso: ' + item.usuario : ' · sin acceso'}</Text>
            </TouchableOpacity>
          )} />
      )}

      {tab === 'veh' && taller && (
        <Listado titulo="＋ Nuevo vehículo" onAdd={() => setModal({ tipo: 'vehiculo', item: null })} datos={vehicles} loading={loading} recargar={recargar} vacio="Sin vehículos."
          render={(item) => (
            <TouchableOpacity style={s.card} onPress={() => setModal({ tipo: 'vehiculo', item })}>
              <Text style={s.veh}>{item.model}</Text>
              <Text style={s.muted}>{item.plate} · {item.owner}{item.recepcion && !item.cerrada ? ' · en órdenes' : ''}</Text>
            </TouchableOpacity>
          )} />
      )}

      {tab === 'mec' && taller && (
        <Listado titulo="＋ Nuevo técnico" onAdd={() => setModal({ tipo: 'mecanico', item: null })} datos={mecanicos} loading={loading} recargar={recargar} vacio="Sin técnicos."
          render={(item) => (
            <TouchableOpacity style={s.card} onPress={() => {
              const opciones = [
                { text: 'Editar', onPress: () => setModal({ tipo: 'mecanico', item }) },
              ];
              if (item.usuario) opciones.push({ text: '💬 Compartir acceso', onPress: () => asegurarClaveYCompartir(item, 'mecanico', 'técnico') });
              opciones.push({ text: item.activo === false ? 'Activar' : 'Inactivar', style: item.activo === false ? 'default' : 'destructive', onPress: () => toggleActivo('mecanico', item) });
              opciones.push({ text: 'Cancelar', style: 'cancel' });
              Alert.alert(item.n, item.usuario ? 'Acceso: ' + item.usuario : 'Sin acceso a la app', opciones);
            }}>
              <Text style={s.veh}>{item.n} {item.activo === false ? '· inactivo' : ''}</Text>
              <Text style={s.muted}>{item.sp || 'General'}{item.usuario ? ' · acceso: ' + item.usuario : ' · sin acceso'}</Text>
            </TouchableOpacity>
          )} />
      )}

      {tab === 'fact' && taller && (
        <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}>
          <View style={s.card}>
            <Text style={s.h}>Enviar pago / factura</Text>
            <Text style={s.label}>Código</Text><TextInput style={s.input} value={fCod} onChangeText={setFCod} placeholder="F-001" />
            <Text style={s.label}>Monto</Text><TextInput style={s.input} value={fMonto} onChangeText={setFMonto} keyboardType="numeric" placeholder="0.00" />
            <TouchableOpacity style={s.pick} onPress={() => pickFoto(setFFoto)}><Text style={s.pickT}>{fFoto ? 'Foto lista ✓' : 'Adjuntar foto'}</Text></TouchableOpacity>
            {fFoto ? <Image source={{ uri: fFoto }} style={s.prev} /> : null}
            <TouchableOpacity style={s.btn} onPress={enviarFactura}><Text style={s.btnT}>Enviar pago</Text></TouchableOpacity>
          </View>
          {(data.facturas || []).length ? (data.facturas || []).map((f) => (
            <View key={f.id} style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {f.foto ? <Image source={{ uri: f.foto }} style={s.fimg} /> : <View style={[s.fimg, { backgroundColor: '#eef0f2' }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.veh}>{f.codigo} · {cur} {(+f.monto).toLocaleString('es-VE')}</Text>
                  <Text style={s.muted}>{f.fecha} · {f.subidoPor || ''}</Text>
                </View>
                <Text style={[s.pill, f.estado === 'pagada' ? { backgroundColor: '#16A34A22', color: '#16A34A' } : { backgroundColor: '#D9770622', color: '#D97706' }]}>{f.estado}</Text>
              </View>
              {esSuper && f.estado !== 'pagada' && <TouchableOpacity style={[s.btn, { marginTop: 10 }]} onPress={() => marcarPagada(f.id)}><Text style={s.btnT}>Marcar pagada</Text></TouchableOpacity>}
            </View>
          )) : <Text style={s.muted}>Sin facturas.</Text>}
        </ScrollView>
      )}

      {tab === 'usuarios' && taller && <Usuarios esSuper={esSuper} taller={taller} />}
      {tab === 'config' && taller && <Config data={data} guardar={guardar} />}
      {tab === 'talleres' && esSuper && <Talleres />}

      {modal && modal.tipo === 'acta' && <Acta item={modal.item} close={() => setModal(null)} />}
      {modal && modal.tipo === 'avances' && <AvancesModal item={modal.item} close={() => setModal(null)} taller={taller} />}
      {modal && modal.tipo !== 'acta' && modal.tipo !== 'avances' && <FormModal modal={modal} close={() => setModal(null)} data={data} guardar={guardar} cur={cur} pickFoto={pickFoto} taller={taller} />}

      <Modal visible={!!passPrompt} transparent animationType="fade" onRequestClose={() => setPassPrompt(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#16191d', marginBottom: 6 }}>Compartir acceso</Text>
            <Text style={{ fontSize: 13, color: '#6b7480', marginBottom: 14 }}>
              Escribe la contraseña que quieres compartir con {passPrompt && passPrompt.item.n} (mínimo 6 caracteres). Se guardará como su contraseña de acceso.
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#d7dee6', borderRadius: 10, padding: 12, fontSize: 15 }}
              value={passPromptValor} onChangeText={setPassPromptValor} placeholder="Ej. 123456" placeholderTextColor="#9aa3ad" secureTextEntry={false} autoCapitalize="none" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#eef0f2', alignItems: 'center' }} onPress={() => { setPassPrompt(null); setPassPromptValor(''); }}>
                <Text style={{ fontWeight: '700', color: '#6b7480' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F5B700', alignItems: 'center' }} onPress={() => passPrompt && regenerarYCompartir(passPrompt.item, passPrompt.rol, passPrompt.rolTxt)}>
                <Text style={{ fontWeight: '700', color: '#16191d' }}>Guardar y compartir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* =================== LISTADO GENÉRICO =================== */
/* =================== BÚSQUEDA =================== */
const norm = (t) => (t == null ? '' : String(t)).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function coincide(x, q) {
  if (!q || !q.trim()) return true;
  const osTxt = x.numOrden ? 'OS' + String(x.numOrden).padStart(4, '0') : '';
  const campos = [x.n, x.model, x.plate, x.owner, x.mech, x.motivo, x.marca, x.modelo, x.color,
    x.anio, x.tipoVeh, x.doc, x.tel, x.mail, x.correo, x.usuario, x.nombre, osTxt, x.numOrden,
    x.recepcion && x.recepcion.trabajo, x.recepcion && x.recepcion.motivo];
  const t = norm(campos.filter(Boolean).join(' '));
  return norm(q).split(/\s+/).filter(Boolean).every((w) => t.includes(w));
}

function Listado({ titulo, onAdd, datos, loading, recargar, vacio, render }) {
  const [q, setQ] = useState('');
  const filtrados = (datos || []).filter((x) => coincide(x, q));
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 14, paddingBottom: 0, gap: 10 }}>
        <TextInput style={s.input} value={q} onChangeText={setQ} placeholder="Buscar por nombre, placa, teléfono…" />
        <TouchableOpacity style={s.addBtn} onPress={onAdd}><Text style={s.addT}>{titulo}</Text></TouchableOpacity>
      </View>
      <FlatList data={filtrados} keyExtractor={(x, i) => String(x.id || i)} contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}
        ListEmptyComponent={!loading && <Text style={s.muted}>{vacio}</Text>}
        renderItem={({ item }) => render(item)} />
    </View>
  );
}

/* =================== INICIO (tarjetas) =================== */
function Inicio({ data, cur, kpis, taller, me, modulos, onNav, loading, recargar }) {
  const now = new Date();
  const fechaTxt = now.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + now.toTimeString().slice(0, 5);
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}>
      <View style={s.dashHead}>
        <Text style={s.dashTaller}>{taller.nombre}</Text>
        <Text style={s.dashAdmin}>{me.nombre}</Text>
        <Text style={s.dashFecha}>{fechaTxt}</Text>
      </View>

      <View style={s.cardsGrid}>
        {modulos.map((c) => (
          <TouchableOpacity key={c.k} style={s.modCard} onPress={() => onNav(c.k)}>
            <View style={[s.modIcon, { backgroundColor: c.c + '18' }]}><Text style={{ fontSize: 22 }}>{c.ic}</Text></View>
            <Text style={s.modTitle}>{c.t}</Text>
            <Text style={s.modSub}>{c.s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

/* =================== DASHBOARD =================== */
function Dashboard({ data, cur, kpis, V, loading, recargar }) {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
  const [dashCal, setDashCal] = useState(null); // 'from' | 'to' | null
  const [verMonto, setVerMonto] = useState(true);
  const [vista, setVista] = useState('general'); // general | cotizaciones | honorarios | neto
  const fmtFecha = (iso) => { if (!iso) return 'elegir'; const p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; };
  // El calendario devuelve d/m/aaaa; lo paso a aaaa-mm-dd para el filtro
  const aISO = (txt) => { const p = String(txt).split('/'); return p.length === 3 ? p[2] + '-' + String(p[1]).padStart(2, '0') + '-' + String(p[0]).padStart(2, '0') : txt; };
  const hist = data.history || [];
  const pagos = []; hist.forEach((h) => { if (h.pagos && h.pagos.length) h.pagos.forEach((p) => pagos.push(p)); });
  const months = []; for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), lab: d.toLocaleDateString('es-VE', { month: 'short' }) }); }
  const inc = months.map((m) => pagos.filter((p) => (p.fechaISO || '').slice(0, 7) === m.k).reduce((a, p) => a + (+p.monto || 0), 0));
  const maxInc = Math.max(1, ...inc);
  const mesActual = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const factMes = pagos.filter((p) => (p.fechaISO || '').slice(0, 7) === mesActual).reduce((a, p) => a + (+p.monto || 0), 0);
  const trabMes = hist.filter((h) => (h.fechaISO || '').slice(0, 7) === mesActual).length;
  const finRange = hist.filter((h) => { const f = h.fechaISO || ''; return f && f >= from && f <= to; });
  const cnt = {}; V.forEach((v) => { const t = (v.recepcion && v.recepcion.trabajo) || v.motivo || 'Otro'; cnt[t] = (cnt[t] || 0) + 1; }); finRange.forEach((h) => { const t = h.trabajo || 'Otro'; cnt[t] = (cnt[t] || 0) + 1; });
  const cols = ['#16191d', '#2563EB', '#16A34A', '#D97706', '#7c3aed', '#64748B'];
  const serv = Object.entries(cnt).map(([l, v], i) => ({ l, v, c: cols[i % cols.length] }));
  const totServ = serv.reduce((a, x) => a + x.v, 0) || 1;
  const K = ({ label, value }) => (<View style={s.kpi}><Text style={s.kpiV}>{value}</Text><Text style={s.kpiL}>{label}</Text></View>);

  // Totales para el desplegable de ganancias (todos calculados sobre TODO el historial, de forma consistente)
  const totalCobrado = hist.reduce((a, h) => a + (+h.pagado || 0), 0);
  const totalHonorarios = hist.reduce((a, h) => a + (h.honorario ? (+h.honorario.monto || 0) : 0), 0);
  const totalNeto = totalCobrado - totalHonorarios;
  const cotActivas = [
    ...(data.cotizaciones || []).filter((c) => c.estado !== 'inactiva' && c.estado !== 'aprobada'),
    ...(data.citas || []).filter((c) => c.estado === 'cotizada').map((c) => ({ monto: c.monto, cliente: c.cliente, items: c.repuestos })),
  ];
  const totalCotiza = cotActivas.reduce((a, c) => a + (+c.monto || 0), 0);
  const VISTAS = {
    general: { l: 'Ganancia general', color: '#0F6E56', valor: totalCobrado, sub: 'Total cobrado a clientes' },
    cotizaciones: { l: 'Cotización', color: '#0891b2', valor: totalCotiza, sub: cotActivas.length + ' cotización(es) por realizar' },
    honorarios: { l: 'Pagos', color: '#D97706', valor: totalHonorarios, sub: 'Pagado a los técnicos' },
    neto: { l: 'Ganancia sin honorarios', color: totalNeto < 0 ? '#dc2626' : '#16191d', valor: totalNeto, sub: totalNeto < 0 ? 'Se pagó más en honorarios de lo cobrado' : 'Lo que queda tras pagar técnicos' },
  };
  const vActual = VISTAS[vista];
  const opcionesVista = Object.values(VISTAS).map((v) => v.l);
  const claveDeLabel = (lab) => Object.keys(VISTAS).find((k) => VISTAS[k].l === lab) || 'general';

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}>
      <Dropdown label="Ver ganancias" value={vActual.l} options={opcionesVista} onChange={(lab) => setVista(claveDeLabel(lab))} />
      <View style={[s.factMes, { backgroundColor: vActual.color, marginTop: 4, marginBottom: 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.factMesL}>{vActual.l}</Text>
          <Text style={s.factMesV}>{verMonto ? cur + ' ' + (vActual.valor || 0).toLocaleString('es-VE') : '••••••'}</Text>
          <Text style={{ color: 'rgba(255,255,255,.8)', fontSize: 11.5, marginTop: 4 }}>{vActual.sub}</Text>
        </View>
        <TouchableOpacity onPress={() => setVerMonto(!verMonto)} style={s.ojo}><Text style={{ fontSize: 20 }}>{verMonto ? '🙈' : '👁️'}</Text></TouchableOpacity>
      </View>

      <View style={s.kpisWrap}>
        <K label="Trabajos del mes" value={trabMes} /><K label="Órdenes abiertas" value={V.length} /><K label="Órdenes finalizadas" value={kpis.entregados} />
        <K label="En reparación" value={kpis.rep} /><K label="Terminados" value={kpis.term} /><K label="En espera" value={kpis.espera} />
        <K label="Clientes" value={kpis.clientes} /><K label="Técnicos" value={kpis.mecanicos} /><K label="Facturado mes" value={cur + ' ' + (factMes >= 1000 ? (factMes / 1000).toFixed(1) + 'k' : factMes)} />
      </View>
      <View style={s.income}><Text style={s.incomeL}>Ingresos acumulados</Text><Text style={s.incomeV}>{cur} {kpis.ingresos.toLocaleString('es-VE')}</Text></View>
      <View style={s.card}>
        <Text style={s.h}>Ingresos por mes</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 8, marginTop: 10 }}>
          {months.map((m, i) => (
            <View key={m.k} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: '#6b7480', marginBottom: 3 }}>{inc[i] ? (inc[i] >= 1000 ? (inc[i] / 1000).toFixed(1) + 'k' : inc[i]) : '0'}</Text>
              <View style={{ width: '70%', height: Math.max(3, (inc[i] / maxInc) * 90), backgroundColor: inc[i] === maxInc && maxInc > 1 ? '#F5B700' : '#16191d', borderRadius: 5 }} />
              <Text style={{ fontSize: 10, color: '#6b7480', marginTop: 4 }}>{m.lab}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.h}>Servicios más realizados</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <TouchableOpacity style={[s.dateInp, { justifyContent: 'center' }]} onPress={() => setDashCal('from')}>
            <Text style={{ fontSize: 12 }}>📅 {fmtFecha(from)}</Text>
          </TouchableOpacity>
          <Text style={{ color: '#6b7480', fontSize: 11 }}>a</Text>
          <TouchableOpacity style={[s.dateInp, { justifyContent: 'center' }]} onPress={() => setDashCal('to')}>
            <Text style={{ fontSize: 12 }}>📅 {fmtFecha(to)}</Text>
          </TouchableOpacity>
        </View>
        <Calendario visible={dashCal !== null} valor={fmtFecha(dashCal === 'from' ? from : to)}
          titulo={dashCal === 'from' ? 'Desde' : 'Hasta'}
          onSelect={(txt) => { const iso = aISO(txt); if (dashCal === 'from') setFrom(iso); else setTo(iso); }}
          onClose={() => setDashCal(null)} />
        <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 12, backgroundColor: '#f0f2f5' }}>
          {serv.map((x) => (<View key={x.l} style={{ width: (x.v / totServ * 100) + '%', backgroundColor: x.c }} />))}
        </View>
        {serv.length ? serv.map((x) => (
          <View key={x.l} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: x.c, marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 13 }}>{x.l}</Text><Text style={{ fontSize: 13, fontWeight: '700' }}>{Math.round(x.v / totServ * 100)}%</Text>
          </View>
        )) : <Text style={s.muted}>Sin datos en el rango.</Text>}
      </View>
    </ScrollView>
  );
}

/* =================== RECEPCIÓN (todo en listas desplegables, como la web) =================== */
function Recepcion({ data, guardar, onListo }) {
  const cur = (data.config && data.config.currency && data.config.currency.sym) || 'Bs.';
  const cfg = data.config || {};
  const vehicles = data.vehicles || [];
  const clients = (data.clients || []).filter((c) => c.activo !== false);
  const mecanicos = (data.mecanicos || []).filter((m) => m.activo !== false);

  const [motivos, setMotivos] = useState((cfg.motivos && cfg.motivos.length) ? cfg.motivos : MOTIVOS_BASE);
  const [trabajos, setTrabajos] = useState((cfg.trabajos && cfg.trabajos.length) ? cfg.trabajos : TRABAJOS_BASE);

  const [tipos, setTipos] = useState((cfg.tiposDano && cfg.tiposDano.length) ? cfg.tiposDano : TIPOS);
  const [docsVeh, setDocsVeh] = useState(DOCS_VEH);
  const [accesorios, setAccesorios] = useState((cfg.accesorios && cfg.accesorios.length) ? cfg.accesorios : ACCS);
  const [cliente, setCliente] = useState('');
  const [vehId, setVehId] = useState(null);
  const [tipoIngreso, setTipoIngreso] = useState('nuevo'); // 'nuevo' | 'cotizacion'
  const [busquedaCot, setBusquedaCot] = useState('');
  const [cotizacionId, setCotizacionId] = useState(null);
  const [cotizacionNum, setCotizacionNum] = useState(null);
  const [montoCotizacion, setMontoCotizacion] = useState(0);
  const [cotizacionItems, setCotizacionItems] = useState([]);
  const [mech, setMech] = useState('');
  const [tipoVeh, setTipoVeh] = useState('Automóvil');
  const [color, setColor] = useState('');
  const [lado, setLado] = useState('sup');
  const [tipo, setTipo] = useState((cfg.tiposDano && cfg.tiposDano[0]) || 'Rayón');
  const [sev, setSev] = useState('leve');
  const [dmg, setDmg] = useState({ sup: [], front: [], izq: [], der: [], post: [] });
  const [carSize, setCarSize] = useState({ w: 1, h: 1 });
  const scrollRef = React.useRef(null);
  const [motivo, setMotivo] = useState('');
  const [trabajo, setTrabajo] = useState('');
  const [prio, setPrio] = useState('Media');
  const [comb, setComb] = useState('½');
  const [km, setKm] = useState('');
  const [acc, setAcc] = useState([]);
  const [docs, setDocs] = useState([]);
  const [obs, setObs] = useState('');
  const [firmaCli, setFirmaCli] = useState(null);
  const [firmaRec, setFirmaRec] = useState(null);
  const [padAbierto, setPadAbierto] = useState(null); // 'cli' | 'rec'
  const [agAcc, setAgAcc] = useState(false);
  const [nvAcc, setNvAcc] = useState('');

  const cvs = vehicles.filter((v) => v.owner === cliente && v.activo !== false);
  const vSel = vehicles.find((v) => v.id === vehId);
  const cSel = clients.find((c) => c.n === cliente);
  const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cotizacionesDisponibles = (data.cotizaciones || []).filter((c) => c.estado === 'aprobada' && !c.usadaRecepcion);
  const cotizacionesFiltradas = busquedaCot.trim()
    ? cotizacionesDisponibles.filter((c) => norm((c.num ? 'P-' + String(c.num).padStart(6, '0') : '') + ' ' + (c.cliente || '') + ' ' + (c.placa || '')).includes(norm(busquedaCot)))
    : cotizacionesDisponibles;
  const elegirCotizacion = (c) => {
    setCotizacionId(c.id); setCotizacionNum(c.num); setMontoCotizacion(c.monto || 0); setCotizacionItems(c.items || []);
    setCliente(c.cliente);
    const vehsCli = vehicles.filter((v) => v.owner === c.cliente && v.activo !== false);
    if (!vehsCli.length) { Alert.alert('Sin vehículo', c.cliente + ' no tiene un vehículo registrado — regístralo primero.'); setVehId(null); return; }
    const porPlaca = c.placa ? vehsCli.find((v) => v.plate === c.placa) : null;
    const elegido = porPlaca || vehsCli[0];
    setVehId(elegido.id);
    if (elegido.color) setColor(elegido.color);
    if (elegido.tipoVeh) setTipoVeh(elegido.tipoVeh);
    if (c.placa && !porPlaca) Alert.alert('Verifica el vehículo', 'La cotización era para la placa ' + c.placa + ', pero no está entre los vehículos de ' + c.cliente + '. Se seleccionó otro por defecto.');
  };
  const quitarCotizacion = () => { setCotizacionId(null); setCotizacionNum(null); setMontoCotizacion(0); setCotizacionItems([]); };
  const togArr = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const borrarPin = (i) => {
    Alert.alert('Quitar daño', '¿Quitar el daño #' + (i + 1) + ' de esta vista?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => setDmg((d) => ({ ...d, [lado]: d[lado].filter((_, k) => k !== i) })) },
    ]);
  };
  const [pinPend, setPinPend] = useState(null);   // punto tocado, esperando tipo+severidad
  const [modalDano, setModalDano] = useState(false); // controla la aparición del modal (tras ver el punto)
  const [tipoNuevo, setTipoNuevo] = useState('');  // texto para un daño que no está en la lista
  const marcar = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    let xp = Math.max(0, Math.min(100, (locationX / (carSize.w || 1)) * 100));
    const yp = Math.max(0, Math.min(100, (locationY / (carSize.h || 1)) * 100));
    // La vista derecha se dibuja volteada (scaleX:-1); invertimos la X para que el pin caiga donde tocaste
    if (lado === 'der') xp = 100 - xp;
    setPinPend({ x: xp, y: yp, lado, tipoSel: tipos[0] || 'Rayón', sevSel: 'leve' });
    setTipoNuevo('');
    // Primero se ve el punto marcado; luego (breve pausa) aparece el detalle
    setModalDano(false);
    setTimeout(() => setModalDano(true), 280);
  };
  const confirmarPin = () => {
    if (!pinPend) return;
    let t = pinPend.tipoSel;
    // Si escribió un daño nuevo, se agrega a la lista y se guarda
    if (tipoNuevo.trim()) {
      t = tipoNuevo.trim();
      if (!tipos.includes(t)) setTipos([...tipos, t]);
    }
    setDmg((d) => ({ ...d, [pinPend.lado]: [...d[pinPend.lado], { x: pinPend.x, y: pinPend.y, tipo: t, sev: pinPend.sevSel }] }));
    setPinPend(null); setModalDano(false); setTipoNuevo('');
  };
  const cancelarPin = () => { setPinPend(null); setModalDano(false); setTipoNuevo(''); };
  const total = Object.values(dmg).reduce((a, arr) => a + arr.length, 0);

  const confirmar = () => {
    if (!cliente) { Alert.alert('Falta', 'Selecciona un cliente.'); return; }
    if (!vehId) { Alert.alert('Falta', 'Selecciona un vehículo.'); return; }
    if (!trabajo.trim()) { Alert.alert('Falta', 'Indica el trabajo a realizar.'); return; }
    let n = 0; const dmgs = []; const ladosCon = [];
    LADOS.forEach(([k]) => { (dmg[k] || []).forEach((dd) => { n++; dmgs.push({ n, tipo: dd.tipo, sev: dd.sev, lado: LADO_NOMBRE[k], x: dd.x, y: dd.y }); }); if ((dmg[k] || []).length) ladosCon.push(LADO_NOMBRE[k]); });
    const now = new Date();
    // Número de orden de servicio correlativo (va aumentando)
    const nOrden = ((data.config && data.config.ultimoNumOrden) || 0) + 1;
    const vs = vehicles.map((v) => v.id !== vehId ? v : {
      ...v, status: 'espera', progress: 0, cerrada: false, cost: cotizacionId ? (+montoCotizacion || 0) : 0, pending: null, entregado: false, motivo: trabajo, mech: mech || v.mech || null,
      color: color || v.color, tipoVeh, numOrden: nOrden,
      ingreso: now.toISOString().slice(0, 10), recepDamages: dmgs, recepLados: ladosCon,
      recepcion: { fecha: now.toLocaleDateString('es-VE'), hora: now.toTimeString().slice(0, 5), tipoVeh, color, motivo, trabajo, prioridad: prio, combustible: comb, km: km || '—', accesorios: acc, documentos: docs, obs, via: 'App', firmaCli, firmaRec, numOrden: nOrden, cotizacionId: cotizacionId || null, cotizacionNum: cotizacionNum || null, montoCotizacion: cotizacionId ? (+montoCotizacion || 0) : 0, cotizacionItems: cotizacionId ? cotizacionItems : [] },
      advances: [{ t: 'Vehículo recibido — recepción digital (app)', m: (motivo || trabajo) + ' · ' + dmgs.length + ' daño(s)' + (cotizacionId ? ' · cobre por cotización P-' + String(cotizacionNum || 0).padStart(6, '0') : ''), type: 'recep', ago: 'ahora' }],
    });
    const cotsActualizadas = cotizacionId
      ? (data.cotizaciones || []).map((c) => (c.id === cotizacionId ? { ...c, usadaRecepcion: true, vehIdRecepcion: vehId } : c))
      : data.cotizaciones;
    // guarda también los catálogos nuevos (motivos/trabajos/marcas) para que la web los vea
    guardar({ ...data, vehicles: vs, cotizaciones: cotsActualizadas, config: { ...cfg, motivos, trabajos, tiposDano: tipos, accesorios, ultimoNumOrden: nOrden } });
    setDmg({ sup: [], front: [], izq: [], der: [], post: [] }); setMotivo(''); setTrabajo(''); setAcc([]); setDocs([]); setObs('');
    setFirmaCli(null); setFirmaRec(null); setKm(''); setMech(''); setColor(''); setTipoVeh('Automóvil');
    setTipoIngreso('nuevo'); quitarCotizacion(); setBusquedaCot('');
    Alert.alert('Recepción registrada ✓', 'Se generó la Orden de Trabajo. El vehículo ya está en el módulo Órdenes.', [
      { text: 'Ver órdenes', onPress: onListo },
      { text: 'Registrar otra', onPress: () => { setCliente(''); setVehId(null); setPrio('Media'); setComb('½'); setDocs([]); if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: true }); } },
    ]);
  };

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 14 }}>
      <Text style={s.label}>Tipo de recepción</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <TouchableOpacity style={[s.pillBtn, { flex: 1, alignItems: 'center' }, tipoIngreso !== 'cotizacion' && s.pillBtnOn]} onPress={() => setTipoIngreso('nuevo')}>
          <Text style={[s.pillBtnT, tipoIngreso !== 'cotizacion' && { color: '#16191d' }]}>Nueva Recepción</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.pillBtn, { flex: 1, alignItems: 'center' }, tipoIngreso === 'cotizacion' && s.pillBtnOn]} onPress={() => setTipoIngreso('cotizacion')}>
          <Text style={[s.pillBtnT, tipoIngreso === 'cotizacion' && { color: '#16191d' }]}>Recepción por Cotización</Text>
        </TouchableOpacity>
      </View>

      {tipoIngreso === 'cotizacion' ? (
        cotizacionId ? (
          <View style={{ backgroundColor: '#e8f6ec', borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontWeight: '800', color: '#0F6E56' }}>Cobre por cotización P-{String(cotizacionNum || 0).padStart(6, '0')}</Text>
              <Text style={s.muted}>Monto: {cur} {(+montoCotizacion || 0).toLocaleString('es-VE')}</Text>
            </View>
            <TouchableOpacity onPress={quitarCotizacion}><Text style={{ color: '#dc2626', fontWeight: '700' }}>Quitar</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginBottom: 14 }}>
            <Text style={s.label}>Buscar cotización aprobada</Text>
            <TextInput style={s.input} value={busquedaCot} onChangeText={setBusquedaCot} placeholder="N° de cotización, cliente o placa…" placeholderTextColor="#9aa3ad" />
            <Dropdown
              label="Cotización aprobada" value=""
              options={cotizacionesFiltradas.map((c) => 'P-' + String(c.num).padStart(6, '0') + ' — ' + c.cliente + (c.vehiculo ? ' — ' + c.vehiculo : '') + ' — ' + cur + ' ' + (+c.monto || 0).toLocaleString('es-VE'))}
              onChange={(label) => { const num = label.match(/^P-(\d+)/); const c = cotizacionesFiltradas.find((x) => num && x.num === +num[1]); if (c) elegirCotizacion(c); }}
              placeholder={cotizacionesFiltradas.length ? 'Selecciona la cotización' : 'Ninguna coincide con la búsqueda'}
              textoVacio="No hay cotizaciones aprobadas disponibles." />
          </View>
        )
      ) : null}

      <Dropdown label="Cliente" obligatorio value={cliente} placeholder="Selecciona el cliente"
        options={clients.map((c) => c.n)}
        meta={Object.fromEntries(clients.map((c) => [c.n, [c.tipoDoc, c.doc, c.tel, c.correo].filter(Boolean).join(' · ')]))}
        onChange={(v) => { setCliente(v); const nc = vehicles.filter((x) => x.owner === v && x.activo !== false); const pv = nc[0]; setVehId(pv ? pv.id : null); if (pv && pv.color) setColor(pv.color); if (pv && pv.tipoVeh) setTipoVeh(pv.tipoVeh); }}
        textoVacio="Aún no hay clientes. Regístralos en el módulo Clientes." />
      {cSel ? <Text style={s.muted}>{cSel.tipoDoc || ''} {cSel.doc || ''} · {cSel.tel || ''} · {cSel.correo || ''}</Text> : null}

      <Dropdown label="Vehículo del cliente" obligatorio value={vSel ? (vSel.model + ' · ' + vSel.plate) : ''}
        placeholder={cliente ? 'Selecciona el vehículo' : 'Primero elige el cliente'}
        deshabilitado={!cliente}
        options={cvs.map((v) => v.model + ' · ' + v.plate)}
        meta={Object.fromEntries(cvs.map((v) => [v.model + ' · ' + v.plate, [v.color, v.anio, v.tipoVeh].filter(Boolean).join(' · ')]))}
        onChange={(txt) => { const v = cvs.find((x) => (x.model + ' · ' + x.plate) === txt); setVehId(v ? v.id : null); if (v && v.color) setColor(v.color); if (v && v.tipoVeh) setTipoVeh(v.tipoVeh); }}
        textoVacio="Este cliente no tiene vehículos. Regístralos en el módulo Vehículos." />

      <Dropdown label="Técnico responsable" value={mech} placeholder="Selecciona el técnico"
        options={mecanicos.map((m) => m.n)}
        meta={Object.fromEntries(mecanicos.map((m) => [m.n, [m.esp, m.tel, m.doc].filter(Boolean).join(' · ')]))}
        onChange={setMech}
        textoVacio="No hay técnicos activos. Regístralos en el módulo Técnicos." />

      <Dropdown label="Motivo de ingreso" value={motivo} placeholder="Selecciona el motivo"
        options={motivos} onChange={setMotivo} onAdd={(t) => setMotivos([...motivos, t])} />

      <Dropdown label="Trabajo a realizar" obligatorio value={trabajo} placeholder="Selecciona el trabajo"
        options={trabajos} onChange={setTrabajo} onAdd={(t) => setTrabajos([...trabajos, t])} />

      <Dropdown label="Prioridad" value={prio} options={PRIOS} onChange={setPrio} />

      <Text style={[s.label, { marginTop: 14 }]}>Vista del vehículo a inspeccionar</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {LADOS.map(([k, l]) => (
          <TouchableOpacity key={k} style={[s.pillBtn, lado === k && s.pillBtnOn]} onPress={() => setLado(k)}>
            <Text style={[s.pillBtnT, lado === k && { color: '#16191d' }]}>{l}{dmg[k].length ? ' (' + dmg[k].length + ')' : ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={{ fontSize: 11, color: '#6b7480', marginTop: 8 }}>Toca sobre el vehículo para marcar un daño en la vista seleccionada.</Text>
      <View style={s.diagram}>
        <View style={s.diagramHead}><Text style={s.diagramHeadT}>{(LADO_NOMBRE[lado] || '').toUpperCase()}</Text></View>
        <Pressable onPress={marcar} onLayout={(e) => setCarSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ width: 300, height: 300 / (CAR_RATIO[lado] || 1.5), position: 'relative' }}>
          <View style={[{ width: 300, height: 300 / (CAR_RATIO[lado] || 1.5) }, lado === 'der' && { transform: [{ scaleX: -1 }] }]} pointerEvents="none">
            <CarroSVG lado={lado} width={300} height={300 / (CAR_RATIO[lado] || 1.5)} />
          </View>
          {(dmg[lado] || []).map((dd, i) => (
            <TouchableOpacity key={i} style={[s.pin, { left: (lado === 'der' ? 100 - dd.x : dd.x) + '%', top: dd.y + '%', marginLeft: -11, marginTop: -11, backgroundColor: dd.sev === 'grave' ? '#dc2626' : dd.sev === 'mod' ? '#D97706' : '#2563EB' }]}
              onPress={() => borrarPin(i)}><Text style={s.pinT}>{i + 1}</Text></TouchableOpacity>
          ))}
          {pinPend && pinPend.lado === lado ? (
            <View style={[s.pin, { left: (lado === 'der' ? 100 - pinPend.x : pinPend.x) + '%', top: pinPend.y + '%', marginLeft: -11, marginTop: -11, backgroundColor: '#16191d', borderWidth: 2, borderColor: '#fff' }]} pointerEvents="none">
              <Text style={s.pinT}>?</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Modal visible={modalDano} transparent animationType="fade" onRequestClose={cancelarPin}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#16191d', marginBottom: 2 }}>Detalle del daño</Text>
            <Text style={{ fontSize: 12.5, color: '#6b7480', marginBottom: 14 }}>Elige el tipo y la severidad, o escribe un daño nuevo.</Text>

            <Text style={s.label}>Tipo de daño</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
              {tipos.map((t) => (
                <TouchableOpacity key={t} style={[s.pillBtn, pinPend && pinPend.tipoSel === t && !tipoNuevo && s.pillBtnOn]}
                  onPress={() => { setPinPend({ ...pinPend, tipoSel: t }); setTipoNuevo(''); }}>
                  <Text style={[s.pillBtnT, pinPend && pinPend.tipoSel === t && !tipoNuevo && { color: '#16191d' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={s.input} value={tipoNuevo} onChangeText={setTipoNuevo}
              placeholder="✏️ ¿Otro? Escríbelo aquí (ej. Mancha en pintura)" placeholderTextColor="#9aa3ad" />

            <Text style={[s.label, { marginTop: 12 }]}>Severidad</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['leve', 'Leve', '#2563EB'], ['mod', 'Moderado', '#D97706'], ['grave', 'Grave', '#dc2626']].map(([k, l, col]) => (
                <TouchableOpacity key={k} style={[s.pillBtn, { flex: 1, alignItems: 'center' }, pinPend && pinPend.sevSel === k && { backgroundColor: col, borderColor: col }]}
                  onPress={() => setPinPend({ ...pinPend, sevSel: k })}>
                  <Text style={[s.pillBtnT, pinPend && pinPend.sevSel === k && { color: '#fff' }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[s.btn, { marginTop: 18 }]} onPress={confirmarPin}>
              <Text style={s.btnT}>Marcar daño</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelarPin}>
              <Text style={{ textAlign: 'center', color: '#6b7480', marginTop: 12, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {(dmg[lado] || []).length ? (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 11, color: '#6b7480', marginBottom: 6 }}>Toca un número en el carro (o en la lista) para quitar ese daño:</Text>
          {(dmg[lado] || []).map((dd, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderColor: '#eef0f2' }}>
              <View style={[s.pin, { position: 'relative', left: 0, top: 0, margin: 0, backgroundColor: dd.sev === 'grave' ? '#dc2626' : dd.sev === 'mod' ? '#D97706' : '#2563EB' }]}><Text style={s.pinT}>{i + 1}</Text></View>
              <Text style={{ flex: 1, fontSize: 12.5, color: '#3a4048' }}>{dd.tipo} · {dd.sev === 'grave' ? 'Grave' : dd.sev === 'mod' ? 'Moderado' : 'Leve'}</Text>
              <TouchableOpacity onPress={() => borrarPin(i)} style={{ backgroundColor: '#fdecec', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 12 }}>Quitar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ backgroundColor: '#eef4ff', borderRadius: 10, padding: 10, marginBottom: 4 }}>
        <Text style={{ fontSize: 12.5, color: '#2563EB', fontWeight: '700' }}>👆 Toca el vehículo donde está el daño</Text>
        <Text style={{ fontSize: 11.5, color: '#6b7480', marginTop: 2 }}>Al tocar, eliges el tipo de daño y la severidad.</Text>
      </View>

      <Dropdown label="Combustible" value={comb} options={FUEL} onChange={setComb} />
      <Text style={s.label}>Kilometraje</Text><TextInput style={s.input} value={km} onChangeText={setKm} keyboardType="numeric" placeholder="Ej. 85000" />

      <Text style={s.label}>Accesorios dentro del vehículo</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {accesorios.map((a) => (<TouchableOpacity key={a} style={[s.pillBtn, acc.includes(a) && s.pillBtnOn]} onPress={() => togArr(acc, setAcc, a)}><Text style={[s.pillBtnT, acc.includes(a) && { color: '#16191d' }]}>{a}</Text></TouchableOpacity>))}
        <TouchableOpacity style={[s.pillBtn, { borderStyle: 'dashed', borderColor: '#2563EB' }]} onPress={() => { Alert.prompt ? Alert.prompt('Nuevo accesorio', 'Nombre del accesorio', (t) => { if (t && t.trim()) { setAccesorios([...accesorios, t.trim()]); setAcc([...acc, t.trim()]); } }) : setAgAcc(true); }}>
          <Text style={[s.pillBtnT, { color: '#2563EB' }]}>＋ Agregar</Text>
        </TouchableOpacity>
      </View>
      {agAcc && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TextInput style={[s.input, { flex: 1 }]} value={nvAcc} onChangeText={setNvAcc} placeholder="Nuevo accesorio" autoFocus />
          <TouchableOpacity style={[s.act, { flex: 0, paddingHorizontal: 16, justifyContent: 'center' }]} onPress={() => { const t = (nvAcc || '').trim(); if (t) { setAccesorios([...accesorios, t]); setAcc([...acc, t]); } setNvAcc(''); setAgAcc(false); }}><Text style={s.actT}>Agregar</Text></TouchableOpacity>
        </View>
      )}
      <Text style={s.label}>Documentos entregados</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {docsVeh.map((dd) => (<TouchableOpacity key={dd} style={[s.pillBtn, docs.includes(dd) && s.pillBtnOn]} onPress={() => togArr(docs, setDocs, dd)}><Text style={[s.pillBtnT, docs.includes(dd) && { color: '#16191d' }]}>{dd}</Text></TouchableOpacity>))}
        <TouchableOpacity style={[s.pillBtn, { borderStyle: 'dashed', borderColor: '#2563EB' }]} onPress={() => { Alert.prompt ? Alert.prompt('Nuevo documento', 'Nombre del documento', (t) => { if (t && t.trim()) { setDocsVeh([...docsVeh, t.trim()]); setDocs([...docs, t.trim()]); } }) : (() => { const extra = 'Documento ' + (docsVeh.length + 1); setDocsVeh([...docsVeh, extra]); })(); }}>
          <Text style={[s.pillBtnT, { color: '#2563EB' }]}>＋ Agregar</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.label}>Observaciones</Text>
      <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} value={obs} onChangeText={setObs} multiline />

      <Text style={s.label}>Firmas</Text>
      <View style={{ gap: 10 }}>
        <View>
          <TouchableOpacity style={[s.act, firmaCli && s.actOk]} onPress={() => setPadAbierto('cli')}>
            <Text style={[s.actT, firmaCli && { color: '#fff' }]}>{firmaCli ? 'Firma del cliente ✓ (tocar para rehacer)' : '✍️ Firma del cliente'}</Text>
          </TouchableOpacity>
          {firmaCli ? <View style={{ marginTop: 8 }}><FirmaVista trazos={firmaCli} /></View> : null}
        </View>
        <View>
          <TouchableOpacity style={[s.act, firmaRec && s.actOk]} onPress={() => setPadAbierto('rec')}>
            <Text style={[s.actT, firmaRec && { color: '#fff' }]}>{firmaRec ? 'Firma del recepcionista ✓' : '✍️ Firma del recepcionista'}</Text>
          </TouchableOpacity>
          {firmaRec ? <View style={{ marginTop: 8 }}><FirmaVista trazos={firmaRec} /></View> : null}
        </View>
      </View>

      <Text style={{ fontSize: 12, color: '#6b7480', marginTop: 10 }}>{total} daño(s) marcado(s) en total.</Text>
      <TouchableOpacity style={s.btn} onPress={confirmar}><Text style={s.btnT}>Registrar recepción y generar orden</Text></TouchableOpacity>

      <FirmaPad
        visible={!!padAbierto}
        titulo={padAbierto === 'cli' ? 'Firma del cliente' : 'Firma del recepcionista'}
        onClose={() => setPadAbierto(null)}
        onGuardar={(trazos) => { if (padAbierto === 'cli') setFirmaCli(trazos); else setFirmaRec(trazos); setPadAbierto(null); }}
      />
    </ScrollView>
  );
}

/* =================== HISTORIAL =================== */
/* =================== AUXILIO VIAL =================== */
function AuxilioVial({ data, loading, recargar, taller }) {
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const todas = [...(data.sos || [])].sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
  const lista = todas.filter((x) => coincide({ n: x.cliente, plate: x.placa, model: x.vehiculo, tel: x.telefono, motivo: x.descripcion }, q));
  const abiertas = todas.filter((x) => x.estado === 'abierto');
  const hayAlerta = abiertas.length > 0;

  const cambiarEstado = async (x, estado) => {
    try {
      await api('/api/state/sos-estado?taller=' + taller.id, { method: 'POST', body: JSON.stringify({ id: x.id, estado }) });
      setSel(null); recargar();
    } catch (e) { Alert.alert('Error', (e && e.message) || 'No se pudo actualizar.'); }
  };
  // Ofrece las apps de navegación disponibles
  const abrirMapa = (x) => {
    const tieneCoords = x.lat && x.lng;
    const q = tieneCoords ? x.lat + ',' + x.lng : encodeURIComponent(x.ubicacionTexto || '');
    const opciones = [];
    if (tieneCoords) {
      opciones.push({ text: '🗺️  Google Maps', onPress: () => ir('https://www.google.com/maps/dir/?api=1&destination=' + q, 'Google Maps') });
      opciones.push({ text: '🚗  Waze', onPress: () => ir('https://waze.com/ul?ll=' + x.lat + ',' + x.lng + '&navigate=yes', 'Waze') });
      opciones.push({ text: '📍  Otra app de mapas', onPress: () => ir('geo:' + x.lat + ',' + x.lng + '?q=' + q, 'mapas') });
    } else {
      opciones.push({ text: '🗺️  Google Maps', onPress: () => ir('https://www.google.com/maps/search/?api=1&query=' + q, 'Google Maps') });
      opciones.push({ text: '🚗  Waze', onPress: () => ir('https://waze.com/ul?q=' + q + '&navigate=yes', 'Waze') });
    }
    opciones.push({ text: '📤  Compartir ubicación', onPress: () => compartirUbicacion(x) });
    opciones.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Abrir ubicación', 'Elige con qué aplicación quieres ver la ubicación de ' + x.cliente + '.', opciones);
  };
  const ir = async (url, nombre) => {
    try {
      const puede = await Linking.canOpenURL(url);
      if (!puede && nombre === 'Waze') {
        Alert.alert('Waze no instalado', '¿Deseas abrirlo en el navegador?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir', onPress: () => Linking.openURL(url).catch(() => {}) },
        ]);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('No se pudo abrir', 'Intenta con otra aplicación de mapas.');
    }
  };
  // Comparte la ubicación por WhatsApp, correo o cualquier app del teléfono
  const compartirUbicacion = async (x) => {
    const enlace = (x.lat && x.lng)
      ? 'https://www.google.com/maps/search/?api=1&query=' + x.lat + ',' + x.lng
      : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(x.ubicacionTexto || '');
    const texto = '🚨 AUXILIO VIAL\n'
      + 'Cliente: ' + x.cliente + (x.telefono ? ' (' + x.telefono + ')' : '') + '\n'
      + 'Vehículo: ' + (x.vehiculo || '—') + (x.placa ? ' · ' + x.placa : '') + '\n'
      + 'Avería: ' + x.descripcion + '\n'
      + 'Ubicación: ' + (x.ubicacionTexto || 'ver enlace') + '\n'
      + (x.lat && x.lng ? 'Coordenadas: ' + Number(x.lat).toFixed(5) + ', ' + Number(x.lng).toFixed(5) + '\n' : '')
      + '\n' + enlace;
    try {
      const { Share } = require('react-native');
      await Share.share({ message: texto, title: 'Auxilio vial — ' + x.cliente });
    } catch (e) {
      Linking.openURL('https://wa.me/?text=' + encodeURIComponent(texto)).catch(() => Alert.alert('Compartir', 'No se pudo compartir.'));
    }
  };
  const EST = {
    abierto: { t: 'SOLICITANDO', c: '#dc2626', bg: '#fdecec' },
    atendido: { t: 'En camino', c: '#D97706', bg: '#fef3e2' },
    cerrado: { t: 'Resuelto', c: '#16A34A', bg: '#e8f7ee' },
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.sosBanner, { backgroundColor: hayAlerta ? '#dc2626' : '#16A34A' }]}>
        <Text style={s.sosBannerT}>
          {hayAlerta ? '🚨 ' + abiertas.length + ' cliente(s) solicitando auxilio' : '✓ Sin solicitudes de auxilio'}
        </Text>
      </View>
      <FlatList data={lista} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}
        ListHeaderComponent={<TextInput style={[s.input, { marginBottom: 12 }]} value={q} onChangeText={setQ} placeholder="Buscar por cliente, placa o teléfono…" />}
        ListEmptyComponent={!loading && <Text style={s.muted}>No hay solicitudes de auxilio vial.</Text>}
        renderItem={({ item }) => {
          const e = EST[item.estado] || EST.abierto;
          return (
            <TouchableOpacity style={[s.card, { borderLeftWidth: 5, borderLeftColor: e.c }]} onPress={() => setSel(item)} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={s.veh}>{item.cliente}</Text>
                <Text style={[s.pill, { backgroundColor: e.bg, color: e.c }]}>{e.t}</Text>
              </View>
              <Text style={[s.muted, { marginTop: 4 }]}>🚗 {item.vehiculo} {item.placa ? '· ' + item.placa : ''}</Text>
              <Text style={[s.muted, { marginTop: 3 }]} numberOfLines={2}>⚠️ {item.descripcion}</Text>
              <Text style={[s.muted, { marginTop: 3 }]}>📅 {item.fecha} · {item.hora}</Text>
            </TouchableOpacity>
          );
        }} />

      <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
        <View style={s.modalWrap}><View style={s.modalCard}>
          {sel ? (() => {
            const e = EST[sel.estado] || EST.abierto;
            return (
              <ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.h}>🚨 Auxilio vial</Text>
                  <TouchableOpacity onPress={() => setSel(null)}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
                </View>
                <View style={[s.card, { backgroundColor: e.bg, borderColor: e.c, marginTop: 10 }]}>
                  <Text style={{ fontWeight: '800', color: e.c, fontSize: 15 }}>{e.t}</Text>
                  <Text style={{ color: e.c, marginTop: 4, fontSize: 13 }}>{sel.fecha} a las {sel.hora}</Text>
                </View>

                <Text style={[s.label, { marginTop: 14 }]}>Cliente</Text>
                <Text style={s.muted}>{sel.cliente}{sel.telefono ? ' · 📞 ' + sel.telefono : ''}</Text>

                <Text style={[s.label, { marginTop: 12 }]}>Vehículo</Text>
                <Text style={s.muted}>{sel.vehiculo} {sel.placa ? '· ' + sel.placa : ''}</Text>

                <Text style={[s.label, { marginTop: 12 }]}>Avería reportada</Text>
                <Text style={s.muted}>{sel.descripcion}</Text>

                <Text style={[s.label, { marginTop: 12 }]}>Ubicación</Text>
                <Text style={s.muted}>{sel.ubicacionTexto || 'No indicada'}</Text>
                {sel.lat && sel.lng ? <Text style={[s.muted, { marginTop: 2 }]}>📍 {Number(sel.lat).toFixed(5)}, {Number(sel.lng).toFixed(5)}</Text> : null}

                {(sel.lat && sel.lng) || sel.ubicacionTexto ? (
                  <>
                    <TouchableOpacity style={[s.avBtn, { marginTop: 16, backgroundColor: '#0891b2' }]} onPress={() => abrirMapa(sel)}>
                      <Text style={s.avBtnT}>🗺️ Abrir ubicación (Maps, Waze…)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.avBtn, { marginTop: 8, backgroundColor: '#6d28d9' }]} onPress={() => compartirUbicacion(sel)}>
                      <Text style={s.avBtnT}>📤 Compartir ubicación</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {sel.telefono ? (
                  <>
                    <TouchableOpacity style={[s.avBtn, { marginTop: 8 }]} onPress={() => Linking.openURL('tel:' + sel.telefono)}>
                      <Text style={s.avBtnT}>📞 Llamar al cliente</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.avBtn, { marginTop: 8, backgroundColor: '#16A34A' }]}
                      onPress={() => Linking.openURL('https://wa.me/' + String(sel.telefono).replace(/\D/g, '') + '?text=' + encodeURIComponent('Hola ' + sel.cliente + ', recibimos tu solicitud de auxilio vial. Vamos en camino.'))}>
                      <Text style={s.avBtnT}>💬 WhatsApp</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {sel.estado === 'abierto' ? (
                  <TouchableOpacity style={[s.avBtn, { marginTop: 14, backgroundColor: '#D97706' }]} onPress={() => cambiarEstado(sel, 'atendido')}>
                    <Text style={s.avBtnT}>🚐 Marcar: vamos en camino</Text>
                  </TouchableOpacity>
                ) : null}
                {sel.estado !== 'cerrado' ? (
                  <TouchableOpacity style={[s.avBtn, { marginTop: 8, backgroundColor: '#16191d' }]} onPress={() => cambiarEstado(sel, 'cerrado')}>
                    <Text style={s.avBtnT}>✓ Marcar como resuelto</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={{ height: 14 }} />
              </ScrollView>
            );
          })() : null}
        </View></View>
      </Modal>
    </View>
  );
}

/* =================== COTIZACIONES =================== */
function Cotizaciones({ data, guardar, cur, loading, recargar, taller, onNav }) {
  const clientes = data.clients || [];
  const vehiculos = data.vehicles || [];
  const cotsCitas = (data.citas || []).filter((c) => c.estado === 'cotizada' || c.estado === 'aceptada').map((c) => ({
    id: 'cita-' + c.id, num: null, cliente: c.cliente, vehiculo: c.vehiculo, placa: c.placa,
    items: c.repuestos || [], monto: c.monto || 0, estado: c.estado === 'aceptada' ? 'aceptada' : 'enviada',
    origen: 'cita', fecha: c.fecha,
  }));
  const cotsPropias = data.cotizaciones || [];
  const todas = [...cotsPropias.filter((c) => c.estado !== 'inactiva'), ...cotsCitas];
  const [crear, setCrear] = React.useState(false);
  const [editar, setEditar] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [buscar, setBuscar] = React.useState('');
  const [cli, setCli] = React.useState(null);
  const [veh, setVeh] = React.useState(null);
  const [items, setItems] = React.useState([]);
  const [itN, setItN] = React.useState('');
  const [itP, setItP] = React.useState('');
  const [itTipo, setItTipo] = React.useState('servicio');
  const [itDetalle, setItDetalle] = React.useState('');
  const [descuento, setDescuento] = React.useState('');
  const [guardando, setGuardando] = React.useState(false);

  const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clientesFiltrados = q.trim()
    ? clientes.filter((c) => norm(c.n + ' ' + (c.doc || '') + ' ' + (c.tel || '')).includes(norm(q)))
    : clientes;

  const todasFiltradas = buscar.trim()
    ? todas.filter((c) => norm((c.num ? 'P-' + String(c.num).padStart(6, '0') : '') + ' ' + (c.cliente || '') + ' ' + (c.doc || '')).includes(norm(buscar)))
    : todas;
  const pendientesFiltradas = todasFiltradas.filter((c) => c.estado !== 'aprobada');
  const aprobadasFiltradas = todasFiltradas.filter((c) => c.estado === 'aprobada');

  const abrirCrear = () => { setCli(null); setVeh(null); setItems([]); setItN(''); setItP(''); setItTipo('servicio'); setItDetalle(''); setDescuento(''); setQ(''); setEditar(null); setCrear(true); };
  const abrirEditar = (c) => {
    setEditar(c); setCli(clientes.find((x) => x.n === c.cliente) || { n: c.cliente });
    setVeh(vehiculos.find((v) => v.model === c.vehiculo) || null);
    setItems(c.items || []); setItN(''); setItP(''); setItTipo('servicio'); setItDetalle(''); setDescuento(c.descuento ? String(c.descuento) : ''); setCrear(true);
  };
  const vehiculosCli = cli ? vehiculos.filter((v) => v.owner === cli.n) : [];
  const total = items.reduce((a, r) => a + (+r.p || 0) * (+r.cant || 1), 0) - (+descuento || 0);
  const agregarItem = () => { if (!itN.trim()) { Alert.alert('Falta', 'Nombre del servicio o repuesto.'); return; } setItems([...items, { n: itN.trim(), p: +itP || 0, cant: 1, tipo: itTipo, detalle: itDetalle.trim() }]); setItN(''); setItP(''); setItDetalle(''); };
  const quitarItem = (i) => setItems(items.filter((_, k) => k !== i));

  const guardarCotiza = async () => {
    if (!cli) { Alert.alert('Falta', 'Elige el cliente.'); return; }
    if (!items.length) { Alert.alert('Falta', 'Agrega al menos un servicio o repuesto.'); return; }
    setGuardando(true);
    const num = editar && editar.num ? editar.num : ((data.config && data.config.ultimoNumCotiza) || 0) + 1;
    const cot = {
      id: editar ? editar.id : Date.now(),
      num,
      cliente: cli.n, doc: cli.doc || '', tel: cli.tel || '',
      vehiculo: veh ? veh.model : '', placa: veh ? veh.plate : '', anio: veh ? (veh.anio || veh.year || '') : '',
      items, monto: total, descuento: +descuento || 0, estado: 'activa', origen: 'manual',
      fecha: new Date().toLocaleDateString('es-VE'),
    };
    let arr = data.cotizaciones || [];
    if (editar) arr = arr.map((x) => (x.id === editar.id ? cot : x));
    else arr = [cot, ...arr];
    const cfg = { ...(data.config || {}) };
    if (!editar) cfg.ultimoNumCotiza = num;
    await guardar({ ...data, cotizaciones: arr, config: cfg });
    setGuardando(false); setCrear(false);
  };

  const inactivar = (c) => {
    Alert.alert('Inactivar cotización', '¿Inactivar la cotización N° ' + (c.num ? String(c.num).padStart(4, '0') : '') + '?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Inactivar', style: 'destructive', onPress: () => guardar({ ...data, cotizaciones: (data.cotizaciones || []).map((x) => (x.id === c.id ? { ...x, estado: 'inactiva' } : x)) }) },
    ]);
  };

  const aprobarCotizacionAdmin = (c) => {
    Alert.alert('Aprobar cotización', '¿Aprobar esta cotización sin la autorización del cliente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprobar', onPress: () => guardar({
          ...data, cotizaciones: (data.cotizaciones || []).map((x) => (x.id === c.id ? { ...x, estado: 'aprobada', aprobadoPor: 'admin', fechaAprobacion: new Date().toLocaleDateString('es-VE') } : x)),
        }),
      },
    ]);
  };

  const compartirCotiza = (c) => {
    const nombreTaller = taller ? taller.nombre : 'TallerOS';
    let txt = '🧾 COTIZACIÓN' + (c.num ? ' P-' + String(c.num).padStart(6, '0') : '') + '\n' + nombreTaller + '\n\n';
    txt += '👤 ' + c.cliente + '\n';
    if (c.vehiculo) txt += '🚗 ' + c.vehiculo + (c.placa ? ' · ' + c.placa : '') + '\n';
    txt += '\nSERVICIOS / REPUESTOS:\n';
    (c.items || []).forEach((r) => { txt += '• ' + r.n + ' — ' + cur + ' ' + (+r.p || 0).toLocaleString('es-VE') + '\n'; });
    if (c.descuento) txt += '\nDescuento: ' + cur + ' ' + (+c.descuento).toLocaleString('es-VE');
    txt += '\nTOTAL: ' + cur + ' ' + (+c.monto || 0).toLocaleString('es-VE');
    try { const { Share } = require('react-native'); Share.share({ message: txt, title: 'Cotización — ' + c.cliente }); }
    catch (e) { const num2 = (c.tel || '').replace(/[^0-9]/g, ''); Linking.openURL('https://wa.me/' + num2 + '?text=' + encodeURIComponent(txt)); }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}>
      <Text style={s.label}>Buscar (N° de cotización, cliente o documento)</Text>
      <TextInput style={[s.input, { marginBottom: 12 }]} value={buscar} onChangeText={setBuscar} placeholder="Ej. P-000125, Juan Pérez, V-12345678" placeholderTextColor="#9aa3ad" />

      <TouchableOpacity style={[s.btn, { marginBottom: 16 }]} onPress={abrirCrear}>
        <Text style={s.btnT}>＋ Nueva cotización</Text>
      </TouchableOpacity>

      {!pendientesFiltradas.length ? <Text style={s.muted}>{buscar.trim() ? 'No se encontraron cotizaciones pendientes.' : 'Aún no hay cotizaciones por aprobar.'}</Text> : null}
      {pendientesFiltradas.map((c) => (
        <View key={c.id} style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F6E56' }}>🧾 {c.num ? 'P-' + String(c.num).padStart(6, '0') : (c.origen === 'cita' ? 'Desde cita' : '')}</Text>
            <Text style={{ fontWeight: '800', color: '#16191d' }}>{cur} {(+c.monto || 0).toLocaleString('es-VE')}</Text>
          </View>
          <Text style={s.muted}>👤 {c.cliente}</Text>
          {c.vehiculo ? <Text style={s.muted}>🚗 {c.vehiculo}{c.placa ? ' · ' + c.placa : ''}</Text> : null}
          <Text style={s.muted}>{(c.items || []).length} ítem(s){c.origen === 'cita' ? ' · desde cita' : ''}{c.estado === 'aceptada' ? ' · aceptada ✓' : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TouchableOpacity style={[s.act, { flex: 1, backgroundColor: '#e8f6ec' }]} onPress={() => compartirCotiza(c)}><Text style={[s.actT, { color: '#0F6E56' }]}>💬 Compartir</Text></TouchableOpacity>
            {c.origen !== 'cita' ? <TouchableOpacity style={[s.act, { flex: 1, backgroundColor: '#fdf3e0' }]} onPress={() => taller && compartirCotizacionPDF(taller.id, c)}><Text style={[s.actT, { color: '#b45309' }]}>📄 PDF</Text></TouchableOpacity> : null}
            {c.origen !== 'cita' ? <TouchableOpacity style={[s.act, { backgroundColor: '#e8f6ec' }]} onPress={() => aprobarCotizacionAdmin(c)}><Text style={[s.actT, { color: '#0F6E56' }]}>✅ Aprobar</Text></TouchableOpacity> : null}
            {c.origen !== 'cita' ? <TouchableOpacity style={[s.act, { flex: 1 }]} onPress={() => abrirEditar(c)}><Text style={s.actT}>✏️ Editar</Text></TouchableOpacity> : null}
            {c.origen !== 'cita' ? <TouchableOpacity style={[s.act, { backgroundColor: '#fdecec', paddingHorizontal: 14 }]} onPress={() => inactivar(c)}><Text style={[s.actT, { color: '#dc2626' }]}>Inactivar</Text></TouchableOpacity> : null}
          </View>
        </View>
      ))}

      <Text style={[s.label, { marginTop: 18, marginBottom: 10, fontSize: 14, fontWeight: '800', color: '#16406b' }]}>Historial de cotizaciones aprobadas</Text>
      {!aprobadasFiltradas.length ? <Text style={s.muted}>Aún no hay cotizaciones aprobadas.</Text> : null}
      {aprobadasFiltradas.map((c) => (
        <View key={c.id} style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F6E56' }}>🧾 {c.num ? 'P-' + String(c.num).padStart(6, '0') : ''}</Text>
            <Text style={{ fontWeight: '800', color: '#16191d' }}>{cur} {(+c.monto || 0).toLocaleString('es-VE')}</Text>
          </View>
          <Text style={s.muted}>👤 {c.cliente}</Text>
          {c.vehiculo ? <Text style={s.muted}>🚗 {c.vehiculo}{c.placa ? ' · ' + c.placa : ''}</Text> : null}
          <Text style={s.muted}>Aprobada por {c.aprobadoPor === 'admin' ? 'el taller' : 'el cliente'}{c.fechaAprobacion ? ' el ' + c.fechaAprobacion : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TouchableOpacity style={[s.act, { flex: 1, backgroundColor: '#e8f6ec' }]} onPress={() => compartirCotiza(c)}><Text style={[s.actT, { color: '#0F6E56' }]}>💬 Compartir</Text></TouchableOpacity>
            <TouchableOpacity style={[s.act, { flex: 1, backgroundColor: '#fdf3e0' }]} onPress={() => taller && compartirCotizacionPDF(taller.id, c)}><Text style={[s.actT, { color: '#b45309' }]}>📄 PDF</Text></TouchableOpacity>
          </View>
        </View>
      ))}

      <Modal visible={crear} transparent animationType="slide" onRequestClose={() => setCrear(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#16191d' }}>{editar ? 'Editar cotización' : 'Nueva cotización'}</Text>
              <TouchableOpacity onPress={() => setCrear(false)}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView>
              {!cli ? (
                <>
                  <Text style={s.label}>Buscar cliente (nombre, cédula o teléfono)</Text>
                  <TextInput style={s.input} value={q} onChangeText={setQ} placeholder="Escribe para buscar…" placeholderTextColor="#9aa3ad" autoFocus />
                  <View style={{ marginTop: 8 }}>
                    {clientesFiltrados.slice(0, 8).map((c) => (
                      <TouchableOpacity key={c.id || c.n} style={{ paddingVertical: 11, borderBottomWidth: 1, borderColor: '#eef0f2' }} onPress={() => { setCli(c); const vs = vehiculos.filter((v) => v.owner === c.n); setVeh(vs.length === 1 ? vs[0] : null); }}>
                        <Text style={{ fontWeight: '700', color: '#16191d' }}>{c.n}</Text>
                        <Text style={s.muted}>{c.doc || 'sin doc'} · {c.tel || 'sin tel'}</Text>
                      </TouchableOpacity>
                    ))}
                    {!clientesFiltrados.length ? (
                      <View style={{ alignItems: 'center', padding: 16 }}>
                        <Text style={s.muted}>No se encontró ese cliente.</Text>
                        <TouchableOpacity style={[s.act, { marginTop: 10 }]} onPress={() => { setCrear(false); onNav && onNav('cli'); }}>
                          <Text style={s.actT}>＋ Registrar cliente nuevo</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <View style={{ backgroundColor: '#f7f8fa', borderRadius: 12, padding: 12, marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '800', color: '#16191d' }}>{cli.n}</Text>
                      <TouchableOpacity onPress={() => { setCli(null); setVeh(null); }}><Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 12 }}>Cambiar</Text></TouchableOpacity>
                    </View>
                    <Text style={s.muted}>{cli.doc || 'sin doc'} · {cli.tel || 'sin tel'}</Text>
                  </View>

                  <Text style={s.label}>Vehículo</Text>
                  {vehiculosCli.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {vehiculosCli.map((v) => (
                        <TouchableOpacity key={v.id} onPress={() => setVeh(v)} style={[s.pillBtn, veh && veh.id === v.id && s.pillBtnOn]}>
                          <Text style={[s.pillBtnT, veh && veh.id === v.id && { color: '#16191d' }]}>{v.model} · {v.plate}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : <Text style={s.muted}>Este cliente no tiene vehículos registrados (opcional).</Text>}

                  <Text style={[s.label, { marginTop: 14 }]}>Servicios y repuestos</Text>
                  {items.map((r, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f0f2f5' }}>
                      <Text style={{ flex: 1, color: '#3a4048' }}>{r.tipo === 'repuesto' ? '🔩' : '🔧'} {r.n}{r.detalle ? ' — ' + r.detalle : ''}</Text>
                      <Text style={{ fontWeight: '700', color: '#16191d' }}>{cur} {(+r.p || 0).toLocaleString('es-VE')}</Text>
                      <TouchableOpacity onPress={() => quitarItem(i)} style={{ backgroundColor: '#fdecec', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: '#dc2626', fontWeight: '800' }}>✕</Text></TouchableOpacity>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => setItTipo('servicio')} style={[s.pillBtn, itTipo === 'servicio' && s.pillBtnOn]}><Text style={[s.pillBtnT, itTipo === 'servicio' && { color: '#16191d' }]}>🔧 Servicio</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setItTipo('repuesto')} style={[s.pillBtn, itTipo === 'repuesto' && s.pillBtnOn]}><Text style={[s.pillBtnT, itTipo === 'repuesto' && { color: '#16191d' }]}>🔩 Repuesto</Text></TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} value={itN} onChangeText={setItN} placeholder="Nombre" placeholderTextColor="#9aa3ad" />
                    <TextInput style={[s.input, { width: 90 }]} value={itP} onChangeText={setItP} keyboardType="numeric" placeholder="Precio" placeholderTextColor="#9aa3ad" />
                  </View>
                  <TextInput style={[s.input, { marginTop: 8 }]} value={itDetalle} onChangeText={setItDetalle} placeholder="Detalle (opcional)" placeholderTextColor="#9aa3ad" />
                  <TouchableOpacity style={[s.act, { marginTop: 8, backgroundColor: '#e9f0fe' }]} onPress={agregarItem}><Text style={[s.actT, { color: '#2563EB' }]}>＋ Agregar</Text></TouchableOpacity>

                  <Text style={[s.label, { marginTop: 14 }]}>Descuento (opcional)</Text>
                  <TextInput style={s.input} value={descuento} onChangeText={setDescuento} keyboardType="numeric" placeholder="0" placeholderTextColor="#9aa3ad" />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 2, borderColor: '#e3e7ec' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#16191d' }}>TOTAL</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F6E56' }}>{cur} {total.toLocaleString('es-VE')}</Text>
                  </View>
                  <TouchableOpacity style={[s.btn, { marginTop: 18 }, guardando && { opacity: 0.6 }]} disabled={guardando} onPress={guardarCotiza}>
                    <Text style={s.btnT}>{guardando ? 'Guardando…' : (editar ? 'Guardar cambios' : 'Crear cotización')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* =================== CITAS PROGRAMADAS =================== */
function CitasProgramadas({ data, guardar, cur, loading, recargar, taller }) {
  const citas = data.citas || [];
  const [cotizar, setCotizar] = React.useState(null); // cita que se está cotizando
  const [reps, setReps] = React.useState([]);
  const [repN, setRepN] = React.useState('');
  const [repP, setRepP] = React.useState('');
  const [repTipo, setRepTipo] = React.useState('servicio');
  const [repDetalle, setRepDetalle] = React.useState('');
  const [descuentoCita, setDescuentoCita] = React.useState('');
  const [guardando, setGuardando] = React.useState(false);
  const [verBloqueo, setVerBloqueo] = React.useState(false);
  const diasBloqueados = data.diasBloqueados || [];
  const toggleDiaBloqueado = (fecha) => {
    const ya = diasBloqueados.includes(fecha);
    const nuevos = ya ? diasBloqueados.filter((f) => f !== fecha) : [...diasBloqueados, fecha];
    guardar({ ...data, diasBloqueados: nuevos });
  };

  const ESTADOS = {
    solicitada: { l: 'Por cotizar', c: '#dc2626', bg: '#fdecec' },
    cotizada: { l: 'Esperando cliente', c: '#D97706', bg: '#fdf1e1' },
    aceptada: { l: 'Aceptada ✓', c: '#16A34A', bg: '#e8f6ec' },
    rechazada: { l: 'Rechazada', c: '#64748B', bg: '#eef0f2' },
  };

  const abrirCotizar = (c) => {
    setCotizar(c);
    setReps(c.repuestos && c.repuestos.length ? [...c.repuestos] : []);
    setRepN(''); setRepP(''); setRepTipo('servicio'); setRepDetalle(''); setDescuentoCita(c.descuento ? String(c.descuento) : '');
  };
  const agregarRep = () => {
    if (!repN.trim()) { Alert.alert('Falta', 'Nombre del servicio o repuesto.'); return; }
    setReps([...reps, { n: repN.trim(), p: +repP || 0, cant: 1, tipo: repTipo, detalle: repDetalle.trim() }]);
    setRepN(''); setRepP(''); setRepDetalle('');
  };
  const quitarRep = (i) => setReps(reps.filter((_, k) => k !== i));
  const totalCotiza = reps.reduce((a, r) => a + (+r.p || 0) * (+r.cant || 1), 0) - (+descuentoCita || 0);

  const confirmarCotizacion = async () => {
    if (!reps.length) { Alert.alert('Falta', 'Agrega al menos un servicio o repuesto a la cotización.'); return; }
    setGuardando(true);
    try {
      await api('/api/state/cita-cotizar?taller=' + taller.id, { method: 'POST', body: JSON.stringify({ id: cotizar.id, repuestos: reps, monto: totalCotiza, descuento: +descuentoCita || 0 }) });
      setCotizar(null); setGuardando(false); setDescuentoCita(''); setRepTipo('servicio');
      Alert.alert('Cotización enviada ✓', 'El cliente recibió la cotización por ' + cur + ' ' + totalCotiza.toLocaleString('es-VE') + ' y podrá aceptarla o rechazarla.');
      recargar();
    } catch (e) { setGuardando(false); Alert.alert('Error', (e && e.message) || 'No se pudo enviar.'); }
  };

  const orden = { solicitada: 0, cotizada: 1, aceptada: 2, rechazada: 3 };
  const citasOrd = [...citas].sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9));

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 14 }}
      data={citasOrd}
      keyExtractor={(c) => String(c.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 14 }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f2ecfd', borderRadius: 12, paddingVertical: 12 }} onPress={() => setVerBloqueo(true)}>
            <Text style={{ fontSize: 16 }}>🚫</Text>
            <Text style={{ color: '#7c3aed', fontWeight: '800' }}>Bloquear días no laborables{diasBloqueados.length ? ' (' + diasBloqueados.length + ')' : ''}</Text>
          </TouchableOpacity>
          <Modal visible={verBloqueo} transparent animationType="slide" onRequestClose={() => setVerBloqueo(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: '#16191d' }}>🚫 Días no laborables</Text>
                  <TouchableOpacity onPress={() => setVerBloqueo(false)}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12.5, color: '#6b7480', marginBottom: 8 }}>Toca un día para bloquearlo o desbloquearlo. Los clientes no podrán agendar citas en los días bloqueados (en plomo).</Text>
                <CalendarioBloqueo bloqueados={diasBloqueados} onToggle={toggleDiaBloqueado} />
                <TouchableOpacity style={[s.btn, { marginTop: 14 }]} onPress={() => setVerBloqueo(false)}><Text style={s.btnT}>Listo</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      }
      ListEmptyComponent={!loading && <Text style={s.muted}>Aún no hay citas solicitadas por los clientes.</Text>}
      renderItem={({ item: c }) => {
        const e = ESTADOS[c.estado] || ESTADOS.solicitada;
        return (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={s.veh}>📅 {c.fecha} · {c.hora}</Text>
              <View style={{ backgroundColor: e.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: e.c, fontWeight: '800', fontSize: 11 }}>{e.l}</Text>
              </View>
            </View>
            <Text style={s.muted}>👤 {c.cliente}</Text>
            <Text style={s.muted}>🚗 {c.vehiculo || '—'}{c.placa ? ' · ' + c.placa : ''}</Text>
            <Text style={{ color: '#16191d', fontWeight: '700', marginTop: 4 }}>🔧 {c.servicio}</Text>
            {c.observaciones ? <Text style={s.muted}>📝 {c.observaciones}</Text> : null}
            {c.monto ? <Text style={{ color: '#0F6E56', fontWeight: '800', marginTop: 4 }}>💰 Cotizado: {cur} {(+c.monto).toLocaleString('es-VE')}</Text> : null}
            {c.estado === 'solicitada' ? (
              <TouchableOpacity style={[s.act, { marginTop: 10 }]} onPress={() => abrirCotizar(c)}>
                <Text style={s.actT}>Armar cotización →</Text>
              </TouchableOpacity>
            ) : c.estado === 'cotizada' ? (
              <TouchableOpacity style={[s.act, { marginTop: 10, backgroundColor: '#fdf1e1' }]} onPress={() => abrirCotizar(c)}>
                <Text style={[s.actT, { color: '#D97706' }]}>Editar cotización</Text>
              </TouchableOpacity>
            ) : null}

            <Modal visible={cotizar && cotizar.id === c.id} transparent animationType="slide" onRequestClose={() => setCotizar(null)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#16191d' }}>🧾 Cotización</Text>
                    <TouchableOpacity onPress={() => setCotizar(null)}><Text style={{ fontSize: 22, color: '#6b7480' }}>✕</Text></TouchableOpacity>
                  </View>
                  <ScrollView style={{ maxHeight: 440 }}>
                    <View style={{ backgroundColor: '#f7f8fa', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                      <Text style={{ fontWeight: '800', color: '#16191d' }}>{c.cliente}</Text>
                      <Text style={s.muted}>{c.vehiculo}{c.placa ? ' · ' + c.placa : ''}</Text>
                      <Text style={{ color: '#16191d', fontWeight: '700', marginTop: 4 }}>{c.servicio} · {c.fecha} {c.hora}</Text>
                      {c.observaciones ? <Text style={s.muted}>📝 {c.observaciones}</Text> : null}
                    </View>

                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#16191d', marginBottom: 8 }}>Servicios y repuestos</Text>
                    {reps.map((r, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f0f2f5' }}>
                        <Text style={{ flex: 1, color: '#3a4048' }}>{r.tipo === 'repuesto' ? '🔩' : '🔧'} {r.n}{r.detalle ? ' — ' + r.detalle : ''}</Text>
                        <Text style={{ fontWeight: '700', color: '#16191d' }}>{cur} {(+r.p || 0).toLocaleString('es-VE')}</Text>
                        <TouchableOpacity onPress={() => quitarRep(i)} style={{ backgroundColor: '#fdecec', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ color: '#dc2626', fontWeight: '800' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <TouchableOpacity onPress={() => setRepTipo('servicio')} style={[s.pillBtn, repTipo === 'servicio' && s.pillBtnOn]}><Text style={[s.pillBtnT, repTipo === 'servicio' && { color: '#16191d' }]}>🔧 Servicio</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => setRepTipo('repuesto')} style={[s.pillBtn, repTipo === 'repuesto' && s.pillBtnOn]}><Text style={[s.pillBtnT, repTipo === 'repuesto' && { color: '#16191d' }]}>🔩 Repuesto</Text></TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TextInput style={[s.input, { flex: 1 }]} value={repN} onChangeText={setRepN} placeholder="Nombre" placeholderTextColor="#9aa3ad" />
                      <TextInput style={[s.input, { width: 90 }]} value={repP} onChangeText={setRepP} keyboardType="numeric" placeholder="Precio" placeholderTextColor="#9aa3ad" />
                    </View>
                    <TextInput style={[s.input, { marginTop: 8 }]} value={repDetalle} onChangeText={setRepDetalle} placeholder="Detalle (opcional)" placeholderTextColor="#9aa3ad" />
                    <TouchableOpacity style={[s.act, { marginTop: 8, backgroundColor: '#e9f0fe' }]} onPress={agregarRep}>
                      <Text style={[s.actT, { color: '#2563EB' }]}>＋ Agregar</Text>
                    </TouchableOpacity>

                    <Text style={[s.label, { marginTop: 14 }]}>Descuento (opcional)</Text>
                    <TextInput style={s.input} value={descuentoCita} onChangeText={setDescuentoCita} keyboardType="numeric" placeholder="0" placeholderTextColor="#9aa3ad" />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 2, borderColor: '#e3e7ec' }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#16191d' }}>TOTAL</Text>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F6E56' }}>{cur} {totalCotiza.toLocaleString('es-VE')}</Text>
                    </View>

                    <TouchableOpacity style={[s.btn, { marginTop: 18 }, guardando && { opacity: 0.6 }]} disabled={guardando} onPress={confirmarCotizacion}>
                      <Text style={s.btnT}>{guardando ? 'Enviando…' : 'Confirmar cotización'}</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11.5, color: '#9aa3ad', textAlign: 'center', marginTop: 8 }}>El cliente recibirá la cotización y podrá aceptarla o rechazarla.</Text>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </View>
        );
      }}
    />
  );
}

/* =================== PRÓXIMOS MANTENIMIENTOS =================== */
function Mantenimientos({ data, guardar, cur, loading, recargar, taller }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const aNum = (f) => {
    if (!f) return 0;
    const t = String(f).trim(); let d, m, a;
    if (t.includes('/')) { const p = t.split('/'); d = +p[0]; m = +p[1]; a = +p[2]; }
    else if (t.includes('-')) { const p = t.split('-'); if (p[0].length === 4) { a = +p[0]; m = +p[1]; d = +p[2]; } else { d = +p[0]; m = +p[1]; a = +p[2]; } }
    else return 0;
    if (!a || !m || !d) return 0;
    if (a < 100) a += 2000;
    return a * 10000 + m * 100 + d;
  };
  const hoy = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();
  const lista = (data.vehicles || [])
    .filter((v) => v.proximoMant && coincide({ ...v, ...(v.proximoMant || {}) }, q))
    .sort((a, b) => aNum(a.proximoMant.fecha) - aNum(b.proximoMant.fecha));

  const estadoDe = (f) => {
    const n = aNum(f);
    if (!n) return { t: 'Sin fecha', c: '#6b7480', bg: '#f1f3f5' };
    if (n < hoy) return { t: 'Vencido', c: '#dc2626', bg: '#fdecec' };
    if (n === hoy) return { t: 'Es hoy', c: '#D97706', bg: '#fef3e2' };
    return { t: 'Programado', c: '#16A34A', bg: '#e8f7ee' };
  };

  const quitar = (v) => {
    Alert.alert('Quitar recordatorio', '¿Eliminar el próximo mantenimiento de ' + v.model + '?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => {
        const vehicles = (data.vehicles || []).map((x) => (x.id === v.id ? { ...x, proximoMant: null } : x));
        guardar({ ...data, vehicles }); setSel(null);
      } },
    ]);
  };

  const avisar = (v) => {
    const p = v.proximoMant || {};
    const txt = 'Recordatorio de mantenimiento\n' + v.model + ' (' + v.plate + ')\n'
      + p.tipo + (p.km && p.km !== '—' ? ' · ' + p.km + ' km' : '') + '\nFecha sugerida: ' + p.fecha
      + '\n\n' + (taller ? taller.nombre : '');
    Linking.openURL('https://wa.me/?text=' + encodeURIComponent(txt)).catch(() => Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp.'));
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList data={lista} keyExtractor={(v) => String(v.id)} contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}
        ListHeaderComponent={
          <TextInput style={[s.input, { marginBottom: 12 }]} value={q} onChangeText={setQ}
            placeholder="Buscar por vehículo, placa, cliente o tipo…" />
        }
        ListEmptyComponent={!loading && <Text style={s.muted}>No hay mantenimientos programados. Se crean cuando el técnico marca un trabajo como terminado.</Text>}
        renderItem={({ item }) => {
          const p = item.proximoMant || {};
          const e = estadoDe(p.fecha);
          return (
            <TouchableOpacity style={[s.card, { borderLeftWidth: 5, borderLeftColor: e.c }]} onPress={() => setSel(item)} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={s.veh}>{item.model}</Text>
                <Text style={[s.pill, { backgroundColor: e.bg, color: e.c }]}>{e.t}</Text>
              </View>
              <View style={s.plate}><Text style={s.plateT}>{item.plate}</Text></View>
              <Text style={[s.muted, { marginTop: 6 }]}>👤 {item.owner || 'Sin cliente'}</Text>
              <Text style={[s.muted, { marginTop: 2 }]}>🔧 {p.tipo}{p.km && p.km !== '—' ? ' · ' + p.km + ' km' : ''}</Text>
              <Text style={{ marginTop: 6, fontWeight: '800', color: e.c }}>📅 {p.fecha}</Text>
            </TouchableOpacity>
          );
        }} />

      <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
        <View style={s.modalWrap}><View style={s.modalCard}>
          {sel ? (() => {
            const p = sel.proximoMant || {};
            const e = estadoDe(p.fecha);
            const cli = (data.clients || []).find((c) => c.n === sel.owner) || {};
            return (
              <ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={s.h}>{sel.model}</Text>
                  <TouchableOpacity onPress={() => setSel(null)}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
                </View>
                <View style={s.plate}><Text style={s.plateT}>{sel.plate}</Text></View>

                <View style={[s.card, { backgroundColor: e.bg, borderColor: e.c, marginTop: 12 }]}>
                  <Text style={{ fontWeight: '800', color: e.c, fontSize: 14 }}>🔔 {p.tipo}</Text>
                  <Text style={{ color: e.c, marginTop: 4 }}>Fecha programada: {p.fecha} ({e.t})</Text>
                  {p.km && p.km !== '—' ? <Text style={{ color: e.c, marginTop: 2 }}>Kilometraje: {p.km} km</Text> : null}
                  {p.mech ? <Text style={{ color: e.c, marginTop: 2 }}>Indicado por: {p.mech}</Text> : null}
                </View>

                <Text style={[s.label, { marginTop: 14 }]}>Cliente</Text>
                <Text style={s.muted}>{sel.owner || '—'}{cli.tel ? ' · 📞 ' + cli.tel : ''}{cli.doc ? ' · ' + cli.doc : ''}</Text>

                <Text style={[s.label, { marginTop: 12 }]}>Último trabajo</Text>
                <Text style={s.muted}>{sel.motivo || '—'}{sel.mech ? ' · 🔧 ' + sel.mech : ''}</Text>

                <TouchableOpacity style={[s.avBtn, { marginTop: 16 }]} onPress={() => abrirEnNavegador(taller.id, sel, 'acta')}>
                  <Text style={s.avBtnT}>📄 Ver acta</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.avBtn, { backgroundColor: '#16191d', marginTop: 8 }]} onPress={() => abrirEnNavegador(taller.id, sel, 'trabajo')}>
                  <Text style={s.avBtnT}>📋 Ver trabajo realizado</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.avBtn, { backgroundColor: '#16A34A', marginTop: 8 }]} onPress={() => avisar(sel)}>
                  <Text style={s.avBtnT}>💬 Recordar por WhatsApp</Text>
                </TouchableOpacity>
                {cli.tel ? (
                  <TouchableOpacity style={[s.avBtn, { backgroundColor: '#0891b2', marginTop: 8 }]} onPress={() => Linking.openURL('tel:' + cli.tel)}>
                    <Text style={s.avBtnT}>📞 Llamar al cliente</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => quitar(sel)}>
                  <Text style={{ textAlign: 'center', color: '#dc2626', marginTop: 16, fontWeight: '700' }}>Quitar recordatorio</Text>
                </TouchableOpacity>
                <View style={{ height: 10 }} />
              </ScrollView>
            );
          })() : null}
        </View></View>
      </Modal>
    </View>
  );
}

function Historial({ data, guardar, cur, loading, recargar, pickFoto, taller }) {
  const histTodo = data.history || [];
  const [qHist, setQHist] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [calCual, setCalCual] = useState(null); // 'desde' | 'hasta' | null
  // El selector nativo se carga solo si está disponible
  const abrirCal = (cual) => setCalCual(cual);
  // Convierte "20/7/2026" o "2026-07-20" a número comparable AAAAMMDD
  const aNum = (f) => {
    if (!f) return 0;
    const t = String(f).trim();
    let d, m, a;
    if (t.includes('/')) { const p = t.split('/'); d = +p[0]; m = +p[1]; a = +p[2]; }
    else if (t.includes('-')) { const p = t.split('-'); if (p[0].length === 4) { a = +p[0]; m = +p[1]; d = +p[2]; } else { d = +p[0]; m = +p[1]; a = +p[2]; } }
    else return 0;
    if (!a || !m || !d) return 0;
    if (a < 100) a += 2000;
    return a * 10000 + m * 100 + d;
  };
  const hist = histTodo.filter((x) => {
    const campos = [x.veh, x.placa, x.cliente, x.mech, x.trabajo, x.fecha, x.doc, x.tel];
    const t = norm(campos.filter(Boolean).join(' '));
    const pasaTexto = !qHist.trim() || norm(qHist).split(/\s+/).filter(Boolean).every((w) => t.includes(w));
    const f = aNum(x.fecha);
    const pasaDesde = !desde.trim() || (f && f >= aNum(desde));
    const pasaHasta = !hasta.trim() || (f && f <= aNum(hasta));
    return pasaTexto && pasaDesde && pasaHasta;
  });
  const [selIdx, setSelIdx] = useState(null);
  React.useEffect(() => { setSelIdx(null); }, [qHist, desde, hasta]);
  const [ab, setAb] = useState({ monto: '', codigo: '', prox: '', foto: null });
  const [honorarioDe, setHonorarioDe] = useState(null); // trabajo al que se le paga honorario
  const [honMonto, setHonMonto] = useState('');
  const pagarHonorario = () => {
    const monto = +honMonto; if (!monto) { Alert.alert('Falta', 'Indica el monto a pagar al técnico.'); return; }
    const cobrado = +honorarioDe.total || +honorarioDe.costo || 0;
    const pct = cobrado > 0 ? Math.round((monto / cobrado) * 1000) / 10 : 0;
    const now = new Date();
    const nh = (data.history || []).map((x) => (x.id === honorarioDe.id ? {
      ...x, honorario: { monto, pct, fecha: now.toISOString().slice(0, 10), tecnico: x.mech },
    } : x));
    guardar({ ...data, history: nh });
    setHonorarioDe(null); setHonMonto('');
    Alert.alert('Honorario registrado ✓', 'Se pagó ' + cur + ' ' + monto.toLocaleString('es-VE') + ' a ' + (honorarioDe.mech || 'el técnico') + ' (' + pct + '% de lo cobrado). El técnico lo verá en su app.');
  };
  const h = selIdx != null ? hist[selIdx] : null;
  const registrarCuota = () => {
    const monto = +ab.monto; if (!monto) { Alert.alert('Falta', 'Monto de la cuota.'); return; }
    const now = new Date();
    const nh = hist.map((x, i) => {
      if (i !== selIdx) return x;
      const pagos = [...(x.pagos || []), { n: (x.pagos || []).length + 1, monto, codigo: ab.codigo, fecha: now.toISOString().slice(0, 10), fechaISO: now.toISOString().slice(0, 10), foto: ab.foto }];
      const pagado = (+x.pagado || 0) + monto; const saldo = Math.max(0, (+x.total || x.costo || 0) - pagado);
      return { ...x, pagos, pagado, saldo, cuotasPagadas: (+x.cuotasPagadas || 0) + 1, proximoPago: saldo > 0 ? ab.prox : '' };
    });
    guardar({ ...data, history: nh }); setAb({ monto: '', codigo: '', prox: '', foto: null });
    Alert.alert('Listo', 'Cuota registrada.');
  };
  const compartir = (x) => {
    // Comparte el informe completo en PDF (ficha + fotos + observaciones + pago)
    if (taller && x.vehId) { compartirActaPDF(taller.id, { id: x.vehId, model: x.veh }, 'trabajo'); return; }
    const txt = 'TALLER ' + (taller ? taller.nombre : '') + '\nTrabajo: ' + x.trabajo + '\nVehículo: ' + x.veh + ' (' + x.placa + ')\nCliente: ' + x.cliente + '\nFecha: ' + x.fecha + '\nTotal: ' + cur + ' ' + (+x.total || 0) + '\nPagado: ' + cur + ' ' + (+x.pagado || 0) + '\nSaldo: ' + cur + ' ' + (+x.saldo || 0);
    Alert.alert('Resumen del trabajo', txt);
  };
  return (
    <View style={{ flex: 1 }}>
      <FlatList data={hist} keyExtractor={(x, i) => String(x.id || i)} contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <TextInput style={s.input} value={qHist} onChangeText={setQHist}
              placeholder="Buscar por placa, cliente, técnico, trabajo…" />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={[s.input, { flex: 1, justifyContent: 'center' }]} onPress={() => abrirCal('desde')}>
                <Text style={{ color: desde ? '#16191d' : '#9aa3ad', fontSize: 14 }}>{desde ? '📅 ' + desde : '📅 Desde'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.input, { flex: 1, justifyContent: 'center' }]} onPress={() => abrirCal('hasta')}>
                <Text style={{ color: hasta ? '#16191d' : '#9aa3ad', fontSize: 14 }}>{hasta ? '📅 ' + hasta : '📅 Hasta'}</Text>
              </TouchableOpacity>
            </View>
            <Calendario visible={calCual !== null} valor={calCual === 'desde' ? desde : hasta}
              titulo={calCual === 'desde' ? 'Fecha desde' : 'Fecha hasta'}
              onSelect={(txt) => { if (calCual === 'desde') setDesde(txt); else setHasta(txt); }}
              onClose={() => setCalCual(null)} />
            {(qHist || desde || hasta) ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={s.muted}>{hist.length} de {histTodo.length} trabajo(s)</Text>
                <TouchableOpacity onPress={() => { setQHist(''); setDesde(''); setHasta(''); }}>
                  <Text style={[s.link, { marginTop: 0 }]}>Limpiar filtros</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={!loading && <Text style={s.muted}>{(qHist || desde || hasta) ? 'Ningún trabajo coincide con la búsqueda.' : 'Aún no hay trabajos realizados.'}</Text>}
        renderItem={({ item, index }) => (
          <View style={s.card}>
            <TouchableOpacity onPress={() => setSelIdx(index)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.veh}>{item.veh}</Text>
                <Text style={[s.pill, +item.saldo > 0 ? { backgroundColor: '#D9770622', color: '#D97706' } : { backgroundColor: '#16A34A22', color: '#16A34A' }]}>{+item.saldo > 0 ? 'Debe ' + cur + ' ' + (+item.saldo).toLocaleString('es-VE') : 'Pagado'}</Text>
              </View>
              <Text style={s.muted}>{item.fecha} · {item.cliente} · {item.trabajo}</Text>
              <Text style={s.muted}>Total {cur} {(+item.total || 0).toLocaleString('es-VE')} · Pagado {cur} {(+item.pagado || 0).toLocaleString('es-VE')}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
              <TouchableOpacity onPress={() => taller && item.vehId && abrirEnNavegador(taller.id, { id: item.vehId, model: item.veh }, 'trabajo')}>
                <Text style={[s.link, { marginTop: 0 }]}>👁 Ver trabajo realizado →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => compartir(item)}>
                <Text style={[s.link, { marginTop: 0 }]}>📄 Compartir (PDF) →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHonorarioDe(item)}>
                <Text style={[s.link, { marginTop: 0, color: '#0F6E56' }]}>💵 Honorarios{item.honorario ? ' ✓' : ''} →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )} />
      <Modal visible={h != null} transparent animationType="slide" onRequestClose={() => setSelIdx(null)}>
        <View style={s.modalWrap}><View style={s.modalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={s.h}>{h ? h.veh : ''}</Text><TouchableOpacity onPress={() => setSelIdx(null)}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>
          {h && (<ScrollView style={{ maxHeight: 470 }}>
            <Text style={s.muted}>{h.fecha} · {h.cliente} · {h.placa}</Text>
            <Row k="Trabajo" v={h.trabajo} /><Row k="Técnico" v={h.mech} />
            <Row k="Total" v={cur + ' ' + (+h.total || 0).toLocaleString('es-VE')} />
            <Row k="Pagado" v={cur + ' ' + (+h.pagado || 0).toLocaleString('es-VE')} />
            <Row k="Saldo" v={cur + ' ' + (+h.saldo || 0).toLocaleString('es-VE')} />
            {(h.pagos || []).length ? <Text style={[s.label, { marginTop: 10 }]}>Pagos</Text> : null}
            {(h.pagos || []).map((p, i) => (<View key={i} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderColor: '#eef0f2' }}><Text style={{ flex: 1, fontSize: 12 }}>Cuota {p.n} · {p.fecha || ''}</Text><Text style={{ fontWeight: '700' }}>{cur} {(+p.monto || 0).toLocaleString('es-VE')}</Text></View>))}
            {+h.saldo > 0 && (<View style={{ marginTop: 14, borderTopWidth: 1, borderColor: '#eef0f2', paddingTop: 12 }}>
              <Text style={s.h}>Registrar cuota</Text>
              <Text style={s.label}>Monto ({cur})</Text><TextInput style={s.input} value={ab.monto} onChangeText={(v) => setAb({ ...ab, monto: v })} keyboardType="numeric" />
              <Text style={s.label}>Código</Text><TextInput style={s.input} value={ab.codigo} onChangeText={(v) => setAb({ ...ab, codigo: v })} />
              <TouchableOpacity style={s.pick} onPress={() => pickFoto((u) => setAb({ ...ab, foto: u }))}><Text style={s.pickT}>{ab.foto ? 'Vaucher listo ✓' : 'Adjuntar vaucher'}</Text></TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={registrarCuota}><Text style={s.btnT}>Registrar cuota</Text></TouchableOpacity>
            </View>)}
          </ScrollView>)}
        </View></View>
      </Modal>

      <Modal visible={!!honorarioDe} transparent animationType="slide" onRequestClose={() => setHonorarioDe(null)}>
        <View style={s.modalWrap}><View style={s.modalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={s.h}>💵 Honorarios del técnico</Text>
            <TouchableOpacity onPress={() => setHonorarioDe(null)}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>
          {honorarioDe && (() => {
            const cobrado = +honorarioDe.total || +honorarioDe.costo || 0;
            const m = +honMonto || 0;
            const pct = cobrado > 0 ? Math.round((m / cobrado) * 1000) / 10 : 0;
            return (
              <View>
                <Text style={s.muted}>{honorarioDe.veh} · {honorarioDe.trabajo}</Text>
                <Text style={s.muted}>Técnico: {honorarioDe.mech || 'sin asignar'}</Text>
                {(honorarioDe.servicios || []).length ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[s.label, { marginBottom: 4 }]}>Servicios realizados</Text>
                    {honorarioDe.servicios.map((sv, i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderColor: '#eef0f2' }}>
                        <Text style={{ fontSize: 12.5, color: '#3a4048', flex: 1 }}>{sv.desc || sv.n || ''}</Text>
                        {sv.precio ? <Text style={{ fontSize: 12.5, fontWeight: '700' }}>{cur} {(+sv.precio).toLocaleString('es-VE')}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : null}
                <Row k="Cobrado al cliente" v={cur + ' ' + cobrado.toLocaleString('es-VE')} />
                {honorarioDe.honorario ? <Text style={{ color: '#0F6E56', fontWeight: '700', marginTop: 6 }}>Ya pagado: {cur} {(+honorarioDe.honorario.monto).toLocaleString('es-VE')} ({honorarioDe.honorario.pct}%)</Text> : null}
                <Text style={[s.label, { marginTop: 12 }]}>Monto a pagar al técnico</Text>
                <TextInput style={s.input} value={honMonto} onChangeText={setHonMonto} keyboardType="numeric" placeholder="0" placeholderTextColor="#9aa3ad" />
                {m > 0 ? <Text style={{ color: '#0F6E56', fontWeight: '800', marginTop: 8, fontSize: 15 }}>Equivale al {pct}% de lo cobrado</Text> : null}
                <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={pagarHonorario}><Text style={s.btnT}>Registrar pago al técnico</Text></TouchableOpacity>
                <Text style={{ fontSize: 11.5, color: '#9aa3ad', textAlign: 'center', marginTop: 8 }}>El técnico verá este pago en su app, con el detalle del trabajo.</Text>
              </View>
            );
          })()}
        </View></View>
      </Modal>
    </View>
  );
}
/* =================== AVANCES DEL TÉCNICO =================== */
function AvancesModal({ item, close, taller }) {
  const [foto, setFoto] = useState(null);
  const avs = [...(item.advances || [])].reverse();
  const ico = { nota: '📝', atencion: '⚠️', recep: '🔧', check: '✅', term: '✅' };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={s.modalWrap}><View style={s.modalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={s.h}>Avances del técnico</Text>
            <TouchableOpacity onPress={close}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>
          <Text style={s.muted}>{item.model} · {item.plate} · {item.mech || 'sin técnico'}</Text>
          <ScrollView style={{ maxHeight: 430, marginTop: 8 }}>
            {avs.length ? avs.map((a, i) => (
              <View key={i} style={s.avItem}>
                <View style={s.avIco}><Text style={{ fontSize: 14 }}>{ico[a.type] || '🔧'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.avTit}>{a.t}</Text>
                  <Text style={s.avSub}>{a.m}{a.ago ? ' · ' + a.ago : ''}</Text>
                  {a.foto ? (
                    <TouchableOpacity onPress={() => setFoto(a.foto)}>
                      <Image source={{ uri: a.foto }} style={s.avImg} />
                      <Text style={s.avVer}>👁 Toca para ampliar</Text>
                    </TouchableOpacity>
                  ) : null}
                  {a.respondido !== undefined ? (
                    <Text style={{ fontSize: 12, fontWeight: '700', marginTop: 4, color: a.autorizado ? '#16A34A' : '#dc2626' }}>
                      {a.autorizado ? '✓ Autorizado por el cliente' : '✕ Denegado por el cliente'}
                    </Text>
                  ) : null}
                </View>
              </View>
            )) : <Text style={{ color: '#6b7480', paddingVertical: 20 }}>El técnico aún no ha registrado avances.</Text>}
            <View style={{ height: 10 }} />
          </ScrollView>
          <TouchableOpacity style={s.avBtn} onPress={() => compartirActaPDF(taller.id, item, 'trabajo')}>
            <Text style={s.avBtnT}>📋 Compartir informe con fotos (PDF)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.avBtn, { backgroundColor: '#16191d', marginTop: 8 }]} onPress={() => abrirEnNavegador(taller.id, item, 'trabajo')}>
            <Text style={s.avBtnT}>🌐 Abrir informe en el navegador</Text>
          </TouchableOpacity>
      </View></View>
      <Modal visible={!!foto} transparent animationType="fade" onRequestClose={() => setFoto(null)}>
        <TouchableOpacity style={s.zoomWrap} activeOpacity={1} onPress={() => setFoto(null)}>
          {foto ? <Image source={{ uri: foto }} style={s.zoomImg} resizeMode="contain" /> : null}
          <Text style={{ color: '#fff', marginTop: 14 }}>Toca para cerrar</Text>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

function Acta({ item, close }) {
  const r = (item && item.recepcion) || {};
  const sn = { leve: 'Leve', mod: 'Moderado', grave: 'Grave' };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={s.modalWrap}><View style={s.modalCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={s.h}>Acta · {item.model}</Text><TouchableOpacity onPress={close}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 480 }}>
          <Text style={s.muted}>{item.plate} · {item.owner}</Text>
          <Row k="Fecha" v={(r.fecha || '') + ' ' + (r.hora || '')} /><Row k="Motivo" v={r.motivo || '—'} /><Row k="Trabajo" v={r.trabajo || '—'} />
          <Row k="Técnico" v={item.mech || 'Por asignar'} />
          <Row k="Prioridad" v={r.prioridad || '—'} /><Row k="Combustible" v={r.combustible || '—'} /><Row k="Kilometraje" v={r.km || '—'} />
          <Row k="Accesorios" v={(r.accesorios || []).join(', ') || '—'} /><Row k="Documentos" v={(r.documentos || []).join(', ') || '—'} />
          {(item.recepLados || []).length ? <Row k="Lados con daño" v={(item.recepLados || []).join(', ')} /> : null}
          <Text style={[s.label, { marginTop: 10 }]}>Daños ({(item.recepDamages || []).length})</Text>
          {(item.recepDamages || []).length ? (item.recepDamages || []).map((d, i) => (<Text key={i} style={{ fontSize: 12, color: '#3a4048', paddingVertical: 2 }}>#{d.n} {d.tipo}{d.lado ? ' · ' + d.lado : ''} — {sn[d.sev] || d.sev}</Text>)) : <Text style={s.muted}>Sin daños.</Text>}
          <Text style={[s.label, { marginTop: 10 }]}>Observaciones</Text><Text style={{ fontSize: 13 }}>{r.obs || 'Sin observaciones.'}</Text>
          <Text style={[s.label, { marginTop: 10 }]}>Firmas</Text>
          {r.firmaCli ? (<><Text style={s.muted}>Cliente</Text><FirmaVista trazos={r.firmaCli} /></>) : <Text style={s.muted}>El cliente no firmó.</Text>}
          {r.firmaRec ? (<><Text style={[s.muted, { marginTop: 8 }]}>Recepcionista</Text><FirmaVista trazos={r.firmaRec} /></>) : null}
        </ScrollView>
        <TouchableOpacity style={s.btn} onPress={close}><Text style={s.btnT}>Cerrar</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}

/* =================== TALLERES =================== */
function Talleres() {
  const [list, setList] = useState([]); const [nombre, setNombre] = useState(''); const [loading, setLoading] = useState(false);
  const cargar = async () => { setLoading(true); try { setList(await api('/api/talleres')); } catch (e) { Alert.alert('Error', e.message); } finally { setLoading(false); } };
  useEffect(() => { cargar(); }, []);
  const crear = async () => { if (!nombre.trim()) return; try { await api('/api/talleres', { method: 'POST', body: JSON.stringify({ nombre }) }); setNombre(''); cargar(); } catch (e) { Alert.alert('Error', e.message); } };
  const toggle = async (t) => { try { await api('/api/talleres/' + t.id, { method: 'PUT', body: JSON.stringify({ activo: !t.activo, motivo_inactivo: t.activo ? 'Desactivado desde la app' : null }) }); cargar(); } catch (e) { Alert.alert('Error', e.message); } };
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargar} />}>
      <View style={s.card}><Text style={s.h}>Nuevo taller</Text><TextInput style={[s.input, { marginTop: 8 }]} value={nombre} onChangeText={setNombre} placeholder="Nombre del taller" /><TouchableOpacity style={s.btn} onPress={crear}><Text style={s.btnT}>Crear taller</Text></TouchableOpacity></View>
      {list.map((t) => (
        <View key={t.id} style={s.card}>
          <Text style={s.veh}>{t.nombre} {t.activo ? '' : '· inactivo'}</Text>
          <Text style={s.muted}>{t.rif || ''} {t.telefono || ''}</Text>
          <TouchableOpacity style={[s.btn, { marginTop: 8, backgroundColor: t.activo ? '#eef0f2' : '#F5B700' }]} onPress={() => toggle(t)}><Text style={[s.btnT, { color: '#16191d' }]}>{t.activo ? 'Inactivar' : 'Reactivar'}</Text></TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

/* =================== USUARIOS (crear y EDITAR con credenciales) =================== */
function Usuarios({ esSuper, taller }) {
  const [list, setList] = useState([]); const [loading, setLoading] = useState(false);
  const vacio = { nombre: '', usuario: '', correo: '', password: '', password2: '', rol: 'administrador' };
  const [f, setF] = useState(vacio);
  const [edit, setEdit] = useState(null);
  const cargar = async () => {
    setLoading(true);
    try { setList(esSuper ? await api('/api/talleres/users/all') : await api('/api/talleres/' + taller.id + '/admins')); }
    catch (e) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);
  const crear = async () => {
    if (!f.nombre || !f.usuario || !f.correo || !f.password) { Alert.alert('Faltan datos', 'Completa todos los campos.'); return; }
    if (f.password !== f.password2) { Alert.alert('Error', 'Las contraseñas no coinciden.'); return; }
    if (f.password.length < 6) { Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.'); return; }
    try {
      if (esSuper) await api('/api/talleres/users/new', { method: 'POST', body: JSON.stringify(f) });
      else await api('/api/talleres/' + taller.id + '/admins', { method: 'POST', body: JSON.stringify({ nombre: f.nombre, usuario: f.usuario, correo: f.correo, password: f.password }) });
      setF(vacio); cargar(); Alert.alert('Listo', 'Usuario creado.');
    } catch (e) { Alert.alert('Error', e.message); }
  };
  const guardarEdicion = async () => {
    if (edit.password && edit.password !== edit.password2) { Alert.alert('Error', 'Las contraseñas no coinciden.'); return; }
    if (edit.password && edit.password.length < 6) { Alert.alert('Error', 'Mínimo 6 caracteres.'); return; }
    const body = { nombre: edit.nombre, usuario: edit.usuario, correo: edit.correo };
    if (edit.password) body.password = edit.password;
    try {
      if (esSuper) await api('/api/talleres/users/' + edit.id, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/api/talleres/' + taller.id + '/admins/' + edit.id, { method: 'PUT', body: JSON.stringify(body) });
      setEdit(null); cargar(); Alert.alert('Listo', 'Usuario actualizado.');
    } catch (e) { Alert.alert('Error', e.message); }
  };
  const RB = { superadmin: 'Super Admin', administrador: 'Administrador', mecanico: 'Técnico', cliente: 'Cliente' };
  const roles = [['administrador', 'Administrador'], ['superadmin', 'Super Admin'], ['mecanico', 'Técnico'], ['cliente', 'Cliente']];
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargar} />}>
      <View style={s.card}>
        <Text style={s.h}>Crear usuario</Text>
        <Text style={s.label}>Nombre</Text><TextInput style={s.input} value={f.nombre} onChangeText={(v) => setF({ ...f, nombre: v })} />
        <Text style={s.label}>Usuario de acceso</Text><TextInput style={s.input} value={f.usuario} onChangeText={(v) => setF({ ...f, usuario: v })} autoCapitalize="none" />
        <Text style={s.label}>Correo</Text><TextInput style={s.input} value={f.correo} onChangeText={(v) => setF({ ...f, correo: v })} autoCapitalize="none" keyboardType="email-address" />
        <Text style={s.label}>Contraseña</Text><TextInput style={s.input} value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry />
        <Text style={s.label}>Confirmar contraseña</Text><TextInput style={s.input} value={f.password2} onChangeText={(v) => setF({ ...f, password2: v })} secureTextEntry />
        {esSuper && (<>
          <Text style={s.label}>Rol</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {roles.map(([k, l]) => (<TouchableOpacity key={k} style={[s.pillBtn, f.rol === k && s.pillBtnOn]} onPress={() => setF({ ...f, rol: k })}><Text style={[s.pillBtnT, f.rol === k && { color: '#16191d' }]}>{l}</Text></TouchableOpacity>))}
          </View>
        </>)}
        <TouchableOpacity style={s.btn} onPress={crear}><Text style={s.btnT}>Crear</Text></TouchableOpacity>
      </View>
      {list.map((u) => (
        <View key={u.id} style={s.card}>
          <Text style={s.veh}>{u.nombre}</Text>
          <Text style={s.muted}>{u.usuario} · {u.correo}{u.rol ? ' · ' + (RB[u.rol] || u.rol) : ''}</Text>
          <TouchableOpacity style={[s.act, { marginTop: 10 }]} onPress={() => setEdit({ ...u, password: '', password2: '' })}><Text style={s.actT}>Modificar (usuario y contraseña)</Text></TouchableOpacity>
        </View>
      ))}
      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <View style={s.modalWrap}><View style={s.modalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.h}>Editar usuario</Text><TouchableOpacity onPress={() => setEdit(null)}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>
          {edit && (<ScrollView style={{ maxHeight: 430 }}>
            <Text style={s.label}>Nombre</Text><TextInput style={s.input} value={edit.nombre} onChangeText={(v) => setEdit({ ...edit, nombre: v })} />
            <Text style={s.label}>Usuario de acceso</Text><TextInput style={s.input} value={edit.usuario} onChangeText={(v) => setEdit({ ...edit, usuario: v })} autoCapitalize="none" />
            <Text style={s.label}>Correo</Text><TextInput style={s.input} value={edit.correo} onChangeText={(v) => setEdit({ ...edit, correo: v })} autoCapitalize="none" />
            <Text style={s.label}>Nueva contraseña (opcional)</Text><TextInput style={s.input} value={edit.password} onChangeText={(v) => setEdit({ ...edit, password: v })} secureTextEntry placeholder="Dejar vacío para no cambiar" />
            <Text style={s.label}>Confirmar contraseña</Text><TextInput style={s.input} value={edit.password2} onChangeText={(v) => setEdit({ ...edit, password2: v })} secureTextEntry />
          </ScrollView>)}
          <TouchableOpacity style={s.btn} onPress={guardarEdicion}><Text style={s.btnT}>Guardar cambios</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

/* =================== CONFIG =================== */
function Config({ data, guardar }) {
  const cfg = data.config || {};
  const [sym, setSym] = useState((cfg.currency && cfg.currency.sym) || 'Bs.');
  const [esp, setEsp] = useState(cfg.especialidades || ESP_BASE);
  const [marcas, setMarcas] = useState(cfg.marcas || MARCAS_BASE);
  const [ne, setNe] = useState(''); const [nm, setNm] = useState('');
  const salvar = () => { guardar({ ...data, config: { ...cfg, currency: { ...(cfg.currency || {}), sym }, especialidades: esp, marcas } }); Alert.alert('Listo', 'Configuración guardada.'); };
  const Lista = ({ title, arr, set, val, setVal }) => (
    <View style={s.card}>
      <Text style={s.h}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {(arr || []).map((x) => { const lab = etiqueta(x); return (
          <TouchableOpacity key={lab} style={s.pillBtnOn2} onPress={() => set(arr.filter((y) => etiqueta(y) !== lab))}><Text style={{ fontWeight: '700', fontSize: 12 }}>{lab}  ✕</Text></TouchableOpacity>
        ); })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TextInput style={[s.input, { flex: 1 }]} value={val} onChangeText={setVal} placeholder="Agregar…" />
        <TouchableOpacity style={[s.act, { flex: 0, paddingHorizontal: 16, justifyContent: 'center' }]} onPress={() => { const t = (val || '').trim(); if (t && !(arr || []).some((y) => etiqueta(y) === t)) set([...(arr || []), title.includes('Marca') ? { marca: t, modelos: [] } : t]); setVal(''); }}><Text style={s.actT}>＋</Text></TouchableOpacity>
      </View>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <View style={s.card}><Text style={s.h}>Moneda</Text><TextInput style={[s.input, { marginTop: 8 }]} value={sym} onChangeText={setSym} /></View>
      <Lista title="Especialidades" arr={esp} set={setEsp} val={ne} setVal={setNe} />
      <Lista title="Marcas de vehículos" arr={marcas} set={setMarcas} val={nm} setVal={setNm} />
      <TouchableOpacity style={s.btn} onPress={salvar}><Text style={s.btnT}>Guardar configuración</Text></TouchableOpacity>
    </ScrollView>
  );
}

/* =================== FORMULARIOS (iguales a la web, con credenciales al crear Y editar) =================== */
function FormModal({ modal, close, data, guardar, cur, pickFoto, taller }) {
  const { tipo, item } = modal;
  const cfg = data.config || {};
  const [espOpts, setEspOpts] = useState(cfg.especialidades || ESP_BASE);
  const [marOpts, setMarOpts] = useState(cfg.marcas || MARCAS_BASE);
  const [f, setF] = useState(() => {
    if (tipo === 'cliente') return item ? { ...item, telNum: item.telNum || '', paisCod: item.paisCod || '+58', paisEt: item.paisEt || '🇻🇪 Venezuela +58', password: '', password2: '' } : { n: '', tipoDoc: 'Cédula V', doc: '', tel: '', telNum: '', paisCod: '+58', paisEt: '🇻🇪 Venezuela +58', correo: '', dir: '', usuario: '', password: '', password2: '', activo: true };
    if (tipo === 'vehiculo') return item ? { ...item } : { marca: '', modelo: '', anio: '', plate: '', owner: '', color: '', activo: true };
    if (tipo === 'mecanico') return item ? { ...item, telNum: item.telNum || '', paisCod: item.paisCod || '+58', paisEt: item.paisEt || '🇻🇪 Venezuela +58', password: '', password2: '' } : { n: '', sp: 'General', doc: '', tel: '', telNum: '', paisCod: '+58', paisEt: '🇻🇪 Venezuela +58', correo: '', usuario: '', password: '', password2: '', activo: true };
    if (tipo === 'pago') return { modo: 'completo', codigo: '', monto: '', total: '', ahora: '', partes: '3', prox: '', foto: null };
    return {};
  });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const cfgMerge = { ...cfg, especialidades: espOpts, marcas: marOpts };

  const crearCuenta = async (rol) => {
    // Crea o actualiza las credenciales de acceso en el backend
    if (!f.usuario || !f.password) return true; // sin credenciales, solo guarda el registro
    if (f.password !== f.password2) { Alert.alert('Error', 'Las contraseñas no coinciden.'); return false; }
    if (f.password.length < 6) { Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.'); return false; }
    if (!f.correo) { Alert.alert('Falta', 'El correo es necesario para el acceso.'); return false; }
    try {
      await api('/api/talleres/' + taller.id + '/cuenta', { method: 'POST', body: JSON.stringify({ nombre: f.n, usuario: f.usuario, correo: f.correo, password: f.password, rol, telefono: f.tel }) });
      return true;
    } catch (e) {
      if ((e.message || '').includes('ya existe')) { Alert.alert('Aviso', 'Ese usuario ya tiene cuenta; se guardaron los demás datos.'); return true; }
      Alert.alert('Error al crear acceso', e.message); return false;
    }
  };

  const ofrecerCompartir = (nombre, usuario, clave, rolTxt, tel) => {
    if (!clave) return;
    Alert.alert('✅ Acceso creado', 'Se creó el acceso de ' + nombre + '.\n\nUsuario: ' + usuario + '\nContraseña: ' + clave + '\n\n¿Quieres compartir estos datos?', [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Compartir', onPress: () => compartirAcceso({ nombreTaller: taller ? taller.nombre : 'TallerOS', nombre, usuario, clave, rolTxt, tel }) },
    ]);
  };
  const guardarEntidad = async () => {
    // Componer teléfono con prefijo de país
    if (f.telNum != null || f.paisCod) {
      const cod = f.paisCod || '+58';
      f.tel = f.telNum ? cod + ' ' + String(f.telNum).trim() : '';
    }
    if (tipo === 'cliente') {
      if (!f.n) { Alert.alert('Falta', 'Nombre del cliente.'); return; }
      const ok = await crearCuenta('cliente'); if (!ok) return;
      const claveCliNueva = f.password;
      const limpio = { ...f }; delete limpio.password; delete limpio.password2; if (claveCliNueva) limpio.claveActual = claveCliNueva;
      let arr = data.clients || [];
      if (item) arr = arr.map((c) => (c.id === item.id ? { ...c, ...limpio } : c));
      else arr = [...arr, { ...limpio, id: nid(arr), ini: inits(f.n), gas: 0 }];
      guardar({ ...data, clients: arr }); close();
      if (!item && claveCliNueva) setTimeout(() => ofrecerCompartir(f.n, f.usuario, claveCliNueva, 'cliente', f.tel), 350);
    } else if (tipo === 'vehiculo') {
      if (!f.marca || !f.plate) { Alert.alert('Falta', 'Marca y placa.'); return; }
      if (!f.owner) { Alert.alert('Falta', 'Selecciona el propietario.'); return; }
      const model = (f.marca + ' ' + f.modelo + (f.anio ? ' ' + f.anio : '')).trim();
      let arr = data.vehicles || [];
      if (item) arr = arr.map((v) => (v.id === item.id ? { ...v, ...f, model } : v));
      else arr = [...arr, { ...f, id: nid(arr), model, ini: inits(f.marca + ' ' + f.modelo), status: 'espera', progress: 0, mech: null, motivo: 'Por definir', cost: 0, recepcion: null, cerrada: false, recepDamages: [], advances: [] }];
      guardar({ ...data, vehicles: arr, config: cfgMerge }); close();
    } else if (tipo === 'mecanico') {
      if (!f.n) { Alert.alert('Falta', 'Nombre del técnico.'); return; }
      const ok = await crearCuenta('mecanico'); if (!ok) return;
      const limpioMecClave = f.password;
      const limpio = { ...f }; delete limpio.password; delete limpio.password2; if (limpioMecClave) limpio.claveActual = limpioMecClave;
      let arr = data.mecanicos || [];
      if (item) arr = arr.map((m) => (m.id === item.id ? { ...m, ...limpio } : m));
      else arr = [...arr, { ...limpio, id: nid(arr), ini: inits(f.n), c: '#2563EB', rat: 5, base: 0 }];
      guardar({ ...data, mecanicos: arr, config: cfgMerge }); close();
      if (!item && limpioMecClave) setTimeout(() => ofrecerCompartir(f.n, f.usuario, limpioMecClave, 'técnico', f.tel), 350);
    }
  };

  const confirmarPago = () => {
    const v = item; const now = new Date(); const fecha = now.toISOString().slice(0, 10);
    let pago;
    if (f.modo === 'completo') {
      const monto = +f.monto; if (!monto) { Alert.alert('Falta', 'Monto.'); return; }
      pago = { tipoPago: 'completo', total: monto, pagado: monto, cuotas: 1, cuotasPagadas: 1, montoCuota: 0, proximoPago: '', pagos: [{ n: 1, monto, codigo: f.codigo, fecha, fechaISO: fecha, foto: f.foto }] };
    } else {
      const partes = +f.partes, total = +f.total, ahora = +f.ahora;
      if (!partes || partes < 2 || !total || !ahora) { Alert.alert('Falta', 'Partes (mín. 2), total y abono.'); return; }
      const montoCuota = Math.max(0, total - ahora) / (partes - 1);
      pago = { tipoPago: 'partes', total, pagado: ahora, cuotas: partes, cuotasPagadas: 1, montoCuota, proximoPago: f.prox, pagos: [{ n: 1, monto: ahora, codigo: f.codigo, fecha, fechaISO: fecha, foto: f.foto }] };
    }
    const hist = { id: Date.now(), vehId: v.id, fecha: now.toLocaleDateString('es-VE'), fechaISO: fecha, cliente: v.owner, veh: v.model, placa: v.plate, trabajo: v.motivo, mech: v.mech || '—', total: pago.total, pagado: pago.pagado, saldo: Math.max(0, pago.total - pago.pagado), tipoPago: pago.tipoPago, cuotas: pago.cuotas, cuotasPagadas: pago.cuotasPagadas, montoCuota: pago.montoCuota, proximoPago: pago.proximoPago, pagos: pago.pagos, damages: v.recepDamages || [], recepcion: v.recepcion || null };
    const vs = (data.vehicles || []).map((x) => (x.id === v.id ? { ...x, status: 'term', progress: 100, cost: pago.total, cerrada: true } : x));
    guardar({ ...data, vehicles: vs, history: [hist, ...(data.history || [])] });
    close(); Alert.alert('Listo', 'Pago registrado. La orden pasó a Trabajos realizados.');
  };

  const titulos = { cliente: item ? 'Editar cliente' : 'Nuevo cliente', vehiculo: item ? 'Editar vehículo' : 'Nuevo vehículo', mecanico: item ? 'Editar técnico' : 'Nuevo técnico', pago: 'Pago del servicio' };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={s.modalWrap}>
        <View style={s.modalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={s.h}>{titulos[tipo]}</Text><TouchableOpacity onPress={close}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 480 }}>
            {tipo === 'cliente' && (<>
              <Text style={s.label}>Nombre completo *</Text><TextInput style={s.input} value={f.n} onChangeText={(v) => set('n', v)} />
              <Dropdown label="Tipo de documento" value={f.tipoDoc} onChange={(v) => set('tipoDoc', v)} options={TIPO_DOC} placeholder="Selecciona" />
              <Text style={s.label}>Número de documento</Text><TextInput style={s.input} value={f.doc} onChangeText={(v) => set('doc', v)} />
              <Text style={s.label}>Teléfono / WhatsApp</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ width: 120 }}>
                  <Dropdown value={f.paisEt || '🇻🇪 Venezuela +58'} onChange={(v) => { set('paisEt', v); const pp = PAISES.find((x) => (x.band + ' ' + x.nom + ' ' + x.cod) === v); set('paisCod', pp ? pp.cod : v.split(' ').pop()); }} options={PAISES.map((x) => x.band + ' ' + x.nom + ' ' + x.cod)} placeholder="País" />
                </View>
                <TextInput style={[s.input, { flex: 1 }]} value={f.telNum} onChangeText={(v) => set('telNum', v)} keyboardType="phone-pad" placeholder={(PAISES.find((x) => x.cod === (f.paisCod || '+58')) || {}).ej || 'número'} />
              </View>
              <Text style={s.label}>Correo electrónico</Text><TextInput style={s.input} value={f.correo} onChangeText={(v) => set('correo', v)} autoCapitalize="none" keyboardType="email-address" />
              <Text style={s.label}>Dirección</Text><TextInput style={s.input} value={f.dir} onChangeText={(v) => set('dir', v)} />
              <View style={s.sep}><Text style={s.sepT}>Acceso del cliente a la app</Text></View>
              <Text style={s.label}>Usuario de acceso</Text><TextInput style={s.input} value={f.usuario} onChangeText={(v) => set('usuario', v)} autoCapitalize="none" />
              <Text style={s.label}>Contraseña</Text><CampoClave value={f.password} onChangeText={(v) => set('password', v)} placeholder={item ? 'Dejar vacío para no cambiar' : 'mínimo 6 caracteres'} />
              <Text style={s.label}>Confirmar contraseña</Text><CampoClave value={f.password2} onChangeText={(v) => set('password2', v)} />
              <Text style={s.label}>Estado</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[[true, 'Activo'], [false, 'Inactivo']].map(([k, l]) => (<TouchableOpacity key={String(k)} style={[s.pillBtn, f.activo === k && s.pillBtnOn]} onPress={() => set('activo', k)}><Text style={[s.pillBtnT, f.activo === k && { color: '#16191d' }]}>{l}</Text></TouchableOpacity>))}
              </View>
            </>)}
            {tipo === 'vehiculo' && (<>
              <Dropdown label="Propietario" obligatorio value={f.owner} onChange={(v) => set('owner', v)}
                options={(data.clients || []).map((c) => c.n)} placeholder="Selecciona el propietario"
                textoVacio="Aún no hay clientes. Regístralos primero." />
              <Dropdown label="Marca" obligatorio value={f.marca} onChange={(v) => { set('marca', v); set('modelo', ''); }}
                options={marOpts} placeholder="Selecciona la marca"
                onAdd={(t) => setMarOpts([...marOpts, { marca: t, modelos: [] }])} />
              <Dropdown label="Modelo" value={f.modelo} onChange={(v) => set('modelo', v)}
                options={(() => { const m = marOpts.find((x) => etiqueta(x) === f.marca); return (m && m.modelos) || []; })()}
                placeholder={f.marca ? 'Selecciona el modelo' : 'Primero elige la marca'}
                deshabilitado={!f.marca}
                textoVacio={'Esta marca no tiene modelos. Agrega uno.'}
                onAdd={(t) => setMarOpts(marOpts.map((x) => (etiqueta(x) === f.marca ? { marca: etiqueta(x), modelos: [...((x && x.modelos) || []), t] } : x)))} />
              <Text style={s.label}>Año</Text><TextInput style={s.input} value={String(f.anio || '')} onChangeText={(v) => set('anio', v)} keyboardType="numeric" />
              <Text style={s.label}>Placa *</Text><TextInput style={s.input} value={f.plate} onChangeText={(v) => set('plate', v)} autoCapitalize="characters" />
              <Text style={s.label}>Color</Text><TextInput style={s.input} value={f.color} onChangeText={(v) => set('color', v)} />
              <Dropdown label="Tipo de vehículo" value={f.tipoVeh || 'Automóvil'} options={TIPO_VEH} onChange={(v) => set('tipoVeh', v)} />
            </>)}
            {tipo === 'mecanico' && (<>
              <Text style={s.label}>Nombre completo *</Text><TextInput style={s.input} value={f.n} onChangeText={(v) => set('n', v)} />
              <Dropdown label="Especialidad" value={f.sp} onChange={(v) => set('sp', v)} options={espOpts} placeholder="Selecciona la especialidad" onAdd={(t) => setEspOpts([...espOpts, t])} />
              <Text style={s.label}>Documento</Text><TextInput style={s.input} value={f.doc} onChangeText={(v) => set('doc', v)} />
              <Text style={s.label}>Teléfono</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ width: 120 }}>
                  <Dropdown value={f.paisEt || '🇻🇪 Venezuela +58'} onChange={(v) => { set('paisEt', v); const pp = PAISES.find((x) => (x.band + ' ' + x.nom + ' ' + x.cod) === v); set('paisCod', pp ? pp.cod : v.split(' ').pop()); }} options={PAISES.map((x) => x.band + ' ' + x.nom + ' ' + x.cod)} placeholder="País" />
                </View>
                <TextInput style={[s.input, { flex: 1 }]} value={f.telNum} onChangeText={(v) => set('telNum', v)} keyboardType="phone-pad" placeholder={(PAISES.find((x) => x.cod === (f.paisCod || '+58')) || {}).ej || 'número'} />
              </View>
              <Text style={s.label}>Correo electrónico</Text><TextInput style={s.input} value={f.correo} onChangeText={(v) => set('correo', v)} autoCapitalize="none" keyboardType="email-address" />
              <View style={s.sep}><Text style={s.sepT}>Acceso del técnico a la app</Text></View>
              <Text style={s.label}>Usuario de acceso</Text><TextInput style={s.input} value={f.usuario} onChangeText={(v) => set('usuario', v)} autoCapitalize="none" />
              <Text style={s.label}>Contraseña</Text><CampoClave value={f.password} onChangeText={(v) => set('password', v)} placeholder={item ? 'Dejar vacío para no cambiar' : 'mínimo 6 caracteres'} />
              <Text style={s.label}>Confirmar contraseña</Text><CampoClave value={f.password2} onChangeText={(v) => set('password2', v)} />
              <Text style={s.label}>Estado</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[[true, 'Activo'], [false, 'Inactivo']].map(([k, l]) => (<TouchableOpacity key={String(k)} style={[s.pillBtn, f.activo === k && s.pillBtnOn]} onPress={() => set('activo', k)}><Text style={[s.pillBtnT, f.activo === k && { color: '#16191d' }]}>{l}</Text></TouchableOpacity>))}
              </View>
            </>)}
            {tipo === 'pago' && (<>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                {[['completo', 'Completo'], ['partes', 'Por partes']].map(([k, l]) => (<TouchableOpacity key={k} style={[s.pillBtn, f.modo === k && s.pillBtnOn]} onPress={() => set('modo', k)}><Text style={[s.pillBtnT, f.modo === k && { color: '#16191d' }]}>{l}</Text></TouchableOpacity>))}
              </View>
              {f.modo === 'completo' ? (
                <><Text style={s.label}>Monto total ({cur})</Text><TextInput style={s.input} value={f.monto} onChangeText={(v) => set('monto', v)} keyboardType="numeric" /></>
              ) : (
                <>
                  <Text style={s.label}>N.º de partes</Text><TextInput style={s.input} value={f.partes} onChangeText={(v) => set('partes', v)} keyboardType="numeric" />
                  <Text style={s.label}>Monto total ({cur})</Text><TextInput style={s.input} value={f.total} onChangeText={(v) => set('total', v)} keyboardType="numeric" />
                  <Text style={s.label}>Paga ahora ({cur})</Text><TextInput style={s.input} value={f.ahora} onChangeText={(v) => set('ahora', v)} keyboardType="numeric" />
                  <Text style={s.label}>Próximo pago</Text><TextInput style={s.input} value={f.prox} onChangeText={(v) => set('prox', v)} placeholder="2026-08-01" />
                </>
              )}
              <Text style={s.label}>Código</Text><TextInput style={s.input} value={f.codigo} onChangeText={(v) => set('codigo', v)} />
              <TouchableOpacity style={s.pick} onPress={() => pickFoto((u) => set('foto', u))}><Text style={s.pickT}>{f.foto ? 'Vaucher listo ✓' : 'Adjuntar vaucher'}</Text></TouchableOpacity>
            </>)}
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={tipo === 'pago' ? confirmarPago : guardarEntidad}><Text style={s.btnT}>{tipo === 'pago' ? 'Registrar pago y finalizar' : 'Guardar'}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Row({ k, v }) {
  return (<View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#eef0f2' }}><Text style={{ color: '#6b7480', fontSize: 13 }}>{k}</Text><Text style={{ fontWeight: '600', fontSize: 13, maxWidth: '60%', textAlign: 'right' }}>{v}</Text></View>);
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f3f4f6' },
  top: { backgroundColor: '#16191d', paddingTop: 52, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#2a3037', justifyContent: 'center', alignItems: 'center' },
  logo: { color: '#fff', fontSize: 17, fontWeight: '800' },
  logoImg: { width: 30, height: 30, borderRadius: 8 },
  role: { color: '#9aa3ad', fontSize: 11, marginTop: 2 },
  logout: { backgroundColor: '#262b31', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 11 },
  chips: { backgroundColor: '#16191d', paddingBottom: 12, maxHeight: 52, flexGrow: 0 },
  chip: { borderWidth: 1, borderColor: '#39414a', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#20262c' },
  chipOn: { backgroundColor: '#F5B700', borderColor: '#F5B700' },
  chipT: { color: '#cfd4db', fontWeight: '700', fontSize: 13 },
  kpisWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '31%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e7e9ec', padding: 12, alignItems: 'center' },
  kpiV: { fontSize: 19, fontWeight: '800', color: '#16191d' },
  kpiL: { fontSize: 10, color: '#6b7480', marginTop: 3, textAlign: 'center' },
  dashHead: { backgroundColor: '#16191d', borderRadius: 16, padding: 16, marginBottom: 12 },
  dashTaller: { color: '#fff', fontSize: 19, fontWeight: '800' },
  dashAdmin: { color: '#9aa3ad', fontSize: 12, marginTop: 2 },
  dashFecha: { color: '#6b7480', fontSize: 11, marginTop: 10, textTransform: 'capitalize' },
  factMes: { backgroundColor: '#F5B700', borderRadius: 16, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center' },
  factMesL: { color: '#5b4a00', fontSize: 12, fontWeight: '700' },
  factMesV: { color: '#16191d', fontSize: 26, fontWeight: '800', marginTop: 2 },
  ojo: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(0,0,0,.08)', justifyContent: 'center', alignItems: 'center' },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modCard: { width: '31%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e7e9ec', padding: 12 },
  modIcon: { width: 42, height: 42, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  modTitle: { fontSize: 13, fontWeight: '800', color: '#16191d' },
  modSub: { fontSize: 10, color: '#6b7480', marginTop: 2 },
  income: { backgroundColor: '#16191d', borderRadius: 14, padding: 16, marginTop: 12 },
  incomeL: { color: '#9aa3ad', fontSize: 12 }, incomeV: { color: '#F5B700', fontSize: 24, fontWeight: '800', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e7e9ec', padding: 14, marginBottom: 12 },
  veh: { fontSize: 15, fontWeight: '800' },
  pill: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  muted: { color: '#6b7480', fontSize: 13, marginTop: 5 }, muted2: { color: '#6b7480', fontSize: 13, padding: 16 },
  h: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#3a4048', marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 11, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  dateInp: { borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8, fontSize: 11, width: 100 },
  sep: { borderTopWidth: 1, borderColor: '#e7e9ec', marginTop: 14, paddingTop: 10 },
  sepT: { fontWeight: '800', fontSize: 13, color: '#16191d' },
  pick: { borderWidth: 1.5, borderColor: '#e7e9ec', borderRadius: 11, padding: 12, alignItems: 'center', marginTop: 12 },
  pickT: { fontWeight: '700', color: '#2563EB' },
  prev: { width: '100%', height: 140, borderRadius: 10, marginTop: 10 },
  fimg: { width: 46, height: 46, borderRadius: 8 },
  btn: { backgroundColor: '#F5B700', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  btnT: { fontWeight: '800', fontSize: 14, color: '#16191d' },
  err: { color: '#dc2626', padding: 16, fontSize: 13 },
  link: { color: '#2563EB', fontWeight: '700', fontSize: 12.5 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  secHeadT: { fontSize: 15, fontWeight: '800', color: '#16191d' },
  secCount: { backgroundColor: '#16191d', borderRadius: 10, minWidth: 22, height: 22, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  secCountT: { color: '#fff', fontSize: 12, fontWeight: '800' },
  mutedSmall: { color: '#9aa3ad', fontSize: 12.5, paddingVertical: 4 },
  progBar2: { height: 7, backgroundColor: '#e7e9ec', borderRadius: 4, overflow: 'hidden' },
  progFill2: { height: 7, backgroundColor: '#F5B700', borderRadius: 4 },
  ordCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e7e9ec', padding: 15, marginBottom: 11 },
  ordModel: { fontSize: 16, fontWeight: '800', color: '#16191d', flex: 1 },
  ordPlate: { backgroundColor: '#16191d', borderRadius: 7, paddingVertical: 3, paddingHorizontal: 9 },
  ordPlateT: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  ordWork: { color: '#6b7480', fontSize: 13.5, marginTop: 3 },
  ordMeta: { color: '#6b7480', fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 12 },
  act: { flex: 1, borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  actOk: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  actT: { fontSize: 12, fontWeight: '700', color: '#16191d' },
  addBtn: { backgroundColor: '#16191d', borderRadius: 12, padding: 13, alignItems: 'center' },
  addT: { color: '#fff', fontWeight: '800' },
  pillBtn: { borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: '#fff' },
  pillBtnOn: { backgroundColor: '#F5B700', borderColor: '#F5B700' },
  pillBtnOn2: { backgroundColor: '#F5B700', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13 },
  pillBtnT: { fontWeight: '700', color: '#6b7480', fontSize: 13 },
  compartirBtn: { marginTop: 10, backgroundColor: '#25D366', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  compartirBtnT: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  diagram: { backgroundColor: '#eef2f6', borderRadius: 14, height: 230, marginTop: 8, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#dfe4ea', justifyContent: 'center', alignItems: 'center' },
  diagramHead: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
  sosBanner: { paddingVertical: 12, paddingHorizontal: 16 },
  sosBannerT: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  avItem: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f3f5' },
  avIco: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f2f4f7', justifyContent: 'center', alignItems: 'center' },
  avTit: { fontSize: 13, fontWeight: '700', color: '#16191d' },
  avSub: { fontSize: 11.5, color: '#6b7480', marginTop: 2 },
  avImg: { width: '100%', height: 165, borderRadius: 10, marginTop: 8 },
  avVer: { fontSize: 11, color: '#2563EB', fontWeight: '700', marginTop: 4, textAlign: 'center' },
  avBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  avBtnT: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  zoomWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.93)', justifyContent: 'center', alignItems: 'center' },
  zoomImg: { width: '95%', height: '80%' },
  diagramHeadT: { color: '#8a929c', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  // vista superior
  carTop: { width: 110, height: 175, backgroundColor: '#fff', borderWidth: 2, borderColor: '#c2c9d2', borderRadius: 30, marginTop: 12 },
  carTopRoof: { position: 'absolute', top: '32%', left: '15%', right: '15%', height: '36%', backgroundColor: '#f2f5f8', borderWidth: 2, borderColor: '#d6dbe1', borderRadius: 10 },
  carTopGlass: { position: 'absolute', left: '20%', right: '20%', height: 16, backgroundColor: '#dfe6ee', borderRadius: 6 },
  wheelV: { position: 'absolute', width: 10, height: 30, backgroundColor: '#2b3138', borderRadius: 3 },
  // vista frontal / posterior
  carFront: { width: 175, height: 130, backgroundColor: '#fff', borderWidth: 2, borderColor: '#c2c9d2', borderRadius: 16, marginTop: 12 },
  carFrontGlass: { position: 'absolute', top: 12, left: 18, right: 18, height: 40, backgroundColor: '#dfe6ee', borderWidth: 2, borderColor: '#d6dbe1', borderRadius: 8 },
  carFrontBumper: { position: 'absolute', bottom: 10, left: 10, right: 10, height: 20, backgroundColor: '#e8edf2', borderRadius: 6 },
  lamp: { position: 'absolute', bottom: 38, width: 30, height: 14, backgroundColor: '#f0d98a', borderRadius: 4 },
  // vista lateral
  carSide: { width: 210, height: 95, backgroundColor: '#fff', borderWidth: 2, borderColor: '#c2c9d2', borderRadius: 18, marginTop: 12 },
  carSideRoof: { position: 'absolute', top: -22, left: 45, right: 55, height: 34, backgroundColor: '#fff', borderWidth: 2, borderColor: '#c2c9d2', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  carSideWindow: { position: 'absolute', top: -14, left: 55, right: 65, height: 22, backgroundColor: '#dfe6ee', borderRadius: 5 },
  wheelH: { position: 'absolute', bottom: -10, width: 30, height: 30, borderRadius: 15, backgroundColor: '#2b3138', borderWidth: 4, borderColor: '#6b7480' },
  pin: { position: 'absolute', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  pinT: { color: '#fff', fontSize: 11, fontWeight: '800' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34 },
});
