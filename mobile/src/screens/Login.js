import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, saveSession, getApiUrl, guardarApiUrl, cargarApiUrl, despertarServidor } from '../api';

const GRADS = [
  ['#0f2027', '#203a43', '#2c5364'],
  ['#232526', '#414345'],
  ['#1c1c22', '#2a1215'],
  ['#0b132b', '#1c2541', '#3a506b'],
  ['#14312e', '#0d1113'],
  ['#141e30', '#243b55'],
  ['#1f242b', '#0e1014'],
  ['#2b2118', '#12140f'],
];

export default function LoginScreen({ navigation }) {
  const [grad] = useState(() => GRADS[Math.floor(Math.random() * GRADS.length)]);
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [ident, setIdent] = useState('');
  const [metodo, setMetodo] = useState('correo');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [nuevaConfirmar, setNuevaConfirmar] = useState('');
  const [errorRecuperar, setErrorRecuperar] = useState('');
  const [step, setStep] = useState(1);
  const [srvOpen, setSrvOpen] = useState(false);
  const [cambioObl, setCambioObl] = useState(null); // {user, talleres, actual}
  const [nv1, setNv1] = useState('');
  const [nv2, setNv2] = useState('');
  const [verNv, setVerNv] = useState(false);
  const [errCambio, setErrCambio] = useState('');
  const [contactoOpen, setContactoOpen] = useState(false);
  const [contacto, setContacto] = useState(null);
  const HERO = [
    { t: 'Tu taller en el bolsillo', s: 'Órdenes, avances y clientes al instante.' },
    { t: 'Recepción con evidencia', s: 'Marca daños, firma y genera el acta.' },
    { t: 'Consejo: aceite a tiempo', s: 'Cámbialo cada 5.000–10.000 km.' },
    { t: 'Consejo: revisa los frenos', s: 'Inspección cada 15.000 km.' },
  ];
  const [heroI, setHeroI] = useState(0);
  React.useEffect(() => { const t = setInterval(() => setHeroI((i) => (i + 1) % HERO.length), 4500); return () => clearInterval(t); }, []);
  const [srvUrl, setSrvUrl] = useState('');
  React.useEffect(() => { cargarApiUrl().then((u) => { setSrvUrl(u || ''); if (!u) setSrvOpen(true); else despertarServidor(); }); }, []);
  const guardarServidor = async () => {
    if (!srvUrl.trim()) { Alert.alert('Falta la dirección', 'Escribe la dirección de tu servidor.'); return; }
    const u = await guardarApiUrl(srvUrl);
    setSrvUrl(u); setSrvOpen(false); setError('');
    Alert.alert('Servidor guardado', 'Ahora puedes iniciar sesión.\n\n' + u);
  };

  const abrirContacto = async () => {
    setContactoOpen(true);
    if (contacto) return;
    try {
      const d = await api('/api/config/contacto');
      setContacto(d);
    } catch (e) {
      setContacto({ mensaje: 'Para acceder a TallerOS, contáctanos.', correo: '', telefono: '' });
    }
  };
  const login = async () => {
    setError(''); setLoading(true);
    const avisoLento = setTimeout(() => setError('⏳ El servidor está iniciando, puede tardar unos segundos la primera vez…'), 4000);
    try {
      const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) });
      clearTimeout(avisoLento); setError('');
      await saveSession(d.token, d.user, d.talleres);
      // Si la contraseña es temporal, obligar a cambiarla antes de entrar
      if (d.user && d.user.mustChange) {
        setCambioObl({ user: d.user, talleres: d.talleres || [], actual: password });
        setLoading(false);
        return;
      }
      const esAdmin = d.user.rol === 'administrador' || d.user.rol === 'superadmin';
      const dest = esAdmin ? 'AdminHome' : 'Home';
      navigation.reset({ index: 0, routes: [{ name: dest, params: { me: d.user, talleres: d.talleres || [] } }] });
    } catch (e) {
      let msg = e.message || 'No se pudo conectar';
      if (msg === 'SIN_SERVIDOR') { setSrvOpen(true); msg = 'Primero configura la dirección del servidor (botón de abajo).'; }
      else if (msg.includes('Network') || msg.includes('fetch') || msg.includes('Failed')) { msg = 'No se pudo conectar con el servidor. Revisa tu internet o corrige la dirección del servidor abajo.'; setSrvOpen(true); }
      clearTimeout(avisoLento); setError(msg);
    } finally { setLoading(false); }
  };

  const enviarCodigo = async () => {
    setErrorRecuperar('');
    try {
      await api('/api/auth/recover', { method: 'POST', body: JSON.stringify({ identificador: ident, metodo }) });
      setStep(2);
    } catch (e) { setErrorRecuperar(e.message || 'No se pudo enviar el código.'); }
  };
  const verificarCodigo = async () => {
    setErrorRecuperar('');
    try {
      await api('/api/auth/verify-code', { method: 'POST', body: JSON.stringify({ identificador: ident, codigo }) });
      setStep(3);
    } catch (e) { setErrorRecuperar(e.message || 'Código inválido o vencido.'); }
  };
  const cambiar = async () => {
    setErrorRecuperar('');
    if (nueva.length < 6) { setErrorRecuperar('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (nueva !== nuevaConfirmar) { setErrorRecuperar('Las contraseñas no coinciden.'); return; }
    try {
      await api('/api/auth/reset', { method: 'POST', body: JSON.stringify({ identificador: ident, codigo, nueva }) });
      Alert.alert('Listo', 'Contraseña actualizada. Ya puedes iniciar sesión con tu contraseña nueva.');
      setRecovering(false); setStep(1); setIdent(''); setCodigo(''); setNueva(''); setNuevaConfirmar('');
    } catch (e) { setErrorRecuperar(e.message || 'No se pudo cambiar la contraseña.'); }
  };

  const confirmarCambioObl = async () => {
    setErrCambio('');
    if (nv1.length < 6) { setErrCambio('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (nv1 !== nv2) { setErrCambio('Las contraseñas no coinciden.'); return; }
    if (nv1 === cambioObl.actual) { setErrCambio('La nueva contraseña debe ser distinta a la temporal.'); return; }
    try {
      await api('/api/auth/mi-clave', { method: 'POST', body: JSON.stringify({ actual: cambioObl.actual, nueva: nv1 }) });
      const u = { ...cambioObl.user, mustChange: false };
      const tls = cambioObl.talleres;
      const esAdmin = u.rol === 'administrador' || u.rol === 'superadmin';
      const dest = esAdmin ? 'AdminHome' : 'Home';
      setCambioObl(null); setNv1(''); setNv2('');
      navigation.reset({ index: 0, routes: [{ name: dest, params: { me: u, talleres: tls } }] });
    } catch (e) { setErrCambio(e.message || 'No se pudo cambiar la contraseña'); }
  };

  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.hero}>
        <View style={s.heroBadge}><Text style={s.heroBadgeT}>TALLEROS</Text></View>
        <Text style={s.heroTit}>{HERO[heroI].t}</Text>
        <Text style={s.heroSub}>{HERO[heroI].s}</Text>
        <View style={s.heroDots}>
          {HERO.map((_, k) => <View key={k} style={[s.heroDot, k === heroI && s.heroDotOn]} />)}
        </View>
      </View>
      <View style={s.brand}><Text style={s.logo}>Taller<Text style={{ color: '#F5B700' }}>OS</Text></Text>
        <Text style={s.sub}>GESTIÓN DE TALLER</Text></View>

      <View style={s.card}>
        {!recovering ? (
          <>
            <Text style={s.h}>Iniciar sesión</Text>
            <Text style={s.label}>Usuario o correo</Text>
            <TextInput style={s.input} value={usuario} onChangeText={setUsuario} autoCapitalize="none" />
            <Text style={s.label}>Contraseña</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput style={[s.input, { paddingRight: 48 }]} value={password} onChangeText={setPassword} secureTextEntry={!verClave} autoCapitalize="none" />
              <TouchableOpacity style={{ position: 'absolute', right: 12, padding: 6 }} onPress={() => setVerClave(!verClave)}>
                <Text style={{ fontSize: 18 }}>{verClave ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {!!error && <Text style={s.err}>{error}</Text>}
            <TouchableOpacity style={s.btn} onPress={login} disabled={loading}>
              <Text style={s.btnT}>{loading ? 'Ingresando…' : 'Ingresar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRecovering(true); setStep(1); }}>
              <Text style={s.link}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={abrirContacto} style={{ marginTop: 6 }}>
              <Text style={s.link}>¿No tienes cuenta? Contáctanos</Text>
            </TouchableOpacity>
          </>
        ) : step === 1 ? (
          <>
            <Text style={s.h}>Recuperar contraseña</Text>
            <Text style={s.label}>Correo de la cuenta</Text>
            <TextInput style={s.input} value={ident} onChangeText={setIdent} autoCapitalize="none" keyboardType="email-address" />
            {errorRecuperar ? <Text style={{ color: '#dc2626', fontSize: 12.5, marginTop: 8 }}>{errorRecuperar}</Text> : null}
            <TouchableOpacity style={[s.btn, { marginTop: 10 }]} onPress={enviarCodigo}><Text style={s.btnT}>Siguiente</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setRecovering(false); setErrorRecuperar(''); }}><Text style={s.link}>Volver</Text></TouchableOpacity>
          </>
        ) : step === 2 ? (
          <>
            <Text style={s.h}>Verifica el código</Text>
            <Text style={{ fontSize: 12.5, color: '#6b7480', marginBottom: 10 }}>Te enviamos un código de 6 dígitos. Vence en 10 minutos.</Text>
            <Text style={s.label}>Código de 6 dígitos</Text>
            <TextInput style={s.input} value={codigo} onChangeText={setCodigo} keyboardType="number-pad" maxLength={6} />
            {errorRecuperar ? <Text style={{ color: '#dc2626', fontSize: 12.5, marginTop: 8 }}>{errorRecuperar}</Text> : null}
            <TouchableOpacity style={[s.btn, { marginTop: 10 }]} onPress={verificarCodigo}><Text style={s.btnT}>Siguiente</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep(1); setErrorRecuperar(''); }}><Text style={s.link}>Volver</Text></TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.h}>Nueva contraseña</Text>
            <Text style={s.label}>Nueva contraseña</Text>
            <TextInput style={s.input} value={nueva} onChangeText={setNueva} secureTextEntry placeholder="mínimo 6 caracteres" />
            <Text style={s.label}>Confirmar nueva contraseña</Text>
            <TextInput style={s.input} value={nuevaConfirmar} onChangeText={setNuevaConfirmar} secureTextEntry />
            {errorRecuperar ? <Text style={{ color: '#dc2626', fontSize: 12.5, marginTop: 8 }}>{errorRecuperar}</Text> : null}
            <TouchableOpacity style={[s.btn, { marginTop: 10 }]} onPress={cambiar}><Text style={s.btnT}>Cambiar contraseña</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setRecovering(false); setErrorRecuperar(''); }}><Text style={s.link}>Cancelar</Text></TouchableOpacity>
          </>
        )}
      </View>

      <Modal visible={!!cambioObl} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 22 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#16191d' }}>🔐 Cambia tu contraseña</Text>
            <Text style={{ fontSize: 13, color: '#6b7480', marginTop: 6, marginBottom: 16 }}>Por seguridad, la contraseña que te compartieron es temporal. Define una nueva para continuar.</Text>

            <Text style={s.label2}>Nueva contraseña</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput style={[s.input, { paddingRight: 46 }]} value={nv1} onChangeText={setNv1} secureTextEntry={!verNv} placeholder="mínimo 6 caracteres" placeholderTextColor="#9aa3ad" autoCapitalize="none" />
              <TouchableOpacity style={{ position: 'absolute', right: 12, padding: 6 }} onPress={() => setVerNv(!verNv)}>
                <Text style={{ fontSize: 17 }}>{verNv ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.label2}>Confirmar nueva contraseña</Text>
            <TextInput style={s.input} value={nv2} onChangeText={setNv2} secureTextEntry={!verNv} autoCapitalize="none" />

            {!!errCambio && <Text style={{ color: '#dc2626', marginTop: 10, fontSize: 13 }}>{errCambio}</Text>}

            <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={confirmarCambioObl}>
              <Text style={s.btnT}>Guardar y entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={contactoOpen} transparent animationType="fade" onRequestClose={() => setContactoOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 26, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 26 }}>🔧</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#16191d', textAlign: 'center' }}>TallerOS</Text>
            <Text style={{ fontSize: 14, color: '#4b5563', textAlign: 'center', marginTop: 10, lineHeight: 20 }}>
              {contacto ? (contacto.mensaje || 'Para acceder a TallerOS, contáctanos.') : 'Cargando…'}
            </Text>
            {contacto && contacto.correo ? (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginTop: 16, width: '100%', justifyContent: 'center' }} onPress={() => Linking.openURL('mailto:' + contacto.correo)}>
                <Text style={{ fontSize: 16 }}>✉️</Text>
                <Text style={{ color: '#16191d', fontWeight: '700', fontSize: 13.5 }}>{contacto.correo}</Text>
              </TouchableOpacity>
            ) : null}
            {contacto && contacto.telefono ? (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginTop: 10, width: '100%', justifyContent: 'center' }} onPress={() => Linking.openURL('https://wa.me/' + contacto.telefono.replace(/[^0-9]/g, ''))}>
                <Text style={{ fontSize: 16 }}>💬</Text>
                <Text style={{ color: '#166534', fontWeight: '700', fontSize: 13.5 }}>{contacto.telefono}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={{ marginTop: 18 }} onPress={() => setContactoOpen(false)}>
              <Text style={{ color: '#6b7480', fontWeight: '700', fontSize: 13.5 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', padding: 22 },
  brand: { alignItems: 'center', marginBottom: 26 },
  logo: { color: '#fff', fontSize: 34, fontWeight: '800' },
  sub: { color: '#9aa3ad', fontSize: 11, letterSpacing: 2, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 22 },
  h: { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#3a4048', marginTop: 12, marginBottom: 5 },
  label2: { fontSize: 12, fontWeight: '700', color: '#3a4048', marginTop: 12, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 11, padding: 13, fontSize: 15 },
  btn: { backgroundColor: '#F5B700', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 18 },
  btnT: { fontWeight: '800', fontSize: 15, color: '#16191d' },
  link: { color: '#2563EB', fontWeight: '700', textAlign: 'center', marginTop: 14 },
  hero: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 10 },
  heroBadge: { backgroundColor: 'rgba(245,183,0,0.18)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14 },
  heroBadgeT: { color: '#F5B700', fontWeight: '800', fontSize: 11, letterSpacing: 2 },
  heroTit: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 29 },
  heroSub: { color: '#c8d2e0', fontSize: 13.5, textAlign: 'center', marginTop: 6 },
  heroDots: { flexDirection: 'row', gap: 6, marginTop: 16 },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroDotOn: { width: 20, backgroundColor: '#F5B700' },
  srvBox: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  srvTit: { color: '#fff', fontWeight: '800', fontSize: 13.5, marginBottom: 3 },
  srvSub: { color: '#aeb6bf', fontSize: 11.5, marginBottom: 10 },
  srvBtn: { backgroundColor: '#F5B700', borderRadius: 11, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  srvBtnT: { color: '#16191d', fontWeight: '800', fontSize: 13.5 },
  err: { color: '#dc2626', marginTop: 10, fontSize: 13 },
  hint: { color: '#6b7480', fontSize: 11, textAlign: 'center', marginTop: 14 },
  method: { flex: 1, borderWidth: 1.5, borderColor: '#e7e9ec', borderRadius: 11, padding: 13, alignItems: 'center' },
  methodOn: { borderColor: '#16191d', backgroundColor: '#f6f7f8' },
});
