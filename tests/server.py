"""Prüf-Server: der echte Server des Windows-Programms (desktop/scriptgenius_app.py), nur ohne Fenster.

Aufruf: python3 tests/server.py OBERFLÄCHE AUSGABE
  OBERFLÄCHE  der von build.py gebaute Ordner
  AUSGABE     hierhin schreibt „Speichern unter“ – ohne Dialog, unter dem vorgeschlagenen Dateinamen
Die Pläne liegen im Ordner aus SCRIPTGENIUS_PLANS. HoneyCut gilt als nicht installiert.
Gibt eine Zeile JSON aus ({"port": …, "token": …}) und läuft dann, bis der Prozess beendet wird."""
import json
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "desktop"))
import scriptgenius_app as app  # noqa: E402

app.WEB_DIR = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve()
OUT.mkdir(parents=True, exist_ok=True)


def sichern(name: str, daten: bytes) -> str:
    ziel = OUT / Path(name).name
    ziel.write_bytes(daten)
    return str(ziel)


app.datei_sichern = sichern
app.honeycut_exe = lambda: None
srv = ThreadingHTTPServer(("127.0.0.1", 0), app.Quiet)
print(json.dumps({"port": srv.server_address[1], "token": app.TOKEN}), flush=True)
srv.serve_forever()
