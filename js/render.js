// DXF2PNG mobil - randare pe Canvas (pe benzi) si scriere PNG in flux.
import { flattenBulges, parseHex, BYLAYER } from './model.js';

// ---------------------------------------------------------------------------
// Vedere
// ---------------------------------------------------------------------------

export function extentFor(M, s) {
  let e = M.extAuto;
  if (s.extMode === 'all') e = M.extAll;
  return e;
}

export function fullView(M, s) {
  const e = [...extentFor(M, s)];
  const dx0 = e[2] - e[0], dy0 = e[3] - e[1];
  const m = (s.marginPct || 0) / 100 * Math.max(dx0, dy0);
  e[0] -= m; e[1] -= m; e[2] += m; e[3] += m;
  const dx = e[2] - e[0], dy = e[3] - e[1];
  const L = Math.max(100, s.longSide | 0);
  const res = Math.max(dx, dy) / L;
  return { res, x0: e[0], y1: e[3], w: Math.max(1, Math.round(dx / res)), h: Math.max(1, Math.round(dy / res)), widthScale: 1, minWidth: 0 };
}

// ---------------------------------------------------------------------------
// Fonturi (fonturile sistemului iOS / browserului)
// ---------------------------------------------------------------------------

const FONT_MAP = { arial: 'Arial', verdana: 'Verdana', times: 'Times New Roman', timesnewroman: 'Times New Roman', tahoma: 'Tahoma',
  calibri: 'Helvetica Neue', segoeui: 'Helvetica Neue', courier: 'Courier New', cour: 'Courier New', couriernew: 'Courier New',
  georgia: 'Georgia', trebuc: 'Trebuchet MS', trebuchet: 'Trebuchet MS', helvetica: 'Helvetica', arialn: 'Arial Narrow' };

function fontFamily(name) {
  const base = (name || '').toLowerCase().split(/[\\/]/).pop().replace(/\.(ttf|otf|ttc|shx)$/, '').replace(/[^a-z]/g, '');
  const f = FONT_MAP[base] || FONT_MAP[base.replace(/bd|bold|i$/g, '')] || 'Arial';
  return `"${f}", Arial, Helvetica, sans-serif`;
}

const capCache = new Map();
function capRatio(ctx, family) {
  if (capCache.has(family)) return capCache.get(family);
  ctx.save();
  ctx.font = `100px ${family}`;
  const m = ctx.measureText('H');
  ctx.restore();
  let r = m.actualBoundingBoxAscent ? m.actualBoundingBoxAscent / 100 : 0.716;
  if (!(r > 0.4 && r < 1)) r = 0.716;
  capCache.set(family, r);
  return r;
}

// ---------------------------------------------------------------------------
// Pregatirea scenei pentru o vedere
// ---------------------------------------------------------------------------

function normDash(pat) {
  // pat: valori px (>0 linie, <0 pauza, 0 punct) -> {arr, offset}
  let segs = [];
  for (const v of pat) {
    const on = v >= 0, len = Math.abs(v);
    if (segs.length && segs[segs.length - 1][0] === on) segs[segs.length - 1][1] += len;
    else segs.push([on, len]);
  }
  let offset = 0;
  if (segs.length > 1 && segs[0][0] === segs[segs.length - 1][0]) {
    const last = segs.pop();
    segs[0][1] += last[1];
    offset = last[1];
  }
  if (!segs[0][0]) { // incepe cu pauza
    const g = segs.shift();
    segs.push(g);
    const tot = segs.reduce((s, x) => s + x[1], 0);
    offset = (offset + tot - g[1]) % tot;
  }
  if (segs.length % 2) segs.push([false, 0.0001]);
  return { arr: segs.map(([on, l]) => (on && l === 0 ? 0.01 : l)), offset };
}

