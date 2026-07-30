import { Alert, Linking, Platform } from 'react-native';
import { getApiUrl, getToken } from './api';

// Carga perezosa: si el módulo nativo no está en el APK, no rompe la app.
function cargarModulo(nombre) {
  try {
    if (nombre === 'print') return require('expo-print');
    if (nombre === 'sharing') return require('expo-sharing');
    if (nombre === 'fs') return require('expo-file-system');
  } catch (e) { return null; }
  return null;
}

// Arma un nombre de archivo significativo: Orden-<n>_<placa>_<fecha>
function nombreArchivo(veh, tipo) {
  const pre = tipo === 'trabajo' ? 'Trabajo' : 'Acta';
  const orden = veh.numOrden ? 'OS' + String(veh.numOrden).padStart(4, '0') : '';
  const placa = (veh.plate || '').replace(/[^A-Za-z0-9]/g, '');
  const fecha = new Date().toISOString().slice(0, 10);
  return [pre, orden, placa, fecha].filter(Boolean).join('_') + '.pdf';
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

// Genera y comparte en PDF una cotización (mismo flujo que el Acta, pero apuntando a /api/cotizacion)
export async function compartirCotizacionPDF(tallerId, cot) {
  const base = getApiUrl();
  if (!base) { Alert.alert('Servidor no configurado', 'Cierra sesión y escribe la dirección del servidor en la pantalla de inicio.'); return; }
  const titulo = 'Cotización';
  const numTxt = cot.num ? 'P-' + String(cot.num).padStart(6, '0') : String(cot.id);

  const Print = cargarModulo('print');
  const Sharing = cargarModulo('sharing');
  const urlDoc = `${base}/api/cotizacion/${tallerId}/${cot.id}`;

  if (!Print || !Print.printToFileAsync) {
    Alert.alert(titulo, 'Se abrirá en el navegador. Desde ahí puedes imprimirlo, guardarlo como PDF o compartirlo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Abrir', onPress: () => Linking.openURL(urlDoc).catch(() => Alert.alert('No se pudo abrir', urlDoc)) },
    ]);
    return;
  }

  try {
    let html;
    try {
      const token = await getToken();
      const res = await fetch(`${urlDoc}?raw=1`, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
      if (!res.ok) throw new Error('servidor ' + res.status);
      html = await res.text();
    } catch (netErr) {
      Alert.alert('Sin conexión', 'No se pudo obtener el documento del servidor.\n\n' + (netErr.message || ''), [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir en navegador', onPress: () => Linking.openURL(urlDoc).catch(() => {}) },
      ]);
      return;
    }
    if (!html || html.length < 100) { Alert.alert(titulo, 'El documento aún no tiene contenido.'); return; }

    let uri;
    try {
      const out = await Print.printToFileAsync({ html, base64: false });
      uri = out && out.uri;
    } catch (pdfErr) {
      Alert.alert('No se pudo crear el PDF', (pdfErr.message || '') + '\n\nPuedes abrirlo en el navegador.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir en navegador', onPress: () => Linking.openURL(urlDoc).catch(() => {}) },
      ]);
      return;
    }
    if (!uri) { Alert.alert('No se pudo crear el PDF', 'El archivo salió vacío.'); return; }

    try {
      const FS = cargarModulo('fs');
      if (FS && FS.moveAsync && FS.cacheDirectory) {
        const destino = FS.cacheDirectory + 'Cotizacion_' + numTxt.replace(/[^A-Za-z0-9-]/g, '') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
        try { if (FS.deleteAsync) await FS.deleteAsync(destino, { idempotent: true }); } catch (e) {}
        await FS.moveAsync({ from: uri, to: destino });
        uri = destino;
      }
    } catch (e) {}

    let puedeCompartir = false;
    try { puedeCompartir = Sharing && Sharing.isAvailableAsync ? await Sharing.isAvailableAsync() : false; } catch (e) { puedeCompartir = false; }

    if (puedeCompartir) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: titulo + ' ' + numTxt, UTI: 'com.adobe.pdf' });
    } else if (Print.printAsync) {
      await Print.printAsync({ uri });
    } else {
      Alert.alert(titulo, 'PDF generado en:\n' + uri);
    }
  } catch (e) {
    Alert.alert('Error', (e && e.message) || 'No se pudo generar el documento.', [
      { text: 'Cerrar', style: 'cancel' },
      { text: 'Abrir en navegador', onPress: () => Linking.openURL(urlDoc).catch(() => {}) },
    ]);
  }
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

    // Renombrar el PDF a un nombre significativo (N° orden, placa, fecha) si se puede
    try {
      const FS = cargarModulo('fs');
      if (FS && FS.moveAsync && FS.cacheDirectory) {
        const destino = FS.cacheDirectory + nombreArchivo(veh, tipo);
        try { if (FS.deleteAsync) await FS.deleteAsync(destino, { idempotent: true }); } catch (e) {}
        await FS.moveAsync({ from: uri, to: destino });
        uri = destino;
      }
    } catch (e) { /* si falla, se comparte con el nombre por defecto */ }

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
