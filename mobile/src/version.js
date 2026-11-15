// VersiÃ³n visible de la app TallerOS. SÃºbela cada vez que publiques un APK nuevo.
export const APP_VERSION = '1.1.0';
export const APP_BUILD = 7;

// En la versiÃ³n de Google Play las actualizaciones las hace la propia tienda (no se instala ningÃºn APK desde la app).
import Constants from 'expo-constants';
export const ES_PLAY = !!(Constants && Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.variant === 'play');

// NÃºmero de build que se muestra en Ajustes, con tres dÃ­gitos (001, 002â€¦).
// En Google Play es el nÃºmero de versiÃ³n de la tienda; en el APK interno es APP_BUILD.
export const BUILD_VISIBLE = String(
  (ES_PLAY && Constants && Constants.expoConfig && Constants.expoConfig.android && Constants.expoConfig.android.versionCode) || APP_BUILD
).padStart(3, '0');
