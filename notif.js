'use strict';
// Notifikasi booking baru ke semua HP/PC yang memasang aplikasi (Web Push, tanpa layanan pihak ketiga).
//
// Alur: perangkat yang menyimpan booking baru → minta daftar langganan + kunci VAPID ke Apps Script (pakai PIN studio)
// → mengenkripsi pesan untuk tiap perangkat di browser (RFC 8291 aes128gcm) + tanda tangan VAPID (ES256)
// → Apps Script meneruskan ke layanan push (Google/Apple/Mozilla) → service worker tiap perangkat menampilkan notifikasi.
// Kunci VAPID dibuat otomatis oleh perangkat pertama yang mengaktifkan notifikasi, disimpan di Script Properties.
//
// Suara: notifikasi sistem memakai bunyi notifikasi HP/PC. Saat aplikasi sedang terbuka, file SUARA_NOTIF diputar juga
// (taruh file suaranya di folder aplikasi dengan nama ini).

const SUARA_NOTIF = 'notif.mp3';
const NOTIF_KEY = 'sf_notif', ANTRE_KEY = 'sf_notif_antre';
const SITUS = 'https://vamosshott18-cloud.github.io/fotofauk-studio/';

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
const dariB64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const gabung = (...xs) => { const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let o = 0; xs.forEach(x => { out.set(x, o); o += x.length; }); return out; };
const teks = s => new TextEncoder().encode(s);

const notifDidukung = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iPhoneBelumDipasang = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
const notifAktif = () => notifDidukung() && Notification.permission === 'granted' && !!bacaLS(NOTIF_KEY);

// ---------- enkripsi pesan (RFC 8291) ----------
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
async function enkripsi(sub, pesan) {
  const uaPub = dariB64u(sub.keys.p256dh), auth = dariB64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, gabung(teks('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, teks('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, teks('Content-Encoding: nonce\0'), 12);
  const kunci = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const isi = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, kunci, gabung(teks(pesan), new Uint8Array([2]))));
  const kepala = new Uint8Array(21); kepala.set(salt); new DataView(kepala.buffer).setUint32(16, 4096); kepala[20] = 65;
  return gabung(kepala, asPub, isi);
}
// tanda tangan VAPID: JWT ES256 untuk origin layanan push
async function jwtVapid(aud, jwk) {
  const kunci = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const isi = b64u(teks(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))) + '.' + b64u(teks(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SITUS })));
  const ttd = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kunci, teks(isi));
  return isi + '.' + b64u(ttd);
}

// ---------- kunci VAPID studio ----------
async function kunciVapid() {
  const r = await panggilDb({ aksi: 'vapid' });
  if (r.pub) return r;
  // belum ada: perangkat ini yang membuat (server menolak kalau ternyata sudah ada → pakai milik server)
  const pasang = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', pasang.publicKey)), jwk = await crypto.subtle.exportKey('jwk', pasang.privateKey);
  return panggilDb({ aksi: 'simpanVapid', pub, jwk });
}

