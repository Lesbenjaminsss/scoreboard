@echo off
title Scoreboard
cd /d "%~dp0"

set "NODE_DIR=C:\Users\bunya\AppData\Local\Programs\node-v24.19.0-win-x64"
if exist "%NODE_DIR%" set "PATH=%NODE_DIR%;%PATH%"

if not exist node_modules (
  echo Ilk calistirmada paketler kuruluyor - bir kere...
  call npm install
)

echo.
echo Scoreboard baslatiliyor...
echo Kontrol penceresinden lig ve mac secin.
echo Ctrl+Shift+S = panoyu goster/gizle
echo.
call npm start

if /i not "%~1"=="hidden" (
  echo.
  echo Uygulama kapatildi.
  pause
)
