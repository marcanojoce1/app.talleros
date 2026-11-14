# Subir TallerOS a Google Play — guía paso a paso

Versión de la app: Expo SDK 54 (apunta a Android 16 / API 36, requisito de Google desde el 31-ago-2026).

## PARTE A — Preparar tu PC (una sola vez)

1. **Node.js 20.19.4 o más nuevo.** Verifica con `node -v`. Si sale menor, instala la versión LTS desde nodejs.org.
2. **Android Studio → More Actions → SDK Manager → SDK Platforms:** marca **Android 16 (API 36)**. En la pestaña *SDK Tools* marca **Android SDK Build-Tools 36** y **NDK (Side by side)** y pulsa Apply.
3. Abre PowerShell y, uno por uno:

```
cd C:\talleros\mobile
```
```
npm install --legacy-peer-deps
```
```
npx expo prebuild --platform android --clean
```

4. Compila el APK interno como siempre para comprobar que todo sigue bien (`publicar-actualizacion.ps1`). **Si algo falla aquí, pégame el error antes de seguir.**

## PARTE B — Generar el archivo para Play (.aab)

Desde `C:\talleros`:

```
powershell -ExecutionPolicy Bypass -File .\build-play.ps1
```

- La primera vez te pide inventar una contraseña y crea tu **llave de firma** en `C:\talleros\keys`.
  **Haz una copia de esa carpeta (USB o nube privada). Si la pierdes, recuperarla con Google tarda días.**
  La carpeta `keys` está en `.gitignore`: no se sube a GitHub.
- Cada corrida sube el `versionCode` solo (Play exige un número mayor en cada subida).
- Resultado: `C:\talleros\play\TallerOS-play-1.aab`.
- Al terminar deja la carpeta `android` lista otra vez para el APK interno.

La versión de Play **no** tiene el botón "Buscar actualización" ni el permiso de instalar APK (Play los prohíbe): las actualizaciones las hace la propia tienda. Tu APK interno sigue igual que siempre.

## PARTE C — Play Console

### 1. Crear la app
Todas las apps → Crear app → Nombre **TallerOS** · Idioma **Español (Latinoamérica)** · App · **Gratuita** · acepta las declaraciones.

### 2. Ficha de la tienda (Presencia en la tienda → Ficha principal)
- **Descripción breve (80 máx.):** `App y plataforma web para tu taller: recepción digital, órdenes y avances.`
- **Descripción completa:**

```
TallerOS es la plataforma para talleres automotrices que quieren trabajar ordenado y sin papeles. Funciona en tu celular con esta app y también en la computadora con la plataforma web.

• Recepción digital con acta de inspección: datos del cliente y del vehículo, accesorios, combustible, daños sobre el esquema del carro y firmas digitales.
• Órdenes de taller en tiempo real: en espera, en reparación, terminado y entregado.
• Avances con fotos, videos y notas que el cliente puede ver desde su celular.
• Asignación de técnicos y control de honorarios.
• Cotizaciones y PDF listos para compartir por WhatsApp.
• Próximos mantenimientos y avisos al cliente.
• Auxilio vial: el cliente comparte su ubicación para pedir ayuda.
• Modo claro y modo oscuro.
• Plataforma web para administrar tu taller desde la computadora: taller.mjservices.app (usa el mismo usuario y contraseña de la app).

TallerOS es una aplicación de uso para talleres registrados. Solicita tu demo gratuita en taller.mjservices.app/demo.html
```

- **Ícono 512×512:** `play-assets/icono-512.png`
- **Imagen destacada 1024×500:** `play-assets/grafico-destacado-1024x500.png`
- **Capturas de teléfono:** mínimo 2, recomendado 4–8 (vertical). Tómalas con el emulador o tu celular: Órdenes, Acta, Avances, Mis trabajos.
- **Categoría:** Negocios · **Correo de contacto:** soporte@mjservices.app · **Sitio web:** https://taller.mjservices.app

### 3. Contenido de la app (Política → Contenido de la app)
- **Política de privacidad:** `https://taller.mjservices.app/privacidad.html` (ya actualizada con notificaciones, cámara/micrófono y eliminación de cuenta).
- **Acceso a la app:** "Todas o algunas funciones están restringidas". Entrega un usuario y contraseña **permanentes** para los revisores (créalo desde el panel de superadmin en un taller de revisión; **no uses una demo, porque vence a los 3 días**).
- **Anuncios:** No.
- **Clasificación de contenido:** categoría *Utilidad/Productividad*, responde "No" a violencia, sexo, drogas, apuestas.
- **Público objetivo:** 18 años o más.
- **Eliminación de cuenta:** URL `https://taller.mjservices.app/privacidad.html#eliminar-cuenta`.
- **Seguridad de los datos** (responde así):
  - ¿Recopila datos? **Sí**. ¿Cifrados en tránsito? **Sí** (HTTPS). ¿Permite pedir su eliminación? **Sí**.
  - **Información personal:** nombre, correo, teléfono, ID de usuario → recopilado, **no compartido**, necesario para la función de la app.
  - **Ubicación** (aproximada y precisa) → recopilado, no compartido, **opcional** (solo auxilio vial).
  - **Fotos y videos** → recopilado, no compartido.
  - **ID de dispositivo u otros** (token de notificaciones) → recopilado, no compartido.
  - Marca también *Historial de compras/pagos* si el taller registra pagos de clientes dentro de la app.
- **Permisos sensibles:** la app solo usa ubicación en primer plano (no necesita declaración de segundo plano).

### 4. Prueba cerrada (obligatoria en tu cuenta)
Tu cuenta es personal y nueva, así que Google exige **al menos 12 testers durante 14 días seguidos** antes de dar acceso a producción.

1. Pruebas → **Prueba cerrada** → Crear pista → Testers: crea una lista de correos Gmail (consigue **15–20** para tener margen).
2. Crear versión → sube `TallerOS-play-1.aab` → notas: "Primera versión de prueba" → Guardar y enviar a revisión.
3. Cuando se apruebe, copia el **enlace de participación** y envíalo a tus testers. Cada uno debe: abrir el enlace con su Gmail → "Convertirse en tester" → instalar desde Play.
4. **Los 12 deben quedarse inscritos 14 días seguidos** (si alguien sale y vuelve a entrar, su conteo se reinicia). Pídeles que abran la app de vez en cuando.
5. Pasados los 14 días: Panel → **Solicitar acceso a producción** y responde el cuestionario (cómo probaste, qué feedback recibiste).
6. Producción → Crear versión → mismo `.aab` (o uno nuevo con versionCode mayor) → revisión de Google (de 1 a 7 días).

## Para cada actualización futura
1. Haz tus cambios.
2. `build-play.ps1` (sube solo el versionCode y genera el nuevo `.aab`).
3. Súbelo a Play Console (producción o prueba).
4. Para tus usuarios con el APK interno: `publicar-actualizacion.ps1` como siempre.
