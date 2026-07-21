@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
    echo Installo le dipendenze...
    call npm install
)

echo === Eseguo i test (vitest) ===
call npm run test

echo.
echo === Avvio server di sviluppo locale (http://localhost:3000) ===
call npm run dev

pause
