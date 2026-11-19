// DXF2PNG mobil - vizualizator PDF in aplicatie (PDF.js, Mozilla, Apache-2.0), fisierele lib/pdf.min.mjs si lib/pdf.worker.min.mjs.
// Marire din degete, tragere, dubla atingere; legaturile din pagina (numerele
// planselor, "Plan de ansamblu", vecinii) se pot atinge; lista planselor
// (semnele de carte); X inchide si revine in aplicatie.

let libP = null;
function lib() {
  if (!libP) libP = (async () => {
    const pj = await import('../lib/pdf.min.mjs');
    pj.GlobalWorkerOptions.workerSrc = new URL('../lib/pdf.worker.min.mjs', import.meta.url).href;
    return pj;
  })();
  return libP;
}

export function creeazaVizualizator({ onSalveaza }) {
  const $ = id => document.getElementById(id);
  const el = $('viz'), zona = $('vizZona'), cv = $('vizCanvas'), ctx = cv.getContext('2d');
  const titlu = $('vizTitlu'), spin = $('vizSpin'), lista = $('vizLista'), msg = $('vizMsg');
  let doc = null, nume = '', pagini = [], idx = 0;   // pagini: [{titlu}]
  let pag = null, pw = 0, ph = 0, linkuri = [];      // pagina curenta (pt) si legaturile ei
  let st = null, randat = null, task = null, timer = null, lucru = false, iar = false;
  let W = 0, H = 0, dpr = 1;
  const ptr = new Map();
  let start = null, ultimTap = 0, mutat = false, tapTimer = null;

  function dim() {
    W = zona.clientWidth; H = zona.clientHeight;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    while (W * H * dpr * dpr > 10e6 && dpr > 1) dpr -= 0.25;
  }
  const fit = () => { const s = Math.min(W / pw, H / ph) * 0.98; return { s, ox: (W - pw * s) / 2, oy: (H - ph * s) / 2 }; };
  const limS = s => { const f = fit().s; return Math.min(Math.max(s, f * 0.5), f * 400); };

  async function randeaza() {
    if (!pag) return;
    if (lucru) { iar = true; if (task) try { task.cancel(); } catch (_) {} return; }
    lucru = true; spin.style.display = '';
    const s = { ...st };
    try {
      const vp = pag.getViewport({ scale: s.s * dpr, offsetX: s.ox * dpr, offsetY: s.oy * dpr });
      const w = Math.round(W * dpr), h = Math.round(H * dpr);
      const off = document.createElement('canvas'); off.width = w; off.height = h;
      const oc = off.getContext('2d');
      oc.fillStyle = '#e5e7eb'; oc.fillRect(0, 0, w, h);
      oc.fillStyle = '#fff'; oc.fillRect(s.ox * dpr, s.oy * dpr, pw * s.s * dpr, ph * s.s * dpr);
      task = pag.render({ canvasContext: oc, viewport: vp, background: 'rgba(0,0,0,0)' });
      await task.promise;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.drawImage(off, 0, 0);
      off.width = off.height = 1;
      randat = s; aplica();
    } catch (e) { if (!/cancel/i.test(e?.name + e?.message)) console.error(e); }
    task = null; lucru = false; spin.style.display = 'none';
    if (iar) { iar = false; randeaza(); }
  }
  const programeaza = (d = 150) => { clearTimeout(timer); timer = setTimeout(randeaza, d); };
  function aplica() {
    if (!randat) return;
    const k = st.s / randat.s;
    cv.style.transform = `translate(${st.ox - randat.ox * k}px, ${st.oy - randat.oy * k}px) scale(${k})`;
  }
  function zoom(f, x, y) {
    const s2 = limS(st.s * f), k = s2 / st.s;
    st = { s: s2, ox: x - (x - st.ox) * k, oy: y - (y - st.oy) * k };
    aplica(); programeaza();
  }

  async function arata(i) {
    if (!doc) return;
    idx = Math.max(0, Math.min(doc.numPages - 1, i));
    spin.style.display = '';
    pag = await doc.getPage(idx + 1);
    const vp = pag.getViewport({ scale: 1 });
    pw = vp.width; ph = vp.height;
    linkuri = [];
    try {
      for (const a of await pag.getAnnotations()) {
        if (a.subtype !== 'Link' || !a.dest) continue;
        let d = a.dest;
        if (typeof d === 'string') d = await doc.getDestination(d);
        if (!Array.isArray(d)) continue;
        const ti = typeof d[0] === 'object' ? await doc.getPageIndex(d[0]) : d[0];
        const [x0, y0, x1, y1] = a.rect;
        linkuri.push({ r: [x0, ph - y1, x1, ph - y0], pag: ti });  // coordonate de sus
      }
    } catch (e) { console.error(e); }
    titlu.textContent = pagini[idx]?.titlu || `Pagina ${idx + 1}`;
    $('vizPrev').disabled = idx === 0; $('vizNext').disabled = idx >= doc.numPages - 1;
    $('vizPag').textContent = `${idx + 1}/${doc.numPages}`;
    for (const b of lista.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.i === idx);
    st = fit(); randat = null; cv.style.transform = ''; ctx.clearRect(0, 0, cv.width, cv.height);
    msg.hidden = !(idx === 0 && linkuri.length > 1);
    randeaza();
  }

  // ---- gesturi (ca la Harta)
  const loc = e => { const b = zona.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  function incepe() {
    const p = [...ptr.values()];
    if (!p.length) { start = null; return; }
    const m = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : { ...p[0] };
    start = { m, d: p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0, st: { ...st } };
  }
  zona.addEventListener('pointerdown', e => {
    if (e.target.closest('.lista')) return;
    try { zona.setPointerCapture(e.pointerId); } catch (_) {}
    ptr.set(e.pointerId, loc(e)); if (ptr.size === 1) mutat = false;
    incepe(); clearTimeout(timer);
  });
  zona.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId) || !start || !st) return;
    ptr.set(e.pointerId, loc(e));
    const p = [...ptr.values()];
    const m = p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
    if (Math.hypot(m.x - start.m.x, m.y - start.m.y) > 6 || p.length > 1) mutat = true;
    const s0 = start.st;
    let s = s0.s;
    if (p.length > 1 && start.d > 10) s = limS(s0.s * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / start.d);
    const k = s / s0.s;
    st = { s, ox: m.x - (start.m.x - s0.ox) * k, oy: m.y - (start.m.y - s0.oy) * k };
    aplica();
  });
  const sfarsit = e => {
    if (!ptr.has(e.pointerId)) return;
    const q = loc(e);
    ptr.delete(e.pointerId); incepe();
    if (ptr.size) return;
    if (!mutat && e.type === 'pointerup') {
      const t = performance.now();
      if (t - ultimTap < 320) { ultimTap = 0; clearTimeout(tapTimer); zoom(2.5, q.x, q.y); return; }
      ultimTap = t;
      // legatura atinsa? (raspuns imediat, fara a astepta dubla atingere)
      const px = (q.x - st.ox) / st.s, py = (q.y - st.oy) / st.s;
      const L = linkuri.find(l => px >= l.r[0] && px <= l.r[2] && py >= l.r[1] && py <= l.r[3]);
      if (L) { ultimTap = 0; arata(L.pag); return; }
    }
    if (mutat) programeaza(60);
  };
  zona.addEventListener('pointerup', sfarsit);
  zona.addEventListener('pointercancel', sfarsit);
  zona.addEventListener('wheel', e => { e.preventDefault(); const q = loc(e); zoom(Math.exp(-e.deltaY * 0.0015), q.x, q.y); }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => el.addEventListener(t, e => e.preventDefault()));

  $('vizInchide').onclick = () => inchide();
  $('vizPrev').onclick = () => arata(idx - 1);
  $('vizNext').onclick = () => arata(idx + 1);
  $('vizTot').onclick = () => { st = fit(); aplica(); randeaza(); };
  $('vizPlus').onclick = () => zoom(2, W / 2, H / 2);
  $('vizMinus').onclick = () => zoom(0.5, W / 2, H / 2);
  $('vizSalv').onclick = () => onSalveaza && onSalveaza();
  $('vizCuprins').onclick = () => { lista.hidden = !lista.hidden; };
  lista.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { lista.hidden = true; arata(+b.dataset.i); } });
  window.addEventListener('resize', () => { if (el.hidden || !pag) return; dim(); st = fit(); aplica(); programeaza(250); });

  async function deschide(blob, titluDoc) {
    el.hidden = false;
    document.documentElement.classList.add('fara-scroll');
    nume = titluDoc || 'PDF';
    titlu.textContent = 'Se deschide PDF-ul…'; spin.style.display = ''; lista.hidden = true; msg.hidden = true;
    dim();
    try {
      const pj = await lib();
      if (doc) { try { await doc.destroy(); } catch (_) {} doc = null; }
      doc = await pj.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
      pagini = [];
      const ol = await doc.getOutline().catch(() => null);
      for (let i = 0; i < doc.numPages; i++) pagini.push({ titlu: `Pagina ${i + 1}` });
      if (ol) for (const o of ol) {
        let d = o.dest;
        if (typeof d === 'string') d = await doc.getDestination(d);
        if (!Array.isArray(d)) continue;
        const i = typeof d[0] === 'object' ? await doc.getPageIndex(d[0]) : d[0];
        if (pagini[i]) pagini[i].titlu = o.title;
      }
      if (doc.numPages === 1) pagini[0].titlu = nume;
      lista.innerHTML = pagini.map((p, i) => `<button data-i="${i}">${p.titlu.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</button>`).join('');
      $('vizCuprins').hidden = doc.numPages < 2;
      $('vizNav').hidden = doc.numPages < 2;
      await arata(0);
    } catch (e) {
      console.error(e);
      titlu.textContent = 'Eroare: ' + (e.message || e);
      spin.style.display = 'none';
    }
  }
  function inchide() {
    el.hidden = true;
    document.documentElement.classList.remove('fara-scroll');
    if (task) try { task.cancel(); } catch (_) {}
    cv.width = cv.height = 1; randat = null; pag = null;
    if (doc) { doc.destroy().catch(() => {}); doc = null; }
  }
  return { deschide, inchide };
}
