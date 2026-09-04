// Configuración oficial de Puppeteer — soluciona un problema conocido al desplegar en
// plataformas como Render: el navegador se descarga en un lugar durante la instalación,
// pero el servidor lo busca en otro al arrancar. Esto fuerza que ambos pasos usen
// exactamente la misma carpeta, dentro del propio proyecto.
const { join } = require('path');

module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
