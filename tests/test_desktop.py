"""Prüfungen für das Windows-Programm ohne Fenster: Ordner der Pläne und der Server für die Oberfläche (/__store/…).

Aufruf: python3 -m unittest discover -s tests   (aus dem Hauptordner des Repositorys)
Die Pläne liegen dabei in einem frischen Ordner (SCRIPTGENIUS_PLANS), das Startprotokoll in einem eigenen APPDATA."""
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = Path(tempfile.mkdtemp(prefix="sg-test-"))
os.environ["SCRIPTGENIUS_PLANS"] = str(TMP / "plaene")
os.environ["APPDATA"] = str(TMP / "appdata")
sys.path.insert(0, str(ROOT / "desktop"))
import scriptgenius_app as app  # noqa: E402


def plan(pid, name="Plan", **extra):
    return {"app": "scriptgenius", "v": 1, "id": pid, "name": name, "made": 1, "changed": 2, "blocks": [], "paths": {}, **extra}


class Ordner(unittest.TestCase):
    def setUp(self):
        app.PLANS.mkdir(parents=True, exist_ok=True)
        for f in app.PLANS.rglob("*"):
            if f.is_file():
                f.unlink()

    def test_speichern_lesen_loeschen(self):
        app.plan_set("abc_1", json.dumps(plan("abc_1", "Mietendeckel")))
        app.plan_set("abc-2", json.dumps(plan("abc-2", "Zweiter")))
        self.assertEqual(sorted(p["name"] for p in app.plans_list()), ["Mietendeckel", "Zweiter"])
        self.assertFalse(list(app.PLANS.glob("*.tmp")), "keine halbfertigen Dateien")
        app.plan_del("abc_1")
        self.assertEqual([p["name"] for p in app.plans_list()], ["Zweiter"])
        self.assertTrue((app.TRASH / "abc_1.scriptgenius").is_file(), "gelöschte Pläne liegen im Papierkorb")
        app.plan_del("gibtsnicht")   # still

    def test_nur_plaene_aus_scriptgenius(self):
        with self.assertRaises(ValueError):
            app.plan_set("x1", json.dumps({"app": "etwas", "id": "x1"}))
        with self.assertRaises(ValueError):
            app.plan_set("x1", json.dumps(plan("anders")))
        with self.assertRaises(ValueError):
            app.plan_set("x1", "kein json")
        self.assertEqual(app.plans_list(), [])

    def test_unsichere_kennungen(self):
        for bad in ("../x", "a/b", "a\\b", "", "x" * 25, "a.b", "ä", "abc\n"):
            with self.assertRaises(ValueError, msg=bad):
                app.plan_file(bad)
        self.assertEqual(app.plan_file("Ab_9-z").name, "Ab_9-z.scriptgenius")

    def test_fremde_und_kaputte_dateien_bleiben_liegen(self):
        (app.PLANS / "kaputt.scriptgenius").write_text("{", encoding="utf-8")
        (app.PLANS / "fremd.scriptgenius").write_text(json.dumps({"app": "honeycut"}), encoding="utf-8")
        (app.PLANS / "notiz.txt").write_text("hallo", encoding="utf-8")
        app.plan_set("gut", json.dumps(plan("gut", "Gut")))
        self.assertEqual([p["name"] for p in app.plans_list()], ["Gut"])
        self.assertTrue((app.PLANS / "kaputt.scriptgenius").is_file())


class Server(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.web = TMP / "web"
        cls.web.mkdir(exist_ok=True)
        (cls.web / "index.html").write_text("<!doctype html><title>ScriptGenius</title>", encoding="utf-8")
        app.WEB_DIR = cls.web
        cls.out = TMP / "gesichert"
        cls.out.mkdir(exist_ok=True)
        cls.saved = []

        def sichern(name, daten):
            ziel = cls.out / Path(name).name
            ziel.write_bytes(daten)
            cls.saved.append(name)
            return str(ziel)
        app.datei_sichern = sichern
        app.honeycut_exe = lambda: None
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), app.Quiet)
        cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def req(self, path, body=None, token=None, host=None):
        r = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=body, method="GET" if body is None else "POST")
        if token is not False:
            r.add_header("X-ScriptGenius", token or app.TOKEN)
        if host:
            r.add_header("Host", host)
        try:
            with urllib.request.urlopen(r, timeout=10) as res:
                return res.status, res.read(), res.headers
        except urllib.error.HTTPError as e:
            return e.code, e.read(), e.headers

    def setUp(self):
        app.PLANS.mkdir(parents=True, exist_ok=True)
        for f in app.PLANS.rglob("*"):
            if f.is_file():
                f.unlink()

    def test_oberflaeche_ohne_schluessel(self):
        st, body, hd = self.req("/index.html", token=False)
        self.assertEqual(st, 200)
        self.assertIn(b"ScriptGenius", body)
        self.assertEqual(hd.get("Cache-Control"), "no-cache")

    def test_speicher_nur_mit_schluessel_und_lokal(self):
        self.assertEqual(self.req("/__store/list", token=False)[0], 403)
        self.assertEqual(self.req("/__store/list", token="falsch")[0], 403)
        self.assertEqual(self.req("/__store/list", host="boese.example")[0], 403, "DNS-Rebinding: fremder Host")
        self.assertEqual(self.req("/__store/list")[0], 200)

    def test_plaene_ueber_den_server(self):
        p = plan("srv1", "Über den Server")
        st, _, _ = self.req("/__store/set?key=srv1", json.dumps(p).encode("utf-8"))
        self.assertEqual(st, 200)
        st, body, _ = self.req("/__store/list")
        self.assertEqual([q["name"] for q in json.loads(body)], ["Über den Server"])
        self.assertEqual(self.req("/__store/set?key=srv2", json.dumps(p).encode("utf-8"))[0], 500, "Kennung muss zum Plan passen")
        self.assertEqual(self.req("/__store/set?key=..%2Fx", json.dumps(plan("../x")).encode("utf-8"))[0], 500)
        self.assertEqual(self.req("/__store/del?key=srv1", b"")[0], 200)
        self.assertEqual(json.loads(self.req("/__store/list")[1]), [])
        self.assertEqual(self.req("/__store/gibtsnicht")[0], 404)

    def test_datei_sichern_und_honeycut(self):
        st, body, _ = self.req("/__store/save?name=" + urllib.request.quote("Plan: Mietendeckel.pdf"), b"%PDF-1.4")
        self.assertEqual(st, 200)
        self.assertTrue(body.decode("utf-8").endswith("Plan: Mietendeckel.pdf"))
        st, body, _ = self.req("/__store/save?name=..%2F..%2Fboese.txt", b"x")
        self.assertEqual(Path(body.decode("utf-8")).parent, self.out, "der Name bleibt ein Dateiname")
        st, body, _ = self.req("/__store/cut", b"")
        self.assertIn("nicht installiert", body.decode("utf-8"))

    def test_beim_start_uebergebene_datei(self):
        app._OFFEN = None
        self.assertEqual(self.req("/__store/opened")[0], 404)
        f = TMP / "Mein Plan.scriptgenius"
        f.write_text(json.dumps(plan("offen1", "Doppelklick")), encoding="utf-8")
        app._OFFEN = f
        st, body, hd = self.req("/__store/opened")
        self.assertEqual((st, json.loads(body)["name"]), (200, "Doppelklick"))
        self.assertEqual(urllib.request.unquote(hd.get("X-Name")), "Mein Plan.scriptgenius")
        app._OFFEN = None


if __name__ == "__main__":
    unittest.main()
