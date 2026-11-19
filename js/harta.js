// DXF2PNG mobil - Harta: vizualizare vectoriala cu marire din degete (pinch),
// tragere, dublu-atingere si rotita mouse-ului. Fara cautare / identificare.
import { fullView, buildScene, drawStrip } from './render.js';

export function creeazaHarta({ getM, getS, getPlan }) {
  const el = document.getElementById('harta');
  const cv = document.getElementById('hartaCanvas');
  const scara = document.getElementById('hartaScara');
  const spin = document.getElementById('hartaSpin');
  const ctx = cv.getContext('2d');
  let st = null;          // { cx, cy, res }  res = unitati / px CSS
  let randat = null;      // starea pentru care canvas-ul a fost desenat
  let timer = null, lucru = false, iar = false;
  let W = 0, H = 0, dpr = 1;
  const ptr = new Map();
  let start = null, ultimTap = 0, mutat = false, tapTimer = null;
  let plan = null, arataPlanse = false, plansaDeschisa = null;
  const info = document.getElementById('hartaInfo');
  const btnAns = document.getElementById('hartaAnsamblu');
  const btnPl = document.getElementById('hartaPlanse');

  function dim() {
    W = el.clientWidth; H = el.clientHeight;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    // limitam memoria canvas-ului (~ 12 MP)
    while (W * H * dpr * dpr > 12e6 && dpr > 1) dpr -= 0.25;
  }

  function potriveste() {
    const M = getM(), S = getS();
    const f = fullView(M, S);
    const dx = f.w * f.res, dy = f.h * f.res;
    st = { cx: f.x0 + dx / 2, cy: f.y1 - dy / 2, res: Math.max(dx / W, dy / H) * 1.04 };
  }

  function vedere(s) {
    const M = getM(), S = getS();
    const full = fullView(M, S);
    const r = s.res / dpr; // unitati / pixel fizic
    return {
      res: r, x0: s.cx - W / 2 * s.res, y1: s.cy + H / 2 * s.res,
      w: Math.round(W * dpr), h: Math.round(H * dpr),
      widthScale: Math.min(dpr * 1.25, full.res / r), minWidth: 0.6 * dpr,
    };
  }

  async function randeaza() {
    if (lucru) { iar = true; return; }
    lucru = true; spin.style.display = '';
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    try {
      const s = { ...st };
      const v = vedere(s);
      const scene = buildScene(getM(), getS(), v);
      if (cv.width !== v.w || cv.height !== v.h) { cv.width = v.w; cv.height = v.h; }
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      drawStrip(ctx, scene, 0, v.h);
      if (arataPlanse && plan) desenPlanse(v);
      randat = s;
      aplicaTransform();
    } catch (e) { console.error(e); }
    lucru = false; spin.style.display = 'none';
    if (iar) { iar = false; randeaza(); }
  }
  function desenPlanse(v) {
    const X = x => (x - v.x0) / v.res, Y = y => (v.y1 - y) / v.res;
    ctx.save();
    ctx.lineWidth = Math.max(1.5, 2 * dpr * 0.75);
    ctx.strokeStyle = 'rgba(214,32,32,.9)';
    if (plansaDeschisa) { const p = plansaDeschisa; ctx.save(); ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(31,111,235,.95)'; ctx.strokeRect(X(p.r[0]), Y(p.r[3]), (p.r[2] - p.r[0]) / v.res, (p.r[3] - p.r[1]) / v.res); ctx.restore(); }
    for (const p of plan.planse) ctx.strokeRect(X(p.r[0]), Y(p.r[3]), (p.r[2] - p.r[0]) / v.res, (p.r[3] - p.r[1]) / v.res);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of plan.planse) {
      const w = (p.r[2] - p.r[0]) / v.res, h = (p.r[3] - p.r[1]) / v.res;
      const fs = Math.min(Math.min(w, h) * 0.32, 110 * dpr);
      if (fs < 9 * dpr || w > v.w * 0.55) continue; // la planse mari (deschise) nu acoperim desenul
      ctx.font = `600 ${fs}px -apple-system, Arial, sans-serif`;
      const cx = X((p.r[0] + p.r[2]) / 2), cy = Y((p.r[1] + p.r[3]) / 2);
      ctx.lineWidth = fs * 0.12; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(String(p.nr), cx, cy);
      ctx.fillStyle = 'rgba(214,32,32,.95)'; ctx.fillText(String(p.nr), cx, cy);
    }
    ctx.restore();
  }
  function infoPlanse() {
    btnPl.classList.toggle('on', arataPlanse);
    btnAns.hidden = !(arataPlanse && plan && plan.planse.length > 1 && plansaDeschisa);
    info.hidden = !(arataPlanse && plan);
    if (!info.hidden) info.textContent = plansaDeschisa ? `Planșa ${plansaDeschisa.nr} din ${plan.planse.length} · 1:1000`
      : (plan.planse.length > 1 ? `${plan.planse.length} planșe A0 · atinge o planșă ca s-o deschizi` : `O planșă ${plan.format} · 1:1000`);
  }
  function arataZona(r) {
    st = { cx: (r[0] + r[2]) / 2, cy: (r[1] + r[3]) / 2, res: Math.max((r[2] - r[0]) / W, (r[3] - r[1]) / (H - 60)) * 1.03 };
    aplicaTransform(); randeaza();
  }
  function deschidePlansa(p) { plansaDeschisa = p; infoPlanse(); arataZona(p.r); }
  function ansamblu() {
    plansaDeschisa = null; infoPlanse();
    const g = plan.grila || plan.planse[0].r;
    arataZona(g);
  }
  function comutaPlanse(on) {
    if (on && !plan) {
      try { plan = getPlan(); } catch (e) { alert(e.message || e); on = false; }
    }
    arataPlanse = on && !!plan;
    if (!arataPlanse) plansaDeschisa = null;
    infoPlanse(); randeaza();
  }
  function tapSimplu(q) {
    if (!(arataPlanse && plan)) return;
    const wx = st.cx + (q.x - W / 2) * st.res, wy = st.cy - (q.y - H / 2) * st.res;
    const p = plan.planse.find(p => wx >= p.r[0] && wx <= p.r[2] && wy >= p.r[1] && wy <= p.r[3]);
    if (!p || p === plansaDeschisa) return;
    // deschidem doar daca pe ecran se vad mai multe planse (altfel e o atingere obisnuita)
    const wp = (p.r[2] - p.r[0]) / st.res;
    if (wp > W * 0.9 && plansaDeschisa) return;
    deschidePlansa(p);
  }
  const programeaza = (d = 160) => { clearTimeout(timer); timer = setTimeout(randeaza, d); };

  // transformarea CSS a imaginii deja desenate, pana la noua randare
  function aplicaTransform() {
    if (!randat) return;
    const s = randat.res / st.res;
    const rx0 = randat.cx - W / 2 * randat.res, ry1 = randat.cy + H / 2 * randat.res;
    const x0 = st.cx - W / 2 * st.res, y1 = st.cy + H / 2 * st.res;
    const tx = (rx0 - x0) / st.res, ty = (y1 - ry1) / st.res;
    cv.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    actualizeazaScara();
  }

  function actualizeazaScara() {
    const tinta = 110 * st.res;
    const p = Math.pow(10, Math.floor(Math.log10(tinta)));
    const L = [1, 2, 5, 10].map(m => m * p).filter(x => x <= tinta).pop() || p;
    const px = L / st.res;
    const t = L >= 1000 ? (L / 1000) + ' km' : (L >= 1 ? L : L.toPrecision(2)) + ' m';
    scara.innerHTML = `<i style="width:${px.toFixed(0)}px"></i><span>${t}</span>`;
  }

  // zoom in jurul unui punct ecran (sx, sy)
  function zoom(f, sx, sy) {
    const wx = st.cx + (sx - W / 2) * st.res, wy = st.cy - (sy - H / 2) * st.res;
    st.res = limRes(st.res / f);
    st.cx = wx - (sx - W / 2) * st.res; st.cy = wy + (sy - H / 2) * st.res;
    aplicaTransform(); programeaza();
  }
  function limRes(r) {
    const f = fullView(getM(), getS());
    const max = Math.max(f.w * f.res / W, f.h * f.res / H) * 8;
    return Math.min(max, Math.max(0.0005, r));
  }

  // ---- gesturi
  const loc = e => { const b = el.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  function incepe() {
    const p = [...ptr.values()];
    if (!p.length) { start = null; return; }
    const m = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : { ...p[0] };
    const d = p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    start = { m, d, st: { ...st } };
  }
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.hbtn')) return;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    ptr.set(e.pointerId, loc(e));
    if (ptr.size === 1) mutat = false;
    incepe();
    clearTimeout(timer);
  });
  el.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId) || !start) return;
    ptr.set(e.pointerId, loc(e));
    const p = [...ptr.values()];
    const m = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
    if (Math.hypot(m.x - start.m.x, m.y - start.m.y) > 6 || p.length > 1) mutat = true;
    const s0 = start.st;
    let res = s0.res;
    if (p.length > 1 && start.d > 10) res = limRes(s0.res * start.d / Math.max(10, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)));
    const wx = s0.cx + (start.m.x - W / 2) * s0.res, wy = s0.cy - (start.m.y - H / 2) * s0.res;
    st = { res, cx: wx - (m.x - W / 2) * res, cy: wy + (m.y - H / 2) * res };
    aplicaTransform();
  });
  const sfarsit = e => {
    if (!ptr.has(e.pointerId)) return;
    const q = loc(e);
    ptr.delete(e.pointerId);
    incepe();
    if (ptr.size === 0) {
      if (!mutat && e.type === 'pointerup') {
        const t = performance.now();
        if (t - ultimTap < 320) { ultimTap = 0; clearTimeout(tapTimer); zoom(2, q.x, q.y); return; }
        ultimTap = t;
        clearTimeout(tapTimer); tapTimer = setTimeout(() => tapSimplu(q), 330);
      }
      if (mutat) programeaza(60);
    }
  };
  el.addEventListener('pointerup', sfarsit);
  el.addEventListener('pointercancel', sfarsit);
  el.addEventListener('wheel', e => { e.preventDefault(); const q = loc(e); zoom(Math.exp(-e.deltaY * 0.0015), q.x, q.y); }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => el.addEventListener(t, e => e.preventDefault()));

  document.getElementById('hartaPlus').onclick = () => zoom(2, W / 2, H / 2);
  document.getElementById('hartaMinus').onclick = () => zoom(0.5, W / 2, H / 2);
  document.getElementById('hartaTot').onclick = () => { potriveste(); aplicaTransform(); randeaza(); };
  document.getElementById('hartaInchide').onclick = () => inchide();
  btnPl.onclick = () => comutaPlanse(!arataPlanse);
  btnAns.onclick = () => ansamblu();
  window.addEventListener('resize', () => { if (el.hidden) return; dim(); aplicaTransform(); programeaza(250); });

  function deschide(opt = {}) {
    if (!getM()) return;
    el.hidden = false;
    document.documentElement.classList.add('fara-scroll');
    dim();
    if (!st || !deschide.cheie || deschide.cheie !== getM()) { potriveste(); deschide.cheie = getM(); plan = null; arataPlanse = false; plansaDeschisa = null; }
    randat = null; cv.style.transform = '';
    actualizeazaScara();
    if (opt.planse) {
      if (!plan) { try { plan = getPlan(); } catch (e) { alert(e.message || e); } }
      arataPlanse = !!plan; plansaDeschisa = null; infoPlanse();
      if (plan) { ansamblu(); return; }
    }
    infoPlanse();
    randeaza();
  }
  function inchide() {
    el.hidden = true;
    document.documentElement.classList.remove('fara-scroll');
    cv.width = 1; cv.height = 1; randat = null; // eliberam memoria
  }
  // setarile s-au schimbat: grila planselor se recalculeaza la nevoie
  function invalideaza() { plan = null; if (arataPlanse) { arataPlanse = false; plansaDeschisa = null; infoPlanse(); } }
  return { deschide, inchide, invalideaza, reimprospateaza: () => { if (!el.hidden) programeaza(200); } };
}
