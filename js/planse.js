// DXF2PNG mobil - PDF vectorial pe planse la scara 1:1000.
// Daca planul incape pe o singura foaie (A4 ... A0) se alege cea mai mica foaie.
// Altfel: impartire pe planse A0, cu pagina 1 = plan de ansamblu, in care numarul
// fiecarei planse este legatura (clic) catre plansa respectiva.
import { flattenBulges, parseHex, BYLAYER } from './model.js';
import { extentFor } from './render.js';
import { loadFonts, pathOps, normDash, textOps, n2 } from './pdf.js';

const MM2PT = 72 / 25.4;
const PX_MM = 25.4 / 300;           // 1 px din PNG = 1 punct la 300 dpi
const FORMATE = [['A4', 297, 210], ['A3', 420, 297], ['A2', 594, 420], ['A1', 841, 594], ['A0', 1189, 841]];
const SCARI_ANS = [1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000, 1000000];
const M_ST = 22, M_DR = 12, M_SUS = 12, M_JOS = 26; // margini (mm); jos = cartus
const MAX_PLANSE = 600;

const zona = (W, H) => ({ x: M_ST, y: M_JOS, w: W - M_ST - M_DR, h: H - M_SUS - M_JOS });
const inter = (a, r) => a[0] <= r[2] && a[2] >= r[0] && a[1] <= r[3] && a[3] >= r[1];

// segmentul AB atinge dreptunghiul r?
function segRect(ax, ay, bx, by, r) {
  if (ax >= r[0] && ax <= r[2] && ay >= r[1] && ay <= r[3]) return true;
  if (bx >= r[0] && bx <= r[2] && by >= r[1] && by <= r[3]) return true;
  if (Math.max(ax, bx) < r[0] || Math.min(ax, bx) > r[2] || Math.max(ay, by) < r[1] || Math.min(ay, by) > r[3]) return false;
  const dx = bx - ax, dy = by - ay;
  const s = (x, y) => Math.sign(dx * (y - ay) - dy * (x - ax));
  const a = s(r[0], r[1]), b = s(r[2], r[1]), c = s(r[2], r[3]), d = s(r[0], r[3]);
  return !(a === b && b === c && c === d && a !== 0);
}

// ---------------------------------------------------------------------------
// Pregatirea geometriei (o singura data)
// ---------------------------------------------------------------------------
function pregateste(M, S) {
  const lset = new Map();
  S.layers.forEach((l, i) => lset.set(l.name.toUpperCase(), { ...l, order: i, col: parseHex(l.color, 0) }));
  const ls = M.layers.map((Ly, i) => lset.get(Ly.name.toUpperCase()) || { name: Ly.name, visible: true, width: 2, textScale: 1, useLtype: true, order: 1000 + i, col: 0 });
  const wmul = S.widthMul > 0 ? S.widthMul : 1, tmul = S.textMul > 0 ? S.textMul : 1;
  const tol = 0.005; // 5 mm teren = 0,005 mm la 1:1000
  const groups = new Map();
  const grp = (pass, order, col, wpx) => {
    const key = pass + '|' + order + '|' + col + '|' + wpx;
    let g = groups.get(key);
    if (!g) { g = { pass, order, col, wpx, items: [] }; groups.set(key, g); }
    return g;
  };
  const bb = pts => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of pts) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; } return [x0, y0, x1, y1]; };
  for (const p of M.prims) {
    const Ly = ls[p.layer];
    if (!Ly.visible) continue;
    const col = p.color === BYLAYER ? Ly.col : p.color;
    if (p.fill) {
      const b = bb(p.rings.flat());
      if (!Number.isFinite(b[0])) continue;
      grp(0, Ly.order, col, 0).items.push({ rings: p.rings, b });
      continue;
    }
    if (!(Ly.width > 0)) continue;
    const pts = p.hasB ? flattenBulges(p.pts, p.closed, tol) : p.pts;
    if (!pts.length) continue;
    const pat = p.pat && Ly.useLtype ? p.pat.map(x => x * p.lts) : null;
    grp(1, Ly.order, col, Math.round(Ly.width * wmul * 1000) / 1000).items.push({ pts, closed: p.closed, pat, b: bb(pts) });
  }
  for (const t of M.texts) {
    const Ly = ls[t.layer];
    if (!Ly.visible) continue;
    const sc = (Ly.textScale ?? 1) * tmul;
    if (!(sc > 0)) continue;
    const col = t.color === BYLAYER ? Ly.col : t.color;
    const h = t.h * sc, n = Math.max(1, ...t.lines.map(l => l.length));
    const r = h * (t.lines.length + 2) * 2 + n * h * 1.3 * Math.max(1, t.wf || 1) + Math.abs(t.fit || 0) + (t.wrap || 0) * sc;
    grp(2, Ly.order, col, 0).items.push({ t, sc, b: [t.ins.x - r, t.ins.y - r, t.ins.x + r, t.ins.y + r] });
  }
  return [...groups.values()].sort((a, b) => a.pass - b.pass || a.order - b.order || a.col - b.col);
}

