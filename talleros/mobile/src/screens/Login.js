import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, saveSession } from '../api';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [ident, setIdent] = useState('');
  const [metodo, setMetodo] = useState('whatsapp');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [step, setStep] = useState(1);

  const login = async () => {
    setError(''); setLoading(true);
    try {
      const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) });
      await saveSession(d.token, d.user, d.talleres);
      const esAdmin = d.user.rol === 'administrador' || d.user.rol === 'superadmin';
      const dest = esAdmin ? 'AdminHome' : 'Home';
      navigation.reset({ index: 0, routes: [{ name: dest, params: { me: d.user, talleres: d.talleres || [] } }] });
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const enviarCodigo = async () => {
    try {
      await api('/api/auth/recover', { method: 'POST', body: JSON.stringify({ identificador: ident, metodo }) });
      setStep(2);
    } catch (e) { Alert.alert('Error', e.message); }
  };
  const cambiar = async () => {
    try {
      await api('/api/auth/reset', { method: 'POST', body: JSON.stringify({ identificador: ident, codigo, nueva }) });
      Alert.alert('Listo', 'Contraseña actualizada. Inicia sesión.');
      setRecovering(false); setStep(1);
    } catch (e) { Alert.alert('Error', e.message); }
  };

  return (
    <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.brand}><Text style={s.logo}>Taller<Text style={{ color: '#F5B700' }}>OS</Text></Text>
        <Text style={s.sub}>GESTIÓN DE TALLER · VENEZUELA</Text></View>

      <View style={s.card}>
        {!recovering ? (
          <>
            <Text style={s.h}>Iniciar sesión</Text>
            <Text style={s.label}>Usuario o correo</Text>
            <TextInput style={s.input} value={usuario} onChangeText={setUsuario} autoCapitalize="none" />
            <Text style={s.label}>Contraseña</Text>
            <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry />
            {!!error && <Text style={s.err}>{error}</Text>}
            <TouchableOpacity style={s.btn} onPress={login} disabled={loading}>
              <Text style={s.btnT}>{loading ? 'Ingresando…' : 'Ingresar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRecovering(true); setStep(1); }}>
              <Text style={s.link}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </>
        ) : step === 1 ? (
          <>
            <Text style={s.h}>Recuperar contraseña</Text>
            <Text style={s.label}>Usuario o correo</Text>
            <TextInput style={s.input} value={ident} onChangeText={setIdent} autoCapitalize="none" />
            <Text style={s.label}>¿Cómo recibir el código?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['whatsapp', 'correo'].map((m) => (
                <TouchableOpacity key={m} style={[s.method, metodo === m && s.methodOn]} onPress={() => setMetodo(m)}>
                  <Text style={{ fontWeight: '700', color: metodo === m ? '#16191d' : '#6b7480' }}>{m === 'whatsapp' ? 'WhatsApp' : 'Correo'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.btn} onPress={enviarCodigo}><Text style={s.btnT}>Enviar código</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setRecovering(false)}><Text style={s.link}>Volver</Text></TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.h}>Verifica e ingresa nueva clave</Text>
            <Text style={s.label}>Código de 6 dígitos</Text>
            <TextInput style={s.input} value={codigo} onChangeText={setCodigo} keyboardType="number-pad" />
            <Text style={s.label}>Nueva contraseña</Text>
            <TextInput style={s.input} value={nueva} onChangeText={setNueva} secureTextEntry />
            <TouchableOpacity style={s.btn} onPress={cambiar}><Text style={s.btnT}>Cambiar contraseña</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setRecovering(false)}><Text style={s.link}>Volver</Text></TouchableOpacity>
          </>
        )}
      </View>
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
  input: { borderWidth: 1, borderColor: '#e7e9ec', borderRadius: 11, padding: 13, fontSize: 15 },
  btn: { backgroundColor: '#F5B700', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 18 },
  btnT: { fontWeight: '800', fontSize: 15, color: '#16191d' },
  link: { color: '#2563EB', fontWeight: '700', textAlign: 'center', marginTop: 14 },
  err: { color: '#dc2626', marginTop: 10, fontSize: 13 },
  hint: { color: '#6b7480', fontSize: 11, textAlign: 'center', marginTop: 14 },
  method: { flex: 1, borderWidth: 1.5, borderColor: '#e7e9ec', borderRadius: 11, padding: 13, alignItems: 'center' },
  methodOn: { borderColor: '#16191d', backgroundColor: '#f6f7f8' },
});
