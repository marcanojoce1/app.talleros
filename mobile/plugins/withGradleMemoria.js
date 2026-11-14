// Evita el error "Metaspace / OutOfMemoryError" de Gradle al compilar (Expo SDK 54 necesita más memoria)
// y desactiva el análisis "lint" del release, que no hace falta para generar el APK/AAB y consume mucha memoria.
const { withGradleProperties, withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withGradleMemoria(config) {
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const poner = (key, value) => {
      const i = props.findIndex((p) => p.type === 'property' && p.key === key);
      if (i >= 0) props[i].value = value; else props.push({ type: 'property', key, value });
    };
    poner('org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1536m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8');
    poner('org.gradle.daemon', 'true');
    poner('kotlin.daemon.jvmargs', '-Xmx2048m -XX:MaxMetaspaceSize=1024m');
    return cfg;
  });
  config = withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (!g.includes('checkReleaseBuilds')) {
      g = g.replace(/^android \{/m, 'android {\n    lint {\n        checkReleaseBuilds = false\n        abortOnError = false\n    }');
    }
    cfg.modResults.contents = g;
    return cfg;
  });
  return config;
};
