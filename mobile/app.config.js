// Configuración dinámica: lee app.json y, si APP_VARIANT=play, genera la versión para Google Play
// (sin el permiso de instalar APK, sin actualizador interno y con firma de subida).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const esPlay = process.env.APP_VARIANT === 'play';
  const out = { ...config, extra: { ...(config.extra || {}), variant: esPlay ? 'play' : 'interna' } };
  out.plugins = [...(config.plugins || []), './plugins/withGradleMemoria.js'];

  if (esPlay) {
    // versionCode de Google Play: sube solo con build-play.ps1 (cada subida a Play debe llevar un número mayor)
    let versionCode = 1;
    try { versionCode = JSON.parse(fs.readFileSync(path.join(__dirname, 'play-version.json'), 'utf8')).versionCode || 1; } catch (e) { /* primera vez */ }
    out.android = {
      ...(config.android || {}),
      versionCode,
      permissions: (config.android.permissions || []).filter((p) => p !== 'REQUEST_INSTALL_PACKAGES'),
      blockedPermissions: [
        'android.permission.REQUEST_INSTALL_PACKAGES', // Play no permite que la app instale APK por su cuenta
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    };
    out.plugins = [...out.plugins, './plugins/withPlaySigning.js'];
  }
  return out;
};
