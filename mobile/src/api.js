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
// Hace un ping para que el servidor "dormido" (plan gratuito) empiece a despertar
// mientras el usuario escribe sus datos. No bloquea ni muestra errores.
export function despertarServidor() {
  if (!_apiUrl) return;
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 40000);
  fetch(_apiUrl + '/api/health', { signal: ctrl.signal }).catch(() => {});
}
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
  // El servidor gratuito puede estar "dormido" y tardar en despertar.
  // Hacemos hasta 2 intentos con un tiempo de espera generoso y mensajes claros.
  const intentos = options._reintento === false ? 1 : 2;
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000); // 45 s por intento
    try {
      const res = await fetch(_apiUrl + path, {
        ...options,
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(options.headers || {}),
        },
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
      return data;
    } catch (e) {
      clearTimeout(timer);
      ultimoError = e;
      // Si fue por tiempo agotado y aún quedan intentos, reintenta (el servidor puede estar despertando)
      const esTimeout = e.name === 'AbortError';
      if (i < intentos - 1 && (esTimeout || (e.message || '').includes('Network'))) continue;
      if (esTimeout) throw new Error('El servidor tardó demasiado en responder. Puede estar iniciando; intenta de nuevo en un momento.');
      if ((e.message || '').includes('Network request failed')) throw new Error('Sin conexión con el servidor. Revisa tu internet o la dirección del servidor.');
      throw e;
    }
  }
  throw ultimoError || new Error('No se pudo conectar');
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
