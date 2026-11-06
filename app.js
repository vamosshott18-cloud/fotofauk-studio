'use strict';
// Studio Foto — salinan alur AppSheet "Laporan FotoFauk Studio" (Jadwal, Pemasukan, Pengeluaran, Laba Bersih, Paket Studio)
// ditambah pembagian otomatis: fee fotografer, fee edit, dan biaya cetak (harga rekanan) langsung masuk Pengeluaran.
// Semua data disimpan di localStorage perangkat ini; backup/restore lewat file JSON.

const KEY = 'studiofoto_v2';
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const rp = n => (n < 0 ? '−' : '') + 'Rp ' + Math.abs(Math.round(n || 0)).toLocaleString('id-ID');
const angka = s => parseInt(String(s ?? '').replace(/\D/g, ''), 10) || 0;
const titik = n => n ? Math.abs(Number(n)).toLocaleString('id-ID') : '';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_UP = BULAN.map(b => b.toUpperCase());
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const keTgl = s => new Date(s + 'T00:00');
const tglPanjang = s => { const d = keTgl(s); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); };
const tglPendek = s => { const d = keTgl(s); return d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3); };
const menit = j => { const [h, m] = String(j || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const jamSekarang = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const bulanDari = tgl => BULAN_UP[keTgl(tgl).getMonth()];
const naik500 = n => Math.ceil(n / 500) * 500;

const STATUS_JADWAL = ['Belum Foto', 'Sudah Foto Belum Edit', 'Sudah Edit Belum Upload', 'Sudah Upload Belum Kirim', 'Selesai'];
const JENIS_JUAL = ['PAKET', 'PAS PHOTO', 'CETAK'];
const TIPE_TAMBAH = { diskon: 'Diskon', dp: 'DP / pelunasan', tambah: 'Biaya tambahan' };
const ADDON_AWAL = [{ id: 'orang', nama: 'Tambah orang', satuan: 'orang', harga: 30000 }, { id: 'sesi', nama: 'Tambah sesi', satuan: 'sesi', harga: 50000 }, { id: 'wisudawan', nama: 'Tambah wisudawan', satuan: 'wisudawan', harga: 150000 }];
// Pos operasional: ditebak dari nama pengeluaran kalau tidak dipilih manual (k.pos)
const POS_OPS = [
  ['listrik', 'Listrik & air', /listrik|pln|token|pdam|\bair\b/i],
  ['konsumsi', 'Galon & konsumsi', /galon|aqua|minum|makan|snack|kopi|konsumsi/i],
  ['perlengkapan', 'Kebersihan & perlengkapan', /pembersih|superpel|pel\b|pewangi|sabun|tisu|lakban|atk|kertas|plastik|baterai|lampu|alat/i],
  ['internet', 'Internet & pulsa', /wifi|internet|pulsa|kuota|indihome/i],
  ['transport', 'Transport', /bensin|parkir|ojek|grab|gojek|transport|bbm/i],
  ['owner', 'Ambil owner', /fauk|prive|owner/i],
  ['lainnya', 'Lainnya', /.^/]
];
const posOps = k => k.pos || (POS_OPS.find(([, , re]) => re.test(k.nama || '')) || POS_OPS[POS_OPS.length - 1])[0];
const namaPos = id => (POS_OPS.find(p => p[0] === id) || POS_OPS[POS_OPS.length - 1])[1];
// Ukuran cetak di pengeluaran; detail (bingkai, canvas, bahan) ditulis di keterangan
const UKURAN_CETAK = ['4R', '10R', '12R', '16R', '18R', '20R', '20Rs', '24R'];
const namaCetakKeluar = d => `Cetak ${(d.cUkuran || []).join(', ')}`;   // boleh lebih dari satu ukuran
const KOLOM_CETAK = ['Cetak', 'Canvas', '+ Canvas', '+ Bingkai 3cm', '+ Bingkai 3cm + Linen', '+ Bingkai 4,5cm', '+ Bingkai 4,5cm + Linen', '+ Bingkai 6cm', '+ Bingkai 6cm + Linen'];

function dataAwal() {
  // Paket Studio, harga rekanan cetak (Zee photograph) dan transaksi Nov 2026 disalin dari AppSheet/Sheet "Laporan".
  const k = 1000;
  const paket = [
    ['Paket Pas Photo', 'Paket 1', 35], ['Paket Pas Photo', 'Paket 2', 35], ['Paket Pas Photo', 'Paket 3', 35], ['Paket Pas Photo', 'Paket 4', 35], ['Paket Pas Photo', 'Paket 5', 35], ['Paket Pas Photo', 'Paket 6', 35],
    ['Paket Pas Photo Couple', 'Paket 1', 50], ['Paket Pas Photo Couple', 'Paket 2', 50], ['Paket Pas Photo Couple', 'Paket 3', 50], ['Paket Pas Photo Couple', 'Paket 4', 50], ['Paket Pas Photo Couple', 'Paket 5', 50],
    ['Paket Wisuda Outdoor', 'Paket 1', 350], ['Paket Wisuda Outdoor', 'Paket 2', 500], ['Paket Wisuda Outdoor', 'Paket 3', 750],
    ['Paket Wisuda', 'Paket 1', 350], ['Paket Wisuda', 'Paket 2', 550], ['Paket Wisuda', 'Paket 3', 750], ['Paket Wisuda', 'Paket 4', 1000],
    ['Paket Grup', 'Paket 1', 150], ['Paket Grup', 'Paket 2', 300], ['Paket Grup', 'Paket 3', 500], ['Paket Grup', 'Paket 4', 700],
    ['Paket Personal', 'Paket 1', 150], ['Paket Personal', 'Paket 2', 250], ['Paket Personal', 'Paket 3', 550],
    ['Paket Couple', 'Paket 1', 250], ['Paket Couple', 'Paket 2', 550],
    ['Paket Keluarga', 'Paket 1', 350], ['Paket Keluarga', 'Paket 2', 550], ['Paket Keluarga', 'Paket 3', 850], ['Paket Keluarga', 'Paket 4', 1250],
    ['Paket Maternity', 'Paket 1', 350], ['Paket Maternity', 'Paket 2', 550],
    ['Paket Engagement', 'Paket 1', 1000], ['Paket Engagement', 'Paket 2', 1500], ['Paket Engagement', 'Paket 3', 2500], ['Paket Engagement', 'Paket 4', 3000],
    ['Paket Prewedding', 'Indoor 1', 850], ['Paket Prewedding', 'Indoor 2', 1250], ['Paket Prewedding', 'Outdoor 1', 2200], ['Paket Prewedding', 'Outdoor 2', 3000],
    ['Paket Wedding', 'BRONZE', 2000], ['Paket Wedding', 'SILVER', 2500], ['Paket Wedding', 'GOLD', 4500], ['Paket Wedding', 'PLATINUM', 6500],
    ['Paket Dokumentasi', 'Custom', 0],
    ['Paket Sport', 'Paket 1', 550], ['Paket Sport', 'Paket 2', 750], ['Paket Sport', 'Paket 3', 950]
  ].map(([jenis, nama, h], i) => ({ id: 'p' + i, jenis, paket: nama, harga: h * k, ...feeAwal(jenis, nama) }));
  const harga = window.SEED_HARGA_CETAK || {};   // harga rekanan (Zee) ada di seed lokal, tidak dipublikasikan

  // Data asli (AppSheet Nov, Excel Okt) hanya ada di seed_*.js lokal — tidak ikut ke GitHub publik.
  const N = window.SEED_NOVEMBER || { masuk: [], keluar: [] };
  const masuk = N.masuk.map(m => ({ ...m, id: uid() })), keluar = N.keluar.map(k => ({ ...k, id: uid() }));
  const s = {
    versi: 2,
    setelan: { nama: 'FotoFauk Studio', ruko: N.ruko || 0, investor: 40, studio: 40, kas: 20, feeDefault: 25, dpPersen: 30, tim: [] },
    paket, cetakHarga: harga,
    fotografer: N.fotografer || [], editor: N.editor || [],
    addon: ADDON_AWAL.map(a => ({ ...a })),
    jadwal: [], masuk, keluar, posisiKas: {}, impor: N.masuk.length ? ['nov-appsheet'] : []
  };
  tambahImpor(s);
  return s;
}

// Laporan Bulanan Oktober 2026 (Excel) masuk sekali saja; tim & posisi kas ikut dari laporan itu.
function tambahImpor(s) {
  const O = window.SEED_OKTOBER;
  if (!O || s.impor.includes('okt-xlsx')) return;
  O.masuk.forEach(m => s.masuk.push({ ...m, id: uid(), fotografer: '', feeRp: 0, editor: '', feeEdit: 0, cetak: [], impor: true }));
  O.keluar.forEach(k => s.keluar.push({ ...k, id: uid(), dari: '' }));
  s.posisiKas['2026-10'] = O.kas;
  if (!s.setelan.tim || !s.setelan.tim.length) s.setelan.tim = O.tim.map(t => ({ ...t }));
  s.impor.push('okt-xlsx');
}

// Aturan fee Fadlan: Paket 1 = 20%, paket lain = 25%; Pas Photo tetap Rp 10.000 (pola data AppSheet).
function feeAwal(jenis, nama) {
  if (/pas photo/i.test(jenis)) return { feeTipe: 'nominal', fee: 10000 };
  return { feeTipe: 'persen', fee: /^paket 1$/i.test(String(nama).trim()) ? 20 : 25 };
}

function muat() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.versi === 2) {
      s.paket.forEach(p => { if (p.fee == null) Object.assign(p, feeAwal(p.jenis, p.paket)); }); delete s.feeAturan;
      s.impor ||= ['nov-appsheet']; s.posisiKas ||= {}; delete s.setelan.gaji; s.setelan.dpPersen ??= 30; s.addon ||= ADDON_AWAL.map(a => ({ ...a }));
      tambahImpor(s); return s;
    }
  } catch (e) {}
  return dataAwal();
}
let S = muat();
function simpan() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Gagal menyimpan di perangkat ini'); } window.setelahSimpan?.(); }
function ui(k, v) { try { if (v === undefined) return localStorage.getItem('sf_' + k); localStorage.setItem('sf_' + k, v); } catch (e) {} }

const hariIni = iso(new Date());
let tab = ui('tab') || 'beranda';
if (!['beranda', 'jadwal', 'kas', 'masuk', 'keluar', 'laba', 'atur'].includes(tab)) tab = 'beranda';
let filterKas = 'semua', cari = '', animasi = true;
let hariPilih = hariIni;
let bulanKal = keTgl(hariIni.slice(0, 8) + '01');
let periode = hariIni.slice(0, 7); // 'YYYY-MM' atau 'semua'
let filterKeluar = 'semua';

const daftarJenis = () => [...new Set(S.paket.map(p => p.jenis.trim()))];
const paketDari = jenis => S.paket.filter(p => p.jenis.trim() === jenis);
const cariPaket = (jenis, nama) => S.paket.find(p => p.jenis.trim() === jenis && p.paket === nama);
const aturanFee = (jenis, paket) => { const p = cariPaket(jenis, paket); return p ? { tipe: p.feeTipe, nilai: Number(p.fee) || 0 } : { tipe: 'persen', nilai: Number(S.setelan.feeDefault) || 25 }; };
// Add-on booking: jumlah per jenis × harga satuan (harga dari Atur → Add-on)
const addonRinci = j => S.addon.map(a => ({ ...a, qty: Number(j.addon?.[a.id]) || 0 })).filter(a => a.qty > 0);
const addonManual = j => (j.addonManual || []).filter(a => (a.nama || '').trim() || Number(a.harga));   // add-on lain, nama & harga diketik
const addonTotal = j => addonRinci(j).reduce((s, a) => s + a.qty * a.harga, 0) + addonManual(j).reduce((s, a) => s + (Number(a.harga) || 0), 0);
const addonTeks = j => [...addonRinci(j).map(a => `+${a.qty} ${a.satuan}`), ...addonManual(j).map(a => '+' + (a.nama.trim() || 'add-on'))].join(', ');
const addonKet = j => [...addonRinci(j).map(a => `tambah ${a.qty} ${a.satuan}`), ...addonManual(j).map(a => a.nama.trim() || 'add-on')].join(' + ');
const totalBooking = j => (cariPaket(j.jenis, j.paket)?.harga || 0) + addonTotal(j);
// Sistem DP: pemasukan berstatus 'dp' tidak dihitung pemasukan bulan itu, tapi masuk Catatan DP.
// Saat lunas, total penuh dicatat di bulan pelunasan (tanggal & laporan bulan pindah ke tanggal lunas).
const sudahLunas = m => m.bayar !== 'dp';
const dpOtomatis = m => naik500(Math.max(0, jumlahMasuk(m)) * (Number(S.setelan.dpPersen) || 0) / 100);
const sisaTagihan = m => Math.max(0, jumlahMasuk(m) - (Number(m.dp) || 0));
function dataDp(p) {
  const semua = S.masuk.filter(m => m.bayar === 'dp').sort((a, b) => (a.tglDp || a.tanggal).localeCompare(b.tglDp || b.tanggal));
  if (p === 'semua') return { ini: semua, lama: [], semua };
  const [y, mo] = p.split('-').map(Number), awal = `${p}-01`, akhir = iso(new Date(y, mo, 0));
  const tgl = m => m.tglDp || m.tanggal;
  return { ini: semua.filter(m => tgl(m) >= awal && tgl(m) <= akhir), lama: semua.filter(m => tgl(m) < awal), semua };
}
const dalamPeriode = r => periode === 'semua' || (r.bulan === BULAN_UP[Number(periode.slice(5)) - 1] && r.tanggal.slice(0, 4) === periode.slice(0, 4));

// Rumus AppSheet: Jumlah = ([Nilai Penjualan]+[Nominal]) * [Jumlah Paket]
const nominalOf = m => m.tambahan === 'ADA' ? Number(m.nominal) || 0 : 0;
const jumlahMasuk = m => ((Number(m.nilai) || 0) + nominalOf(m)) * (Number(m.qty) || 0);
const totalKeluar = k => (Number(k.nominal) || 0) * (Number(k.jumlah) || 0);
// Dasar fee: harga setelah diskon/biaya tambahan, tapi DP bulan lalu tidak mengurangi fee (pola data Nov 2026).
const dasarFee = m => ((Number(m.nilai) || 0) + (m.tipeTambah === 'dp' ? 0 : nominalOf(m))) * (Number(m.qty) || 0);
function feeOtomatis(m) {
  if (!m.fotografer || m.jenisJual === 'CETAK') return 0;
  const a = aturanFee(m.jenis, m.paket);
  return a.tipe === 'nominal' ? Number(a.nilai) * (Number(m.qty) || 1) : naik500(Math.max(0, dasarFee(m)) * Number(a.nilai) / 100);
}
const biayaCetak = m => (m.cetak || []).reduce((s, c) => s + (Number(c.harga) || 0) * (Number(c.qty) || 0), 0);

function rincianMasuk(m) {
  const jumlah = jumlahMasuk(m), cetak = biayaCetak(m), fee = m.fotografer ? Number(m.feeRp) || 0 : 0, edit = m.editor ? Number(m.feeEdit) || 0 : 0;
  return { jumlah, cetak, fee, edit, studio: jumlah - cetak - fee - edit };
}

// Rumus Laporan Bulanan: Total Bersih = Pemasukan − Pengeluaran; Laba = Total Bersih − gaji tim − ruko; lalu 40/20/40.
function dataBulan(p) {
  const st = S.setelan, [y, mo] = p.split('-').map(Number), B = BULAN_UP[mo - 1];
  const ok = r => r.bulan === B && r.tanggal.slice(0, 4) === String(y);
  const masuk = S.masuk.filter(ok).filter(sudahLunas).sort((a, b) => (a.tanggal + a.waktu).localeCompare(b.tanggal + b.waktu));
  const keluar = S.keluar.filter(ok).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const tm = masuk.reduce((s, m) => s + jumlahMasuk(m), 0), tk = keluar.reduce((s, k) => s + totalKeluar(k), 0);
  const tim = st.tim || [], gaji = tim.reduce((s, t) => s + (Number(t.gaji) || 0), 0), ruko = Number(st.ruko) || 0;
  const bersih = tm - tk, laba = bersih - gaji - ruko;
  return { p, y, mo, masuk, keluar, tm, tk, bersih, tim, gaji, ruko, laba, ada: masuk.length + keluar.length > 0,
    investor: laba * st.investor / 100, kas: laba * st.kas / 100, studio: laba * st.studio / 100 };
}

// ---------- render ----------
// Nama studio ditulis gaya logo: "FotoFauk Studio" → fotofauk.studio
const namaLogo = n => { const p = String(n || 'Studio Foto').trim().toLowerCase().split(/\s+/); return esc(p.slice(0, -1).join('')) + (p.length > 1 ? '<b>.</b>' : '') + esc(p[p.length - 1]); };
const FONT_UI = ['Nunito', 'Plus Jakarta Sans', 'Poppins'];
function render() {
  document.documentElement.style.setProperty('--font-ui', `"${S.setelan.font || 'Nunito'}"`);
  $('#namaStudio').innerHTML = namaLogo(S.setelan.nama);
  document.title = S.setelan.nama || 'Studio Foto';
  const navAktif = tab === 'masuk' || tab === 'keluar' ? 'kas' : tab;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === navAktif));
  const v = { beranda: viewBeranda, jadwal: viewJadwal, kas: viewKas, masuk: viewMasuk, keluar: viewKeluar, laba: viewLaporan, atur: viewAtur }[tab] || viewBeranda;
  const view = $('#view');
  view.innerHTML = v();
  view.classList.toggle('animasi', animasi); animasi = false;   // animasi masuk hanya saat pindah halaman
  if (tab === 'laba') gambarGrafik();
  view.querySelectorAll('[data-hitung]').forEach(hitungNaik);
  const ct = $('#cariTop'); if (ct && document.activeElement !== ct) ct.value = cari;
}
// angka berjalan naik (ease-out ~0,9 dtk)
function hitungNaik(el) {
  const t = Number(el.dataset.hitung) || 0, mulai = performance.now();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !el.closest('.animasi')) { el.textContent = rp(t); return; }
  (function f(n) { const p = Math.min(1, (n - mulai) / 900), e = 1 - Math.pow(1 - p, 3); el.textContent = rp(t * e); if (p < 1) requestAnimationFrame(f); })(mulai);
}

