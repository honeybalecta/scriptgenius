#!/usr/bin/env bash
# Prüfläufe für ScriptGenius. Aufruf aus beliebigem Ordner: tests/lauf.sh
# 1) Windows-Programm ohne Fenster (Ordner der Pläne, Server) – Python
# 2) Oberfläche, Exporte, Browser- und Handy-Ansicht – Playwright (p_sg.mjs) gegen den echten Server
# Bericht: tests/.work/bericht.md, Bildschirmfotos: tests/.work/bilder
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
export SG_WORK="${SG_WORK:-$HERE/.work}"
# Chromium unter Linux braucht eine UTF-8-Umgebung, sonst heißt ein Download mit Umlauten im Namen nur „download“
case "${LC_ALL:-${LANG:-}}" in *UTF-8*|*utf8*|*UTF8*|*utf-8*) ;; *) export LANG=C.UTF-8 LC_ALL=C.UTF-8 ;; esac
mkdir -p "$SG_WORK"
FEHLER=0

echo "== Windows-Programm (ohne Fenster)"
if ! (cd "$ROOT" && python3 -m unittest discover -s tests 2>&1 | tail -4); then FEHLER=1; fi
(cd "$ROOT" && python3 -m unittest discover -s tests > "$SG_WORK/unittest.log" 2>&1) || FEHLER=1

echo "== Oberfläche und Exporte"
python3 "$ROOT/build.py" "$SG_WORK/web" > /dev/null || { echo "build.py ist gescheitert"; exit 1; }
[ -d "$HERE/node_modules/playwright" ] || (cd "$HERE" && npm install --no-audit --no-fund --silent) || { echo "Playwright fehlt (npm install in tests/)"; exit 1; }
node "$HERE/p_sg.mjs" || FEHLER=1

if [ -f "$SG_WORK/bericht.md" ]; then
  if [ $FEHLER -ne 0 ] && grep -q "bestanden" "$SG_WORK/bericht.md" && ! grep -q "OK$" "$SG_WORK/unittest.log"; then
    printf '\n❌ Windows-Programm: siehe unittest.log\n' >> "$SG_WORK/bericht.md"
  fi
  { echo; echo '```'; tail -3 "$SG_WORK/unittest.log"; echo '```'; } >> "$SG_WORK/bericht.md"
fi
exit $FEHLER
