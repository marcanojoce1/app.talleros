# TallerOS — Código fuente del producto

Este repositorio contiene **todo lo necesario para montar TallerOS en un servidor** y **generar las apps** para las tiendas. Es la versión real (no el prototipo): código que se instala, se conecta a una base de datos y se ejecuta.

```
talleros/
├── database/          → Base de datos PostgreSQL (esquema + datos)
│   ├── schema.sql
│   └── seed.sql
├── backend/           → API en Node.js (login, módulos, WhatsApp, correo, tiempo real)
│   └── src/...
├── web-admin/         → Plataforma web del administrador (navegador)
│   └── index.html
├── apps/              → App web instalable (PWA) mecánico/cliente — camino rápido
│   ├── index.html, manifest.json, sw.js
└── mobile/            → App NATIVA iOS + Android (React Native + Expo) — para las tiendas
    ├── App.js, app.json, package.json
    └── src/...
```

> Tienes **dos formas** de llevar las apps al teléfono:
> 1. **PWA** (`apps/`): se instala desde el navegador del celular. Gratis e inmediata, no va a las tiendas.
> 2. **App nativa** (`mobile/`): React Native + Expo. Se prueba al instante con Expo Go (QR) y se publica en App Store y Google Play. **Esta es la app del teléfono propiamente dicha.**

---

## Requisitos

- **Node.js 18 o superior**
- **PostgreSQL 14 o superior**

---

## 1. Base de datos

Crea la base y carga el esquema:

```bash
# Crea la base (ajusta usuario según tu instalación)
createdb talleros           # o:  psql -U postgres -c "CREATE DATABASE talleros;"
```

(El esquema y los datos se cargan desde el backend en el paso siguiente con `npm run migrate`. También puedes cargarlos a mano con `psql -U postgres -d talleros -f database/schema.sql` y luego `-f database/seed.sql`.)

---

## 2. Backend / API

```bash
cd backend
cp .env.example .env          # edita .env con tus datos de conexión y secretos
npm install
npm run migrate               # crea tablas + datos de ejemplo
npm run seed                  # crea los usuarios con contraseña (demo1234)
npm start                     # arranca la API en http://localhost:4000
```

Comprueba que responde: abre `http://localhost:4000/api/health`.

**Usuarios de prueba** (contraseña `demo1234`):
- Administrador: `jramirez`
- Mecánico: `dcardenas`
- Cliente: `cmendoza`

### Variables de entorno importantes (`.env`)
- `DATABASE_URL` — conexión a PostgreSQL.
- `JWT_SECRET` — **cámbialo** por una cadena larga y secreta.
- `SMTP_*` — credenciales de correo (vacío = modo demo, el código sale en consola).
- `WHATSAPP_PROVIDER` + credenciales de Twilio o Meta (vacío = modo demo).

> En **modo demo** (sin credenciales), el código de recuperación y los mensajes de WhatsApp/correo se imprimen en la consola del backend, para que puedas probar el flujo completo sin pagar nada.

---

## 3. Web del administrador

Es estática: ábrela tras tener el backend corriendo.

```bash
cd web-admin
# Sirve la carpeta con cualquier servidor estático, por ejemplo:
npx serve .          # o:  python3 -m http.server 5500
```

Si tu API no está en `http://localhost:4000`, configúralo una vez en el navegador (consola):
```js
localStorage.setItem('talleros_api', 'https://api.tu-dominio.com')
```

---

## 4. Apps (mecánico y cliente)

La carpeta `apps/` es una **PWA**: una sola base de código que funciona en iOS y Android, instalable desde el navegador (“Agregar a pantalla de inicio”).

```bash
cd apps
npx serve .
```

> Faltan los íconos `icon-192.png` e `icon-512.png` (agrega el logo del taller).

### Llevarla a App Store / Google Play
Para publicarla en las tiendas, envuelve la PWA con **Capacitor** (recomendado, reutiliza este mismo código):

