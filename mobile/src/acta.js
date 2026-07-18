import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { API_URL, getToken } from './api';

// Comparte el acta O el informe de trabajo realizado en PDF.
export async function compartirActaPDF(tallerId, veh, tipo = 'acta') {
  try {
    if (!API_URL || API_URL.includes('PON-AQUI')) {
      Alert.alert('Configuración pendiente', 'La app no tiene configurada la dirección del servidor.');
      return;
    }
    const token = await getToken();
    const ruta = tipo === 'trabajo' ? 'trabajo' : 'acta';
    let html;
    try {
      const res = await fetch(`${API_URL}/api/${ruta}/${tallerId}/${veh.id}?raw=1`, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!res.ok) throw new Error('El servidor respondió ' + res.status);
      html = await res.text();
    } catch (netErr) {
      Alert.alert('Sin conexión con el servidor', 'No se pudo obtener el documento. Verifica tu internet e intenta de nuevo.');
      return;
    }
    if (!html || html.length < 100) { Alert.alert('Documento vacío', 'No tiene contenido todavía.'); return; }

    let uri;
    try {
      const out = await Print.printToFileAsync({ html });
      uri = out.uri;
    } catch (pdfErr) {
      Alert.alert('Error al crear el PDF', 'No se pudo generar el archivo. Intenta de nuevo.');
      return;
    }

    const disponible = await Sharing.isAvailableAsync();
    if (disponible) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: (tipo === 'trabajo' ? 'Trabajo realizado — ' : 'Acta — ') + (veh.model || 'vehículo'),
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF listo', 'Se generó en: ' + uri);
    }
  } catch (e) {
    Alert.alert('Error', e.message || 'No se pudo generar el documento.');
  }
}
