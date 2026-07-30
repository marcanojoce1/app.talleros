# Pasar TallerOS a producción

Guía para publicar la plataforma web en un dominio propio y la app en Google Play.

---

## ⚠️ DOS COSAS QUE DEBES SABER ANTES DE GASTAR UN CENTAVO

### 1. Crea la cuenta de Google Play como EMPRESA, no como personal

Esto te ahorra **entre 3 y 6 semanas de trabajo**.

Desde noviembre de 2023, las cuentas **personales** nuevas deben pasar una prueba
cerrada con **12 personas reales usando la app durante 14 días seguidos** antes de
poder publicar. Si un tester borra la app, el contador se reinicia.

Las cuentas de **organización (empresa)** están **exentas** de ese requisito.

Como TallerOS es un producto que vas a vender a talleres, te corresponde una cuenta
de organización. Para crearla necesitas:
- Nombre legal de la empresa
- Número de identificación fiscal (RIF)
- Un número D-U-N-S (se solicita gratis, tarda entre 5 y 30 días)

**Si creas la cuenta personal por error, no se puede convertir.** Tendrías que abrir
otra y pagar los $25 de nuevo.

### 2. La app NO se puede publicar tal como está hoy

Google exige que la app apunte a una versión reciente de Android:
- **Ahora mismo:** Android 15 (API 35) como mínimo
- **Desde el 31 de agosto de 2026:** Android 16 (API 36)

Tu proyecto usa **Expo SDK 51**, que apunta a Android 14 (API 34). **No cumple.**

Hay que **actualizar el Expo SDK** antes de publicar. Es la tarea técnica más grande
que queda y hay que hacerla con calma porque puede romper cosas que ya funcionan.

---

## PARTE A — La plataforma web con dominio propio

Esto es lo más rápido: se puede tener listo en 1 o 2 días.

### A1. Comprar el dominio (~$12 al año)

Registradores confiables: Namecheap, Porkbun, Cloudflare Registrar, GoDaddy.

Ideas de dominio (verifica disponibilidad):
- talleros.app
- talleros.com.ve
- mitalleros.com

### A2. Pasar Render a plan pago (~$7 al mes)

El plan gratuito **duerme la aplicación** tras 15 minutos sin uso: el primer usuario
del día espera 50 segundos a que despierte. Inaceptable para un taller trabajando.

También necesitas la **base de datos en plan pago**: en el plan gratuito de Render la
base de datos **se elimina** al vencer el periodo de prueba. Si eso pasa, pierdes todo.

> Verifica los precios actuales en render.com/pricing — cambian con el tiempo.

### A3. Conectar el dominio a Render

1. En Render: tu servicio → **Settings** → **Custom Domains** → **Add Custom Domain**
2. Escribe tu dominio (ej. `app.talleros.com`)
3. Render te da un valor CNAME
4. En tu registrador de dominio: crea un registro **CNAME** con ese valor
5. Espera de 10 minutos a 2 horas. Render genera el certificado HTTPS solo.

### A4. Seguridad — HAZLO ANTES DE ABRIR AL PÚBLICO

Esto es urgente. Hoy tu sistema tiene la contraseña de superadmin por defecto.

En Render → **Environment** → agrega estas variables:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | Un texto largo y aleatorio (40+ caracteres) |
| `RESCATE_CLAVE` | Otra clave distinta, para recuperar acceso |
| `CORS_ORIGIN` | Tu dominio, ej. `https://app.talleros.com` |

Y dentro del sistema:
1. Entra como superadmin
2. Cambia la contraseña `super1234` por una fuerte
3. Borra los datos de prueba (módulo Talleres → Zona de peligro)

### A5. Publicar la política de privacidad

El archivo `web-admin/privacidad.html` ya está creado. **Completa los campos
marcados [COMPLETAR]** con tus datos reales y quedará accesible en:

```
https://TU-DOMINIO/privacidad.html
```

Esa dirección la vas a necesitar para Google Play.

---

## PARTE B — La app en Google Play

### B1. Actualizar el Expo SDK (tarea técnica, la más delicada)

Sin esto Google rechaza la app. Hay que subir de SDK 51 a una versión que apunte a
API 36. Al hacerlo pueden romperse librerías, pantallas o estilos, así que después
hay que probar la app completa.

**No lo hagas solo.** Pídemelo y lo hacemos por partes, revisando qué se rompe.

### B2. Crear la cuenta de desarrollador ($25, pago único)

