; Inno-Setup-Skript für ScriptGenius (Installation ohne Adminrechte, pro Benutzer:in)
; Registry: WebDir nennt den Ordner der Oberfläche, PlanDir den Ordner der Pläne (beides für HoneyCut).
#define AppVersion GetEnv("SG_VERSION")
#if AppVersion == ""
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{8E2C5B71-4D93-4A6F-B1E8-27C9D5A04F63}
AppName=ScriptGenius
AppVersion={#AppVersion}
AppPublisher=Honey Balecta
DefaultDirName={localappdata}\Programs\ScriptGenius
DefaultGroupName=ScriptGenius
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=ScriptGenius-Setup-{#AppVersion}
SetupIconFile=scriptgenius.ico
UninstallDisplayIcon={app}\ScriptGenius.exe
Compression=lzma2/normal
SolidCompression=no
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes
; Läuft ScriptGenius noch – auch ein Fenster ohne Rückmeldung –, beendet der Installer es, statt alte Dateien stehen zu lassen
CloseApplications=force
RestartApplications=no

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Symbol auf dem Desktop anlegen"; GroupDescription: "Zusätzlich:"

[Files]
Source: "..\dist\ScriptGenius\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Oberfläche zusätzlich als offener Ordner – für HoneyCut
Source: "..\dist-web\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\HoneyBalecta\ScriptGenius"; ValueType: string; ValueName: "WebDir"; ValueData: "{app}\web"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\HoneyBalecta\ScriptGenius"; ValueType: string; ValueName: "Version"; ValueData: "{#AppVersion}"
Root: HKCU; Subkey: "Software\HoneyBalecta\ScriptGenius"; ValueType: string; ValueName: "PlanDir"; ValueData: "{userappdata}\ScriptGenius\plaene"
Root: HKCU; Subkey: "Software\Classes\.scriptgenius"; ValueType: string; ValueName: ""; ValueData: "ScriptGenius.Plan"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\ScriptGenius.Plan"; ValueType: string; ValueName: ""; ValueData: "ScriptGenius-Plan"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\ScriptGenius.Plan\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\ScriptGenius.exe,0"
Root: HKCU; Subkey: "Software\Classes\ScriptGenius.Plan\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\ScriptGenius.exe"" ""%1"""

[Icons]
Name: "{autoprograms}\ScriptGenius"; Filename: "{app}\ScriptGenius.exe"
Name: "{autodesktop}\ScriptGenius"; Filename: "{app}\ScriptGenius.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\ScriptGenius.exe"; Description: "ScriptGenius jetzt starten"; Flags: nowait postinstall skipifsilent
