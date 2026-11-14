// DXF2PNG mobil - model: citire DXF (text), conversie DWG (LibreDWG) si
// construirea geometriei desenabile (polilinii, suprafete, texte).
// Unghiurile din modelul normalizat sunt in RADIANI.

export const ACI = [
  0x000000,0xFF0000,0xFFFF00,0x00FF00,0x00FFFF,0x0000FF,0xFF00FF,0xFFFFFF,0x414141,0x808080,0xFF0000,0xFFAAAA,0xBD0000,0xBD7E7E,0x810000,0x815656,
  0x680000,0x684545,0x4F0000,0x4F3535,0xFF3F00,0xFFBFAA,0xBD2E00,0xBD8D7E,0x811F00,0x816056,0x681900,0x684E45,0x4F1300,0x4F3B35,0xFF7F00,0xFFD4AA,
  0xBD5E00,0xBD9D7E,0x814000,0x816B56,0x683400,0x685645,0x4F2700,0x4F4235,0xFFBF00,0xFFEAAA,0xBD8D00,0xBDAD7E,0x816000,0x817656,0x684E00,0x685F45,
  0x4F3B00,0x4F4935,0xFFFF00,0xFFFFAA,0xBDBD00,0xBDBD7E,0x818100,0x818156,0x686800,0x686845,0x4F4F00,0x4F4F35,0xBFFF00,0xEAFFAA,0x8DBD00,0xADBD7E,
  0x608100,0x768156,0x4E6800,0x5F6845,0x3B4F00,0x494F35,0x7FFF00,0xD4FFAA,0x5EBD00,0x9DBD7E,0x408100,0x6B8156,0x346800,0x566845,0x274F00,0x424F35,
  0x3FFF00,0xBFFFAA,0x2EBD00,0x8DBD7E,0x1F8100,0x608156,0x196800,0x4E6845,0x134F00,0x3B4F35,0x00FF00,0xAAFFAA,0x00BD00,0x7EBD7E,0x008100,0x568156,
  0x006800,0x456845,0x004F00,0x354F35,0x00FF3F,0xAAFFBF,0x00BD2E,0x7EBD8D,0x00811F,0x568160,0x006819,0x45684E,0x004F13,0x354F3B,0x00FF7F,0xAAFFD4,
  0x00BD5E,0x7EBD9D,0x008140,0x56816B,0x006834,0x456856,0x004F27,0x354F42,0x00FFBF,0xAAFFEA,0x00BD8D,0x7EBDAD,0x008160,0x568176,0x00684E,0x45685F,
  0x004F3B,0x354F49,0x00FFFF,0xAAFFFF,0x00BDBD,0x7EBDBD,0x008181,0x568181,0x006868,0x456868,0x004F4F,0x354F4F,0x00BFFF,0xAAEAFF,0x008DBD,0x7EADBD,
  0x006081,0x567681,0x004E68,0x455F68,0x003B4F,0x35494F,0x007FFF,0xAAD4FF,0x005EBD,0x7E9DBD,0x004081,0x566B81,0x003468,0x455668,0x00274F,0x35424F,
  0x003FFF,0xAABFFF,0x002EBD,0x7E8DBD,0x001F81,0x566081,0x001968,0x454E68,0x00134F,0x353B4F,0x0000FF,0xAAAAFF,0x0000BD,0x7E7EBD,0x000081,0x565681,
  0x000068,0x454568,0x00004F,0x35354F,0x3F00FF,0xBFAAFF,0x2E00BD,0x8D7EBD,0x1F0081,0x605681,0x190068,0x4E4568,0x13004F,0x3B354F,0x7F00FF,0xD4AAFF,
  0x5E00BD,0x9D7EBD,0x400081,0x6B5681,0x340068,0x564568,0x27004F,0x42354F,0xBF00FF,0xEAAAFF,0x8D00BD,0xAD7EBD,0x600081,0x765681,0x4E0068,0x5F4568,
  0x3B004F,0x49354F,0xFF00FF,0xFFAAFF,0xBD00BD,0xBD7EBD,0x810081,0x815681,0x680068,0x684568,0x4F004F,0x4F354F,0xFF00BF,0xFFAAEA,0xBD008D,0xBD7EAD,
  0x810060,0x815676,0x68004E,0x68455F,0x4F003B,0x4F3549,0xFF007F,0xFFAAD4,0xBD005E,0xBD7E9D,0x810040,0x81566B,0x680034,0x684556,0x4F0027,0x4F3542,
  0xFF003F,0xFFAABF,0xBD002E,0xBD7E8D,0x81001F,0x815660,0x680019,0x68454E,0x4F0013,0x4F353B,0x333333,0x505050,0x696969,0x828282,0xBEBEBE,0xFFFFFF,
];
export const aci = c => (c >= 1 && c <= 255 ? ACI[c] : 0xFFFFFF);
export const BYLAYER = 0x1000000;

// ---------------------------------------------------------------------------
// Utilitare text
// ---------------------------------------------------------------------------

function unescapeU(s) {
  if (s.indexOf('\\U+') < 0 && s.indexOf('\\u+') < 0) return s;
  return s.replace(/\\[Uu]\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function cleanTextCodes(s) {
  return s.replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±')
    .replace(/%%[uUoO]/g, '').replace(/%%%/g, '%');
}

export function mtextPlain(s) {
  let b = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '}') continue;
    if (c !== '\\') { b += c; continue; }
    const n = s[i + 1];
    if (n === undefined) continue;
    if (n === 'P' || n === 'n') { b += '\n'; i++; }
    else if (n === '~') { b += ' '; i++; }
    else if (n === '\\' || n === '{' || n === '}') { b += n; i++; }
    else if ('LlOoKkN'.includes(n)) { i++; }
    else if (n === 'S') {
      let j = i + 2, f = '';
      while (j < s.length && s[j] !== ';') { f += (s[j] === '^' || s[j] === '#') ? '/' : s[j]; j++; }
      b += f; i = j;
    } else {
      let j = i + 2;
      while (j < s.length && s[j] !== ';') j++;
      i = j;
    }
  }
  const lines = cleanTextCodes(b).split('\n').map(l => l.replace(/ +$/, ''));
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines;
}

