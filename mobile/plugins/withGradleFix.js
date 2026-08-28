// Este plugin ajusta automáticamente la versión de Android Gradle Plugin (AGP) y de
// Gradle en cada "expo prebuild" — sin esto, cualquier cambio manual a build.gradle o
// gradle-wrapper.properties se borra cada vez que se corre ese comando, y vuelve a salir
// el error "Could not get unknown property 'release'..." (bug conocido de compatibilidad
// entre expo-modules-core y versiones más nuevas de Gradle/AGP).
const { withProjectBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withGradleFix(config) {
  // 1) Fija la versión del Android Gradle Plugin (AGP) en build.gradle
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /classpath\(['"]com\.android\.tools\.build:gradle['"]\)/,
        "classpath('com.android.tools.build:gradle:8.2.2')"
      );
    }
    return cfg;
  });

  // 2) Fija la versión de Gradle en sí, editando el wrapper después de que Expo genere
  //    la carpeta android/ (gradle-wrapper.properties no tiene un mod dedicado en
  //    config-plugins, así que usamos withDangerousMod para tocar el archivo directo).
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const wrapperPath = path.join(cfg.modRequest.platformProjectRoot, 'gradle', 'wrapper', 'gradle-wrapper.properties');
      try {
        if (fs.existsSync(wrapperPath)) {
          let txt = fs.readFileSync(wrapperPath, 'utf8');
          txt = txt.replace(
            /distributionUrl=.*gradle-[\d.]+-all\.zip/,
            'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.6-all.zip'
          );
          fs.writeFileSync(wrapperPath, txt);
        }
      } catch (e) {
        console.warn('withGradleFix: no se pudo ajustar gradle-wrapper.properties —', e.message);
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withGradleFix;