function areContinut(list, r) {
  for (const g of list) for (const it of g.items) {
    if (!inter(it.b, r)) continue;
    if (g.pass !== 1) return true;
    const p = it.pts;
    if (p.length === 1) return true;
    for (let i = 1; i < p.length; i++) if (segRect(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y, r)) return true;
    if (it.closed && p.length > 2 && segRect(p[p.length - 1].x, p[p.length - 1].y, p[0].x, p[0].y, r)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Planificarea planselor
// ---------------------------------------------------------------------------
export function planificaPlanse(M, S, list) {
  const e = [...extentFor(M, S)];
  const k = 1;                          // 1:1000 -> 1 mm pe hartie = 1 m teren
  const dx = Math.max(1, e[2] - e[0]), dy = Math.max(1, e[3] - e[1]);
  const cx = (e[0] + e[2]) / 2, cy = (e[1] + e[3]) / 2;
  for (const [nm, a, b] of FORMATE) {
    for (const [W, H] of (dx >= dy ? [[a, b], [b, a]] : [[b, a], [a, b]])) {
      const z = zona(W, H);
      if (dx * k <= z.w - 4 && dy * k <= z.h - 4) {
        const sw = z.w / k, sh = z.h / k;
        const r = [cx - sw / 2, cy - sh / 2, cx + sw / 2, cy + sh / 2];
        return { k, format: nm, W, H, z, unica: true, planse: [{ nr: 1, r, lin: 0, col: 0 }], nx: 1, ny: 1 };
      }
    }
  }
  // mai multe planse A0: alegem orientarea cu mai putine planse
  let best = null;
  for (const [W, H] of [[1189, 841], [841, 1189]]) {
    const z = zona(W, H), sw = z.w / k, sh = z.h / k;
    const nx = Math.ceil(dx / sw), ny = Math.ceil(dy / sh);
    if (!best || nx * ny < best.nx * best.ny) best = { W, H, z, sw, sh, nx, ny };
  }
  const { W, H, z, sw, sh, nx, ny } = best;
  if (nx * ny > 20000) throw new Error(`Planul are ${Math.round(dx)} × ${Math.round(dy)} unități – prea mare pentru 1:1000 (unitățile desenului trebuie să fie metri).`);
  const gx0 = cx - nx * sw / 2, gy1 = cy + ny * sh / 2;
  const planse = [];
  for (let lin = 0; lin < ny; lin++) for (let col = 0; col < nx; col++) {
    const r = [gx0 + col * sw, gy1 - (lin + 1) * sh, gx0 + (col + 1) * sw, gy1 - lin * sh];
    if (!list || areContinut(list, r)) planse.push({ nr: planse.length + 1, r, lin, col });
  }
  if (planse.length > MAX_PLANSE) throw new Error(`Ar rezulta ${planse.length} planșe A0 (maxim ${MAX_PLANSE}). Ascundeți straturile îndepărtate sau verificați unitățile desenului (trebuie metri).`);
  return { k, format: 'A0', W, H, z, unica: false, planse, nx, ny, grila: [gx0, gy1 - ny * sh, gx0 + nx * sw, gy1] };
}

// ---------------------------------------------------------------------------
// Continutul unei pagini
// ---------------------------------------------------------------------------
const rgb = (c, stroke) => `${n2((c >> 16 & 255) / 255)} ${n2((c >> 8 & 255) / 255)} ${n2((c & 255) / 255)} ${stroke ? 'RG' : 'rg'}\n`;

function desen(out, list, r, P, k, opt) {
  const { wscale, wmin, texte, fonts, ltm } = opt;
  for (const g of list) {
    if (g.pass === 2 && !texte) continue;
    let deschis = false;
    const start = s => { if (!deschis) { out.push(s); deschis = true; } };
    if (g.pass === 0) {
      for (const it of g.items) {
        if (!inter(it.b, r)) continue;
        start(rgb(g.col, false));
        let s = '';
        for (const ring of it.rings) { ring.forEach((q, i) => { const [x, y] = P(q.x, q.y); s += `${n2(x)} ${n2(y)} ${i ? 'l' : 'm'}\n`; }); s += 'h\n'; }
        out.push(s);
      }
      if (deschis) out.push('f\n');
    } else if (g.pass === 1) {
      const w = Math.max(wmin, g.wpx * PX_MM * wscale);
      const dashed = [];
      let n = 0;
      for (const it of g.items) {
        if (!inter(it.b, r)) continue;
        if (it.pat) {
          const mm = it.pat.map(x => x * ltm * k);
          if (mm.reduce((s, x) => s + Math.abs(x), 0) >= 0.6) { dashed.push({ it, mm }); continue; }
        }
        start(rgb(g.col, true) + `${n2(w)} w [] 0 d 1 J 1 j\n`);
        let s = '';
        it.pts.forEach((q, i) => { const [x, y] = P(q.x, q.y); s += `${n2(x)} ${n2(y)} ${i ? 'l' : 'm'}\n`; });
        if (it.pts.length === 1) { const [x, y] = P(it.pts[0].x, it.pts[0].y); s += `${n2(x + 0.01)} ${n2(y)} l\n`; }
        if (it.closed && it.pts.length > 2) s += 'h\n';
        out.push(s);
        if (++n % 2000 === 0) out.push('S\n');
      }
      if (deschis) out.push('S\n');
      if (dashed.length) {
        out.push(rgb(g.col, true) + `${n2(w)} w 0 J 1 j\n`);
        for (const { it, mm } of dashed) {
          const d = normDash(mm);
          const arr = d.arr.map(x => (x === 0 ? Math.max(0.05, w * 0.9) : x));
          let s = `[${arr.map(n2).join(' ')}] ${n2(d.offset)} d\n`;
          it.pts.forEach((q, i) => { const [x, y] = P(q.x, q.y); s += `${n2(x)} ${n2(y)} ${i ? 'l' : 'm'}\n`; });
          if (it.closed && it.pts.length > 2) s += 'h\n';
          out.push(s + 'S\n');
        }
        out.push('[] 0 d 1 J\n');
      }
    } else {
      let n = 0;
      for (const it of g.items) {
        if (!inter(it.b, r)) continue;
        start(rgb(g.col, false));
        out.push(textOps(it.t, it.sc, fonts, k, P));
        if (++n % 200 === 0) out.push('f\n');
      }
      if (deschis) out.push('f\n');
    }
  }
}

// text simplu (cartus, etichete) in coordonate pagina (mm)
function txt(F, str, x, y, cap, ha = 0) {
  str = String(str);
  if (!str) return '';
  const size = cap / F.cap;
  const w = F.f.getAdvanceWidth(str, size);
  const ux = ha === 1 ? -w / 2 : ha === 2 ? -w : 0;
  return pathOps(F.f.getPath(str, 0, 0, size).commands, (gx, gy) => [x + ux + gx, y - gy]);
}
const latime = (F, str, cap) => F.f.getAdvanceWidth(String(str), cap / F.cap);

async function comprima(parts) {
  const st = new Blob(parts).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}

const fmtC = v => Math.round(v).toString();

// ---------------------------------------------------------------------------
// Generarea PDF-ului
// ---------------------------------------------------------------------------
export async function renderPlanse(M, S, onProgress) {
  if (typeof CompressionStream === 'undefined') throw new Error('Browserul nu suportă CompressionStream (actualizați iOS / Safari).');
  const fonts = await loadFonts();
  const list = pregateste(M, S);
  const plan = planificaPlanse(M, S, list);
  const { k, z, W, H } = plan;
  const ltm = S.ltScaleMul > 0 ? S.ltScaleMul : 1;
  const titlu = S._title || 'Plan';
  const data = new Date().toLocaleDateString('ro-RO');
  const F = fonts.sans, FV = fonts.verd;
  const N = plan.planse.length;
  const nrPag = plan.unica ? 1 : N + 1;
  const pagini = []; // { cont: Uint8Array, W, H, linkuri: [{rect:[x0,y0,x1,y1] mm, pag}] }
  const harta = new Map(plan.planse.map(p => [p.lin + ',' + p.col, p]));
  const pagPlansa = p => plan.unica ? 0 : p.nr; // indexul paginii (0 = ansamblu)
  const pas = 100; // grila de coordonate (m)

  // ---- plan de ansamblu
  if (!plan.unica) {
    const g = plan.grila;
    const gdx = g[2] - g[0], gdy = g[3] - g[1];
    let Wa = 1189, Ha = 841;
    if (gdy > gdx) [Wa, Ha] = [841, 1189];
    const za = zona(Wa, Ha);
    let sa = SCARI_ANS.find(s => gdx * 1000 / s <= za.w && gdy * 1000 / s <= za.h) || SCARI_ANS[SCARI_ANS.length - 1];
    const ka = 1000 / sa;
    const ox = za.x + (za.w - gdx * ka) / 2, oy = za.y + (za.h - gdy * ka) / 2;
    const P = (x, y) => [ox + (x - g[0]) * ka, oy + (y - g[1]) * ka];
    const out = [`${MM2PT.toFixed(6)} 0 0 ${MM2PT.toFixed(6)} 0 0 cm\n`];
    out.push(`q ${za.x} ${za.y} ${za.w} ${za.h} re W n\n`);
    desen(out, list, g, P, ka, { wscale: ka / k, wmin: 0.03, texte: false, fonts, ltm });
    out.push('Q\n');
    const linkuri = [];
    out.push('0.85 0.1 0.1 RG 0.5 w [] 0 d\n');
    for (const p of plan.planse) {
      const [x0, y0] = P(p.r[0], p.r[1]), [x1, y1] = P(p.r[2], p.r[3]);
      out.push(`${n2(x0)} ${n2(y0)} ${n2(x1 - x0)} ${n2(y1 - y0)} re S\n`);
      linkuri.push({ rect: [x0, y0, x1, y1], pag: p.nr });
    }
    out.push('0.85 0.1 0.1 rg\n');
    for (const p of plan.planse) {
      const [x0, y0] = P(p.r[0], p.r[1]), [x1, y1] = P(p.r[2], p.r[3]);
      const cap = Math.min(40, Math.max(2, Math.min(x1 - x0, y1 - y0) * 0.28));
      out.push(txt(F, p.nr, (x0 + x1) / 2, (y0 + y1) / 2 - cap / 2, cap, 1));
    }
    out.push('f\n0 0 0 RG 0.35 w\n');
    out.push(`${za.x} ${za.y} ${za.w} ${za.h} re S\n`);
    out.push('0 0 0 rg\n');
    out.push(txt(F, `PLAN DE ANSAMBLU – ${titlu}`, za.x, Ha - M_SUS + 3.5, 6));
    out.push(txt(F, `${N} planșe A0 la scara 1:1000 · ansamblu 1:${sa} · ${data}`, za.x, M_JOS - 10, 4.5));
    out.push(txt(F, 'Atingeți (clic) chenarul sau numărul unei planșe pentru a o deschide. Din fiecare planșă, „Plan de ansamblu” revine aici.', za.x, M_JOS - 18, 3.5));
    out.push('f\n');
    pagini.push({ cont: await comprima(out), W: Wa, H: Ha, linkuri });
    onProgress && onProgress(1, nrPag);
  }

  // ---- planse
  for (const p of plan.planse) {
    const r = p.r;
    const P = (x, y) => [z.x + (x - r[0]) * k, z.y + (y - r[1]) * k];
    const out = [`${MM2PT.toFixed(6)} 0 0 ${MM2PT.toFixed(6)} 0 0 cm\n`];
    out.push(`q ${z.x} ${z.y} ${z.w} ${z.h} re W n\n`);
    desen(out, list, r, P, k, { wscale: 1, wmin: 0.05, texte: true, fonts, ltm });
    // cruci de grila la 100 m
    let s = '0.55 0.55 0.55 RG 0.12 w [] 0 d\n';
    for (let x = Math.ceil(r[0] / pas) * pas; x <= r[2]; x += pas)
      for (let y = Math.ceil(r[1] / pas) * pas; y <= r[3]; y += pas) {
        const [u, v] = P(x, y);
        s += `${n2(u - 2)} ${n2(v)} m ${n2(u + 2)} ${n2(v)} l ${n2(u)} ${n2(v - 2)} m ${n2(u)} ${n2(v + 2)} l\n`;
      }
    out.push(s + 'S\nQ\n');
    // chenar + repere de coordonate
    s = `0 0 0 RG 0.4 w ${z.x} ${z.y} ${z.w} ${z.h} re S\n0.2 w\n`;
    let et = '';
    for (let x = Math.ceil(r[0] / pas) * pas; x <= r[2]; x += pas) {
      const u = z.x + (x - r[0]) * k;
      s += `${n2(u)} ${z.y} m ${n2(u)} ${z.y - 1.5} l ${n2(u)} ${z.y + z.h} m ${n2(u)} ${z.y + z.h + 1.5} l\n`;
      et += txt(F, fmtC(x), u, z.y + z.h + 2.5, 1.8, 1) + txt(F, fmtC(x), u, z.y - 4.3, 1.8, 1);
    }
    for (let y = Math.ceil(r[1] / pas) * pas; y <= r[3]; y += pas) {
      const v = z.y + (y - r[1]) * k;
      s += `${z.x} ${n2(v)} m ${z.x - 1.5} ${n2(v)} l ${z.x + z.w} ${n2(v)} m ${z.x + z.w + 1.5} ${n2(v)} l\n`;
      et += txt(F, fmtC(y), z.x - 2.5, v - 0.9, 1.8, 2);
    }
    out.push(s + 'S\n0 0 0 rg\n' + et + 'f\n');
    // cartus
    const linkuri = [];
    out.push('0 0 0 rg\n');
    out.push(txt(F, titlu, z.x, M_JOS - 11, 5));
    out.push(txt(F, `Planșa ${p.nr} din ${N} · scara 1:1000 · ${plan.format} · ${data}`, z.x, M_JOS - 19, 3.5));
    out.push('f\n');
    if (!plan.unica) {
      // butonul "Plan de ansamblu"
      const lab = '◄ Plan de ansamblu', cap = 4.5;
      const w = latime(FV, lab, cap) + 10, h = 11;
      const bx = z.x + z.w - w, by = M_JOS - 21;
      out.push(`0.12 0.43 0.92 rg ${n2(bx)} ${n2(by)} ${n2(w)} ${h} re f\n1 1 1 rg\n` + txt(FV, lab, bx + 5, by + (h - cap) / 2, cap) + 'f\n');
      linkuri.push({ rect: [bx, by, bx + w, by + h], pag: 0 });
      // vecini
      const vec = [[-1, 0, '▲'], [1, 0, '▼'], [0, -1, '◄'], [0, 1, '►']];
      out.push('0.12 0.43 0.92 rg\n');
      let lx = bx - 8;
      for (const [dl, dc, sg] of vec.reverse()) {
        const q = harta.get((p.lin + dl) + ',' + (p.col + dc));
        if (!q) continue;
        const lab2 = `${sg} ${q.nr}`, c2 = 4.5, w2 = latime(FV, lab2, c2);
        // pe marginea corespunzatoare
        let x, y;
        if (dl === -1) { x = z.x + z.w / 2 - w2 / 2; y = z.y + z.h + 6; }
        else if (dl === 1) { x = z.x + z.w / 2 - w2 / 2; y = z.y - 10.5; }
        else if (dc === -1) { x = 2.5; y = z.y + z.h / 2 - c2 / 2; }
        else { x = W - M_DR + 1; y = z.y + z.h / 2 - c2 / 2; }
        out.push(txt(FV, lab2, x, y, c2));
        linkuri.push({ rect: [x - 1.5, y - 1.5, x + w2 + 1.5, y + c2 + 1.5], pag: q.nr });
        // si in cartus
        const w3 = latime(FV, lab2, 3.5);
        lx -= w3;
        out.push(txt(FV, lab2, lx, by + 3.7, 3.5));
        linkuri.push({ rect: [lx - 1, by + 2, lx + w3 + 1, by + 9.5], pag: q.nr });
        lx -= 5;
      }
      out.push('f\n');
    }
    pagini.push({ cont: await comprima(out), W, H, linkuri });
    onProgress && onProgress(pagini.length, nrPag);
    await new Promise(r => setTimeout(r, 0));
  }

  // ---- asamblare PDF
  const enc = new TextEncoder();
  const hexT = t => '<FEFF' + [...String(t)].map(c => { const u = c.codePointAt(0); return u > 0xFFFF ? '003F' : u.toString(16).padStart(4, '0').toUpperCase(); }).join('') + '>';
  const NP = pagini.length;
  const pageObj = i => 5 + 2 * i, contObj = i => 6 + 2 * i;
  let next = 5 + 2 * NP;
  const annots = pagini.map(pg => pg.linkuri.map(l => ({ ...l, n: next++ })));
  const titluri = plan.unica ? [`Planșa 1 – ${titlu}`] : ['Plan de ansamblu', ...plan.planse.map(p => `Planșa ${p.nr}`)];
  const outl = titluri.map((t, i) => ({ t, i, n: next++ }));
  const total = next;
  const pieces = [];
  let off = 0;
  const offs = [];
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; pieces.push(b); off += b.length; };
  const obj = (n, body) => { offs[n] = off; push(`${n} 0 obj\n`); if (typeof body === 'function') body(); else push(body); push('\nendobj\n'); };
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, `<< /Type /Catalog /Pages 2 0 R /Outlines 3 0 R /PageMode /UseOutlines /OpenAction [${pageObj(0)} 0 R /Fit] >>`);
  obj(2, `<< /Type /Pages /Kids [${pagini.map((_, i) => pageObj(i) + ' 0 R').join(' ')}] /Count ${NP} >>`);
  obj(3, `<< /Type /Outlines /First ${outl[0].n} 0 R /Last ${outl[outl.length - 1].n} 0 R /Count ${outl.length} >>`);
  obj(4, `<< /Title ${hexT(titlu)} /Producer (DXF2PNG mobil) >>`);
  pagini.forEach((pg, i) => {
    const a = annots[i];
    obj(pageObj(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${(pg.W * MM2PT).toFixed(2)} ${(pg.H * MM2PT).toFixed(2)}] /Contents ${contObj(i)} 0 R /Resources << >>${a.length ? ` /Annots [${a.map(x => x.n + ' 0 R').join(' ')}]` : ''} >>`);
    obj(contObj(i), () => { push(`<< /Length ${pg.cont.length} /Filter /FlateDecode >>\nstream\n`); push(pg.cont); push('\nendstream'); });
  });
  annots.forEach(a => a.forEach(l => {
    const R = l.rect.map(v => (v * MM2PT).toFixed(2)).join(' ');
    obj(l.n, `<< /Type /Annot /Subtype /Link /Rect [${R}] /Border [0 0 0] /H /I /Dest [${pageObj(l.pag)} 0 R /Fit] >>`);
  }));
  outl.forEach((o, j) => {
    obj(o.n, `<< /Title ${hexT(o.t)} /Parent 3 0 R${j ? ` /Prev ${outl[j - 1].n} 0 R` : ''}${j < outl.length - 1 ? ` /Next ${outl[j + 1].n} 0 R` : ''} /Dest [${pageObj(o.i)} 0 R /Fit] >>`);
  });
  const xref = off;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  x += `trailer\n<< /Size ${total} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  push(x);
  return { blob: new Blob(pieces, { type: 'application/pdf' }), plan };
}
