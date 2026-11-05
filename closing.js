'use strict';
// Closing akhir bulan: satu rekap → 3 keluaran (spreadsheet .xlsx, PDF A4, teks WhatsApp).
// Rumus sama dengan Laporan Bulanan Excel: Total bersih = Pemasukan − Pengeluaran; Laba = bersih − gaji team − ruko; 40/20/40.

const JUAL_LABEL = { PAKET: 'Paket', 'PAS PHOTO': 'Pas Photo', CETAK: 'Cetak' };
const KAT_LABEL = { fee: 'Fee fotografer', edit: 'Fee edit', cetak: 'Cetak', lain: 'Operasional' };

function rekapBulan(p) {
  const D = dataBulan(p);
  const jual = { PAKET: { n: 0, v: 0 }, 'PAS PHOTO': { n: 0, v: 0 }, CETAK: { n: 0, v: 0 } };
  D.masuk.forEach(m => { const o = jual[m.jenisJual] ||= { n: 0, v: 0 }; o.n++; o.v += jumlahMasuk(m); });
  const kat = { fee: 0, edit: 0, cetak: 0, lain: 0 };
  D.keluar.forEach(k => { kat[k.jenis || 'lain'] += totalKeluar(k); });
  const orang = {};
  D.keluar.filter(k => k.jenis === 'fee' || k.jenis === 'edit').forEach(k => {
    const o = orang[k.fotografer || 'Lainnya'] ||= { total: 0, belum: 0, n: 0 };
    o.total += totalKeluar(k); o.n++; if (k.status === 'BELUM') o.belum += totalKeluar(k);
  });
  const kas = S.posisiKas[p] || { cash: 0, bri: 0 };
  const dp = dataDp(p), dpList = [...dp.lama, ...dp.ini];
  // data grafik — sama dengan tab Laporan
  const nHari = new Date(D.y, D.mo, 0).getDate(), awal = new Date(D.y, D.mo - 1, 1);
  const hariKe = r => { const d = keTgl(r.tanggal); return d.getFullYear() === D.y && d.getMonth() === D.mo - 1 ? d.getDate() - 1 : d < awal ? 0 : nHari - 1; };
  const hM = Array(nHari).fill(0), hK = Array(nHari).fill(0), hN = Array(nHari).fill(0);
  D.masuk.forEach(m => { const i = hariKe(m); hM[i] += jumlahMasuk(m); hN[i]++; });
  D.keluar.forEach(k => { hK[hariKe(k)] += totalKeluar(k); });
  const kum = a => a.reduce((o, v, i) => (o.push((o[i - 1] || 0) + v), o), []);
  const perPaket = {};
  D.masuk.forEach(m => { const n = m.jenisJual === 'CETAK' ? 'Cetak' : (m.jenis || (m.jenisJual === 'PAS PHOTO' ? 'Pas Photo lain' : 'Lainnya')).replace(/^Paket /, ''); const o = perPaket[n] ||= { n: 0, v: 0 }; o.n++; o.v += jumlahMasuk(m); });
  const pHr = Array(7).fill(0), pHrN = Array(7).fill(0);
  D.masuk.forEach(m => { const i = (keTgl(m.tanggal).getDay() + 6) % 7; pHr[i] += jumlahMasuk(m); pHrN[i]++; });
  const tren = []; for (let k = 5; k >= 0; k--) tren.push(dataBulan(iso(new Date(D.y, D.mo - 1 - k, 1)).slice(0, 7)));
  const iAda = tren.findIndex(t => t.ada);
  const L = dataBulan(iso(new Date(D.y, D.mo - 2, 1)).slice(0, 7));
  const R = { ...D, jual, kat, orang, posisi: kas, bca: D.bersih - (Number(kas.cash) || 0) - (Number(kas.bri) || 0),
    dpList, dpTotal: dpList.reduce((s, m) => s + (Number(m.dp) || 0), 0),
    belumBayar: D.keluar.filter(k => k.status === 'BELUM').reduce((s, k) => s + totalKeluar(k), 0),
    nHari, hM, hK, hN, kM: kum(hM), kK: kum(hK), pHr, pHrN, tren: iAda < 0 ? [] : tren.slice(iAda),
    topPaket: Object.entries(perPaket).sort((a, b) => b[1].v - a[1].v), lalu: L, lblLalu: BULAN[(D.mo + 10) % 12],
    label: BULAN[D.mo - 1] + ' ' + D.y };
  R.catatan = catatanPenting(R);
  return R;
}
const periodeTeks = R => `01/${String(R.mo).padStart(2, '0')}/${R.y} – ${R.nHari}/${String(R.mo).padStart(2, '0')}/${R.y}`;
const persen = (v, t) => t ? Math.round(v / t * 100) : 0;
const naikTurun = (kini, lalu) => { const p = Math.round((kini - lalu) / Math.abs(lalu) * 100); return `${p >= 0 ? 'naik' : 'turun'} ${Math.abs(p)}%`; };