```bash
npm install @capacitor/core @capacitor/cli
npx cap init TallerOS com.talleros.app
npx cap add android
npx cap add ios
npx cap copy
# Android → abre en Android Studio → genera el .aab → súbelo a Google Play
# iOS     → abre en Xcode (requiere Mac) → genera el build → súbelo a App Store
```

Alternativa: reescribir las apps en **React Native (Expo)** para experiencia 100% nativa (cámara, video y notificaciones push completas).

---

## 4b. App nativa para las tiendas (React Native + Expo)  ← recomendado para los teléfonos

La carpeta `mobile/` es un proyecto **Expo** real: un solo código para iOS y Android.

```bash
cd mobile
npm install
npx expo start          # muestra un QR
```
Escanea el QR con la app **Expo Go** en tu teléfono y la app se abre al instante.
(Tu teléfono y tu PC deben estar en la misma WiFi; ajusta `app.json` → `extra.apiUrl` con la IP de tu PC, p. ej. `http://192.168.1.10:4000`.)

Para generar los instaladores de las tiendas (sin necesidad de Mac para iOS):
```bash
npm install -g eas-cli
eas login
eas build --platform android    # .aab para Google Play
eas build --platform ios        # build para App Store
```
Ver `mobile/README.md` para el detalle.

---

## 5. Desplegar en un servidor (producción)

Opción sencilla y económica para empezar:

- **Base de datos:** un PostgreSQL gestionado (Neon, Supabase, Railway o RDS).
- **Backend:** Render o Railway (conecta el repositorio, define las variables de entorno; arranca con `npm start`).
- **Web admin y apps:** Vercel, Netlify o Cloudflare Pages (son archivos estáticos).
- **Archivos (fotos/videos):** en producción cambia `STORAGE` a S3 / Cloudflare R2 (el código local de `/uploads` es solo para desarrollo).

Pasos típicos en un servidor propio (VPS):
```bash
# 1. Instala Node y PostgreSQL
# 2. Clona el código, configura backend/.env
# 3. npm install && npm run migrate && npm run seed
# 4. Usa pm2 para mantener la API viva:
npm install -g pm2 && pm2 start src/server.js --name talleros-api
# 5. Pon un dominio + HTTPS con Nginx delante del puerto 4000
```

---

## 6. ¿Qué falta para el producto completo?

Esta base cubre: autenticación con roles, recuperación de contraseña, CRUD de todos los módulos, órdenes con cambio de estado, recepción con daños, subida de media, citas, notificaciones, tiempo real y configuración. Para terminar el producto:

1. **Portar las pantallas** del prototipo a `web-admin/` y `apps/` (la lógica de API ya está lista).
2. Activar **WhatsApp Business** y **correo** reales (poner credenciales en `.env`).
3. Mover el **almacenamiento** de archivos a la nube (S3/R2).
4. Añadir **2FA** e inicio con **Google** (vía Auth0/Supabase Auth si prefieres no mantenerlo a mano).
5. **Publicar** las apps (Capacitor/Expo) y la web (Vercel).

Consulta el documento *“TallerOS — Del prototipo al producto real”* para la hoja de ruta y los costos.

---

## Mapa de la API (resumen)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/recover` | Enviar código de recuperación (correo/WhatsApp) |
| POST | `/api/auth/reset` | Cambiar contraseña con el código |
| GET/POST/PUT/DELETE | `/api/clientes` | Clientes |
| GET/POST/PUT/DELETE | `/api/vehiculos` | Vehículos |
| GET/POST/PUT/DELETE | `/api/mecanicos` | Mecánicos |
| GET/POST/PUT/DELETE | `/api/usuarios` | Usuarios y roles |
| GET/POST | `/api/ordenes` | Órdenes de taller |
| PUT | `/api/ordenes/:id/estado` | Cambiar estado (en proceso, terminado, etc.) |
| POST/GET | `/api/ordenes/:id/recepcion` | Acta de recepción + daños |
| POST/GET | `/api/ordenes/:id/media` | Subir/ver fotos y videos |
| GET/POST/PUT | `/api/citas` | Citas |
| GET | `/api/notificaciones` | Notificaciones del usuario |
| GET/PUT/POST | `/api/config` | Moneda y catálogos |