// ---------------------------------------------------------------------------
// Citire DXF ASCII -> model normalizat
// ---------------------------------------------------------------------------

const CODEPAGES = { ANSI_1250: 'windows-1250', ANSI_1251: 'windows-1251', ANSI_1252: 'windows-1252', ANSI_1253: 'windows-1253',
  ANSI_1254: 'windows-1254', ANSI_1255: 'windows-1255', ANSI_1256: 'windows-1256', ANSI_1257: 'windows-1257', ANSI_874: 'windows-874',
  ANSI_932: 'shift_jis', ANSI_936: 'gbk', ANSI_949: 'euc-kr', ANSI_950: 'big5' };

function decodeDXF(buf) {
  const u8 = new Uint8Array(buf);
  if (u8.length > 18 && String.fromCharCode(...u8.subarray(0, 18)) === 'AutoCAD Binary DXF') {
    throw new Error('DXF binar nu este suportat - salvați fișierul ca DXF ASCII sau DWG.');
  }
  const head = new TextDecoder('latin1').decode(u8.subarray(0, Math.min(u8.length, 200000)));
  const ver = (head.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(\S+)/) || [])[1] || '';
  const cp = ((head.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*(\S+)/) || [])[1] || '').toUpperCase();
  let enc = 'windows-1250';
  if (ver >= 'AC1021') enc = 'utf-8';
  else if (CODEPAGES[cp]) enc = CODEPAGES[cp];
  let txt;
  try { txt = new TextDecoder(enc).decode(u8); } catch (e) { txt = new TextDecoder('windows-1252').decode(u8); }
  return { txt, ver, cp };
}

function readTags(txt) {
  const lines = txt.split(/\r?\n/);
  const codes = new Int32Array(Math.floor(lines.length / 2) + 1);
  const vals = new Array(codes.length);
  let n = 0;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const cs = lines[i].trim();
    if (cs === '') { i--; continue; }
    const c = parseInt(cs, 10);
    if (Number.isNaN(c)) throw new Error('DXF invalid (cod de grup "' + cs.slice(0, 20) + '" la linia ' + (i + 1) + ')');
    codes[n] = c; vals[n] = lines[i + 1]; n++;
  }
  return { codes, vals, n };
}

// grupeaza in entitati: [{t, g: [[code, val], ...], sub: []}]
function groupEnts(T, a, b) {
  const out = [];
  let parent = null;
  let i = a;
  while (i < b) {
    if (T.codes[i] !== 0) { i++; continue; }
    const t = T.vals[i].trim().toUpperCase();
    let j = i + 1;
    const g = [];
    while (j < b && T.codes[j] !== 0) { g.push([T.codes[j], T.vals[j]]); j++; }
    i = j;
    const e = { t, g, sub: [] };
    if (t === 'VERTEX' || t === 'ATTRIB') { if (parent) { parent.sub.push(e); continue; } }
    if (t === 'SEQEND') { parent = null; continue; }
    parent = null;
    if (t === 'POLYLINE') parent = e;
    else if (t === 'INSERT' && e.g.some(([c, v]) => c === 66 && parseInt(v) === 1)) parent = e;
    out.push(e);
  }
  return out;
}

const F = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
const I = v => { const x = parseInt(v, 10); return Number.isFinite(x) ? x : Math.trunc(F(v)); };
const D2R = Math.PI / 180;

function dxfCommon(g) {
  const c = { layer: '0', color: 256, tc: -1, lt: '', lts: 1, inv: false, paper: false };
  for (const [k, v] of g) {
    switch (k) {
      case 8: c.layer = v.trim(); break;
      case 62: c.color = I(v); break;
      case 420: c.tc = I(v) & 0xFFFFFF; break;
      case 6: c.lt = v.trim(); break;
      case 48: if (F(v) > 0) c.lts = F(v); break;
      case 60: c.inv = I(v) === 1; break;
      case 67: c.paper = I(v) === 1; break;
    }
  }
  return c;
}

function dxfText(e, isAttrib) {
  const n = { t: 'TEXT', text: '', ins: { x: 0, y: 0 }, al: { x: 0, y: 0 }, hasAl: false, h: 1, rot: 0, wf: -1, style: 'STANDARD', ha: 0, va: 0, hidden: false };
  for (const [k, v] of e.g) {
    switch (k) {
      case 1: n.text = v; break;
      case 10: n.ins.x = F(v); break;
      case 20: n.ins.y = F(v); break;
      case 11: n.al.x = F(v); n.hasAl = true; break;
      case 21: n.al.y = F(v); break;
      case 40: n.h = F(v); break;
      case 41: n.wf = F(v); break;
      case 50: n.rot = F(v) * D2R; break;
      case 7: n.style = v.trim(); break;
      case 72: n.ha = I(v); break;
      case 73: if (!isAttrib) n.va = I(v); break;
      case 74: if (isAttrib) n.va = I(v); break;
      case 70: if (isAttrib && (I(v) & 1)) n.hidden = true; break;
    }
  }
  return Object.assign(n, dxfCommon(e.g));
}