// Poin-poin bahasa biasa: [ikon, teks]
function catatanPenting(R) {
  const c = [], st = S.setelan;
  c.push(['💰', `Laba bersih ${rp(R.laba)} — ${persen(Math.max(R.laba, 0), R.tm)}% dari pemasukan. Investor ${rp(R.investor)}, Kas ${rp(R.kas)}, Studio ${rp(R.studio)}.`]);
  if (R.lalu.ada) c.push(['📈', `Dibanding ${R.lblLalu}: pemasukan ${naikTurun(R.tm, R.lalu.tm)}, pengeluaran ${naikTurun(R.tk, R.lalu.tk)}, laba ${R.lalu.laba ? naikTurun(R.laba, R.lalu.laba) : 'baru tercatat'}.`]);
  const [tp, to] = R.topPaket[0] || ['-', { v: 0, n: 0 }];
  c.push(['⭐', `Penyumbang terbesar: ${tp} — ${rp(to.v)} (${persen(to.v, R.tm)}% pemasukan, ${to.n} transaksi).`]);
  const iHr = R.pHr.indexOf(Math.max(...R.pHr)), iTgl = R.hM.indexOf(Math.max(...R.hM));
  c.push(['📅', `Hari paling ramai: ${HR_PANJANG[iHr]} (${rp(R.pHr[iHr])}). Tanggal tersibuk: ${iTgl + 1} ${BULAN[R.mo - 1]} (${rp(R.hM[iTgl])}).`]);
  const [kk, kv] = Object.entries(R.kat).sort((a, b) => b[1] - a[1])[0];
  c.push(['💸', `Pengeluaran terbesar: ${KAT_LABEL[kk]} ${rp(kv)} (${persen(kv, R.tk)}% pengeluaran).`]);
  const hutang = Object.entries(R.orang).filter(([, o]) => o.belum > 0);
  c.push(hutang.length ? ['⏳', `Fee belum dibayar: ${hutang.map(([n, o]) => `${n} ${rp(o.belum)}`).join(', ')}.`] : ['✔️', 'Semua fee fotografer & editor sudah dibayar.']);
  c.push(['🕒', R.dpList.length ? `DP titipan ${rp(R.dpTotal)} dari ${R.dpList.length} booking — belum dihitung pemasukan.` : 'Tidak ada DP yang belum lunas.']);
  if (R.laba < 0) c.push(['⚠️', `Laba minus ${rp(-R.laba)} — pemasukan belum menutup gaji team ${rp(R.gaji)} + ruko ${rp(R.ruko)}.`]);
  return c;
}

// ---------- teks WhatsApp (bold pakai *…*, bar ▓░ supaya mudah dibaca) ----------
const barTeks = (v, max, n = 10) => { const isi = max > 0 ? Math.max(v > 0 ? 1 : 0, Math.round(Math.max(0, v) / max * n)) : 0; return '▓'.repeat(isi) + '░'.repeat(n - isi); };
function teksWA(R) {
  const st = S.setelan, g = '━━━━━━━━━━━━━━';
  const jual = Object.entries(R.jual).filter(([, o]) => o.n), maxJ = Math.max(...jual.map(([, o]) => o.v), 1);
  const kat = Object.entries(R.kat).filter(([, v]) => v), maxK = Math.max(...kat.map(([, v]) => v), 1);
  return [
    `*CLOSING ${R.label.toUpperCase()}*`, `${st.nama} · ${periodeTeks(R)}`, '',
    `💰 *Pemasukan: ${rp(R.tm)}* (${R.masuk.length} transaksi)${R.lalu.ada ? ` — ${naikTurun(R.tm, R.lalu.tm)} dari ${R.lblLalu}` : ''}`,
    ...jual.map(([k, o]) => `${barTeks(o.v, maxJ)} ${JUAL_LABEL[k]} ${rp(o.v)} · ${persen(o.v, R.tm)}%`),
    '', `💸 *Pengeluaran: ${rp(R.tk)}*`,
    ...kat.flatMap(([k, v]) => [`${barTeks(v, maxK)} ${KAT_LABEL[k]} ${rp(v)} · ${persen(v, R.tk)}%`, ...(k === 'lain' ? rinciOps(R.keluar).map(([n, x]) => `      ◦ ${n} ${rp(x)}`) : [])]),
    g, `*Total bersih: ${rp(R.bersih)}*`,
    `👥 Gaji team (${R.tim.length} orang): −${rp(R.gaji)}`,
    `🏠 Ruko: −${rp(R.ruko)}`,
    `${R.laba >= 0 ? '✅' : '⚠️'} *LABA BERSIH: ${rp(R.laba)}*`, g,
    '📊 *Pembagian laba*',
    `   • Investor ${st.investor}%: ${rp(R.investor)}`,
    `   • Kas ${st.kas}%: ${rp(R.kas)}`,
    `   • Studio ${st.studio}%: ${rp(R.studio)}`, '',
    '🏦 *Posisi uang*',
    `   • Cash: ${rp(R.posisi.cash || 0)}`,
    `   • Transfer BCA: ${rp(R.bca)}`,
    `   • Transfer BRI: ${rp(R.posisi.bri || 0)}`, '',
    '🏆 *Paket terlaris*',
    ...R.topPaket.slice(0, 3).map(([n, o], i) => `   ${i + 1}. ${n} — ${rp(o.v)} (${o.n}×)`), '',
    '📝 *Catatan penting*',
    ...R.catatan.slice(1).map(([ik, t]) => `${ik} ${t}`),
    '', `_Dibuat dari aplikasi ${st.nama}, ${tglPanjang(hariIni)}_`
  ].join('\n');
}

