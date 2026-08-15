Dim fso, dir, ws
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set ws = CreateObject("WScript.Shell")
ws.Run """" & dir & "\start.bat"" hidden", 0, False
