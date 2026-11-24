# ScriptGenius

Planer für Videos mit mehreren möglichen Ausgängen. Bevor eine Abstimmung, eine Wahl oder eine Entscheidung fällt,
legst du fest, was in jedem Video gleich ist und an welchen Stellen sich die Videos trennen. Jeder Weg durch diese
Stellen ergibt ein eigenes Video. Du nimmst alles vorab in einem Zug auf und veröffentlichst direkt, sobald feststeht,
wie es ausgegangen ist.

ScriptGenius läuft für sich allein – unter Windows, auf Android und im Browser. Mit HoneyCut zusammen baut es aus
einer Aufnahme alle Videos auf einmal.

## Der Plan

- **Gemeinsamer Teil** – kommt in jedem Video vor (Einstieg, Einordnung, Schluss).
- **Weiche** – eine Stelle mit mehreren möglichen Ausgängen, etwa „Abstimmung: Angenommen / Abgelehnt“.
  Jeder Ausgang hat einen eigenen Text oder bleibt **ohne eigenen Teil** (auf diesem Weg kommt an der Stelle nichts).
- **Nur auf bestimmten Pfaden** – ein Teil oder eine ganze Weiche gilt nur nach bestimmten früheren Ausgängen.
  So kommt die Frage „Tritt er wieder an?“ nur in den Videos vor, in denen das Misstrauensvotum angenommen wurde.
- **Abweichende Fassung** – ein Text wird einmal geschrieben und gilt auf allen Pfaden; nur wo es nötig ist, ersetzt eine
  eigene Fassung ihn („Kommt zur Kundgebung“ statt „Kommt zur Versammlung“, wenn der Antrag abgelehnt wurde).
- **Skript oder nur Beschriftung** – jeder Abschnitt kann Text haben oder nur einen Namen („frei gesprochen“).

Rechts stehen die Zahl der Videos und der Abschnitte, die geschätzte Sprechzeit, der Baum aller Pfade und jedes Video
mit seinem Text. Je Video lässt sich ein Titel vergeben (für Titelbild und Übersicht in HoneyCut). „Skript“ zeigt das
**Aufnahme-Skript**: jeder Abschnitt einmal, in der Reihenfolge des Ablaufs – mit Überschriften oder als reiner Text
für den Souffleur.

## Exportieren

| Format | Datei | Inhalt |
|---|---|---|
| Drehbuch als PDF | `.pdf` | Übersicht, Baum, jedes Video mit Text, Aufnahme-Skript; Schriften eingebettet |
| Drehbuch als Webseite | `.html` | eine einzelne Datei, ohne Skripte und ohne Verweise nach außen |
| Drehbuch als Word-Datei | `.docx` | mit Formatvorlagen für Überschriften, Baum als Bild – für Word, LibreOffice, Google Docs |
| Drehbuch als Markdown | `.md` | für Notizen-Apps |
| Aufnahme-Skript | `.txt` | jeder Abschnitt einmal, mit Überschriften |
| Souffleur-Fassung | `.txt` | nur der Text zum Vorlesen, ohne Überschriften und Anweisungen in eckigen Klammern |
| Texte je Video | `.zip` | eine Textdatei je Video |
| Baum als Bild / Grafik | `.png` / `.svg` | die Pfade auf einen Blick |
| Karten je Video | `.zip` | je Video ein Bild 1080 × 1920 mit allen Abschnitten |
| Tabelle der Videos | `.csv` | Ausgänge, Titel, Abschnitte, Wörter, Länge – für Excel (Semikolon, UTF-8 mit BOM) |
| Plan zum Weiterbearbeiten | `.scriptgenius` | für ScriptGenius und HoneyCut auf einem anderen Gerät |
| Alles zusammen | `.zip` | alle Formate in einem Archiv |

Alle Exporte entstehen auf dem Gerät, ohne Netz und ohne fremde Bibliotheken.

## Wo die Pläne liegen – und wie HoneyCut sie findet

| | Ablage | HoneyCut |
|---|---|---|
| Windows | `%APPDATA%\ScriptGenius\plaene`, eine Datei `<id>.scriptgenius` je Plan; Gelöschtes in `papierkorb` | liest und schreibt denselben Ordner (Registry `HKCU\Software\HoneyBalecta\ScriptGenius\PlanDir`) |
| Android | Dateien der App | liest und schreibt über die Schnittstelle `content://de.honeybalecta.scriptgenius.plaene` – geschützt durch eine Berechtigung, die nur Apps mit demselben Signaturschlüssel bekommen |
| Browser | Browser-Speicher (`localStorage` „sg-plans“) auf honeybalecta.github.io | HoneyCut im Browser liegt auf derselben Website und liest mit |

In HoneyCut steht ein Plan unter „Transkribieren“ → **„Pfad-Plan“** bereit. Ist ScriptGenius installiert, öffnet
HoneyCut es dort auch direkt („Pfade planen“, „ScriptGenius öffnen“): Die Oberfläche läuft dann eingebettet in
HoneyCut, arbeitet auf denselben Plänen, und **„Im Projekt verwenden“** übernimmt den Plan in das geöffnete Projekt.
HoneyCut findet die Oberfläche unter Windows über den Registry-Eintrag `WebDir`, auf Android in den Assets der App
(`sg/`), im Browser unter `../scriptgenius/`.

