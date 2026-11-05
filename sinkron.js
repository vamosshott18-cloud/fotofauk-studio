'use strict';
// Sinkron ke Google Sheet (Apps Script di akun fotofauk). Tanpa PIN: alamat database disimpan per perangkat
// lewat "link sambung" (?db=…) dan TIDAK ada di kode/GitHub. Tanpa alamat, aplikasi tetap jalan lokal seperti biasa.
//
// Cara kerja: setiap simpan() → bandingkan tiap catatan dengan versi terakhir yang sudah terkirim → kirim yang berubah
// (dan tanda hapus) → ambil perubahan perangkat lain sejak waktu server terakhir. Offline: antre, dikirim saat online.

const DB_KEY = 'sf_db', SEJAK_KEY = 'sf_sejak', TERKIRIM_KEY = 'sf_terkirim';
const KOLEKSI = ['jadwal', 'masuk', 'keluar'];
let dbUrl = bacaLS(DB_KEY) || '';
let sejak = Number(bacaLS(SEJAK_KEY)) || 0;
let terkirim = (() => { try { return JSON.parse(bacaLS(TERKIRIM_KEY) || '{}'); } catch (e) { return {}; } })();
let sedangSinkron = false, ulangSinkron = false, timerSinkron = null, statusSinkron = dbUrl ? 'menunggu' : 'lokal';

function bacaLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function tulisLS(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }

// Semua catatan dalam bentuk {kunci: json}; pengaturan (paket, harga, team, dll.) = satu catatan "setelan|utama"
function semuaCatatan() {
  const out = {};
  KOLEKSI.forEach(k => (S[k] || []).forEach(r => { out[k + '|' + r.id] = JSON.stringify(r); }));
  const { jadwal, masuk, keluar, ...konfig } = S;
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

async function panggilDb(body) {
  // text/plain supaya tidak ada preflight CORS ke Apps Script
  const res = await fetch(dbUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'gagal');
  return j;
}

async function sinkron() {
  if (!dbUrl) return;
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
window.setelahSimpan = () => { if (dbUrl) { setStatus('menunggu'); jadwalkanSinkron(); } };

const TEKS_STATUS = { lokal: 'Hanya di perangkat ini', menunggu: 'Belum tersimpan ke Sheet', menyimpan: 'Menyimpan…', tersinkron: 'Tersimpan di Google Sheet', offline: 'Offline — tersimpan di perangkat, dikirim nanti', gagal: 'Gagal sambung — dicoba lagi' };
function setStatus(s) {
  statusSinkron = s;
  const el = document.getElementById('statusDb');
  if (el) { el.className = 'status-db ' + s; el.title = TEKS_STATUS[s]; el.setAttribute('aria-label', TEKS_STATUS[s]); }
  const t = document.getElementById('teksStatusDb'); if (t) t.textContent = TEKS_STATUS[s];
}

// ---------- sambung perangkat ----------
const urlDariKode = v => /^https?:\/\//.test(v) ? v : `https://script.google.com/macros/s/${v}/exec`;
const kodeDariUrl = u => (u.match(/\/macros\/s\/([^/]+)\/exec/) || [])[1] || u;
function linkSambung() { return location.origin + location.pathname + '?db=' + encodeURIComponent(kodeDariUrl(dbUrl)); }
function sambungkan(v) {
  dbUrl = urlDariKode(v.trim()); tulisLS(DB_KEY, dbUrl);
  sejak = 0; terkirim = {}; simpanStatus();
  setStatus('menunggu'); sinkron();
}
function putuskan() {
  dbUrl = ''; tulisLS(DB_KEY, null); sejak = 0; terkirim = {}; tulisLS(SEJAK_KEY, null); tulisLS(TERKIRIM_KEY, null); setStatus('lokal');
}

function kartuDatabase() {
  return `<div class="card lebar"><h2>Database Google Sheet</h2>
    <div class="baris"><span class="status-db ${statusSinkron}"></span><div class="isi"><b id="teksStatusDb">${TEKS_STATUS[statusSinkron]}</b><span>${dbUrl ? 'Semua perangkat yang tersambung memakai data yang sama (akun fotofauk).' : 'Perangkat ini belum tersambung — data hanya ada di browser ini.'}</span></div>
      ${dbUrl ? '<button class="btn btn-kecil" data-act="sinkronSekarang">Sinkron sekarang</button>' : ''}</div>
    ${dbUrl ? `<div class="baris"><div class="isi"><b>Link sambung perangkat</b><span>Buka link ini sekali di HP/PC tim supaya tersambung. Bagikan ke tim saja — siapa pun yang punya link bisa melihat data.</span></div><button class="btn btn-kecil" data-act="salinLinkDb">Salin link</button></div>
      <div class="baris"><div class="isi"><b>Putuskan perangkat ini</b><span>Data di Sheet tetap aman; perangkat ini kembali lokal.</span></div><button class="btn btn-kecil btn-hapus" data-act="putuskanDb">Putuskan</button></div>`
    : `<div class="baris"><div class="isi"><b>Sambungkan</b><span>Tempel link sambung atau kode database dari admin.</span></div><button class="btn btn-kecil btn-utama" data-act="sambungDb">Sambungkan</button></div>`}
  </div>`;
}

Object.assign(AKSI, {
  sinkronSekarang: () => sinkron(),
  salinLinkDb: async () => { try { await navigator.clipboard.writeText(linkSambung()); toast('Link sambung disalin'); } catch (e) { prompt('Salin link ini:', linkSambung()); } },
  putuskanDb: () => { if (confirm('Putuskan perangkat ini dari database? Data di Google Sheet tidak terhapus.')) { putuskan(); render(); toast('Perangkat diputus'); } },
  sambungDb: () => { const v = prompt('Tempel link sambung atau kode database:'); if (!v) return; const m = v.match(/[?&]db=([^&\s]+)/); sambungkan(m ? decodeURIComponent(m[1]) : v); render(); toast('Menyambungkan…'); }
});

// link sambung: ?db=<kode> → simpan di perangkat, hapus dari alamat
(() => {
  const p = new URLSearchParams(location.search), kode = p.get('db');
  if (kode) { sambungkan(kode); p.delete('db'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); }
  setStatus(statusSinkron);
  if (dbUrl) {
    sinkron();
    setInterval(() => { if (document.visibilityState === 'visible') sinkron(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sinkron(); });
    addEventListener('online', () => sinkron());
  }
})();
