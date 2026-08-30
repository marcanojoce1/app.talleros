# ============================================================
# Compila y publica una actualizacion OTA de TallerOS, TODO en un
# solo comando -- no hace falta abrir ni tocar ningun archivo a mano.
# Uso: desde C:\talleros, corre:
#   powershell -ExecutionPolicy Bypass -File .\publicar-actualizacion.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$raiz = $PSScriptRoot

# 1) Sube el numero de build automaticamente (+1 sobre el que tenia).
$versionFile = Join-Path $raiz "mobile\src\version.js"
$contenido = Get-Content $versionFile -Raw
if ($contenido -notmatch "APP_BUILD\s*=\s*(\d+)") {
  Write-Host "No se pudo leer APP_BUILD de mobile\src\version.js" -ForegroundColor Red
  exit 1
}
$buildAnterior = [int]$matches[1]
$build = $buildAnterior + 1
$contenidoNuevo = $contenido -replace "APP_BUILD\s*=\s*\d+", "APP_BUILD = $build"
[System.IO.File]::WriteAllText($versionFile, $contenidoNuevo, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Numero de version subido automaticamente: $buildAnterior -> $build" -ForegroundColor Green

if ($contenidoNuevo -notmatch "APP_VERSION\s*=\s*'([^']+)'") {
  Write-Host "No se pudo leer APP_VERSION de mobile\src\version.js" -ForegroundColor Red
  exit 1
}
$version = $matches[1]

# 2) Compila el APK ya con el numero nuevo.
Write-Host ""
Write-Host "Compilando el APK (esto puede tardar varios minutos)..." -ForegroundColor Cyan
$androidDir = Join-Path $raiz "mobile\android"
Set-Location $androidDir
& .\gradlew.bat assembleRelease
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "LA COMPILACION FALLO. Revisa el error de arriba." -ForegroundColor Red
  Write-Host "El numero de version ya quedo actualizado en el codigo (build $build) pero no se publico nada." -ForegroundColor Yellow
  exit 1
}
Set-Location $raiz

# 3) Verifica que el APK recien compilado exista.
$apkOrigen = Join-Path $raiz "mobile\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apkOrigen)) {
  Write-Host "No encuentro el APK compilado en:" -ForegroundColor Red
  Write-Host "  $apkOrigen"
  exit 1
}

# 4) Copia el APK a la carpeta que sirve el servidor.
$apkDestino = Join-Path $raiz "backend\apk\talleros.apk"
Copy-Item -Path $apkOrigen -Destination $apkDestino -Force
Write-Host "APK copiado a backend\apk\talleros.apk" -ForegroundColor Green

# 5) Pide (opcional) una nota de que cambio, para que la vea quien actualice.
$notas = Read-Host "Que cambio en esta version? (Enter para dejarlo generico)"
if ([string]::IsNullOrWhiteSpace($notas)) { $notas = "Actualizacion disponible." }

# 6) Escribe version.json con el numero correcto.
$versionJson = @{
  appVersion = $version
  appBuild   = $build
  apk        = "/apk/talleros.apk"
  notas      = $notas
} | ConvertTo-Json

$versionJsonPath = Join-Path $raiz "backend\apk\version.json"
[System.IO.File]::WriteAllText($versionJsonPath, $versionJson, (New-Object System.Text.UTF8Encoding $false))
Write-Host "version.json actualizado -> build $build (v$version)" -ForegroundColor Green

# 7) Sube TODO a git (el numero de version, el APK, y cualquier otro cambio pendiente).
git add -A
git commit -m "Publicar actualizacion OTA - build $build"
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "El 'git commit' no se hizo (puede que no haya cambios nuevos, revisa arriba)." -ForegroundColor Yellow
}
git push
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "EL 'git push' FALLO. Revisa el error de arriba (login, conexion, o hay que hacer 'git pull' primero)." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "LISTO. Version $version (build $build) publicada." -ForegroundColor Cyan
Write-Host "Quien tenga la app instalada vera la actualizacion" -ForegroundColor Cyan
Write-Host "al presionar Buscar actualizacion en unos minutos." -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
