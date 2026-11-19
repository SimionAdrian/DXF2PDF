// DXF2PNG mobil - PDF vectorial al intregului plan, pe o singura pagina.
// Liniile raman vectori; textele sunt desenate ca si contururi (fara fonturi
// necesare pe dispozitivul care deschide PDF-ul).
import { flattenBulges, parseHex, BYLAYER } from './model.js';
import { extentFor, fullView } from './render.js';

const MM2PT = 72 / 25.4;
const MAX_MM = 4800; // limita practica a unei pagini PDF (~5 m)
const SCALES = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000];

let fontsPromise = null;
export async function loadFonts() {
  if (!fontsPromise) fontsPromise = (async () => {
    const ot = (await import('../lib/opentype.module.js')).default;
    const get = async f => ot.parse(await (await fetch(new URL('../lib/fonts/' + f, import.meta.url))).arrayBuffer());
    const [sans, verd] = await Promise.all([get('LiberationSans-Regular.ttf'), get('DejaVuSans.ttf')]);
    const prep = f => {
      const os2 = f.tables.os2 || {};
      let cap = os2.sCapHeight ? os2.sCapHeight / f.unitsPerEm : 0;
      if (!(cap > 0.4 && cap < 1)) cap = 0.716;
      return { f, cap };
    };
    return { sans: prep(sans), verd: prep(verd) };
  })();
  return fontsPromise;
}

function pickFont(fonts, name) {
  const n = (name || '').toLowerCase();
  if (n.includes('verdana') || n.includes('tahoma') || n.includes('dejavu')) return fonts.verd;
  return fonts.sans;
}

export const n2 = v => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? '0' : String(r); };

// cale opentype (y in jos) -> operatori PDF, cu transformare
export function pathOps(cmds, tr) {
  let s = '', cx = 0, cy = 0;
  for (const c of cmds) {
    switch (c.type) {
      case 'M': { const [x, y] = tr(c.x, c.y); s += `${n2(x)} ${n2(y)} m\n`; cx = c.x; cy = c.y; break; }
      case 'L': { const [x, y] = tr(c.x, c.y); s += `${n2(x)} ${n2(y)} l\n`; cx = c.x; cy = c.y; break; }
      case 'Q': {
        const c1x = cx + 2 / 3 * (c.x1 - cx), c1y = cy + 2 / 3 * (c.y1 - cy);
        const c2x = c.x + 2 / 3 * (c.x1 - c.x), c2y = c.y + 2 / 3 * (c.y1 - c.y);
        const [a, b] = tr(c1x, c1y), [d, e] = tr(c2x, c2y), [f, g] = tr(c.x, c.y);
        s += `${n2(a)} ${n2(b)} ${n2(d)} ${n2(e)} ${n2(f)} ${n2(g)} c\n`; cx = c.x; cy = c.y; break;
      }
      case 'C': {
        const [a, b] = tr(c.x1, c.y1), [d, e] = tr(c.x2, c.y2), [f, g] = tr(c.x, c.y);
        s += `${n2(a)} ${n2(b)} ${n2(d)} ${n2(e)} ${n2(f)} ${n2(g)} c\n`; cx = c.x; cy = c.y; break;
      }
      case 'Z': s += 'h\n'; break;
    }
  }
  return s;
}

export function normDash(pat) {
  let segs = [];
  for (const v of pat) {
    const on = v >= 0, len = Math.abs(v);
    if (segs.length && segs[segs.length - 1][0] === on) segs[segs.length - 1][1] += len;
    else segs.push([on, len]);
  }
  let offset = 0;
  if (segs.length > 1 && segs[0][0] === segs[segs.length - 1][0]) { const last = segs.pop(); segs[0][1] += last[1]; offset = last[1]; }
  if (!segs[0][0]) { const g = segs.shift(); segs.push(g); const tot = segs.reduce((s, x) => s + x[1], 0); offset = (offset + tot - g[1]) % tot; }
  if (segs.length % 2) segs.push([false, 0.001]);
  return { arr: segs.map(([on, l]) => (on && l === 0 ? 0 : l)), offset };
}

// Alege scara si dimensiunea paginii.
export function pdfLayout(M, S) {
  const e = [...extentFor(M, S)];
  const dx0 = e[2] - e[0], dy0 = e[3] - e[1];
  const m = Math.max(dx0, dy0) * Math.max(S.marginPct || 0, 1) / 100;
  e[0] -= m; e[1] -= m; e[2] += m; e[3] += m;
  const dx = e[2] - e[0], dy = e[3] - e[1];
  let scale = SCALES[SCALES.length - 1];
  for (const sc of SCALES) { if (Math.max(dx, dy) * 1000 / sc <= MAX_MM) { scale = sc; break; } }
  const k = 1000 / scale; // mm hartie / m teren
  return { e, scale, k, wmm: dx * k, hmm: dy * k };
}

