// FotoFauk Studio — database di Google Sheet (akun studio faublade01@gmail.com).
// Semua HP/PC yang tersambung membaca & menulis ke sheet "data" ini.
// Satu baris = satu catatan: koleksi (jadwal/masuk/keluar/setelan), id, diubah (waktu server, ms), hapus, json.
//
// Pasang: 1) jalankan siapkan() sekali (buat Sheet)  2) PIN studio dibuat dari aplikasi oleh perangkat pertama
//         (selama belum ada PIN; atau jalankan buatPinAwal() → PIN acak di log)  3) Terapkan → Deployment baru → Aplikasi web, Jalankan sebagai: Saya, Akses: Siapa saja
//         4) URL /exec ditaruh di sinkron.js (DB_BAWAAN). Tanpa PIN yang benar server tidak memberi/menerima data.

const NAMA_SHEET = 'data';

function siapkan() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SHEET_ID')) { Logger.log('Sudah ada: ' + SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getUrl()); return; }
  const ss = SpreadsheetApp.create('FotoFauk Studio (data aplikasi)');
  const sh = ss.getSheets()[0];
  sh.setName(NAMA_SHEET);
  sh.appendRow(['koleksi', 'id', 'diubah', 'hapus', 'json']);
  sh.setFrozenRows(1);
  props.setProperty('SHEET_ID', ss.getId());
  Logger.log('Sheet dibuat: ' + ss.getUrl());
}

// PIN studio 6 angka (disimpan di Script Properties, tidak ada di kode/GitHub)
function buatPinAwal() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PIN')) { Logger.log('PIN sudah ada. Ganti lewat aplikasi → Atur.'); return; }
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  props.setProperty('PIN', pin);
  Logger.log('PIN studio: ' + pin);
}

// salah 10× dalam 15 menit → semua cek PIN dikunci 15 menit
function pinBenar_(pin) {
  const cache = CacheService.getScriptCache(), salah = Number(cache.get('salah') || 0);
  if (salah >= 10) return 'terkunci';
  const asli = PropertiesService.getScriptProperties().getProperty('PIN');
  if (!asli) return 'belum';
  if (asli && String(pin || '') === asli) return 'ok';
  cache.put('salah', String(salah + 1), 900);
  Utilities.sleep(1500);
  return 'pin';
}

function sheet_() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')).getSheetByName(NAMA_SHEET);
}

function doGet() {
  return json_({ ok: true, aplikasi: 'FotoFauk Studio' });
}

// {aksi:'kirim', rows:[{koleksi,id,hapus,data}], sejak} → simpan, lalu kembalikan semua baris yang berubah sejak "sejak"
// {aksi:'tarik', sejak} → hanya kembalikan perubahan
// {aksi:'gantiPin', pinBaru} → ganti PIN studio (semua perangkat lain diminta PIN baru)
// {aksi:'buatPin', pinBaru} → hanya bisa selama belum ada PIN (perangkat pertama)
// {aksi:'vapid'|'simpanVapid'|'langganan'|'berhenti'|'pushInfo'|'pushTeruskan'} → notifikasi booking (lihat bawah)
// Semua permintaan lain wajib membawa pin.
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: 'json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (req.aksi === 'buatPin') {
      const props = PropertiesService.getScriptProperties();
      if (props.getProperty('PIN')) return json_({ ok: false, error: 'pin' });
      if (!/^\d{6,8}$/.test(String(req.pinBaru || ''))) return json_({ ok: false, error: 'pin_baru' });
      props.setProperty('PIN', String(req.pinBaru));
      return json_({ ok: true });
    }
    const cek = pinBenar_(req.pin);
    if (cek !== 'ok') return json_({ ok: false, error: cek });
    if (req.aksi === 'gantiPin') {
      const baru = String(req.pinBaru || '');
      if (!/^\d{6,8}$/.test(baru)) return json_({ ok: false, error: 'pin_baru' });
      PropertiesService.getScriptProperties().setProperty('PIN', baru);
      return json_({ ok: true });
    }
    if (req.aksi && NOTIF_AKSI[req.aksi]) return json_(NOTIF_AKSI[req.aksi](req));
    const sh = sheet_(), sekarang = Date.now();
    if (req.aksi === 'kirim' && Array.isArray(req.rows) && req.rows.length) {
      const nilai = sh.getDataRange().getValues(), letak = {};
      for (let i = 1; i < nilai.length; i++) letak[nilai[i][0] + '|' + nilai[i][1]] = i + 1;
      const baru = [];
      req.rows.forEach(r => {
        const baris = [String(r.koleksi), String(r.id), sekarang, r.hapus ? 1 : 0, r.hapus ? '' : JSON.stringify(r.data)];
        const k = baris[0] + '|' + baris[1];
        if (letak[k]) sh.getRange(letak[k], 1, 1, 5).setValues([baris]);
        else { baru.push(baris); letak[k] = -1; }
      });
      if (baru.length) sh.getRange(sh.getLastRow() + 1, 1, baru.length, 5).setValues(baru);
    }
    const sejak = Number(req.sejak) || 0, rows = [];
    sh.getDataRange().getValues().slice(1).forEach(v => {
      if (Number(v[2]) > sejak) rows.push({ koleksi: v[0], id: String(v[1]), diubah: Number(v[2]), hapus: !!Number(v[3]), data: Number(v[3]) ? null : JSON.parse(v[4] || 'null') });
    });
    backupMingguan_();
    return json_({ ok: true, waktu: sekarang, rows });
  } finally {
    lock.releaseLock();
  }
}

