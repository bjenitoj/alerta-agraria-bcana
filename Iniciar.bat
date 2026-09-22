@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo No se encuentra Node.js. Instalalo y vuelve a abrir este acceso directo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)

echo Cerrando una sesion anterior si estaba abierta...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3847" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>nul
)

echo Actualizando novedades agrarias de Castilla y Leon...
start "Alerta Agraria CyL" /MIN /D "%~dp0" cmd /c "node server.js"
timeout /t 3 /nobreak >nul
start "" http://localhost:3847