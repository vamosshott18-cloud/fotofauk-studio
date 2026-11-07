'use strict';
// Sinkron ke Google Sheet (Apps Script di akun studio faublade01). Semua perangkat otomatis memakai database ini;
// tiap HP/PC cukup isi PIN studio sekali (disimpan di perangkat). Tanpa PIN yang benar server tidak memberi data.
//
// Cara kerja: setiap simpan() → bandingkan tiap catatan dengan versi terakhir yang sudah terkirim → kirim yang berubah
// (dan tanda hapus) → ambil perubahan perangkat lain sejak waktu server terakhir. Offline: antre, dikirim saat online.

const DB_BAWAAN = 'https://script.google.com/macros/s/AKfycbzaW9N6WNjd1kQBjXKNl8aQsXxFLTLYLjLYV3xv_qan-blr2FVjLt-VbrZ9Vvbb4HHDmw/exec';
const DB_KEY = 'sf_db', PIN_KEY = 'sf_pin', SEJAK_KEY = 'sf_sejak', TERKIRIM_KEY = 'sf_terkirim';
const KOLEKSI = ['jadwal', 'masuk', 'keluar', 'sampah'];
let dbUrl = bacaLS(DB_KEY) || DB_BAWAAN;
let pin = bacaLS(PIN_KEY) || '';
let sejak = Number(bacaLS(SEJAK_KEY)) || 0;
let terkirim = (() => { try { return JSON.parse(bacaLS(TERKIRIM_KEY) || '{}'); } catch (e) { return {}; } })();
let sedangSinkron = false, ulangSinkron = false, timerSinkron = null, statusSinkron = dbUrl ? 'menunggu' : 'lokal';

function bacaLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function tulisLS(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }

// Semua catatan dalam bentuk {kunci: json}; pengaturan (paket, harga, team, dll.) = satu catatan "setelan|utama"
function semuaCatatan() {
  const out = {};
  KOLEKSI.forEach(k => (S[k] || []).forEach(r => { out[k + '|' + r.id] = JSON.stringify(r); }));
  const { jadwal, masuk, keluar, sampah, ...konfig } = S;
  out['setelan|utama'] = JSON.stringify(konfig);
  return out;
}
function perubahanLokal() {
  const kini = semuaCatatan(), rows = [];
  Object.entries(kini).forEach(([kunci, json]) => { if (terkirim[kunci] !== json) { const [koleksi, id] = pecah(kunci); rows.push({ koleksi, id, data: JSON.parse(json), _json: json }); } });
  Object.keys(terkirim).forEach(kunci => { if (!(kunci in kini)) { const [koleksi, id] = pecah(kunci); rows.push({ koleksi, id, hapus: true }); } });
  return rows;
}
const pecah = kunci => { const i = kunci.indexOf('|'); return [kunci.slice(0, i), kunci.slice(i + 1)]; };

function terapkan(r) {
  if (r.koleksi === 'setelan') { if (!r.hapus && r.data) Object.assign(S, r.data); return; }
  if (!KOLEKSI.includes(r.koleksi)) return;
  const arr = S[r.koleksi] ||= [], i = arr.findIndex(x => x.id === r.id);
  if (r.hapus) { if (i >= 0) arr.splice(i, 1); }
  else if (i >= 0) arr[i] = r.data; else arr.push(r.data);
}

async function panggilDb(body, pinPakai = pin) {
  // text/plain supaya tidak ada preflight CORS ke Apps Script
  const res = await fetch(dbUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, pin: pinPakai }) });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'gagal');
  return j;
}