export function buildScene(M, s, v) {
  const lset = new Map();
  s.layers.forEach((l, i) => lset.set(l.name.toUpperCase(), { ...l, order: i, col: parseHex(l.color, 0) }));
  const ls = M.layers.map((L, i) => lset.get(L.name.toUpperCase()) || { name: L.name, visible: true, width: 2, textScale: 1, useLtype: true, order: 1000 + i, col: 0 });
  const wmul = s.widthMul > 0 ? s.widthMul : 1, tmul = s.textMul > 0 ? s.textMul : 1, ltm = s.ltScaleMul > 0 ? s.ltScaleMul : 1;
  const tol = 0.25 * v.res;
  const W = v.w, H = v.h;
  const toX = x => (x - v.x0) / v.res, toY = y => (v.y1 - y) / v.res;
  const groups = new Map();
  const grp = (pass, order, col, width) => {
    const k = pass + '|' + order + '|' + col + '|' + width;
    let g = groups.get(k);
    if (!g) { g = { pass, order, col, width, items: [] }; groups.set(k, g); }
    return g;
  };
  for (const p of M.prims) {
    const L = ls[p.layer];
    if (!L.visible) continue;
    const col = p.color === BYLAYER ? L.col : p.color;
    if (p.fill) {
      const rings = p.rings.map(r => { const a = new Float32Array(r.length * 2); r.forEach((q, i) => { a[2 * i] = toX(q.x); a[2 * i + 1] = toY(q.y); }); return a; });
      let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
      for (const a of rings) for (let i = 0; i < a.length; i += 2) { x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); }
      if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) continue;
      grp(0, L.order, col, 0).items.push({ rings, y0, y1 });
      continue;
    }
    let w = L.width * wmul * v.widthScale;
    if (w < v.minWidth) w = v.minWidth;
    if (!(w > 0)) continue;
    const pts = p.hasB ? flattenBulges(p.pts, p.closed, tol) : p.pts;
    const a = new Float32Array(pts.length * 2);
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const x = toX(pts[i].x), y = toY(pts[i].y);
      a[2 * i] = x; a[2 * i + 1] = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < -w || x0 > W + w || y1 < -w || y0 > H + w) continue;
    let dash = null;
    if (p.pat && L.useLtype) {
      const px = p.pat.map(e => e * p.lts * ltm / v.res);
      const tot = px.reduce((t, e) => t + Math.abs(e), 0);
      if (tot >= 3) dash = normDash(px);
    }
    grp(1, L.order, col, Math.round(w * 100) / 100).items.push({ a, closed: p.closed, dash, y0: y0 - w, y1: y1 + w });
  }
  for (const t of M.texts) {
    const L = ls[t.layer];
    if (!L.visible) continue;
    const sc = (L.textScale ?? 1) * tmul;
    if (!(sc > 0)) continue;
    const h = t.h * sc / v.res;
    if (h < 0.35) continue;
    const x = toX(t.ins.x), y = toY(t.ins.y);
    const n = Math.max(...t.lines.map(l => l.length));
    const r = h * (t.lines.length + 2) * 2 + n * h * 1.3 * Math.max(1, t.wf) + Math.abs(t.fit) / v.res + t.wrap * sc / v.res;
    if (x + r < 0 || x - r > W || y + r < 0 || y - r > H) continue;
    const col = t.color === BYLAYER ? L.col : t.color;
    grp(2, L.order, col, 0).items.push({ t, sc, x, y, y0: y - r, y1: y + r });
  }
  const list = [...groups.values()].sort((a, b) => a.pass - b.pass || a.order - b.order || a.col - b.col);
  for (const g of list) g.items.sort((a, b) => a.y0 - b.y0);
  const bg = s.transparent ? null : (s.background || '#ffffff');
  return { groups: list, bg, v };
}

const css = c => '#' + (c & 0xFFFFFF).toString(16).padStart(6, '0');

function drawText(ctx, it, v, fontCache) {
  const t = it.t;
  const family = fontFamily(t.font);
  const cap = capRatio(ctx, family);
  let H = t.h * it.sc / v.res;               // inaltime majuscule (px)
  let fs = H / cap;
  let wf = t.wf > 0 ? t.wf : 1;
  ctx.font = `${fs}px ${family}`;
  let lines = t.lines;
  const mw = s => ctx.measureText(s).width;
  if (t.mtext && t.wrap > 0) {
    const maxW = t.wrap * it.sc / v.res / wf;
    const out = [];
    for (const l of lines) {
      let cur = '';
      for (const w of l.split(' ')) {
        const tr = cur ? cur + ' ' + w : w;
        if (cur && mw(tr) > maxW * 1.001) { out.push(cur); cur = w; } else cur = tr;
      }
      out.push(cur);
    }
    lines = out;
  }
  if (t.fit && lines.length === 1) {
    const nat = mw(lines[0]);
    const target = Math.abs(t.fit) / v.res;
    if (nat > 0) {
      if (t.fit > 0) wf = target / nat;
      else { const k = target / (nat * wf); H *= k; fs *= k; ctx.font = `${fs}px ${family}`; }
    }
  }
  const ls = t.mtext ? 5 / 3 * H * t.spacing : 0;
  const n = lines.length;
  let vy = 0;
  if (t.mtext) {
    const total = H + (n - 1) * ls;
    vy = t.va === 3 ? -H : t.va === 2 ? -H + total / 2 : -H + total;
  } else {
    vy = t.va === 1 ? fs * 0.21 : t.va === 2 ? -H / 2 : t.va === 3 ? -H : 0;
  }
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(-t.rot);
  ctx.scale(wf, 1);
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < n; i++) {
    const w = mw(lines[i]);
    const ux = t.ha === 1 ? -w / 2 : t.ha === 2 ? -w : 0;
    ctx.fillText(lines[i], ux, -(vy - i * ls));
  }
  ctx.restore();
}

