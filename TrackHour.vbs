Set WshShell = CreateObject("WScript.Shell")

' Lancer le serveur en arrière-plan
WshShell.Run "C:\ClaudeWork\TrackHourWebV2\LANCER_TRACKHOUR.bat", 0, False

' Attendre 3 secondes que le serveur démarre
WScript.Sleep 3000

' Ouvrir le navigateur
WshShell.Run "http://localhost:3000"

Set WshShell = Nothing