En `play.google.com/console` → elige **cuenta de organización** (ver advertencia arriba).

Google verifica tu identidad. Puede tardar unos días. **Hazlo desde ya**, en paralelo
con lo demás, para que no sea el cuello de botella.

### B3. Generar la llave de firma — Y GUARDARLA COMO EL ORO

```
keytool -genkeypair -v -storetype PKCS12 -keystore talleros-release.keystore -alias talleros -keyalg RSA -keysize 2048 -validity 10000
```

⚠️ **Si pierdes este archivo o su contraseña, NUNCA MÁS podrás actualizar tu app.**
Tendrías que publicarla de cero con otro nombre y perder todos los usuarios.

Guarda tres copias: disco externo, nube privada, y un pendrive aparte.
Guarda la contraseña en un gestor de contraseñas, no en un papel.

### B4. Generar el AAB (no APK)

Google Play ya no acepta APK para apps nuevas, solo **AAB** (Android App Bundle).

```
cd C:\talleros\mobile\android
```
```
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```
```
.\gradlew.bat bundleRelease
```

El archivo queda en:
```
C:\talleros\mobile\android\app\build\outputs\bundle\release\app-release.aab
```

### B5. Preparar los materiales de la tienda

| Material | Especificación |
|---|---|
| Icono | 512 × 512 px, PNG, sin transparencia |
| Gráfico destacado | 1024 × 500 px |
| Capturas de teléfono | Mínimo 2, máximo 8 (recomendado 4-6) |
| Descripción corta | Hasta 80 caracteres |
| Descripción completa | Hasta 4000 caracteres |
| Política de privacidad | La URL de la Parte A5 |

**Las capturas puedes tomarlas del teléfono** con la app funcionando. Elige las
pantallas que mejor venden: recepción con daños marcados, órdenes de taller, el acta.

### B6. Llenar el formulario de Seguridad de los datos

Google pregunta qué datos recoge tu app. Tienes que declarar con honestidad:

- ✅ Nombre, correo, teléfono, documento de identidad
- ✅ Fotos (del vehículo y reparaciones)
- ✅ Ubicación aproximada y precisa (solo para el auxilio vial)
- ✅ Datos financieros (montos de servicios)
- ❌ No se comparten con terceros
- ✅ Se transmiten cifrados (HTTPS)
- ✅ El usuario puede solicitar eliminación

Si declaras algo distinto a lo que hace la app, Google la retira cuando lo detecta.

### B7. Enviar a revisión

La primera revisión de una cuenta nueva puede tardar **hasta 7 días**, a veces más.
Prepárate para que pidan correcciones en el primer intento — es normal.

---

## Cuánto cuesta al año

| Concepto | Costo aproximado |
|---|---|
| Dominio | $12 / año |
| Servidor web (Render) | $84 / año ($7 al mes) |
| Base de datos | Verificar precio actual en Render |
| Cuenta Google Play | $25 (una sola vez) |
| **Primer año** | **alrededor de $150–250** |

Sin contar iOS. Publicar en App Store cuesta **$99 al año** y requiere una Mac.

---

## En qué orden hacerlo

**Esta semana**
1. Solicitar el número D-U-N-S (tarda, empieza ya)
2. Comprar el dominio
3. Pasar Render a plan pago
4. Poner las variables de seguridad y cambiar la contraseña de superadmin
5. Completar y publicar la política de privacidad

**Semanas 2 y 3**
6. Actualizar el Expo SDK (pídemelo)
7. Probar la app completa tras la actualización
8. Crear la cuenta de Google Play como organización

**Semana 4**
9. Generar la llave de firma y respaldarla
10. Generar el AAB
11. Tomar capturas y preparar los textos
12. Llenar la ficha y el formulario de datos
13. Enviar a revisión

---

## Lo que falta y conviene resolver antes de vender

Estas cosas funcionan a medias hoy. No bloquean la publicación, pero un taller que
pague las va a notar:

- **Notificaciones push reales** — hoy los avisos solo se ven al abrir la app.
  Requiere Firebase.
- **Correos reales** — la recuperación de contraseña necesita un servicio de correo
  configurado (Gmail SMTP o similar).
- **Fotos dentro de la base de datos** — hoy las imágenes se guardan como texto en el
  JSON. Con muchos vehículos, la base crecerá demasiado y se volverá lenta. Conviene
  moverlas a un almacenamiento aparte.
- **Editar recepción** — el formulario de edición no carga los daños ni accesorios
  completos, solo los campos básicos.