// ---------- PDF (halaman A4 untuk dicetak / disimpan PDF) ----------
function htmlClosing(R) {
  const st = S.setelan;
  const baris = (l, v, cls = '') => `<tr class="${cls}"><td>${l}</td><td class="r tnum">${rp(v)}</td></tr>`;
  const rinciMasuk = barisKelompok(kelompokMasuk(R.masuk), 6, 0, jumlahMasuk, 'transaksi', (m, no) =>
    `<tr><td>${no}</td><td>${esc(tglExcel(m.tanggal))}</td><td>${esc(m.customer)}</td><td>${esc(namaPaket(m))}</td><td>${esc(m.tambahan === 'ADA' ? m.ket : '')}</td><td class="r tnum">${rp(jumlahMasuk(m))}</td></tr>`);
  const rinciKeluar = barisKelompok(kelompokKeluar(R.keluar), 6, 1, totalKeluar, 'catatan', (k, no) =>
    `<tr><td>${no}</td><td>${esc(tglExcel(k.tanggal))}</td><td>${esc(k.nama)}</td><td class="r tnum">${rp(k.nominal)} × ${k.jumlah}</td><td class="r tnum">${rp(totalKeluar(k))}</td><td>${k.status}</td></tr>`);
  const ops = rinciOps(R.keluar);
  const W = 744, W2 = 344, hari = Array.from({ length: R.nHari }, (_, i) => String(i + 1));
  const kurva = grafikGaris({ w: W, h: 200, x: hari, series: [{ nama: 'Pemasukan', warna: WARNA.masuk, data: R.kM }, { nama: 'Pengeluaran', warna: WARNA.keluar, data: R.kK }], tip: () => '' });
  const harian = grafikBatang({ w: W, h: 160, x: hari, data: R.hM, warna: WARNA.masuk, tip: () => '' });
  const hariMinggu = grafikBatang({ w: W2, h: 170, x: HR, data: R.pHr, warna: WARNA.masuk, labelSemua: true, tip: () => '' });
  const tren = R.tren.length >= 2 ? grafikGaris({ w: W2, h: 170, x: R.tren.map(t => BULAN[t.mo - 1].slice(0, 3)), series: [{ nama: 'Masuk', warna: WARNA.masuk, data: R.tren.map(t => t.tm) }, { nama: 'Keluar', warna: WARNA.keluar, data: R.tren.map(t => t.tk) }, { nama: 'Laba', warna: WARNA.laba, data: R.tren.map(t => t.laba) }], tip: () => '' }) : '<p class="cl-cat">Tren muncul setelah ada data minimal 2 bulan.</p>';
  const lgd = items => `<div class="legend">${items.map(([n, w]) => `<span><i style="background:${w}"></i>${n}</span>`).join('')}</div>`;
  return `<article class="closing">
  <header class="cl-head"><img src="icon.svg" alt=""><div><h1>Closing Akhir Bulan</h1><p>${esc(st.nama)} · ${R.label} · Periode ${periodeTeks(R)}</p></div><div class="cl-tgl">Dibuat ${esc(tglPanjang(hariIni))}</div></header>
  <section class="cl-kpi">
    <div><span>Total pemasukan</span><b class="tnum">${rp(R.tm)}</b>${selisih(R.tm, R.lalu.tm, R.lblLalu)}</div>
    <div><span>Total pengeluaran</span><b class="tnum">${rp(R.tk)}</b>${selisih(R.tk, R.lalu.tk, R.lblLalu, true)}</div>
    <div><span>Total bersih</span><b class="tnum">${rp(R.bersih)}</b>${selisih(R.bersih, R.lalu.bersih, R.lblLalu)}</div>
    <div class="utama"><span>Laba bersih</span><b class="tnum">${rp(R.laba)}</b><small>setelah team & ruko</small></div>
  </section>
  <section class="cl-box cl-catatan"><h2>Catatan penting</h2><ul>${R.catatan.map(([ik, t]) => `<li><span>${ik}</span>${esc(t)}</li>`).join('')}</ul></section>
  <section class="cl-dua">
    <div class="cl-box"><h2>Perhitungan laba</h2><table class="cl-t">
      ${baris('Total pemasukan', R.tm)}${baris('Total pengeluaran', -R.tk)}${baris('Total bersih', R.bersih, 'tot')}
      ${baris(`Gaji team (${R.tim.length} orang)`, -R.gaji)}${baris('Ruko', -R.ruko)}${baris('Laba bersih', R.laba, 'tot besar')}
      ${baris(`Investor ${st.investor}%`, R.investor)}${baris(`Kas ${st.kas}%`, R.kas)}${baris(`Studio ${st.studio}%`, R.studio)}</table></div>
    <div class="cl-box"><h2>Dari pemasukan ke laba</h2>${airTerjun([{ nama: 'Pemasukan', nilai: R.tm, tipe: 'awal' }, ...Object.entries(R.kat).filter(([, v]) => v).map(([k, v]) => ({ nama: KAT_LABEL[k], nilai: v, tipe: 'kurang' })), { nama: 'Gaji team', nilai: R.gaji, tipe: 'kurang' }, { nama: 'Ruko', nilai: R.ruko, tipe: 'kurang' }, { nama: 'Laba bersih', nilai: R.laba, tipe: 'akhir' }])}
      ${R.laba > 0 ? `<h2 style="margin-top:12px">Pembagian laba</h2>${batangKomposisi([{ nama: `Investor ${st.investor}%`, nilai: R.investor, warna: WARNA.pas }, { nama: `Kas ${st.kas}%`, nilai: R.kas, warna: WARNA.cetak }, { nama: `Studio ${st.studio}%`, nilai: R.studio, warna: WARNA.paket }])}` : ''}</div>
  </section>
  <section class="cl-tiga">
    <div class="cl-box"><h2>Posisi uang</h2><table class="cl-t">${baris('Cash', R.posisi.cash || 0)}${baris('Transfer BCA', R.bca)}${baris('Transfer BRI', R.posisi.bri || 0)}${baris('Total bersih', R.bersih, 'tot')}</table>
      <p class="cl-cat">BCA = Total bersih − Cash − BRI</p></div>
    <div class="cl-box"><h2>Fee per orang</h2><table class="cl-t"><tr class="th"><td>Nama</td><td class="r">Total</td><td class="r">Belum dibayar</td></tr>
      ${Object.entries(R.orang).sort((a, b) => b[1].total - a[1].total).map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r tnum">${rp(o.total)}</td><td class="r tnum ${o.belum ? 'merah' : ''}">${o.belum ? rp(o.belum) : '—'}</td></tr>`).join('') || '<tr><td colspan="3">Tidak ada fee</td></tr>'}</table></div>
    <div class="cl-box"><h2>DP titipan</h2><table class="cl-t">
      ${R.dpList.map(m => `<tr><td>${esc(m.customer)}<br><small>${esc(tglPendek(m.tglDp || m.tanggal))} · sisa ${rp(sisaTagihan(m))}</small></td><td class="r tnum">${rp(m.dp)}</td></tr>`).join('') || '<tr><td>Tidak ada DP belum lunas</td><td></td></tr>'}
      ${baris('Total DP dipegang', R.dpTotal, 'tot')}</table><p class="cl-cat">Belum dihitung pemasukan sampai lunas.</p></div>
  </section>

  <div class="cl-hal">
  <header class="cl-subhead"><h1>Grafik ${R.label}</h1><p>Sama dengan tab Laporan di aplikasi</p></header>
  <section class="cl-box"><h2>Kurva uang masuk vs keluar</h2><p class="cl-cat" style="margin:-4px 0 4px">kumulatif per tanggal</p>${lgd([['Pemasukan', WARNA.masuk], ['Pengeluaran', WARNA.keluar]])}<div class="chart">${kurva}</div></section>
  <section class="cl-box" style="margin-top:10px"><h2>Pemasukan per tanggal</h2><div class="chart">${harian}</div></section>
  <section class="cl-dua" style="margin-top:10px">
    <div class="cl-box"><h2>Pemasukan per jenis</h2>${batangKomposisi([{ nama: 'Paket', nilai: R.jual.PAKET.v, warna: WARNA.paket }, { nama: 'Pas Photo', nilai: R.jual['PAS PHOTO'].v, warna: WARNA.pas }, { nama: 'Cetak', nilai: R.jual.CETAK.v, warna: WARNA.cetak }])}</div>
    <div class="cl-box"><h2>Pengeluaran per kategori</h2>${batangKomposisi(Object.entries(KAT_LABEL).map(([k, n]) => ({ nama: n, nilai: R.kat[k], warna: { fee: WARNA.fee, edit: WARNA.edit, cetak: WARNA.cetak, lain: WARNA.ops }[k] })))}
      ${ops.length ? `<h2 style="margin-top:12px">Rincian operasional</h2>${batangMendatar(ops.map(([n, v]) => ({ nama: n, nilai: v })), WARNA.ops)}` : ''}</div>
  </section>
  <section class="cl-dua">
    <div class="cl-box"><h2>Paket paling laku</h2>${batangMendatar(R.topPaket.slice(0, 7).map(([n, o]) => ({ nama: n, sub: o.n + '× transaksi', nilai: o.v })), WARNA.paket)}</div>
    <div class="cl-box"><h2>Fee per orang</h2>${Object.keys(R.orang).length ? batangMendatar(Object.entries(R.orang).sort((a, b) => b[1].total - a[1].total).map(([n, o]) => ({ nama: n, sub: o.n + ' catatan', nilai: o.total })), WARNA.fee) : '<p class="cl-cat">Belum ada fee.</p>'}</div>
  </section>
  <section class="cl-dua">
    <div class="cl-box"><h2>Hari paling ramai</h2><div class="chart">${hariMinggu}</div></div>
    <div class="cl-box"><h2>Tren per bulan</h2>${R.tren.length >= 2 ? lgd([['Pemasukan', WARNA.masuk], ['Pengeluaran', WARNA.keluar], ['Laba', WARNA.laba]]) : ''}<div class="chart">${tren}</div></div>
  </section>
  </div>
  <section class="cl-box cl-pecah"><h2>Rincian pemasukan per jenis · ${R.masuk.length} transaksi</h2><table class="cl-t kecil">
    <tr class="th"><td>No</td><td>Tanggal</td><td>Nama</td><td>Paket</td><td>Keterangan</td><td class="r">Total</td></tr>${rinciMasuk}
    <tr class="tot"><td colspan="5">TOTAL PEMASUKAN</td><td class="r tnum">${rp(R.tm)}</td></tr></table></section>
  <section class="cl-box cl-pecah"><h2>Rincian pengeluaran per kategori · ${R.keluar.length} catatan</h2><table class="cl-t kecil">
    <tr class="th"><td>No</td><td>Tanggal</td><td>Pengeluaran</td><td class="r">Harga × jumlah</td><td class="r">Total</td><td>Status</td></tr>${rinciKeluar}
    <tr class="tot"><td colspan="4">TOTAL PENGELUARAN</td><td class="r tnum">${rp(R.tk)}</td><td></td></tr></table></section>
  <section class="cl-dua">
    <div class="cl-box"><h2>Team</h2><table class="cl-t"><tr class="th"><td>No</td><td>Nama</td><td>Posisi</td><td class="r">Sallary</td></tr>
      ${R.tim.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.nama)}</td><td>${esc(t.posisi)}</td><td class="r tnum">${rp(t.gaji)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="3">Total</td><td class="r tnum">${rp(R.gaji)}</td></tr><tr><td colspan="3">Ruko</td><td class="r tnum">${rp(R.ruko)}</td></tr></table></div>
    <div class="cl-box cl-ttd"><h2>Pengesahan</h2><div class="ttd"><div><span>Dibuat oleh</span><i></i><small>Admin</small></div><div><span>Diperiksa</span><i></i><small>Owner</small></div><div><span>Mengetahui</span><i></i><small>Investor</small></div></div></div>
  </section>
</article>`;
}

// ---------- Spreadsheet .xlsx (ExcelJS dimuat saat dibutuhkan) ----------
let exceljsSiap = null;
function muatExcelJS() {
  if (window.ExcelJS) return Promise.resolve();
  return exceljsSiap ||= new Promise((ok, gagal) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    sc.onload = ok; sc.onerror = () => { exceljsSiap = null; gagal(new Error('Perlu internet untuk membuat spreadsheet')); };
    document.head.appendChild(sc);
  });
}

// SVG grafik → PNG (gaya ditanam langsung karena gambar tidak membaca app.css)
const GAYA_SVG = '.grid{stroke:#E8F4F4;stroke-width:1}.nol{stroke:#456264;stroke-dasharray:3 3}.silang{opacity:0}text{font-family:Helvetica,Arial,sans-serif;fill:#102A2C}.ax{fill:#7D9799;font-size:11px}.ax.kuat{fill:#102A2C;font-weight:700}.lbl-nama{font-size:11px;font-weight:600;fill:#456264}.lbl-nilai{font-size:12px;font-weight:800}';
function svgKePng(svg, w, h) {
  return new Promise((ok, gagal) => {
    const src = svg.replace(/^<svg([^>]*)>/, `<svg xmlns="http://www.w3.org/2000/svg"$1><rect width="100%" height="100%" fill="#fff"/><style>${GAYA_SVG}</style>`);
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.scale(2, 2); g.drawImage(img, 0, 0, w, h); ok(c.toDataURL('image/png')); };
    img.onerror = gagal;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  });
}

async function bukuXlsx(p) {
  await muatExcelJS();
  const R = rekapBulan(p), st = S.setelan, wb = new ExcelJS.Workbook();
  wb.creator = st.nama; wb.created = new Date();
  const RP = '"Rp" #,##0;[Red]-"Rp" #,##0', TEAL = 'FF11B3B1', PALE = 'FFE7FDFD', INK = 'FF102A2C';
  const tipis = { style: 'thin', color: { argb: 'FFD5EBEB' } }, garis = { top: tipis, left: tipis, bottom: tipis, right: tipis };
  const kepala = (ws, row) => row.eachCell(c => { c.font = { bold: true, color: { argb: INK } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }; c.border = garis; c.alignment = { vertical: 'middle' }; });
  const judul = (ws, teks, kol) => {
    ws.mergeCells(1, 1, 1, kol); ws.getCell(1, 1).value = teks; ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: INK } };
    ws.mergeCells(2, 1, 2, kol); ws.getCell(2, 1).value = `${st.nama} · ${R.label} · Periode ${periodeTeks(R)}`; ws.getCell(2, 1).font = { color: { argb: 'FF456264' } };
  };
  const tgl = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

  // tulis kelompok: judul kelompok → (sub-judul + subtotal sub) → baris → subtotal kelompok; TOTAL = jumlah subtotal
  const ISI_GRUP = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } };
  function tulisKelompok(sh, groups, nKol, kolTot, satuan, isiBaris) {
    let r = 5; const subtotal = [], rentangItem = [], huruf = String.fromCharCode(64 + kolTot);
    for (const g of groups) {
      sh.mergeCells(r, 1, r, nKol); const h = sh.getCell(r, 1);
      h.value = `${g.judul.toUpperCase()} · ${g.rows.length} ${satuan}`; h.font = { bold: true, color: { argb: INK } }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDEDED' } }; r++;
      const itemRows = []; let no = 0;
      for (const [nama, rows] of g.sub) {
        let rSub = null;
        if (nama) { rSub = r; sh.mergeCells(r, 1, r, kolTot - 1); sh.getCell(r, 1).value = `${nama} · ${rows.length} ${satuan}`; sh.getRow(r).font = { bold: true, italic: true, color: { argb: 'FF0B6B6A' } }; r++; }
        const awal = r;
        rows.forEach(x => { const row = sh.getRow(r); isiBaris(row, x, ++no, r); row.eachCell({ includeEmpty: true }, c => { c.border = garis; }); itemRows.push(r); r++; });
        rentangItem.push(`${huruf}${awal}:${huruf}${r - 1}`);
        if (rSub) { const c = sh.getCell(rSub, kolTot); c.value = { formula: `SUM(${huruf}${awal}:${huruf}${r - 1})`, result: rows.reduce((s2, x) => s2 + (kolTot === 11 ? jumlahMasuk(x) : totalKeluar(x)), 0) }; c.numFmt = RP; }
      }
      sh.mergeCells(r, 1, r, kolTot - 1); sh.getCell(r, 1).value = `Subtotal ${g.judul}`;
      const st = sh.getCell(r, kolTot); st.value = { formula: `SUM(${rentangItem.slice(-g.sub.length).join(',')})`, result: g.total }; st.numFmt = RP;
      sh.getRow(r).font = { bold: true }; sh.getRow(r).eachCell(c => { c.fill = ISI_GRUP; c.border = garis; });
      subtotal.push(`${huruf}${r}`); r += 2;
    }
    sh.mergeCells(r, 1, r, kolTot - 1); sh.getCell(r, 1).value = 'TOTAL';
    const t = sh.getCell(r, kolTot); t.value = { formula: subtotal.length ? subtotal.join('+') : '0', result: groups.reduce((s2, g) => s2 + g.total, 0) }; t.numFmt = RP;
    sh.getRow(r).font = { bold: true, size: 12 }; sh.getRow(r).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6D6' } }; c.border = garis; });
    return { totRow: r, rentangItem, akhir: r - 1 };
  }

  // Pemasukan (dikelompokkan per jenis penjualan; Paket per jenis paket)
  const wm = wb.addWorksheet('Pemasukan', { views: [{ state: 'frozen', ySplit: 4 }] });
  judul(wm, 'RINCIAN PEMASUKAN PER JENIS', 11);
  wm.columns = [{ width: 5 }, { width: 13 }, { width: 8 }, { width: 22 }, { width: 30 }, { width: 6 }, { width: 15 }, { width: 13 }, { width: 30 }, { width: 14 }, { width: 15 }];
  wm.getRow(4).values = ['No', 'Tanggal', 'Waktu', 'Nama', 'Paket', 'Qty', 'Nilai Penjualan', 'Jenis Penjualan', 'Keterangan', 'Nominal', 'Total']; kepala(wm, wm.getRow(4));
  const KM = tulisKelompok(wm, kelompokMasuk(R.masuk), 11, 11, 'transaksi', (row, m, no, r) => {
    row.values = [no, tgl(m.tanggal), m.waktu, m.customer, namaPaket(m), Number(m.qty) || 1, Number(m.nilai) || 0, JUAL_LABEL[m.jenisJual] || m.jenisJual, m.tambahan === 'ADA' ? m.ket : '', nominalOf(m) || null, { formula: `(G${r}+N(J${r}))*F${r}`, result: jumlahMasuk(m) }];
    row.getCell(2).numFmt = 'dd/mm/yyyy'; [7, 10, 11].forEach(c => row.getCell(c).numFmt = RP);
  });
  const totM = KM.totRow;

  // Pengeluaran (per kategori; fee per orang, operasional per pos)
  const wk = wb.addWorksheet('Pengeluaran', { views: [{ state: 'frozen', ySplit: 4 }] });
  judul(wk, 'RINCIAN PENGELUARAN PER KATEGORI', 9);
  wk.columns = [{ width: 5 }, { width: 13 }, { width: 38 }, { width: 16 }, { width: 15 }, { width: 8 }, { width: 15 }, { width: 10 }, { width: 24 }];
  wk.getRow(4).values = ['No', 'Tanggal', 'Pengeluaran', 'Kategori', 'Harga satuan', 'Jumlah', 'Total', 'Status', 'Rincian (orang / pos)']; kepala(wk, wk.getRow(4));
  const KK = tulisKelompok(wk, kelompokKeluar(R.keluar), 9, 7, 'catatan', (row, k, no, r) => {
    const kat = k.jenis || 'lain';
    row.values = [no, tgl(k.tanggal), k.nama, KAT_LABEL[kat], Number(k.nominal) || 0, Number(k.jumlah) || 1, { formula: `E${r}*F${r}`, result: totalKeluar(k) }, k.status, kat === 'lain' ? namaPos(posOps(k)) : (kat === 'fee' || kat === 'edit') ? k.fotografer || '' : ''];
    row.getCell(2).numFmt = 'dd/mm/yyyy'; [5, 7].forEach(c => row.getCell(c).numFmt = RP);
    if (k.status === 'BELUM') row.getCell(8).font = { color: { argb: 'FFB23A2F' }, bold: true };
  });
  const totK = KK.totRow;
  let r;

  // DP titipan
  const wd = wb.addWorksheet('DP titipan');
  judul(wd, 'CATATAN DP (BELUM LUNAS)', 7);
  wd.columns = [{ width: 5 }, { width: 13 }, { width: 22 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }];
  wd.getRow(4).values = ['No', 'Tanggal DP', 'Nama', 'Paket', 'Total booking', 'DP diterima', 'Sisa tagihan']; kepala(wd, wd.getRow(4));
  r = 5;
  R.dpList.forEach((m, i) => {
    const row = wd.getRow(r);
    row.values = [i + 1, tgl(m.tglDp || m.tanggal), m.customer, namaPaket(m), jumlahMasuk(m), Number(m.dp) || 0, { formula: `E${r}-F${r}`, result: sisaTagihan(m) }];
    row.getCell(2).numFmt = 'dd/mm/yyyy'; [5, 6, 7].forEach(c => row.getCell(c).numFmt = RP);
    row.eachCell({ includeEmpty: true }, c => { c.border = garis; }); r++;
  });
  const totD = r;
  wd.getRow(totD).values = ['TOTAL DP DIPEGANG', '', '', '', '', R.dpList.length ? { formula: `SUM(F5:F${totD - 1})`, result: R.dpTotal } : 0, ''];
  wd.mergeCells(totD, 1, totD, 5); wd.getRow(totD).font = { bold: true }; wd.getCell(totD, 6).numFmt = RP;
  wd.getRow(totD).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } }; c.border = garis; });

  // Team
  const wt = wb.addWorksheet('Team');
  judul(wt, 'TEAM & BIAYA TETAP', 4);
  wt.columns = [{ width: 6 }, { width: 22 }, { width: 18 }, { width: 16 }];
  wt.getRow(4).values = ['No.', 'Nama', 'Posisi', 'Sallary']; kepala(wt, wt.getRow(4));
  r = 5;
  R.tim.forEach((t, i) => { const row = wt.getRow(r); row.values = [i + 1, t.nama, t.posisi, Number(t.gaji) || 0]; row.getCell(4).numFmt = RP; row.eachCell(c => { c.border = garis; }); r++; });
  const totT = r;
  wt.getRow(totT).values = ['Total', '', '', { formula: `SUM(D5:D${totT - 1})`, result: R.gaji }]; wt.mergeCells(totT, 1, totT, 3); wt.getRow(totT).font = { bold: true }; wt.getCell(totT, 4).numFmt = RP;
  wt.getRow(totT + 2).values = ['RUKO', '', '', R.ruko]; wt.mergeCells(totT + 2, 1, totT + 2, 3); wt.getRow(totT + 2).font = { bold: true }; wt.getCell(totT + 2, 4).numFmt = RP;

  // Ringkasan (sheet pertama) — angka pakai rumus ke sheet lain
  const ws = wb.addWorksheet('Ringkasan', { properties: { tabColor: { argb: TEAL } } });
  ws.orderNo = 0; wb.views = [{ activeTab: 0 }];   // Ringkasan jadi sheet pertama
  judul(ws, 'CLOSING AKHIR BULAN', 3);
  ws.columns = [{ width: 34 }, { width: 18 }, { width: 30 }];
  const tulis = (row, label, isi, catatan = '', gaya = {}) => {
    const rr = ws.getRow(row); rr.getCell(1).value = label; rr.getCell(2).value = isi; rr.getCell(3).value = catatan;
    rr.getCell(2).numFmt = RP; rr.getCell(3).font = { color: { argb: 'FF7D9799' }, italic: true };
    if (gaya.tebal) [1, 2].forEach(c => rr.getCell(c).font = { bold: true, size: gaya.besar ? 13 : 11 });
    if (gaya.isi) [1, 2, 3].forEach(c => rr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: gaya.isi } });
    [1, 2, 3].forEach(c => rr.getCell(c).border = garis);
  };
  const sub = (row, teks) => { const c = ws.getCell(row, 1); ws.mergeCells(row, 1, row, 3); c.value = teks; c.font = { bold: true, color: { argb: INK } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }; };
  sub(4, 'PERHITUNGAN LABA');
  tulis(5, 'Total pemasukan', { formula: `Pemasukan!K${totM}`, result: R.tm }, `${R.masuk.length} transaksi lunas`);
  tulis(6, 'Total pengeluaran', { formula: `Pengeluaran!G${totK}`, result: R.tk }, `${R.keluar.length} catatan`);
  tulis(7, 'Total bersih', { formula: 'B5-B6', result: R.bersih }, 'pemasukan − pengeluaran', { tebal: true, isi: PALE });
  tulis(8, `Gaji team (${R.tim.length} orang)`, { formula: `Team!D${totT}`, result: R.gaji });
  tulis(9, 'Ruko', { formula: `Team!D${totT + 2}`, result: R.ruko });
  tulis(10, 'LABA BERSIH', { formula: 'B7-B8-B9', result: R.laba }, 'total bersih − team − ruko', { tebal: true, besar: true, isi: 'FFFFF6D6' });
  tulis(11, `Investor ${st.investor}%`, { formula: `B10*${st.investor / 100}`, result: R.investor });
  tulis(12, `Kas ${st.kas}%`, { formula: `B10*${st.kas / 100}`, result: R.kas });
  tulis(13, `Studio ${st.studio}%`, { formula: `B10*${st.studio / 100}`, result: R.studio });
  sub(15, 'POSISI UANG');
  tulis(16, 'Cash', Number(R.posisi.cash) || 0, 'isi manual');
  tulis(17, 'Transfer BRI', Number(R.posisi.bri) || 0, 'isi manual');
  tulis(18, 'Transfer BCA', { formula: 'B7-B16-B17', result: R.bca }, 'total bersih − cash − BRI', { tebal: true });
  tulis(19, 'DP titipan (belum dihitung)', { formula: `'DP titipan'!F${totD}`, result: R.dpTotal }, `${R.dpList.length} booking belum lunas`);
  sub(21, 'PEMASUKAN PER JENIS');
  Object.keys(JUAL_LABEL).forEach((k, i) => tulis(22 + i, JUAL_LABEL[k], { formula: `SUMIF(Pemasukan!H5:H${KM.akhir},"${JUAL_LABEL[k]}",Pemasukan!K5:K${KM.akhir})`, result: R.jual[k].v }, `${R.jual[k].n} transaksi`));
  sub(26, 'PENGELUARAN PER KATEGORI');
  Object.keys(KAT_LABEL).forEach((k, i) => tulis(27 + i, KAT_LABEL[k], { formula: `SUMIF(Pengeluaran!D5:D${KK.akhir},"${KAT_LABEL[k]}",Pengeluaran!G5:G${KK.akhir})`, result: R.kat[k] }));
  sub(32, 'FEE PER ORANG');
  Object.entries(R.orang).sort((a, b) => b[1].total - a[1].total).forEach(([n, o], i) => tulis(33 + i, n, o.total, o.belum ? `belum dibayar ${rp(o.belum)}` : 'lunas'));
  const opsList = rinciOps(R.keluar), barisOps = 34 + Object.keys(R.orang).length;
  if (opsList.length) {
    sub(barisOps, 'RINCIAN OPERASIONAL');
    opsList.forEach(([n, v], i) => tulis(barisOps + 1 + i, n, { formula: `SUMIFS(Pengeluaran!G5:G${KK.akhir},Pengeluaran!D5:D${KK.akhir},"Operasional",Pengeluaran!I5:I${KK.akhir},"${n}")`, result: v }, `${persen(v, R.kat.lain)}% dari operasional`));
  }
  // bar warna di dalam sel supaya angka besar/kecil langsung terlihat
  const bar = (sheet, ref, argb) => sheet.addConditionalFormatting({ ref, rules: [{ type: 'dataBar', gradient: false, color: { argb }, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }] }] });
  bar(ws, 'B22:B24', 'FF0E9F9D'); bar(ws, 'B27:B30', 'FFD9674C');
  if (Object.keys(R.orang).length) bar(ws, `B33:B${32 + Object.keys(R.orang).length}`, 'FF3E6FB0');
  KM.rentangItem.forEach(ref => bar(wm, ref, 'FF0E9F9D'));
  KK.rentangItem.forEach(ref => bar(wk, ref, 'FFD9674C'));
  if (opsList.length) bar(ws, `B${barisOps + 1}:B${barisOps + opsList.length}`, 'FFD9674C');

  // sheet Grafik: gambar grafik yang sama dengan tab Laporan
  const wg = wb.addWorksheet('Grafik');
  judul(wg, 'GRAFIK BULAN INI', 10);
  const hari = Array.from({ length: R.nHari }, (_, i) => String(i + 1));
  const daftar = [
    ['Kurva uang masuk (tosca) vs keluar (koral) — kumulatif', grafikGaris({ w: 760, h: 260, x: hari, series: [{ nama: 'Pemasukan', warna: WARNA.masuk, data: R.kM }, { nama: 'Pengeluaran', warna: WARNA.keluar, data: R.kK }], tip: () => '' }), 760, 260],
    ['Pemasukan per tanggal', grafikBatang({ w: 760, h: 220, x: hari, data: R.hM, warna: WARNA.masuk, tip: () => '' }), 760, 220],
    ['Hari paling ramai (pemasukan per hari dalam minggu)', grafikBatang({ w: 520, h: 220, x: HR, data: R.pHr, warna: WARNA.masuk, labelSemua: true, tip: () => '' }), 520, 220]
  ];
  if (R.tren.length >= 2) daftar.push(['Tren per bulan — pemasukan, pengeluaran, laba', grafikGaris({ w: 620, h: 240, x: R.tren.map(t => BULAN[t.mo - 1].slice(0, 3)), series: [{ nama: 'Masuk', warna: WARNA.masuk, data: R.tren.map(t => t.tm) }, { nama: 'Keluar', warna: WARNA.keluar, data: R.tren.map(t => t.tk) }, { nama: 'Laba', warna: WARNA.laba, data: R.tren.map(t => t.laba) }], tip: () => '' }), 620, 240]);
  let baris = 4;
  for (const [teks, svg, w, h] of daftar) {
    wg.getCell(baris, 1).value = teks; wg.getCell(baris, 1).font = { bold: true, color: { argb: INK } };
    const id = wb.addImage({ base64: await svgKePng(svg, w, h), extension: 'png' });
    wg.addImage(id, { tl: { col: 0, row: baris }, ext: { width: w, height: h } });
    baris += Math.ceil(h / 20) + 3;
  }
  wg.orderNo = 0.5;   // tepat setelah Ringkasan
  return { wb, R };
}

async function unduhXlsx(p) {
  try {
    toast('Menyiapkan spreadsheet…');
    const { wb, R } = await bukuXlsx(p);
    const buf = await wb.xlsx.writeBuffer();
    unduh(`Closing_${R.label.replace(' ', '_')}_${S.setelan.nama.replace(/\s+/g, '')}.xlsx`, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (e) { toast(e.message || 'Gagal membuat spreadsheet'); }
}

function cetakClosing(p) {
  let el = document.getElementById('closingCetak');
  if (!el) { el = document.createElement('div'); el.id = 'closingCetak'; document.body.appendChild(el); }
  el.innerHTML = htmlClosing(rekapBulan(p));
  document.body.classList.add('cetak-closing');
  const lepas = () => { document.body.classList.remove('cetak-closing'); removeEventListener('afterprint', lepas); };
  addEventListener('afterprint', lepas);
  setTimeout(() => window.print(), 150);
}

function bukaWA(p) {
  const t = teksWA(rekapBulan(p));
  formJenis = null;
  bukaModal(`<div class="sheet-head"><h2>Teks closing WhatsApp</h2><button class="x" data-act="tutup" aria-label="Tutup">×</button></div>
  <div class="sheet-body"><textarea class="wa-teks" id="waTeks" readonly>${esc(t)}</textarea></div>
  <div class="sheet-foot"><span class="spacer"></span><button class="btn" data-act="salinWA">Salin teks</button><a class="btn btn-utama" href="https://wa.me/?text=${encodeURIComponent(t)}" target="_blank" rel="noopener">Kirim lewat WhatsApp</a></div>`);
}

Object.assign(AKSI, {
  closingXlsx: () => unduhXlsx(periode),
  closingPdf: () => cetakClosing(periode),
  closingWa: () => bukaWA(periode),
  salinWA: async () => {
    const ta = document.getElementById('waTeks');
    try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
    toast('Teks closing disalin');
  }
});

// ?closing=YYYY-MM → halaman closing saja (dipakai untuk membuat PDF tanpa membuka aplikasi)
(() => {
  const p = new URLSearchParams(location.search).get('closing');
  if (!/^\d{4}-\d{2}$/.test(p || '')) return;
  document.body.classList.add('mode-closing');
  $('#view').innerHTML = htmlClosing(rekapBulan(p));
})();
