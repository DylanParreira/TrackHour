@echo off
title TrackHour

REM Se placer dans le dossier du bat (fiable peu importe comment il est lancé)
cd /d %~dp0

REM Tuer toutes les instances Node.js existantes (sans filtre par titre)
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

REM Lancer le serveur
node server.js
