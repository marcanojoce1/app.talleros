import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { API_URL, getToken } from './api';

// Genera el acta en PDF y abre el menú de compartir del teléfono.
export async function compartirActaPDF(tallerId, veh) {
  try {
    if (!API_URL || API_URL.includes('PON-AQUI')) {
      Alert.alert('Configuración pendiente', 'La app no tiene configurada la dirección del servidor.');
      return;
    }
    const token = await getToken();
    let html;
    try {
      const res = await fetch(`${API_URL}/api/acta/${tallerId}/${veh.id}?raw=1`, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!res.ok) throw new Error('El servidor respondió ' + res.status);
      html = await res.text();
    } catch (netErr) {
      Alert.alert('Sin conexión con el servidor', 'No se pudo obtener el acta. Verifica tu internet e intenta de nuevo.');
      return;
    }
    if (!html || html.length < 100) { Alert.alert('Acta vacía', 'El acta no tiene contenido todavía.'); return; }

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
        dialogTitle: 'Compartir acta — ' + (veh.model || 'vehículo'),
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Acta lista', 'El PDF se generó en: ' + uri);
    }
  } catch (e) {
    Alert.alert('Error', e.message || 'No se pudo generar el acta.');
  }
}