function dxfHatchRings(g) {
  const rings = [];
  let i = 0;
  while (i < g.length && g[i][0] !== 91) i++;
  if (i >= g.length) return rings;
  const nb = I(g[i][1]); i++;
  for (let b = 0; b < nb && i < g.length; b++) {
    while (i < g.length && g[i][0] !== 92) i++;
    if (i >= g.length) break;
    const bt = I(g[i][1]); i++;
    let ring = [];
    if (bt & 2) {
      let hasB = false, nv = 0;
      while (i < g.length && g[i][0] !== 93) { if (g[i][0] === 72) hasB = I(g[i][1]) !== 0; i++; }
      if (i < g.length) { nv = I(g[i][1]); i++; }
      const pts = [];
      while (pts.length < nv && i < g.length) {
        const [k, v] = g[i];
        if (k === 10) pts.push({ x: F(v), y: 0, b: 0 });
        else if (k === 20 && pts.length) pts[pts.length - 1].y = F(v);
        else if (k === 42 && hasB && pts.length) pts[pts.length - 1].b = F(v);
        else if (k !== 10 && k !== 20 && k !== 42) break;
        i++;
        if (pts.length === nv) {
          while (i < g.length && (g[i][0] === 20 || g[i][0] === 42)) {
            if (g[i][0] === 20) pts[pts.length - 1].y = F(g[i][1]);
            else if (hasB) pts[pts.length - 1].b = F(g[i][1]);
            i++;
          }
        }
      }
      ring = flattenBulges(pts, true, 0);
    } else {
      let ne = 0;
      if (i < g.length && g[i][0] === 93) { ne = I(g[i][1]); i++; }
      for (let k = 0; k < ne && i < g.length; k++) {
        while (i < g.length && g[i][0] !== 72) i++;
        if (i >= g.length) break;
        const et = I(g[i][1]); i++;
        const vals = {};
        while (i < g.length && ![72, 92, 97, 75].includes(g[i][0])) {
          if (!(g[i][0] in vals)) vals[g[i][0]] = F(g[i][1]);
          i++;
        }
        if (et === 1) ring.push({ x: vals[10] || 0, y: vals[20] || 0 }, { x: vals[11] || 0, y: vals[21] || 0 });
        else if (et === 2) arcPoints(ring, { x: vals[10] || 0, y: vals[20] || 0 }, vals[40] || 0, (vals[50] || 0) * D2R, (vals[51] || 0) * D2R, (vals[73] || 0) !== 0);
        else if (10 in vals) ring.push({ x: vals[10], y: vals[20] || 0 });
      }
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

function arcPoints(ring, c, r, a0, a1, ccw) {
  let sw = a1 - a0;
  while (sw <= 0) sw += 2 * Math.PI;
  const n = Math.max(8, Math.ceil(sw / (5 * D2R)));
  for (let s = 0; s <= n; s++) {
    let a = a0 + sw * s / n;
    if (!ccw) a = -a;
    ring.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
}

function dxfEntity(e) {
  const c = dxfCommon(e.g);
  if (c.paper) return null;
  const g = e.g;
  const get = (code, def = 0) => { for (const [k, v] of g) if (k === code) return F(v); return def; };
  switch (e.t) {
    case 'LINE': return { ...c, t: 'LINE', p1: { x: get(10), y: get(20) }, p2: { x: get(11), y: get(21) } };
    case 'LWPOLYLINE': {
      const pts = []; let closed = false;
      for (const [k, v] of g) {
        if (k === 70) closed = (I(v) & 1) !== 0;
        else if (k === 10) pts.push({ x: F(v), y: 0, b: 0 });
        else if (k === 20 && pts.length) pts[pts.length - 1].y = F(v);
        else if (k === 42 && pts.length) pts[pts.length - 1].b = F(v);
      }
      return { ...c, t: 'PLINE', pts, closed };
    }
    case 'POLYLINE': {
      const fl = I(g.find(([k]) => k === 70)?.[1] ?? 0);
      if (fl & (16 | 64)) return { ...c, t: 'SKIP', what: 'POLYLINE mesh/polyface' };
      const pts = [];
      for (const v of e.sub) {
        if (v.t !== 'VERTEX') continue;
        const p = { x: 0, y: 0, b: 0 }; let vf = 0;
        for (const [k, val] of v.g) {
          if (k === 10) p.x = F(val); else if (k === 20) p.y = F(val); else if (k === 42) p.b = F(val); else if (k === 70) vf = I(val);
        }
        if (vf & 16) continue;
        pts.push(p);
      }
      return { ...c, t: 'PLINE', pts, closed: (fl & 1) !== 0 };
    }
    case 'CIRCLE': return { ...c, t: 'CIRCLE', c: { x: get(10), y: get(20) }, r: get(40) };
    case 'ARC': return { ...c, t: 'ARC', c: { x: get(10), y: get(20) }, r: get(40), a0: get(50) * D2R, a1: get(51, 360) * D2R };
    case 'ELLIPSE': return { ...c, t: 'ELLIPSE', c: { x: get(10), y: get(20) }, maj: { x: get(11), y: get(21) }, ratio: get(40, 1), p0: get(41, 0), p1: get(42, 2 * Math.PI) };
    case 'SPLINE': {
      const s = { ...c, t: 'SPLINE', deg: 3, knots: [], weights: [], ctrl: [], fit: [], closed: false };
      for (const [k, v] of g) {
        switch (k) {
          case 70: s.closed = (I(v) & 1) !== 0; break;
          case 71: s.deg = I(v); break;
          case 40: s.knots.push(F(v)); break;
          case 41: s.weights.push(F(v)); break;
          case 10: s.ctrl.push({ x: F(v), y: 0 }); break;
          case 20: if (s.ctrl.length) s.ctrl[s.ctrl.length - 1].y = F(v); break;
          case 11: s.fit.push({ x: F(v), y: 0 }); break;
          case 21: if (s.fit.length) s.fit[s.fit.length - 1].y = F(v); break;
        }
      }
      return s;
    }
    case 'SOLID': case 'TRACE':
      return { ...c, t: 'SOLID', pts: [{ x: get(10), y: get(20) }, { x: get(11), y: get(21) }, { x: get(12), y: get(22) }, { x: get(13), y: get(23) }] };
    case 'HATCH': {
      let solid = false;
      for (const [k, v] of g) if (k === 70) { solid = I(v) === 1; break; }
      if (!solid) return { ...c, t: 'SKIP', what: 'HATCH cu model' };
      return { ...c, t: 'FILL', rings: dxfHatchRings(g) };
    }
    case 'TEXT': return dxfText(e, false);
    case 'ATTRIB': return dxfText(e, true);
    case 'MTEXT': {
      const m = { ...c, t: 'MTEXT', text: '', ins: { x: 0, y: 0 }, h: 1, rot: 0, width: 0, spacing: 1, att: 1, style: 'STANDARD' };
      let parts = '', last = '', dir = null;
      for (const [k, v] of g) {
        switch (k) {
          case 3: parts += v; break;
          case 1: last = v; break;
          case 10: m.ins.x = F(v); break;
          case 20: m.ins.y = F(v); break;
          case 11: dir = dir || { x: 0, y: 0 }; dir.x = F(v); break;
          case 21: dir = dir || { x: 0, y: 0 }; dir.y = F(v); break;
          case 40: m.h = F(v); break;
          case 41: m.width = F(v); break;
          case 44: m.spacing = F(v); break;
          case 50: m.rot = F(v) * D2R; break;
          case 71: m.att = I(v); break;
          case 7: m.style = v.trim(); break;
        }
      }
      if (dir && (dir.x || dir.y)) m.rot = Math.atan2(dir.y, dir.x);
      m.text = parts + last;
      return m;
    }
    case 'INSERT': {
      const n = { ...c, t: 'INSERT', name: '', ins: { x: 0, y: 0 }, sx: 1, sy: 1, rot: 0, cols: 1, rows: 1, cs: 0, rs: 0, attribs: [] };
      for (const [k, v] of g) {
        switch (k) {
          case 2: n.name = v.trim(); break;
          case 10: n.ins.x = F(v); break;
          case 20: n.ins.y = F(v); break;
          case 41: n.sx = F(v); break;
          case 42: n.sy = F(v); break;
          case 50: n.rot = F(v) * D2R; break;
          case 70: n.cols = I(v); break;
          case 71: n.rows = I(v); break;
          case 44: n.cs = F(v); break;
          case 45: n.rs = F(v); break;
        }
      }
      for (const a of e.sub) if (a.t === 'ATTRIB') n.attribs.push(dxfText(a, true));
      return n;
    }
    case 'DIMENSION': {
      const name = (g.find(([k]) => k === 2) || [0, ''])[1].trim();
      return name ? { ...c, t: 'INSERT', name, ins: { x: 0, y: 0 }, sx: 1, sy: 1, rot: 0, cols: 1, rows: 1, cs: 0, rs: 0, attribs: [], baseless: true } : null;
    }
    case 'ATTDEF': case 'VIEWPORT': case 'POINT': return null;
    default: return { ...c, t: 'SKIP', what: e.t };
  }
}

export function parseDXF(buf) {
  const { txt, ver, cp } = decodeDXF(buf);
  const T = readTags(txt);
  const N = { version: ver, codepage: cp, ltscale: 1, layers: [], ltypes: {}, styles: {}, blocks: {}, ents: [], source: 'DXF' };
  let i = 0;
  while (i < T.n) {
    if (T.codes[i] === 0 && T.vals[i].trim() === 'SECTION' && i + 1 < T.n && T.codes[i + 1] === 2) {
      const name = T.vals[i + 1].trim().toUpperCase();
      let j = i + 2;
      while (j < T.n && !(T.codes[j] === 0 && T.vals[j].trim() === 'ENDSEC')) j++;
      if (name === 'HEADER') {
        let cur = '';
        for (let k = i + 2; k < j; k++) {
          if (T.codes[k] === 9) { cur = T.vals[k].trim(); continue; }
          if (cur === '$LTSCALE' && T.codes[k] === 40 && F(T.vals[k]) > 0) N.ltscale = F(T.vals[k]);
        }
      } else if (name === 'TABLES') {
        for (const e of groupEnts(T, i + 2, j)) {
          if (e.t === 'LAYER') {
            const L = { name: '', aci: 7, rgb: -1, on: true, frozen: false, ltype: 'CONTINUOUS', lw: -3 };
            for (const [k, v] of e.g) {
              if (k === 2) L.name = v.trim();
              else if (k === 62) { let c = I(v); if (c < 0) { L.on = false; c = -c; } L.aci = c; }
              else if (k === 420) L.rgb = I(v) & 0xFFFFFF;
              else if (k === 70) L.frozen = (I(v) & 1) !== 0;
              else if (k === 6) L.ltype = v.trim();
              else if (k === 370) L.lw = I(v);
            }
            if (L.name) N.layers.push(L);
          } else if (e.t === 'LTYPE') {
            let name = ''; const pat = [];
            for (const [k, v] of e.g) { if (k === 2) name = v.trim(); else if (k === 49) pat.push(F(v)); }
            if (name) N.ltypes[name.toUpperCase()] = pat;
          } else if (e.t === 'STYLE') {
            const s = { name: '', font: '', width: 1 };
            for (const [k, v] of e.g) { if (k === 2) s.name = v.trim(); else if (k === 3) s.font = v.trim(); else if (k === 41 && F(v) > 0) s.width = F(v); }
            if (s.name) N.styles[s.name.toUpperCase()] = s;
          }
        }
      } else if (name === 'BLOCKS') {
        let cur = null;
        for (const e of groupEnts(T, i + 2, j)) {
          if (e.t === 'BLOCK') {
            cur = { name: '', base: { x: 0, y: 0 }, ents: [] };
            for (const [k, v] of e.g) { if (k === 2) cur.name = v.trim(); else if (k === 10) cur.base.x = F(v); else if (k === 20) cur.base.y = F(v); }
          } else if (e.t === 'ENDBLK') {
            if (cur && cur.name) N.blocks[cur.name.toUpperCase()] = cur;
            cur = null;
          } else if (cur) {
            const n = dxfEntity(e);
            if (n) cur.ents.push(n);
          }
        }
      } else if (name === 'ENTITIES') {
        for (const e of groupEnts(T, i + 2, j)) {
          const n = dxfEntity(e);
          if (n) N.ents.push(n);
        }
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  // decodare \U+XXXX
  const fix = n => { if (n.text) n.text = unescapeU(n.text); if (n.attribs) n.attribs.forEach(fix); };
  N.ents.forEach(fix);
  Object.values(N.blocks).forEach(b => b.ents.forEach(fix));
  return N;
}

// ---------------------------------------------------------------------------
// DWG (baza de date LibreDWG) -> model normalizat
// ---------------------------------------------------------------------------

function dwgCommon(e) {
  return {
    layer: e.layer || '0',
    color: e.color !== undefined && e.color !== null ? 257 : (e.colorIndex ?? 256),
    tc: e.color !== undefined && e.color !== null ? (e.color & 0xFFFFFF) : -1,
    lt: e.lineType || '',
    lts: e.lineTypeScale > 0 ? e.lineTypeScale : 1,
    inv: e.isVisible === false,
  };
}

function dwgText(e, attrib) {
  const t = attrib ? (e.text || {}) : e;
  const str = attrib ? (t.text ?? '') : (e.text ?? '');
  const n = {
    ...dwgCommon(e), t: 'TEXT', text: String(str), ins: { x: t.startPoint?.x || 0, y: t.startPoint?.y || 0 },
    al: { x: t.endPoint?.x || 0, y: t.endPoint?.y || 0 }, hasAl: true, h: t.textHeight || 1, rot: t.rotation || 0,
    wf: t.xScale > 0 ? t.xScale : -1, style: t.styleName || e.styleName || 'STANDARD', ha: t.halign || 0, va: t.valign || 0,
    hidden: attrib ? ((e.flags || 0) & 1) !== 0 : false,
  };
  return n;
}

function dwgEntity(e, warn) {
  const c = dwgCommon(e);
  const P = p => ({ x: p?.x || 0, y: p?.y || 0 });
  switch (e.type) {
    case 'LINE': return { ...c, t: 'LINE', p1: P(e.startPoint), p2: P(e.endPoint) };
    case 'LWPOLYLINE':
      return { ...c, t: 'PLINE', pts: (e.vertices || []).map(v => ({ x: v.x, y: v.y, b: v.bulge || 0 })), closed: ((e.flag || 0) & 512) !== 0 };
    case 'POLYLINE2D': case 'POLYLINE3D': case 'POLYLINE':
      if ((e.flag || 0) & (16 | 64)) { warn('POLYLINE mesh/polyface'); return null; }
      return { ...c, t: 'PLINE', pts: (e.vertices || []).filter(v => !((v.flag || 0) & 16)).map(v => ({ x: v.x, y: v.y, b: v.bulge || 0 })), closed: ((e.flag || 0) & 1) !== 0 };
    case 'CIRCLE': return { ...c, t: 'CIRCLE', c: P(e.center), r: e.radius || 0 };
    case 'ARC': return { ...c, t: 'ARC', c: P(e.center), r: e.radius || 0, a0: e.startAngle || 0, a1: e.endAngle ?? 2 * Math.PI };
    case 'ELLIPSE': return { ...c, t: 'ELLIPSE', c: P(e.center), maj: P(e.majorAxisEndPoint), ratio: e.axisRatio || 1, p0: e.startAngle || 0, p1: e.endAngle ?? 2 * Math.PI };
    case 'SPLINE':
      return { ...c, t: 'SPLINE', deg: e.degree || 3, knots: e.knots || [], weights: e.weights || [], ctrl: (e.controlPoints || []).map(P), fit: (e.fitPoints || []).map(P), closed: ((e.flag || 0) & 1) !== 0 };
    case 'SOLID': case 'TRACE':
      return { ...c, t: 'SOLID', pts: [P(e.corner1), P(e.corner2), P(e.corner3), P(e.corner4 || e.corner3)] };
    case 'HATCH': {
      if (!e.solidFill) { warn('HATCH cu model'); return null; }
      const rings = [];
      for (const bp of e.boundaryPaths || []) {
        let ring = [];
        if ((bp.boundaryPathTypeFlag || 0) & 2) {
          ring = flattenBulges((bp.vertices || []).map(v => ({ x: v.x, y: v.y, b: v.bulge || 0 })), true, 0);
        } else {
          for (const ed of bp.edges || []) {
            if (ed.type === 1) ring.push(P(ed.start), P(ed.end));
            else if (ed.type === 2) arcPoints(ring, P(ed.center), ed.radius || 0, ed.startAngle || 0, ed.endAngle || 0, !!ed.isCCW);
            else if (ed.center) ring.push(P(ed.center));
          }
        }
        if (ring.length >= 3) rings.push(ring);
      }
      return { ...c, t: 'FILL', rings };
    }
    case 'TEXT': return dwgText(e, false);
    case 'MTEXT': {
      let rot = e.rotation || 0;
      if (e.direction && (e.direction.x || e.direction.y)) rot = Math.atan2(e.direction.y, e.direction.x);
      return { ...c, t: 'MTEXT', text: String(e.text ?? ''), ins: P(e.insertionPoint), h: e.textHeight || 1, rot, width: e.rectWidth || 0,
        spacing: e.lineSpacing > 0 ? e.lineSpacing : 1, att: e.attachmentPoint || 1, style: e.styleName || 'STANDARD' };
    }
    case 'INSERT':
      return { ...c, t: 'INSERT', name: e.name || '', ins: P(e.insertionPoint), sx: e.xScale ?? 1, sy: e.yScale ?? 1, rot: e.rotation || 0,
        cols: e.columnCount || 1, rows: e.rowCount || 1, cs: e.columnSpacing || 0, rs: e.rowSpacing || 0,
        attribs: (e.attribs || []).map(a => dwgText(a, true)) };
    case 'DIMENSION':
      return e.name ? { ...c, t: 'INSERT', name: e.name, ins: { x: 0, y: 0 }, sx: 1, sy: 1, rot: 0, cols: 1, rows: 1, cs: 0, rs: 0, attribs: [], baseless: true } : null;
    case 'ATTDEF': case 'VIEWPORT': case 'POINT': case 'ATTRIB': return null;
    default: warn(e.type); return null;
  }
}

export function fromDwgDatabase(db) {
  const N = { version: '', codepage: '', ltscale: db.header?.LTSCALE > 0 ? db.header.LTSCALE : 1, layers: [], ltypes: {}, styles: {}, blocks: {}, ents: [], source: 'DWG', warn: {} };
  const warn = w => { N.warn[w] = (N.warn[w] || 0) + 1; };
  for (const L of db.tables?.LAYER?.entries || []) {
    let aciC = L.colorIndex >= 1 && L.colorIndex <= 255 ? L.colorIndex : 7;
    let rgb = -1;
    if (!(L.colorIndex >= 1 && L.colorIndex <= 255) && L.color !== undefined && L.color !== 0xFFFFFF) rgb = L.color & 0xFFFFFF;
    N.layers.push({ name: L.name, aci: aciC, rgb, on: !L.off, frozen: !!L.frozen, ltype: L.lineType || 'CONTINUOUS', lw: L.lineweight ?? -3 });
  }
  for (const lt of db.tables?.LTYPE?.entries || []) {
    N.ltypes[(lt.name || '').toUpperCase()] = (lt.pattern || []).map(p => p.elementLength || 0);
  }
  for (const s of db.tables?.STYLE?.entries || []) {
    N.styles[(s.name || '').toUpperCase()] = { name: s.name, font: s.font || '', width: s.widthFactor > 0 ? s.widthFactor : 1 };
  }
  let msHandle = null;
  for (const b of db.tables?.BLOCK_RECORD?.entries || []) {
    const nm = (b.name || '').toUpperCase();
    if (nm === '*MODEL_SPACE') { msHandle = b.handle; continue; }
    if (nm.startsWith('*PAPER_SPACE')) continue;
    const ents = [];
    for (const e of b.entities || []) { const n = dwgEntity(e, warn); if (n) ents.push(n); }
    N.blocks[nm] = { name: b.name, base: { x: b.basePoint?.x || 0, y: b.basePoint?.y || 0 }, ents };
  }
  for (const e of db.entities || []) {
    if (msHandle && e.ownerBlockRecordSoftId && e.ownerBlockRecordSoftId !== msHandle) continue;
    const n = dwgEntity(e, warn);
    if (n) N.ents.push(n);
  }
  return N;
}

// ---------------------------------------------------------------------------
// Geometrie: polilinii cu bulge, spline
// ---------------------------------------------------------------------------

// pts: [{x,y,b}] ; tol = toleranta (unitati desen), 0 = pas fix 5 grade
export function flattenBulges(pts, closed, tol) {
  const n = pts.length;
  if (!n) return [];
  if (!pts.some(p => p.b)) return pts.map(p => ({ x: p.x, y: p.y }));
  const out = [{ x: pts[0].x, y: pts[0].y }];
  const segs = closed ? n : n - 1;
  for (let k = 0; k < segs; k++) {
    const a = pts[k], c = pts[(k + 1) % n], bg = a.b || 0;
    if (!bg) { out.push({ x: c.x, y: c.y }); continue; }
    const dx = c.x - a.x, dy = c.y - a.y, L = Math.hypot(dx, dy);
    if (!L) continue;
    const th = 4 * Math.atan(bg);
    const r = L * (1 + bg * bg) / (4 * Math.abs(bg));
    const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
    const nx = -dy / L, ny = dx / L;
    const d = L * (1 - bg * bg) / (4 * bg);
    const cx = mx + nx * d, cy = my + ny * d;
    const a0 = Math.atan2(a.y - cy, a.x - cx);
    let steps;
    if (tol > 0 && r > tol) steps = Math.ceil(Math.abs(th) / Math.max(2 * Math.acos(Math.max(-1, 1 - tol / r)), 1e-4));
    else steps = Math.ceil(Math.abs(th) / (5 * D2R));
    steps = Math.min(2000, Math.max(2, steps));
    for (let s = 1; s <= steps; s++) {
      const an = a0 + th * s / steps;
      out.push({ x: cx + r * Math.cos(an), y: cy + r * Math.sin(an) });
    }
  }
  if (closed && out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.abs(f.x - l.x) < 1e-9 && Math.abs(f.y - l.y) < 1e-9) out.pop();
  }
  return out;
}

function splinePoints(s) {
  const deg = s.deg || 3, ctrl = s.ctrl, knots = s.knots, n = ctrl.length;
  if (n < 2 || knots.length !== n + deg + 1) return s.fit.length >= 2 ? s.fit : ctrl;
  const w = s.weights.length === n ? s.weights : new Array(n).fill(1);
  const u0 = knots[deg], u1 = knots[n];
  const steps = Math.min(4000, n * 16);
  const out = [];
  for (let st = 0; st <= steps; st++) {
    let u = u0 + (u1 - u0) * st / steps;
    if (st === steps) u = u1 - 1e-12 * (u1 - u0);
    let k = deg;
    while (k < n - 1 && u >= knots[k + 1]) k++;
    const d = [];
    for (let j = 0; j <= deg; j++) { const idx = k - deg + j; d.push([ctrl[idx].x * w[idx], ctrl[idx].y * w[idx], w[idx]]); }
    for (let r = 1; r <= deg; r++) {
      for (let j = deg; j >= r; j--) {
        const i = k - deg + j, den = knots[i + deg - r + 1] - knots[i];
        const a = den ? (u - knots[i]) / den : 0;
        d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1], (1 - a) * d[j - 1][2] + a * d[j][2]];
      }
    }
    const p = d[deg];
    if (p[2]) out.push({ x: p[0] / p[2], y: p[1] / p[2] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Construirea modelului desenabil
// ---------------------------------------------------------------------------

export function buildModel(N) {
  const M = { layers: [], layerIdx: new Map(), prims: [], texts: [], warnings: { ...(N.warn || {}) }, source: N.source };
  const addLayer = L => {
    const key = L.name.toUpperCase();
    if (M.layerIdx.has(key)) return M.layerIdx.get(key);
    const color = L.rgb >= 0 ? L.rgb : aci(L.aci);
    const idx = M.layers.length;
    M.layers.push({ name: L.name, color, aci: L.aci, on: L.on !== false, frozen: !!L.frozen, ltype: L.ltype || 'CONTINUOUS', lw: L.lw ?? -3, nLines: 0, nTexts: 0, nFills: 0 });
    M.layerIdx.set(key, idx);
    return idx;
  };
  N.layers.forEach(addLayer);
  if (!M.layers.length) addLayer({ name: '0', aci: 7, on: true });
  const layerIndex = name => addLayer({ name, aci: 7, on: true, ltype: 'CONTINUOUS' });
  const warn = w => { M.warnings[w] = (M.warnings[w] || 0) + 1; };
  const styleOf = name => N.styles[(name || '').toUpperCase()] || N.styles.STANDARD || { font: 'arial.ttf', width: 1 };
  const ltScale = N.ltscale || 1;

  const ident = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const apply = (m, p) => ({ x: m.a * p.x + m.b * p.y + m.e, y: m.c * p.x + m.d * p.y + m.f });
  const applyV = (m, p) => ({ x: m.a * p.x + m.b * p.y, y: m.c * p.x + m.d * p.y });
  const then = (m, n) => ({ a: n.a * m.a + n.b * m.c, b: n.a * m.b + n.b * m.d, c: n.c * m.a + n.d * m.c, d: n.c * m.b + n.d * m.d,
    e: n.a * m.e + n.b * m.f + n.e, f: n.c * m.e + n.d * m.f + n.f });
  const mirrored = m => m.a * m.d - m.b * m.c < 0;

  const resolve = (e, cx) => {
    let lname = e.layer;
    if (cx.inBlock && lname === '0' && cx.layer) lname = cx.layer;
    const li = layerIndex(lname);
    const L = M.layers[li];
    let col;
    if (e.tc >= 0) col = e.tc;
    else if (e.color === 0) col = cx.tc >= 0 ? cx.tc : (cx.color === 256 || cx.color === 0 ? L.color : aci(cx.color));
    else if (e.color === 256 || e.color < 0 || e.color > 257) col = BYLAYER;
    else col = aci(e.color);
    let lt = (e.lt || '').toUpperCase();
    if (lt === 'BYBLOCK') lt = (cx.lt || '').toUpperCase();
    if (lt === 'BYLAYER' || lt === '') lt = (L.ltype || '').toUpperCase();
    const pat = N.ltypes[lt];
    const tot = pat ? pat.reduce((s, v) => s + Math.abs(v), 0) : 0;
    return { li, col, pat: pat && pat.length >= 2 && tot > 0 ? pat : null };
  };

  const addPrim = (e, cx, pts, closed) => {
    if (pts.length < 2 && !(pts.length === 1 && closed)) return;
    const { li, col, pat } = resolve(e, cx);
    const mir = mirrored(cx.m);
    const out = pts.map(p => { const q = apply(cx.m, p); return { x: q.x, y: q.y, b: p.b ? (mir ? -p.b : p.b) : 0 }; });
    M.prims.push({ layer: li, color: col, closed, pts: out, hasB: out.some(p => p.b), pat, lts: e.lts * ltScale });
  };
  const addFill = (e, cx, rings) => {
    const { li, col } = resolve(e, cx);
    const rr = rings.filter(r => r.length >= 3).map(r => r.map(p => apply(cx.m, p)));
    if (rr.length) M.prims.push({ layer: li, color: col, fill: true, rings: rr });
  };
  const addText = (e, cx, tp) => {
    const { li, col } = resolve(e, cx);
    tp.layer = li; tp.color = col;
    tp.ins = apply(cx.m, tp.ins);
    const dir = applyV(cx.m, { x: Math.cos(tp.rot), y: Math.sin(tp.rot) });
    const up = applyV(cx.m, { x: -Math.sin(tp.rot), y: Math.cos(tp.rot) });
    const sx = Math.hypot(dir.x, dir.y), sy = Math.hypot(up.x, up.y);
    if (sx > 0 && sy > 0) {
      tp.rot = Math.atan2(dir.y, dir.x); tp.h *= sy; tp.wf *= sx / sy; tp.wrap *= sx;
      if (tp.fit) tp.fit *= sx;
    }
    M.texts.push(tp);
  };

  const textPrim = (e, cx) => {
    if (e.hidden || !e.text || !e.text.trim() || e.h <= 0) return;
    const st = styleOf(e.style);
    let wf = e.wf > 0 ? e.wf : st.width;
    const tp = { lines: [cleanTextCodes(e.text)], ins: { ...e.ins }, h: e.h, rot: e.rot, wf, font: st.font, ha: 0, va: 0, mtext: false, wrap: 0, spacing: 1, fit: 0 };
    const { ha, va } = e;
    if (ha === 0 && va === 0) { /* stanga-baza */ }
    else if (ha === 3 || ha === 5) {
      if (e.hasAl) {
        const dx = e.al.x - e.ins.x, dy = e.al.y - e.ins.y;
        if (dx || dy) { tp.rot = Math.atan2(dy, dx); tp.fit = Math.hypot(dx, dy) * (ha === 3 ? -1 : 1); }
      }
    } else if (ha === 4) { if (e.hasAl) tp.ins = { ...e.al }; tp.ha = 1; tp.va = 2; }
    else { if (e.hasAl) tp.ins = { ...e.al }; tp.ha = ha > 2 ? 0 : ha; tp.va = va; }
    addText(e, cx, tp);
  };

  const convert = (e, cx) => {
    if (e.inv) return;
    switch (e.t) {
      case 'LINE': addPrim(e, cx, [e.p1, e.p2], false); break;
      case 'PLINE': addPrim(e, cx, e.pts, e.closed); break;
      case 'CIRCLE':
        if (e.r > 0) addPrim(e, cx, [{ x: e.c.x + e.r, y: e.c.y, b: 1 }, { x: e.c.x - e.r, y: e.c.y, b: 1 }], true);
        break;
      case 'ARC': {
        if (e.r <= 0) break;
        let sw = e.a1 - e.a0;
        while (sw <= 0) sw += 2 * Math.PI;
        const ns = Math.ceil(sw / (Math.PI / 2)), step = sw / ns, bl = Math.tan(step / 4), pts = [];
        for (let k = 0; k <= ns; k++) { const a = e.a0 + step * k; pts.push({ x: e.c.x + e.r * Math.cos(a), y: e.c.y + e.r * Math.sin(a), b: k < ns ? bl : 0 }); }
        addPrim(e, cx, pts, false);
        break;
      }
      case 'ELLIPSE': {
        const mn = { x: -e.maj.y * e.ratio, y: e.maj.x * e.ratio };
        let sw = e.p1 - e.p0;
        while (sw <= 0) sw += 2 * Math.PI;
        const n = Math.max(24, Math.min(720, Math.round(sw / (2 * Math.PI) * 360))), pts = [];
        for (let k = 0; k <= n; k++) { const a = e.p0 + sw * k / n; pts.push({ x: e.c.x + e.maj.x * Math.cos(a) + mn.x * Math.sin(a), y: e.c.y + e.maj.y * Math.cos(a) + mn.y * Math.sin(a) }); }
        const closed = Math.abs(sw - 2 * Math.PI) < 1e-6;
        if (closed) pts.pop();
        addPrim(e, cx, pts, closed);
        break;
      }
      case 'SPLINE': addPrim(e, cx, splinePoints(e), e.closed); break;
      case 'SOLID': addFill(e, cx, [[e.pts[0], e.pts[1], e.pts[3], e.pts[2]]]); break;
      case 'FILL': addFill(e, cx, e.rings); break;
      case 'TEXT': textPrim(e, cx); break;
      case 'MTEXT': {
        const lines = mtextPlain(e.text);
        if (!lines.length || e.h <= 0) break;
        const st = styleOf(e.style);
        const att = e.att >= 1 && e.att <= 9 ? e.att : 1;
        addText(e, cx, { lines, ins: { ...e.ins }, h: e.h, rot: e.rot, wf: st.width, font: st.font, ha: (att - 1) % 3, va: [3, 2, 1][Math.floor((att - 1) / 3)],
          mtext: true, wrap: e.width || 0, spacing: e.spacing > 0 ? e.spacing : 1, fit: 0 });
        break;
      }
      case 'INSERT': {
        if (cx.depth > 16) break;
        const blk = N.blocks[(e.name || '').toUpperCase()];
        if (blk) {
          const cols = Math.max(1, e.cols || 1), rows = Math.max(1, e.rows || 1);
          const cr = Math.cos(e.rot), sr = Math.sin(e.rot);
          let lname = e.layer;
          if (cx.inBlock && lname === '0') lname = cx.layer;
          let ccol = e.color, ctc = e.tc;
          if (ccol === 0) { ccol = cx.color; ctc = cx.tc; }
          if (ccol === 256 && ctc < 0) ccol = M.layers[layerIndex(lname)].aci;
          const base = e.baseless ? { x: 0, y: 0 } : blk.base;
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            let m = { a: e.sx, b: 0, c: 0, d: e.sy, e: -base.x * e.sx + c * e.cs, f: -base.y * e.sy + r * e.rs };
            m = then(m, { a: cr, b: -sr, c: sr, d: cr, e: e.ins.x, f: e.ins.y });
            m = then(m, cx.m);
            const nc = { m, layer: lname, color: ccol, tc: ctc, lt: e.lt, depth: cx.depth + 1, inBlock: true };
            for (const be of blk.ents) convert(be, nc);
          }
        } else warn('INSERT bloc lipsă');
        for (const a of e.attribs || []) textPrim(a, cx);
        break;
      }
      case 'SKIP': warn(e.what); break;
    }
  };

  const root = { m: ident, layer: '', color: 7, tc: -1, lt: '', depth: 0, inBlock: false };
  for (const e of N.ents) convert(e, root);

  for (const p of M.prims) { const L = M.layers[p.layer]; if (p.fill) L.nFills++; else L.nLines++; }
  for (const t of M.texts) M.layers[t.layer].nTexts++;
  computeExtents(M);
  return M;
}

function robust(v) {
  const s = Float64Array.from(v).sort();
  const n = s.length;
  const q = p => s[Math.round(p * (n - 1))];
  const a = q(0.002), b = q(0.998);
  let span = b - a;
  if (span <= 0) span = Math.max(1, Math.abs(a) * 1e-6);
  return [a - 0.5 * span, b + 0.5 * span, s[0], s[n - 1]];
}

function computeExtents(M) {
  const xs = [], ys = [];
  for (const p of M.prims) {
    if (p.fill) { for (const r of p.rings) for (const q of r) { xs.push(q.x); ys.push(q.y); } continue; }
    for (const q of p.pts) { xs.push(q.x); ys.push(q.y); }
    if (p.closed && p.pts.length === 2 && p.hasB) {
      const cx = (p.pts[0].x + p.pts[1].x) / 2, cy = (p.pts[0].y + p.pts[1].y) / 2, r = Math.hypot(p.pts[0].x - cx, p.pts[0].y - cy);
      xs.push(cx - r, cx + r); ys.push(cy - r, cy + r);
    }
  }
  for (const t of M.texts) { xs.push(t.ins.x); ys.push(t.ins.y); }
  if (!xs.length) { M.extAuto = M.extAll = [0, 0, 100, 100]; return; }
  const [ax0, ax1, minx, maxx] = robust(xs), [ay0, ay1, miny, maxy] = robust(ys);
  M.extAll = [minx, miny, maxx, maxy];
  const e = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < xs.length; k++) {
    const x = xs[k], y = ys[k];
    if (x < ax0 || x > ax1 || y < ay0 || y > ay1) continue;
    if (x < e[0]) e[0] = x; if (y < e[1]) e[1] = y; if (x > e[2]) e[2] = x; if (y > e[3]) e[3] = y;
  }
  if (!Number.isFinite(e[0])) e.splice(0, 4, ...M.extAll);
  if (e[2] - e[0] <= 0) e[2] = e[0] + 1;
  if (e[3] - e[1] <= 0) e[3] = e[1] + 1;
  M.extAuto = e;
}

// ---------------------------------------------------------------------------
// Setari implicite
// ---------------------------------------------------------------------------

export const hex = c => '#' + (c & 0xFFFFFF).toString(16).padStart(6, '0');
export const parseHex = (s, d = 0) => { const m = /^#?([0-9a-f]{6})$/i.exec((s || '').trim()); return m ? parseInt(m[1], 16) : d; };

export function defaultSettings(M) {
  const s = { longSide: 24000, marginPct: 1, background: '#ffffff', transparent: false, widthMul: 1, textMul: 1, ltScaleMul: 1, worldFile: true, extMode: 'auto', layers: [] };
  for (const L of M.layers) {
    let c = L.color;
    if (c === 0xFFFFFF) c = 0;
    const w = L.lw > 0 ? Math.max(1, L.lw / 100 * 300 / 25.4) : 2;
    s.layers.push({ name: L.name, visible: L.on && !L.frozen && (L.nLines + L.nTexts + L.nFills) > 0, color: hex(c), width: Math.round(w * 10) / 10, textScale: 1, useLtype: true });
  }
  return s;
}