async function sinkron() {
  if (!dbUrl) return;
  if (!pin) { layarPin(); return; }
  if (sedangSinkron) { ulangSinkron = true; return; }
  sedangSinkron = true; setStatus('menyimpan');
  try {
    if (!sejak) {
      // perangkat baru tersambung: kalau database sudah berisi, pakai isi database (data lokal perangkat ini diganti)
      const awal = await panggilDb({ aksi: 'tarik', sejak: 0 });
      if (awal.rows.length) {
        KOLEKSI.forEach(k => { S[k] = []; });
        terkirim = {};
        awal.rows.forEach(r => { terapkan(r); if (!r.hapus) terkirim[r.koleksi + '|' + r.id] = JSON.stringify(r.data); });
        sejak = awal.waktu; simpanStatus(); simpanLokal(); segarkan();
      }
    }
    const rows = perubahanLokal();
    const j = await panggilDb({ aksi: rows.length ? 'kirim' : 'tarik', rows: rows.map(({ _json, ...r }) => r), sejak });
    rows.forEach(r => { const k = r.koleksi + '|' + r.id; if (r.hapus) delete terkirim[k]; else terkirim[k] = r._json; });
    const dikirim = new Set(rows.map(r => r.koleksi + '|' + r.id)), lokalKini = semuaCatatan();
    let berubah = false;
    j.rows.forEach(r => {
      const k = r.koleksi + '|' + r.id;
      if (dikirim.has(k)) return;                                            // baris kita sendiri
      if (k in lokalKini && lokalKini[k] !== terkirim[k] && terkirim[k] !== undefined) return;   // ada ubahan lokal yang belum terkirim → kirim nanti
      terapkan(r); berubah = true;
      if (r.hapus) delete terkirim[k]; else terkirim[k] = JSON.stringify(r.data);
    });
    sejak = j.waktu; simpanStatus();
    if (berubah) { simpanLokal(); segarkan(); }
    setStatus('tersinkron');
  } catch (e) {
    if (e.message === 'pin') { pin = ''; tulisLS(PIN_KEY, null); layarPin('PIN studio sudah diganti. Masukkan PIN yang baru.'); }
    setStatus(navigator.onLine === false ? 'offline' : 'gagal');
  } finally {
    sedangSinkron = false;
    if (ulangSinkron) { ulangSinkron = false; jadwalkanSinkron(300); }
  }
}
function simpanStatus() { tulisLS(SEJAK_KEY, String(sejak)); tulisLS(TERKIRIM_KEY, JSON.stringify(terkirim)); }
function simpanLokal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
// gambar ulang hanya kalau tidak ada form terbuka (supaya isian tidak hilang)
function segarkan() { if ($('#modal').hidden) render(); }
function jadwalkanSinkron(ms = 900) { if (!dbUrl) return; clearTimeout(timerSinkron); timerSinkron = setTimeout(sinkron, ms); }
window.setelahSimpan = () => { if (dbUrl && pin) { setStatus('menunggu'); jadwalkanSinkron(); } };

const TEKS_STATUS = { lokal: 'Hanya di perangkat ini', menunggu: 'Belum tersimpan ke Sheet', menyimpan: 'Menyimpan…', tersinkron: 'Tersimpan di Google Sheet', offline: 'Offline — tersimpan di perangkat, dikirim nanti', gagal: 'Gagal sambung — dicoba lagi' };
function setStatus(s) {
  statusSinkron = s;
  const el = document.getElementById('statusDb');
  if (el) { el.className = 'status-db ' + s; el.title = TEKS_STATUS[s]; el.setAttribute('aria-label', TEKS_STATUS[s]); }
  const t = document.getElementById('teksStatusDb'); if (t) t.textContent = TEKS_STATUS[s];
}

// ---------- PIN & perangkat ----------
let pinPertama = '';
function layarPin(pesan = '') {
  let el = document.getElementById('layarPin');
  if (!el) {
    el = document.createElement('div'); el.id = 'layarPin'; el.className = 'layar-pin';
    el.innerHTML = `<form class="kotak-pin" autocomplete="off">
      <img src="icon.svg" alt="">
      <h1>FotoFauk Studio</h1>
 <p>Masukkan nama kamu dan PIN studio. Cukup sekali di perangkat ini.</p>
      <input id="isiNama" class="isi-nama" autocomplete="name" placeholder="Nama kamu (mis. Febri)" aria-label="Nama kamu" value="">
      <input id="isiPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="••••••" aria-label="PIN studio">
      <b id="pesanPin" role="alert"></b>
      <button class="btn btn-utama" type="submit">Masuk</button>
    </form>`;
    document.body.appendChild(el);
    el.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const v = el.querySelector('#isiPin').value.trim(), tombol = el.querySelector('button'), nm = el.querySelector('#isiNama').value.trim();
      if (!nm) { tulisPesanPin('Isi nama kamu dulu — dipakai untuk mencatat siapa yang menginput'); el.querySelector('#isiNama').focus(); return; }
      if (!/^\d{6,8}$/.test(v)) { tulisPesanPin('PIN 6–8 angka'); return; }
      tulisLS('sf_nama', nm);
      tombol.disabled = true; tulisPesanPin('Memeriksa…');
      try {
        if (pinPertama) {
          // database belum punya PIN: PIN yang diketik dua kali jadi PIN studio
          if (v !== pinPertama) { pinPertama = ''; throw new Error('beda'); }
          await panggilDb({ aksi: 'buatPin', pinBaru: v }, '');
          pinPertama = '';
        } else {
          await panggilDb({ aksi: 'tarik', sejak: 9e15 }, v);   // cek PIN saja, tanpa ambil data
        }
        pin = v; tulisLS(PIN_KEY, v); el.hidden = true; tulisPesanPin('');
        setStatus('menunggu'); await sinkron(); render();
        toast('Tersambung ke database studio');
      } catch (e) {
        if (e.message === 'belum') { pinPertama = v; el.querySelector('#isiPin').value = ''; tulisPesanPin('Belum ada PIN studio. Ketik ulang PIN ini untuk menjadikannya PIN studio.'); return; }
        if (e.message === 'beda') { el.querySelector('#isiPin').value = ''; tulisPesanPin('PIN tidak sama. Ulangi dari awal.'); return; }
        tulisPesanPin(e.message === 'pin' ? 'PIN salah' : e.message === 'terkunci' ? 'Terlalu banyak salah. Coba lagi 15 menit lagi.' : 'Tidak bisa tersambung. Cek internet lalu coba lagi.');
      } finally { tombol.disabled = false; }
    });
  }
  el.hidden = false; tulisPesanPin(pesan);
  const nmIn = el.querySelector('#isiNama'); nmIn.value = bacaLS('sf_nama') || '';
  setTimeout(() => (nmIn.value ? el.querySelector('#isiPin') : nmIn).focus(), 50);
}
function tulisPesanPin(t) { const b = document.getElementById('pesanPin'); if (b) b.textContent = t; }