export async function renderPDF(M, S, onProgress) {
  if (typeof CompressionStream === 'undefined') throw new Error('Browserul nu suportă CompressionStream (actualizați iOS / Safari).');
  const fonts = await loadFonts();
  const L = pdfLayout(M, S);
  const { e, k } = L;
  const P = (x, y) => [(x - e[0]) * k, (y - e[1]) * k];
  // grosimi: aceeasi imagine ca PNG-ul (px -> mm pe pagina)
  const v = fullView(M, S);
  const mmPerPx = v.res * k;
  const lset = new Map();
  S.layers.forEach((l, i) => lset.set(l.name.toUpperCase(), { ...l, order: i, col: parseHex(l.color, 0) }));
  const ls = M.layers.map((Ly, i) => lset.get(Ly.name.toUpperCase()) || { name: Ly.name, visible: true, width: 2, textScale: 1, useLtype: true, order: 1000 + i, col: 0 });
  const wmul = S.widthMul > 0 ? S.widthMul : 1, tmul = S.textMul > 0 ? S.textMul : 1, ltm = S.ltScaleMul > 0 ? S.ltScaleMul : 1;
  const tol = 0.005 / k; // 0,005 mm pe hartie (cercuri netede la zoom mare)

  // grupare
  const groups = new Map();
  const grp = (pass, order, col, w) => {
    const key = pass + '|' + order + '|' + col + '|' + w;
    let g = groups.get(key);
    if (!g) { g = { pass, order, col, w, items: [] }; groups.set(key, g); }
    return g;
  };
  for (const p of M.prims) {
    const Ly = ls[p.layer];
    if (!Ly.visible) continue;
    const col = p.color === BYLAYER ? Ly.col : p.color;
    if (p.fill) { grp(0, Ly.order, col, 0).items.push(p); continue; }
    const w = Math.max(0.05, Ly.width * wmul * mmPerPx);
    if (!(Ly.width > 0)) continue;
    grp(1, Ly.order, col, Math.round(w * 1000) / 1000).items.push(p);
  }
  for (const t of M.texts) {
    const Ly = ls[t.layer];
    if (!Ly.visible) continue;
    const sc = (Ly.textScale ?? 1) * tmul;
    if (!(sc > 0)) continue;
    const col = t.color === BYLAYER ? Ly.col : t.color;
    grp(2, Ly.order, col, 0).items.push({ t, sc });
  }
  const list = [...groups.values()].sort((a, b) => a.pass - b.pass || a.order - b.order || a.col - b.col);
  const total = list.reduce((s, g) => s + g.items.length, 0);

  // flux de continut comprimat
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  const parts = [];
  const reader = cs.readable.getReader();
  const pump = (async () => { for (;;) { const { value, done } = await reader.read(); if (done) break; parts.push(value); } })();
  const enc = new TextEncoder();
  let buf = '';
  const out = async s => { buf += s; if (buf.length > 1 << 20) { await writer.ready; writer.write(enc.encode(buf)); buf = ''; } };
  const rgb = (c, stroke) => `${n2((c >> 16 & 255) / 255)} ${n2((c >> 8 & 255) / 255)} ${n2((c & 255) / 255)} ${stroke ? 'RG' : 'rg'}\n`;

  await out(`${MM2PT.toFixed(6)} 0 0 ${MM2PT.toFixed(6)} 0 0 cm 1 J 1 j\n`);
  let done = 0, lastTick = performance.now();
  const tick = async () => {
    if (performance.now() - lastTick > 60) { onProgress && onProgress(done, total); await new Promise(r => setTimeout(r, 0)); lastTick = performance.now(); }
  };
  for (const g of list) {
    if (g.pass === 0) {
      await out(rgb(g.col, false));
      for (const p of g.items) {
        for (const r of p.rings) {
          r.forEach((q, i) => { const [x, y] = P(q.x, q.y); buf += `${n2(x)} ${n2(y)} ${i ? 'l' : 'm'}\n`; });
          buf += 'h\n';
        }
        done++;
      }
      await out('f\n');
    } else if (g.pass === 1) {
      await out(rgb(g.col, true) + `${n2(g.w)} w [] 0 d 1 J\n`);
      const dashed = [];
      let n = 0;
      for (const p of g.items) {
        const Ly = ls[p.layer];
        if (p.pat && Ly.useLtype) {
          const mm = p.pat.map(x => x * p.lts * ltm * k);
          if (mm.reduce((s, x) => s + Math.abs(x), 0) >= 0.6) { dashed.push({ p, mm }); continue; }
        }
        const pts = p.hasB ? flattenBulges(p.pts, p.closed, tol) : p.pts;
        let s = '';
        pts.forEach((q, i) => { const [x, y] = P(q.x, q.y); s += `${n2(x)} ${n2(y)} ${i ? 'l' : 'm'}\n`; });
        if (pts.length === 1) { const [x, y] = P(pts[0].x, pts[0].y); s += `${n2(x)} ${n2(y)} l\n`; }
        if (p.closed && pts.length > 2) s += 'h\n';
        await out(s);
        done++; n++;
        if (n % 2000 === 0) { await out('S\n'); await tick(); }
      }
      await out('S\n');
      if (dashed.length) {
        await out('0 J\n');
        for (const { p, mm } of dashed) {
          const d = normDash(mm);
          const arr = d.arr.map(x => (x === 0 ? Math.max(0.05, g.w * 0.9) : x));
          const pts = p.hasB ? flattenBulges(p.pts, p.closed, tol) : p.pts;
          let s = `[${arr.map(n2).join(' ')}] ${n2(d.offset)} d\n`;
          pts.forEach((q, i) => { const [x, y] = P(q.x, q.y); s += `${n2(x)} ${n2(y)} ${i ? 'l' : 'm'}\n`; });
          if (p.closed && pts.length > 2) s += 'h\n';
          await out(s + 'S\n');
          done++;
        }
        await out('[] 0 d 1 J\n');
      }
    } else {
      await out(rgb(g.col, false));
      let n = 0;
      for (const { t, sc } of g.items) {
        await out(textOps(t, sc, fonts, k, P));
        done++; n++;
        if (n % 200 === 0) { await out('f\n'); await tick(); }
      }
      await out('f\n');
    }
    await tick();
  }
  if (buf) { await writer.ready; writer.write(enc.encode(buf)); buf = ''; }
  await writer.close();
  await pump;
  onProgress && onProgress(total, total);

  // asamblare PDF
  let clen = 0;
  for (const p of parts) clen += p.length;
  const W = L.wmm * MM2PT, H = L.hmm * MM2PT;
  const pieces = [];
  let off = 0;
  const offs = [];
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; pieces.push(b); off += b.length; };
  const obj = (n, body) => { offs[n] = off; push(`${n} 0 obj\n`); if (typeof body === 'function') body(); else push(body); push('\nendobj\n'); };
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Contents 4 0 R /Resources << >> >>`);
  obj(4, () => { push(`<< /Length ${clen} /Filter /FlateDecode >>\nstream\n`); for (const p of parts) push(p); push('\nendstream'); });
  const title = (S._title || 'Plan').replace(/[()\\]/g, '');
  const hexTitle = '<FEFF' + [...title].map(c => c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()).join('') + '>';
  obj(5, `<< /Title ${hexTitle} /Producer (DXF2PNG mobil) >>`);
  const xref = off;
  let x = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  x += `trailer\n<< /Size 6 /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  push(x);
  return { blob: new Blob(pieces, { type: 'application/pdf' }), layout: L };
}