function pilihPeriode(denganSemua) {
  const label = periode === 'semua' ? 'Semua bulan' : BULAN[Number(periode.slice(5)) - 1] + ' ' + periode.slice(0, 4);
  return `<div class="periode">
    <button class="btn btn-ikon" data-act="geserPeriode" data-d="-1" aria-label="Bulan sebelumnya" ${periode === 'semua' ? 'disabled' : ''}>‹</button>
    <b>${label}</b>
    <button class="btn btn-ikon" data-act="geserPeriode" data-d="1" aria-label="Bulan berikutnya" ${periode === 'semua' ? 'disabled' : ''}>›</button>
    ${denganSemua ? `<button class="btn btn-kecil ${periode === 'semua' ? 'btn-utama' : ''}" data-act="periodeSemua">${periode === 'semua' ? 'Per bulan' : 'Semua bulan'}</button>` : ''}
  </div>`;
}

function kartuJadwal(j, tampilTgl) {
  const mj = S.masuk.find(m => m.jadwalId === j.id);
  const i = STATUS_JADWAL.indexOf(j.status);
  return `<div class="bk" role="button" tabindex="0" data-act="editJadwal" data-id="${j.id}">
    <div class="bk-jam tnum">${esc(j.jam || '--:--')}<small>${tampilTgl ? esc(tglPendek(j.tanggal)) : esc(j.fotografer || '—')}</small></div>
    <div class="bk-isi"><b>${esc(j.customer)}</b><span>${esc(j.jenis)} · ${esc(j.paket)}${addonTeks(j) ? ' · ' + esc(addonTeks(j)) : ''}${tampilTgl ? ' · ' + esc(j.fotografer || '—') : ''}${j.tglBooking ? ' · booking ' + esc(tglPendek(j.tglBooking)) : ''}</span>
      <div class="chips"><span class="chip st${i}">${esc(j.status)}</span>${mj ? (mj.bayar === 'dp' ? `<span class="chip dp">DP ${rp(mj.dp)}</span><button class="chip-btn" data-act="bukaLunas" data-id="${mj.id}">Lunas</button>` : '<span class="chip ok">Lunas</span>') : `<button class="chip-btn" data-act="dpKartu" data-id="${j.id}">+ DP</button>`}</div></div>
    <div class="bk-rp tnum">${rp(totalBooking(j))}</div>
  </div>`;
}

function viewJadwal() {
  const y = bulanKal.getFullYear(), m = bulanKal.getMonth();
  const awal = (new Date(y, m, 1).getDay() + 6) % 7; // mulai Senin
  const jml = new Date(y, m + 1, 0).getDate();
  const perHari = {};
  S.jadwal.forEach(j => { perHari[j.tanggal] = (perHari[j.tanggal] || 0) + 1; });
  let sel = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(h => `<div class="hd">${h}</div>`).join('');
  for (let i = 0; i < awal; i++) sel += '<div></div>';
  for (let d = 1; d <= jml; d++) {
    const t = iso(new Date(y, m, d)), n = perHari[t] || 0;
    const cls = [t === hariIni && 'hari-ini', t === hariPilih && 'pilih', new Date(y, m, d).getDay() === 0 && 'minggu'].filter(Boolean).join(' ');
    const dot = n ? (n <= 3 ? '<i></i>'.repeat(n) : '<i></i><span class="lebih">+' + (n - 1) + '</span>') : '';
    sel += `<button class="${cls}" data-act="pilihHari" data-tgl="${t}"><span class="tnum">${d}</span><span class="dot">${dot}</span></button>`;
  }
  const kunci = iso(new Date(y, m, 1)).slice(0, 7);
  const bln = S.jadwal.filter(j => j.tanggal.startsWith(kunci));
  const hari = S.jadwal.filter(j => j.tanggal === hariPilih).sort((a, b) => menit(a.jam) - menit(b.jam));
  const belum = S.jadwal.filter(j => j.status !== 'Selesai' && j.tanggal !== hariPilih)
    .sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam)).slice(0, 8);

  return `<div class="jadwal">
    <section class="card">
      <div class="kal-head">
        <button class="btn btn-ikon" data-act="bulanKal" data-d="-1" aria-label="Bulan sebelumnya">‹</button>
        <h2>${BULAN[m]} ${y}</h2>
        <button class="btn btn-kecil" data-act="keHariIni">Hari ini</button>
        <button class="btn btn-ikon" data-act="bulanKal" data-d="1" aria-label="Bulan berikutnya">›</button>
      </div>
      <div class="kal">${sel}</div>
      <div class="ringkas-hari">
        <div class="mini"><b class="tnum">${bln.length}</b><span>jadwal bulan ini</span></div>
        <div class="mini"><b class="tnum">${bln.filter(j => j.status !== 'Selesai').length}</b><span>belum selesai</span></div>
      </div>
    </section>
    <section>
      <div class="card">
        <div class="hari-head"><h2>${esc(tglPanjang(hariPilih))}</h2><button class="btn btn-utama btn-kecil" data-act="tambah">+ Jadwal</button></div>
        <div class="daftar">${hari.length ? hari.map(j => kartuJadwal(j)).join('') : '<div class="kosong">Belum ada jadwal di tanggal ini.</div>'}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <h2>Belum selesai</h2>
        <div class="daftar">${belum.length ? belum.map(j => kartuJadwal(j, true)).join('') : '<div class="kosong">Semua jadwal sudah selesai.</div>'}</div>
      </div>
    </section>
  </div>`;
}

// ---------- Beranda (gaya super-app) ----------
const IKON = {
  jadwal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  masuk: '<path d="M17 7L7 17M7 9v8h8"/>', keluar: '<path d="M7 17L17 7M9 7h8v8"/>',
  dp: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>', fee: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M18 19a5 5 0 0 0-2.5-4.3"/>',
  laporan: '<path d="M5 20V11M12 20V5M19 20v-6"/>', closing: '<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z"/><path d="M10 8h4M10 12h4"/>',
  atur: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  lunas: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
  booking: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M12 11v6M9 14h6"/>'
};
const ikon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON[k]}</svg>`;

function viewBeranda() {
  const p = hariIni.slice(0, 7), D = dataBulan(p), dp = dataDp(p), dpList = [...dp.ini, ...dp.lama];
  const hariIniList = S.jadwal.filter(j => j.tanggal === hariIni).sort((a, b) => menit(a.jam) - menit(b.jam));
  const besok = iso(new Date(Date.now() + 864e5)), besokList = S.jadwal.filter(j => j.tanggal === besok);
  const feeBelum = S.keluar.filter(k => k.status === 'BELUM' && (k.jenis === 'fee' || k.jenis === 'edit'));
  const jam = new Date().getHours(), sapa = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 19 ? 'Selamat sore' : 'Selamat malam';
  const menu = [['jadwal', 'Jadwal', 'a1', 'buka', 'jadwal'], ['masuk', 'Pemasukan', 'a1', 'buka', 'masuk'], ['keluar', 'Pengeluaran', 'a4', 'buka', 'keluar'], ['dp', 'DP', 'a3', 'bukaKas', 'dp'],
    ['fee', 'Fee', 'a2', 'bukaFee', ''], ['laporan', 'Laporan', 'a2', 'buka', 'laba'], ['closing', 'Closing', 'a3', 'buka', 'laba'], ['atur', 'Atur', 'a4', 'buka', 'atur']];
  const baris = j => { const mj = pemasukanJadwal(j); return `<div class="br-row tk" role="button" tabindex="0" data-act="editJadwal" data-id="${j.id}"><span class="br-jam">${esc(j.jam || '--:--')}</span><span class="br-isi"><b>${esc(j.customer)}</b><small>${esc(j.jenis.replace(/^Paket /, ''))} · ${esc(j.paket)}</small></span>${mj ? (mj.bayar === 'dp' ? '<span class="pil dp">DP</span>' : '<span class="pil ok">Lunas</span>') : '<span class="pil">Belum bayar</span>'}</div>`; };
  const kas = itemKas('semua', p).slice(0, 5);
  return `<div class="beranda">
  <label class="cari-hp"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="cariBeranda" type="search" placeholder="Cari customer, paket, pengeluaran" autocomplete="off"></label>
  <div class="sapa"><b>${sapa} <span class="lambai">👋</span></b><small>${esc(tglPanjang(hariIni))}</small></div>
  <section class="saldo">
    <small>Bersih ${BULAN[D.mo - 1]}</small>
    <b data-hitung="${D.bersih}">${rp(D.bersih)}</b>
    <div class="saldo-sub"><span>Masuk ${rpS(D.tm)}</span><span>Keluar ${rpS(D.tk)}</span>${dpList.length ? `<span>DP titipan ${rpS(dpList.reduce((s, m) => s + (Number(m.dp) || 0), 0))}</span>` : ''}</div>
    <div class="aksi-cepat">
      <button class="tk" data-act="tambahJenis" data-v="jadwal">${ikon('booking')}<span>Booking</span></button>
      <button class="tk" data-act="tambahJenis" data-v="masuk">${ikon('masuk')}<span>Masuk</span></button>
      <button class="tk" data-act="tambahJenis" data-v="keluar">${ikon('keluar')}<span>Keluar</span></button>
      <button class="tk" data-act="buka" data-v="laba">${ikon('closing')}<span>Closing</span></button>
    </div>
  </section>
  <section class="menu-ikon">${menu.map(([k, n, w, act, v], i) => `<button class="tk" data-act="${act}" data-v="${v}" style="--i:${i}"><i class="${w}">${ikon(k)}</i><span>${n}</span></button>`).join('')}</section>
  <div class="br-dua">
    <section class="br-kartu"><div class="br-head"><h2>Hari ini</h2><button class="link" data-act="buka" data-v="jadwal">Lihat jadwal</button></div>
      ${hariIniList.length ? hariIniList.map(baris).join('') : '<p class="br-kosong">Belum ada jadwal hari ini.</p>'}
      ${besokList.length ? `<div class="br-sub">Besok · ${besokList.length} jadwal</div>${besokList.slice(0, 3).map(baris).join('')}` : ''}
      ${feeBelum.length || dpList.length ? `<div class="br-sub">Perlu tindakan</div>
        ${feeBelum.length ? `<div class="br-row tk" role="button" tabindex="0" data-act="bukaFee"><span class="br-dot merah"></span><span class="br-isi"><b>${feeBelum.length} fee belum dibayar</b><small>${rp(feeBelum.reduce((s, k) => s + totalKeluar(k), 0))}</small></span><span class="panah">›</span></div>` : ''}
        ${dpList.length ? `<div class="br-row tk" role="button" tabindex="0" data-act="bukaKas" data-v="dp"><span class="br-dot kuning"></span><span class="br-isi"><b>${dpList.length} DP belum lunas</b><small>sisa tagihan ${rp(dpList.reduce((s, m) => s + sisaTagihan(m), 0))}</small></span><span class="panah">›</span></div>` : ''}` : ''}
    </section>
    <section class="br-kartu"><div class="br-head"><h2>Riwayat terakhir</h2><button class="link" data-act="buka" data-v="kas">Semua</button></div>
      ${kas.length ? kas.map(barisKas).join('') : '<p class="br-kosong">Belum ada transaksi bulan ini.</p>'}
    </section>
  </div>
