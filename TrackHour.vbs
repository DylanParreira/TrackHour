Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Obtenir le dossier du script VBS (fonctionne peu importe où le dossier est placé)
Dim scriptDir
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

' Si node_modules absent, lancer npm install d'abord
If Not fso.FolderExists(scriptDir & "node_modules") Then
    WshShell.CurrentDirectory = scriptDir
    Dim install
    install = WshShell.Run("cmd /c npm install", 1, True)
    If install <> 0 Then
        MsgBox "Erreur lors de npm install. Vérifie que Node.js est installé (nodejs.org).", vbCritical, "TrackHour"
        WScript.Quit
    End If
End If

' Lancer le serveur en arrière-plan
WshShell.Run """" & scriptDir & "LANCER_TRACKHOUR.bat""", 0, False

' Attendre 3 secondes que le serveur démarre
WScript.Sleep 3000

' Ouvrir le navigateur
WshShell.Run "http://localhost:3000"

Set fso = Nothing
Set WshShell = Nothing
