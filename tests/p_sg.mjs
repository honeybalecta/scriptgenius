// Prüflauf für ScriptGenius: die Oberfläche am Computer (echter Server des Windows-Programms ohne Fenster, Pläne im Ordner),
// alle Exportformate – gelesen wie von anderen Programmen (tests/pruefe.py) –, im Browser (localStorage, Download) und am Handy.
// Aufruf über tests/lauf.sh (baut die Oberfläche nach .work/web und schreibt den Bericht nach .work/bericht.md).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.dirname(HERE);
const WORK = process.env.SG_WORK || path.join(HERE, '.work'), WEB = path.join(WORK, 'web'), OUT = path.join(WORK, 'out'), PLANS = path.join(WORK, 'plaene'), SHOTS = path.join(WORK, 'bilder');
for (const d of [OUT, PLANS, SHOTS, path.join(WORK, 'downloads')]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ───────── Ergebnisse ─────────
const res = [];
function chk(name, ok, detail){ ok = !!ok; res.push({ name, ok, detail: ok ? '' : JSON.stringify(detail === undefined ? '' : detail).slice(0, 600) }); console.log(`${ok ? 'ok    ' : 'FEHLER'} ${name}${ok ? '' : ' · ' + res[res.length - 1].detail}`); }
function bericht(abbruch){
  const bad = res.filter(r => !r.ok), version = fs.readFileSync(path.join(ROOT, 'version.txt'), 'utf8').trim();
  const md = [`### Prüflauf ScriptGenius ${version}: ${bad.length || abbruch ? '❌ ' + (bad.length + (abbruch ? 1 : 0)) + ' Fehler' : '✅ bestanden'}`, '',
    `${res.length} Prüfungen, ${bad.length} Fehler${abbruch ? ' – abgebrochen: ' + abbruch : ''}`, '',
    ...res.map(r => `- ${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : ' · `' + r.detail.replace(/`/g, "'") + '`'}`)].join('\n');
  fs.writeFileSync(path.join(WORK, 'bericht.md'), md + '\n');
  console.log(`\n→ ScriptGenius: ${res.length} geprüft, ${bad.length} Fehler${abbruch ? ' (abgebrochen)' : ''}`);
  return bad.length || abbruch ? 1 : 0;
}
const lies = (...files) => JSON.parse(execFileSync('python3', [path.join(HERE, 'pruefe.py'), ...files], { maxBuffer: 1 << 27 }).toString());

// ───────── Server des Windows-Programms ─────────
const srv = spawn('python3', [path.join(HERE, 'server.py'), WEB, OUT], { env: { ...process.env, SCRIPTGENIUS_PLANS: PLANS, APPDATA: path.join(WORK, 'appdata') }, stdio: ['ignore', 'pipe', 'inherit'] });
const { port, token } = JSON.parse(await new Promise((ok, no) => { readline.createInterface({ input: srv.stdout }).once('line', ok); srv.once('exit', c => no(new Error('Server beendet: ' + c))); }));
const URL_DESK = `http://127.0.0.1:${port}/index.html?desktop=1&k=${token}`, URL_WEB = `http://127.0.0.1:${port}/index.html`;
const args = ['--no-sandbox'];
const browser = process.env.SG_CHROME ? await chromium.launch({ executablePath: process.env.SG_CHROME, args })
  : await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const logs = [];
const watch = (pg, tag) => { pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${tag} ${m.type()}: ${m.text()}`); }); pg.on('pageerror', e => logs.push(`${tag} PAGEERROR: ${e.message}`)); pg.on('dialog', d => d.accept().catch(() => {})); };
const ready = pg => pg.waitForFunction(() => document.documentElement.classList.contains('ready'));
const planFiles = () => fs.readdirSync(PLANS).filter(f => f.endsWith('.scriptgenius'));
const filePlans = () => planFiles().map(f => JSON.parse(fs.readFileSync(path.join(PLANS, f), 'utf8')));
let code = 1;
try {
  // ══════════ 1) Am Computer: Plan anlegen ══════════
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true, locale: 'de-DE' });
  const pp = await ctx.newPage(); watch(pp, 'Computer');
  await pp.goto(URL_DESK); await ready(pp);
  const pe = (f, a) => pp.evaluate(f, a), toast = () => pe(() => document.querySelector('#toast').textContent);
  let st = await pe(() => ({ store: ScriptGeniusApp.store(), empty: !!document.querySelector('#flow .empty'), name: document.querySelector('#pName').value, stats: document.querySelector('#stats').textContent.replace(/\s+/g, ' '), tree: document.querySelector('#treeBox').classList.contains('hidden'), cut: document.querySelector('#cutBtn').textContent, close: document.querySelector('#closeBtn').classList.contains('hidden') }));
  chk('Start am Computer: leerer Plan, Ablage im Ordner des Programms, ohne „✕“ (nur eingebettet in HoneyCut)', st.store === 'desktop' && st.empty && st.name === 'Neuer Plan' && /1 ?Video/.test(st.stats) && st.tree && st.cut === 'Mit HoneyCut' && st.close, st);
  await sleep(500);
  chk('der erste Plan liegt sofort als Datei im Ordner', planFiles().length === 1 && filePlans()[0].name === 'Neuer Plan', planFiles());
  await pp.fill('#pName', 'Mietendeckel');
  await pp.click('#flow [data-a="addTeil"]'); await pp.fill('#flow .blk.teil .lbl', 'Einstieg'); await pp.fill('#flow .blk.teil textarea', 'Heute entscheidet der Stadtrat über den Mietendeckel. Wir haben lange dafür gekämpft.');
  await pp.click('#flow .ins.last [data-a="addWeiche"]'); await pp.fill('#flow .blk.weiche .lbl', 'Abstimmung');
  await pp.fill('#flow .out:nth-child(1) [data-f="olabel"]', 'Angenommen'); await pp.fill('#flow .out:nth-child(1) textarea', 'Der Antrag ist angenommen. Die Mieten bleiben stabil.');
  await pp.fill('#flow .out:nth-child(2) [data-f="olabel"]', 'Abgelehnt'); await pp.fill('#flow .out:nth-child(2) textarea', 'Der Antrag ist abgelehnt. Der Kampf geht weiter.');
  await pp.click('#flow .ins.last [data-a="addTeil"]'); await pp.fill('#flow .blk:nth-of-type(3) .lbl', 'Einordnung');
  await pp.click('#flow .ins.last [data-a="addWeiche"]'); await pp.fill('#flow .blk:nth-of-type(4) .lbl', 'Bürgerbegehren');
  await pp.fill('#flow .blk:nth-of-type(4) .out:nth-child(1) [data-f="olabel"]', 'Begehren kommt'); await pp.fill('#flow .blk:nth-of-type(4) .out:nth-child(1) textarea', 'Außerdem startet jetzt das Bürgerbegehren.');
  await pp.fill('#flow .blk:nth-of-type(4) .out:nth-child(2) [data-f="olabel"]', 'Kein Begehren'); await pp.check('#flow .blk:nth-of-type(4) .out:nth-child(2) [data-f="leer"]');
  await pp.click('#flow .ins.last [data-a="addTeil"]'); await pp.fill('#flow .blk:nth-of-type(5) .lbl', 'Schluss'); await pp.fill('#flow .blk:nth-of-type(5) textarea[data-f="text"]', 'Kommt am Samstag zur Versammlung im Rathaus.');
  // abweichende Fassung des Schlusses für „Abgelehnt“
  await pp.click('#flow .blk:nth-of-type(5) [data-a="altAdd"]'); await pp.waitForSelector('#modal:not(.hidden) .chipb');
  st = await pe(() => ({ groups: [...document.querySelectorAll('#modal .cgroup')].map(g => g.querySelector('b').textContent + ': ' + [...g.querySelectorAll('.chipb')].map(c => c.textContent).join('/')), all: !!document.querySelector('#modal [data-x="all"]') }));
  chk('Bedingung wählen: die früheren Weichen mit ihren Ausgängen', st.groups.join(' | ') === 'Abstimmung: Angenommen/Abgelehnt | Bürgerbegehren: Begehren kommt/Kein Begehren' && !st.all, st);
  await pp.click('#modal [data-x="ok"]'); await sleep(150);
  chk('ohne Auswahl bleibt das Fenster offen, mit Hinweis', await pe(() => !document.querySelector('#modal').classList.contains('hidden')) && /mindestens einen Ausgang/.test(await toast()));
  await pp.click('#modal .cgroup:nth-of-type(1) .chipb:nth-child(2)'); await pp.click('#modal [data-x="ok"]'); await sleep(200);
  await pp.fill('#flow .blk:nth-of-type(5) .alt textarea', 'Kommt am Samstag zur Kundgebung vor dem Rathaus.'); await sleep(600);
  st = await pe(() => ({ stats: [...document.querySelectorAll('#stats .stat')].map(s => s.textContent.replace(/\s+/g, ' ')), paths: [...document.querySelectorAll('#paths .path')].map(d => d.querySelector('.nr').textContent + ' ' + d.querySelector('.pl').textContent + ' ' + d.querySelector('.pd').textContent), leafs: document.querySelectorAll('#tree .leaf').length, nodes: [...document.querySelectorAll('#tree .nd text')].map(t => t.textContent),
    alt: document.querySelector('#flow .alt .cond').textContent, meta: document.querySelector('#flow .blk.teil .meta').textContent, leer: document.querySelector('#flow .out.leer .meta').textContent, tab: document.querySelector('#tabCount').textContent, saved: document.querySelector('#pSaved').textContent }));
  chk('Übersicht: 4 Videos, 7 Abschnitte aufzunehmen, Sprechzeit', /^4 ?Videos$/.test(st.stats[0]) && /^7 ?Abschnitte aufzunehmen$/.test(st.stats[1]) && /\d+ s ?Aufnahme nach Skript/.test(st.stats[2]) && st.tab === '4', st.stats);
  chk('Videos mit Beschriftung der Ausgänge und geschätzter Länge', st.paths.length === 4 && /^1 Angenommen · Begehren kommt etwa \d+ s$/.test(st.paths[0]) && /^4 Abgelehnt · Kein Begehren etwa \d+ s$/.test(st.paths[3]), st.paths);
  chk('Baum der Pfade: Start, je Ausgang ein Knoten, je Video ein nummeriertes Blatt', st.leafs === 4 && st.nodes.filter(n => n === 'Begehren kommt').length === 2 && st.nodes.includes('Start') && st.nodes.includes('Angenommen'), st.nodes);
  chk('abweichende Fassung nennt ihre Pfade; Wortzahl und Sprechzeit je Text; Ausgang ohne eigenen Teil', /Abweichende Fassung für Abgelehnt/.test(st.alt) && /^12 Wörter · etwa \d+ s$/.test(st.meta) && /ohne eigenen Teil/.test(st.leer), [st.alt, st.meta, st.leer]);
  let fp = filePlans();
  chk('jede Änderung landet im Ordner: eine Datei je Plan mit Weichen, Bedingung und Text', st.saved === 'Gespeichert' && fp.length === 1 && fp[0].name === 'Mietendeckel' && fp[0].blocks.length === 5 && fp[0].blocks[4].alts.length === 1 && /Kundgebung/.test(fp[0].blocks[4].alts[0].text), fp.map(p => [p.name, p.blocks.length]));
  await pp.screenshot({ path: path.join(SHOTS, 'planer.png') });
  // Umbenennen eines Ausgangs zieht in Bedingungen nach; Titel je Video; Text eines Videos
  await pp.fill('#flow .blk.weiche .out:nth-child(2) [data-f="olabel"]', 'Durchgefallen'); await sleep(100);
  chk('ein umbenannter Ausgang steht sofort auch in den Bedingungen', /für Durchgefallen/.test(await pe(() => document.querySelector('#flow .alt .cond').textContent)));
  await pp.fill('#flow .blk.weiche .out:nth-child(2) [data-f="olabel"]', 'Abgelehnt'); await sleep(450);
  await pp.click('#paths .path:nth-of-type(1) summary'); await pp.fill('#paths .path:nth-of-type(1) [data-f="ptitle"]', 'Deckel steht'); await sleep(100);
  st = await pe(() => ({ text: document.querySelector('#paths .path:nth-of-type(1) .ptext').textContent.replace(/\s+/g, ' '), heads: [...document.querySelectorAll('#paths .path:nth-of-type(1) .ptext .hd')].map(h => h.textContent), free: document.querySelector('#paths .path:nth-of-type(1) .ptext .free').textContent, title: Object.values(ScriptGeniusApp.plan.paths).map(x => x.title) }));
  chk('ein Video zeigt seinen Text der Reihe nach, frei Gesprochenes ist gekennzeichnet; der Titel wird gemerkt', st.heads.join('|') === 'Einstieg|Abstimmung: Angenommen|Einordnung|Bürgerbegehren: Begehren kommt|Schluss' && /Versammlung im Rathaus/.test(st.text) && !/Kundgebung/.test(st.text) && st.free === 'frei gesprochen' && st.title.join() === 'Deckel steht', st);
  await pp.evaluate(() => document.querySelectorAll('#tree .leaf')[3].dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(200);
  chk('ein Blatt im Baum klappt das Video in der Liste auf', await pe(() => document.querySelector('#paths .path:nth-of-type(4)').open));

  // ══════════ 2) Aufnahme-Skript ══════════
  await pp.click('#scriptBtn'); await pp.waitForSelector('#scText');
  st = await pe(() => ({ t: document.querySelector('#scText').value, info: document.querySelector('#scInfo').textContent }));
  chk('Aufnahme-Skript mit Überschriften: sieben Abschnitte, der freie Teil mit Hinweis in Klammern', (st.t.match(/^# /gm) || []).length === 7 && /# Einordnung\n\[frei gesprochen\]/.test(st.t) && /# Schluss \(Abgelehnt\)\nKommt am Samstag zur Kundgebung/.test(st.t) && /^\d+ Wörter · etwa \d+ s$/.test(st.info), st);
  const recShown = st.t;
  await pp.click('#scMode [data-h="0"]');
  const souShown = await pe(() => document.querySelector('#scText').value);
  chk('reiner Text für den Souffleur: ohne Überschriften, ohne den freien Teil', !/#|\[/.test(souShown) && souShown.split('\n\n').length === 6 && /^Heute entscheidet/.test(souShown), souShown.slice(0, 120));
  await pp.click('#modal [data-x="save"]'); await sleep(400);
  const fSou = path.join(OUT, 'Mietendeckel – Souffleur.txt');
  chk('„Als Textdatei sichern“ schreibt genau den angezeigten Text, unter dem Namen des Exports', fs.existsSync(fSou) && fs.readFileSync(fSou, 'utf8').trimEnd() === souShown.trimEnd() && /^Gespeichert: .*Souffleur\.txt$/.test(await toast()), [fs.readdirSync(OUT), await toast()]);
  await pp.click('#scMode [data-h="1"]'); await pp.click('#modal [data-x="save"]'); await sleep(400);
  const fRec = path.join(OUT, 'Mietendeckel – Aufnahme-Skript.txt');
  chk('… mit Überschriften als Aufnahme-Skript', fs.existsSync(fRec) && fs.readFileSync(fRec, 'utf8').trimEnd() === recShown.trimEnd(), fs.existsSync(fRec) && fs.readFileSync(fRec, 'utf8').slice(0, 200));
  await pp.click('#modal [data-x="close"]');

  // ══════════ 3) Mit HoneyCut (eigenständig am Computer) ══════════
  await pp.click('#cutBtn'); await pp.waitForSelector('#modal [data-x="file"]');
  st = await pe(() => ({ t: document.querySelector('#modal').textContent.replace(/\s+/g, ' '), open: !!document.querySelector('#modal [data-x="cut"]') }));
  chk('„Mit HoneyCut“ erklärt den gemeinsamen Ordner und bietet Datei und Öffnen', /denselben Ordner/.test(st.t) && /4 Videos/.test(st.t) && st.open, st.t.slice(0, 300));
  await pp.click('#modal [data-x="file"]'); await sleep(400);
  const fPlan = path.join(OUT, 'Mietendeckel.scriptgenius'); const fileP = fs.existsSync(fPlan) ? JSON.parse(fs.readFileSync(fPlan, 'utf8')) : null;
  chk('„Als Datei sichern“ legt den Plan als .scriptgenius ab', !!fileP && fileP.app === 'scriptgenius' && fileP.name === 'Mietendeckel' && fileP.blocks.length === 5 && Object.values(fileP.paths).map(x => x.title).join() === 'Deckel steht', fileP && [fileP.app, fileP.name, fileP.blocks.length]);
  await pp.click('#modal [data-x="cut"]'); await sleep(400);
  chk('ist HoneyCut nicht installiert, sagt ScriptGenius das', /nicht installiert/.test(await toast()), await toast());

  // ══════════ 4) Exportieren: alle Formate ══════════
  await pp.click('#exportBtn'); await pp.waitForSelector('#modal .xrow');
  const fmts = await pe(() => [...document.querySelectorAll('#modal .xrow')].map(r => r.dataset.f));
  chk('Exportieren bietet PDF, Webseite, Word, Markdown, Texte, Bilder, Tabelle, Plan und alles zusammen', fmts.join() === 'pdf,html,docx,md,rec,souffleur,texts,treepng,treesvg,cards,csv,plan,all', fmts);
  await pp.screenshot({ path: path.join(SHOTS, 'exportieren.png') });
  fs.mkdirSync(path.join(OUT, 'export'), { recursive: true });
  for (const f of fmts){ const t0 = Date.now() - 5;
    await pp.click(`#modal [data-f="${f}"] [data-x="go"]`); await pp.waitForFunction(i => !document.querySelector(`#modal [data-f="${i}"] [data-x="go"]`).disabled, f, { timeout: 90000 });
    const t = await toast(), files = fs.readdirSync(OUT).filter(x => { const s = fs.statSync(path.join(OUT, x)); return s.isFile() && s.mtimeMs >= t0; });
    if (files.length === 1) fs.copyFileSync(path.join(OUT, files[0]), path.join(OUT, 'export', files[0]));
    if (files.length !== 1 || !/^Gespeichert: /.test(t)) chk(`Export ${f}`, false, [t, files]); }
  await pp.click('#modal [data-x="close"]');
  const X = Object.fromEntries(fs.readdirSync(path.join(OUT, 'export')).map(f => [f, path.join(OUT, 'export', f)]));
  const names = Object.keys(X).sort();
  chk('Dateinamen: Name des Plans und Art der Datei', names.join('|') === ['Mietendeckel – Aufnahme-Skript.txt', 'Mietendeckel – Baum.png', 'Mietendeckel – Baum.svg', 'Mietendeckel – Drehbuch.docx', 'Mietendeckel – Drehbuch.html', 'Mietendeckel – Drehbuch.md', 'Mietendeckel – Drehbuch.pdf', 'Mietendeckel – Karten.zip', 'Mietendeckel – Souffleur.txt', 'Mietendeckel – Texte je Video.zip', 'Mietendeckel – Videos.csv', 'Mietendeckel – alles.zip', 'Mietendeckel.scriptgenius'].sort().join('|'), names);
  const R = Object.fromEntries(lies(...Object.values(X)).map(r => [r.name, r])), r = k => R['Mietendeckel – ' + k] || R[k] || {};
  let x = r('Drehbuch.pdf'); const pdfText = (x.text || []).join('\n');
  chk('PDF: gültig (qpdf), mehrere Seiten, Schriften eingebettet, Text mit Umlauten lesbar', x.qpdf !== 1 && x.qpdf !== 2 && x.pages >= 3 && x.fonts.length >= 2 && x.fonts.every(f => f[1]) && x.fonts.some(f => /Inter/.test(f[0])) && /Mietendeckel/.test(pdfText) && /Bürgerbegehren/.test(pdfText) && /Außerdem startet/.test(pdfText) && x.title === 'Mietendeckel - Drehbuch', { pages: x.pages, fonts: x.fonts, qpdf: x.qpdf, title: x.title, text: pdfText.slice(0, 200) });
  chk('PDF: jedes Video mit Titel und Text, dazu das Aufnahme-Skript', /Angenommen · Begehren kommt/.test(pdfText) && /Deckel steht/.test(pdfText) && /Abgelehnt · Kein Begehren/.test(pdfText) && /Kundgebung vor dem Rathaus/.test(pdfText) && /AUFNAHME-SKRIPT/.test(pdfText), pdfText.slice(0, 400));
  x = r('Drehbuch.html');
  chk('Webseite: eine Datei ohne Skripte und ohne Verweise nach außen, mit allen Videos', x.title === 'Mietendeckel – Drehbuch' && x.external.length === 0 && x.scripts === 0 && /Deckel steht/.test(x.text) && /Abgelehnt · Kein Begehren/.test(x.text) && /Kundgebung vor dem Rathaus/.test(x.text), { title: x.title, ext: x.external, scripts: x.scripts });
  x = r('Drehbuch.docx');
  chk('Word: Überschriften als Formatvorlagen, Baum als Bild, Texte der Videos', x.names.includes('word/document.xml') && x.styles.includes('Heading1') && x.pics === 1 && x.media.length === 1 && x.paras.includes('Mietendeckel') && x.paras.some(p => /Kundgebung vor dem Rathaus/.test(p)) && x.paras.some(p => /Deckel steht/.test(p)), { styles: x.styles, pics: x.pics, paras: (x.paras || []).slice(0, 6) });
  x = r('Drehbuch.md');
  chk('Markdown: Überschriften für Plan, Ablauf und Videos', /^# Mietendeckel\n/.test(x.text) && /^## Ablauf$/m.test(x.text) && (x.text.match(/^### /gm) || []).length >= 4, x.text && x.text.slice(0, 300));
  chk('Aufnahme-Skript und Souffleur-Fassung wie im Fenster „Skript“', r('Aufnahme-Skript.txt').text.trimEnd() === recShown.trimEnd() && r('Souffleur.txt').text.trimEnd() === souShown.trimEnd());
  x = r('Texte je Video.zip');
  chk('Texte je Video: vier Textdateien, nummeriert, mit Titel und dem Text ihres Pfads', !x.bad && x.entries.length === 4 && /^Video 01 – Angenommen · Begehren kommt\.txt$/.test(x.entries[0].name) && /# Titel: Deckel steht/.test(x.entries[0].text) && /Versammlung/.test(x.entries[0].text) && /Kundgebung/.test(x.entries[3].text) && !/Bürgerbegehren\./.test(x.entries[3].text), x.entries && x.entries.map(e => e.name));
  x = r('Baum.png');
  chk('Baum als PNG: breit, scharf (doppelte Auflösung), mit Inhalt', x.w >= 1200 && x.h >= 300 && x.filled > 0.05, x);
  x = r('Baum.svg');
  chk('Baum als SVG: gültiges XML mit allen Ausgängen und vier nummerierten Blättern', x.root === 'svg' && x.texts.filter(t => t === 'Begehren kommt').length === 2 && x.texts.includes('Start') && ['1', '2', '3', '4'].every(n => x.texts.includes(n)), x.texts);
  x = r('Karten.zip');
  chk('Karten je Video: vier Bilder 1080 × 1920', !x.bad && x.entries.length === 4 && x.entries.every(e => e.w === 1080 && e.h === 1920) && /^Karte 01 – Angenommen · Begehren kommt\.png$/.test(x.entries[0].name), x.entries && x.entries.map(e => [e.name, e.w, e.h]));
  x = r('Videos.csv');
  chk('Tabelle: mit BOM und Semikolon (Excel), eine Spalte je Weiche, Titel', x.bom && x.rows.length === 5 && x.rows[0].slice(0, 4).join('|') === 'Nr|Video|Abstimmung|Bürgerbegehren' && x.rows[1].includes('Deckel steht') && x.rows[4][2] === 'Abgelehnt' && x.rows[4][3] === 'Kein Begehren', x.rows);
  x = R['Mietendeckel.scriptgenius'] || {};
  chk('Plan zum Weiterbearbeiten: dieselbe Datei wie „Als Datei sichern“', x.app === 'scriptgenius' && x.plan === 'Mietendeckel' && x.blocks === 5 && fs.readFileSync(X['Mietendeckel.scriptgenius'], 'utf8') === fs.readFileSync(fPlan, 'utf8'));
  x = r('alles.zip'); const inAll = (x.entries || []).map(e => e.name);
  chk('alles zusammen: jedes Format im Archiv, Texte und Karten in Unterordnern', !x.bad && ['Drehbuch.pdf', 'Drehbuch.html', 'Drehbuch.docx', 'Drehbuch.md', 'Aufnahme-Skript.txt', 'Souffleur.txt', 'Videos.csv', 'Baum.png', 'Baum.svg', 'Mietendeckel.scriptgenius'].every(n => inAll.includes(n)) && inAll.filter(n => /^Texte je Video\/Video 0\d/.test(n)).length === 4 && inAll.filter(n => /^Karten\/Karte 0\d/.test(n)).length === 4, inAll);
  // Doppelpunkt im Namen: sichtbar, aber erlaubt unter Windows
  await pp.fill('#pName', 'Plan: Kandidat:innen'); await sleep(500);
  const nm = await pe(async () => (await ScriptGeniusExport.make('md', ScriptGeniusApp.plan)).name);
  chk('ein Doppelpunkt im Namen bleibt lesbar und ist trotzdem ein gültiger Dateiname (꞉)', nm === 'Plan꞉ Kandidat꞉innen – Drehbuch.md', nm);
  await pp.fill('#pName', 'Mietendeckel'); await sleep(500);

  // ══════════ 5) Pläne: Kopie, löschen, aus Datei, Neustart, Änderung von außen ══════════
  await pp.click('#plansBtn'); await pp.click('#modal .prow [data-x="dup"]'); await sleep(500);
  st = await pe(() => ({ n: ScriptGeniusApp.plans.length, name: ScriptGeniusApp.plan.name }));
  chk('Kopie eines Plans: eigener Eintrag, sofort geöffnet und im Ordner', st.n === 2 && st.name === 'Mietendeckel (Kopie)' && filePlans().map(p => p.name).sort().join('|') === 'Mietendeckel|Mietendeckel (Kopie)', [st, filePlans().map(p => p.name)]);
  await pp.click('#plansBtn'); await pp.click('#modal .prow.cur [data-x="del"]'); await sleep(400);
  st = await pe(() => ({ n: ScriptGeniusApp.plans.length, name: ScriptGeniusApp.plan.name, open: !document.querySelector('#modal').classList.contains('hidden') }));
  const trashDir = path.join(PLANS, 'papierkorb');
  chk('Löschen: der nächste Plan öffnet sich, die Datei wandert in den Papierkorb des Ordners', st.n === 1 && st.name === 'Mietendeckel' && st.open && planFiles().length === 1 && fs.existsSync(trashDir) && fs.readdirSync(trashDir).length === 1, [st, planFiles()]);
  await pp.setInputFiles('#planFile', fPlan); await sleep(500);
  st = await pe(() => ({ n: ScriptGeniusApp.plans.length, name: ScriptGeniusApp.plan.name, blocks: ScriptGeniusApp.plan.blocks.length }));
  chk('ein Plan aus einer Datei ersetzt nach Rückfrage den gleichnamigen', st.n === 1 && st.name === 'Mietendeckel' && st.blocks === 5 && planFiles().length === 1, st);
  await pp.evaluate(() => localStorage.clear()); await pp.reload(); await ready(pp);
  st = await pe(() => ({ name: document.querySelector('#pName').value, paths: document.querySelectorAll('#paths .path').length, title: document.querySelector('#paths .path [data-f="ptitle"]').value }));
  chk('nach dem Neustart kommt der Plan aus dem Ordner – nicht aus dem Browser-Speicher', st.name === 'Mietendeckel' && st.paths === 4 && st.title === 'Deckel steht', st);
  // HoneyCut (oder ein zweites Fenster) ändert den Plan im Ordner: beim Zurückkehren ins Fenster ist die Änderung da
  const pf = path.join(PLANS, planFiles()[0]), ext = JSON.parse(fs.readFileSync(pf, 'utf8')); ext.name = 'Mietendeckel (aus HoneyCut)'; ext.changed = Date.now() + 1000;
  fs.writeFileSync(pf, JSON.stringify(ext));
  await pe(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(500);
  chk('eine Änderung von außen erscheint beim Zurückkehren ins Fenster', (await pe(() => document.querySelector('#pName').value)) === 'Mietendeckel (aus HoneyCut)');
  // Reihenfolge ändern
  await pp.click('#flow .blk:nth-of-type(4) [data-a="up"]'); await sleep(150); await pp.click('#flow .blk:nth-of-type(3) [data-a="up"]'); await sleep(150);
  st = await pe(() => ({ order: ScriptGeniusApp.plan.blocks.map(b => b.label), alts: (ScriptGeniusApp.plan.blocks[4].alts || []).length, n: document.querySelectorAll('#paths .path').length }));
  chk('eine Weiche nach vorn: die Bedingung auf die Abstimmung bleibt, solange diese davor liegt', st.order.join('|') === 'Einstieg|Bürgerbegehren|Abstimmung|Einordnung|Schluss' && st.alts === 1 && st.n === 4, st);
  await pp.click('#flow .blk:nth-of-type(5) [data-a="up"]'); await sleep(100); await pp.click('#flow .blk:nth-of-type(4) [data-a="up"]'); await sleep(200);
  st = await pe(() => ({ order: ScriptGeniusApp.plan.blocks.map(b => b.label), alts: (ScriptGeniusApp.plan.blocks[2].alts || []).length, toast: document.querySelector('#toast').textContent }));
  chk('liegt der Schluss vor der Abstimmung, fällt seine Bedingung darauf weg – mit Hinweis', st.order.join('|') === 'Einstieg|Bürgerbegehren|Schluss|Abstimmung|Einordnung' && st.alts === 0 && /spätere Weichen/.test(st.toast), st);

  // ══════════ 6) Am Handy ══════════
  await pp.setViewportSize({ width: 390, height: 844 }); await sleep(200);
  st = await pe(() => ({ tabs: getComputedStyle(document.querySelector('#pTabs')).display, flow: getComputedStyle(document.querySelector('#flowCol')).display, side: getComputedStyle(document.querySelector('#sideCol')).display, w: document.documentElement.scrollWidth }));
  await pp.screenshot({ path: path.join(SHOTS, 'handy-ablauf.png') });
  await pp.click('#pTabs [data-view="side"]'); await sleep(200);
  await pp.screenshot({ path: path.join(SHOTS, 'handy-pfade.png') });
  const st2 = await pe(() => ({ flow: getComputedStyle(document.querySelector('#flowCol')).display, side: getComputedStyle(document.querySelector('#sideCol')).display, back: window.SGBack(), view: document.querySelector('#pMain').dataset.view, back2: window.SGBack() }));
  chk('am Handy: eine Spalte mit Umschalter „Ablauf / Pfade“, nichts läuft über den Rand; „Zurück“ führt erst zum Ablauf, dann aus der App', st.tabs === 'flex' && st.flow !== 'none' && st.side === 'none' && st.w <= 390 && st2.flow === 'none' && st2.side !== 'none' && st2.back === true && st2.view === 'flow' && st2.back2 === false, [st, st2]);
  await pp.click('#exportBtn'); await sleep(200);
  st = await pe(() => ({ w: document.documentElement.scrollWidth, mw: document.querySelector('#modal').getBoundingClientRect().width, back: window.SGBack(), open: !document.querySelector('#modal').classList.contains('hidden') }));
  chk('am Handy passt „Exportieren“ auf den Schirm; „Zurück“ schließt erst das Fenster', st.w <= 390 && st.mw <= 390 && st.back === true && !st.open, st);
  // Android: geteilte Datei
  await pe(t => window.SGImportB64('Plan.scriptgenius', btoa(String.fromCharCode(...new TextEncoder().encode(t)))), JSON.stringify({ ...ext, id: 'geteilt1', name: 'Geteilt über Android' }));
  await sleep(400);
  chk('Android: ein geteilter Plan („Teilen“, „Öffnen mit“) öffnet sich und landet in der Ablage', (await pe(() => ScriptGeniusApp.plan.name)) === 'Geteilt über Android' && filePlans().some(p => p.name === 'Geteilt über Android'));
  await pp.close();

  // ══════════ 7) Im Browser (honeybalecta.github.io/scriptgenius) ══════════
  const bp = await ctx.newPage(); watch(bp, 'Browser');
  await bp.goto(URL_WEB); await ready(bp);
  const be = (f, a) => bp.evaluate(f, a);
  st = await be(() => ({ store: ScriptGeniusApp.store(), name: ScriptGeniusApp.plan.name }));
  chk('im Browser: Ablage im Browser-Speicher, unabhängig vom Ordner am Computer', st.store === 'local' && st.name === 'Neuer Plan', st);
  await bp.click('#plansBtn'); await bp.click('#modal [data-x="sample"]'); await sleep(500);
  st = await be(() => ({ name: ScriptGeniusApp.plan.name, stored: JSON.parse(localStorage.getItem('sg-plans') || '[]').map(p => p.name) }));
  chk('„Beispiel ansehen“ legt einen Beispielplan an und speichert ihn im Browser', st.name === 'Beispiel: Misstrauensvotum' && st.stored.includes('Beispiel: Misstrauensvotum'), st);
  await bp.click('#exportBtn');
  const [dl] = await Promise.all([bp.waitForEvent('download'), bp.click('#modal [data-f="pdf"] [data-x="go"]')]);
  const fDl = path.join(WORK, 'downloads', dl.suggestedFilename()); await dl.saveAs(fDl); await sleep(300);
  x = lies(fDl)[0];
  chk('Export im Browser kommt als Download', dl.suggestedFilename() === 'Beispiel꞉ Misstrauensvotum – Drehbuch.pdf' && x.pages >= 3 && /Heruntergeladen/.test(await be(() => document.querySelector('#toast').textContent)), [dl.suggestedFilename(), x.pages]);
  await bp.click('#modal [data-x="close"]');
  await bp.reload(); await ready(bp);
  chk('nach dem Neuladen ist der Plan im Browser wieder da', (await be(() => ScriptGeniusApp.plan.name)) === 'Beispiel: Misstrauensvotum');
  await bp.click('#cutBtn'); await bp.waitForSelector('#modal [data-x="cut"]');
  chk('„Mit HoneyCut“ im Browser verweist auf HoneyCut auf derselben Website', /honeybalecta\.github\.io/.test(await be(() => document.querySelector('#modal').textContent)));
  await bp.click('#modal [data-x="close"]'); await bp.close();

  chk('keine Fehlermeldungen in der Seite', logs.length === 0, logs);
  code = bericht();
} catch (e) {
  console.error(e);
  code = bericht(String((e && e.message) || e).split('\n')[0].slice(0, 300));
} finally {
  await browser.close().catch(() => {}); srv.kill();
}
process.exit(code);