</div>`;
}

// ---------- Riwayat: pemasukan, pengeluaran, DP dalam satu daftar ----------
function itemKas(f, p) {
  const ok = r => p === 'semua' || (r.bulan === BULAN_UP[Number(p.slice(5)) - 1] && r.tanggal.slice(0, 4) === p.slice(0, 4));
  const q = cari.trim().toLowerCase(), cocok = t => !q || t.toLowerCase().includes(q);
  const out = [];
  if (f === 'semua' || f === 'masuk') S.masuk.filter(m => sudahLunas(m) && ok(m) && cocok(m.customer + ' ' + namaPaket(m))).forEach(m => out.push({ t: m.tanggal + (m.waktu || ''), tgl: m.tanggal, jenis: 'masuk', judul: m.customer, sub: namaPaket(m), nilai: jumlahMasuk(m), act: 'editMasuk', id: m.id }));
  if (f === 'semua' || f === 'keluar') S.keluar.filter(k => ok(k) && cocok(k.nama)).forEach(k => out.push({ t: k.tanggal + '99', tgl: k.tanggal, jenis: 'keluar', judul: k.nama, sub: ({ fee: 'Fee fotografer', edit: 'Fee edit', cetak: 'Cetak', lain: namaPos(posOps(k)) })[k.jenis || 'lain'] + (k.status === 'BELUM' ? ' · belum dibayar' : ''), nilai: -totalKeluar(k), act: 'editKeluar', id: k.id }));
  if (f === 'semua' || f === 'dp') { const D = dataDp(p); [...D.ini, ...(f === 'dp' ? D.lama : [])].filter(m => cocok(m.customer + ' ' + namaPaket(m))).forEach(m => out.push({ t: (m.tglDp || m.tanggal) + (m.waktu || ''), tgl: m.tglDp || m.tanggal, jenis: 'dp', judul: m.customer, sub: `DP ${namaPaket(m)} · sisa ${rp(sisaTagihan(m))}`, nilai: Number(m.dp) || 0, act: 'editMasuk', id: m.id })); }
  return out.sort((a, b) => b.t.localeCompare(a.t));
}
const barisKas = x => `<div class="kas-row tk" role="button" tabindex="0" data-act="${x.act}" data-id="${x.id}">
  <i class="kas-ik ${x.jenis}">${ikon(x.jenis === 'dp' ? 'dp' : x.jenis)}</i>
  <span class="kas-isi"><b>${esc(x.judul || '—')}</b><small>${esc(x.sub)}</small></span>
  <span class="kas-nilai ${x.jenis}">${x.jenis === 'keluar' ? '−' : x.jenis === 'dp' ? '' : '+'}${rp(Math.abs(x.nilai))}${x.jenis === 'dp' ? '<small>titipan</small>' : ''}</span></div>`;

function viewKas() {
  const items = itemKas(filterKas, periode), per = {};
  items.forEach(x => (per[x.tgl] ||= []).push(x));
  const tm = items.filter(x => x.jenis === 'masuk').reduce((s, x) => s + x.nilai, 0), tk = -items.filter(x => x.jenis === 'keluar').reduce((s, x) => s + x.nilai, 0);
  return `<div class="judul"><div><h1>Riwayat</h1><div class="sub">Pemasukan, pengeluaran, dan DP dalam satu daftar</div></div></div>
  <div class="card bar-atas">${pilihPeriode(true)}
    <div class="seg" style="margin-left:auto">${[['semua', 'Semua'], ['masuk', 'Masuk'], ['keluar', 'Keluar'], ['dp', 'DP']].map(([v, l]) => `<button class="${filterKas === v ? 'on' : ''}" data-act="filterKas" data-v="${v}">${l}</button>`).join('')}</div></div>
  <label class="cari-hp cari-kas"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="cariKas" type="search" value="${esc(cari)}" placeholder="Cari customer, paket, pengeluaran" autocomplete="off"></label>
  <div class="kas-ringkas"><div><small>Masuk</small><b class="masuk">${rp(tm)}</b></div><div><small>Keluar</small><b class="keluar">${rp(tk)}</b></div><div><small>Bersih</small><b>${rp(tm - tk)}</b></div></div>
  ${cari ? `<div class="catatan" style="margin:0 0 12px">Hasil pencarian "<b>${esc(cari)}</b>" · <a href="#" data-act="hapusCari">hapus pencarian</a></div>` : ''}
  <div class="card kas-list">${Object.keys(per).length ? Object.entries(per).map(([t, xs]) => `<div class="kas-tgl">${esc(tglPanjang(t))}</div>${xs.map(barisKas).join('')}`).join('') : '<div class="kosong">Tidak ada catatan di periode ini.</div>'}</div>`;
}

function menuTambah() {
  formJenis = null;
  const nDp = S.masuk.filter(m => m.bayar === 'dp').length;
  const opsi = [['jadwal', 'booking', 'Booking / jadwal', 'Customer, paket, add-on, tanggal foto'], ['masuk', 'masuk', 'Pemasukan', 'Pembayaran lunas dari customer'], ['dp', 'dp', 'DP', 'Uang muka — belum dihitung pemasukan'],
    ['lunas', 'lunas', 'Pelunasan', nDp ? `${nDp} customer masih DP — pilih untuk dilunasi` : 'Belum ada DP yang perlu dilunasi'], ['keluar', 'keluar', 'Pengeluaran', 'Fee, cetak, operasional']];
  bukaModal(`<div class="sheet-head"><h2>Tambah</h2><button class="x" data-act="tutup" aria-label="Tutup">×</button></div>
  <div class="sheet-body"><div class="pilih-tambah">${opsi.map(([v, ik, n, d]) => `<button class="tk" data-act="tambahJenis" data-v="${v}"><i class="kas-ik ${v === 'jadwal' || v === 'lunas' ? 'masuk' : v}">${ikon(ik)}</i><span><b>${n}</b><small>${d}</small></span>${v === 'lunas' && nDp ? `<em class="hitung-dp">${nDp}</em>` : ''}</button>`).join('')}</div></div>`, 'kecil');
}

// Kartu pelunasan: semua customer yang masih DP, klik untuk melunasi
function daftarPelunasan() {
  formJenis = null;
  const list = S.masuk.filter(m => m.bayar === 'dp').sort((a, b) => (a.tglDp || a.tanggal).localeCompare(b.tglDp || b.tanggal));
  bukaModal(`<div class="sheet-head"><h2>Pelunasan</h2><button class="x" data-act="tutup" aria-label="Tutup">×</button></div>
  <div class="sheet-body">${list.length ? `<p class="bantu" style="margin:0 0 10px">${list.length} customer masih DP · total sisa tagihan ${rp(list.reduce((s, m) => s + sisaTagihan(m), 0))}</p>
    <div class="pilih-tambah">${list.map(m => `<button class="tk" data-act="bukaLunas" data-id="${m.id}"><i class="kas-ik dp">${ikon('dp')}</i>
      <span><b>${esc(m.customer)}</b><small>${esc(namaPaket(m))} · DP ${rp(m.dp)} tgl ${esc(tglPendek(m.tglDp || m.tanggal))}</small></span>
      <span class="sisa-lunas tnum"><small>sisa</small>${rp(sisaTagihan(m))}</span></button>`).join('')}</div>`
    : '<div class="kosong">Belum ada customer yang DP.</div>'}</div>`, 'kecil');
}

function blokDp(p, untukLaporan) {
  const D = dataDp(p), lbl = p === 'semua' ? 'semua bulan' : BULAN[Number(p.slice(5)) - 1] + ' ' + p.slice(0, 4);
  const jml = arr => arr.reduce((s, m) => s + (Number(m.dp) || 0), 0);
  const baris = m => `<div class="dp-row">
      <div class="dp-isi" role="button" tabindex="0" data-act="editMasuk" data-id="${m.id}"><b>${esc(m.customer)}</b><span>${esc(namaPaket(m))} · DP tgl ${esc(tglPendek(m.tglDp || m.tanggal))}</span></div>
      <div class="dp-angka tnum"><b>${rp(m.dp)}</b><small>sisa ${rp(sisaTagihan(m))} dari ${rp(jumlahMasuk(m))}</small></div>
      ${untukLaporan ? '' : `<button class="btn btn-kecil btn-utama" data-act="bukaLunas" data-id="${m.id}">Lunas</button>`}
    </div>`;
  return `<div class="card dp-blok">
    <div class="grafik-head"><h2>Catatan DP · ${lbl}</h2><span class="sub">uang titipan — belum dihitung pemasukan sampai lunas</span></div>
    <div class="dp-ringkas">
      <div><span>DP masuk ${p === 'semua' ? '' : 'bulan ini'}</span><b class="tnum">${rp(jml(D.ini))}</b><small>${D.ini.length} booking</small></div>
      <div><span>Belum lunas dari bulan lalu</span><b class="tnum">${rp(jml(D.lama))}</b><small>${D.lama.length} booking</small></div>
      <div class="utama"><span>Total uang DP dipegang</span><b class="tnum">${rp(jml(D.ini) + jml(D.lama))}</b><small>sisa tagihan ${rp([...D.ini, ...D.lama].reduce((s, m) => s + sisaTagihan(m), 0))}</small></div>
    </div>
    ${D.ini.length ? `<div class="label-kecil dp-sub">DP masuk ${lbl}</div>${D.ini.map(baris).join('')}` : ''}
    ${D.lama.length ? `<div class="label-kecil dp-sub">Belum lunas dari bulan sebelumnya</div>${D.lama.map(baris).join('')}` : ''}
    ${D.ini.length + D.lama.length ? '' : '<div class="kosong" style="padding:14px">Tidak ada DP yang belum lunas.</div>'}
  </div>`;
}

function formLunas() {
  const m = S.masuk.find(x => x.id === F.id);
  return `${kepala('Pelunasan')}
  <div class="sheet-body">
    ${bagian(1, esc(m.customer), esc(namaPaket(m)), `<div class="ringkas" style="margin:0">
      <div class="row"><span>Total booking</span><span class="tnum">${rp(jumlahMasuk(m))}</span></div>
      <div class="row"><span>DP sudah dibayar · ${esc(tglPendek(m.tglDp || m.tanggal))}</span><span class="tnum">− ${rp(m.dp)}</span></div>
      <div class="row total"><span>Sisa tagihan</span><b class="tnum">${rp(sisaTagihan(m))}</b></div></div>`)}
    ${bagian(2, 'Pelunasan', 'Nominal yang dibayar sekarang', `
      <div class="grid2">
        ${fld('Nominal pelunasan', uang('bayarLunas', F.bayarLunas), { wajib: true, bantu: 'terisi sisa tagihan, ubah kalau beda' })}
        ${fld('Tanggal lunas', `<input type="date" data-f="tanggal" value="${esc(F.tanggal)}">`, { wajib: true })}
      </div>
      <div class="catatan" style="margin:0" id="lunasInfo">${infoLunas(m)}</div>`)}
  </div>
  <div class="sheet-foot"><span class="spacer"></span><button class="btn" data-act="tutup">Batal</button><button class="btn btn-utama" data-act="simpanLunas">Simpan pelunasan</button></div>`;
}
function infoLunas(m) {
  const total = (Number(m.dp) || 0) + (Number(F.bayarLunas) || 0), beda = total - jumlahMasuk(m), d = F.tanggal ? keTgl(F.tanggal) : null;
  return `DP ${rp(m.dp)} + pelunasan ${rp(F.bayarLunas || 0)} = <b>${rp(total)}</b> masuk pemasukan <b>${d ? BULAN[d.getMonth()] + ' ' + d.getFullYear() : '—'}</b>. Data DP-nya dihapus dari daftar DP.${beda ? `<br><span style="color:${beda < 0 ? '#B23A2F' : '#0B6B6A'}">${beda < 0 ? 'Kurang' : 'Lebih'} ${rp(Math.abs(beda))} dari total booking — dicatat sebagai ${beda < 0 ? 'potongan' : 'tambahan'} pelunasan.</span>` : ''}`;
}
function simpanLunas() {
  if (!F.tanggal) return toast('Isi tanggal lunas');
  const m = S.masuk.find(x => x.id === F.id), bayar = Number(F.bayarLunas) || 0;
  if (!(bayar > 0) && sisaTagihan(m) > 0) return toast('Isi nominal pelunasan');
  const beda = (Number(m.dp) || 0) + bayar - jumlahMasuk(m), qty = Number(m.qty) || 1;
  if (beda) {   // pelunasan beda dari sisa tagihan → selisih dicatat sebagai penyesuaian supaya total = DP + pelunasan
    m.nominal = (m.tambahan === 'ADA' ? Number(m.nominal) || 0 : 0) + beda / qty;
    m.ket = [m.tambahan === 'ADA' ? m.ket : '', `${beda < 0 ? 'potongan' : 'tambahan'} pelunasan ${rp(Math.abs(beda))}`].filter(Boolean).join(' · ');
    if (m.tambahan !== 'ADA') m.tipeTambah = beda < 0 ? 'diskon' : 'tambah';
    m.tambahan = 'ADA';
    if (!m.feeManual) m.feeRp = feeOtomatis(m);
  }
  Object.assign(m, { bayar: 'lunas', tglLunas: F.tanggal, tanggal: F.tanggal, bulan: bulanDari(F.tanggal), waktu: jamSekarang(), lunasNominal: bayar });
  sinkronKeluar(m); simpan(); tutupModal(); render();
  toast(`Lunas — ${rp(jumlahMasuk(m))} masuk pemasukan ${BULAN[keTgl(m.tanggal).getMonth()]}`);
}

function viewMasuk() {
  const list = S.masuk.filter(dalamPeriode).filter(sudahLunas).sort((a, b) => (a.tanggal + a.waktu).localeCompare(b.tanggal + b.waktu));
  const DP = dataDp(periode);
  // cetak & fee diambil dari Pengeluaran periode ini, jadi catatan manual/impor ikut terhitung
  const kel = S.keluar.filter(dalamPeriode), sumJenis = js => kel.filter(k => js.includes(k.jenis)).reduce((s, k) => s + totalKeluar(k), 0);
  const tot = { jumlah: list.reduce((s, m) => s + jumlahMasuk(m), 0), cetak: sumJenis(['cetak']), fee: sumJenis(['fee', 'edit']) };
  tot.studio = tot.jumlah - tot.cetak - tot.fee;
  const baris = list.map((m, i) => {
    const r = rincianMasuk(m);
    const detail = m.item ? esc(m.item) : m.jenisJual === 'CETAK' ? 'Cetak' : esc(m.jenis) + (m.paket ? ' · ' + esc(m.paket) : '');
    const potong = r.cetak + r.fee + r.edit;
    return `<div class="trx" role="button" tabindex="0" data-act="editMasuk" data-id="${m.id}">
      <div class="trx-no tnum">${i + 1}<small>${esc(tglPendek(m.tanggal))}</small></div>
      <div class="trx-isi"><b>${esc(m.customer || '—')}</b><span>${detail}${m.qty > 1 ? ' ×' + m.qty : ''}${m.fotografer ? ' · ' + esc(m.fotografer) : ''}</span>
        <div class="chips"><span class="chip j-${m.jenisJual.replace(' ', '')}">${m.jenisJual}</span>${m.tambahan === 'ADA' ? `<span class="chip">${esc(m.ket || TIPE_TAMBAH[m.tipeTambah])} ${rp(m.nominal)}</span>` : ''}</div></div>
      <div class="trx-rp tnum">${rp(r.jumlah)}${potong ? `<small>studio ${rp(r.studio)}</small>` : ''}</div>
    </div>`;
  }).join('');
  return `<div class="judul"><div><h1>Pemasukan</h1><div class="sub">Jumlah = (Nilai Penjualan + Nominal) × Jumlah Paket</div></div>
    <div class="kanan"><button class="btn btn-kecil" data-act="exportCsv" data-j="masuk">Unduh CSV</button></div></div>
  <div class="card bar-atas">${pilihPeriode(true)}</div>
  <div class="stats">
    <div class="stat utama"><div class="lbl">Total pemasukan</div><b class="tnum">${rp(tot.jumlah)}</b><small>${list.length} transaksi lunas · DP tidak dihitung</small></div>
    <div class="stat"><div class="lbl"><i class="c-cetak"></i>Biaya cetak</div><b class="tnum">${rp(tot.cetak)}</b><small>tercatat di pengeluaran</small></div>
    <div class="stat"><div class="lbl"><i class="c-fee"></i>Fee fotografer + edit</div><b class="tnum">${rp(tot.fee)}</b><small>tercatat di pengeluaran</small></div>
    <div class="stat"><div class="lbl"><i class="c-studio"></i>Sisa untuk studio</div><b class="tnum">${rp(tot.studio)}</b><small>sebelum operasional, gaji & ruko</small></div>
  </div>
  ${blokDp(periode)}
  <div class="card"><div class="grafik-head"><h2>Pemasukan lunas</h2><span class="sub">yang dihitung di laporan akhir bulan</span></div><div class="daftar">${baris || '<div class="kosong">Belum ada pemasukan lunas di periode ini.</div>'}</div></div>`;
}

function viewKeluar() {
  const semua = S.keluar.filter(dalamPeriode).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const list = semua.filter(k => filterKeluar === 'semua' || k.status === filterKeluar);
  const total = semua.reduce((s, k) => s + totalKeluar(k), 0);
  const belum = semua.filter(k => k.status === 'BELUM');
  const hutang = {};
  belum.filter(k => (k.jenis === 'fee' || k.jenis === 'edit') && k.fotografer).forEach(k => { hutang[k.fotografer] = (hutang[k.fotografer] || 0) + totalKeluar(k); });
  const perJenis = { cetak: 0, fee: 0, edit: 0, lain: 0 };
  semua.forEach(k => perJenis[k.jenis || 'lain'] += totalKeluar(k));
  const baris = list.map((k, i) => `<div class="trx" role="button" tabindex="0" data-act="editKeluar" data-id="${k.id}">
      <div class="trx-no tnum">${i + 1}<small>${esc(tglPendek(k.tanggal))}</small></div>
      <div class="trx-isi"><b>${esc(k.nama)}</b><span>${rp(k.nominal)} × ${k.jumlah}${k.dari ? ' · otomatis dari pemasukan' : ''}</span>
        <div class="chips"><span class="chip k-${k.jenis || 'lain'}">${{ cetak: 'Cetak', fee: 'Fee fotografer', edit: 'Fee edit', lain: 'Operasional' }[k.jenis || 'lain']}</span></div></div>
      <div class="trx-rp tnum">${rp(totalKeluar(k))}<button class="chip ${k.status === 'SELESAI' ? 'ok' : 'belum'}" data-act="tukarStatus" data-id="${k.id}">${k.status}</button></div>
    </div>`).join('');
  return `<div class="judul"><div><h1>Pengeluaran</h1><div class="sub">Total = Nominal × Jumlah · status BELUM / SELESAI</div></div>
    <div class="kanan"><button class="btn btn-kecil" data-act="exportCsv" data-j="keluar">Unduh CSV</button></div></div>
  <div class="card bar-atas">${pilihPeriode(true)}
    <div class="seg" style="margin-left:auto">${['semua', 'BELUM', 'SELESAI'].map(f => `<button class="${filterKeluar === f ? 'on' : ''}" data-act="filterKeluar" data-v="${f}">${f === 'semua' ? 'Semua' : f}</button>`).join('')}</div></div>
  <div class="stats">
    <div class="stat utama"><div class="lbl">Total pengeluaran</div><b class="tnum">${rp(total)}</b><small>${semua.length} catatan · belum dibayar ${rp(belum.reduce((s, k) => s + totalKeluar(k), 0))}</small></div>
    <div class="stat"><div class="lbl"><i class="c-cetak"></i>Cetak</div><b class="tnum">${rp(perJenis.cetak)}</b><small>&nbsp;</small></div>
    <div class="stat"><div class="lbl"><i class="c-fee"></i>Fee fotografer + edit</div><b class="tnum">${rp(perJenis.fee + perJenis.edit)}</b><small>&nbsp;</small></div>
    <div class="stat"><div class="lbl"><i class="c-lain"></i>Operasional lain</div><b class="tnum">${rp(perJenis.lain)}</b><small>&nbsp;</small></div>
  </div>
  ${Object.keys(hutang).length ? `<div class="card" style="margin-bottom:14px"><h2>Fee belum dibayar</h2>${Object.entries(hutang).map(([n, v]) => `<div class="baris"><div class="isi"><b>${esc(n)}</b><span>${belum.filter(k => k.fotografer === n).length} catatan BELUM</span></div><b class="tnum">${rp(v)}</b><button class="btn btn-kecil" data-act="lunasFee" data-n="${esc(n)}">Tandai lunas</button></div>`).join('')}</div>` : ''}
  <div class="card"><div class="daftar">${baris || '<div class="kosong">Belum ada pengeluaran di periode ini.</div>'}</div></div>`;
}

// ---------- Laporan bulanan (hasil akhir, format Excel + grafik) ----------
let GRAFIK = null;
const HR = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const HR_PANJANG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const tglExcel = s => { const d = keTgl(s); return HARI[d.getDay()].slice(0, 3) + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3); };
const namaPaket = m => m.item || (m.jenisJual === 'CETAK' ? 'Cetak' : [m.paket, m.jenis.replace(/^Paket /, '')].filter(Boolean).join(' ')) || m.jenisJual;
// Rincian dikelompokkan sesuai jenis input: pemasukan per jenis penjualan (Paket dipecah per jenis paket),
// pengeluaran per kategori (fee dipecah per orang). Dipakai tab Laporan, PDF dan spreadsheet closing.
const URUT_JUAL = [['PAKET', 'Paket', WARNA.paket], ['PAS PHOTO', 'Pas Photo', WARNA.pas], ['CETAK', 'Cetak', WARNA.cetak]];
const URUT_KAT = [['fee', 'Fee fotografer', WARNA.fee], ['edit', 'Fee edit', WARNA.edit], ['cetak', 'Cetak', WARNA.cetak], ['lain', 'Operasional', WARNA.ops]];
const urutTgl = (a, b) => (a.tanggal + (a.waktu || '')).localeCompare(b.tanggal + (b.waktu || ''));
function kelompok(list, urutan, kunci, subKunci, nilai) {
  return urutan.map(([k, judul, warna]) => {
    const rows = list.filter(r => kunci(r) === k).sort(urutTgl), subs = {};
    rows.forEach(r => { (subs[subKunci(r, k)] ||= []).push(r); });
    const sub = Object.entries(subs).sort((a, b) => b[1].reduce((s, r) => s + nilai(r), 0) - a[1].reduce((s, r) => s + nilai(r), 0));
    return { k, judul, warna, rows, sub, total: rows.reduce((s, r) => s + nilai(r), 0) };
  }).filter(g => g.rows.length);
}
const kelompokMasuk = list => kelompok(list, URUT_JUAL, m => URUT_JUAL.some(([k]) => k === m.jenisJual) ? m.jenisJual : 'PAKET', (m, k) => k === 'PAKET' ? (m.jenis || 'Lainnya').replace(/^Paket /, '') : '', jumlahMasuk);
const kelompokKeluar = list => kelompok(list, URUT_KAT, x => x.jenis || 'lain', (x, k) => k === 'fee' || k === 'edit' ? x.fotografer || 'Lainnya' : k === 'lain' ? namaPos(posOps(x)) : '', totalKeluar);
const rinciOps = list => { const o = {}; list.filter(k => (k.jenis || 'lain') === 'lain').forEach(k => { const n = namaPos(posOps(k)); o[n] = (o[n] || 0) + totalKeluar(k); }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
// baris tabel HTML per kelompok: judul kelompok → (sub-judul) → baris → subtotal. ekor = jumlah kolom setelah kolom total.
function barisKelompok(groups, nKol, ekor, nilai, satuan, baris) {
  const span = nKol - 1 - ekor, kosong = '<td></td>'.repeat(ekor);
  return groups.map(g => {
    let no = 0;
    const isi = g.sub.map(([nama, rows]) => (nama && g.sub.length > 0 ? `<tr class="subgrup"><td colspan="${span}">${esc(nama)} · ${rows.length} ${satuan}</td><td class="r tnum">${rp(rows.reduce((s, r) => s + nilai(r), 0))}</td>${kosong}</tr>` : '') + rows.map(r => baris(r, ++no)).join('')).join('');
    return `<tr class="grup"><td colspan="${nKol}"><i class="kotak" style="background:${g.warna}"></i> ${esc(g.judul)} <span>· ${g.rows.length} ${satuan}</span></td></tr>${isi}<tr class="subtotal"><td colspan="${span}">Subtotal ${esc(g.judul)}</td><td class="r tnum">${rp(g.total)}</td>${kosong}</tr>`;
  }).join('');
}
// Rincian ringkas di tab Laporan: kelompok (ketuk → buka) berisi satu baris per catatan; ketuk baris → keterangan lengkap.
function daftarRinci(groups, total, satuan, nilai, judulBaris, detail) {
  if (!groups.length) return '<div class="kosong">Belum ada data.</div>';
  const item = r => `<details class="rinci-item"><summary><span class="tgl">${esc(tglExcel(r.tanggal))}</span><span class="nm">${judulBaris(r)}</span><b class="tnum">${rp(nilai(r))}</b></summary>
    <div class="rinci-isi">${detail(r).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div></details>`;
  return groups.map(g => `<details class="rinci-grup"><summary><i class="kotak" style="background:${g.warna}"></i><span class="nm">${esc(g.judul)}<small>${g.rows.length} ${satuan} · ${total ? Math.round(g.total / total * 100) : 0}%</small></span><b class="tnum">${rp(g.total)}</b></summary>
    <div class="rinci-daftar">${g.sub.map(([nama, rows]) => (nama ? `<div class="rinci-sub"><span>${esc(nama)} · ${rows.length}</span><span class="tnum">${rp(rows.reduce((s, r) => s + nilai(r), 0))}</span></div>` : '') + rows.map(item).join('')).join('')}</div>
  </details>`).join('');
}
const KAT = { fee: ['Fee fotografer', WARNA.fee], edit: ['Fee edit', WARNA.edit], cetak: ['Cetak', WARNA.cetak], lain: ['Operasional', WARNA.ops] };

function selisih(kini, lalu, lbl, terbalik) {
  if (!lalu) return `<small>belum ada data ${lbl}</small>`;
  const pct = Math.round((kini - lalu) / Math.abs(lalu) * 100), naik = pct >= 0, baik = terbalik ? !naik : naik;
  return `<small class="${baik ? 'naik' : 'turun'}">${naik ? '▲' : '▼'} ${Math.abs(pct)}% dari ${lbl}</small>`;
}

function viewLaporan() {
  if (periode === 'semua') periode = hariIni.slice(0, 7);
  const st = S.setelan, D = dataBulan(periode);
  const pLalu = iso(new Date(D.y, D.mo - 2, 1)).slice(0, 7), L = dataBulan(pLalu), lblLalu = BULAN[(D.mo + 10) % 12];
  const nHari = new Date(D.y, D.mo, 0).getDate(), awal = new Date(D.y, D.mo - 1, 1);
  const hariKe = r => { const d = keTgl(r.tanggal); return d.getFullYear() === D.y && d.getMonth() === D.mo - 1 ? d.getDate() - 1 : d < awal ? 0 : nHari - 1; };
  const hM = Array(nHari).fill(0), hK = Array(nHari).fill(0), hN = Array(nHari).fill(0);
  D.masuk.forEach(m => { const i = hariKe(m); hM[i] += jumlahMasuk(m); hN[i]++; });
  D.keluar.forEach(k => { hK[hariKe(k)] += totalKeluar(k); });
  const kum = a => a.reduce((o, v, i) => (o.push((o[i - 1] || 0) + v), o), []);
  const jual = { PAKET: 0, 'PAS PHOTO': 0, CETAK: 0 }; D.masuk.forEach(m => { jual[m.jenisJual] = (jual[m.jenisJual] || 0) + jumlahMasuk(m); });
  const kat = { fee: 0, edit: 0, cetak: 0, lain: 0 }; D.keluar.forEach(k => { kat[k.jenis || 'lain'] += totalKeluar(k); });
  const perPaket = {}; D.masuk.forEach(m => { const n = m.jenisJual === 'CETAK' ? 'Cetak' : (m.jenis || (m.jenisJual === 'PAS PHOTO' ? 'Pas Photo lain' : 'Lainnya')).replace(/^Paket /, ''); const o = perPaket[n] ||= { n: 0, v: 0 }; o.n++; o.v += jumlahMasuk(m); });
  const perOrang = {}; D.keluar.filter(k => k.jenis === 'fee' || k.jenis === 'edit').forEach(k => { const n = k.fotografer || 'Lainnya'; perOrang[n] = (perOrang[n] || 0) + totalKeluar(k); });
  const pHr = Array(7).fill(0), pHrN = Array(7).fill(0); D.masuk.forEach(m => { const i = (keTgl(m.tanggal).getDay() + 6) % 7; pHr[i] += jumlahMasuk(m); pHrN[i]++; });
  const tren = []; for (let k = 5; k >= 0; k--) tren.push(dataBulan(iso(new Date(D.y, D.mo - 1 - k, 1)).slice(0, 7)));
  const iAda = tren.findIndex(t => t.ada), trenAda = iAda < 0 ? [] : tren.slice(iAda);
  GRAFIK = { nHari, hM, hK, hN, kM: kum(hM), kK: kum(hK), pHr, pHrN, tren: trenAda, bulan: BULAN[D.mo - 1] };

  if (!D.ada) return `<div class="judul"><div><h1>Laporan Bulanan</h1></div></div><div class="card bar-atas">${pilihPeriode(false)}</div><div class="card kosong">Belum ada pemasukan atau pengeluaran di ${BULAN[D.mo - 1]} ${D.y}.</div>`;

  const iTop = hM.indexOf(Math.max(...hM)), iHr = pHr.indexOf(Math.max(...pHr));
  const topPaket = Object.entries(perPaket).sort((a, b) => b[1].v - a[1].v);
  const kas = S.posisiKas[periode] || { cash: 0, bri: 0 };
  const pct = (v, t) => t ? Math.round(v / t * 100) + '%' : '0%';
  const insight = `<b>${BULAN[D.mo - 1]} ${D.y}${periode === hariIni.slice(0, 7) ? ' (bulan berjalan, data s/d hari ini)' : ''}:</b> ${D.masuk.length} transaksi, uang masuk <b>${rp(D.tm)}</b> dan keluar <b>${rp(D.tk)}</b>, jadi tersisa <b>${rp(D.bersih)}</b>.
    Setelah gaji tim ${rp(D.gaji)} dan ruko ${rp(D.ruko)}, <b>laba bersih ${rp(D.laba)}</b>${D.laba > 0 ? ` → Investor ${rp(D.investor)}, Kas ${rp(D.kas)}, Studio ${rp(D.studio)}` : ' (belum menutup gaji + ruko)'}.
    ${(() => { const dp = dataDp(periode), n = dp.ini.length + dp.lama.length, t = [...dp.ini, ...dp.lama].reduce((s, m) => s + (Number(m.dp) || 0), 0); return n ? `Uang DP titipan <b>${rp(t)}</b> dari ${n} booking belum dihitung (lihat Catatan DP). ` : ''; })()}Penyumbang terbesar: <b>${esc(topPaket[0]?.[0] || '-')}</b> (${pct(topPaket[0]?.[1].v || 0, D.tm)} pemasukan). Hari paling ramai: <b>${HR_PANJANG[iHr]}</b>; tanggal terbesar: <b>${iTop + 1} ${BULAN[D.mo - 1]}</b> (${rp(hM[iTop])}).`;

  // rincian dikelompokkan per jenis
  const rinciMasukList = daftarRinci(kelompokMasuk(D.masuk), D.tm, 'transaksi', jumlahMasuk, m => esc(m.customer || '-'), m => [
    ['Tanggal', esc(tglExcel(m.tanggal) + (m.waktu ? ' · ' + m.waktu : ''))], ['Paket', esc(namaPaket(m))], ['Nilai penjualan', rp(m.nilai) + (Number(m.qty) > 1 ? ' × ' + m.qty : '')],
    ['Keterangan', m.tambahan === 'ADA' ? esc(m.ket || '') : ''], ['Nominal tambahan', nominalOf(m) ? rp(nominalOf(m)) : ''], ['Fotografer', esc(m.fotografer || '')], ['Total', rp(jumlahMasuk(m))]]);
  const rinciKeluarList = daftarRinci(kelompokKeluar(D.keluar), D.tk, 'catatan', totalKeluar, k => (k.status === 'BELUM' ? '<i class="titik-belum" title="Belum dibayar"></i>' : '') + esc(k.nama || '-'), k => [
    ['Tanggal', esc(tglExcel(k.tanggal))], ['Harga satuan', rp(k.nominal)], ['Jumlah', k.jumlah], ['Total', rp(totalKeluar(k))], ['Status', k.status === 'BELUM' ? 'Belum dibayar' : 'Sudah dibayar']]);
  const bagi = [['Investor', D.investor, st.investor, WARNA.pas], ['Kas', D.kas, st.kas, WARNA.cetak], ['Studio', D.studio, st.studio, WARNA.paket]];

  return `<div class="judul"><div><h1>Laporan Bulanan</h1><div class="sub">${esc(st.nama)} · Periode 01/${String(D.mo).padStart(2, '0')}/${D.y} – ${nHari}/${String(D.mo).padStart(2, '0')}/${D.y}</div></div>
    <div class="kanan no-print"><button class="btn btn-kecil" data-act="cetakLaporan">Cetak / PDF</button></div></div>
  <div class="card bar-atas no-print">${pilihPeriode(false)}</div>
  <div class="card closing-aksi no-print"><div><h2>Closing akhir bulan</h2><span class="sub">Hasil akhir ${BULAN[D.mo - 1]} ${D.y} untuk owner & investor</span></div>
    <div class="closing-btn"><button class="btn" data-act="closingXlsx">Spreadsheet (.xlsx)</button><button class="btn" data-act="closingPdf">PDF</button><button class="btn btn-utama" data-act="closingWa">Teks WA</button></div></div>
  <div class="insight">${insight}</div>
  <div class="stats">
    <div class="stat"><div class="lbl"><i style="background:${WARNA.masuk}"></i>Total pemasukan</div><b class="tnum">${rp(D.tm)}</b>${selisih(D.tm, L.tm, lblLalu)}</div>
    <div class="stat"><div class="lbl"><i style="background:${WARNA.keluar}"></i>Total pengeluaran</div><b class="tnum">${rp(D.tk)}</b>${selisih(D.tk, L.tk, lblLalu, true)}</div>
    <div class="stat"><div class="lbl">Total bersih</div><b class="tnum">${rp(D.bersih)}</b>${selisih(D.bersih, L.bersih, lblLalu)}</div>
    <div class="stat utama"><div class="lbl">Laba bersih</div><b class="tnum">${rp(D.laba)}</b><small>setelah gaji tim & ruko</small></div>
  </div>

  <div class="card"><div class="grafik-head"><h2>Kurva uang masuk vs keluar</h2><span class="sub">kumulatif per tanggal · arahkan/ketuk untuk detail</span></div>
    <div class="legend"><span><i style="background:${WARNA.masuk}"></i>Pemasukan</span><span><i style="background:${WARNA.keluar}"></i>Pengeluaran</span></div>
    <div class="chart" data-chart="kurva"></div></div>

  <div class="dua">
    <div class="card"><div class="grafik-head"><h2>Pemasukan per tanggal</h2></div><div class="chart" data-chart="harian"></div></div>
    <div class="card"><div class="grafik-head"><h2>Dari pemasukan ke laba</h2></div>
      ${airTerjun([{ nama: 'Pemasukan', nilai: D.tm, tipe: 'awal' }, { nama: 'Fee fotografer', nilai: kat.fee, tipe: 'kurang' }, { nama: 'Fee edit', nilai: kat.edit, tipe: 'kurang' }, { nama: 'Cetak', nilai: kat.cetak, tipe: 'kurang' }, { nama: 'Operasional', nilai: kat.lain, tipe: 'kurang' }, { nama: 'Gaji tim', nilai: D.gaji, tipe: 'kurang' }, { nama: 'Ruko', nilai: D.ruko, tipe: 'kurang' }, { nama: 'Laba bersih', nilai: D.laba, tipe: 'akhir' }].filter(s => s.nilai || s.tipe !== 'kurang'))}</div>
  </div>

  <div class="dua">
    <div class="card"><div class="grafik-head"><h2>Pemasukan per jenis</h2></div>${batangKomposisi([{ nama: 'Paket', nilai: jual.PAKET, warna: WARNA.paket }, { nama: 'Pas Photo', nilai: jual['PAS PHOTO'], warna: WARNA.pas }, { nama: 'Cetak', nilai: jual.CETAK, warna: WARNA.cetak }])}</div>
    <div class="card"><div class="grafik-head"><h2>Pengeluaran per kategori</h2></div>${batangKomposisi(Object.entries(KAT).map(([k, [n, w]]) => ({ nama: n, nilai: kat[k], warna: w })))}
      ${kat.lain ? `<div class="label-kecil" style="margin:16px 0 8px">Rincian operasional</div>${batangMendatar(rinciOps(D.keluar).map(([n, v]) => ({ nama: n, nilai: v })), WARNA.ops)}` : ''}</div>
  </div>

  <div class="dua">
    <div class="card"><div class="grafik-head"><h2>Paket paling laku</h2><span class="sub">nilai pemasukan · jumlah transaksi</span></div>
      ${batangMendatar(topPaket.slice(0, 8).map(([n, o]) => ({ nama: n, sub: o.n + '× transaksi', nilai: o.v, tip: `${n}\n${o.n} transaksi\n${rp(o.v)}` })), WARNA.paket)}</div>
    <div class="card"><div class="grafik-head"><h2>Fee per orang</h2><span class="sub">fee fotografer + edit</span></div>
      ${Object.keys(perOrang).length ? batangMendatar(Object.entries(perOrang).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ nama: n, nilai: v, tip: `${n}\n${rp(v)}` })), WARNA.fee) : '<div class="kosong">Belum ada fee.</div>'}</div>
  </div>

  <div class="dua">
    <div class="card"><div class="grafik-head"><h2>Hari paling ramai</h2><span class="sub">pemasukan per hari dalam minggu</span></div><div class="chart" data-chart="hari"></div></div>
    <div class="card"><div class="grafik-head"><h2>Tren per bulan</h2><span class="sub">${trenAda.length} bulan terakhir yang ada datanya</span></div>
      ${trenAda.length >= 2 ? `<div class="legend"><span><i style="background:${WARNA.masuk}"></i>Pemasukan</span><span><i style="background:${WARNA.keluar}"></i>Pengeluaran</span><span><i style="background:${WARNA.laba}"></i>Laba bersih</span></div>` : ''}
      <div class="chart" data-chart="tren"></div></div>
  </div>

  <div class="card"><div class="grafik-head"><h2>Pembagian laba bersih</h2><span class="sub">Investor ${st.investor}% · Kas ${st.kas}% · Studio ${st.studio}%</span></div>
    <div class="bagi">${bagi.map(([n, v, p, w]) => `<div class="bagi-item"><i style="background:${w}"></i><span>${n} <small>${p}%</small></span><b class="tnum ${v < 0 ? 'neg' : ''}">${rp(v)}</b></div>`).join('')}</div>
    ${D.laba < 0 ? `<div class="peringatan merah" style="margin-top:12px">Laba bersih minus ${rp(-D.laba)} — pemasukan bulan ini belum menutup gaji tim + ruko.</div>` : ''}</div>

  <div class="judul" style="margin-top:26px"><div><h1 style="font-size:24px">Rincian seperti laporan Excel</h1><div class="sub">Laporan harian pemasukan, pengeluaran, total, team, ruko, laba bersih</div></div></div>
  ${blokDp(periode, true)}
  <div class="dua rinci-dua">
    <div class="card"><div class="grafik-head"><h2>Rincian pemasukan</h2><span class="sub">ketuk untuk lihat isinya</span></div>
      ${rinciMasukList}<div class="rinci-total"><span>Total pemasukan · ${D.masuk.length} transaksi</span><b class="tnum">${rp(D.tm)}</b></div></div>
    <div class="card"><div class="grafik-head"><h2>Rincian pengeluaran</h2><span class="sub">ketuk untuk lihat isinya · <i class="titik-belum"></i>belum dibayar</span></div>
      ${rinciKeluarList}<div class="rinci-total"><span>Total pengeluaran · ${D.keluar.length} catatan</span><b class="tnum">${rp(D.tk)}</b></div></div>
  </div>

  <div class="dua">
    <div class="card"><h2>Total</h2><div class="ringkas" style="margin-top:0">
      <div class="row"><span>Total keseluruhan</span><b class="tnum">${rp(D.tm)}</b></div>
      <div class="row"><span>Total pengeluaran</span><span class="tnum">− ${rp(D.tk)}</span></div>
      <div class="row total"><span>Total bersih</span><b class="tnum">${rp(D.bersih)}</b></div></div>
      <h2 style="margin-top:16px">Posisi uang</h2>
      <div class="grid3">
        <label class="f"><span>Cash</span><input class="uang tnum" data-kas="cash" inputmode="numeric" value="${titik(kas.cash)}" placeholder="0"></label>
        <div class="f"><span>Transfer BCA</span><b class="tnum kas-bca" id="bca">${rp(D.bersih - (kas.cash || 0) - (kas.bri || 0))}</b></div>
        <label class="f"><span>Transfer BRI</span><input class="uang tnum" data-kas="bri" inputmode="numeric" value="${titik(kas.bri)}" placeholder="0"></label>
      </div><div class="catatan">BCA = Total bersih − Cash − BRI (sama seperti Excel). Uang DP titipan ada di luar angka ini — lihat Catatan DP.</div></div>
    <div class="card"><h2>Team</h2>
      <table class="tabel"><thead><tr><th>No.</th><th>Nama</th><th>Posisi</th><th class="r">Sallary</th></tr></thead><tbody>
      ${D.tim.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.nama)}</td><td>${esc(t.posisi)}</td><td class="r tnum">${rp(t.gaji)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="r tnum">${rp(D.gaji)}</td></tr></tfoot></table>
      <div class="ringkas">
        <div class="row"><span>Total bersih</span><b class="tnum">${rp(D.bersih)}</b></div>
        <div class="row"><span>Team</span><span class="tnum">− ${rp(D.gaji)}</span></div>
        <div class="row"><span>Ruko</span><span class="tnum">− ${rp(D.ruko)}</span></div>
        <div class="row total"><span>Laba bersih</span><b class="tnum ${D.laba < 0 ? 'neg' : ''}">${rp(D.laba)}</b></div>
        ${bagi.map(([n, v, p]) => `<div class="row"><span>${n} (${p}%)</span><span class="tnum">${rp(v)}</span></div>`).join('')}
      </div><div class="catatan no-print">Team & ruko diubah di tab Atur.</div></div>
  </div>`;
}

function gambarGrafik() {
  const G = GRAFIK; if (!G) return;
  document.querySelectorAll('[data-chart]').forEach(el => {
    const w = el.clientWidth; if (!w) return;
    const hari = Array.from({ length: G.nHari }, (_, i) => String(i + 1));
    if (el.dataset.chart === 'kurva') el.innerHTML = grafikGaris({ w, x: hari, series: [{ nama: 'Pemasukan', warna: WARNA.masuk, data: G.kM }, { nama: 'Pengeluaran', warna: WARNA.keluar, data: G.kK }],
      tip: i => `${i + 1} ${G.bulan}\nMasuk hari ini: ${rp(G.hM[i])} (${G.hN[i]} trx)\nKeluar hari ini: ${rp(G.hK[i])}\nTotal masuk s/d tgl ini: ${rp(G.kM[i])}\nTotal keluar s/d tgl ini: ${rp(G.kK[i])}\nSelisih: ${rp(G.kM[i] - G.kK[i])}` });
    if (el.dataset.chart === 'harian') el.innerHTML = grafikBatang({ w, x: hari, data: G.hM, warna: WARNA.masuk, tip: i => `${i + 1} ${G.bulan}\n${rp(G.hM[i])} · ${G.hN[i]} transaksi` });
    if (el.dataset.chart === 'hari') el.innerHTML = grafikBatang({ w, x: HR, data: G.pHr, warna: WARNA.masuk, labelSemua: true, tip: i => `${HR_PANJANG[i]}\n${rp(G.pHr[i])} · ${G.pHrN[i]} transaksi` });
    if (el.dataset.chart === 'tren') el.innerHTML = G.tren.length < 2 ? `<div class="kosong">Tren muncul setelah ada data minimal 2 bulan.</div>` : grafikGaris({ w, h: 230, x: G.tren.map(t => BULAN[t.mo - 1].slice(0, 3)),
      series: [{ nama: 'Pemasukan', warna: WARNA.masuk, data: G.tren.map(t => t.tm) }, { nama: 'Pengeluaran', warna: WARNA.keluar, data: G.tren.map(t => t.tk) }, { nama: 'Laba', warna: WARNA.laba, data: G.tren.map(t => t.laba) }],
      tip: i => { const t = G.tren[i]; return `${BULAN[t.mo - 1]} ${t.y}\nPemasukan: ${rp(t.tm)}\nPengeluaran: ${rp(t.tk)}\nLaba bersih: ${rp(t.laba)}`; } });
  });
}

function viewAtur() {
  const st = S.setelan;
  const jenis = daftarJenis();
  const paketRows = S.paket.map(p => {
    const persen = p.feeTipe !== 'nominal', nom = persen ? p.harga * p.fee / 100 : p.fee;
    return `<tr><td><input data-p="${p.id}" data-k="jenis" value="${esc(p.jenis)}" list="dlJenis"></td><td><input data-p="${p.id}" data-k="paket" value="${esc(p.paket)}"></td><td><input class="uang tnum" data-p="${p.id}" data-k="harga" inputmode="numeric" value="${titik(p.harga)}"></td>
      <td><div class="fee-in"><input class="tnum ${persen ? '' : 'uang'}" data-p="${p.id}" data-k="fee" inputmode="numeric" value="${persen ? p.fee : titik(p.fee)}"><select data-p="${p.id}" aria-label="Satuan fee"><option value="persen" ${persen ? 'selected' : ''}>%</option><option value="nominal" ${persen ? '' : 'selected'}>Rp</option></select></div></td>
      <td class="r tnum" style="color:var(--muted)">${rp(naik500(nom))}</td><td><button class="x" data-act="hapusPaket" data-id="${p.id}" aria-label="Hapus">×</button></td></tr>`;
  }).join('');
  const cetakRows = Object.entries(S.cetakHarga).map(([u, arr]) => `<tr><th>${esc(u)}</th>${KOLOM_CETAK.map((_, i) => `<td><input class="uang tnum" data-c="${esc(u)}" data-i="${i}" inputmode="numeric" value="${titik(arr[i])}" placeholder="—"></td>`).join('')}</tr>`).join('');
  const orang = (k, judul) => `<div class="card"><h2>${judul}</h2><div class="chips" style="margin:0 0 10px">${S[k].map((n, i) => `<span class="chip besar">${esc(n)}<button class="x" data-act="hapusOrang" data-k="${k}" data-i="${i}" aria-label="Hapus">×</button></span>`).join('')}</div>
    <div style="display:flex;gap:8px"><input class="mini-in" style="flex:1" id="baru-${k}" placeholder="Nama"><button class="btn btn-kecil" data-act="tambahOrang" data-k="${k}">Tambah</button></div></div>`;
  return `<div class="judul"><div><h1>Pengaturan</h1><div class="sub">Paket Studio, harga cetak rekanan, fee, gaji/ruko, pembagian laba</div></div></div>
  <div class="atur">
    <div class="card lebar"><h2>Umum & laba bersih</h2>
      <div class="grid3">
        <label class="f"><span>Nama studio</span><input data-s="nama" value="${esc(st.nama)}"></label>
        <label class="f"><span>Total gaji tim / bulan</span><input class="tnum" value="${titik((st.tim || []).reduce((s, t) => s + (Number(t.gaji) || 0), 0))}" disabled></label>
        <label class="f"><span>Ruko / bulan</span><input class="uang tnum" data-s="ruko" inputmode="numeric" value="${titik(st.ruko)}"></label>
      </div>
      <div class="grid3" style="margin-top:12px">
        <label class="f"><span>Investor (%)</span><input type="number" data-s="investor" value="${st.investor}"></label>
        <label class="f"><span>Studio (%)</span><input type="number" data-s="studio" value="${st.studio}"></label>
        <label class="f"><span>Kas (%)</span><input type="number" data-s="kas" value="${st.kas}"></label>
      </div>
      <div class="grid3" style="margin-top:12px">
        <label class="f"><span>DP otomatis (% dari total)</span><input type="number" data-s="dpPersen" value="${st.dpPersen ?? 30}"></label>
      </div>
      <div class="f" style="margin-top:12px"><span>Font aplikasi</span><div class="seg">${FONT_UI.map(f => `<button type="button" class="${(st.font || 'Nunito') === f ? 'on' : ''}" style="font-family:'${f}'" data-act="gantiFont" data-v="${f}">${f}</button>`).join('')}</div></div>
    </div>
    <div class="card lebar"><div class="blok-head"><h2 style="flex:1;margin:0">Add-on booking</h2><button class="btn btn-utama btn-kecil" data-act="tambahAddon">+ Add-on</button></div>
      <div class="scroll-x"><table class="tabel tabel-in"><thead><tr><th>Nama add-on</th><th>Satuan</th><th>Harga per satuan</th><th></th></tr></thead><tbody>
      ${S.addon.map((a, i) => `<tr><td><input data-addon="${i}" data-k="nama" value="${esc(a.nama)}"></td><td><input data-addon="${i}" data-k="satuan" value="${esc(a.satuan)}"></td><td><input class="uang tnum" data-addon="${i}" data-k="harga" inputmode="numeric" value="${titik(a.harga)}"></td><td><button class="x" data-act="hapusAddon" data-i="${i}" aria-label="Hapus">×</button></td></tr>`).join('')}
      </tbody></table></div><div class="catatan">Dipakai di form Jadwal; saat "Catat pemasukan", total add-on masuk sebagai Tambahan (biaya tambahan).</div></div>
    <div class="card lebar"><div class="blok-head"><h2 style="flex:1;margin:0">Team (gaji bulanan)</h2><button class="btn btn-utama btn-kecil" data-act="tambahTim">+ Anggota</button></div>
      <div class="scroll-x"><table class="tabel tabel-in"><thead><tr><th>Nama</th><th>Posisi</th><th>Sallary</th><th></th></tr></thead><tbody>
      ${(st.tim || []).map((t, i) => `<tr><td><input data-tim="${i}" data-k="nama" value="${esc(t.nama)}"></td><td><input data-tim="${i}" data-k="posisi" value="${esc(t.posisi)}"></td><td><input class="uang tnum" data-tim="${i}" data-k="gaji" inputmode="numeric" value="${titik(t.gaji)}"></td><td><button class="x" data-act="hapusTim" data-i="${i}" aria-label="Hapus">×</button></td></tr>`).join('')}
      </tbody></table></div></div>
    ${orang('fotografer', 'Fotografer')}
    ${orang('editor', 'Editor')}
    <div class="card lebar"><div class="blok-head"><h2 style="flex:1;margin:0">Paket Studio</h2><button class="btn btn-utama btn-kecil" data-act="tambahPaket">+ Paket</button></div>
      <datalist id="dlJenis">${jenis.map(j => `<option value="${esc(j)}">`).join('')}</datalist>
      <div class="scroll-x"><table class="tabel tabel-in tabel-paket"><thead><tr><th>Jenis Paket</th><th>Paket</th><th>Nilai Penjualan</th><th>Fee fotografer</th><th class="r">Fee (harga normal)</th><th></th></tr></thead><tbody>${paketRows}</tbody></table></div>
      <div class="catatan">Fee otomatis terisi saat paket dipilih di Pemasukan. Persen dihitung dari harga setelah diskon (DP bulan lalu tidak mengurangi fee), dibulatkan ke atas per Rp 500; fee Rp tetap dikali jumlah paket.</div></div>
    <div class="card lebar"><h2>Harga cetak rekanan (biaya cetak)</h2>
      <div class="scroll-x"><table class="tabel tabel-in tabel-cetak"><thead><tr><th>Ukuran</th>${KOLOM_CETAK.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${cetakRows}</tbody></table></div>
      <div class="catatan">3R–18R pakai bahan bingkai 3 cm, 20R–36R pakai 4,5 cm / 6 cm. Kosong = tidak tersedia.</div></div>
    ${typeof kartuDatabase === 'function' ? kartuDatabase() : ''}
    <div class="card lebar"><h2>Data</h2>
      <div class="baris"><div class="isi"><b>Backup data</b><span>Simpan semua jadwal, pemasukan, pengeluaran & pengaturan ke file JSON.</span></div><button class="btn btn-kecil" data-act="backup">Unduh backup</button></div>
      <div class="baris"><div class="isi"><b>Pulihkan dari backup</b><span>Menimpa data di perangkat ini dengan isi file backup.</span></div><button class="btn btn-kecil" data-act="restore">Pilih file</button></div>
    </div>
  </div>`;
}

// ---------- modal & form ----------
let F = null, formJenis = null;

function bukaModal(html, kelas = '') {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet ${kelas}" role="dialog" aria-modal="true">` + html + '</div>';
  m.hidden = false; document.body.classList.add('kunci');
}
function tutupModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; document.body.classList.remove('kunci'); F = null; formJenis = null; }
function gambarUlangForm() {
  const body = document.querySelector('.sheet-body'), top = body ? body.scrollTop : 0;
  document.querySelector('.sheet').innerHTML = { jadwal: formJadwal, masuk: formMasuk, keluar: formKeluar, lunas: formLunas }[formJenis]();
  document.querySelector('.sheet-body').scrollTop = top;
}
const kepala = judul => `<div class="sheet-head"><h2>${judul}</h2><button class="x" data-act="tutup" aria-label="Tutup">×</button></div>`;
const uang = (f, v, ph = '0') => `<input data-f="${f}" class="uang tnum" inputmode="numeric" value="${titik(v)}" placeholder="${ph}">`;
const seg = (k, opsi, nilai) => `<div class="seg">${opsi.map(([v, l]) => `<button type="button" class="${nilai === v ? 'on' : ''}" data-act="setF" data-k="${k}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
const pilihan = (f, opsi, nilai, kosong) => `<select data-f="${f}">${kosong ? `<option value="">${kosong}</option>` : ''}${opsi.map(o => `<option value="${esc(o)}" ${o === nilai ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
const pilihBulan = nilai => pilihan('bulan', BULAN_UP, nilai);

// Jadwal (Laporan Studio)
function jadwalBaru() {
  const jenis = daftarJenis()[0] || '';
  F = { id: null, fotografer: '', tglBooking: hariIni, tanggal: hariPilih !== hariIni ? hariPilih : '', jam: '', addonManual: [], jenis, paket: paketDari(jenis)[0]?.paket || '', customer: '', kontak: '', ig: '', addon: {}, status: STATUS_JADWAL[0] };
  formJenis = 'jadwal'; bukaModal(formJadwal(), 'lebar');
}
// Bagian bernomor: yang wajib & paling sering diisi di atas, detail di bawah.
const bagian = (no, judul, hint, isi, aksi = '') => `<section class="bagian"><div class="bagian-head"><span class="no">${no}</span><div><h3>${judul}</h3>${hint ? `<p>${hint}</p>` : ''}</div>${aksi ? `<div class="aksi">${aksi}</div>` : ''}</div><div class="isi-bagian">${isi}</div></section>`;
const fld = (label, kontrol, { wajib, bantu } = {}) => `<label class="f"><span>${label}${wajib ? ' <em>*</em>' : ''}</span>${kontrol}${bantu ? `<small class="bantu">${bantu}</small>` : ''}</label>`;
const segPenuh = (k, opsi, nilai, kelas = '') => seg(k, opsi, nilai).replace('class="seg"', `class="seg penuh ${kelas}"`);
const kartuPaket = (jenis, nilai) => {
  const ps = paketDari(jenis);
  if (!jenis) return '<small class="bantu">Pilih jenis paket dulu.</small>';
  return `<div class="pilih-paket">${ps.map(p => `<button type="button" class="${p.paket === nilai ? 'on' : ''}" data-act="setF" data-k="paket" data-v="${esc(p.paket)}"><b>${esc(p.paket)}</b><span class="tnum">${rp(p.harga)}</span></button>`).join('')}</div>`;
};
const saklar = (k, on, label) => `<button type="button" class="saklar ${on ? 'on' : ''}" data-act="setF" data-k="${k}" data-v="${on ? 'TIDAK' : 'ADA'}" aria-pressed="${on}"><i></i>${label}</button>`;

function formJadwal() {
  const d = F;
  d.addon ||= {};
  const bentrok = d.jam ? S.jadwal.filter(j => j.id !== d.id && j.tanggal === d.tanggal && j.jam === d.jam) : [];
  const iStatus = STATUS_JADWAL.indexOf(d.status);
  const addonRows = S.addon.map(a => { const n = Number(d.addon[a.id]) || 0; return `<div class="addon ${n ? 'on' : ''}">
      <div class="addon-nama"><b>${esc(a.nama)}</b><span class="tnum">${rp(a.harga)} / ${esc(a.satuan)}</span></div>
      <div class="qty"><button type="button" data-act="addonQty" data-id="${a.id}" data-d="-1" aria-label="Kurangi ${esc(a.satuan)}">−</button><input class="qty-in tnum" type="number" min="0" inputmode="numeric" data-f="addonQty" data-id="${a.id}" value="${n}" aria-label="Jumlah ${esc(a.satuan)}"><button type="button" data-act="addonQty" data-id="${a.id}" data-d="1" aria-label="Tambah ${esc(a.satuan)}">+</button></div>
      <div class="addon-sub tnum" id="sub-${a.id}">${n ? rp(n * a.harga) : '—'}</div></div>`; }).join('');
  const manualRows = (d.addonManual || []).map((a, i) => `<div class="addon manual on">
      <input data-f="amNama" data-i="${i}" value="${esc(a.nama)}" placeholder="Nama add-on (mis. MUA, cetak 12R)" aria-label="Nama add-on">
      <input class="uang tnum" data-f="amHarga" data-i="${i}" inputmode="numeric" value="${titik(a.harga)}" placeholder="Harga" aria-label="Harga add-on">
      <button type="button" class="x" data-act="hapusAddonManual" data-i="${i}" aria-label="Hapus add-on">×</button></div>`).join('');
  return `${kepala(d.id ? 'Ubah jadwal' : 'Jadwal baru')}
  <div class="sheet-body form-dua">
    <div class="form-kiri">
      ${bagian(1, 'Pemesan', 'Nama yang booking dan kontaknya', `
        ${fld('Nama yang booking', `<input class="besar" data-f="customer" value="${esc(d.customer)}" autocomplete="off" placeholder="mis. Rani Putri">`, { wajib: true })}
        <div class="grid2">
          ${fld('No. HP', `<input data-f="kontak" value="${esc(d.kontak)}" inputmode="tel" autocomplete="off" placeholder="08…">`, { wajib: true })}
          ${fld('Instagram', `<input data-f="ig" value="${esc(d.ig)}" autocomplete="off" placeholder="@username">`, { bantu: 'media sosial' })}
        </div>`)}
      ${bagian(2, 'Paket', 'Jenis paket dan paket berapa yang diambil', `
        ${fld('Jenis paket', pilihan('jenis', daftarJenis(), d.jenis), { wajib: true })}
        <div class="f"><span>Paket berapa <em>*</em></span>${kartuPaket(d.jenis, d.paket)}</div>`)}
      ${bagian(3, 'Add-on', 'Tambahan di luar paket — jumlah bisa diketik', `<div class="addon-list">${addonRows}${manualRows}</div>
        <button type="button" class="tambah-baris" data-act="tambahAddonManual">+ Add-on lain (isi manual)</button>`)}
      ${bagian(4, 'Tanggal', 'Tanggal booking otomatis, tanggal fotoshoot diisi manual', `
        <div class="tgl-booking"><span>Tanggal booking <small>otomatis</small></span><b>${d.tglBooking ? esc(tglPanjang(d.tglBooking)) : 'tidak tercatat'}</b></div>
        <div class="grid2">
          ${fld('Tanggal fotoshoot', `<input type="date" data-f="tanggal" value="${esc(d.tanggal)}">`, { wajib: true })}
          ${fld('Jam', `<input type="time" data-f="jam" value="${esc(d.jam)}">`, { bantu: 'opsional' })}
        </div>
        <div class="hari-besar" id="hariJadwal">${d.tanggal ? 'Fotoshoot: ' + esc(tglPanjang(d.tanggal)) : 'Pilih tanggal fotoshoot'}</div>
        ${bentrok.length ? `<div class="peringatan">Jam sama dengan: ${bentrok.map(j => esc(j.customer) + (j.fotografer ? ' (' + esc(j.fotografer) + ')' : '')).join(', ')}</div>` : ''}
        ${fld('Fotografer', pilihan('fotografer', S.fotografer, d.fotografer, '— belum ditentukan'), { bantu: 'opsional, bisa diisi nanti' })}`)}
      ${bagian(5, 'Pembayaran', 'DP atau lunas — tercatat di Pemasukan', (() => {
        const mj = d.id ? pemasukanJadwal(d) : null, tot = totalBooking(d), dp30 = naik500(tot * (Number(S.setelan.dpPersen) || 0) / 100);
        if (!mj) return `<div class="bayar-aksi">
            <button type="button" class="btn btn-dp" data-act="dpDariJadwal"><b>DP ${S.setelan.dpPersen}%</b><span class="tnum" id="nomDp">${rp(dp30)}</span></button>
            <button type="button" class="btn" data-act="lunasDariJadwal"><b>Lunas</b><span class="tnum" id="nomLunas">${rp(tot)}</span></button></div>
          <small class="bantu">${d.id ? '' : 'Jadwal disimpan dulu, lalu form pemasukan terbuka. '}DP tidak dihitung pemasukan bulan ini sampai lunas.</small>`;
        if (mj.bayar === 'dp') return `<div class="bayar-status dp"><div><b>DP ${rp(mj.dp)}</b><span>tgl ${esc(tglPendek(mj.tglDp || mj.tanggal))} · sisa ${rp(sisaTagihan(mj))}</span></div>
            <button type="button" class="btn btn-utama btn-kecil" data-act="bukaLunas" data-id="${mj.id}">Lunas</button><button type="button" class="btn btn-kecil" data-act="editMasuk" data-id="${mj.id}">Lihat</button></div>`;
        return `<div class="bayar-status ok"><div><b>Lunas ${rp(jumlahMasuk(mj))}</b><span>tgl ${esc(tglPendek(mj.tanggal))}${mj.dp ? ' · pernah DP ' + rp(mj.dp) : ''}</span></div><button type="button" class="btn btn-kecil" data-act="editMasuk" data-id="${mj.id}">Lihat</button></div>`;
      })())}
      ${d.id ? bagian(6, 'Status', 'Progres pengerjaan', `<div class="langkah">${STATUS_JADWAL.map((s, i) => `<button type="button" class="${i < iStatus ? 'lewat' : i === iStatus ? 'on' : ''}" data-act="setF" data-k="status" data-v="${esc(s)}"><i>${i < iStatus ? '✓' : i + 1}</i>${esc(s)}</button>`).join('')}</div>`) : ''}
    </div>
    <aside class="form-kanan"><div class="kanan-sticky">${ringkasJadwal()}</div></aside>
  </div>
  <div class="sheet-foot">
    ${d.id ? '<button class="btn btn-hapus btn-kecil" data-act="hapusJadwal">Hapus</button>' : ''}
    ${d.kontak ? '<button class="btn btn-kecil" data-act="waJadwal">Konfirmasi WA</button>' : ''}
    <div class="foot-total"><span>Total booking</span><b class="tnum" id="footBooking">${rp(totalBooking(d))}</b></div>
    <span class="spacer"></span>
    <button class="btn" data-act="tutup">Batal</button>
    <button class="btn btn-utama" data-act="simpanJadwal">Simpan</button>
  </div>`;
}
function ringkasJadwal() {
  const d = F, p = cariPaket(d.jenis, d.paket);
  return `<div class="ringkas ringkas-form">
    <div class="ringkas-judul">Total booking</div>
    <div class="ringkas-besar tnum">${rp(totalBooking(d))}</div>
    <div class="row"><span>${p ? esc(d.jenis.replace(/^Paket /, '') + ' · ' + p.paket) : 'Paket belum dipilih'}</span><span class="tnum">${rp(p?.harga || 0)}</span></div>
    ${addonRinci(d).map(a => `<div class="row"><span>+${a.qty} ${esc(a.satuan)} × ${rp(a.harga)}</span><span class="tnum">${rp(a.qty * a.harga)}</span></div>`).join('')}
    ${addonManual(d).map(a => `<div class="row"><span>+ ${esc(a.nama.trim() || 'add-on')}</span><span class="tnum">${rp(a.harga)}</span></div>`).join('')}
    <div class="row sub-total"><span>Tanggal</span></div>
    <div class="row"><span>Booking</span><span>${d.tglBooking ? esc(tglPendek(d.tglBooking)) : '—'}</span></div>
    <div class="row"><span>Fotoshoot</span><b>${d.tanggal ? esc(tglPanjang(d.tanggal)) : '—'}${d.jam ? ' · ' + esc(d.jam) : ''}</b></div>
    ${d.customer ? `<small class="bantu" style="display:block;margin-top:8px">${esc(d.customer)}${d.kontak ? ' · ' + esc(d.kontak) : ''}${d.ig ? ' · ' + esc(d.ig) : ''}</small>` : ''}
  </div>`;
}
function simpanJadwalData() {
  if (!F.customer.trim()) return toast('Isi nama yang booking dulu'), null;
  if (!F.kontak.trim()) return toast('Isi no. HP dulu'), null;
  if (!F.jenis || !F.paket) return toast('Pilih jenis paket dan paket dulu'), null;
  if (!F.tanggal) return toast('Isi tanggal fotoshoot'), null;
  const j = { ...F, customer: F.customer.trim(), kontak: F.kontak.trim(), ig: F.ig.trim() };
  if (!j.id) { j.id = uid(); S.jadwal.push(j); } else S.jadwal[S.jadwal.findIndex(x => x.id === j.id)] = j;
  simpan(); hariPilih = j.tanggal; bulanKal = keTgl(j.tanggal.slice(0, 8) + '01');
  return j;
}
// total booking di ringkasan, footer & tombol DP/Lunas ikut berubah saat mengetik
function segarkanJadwal() {
  const r = document.querySelector('.form-kanan .kanan-sticky'); if (r) r.innerHTML = ringkasJadwal();
  const tot = totalBooking(F), set = (id, v) => { const e = $(id); if (e) e.textContent = rp(v); };
  set('#footBooking', tot); set('#nomLunas', tot); set('#nomDp', naik500(tot * (Number(S.setelan.dpPersen) || 0) / 100));
}
function simpanJadwal() { if (simpanJadwalData()) { tutupModal(); render(); toast('Jadwal tersimpan'); } }
// Dari jadwal: simpan dulu, lalu buka form pemasukan (DP 30% atau lunas) yang sudah terisi paket + add-on
function bayarDariJadwal(bayar) { const j = simpanJadwalData(); if (!j) return; tutupModal(); render(); masukBaru(j, bayar); }
const pemasukanJadwal = j => S.masuk.find(m => m.jadwalId === j.id);
function waJadwal() {
  let no = String(F.kontak).replace(/\D/g, ''); if (no.startsWith('0')) no = '62' + no.slice(1);
  const h = cariPaket(F.jenis, F.paket)?.harga;
  const add = [...addonRinci(F).map(a => `➕ ${a.qty} ${a.satuan} × ${rp(a.harga)}`), ...addonManual(F).map(a => `➕ ${a.nama.trim() || 'add-on'} ${rp(a.harga)}`)].join('\n');
  const teks = `Halo ${F.customer.trim()}, jadwal foto di ${S.setelan.nama} sudah kami catat:\n\n📅 ${tglPanjang(F.tanggal)}${F.jam ? '\n⏰ ' + F.jam : ''}\n📦 ${F.jenis} · ${F.paket}${h ? ' (' + rp(h) + ')' : ''}${add ? '\n' + add : ''}\n💰 Total ${rp(totalBooking(F))}\n\nTerima kasih 🙏`;
  window.open('https://wa.me/' + no + '?text=' + encodeURIComponent(teks), '_blank');
}

// Pemasukan
function masukBaru(dari, bayar = 'lunas') {
  const tgl = (bayar === 'dp' ? hariIni : dari?.tanggal) || (tab === 'masuk' && periode !== 'semua' && !hariIni.startsWith(periode) ? periode + '-01' : hariIni);
  F = { id: null, tanggal: tgl, waktu: jamSekarang(), bulan: bulanDari(tgl), customer: '', jenisJual: 'PAKET', jenis: '', paket: '', qty: 1, nilai: 0,
    item: '', tambahan: 'TIDAK', ket: '', nominal: 0, tipeTambah: 'diskon', tanda: '-', fotografer: '', feeRp: 0, feeManual: false, editor: '', feeEdit: 0, cetak: [], jadwalId: '', bayar, dp: 0, dpManual: false };
  if (dari) {
    Object.assign(F, { customer: dari.customer, jenis: dari.jenis, paket: dari.paket, fotografer: dari.fotografer, jadwalId: dari.id, jenisJual: /pas photo/i.test(dari.jenis) ? 'PAS PHOTO' : 'PAKET' });
    const add = addonTotal(dari);   // add-on booking → Tambahan "biaya tambahan" (ikut dihitung fee, seperti Excel)
    if (add) Object.assign(F, { tambahan: 'ADA', tipeTambah: 'tambah', tanda: '+', nominal: add, ket: addonKet(dari) });
  }
  else { const j = jenisUntuk(F.jenisJual)[0] || ''; F.jenis = j; F.paket = paketDari(j)[0]?.paket || ''; }
  isiHarga(); formJenis = 'masuk'; bukaModal(formMasuk(), 'lebar');
}
const jenisUntuk = jual => daftarJenis().filter(j => jual === 'PAS PHOTO' ? /pas photo/i.test(j) : !/pas photo/i.test(j));
function isiHarga() {
  const p = cariPaket(F.jenis, F.paket);
  if (F.jenisJual !== 'CETAK') F.nilai = p ? p.harga : 0;
  hitungFee();
}
function hitungFee() { if (!F.feeManual) F.feeRp = feeOtomatis(F); if (F.bayar === 'dp' && !F.dpManual) F.dp = dpOtomatis(F); }

function ringkasMasuk() {
  const r = rincianMasuk(F), a = aturanFee(F.jenis, F.paket);
  const tot = Math.max(1, r.jumlah), p = v => Math.max(0, v) / tot * 100;
  const feeLabel = F.feeManual ? 'manual' : a.tipe === 'nominal' ? 'tetap' : a.nilai + '%';
  const isDp = F.bayar === 'dp';
  return `<div class="ringkas ringkas-form">
    <div class="ringkas-judul">${isDp ? 'DP diterima (belum dihitung)' : 'Jumlah masuk'}</div>
    <div class="ringkas-besar tnum">${rp(isDp ? F.dp : r.jumlah)}</div>
    ${isDp ? `<div class="row"><span>Total booking</span><span class="tnum">${rp(r.jumlah)}</span></div><div class="row"><span>Sisa tagihan</span><b class="tnum">${rp(sisaTagihan(F))}</b></div>` : ''}
    <div class="bar"><i class="c-cetak" style="width:${p(r.cetak)}%"></i><i class="c-fee" style="width:${p(r.fee + r.edit)}%"></i><i class="c-studio" style="width:${p(r.studio)}%"></i></div>
    <div class="row"><span>Nilai penjualan${F.qty > 1 ? ' × ' + F.qty : ''}</span><span class="tnum">${rp((Number(F.nilai) || 0) * (Number(F.qty) || 0))}</span></div>
    ${nominalOf(F) ? `<div class="row"><span>${esc(TIPE_TAMBAH[F.tipeTambah])}</span><span class="tnum">${nominalOf(F) > 0 ? '+' : '−'} ${rp(Math.abs(nominalOf(F) * (Number(F.qty) || 0)))}</span></div>` : ''}
    <div class="row sub-total"><span>Pembagian</span></div>
    <div class="row"><span><i class="c-cetak"></i>Biaya cetak</span><span class="tnum">− ${rp(r.cetak)}</span></div>
    <div class="row"><span><i class="c-fee"></i>Fee ${F.fotografer ? esc(F.fotografer) + ' (' + feeLabel + ')' : 'fotografer'}</span><span class="tnum">− ${rp(r.fee)}</span></div>
    ${r.edit ? `<div class="row"><span><i class="c-fee"></i>Fee edit ${esc(F.editor)}</span><span class="tnum">− ${rp(r.edit)}</span></div>` : ''}
    <div class="row total"><span><i class="c-studio"></i>Sisa untuk studio</span><b class="tnum ${r.studio < 0 ? 'neg' : ''}">${rp(r.studio)}</b></div>
    ${r.cetak || r.fee || r.edit ? `<small class="bantu" style="display:block;margin-top:8px">${isDp ? 'Fee & cetak dicatat ke Pengeluaran saat lunas.' : 'Fee & cetak otomatis masuk Pengeluaran (status BELUM).'}</small>` : ''}
  </div>`;
}
const totalBawah = () => F.bayar === 'dp' ? `<span>DP diterima</span><b class="tnum">${rp(F.dp)}</b>` : `<span>Jumlah masuk</span><b class="tnum">${rp(jumlahMasuk(F))}</b>`;

function formMasuk() {
  const d = F, cetakMode = d.jenisJual === 'CETAK', a = aturanFee(d.jenis, d.paket);
  const ukuran = Object.keys(S.cetakHarga);
  const cetakRows = d.cetak.map((c, i) => {
    const arr = S.cetakHarga[c.ukuran] || [];
    return `<div class="item item-cetak">
      <select data-f="cUkuran" data-i="${i}" aria-label="Ukuran">${ukuran.map(u => `<option ${u === c.ukuran ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>
      <select data-f="cKolom" data-i="${i}" aria-label="Jenis cetak">${KOLOM_CETAK.map((k, ki) => arr[ki] ? `<option value="${ki}" ${ki === c.kolom ? 'selected' : ''}>${k} — ${rp(arr[ki])}</option>` : '').join('')}</select>
      <div class="qty"><button type="button" data-act="qty" data-i="${i}" data-d="-1" aria-label="Kurangi">−</button><b class="tnum">${c.qty}</b><button type="button" data-act="qty" data-i="${i}" data-d="1" aria-label="Tambah">+</button></div>
      <button type="button" class="x" data-act="hapusCetak" data-i="${i}" aria-label="Hapus">×</button></div>`;
  }).join('');
  const bantuFee = d.feeManual ? 'diubah manual · <a href="#" data-act="feeAuto">hitung ulang otomatis</a>' : a.tipe === 'nominal' ? `otomatis: fee tetap ${rp(a.nilai)}` : `otomatis: ${a.nilai}% dari harga paket`;
  return `${kepala(d.id ? 'Ubah pemasukan' : 'Pemasukan baru')}
  <div class="sheet-body form-dua">
    <div class="form-kiri">
      ${bagian(1, 'Customer', 'Siapa dan kapan bayar', `
        ${fld('Nama customer', `<input class="besar" data-f="customer" value="${esc(d.customer)}" autocomplete="off" placeholder="mis. Rani Putri">`, { wajib: true })}
        <div class="grid3">
          ${fld('Tanggal', `<input type="date" data-f="tanggal" value="${esc(d.tanggal)}">`, { wajib: true })}
          ${fld('Waktu', `<input type="time" data-f="waktu" value="${esc(d.waktu)}">`)}
          ${fld('Laporan bulan', pilihBulan(d.bulan), { bantu: 'otomatis dari tanggal' })}
        </div>`)}
      ${bagian(2, 'Penjualan', 'Apa yang dibeli', `
        <div class="f"><span>Jenis penjualan <em>*</em></span>${segPenuh('jenisJual', [['PAKET', 'Paket'], ['PAS PHOTO', 'Pas Photo'], ['CETAK', 'Cetak']], d.jenisJual)}</div>
        ${cetakMode ? fld('Nama item', `<input data-f="item" value="${esc(d.item || '')}" placeholder="mis. cetak 16R + canvas">`, { wajib: true }) : `
          ${fld('Jenis paket', pilihan('jenis', jenisUntuk(d.jenisJual), d.jenis, '— pilih jenis paket'), { wajib: true })}
          <div class="f"><span>Paket <em>*</em></span>${kartuPaket(d.jenis, d.paket)}</div>`}
        <div class="grid2">
          ${fld('Nilai penjualan', uang('nilai', d.nilai), { wajib: true, bantu: cetakMode ? '' : 'terisi dari paket, bisa diubah' })}
          ${fld('Jumlah paket', `<input type="number" min="1" data-f="qty" value="${d.qty}">`)}
        </div>
        ${cetakMode ? '' : fld('Keterangan paket', `<input data-f="item" value="${esc(d.item || '')}" placeholder="mis. post card, + 8 orang, file only">`, { bantu: 'opsional — tampil di kolom Paket laporan' })}`)}
      ${bagian(3, 'Tambahan / potongan', 'Diskon, DP, atau biaya tambahan', `
        ${saklar('tambahan', d.tambahan === 'ADA', 'Ada tambahan / potongan')}
        ${d.tambahan === 'ADA' ? `
          ${segPenuh('tipeTambah', Object.entries(TIPE_TAMBAH), d.tipeTambah)}
          <div class="grid2">
            ${fld('Keterangan', `<input data-f="ket" value="${esc(d.ket)}" placeholder="${d.tipeTambah === 'diskon' ? 'disc 15%' : d.tipeTambah === 'dp' ? 'dp 50 bulan lalu' : 'tambah 2 orang'}">`)}
            <div class="f"><span>Nominal</span><div class="nominal">${seg('tanda', [['-', '−'], ['+', '+']], d.tanda)}${uang('nominalAbs', Math.abs(d.nominal))}</div><small class="bantu">− mengurangi, + menambah jumlah</small></div>
          </div>` : ''}`)}
      ${bagian(4, 'Pembayaran', 'Lunas sekarang atau DP dulu', `
        ${segPenuh('bayar', [['lunas', 'Lunas'], ['dp', 'DP dulu']], d.bayar || 'lunas')}
        ${d.bayar === 'dp' ? `<div class="grid2">
          ${fld('Nominal DP', uang('dp', d.dp), { wajib: true, bantu: d.dpManual ? 'diubah manual · <a href="#" data-act="dpAuto">kembali ' + S.setelan.dpPersen + '% otomatis</a>' : 'otomatis ' + S.setelan.dpPersen + '% dari jumlah, bisa diubah' })}
          <div class="f"><span>Sisa tagihan</span><b class="kas-bca tnum" id="sisaDp">${rp(sisaTagihan(d))}</b></div>
        </div>
        <div class="catatan" style="margin:0">DP masuk <b>Catatan DP</b> dan <b>tidak dihitung</b> pemasukan bulan ini. Saat lunas, totalnya masuk pemasukan bulan pelunasan.</div>`
        : d.tglLunas && d.dp ? `<small class="bantu">Pernah DP ${rp(d.dp)} tgl ${esc(tglPendek(d.tglDp))}, lunas ${esc(tglPendek(d.tglLunas))}.</small>` : ''}`)}
      ${bagian(5, 'Pembagian', d.bayar === 'dp' ? 'Dicatat ke Pengeluaran saat lunas' : 'Otomatis tercatat di Pengeluaran', `
        ${cetakMode ? '' : `<div class="grid2">
          ${fld('Fotografer', pilihan('fotografer', S.fotografer, d.fotografer, '— tidak ada'))}
          ${d.fotografer ? fld('Fee fotografer', uang('feeRp', d.feeRp), { bantu: bantuFee }) : '<div></div>'}
        </div>`}
        <div class="grid2">
          ${fld('Editor', pilihan('editor', S.editor, d.editor, '— tidak ada'))}
          ${d.editor ? fld('Fee edit', uang('feeEdit', d.feeEdit), { bantu: 'isi manual' }) : '<div></div>'}
        </div>
        <div class="f"><span>Cetakan</span>${cetakRows}<button type="button" class="tambah-baris" data-act="tambahCetak">+ Tambah cetakan (harga rekanan)</button></div>`)}
    </div>
    <aside class="form-kanan"><div class="kanan-sticky" id="ringkas">${ringkasMasuk()}</div></aside>
  </div>
  <div class="sheet-foot">
    ${d.id ? '<button class="btn btn-hapus btn-kecil" data-act="hapusMasuk">Hapus</button>' : ''}
    <div class="foot-total" id="footTotal">${totalBawah()}</div>
    <span class="spacer"></span>
    <button class="btn" data-act="tutup">Batal</button>
    <button class="btn btn-utama" data-act="simpanMasuk">Simpan</button>
  </div>`;
}
function simpanMasuk() {
  const d = F;
  if (!d.customer.trim()) return toast('Isi nama customer dulu');
  if (!jumlahMasuk(d) && !confirm('Jumlah pemasukan Rp 0. Tetap simpan?')) return;
  const m = { ...d, customer: d.customer.trim(), qty: Number(d.qty) || 1 };
  delete m.tanda;
  if (m.jenisJual === 'CETAK') { m.jenis = ''; m.paket = ''; m.fotografer = ''; m.feeRp = 0; }
  if (!m.fotografer) m.feeRp = 0;
  if (!m.editor) m.feeEdit = 0;
  const lama = m.id ? S.masuk.find(x => x.id === m.id) : null;
  if (m.bayar === 'dp') {
    if (!(Number(m.dp) > 0)) return toast('Isi nominal DP dulu');
    m.tglDp = m.tanggal;
  } else if (lama?.bayar === 'dp') m.tglLunas = m.tanggal;   // dilunasi lewat form ubah
  if (!m.id) { m.id = uid(); S.masuk.push(m); } else S.masuk[S.masuk.findIndex(x => x.id === m.id)] = m;
  if (m.bayar === 'dp') S.keluar = S.keluar.filter(k => k.dari !== m.id); else sinkronKeluar(m);
  if (m.jadwalId && m.bayar !== 'dp') { const j = S.jadwal.find(x => x.id === m.jadwalId); if (j && j.status === 'Belum Foto') j.status = 'Sudah Foto Belum Edit'; }
  simpan(); tutupModal(); render(); toast(m.bayar === 'dp' ? 'DP tersimpan di Catatan DP' : 'Pemasukan tersimpan');
}

// Fee & cetak dari satu pemasukan → baris Pengeluaran yang terhubung (status lama dipertahankan).
function sinkronKeluar(m) {
  const lama = S.keluar.filter(k => k.dari === m.id);
  const statusLama = Object.fromEntries(lama.map(k => [k.kunci, k.status]));
  S.keluar = S.keluar.filter(k => k.dari !== m.id);
  const label = [m.jenisJual === 'CETAK' ? 'Cetak' : m.paket, m.jenis.replace(/^Paket /, ''), m.customer].filter(Boolean).join(' ');
  const baru = [];
  if (m.fotografer && m.feeRp) baru.push({ kunci: 'fee', jenis: 'fee', fotografer: m.fotografer, nama: `Fee ${m.fotografer} ${label}`, nominal: m.feeRp, jumlah: 1 });
  if (m.editor && m.feeEdit) baru.push({ kunci: 'edit', jenis: 'edit', fotografer: m.editor, nama: `Fee edit ${m.editor} ${m.customer}`, nominal: m.feeEdit, jumlah: 1 });
  (m.cetak || []).forEach((c, i) => baru.push({ kunci: 'cetak' + i, jenis: 'cetak', fotografer: '', nama: `Cetak ${c.ukuran} ${KOLOM_CETAK[c.kolom]} ${m.customer}`.replace(' Cetak ', ' '), nominal: c.harga, jumlah: c.qty }));
  baru.forEach(k => S.keluar.push({ id: uid(), tanggal: m.tanggal, bulan: m.bulan, status: statusLama[k.kunci] || 'BELUM', dari: m.id, ...k }));
}

// Pengeluaran
function keluarBaru() {
  const tgl = periode !== 'semua' && !hariIni.startsWith(periode) ? periode + '-01' : hariIni;
  F = { id: null, tanggal: tgl, bulan: bulanDari(tgl), nama: '', nominal: 0, jumlah: 1, status: 'BELUM', jenis: 'lain', fotografer: '', dari: '', cUkuran: [] };
  formJenis = 'keluar'; bukaModal(formKeluar());
}
function formKeluar() {
  const d = F, kunci = !!d.dari;
  const dis = kunci ? 'disabled' : '';
  return `${kepala(d.id ? 'Ubah pengeluaran' : 'Pengeluaran baru')}
  <div class="sheet-body">
    ${kunci ? '<div class="catatan" style="margin:0 0 12px">Baris ini dibuat otomatis dari pemasukan. Nominal diubah lewat pemasukannya; di sini cukup ubah status.</div>' : ''}
    ${kunci ? '' : bagian(1, 'Jenis pengeluaran', 'Untuk apa uangnya', segPenuh('jenis', [['lain', 'Operasional'], ['cetak', 'Cetak'], ['fee', 'Fee fotografer'], ['edit', 'Fee edit']], d.jenis, 'empat'))}
    ${bagian(kunci ? 1 : 2, 'Detail', 'Nama, harga, dan jumlah', `
      ${!kunci && d.jenis === 'cetak' ? `<div class="f"><span>Ukuran <small class="bantu">bisa pilih lebih dari satu</small></span><div class="seg ukuran-cetak">${UKURAN_CETAK.map(u => `<button type="button" class="${d.cUkuran.includes(u) ? 'on' : ''}" aria-pressed="${d.cUkuran.includes(u)}" data-act="pilihUkuran" data-v="${u}">${u}</button>`).join('')}</div></div>
      ` : ''}
      ${!kunci && d.jenis === 'lain' ? `<div class="f"><span>Pos operasional</span><div class="seg pos-ops">${POS_OPS.map(([id, n]) => `<button type="button" class="${(d.pos || posOps(d)) === id ? 'on' : ''}" data-act="setF" data-k="pos" data-v="${id}">${n}</button>`).join('')}</div><small class="bantu">${d.pos ? 'dipilih manual' : 'ditebak otomatis dari nama — ketuk untuk ganti'}</small></div>` : ''}
      ${!kunci && (d.jenis === 'fee' || d.jenis === 'edit') ? fld(d.jenis === 'fee' ? 'Fotografer' : 'Editor', pilihan('fotografer', d.jenis === 'fee' ? S.fotografer : S.editor, d.fotografer, '—')) : ''}
      ${!kunci && d.jenis === 'cetak'
        ? fld('Keterangan', `<input data-f="nama" value="${esc(d.nama)}" placeholder="mis. + bingkai 3cm A3, canvas, untuk Rani">`, { bantu: d.cUkuran.length ? `tercatat sebagai: <b>${esc(namaCetakKeluar(d))}${d.nama.trim() ? ' · ' + esc(d.nama.trim()) : ''}</b>` : 'pilih ukuran supaya nama terisi otomatis' })
        : fld('Pengeluaran', `<input class="besar" data-f="nama" value="${esc(d.nama)}" placeholder="mis. galon, lakban, listrik" ${dis}>`, { wajib: true })}
      <div class="grid2">
        ${fld('Harga satuan', kunci ? `<input value="${titik(d.nominal)}" disabled>` : uang('nominal', d.nominal), { wajib: true })}
        ${fld('Jumlah', `<input type="number" min="1" data-f="jumlah" value="${d.jumlah}" ${dis}>`)}
      </div>
      <div class="ringkas" id="ringkas" style="margin-top:0"><div class="row total" style="margin:0;border:0;padding:0"><span>Total</span><b class="tnum">${rp(totalKeluar(d))}</b></div></div>`)}
    ${bagian(kunci ? 2 : 3, 'Waktu & status', 'Tanggal dan sudah dibayar atau belum', `
      <div class="grid2">
        ${fld('Tanggal', `<input type="date" data-f="tanggal" value="${esc(d.tanggal)}" ${dis}>`)}
        ${fld('Pengeluaran bulan', pilihBulan(d.bulan), { bantu: 'otomatis dari tanggal' })}
      </div>
      <div class="f"><span>Status</span>${segPenuh('status', [['BELUM', 'Belum dibayar'], ['SELESAI', 'Selesai']], d.status)}</div>`)}
  </div>
  <div class="sheet-foot">
    ${d.id && !kunci ? '<button class="btn btn-hapus btn-kecil" data-act="hapusKeluar">Hapus</button>' : ''}
    ${kunci ? '<button class="btn btn-kecil" data-act="bukaAsal">Buka pemasukannya</button>' : ''}
    <span class="spacer"></span>
    <button class="btn" data-act="tutup">Batal</button>
    <button class="btn btn-utama" data-act="simpanKeluar">Simpan</button>
  </div>`;
}
function simpanKeluar() {
  // Cetak: nama otomatis dari ukuran + jenis cetak + bahan; keterangan opsional ditambahkan di belakang
  const cetakBaru = F.jenis === 'cetak' && !F.dari, otomatis = cetakBaru && F.cUkuran.length ? namaCetakKeluar(F) : '', ket = F.nama.trim();
  const nama = cetakBaru ? (otomatis ? otomatis + (ket ? ' · ' + ket : '') : ket || 'Cetak') : ket;
  if (!nama) return toast('Isi nama pengeluaran dulu');
  const k = { ...F, nama, jumlah: Number(F.jumlah) || 1 };
  delete k.cUkuran;
  if (!k.id) { k.id = uid(); S.keluar.push(k); } else S.keluar[S.keluar.findIndex(x => x.id === k.id)] = k;
  simpan(); tutupModal(); render(); toast('Pengeluaran tersimpan');
}

// ---------- ekspor ----------
function unduh(nama, isi, tipe) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([isi], { type: tipe }));
  a.download = nama; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportCsv(j) {
  const sel = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  let rows;
  if (j === 'masuk') {
    rows = [['No', 'Laporan Bulan', 'Hari/Tanggal', 'Waktu', 'Nama Customer', 'Jenis Paket', 'Paket', 'Jumlah Paket', 'Nilai Penjualan', 'Jenis Penjualan', 'Tambahan', 'Keterangan', 'Nominal', 'Jumlah', 'Fotografer', 'Fee', 'Fee edit', 'Biaya cetak']];
    S.masuk.filter(dalamPeriode).filter(sudahLunas).forEach((m, i) => { const r = rincianMasuk(m); rows.push([i + 1, m.bulan, m.tanggal, m.waktu, m.customer, m.jenis, m.paket, m.qty, m.nilai, m.jenisJual, m.tambahan, m.ket, nominalOf(m), r.jumlah, m.fotografer, r.fee, r.edit, r.cetak]); });
  } else {
    rows = [['No', 'Pengeluaran Bulan', 'Tanggal', 'Pengeluaran', 'Nominal', 'Jumlah', 'Total', 'Status']];
    S.keluar.filter(dalamPeriode).forEach((k, i) => rows.push([i + 1, k.bulan, k.tanggal, k.nama, k.nominal, k.jumlah, totalKeluar(k), k.status]));
  }
  unduh(`${j === 'masuk' ? 'pemasukan' : 'pengeluaran'}-${periode}.csv`, '﻿' + rows.map(r => r.map(sel).join(';')).join('\n'), 'text/csv;charset=utf-8');
}

// ---------- event ----------
const AKSI = {
  tab: el => { tab = el.dataset.tab; ui('tab', tab); animasi = true; render(); window.scrollTo(0, 0); },
  buka: el => { tab = el.dataset.v; ui('tab', tab); animasi = true; render(); window.scrollTo(0, 0); },
  bukaKas: el => { filterKas = el.dataset.v || 'semua'; if (filterKas === 'dp') periode = hariIni.slice(0, 7); tab = 'kas'; animasi = true; render(); window.scrollTo(0, 0); },
  bukaFee: () => { filterKeluar = 'BELUM'; periode = 'semua'; tab = 'keluar'; animasi = true; render(); window.scrollTo(0, 0); },
  filterKas: el => { filterKas = el.dataset.v; render(); },
  hapusCari: () => { cari = ''; render(); },
  menuTambah,
  pilihUkuran: el => { const u = el.dataset.v; F.cUkuran = F.cUkuran.includes(u) ? F.cUkuran.filter(x => x !== u) : UKURAN_CETAK.filter(x => x === u || F.cUkuran.includes(x)); gambarUlangForm(); },
  gantiFont: el => { S.setelan.font = el.dataset.v; simpan(); render(); toast('Font: ' + el.dataset.v); },
  tambahJenis: el => { const v = el.dataset.v; tutupModal(); ({ jadwal: jadwalBaru, masuk: () => masukBaru(), dp: () => masukBaru(null, 'dp'), lunas: daftarPelunasan, keluar: keluarBaru })[v](); },
  tambah: () => ({ jadwal: jadwalBaru, masuk: () => masukBaru(), keluar: keluarBaru }[tab] || (() => {}))(),
  pilihHari: el => { hariPilih = el.dataset.tgl; render(); },
  bulanKal: el => { bulanKal = new Date(bulanKal.getFullYear(), bulanKal.getMonth() + Number(el.dataset.d), 1); render(); },
  keHariIni: () => { hariPilih = hariIni; bulanKal = keTgl(hariIni.slice(0, 8) + '01'); render(); },
  geserPeriode: el => { const [y, m] = periode.split('-').map(Number); periode = iso(new Date(y, m - 1 + Number(el.dataset.d), 1)).slice(0, 7); render(); },
  periodeSemua: () => { periode = periode === 'semua' ? hariIni.slice(0, 7) : 'semua'; render(); },
  filterKeluar: el => { filterKeluar = el.dataset.v; render(); },
  exportCsv: el => exportCsv(el.dataset.j),
  tutup: tutupModal,
  setF: el => {
    const k = el.dataset.k, v = el.dataset.v;
    F[k] = v;
    if (k === 'tanda') F.nominal = (v === '-' ? -1 : 1) * Math.abs(F.nominal);
    if (formJenis === 'masuk') {
      if (k === 'paket') isiHarga();
      if (k === 'bayar' && v === 'dp' && !F.dpManual) F.dp = dpOtomatis(F);
      if (k === 'jenisJual') { if (v === 'CETAK') { F.jenis = ''; F.paket = ''; F.nilai = 0; F.fotografer = ''; } else { F.jenis = jenisUntuk(v)[0] || ''; F.paket = paketDari(F.jenis)[0]?.paket || ''; isiHarga(); } }
      if (k === 'tipeTambah') { F.tanda = v === 'diskon' ? '-' : v === 'tambah' ? '+' : F.tanda; F.nominal = (F.tanda === '-' ? -1 : 1) * Math.abs(F.nominal); }
      hitungFee();
    }
    if (formJenis === 'keluar' && k === 'jenis') { F.fotografer = ''; F.cUkuran = []; }
    gambarUlangForm();
  },
  dpAuto: () => { F.dpManual = false; hitungFee(); gambarUlangForm(); },
  bukaLunas: el => { const m = S.masuk.find(x => x.id === el.dataset.id); F = { id: m.id, tanggal: hariIni, bayarLunas: sisaTagihan(m) }; formJenis = 'lunas'; bukaModal(formLunas()); },
  simpanLunas,
  feeAuto: () => { F.feeManual = false; hitungFee(); gambarUlangForm(); },
  // jadwal
  editJadwal: el => { F = JSON.parse(JSON.stringify(S.jadwal.find(j => j.id === el.dataset.id))); F.addon ||= {}; F.addonManual ||= []; F.ig ||= ''; formJenis = 'jadwal'; bukaModal(formJadwal(), 'lebar'); },
  simpanJadwal, waJadwal,
  hapusJadwal: () => { if (!confirm('Hapus jadwal ' + F.customer + '?')) return; S.jadwal = S.jadwal.filter(j => j.id !== F.id); simpan(); tutupModal(); render(); toast('Jadwal dihapus'); },
  dpDariJadwal: () => bayarDariJadwal('dp'),
  lunasDariJadwal: () => bayarDariJadwal('lunas'),
  dpKartu: el => { const j = S.jadwal.find(x => x.id === el.dataset.id); masukBaru(j, 'dp'); },
  masukDariJadwal: () => { const j = { ...F }; tutupModal(); tab = 'masuk'; ui('tab', tab); periode = j.tanggal.slice(0, 7); render(); masukBaru(j); },
  // pemasukan
  editMasuk: el => { F = JSON.parse(JSON.stringify(S.masuk.find(m => m.id === el.dataset.id))); F.tanda = F.nominal < 0 ? '-' : '+'; F.feeManual = F.feeRp !== feeOtomatis(F); formJenis = 'masuk'; bukaModal(formMasuk(), 'lebar'); },
  simpanMasuk,
  hapusMasuk: () => {
    const n = S.keluar.filter(k => k.dari === F.id).length;
    if (!confirm('Hapus pemasukan ' + F.customer + '?' + (n ? ` ${n} baris pengeluaran otomatis (fee/cetak) ikut terhapus.` : ''))) return;
    S.keluar = S.keluar.filter(k => k.dari !== F.id); S.masuk = S.masuk.filter(m => m.id !== F.id); simpan(); tutupModal(); render(); toast('Pemasukan dihapus');
  },
  tambahCetak: () => { const u = '12R'; const ki = 3; F.cetak.push({ ukuran: u, kolom: ki, qty: 1, harga: S.cetakHarga[u]?.[ki] || 0 }); gambarUlangForm(); },
  hapusCetak: el => { F.cetak.splice(Number(el.dataset.i), 1); gambarUlangForm(); },
  qty: el => { const c = F.cetak[el.dataset.i]; c.qty = Math.max(1, c.qty + Number(el.dataset.d)); gambarUlangForm(); },
  // pengeluaran
  editKeluar: el => { F = JSON.parse(JSON.stringify(S.keluar.find(k => k.id === el.dataset.id))); F.cUkuran = []; formJenis = 'keluar'; bukaModal(formKeluar()); },
  simpanKeluar,
  hapusKeluar: () => { if (!confirm('Hapus pengeluaran "' + F.nama + '"?')) return; S.keluar = S.keluar.filter(k => k.id !== F.id); simpan(); tutupModal(); render(); toast('Pengeluaran dihapus'); },
  bukaAsal: () => { const id = F.dari; tutupModal(); AKSI.editMasuk({ dataset: { id } }); },
  tukarStatus: el => { const k = S.keluar.find(x => x.id === el.dataset.id); k.status = k.status === 'SELESAI' ? 'BELUM' : 'SELESAI'; simpan(); render(); },
  lunasFee: el => {
    const n = el.dataset.n, rows = S.keluar.filter(k => dalamPeriode(k) && k.status === 'BELUM' && k.fotografer === n && (k.jenis === 'fee' || k.jenis === 'edit'));
    if (!confirm(`Tandai ${rows.length} fee ${n} (${rp(rows.reduce((s, k) => s + totalKeluar(k), 0))}) sudah dibayar?`)) return;
    rows.forEach(k => k.status = 'SELESAI'); simpan(); render(); toast('Fee ' + n + ' ditandai lunas');
  },
  // pengaturan
  tambahPaket: () => { S.paket.push({ id: uid(), jenis: '', paket: '', harga: 0, feeTipe: 'persen', fee: 25 }); simpan(); render(); document.querySelector('.tabel-in tbody tr:last-child input')?.focus(); },
  hapusPaket: el => { const p = S.paket.find(x => x.id === el.dataset.id); if (!confirm(`Hapus ${p.jenis} · ${p.paket}?`)) return; S.paket = S.paket.filter(x => x.id !== p.id); simpan(); render(); },
  tambahOrang: el => { const inp = $('#baru-' + el.dataset.k), n = inp.value.trim(); if (!n) return; S[el.dataset.k].push(n); simpan(); render(); },
  hapusOrang: el => { const k = el.dataset.k, n = S[k][el.dataset.i]; if (!confirm('Hapus ' + n + ' dari daftar? Catatan lama tetap ada.')) return; S[k].splice(Number(el.dataset.i), 1); simpan(); render(); },
  tambahAddonManual: () => { (F.addonManual ||= []).push({ nama: '', harga: 0 }); gambarUlangForm(); document.querySelector(`[data-f=amNama][data-i="${F.addonManual.length - 1}"]`)?.focus(); },
  hapusAddonManual: el => { F.addonManual.splice(Number(el.dataset.i), 1); gambarUlangForm(); },
  addonQty: el => { const id = el.dataset.id; F.addon[id] = Math.max(0, (Number(F.addon[id]) || 0) + Number(el.dataset.d)); gambarUlangForm(); },
  tambahAddon: () => { S.addon.push({ id: uid(), nama: 'Add-on baru', satuan: 'item', harga: 0 }); simpan(); render(); },
  hapusAddon: el => { const a = S.addon[el.dataset.i]; if (!confirm('Hapus add-on ' + a.nama + '?')) return; S.addon.splice(Number(el.dataset.i), 1); simpan(); render(); },
  tambahTim: () => { (S.setelan.tim ||= []).push({ nama: '', posisi: '', gaji: 0 }); simpan(); render(); },
  hapusTim: el => { const t = S.setelan.tim[el.dataset.i]; if (!confirm('Hapus ' + (t.nama || 'anggota') + ' dari team?')) return; S.setelan.tim.splice(Number(el.dataset.i), 1); simpan(); render(); },
  cetakLaporan: () => { document.querySelectorAll('#view details').forEach(d => d.open = true); window.print(); },
  backup: () => unduh(`backup-studio-foto-${hariIni}.json`, JSON.stringify(S, null, 1), 'application/json'),
  restore: () => $('#fileRestore').click()
};

document.addEventListener('click', e => {
  if (e.target.id === 'modal') return tutupModal();
  const el = e.target.closest('[data-act]');
  if (el && AKSI[el.dataset.act]) { e.preventDefault(); e.stopPropagation(); AKSI[el.dataset.act](el); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').hidden) return tutupModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
});

function nilaiField(el) {
  if (el.classList.contains('uang')) { const n = angka(el.value); el.value = titik(n); return n; }
  return el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
}

document.addEventListener('input', e => {
  const el = e.target;
  // pencarian: dari kotak mana pun pindah ke Riwayat (semua bulan), fokus tetap di kotak cari
  if (el.id === 'cariTop' || el.id === 'cariBeranda' || el.id === 'cariKas') {
    cari = el.value;
    if (tab !== 'kas') { tab = 'kas'; filterKas = 'semua'; periode = 'semua'; }
    render();
    const target = el.id === 'cariTop' ? $('#cariTop') : $('#cariKas');
    if (target) { target.focus(); target.setSelectionRange(cari.length, cari.length); }
    return;
  }
  // pengaturan: disimpan langsung
  if (el.dataset.s) { const k = el.dataset.s; S.setelan[k] = el.classList.contains('uang') ? nilaiField(el) : el.type === 'number' ? Number(el.value) || 0 : el.value; simpan(); if (k === 'nama') $('#namaStudio').textContent = el.value || 'Studio Foto'; return; }
  if (el.dataset.p && el.tagName !== 'SELECT') { const p = S.paket.find(x => x.id === el.dataset.p), k = el.dataset.k; p[k] = k === 'harga' || (k === 'fee' && p.feeTipe === 'nominal') ? nilaiField(el) : k === 'fee' ? Number(el.value) || 0 : el.value; simpan(); return; }
  if (el.dataset.addon) { const a = S.addon[el.dataset.addon]; a[el.dataset.k] = el.dataset.k === 'harga' ? nilaiField(el) : el.value; simpan(); return; }
  if (el.dataset.tim) { const t = S.setelan.tim[el.dataset.tim]; t[el.dataset.k] = el.dataset.k === 'gaji' ? nilaiField(el) : el.value; simpan(); return; }
  if (el.dataset.kas) { const o = S.posisiKas[periode] ||= { cash: 0, bri: 0 }; o[el.dataset.kas] = nilaiField(el); simpan(); const D = dataBulan(periode); $('#bca').textContent = rp(D.bersih - (o.cash || 0) - (o.bri || 0)); return; }
  if (el.dataset.c) { S.cetakHarga[el.dataset.c][Number(el.dataset.i)] = nilaiField(el) || null; simpan(); return; }
  const k = el.dataset.f;
  if (!k || !F || el.tagName === 'SELECT') return;
  if (formJenis === 'jadwal' && ['addonQty', 'amNama', 'amHarga'].includes(k)) {
    if (k === 'addonQty') { const id = el.dataset.id, n = Math.max(0, Number(el.value) || 0), a = S.addon.find(x => x.id === id); F.addon[id] = n; $('#sub-' + id).textContent = n ? rp(n * a.harga) : '—'; el.closest('.addon').classList.toggle('on', n > 0); }
    else { const a = F.addonManual[el.dataset.i]; if (k === 'amNama') a.nama = el.value; else a.harga = nilaiField(el); }
    segarkanJadwal(); return;
  }
  const v = nilaiField(el);
  if (k === 'nominalAbs') F.nominal = (F.tanda === '-' ? -1 : 1) * v;
  else F[k] = v;
  if (formJenis === 'masuk') {
    if (k === 'dp') F.dpManual = true;
    if (k === 'feeRp') F.feeManual = true; else hitungFee();
    if (F.bayar === 'dp') { const di = document.querySelector('[data-f=dp]'); if (di && k !== 'dp') di.value = titik(F.dp); const sd = $('#sisaDp'); if (sd) sd.textContent = rp(sisaTagihan(F)); }
    if (k === 'tanggal' && v) F.bulan = bulanDari(v);
    if (k === 'feeRp' || k === 'feeEdit' || k === 'nilai' || k === 'qty' || k === 'nominalAbs') {
      const inp = document.querySelector('[data-f=feeRp]'); if (inp && k !== 'feeRp') inp.value = titik(F.feeRp);
    }
    $('#ringkas').innerHTML = ringkasMasuk();
    const ft = $('#footTotal'); if (ft) ft.innerHTML = totalBawah();
    if (k === 'tanggal') { const s = document.querySelector('select[data-f=bulan]'); if (s) s.value = F.bulan; }
  } else if (formJenis === 'lunas') {
    const m = S.masuk.find(x => x.id === F.id), li = $('#lunasInfo');
    if (li) li.innerHTML = infoLunas(m);
  } else if (formJenis === 'jadwal') {
    if (k === 'tanggal') $('#hariJadwal').textContent = v ? 'Fotoshoot: ' + tglPanjang(v) : 'Pilih tanggal fotoshoot';
    segarkanJadwal();
  } else if (formJenis === 'keluar') {
    if (k === 'tanggal' && v) { F.bulan = bulanDari(v); const s = document.querySelector('select[data-f=bulan]'); if (s) s.value = F.bulan; }
    $('#ringkas').innerHTML = `<div class="row total"><span>Total</span><b class="tnum">${rp(totalKeluar(F))}</b></div>`;
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.p && el.tagName === 'SELECT') { const p = S.paket.find(x => x.id === el.dataset.p); p.feeTipe = el.value; p.fee = el.value === 'nominal' ? 10000 : 25; simpan(); render(); return; }
  if (el.tagName !== 'SELECT' || !el.dataset.f || !F) return;
  const k = el.dataset.f, v = el.value;
  if (k === 'cUkuran' && formJenis === 'masuk') {
    const c = F.cetak[el.dataset.i], arr = S.cetakHarga[v] || [];
    c.ukuran = v; if (!arr[c.kolom]) c.kolom = arr.findIndex(Boolean); c.harga = arr[c.kolom] || 0;
  } else if (k === 'cKolom' && formJenis === 'masuk') {
    const c = F.cetak[el.dataset.i]; c.kolom = Number(v); c.harga = S.cetakHarga[c.ukuran]?.[c.kolom] || 0;
  } else {
    F[k] = v;
    if (formJenis === 'masuk') {
      if (k === 'jenis') { F.paket = paketDari(v)[0]?.paket || ''; isiHarga(); }
      else if (k === 'paket') isiHarga();
      else hitungFee();
    }
    if (formJenis === 'jadwal' && k === 'jenis') F.paket = paketDari(v)[0]?.paket || '';
    if (formJenis === 'keluar' && k === 'fotografer' && v && !F.nama) F.nama = (F.jenis === 'edit' ? 'Fee edit ' : 'Fee ') + v + ' ';
  }
  gambarUlangForm();
});

$('#fileRestore').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.versi !== 2 || !Array.isArray(d.masuk)) throw 0;
    if (!confirm(`Pulihkan backup berisi ${d.masuk.length} pemasukan & ${d.keluar.length} pengeluaran? Data di perangkat ini akan diganti.`)) return;
    S = d; simpan(); render(); toast('Backup dipulihkan');
  } catch (err) { toast('File backup tidak valid'); }
});

let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2400); }

// rincian yang tertutup tetap ikut tercetak
addEventListener('beforeprint', () => document.querySelectorAll('details.rinci-grup:not([open]),details.rinci-item:not([open])').forEach(d => { d.open = true; d.dataset.cetak = '1'; }));
addEventListener('afterprint', () => document.querySelectorAll('details[data-cetak]').forEach(d => { d.open = false; delete d.dataset.cetak; }));
let ukuranLama = innerWidth;
addEventListener('resize', () => { if (tab === 'laba' && Math.abs(innerWidth - ukuranLama) > 30) { ukuranLama = innerWidth; gambarGrafik(); } });
render();
// versi baru di GitHub langsung terpasang: cek update tiap aplikasi dibuka lagi, muat ulang sekali (kecuali form sedang terbuka)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const adaLama = !!navigator.serviceWorker.controller; let sudahMuat = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (adaLama && !sudahMuat && $('#modal').hidden) { sudahMuat = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => {
    r.update();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update(); });
  }).catch(() => {});
}
