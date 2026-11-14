// VersiÃƒÂ³n visible de la app TallerOS. SÃƒÂºbela cada vez que publiques un APK nuevo.
export const APP_VERSION = '1.1.0';
export const APP_BUILD = 411;

// En la versiÃƒÂ³n de Google Play las actualizaciones las hace la propia tienda (no se instala ningÃƒÂºn APK desde la app).
import Constants from 'expo-constants';
export const ES_PLAY = !!(Constants && Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.variant === 'play');
