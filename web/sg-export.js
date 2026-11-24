'use strict';
/* ScriptGenius – Exporte ohne fremde Bibliotheken.

   ScriptGeniusExport.FORMATS                    → Liste der Exporte (id, Name, Beschreibung)
   ScriptGeniusExport.make(id, plan, opts)       → Promise<{name, blob}>
   ScriptGeniusExport.model(plan)                → Inhalt, aus dem alle Formate entstehen (für die Prüfläufe)

   Drehbuch: Übersicht (Zahlen, Ablauf, Baum der Pfade), jedes Video mit seinem Text, das Aufnahme-Skript.
   PDF mit echtem, durchsuchbarem Text: Inter und Lora werden eingebettet (nur die Tabellen für die Umrisse), Text in
   WinAnsi-Kodierung. Word (.docx) und ZIP als Pakete ohne Kompression, PNG über eine Leinwand, SVG als Text.
   opts.base: Ordner der Oberfläche (für die Schriften), Vorgabe: relativ zur Seite. */
(function(g){
  const S = () => g.ScriptGenius, enc = new TextEncoder();
  const C = {anth: '#131312', creme: '#EDE7DA', sand: '#CFC6B0', rot: '#E5402A', rotHell: '#B8301D', grau: '#A9A397', grauHell: '#5E584D', line: '#34332F', s2: '#262623', s3: '#30302C'};
  const MAX_VIDEOS = 500, TREE_MAX = 60;

  // ───────── Hilfen ─────────
  const fmtDur = s => { s = Math.round(s); return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`; };
  const today = () => new Date().toLocaleDateString('de-DE', {day: 'numeric', month: 'long', year: 'numeric'});
  // Doppelpunkt (auch beim Gendern, „Kandidat:innen“) ist in Windows-Dateinamen verboten: dafür das gleich aussehende Zeichen U+A789
  const fileName = s => String(s || 'Plan').replace(/:/g, '\uA789').replace(/[\\/*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Plan';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const xml = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  // Text für den Souffleur: ohne Überschriften (# …) und ohne Anweisungen in eckigen Klammern
  const plain = t => String(t || '').replace(/\r/g, '').split('\n').filter(l => !/^\s*#/.test(l)).join('\n').replace(/\[[^\]\n]{0,300}\]/g, '').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const nr2 = (k, n) => String(k).padStart(String(n).length < 2 ? 2 : String(n).length, '0');

  // ───────── Inhalt ─────────
  function model(plan){
    const X = S(), N = X.names(plan), P = X.paths(plan, MAX_VIDEOS), segs = X.segs(plan, X.paths(plan, 5000)), by = new Map(segs.map(s => [s.id, s]));
    const videos = P.list.map((p, k) => {
      const ss = p.segs.map(id => by.get(id)).filter(Boolean), words = ss.reduce((n, s) => n + X.words(s.text), 0);
      return {nr: k + 1, key: p.key, label: p.label || 'Ein Video', title: (plan.paths[p.key] || {}).title || '', picks: p.picks.map(x => ({w: N.blk.get(x.w), o: N.out.get(x.o)})),
        segs: ss.map(s => ({label: s.label, text: s.text.trim()})), words, secs: X.secs(words)};
    });
    const rec = segs.filter(s => s.n > 0).map(s => ({label: s.label, text: s.text.trim(), n: s.n}));
    const recWords = rec.reduce((n, s) => n + X.words(s.text), 0);
    const ablauf = plan.blocks.map(b => ({kind: b.kind, label: N.blk.get(b.id), cond: b.when ? X.condText(plan, b.when, N) : '',
      outs: b.kind === 'weiche' ? b.outs.map(o => ({label: N.out.get(o.id), leer: !!o.leer, alts: (o.alts || []).map(a => X.condText(plan, a.when, N))})) : null,
      alts: b.kind === 'weiche' ? [] : (b.alts || []).map(a => X.condText(plan, a.when, N))}));
    const weichen = plan.blocks.filter(b => b.kind === 'weiche').map(b => N.blk.get(b.id));
    return {plan, name: plan.name || 'Plan', date: today(), videos, count: P.count, more: P.more, rec, recWords, recSecs: X.secs(recWords), ablauf, weichen, picksOf: P.list.map(p => p.picks), N};
  }

  // ───────── Baum der Pfade (ein Aufbau für SVG, PNG und PDF) ─────────
  function treeLayout(m){
    if (!m.videos.length || m.count > TREE_MAX || !m.weichen.length) return null;
    const root = {label: 'Start', kids: new Map(), d: 0}; let maxD = 0;
    m.picksOf.forEach((picks, k) => { let n = root; picks.forEach((pk, d) => { const key = pk.w + '.' + pk.o; let c = n.kids.get(key); if (!c){ c = {label: m.N.out.get(pk.o), kids: new Map(), d: d + 1}; n.kids.set(key, c); } n = c; maxD = Math.max(maxD, d + 1); }); n.leaf = k + 1; });
    const RH = 40, CW = 168, BW = 140, BH = 28, RW = 58; let row = 0; const nodes = [], links = [], leaves = [];
    const xOf = n => n.d === 0 ? 4 : RW + 30 + (n.d - 1) * CW, wOf = n => n.d === 0 ? RW : BW;
    (function lay(n){ const ks = [...n.kids.values()]; if (!ks.length){ n.y = RH * (row++ + 0.5); return; } ks.forEach(lay); n.y = (ks[0].y + ks[ks.length - 1].y) / 2; })(root);
    (function walk(n){
      const x = xOf(n), w = wOf(n);
      for (const c of n.kids.values()){ const cx = xOf(c), mid = x + w + (cx - x - w) / 2; links.push([[x + w, n.y], [mid, n.y], [mid, c.y], [cx, c.y]]); walk(c); }
      nodes.push({x, y: n.y - BH / 2, w, h: BH, label: n.label, root: !n.d});
      if (n.leaf != null){ links.push([[x + w, n.y], [x + w + 12, n.y]]); leaves.push({x: x + w + 24, y: n.y, r: 12, nr: n.leaf}); }
    })(root);
    return {w: RW + 30 + Math.max(0, maxD - 1) * CW + (maxD ? BW : 0) + 44, h: Math.max(1, row) * RH, nodes, links, leaves, fs: 12.5};
  }
  const cut = s => s.length > 17 ? s.slice(0, 16) + '…' : s;
  const THEMES = {dark: {bg: C.anth, node: C.s3, nodeLine: '#4a4843', text: C.creme, root: C.creme, rootText: C.anth, link: '#5b574d', leaf: C.rot, leafText: '#FFF6EE'},
    light: {bg: '#FFFDF8', node: C.creme, nodeLine: C.sand, text: C.anth, root: C.anth, rootText: C.creme, link: '#9a937f', leaf: C.rotHell, leafText: '#FFFFFF'}};
  function treeSvg(L, theme = 'dark', pad = 12){
    const T = THEMES[theme], W = L.w + pad * 2, Hh = L.h + pad * 2, o = [];
    o.push(`<rect width="${W}" height="${Hh}" fill="${T.bg}"/>`, `<g transform="translate(${pad} ${pad})" font-family="Inter, system-ui, sans-serif" font-size="${L.fs}" font-weight="600">`);
    for (const l of L.links) o.push(`<path d="M${l.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')}" fill="none" stroke="${T.link}" stroke-width="2"/>`);
    for (const n of L.nodes) o.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${n.root ? T.root : T.node}" stroke="${n.root ? T.root : T.nodeLine}"/><text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4.5}" text-anchor="middle" fill="${n.root ? T.rootText : T.text}">${xml(cut(n.label))}</text>`);
    for (const f of L.leaves) o.push(`<circle cx="${f.x}" cy="${f.y}" r="${f.r}" fill="${T.leaf}"/><text x="${f.x}" y="${f.y + 4.5}" text-anchor="middle" font-weight="800" fill="${T.leafText}">${f.nr}</text>`);
    o.push('</g>');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${o.join('')}</svg>`;
  }
  async function fontsReady(){ if (!document.fonts) return; try { await Promise.all(['600 12px Inter', '800 12px Inter', '700 12px Inter', '400 12px Inter', '400 12px Lora', '700 12px Lora'].map(f => document.fonts.load(f))); } catch(_){} }
  function rr(x, cx, cy, w, h, r){ x.beginPath(); x.moveTo(cx + r, cy); x.arcTo(cx + w, cy, cx + w, cy + h, r); x.arcTo(cx + w, cy + h, cx, cy + h, r); x.arcTo(cx, cy + h, cx, cy, r); x.arcTo(cx, cy, cx + w, cy, r); x.closePath(); }
  async function treeCanvas(L, scale = 2, theme = 'dark', pad = 12){
    await fontsReady();
    const T = THEMES[theme], W = L.w + pad * 2, Hh = L.h + pad * 2, cv = document.createElement('canvas'); cv.width = Math.ceil(W * scale); cv.height = Math.ceil(Hh * scale);
    const x = cv.getContext('2d'); x.scale(scale, scale); x.fillStyle = T.bg; x.fillRect(0, 0, W, Hh); x.translate(pad, pad);
    x.lineWidth = 2; x.strokeStyle = T.link; for (const l of L.links){ x.beginPath(); l.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const n of L.nodes){ rr(x, n.x, n.y, n.w, n.h, 8); x.fillStyle = n.root ? T.root : T.node; x.fill(); x.lineWidth = 1; x.strokeStyle = n.root ? T.root : T.nodeLine; x.stroke(); x.fillStyle = n.root ? T.rootText : T.text; x.font = `600 ${L.fs}px Inter, sans-serif`; x.fillText(cut(n.label), n.x + n.w / 2, n.y + n.h / 2 + 0.5); }
    for (const f of L.leaves){ x.beginPath(); x.arc(f.x, f.y, f.r, 0, Math.PI * 2); x.fillStyle = T.leaf; x.fill(); x.fillStyle = T.leafText; x.font = `800 ${L.fs}px Inter, sans-serif`; x.fillText(String(f.nr), f.x, f.y + 0.5); }
    return cv;
  }
  const canvasBlob = (cv, type = 'image/png', q) => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('Das Bild ließ sich nicht erzeugen')), type, q));
  const blobBytes = async b => new Uint8Array(await b.arrayBuffer());

  // ───────── ZIP (gespeichert, ohne Kompression) ─────────
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files, type = 'application/zip'){   // files: [{name, data: Uint8Array | string}]
    const parts = [], cen = []; let off = 0;
    const d = new Date(), dt = ((d.getFullYear() - 1980) << 25) | ((d.getMonth() + 1) << 21) | (d.getDate() << 16) | (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    for (const f of files){
      const nm = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint32(10, dt, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(12, dt, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + data.length;
    }
    const csz = cen.reduce((n, p) => n + p.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], {type});
  }

  // ───────── Text, Markdown, CSV ─────────
  function recText(m){ return m.rec.map(s => `# ${s.label}\n${s.text || '[frei gesprochen]'}`).join('\n\n') + '\n'; }
  function souffleur(m){ return m.rec.map(s => plain(s.text)).filter(Boolean).join('\n\n') + '\n'; }
  function videoText(v){ return `# Video ${v.nr}: ${v.label}\n` + (v.title ? `# Titel: ${v.title}\n` : '') + '\n' + v.segs.map(s => `# ${s.label}\n${s.text || '[frei gesprochen]'}`).join('\n\n') + '\n'; }
  function md(m){
    const L = [`# ${m.name}`, '', `Stand: ${m.date} · ${m.count} ${m.count === 1 ? 'Video' : 'Videos'} · ${m.rec.length} Abschnitte aufzunehmen` + (m.recWords ? ` · Aufnahme nach Skript etwa ${fmtDur(m.recSecs)}` : ''), '', '## Ablauf', ''];
    for (const b of m.ablauf){
      if (b.kind === 'weiche') L.push(`- **Weiche: ${b.label}**${b.cond ? ` (nur bei ${b.cond})` : ''} – ${b.outs.map(o => o.label + (o.leer ? ' (ohne eigenen Teil)' : '')).join(' / ')}`);
      else L.push(`- **${b.label}**${b.cond ? ` (nur bei ${b.cond})` : ''}${b.alts.length ? ` – abweichende Fassung für ${b.alts.join('; ')}` : ''}`);
    }
    L.push('', '## Videos', '');
    for (const v of m.videos){
      L.push(`### Video ${v.nr}: ${v.label}`, '');
      if (v.title) L.push(`Titel: ${v.title}`, '');
      L.push(`Länge nach Skript: ${v.words ? 'etwa ' + fmtDur(v.secs) : '–'}`, '');
      for (const s of v.segs) L.push(`**${s.label}**`, '', s.text || '*frei gesprochen*', '');
    }
    if (m.more) L.push(`*Weitere Videos sind nicht aufgeführt (mehr als ${MAX_VIDEOS}).*`, '');
    L.push('## Aufnahme-Skript', '', 'Jeder Abschnitt einmal, in der Reihenfolge des Ablaufs.', '');
    for (const s of m.rec) L.push(`### ${s.label}`, '', `*in ${s.n} ${s.n === 1 ? 'Video' : 'Videos'}*`, '', s.text || '*frei gesprochen*', '');
    return L.join('\n');
  }
  function csv(m){
    const q = v => /[;"\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const rows = [['Nr', 'Video', ...m.weichen, 'Titel', 'Abschnitte', 'Wörter', 'Länge (s)']];
    for (const v of m.videos){ const at = new Map(v.picks.map(p => [p.w, p.o])); rows.push([v.nr, v.label, ...m.weichen.map(w => at.get(w) || '–'), v.title, v.segs.length, v.words, Math.round(v.secs)]); }
    return '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n') + '\r\n';
  }

  // ───────── HTML ─────────
  function html(m){
    const L = treeLayout(m);
    const ablauf = m.ablauf.map(b => b.kind === 'weiche'
      ? `<li class="w"><b>Weiche: ${esc(b.label)}</b>${b.cond ? ` <span class="c">nur bei ${esc(b.cond)}</span>` : ''}<div class="outs">${b.outs.map((o, k) => `<span><i>${String.fromCharCode(65 + k)}</i>${esc(o.label)}${o.leer ? ' <em>(ohne eigenen Teil)</em>' : ''}</span>`).join('')}</div></li>`
      : `<li><b>${esc(b.label)}</b>${b.cond ? ` <span class="c">nur bei ${esc(b.cond)}</span>` : ''}${b.alts.length ? ` <span class="c">abweichend für ${esc(b.alts.join('; '))}</span>` : ''}</li>`).join('');
    const vids = m.videos.map(v => `<article class="video" id="v${v.nr}"><h3><span class="nr">${v.nr}</span>${esc(v.label)}</h3>${v.title ? `<p class="title">${esc(v.title)}</p>` : ''}<p class="len">${v.words ? 'etwa ' + fmtDur(v.secs) : 'ohne Skript'} · ${v.segs.length} ${v.segs.length === 1 ? 'Abschnitt' : 'Abschnitte'}</p>
      ${v.segs.map(s => `<div class="seg"><div class="lab">${esc(s.label)}</div>${s.text ? `<p class="txt">${esc(s.text).replace(/\n/g, '<br>')}</p>` : '<p class="free">frei gesprochen</p>'}</div>`).join('')}</article>`).join('');
    const rec = m.rec.map(s => `<div class="seg"><div class="lab">${esc(s.label)} <span>· in ${s.n} ${s.n === 1 ? 'Video' : 'Videos'}</span></div>${s.text ? `<p class="txt">${esc(s.text).replace(/\n/g, '<br>')}</p>` : '<p class="free">frei gesprochen</p>'}</div>`).join('');
    return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(m.name)} – Drehbuch</title>
<style>
:root{--anth:${C.anth};--creme:${C.creme};--sand:${C.sand};--rot:${C.rot};--rot2:${C.rotHell};--grau:${C.grauHell}}
*{box-sizing:border-box}body{margin:0;background:var(--creme);color:var(--anth);font:16px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:880px;margin:0 auto;padding:40px 24px 80px}
.kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--rot2);font-weight:700}
h1{font-size:34px;line-height:1.15;margin:6px 0 4px}h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--grau);margin:40px 0 12px;border-top:2px solid var(--anth);padding-top:10px}
.meta{color:var(--grau);margin:0}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.stats div{background:var(--anth);color:var(--creme);border-radius:12px;padding:12px 14px}.stats b{display:block;font-size:26px;line-height:1.2}.stats span{font-size:13px;color:var(--sand)}
ol.ablauf{padding-left:22px}ol.ablauf li{margin:6px 0}ol.ablauf li.w b{color:var(--rot2)}.c{color:var(--grau);font-size:14px}
.outs{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.outs span{background:#fff;border:1px solid var(--sand);border-radius:999px;padding:2px 10px 2px 4px;font-size:14px}.outs i{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--anth);color:var(--creme);font-style:normal;font-weight:700;font-size:11px;margin-right:6px}
.tree{overflow:auto;border-radius:12px;border:1px solid var(--sand);background:#FFFDF8}.tree svg{display:block}
nav.toc{columns:2;column-gap:24px;font-size:14px}nav.toc a{color:var(--anth);text-decoration:none;display:block;padding:2px 0}nav.toc a b{color:var(--rot2);margin-right:6px}
.video{background:#FFFDF8;border:1px solid var(--sand);border-radius:14px;padding:18px 20px;margin:16px 0}
.video h3{display:flex;align-items:center;gap:10px;margin:0;font-size:19px}.nr{flex:none;display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--rot);color:#FFF6EE;font-size:14px;font-weight:800}
.title{margin:6px 0 0;font-weight:600;color:var(--rot2)}.len{margin:4px 0 8px;color:var(--grau);font-size:14px}
.seg{margin:14px 0 0}.lab{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--grau)}.lab span{text-transform:none;letter-spacing:0;font-weight:500}
.txt{font:18px/1.6 Lora,Georgia,"Times New Roman",serif;margin:4px 0 0}.free{font-style:italic;color:var(--grau);margin:4px 0 0}
footer{margin-top:48px;color:var(--grau);font-size:13px}
@media print{body{background:#fff}main{padding:0;max-width:none}.video{break-inside:avoid-page;border-color:#ddd}h2{break-after:avoid}.stats div{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media (max-width:600px){.stats{grid-template-columns:1fr 1fr 1fr}.stats b{font-size:20px}nav.toc{columns:1}h1{font-size:28px}}
</style></head><body><main>
<div class="kicker">ScriptGenius · Drehbuch</div><h1>${esc(m.name)}</h1><p class="meta">Stand: ${esc(m.date)}</p>
<div class="stats"><div><b>${m.count}</b><span>${m.count === 1 ? 'Video' : 'Videos'}</span></div><div><b>${m.rec.length}</b><span>Abschnitte aufzunehmen</span></div><div><b>${m.recWords ? fmtDur(m.recSecs) : '–'}</b><span>Aufnahme nach Skript</span></div></div>
<h2>Ablauf</h2><ol class="ablauf">${ablauf || '<li>noch leer</li>'}</ol>
${L ? `<h2>Pfade</h2><div class="tree">${treeSvg(L, 'light')}</div>` : ''}
<h2>Videos</h2><nav class="toc">${m.videos.map(v => `<a href="#v${v.nr}"><b>${v.nr}</b>${esc(v.label)}</a>`).join('')}</nav>
${vids}${m.more ? `<p class="meta">Weitere Videos sind nicht aufgeführt (mehr als ${MAX_VIDEOS}).</p>` : ''}
<h2>Aufnahme-Skript</h2><p class="meta">Jeder Abschnitt einmal, in der Reihenfolge des Ablaufs.</p>${rec}
<footer>Erstellt mit ScriptGenius</footer>
</main></body></html>
`;
  }

  // ───────── Word (.docx) ─────────
  async function docx(m){
    const L = treeLayout(m), media = [];
    let img = null;
    if (L){ const cv = await treeCanvas(L, 2, 'light'); const data = await blobBytes(await canvasBlob(cv)); const maxW = 6.3 * 914400, w = cv.width / 2 * 9525, k = Math.min(1, maxW / w); img = {data, cx: Math.round(w * k), cy: Math.round(cv.height / 2 * 9525 * k)}; media.push({name: 'word/media/baum.png', data}); }
    const run = (t, o = {}) => `<w:r>${o.b || o.c || o.sz || o.i || o.f ? `<w:rPr>${o.f ? `<w:rFonts w:ascii="${o.f}" w:hAnsi="${o.f}"/>` : ''}${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.c ? `<w:color w:val="${o.c}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ''}</w:rPr>` : ''}${String(t).split('\n').map((l, k) => (k ? '<w:br/>' : '') + `<w:t xml:space="preserve">${xml(l)}</w:t>`).join('')}</w:r>`;
    const p = (style, runs, extra = '') => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>${runs}</w:p>`;
    const B = [];
    B.push(p('Untertitel', run('ScriptGenius · Drehbuch')), p('Title', run(m.name)), p('', run(`Stand: ${m.date} · ${m.count} ${m.count === 1 ? 'Video' : 'Videos'} · ${m.rec.length} Abschnitte aufzunehmen` + (m.recWords ? ` · Aufnahme nach Skript etwa ${fmtDur(m.recSecs)}` : ''), {c: '5E584D'})));
    B.push(p('Heading1', run('Ablauf')));
    for (const b of m.ablauf){
      if (b.kind === 'weiche') B.push(p('ListParagraph', run('Weiche: ' + b.label, {b: true, c: 'B8301D'}) + (b.cond ? run(` – nur bei ${b.cond}`, {c: '5E584D'}) : '') + run('\n' + b.outs.map((o, k) => `${String.fromCharCode(65 + k)}  ${o.label}${o.leer ? ' (ohne eigenen Teil)' : ''}`).join('   ·   '))));
      else B.push(p('ListParagraph', run(b.label, {b: true}) + (b.cond ? run(` – nur bei ${b.cond}`, {c: '5E584D'}) : '') + (b.alts.length ? run(` – abweichend für ${b.alts.join('; ')}`, {c: '5E584D'}) : '')));
    }
    if (img){ B.push(p('Heading1', run('Pfade')));
      B.push(`<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${img.cx}" cy="${img.cy}"/><wp:docPr id="1" name="Baum der Pfade"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="baum.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdBaum"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.cx}" cy="${img.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`); }
    m.videos.forEach((v, k) => {
      B.push(p('Heading1', run(`Video ${v.nr}: ${v.label}`), k ? '' : '<w:pageBreakBefore/>'));
      if (v.title) B.push(p('', run(v.title, {b: true, c: 'B8301D'})));
      B.push(p('', run(`${v.words ? 'etwa ' + fmtDur(v.secs) : 'ohne Skript'} · ${v.segs.length} ${v.segs.length === 1 ? 'Abschnitt' : 'Abschnitte'}`, {c: '5E584D'})));
      for (const s of v.segs){ B.push(p('Abschnitt', run(s.label))); B.push(p('Skript', s.text ? run(s.text) : run('frei gesprochen', {i: true, c: '5E584D'}))); }
    });
    B.push(p('Heading1', run('Aufnahme-Skript'), '<w:pageBreakBefore/>'), p('', run('Jeder Abschnitt einmal, in der Reihenfolge des Ablaufs.', {c: '5E584D'})));
    for (const s of m.rec){ B.push(p('Abschnitt', run(s.label) + run(`  ·  in ${s.n} ${s.n === 1 ? 'Video' : 'Videos'}`, {c: '5E584D'}))); B.push(p('Skript', s.text ? run(s.text) : run('frei gesprochen', {i: true, c: '5E584D'}))); }
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${B.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const font = (a, h) => `<w:rFonts w:ascii="${a}" w:hAnsi="${a}" w:cs="${h || a}"/>`;
    const st = (id, name, rpr, ppr = '', extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${extra}<w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${font('Inter')}<w:color w:val="131312"/><w:sz w:val="22"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${st('Title', 'Title', `${font('Inter')}<w:b/><w:sz w:val="52"/>`, '<w:spacing w:after="80"/>')}
${st('Untertitel', 'Subtitle', '<w:b/><w:caps/><w:color w:val="B8301D"/><w:sz w:val="18"/>', '<w:spacing w:after="40"/>')}
${st('Heading1', 'heading 1', '<w:b/><w:sz w:val="32"/>', '<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/>')}
${st('Abschnitt', 'Abschnitt', '<w:b/><w:caps/><w:color w:val="5E584D"/><w:sz w:val="17"/>', '<w:keepNext/><w:spacing w:before="200" w:after="40"/>')}
${st('Skript', 'Skript', `${font('Lora', 'Georgia')}<w:sz w:val="24"/>`, '<w:spacing w:after="120" w:line="320" w:lineRule="auto"/>')}
${st('ListParagraph', 'List Paragraph', '', '<w:ind w:left="284"/><w:spacing w:after="80"/>')}
</w:styles>`;
    const files = [
      {name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'},
      {name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'},
      {name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(m.name)} – Drehbuch</dc:title><dc:creator>ScriptGenius</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`},
      {name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${img ? '<Relationship Id="rIdBaum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/baum.png"/>' : ''}</Relationships>`},
      {name: 'word/document.xml', data: doc}, {name: 'word/styles.xml', data: styles}, ...media];
    return zip(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  // ───────── PDF mit eingebetteten Schriften ─────────
  // WinAnsi: Zeichen 128–159 weichen von Latin-1 ab
  const WIN = {0x20AC: 128, 0x201A: 130, 0x0192: 131, 0x201E: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02C6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017D: 142,
    0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x0161: 154, 0x203A: 155, 0x0153: 156, 0x017E: 158, 0x0178: 159};
  const UNI = new Array(256).fill(0); for (let c = 32; c < 256; c++) UNI[c] = c >= 128 && c < 160 ? 0 : c; for (const [u, c] of Object.entries(WIN)) UNI[c] = +u; UNI[127] = 0;
  const SUBST = {'→': '->', '←': '<-', '‑': '-', '‐': '-', '−': '-', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '′': "'", '″': '"', '✓': 'x', '✔': 'x', '✕': 'x', '✗': 'x', '⌘': '', '⑂': ''};
  function winAnsi(s){
    const out = []; for (const ch of String(s).normalize('NFC')){ const u = ch.codePointAt(0);
      if (u >= 32 && u < 127) out.push(u); else if (u >= 160 && u < 256) out.push(u); else if (WIN[u]) out.push(WIN[u]);
      else if (SUBST[ch] != null) for (const c of SUBST[ch]) out.push(c.charCodeAt(0)); else if (u === 9) out.push(32); else if (u > 32) out.push(63); }
    return out;
  }
  function parseTTF(bytes){
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), n = v.getUint16(4), T = {};
    for (let i = 0; i < n; i++){ const p = 12 + 16 * i, tag = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]); T[tag] = {off: v.getUint32(p + 8), len: v.getUint32(p + 12)}; }
    const head = T.head.off, upm = v.getUint16(head + 18), bbox = [v.getInt16(head + 36), v.getInt16(head + 38), v.getInt16(head + 40), v.getInt16(head + 42)];
    const hhea = T.hhea.off, asc = v.getInt16(hhea + 4), desc = v.getInt16(hhea + 6), nH = v.getUint16(hhea + 34);
    const os2 = T['OS/2'] ? T['OS/2'].off : 0, cap = os2 && v.getUint16(os2) >= 2 ? v.getInt16(os2 + 88) : asc;
    const adv = gid => v.getUint16(T.hmtx.off + 4 * Math.min(gid, nH - 1));
    // cmap: Unicode-Tabelle Format 4
    const cm = T.cmap.off, nt = v.getUint16(cm + 2); let sub = -1;
    for (let i = 0; i < nt; i++){ const pid = v.getUint16(cm + 4 + 8 * i), eid = v.getUint16(cm + 6 + 8 * i), off = v.getUint32(cm + 8 + 8 * i); if (v.getUint16(cm + off) === 4 && (pid === 3 && eid === 1 || pid === 0)){ sub = cm + off; if (pid === 3) break; } }
    const gidOf = u => { if (sub < 0) return 0; const seg = v.getUint16(sub + 6) / 2, ends = sub + 14, starts = ends + 2 * seg + 2, deltas = starts + 2 * seg, ranges = deltas + 2 * seg;
      for (let i = 0; i < seg; i++){ if (v.getUint16(ends + 2 * i) < u) continue; const st = v.getUint16(starts + 2 * i); if (st > u) return 0; const ro = v.getUint16(ranges + 2 * i), d = v.getInt16(deltas + 2 * i);
        if (!ro) return (u + d) & 0xFFFF; const gi = v.getUint16(ranges + 2 * i + ro + 2 * (u - st)); return gi ? (gi + d) & 0xFFFF : 0; } return 0; };
    const widths = []; for (let c = 32; c < 256; c++){ const u = UNI[c], gid = u ? gidOf(u) : 0; widths.push(Math.round((gid || u === 32 ? adv(gid) : adv(gidOf(63))) * 1000 / upm)); }
    // nur die Tabellen für die Umrisse behalten (variable Schriften: Grundschnitt)
    const keep = ['cmap', 'cvt ', 'fpgm', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'OS/2', 'post', 'prep'].filter(t => T[t]);
    const pad4 = x => (x + 3) & ~3; let size = 12 + 16 * keep.length; for (const t of keep) size += pad4(T[t].len);
    const out = new Uint8Array(size), ov = new DataView(out.buffer); ov.setUint32(0, 0x00010000); ov.setUint16(4, keep.length);
    let es = 0; while ((1 << (es + 1)) <= keep.length) es++; ov.setUint16(6, (1 << es) * 16); ov.setUint16(8, es); ov.setUint16(10, keep.length * 16 - (1 << es) * 16);
    let at = 12 + 16 * keep.length;
    keep.forEach((t, i) => { const {off, len} = T[t]; out.set(bytes.subarray(off, off + len), at); if (t === 'head') ov.setUint32(at + 8, 0);
      let sum = 0; for (let q = 0; q < pad4(len); q += 4) sum = (sum + ov.getUint32(at + q)) >>> 0;
      const p = 12 + 16 * i; for (let k = 0; k < 4; k++) out[p + k] = t.charCodeAt(k); ov.setUint32(p + 4, sum); ov.setUint32(p + 8, at); ov.setUint32(p + 12, len); at += pad4(len); });
    return {widths, k: 1000 / upm, asc: Math.round(asc * 1000 / upm), desc: Math.round(desc * 1000 / upm), cap: Math.round(cap * 1000 / upm), bbox: bbox.map(x => Math.round(x * 1000 / upm)), file: out};
  }
  async function deflate(bytes){ const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate')); return new Uint8Array(await new Response(s).arrayBuffer()); }
  const fontCache = new Map();
  async function loadFont(base, file){
    const url = base + 'fonts/' + file; if (fontCache.has(url)) return fontCache.get(url);
    const p = (async () => { const r = await fetch(url); if (!r.ok) throw new Error('Schrift fehlt: ' + file); return parseTTF(new Uint8Array(await r.arrayBuffer())); })();
    fontCache.set(url, p); p.catch(() => fontCache.delete(url)); return p;
  }
  const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(x => x.toFixed(3)).join(' '); };
  const pdfStr = codes => '(' + codes.map(c => c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c < 32 || c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c)).join('') + ')';

  async function pdf(m, opts = {}){
    const base = opts.base || '';
    const F = {r: await loadFont(base, 'Inter-UI.ttf'), b: await loadFont(base, 'Inter-Bold.ttf'), s: await loadFont(base, 'Lora-UI.ttf')};
    const NAMES = {r: 'Inter', b: 'Inter-Bold', s: 'Lora'}, KEYS = {r: 'F1', b: 'F2', s: 'F3'};
    const W = 595.28, Hh = 841.89, M = 56, CW = W - 2 * M, TOP = Hh - M, BOT = M + 22;
    const pages = []; let ops = null, y = 0;
    const width = (s, f, sz) => winAnsi(s).reduce((n, c) => n + (F[f].widths[c - 32] || 0), 0) * sz / 1000;
    const newPage = () => { ops = []; pages.push(ops); y = TOP; };
    const text = (x, yy, s, f, sz, col = C.anth) => { if (!s) return; ops.push(`BT /${KEYS[f]} ${sz} Tf ${hex(col)} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td ${pdfStr(winAnsi(s))} Tj ET`); };
    const rect = (x, yy, w, h, fill, stroke, r = 0) => {
      const path = r ? (() => { const k = 0.5523 * r, X2 = x + w, Y2 = yy + h; return `${x + r} ${yy} m ${X2 - r} ${yy} l ${X2 - r + k} ${yy} ${X2} ${yy + r - k} ${X2} ${yy + r} c ${X2} ${Y2 - r} l ${X2} ${Y2 - r + k} ${X2 - r + k} ${Y2} ${X2 - r} ${Y2} c ${x + r} ${Y2} l ${x + r - k} ${Y2} ${x} ${Y2 - r + k} ${x} ${Y2 - r} c ${x} ${yy + r} l ${x} ${yy + r - k} ${x + r - k} ${yy} ${x + r} ${yy} c h`; })() : `${x} ${yy} ${w} ${h} re`;
      ops.push(`${fill ? hex(fill) + ' rg ' : ''}${stroke ? hex(stroke) + ' RG 0.8 w ' : ''}${path} ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`); };
    const circle = (cx, cy, r, fill) => { const k = 0.5523 * r; ops.push(`${hex(fill)} rg ${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c f`); };
    const hline = (yy, col = C.sand, w = 0.8) => ops.push(`${hex(col)} RG ${w} w ${M} ${yy} m ${W - M} ${yy} l S`);
    // Zeilen umbrechen
    function wrap(s, f, sz, maxW){
      const out = []; for (const para of String(s).replace(/\r/g, '').split('\n')){
        const words = para.split(/(\s+)/).filter(x => x !== ''); let line = '';
        for (const w of words){ const t = line + w; if (!line || width(t.trimEnd(), f, sz) <= maxW){ line = t; continue; } out.push(line.trimEnd()); line = /^\s+$/.test(w) ? '' : w;
          while (width(line, f, sz) > maxW && line.length > 1){ let k = line.length; while (k > 1 && width(line.slice(0, k), f, sz) > maxW) k--; out.push(line.slice(0, k)); line = line.slice(k); } }
        out.push(line.trimEnd()); }
      return out;
    }
    const need = h => { if (y - h < BOT) newPage(); };
    function para(s, f, sz, col, lead, before = 0, after = 0, indent = 0, keepNext = 0){
      const lines = wrap(s, f, sz, CW - indent); y -= before;
      need(Math.min(lines.length, 2) * lead + keepNext);
      for (const l of lines){ need(lead); y -= lead; text(M + indent, y + lead * 0.25, l, f, sz, col); }
      y -= after;
    }
    const caps = s => String(s).toLocaleUpperCase('de-DE');
    // ── Titelseite: Übersicht ──
    newPage();
    text(M, y - 10, caps('ScriptGenius · Drehbuch'), 'b', 8.5, C.rotHell); y -= 22;
    for (const l of wrap(m.name, 'b', 24, CW)){ y -= 29; text(M, y, l, 'b', 24); }
    y -= 18; text(M, y, `Stand: ${m.date}`, 'r', 10, C.grauHell); y -= 22;
    const stats = [[String(m.count), m.count === 1 ? 'Video' : 'Videos'], [String(m.rec.length), 'Abschnitte aufzunehmen'], [m.recWords ? fmtDur(m.recSecs) : '–', 'Aufnahme nach Skript']], bw = (CW - 16) / 3;
    stats.forEach(([a, b], k) => { const x = M + k * (bw + 8); rect(x, y - 56, bw, 56, C.anth, null, 8); text(x + 12, y - 28, a, 'b', 20, C.creme); text(x + 12, y - 45, b, 'r', 9, C.sand); });
    y -= 80;
    const h2 = s => { need(60); y -= 14; hline(y, C.anth, 1.4); y -= 16; text(M, y, caps(s), 'b', 9, C.grauHell); y -= 8; };
    h2('Ablauf');
    m.ablauf.forEach((b, k) => {
      const head = `${k + 1}.  ${b.kind === 'weiche' ? 'Weiche: ' : ''}${b.label}`;
      para(head, 'b', 10.5, b.kind === 'weiche' ? C.rotHell : C.anth, 15, 4, 0, 0, 15);
      const sub = [b.cond ? `nur bei ${b.cond}` : '', b.kind === 'weiche' ? b.outs.map((o, q) => `${String.fromCharCode(65 + q)}: ${o.label}${o.leer ? ' (ohne eigenen Teil)' : ''}`).join('   ·   ') : '', b.alts && b.alts.length ? `abweichende Fassung für ${b.alts.join('; ')}` : ''].filter(Boolean);
      for (const s of sub) para(s, 'r', 9.5, C.grauHell, 13, 0, 0, 16);
    });
    if (!m.ablauf.length) para('noch leer', 'r', 10, C.grauHell, 14);
    const L = treeLayout(m);
    if (L){
      h2('Pfade'); const k = Math.min(1, CW / L.w), th = L.h * k;
      if (y - th - 8 < BOT && th < TOP - BOT - 40){ newPage(); }
      const k2 = Math.min(k, (y - BOT - 8) / L.h), x0 = M, y0 = y - 6;   // Baum oben links, y nach unten
      const P = (px, py) => [x0 + px * k2, y0 - py * k2], fs = L.fs * k2;
      ops.push(`${hex('#9a937f')} RG ${(2 * k2).toFixed(2)} w`);
      for (const l of L.links){ ops.push(l.map((p, i) => { const [a, b] = P(p[0], p[1]); return `${a.toFixed(2)} ${b.toFixed(2)} ${i ? 'l' : 'm'}`; }).join(' ') + ' S'); }
      for (const n of L.nodes){ const [a, b] = P(n.x, n.y + n.h); rect(a, b, n.w * k2, n.h * k2, n.root ? C.anth : C.creme, n.root ? C.anth : C.sand, 6 * k2);
        const t = cut(n.label), tw = width(t, 'b', fs); text(a + (n.w * k2 - tw) / 2, b + n.h * k2 / 2 - fs * 0.35, t, 'b', fs, n.root ? C.creme : C.anth); }
      for (const f of L.leaves){ const [a, b] = P(f.x, f.y); circle(a, b, f.r * k2, C.rotHell); const t = String(f.nr), tw = width(t, 'b', fs); text(a - tw / 2, b - fs * 0.35, t, 'b', fs, '#FFFFFF'); }
      y = y0 - L.h * k2 - 10;
    } else if (m.count > TREE_MAX){ h2('Pfade'); para(`Der Baum ist für ${m.count} Videos zu groß; die Videos folgen einzeln.`, 'r', 10, C.grauHell, 14); }
    // ── Videos ──
    m.videos.forEach(v => {
      if (y < TOP - 10 && y - 120 < BOT + 120) newPage(); else if (y < TOP - 10){ y -= 18; hline(y + 8); }
      need(70);
      y -= 24; circle(M + 11, y + 5, 11, C.rot); const t = String(v.nr), tw = width(t, 'b', 10); text(M + 11 - tw / 2, y + 1.5, t, 'b', 10, '#FFFFFF');
      const lines = wrap(v.label, 'b', 15, CW - 30); lines.forEach((l, q) => { if (q){ y -= 19; need(19); } text(M + 30, y, l, 'b', 15); });
      if (v.title) para(v.title, 'b', 11, C.rotHell, 15, 4);
      para(`${v.words ? 'etwa ' + fmtDur(v.secs) : 'ohne Skript'} · ${v.segs.length} ${v.segs.length === 1 ? 'Abschnitt' : 'Abschnitte'}`, 'r', 9.5, C.grauHell, 14, 5, 2, 30);
      for (const s of v.segs){ para(caps(s.label), 'b', 8, C.grauHell, 12, 8, 0, 0, 16); para(s.text || 'frei gesprochen', 's', 11, s.text ? C.anth : C.grauHell, 16, 1); }
    });
    if (m.more){ y -= 8; para(`Weitere Videos sind nicht aufgeführt (mehr als ${MAX_VIDEOS}).`, 'r', 9.5, C.grauHell, 14); }
    // ── Aufnahme-Skript ──
    newPage(); text(M, y - 10, caps('Aufnahme-Skript'), 'b', 8.5, C.rotHell); y -= 22;
    para('Jeder Abschnitt einmal, in der Reihenfolge des Ablaufs.', 'r', 10, C.grauHell, 14, 0, 6);
    for (const s of m.rec){ para(`${caps(s.label)}  ·  in ${s.n} ${s.n === 1 ? 'Video' : 'Videos'}`, 'b', 8, C.grauHell, 12, 10, 0, 0, 16); para(s.text || 'frei gesprochen', 's', 11, s.text ? C.anth : C.grauHell, 16, 1); }
    // Fußzeilen
    pages.forEach((o, i) => { ops = o; ops.push(`${hex(C.sand)} RG 0.6 w ${M} ${M + 8} m ${W - M} ${M + 8} l S`); text(M, M - 4, `ScriptGenius · ${m.name}`.slice(0, 90), 'r', 8, C.grauHell);
      const pg = `Seite ${i + 1} von ${pages.length}`; text(W - M - width(pg, 'r', 8), M - 4, pg, 'r', 8, C.grauHell); });
    // Datei zusammensetzen
    const objs = [], add = o => { objs.push(o); return objs.length; }, catalog = add(null), pagesObj = add(null), fontRefs = {};
    for (const f of ['r', 'b', 's']){
      const ff = F[f], data = await deflate(ff.file), file = add({head: `<< /Length ${data.length} /Length1 ${ff.file.length} /Filter /FlateDecode >>`, stream: data});
      const desc = add(`<< /Type /FontDescriptor /FontName /${NAMES[f]} /Flags 32 /FontBBox [${ff.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${ff.asc} /Descent ${ff.desc} /CapHeight ${ff.cap} /StemV ${f === 'b' ? 140 : 80} /FontFile2 ${file} 0 R >>`);
      fontRefs[f] = add(`<< /Type /Font /Subtype /TrueType /BaseFont /${NAMES[f]} /FirstChar 32 /LastChar 255 /Widths [${ff.widths.join(' ')}] /FontDescriptor ${desc} 0 R /Encoding /WinAnsiEncoding >>`);
    }
    const res = `<< /Font << /F1 ${fontRefs.r} 0 R /F2 ${fontRefs.b} 0 R /F3 ${fontRefs.s} 0 R >> >>`, kids = [];
    for (const o of pages){ const cs = await deflate(enc.encode(o.join('\n'))), c = add({head: `<< /Length ${cs.length} /Filter /FlateDecode >>`, stream: cs});
      kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${Hh}] /Resources ${res} /Contents ${c} 0 R >>`)); }
    const info = add(`<< /Title (${String(m.name).replace(/[()\\]/g, ' ').replace(/[^\x20-\x7E]/g, '?')} - Drehbuch) /Producer (ScriptGenius) >>`);
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R /Lang (de-DE) >>`;
    objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    const chunks = [enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]; let len = chunks[0].length; const xref = [];
    objs.forEach((o, i) => { xref.push(len);
      const parts = typeof o === 'string' ? [enc.encode(`${i + 1} 0 obj\n${o}\nendobj\n`)] : [enc.encode(`${i + 1} 0 obj\n${o.head}\nstream\n`), o.stream, enc.encode('\nendstream\nendobj\n')];
      for (const p of parts){ chunks.push(p); len += p.length; } });
    chunks.push(enc.encode(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + xref.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${len}\n%%EOF\n`));
    return {blob: new Blob(chunks, {type: 'application/pdf'}), pages: pages.length};
  }

  // ───────── Karte je Video (PNG, Hochformat 1080 × 1920) ─────────
  function cwrap(x, s, maxW){ const out = []; for (const para of String(s).split('\n')){ let line = ''; for (const w of para.split(/\s+/).filter(Boolean)){ const t = line ? line + ' ' + w : w; if (!line || x.measureText(t).width <= maxW) line = t; else { out.push(line); line = w; } } out.push(line); } return out; }
  async function card(m, v){
    await fontsReady();
    const W = 1080, Hh = 1920, P = 84, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const x = cv.getContext('2d');
    x.fillStyle = C.anth; x.fillRect(0, 0, W, Hh); x.textBaseline = 'alphabetic';
    x.fillStyle = C.rot; x.fillRect(0, 0, 14, Hh);
    let y = 150;
    x.font = '700 30px Inter, sans-serif'; x.fillStyle = C.sand; x.fillText(`VIDEO ${v.nr} VON ${m.count}`, P, y);
    x.beginPath(); x.arc(W - P - 44, y - 12, 44, 0, Math.PI * 2); x.fillStyle = C.rot; x.fill(); x.fillStyle = '#FFF6EE'; x.font = '800 40px Inter, sans-serif'; x.textAlign = 'center'; x.fillText(String(v.nr), W - P - 44, y + 2); x.textAlign = 'left';
    y += 40; x.font = '800 64px Inter, sans-serif'; x.fillStyle = C.creme;
    for (const l of cwrap(x, v.label, W - 2 * P).slice(0, 4)){ y += 74; x.fillText(l, P, y); }
    if (v.title){ y += 20; x.font = '700 40px Inter, sans-serif'; x.fillStyle = C.rot; for (const l of cwrap(x, v.title, W - 2 * P).slice(0, 2)){ y += 50; x.fillText(l, P, y); } }
    y += 50; x.font = '500 30px Inter, sans-serif'; x.fillStyle = C.grau; x.fillText(`${v.words ? 'etwa ' + fmtDur(v.secs) : 'ohne Skript'} · ${v.segs.length} ${v.segs.length === 1 ? 'Abschnitt' : 'Abschnitte'}`, P, y);
    y += 36; x.fillStyle = C.line; x.fillRect(P, y, W - 2 * P, 3); y += 20;
    // Abschnitte: Schrift so groß, dass alles passt (bis 24 px), sonst gekürzt
    const room = Hh - 170 - y, fit = sz => { x.font = `400 ${sz}px Lora, serif`; let h = 0; for (const s of v.segs) h += 88 + cwrap(x, s.text || 'frei gesprochen', W - 2 * P).length * sz * 1.4; return h; };
    let sz = 40; while (sz > 24 && fit(sz) > room) sz -= 2;
    let cutOff = false;
    for (const s of v.segs){
      if (y + 88 + sz * 1.4 > Hh - 170){ cutOff = true; break; }
      y += 74; x.font = '700 26px Inter, sans-serif'; x.fillStyle = C.sand; x.fillText(s.label.toLocaleUpperCase('de-DE').slice(0, 60), P, y); y += 14;
      x.font = `${s.text ? 400 : 'italic 400'} ${sz}px Lora, serif`; x.fillStyle = s.text ? C.creme : C.grau;
      for (const l of cwrap(x, s.text || 'frei gesprochen', W - 2 * P)){ if (y + sz * 1.4 > Hh - 170){ cutOff = true; break; } y += sz * 1.4; x.fillText(l, P, y); }
      if (cutOff) break;
    }
    if (cutOff){ x.font = '500 28px Inter, sans-serif'; x.fillStyle = C.grau; x.fillText('… vollständig im Drehbuch', P, Hh - 140); }
    x.fillStyle = C.line; x.fillRect(P, Hh - 110, W - 2 * P, 2);
    x.font = '700 28px Inter, sans-serif'; x.fillStyle = C.creme; x.fillText('ScriptGenius', P, Hh - 64);
    x.font = '500 28px Inter, sans-serif'; x.fillStyle = C.grau; const nm = m.name.length > 40 ? m.name.slice(0, 39) + '…' : m.name; x.textAlign = 'right'; x.fillText(nm, W - P, Hh - 64); x.textAlign = 'left';
    return canvasBlob(cv);
  }

  // ───────── Formate ─────────
  const FORMATS = [
    {id: 'pdf', name: 'Drehbuch als PDF', ext: 'pdf', desc: 'Übersicht, Baum, jedes Video mit Text und das Aufnahme-Skript – zum Lesen, Drucken und Weitergeben'},
    {id: 'html', name: 'Drehbuch als Webseite', ext: 'html', desc: 'Eine einzelne HTML-Datei, die in jedem Browser aufgeht'},
    {id: 'docx', name: 'Drehbuch als Word-Datei', ext: 'docx', desc: 'Zum Weiterschreiben in Word, LibreOffice oder Google Docs'},
    {id: 'md', name: 'Drehbuch als Markdown', ext: 'md', desc: 'Reiner Text mit Überschriften – etwa für Notizen-Apps'},
    {id: 'rec', name: 'Aufnahme-Skript', ext: 'txt', desc: 'Jeder Abschnitt einmal, mit Überschriften'},
    {id: 'souffleur', name: 'Souffleur-Fassung', ext: 'txt', desc: 'Nur der Text zum Vorlesen, ohne Überschriften und Anweisungen in Klammern'},
    {id: 'texts', name: 'Texte je Video', ext: 'zip', desc: 'Eine Textdatei je Video'},
    {id: 'treepng', name: 'Baum als Bild (PNG)', ext: 'png', desc: 'Die Pfade auf einen Blick'},
    {id: 'treesvg', name: 'Baum als Grafik (SVG)', ext: 'svg', desc: 'Beliebig vergrößerbar, zum Weiterbearbeiten'},
    {id: 'cards', name: 'Karten je Video', ext: 'zip', desc: 'Je Video ein Bild im Hochformat mit allen Abschnitten'},
    {id: 'csv', name: 'Tabelle der Videos', ext: 'csv', desc: 'Für Excel und Co.: Ausgänge, Titel, Länge je Video'},
    {id: 'plan', name: 'Plan zum Weiterbearbeiten', ext: 'scriptgenius', desc: 'Für ScriptGenius und HoneyCut auf einem anderen Gerät'},
    {id: 'all', name: 'Alles zusammen', ext: 'zip', desc: 'Alle Formate in einem ZIP-Archiv'},
  ];
  const TXT = 'text/plain;charset=utf-8';
  function planFile(plan){ const X = S(), keys = new Set(X.paths(plan, 5000).list.map(q => q.key)), c = JSON.parse(JSON.stringify(plan)); for (const k of Object.keys(c.paths || {})) if (!keys.has(k)) delete c.paths[k]; return JSON.stringify(c, null, 1); }
  async function make(id, plan, opts = {}){
    const m = model(plan), base = fileName(m.name), L = () => treeLayout(m);
    const noTree = () => { throw new Error(m.count > TREE_MAX ? `Der Baum ist für ${m.count} Videos zu groß.` : 'Der Plan hat noch keine Weiche.'); };
    switch (id){
      case 'pdf': return {name: `${base} – Drehbuch.pdf`, blob: (await pdf(m, opts)).blob};
      case 'html': return {name: `${base} – Drehbuch.html`, blob: new Blob([html(m)], {type: 'text/html;charset=utf-8'})};
      case 'docx': return {name: `${base} – Drehbuch.docx`, blob: await docx(m)};
      case 'md': return {name: `${base} – Drehbuch.md`, blob: new Blob([md(m)], {type: 'text/markdown;charset=utf-8'})};
      case 'rec': return {name: `${base} – Aufnahme-Skript.txt`, blob: new Blob([recText(m)], {type: TXT})};
      case 'souffleur': return {name: `${base} – Souffleur.txt`, blob: new Blob([souffleur(m)], {type: TXT})};
      case 'texts': return {name: `${base} – Texte je Video.zip`, blob: zip(m.videos.map(v => ({name: `Video ${nr2(v.nr, m.count)} – ${fileName(v.label)}.txt`, data: videoText(v)})))};
      case 'treepng': { const l = L(); if (!l) noTree(); return {name: `${base} – Baum.png`, blob: await canvasBlob(await treeCanvas(l, 3, opts.theme || 'dark'))}; }
      case 'treesvg': { const l = L(); if (!l) noTree(); return {name: `${base} – Baum.svg`, blob: new Blob([treeSvg(l, opts.theme || 'dark')], {type: 'image/svg+xml'})}; }
      case 'cards': { const files = []; for (const v of m.videos) files.push({name: `Karte ${nr2(v.nr, m.count)} – ${fileName(v.label)}.png`, data: await blobBytes(await card(m, v))}); return {name: `${base} – Karten.zip`, blob: zip(files)}; }
      case 'csv': return {name: `${base} – Videos.csv`, blob: new Blob([csv(m)], {type: 'text/csv;charset=utf-8'})};
      case 'plan': return {name: `${base}.scriptgenius`, blob: new Blob([planFile(plan)], {type: 'application/json'})};
      case 'all': {
        const files = [], add = async (n, b) => files.push({name: n, data: await blobBytes(b)});
        await add('Drehbuch.pdf', (await pdf(m, opts)).blob); await add('Drehbuch.html', new Blob([html(m)])); await add('Drehbuch.docx', await docx(m)); await add('Drehbuch.md', new Blob([md(m)]));
        await add('Aufnahme-Skript.txt', new Blob([recText(m)])); await add('Souffleur.txt', new Blob([souffleur(m)])); await add('Videos.csv', new Blob([csv(m)]));
        for (const v of m.videos) await add(`Texte je Video/Video ${nr2(v.nr, m.count)} – ${fileName(v.label)}.txt`, new Blob([videoText(v)]));
        const l = L(); if (l){ await add('Baum.png', await canvasBlob(await treeCanvas(l, 3, 'dark'))); await add('Baum.svg', new Blob([treeSvg(l, 'dark')])); }
        for (const v of m.videos) await add(`Karten/Karte ${nr2(v.nr, m.count)} – ${fileName(v.label)}.png`, await card(m, v));
        await add(`${base}.scriptgenius`, new Blob([planFile(plan)]));
        return {name: `${base} – alles.zip`, blob: zip(files)};
      }
    }
    throw new Error('Unbekanntes Format: ' + id);
  }
  g.ScriptGeniusExport = {FORMATS, make, model, treeLayout, treeSvg, plain, parseTTF, winAnsi, zip};
})(typeof window !== 'undefined' ? window : globalThis);
