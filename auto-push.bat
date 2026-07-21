@echo off
setlocal

cd /d "%~dp0"

echo === Auto push uSocial ===

git add -A

set MSG=%*
if "%MSG%"=="" set MSG=auto commit %date% %time%

git commit -m "%MSG%"
if errorlevel 1 (
    echo Nessuna modifica da committare, provo comunque il push...
)

git push origin main

echo === Fatto ===
pause