export function textOps(t, sc, fonts, k, P) {
  const F = pickFont(fonts, t.font);
  const f = F.f;
  let H = t.h * sc;                  // inaltime majuscule (unitati desen)
  let size = H / F.cap;              // dimensiune font (unitati desen)
  let wf = t.wf > 0 ? t.wf : 1;
  const adv = s => f.getAdvanceWidth(s, size, { kerning: true });
  let lines = t.lines;
  if (t.mtext && t.wrap > 0) {
    const maxW = t.wrap * sc / wf, outl = [];
    for (const l of lines) {
      let cur = '';
      for (const w of l.split(' ')) { const tr = cur ? cur + ' ' + w : w; if (cur && adv(tr) > maxW * 1.001) { outl.push(cur); cur = w; } else cur = tr; }
      outl.push(cur);
    }
    lines = outl;
  }
  if (t.fit && lines.length === 1) {
    const nat = adv(lines[0]);
    if (nat > 0) {
      if (t.fit > 0) wf = t.fit / nat;
      else { const q = -t.fit / (nat * wf); H *= q; size *= q; }
    }
  }
  const ls = t.mtext ? 5 / 3 * H * t.spacing : 0;
  const n = lines.length;
  let vy;
  if (t.mtext) { const total = H + (n - 1) * ls; vy = t.va === 3 ? -H : t.va === 2 ? -H + total / 2 : -H + total; }
  else vy = t.va === 1 ? size * 0.21 : t.va === 2 ? -H / 2 : t.va === 3 ? -H : 0;
  const cr = Math.cos(t.rot), sr = Math.sin(t.rot);
  let s = '';
  for (let i = 0; i < n; i++) {
    const line = lines[i];
    if (!line) continue;
    const w = adv(line) * wf;
    const ux = t.ha === 1 ? -w / 2 : t.ha === 2 ? -w : 0;
    const base = vy - i * ls;
    const path = f.getPath(line, 0, 0, size, { kerning: true });
    s += pathOps(path.commands, (gx, gy) => {
      const u = ux + gx * wf, wv = base - gy;
      return P(t.ins.x + u * cr - wv * sr, t.ins.y + u * sr + wv * cr);
    });
  }
  return s;
}