// Backup otomatis: seminggu sekali sheet "data" disalin ke file "FotoFauk Studio (backup mingguan)",
// satu tab per minggu, 8 minggu terakhir disimpan. Jalan sendiri saat ada yang sinkron — tanpa izin tambahan.
function backupMingguan_() {
  const props = PropertiesService.getScriptProperties(), terakhir = Number(props.getProperty('BACKUP_TERAKHIR') || 0);
  if (Date.now() - terakhir < 7 * 864e5) return;
  try {
    let ss = props.getProperty('BACKUP_ID') ? SpreadsheetApp.openById(props.getProperty('BACKUP_ID')) : null;
    if (!ss) { ss = SpreadsheetApp.create('FotoFauk Studio (backup mingguan)'); props.setProperty('BACKUP_ID', ss.getId()); }
    const nama = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'), nilai = sheet_().getDataRange().getValues();
    const tab = ss.getSheetByName(nama) || ss.insertSheet(nama, 0);
    tab.clear(); tab.getRange(1, 1, nilai.length, nilai[0].length).setValues(nilai);
    ss.getSheets().filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.getName())).sort((a, b) => b.getName().localeCompare(a.getName())).slice(8).forEach(s => ss.deleteSheet(s));
    const awal = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1'); if (awal && ss.getSheets().length > 1) ss.deleteSheet(awal);
    props.setProperty('BACKUP_TERAKHIR', String(Date.now()));
  } catch (err) { console.error('backup gagal: ' + err); }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Notifikasi booking (Web Push) ----------
// Langganan tiap perangkat disimpan di tab "notif". Kunci VAPID dibuat oleh perangkat pertama (Script Properties).
// Enkripsi + tanda tangan dikerjakan di browser pengirim; server hanya meneruskan ke layanan push yang terdaftar.
const NAMA_NOTIF = 'notif';
function sheetNotif_() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  let sh = ss.getSheetByName(NAMA_NOTIF);
  if (!sh) { sh = ss.insertSheet(NAMA_NOTIF); sh.appendRow(['endpoint', 'json', 'nama', 'perangkat', 'diubah']); sh.setFrozenRows(1); }
  return sh;
}
function daftarLangganan_() {
  return sheetNotif_().getDataRange().getValues().slice(1).filter(v => v[0]).map(v => { const j = JSON.parse(v[1]); return { endpoint: j.endpoint, keys: j.keys, nama: v[2], perangkat: v[3] }; });
}
function hapusLangganan_(endpoints) {
  const sh = sheetNotif_(), v = sh.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (endpoints.indexOf(v[i][0]) >= 0) sh.deleteRow(i + 1);
}
const NOTIF_AKSI = {
  vapid: () => ({ ok: true, pub: PropertiesService.getScriptProperties().getProperty('VAPID_PUB') || '' }),
  simpanVapid: req => {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('VAPID_PUB') && req.pub && req.jwk && req.jwk.d) { props.setProperty('VAPID_PUB', String(req.pub)); props.setProperty('VAPID_JWK', JSON.stringify(req.jwk)); }
    return { ok: true, pub: props.getProperty('VAPID_PUB') };
  },
  langganan: req => {
    const sub = req.sub || {};
    if (!/^https:\/\//.test(sub.endpoint || '') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return { ok: false, error: 'langganan' };
    const sh = sheetNotif_(), v = sh.getDataRange().getValues(), baris = [sub.endpoint, JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }), String(req.nama || ''), String(req.perangkat || ''), new Date()];
    for (let i = 1; i < v.length; i++) if (v[i][0] === sub.endpoint) { sh.getRange(i + 1, 1, 1, 5).setValues([baris]); return { ok: true }; }
    sh.appendRow(baris);
    return { ok: true };
  },
  berhenti: req => { hapusLangganan_([String(req.endpoint || '')]); return { ok: true }; },
  pushInfo: () => {
    const props = PropertiesService.getScriptProperties(), jwk = props.getProperty('VAPID_JWK');
    return { ok: true, pub: props.getProperty('VAPID_PUB') || '', jwk: jwk ? JSON.parse(jwk) : null, langganan: daftarLangganan_() };
  },
  pushTeruskan: req => {
    const terdaftar = {}; daftarLangganan_().forEach(s => { terdaftar[s.endpoint] = 1; });
    const kirim = (req.req || []).filter(r => terdaftar[r.endpoint]).slice(0, 50);
    if (!kirim.length) return { ok: true, terkirim: 0 };
    const hasil = UrlFetchApp.fetchAll(kirim.map(r => ({
      url: r.endpoint, method: 'post', contentType: 'application/octet-stream', muteHttpExceptions: true,
      headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', Authorization: String(r.auth) },
      payload: Utilities.base64Decode(r.body)
    })));
    const kode = hasil.map(h => h.getResponseCode()), mati = [];
    kode.forEach((c, i) => { if (c === 404 || c === 410) mati.push(kirim[i].endpoint); });
    if (mati.length) hapusLangganan_(mati);
    return { ok: true, terkirim: kode.filter(c => c >= 200 && c < 300).length, kode };
  }
};

// Jalankan sekali dari editor setelah menempel kode ini: memberi izin "hubungkan ke layanan luar" (UrlFetchApp) & buat tab notif.
function izinNotif() {
  sheetNotif_();
  UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  Logger.log('Siap: tab notif ada, izin UrlFetch diberikan.');
}
