// VersiÃ³n visible de la app TallerOS. SÃºbela cada vez que publiques un APK nuevo.
export const APP_VERSION = '1.1.0';
export const APP_BUILD = 405;

// En la versiÃ³n de Google Play las actualizaciones las hace la propia tienda (no se instala ningÃºn APK desde la app).
import Constants from 'expo-constants';
export const ES_PLAY = !!(Constants && Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.variant === 'play');