// ---------- aktifkan / matikan di perangkat ini ----------
async function aktifkanNotif() {
  if (iPhoneBelumDipasang()) { alert('Di iPhone/iPad notifikasi hanya jalan kalau aplikasi dipasang:\n\n1. Buka situs ini di Safari\n2. Tombol Bagikan → "Tambah ke Layar Utama"\n3. Buka FotoFauk Studio dari ikon di layar utama, lalu aktifkan notifikasi lagi.'); return; }
  if (!notifDidukung()) { toast('Browser ini belum mendukung notifikasi. Pakai Chrome/Edge/Safari terbaru.'); return; }
  if (!pin) { toast('Masuk dengan PIN studio dulu'); return; }
  const izin = await Notification.requestPermission();
  if (izin !== 'granted') { toast(izin === 'denied' ? 'Notifikasi diblokir. Izinkan lewat pengaturan situs/browser.' : 'Notifikasi belum diizinkan'); render(); return; }
  try {
    toast('Mengaktifkan notifikasi…');
    const v = await kunciVapid();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const kunciSub = sub && sub.options && sub.options.applicationServerKey ? b64u(sub.options.applicationServerKey) : null;
    if (sub && kunciSub && kunciSub !== v.pub) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: dariB64u(v.pub) });
    await panggilDb({ aksi: 'langganan', sub: sub.toJSON(), nama: bacaLS('sf_nama') || '', perangkat: namaPerangkat() });
    tulisLS(NOTIF_KEY, sub.endpoint); tulisLS('sf_notif_cek', String(Date.now()));
    render(); toast('Notifikasi aktif di perangkat ini 🔔');
  } catch (e) { console.error(e); toast('Gagal mengaktifkan notifikasi — cek internet lalu coba lagi'); }
}
async function matikanNotif() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { panggilDb({ aksi: 'berhenti', endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  } catch (e) {}
  tulisLS(NOTIF_KEY, null); render(); toast('Notifikasi dimatikan di perangkat ini');
}
function namaPerangkat() {
  const u = navigator.userAgent;
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Perangkat';
  const br = /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : '';
  return os + (br ? ' · ' + br : '');
}

// ---------- kirim ----------
// pesan: {judul, isi, url, tag}; antre dulu supaya tetap terkirim kalau sedang offline
function antreNotif(pesan, termasukSaya = false) {
  let q = []; try { q = JSON.parse(bacaLS(ANTRE_KEY) || '[]'); } catch (e) {}
  q.push({ pesan, termasukSaya, dari: bacaLS(NOTIF_KEY) || '', t: Date.now() });
  tulisLS(ANTRE_KEY, JSON.stringify(q.slice(-20)));
  kirimAntreanNotif();
}
let sedangKirimNotif = false;
async function kirimAntreanNotif() {
  if (sedangKirimNotif || !pin || !dbUrl) return;
  let q = []; try { q = JSON.parse(bacaLS(ANTRE_KEY) || '[]'); } catch (e) {}
  q = q.filter(x => Date.now() - x.t < 864e5);   // pesan lebih dari sehari tidak dikirim lagi
  if (!q.length) { tulisLS(ANTRE_KEY, null); return; }
  sedangKirimNotif = true;
  try {
    const info = await panggilDb({ aksi: 'pushInfo' });
    if (!info.pub || !info.jwk) { tulisLS(ANTRE_KEY, null); return; }   // belum ada perangkat yang mengaktifkan notifikasi
    const jwt = {};
    for (const item of q) {
      const tujuan = (info.langganan || []).filter(s => item.termasukSaya ? s.endpoint === item.dari : s.endpoint !== item.dari);
      const req = [];
      for (const s of tujuan) {
        try {
          const aud = new URL(s.endpoint).origin;
          jwt[aud] ||= await jwtVapid(aud, info.jwk);
          const body = await enkripsi(s, JSON.stringify(item.pesan));
          req.push({ endpoint: s.endpoint, auth: `vapid t=${jwt[aud]}, k=${info.pub}`, body: b64(body) });
        } catch (e) { console.warn('lewati langganan rusak', e); }
      }
      if (req.length) await panggilDb({ aksi: 'pushTeruskan', req });
      q = q.filter(x => x !== item); tulisLS(ANTRE_KEY, q.length ? JSON.stringify(q) : null);
    }
  } catch (e) { console.warn('notif belum terkirim, dicoba lagi nanti', e); }
  finally { sedangKirimNotif = false; }
}

// dipanggil app.js setiap ada booking BARU yang disimpan
function kabariBooking(j) {
  const oleh = bacaLS('sf_nama') || '';
  antreNotif({
    judul: 'Booking baru · ' + j.customer,
    isi: `${j.jenis} · ${j.paket}\n${tglPanjang(j.tanggal)}${j.jam ? ' · ' + j.jam : ''}${oleh ? '\ndicatat ' + oleh : ''}`,
    url: SITUS + '?buka=' + encodeURIComponent(j.id),
    tag: 'booking-' + j.id
  });
}

// ---------- tampilan ----------
function kartuNotif() {
  const aktif = notifAktif(), ditolak = notifDidukung() && Notification.permission === 'denied';
  return `<div class="card lebar"><h2>Notifikasi booking</h2>
    <div class="baris"><span class="status-db ${aktif ? 'tersinkron' : 'menunggu'}"></span><div class="isi"><b>${aktif ? 'Aktif di perangkat ini' : ditolak ? 'Diblokir di browser ini' : 'Belum aktif di perangkat ini'}</b>
      <span>Setiap ada yang menyimpan booking baru, semua HP/PC yang notifikasinya aktif langsung dapat pemberitahuan (aplikasi tidak perlu dibuka).${iPhoneBelumDipasang() ? ' Di iPhone: pasang dulu lewat Bagikan → Tambah ke Layar Utama.' : ''}</span></div>
      ${aktif ? '<button class="btn btn-kecil" data-act="matikanNotif">Matikan</button>' : `<button class="btn btn-kecil btn-utama" data-act="aktifkanNotif">Aktifkan</button>`}</div>
    ${aktif ? '<div class="baris"><div class="isi"><b>Coba notifikasi</b><span>Kirim satu notifikasi tes ke perangkat ini saja.</span></div><button class="btn btn-kecil" data-act="tesNotif">Kirim tes</button></div>' : ''}
  </div>`;
}
function bannerNotif() {
  if (!pin || notifAktif() || bacaLS('sf_notif_tutup')) return '';
  if (notifDidukung() && Notification.permission === 'denied') return '';
  return `<div class="banner-notif"><span>🔔</span><div><b>Aktifkan notifikasi booking</b><small>Dapat pemberitahuan setiap ada booking baru dari perangkat lain.</small></div>
    <button class="btn btn-kecil btn-utama" data-act="aktifkanNotif">Aktifkan</button><button class="tutup-banner" data-act="tutupBannerNotif" aria-label="Tutup">×</button></div>`;
}

Object.assign(AKSI, {
  aktifkanNotif, matikanNotif,
  tesNotif: () => { antreNotif({ judul: 'Tes notifikasi', isi: 'Notifikasi FotoFauk Studio sudah jalan di perangkat ini ✅', url: SITUS, tag: 'tes' }, true); toast('Tes dikirim — tunggu beberapa detik'); },
  tutupBannerNotif: () => { tulisLS('sf_notif_tutup', '1'); render(); }
});

// pesan dari service worker saat aplikasi sedang terbuka → bunyi + sinkron supaya booking baru langsung tampil
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if (!e.data || e.data.jenis !== 'push') return;
  try { const a = new Audio(SUARA_NOTIF); a.play().catch(() => {}); } catch (err) {}
  if (typeof sinkron === 'function') sinkron();
});

