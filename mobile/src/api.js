// Cliente de la API + manejo de sesión (token) con AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Dirección del backend. Cámbiala por la de tu servidor en producción.
// En desarrollo con teléfono físico, usa la IP de tu PC (no localhost), p. ej. http://192.168.1.10:4000
const URL_CONFIGURADA =
  (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.apiUrl) || '';
const URL_VALIDA = URL_CONFIGURADA && !URL_CONFIGURADA.includes('PON-AQUI') ? URL_CONFIGURADA : '';

// URL activa: la guardada por el usuario tiene prioridad sobre la compilada
let _apiUrl = URL_VALIDA;
export function getApiUrl() { return _apiUrl; }
export function apiUrlLista() { return !!_apiUrl; }
export async function cargarApiUrl() {
  const guardada = await AsyncStorage.getItem('t_api_url');
  if (guardada) _apiUrl = guardada;
  return _apiUrl;
}
export async function guardarApiUrl(url) {
  let u = (url || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  _apiUrl = u;
  await AsyncStorage.setItem('t_api_url', u);
  return u;
}
let token = null;

export async function loadSession() {
  await cargarApiUrl();
  token = await AsyncStorage.getItem('t_token');
  const me = await AsyncStorage.getItem('t_me');
  const talleres = await AsyncStorage.getItem('t_talleres');
  return { token, me: me ? JSON.parse(me) : null, talleres: talleres ? JSON.parse(talleres) : [] };
}
export async function saveSession(tk, me, talleres) {
  token = tk;
  await AsyncStorage.setItem('t_token', tk);
  await AsyncStorage.setItem('t_me', JSON.stringify(me));
  await AsyncStorage.setItem('t_talleres', JSON.stringify(talleres || []));
}
export async function clearSession() {
  token = null;
  await AsyncStorage.multiRemove(['t_token', 't_me', 't_talleres']);
}

export async function api(path, options = {}) {
  if (!_apiUrl) throw new Error('SIN_SERVIDOR');
  const res = await fetch(_apiUrl + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
  return data;
}

// ==== Estado por taller (mismo documento que usa la web para sincronizar) ====
export async function getState(tallerId) {
  const r = await api('/api/state?taller=' + tallerId);
  return (r && r.data) || {};
}
export async function putState(tallerId, data) {
  return api('/api/state?taller=' + tallerId, { method: 'PUT', body: JSON.stringify({ data }) });
}

// Devuelve el token actual (para descargas autenticadas como el acta PDF)
export async function getToken() {
  if (!token) token = await AsyncStorage.getItem('t_token');
  return token;
}
