"""Liest exportierte Dateien so, wie es andere Programme tun, und gibt das Ergebnis als JSON aus (für p_sg.mjs).

Aufruf: python3 tests/pruefe.py DATEI …
PDF über pypdf (und qpdf --check, wenn vorhanden), Word über das ZIP-Archiv, Bilder über Pillow, SVG als XML."""
import csv
import io
import json
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


def png(data: bytes):
    from PIL import Image
    im = Image.open(io.BytesIO(data))
    im.load()
    # Anteil der Bildpunkte, die nicht Hintergrund sind (grob: weicht von der Ecke oben links ab)
    small = im.convert("RGB").resize((60, 60))
    bg = small.getpixel((0, 0))
    raw = small.tobytes()
    filled = sum(1 for i in range(0, len(raw), 3) if abs(raw[i] - bg[0]) + abs(raw[i + 1] - bg[1]) + abs(raw[i + 2] - bg[2]) > 40) / 3600
    return {"w": im.width, "h": im.height, "mode": im.mode, "filled": round(filled, 3), "bg": "#%02X%02X%02X" % bg}


def svg(text: str):
    root = ET.fromstring(text)
    ns = "{http://www.w3.org/2000/svg}"
    return {"root": root.tag.replace(ns, ""), "viewBox": root.get("viewBox"), "texts": [t.text or "".join(t.itertext()) for t in root.iter(ns + "text")]}


def docx(data: bytes):
    z = zipfile.ZipFile(io.BytesIO(data))
    names = z.namelist()
    xml = z.read("word/document.xml").decode("utf-8")
    paras = ["".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", p)) for p in re.findall(r"<w:p[ >].*?</w:p>", xml, re.S)]
    styles = re.findall(r'<w:pStyle w:val="([^"]+)"', xml)
    return {"names": names, "paras": [p for p in paras if p], "styles": sorted(set(styles)), "pics": xml.count("<pic:pic"),
            "media": [n for n in names if n.startswith("word/media/")]}


def pdf(path: Path):
    from pypdf import PdfReader
    r = PdfReader(str(path))
    texts = [(p.extract_text() or "") for p in r.pages]
    fonts = set()
    for p in r.pages:
        res = p.get("/Resources") or {}
        for f in (res.get("/Font") or {}).values():
            f = f.get_object()
            d = f.get("/FontDescriptor")
            fonts.add((str(f.get("/BaseFont")), bool(d and ("/FontFile2" in d.get_object()))))
    out = {"pages": len(r.pages), "text": texts, "fonts": sorted([n, e] for n, e in fonts), "title": (r.metadata or {}).get("/Title")}
    if shutil.which("qpdf"):
        q = subprocess.run(["qpdf", "--check", str(path)], capture_output=True, text=True)
        out["qpdf"] = q.returncode
    return out


def one(path: Path):
    data = path.read_bytes()
    ext = path.suffix.lower()
    res = {"name": path.name, "size": len(data)}
    if ext == ".pdf":
        res.update(pdf(path))
    elif ext == ".docx":
        res.update(docx(data))
    elif ext == ".png":
        res.update(png(data))
    elif ext == ".svg":
        res.update(svg(data.decode("utf-8")))
    elif ext == ".zip":
        z = zipfile.ZipFile(io.BytesIO(data))
        res["bad"] = z.testzip()
        res["entries"] = []
        for n in z.namelist():
            e = {"name": n, "size": z.getinfo(n).file_size}
            inner = z.read(n)
            if n.lower().endswith(".png"):
                e.update(png(inner))
            elif n.lower().endswith((".txt", ".md", ".csv", ".html", ".svg", ".scriptgenius")):
                e["text"] = inner.decode("utf-8-sig")[:4000]
            elif n.lower().endswith(".pdf"):
                e["pdf"] = inner[:8].decode("latin-1")
            elif n.lower().endswith(".docx"):
                e["docx"] = len(docx(inner)["paras"])
            res["entries"].append(e)
    elif ext == ".csv":
        text = data.decode("utf-8")
        res["bom"] = text.startswith("﻿")
        res["rows"] = list(csv.reader(io.StringIO(text.lstrip("﻿")), delimiter=";"))
    elif ext == ".html":
        text = data.decode("utf-8")
        m = re.search(r"<title>(.*?)</title>", text, re.S)
        res.update({"title": m and m.group(1), "text": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<(style|script)[^>]*>.*?</\1>", "", text, flags=re.S))).strip(),
                    "external": re.findall(r'(?:src|href)="(https?:[^"]+)"', text), "scripts": text.count("<script")})
    elif ext == ".scriptgenius":
        p = json.loads(data.decode("utf-8"))
        res.update({"app": p.get("app"), "plan": p.get("name"), "blocks": len(p.get("blocks") or []), "paths": p.get("paths")})
    else:
        res["text"] = data.decode("utf-8")
    return res


if __name__ == "__main__":
    print(json.dumps([one(Path(a)) for a in sys.argv[1:]], ensure_ascii=False))