(() => {
  // dibuka dari notifikasi: ?buka=<id jadwal> → tunggu data tersinkron lalu buka booking itu
  const p = new URLSearchParams(location.search), id = p.get('buka');
  if (id) {
    p.delete('buka'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
    let n = 0;
    const coba = () => { if (S.jadwal.some(j => j.id === id)) { tab = 'jadwal'; render(); AKSI.editJadwal({ dataset: { id } }); } else if (++n < 20) { if (n === 1 && typeof sinkron === 'function') sinkron(); setTimeout(coba, 700); } };
    setTimeout(coba, 300);
  }
  // segarkan langganan sehari sekali (endpoint bisa berubah) + kirim antrean yang tertinggal
  if (notifAktif() && Date.now() - Number(bacaLS('sf_notif_cek') || 0) > 864e5) {
    navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).then(sub => {
      if (!sub) { tulisLS(NOTIF_KEY, null); return; }
      tulisLS(NOTIF_KEY, sub.endpoint); tulisLS('sf_notif_cek', String(Date.now()));
      return panggilDb({ aksi: 'langganan', sub: sub.toJSON(), nama: bacaLS('sf_nama') || '', perangkat: namaPerangkat() });
    }).catch(() => {});
  }
  setTimeout(kirimAntreanNotif, 2000);
  addEventListener('online', kirimAntreanNotif);
})();