function keluarPerangkat() {
  pin = ''; tulisLS(PIN_KEY, null);
  KOLEKSI.forEach(k => { S[k] = []; });
  sejak = 0; terkirim = {}; tulisLS(SEJAK_KEY, null); tulisLS(TERKIRIM_KEY, null);
  simpanLokal(); render(); layarPin();
}

function kartuDatabase() {
  return `<div class="card lebar"><h2>Database Google Sheet</h2>
    <div class="baris"><span class="status-db ${statusSinkron}"></span><div class="isi"><b id="teksStatusDb">${TEKS_STATUS[statusSinkron]}</b> ${typeof tanya === 'function' ? tanya('sinkron') : ''}<span>Semua HP/PC studio otomatis memakai data yang sama. Perangkat baru cukup buka aplikasi lalu isi PIN studio sekali.</span></div>
      <button class="btn btn-kecil" data-act="sinkronSekarang">Sinkron sekarang</button></div>
    <div class="baris"><div class="isi"><b>Nama di perangkat ini: ${esc(bacaLS('sf_nama') || '—')}</b><span>Tercatat sebagai penginput setiap jadwal, pemasukan & pengeluaran dari perangkat ini.</span></div><button class="btn btn-kecil" data-act="gantiNama">Ganti nama</button></div>
    <div class="baris"><div class="isi"><b>Ganti PIN studio</b><span>Semua perangkat lain akan diminta PIN baru.</span></div><button class="btn btn-kecil" data-act="gantiPinDb">Ganti PIN</button></div>
    <div class="baris"><div class="isi"><b>Keluar dari perangkat ini</b><span>Data di Google Sheet tetap aman; data di perangkat ini dihapus dan perlu PIN lagi.</span></div><button class="btn btn-kecil btn-hapus" data-act="keluarDb">Keluar</button></div>
  </div>`;
}

Object.assign(AKSI, {
  sinkronSekarang: () => sinkron(),
  gantiNama: () => { const v = prompt('Nama kamu (tercatat sebagai penginput):', bacaLS('sf_nama') || ''); if (v == null || !v.trim()) return; tulisLS('sf_nama', v.trim()); render(); toast('Nama disimpan'); },
  gantiPinDb: async () => {
    const baru = prompt('PIN baru (6–8 angka):'); if (baru == null) return;
    if (!/^\d{6,8}$/.test(baru.trim())) { toast('PIN harus 6–8 angka'); return; }
    if (prompt('Ketik ulang PIN baru:') !== baru) { toast('PIN tidak sama'); return; }
    try { await panggilDb({ aksi: 'gantiPin', pinBaru: baru.trim() }); pin = baru.trim(); tulisLS(PIN_KEY, pin); toast('PIN studio diganti'); }
    catch (e) { toast('Gagal ganti PIN — cek internet'); }
  },
  keluarDb: async () => {
    await sinkron();
    if (perubahanLokal().length) { toast('Masih ada data yang belum terkirim — sambungkan internet dulu'); return; }
    if (confirm('Keluar dari perangkat ini? Data tetap aman di Google Sheet.')) keluarPerangkat();
  }
});

// link sambung lama (?db=…) tidak dipakai lagi: buang dari alamat
(() => {
  const p = new URLSearchParams(location.search);
  if (p.has('db')) { p.delete('db'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); }
  if (bacaLS(DB_KEY) === DB_BAWAAN) tulisLS(DB_KEY, null);
  setStatus(statusSinkron);
  if (dbUrl) {
    if (pin && !bacaLS('sf_nama')) setTimeout(() => { const v = prompt('Nama kamu? (dipakai untuk mencatat siapa yang menginput data)'); if (v && v.trim()) { tulisLS('sf_nama', v.trim()); render(); } }, 800);
    sinkron();
    setInterval(() => { if (document.visibilityState === 'visible') sinkron(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sinkron(); });
    addEventListener('online', () => sinkron());
  }
})();
