'use strict';
// Grafik ringan tanpa library (tetap jalan offline). Palet lolos validate_palette (dataviz skill):
// tosca #0E9F9D · oker #D9A21B · biru #3E6FB0 · koral #D9674C — oker di bawah 3:1, jadi selalu ada label/tabel.
const WARNA = { masuk: '#0E9F9D', keluar: '#D9674C', paket: '#0E9F9D', pas: '#3E6FB0', cetak: '#D9A21B', fee: '#3E6FB0', edit: '#0E9F9D', ops: '#D9674C', laba: '#102A2C' };
const rpS = n => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e6 ? s + (a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt' : a >= 1e3 ? s + Math.round(a / 1e3) + ' rb' : s + Math.round(a); };
const escG = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Skala sumbu dengan langkah bulat (1/2/2,5/5 × 10^n) supaya label "500 rb, 1 jt, 1,5 jt" bukan "625 rb".
function skala(min, max, n = 4) {
  const rentang = Math.max(max - Math.min(0, min), 1), step = niceMax(rentang / n);
  const lo = min < 0 ? -Math.ceil(-min / step) * step : 0, hi = Math.max(step, Math.ceil(max / step) * step);
  const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return { lo, hi, ticks };
}
function niceMax(v) { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }

// Garis/kurva: satu sumbu Rp, label langsung di ujung garis, kolom hover per titik.
function grafikGaris({ w, h = 250, x, series, tip }) {
  const L = 54, R = 92, T = 14, B = 28, iw = Math.max(80, w - L - R), ih = h - T - B;
  const semua = series.flatMap(s => s.data);
  const { lo, hi, ticks } = skala(Math.min(...semua, 0), Math.max(...semua, 1));
  const X = i => L + (x.length <= 1 ? iw / 2 : i * iw / (x.length - 1));
  const Y = v => T + ih - (v - lo) / (hi - lo) * ih;
  let g = '';
  for (const v of ticks) { g += `<line x1="${L}" x2="${L + iw}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${rpS(v)}</text>`; }
  if (lo < 0) g += `<line x1="${L}" x2="${L + iw}" y1="${Y(0)}" y2="${Y(0)}" class="nol"/>`;
  const tiap = Math.max(1, Math.ceil(x.length / Math.max(2, Math.floor(iw / 46))));
  x.forEach((t, i) => { if (i % tiap === 0 || i === x.length - 1) g += `<text x="${X(i)}" y="${h - 8}" class="ax" text-anchor="middle">${escG(t)}</text>`; });
  const titik = x.length <= 12;
  series.forEach(s => {
    g += `<path d="${s.data.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('')}" fill="none" stroke="${s.warna}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (titik) s.data.forEach((v, i) => { g += `<circle cx="${X(i)}" cy="${Y(v)}" r="4.5" fill="${s.warna}" stroke="#fff" stroke-width="2"/>`; });
  });
  // label ujung, didorong supaya tidak bertumpuk
  const ujung = series.map(s => ({ s, y: Y(s.data[s.data.length - 1]) })).sort((a, b) => a.y - b.y);
  ujung.forEach((u, i) => { if (i && u.y - ujung[i - 1].y < 30) u.y = ujung[i - 1].y + 30; });
  const lebih = ujung.length ? ujung[ujung.length - 1].y + 14 - (T + ih) : 0;
  if (lebih > 0) ujung.forEach(u => { u.y = Math.max(T + 8, u.y - lebih); });
  ujung.forEach(u => { g += `<text x="${L + iw + 8}" y="${u.y}" class="lbl-ujung" fill="currentColor"><tspan x="${L + iw + 8}" class="lbl-nama">${escG(u.s.nama)}</tspan><tspan x="${L + iw + 8}" dy="14" class="lbl-nilai">${rpS(u.s.data[u.s.data.length - 1])}</tspan></text>`; });
  const lebar = x.length <= 1 ? iw : iw / (x.length - 1);
  x.forEach((t, i) => { g += `<g class="kol" data-tip="${escG(tip(i))}"><rect x="${X(i) - lebar / 2}" y="${T}" width="${lebar}" height="${ih}" fill="transparent"/><line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${T + ih}" class="silang"/></g>`; });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${g}</svg>`;
}

// Batang vertikal satu seri; batang tertinggi diberi label nilai.
function grafikBatang({ w, h = 210, x, data, warna, tip, labelSemua }) {
  const L = 54, R = 10, T = 18, B = 28, iw = Math.max(80, w - L - R), ih = h - T - B;
  const { hi, ticks } = skala(0, Math.max(...data, 1)), Y = v => T + ih - v / hi * ih;
  const step = iw / x.length, bw = Math.max(3, Math.min(34, step - 2));
  let g = '';
  for (const v of ticks) { g += `<line x1="${L}" x2="${L + iw}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${rpS(v)}</text>`; }
  const imax = data.indexOf(Math.max(...data));
  const tiap = Math.max(1, Math.ceil(x.length / Math.max(2, Math.floor(iw / 30))));
  data.forEach((v, i) => {
    const cx = L + step * i + step / 2, y = Y(v), hb = T + ih - y, r = Math.min(4, bw / 2, hb);
    const d = hb > 0 ? `M${cx - bw / 2} ${T + ih}V${y + r}Q${cx - bw / 2} ${y} ${cx - bw / 2 + r} ${y}H${cx + bw / 2 - r}Q${cx + bw / 2} ${y} ${cx + bw / 2} ${y + r}V${T + ih}Z` : '';
    g += `<g class="bat" data-tip="${escG(tip(i))}"><rect x="${cx - step / 2}" y="${T}" width="${step}" height="${ih}" fill="transparent"/>${d ? `<path d="${d}" fill="${warna}"/>` : ''}</g>`;
    if (v && (labelSemua || i === imax)) g += `<text x="${cx}" y="${y - 5}" class="ax kuat" text-anchor="middle">${rpS(v)}</text>`;
    if (i % tiap === 0 || i === x.length - 1) g += `<text x="${cx}" y="${h - 8}" class="ax" text-anchor="middle">${escG(x[i])}</text>`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${g}</svg>`;
}

// Batang horizontal (HTML, ikut lebar layar): [{nama, nilai, sub, warna}]
function batangMendatar(rows, warnaDefault) {
  const max = Math.max(...rows.map(r => r.nilai), 1);
  return `<div class="hbar">${rows.map(r => `<div class="hbar-row" data-tip="${escG(r.tip || r.nama + ': ' + rpS(r.nilai))}">
    <div class="hbar-lbl">${escG(r.nama)}${r.sub ? `<small>${escG(r.sub)}</small>` : ''}</div>
    <div class="hbar-track"><i style="width:${Math.max(1.5, r.nilai / max * 100)}%;background:${r.warna || warnaDefault}"></i></div>
    <div class="hbar-val tnum">${r.teks || rpS(r.nilai)}</div></div>`).join('')}</div>`;
}

// Batang 100% bertumpuk + legenda bernilai: [{nama, nilai, warna}]
function batangKomposisi(parts) {
  const tot = parts.reduce((s, p) => s + Math.max(0, p.nilai), 0) || 1;
  return `<div class="komp">${parts.filter(p => p.nilai > 0).map(p => `<i style="width:${p.nilai / tot * 100}%;background:${p.warna}" data-tip="${escG(p.nama + ': ' + rpS(p.nilai) + ' (' + Math.round(p.nilai / tot * 100) + '%)')}"></i>`).join('')}</div>
  <div class="komp-leg">${parts.map(p => `<div><i style="background:${p.warna}"></i><span>${escG(p.nama)}</span><b class="tnum">${rpS(p.nilai)}</b><small>${Math.round(Math.max(0, p.nilai) / tot * 100)}%</small></div>`).join('')}</div>`;
}

// Air terjun horizontal: pemasukan → potongan → laba. steps: [{nama, nilai, tipe:'awal'|'kurang'|'akhir'}]
function airTerjun(steps) {
  let jalan = 0; const seg = steps.map(s => {
    if (s.tipe === 'awal') { jalan = s.nilai; return { ...s, a: 0, b: s.nilai }; }
    if (s.tipe === 'kurang') { const a = jalan; jalan -= s.nilai; return { ...s, a: jalan, b: a }; }
    return { ...s, a: Math.min(0, s.nilai), b: Math.max(0, s.nilai) };
  });
  const lo = Math.min(0, ...seg.map(s => s.a)), hi = Math.max(...seg.map(s => s.b), 1), P = v => (v - lo) / (hi - lo) * 100;
  return `<div class="wf">${seg.map(s => `<div class="wf-row ${s.tipe}" data-tip="${escG(s.nama + ': ' + (s.tipe === 'kurang' ? '−' : '') + rpS(s.nilai))}">
    <div class="wf-lbl">${escG(s.nama)}</div>
    <div class="wf-track">${lo < 0 ? `<b class="wf-nol" style="left:${P(0)}%"></b>` : ''}<i style="left:${P(s.a)}%;width:${Math.max(.6, P(s.b) - P(s.a))}%"></i></div>
    <div class="wf-val tnum">${s.tipe === 'kurang' ? '−' : ''}${rpS(s.nilai)}</div></div>`).join('')}</div>`;
}

// Tooltip bersama untuk semua elemen ber-data-tip (mouse & sentuh)
(() => {
  const tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.hidden = true; document.body.appendChild(tipEl);
  const tampil = (el, x, y) => {
    tipEl.innerHTML = el.dataset.tip.split('\n').map((l, i) => i ? `<div>${escG(l)}</div>` : `<b>${escG(l)}</b>`).join('');
    tipEl.hidden = false;
    const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
    tipEl.style.left = Math.min(innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
    tipEl.style.top = Math.max(8, y - hh - 12) + 'px';
  };
  document.addEventListener('mousemove', e => { const el = e.target.closest?.('[data-tip]'); if (el) tampil(el, e.clientX, e.clientY); else tipEl.hidden = true; });
  document.addEventListener('touchstart', e => { const el = e.target.closest?.('[data-tip]'), t = e.touches[0]; if (el) tampil(el, t.clientX, t.clientY); else tipEl.hidden = true; }, { passive: true });
  addEventListener('scroll', () => { tipEl.hidden = true; }, { passive: true });
})();
