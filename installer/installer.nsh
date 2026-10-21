; Zastita: ne instaliraj preko stare Gimnastike (PHP) koja ima Gimnastika.exe i server\.
; Bez LogicLib: ovaj fajl se ucitava pre njega.
!macro gimStaraU dir
  IfFileExists "${dir}\Gimnastika.exe" +2 0
  IfFileExists "${dir}\server" 0 +2
  StrCpy $R9 "1"
!macroend

; Poziva se dok korisnik bira fasciklu: Abort onemogucava dugme Dalje.
Function .onVerifyInstDir
  StrCpy $R9 "0"
  !insertmacro gimStaraU "$INSTDIR"
  !insertmacro gimStaraU "$INSTDIR\Gimnastika"
  StrCmp $R9 "1" 0 +2
  Abort
FunctionEnd

!macro customInit
  IfSilent 0 gimInitKraj
  StrCpy $R9 "0"
  !insertmacro gimStaraU "$INSTDIR"
  StrCmp $R9 "1" 0 gimInitKraj
  SetErrorLevel 2
  Abort
  gimInitKraj:
!macroend

!macro customPageAfterChangeDir
  Page custom gimProveraFascikle
!macroend

!ifndef BUILD_UNINSTALLER
; Rezerva ako je izbor ipak prosao: poruka i izlaz pre kopiranja fajlova.
Function gimProveraFascikle
  StrCpy $R9 "0"
  !insertmacro gimStaraU "$INSTDIR"
  !insertmacro gimStaraU "$INSTDIR\Gimnastika"
  StrCmp $R9 "1" 0 gimDobro
  MessageBox MB_OK|MB_ICONSTOP "U izabranoj fascikli je instalirana starija Gimnastika. Izaberite drugu fasciklu."
  SetErrorLevel 2
  Quit
  gimDobro:
  Abort
FunctionEnd
!endif
