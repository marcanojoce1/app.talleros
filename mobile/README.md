# TallerOS — App móvil (React Native + Expo)

App nativa para **mecánico** y **cliente**, un solo código para **iOS y Android**.
Se conecta al mismo backend (`../backend`).

## Requisitos
- Node.js 18+
- La app **Expo Go** instalada en tu teléfono (gratis, en App Store / Google Play) para probar al instante.

## Probar en tu teléfono en 3 minutos
```bash
cd mobile
npm install
npx expo start
```
- Se abre un **código QR**. Escanéalo con Expo Go (Android) o con la cámara (iOS).
- La app se abre en tu teléfono y ya puedes iniciar sesión.

> Importante: tu teléfono y tu PC deben estar en la **misma red WiFi**, y la app debe apuntar a la **IP de tu PC**, no a `localhost`. Edita `app.json` → `extra.apiUrl` con algo como `http://192.168.1.10:4000` (tu IP local). Para producción, pon la URL de tu servidor: `https://api.tu-dominio.com`.

Usuarios de prueba (contraseña `demo1234`): `dcardenas` (mecánico), `cmendoza` (cliente).

## Funciones incluidas
- Login real contra la API + recuperación de contraseña (WhatsApp/correo).
- Mecánico: ve sus órdenes y cambia el estado (en proceso, espera de repuesto, terminar).
- Cliente: ve el estado de sus vehículos.
- Sesión guardada en el teléfono (no hay que entrar cada vez).

> Las pantallas se irán enriqueciendo portando el diseño del prototipo (recepción 3D, subir foto/video, notificaciones push). La conexión con la API ya está lista.

## Generar los instaladores para las tiendas (EAS Build)
No necesitas Mac para iOS si usas EAS (servicio de Expo en la nube).
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android   # genera el .aab para Google Play
eas build --platform ios       # genera el build para App Store
```
Luego subes el `.aab` a **Google Play Console** y el build de iOS a **App Store Connect**.

### Antes de publicar
- Agrega los íconos y splash en `assets/` y referéncialos en `app.json` (`icon`, `splash`, `android.adaptiveIcon.foregroundImage`).
- Cambia `extra.apiUrl` a la URL de tu servidor de producción.
- Crea las cuentas de desarrollador: Apple ($99/año) y Google Play ($25 único).

## Estructura
```
mobile/
├── App.js                 → navegación y arranque de sesión
├── app.json               → configuración Expo (nombre, bundle iOS/Android, apiUrl)
├── package.json
└── src/
    ├── api.js             → cliente de la API + sesión
    └── screens/
        ├── Login.js       → inicio de sesión + recuperación
        └── Home.js        → mecánico (órdenes) / cliente (vehículos)
```

## App de Administrador (nuevo)

La misma app ahora enruta según el rol al iniciar sesión:
- **superadmin / administrador** → pantalla de Administrador (Resumen, Órdenes, Facturación).
- **mecanico / cliente** → pantalla de siempre (órdenes / vehículos).

La pantalla de Administrador:
- Muestra un selector de talleres (para super admin lista todos los activos; para admin, los suyos).
- **Resumen**: KPIs calculados del taller (en espera, en reparación, terminados, entregados, clientes, mecánicos, ingresos).
- **Órdenes**: vehículos del taller con su estado.
- **Facturación**: el administrador sube factura/boleta (código, monto y foto) → se sincroniza con la web; el super admin ve las facturas del taller y las marca como pagadas.

Todo se sincroniza porque la app lee y escribe el **mismo estado por taller** (`/api/state?taller=ID`) que usa la plataforma web.

Nueva dependencia: `expo-image-picker` (para adjuntar la foto de la factura). Tras `npm install`, corre `npx expo start`.
Recuerda poner la IP de tu PC en `apiUrl` (app.json → extra) si pruebas en un teléfono físico.
