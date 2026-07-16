import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert, ScrollView, TextInput, Image, Modal, Pressable, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, getState, putState, clearSession, API_URL } from '../api';
import { compartirActaPDF } from '../acta';
import { Dropdown, FirmaPad, FirmaVista, CarroSVG, etiqueta } from '../ui';

const STATUS = {
  espera: { l: 'En espera', c: '#64748B' }, rep: { l: 'En reparación', c: '#D97706' },
  wait: { l: 'Esp. repuestos', c: '#D97706' }, reprog: { l: 'Reprogramado', c: '#7c3aed' },
  term: { l: 'Terminado', c: '#16A34A' }, dev: { l: 'Devolución', c: '#dc2626' }, ent: { l: 'Entregado', c: '#2563EB' },
};
const LADOS = [['sup', 'Superior'], ['front', 'Frontal'], ['izq', 'Lat. Izq.'], ['der', 'Lat. Der.'], ['post', 'Posterior']];
const LADO_NOMBRE = { sup: 'Superior', front: 'Frontal', izq: 'Lat. Izq.', der: 'Lat. Der.', post: 'Posterior' };
const TIPOS = ['Rayón', 'Abolladura', 'Golpe', 'Vidrio', 'Óxido', 'Faltante'];
const FUEL = ['E', '¼', '½', '¾', 'F'];
const ACCS = ['Radio', 'Gato', 'Llave cruz', 'Extintor', 'Triángulo', 'Repuesto', 'Alfombras', 'Antena'];
const DOCS_VEH = ['Cédula', 'Circulación', 'Título', 'Seguro'];
const PRIOS = ['Baja', 'Media', 'Alta', 'Urgente'];
const TIPO_VEH = ['Automóvil', 'Camioneta / SUV', 'Motocicleta', 'Moto taxi', 'Camión', 'Bus', 'Van'];
const TIPO_DOC = ['Cédula V', 'Cédula E', 'RIF', 'Pasaporte'];
const TIPOS_VEH = ['Automóvil', 'Camioneta', 'SUV', 'Motocicleta', 'Moto taxi', 'Camión', 'Bus', 'Van'];
const COLORES = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Marrón', 'Beige', 'Dorado', 'Vino tinto', 'Celeste'];
const MOTIVOS_BASE = ['Ruido extraño', 'Revisión general', 'Falla eléctrica', 'Recalentamiento', 'Mantenimiento preventivo', 'Choque / golpe', 'No enciende', 'Fuga de aceite'];
const TRABAJOS_BASE = ['Cambio de aceite', 'Frenos', 'Motor', 'Suspensión', 'Sistema eléctrico', 'Aire acondicionado', 'Latonería y pintura', 'Alineación y balanceo', 'Diagnóstico'];
const ESP_BASE = ['General', 'Motor', 'Frenos', 'Electricidad', 'Suspensión', 'Latonería y pintura', 'Aire acondicionado', 'Diagnóstico'];
const MARCAS_BASE = ['Toyota', 'Chevrolet', 'Ford', 'Hyundai', 'Kia', 'Renault', 'Fiat', 'Jeep', 'Nissan', 'Mitsubishi'];
const nid = (arr) => Math.max(0, ...(arr || []).map((x) => +x.id || 0)) + 1;
const inits = (str) => (str || '').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

