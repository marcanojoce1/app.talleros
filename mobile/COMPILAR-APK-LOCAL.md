# Compilar el APK en tu propia PC (Windows)

No necesitas EAS ni esperar cuota. Todo se hace en tu computadora.

## Antes de empezar — verifica que tienes lo necesario

Abre PowerShell y ejecuta estos comandos **uno por uno**. Cada uno debe responder algo (no un error):

```
java -version
```
Debe decir version "17" (Expo SDK 51 necesita **Java 17**). Si dice 11 o 21, instala el JDK 17.

```
echo $env:ANDROID_HOME
```
Debe mostrar una ruta como `C:\Users\TuUsuario\AppData\Local\Android\Sdk`.
Si sale vacío, configúralo (ver "Si falta ANDROID_HOME" abajo).

```
node -v
```
Debe decir v18 o superior.

---

## PASO 1 — Preparar el proyecto

Abre PowerShell en la carpeta del proyecto:

```
cd C:\talleros\mobile
```

Instala las dependencias:

```
npm install
```

---

## PASO 2 — Generar la carpeta de Android

Este comando crea la carpeta `android` con todo lo necesario:

```
npx expo prebuild --platform android --clean
```

Tarda 1-3 minutos. Si pregunta algo, acepta con Enter.

---

## PASO 3 — Compilar el APK

Entra a la carpeta android:

```
cd android
```

### Opción A — APK de prueba (más simple, recomendada la primera vez)

```
.\gradlew.bat assembleDebug
```

Tarda 5-15 minutos la primera vez (descarga dependencias).

El APK queda en:
```
C:\talleros\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

### Opción B — APK de producción (más liviano y rápido)

Necesita una firma. Genera la llave **una sola vez**:

```
keytool -genkeypair -v -storetype PKCS12 -keystore talleros.keystore -alias talleros -keyalg RSA -keysize 2048 -validity 10000
```

Te pedirá una contraseña (anótala) y unos datos (puedes poner cualquier cosa).

Luego crea el archivo `C:\talleros\mobile\android\gradle.properties` y agrega al final:

```
MYAPP_UPLOAD_STORE_FILE=talleros.keystore
MYAPP_UPLOAD_KEY_ALIAS=talleros
MYAPP_UPLOAD_STORE_PASSWORD=TU_CONTRASEÑA
MYAPP_UPLOAD_KEY_PASSWORD=TU_CONTRASEÑA
```

Y compila:

```
.\gradlew.bat assembleRelease
```

El APK queda en:
```
C:\talleros\mobile\android\app\build\outputs\apk\release\app-release.apk
```

---

## PASO 4 — Instalar en el teléfono

**Por cable:** conecta el teléfono con depuración USB activada y ejecuta:
```
.\gradlew.bat installDebug
```

**Sin cable:** copia el archivo `.apk` al teléfono (por WhatsApp, correo o USB), ábrelo desde el teléfono y acepta instalar de "orígenes desconocidos".

---

## Si algo falla

**"gradlew.bat no se reconoce"**
No estás dentro de la carpeta `android`. Ejecuta `cd C:\talleros\mobile\android`.

**"SDK location not found"**
Crea el archivo `C:\talleros\mobile\android\local.properties` con esta línea
(cambia TuUsuario por tu nombre de usuario de Windows):
```
sdk.dir=C:\\Users\\TuUsuario\\AppData\\Local\\Android\\Sdk
```

**"Unsupported class file major version" o error de Java**
Tienes la versión equivocada de Java. Instala el **JDK 17**.

**Si falta ANDROID_HOME**
Panel de control → Buscar "variables de entorno" → Variables de entorno →
Nueva variable de usuario:
- Nombre: `ANDROID_HOME`
- Valor: `C:\Users\TuUsuario\AppData\Local\Android\Sdk`

Cierra y vuelve a abrir PowerShell.

**El build se queda pegado**
La primera compilación descarga mucho. Déjalo hasta 30 minutos.
Si falla, ejecuta `.\gradlew.bat clean` y vuelve a intentar.

---

## Cambios futuros

Cuando modifiques el código de la app:

```
cd C:\talleros\mobile\android
.\gradlew.bat assembleDebug
```

No hace falta repetir el `prebuild` salvo que cambies `app.json`
o agregues librerías nuevas.

---

## Nota sobre la dirección del servidor

La app ya trae configurada `https://app-talleros.onrender.com`.

Si tu dirección cambia, **no necesitas recompilar**: en la pantalla de inicio
de sesión hay un enlace abajo que dice "⚙ Servidor: ..." donde puedes
escribir la dirección nueva y guardarla.