// Deseneaza in ctx zona [y0, y0+h) a vederii (ctx are dimensiunea w x h).
export function drawStrip(ctx, scene, y0, h) {
  const v = scene.v;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (scene.bg) { ctx.fillStyle = scene.bg; ctx.fillRect(0, 0, ctx.canvas.width, h); }
  else ctx.clearRect(0, 0, ctx.canvas.width, h);
  ctx.setTransform(1, 0, 0, 1, 0, -y0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const ya = y0 - 2, yb = y0 + h + 2;
  for (const g of scene.groups) {
    if (g.pass === 0) {
      ctx.fillStyle = css(g.col);
      ctx.beginPath();
      let any = false;
      for (const it of g.items) {
        if (it.y0 > yb) break;
        if (it.y1 < ya) continue;
        for (const a of it.rings) { ctx.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) ctx.lineTo(a[i], a[i + 1]); ctx.closePath(); }
        any = true;
      }
      if (any) ctx.fill('nonzero');
    } else if (g.pass === 1) {
      ctx.strokeStyle = css(g.col);
      ctx.lineWidth = g.width;
      ctx.setLineDash([]);
      ctx.beginPath();
      let any = false;
      const dashed = [];
      for (const it of g.items) {
        if (it.y0 > yb) break;
        if (it.y1 < ya) continue;
        if (it.dash) { dashed.push(it); continue; }
        const a = it.a;
        ctx.moveTo(a[0], a[1]);
        if (a.length === 2) ctx.lineTo(a[0] + 0.01, a[1]);
        for (let i = 2; i < a.length; i += 2) ctx.lineTo(a[i], a[i + 1]);
        if (it.closed) ctx.closePath();
        any = true;
      }
      if (any) ctx.stroke();
      if (dashed.length) ctx.lineCap = 'butt';
      for (const it of dashed) {
        ctx.setLineDash(it.dash.arr.map(x => (x === 0.01 ? Math.max(1, g.width * 0.9) : x)));
        ctx.lineDashOffset = it.dash.offset;
        ctx.beginPath();
        const a = it.a;
        ctx.moveTo(a[0], a[1]);
        for (let i = 2; i < a.length; i += 2) ctx.lineTo(a[i], a[i + 1]);
        if (it.closed) ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
    } else {
      ctx.fillStyle = css(g.col);
      for (const it of g.items) {
        if (it.y0 > yb) break;
        if (it.y1 < ya) continue;
        drawText(ctx, it, v);
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Randare intr-un canvas mic (previzualizare)
export function renderToCanvas(canvas, scene) {
  canvas.width = scene.v.w;
  canvas.height = scene.v.h;
  const ctx = canvas.getContext('2d');
  drawStrip(ctx, scene, 0, scene.v.h);
}

// ---------------------------------------------------------------------------
// CRC32 + PNG in flux
// ---------------------------------------------------------------------------

const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(data, crc = 0) {
  let c = ~crc >>> 0;
  for (let i = 0; i < data.length; i++) c = CRC_T[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

class PNGStream {
  constructor(w, h, alpha) {
    this.w = w; this.h = h; this.alpha = alpha; this.bpp = alpha ? 4 : 3;
    this.prev = new Uint8Array(w * this.bpp);
    this.cs = new CompressionStream('deflate');
    this.writer = this.cs.writable.getWriter();
    this.parts = [];
    const reader = this.cs.readable.getReader();
    this.done = (async () => { for (;;) { const { value, done } = await reader.read(); if (done) break; this.parts.push(value); } })();
  }
  // rgba: Uint8ClampedArray (w x rows), neprecomputat (ImageData)
  async addRows(rgba, rows) {
    const w = this.w, bpp = this.bpp, stride = 1 + w * bpp;
    const batch = 48;
    for (let r0 = 0; r0 < rows; r0 += batch) {
      const nr = Math.min(batch, rows - r0);
      const buf = new Uint8Array(nr * stride);
      for (let r = 0; r < nr; r++) {
        const src = (r0 + r) * w * 4;
        const o = r * stride;
        buf[o] = 2; // filtru Up
        const prev = this.prev;
        if (bpp === 3) {
          for (let x = 0, j = 0; x < w; x++, j += 3) {
            const s = src + x * 4;
            const R = rgba[s], G = rgba[s + 1], B = rgba[s + 2];
            buf[o + 1 + j] = R - prev[j]; buf[o + 2 + j] = G - prev[j + 1]; buf[o + 3 + j] = B - prev[j + 2];
            prev[j] = R; prev[j + 1] = G; prev[j + 2] = B;
          }
        } else {
          for (let x = 0, j = 0; x < w; x++, j += 4) {
            const s = src + x * 4;
            for (let k = 0; k < 4; k++) { const val = rgba[s + k]; buf[o + 1 + j + k] = val - prev[j + k]; prev[j + k] = val; }
          }
        }
      }
      await this.writer.ready;
      this.writer.write(buf);
    }
  }
  async finish() {
    await this.writer.close();
    await this.done;
    const ih = new Uint8Array(13);
    const dv = new DataView(ih.buffer);
    dv.setUint32(0, this.w); dv.setUint32(4, this.h);
    ih[8] = 8; ih[9] = this.alpha ? 6 : 2;
    const out = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih)];
    // IDAT-uri de ~1 MB
    let acc = [], accLen = 0;
    const flush = () => {
      if (!accLen) return;
      const d = new Uint8Array(accLen); let o = 0;
      for (const p of acc) { d.set(p, o); o += p.length; }
      out.push(chunk('IDAT', d)); acc = []; accLen = 0;
    };
    for (const p of this.parts) { acc.push(p); accLen += p.length; if (accLen >= 1 << 20) flush(); }
    flush();
    this.parts = null;
    out.push(chunk('IEND', new Uint8Array(0)));
    return new Blob(out, { type: 'image/png' });
  }
}

// Randarea completa -> Blob PNG
export async function renderPNG(scene, onProgress, shouldCancel) {
  const v = scene.v;
  if (v.w > 32000) throw new Error('Lățimea maximă suportată este 32000 px.');
  if (typeof CompressionStream === 'undefined') throw new Error('Browserul nu suportă CompressionStream (actualizați iOS / Safari).');
  const stripH = Math.max(1, Math.min(1024, Math.floor(16000000 / v.w)));
  const canvas = document.createElement('canvas');
  canvas.width = v.w; canvas.height = stripH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: !scene.bg });
  if (!ctx) throw new Error('Nu pot crea suprafața de desen (memorie insuficientă).');
  const png = new PNGStream(v.w, v.h, !scene.bg);
  const total = Math.ceil(v.h / stripH);
  try {
    for (let k = 0; k < total; k++) {
      if (shouldCancel && shouldCancel()) throw new Error('Anulat');
      const y0 = k * stripH, h = Math.min(stripH, v.h - y0);
      drawStrip(ctx, scene, y0, h);
      const img = ctx.getImageData(0, 0, v.w, h);
      if (!img || !img.data || img.data.length !== v.w * h * 4) throw new Error('Citirea imaginii a eșuat (memorie insuficientă).');
      await png.addRows(img.data, h);
      onProgress && onProgress(k + 1, total);
      await new Promise(r => setTimeout(r, 0));
    }
    return await png.finish();
  } finally {
    canvas.width = 1; canvas.height = 1; // eliberam memoria canvas-ului
  }
}

export function worldFile(v) {
  return `${v.res.toFixed(10)}\n0.0\n0.0\n${(-v.res).toFixed(10)}\n${(v.x0 + v.res / 2).toFixed(6)}\n${(v.y1 - v.res / 2).toFixed(6)}\n`;
}

// ---------------------------------------------------------------------------
// ZIP (fara compresie) pentru PNG + PGW
// ---------------------------------------------------------------------------

export async function makeZip(files) { // [{name, blob}]
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer());
    const crc = crc32(data);
    const name = enc.encode(f.name);
    const lh = new Uint8Array(30 + name.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true);
    dv.setUint16(10, dosTime, true); dv.setUint16(12, dosDate, true); dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
    lh.set(name, 30);
    parts.push(lh, data);
    const ch = new Uint8Array(46 + name.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    ch.set(name, 46);
    central.push(ch);
    offset += lh.length + data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
