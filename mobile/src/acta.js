import { Alert, Linking, Platform } from 'react-native';
import { getApiUrl, getToken } from './api';

// Carga perezosa: si el módulo nativo no está en el APK, no rompe la app.
function cargarModulo(nombre) {
  try {
    if (nombre === 'print') return require('expo-print');
    if (nombre === 'sharing') return require('expo-sharing');
  } catch (e) { return null; }
  return null;
}

export function urlDocumento(tallerId, vehId, tipo = 'acta') {
  const base = getApiUrl();
  if (!base) return '';
  return `${base}/api/${tipo === 'trabajo' ? 'trabajo' : 'acta'}/${tallerId}/${vehId}`;
}

// Abre el documento en el navegador del teléfono (siempre funciona).
export async function abrirEnNavegador(tallerId, veh, tipo = 'acta') {
  const url = urlDocumento(tallerId, veh.id, tipo);
  if (!url) { Alert.alert('Servidor no configurado', 'Cierra sesión y escribe la dirección del servidor en la pantalla de inicio.'); return; }
  try { await Linking.openURL(url); }
  catch (e) { Alert.alert('No se pudo abrir', url); }
}

// Genera el PDF y abre el menú de compartir. Si no se puede, ofrece el navegador.
export async function compartirActaPDF(tallerId, veh, tipo = 'acta') {
  const base = getApiUrl();
  if (!base) {
    Alert.alert('Servidor no configurado', 'Cierra sesión y escribe la dirección del servidor en la pantalla de inicio.');
    return;
  }
  const ruta = tipo === 'trabajo' ? 'trabajo' : 'acta';
  const titulo = tipo === 'trabajo' ? 'Informe de trabajo' : 'Acta';

  const Print = cargarModulo('print');
  const Sharing = cargarModulo('sharing');

  // Sin módulos nativos → abrir en el navegador (desde ahí se puede imprimir/compartir)
  if (!Print || !Print.printToFileAsync) {
    Alert.alert(titulo, 'Se abrirá en el navegador. Desde ahí puedes imprimirlo, guardarlo como PDF o compartirlo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Abrir', onPress: () => abrirEnNavegador(tallerId, veh, tipo) },
    ]);
    return;
  }

  try {
    // 1) Traer el HTML
    let html;
    try {
      const token = await getToken();
      const res = await fetch(`${base}/api/${ruta}/${tallerId}/${veh.id}?raw=1`, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!res.ok) throw new Error('servidor ' + res.status);
      html = await res.text();
    } catch (netErr) {
      Alert.alert('Sin conexión', 'No se pudo obtener el documento del servidor.\n\n' + (netErr.message || ''), [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir en navegador', onPress: () => abrirEnNavegador(tallerId, veh, tipo) },
      ]);
      return;
    }
    if (!html || html.length < 100) { Alert.alert(titulo, 'El documento aún no tiene contenido.'); return; }

    // 2) Convertir a PDF
    let uri;
    try {
      const out = await Print.printToFileAsync({ html, base64: false });
      uri = out && out.uri;
    } catch (pdfErr) {
      Alert.alert('No se pudo crear el PDF', (pdfErr.message || '') + '\n\nPuedes abrirlo en el navegador.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir en navegador', onPress: () => abrirEnNavegador(tallerId, veh, tipo) },
      ]);
      return;
    }
    if (!uri) { Alert.alert('No se pudo crear el PDF', 'El archivo salió vacío.'); return; }

    // 3) Compartir
    let puedeCompartir = false;
    try { puedeCompartir = Sharing && Sharing.isAvailableAsync ? await Sharing.isAvailableAsync() : false; } catch (e) { puedeCompartir = false; }

    if (puedeCompartir) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: titulo + ' — ' + (veh.model || 'vehículo'),
        UTI: 'com.adobe.pdf',
      });
    } else if (Print.printAsync) {
      // Sin menú de compartir: al menos abrir el diálogo de impresión / guardar PDF
      await Print.printAsync({ uri });
    } else {
      Alert.alert(titulo, 'PDF generado en:\n' + uri);
    }
  } catch (e) {
    Alert.alert('Error', (e && e.message) || 'No se pudo generar el documento.', [
      { text: 'Cerrar', style: 'cancel' },
      { text: 'Abrir en navegador', onPress: () => abrirEnNavegador(tallerId, veh, tipo) },
    ]);
  }
}
