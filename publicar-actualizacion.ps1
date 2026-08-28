# ============================================================
# Publica una actualización OTA de TallerOS en un solo paso.
# Uso: desde C:\talleros, después de compilar el APK, corre:
#   .\publicar-actualizacion.ps1
# Hace todo lo que antes había que hacer a mano: copia el APK,
# actualiza version.json con el número correcto, y sube a git.
# ============================================================

$ErrorActionPreference = "Stop"
$raiz = $PSScriptRoot

# 1) Lee el número de versión (APP_BUILD) directo del código, para no
#    tener que escribirlo dos veces ni que se desincronice.
$versionFile = Join-Path $raiz "mobile\src\version.js"
$contenido = Get-Content $versionFile -Raw
if ($contenido -notmatch "APP_BUILD\s*=\s*(\d+)") {
  Write-Host "No se pudo leer APP_BUILD de mobile\src\version.js" -ForegroundColor Red
  exit 1
}
$build = $matches[1]
if ($contenido -notmatch "APP_VERSION\s*=\s*'([^']+)'") {
  Write-Host "No se pudo leer APP_VERSION de mobile\src\version.js" -ForegroundColor Red
  exit 1
}
$version = $matches[1]

# 2) Verifica que el APK recién compilado exista.
$apkOrigen = Join-Path $raiz "mobile\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apkOrigen)) {
  Write-Host "No encuentro el APK compilado en:" -ForegroundColor Red
  Write-Host "  $apkOrigen"
  Write-Host "Compila primero con: cd mobile\android; .\gradlew.bat assembleRelease"
  exit 1
}

# 3) Copia el APK a la carpeta que sirve el servidor.
$apkDestino = Join-Path $raiz "backend\apk\talleros.apk"
Copy-Item -Path $apkOrigen -Destination $apkDestino -Force
Write-Host "APK copiado a backend\apk\talleros.apk" -ForegroundColor Green

# 4) Pide (opcional) una nota de que cambio, para que la vea quien actualice.
$notas = Read-Host "Que cambio en esta version? (Enter para dejarlo generico)"
if ([string]::IsNullOrWhiteSpace($notas)) { $notas = "Actualizacion disponible." }

# 5) Escribe version.json con el número correcto (el mismo que ya tiene el código).
$versionJson = @{
  appVersion = $version
  appBuild   = [int]$build
  apk        = "/apk/talleros.apk"
  notas      = $notas
} | ConvertTo-Json

$versionJsonPath = Join-Path $raiz "backend\apk\version.json"
Set-Content -Path $versionJsonPath -Value $versionJson -Encoding UTF8
Write-Host "version.json actualizado -> build $build (v$version)" -ForegroundColor Green

# 6) Sube todo a git para que Render lo despliegue solo.
Set-Location $raiz
git add backend\apk\talleros.apk backend\apk\version.json
git commit -m "Publicar actualizacion OTA - build $build"
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "El 'git commit' no se hizo (puede que no haya cambios nuevos que subir, revisa arriba)." -ForegroundColor Yellow
}
git push
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "EL 'git push' FALLO. Revisa el error de arriba (login, conexion, o hay que hacer 'git pull' primero)." -ForegroundColor Red
  Write-Host "El APK y version.json quedaron guardados localmente pero NO llegaron al servidor todavia." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Listo. Quien tenga la app instalada vera la actualizacion al presionar" -ForegroundColor Cyan
Write-Host "el boton Buscar actualizacion (dentro de unos minutos, cuando Render termine de desplegar)." -ForegroundColor Cyan
