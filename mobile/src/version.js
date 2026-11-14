// Versión visible de la app TallerOS. Súbela cada vez que publiques un APK nuevo.
export const APP_VERSION = '1.1.0';
export const APP_BUILD = 404;

// En la versión de Google Play las actualizaciones las hace la propia tienda (no se instala ningún APK desde la app).
import Constants from 'expo-constants';
export const ES_PLAY = !!(Constants && Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.variant === 'play');
