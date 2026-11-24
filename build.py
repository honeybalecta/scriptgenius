#!/usr/bin/env python3
"""Stellt ScriptGenius als fertigen Ordner zusammen (Web-Seite, Android-Assets, Windows-Programm, Einbettung in HoneyCut).

Aufruf: python3 build.py ZIELORDNER
Kopiert web/ und die Schriften aus fonts/ in einen Ordner und legt version.txt dazu."""
import shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "web"
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "site"
VERSION = (ROOT / "version.txt").read_text().strip()

shutil.rmtree(OUT, ignore_errors=True)
OUT.mkdir(parents=True)
for f in SRC.iterdir():
    if f.is_file():
        shutil.copy(f, OUT / f.name)
fonts = OUT / "fonts"
fonts.mkdir()
for f in (ROOT / "fonts").iterdir():
    if f.suffix.lower() in (".ttf", ".otf", ".txt", ".md"):
        shutil.copy(f, fonts / f.name)
(OUT / "version.txt").write_text(VERSION)
print(f"ScriptGenius {VERSION} → {OUT}")
