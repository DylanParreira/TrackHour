@echo off
echo Arret de TrackHour...
taskkill /F /IM node.exe 2>nul
echo TrackHour arrete !
timeout /t 2 >nul
exit
