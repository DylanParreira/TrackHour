Set WshShell = CreateObject("WScript.Shell")

' Obtenir le dossier du script VBS (fonctionne peu importe où le dossier est placé)
Dim scriptDir
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

' Lancer le serveur en arrière-plan
WshShell.Run """" & scriptDir & "LANCER_TRACKHOUR.bat""", 0, False

' Attendre 3 secondes que le serveur démarre
WScript.Sleep 3000

' Ouvrir le navigateur
WshShell.Run "http://localhost:3000"

Set WshShell = Nothing
