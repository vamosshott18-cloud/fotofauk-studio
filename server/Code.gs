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
    return json_({ ok: true, waktu: sekarang, rows });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
