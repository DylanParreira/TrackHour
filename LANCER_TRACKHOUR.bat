@echo off
title TrackHour

REM Tuer toutes les instances Node.js existantes (sans filtre par titre)
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

REM Lancer le serveur (ce processus cmd devient le serveur, pas besoin de pause)
node server.js
