@echo off
title TrackHour

REM Tuer les anciennes instances de Node.js pour TrackHour
taskkill /F /IM node.exe /FI "WINDOWTITLE eq TrackHour*" 2>nul

REM Lancer le serveur en arrière-plan (invisible)
start /B node server.js

REM Attendre que le serveur soit prêt
timeout /t 2 /nobreak >nul

REM NE PAS ouvrir le navigateur (c'est le VBS qui le fait)
REM start http://localhost:3000

REM Garder le serveur actif
echo TrackHour serveur demarre
pause >nul

REM Arrêter le serveur proprement
taskkill /F /IM node.exe 2>nul

exit
