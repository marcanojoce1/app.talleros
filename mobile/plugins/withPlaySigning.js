// Firma el .aab de Google Play con tu llave de subida (C:\talleros\keys\keystore.properties).
// Solo se usa en la variante "play"; el APK interno sigue firmándose igual que siempre.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withPlaySigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes('keystoreProps')) return cfg; // ya aplicado
    const cargador = `
def keystorePropsFile = rootProject.file("../../keys/keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) { keystorePropsFile.withInputStream { keystoreProps.load(it) } }
`;
    g = g.replace(/^android \{/m, cargador + '\nandroid {');
    // signingConfig "release" con la llave de subida
    g = g.replace(/signingConfigs \{/, `signingConfigs {
        release {
            if (keystoreProps['storeFile']) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }`);
    // el build "release" usa esa llave en lugar de la de depuración
    g = g.replace(/(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig keystoreProps[\'storeFile\'] ? signingConfigs.release : signingConfigs.debug');
    cfg.modResults.contents = g;
    return cfg;
  });
};