export default function AdminHomeScreen({ navigation, route }) {
  const me = route.params?.me || {};
  const esSuper = me.rol === 'superadmin';
  const [talleres, setTalleres] = useState(route.params?.talleres || []);
  const [taller, setTaller] = useState(null);
  const [data, setData] = useState({});
  const [tab, setTab] = useState('inicio');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
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

  const salir = async () => { await clearSession(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); };

  const cur = (data.config && data.config.currency && data.config.currency.sym) || 'Bs.';
  const clients = data.clients || [];
  const vehicles = data.vehicles || [];
  const mecanicos = data.mecanicos || [];
  const V = vehicles.filter((v) => v.activo !== false && v.recepcion && !v.cerrada);

  const kpis = {
    espera: V.filter((v) => v.status === 'espera' || v.status === 'reprog').length,
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
    { k: 'cli', ic: '👥', c: '#7c3aed', t: 'Clientes', s: kpis.clientes + ' activos' },
    { k: 'veh', ic: '🚗', c: '#0f766e', t: 'Vehículos', s: vehicles.length + ' registrados' },
    { k: 'mec', ic: '🛠️', c: '#be185d', t: 'Mecánicos', s: kpis.mecanicos + ' activos' },
    { k: 'fact', ic: '🧾', c: '#334155', t: 'Facturación', s: 'Pagos y facturas' },
    { k: 'usuarios', ic: '🔐', c: '#0f766e', t: 'Usuarios', s: 'Accesos' },
    { k: 'config', ic: '⚙️', c: '#64748b', t: 'Config', s: 'Parámetros' },
  ];
  if (esSuper) MODULOS.push({ k: 'talleres', ic: '🏭', c: '#16191d', t: 'Talleres', s: 'Administrar' });

  const TITULOS = { dash: 'Dashboard', recep: 'Recepción digital', ordenes: 'Órdenes de taller', hist: 'Trabajos realizados', cli: 'Clientes', veh: 'Vehículos', mec: 'Mecánicos', fact: 'Facturación', usuarios: 'Usuarios y accesos', config: 'Configuración', talleres: 'Talleres' };

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
      <TouchableOpacity style={s.logout} onPress={salir}><Text style={{ color: '#fff', fontSize: 12 }}>Salir</Text></TouchableOpacity>
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

      {!!error && <Text style={s.err}>{error}</Text>}
      {!taller && !error && <Text style={s.muted2}>Selecciona un taller para comenzar.</Text>}

      {/* ---------- INICIO: tarjetas por módulo ---------- */}
      {tab === 'inicio' && taller && <Inicio data={data} cur={cur} kpis={kpis} taller={taller} me={me} modulos={MODULOS} onNav={setTab} loading={loading} recargar={recargar} />}

      {tab === 'dash' && taller && <Dashboard data={data} cur={cur} kpis={kpis} V={V} loading={loading} recargar={recargar} />}
      {tab === 'recep' && taller && <Recepcion data={data} guardar={guardar} onListo={() => setTab('ordenes')} />}

      {tab === 'ordenes' && taller && (() => {
        const grupos = [
          { k: 'espera', t: 'En espera', filtro: (v) => v.status === 'espera' || v.status === 'reprog' },
          { k: 'rep', t: 'Trabajando', filtro: (v) => v.status === 'rep' || v.status === 'wait' },
          { k: 'term', t: 'Terminado', filtro: (v) => v.status === 'term' },
        ];
        return (
          <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}>
            {!V.length && !loading ? <Text style={s.muted}>Sin vehículos recibidos. Registra una recepción para generar la orden.</Text> : null}
            {grupos.map((g) => {
              const items = V.filter(g.filtro);
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
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Text style={s.ordModel}>{item.model || 'Vehículo'}</Text>
                          <View style={s.ordPlate}><Text style={s.ordPlateT}>{item.plate || ''}</Text></View>
                        </View>
                        <Text style={s.ordWork}>{item.motivo || '—'}</Text>
                        <View style={[s.pill, { backgroundColor: (st.c || '#64748B') + '22', alignSelf: 'flex-start', marginTop: 6 }]}><Text style={[s.pillT, { color: st.c }]}>● {st.l}</Text></View>
                        <Text style={s.ordMeta}>👤 {item.owner || 'Cliente'}{cli && cli.tel ? '' : ''} · 🔧 {item.mech || 'sin mecánico'}</Text>
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
                          <TouchableOpacity onPress={() => setModal({ tipo: 'acta', item })}><Text style={s.link}>Ver acta →</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => compartirActaPDF(taller.id, item)}><Text style={s.link}>Compartir acta (PDF) →</Text></TouchableOpacity>
                        </View>
                      </View>
                    );
                  }) : <Text style={s.mutedSmall}>Sin vehículos en este estado.</Text>}
                </View>
              );
            })}
          </ScrollView>
        );
      })()}

      {tab === 'hist' && taller && <Historial data={data} guardar={guardar} cur={cur} loading={loading} recargar={recargar} pickFoto={pickFoto} taller={taller} />}

      {tab === 'cli' && taller && (
        <Listado titulo="＋ Nuevo cliente" onAdd={() => setModal({ tipo: 'cliente', item: null })} datos={clients} loading={loading} recargar={recargar} vacio="Sin clientes."
          render={(item) => (
            <TouchableOpacity style={s.card} onPress={() => setModal({ tipo: 'cliente', item })}>
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
        <Listado titulo="＋ Nuevo mecánico" onAdd={() => setModal({ tipo: 'mecanico', item: null })} datos={mecanicos} loading={loading} recargar={recargar} vacio="Sin mecánicos."
          render={(item) => (
            <TouchableOpacity style={s.card} onPress={() => setModal({ tipo: 'mecanico', item })}>
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
      {modal && modal.tipo !== 'acta' && <FormModal modal={modal} close={() => setModal(null)} data={data} guardar={guardar} cur={cur} pickFoto={pickFoto} taller={taller} />}
    </View>
  );
}

/* =================== LISTADO GENÉRICO =================== */
function Listado({ titulo, onAdd, datos, loading, recargar, vacio, render }) {
  const [q, setQ] = useState('');
  const filtrados = (datos || []).filter((x) => {
    if (!q.trim()) return true;
    const t = (JSON.stringify(x) || '').toLowerCase();
    return t.includes(q.toLowerCase());
  });
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 14, paddingBottom: 0, gap: 10 }}>
        <TextInput style={s.input} value={q} onChangeText={setQ} placeholder="Buscar…" />
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
  const [verMonto, setVerMonto] = useState(false);
  const now = new Date();
  const mes = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const pagos = []; (data.history || []).forEach((h) => { (h.pagos || []).forEach((p) => pagos.push(p)); });
  const factMes = pagos.filter((p) => (p.fechaISO || '').slice(0, 7) === mes).reduce((a, p) => a + (+p.monto || 0), 0);
  const fechaTxt = now.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + now.toTimeString().slice(0, 5);
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}>
      <View style={s.dashHead}>
        <Text style={s.dashTaller}>{taller.nombre}</Text>
        <Text style={s.dashAdmin}>{me.nombre}</Text>
        <Text style={s.dashFecha}>{fechaTxt}</Text>
      </View>
      <View style={s.factMes}>
        <View style={{ flex: 1 }}>
          <Text style={s.factMesL}>Facturación del mes</Text>
          <Text style={s.factMesV}>{verMonto ? cur + ' ' + factMes.toLocaleString('es-VE') : '••••••'}</Text>
        </View>
        <TouchableOpacity onPress={() => setVerMonto(!verMonto)} style={s.ojo}><Text style={{ fontSize: 20 }}>{verMonto ? '🙈' : '👁️'}</Text></TouchableOpacity>
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
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}>
      <View style={s.kpisWrap}>
        <K label="Trabajos del mes" value={trabMes} /><K label="Órdenes abiertas" value={V.length} /><K label="Órdenes finalizadas" value={kpis.entregados} />
        <K label="En reparación" value={kpis.rep} /><K label="Terminados" value={kpis.term} /><K label="En espera" value={kpis.espera} />
        <K label="Clientes" value={kpis.clientes} /><K label="Mecánicos" value={kpis.mecanicos} /><K label="Facturado mes" value={cur + ' ' + (factMes >= 1000 ? (factMes / 1000).toFixed(1) + 'k' : factMes)} />
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
          <TextInput style={s.dateInp} value={from} onChangeText={setFrom} />
          <Text style={{ color: '#6b7480', fontSize: 11 }}>a</Text>
          <TextInput style={s.dateInp} value={to} onChangeText={setTo} />
        </View>
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
  const cfg = data.config || {};
  const vehicles = data.vehicles || [];
  const clients = (data.clients || []).filter((c) => c.activo !== false);
  const mecanicos = (data.mecanicos || []).filter((m) => m.activo !== false);

  const [motivos, setMotivos] = useState((cfg.motivos && cfg.motivos.length) ? cfg.motivos : MOTIVOS_BASE);
  const [trabajos, setTrabajos] = useState((cfg.trabajos && cfg.trabajos.length) ? cfg.trabajos : TRABAJOS_BASE);

  const [tipos, setTipos] = useState((cfg.tiposDano && cfg.tiposDano.length) ? cfg.tiposDano : TIPOS);
  const [accesorios, setAccesorios] = useState((cfg.accesorios && cfg.accesorios.length) ? cfg.accesorios : ACCS);
  const [cliente, setCliente] = useState('');
  const [vehId, setVehId] = useState(null);
  const [mech, setMech] = useState('');
  const [tipoVeh, setTipoVeh] = useState('Automóvil');
  const [color, setColor] = useState('');
  const [lado, setLado] = useState('sup');
  const [tipo, setTipo] = useState((cfg.tiposDano && cfg.tiposDano[0]) || 'Rayón');
  const [sev, setSev] = useState('leve');
  const [dmg, setDmg] = useState({ sup: [], front: [], izq: [], der: [], post: [] });
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
  const togArr = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const marcar = (e) => { const { locationX, locationY } = e.nativeEvent; setDmg((d) => ({ ...d, [lado]: [...d[lado], { x: locationX, y: locationY, tipo, sev }] })); };
  const total = Object.values(dmg).reduce((a, arr) => a + arr.length, 0);

  const confirmar = () => {
    if (!cliente) { Alert.alert('Falta', 'Selecciona un cliente.'); return; }
    if (!vehId) { Alert.alert('Falta', 'Selecciona un vehículo.'); return; }
    if (!trabajo.trim()) { Alert.alert('Falta', 'Indica el trabajo a realizar.'); return; }
    let n = 0; const dmgs = []; const ladosCon = [];
    LADOS.forEach(([k]) => { (dmg[k] || []).forEach((dd) => { n++; dmgs.push({ n, tipo: dd.tipo, sev: dd.sev, lado: LADO_NOMBRE[k] }); }); if ((dmg[k] || []).length) ladosCon.push(LADO_NOMBRE[k]); });
    const now = new Date();
    const vs = vehicles.map((v) => v.id !== vehId ? v : {
      ...v, status: 'espera', progress: 0, cerrada: false, motivo: trabajo, mech: mech || v.mech || null,
      color: color || v.color, tipoVeh,
      ingreso: now.toISOString().slice(0, 10), recepDamages: dmgs, recepLados: ladosCon,
      recepcion: { fecha: now.toLocaleDateString('es-VE'), hora: now.toTimeString().slice(0, 5), tipoVeh, color, motivo, trabajo, prioridad: prio, combustible: comb, km: km || '—', accesorios: acc, documentos: docs, obs, via: 'App', firmaCli, firmaRec },
      advances: [...(v.advances || []), { t: 'Vehículo recibido — recepción digital (app)', m: (motivo || trabajo) + ' · ' + dmgs.length + ' daño(s)', type: 'recep', ago: 'ahora' }],
    });
    // guarda también los catálogos nuevos (motivos/trabajos/marcas) para que la web los vea
    guardar({ ...data, vehicles: vs, config: { ...cfg, motivos, trabajos, tiposDano: tipos, accesorios } });
    setDmg({ sup: [], front: [], izq: [], der: [], post: [] }); setMotivo(''); setTrabajo(''); setAcc([]); setDocs([]); setObs('');
    setFirmaCli(null); setFirmaRec(null); setKm(''); setMech(''); setColor(''); setTipoVeh('Automóvil');
    Alert.alert('Recepción registrada ✓', 'Se generó la Orden de Trabajo. El vehículo ya está en el módulo Órdenes.', [{ text: 'Ver órdenes', onPress: onListo }, { text: 'Seguir aquí' }]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Dropdown label="Cliente" obligatorio value={cliente} placeholder="Selecciona el cliente"
        options={clients.map((c) => c.n)}
        onChange={(v) => { setCliente(v); const nc = vehicles.filter((x) => x.owner === v && x.activo !== false); setVehId(nc[0] ? nc[0].id : null); }}
        textoVacio="Aún no hay clientes. Regístralos en el módulo Clientes." />
      {cSel ? <Text style={s.muted}>{cSel.tipoDoc || ''} {cSel.doc || ''} · {cSel.tel || ''} · {cSel.correo || ''}</Text> : null}

      <Dropdown label="Vehículo del cliente" obligatorio value={vSel ? (vSel.model + ' · ' + vSel.plate) : ''}
        placeholder={cliente ? 'Selecciona el vehículo' : 'Primero elige el cliente'}
        deshabilitado={!cliente}
        options={cvs.map((v) => v.model + ' · ' + v.plate)}
        onChange={(txt) => { const v = cvs.find((x) => (x.model + ' · ' + x.plate) === txt); setVehId(v ? v.id : null); if (v && v.color) setColor(v.color); }}
        textoVacio="Este cliente no tiene vehículos. Regístralos en el módulo Vehículos." />

      <Dropdown label="Tipo de vehículo" value={tipoVeh} options={TIPOS_VEH} onChange={setTipoVeh} onAdd={() => {}} />
      <Dropdown label="Color" value={color} placeholder="Selecciona el color" options={COLORES} onChange={setColor} onAdd={(t) => {}} />

      <Dropdown label="Mecánico responsable" value={mech} placeholder="Selecciona el mecánico"
        options={mecanicos.map((m) => m.n)} onChange={setMech}
        textoVacio="No hay mecánicos activos. Regístralos en el módulo Mecánicos." />

      <Dropdown label="Tipo de vehículo" value={tipoVeh} options={TIPO_VEH} onChange={setTipoVeh} />
      <Dropdown label="Color" value={color} placeholder="Selecciona el color" options={COLORES} onChange={setColor} onAdd={() => {}} />

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
      <Pressable style={s.diagram} onPress={marcar}>
        <View style={s.diagramHead}><Text style={s.diagramHeadT}>{(LADO_NOMBRE[lado] || '').toUpperCase()}</Text></View>
        <View style={[lado === 'der' && { transform: [{ scaleX: -1 }] }]} pointerEvents="none">
          <CarroSVG lado={lado} />
        </View>
        {(dmg[lado] || []).map((dd, i) => (
          <View key={i} style={[s.pin, { left: dd.x - 11, top: dd.y - 11, backgroundColor: dd.sev === 'grave' ? '#dc2626' : dd.sev === 'mod' ? '#D97706' : '#2563EB' }]}><Text style={s.pinT}>{i + 1}</Text></View>
        ))}
      </Pressable>

      <Dropdown label="Tipo de daño" value={tipo} options={tipos} onChange={setTipo} onAdd={(t) => setTipos([...tipos, t])} />
      <Text style={s.label}>Severidad</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[['leve', 'Leve'], ['mod', 'Moderado'], ['grave', 'Grave']].map(([k, l]) => (<TouchableOpacity key={k} style={[s.pillBtn, sev === k && s.pillBtnOn]} onPress={() => setSev(k)}><Text style={[s.pillBtnT, sev === k && { color: '#16191d' }]}>{l}</Text></TouchableOpacity>))}
      </View>

      <Dropdown label="Combustible" value={comb} options={FUEL} onChange={setComb} />
      <Text style={s.label}>Kilometraje</Text><TextInput style={s.input} value={km} onChangeText={setKm} keyboardType="numeric" placeholder="Ej. 85000" />

      <Text style={s.label}>Accesorios recibidos</Text>
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
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {DOCS_VEH.map((dd) => (<TouchableOpacity key={dd} style={[s.pillBtn, docs.includes(dd) && s.pillBtnOn]} onPress={() => togArr(docs, setDocs, dd)}><Text style={[s.pillBtnT, docs.includes(dd) && { color: '#16191d' }]}>{dd}</Text></TouchableOpacity>))}
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
function Historial({ data, guardar, cur, loading, recargar, pickFoto, taller }) {
  const hist = data.history || [];
  const [selIdx, setSelIdx] = useState(null);
  const [ab, setAb] = useState({ monto: '', codigo: '', prox: '', foto: null });
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
    const txt = 'TALLER ' + (taller ? taller.nombre : '') + '\nTrabajo: ' + x.trabajo + '\nVehículo: ' + x.veh + ' (' + x.placa + ')\nCliente: ' + x.cliente + '\nFecha: ' + x.fecha + '\nTotal: ' + cur + ' ' + (+x.total || 0) + '\nPagado: ' + cur + ' ' + (+x.pagado || 0) + '\nSaldo: ' + cur + ' ' + (+x.saldo || 0);
    Alert.alert('Resumen del trabajo', txt + '\n\n(Para PDF e impresión usa la plataforma web.)');
  };
  return (
    <View style={{ flex: 1 }}>
      <FlatList data={hist} keyExtractor={(x, i) => String(x.id || i)} contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={recargar} />}
        ListEmptyComponent={!loading && <Text style={s.muted}>Aún no hay trabajos realizados.</Text>}
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
            <TouchableOpacity onPress={() => compartir(item)} style={{ marginTop: 8 }}><Text style={s.link}>Compartir resumen →</Text></TouchableOpacity>
          </View>
        )} />
      <Modal visible={h != null} transparent animationType="slide" onRequestClose={() => setSelIdx(null)}>
        <View style={s.modalWrap}><View style={s.modalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={s.h}>{h ? h.veh : ''}</Text><TouchableOpacity onPress={() => setSelIdx(null)}><Text style={{ fontSize: 20, color: '#6b7480' }}>✕</Text></TouchableOpacity>
          </View>
          {h && (<ScrollView style={{ maxHeight: 470 }}>
            <Text style={s.muted}>{h.fecha} · {h.cliente} · {h.placa}</Text>
            <Row k="Trabajo" v={h.trabajo} /><Row k="Mecánico" v={h.mech} />
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
    </View>
  );
}

/* =================== ACTA =================== */
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
          <Row k="Mecánico" v={item.mech || 'Por asignar'} />
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
  const RB = { superadmin: 'Super Admin', administrador: 'Administrador', mecanico: 'Mecánico', cliente: 'Cliente' };
  const roles = [['administrador', 'Administrador'], ['superadmin', 'Super Admin'], ['mecanico', 'Mecánico'], ['cliente', 'Cliente']];
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
    if (tipo === 'cliente') return item ? { ...item, password: '', password2: '' } : { n: '', tipoDoc: 'Cédula V', doc: '', tel: '', correo: '', dir: '', usuario: '', password: '', password2: '', activo: true };
    if (tipo === 'vehiculo') return item ? { ...item } : { marca: '', modelo: '', anio: '', plate: '', owner: '', color: '', activo: true };
    if (tipo === 'mecanico') return item ? { ...item, password: '', password2: '' } : { n: '', sp: 'General', doc: '', tel: '', correo: '', usuario: '', password: '', password2: '', activo: true };
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

  const guardarEntidad = async () => {
    if (tipo === 'cliente') {
      if (!f.n) { Alert.alert('Falta', 'Nombre del cliente.'); return; }
      const ok = await crearCuenta('cliente'); if (!ok) return;
      const limpio = { ...f }; delete limpio.password; delete limpio.password2;
      let arr = data.clients || [];
      if (item) arr = arr.map((c) => (c.id === item.id ? { ...c, ...limpio } : c));
      else arr = [...arr, { ...limpio, id: nid(arr), ini: inits(f.n), gas: 0 }];
      guardar({ ...data, clients: arr }); close();
    } else if (tipo === 'vehiculo') {
      if (!f.marca || !f.plate) { Alert.alert('Falta', 'Marca y placa.'); return; }
      if (!f.owner) { Alert.alert('Falta', 'Selecciona el propietario.'); return; }
      const model = (f.marca + ' ' + f.modelo + (f.anio ? ' ' + f.anio : '')).trim();
      let arr = data.vehicles || [];
      if (item) arr = arr.map((v) => (v.id === item.id ? { ...v, ...f, model } : v));
      else arr = [...arr, { ...f, id: nid(arr), model, ini: inits(f.marca + ' ' + f.modelo), status: 'espera', progress: 0, mech: null, motivo: 'Por definir', cost: 0, recepcion: null, cerrada: false, recepDamages: [], advances: [] }];
      guardar({ ...data, vehicles: arr, config: cfgMerge }); close();
    } else if (tipo === 'mecanico') {
      if (!f.n) { Alert.alert('Falta', 'Nombre del mecánico.'); return; }
      const ok = await crearCuenta('mecanico'); if (!ok) return;
      const limpio = { ...f }; delete limpio.password; delete limpio.password2;
      let arr = data.mecanicos || [];
      if (item) arr = arr.map((m) => (m.id === item.id ? { ...m, ...limpio } : m));
      else arr = [...arr, { ...limpio, id: nid(arr), ini: inits(f.n), c: '#2563EB', rat: 5, base: 0 }];
      guardar({ ...data, mecanicos: arr, config: cfgMerge }); close();
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

  const titulos = { cliente: item ? 'Editar cliente' : 'Nuevo cliente', vehiculo: item ? 'Editar vehículo' : 'Nuevo vehículo', mecanico: item ? 'Editar mecánico' : 'Nuevo mecánico', pago: 'Pago del servicio' };

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
              <Text style={s.label}>Teléfono / WhatsApp</Text><TextInput style={s.input} value={f.tel} onChangeText={(v) => set('tel', v)} keyboardType="phone-pad" />
              <Text style={s.label}>Correo electrónico</Text><TextInput style={s.input} value={f.correo} onChangeText={(v) => set('correo', v)} autoCapitalize="none" keyboardType="email-address" />
              <Text style={s.label}>Dirección</Text><TextInput style={s.input} value={f.dir} onChangeText={(v) => set('dir', v)} />
              <View style={s.sep}><Text style={s.sepT}>Acceso del cliente a la app</Text></View>
              <Text style={s.label}>Usuario de acceso</Text><TextInput style={s.input} value={f.usuario} onChangeText={(v) => set('usuario', v)} autoCapitalize="none" />
              <Text style={s.label}>Contraseña</Text><TextInput style={s.input} value={f.password} onChangeText={(v) => set('password', v)} secureTextEntry placeholder={item ? 'Dejar vacío para no cambiar' : 'mínimo 6 caracteres'} />
              <Text style={s.label}>Confirmar contraseña</Text><TextInput style={s.input} value={f.password2} onChangeText={(v) => set('password2', v)} secureTextEntry />
              <Text style={s.label}>Estado</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[[true, 'Activo'], [false, 'Inactivo']].map(([k, l]) => (<TouchableOpacity key={String(k)} style={[s.pillBtn, f.activo === k && s.pillBtnOn]} onPress={() => set('activo', k)}><Text style={[s.pillBtnT, f.activo === k && { color: '#16191d' }]}>{l}</Text></TouchableOpacity>))}
              </View>
            </>)}
            {tipo === 'vehiculo' && (<>
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
              <Dropdown label="Propietario" obligatorio value={f.owner} onChange={(v) => set('owner', v)}
                options={(data.clients || []).map((c) => c.n)} placeholder="Selecciona el propietario"
                textoVacio="Aún no hay clientes. Regístralos primero." />
            </>)}
            {tipo === 'mecanico' && (<>
              <Text style={s.label}>Nombre completo *</Text><TextInput style={s.input} value={f.n} onChangeText={(v) => set('n', v)} />
              <Dropdown label="Especialidad" value={f.sp} onChange={(v) => set('sp', v)} options={espOpts} placeholder="Selecciona la especialidad" onAdd={(t) => setEspOpts([...espOpts, t])} />
              <Text style={s.label}>Documento</Text><TextInput style={s.input} value={f.doc} onChangeText={(v) => set('doc', v)} />
              <Text style={s.label}>Teléfono</Text><TextInput style={s.input} value={f.tel} onChangeText={(v) => set('tel', v)} keyboardType="phone-pad" />
              <Text style={s.label}>Correo electrónico</Text><TextInput style={s.input} value={f.correo} onChangeText={(v) => set('correo', v)} autoCapitalize="none" keyboardType="email-address" />
              <View style={s.sep}><Text style={s.sepT}>Acceso del mecánico a la app</Text></View>
              <Text style={s.label}>Usuario de acceso</Text><TextInput style={s.input} value={f.usuario} onChangeText={(v) => set('usuario', v)} autoCapitalize="none" />
              <Text style={s.label}>Contraseña</Text><TextInput style={s.input} value={f.password} onChangeText={(v) => set('password', v)} secureTextEntry placeholder={item ? 'Dejar vacío para no cambiar' : 'mínimo 6 caracteres'} />
              <Text style={s.label}>Confirmar contraseña</Text><TextInput style={s.input} value={f.password2} onChangeText={(v) => set('password2', v)} secureTextEntry />
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
  diagram: { backgroundColor: '#eef2f6', borderRadius: 14, height: 230, marginTop: 8, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#dfe4ea', justifyContent: 'center', alignItems: 'center' },
  diagramHead: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
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