Zwischen Geräten wandert ein Plan als Datei: „Exportieren“ → „Plan zum Weiterbearbeiten“, dann in ScriptGenius über
„Pläne“ → „Aus Datei öffnen“ oder in HoneyCut über „Pfad-Plan“ → „Aus Datei laden“. Unter Windows öffnet ein
Doppelklick auf eine `.scriptgenius`-Datei ScriptGenius, auf Android „Teilen“ oder „Öffnen mit“.

## Dateiformat `.scriptgenius`

JSON, UTF-8:

```json
{"app": "scriptgenius", "v": 1, "id": "…", "name": "Mietendeckel", "made": 0, "changed": 0,
 "blocks": [
   {"id": "…", "kind": "teil", "label": "Einstieg", "text": "…"},
   {"id": "…", "kind": "weiche", "label": "Abstimmung", "outs": [
     {"id": "…", "label": "Angenommen", "text": "…"},
     {"id": "…", "label": "Abgelehnt", "text": "…"}]},
   {"id": "…", "kind": "teil", "label": "Schluss", "text": "…",
    "alts": [{"id": "…", "when": {"<Weiche>": ["<Ausgang>"]}, "text": "…"}]}
 ],
 "paths": {"<Weiche>.<Ausgang>~…": {"title": "Deckel steht"}}}
```

`when` an einem Block oder einer Weiche: gilt nur auf diesen Pfaden. `leer: true` an einem Ausgang: ohne eigenen
Teil. Kennungen bestehen aus `A–Z a–z 0–9 _ -` (höchstens 24 Zeichen). Der Rechenkern dazu ist `web/sg-core.js`;
HoneyCut trägt eine Kopie davon (`core/web/sg-core.js`) – nach Änderungen dort mitziehen.

## Aufbau

| Ordner | |
|---|---|
| `web/` | Oberfläche (`index.html`, `sg-app.js`, `sg.css`), Rechenkern (`sg-core.js`), Exporte (`sg-export.js`) |
| `fonts/` | Inter und Lora (SIL OFL) für die PDF-Exporte |
| `build.py` | stellt `web/` und `fonts/` samt `version.txt` zu einem Ordner zusammen – für alle Plattformen |
| `desktop/` | Windows-Programm (pywebview, eigener Server für die Ablage), PyInstaller, Inno-Setup-Installer |
| `android/` | Android-App (WebView, Ablage, Schnittstelle für HoneyCut) |
| `tests/` | Prüfläufe |

## Bauen und veröffentlichen

Alles läuft über GitHub Actions:

- **ScriptGenius bauen** (`build.yml`) – bei jedem Push auf `main`: Android-APK (`ScriptGenius-Android-<Version>.apk`,
  Release `android-v<Version>`) und Windows-Installer (`ScriptGenius-Setup-<Version>.exe`, Release `v<Version>`).
  Die Version steht in `version.txt`; der `versionCode` der APK ist die Laufnummer des Workflows.
- **Web-Version** (`pages.yml`) – veröffentlicht die Oberfläche auf GitHub Pages (Einstellung „Source: GitHub Actions“).
- **Prüfläufe** (`test.yml`).

Für die APK braucht das Repository die Secrets `ANDROID_KEYSTORE_B64` und `ANDROID_KEYSTORE_PASSWORD` – **derselbe
Schlüssel wie bei HoneyCut**. Nur dann bekommt HoneyCut die Berechtigung, die Pläne zu lesen, und Updates über
Honeys Werkstatt funktionieren. Ohne Schlüssel entsteht nur ein Testbuild, der nicht veröffentlicht wird.

Der Installer richtet ScriptGenius pro Benutzer:in ein (ohne Administrationsrechte, fester `AppId`
`{8E2C5B71-4D93-4A6F-B1E8-27C9D5A04F63}`), sodass Honeys Werkstatt still aktualisieren kann.

## Prüfläufe

```sh
tests/lauf.sh
```

1. **Windows-Programm ohne Fenster** (`tests/test_desktop.py`): Ordner der Pläne, unsichere Kennungen, Papierkorb, der
   Server für die Oberfläche (nur mit dem Schlüssel des Programmlaufs und nur lokal).
2. **Oberfläche** (`tests/p_sg.mjs`, Playwright) gegen den echten Server des Windows-Programms: einen Plan anlegen,
   Bedingungen und abweichende Fassungen, Skript, Pläne kopieren, löschen, aus Datei laden, Änderungen von außen,
   Handy-Ansicht, Browser-Fassung mit Download.
3. **Alle Exporte**, gelesen wie von anderen Programmen (`tests/pruefe.py`): PDF mit pypdf und qpdf, Word über das
   Archiv, Bilder mit Pillow, SVG als XML.

Braucht Python 3 mit `pypdf` und `pillow`, Node 22 und (für `npm install` in `tests/`) Playwright. Bericht:
`tests/.work/bericht.md`, Bildschirmfotos in `tests/.work/bilder/`.

Das Zusammenspiel mit HoneyCut (gemeinsamer Ordner, eingebettete Oberfläche, „Im Projekt verwenden“) prüft der
Prüflauf von HoneyCut (`tests/p_pfade.mjs` im Repository honeybalecta/textschnitt); er baut ScriptGenius dafür aus
diesem Repository.

## Lizenz der Schriften

Inter und Lora stehen unter der SIL Open Font License 1.1, siehe `fonts/OFL.txt` und `fonts/LIZENZ.md`.
