# ============================================================
# Genera el archivo .aab para subir a Google Play, en UN solo comando.
# Uso (desde C:\talleros):
#   powershell -ExecutionPolicy Bypass -File .\build-play.ps1
# Resultado: C:\talleros\play\TallerOS-play-<versionCode>.aab
# Al terminar deja la carpeta android lista otra vez para el APK interno.
# ============================================================
$ErrorActionPreference = "Stop"
$raiz = $PSScriptRoot
$mobile = Join-Path $raiz "mobile"
$keys = Join-Path $raiz "keys"
$propsFile = Join-Path $keys "keystore.properties"
$jks = Join-Path $keys "talleros-upload.jks"

# 0) Java (el de Android Studio)
$jbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }
$keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"

# 1) Llave de firma (se crea una sola vez y se guarda para siempre)
if (-not (Test-Path $propsFile)) {
  New-Item -ItemType Directory -Force -Path $keys | Out-Null
  Write-Host ""
  Write-Host "Primera vez: vamos a crear tu LLAVE DE FIRMA de Google Play." -ForegroundColor Cyan
  Write-Host "IMPORTANTE: guarda la carpeta C:\talleros\keys y las contrasenas en un lugar seguro (copia en USB/nube privada)." -ForegroundColor Yellow
  Write-Host "Si la pierdes, tendras que pedirle a Google que la restablezca (tarda dias)." -ForegroundColor Yellow
  Write-Host ""
  $clave = Read-Host "Inventa una contrasena para la llave (minimo 8 caracteres, anotala)"
  if ($clave.Length -lt 8) { Write-Host "La contrasena debe tener al menos 8 caracteres." -ForegroundColor Red; exit 1 }
  & $keytool -genkeypair -v -storetype PKCS12 -keystore $jks -alias talleros -keyalg RSA -keysize 2048 -validity 10000 -storepass $clave -keypass $clave -dname "CN=JM Marcano Dev, OU=TallerOS, O=JM Marcano Dev, L=Lima, C=PE"
  if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo crear la llave." -ForegroundColor Red; exit 1 }
  $jksFwd = $jks -replace "\\", "/"
  $texto = "storeFile=$jksFwd`nstorePassword=$clave`nkeyAlias=talleros`nkeyPassword=$clave`n"
  [System.IO.File]::WriteAllText($propsFile, $texto, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "Llave creada en $jks" -ForegroundColor Green
}

# 2) Sube el versionCode (Google Play exige un numero mayor en cada subida)
$pvFile = Join-Path $mobile "play-version.json"
$pv = Get-Content $pvFile -Raw | ConvertFrom-Json
$pv.versionCode = [int]$pv.versionCode + 1
[System.IO.File]::WriteAllText($pvFile, ($pv | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))
$vc = $pv.versionCode
Write-Host "versionCode para Google Play: $vc" -ForegroundColor Green

# 3) Prepara el proyecto Android en modo Play (sin actualizador por APK)
Set-Location $mobile
$env:APP_VARIANT = "play"
Write-Host "Preparando el proyecto (prebuild, modo Play)..." -ForegroundColor Cyan
npx expo prebuild --platform android --clean
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO el prebuild." -ForegroundColor Red; Remove-Item Env:APP_VARIANT -ErrorAction SilentlyContinue; exit 1 }

# 4) Compila el .aab firmado
Write-Host "Compilando el .aab (varios minutos)..." -ForegroundColor Cyan
Set-Location (Join-Path $mobile "android")
& .\gradlew.bat bundleRelease
$ok = ($LASTEXITCODE -eq 0)
Set-Location $mobile

# 5) Copia el resultado
if ($ok) {
  $aab = Join-Path $mobile "android\app\build\outputs\bundle\release\app-release.aab"
  $destDir = Join-Path $raiz "play"
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  $dest = Join-Path $destDir "TallerOS-play-$vc.aab"
  Copy-Item $aab $dest -Force
}

# 6) Deja la carpeta android lista otra vez para el APK interno
Remove-Item Env:APP_VARIANT -ErrorAction SilentlyContinue
Write-Host "Restaurando el proyecto para el APK interno..." -ForegroundColor Cyan
npx expo prebuild --platform android --clean | Out-Null
Set-Location $raiz

if ($ok) {
  Write-Host ""
  Write-Host "===============================================" -ForegroundColor Cyan
  Write-Host "LISTO. Archivo para Google Play:" -ForegroundColor Cyan
  Write-Host "  $dest" -ForegroundColor Cyan
  Write-Host "Subelo en Play Console > Pruebas > Prueba cerrada > Crear version." -ForegroundColor Cyan
  Write-Host "===============================================" -ForegroundColor Cyan
} else {
  Write-Host "LA COMPILACION FALLO. Revisa el error de arriba y pegamelo." -ForegroundColor Red
  exit 1
}
