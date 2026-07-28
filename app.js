/* ============================================================
   Yoga Tugi — Ön Muhasebe · app.js
   Saf vanilla JS. Veriler tarayıcıda (localStorage) saklanır.
   Sunucu/Firebase yok — tamamen yerel çalışır.
   ============================================================ */
(function () {
'use strict';

/* ==========================================================
   0) DURUM (STATE)
   ========================================================== */
const State = {
  kullanici: null,
  hesaplar: [],      // {id, ad, tip, acilisBakiye, aktif, banka?}
  islemler: [],      // {id, tarih, tutar, tip, odemeHesabiId, kategoriId, ortakId?, kaynak, aciklama}
  ortaklar: [],      // {id, ad, payOrani, aktif, telefon, eposta}
  komisyonlar: [],   // {id, ad, oran, aktif}
  karPayi: [],       // {id, donem, toplamGelir, toplamGider, netKar, dagitim[], olusturma}
  kullanicilar: [],  // {id, eposta, ad, rol, aktif}
  potansiyel: [],    // {id, ad, telefon, not, durum}
  ayarlar: {},       // {firmaAd, ...}
  aktifSayfa: 'dashboard',
};

const HESAP_TIPLERI = {
  banka:      { ad:'Banka',        ikon:'🏦', para:true },
  kasa:       { ad:'Kasa',         ikon:'💵', para:true },
  krediKarti: { ad:'Kredi Kartı',  ikon:'💳', para:true },
  ortak:      { ad:'Ortak',        ikon:'🤝', para:false },
  gider:      { ad:'Gider Kalemi', ikon:'📉', para:false },
  gelir:      { ad:'Gelir Kalemi', ikon:'📈', para:false },
};

/* ==========================================================
   1) YARDIMCILAR
   ========================================================== */
const $  = (s, k) => (k || document).querySelector(s);
const $$ = (s, k) => Array.from((k || document).querySelectorAll(s));

function TL(n) {
  n = Number(n) || 0;
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}
function sayi(n) { return (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* --- Tutar giriş kutusu: yazarken canlı "5.000,12 ₺" biçimlendirme --- */
function tutarBicimle(ham) {
  ham = String(ham == null ? '' : ham).replace(/[^\d,]/g, '');   // sadece rakam + virgül
  const vi = ham.indexOf(',');
  let tam, ond = null;
  if (vi >= 0) { tam = ham.slice(0, vi).replace(/,/g, ''); ond = ham.slice(vi + 1).replace(/,/g, '').slice(0, 2); }
  else tam = ham;
  tam = tam.replace(/^0+(?=\d)/, '');                            // baştaki gereksiz sıfırlar
  const tamB = tam ? Number(tam).toLocaleString('tr-TR') : (ond !== null ? '0' : '');
  if (!tamB && ond === null) return '';
  return (ond !== null ? (tamB || '0') + ',' + ond : tamB) + ' ₺';
}
function tutarSayi(str) {
  str = String(str == null ? '' : str).replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(str) || 0;
}
/* Bir input'u tutar kutusu yap: canlı biçimlendir, başlangıç değerini de biçimle */
function tutarKutusuBagla(el, baslangic) {
  if (!el) return;
  if (baslangic != null && baslangic !== '') el.value = tutarBicimle(String(baslangic).replace('.', ','));
  el.addEventListener('input', () => { el.value = tutarBicimle(el.value); });
}
/* Tarih satırı: görünmez <input type=date> değişince görünen metni (28 Tem 2026) günceller */
function tarihGostergeBagla() {
  const inp = document.querySelector('#hrTarih'), gos = document.querySelector('#hrTarihGos');
  if (!inp || !gos) return;
  const guncelle = () => { gos.textContent = fmtTarihUzun(inp.value); };
  inp.addEventListener('input', guncelle);
  inp.addEventListener('change', guncelle);
  guncelle();
}
function yeniId() { return 'id' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function bugunISO() { return new Date().toISOString().slice(0, 10); }
function donemStr(tarih) { return (tarih || bugunISO()).slice(0, 7); } // YYYY-MM
function buAy() { return bugunISO().slice(0, 7); }

function fmtTarih(iso) {
  if (!iso) return '—';
  const [y, m, g] = iso.slice(0, 10).split('-');
  return `${g}.${m}.${y}`;
}
function donemAdi(donem) {
  const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const [y, m] = donem.split('-');
  return `${aylar[parseInt(m, 10) - 1]} ${y}`;
}
function kacar(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function bildir(mesaj, tip = '') {
  const b = document.createElement('div');
  b.className = 'bildirim ' + tip;
  b.innerHTML = (tip === 'basari' ? '✓ ' : tip === 'hata' ? '⚠ ' : '') + kacar(mesaj);
  $('#bildirimler').appendChild(b);
  setTimeout(() => { b.style.opacity = '0'; b.style.transform = 'translateY(10px)'; b.style.transition = '.3s'; setTimeout(() => b.remove(), 300); }, 3200);
}

/* --- Modal --- */
function modalAc(baslik, govdeHTML, altHTML, basAksesuar) {
  const kap = $('#modalKap');
  kap.innerHTML = `
    <div class="modal-perde" id="modalPerde">
      <div class="modal" role="dialog">
        <div class="modal-ust"><h3>${kacar(baslik)}</h3>${basAksesuar || ''}<button class="modal-kapat" id="modalKapat">×</button></div>
        <div class="modal-govde">${govdeHTML}</div>
        ${altHTML ? `<div class="modal-alt">${altHTML}</div>` : ''}
      </div>
    </div>`;
  $('#modalKapat').onclick = modalKapat;
  $('#modalPerde').onclick = e => { if (e.target.id === 'modalPerde') modalKapat(); };
}
function modalKapat() { $('#modalKap').innerHTML = ''; }

/* ==========================================================
   2) VERİ KATMANI (Yerel depolama / localStorage)
   ========================================================== */
const KOLEKSIYONLAR = ['hesaplar', 'islemler', 'ortaklar', 'komisyonlar', 'karPayi', 'kullanicilar', 'potansiyel'];

/* Veri katmanı — Yerel depolama (localStorage). Sunucu/Firebase yok. */
const DB = {
  mod: 'yerel',

  baslat() { this.mod = 'yerel'; },

  _anahtar(kol) { return 'yt_' + kol; },
  _oku(kol) { try { return JSON.parse(localStorage.getItem(this._anahtar(kol))) || []; } catch { return []; } },
  _yaz(kol, dizi) { localStorage.setItem(this._anahtar(kol), JSON.stringify(dizi)); },

  async listele(kol) { return this._oku(kol); },

  async ekle(kol, veri) {
    veri = { ...veri, olusturma: new Date().toISOString() };
    const dizi = this._oku(kol);
    const kayit = { id: yeniId(), ...veri };
    dizi.push(kayit); this._yaz(kol, dizi);
    return kayit;
  },

  async guncelle(kol, id, veri) {
    const dizi = this._oku(kol);
    const i = dizi.findIndex(x => x.id === id);
    if (i >= 0) { dizi[i] = { ...dizi[i], ...veri }; this._yaz(kol, dizi); }
  },

  async sil(kol, id) {
    this._yaz(kol, this._oku(kol).filter(x => x.id !== id));
  },

  async topluEkle(kol, kayitlar) {
    const sonuc = [];
    for (const k of kayitlar) sonuc.push(await this.ekle(kol, k));
    return sonuc;
  },

  // ---- Ayarlar (firma bilgileri, logo, güvenlik) — tekil nesne ----
  ayarOku() { try { return JSON.parse(localStorage.getItem('yt_ayarlar')) || {}; } catch { return {}; } },
  ayarYaz(obj) { State.ayarlar = obj; localStorage.setItem('yt_ayarlar', JSON.stringify(obj)); },
};

/* Şifre özeti (SHA-256; yoksa basit yedek). Not: yerel kilit, tam güvenlik değildir. */
async function sifreHash(metin) {
  const girdi = 'yt$' + metin;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(girdi));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381; for (const c of girdi) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
    return 'y' + h.toString(16);
  }
}

/* Sabit yönetici girişi — kod içinde tanımlı, uygulamadan değiştirilemez/kaldırılamaz.
   Kullanıcı: Admin · Şifre: 22075934  (özet olarak saklanır) */
const SABIT_ADMIN = {
  kullanici: 'Admin',
  hashler: ['833b0b5def5616ae555d81040563c19594b7500aaf4dee277b926bbf048b00d0', 'ycc397796'],
};

/* Uygulama sürümü — index.html'deki ?v=NN ile aynı tutulur */
const APP_SURUM = '47';
const APP_SURUM_TARIH = '28 Tem 2026';

/* Giriş yapan kullanıcı yönetici (admin) mi? */
function adminMi() { return (State.kullanici && State.kullanici.ad) === SABIT_ADMIN.kullanici; }

/* Tüm koleksiyonları State'e yükle */
async function veriYukle() {
  const [hesaplar, islemler, ortaklar, komisyonlar, karPayi, kullanicilar, potansiyel] = await Promise.all(
    KOLEKSIYONLAR.map(k => DB.listele(k))
  );
  State.hesaplar = hesaplar;
  State.islemler = islemler.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  State.ortaklar = ortaklar;
  State.komisyonlar = komisyonlar;
  State.karPayi = karPayi;
  State.kullanicilar = kullanicilar;
  State.potansiyel = potansiyel || [];
  await kayitNoMigrasyon();
}

/* Kayıt No — her işleme benzersiz sıralı numara. Eski kayıtlar için tek seferlik doldurulur. */
function sonrakiKayitNo() {
  let enBuyuk = 0;
  for (const i of State.islemler) { const n = Number(i.kayitNo) || 0; if (n > enBuyuk) enBuyuk = n; }
  return enBuyuk + 1;
}
async function kayitNoMigrasyon() {
  const eksik = State.islemler.filter(i => !(Number(i.kayitNo) > 0));
  if (!eksik.length) return;
  // Kronolojik sıraya göre numara ver (en eski = en küçük numara)
  eksik.sort((a, b) => (a.olusturma || a.tarih || '').localeCompare(b.olusturma || b.tarih || ''));
  let no = sonrakiKayitNo();
  for (const i of eksik) {
    i.kayitNo = no++;
    await DB.guncelle('islemler', i.id, { kayitNo: i.kayitNo });
  }
}

/* ==========================================================
   3) HESAPLAMALAR (çekirdek muhasebe mantığı)
   ========================================================== */
const Hesapla = {
  // Bir para hesabının (banka/kasa/kk) güncel bakiyesi
  paraHesapBakiye(hesapId) {
    const h = State.hesaplar.find(x => x.id === hesapId);
    if (!h) return 0;
    let b = Number(h.acilisBakiye) || 0;
    for (const i of State.islemler) {
      const t = Number(i.tutar) || 0;
      if (i.tip === 'gelir' && i.odemeHesabiId === hesapId) b += t;
      else if (i.tip === 'gider' && i.odemeHesabiId === hesapId) b -= t;
      else if (i.tip === 'ortakOdeme' && i.odemeHesabiId === hesapId) b -= t;
      else if (i.tip === 'transfer') {
        if (i.odemeHesabiId === hesapId) b -= t;      // çıkış
        if (i.karsiHesapId === hesapId) b += t;        // giriş
      }
    }
    return b;
  },

  // Bir kategori (gelir/gider hesabı) toplamı, dönem filtresiyle
  kategoriToplam(kategoriId, donem) {
    return State.islemler
      .filter(i => i.kategoriId === kategoriId && (!donem || donemStr(i.tarih) === donem))
      .reduce((s, i) => s + (Number(i.tutar) || 0), 0);
  },

  // Ortağa yapılan ödemeler toplamı
  ortakOdenen(ortakId, donem) {
    return State.islemler
      .filter(i => i.tip === 'ortakOdeme' && i.ortakId === ortakId && (!donem || donemStr(i.tarih) === donem))
      .reduce((s, i) => s + (Number(i.tutar) || 0), 0);
  },

  // Dönem gelir / gider / net kar
  donemOzet(donem) {
    let gelir = 0, gider = 0;
    for (const i of State.islemler) {
      if (donem && donemStr(i.tarih) !== donem) continue;
      if (i.tip === 'gelir') gelir += Number(i.tutar) || 0;
      else if (i.tip === 'gider') gider += Number(i.tutar) || 0;
    }
    return { gelir, gider, netKar: gelir - gider };
  },

  gunOzet(tarih) {
    let gelir = 0, gider = 0;
    for (const i of State.islemler) {
      if ((i.tarih || '').slice(0, 10) !== tarih) continue;
      if (i.tip === 'gelir') gelir += Number(i.tutar) || 0;
      else if (i.tip === 'gider') gider += Number(i.tutar) || 0;
    }
    return { gelir, gider, netKar: gelir - gider };
  },

  // Kar payı dağıtımı: net kar × (pay oranı / 100)
  karPayiDagitimi(netKar) {
    const aktif = State.ortaklar.filter(o => o.aktif !== false);
    const toplamOran = aktif.reduce((s, o) => s + (Number(o.payOrani) || 0), 0) || 1;
    return aktif.map(o => {
      const oran = Number(o.payOrani) || 0;
      return {
        ortakId: o.id, ad: o.ad, oran,
        // Oranların toplamı 100 değilse orantısal normalize et
        tutar: netKar * (oran / (toplamOran === 100 ? 100 : toplamOran)),
      };
    });
  },
};

/* ==========================================================
   4) MENÜ & YÖNLENDİRME
   ========================================================== */
const MENU = [
  { id: 'dashboard', ad: 'Gösterge Paneli', ikon: '📊', baslik: 'Gösterge Paneli' },
  { id: 'hesaplar', ad: 'Hesaplar', ikon: '🗂️', baslik: 'Hesaplar' },
  { grup: 'Raporlar', ikon: '📊', ogeler: [
    { id: 'rapor-karzarar', ad: 'Kar / Zarar Raporu',    ikon: '⚖️', baslik: 'Kar / Zarar Raporu' },
    { id: 'rapor-hakedis',  ad: 'Ortak Hak Ediş',        ikon: '🥧', baslik: 'Ortak Hak Ediş Raporu' },
    { id: 'rapor-gelir',    ad: 'Gelirler Raporu',       ikon: '📈', baslik: 'Gelirler Raporu' },
    { id: 'rapor-gider',    ad: 'Giderler Raporu',       ikon: '📉', baslik: 'Giderler Raporu' },
    { id: 'rapor-resmi',    ad: 'Resmi Muhasebe',        ikon: '🧾', baslik: 'Resmi Muhasebe Raporu' },
  ]},
  { grup: 'Ayarlar', ikon: '⚙️', ogeler: [
    { id: 'ayar-firma',     ad: 'Firma Bilgileri',   ikon: '🏢', baslik: 'Firma Bilgileri & Logo' },
    { id: 'ayar-banka',     ad: 'Banka Ayarları',    ikon: '🏦', baslik: 'Banka Ayarları' },
    { id: 'ayar-kk',        ad: 'Kredi Kartı Ayarları', ikon: '💳', baslik: 'Kredi Kartı Ayarları' },
    { id: 'ayar-guvenlik',  ad: 'Giriş / Güvenlik',  ikon: '🔒', baslik: 'Giriş / Güvenlik', gizli: true },
    { id: 'ayar-kullanici', ad: 'Kullanıcı Yetki',   ikon: '👤', baslik: 'Kullanıcı Yetkilendirme' },
    { id: 'ayar-komisyon',  ad: 'Komisyon Ayarları', ikon: '％', baslik: 'Komisyon Ayarları' },
    { id: 'ayar-pay',       ad: 'Ortak Pay Oranı',   ikon: '🥧', baslik: 'Ortak Pay Oranı', gizli: true },
    { id: 'ayar-admin',     ad: 'Admin Ayarları',    ikon: '🛡️', baslik: 'Admin Ayarları', sadeceAdmin: true },
  ]},
];

// Hesaplar kart sayfası — "Hesaplar"a basınca açılan 6 kart
const HESAP_GRUP_SIRA = ['Para Hesapları', 'Gelir · Gider · Ortak', 'Müşteri & Planlama'];
const HESAP_KARTLARI = [
  { id: 'hesap-banka', grup: 'Para Hesapları',        ad: 'Banka Hesabı',    baslik: 'Bankalar',              ikon: '🏦', aciklama: 'Banka işlemlerini izleyin' },
  { id: 'hesap-kk',    grup: 'Para Hesapları',        ad: 'Kredi Kartı',     baslik: 'Kredi Kartı Hesapları', ikon: '💳', aciklama: 'Kart harcamalarını izleyin' },
  { id: 'hesap-kasa',  grup: 'Para Hesapları',        ad: 'Kasa',            baslik: 'Kasa',                  ikon: '💵', aciklama: 'Nakit giriş-çıkışları' },
  { id: 'hesap-gider', grup: 'Gelir · Gider · Ortak', ad: 'Giderler Hesabı', baslik: 'Giderler Hesabı',       ikon: '📉', aciklama: 'Giderleri kalem kalem', gizli: true },
  { id: 'hesap-gelir', grup: 'Gelir · Gider · Ortak', ad: 'Gelirler Hesabı', baslik: 'Gelirler Hesabı',       ikon: '📈', aciklama: 'Gelirleri kalem kalem', gizli: true },
  { id: 'hesap-ortak', grup: 'Gelir · Gider · Ortak', ad: 'Ortaklar Hesabı', baslik: 'Ortaklar Hesabı',       ikon: '🤝', aciklama: 'Hak ediş ve ödemeler', gizli: true },
  { id: 'plan4me',     grup: 'Müşteri & Planlama',    ad: 'Plan4Me',         baslik: 'Plan4Me Aktarımı',      ikon: '🧘', aciklama: 'Ders planı ve katılım' },
  { id: 'potansiyel',  grup: 'Müşteri & Planlama',    ad: 'Potansiyel Müşteriler', baslik: 'Potansiyel Müşteriler', ikon: '🌱', aciklama: 'İlgilenenleri takip et' },
];
// Hesap kartları için şık çizim (line/duotone) ikonlar
const HESAP_IKON = {
  banka: '<path d="M12 3 3 8.2h18L12 3Z" fill="currentColor" opacity=".32"/><path d="M5 10.5v6.5M9 10.5v6.5M15 10.5v6.5M19 10.5v6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.2 20h17.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  kart: '<rect x="2.5" y="5.5" width="19" height="13" rx="3" fill="currentColor" opacity=".3"/><rect x="2.5" y="5.5" width="19" height="13" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 9.7h19" stroke="currentColor" stroke-width="1.8"/><path d="M6 15h4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  kasa: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.5" fill="currentColor" opacity=".3"/><rect x="2.5" y="6.5" width="19" height="11" rx="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 9.5h.01M18.5 14.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  ortak: '<circle cx="9" cy="8" r="3.2" fill="currentColor" opacity=".3"/><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 19c0-3 2.6-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.2 6.6a3 3 0 0 1 .3 5.7M18.5 19c0-2.3-1-4-2.6-4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  gider: '<path d="M4 7.5l5 5 3-3 7.5 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.5 12v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  gelir: '<path d="M4 16.5l5-5 3 3 7.5-7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.5 12V7h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};
function hesapIkonSVG(renk) {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${HESAP_IKON[renk] || ''}</svg>`;
}

function menuCiz() {
  const nav = $('#anaMenu');
  let html = '';
  for (const m of MENU) {
    if (m.gizli) continue;
    if (m.grup) {
      const ogeler = m.ogeler.filter(o => !o.gizli && (!o.sadeceAdmin || adminMi()));
      if (!ogeler.length) continue;
      html += `<div class="menu-grup">
        <button type="button" class="grup-baslik">
          <span class="ikon">${m.ikon || '📁'}</span>
          <span class="gad">${kacar(m.grup)}</span>
          <span class="ok">▸</span>
        </button>
        <div class="menu-alt"><div class="ic">
          ${ogeler.map(o => `<button class="menu-oge" data-sayfa="${o.id}"><span class="ikon">${o.ikon}</span>${kacar(o.ad)}</button>`).join('')}
        </div></div>
      </div>`;
    } else {
      html += `<button class="menu-oge tekil" data-sayfa="${m.id}"><span class="ikon">${m.ikon}</span>${kacar(m.ad)}</button>`;
    }
  }
  nav.innerHTML = html;
  // Akordeon: grup başlığına basınca aç/kapa; biri açılınca diğerleri kapanır
  $$('.grup-baslik', nav).forEach(b => b.onclick = () => {
    const grup = b.parentElement;
    const acikti = grup.classList.contains('acik');
    $$('.menu-grup', nav).forEach(g => g.classList.remove('acik'));
    if (!acikti) grup.classList.add('acik');
  });
  $$('.menu-oge', nav).forEach(b => b.onclick = () => git(b.dataset.sayfa));
}

function menuBul(id) {
  for (const m of MENU) {
    if (m.id === id) return m;
    if (m.ogeler) { const o = m.ogeler.find(x => x.id === id); if (o) return o; }
  }
  const k = HESAP_KARTLARI.find(x => x.id === id);
  if (k) return k;
  return null;
}

function git(sayfa) {
  State.aktifSayfa = sayfa;
  const m = menuBul(sayfa) || { baslik: '—' };
  $('#sayfaBaslik').textContent = m.baslik;
  // Hesap kart sayfaları menüde tekil "Hesaplar" öğesini aktif tutar
  const hesapKartMi = HESAP_KARTLARI.some(k => k.id === sayfa);
  const vurgulanan = hesapKartMi ? 'hesaplar' : sayfa;
  $$('.menu-oge').forEach(b => b.classList.toggle('aktif', b.dataset.sayfa === vurgulanan));
  // Aktif alt sayfanın grubunu aç, diğerlerini kapat (akordeon)
  $$('.menu-grup').forEach(g => {
    const icerir = Array.from(g.querySelectorAll('.menu-oge')).some(b => b.dataset.sayfa === sayfa);
    g.classList.toggle('acik', icerir);
  });
  document.body.classList.remove('menu-acik');
  if (typeof altMenuGuncelle === 'function') altMenuGuncelle();
  const render = SAYFALAR[sayfa] || SAYFALAR.dashboard;
  render(m);
}
window.git = git;

/* ==========================================================
   5) SAYFALAR
   ========================================================== */
const SAYFALAR = {};
const ic = () => $('#icerik');

/* -------- DASHBOARD -------- */
SAYFALAR.dashboard = function () {
  const donem = buAy();
  const ay = Hesapla.donemOzet(donem);
  const gun = Hesapla.gunOzet(bugunISO());

  const paraHesaplar = State.hesaplar.filter(h => HESAP_TIPLERI[h.tip]?.para);
  const toplamVarlik = paraHesaplar.filter(h => h.tip !== 'krediKarti')
    .reduce((s, h) => s + Hesapla.paraHesapBakiye(h.id), 0);

  ic().innerHTML = `
    <div class="izgara izgara-4 dash-ozet" style="margin-bottom:18px">
      <div class="kart ozet gelir">
        <div class="ikon-daire">📈</div>
        <div class="etiket">Bu Ay Gelir</div>
        <div class="deger pozitif">${TL(ay.gelir)}</div>
        <div class="alt-bilgi">Bugün: ${TL(gun.gelir)}</div>
      </div>
      <div class="kart ozet gider">
        <div class="ikon-daire">📉</div>
        <div class="etiket">Bu Ay Gider</div>
        <div class="deger negatif">${TL(ay.gider)}</div>
        <div class="alt-bilgi">Bugün: ${TL(gun.gider)}</div>
      </div>
      <div class="kart ozet kar">
        <div class="ikon-daire">⚖️</div>
        <div class="etiket">Bu Ay Net Kar</div>
        <div class="deger ${ay.netKar >= 0 ? 'pozitif' : 'negatif'}">${TL(ay.netKar)}</div>
        <div class="alt-bilgi">${donemAdi(donem)}</div>
      </div>
      <div class="kart ozet pay">
        <div class="ikon-daire">🥧</div>
        <div class="etiket">Toplam Nakit Varlık</div>
        <div class="deger">${TL(toplamVarlik)}</div>
        <div class="alt-bilgi">${paraHesaplar.filter(h=>h.tip!=='krediKarti').length} hesap</div>
      </div>
    </div>

    ${ortakKartHTML(donem)}
  `;
  $$('[data-git]').forEach(b => b.onclick = () => git(b.dataset.git));
  $$('[data-ders]').forEach(b => b.onclick = () => dersSayisiDuzenle(b.dataset.ders, donem));
};

/* Ortak başına hesaplama: ders geliri, eşit gider payı, hak ediş */
function ortakHesapla(donem) {
  const aktif = State.ortaklar.filter(o => o.aktif !== false);
  const toplamGider = Hesapla.donemOzet(donem).gider;
  const giderPayi = aktif.length ? toplamGider / aktif.length : 0;
  return aktif.map(o => {
    const adet = (o.dersAdet && o.dersAdet[donem]) || 0;
    const ucret = Number(o.dersUcreti) || 0;
    const dersGeliri = adet * ucret;
    return { o, adet, ucret, dersGeliri, giderPayi, hakEdis: dersGeliri - giderPayi };
  });
}

/* Dashboard: tek büyük "Ortak Hak Edişleri" kartı (4 dikey bölme) */
function ortakKartHTML(donem) {
  const rows = ortakHesapla(donem);
  const toplamHE = rows.reduce((s, r) => s + r.hakEdis, 0);
  const avSinif = ['', 'g', 'b', 'p'];
  const bas = (ad) => (ad || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  return `
  <div class="ortakkart">
    <div class="ok-head"><h3>🤝 Ortak Hak Edişleri</h3><span class="dn">${donemAdi(donem)}</span></div>
    ${rows.length === 0
      ? bosBlok('Henüz ortak yok. “Ayarlar → Ortak Pay Oranı”ndan ekleyin.')
      : rows.map((r, i) => {
          const av = r.o.foto
            ? `<div class="av"><img src="${r.o.foto}" alt="${kacar(r.o.ad)}"></div>`
            : `<div class="av ${avSinif[i % 4]}">${kacar(bas(r.o.ad))}</div>`;
          return `<div class="bolme">
            ${av}
            <div class="mid">
              <div class="ad">${kacar(r.o.ad)}</div>
              <div class="sub"><b>${r.adet} ders</b> · ${TL(r.dersGeliri)}
                <button class="ders-duzenle" data-ders="${r.o.id}" title="Bu ay ders sayısını düzenle">✎</button><br>
                Gider payı: <span class="negatif">−${TL(r.giderPayi)}</span></div>
            </div>
            <div class="he"><div class="k">HAK EDİŞ</div>
              <div class="v"${r.hakEdis < 0 ? ' style="color:var(--kirmizi)"' : ''}>${TL(r.hakEdis)}</div></div>
          </div>`;
        }).join('')
        + `<div class="ok-foot"><span class="k">Toplam Hak Ediş</span><span class="v">${TL(toplamHE)}</span></div>`
    }
  </div>`;
}

/* Bir ortağın seçili dönemdeki ders sayısını düzenle */
function dersSayisiDuzenle(ortakId, donem) {
  const o = State.ortaklar.find(x => x.id === ortakId);
  if (!o) return;
  const mevcut = (o.dersAdet && o.dersAdet[donem]) || 0;
  modalAc(`${o.ad} — Ders Sayısı`, `
    <div class="bilgi-kutu"><span class="ikon">📅</span><div><b>${donemAdi(donem)}</b> için verilen ders sayısı. Ders ücreti: <b>${TL(o.dersUcreti || 0)}</b>/ders.
      ${!o.dersUcreti ? '<br>⚠️ Bu ortağın ders ücreti tanımlı değil (Ayarlar → Ortak Pay Oranı).' : ''}</div></div>
    <div class="form-alan"><label>Ders Sayısı</label><input type="number" id="dsAdet" min="0" step="1" value="${mevcut}" autofocus></div>
  `, `<button class="btn" id="dsIptal">İptal</button><button class="btn btn-ana" id="dsKaydet">💾 Kaydet</button>`);
  $('#dsIptal').onclick = modalKapat;
  $('#dsKaydet').onclick = async () => {
    const adet = Math.max(0, parseInt($('#dsAdet').value, 10) || 0);
    const dersAdet = { ...(o.dersAdet || {}), [donem]: adet };
    await DB.guncelle('ortaklar', ortakId, { dersAdet });
    o.dersAdet = dersAdet;
    modalKapat(); bildir('Ders sayısı kaydedildi.', 'basari'); git('dashboard');
  };
}

function sonAylar(n) {
  const arr = [], d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push(t.toISOString().slice(0, 7));
  }
  return arr;
}
function bosBlok(mesaj) {
  return `<div class="bos-tablo"><span class="ikon">📭</span>${kacar(mesaj)}</div>`;
}

/* ==========================================================
   6) VERİ GİRİŞLERİ
   ========================================================== */

/* Ortak: içe aktarma sayfası iskeleti (banka/plan4me/kk) */
function aktarimSayfasi(cfg) {
  const paraHesaplar = State.hesaplar.filter(h => h.tip === cfg.hedefTip);
  ic().innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">ℹ️</span><div>${cfg.aciklama}</div></div>
    <div class="sekmeler">
      <button class="sekme aktif" data-sek="oto">📥 Otomatik (Dosya)</button>
      <button class="sekme" data-sek="manuel">✍️ Manuel Giriş</button>
    </div>
    <div id="sekOto">
      <div class="kart">
        <div class="kart-baslik"><h3>${cfg.baslik} — Dosyadan İçe Aktar</h3></div>
        <div class="form-satir">
          <div class="form-alan">
            <label>Hedef ${HESAP_TIPLERI[cfg.hedefTip].ad} Hesabı</label>
            <select id="ozHedef">${paraHesaplar.length
              ? paraHesaplar.map(h => `<option value="${h.id}">${kacar(h.ad)}</option>`).join('')
              : `<option value="">— önce hesap ekleyin —</option>`}</select>
          </div>
        </div>
        <div class="birak-alani" id="birakAlani">
          <span class="ikon">📄</span>
          <b>Dosyayı buraya sürükleyin</b> veya seçmek için tıklayın<br>
          <span class="soluk">Desteklenen: .csv, .xlsx, .xls</span>
          <input type="file" id="dosyaGir" accept=".csv,.xlsx,.xls" hidden>
        </div>
        <div id="onizleme"></div>
      </div>
    </div>
    <div id="sekManuel" class="gizli"></div>
  `;
  // Sekme geçişi
  $$('.sekme').forEach(s => s.onclick = () => {
    $$('.sekme').forEach(x => x.classList.remove('aktif')); s.classList.add('aktif');
    $('#sekOto').classList.toggle('gizli', s.dataset.sek !== 'oto');
    $('#sekManuel').classList.toggle('gizli', s.dataset.sek !== 'manuel');
    if (s.dataset.sek === 'manuel') manuelGirisFormu(cfg);
  });

  // Dosya bırakma
  const alan = $('#birakAlani'), inp = $('#dosyaGir');
  alan.onclick = () => inp.click();
  ['dragover', 'dragenter'].forEach(ev => alan.addEventListener(ev, e => { e.preventDefault(); alan.classList.add('uzerinde'); }));
  ['dragleave', 'drop'].forEach(ev => alan.addEventListener(ev, e => { e.preventDefault(); alan.classList.remove('uzerinde'); }));
  alan.addEventListener('drop', e => { if (e.dataTransfer.files[0]) dosyaOku(e.dataTransfer.files[0], cfg); });
  inp.onchange = () => { if (inp.files[0]) dosyaOku(inp.files[0], cfg); };
}

/* Manuel işlem giriş formu (gelir/gider/transfer için genel) */
function manuelGirisFormu(cfg) {
  const kap = $('#sekManuel');
  const paraHesaplar = State.hesaplar.filter(h => HESAP_TIPLERI[h.tip]?.para);
  const gelirKalem = State.hesaplar.filter(h => h.tip === 'gelir');
  const giderKalem = State.hesaplar.filter(h => h.tip === 'gider');
  kap.innerHTML = `
    <div class="kart" style="max-width:640px">
      <div class="kart-baslik"><h3>${cfg.baslik} — Manuel İşlem</h3></div>
      <div class="form-satir">
        <div class="form-alan"><label>İşlem Türü</label>
          <select id="mTip">
            <option value="gelir">Gelir (Tahsilat)</option>
            <option value="gider">Gider (Ödeme)</option>
            <option value="transfer">Transfer (Hesaplar arası)</option>
          </select>
        </div>
        <div class="form-alan"><label>Tarih</label><input type="date" id="mTarih" value="${bugunISO()}"></div>
      </div>
      <div class="form-satir">
        <div class="form-alan"><label id="mHesapEt">${HESAP_TIPLERI[cfg.hedefTip].ad} Hesabı</label>
          <select id="mHesap">${paraHesaplar.map(h => `<option value="${h.id}" ${h.tip===cfg.hedefTip?'':''}>${HESAP_TIPLERI[h.tip].ikon} ${kacar(h.ad)}</option>`).join('')}</select>
        </div>
        <div class="form-alan"><label>Tutar (₺)</label><input type="number" id="mTutar" step="0.01" min="0" placeholder="0,00"></div>
      </div>
      <div class="form-satir">
        <div class="form-alan" id="mKategoriKap"><label id="mKategoriEt">Gelir Kalemi</label>
          <select id="mKategori"></select>
        </div>
        <div class="form-alan"><label>Açıklama</label><input type="text" id="mAciklama" placeholder="Örn. Ocak ders geliri"></div>
      </div>
      <div style="text-align:right;margin-top:6px">
        <button class="btn btn-ana" id="mKaydet">💾 Kaydet</button>
      </div>
    </div>`;

  const kategoriDoldur = () => {
    const tip = $('#mTip').value;
    const kat = $('#mKategori'), et = $('#mKategoriEt'), kapDiv = $('#mKategoriKap');
    if (tip === 'transfer') {
      kapDiv.querySelector('label').textContent = 'Karşı Hesap (Nereye)';
      kat.innerHTML = paraHesaplar.map(h => `<option value="${h.id}">${HESAP_TIPLERI[h.tip].ikon} ${kacar(h.ad)}</option>`).join('');
    } else {
      const liste = tip === 'gelir' ? gelirKalem : giderKalem;
      et.textContent = tip === 'gelir' ? 'Gelir Kalemi' : 'Gider Kalemi';
      kat.innerHTML = liste.length ? liste.map(h => `<option value="${h.id}">${kacar(h.ad)}</option>`).join('')
        : `<option value="">— kalem yok, Hesaplar'dan ekleyin —</option>`;
    }
  };
  $('#mTip').onchange = kategoriDoldur; kategoriDoldur();

  $('#mKaydet').onclick = async () => {
    const tip = $('#mTip').value;
    const tutar = parseFloat($('#mTutar').value);
    const hesapId = $('#mHesap').value;
    const katId = $('#mKategori').value;
    if (!tutar || tutar <= 0) return bildir('Geçerli bir tutar girin.', 'hata');
    if (!hesapId) return bildir('Hesap seçin.', 'hata');
    const kayit = {
      tarih: $('#mTarih').value, tutar, tip, odemeHesabiId: hesapId,
      aciklama: $('#mAciklama').value.trim(), kaynak: cfg.kaynak,
    };
    if (tip === 'transfer') kayit.karsiHesapId = katId; else kayit.kategoriId = katId;
    const yeni = await DB.ekle('islemler', kayit);
    State.islemler.unshift(yeni);
    bildir('İşlem kaydedildi.', 'basari');
    manuelGirisFormu(cfg);
  };
}

/* Dosya okuma (CSV / XLSX) → önizleme + eşleştirme */
function dosyaOku(dosya, cfg) {
  const uzanti = dosya.name.split('.').pop().toLowerCase();
  const on = $('#onizleme');
  on.innerHTML = `<div class="yukleniyor"><div class="spinner"></div>Dosya okunuyor…</div>`;
  const bitir = (satirlar) => aktarimOnizle(satirlar, cfg);

  if (uzanti === 'csv') {
    const fr = new FileReader();
    fr.onload = () => bitir(csvAyristir(fr.result));
    fr.readAsText(dosya, 'utf-8');
  } else if (uzanti === 'xlsx' || uzanti === 'xls') {
    if (typeof XLSX === 'undefined') {
      on.innerHTML = `<div class="bilgi-kutu uyari"><span class="ikon">⚠️</span><div>Excel okuma kütüphanesi (xlsx.full.min.js) yüklenmemiş. CSV formatını deneyin ya da kütüphaneyi ekleyin.</div></div>`;
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      const wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const satirlar = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
      bitir(satirlar);
    };
    fr.readAsArrayBuffer(dosya);
  } else {
    on.innerHTML = `<div class="bilgi-kutu uyari"><span class="ikon">⚠️</span><div>Desteklenmeyen dosya türü.</div></div>`;
  }
}

function csvAyristir(metin) {
  const ayrac = (metin.split('\n')[0].match(/;/g) || []).length >= (metin.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  return metin.split(/\r?\n/).filter(s => s.trim()).map(satir => {
    const hucreler = []; let h = '', tirnak = false;
    for (const ch of satir) {
      if (ch === '"') tirnak = !tirnak;
      else if (ch === ayrac && !tirnak) { hucreler.push(h); h = ''; }
      else h += ch;
    }
    hucreler.push(h);
    return hucreler.map(x => x.trim());
  });
}

/* İçe aktarma önizleme + sütun eşleştirme */
function aktarimOnizle(satirlar, cfg) {
  const on = $('#onizleme');
  if (!satirlar || satirlar.length < 2) { on.innerHTML = bosBlok('Dosyada satır bulunamadı.'); return; }
  const baslik = satirlar[0];
  const veri = satirlar.slice(1).filter(s => s.some(h => String(h).trim()));

  // Otomatik sütun tahmini
  const bul = (anahtarlar) => {
    for (let i = 0; i < baslik.length; i++) {
      const b = String(baslik[i]).toLocaleLowerCase('tr');
      if (anahtarlar.some(a => b.includes(a))) return i;
    }
    return -1;
  };
  const tahmin = {
    tarih: bul(['tarih', 'date']),
    aciklama: bul(['açıklama', 'aciklama', 'description', 'detay', 'işlem']),
    tutar: bul(['tutar', 'amount', 'miktar']),
    borc: bul(['borç', 'borc', 'çıkış', 'cikis', 'debit', 'gider']),
    alacak: bul(['alacak', 'giriş', 'giris', 'credit', 'gelir']),
  };

  const sutunSecici = (isim, secili) =>
    `<select id="es_${isim}" style="padding:6px 8px;border-radius:6px;border:1px solid var(--kenar-koyu)">
      <option value="-1">—</option>
      ${baslik.map((b, i) => `<option value="${i}" ${i===secili?'selected':''}>${kacar(String(b)||('Sütun '+(i+1)))}</option>`).join('')}
    </select>`;

  const paraHesaplar = State.hesaplar.filter(h => h.tip === cfg.hedefTip);
  const gelirKalem = State.hesaplar.filter(h => h.tip === 'gelir');
  const giderKalem = State.hesaplar.filter(h => h.tip === 'gider');

  on.innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">🔎</span><div><b>${veri.length}</b> satır bulundu. Sütunları eşleştirin, önizleyin ve aktarın.</div></div>
    <div class="izgara izgara-3" style="margin-bottom:14px">
      <div class="form-alan"><label>Tarih sütunu</label>${sutunSecici('tarih', tahmin.tarih)}</div>
      <div class="form-alan"><label>Açıklama sütunu</label>${sutunSecici('aciklama', tahmin.aciklama)}</div>
      <div class="form-alan"><label>Tutar sütunu (tek)</label>${sutunSecici('tutar', tahmin.tutar)}</div>
      <div class="form-alan"><label>Alacak/Giriş (+) sütunu</label>${sutunSecici('alacak', tahmin.alacak)}</div>
      <div class="form-alan"><label>Borç/Çıkış (−) sütunu</label>${sutunSecici('borc', tahmin.borc)}</div>
      <div class="form-alan"><label>Varsayılan Gelir Kalemi</label>
        <select id="esGelirKat">${gelirKalem.map(h=>`<option value="${h.id}">${kacar(h.ad)}</option>`).join('') || '<option value="">—</option>'}</select></div>
      <div class="form-alan"><label>Varsayılan Gider Kalemi</label>
        <select id="esGiderKat">${giderKalem.map(h=>`<option value="${h.id}">${kacar(h.ad)}</option>`).join('') || '<option value="">—</option>'}</select></div>
    </div>
    <div class="tablo-sar" style="max-height:320px;overflow:auto"><table class="tablo">
      <thead><tr>${baslik.map(b=>`<th>${kacar(String(b))}</th>`).join('')}</tr></thead>
      <tbody>${veri.slice(0,20).map(r=>`<tr>${baslik.map((_,i)=>`<td>${kacar(String(r[i]??''))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    ${veri.length>20?`<div class="soluk" style="margin-top:8px;font-size:12px">İlk 20 satır gösteriliyor…</div>`:''}
    <div style="text-align:right;margin-top:16px">
      <button class="btn btn-ana" id="aktarBtn">✅ ${veri.length} Satırı Aktar</button>
    </div>`;

  $('#aktarBtn').onclick = async () => {
    const hedefId = $('#ozHedef').value;
    if (!hedefId) return bildir('Hedef hesap seçin.', 'hata');
    const es = {
      tarih: +$('#es_tarih').value, aciklama: +$('#es_aciklama').value,
      tutar: +$('#es_tutar').value, alacak: +$('#es_alacak').value, borc: +$('#es_borc').value,
    };
    const gelirKat = $('#esGelirKat').value, giderKat = $('#esGiderKat').value;
    const kayitlar = [];
    for (const r of veri) {
      const tarih = tarihNormalize(es.tarih >= 0 ? r[es.tarih] : '') || bugunISO();
      const aciklama = es.aciklama >= 0 ? String(r[es.aciklama] || '') : '';
      let tip = null, tutar = 0;
      if (es.alacak >= 0 || es.borc >= 0) {
        const alacak = es.alacak >= 0 ? paraCoz(r[es.alacak]) : 0;
        const borc = es.borc >= 0 ? paraCoz(r[es.borc]) : 0;
        if (alacak > 0) { tip = 'gelir'; tutar = alacak; }
        else if (borc > 0) { tip = 'gider'; tutar = borc; }
      } else if (es.tutar >= 0) {
        const t = paraCoz(r[es.tutar]);
        if (t > 0) { tip = 'gelir'; tutar = t; }
        else if (t < 0) { tip = 'gider'; tutar = Math.abs(t); }
      }
      if (!tip || tutar <= 0) continue;
      const k = { tarih, tutar, tip, odemeHesabiId: hedefId, aciklama, kaynak: cfg.kaynak };
      k.kategoriId = tip === 'gelir' ? gelirKat : giderKat;
      kayitlar.push(k);
    }
    if (!kayitlar.length) return bildir('Aktarılacak geçerli satır bulunamadı.', 'hata');
    $('#aktarBtn').disabled = true; $('#aktarBtn').textContent = 'Aktarılıyor…';
    const eklenen = await DB.topluEkle('islemler', kayitlar);
    State.islemler = eklenen.concat(State.islemler);
    bildir(`${eklenen.length} işlem aktarıldı.`, 'basari');
    git(State.aktifSayfa);
  };
}

function paraCoz(v) {
  if (v == null) return 0;
  let s = String(v).replace(/[^\d,.\-]/g, '').trim();
  if (!s) return 0;
  // Türkçe format: 1.234,56 → 1234.56
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function tarihNormalize(v) {
  if (!v) return '';
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);      // YYYY-MM-DD
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/);        // DD.MM.YYYY
  if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
  const d = new Date(s);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

SAYFALAR['banka-aktarim'] = () => aktarimSayfasi({
  baslik: 'Banka Aktarımı', hedefTip: 'banka', kaynak: 'banka',
  aciklama: 'Bankanızın ekstre/hesap hareketleri dosyasını (CSV veya Excel) yükleyin ya da manuel giriş yapın. Giriş (alacak) → gelir, çıkış (borç) → gider olarak işlenir.',
});
SAYFALAR['plan4me'] = () => aktarimSayfasi({
  baslik: 'Plan4Me Aktarımı', hedefTip: 'kasa', kaynak: 'plan4me',
  aciklama: 'Plan4Me ders kayıt raporunu yükleyin (otomatik) ya da tek tek ders gelirlerini manuel girin. Ders ücretleri gelir olarak işlenir.',
});
SAYFALAR['kk-aktarim'] = () => aktarimSayfasi({
  baslik: 'Kredi Kartı Aktarımı', hedefTip: 'krediKarti', kaynak: 'krediKarti',
  aciklama: 'Kredi kartı ekstre dosyanızı yükleyin. Harcamalar gider, iadeler/tahsilatlar gelir olarak işlenir.',
});
/* -------- KASA GİRİŞİ — yönlendirmeli sihirbaz (dokunmatik, basit) -------- */
SAYFALAR['kasa-giris'] = function () { kasaSihirbaz(); };

function kasaSihirbaz() {
  const AYK = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const S = { adim: 1, yon: null, kurus: 0, kategoriId: null, kategoriAd: '', ortakId: null, ortakAd: '', tarih: bugunISO(), kasaId: null };
  const kasalar = () => State.hesaplar.filter(h => h.tip === 'kasa');
  const tutar = () => S.kurus / 100;
  const tutarYazi = () => tutar().toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const trTarih = (iso) => { const [y, m, g] = iso.split('-'); return `${parseInt(g, 10)} ${AYK[parseInt(m, 10) - 1]}`; };
  const bugunMu = () => S.tarih === bugunISO();

  const basHarf = (ad) => (ad || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  const avSinif = ['', 'g', 'b', 'p'];

  function baslik(no, ust, alt) {
    const geri = no === 1 ? '✕' : '←';
    return `<div class="k-head">
      <button class="k-geri" data-eylem="geri">${geri}</button>
      <h2>${ust}</h2><div class="k-alt">${alt}</div>
      <div class="k-prog">${[1,2,3,4,5].map(i => `<i class="${i <= no ? 'on' : ''}"></i>`).join('')}</div>
    </div>`;
  }

  function ciz() {
    const kap = ic();
    let g = '';
    if (S.adim === 1) {
      g = baslik(1, 'Kasaya ne oldu?', 'Nakit para giriş mi çıkış mı?') + `
        <div class="k-body"><div class="k-yon">
          <button class="k-ybtn gir" data-yon="gelir"><span class="ic">💵</span><span class="tx"><b>Para GİRDİ</b><small>Tahsilat, nakit gelir</small></span></button>
          <button class="k-ybtn cik" data-yon="gider"><span class="ic">💸</span><span class="tx"><b>Para ÇIKTI</b><small>Ödeme, harcama</small></span></button>
        </div></div>`;
    } else if (S.adim === 2) {
      g = baslik(2, 'Ne kadar?', `${S.yon === 'gelir' ? '💵 Para Girdi' : '💸 Para Çıktı'} · tutarı yazın`) + `
        <div class="k-body">
          <div class="k-tutar ${S.yon}">${S.yon === 'gelir' ? '+' : '−'} ${tutarYazi()} <small>₺</small></div>
          <div class="k-pad">
            ${[1,2,3,4,5,6,7,8,9].map(n => `<button data-tus="${n}">${n}</button>`).join('')}
            <button data-tus="00">00</button><button data-tus="0">0</button>
            <button class="sil" data-eylem="sil">⌫</button>
          </div>
        </div>
        <div class="k-foot"><button class="k-ana" data-eylem="ileri" ${S.kurus > 0 ? '' : 'disabled'}>Devam →</button></div>`;
    } else if (S.adim === 3) {
      const liste = State.hesaplar.filter(h => h.tip === S.yon);
      g = baslik(3, 'Ne için?', 'Kategori seçin (isteğe bağlı)') + `
        <div class="k-body"><div class="k-kat">
          ${liste.map(h => `<button class="k-kbtn ${S.kategoriId === h.id ? 'sec' : ''}" data-kat="${h.id}">
            <span class="ic">${S.yon === 'gelir' ? '📈' : '📉'}</span><span class="n">${kacar(h.ad)}</span></button>`).join('')}
          <button class="k-kbtn" data-eylem="yeniKat"><span class="ic">➕</span><span class="n">Yeni</span></button>
        </div></div>
        <div class="k-foot">
          <button class="k-ikincil" data-eylem="atlaKat">Kategorisiz devam</button>
          <button class="k-ana" data-eylem="ileri" ${S.kategoriId ? '' : 'disabled'}>Devam →</button>
        </div>`;
    } else if (S.adim === 4) {
      const ortaklar = State.ortaklar.filter(o => o.aktif !== false);
      g = baslik(4, 'Hangi ortak?', 'Bu işlem kime ait?') + `
        <div class="k-body"><div class="k-ortak">
          ${ortaklar.map((o, i) => `<button class="k-obtn ${S.ortakId === o.id ? 'sec' : ''}" data-ortak="${o.id}" data-ad="${kacar(o.ad)}">
            ${o.foto ? `<span class="av"><img src="${o.foto}" alt=""></span>` : `<span class="av ${avSinif[i % 4]}">${kacar(basHarf(o.ad))}</span>`}
            <span class="n">${kacar(o.ad)}</span></button>`).join('')}
          <button class="k-obtn ${S.ortakId === '' ? 'sec' : ''}" data-ortak="" data-ad="Genel"><span class="av genel">🏢</span><span class="n">Genel<br>(ortak yok)</span></button>
        </div></div>`;
    } else {
      const kaslar = kasalar();
      const kAd = S.kategoriAd || 'Kategorisiz';
      const oAd = S.ortakId === '' ? 'Genel' : (S.ortakAd || '—');
      g = baslik(5, 'Onayla', 'Her şey doğru mu?') + `
        <div class="k-body">
          <div class="k-ozet ${S.yon}">
            <div class="ust">Kasaya</div>
            <div class="big">${S.yon === 'gelir' ? '+' : '−'} ${tutarYazi()} ₺</div>
            <div class="sat"><span>İşlem</span><b class="${S.yon === 'gelir' ? 'pozitif' : 'negatif'}">${S.yon === 'gelir' ? 'Para Girdi' : 'Para Çıktı'}</b></div>
            <div class="sat"><span>Ne için</span><b>${kacar(kAd)}</b></div>
            <div class="sat"><span>Ortak</span><b>${kacar(oAd)}</b></div>
            <div class="sat"><span>Tarih</span><b>${bugunMu() ? 'Bugün · ' : ''}${trTarih(S.tarih)}</b></div>
            ${kaslar.length > 1 ? `<div class="sat"><span>Kasa</span><b><select id="kKasa">${kaslar.map(k => `<option value="${k.id}" ${S.kasaId === k.id ? 'selected' : ''}>${kacar(k.ad)}</option>`).join('')}</select></b></div>` : ''}
          </div>
          <button class="k-tarih" data-eylem="tarih">📅 Tarihi değiştir</button>
        </div>
        <div class="k-foot"><button class="k-ana kaydet" data-eylem="kaydet">✓ Kaydet</button></div>`;
    }
    kap.innerHTML = `<div class="ksihirbaz">${g}</div>`;
    wire();
  }

  function wire() {
    const kap = ic();
    $$('[data-yon]', kap).forEach(b => b.onclick = () => { S.yon = b.dataset.yon; S.kategoriId = null; S.kategoriAd = ''; S.adim = 2; ciz(); });
    $$('[data-tus]', kap).forEach(b => b.onclick = () => { const t = b.dataset.tus; if (t === '00') S.kurus = Math.min(S.kurus * 100, 9999999999); else S.kurus = Math.min(S.kurus * 10 + parseInt(t, 10), 9999999999); ciz(); });
    $$('[data-kat]', kap).forEach(b => b.onclick = () => { S.kategoriId = b.dataset.kat; const h = State.hesaplar.find(x => x.id === b.dataset.kat); S.kategoriAd = h ? h.ad : ''; S.adim = 4; ciz(); });
    $$('[data-ortak]', kap).forEach(b => b.onclick = () => { S.ortakId = b.dataset.ortak; S.ortakAd = b.dataset.ad; S.adim = 5; ciz(); });
    const el = (s) => $(s, kap);
    const eylem = (ad, fn) => { const b = $(`[data-eylem="${ad}"]`, kap); if (b) b.onclick = fn; };
    eylem('geri', () => { if (S.adim === 1) { git('dashboard'); return; } S.adim--; ciz(); });
    eylem('sil', () => { S.kurus = Math.floor(S.kurus / 10); ciz(); });
    eylem('ileri', () => { if (S.adim === 2 && S.kurus <= 0) return; S.adim++; ciz(); });
    eylem('atlaKat', () => { S.kategoriId = null; S.kategoriAd = ''; S.adim = 4; ciz(); });
    eylem('yeniKat', () => yeniKategori());
    eylem('tarih', () => tarihDegistir());
    eylem('kaydet', () => kaydet());
  }

  function yeniKategori() {
    modalAc(S.yon === 'gelir' ? 'Yeni Gelir Kategorisi' : 'Yeni Gider Kategorisi',
      `<div class="form-alan"><label>Kategori Adı</label><input type="text" id="ykAd" placeholder="${S.yon === 'gelir' ? 'Örn. Ders Ücreti' : 'Örn. Malzeme'}" autofocus></div>`,
      `<button class="btn" id="ykIptal">İptal</button><button class="btn btn-ana" id="ykKaydet">Ekle</button>`);
    $('#ykIptal').onclick = modalKapat;
    $('#ykKaydet').onclick = async () => {
      const ad = $('#ykAd').value.trim(); if (!ad) return bildir('Ad girin.', 'hata');
      const y = await DB.ekle('hesaplar', { ad, tip: S.yon, aktif: true });
      State.hesaplar.push(y); S.kategoriId = y.id; S.kategoriAd = ad;
      modalKapat(); S.adim = 4; ciz();
    };
  }

  function tarihDegistir() {
    modalAc('Tarih Seç', `<div class="form-alan"><label>İşlem Tarihi</label><input type="date" id="tdTarih" value="${S.tarih}"></div>`,
      `<button class="btn" id="tdIptal">İptal</button><button class="btn btn-ana" id="tdOk">Tamam</button>`);
    $('#tdIptal').onclick = modalKapat;
    $('#tdOk').onclick = () => { S.tarih = $('#tdTarih').value || bugunISO(); modalKapat(); ciz(); };
  }

  async function kaydet() {
    if (S.kurus <= 0) return bildir('Tutar girin.', 'hata');
    let kasaId = S.kasaId;
    const kaslar = kasalar();
    const secili = $('#kKasa'); if (secili) kasaId = secili.value;
    if (!kasaId) kasaId = kaslar[0] && kaslar[0].id;
    if (!kasaId) { const yk = await DB.ekle('hesaplar', { ad: 'Kasa', tip: 'kasa', acilisBakiye: 0, aktif: true }); State.hesaplar.push(yk); kasaId = yk.id; }
    const kayit = { tarih: S.tarih, tutar: tutar(), tip: S.yon, odemeHesabiId: kasaId, kaynak: 'kasa' };
    if (S.kategoriId) kayit.kategoriId = S.kategoriId;
    if (S.ortakId) kayit.ortakId = S.ortakId;
    const y = await DB.ekle('islemler', kayit); State.islemler.unshift(y);
    basari();
  }

  function basari() {
    ic().innerHTML = `<div class="ksihirbaz"><div class="k-basari">
      <div class="tik">✓</div>
      <h2>Kaydedildi!</h2>
      <p>Kasaya <b class="${S.yon === 'gelir' ? 'pozitif' : 'negatif'}">${S.yon === 'gelir' ? '+' : '−'} ${tutarYazi()} ₺</b> işlendi.</p>
      <div class="k-basari-btn">
        <button class="k-ana" data-eylem="yeni">➕ Yeni Giriş</button>
        <button class="k-ikincil" data-eylem="bitir">Bitir</button>
      </div>
    </div></div>`;
    $('[data-eylem="yeni"]').onclick = () => kasaSihirbaz();
    $('[data-eylem="bitir"]').onclick = () => git('dashboard');
  }

  ciz();
}

/* ==========================================================
   7) HESAPLAR
   ========================================================== */
/* -------- HESAPLAR (kart sayfası) -------- */
// Kart alt satırı: açıklama yerine canlı özet rakam
function hesapKartOzet(k) {
  const TLk = (n) => Math.round(Number(n) || 0).toLocaleString('tr-TR') + ' ₺';
  const paraTop = (tip) => State.hesaplar.filter(h => h.tip === tip).reduce((s, h) => s + Hesapla.paraHesapBakiye(h.id), 0);
  switch (k.id) {
    case 'hesap-banka': { const t = paraTop('banka'); return { metin: TLk(t), sinif: t < 0 ? 'r' : 'n' }; }
    case 'hesap-kasa':  { const t = paraTop('kasa');  return { metin: TLk(t), sinif: t < 0 ? 'r' : 'n' }; }
    case 'hesap-kk':    { const b = -paraTop('krediKarti'); return { metin: TLk(b), sinif: b > 0 ? 'r' : 'n' }; }
    case 'hesap-gider': return { metin: TLk(Hesapla.donemOzet(null).gider), sinif: 'r' };
    case 'hesap-gelir': return { metin: TLk(Hesapla.donemOzet(null).gelir), sinif: 'g' };
    case 'hesap-ortak': return { metin: State.ortaklar.length + ' ortak', sinif: 'n' };
    case 'potansiyel':  return { metin: State.potansiyel.length + ' kişi', sinif: 'n' };
    default:            return { metin: '—', sinif: 'soluk' };
  }
}
SAYFALAR.hesaplar = function () {
  const kartHTML = (k) => {
    const o = hesapKartOzet(k);
    return `
    <button type="button" class="hkart" data-git="${k.id}">
      <span class="visual"><span class="hk-emoji">${k.ikon}</span></span>
      <span class="t">${kacar(k.ad)}</span>
      <span class="rakam ${o.sinif}">${kacar(o.metin)}</span>
    </button>`;
  };
  ic().innerHTML = HESAP_GRUP_SIRA.map(grup => {
    const kartlar = HESAP_KARTLARI.filter(k => k.grup === grup && !k.gizli);
    if (!kartlar.length) return '';
    return `<div class="hgrup-baslik">🌿 ${kacar(grup)}</div>
      <div class="hesap-kartlar${kartlar.length <= 2 ? ' iki' : ''}">${kartlar.map(kartHTML).join('')}</div>`;
  }).join('');
  $$('[data-git]').forEach(b => b.onclick = () => git(b.dataset.git));
};

// Alt hesap sayfalarının üstünde "Hesaplar'a dön" bağlantısı
function hesapGeriHTML() {
  return `<button type="button" class="hesap-geri" onclick="git('hesaplar')">‹ Hesaplar</button>`;
}

/* -------- POTANSİYEL MÜŞTERİLER (basit takip listesi) -------- */
SAYFALAR['potansiyel'] = function () {
  const list = State.potansiyel;
  ic().innerHTML = `
    ${hesapGeriHTML()}
    <div class="kart-baslik" style="margin-bottom:16px">
      <div class="bilgi-kutu" style="margin:0;flex:1"><span class="ikon">🌱</span><div>Stüdyoyla ilgilenen <b>potansiyel müşterileri</b> buradan takip edin; üye olduklarında güncelleyin.</div></div>
      <button class="btn btn-ana" id="yeniPot" style="margin-left:14px">＋ Yeni Kişi</button>
    </div>
    <div class="kart">
      ${list.length === 0 ? bosBlok('Henüz potansiyel müşteri yok. “＋ Yeni Kişi” ile ekleyin.') : `
      <div class="tablo-sar"><table class="tablo">
        <thead><tr><th>Ad Soyad</th><th>Telefon</th><th>Not</th><th class="sag">İşlem</th></tr></thead>
        <tbody>${list.map(p => `<tr>
          <td>🌱 ${kacar(p.ad)}</td>
          <td>${p.telefon ? `<a href="tel:${kacar(p.telefon)}">${kacar(p.telefon)}</a>` : '<span class="soluk">—</span>'}</td>
          <td class="soluk">${kacar(p.not || '—')}</td>
          <td class="sag">
            <button class="btn btn-kucuk btn-ikon" data-duzenle="${p.id}" title="Düzenle">✏️</button>
            <button class="btn btn-kucuk btn-ikon" data-sil="${p.id}" title="Sil">🗑️</button>
          </td></tr>`).join('')}</tbody>
      </table></div>`}
    </div>`;
  $('#yeniPot').onclick = () => potansiyelFormu();
  $$('[data-duzenle]').forEach(b => b.onclick = () => potansiyelFormu(list.find(p => p.id === b.dataset.duzenle)));
  $$('[data-sil]').forEach(b => b.onclick = () => {
    const p = list.find(x => x.id === b.dataset.sil);
    onayModal('Kişi silinsin mi?', `“${kacar(p.ad)}” silinecek.`, async () => {
      await DB.sil('potansiyel', p.id);
      State.potansiyel = State.potansiyel.filter(x => x.id !== p.id);
      bildir('Silindi.', 'basari'); git('potansiyel');
    });
  });
};
function potansiyelFormu(mevcut) {
  const govde = `
    <div class="form-alan"><label>Ad Soyad</label><input type="text" id="pAd" value="${mevcut ? kacar(mevcut.ad) : ''}" placeholder="Örn. Ayşe Demir"></div>
    <div class="form-alan"><label>Telefon</label><input type="tel" id="pTel" value="${mevcut ? kacar(mevcut.telefon || '') : ''}" placeholder="05__ ___ __ __"></div>
    <div class="form-alan"><label>Not</label><textarea id="pNot" rows="2" placeholder="Örn. Deneme dersine geldi, Pazartesi tekrar arayacak">${mevcut ? kacar(mevcut.not || '') : ''}</textarea></div>`;
  modalAc(mevcut ? 'Kişi Düzenle' : 'Yeni Potansiyel Müşteri', govde, `<button class="btn" id="pIptal">İptal</button><button class="btn btn-ana" id="pKaydet">💾 Kaydet</button>`);
  $('#pIptal').onclick = modalKapat;
  $('#pKaydet').onclick = async () => {
    const ad = $('#pAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, telefon: $('#pTel').value.trim(), not: $('#pNot').value.trim() };
    if (mevcut) { await DB.guncelle('potansiyel', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('potansiyel', veri); State.potansiyel.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); git('potansiyel');
  };
}

/* ===================== BANKALAR (logo şeridi + Kayıt No tablosu) ===================== */
let _bankaSecili = null;   // seçili banka hesabının id'si (açılışta boş)

// İsimden istikrarlı bir renk tonu üret (logo yoksa monogram karesi için)
function renkTon(s) { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
function bankaTileHTML(h, boyut) {
  const b = boyut || 76;
  const stil = `width:${b}px;height:${b}px`;
  if (h.logoData) return `<div class="banka-tile" style="${stil}"><img src="${h.logoData}" alt="${kacar(h.ad)}"></div>`;
  const t = renkTon(h.ad);
  return `<div class="banka-tile" style="${stil};background:linear-gradient(135deg,hsl(${t} 52% 55%),hsl(${t} 52% 38%))">${kacar(monogram(h.ad))}</div>`;
}

/* ===================== ORTAK EKSTRE GÖRÜNÜMÜ (Banka · Kasa · Kredi Kartı) ===================== */
const _ekstreSecili = { banka: null, kasa: null, krediKarti: null };
const EKSTRE_CFG = {
  banka:      { ikon: '🏦', ad: 'Banka',        bosAd: 'banka',        ayar: 'ayar-banka', borcMu: false },
  kasa:       { ikon: '💵', ad: 'Kasa',         bosAd: 'kasa',         ayar: null,         borcMu: false },
  krediKarti: { ikon: '💳', ad: 'Kredi Kartı',  bosAd: 'kredi kartı',  ayar: 'ayar-kk',    borcMu: true },
};
const AY_KISA = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
/* "28 Tem 2026" biçimi (form tarih göstergesi) */
function fmtTarihUzun(iso) {
  const s = (iso || bugunISO()).slice(0, 10).split('-');
  const m = parseInt(s[1], 10) || 1;
  return `${parseInt(s[2], 10) || ''} ${AY_KISA[m - 1] || ''} ${s[0] || ''}`;
}
function tarihBlok(iso) {
  const s = (iso || bugunISO()).slice(0, 10).split('-');
  const m = parseInt(s[1], 10) || 1;
  return `<div class="e-tarih"><div class="g">${kacar(s[2] || '')}</div><div class="a">${AY_KISA[m-1] || ''}</div><div class="y">${kacar(s[0] || '')}</div></div>`;
}
function kasaTileHTML() {
  return `<div class="banka-tile" style="width:76px;height:76px;font-size:34px;background:linear-gradient(135deg,#7ba97e,#4f7452)">💵</div>`;
}
// Çip/seçici için küçük logo (yüklenen logo varsa görsel, yoksa renkli monogram)
function hesapMiniLogo(h) {
  if (h.logoData) return `<span class="e-ml"><img src="${h.logoData}" alt=""></span>`;
  const t = renkTon(h.ad);
  return `<span class="e-ml" style="background:linear-gradient(135deg,hsl(${t} 52% 55%),hsl(${t} 52% 38%))">${kacar(monogram(h.ad))}</span>`;
}

SAYFALAR['hesap-banka'] = () => { _ekstreSecili.banka = null; ekstreSayfasi('banka'); };
SAYFALAR['hesap-kasa']  = () => { _ekstreSecili.kasa = null; ekstreSayfasi('kasa'); };
SAYFALAR['hesap-kk']    = () => { _ekstreSecili.krediKarti = null; ekstreSayfasi('krediKarti'); };

function ekstreSayfasi(tip) {
  const cfg = EKSTRE_CFG[tip];
  const hesaplar = State.hesaplar.filter(h => h.tip === tip);
  if (_ekstreSecili[tip] && !hesaplar.some(h => h.id === _ekstreSecili[tip])) _ekstreSecili[tip] = null;
  if (!_ekstreSecili[tip] && hesaplar.length) _ekstreSecili[tip] = hesaplar[0].id;   // ilkini otomatik seç

  if (!hesaplar.length) {
    const btn = `<button class="btn btn-ana" id="ekstreEkle" style="margin-top:12px">＋ ${cfg.ad} ${tip === 'kasa' ? 'Oluştur' : 'Ekle'}</button>`;
    ic().innerHTML = `${hesapGeriHTML()}
      <div class="kart"><div class="banka-bos"><div class="el">${cfg.ikon}</div><p>Henüz ${cfg.bosAd} yok.</p>${btn}</div></div>`;
    $('#ekstreEkle').onclick = () => hesapEkleModal(tip);
    return;
  }

  const secili = hesaplar.find(h => h.id === _ekstreSecili[tip]);
  const borcMu = cfg.borcMu;
  const kartMi = tip === 'krediKarti';

  // Seçici: Kasa hariç her zaman görünür (açılır-kapanır çip listesi + "＋ Ekle")
  let secHTML = '';
  if (tip !== 'kasa') {
    const chips = hesaplar.map(h => `<button type="button" class="e-chip ${h.id===secili.id?'sec':''}" data-ekstre="${h.id}">
      ${hesapMiniLogo(h)}<span>${kacar(h.ad)}</span></button>`).join('');
    const ekleChip = cfg.ayar ? `<button type="button" class="e-chip e-chip-ekle" id="ekstreEkleChip">＋ ${kacar(cfg.ad)} Ekle</button>` : '';
    const sayHTML = hesaplar.length > 1 ? `<span class="say">${hesaplar.length} hesap</span>` : '';
    secHTML = `<div class="e-sec" id="eSec">
      <button type="button" class="e-sec-trigger" id="secTrigger">
        ${hesapMiniLogo(secili)}<b>${kacar(secili.ad)}</b>${sayHTML}<span class="ok">▾</span>
      </button>
      <div class="e-sec-liste"><div class="ic">${chips}${ekleChip}</div></div>
    </div>`;
  }

  // Hareketler — kronolojik (eski→yeni), yürüyen değer için
  const hareketler = State.islemler
    .filter(i => i.odemeHesabiId === secili.id || i.karsiHesapId === secili.id)
    .slice()
    .sort((a, b) => (a.tarih || '').localeCompare(b.tarih || '') || (Number(a.kayitNo) || 0) - (Number(b.kayitNo) || 0));

  let deger = borcMu ? 0 : (Number(secili.acilisBakiye) || 0);
  const rows = hareketler.map(i => {
    const tutar = Number(i.tutar) || 0;
    const kat = State.hesaplar.find(h => h.id === i.kategoriId);
    let artiMi, katAd;
    if (borcMu) {
      const odemeMi = (i.tip === 'transfer' && i.karsiHesapId === secili.id);
      if (odemeMi) { deger -= tutar; artiMi = true;  katAd = 'Borç Ödeme'; }
      else         { deger += tutar; artiMi = false; katAd = kat ? kat.ad : 'Harcama'; }
    } else {
      const girenMi = (i.tip === 'gelir') || (i.tip === 'transfer' && i.karsiHesapId === secili.id);
      if (girenMi) { deger += tutar; artiMi = true;  katAd = (i.tip === 'gelir' && kat) ? kat.ad : 'Transfer'; }
      else         { deger -= tutar; artiMi = false; katAd = (i.tip === 'gider' && kat) ? kat.ad : (i.tip === 'ortakOdeme' ? 'Ortak Ödeme' : 'Transfer'); }
    }
    return { i, artiMi, tutar, deger, katAd };
  });
  const guncel = deger;
  const bakiyeLbl = borcMu ? 'Borç' : 'Bakiye';

  const satirlar = rows.slice().reverse().map(r => `
    <button type="button" class="e-satir" data-hareket="${r.i.id}">
      ${tarihBlok(r.i.tarih)}
      <div class="e-ic">
        <div class="e-l1"><span class="e-ack">${kacar(r.i.aciklama || '—')}</span>
          <span class="e-tut ${r.artiMi ? 'g' : 'r'}">${r.artiMi ? '+' : '−'}${TL(r.tutar)}</span></div>
        <div class="e-l2"><span class="e-bk">İşlem Sonu ${bakiyeLbl}</span><span class="e-bv">${TL(r.deger)}</span></div>
        <span class="e-kat ${r.artiMi ? '' : 'r'}">${kacar(r.katAd)}</span>
      </div>
    </button>`).join('');

  ic().innerHTML = `${hesapGeriHTML()}
    ${secHTML}
    <div class="e-ozet">
      <div class="e-ozet-sol">
        <div class="k">${kacar(secili.ad)} · ${borcMu ? 'Güncel Borç' : 'Güncel Bakiye'}</div>
        <div class="v">${TL(guncel)}</div>
        ${kartMi ? `<div class="sd">Son ödeme: ${sonOdemeMetni(secili.sonOdemeGunu)}</div>` : ''}
      </div>
      <button type="button" class="btn-yeni" id="yeniHareket">＋ Yeni</button>
    </div>
    ${hareketler.length === 0
      ? `<div class="kart">${bosBlok('Bu hesapta henüz hareket yok. “＋ Yeni” ile ekleyin.')}</div>`
      : `<div class="e-liste">${satirlar}</div>`}`;

  if ($('#secTrigger')) $('#secTrigger').onclick = () => $('#eSec').classList.toggle('acik');
  if ($('#ekstreEkleChip')) $('#ekstreEkleChip').onclick = () => hesapEkleModal(tip);
  $$('[data-ekstre]').forEach(b => b.onclick = () => { _ekstreSecili[tip] = b.dataset.ekstre; ekstreSayfasi(tip); });
  const hareketFormu = kartMi ? kartHareketFormu : bankaHareketFormu;
  if ($('#yeniHareket')) $('#yeniHareket').onclick = () => hareketFormu(secili.id);
  $$('[data-hareket]').forEach(r => r.onclick = () => hareketFormu(secili.id, State.islemler.find(i => i.id === r.dataset.hareket)));
}

function kasaOlustur() {
  const govde = `
    <div class="form-alan"><label>Kasa Adı</label><input type="text" id="kAd" value="Kasa" placeholder="Örn. Merkez Kasa"></div>
    <div class="form-alan"><label>Açılış Bakiyesi (₺)</label><input type="number" id="kBak" step="0.01" value="0"></div>`;
  modalAc('Yeni Kasa', govde, `<button class="btn" id="kIptal">İptal</button><button class="btn btn-ana" id="kKaydet">💾 Oluştur</button>`);
  $('#kIptal').onclick = modalKapat;
  $('#kKaydet').onclick = async () => {
    const ad = $('#kAd').value.trim() || 'Kasa';
    const y = await DB.ekle('hesaplar', { ad, tip: 'kasa', acilisBakiye: parseFloat($('#kBak').value) || 0, aktif: true });
    State.hesaplar.push(y); _ekstreSecili.kasa = y.id;
    modalKapat(); bildir('Kasa oluşturuldu.', 'basari'); ekstreSayfasi('kasa');
  };
}

/* Premium hesap ekleme penceresi — Kasa / Banka / Kredi Kartı (gruplu liste tarzı) */
function hesapEkleModal(tip, mevcut) {
  const bilgi = HESAP_TIPLERI[tip];
  if (!bilgi) return;
  const logoDestek = (tip === 'banka' || tip === 'krediKarti');
  let _logo = (mevcut && mevcut.logoData) || null;

  const satirlar = [];
  satirlar.push(`<div class="hr-satir"><label for="heAd">${bilgi.ad} Adı</label>
    <input type="text" id="heAd" value="${mevcut ? kacar(mevcut.ad) : ''}" placeholder="Örn. ${ornekAd(tip)}"></div>`);
  if (tip === 'krediKarti') {
    satirlar.push(`<div class="hr-satir"><label for="heGun">Son Ödeme Günü</label>
      <input type="number" id="heGun" min="1" max="31" inputmode="numeric" value="${mevcut ? (mevcut.sonOdemeGunu || 1) : 1}" placeholder="1"></div>`);
  } else {
    satirlar.push(`<div class="hr-satir"><label for="heAcilis">Açılış Bakiyesi (₺)</label>
      <input type="number" id="heAcilis" step="0.01" inputmode="decimal" value="${mevcut ? (mevcut.acilisBakiye || 0) : 0}"></div>`);
  }
  if (logoDestek) {
    satirlar.push(`<div class="hr-satir hr-logo-satir"><label>Logo</label>
      <div class="hr-logo-sag">
        <span id="heLogoOn">${_logo ? `<span class="hr-logo-tile"><img src="${_logo}" alt=""></span>` : ''}</span>
        <button type="button" class="hr-logo-btn" id="heLogoBtn">🖼️ ${_logo ? 'Değiştir' : 'Logo Seç'}</button>
      </div></div>`);
  }

  const govde = `<div class="hr-form">
    <div class="hr-grup">${satirlar.join('')}</div>
    ${logoDestek ? '<input type="file" id="heLogoDosya" accept="image/*" hidden>' : ''}
  </div>`;
  const kaydetEt = tip === 'kasa' ? '💾 Oluştur' : '💾 Kaydet';
  const alt = `<button class="btn" id="heIptal">İptal</button><button class="btn btn-ana hr-kaydet" id="heKaydet">${kaydetEt}</button>`;
  modalAc(mevcut ? bilgi.ad + ' Düzenle' : 'Yeni ' + bilgi.ad, govde, alt, `<span class="hr-rozet">${bilgi.ikon} ${kacar(bilgi.ad)}</span>`);

  if (logoDestek) {
    const dosya = $('#heLogoDosya');
    $('#heLogoBtn').onclick = () => dosya.click();
    dosya.onchange = () => { if (dosya.files[0]) bankaLogoIsle(dosya.files[0], (veri) => {
      _logo = veri;
      $('#heLogoOn').innerHTML = `<span class="hr-logo-tile"><img src="${veri}" alt=""></span>`;
      $('#heLogoBtn').textContent = '🖼️ Değiştir';
    }); };
  }

  $('#heIptal').onclick = modalKapat;
  $('#heKaydet').onclick = async () => {
    const ad = $('#heAd').value.trim();
    if (!ad) return bildir(bilgi.ad + ' adı girin.', 'hata');
    const veri = { ad, tip, aktif: true };
    if (tip === 'krediKarti') {
      veri.acilisBakiye = 0;
      veri.sonOdemeGunu = Math.min(31, Math.max(1, parseInt($('#heGun').value, 10) || 1));
    } else {
      veri.acilisBakiye = parseFloat($('#heAcilis').value) || 0;
    }
    if (logoDestek) veri.logoData = _logo || null;
    let hedefId;
    if (mevcut) { await DB.guncelle('hesaplar', mevcut.id, veri); Object.assign(mevcut, veri); hedefId = mevcut.id; }
    else { const y = await DB.ekle('hesaplar', veri); State.hesaplar.push(y); hedefId = y.id; }
    _ekstreSecili[tip] = hedefId;
    modalKapat();
    bildir(mevcut ? 'Güncellendi.' : bilgi.ad + ' eklendi.', 'basari');
    ekstreSayfasi(tip);
  };
}

/* (eski tablo görünümü — artık kullanılmıyor, ekstreSayfasi devraldı) */
function bankalarSayfasi() {
  const bankalar = State.hesaplar.filter(h => h.tip === 'banka');
  // Seçili banka artık yoksa seçimi temizle
  if (_bankaSecili && !bankalar.some(b => b.id === _bankaSecili)) _bankaSecili = null;

  if (!bankalar.length) {
    ic().innerHTML = `
      <div class="bilgi-kutu"><span class="ikon">🏦</span><div>Banka hareketlerini görmek için önce banka eklemelisiniz.</div></div>
      <div class="kart"><div class="banka-bos">
        <div class="el">🏦</div>
        <p>Henüz banka yok.</p>
        <button class="btn btn-ana" id="bankaAyarGit" style="margin-top:12px">⚙️ Banka Ayarları'na git</button>
      </div></div>`;
    $('#bankaAyarGit').onclick = () => git('ayar-banka');
    return;
  }

  const serit = bankalar.map(h => `
    <button type="button" class="blogo ${h.id === _bankaSecili ? 'sec' : ''}" data-banka="${h.id}">
      ${bankaTileHTML(h)}
      <span class="ad">${kacar(h.ad)}</span>
    </button>`).join('');

  const secili = bankalar.find(b => b.id === _bankaSecili);
  let govde;
  if (!secili) {
    govde = `<div class="banka-bos">
      <div class="el">👆</div>
      <p>Hareketleri görmek için yukarıdan bir <b>banka seçin</b>.</p>
    </div>`;
  } else {
    // Bu bankaya ait hareketler — kronolojik (eski → yeni), yürüyen bakiye için
    const hareketler = State.islemler
      .filter(i => i.odemeHesabiId === secili.id || i.karsiHesapId === secili.id)
      .slice()
      .sort((a, b) => (a.tarih || '').localeCompare(b.tarih || '') || (Number(a.kayitNo) || 0) - (Number(b.kayitNo) || 0));

    let bakiye = Number(secili.acilisBakiye) || 0;
    let topGiren = 0, topCikan = 0;
    // Her hareket için satır verisini bir kez hesapla (tablo + mobil kart aynı veriden)
    const rows = hareketler.map(i => {
      const girenMi = (i.tip === 'gelir') || (i.tip === 'transfer' && i.karsiHesapId === secili.id);
      const tutar = Number(i.tutar) || 0;
      let giren = 0, cikan = 0;
      if (girenMi) { giren = tutar; bakiye += tutar; topGiren += tutar; }
      else { cikan = tutar; bakiye -= tutar; topCikan += tutar; }
      const kat = State.hesaplar.find(h => h.id === i.kategoriId);
      const gelirAd = i.tip === 'gelir' ? (kat ? kacar(kat.ad) : '—') : (i.tip === 'transfer' && girenMi ? 'Transfer (gelen)' : '');
      const giderAd = i.tip === 'gider' ? (kat ? kacar(kat.ad) : '—') : (i.tip === 'ortakOdeme' ? 'Ortak Ödeme' : (i.tip === 'transfer' && !girenMi ? 'Transfer (giden)' : ''));
      const katEtk = girenMi ? (gelirAd || '—') : (giderAd || '—');
      return { i, girenMi, giren, cikan, gelirAd, giderAd, katEtk, bakiye };
    });

    const satirlar = rows.map(r => `
      <tr data-hareket="${r.i.id}" style="cursor:pointer">
        <td><span class="kno">#${r.i.kayitNo || '—'}</span></td>
        <td>${kacar(r.i.aciklama || '—')}</td>
        <td>${r.gelirAd ? `<span class="kat-etk">${r.gelirAd}</span>` : '<span class="soluk">—</span>'}</td>
        <td>${r.giderAd ? `<span class="kat-etk">${r.giderAd}</span>` : '<span class="soluk">—</span>'}</td>
        <td class="sag num ${r.giren ? 'pozitif' : 'soluk'}">${r.giren ? '+' + TL(r.giren) : '—'}</td>
        <td class="sag num ${r.cikan ? 'negatif' : 'soluk'}">${r.cikan ? '−' + TL(r.cikan) : '—'}</td>
        <td class="sag bakiye-hucre">${TL(r.bakiye)}</td>
      </tr>`).join('');

    const kartlar = rows.map(r => `
      <div class="hareket-kart" data-hareket="${r.i.id}">
        <div class="hk-ust"><span class="kno">#${r.i.kayitNo || '—'}</span><span class="hk-ack">${kacar(r.i.aciklama || '—')}</span></div>
        <div class="hk-alt"><span class="hk-kat">${r.girenMi ? 'Gelir' : 'Gider'} · ${r.katEtk}</span>
          <span class="num ${r.girenMi ? 'pozitif' : 'negatif'}">${r.girenMi ? '+' : '−'}${TL(r.girenMi ? r.giren : r.cikan)}</span></div>
        <div class="hk-alt"><span class="hk-kat">Güncel Bakiye</span><span class="bakiye-hucre">${TL(r.bakiye)}</span></div>
      </div>`).join('');

    govde = `
      <div class="banka-arac">
        <h3>${bankaTileHTML(secili, 30)} <span>${kacar(secili.ad)} — Hareketler</span></h3>
        <button class="btn btn-ana" id="yeniHareket">＋ Yeni Hareket</button>
      </div>
      ${hareketler.length === 0
        ? `<div class="kart">${bosBlok('Bu bankada henüz hareket yok. “＋ Yeni Hareket” ile ekleyin.')}</div>`
        : `<div class="kart banka-tablo-kart" style="padding:0;overflow:hidden">
            <div class="tablo-sar"><table class="tablo banka-tablo">
              <thead><tr>
                <th>Kayıt No</th><th>Açıklama</th><th>Gelir Adı</th><th>Gider Adı</th>
                <th class="sag">Giren Tutar</th><th class="sag">Çıkan Tutar</th><th class="sag">Güncel Bakiye</th>
              </tr></thead>
              <tbody>${satirlar}</tbody>
              <tfoot><tr>
                <td colspan="4">TOPLAM</td>
                <td class="sag pozitif">+${TL(topGiren)}</td>
                <td class="sag negatif">−${TL(topCikan)}</td>
                <td class="sag"><b>${TL(bakiye)}</b></td>
              </tr></tfoot>
            </table></div>
          </div>
          <div class="banka-kartlar">${kartlar}
            <div class="hareket-kart hk-toplam">
              <div class="hk-alt"><span class="hk-kat">Giren</span><span class="pozitif">+${TL(topGiren)}</span></div>
              <div class="hk-alt"><span class="hk-kat">Çıkan</span><span class="negatif">−${TL(topCikan)}</span></div>
              <div class="hk-alt"><span class="hk-kat"><b>Güncel Bakiye</b></span><span class="bakiye-hucre">${TL(bakiye)}</span></div>
            </div>
          </div>`}
      <p class="banka-not">💡 <b>Kayıt No</b> her harekette benzersizdir ve tüm hesaplarda ortaktır. Bir hareketi buradan düzenleyince ilgili gelir/gider hesabında da güncellenir.</p>`;
  }

  ic().innerHTML = `<div class="banka-serit">${serit}</div>${govde}`;

  $$('[data-banka]').forEach(b => b.onclick = () => { _bankaSecili = b.dataset.banka; bankalarSayfasi(); });
  if ($('#yeniHareket')) $('#yeniHareket').onclick = () => bankaHareketFormu(_bankaSecili);
  $$('[data-hareket]').forEach(r => r.onclick = () => bankaHareketFormu(_bankaSecili, State.islemler.find(i => i.id === r.dataset.hareket)));
}

/* Yeni gelir/gider kalemi eklemek için üstte açılan küçük form (ana modalı kapatmaz) */
function yeniKalemModal(tur, sonra) {
  const ad = tur === 'gelir' ? 'Gelir' : 'Gider';
  const ornek = tur === 'gelir' ? 'Ders Geliri' : 'Kira';
  const kap = document.createElement('div');
  kap.className = 'modal-perde modal-ust-kat';
  kap.innerHTML = `
    <div class="modal modal-dar" role="dialog">
      <div class="modal-ust"><h3>Yeni ${ad} Kalemi</h3>
        <span class="hr-rozet">${tur === 'gelir' ? '📈' : '📉'} ${ad}</span>
        <button class="modal-kapat" type="button">×</button></div>
      <div class="modal-govde"><div class="hr-form">
        <div class="hr-grup"><div class="hr-satir"><label for="ykAdInp">${ad} Adı</label>
          <input type="text" id="ykAdInp" placeholder="Örn. ${ornek}"></div></div>
      </div></div>
      <div class="modal-alt">
        <button class="btn" type="button" data-iptal>İptal</button>
        <button class="btn btn-ana hr-kaydet" type="button" data-kaydet>💾 Ekle</button>
      </div>
    </div>`;
  document.body.appendChild(kap);
  const kapat = () => kap.remove();
  const inp = kap.querySelector('#ykAdInp');
  setTimeout(() => inp.focus(), 50);
  kap.querySelector('.modal-kapat').onclick = kapat;
  kap.querySelector('[data-iptal]').onclick = kapat;
  kap.onclick = (e) => { if (e.target === kap) kapat(); };
  const kaydet = async () => {
    const v = inp.value.trim();
    if (!v) return bildir(ad + ' adı girin.', 'hata');
    const yk = await DB.ekle('hesaplar', { ad: v, tip: tur, aktif: true });
    State.hesaplar.push(yk);
    kapat();
    bildir(ad + ' kalemi eklendi.', 'basari');
    if (sonra) sonra(yk);
  };
  kap.querySelector('[data-kaydet]').onclick = kaydet;
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') kaydet(); });
}

/* Banka hareketi ekle / düzenle — muhasebe bilmeyen için basit: Giriş mi Çıkış mı */
function bankaHareketFormu(bankaId, mevcut) {
  const banka = State.hesaplar.find(h => h.id === bankaId);
  if (!banka) return;
  const gelirKalem = State.hesaplar.filter(h => h.tip === 'gelir');
  const giderKalem = State.hesaplar.filter(h => h.tip === 'gider');
  // Düzenlemede yön: gelir → giriş, diğer (gider/ortakOdeme) → çıkış
  const baslangicYon = mevcut ? (mevcut.tip === 'gelir' ? 'giris' : 'cikis') : 'giris';

  const kalemSecenek = (liste, secili) =>
    `<option value="">— Kalem seç —</option>`
    + liste.map(h => `<option value="${h.id}" ${secili === h.id ? 'selected' : ''}>${kacar(h.ad)}</option>`).join('')
    + `<option value="__yeni">➕ Yeni kalem ekle…</option>`;

  const govde = `
    <div class="hr-form">
      <div class="yon-secim">
        <button type="button" class="yon-btn ${baslangicYon === 'giris' ? 'sec' : ''}" data-yon="giris">⬇️ Para Girdi<small>Gelir / Tahsilat</small></button>
        <button type="button" class="yon-btn ${baslangicYon === 'cikis' ? 'sec' : ''}" data-yon="cikis">⬆️ Para Çıktı<small>Gider / Ödeme</small></button>
      </div>
      <div class="hr-tutar ${baslangicYon === 'cikis' ? 'cikis' : ''}" id="hrTutarKutu">
        <label for="hrTutar">Tutar</label>
        <input type="text" id="hrTutar" inputmode="decimal" autocomplete="off" placeholder="0,00 ₺">
      </div>
      <div class="hr-grup">
        <div class="hr-satir hr-tarih-satir"><label>Tarih</label><span class="hr-deger" id="hrTarihGos">${fmtTarihUzun(mevcut ? mevcut.tarih : '')}</span><input type="date" id="hrTarih" aria-label="Tarih" value="${mevcut ? (mevcut.tarih || bugunISO()).slice(0,10) : bugunISO()}"></div>
        <div class="hr-satir sel" id="hrKalemKap"><label id="hrKalemEt" for="hrKalem">Gelir Adı</label><select id="hrKalem"></select></div>
        <div class="hr-satir"><label for="hrAciklama">Açıklama</label><input type="text" id="hrAciklama" value="${mevcut ? kacar(mevcut.aciklama || '') : ''}" placeholder="Örn. Ocak ders geliri"></div>
      </div>
    </div>`;

  const alt = `${mevcut ? '<button class="btn btn-kirmizi" id="hrSil" style="margin-right:auto">🗑️ Sil</button>' : ''}
    <button class="btn" id="hrIptal">İptal</button><button class="btn btn-ana hr-kaydet" id="hrKaydet">💾 Kaydet</button>`;
  modalAc(mevcut ? 'Hareketi Düzenle' : 'Yeni Hareket', govde, alt, `<span class="hr-rozet">🏦 ${kacar(banka.ad)}</span>`);

  let yon = baslangicYon, _sonKalem = '';
  const kalemDoldur = (seciliId) => {
    const et = $('#hrKalemEt'), sel = $('#hrKalem');
    const liste = State.hesaplar.filter(h => h.tip === (yon === 'giris' ? 'gelir' : 'gider'));
    et.textContent = yon === 'giris' ? 'Gelir Adı' : 'Gider Adı';
    const secDef = seciliId || (mevcut && ((yon === 'giris') === (mevcut.tip === 'gelir')) ? mevcut.kategoriId : null);
    sel.innerHTML = kalemSecenek(liste, secDef);
    // Yeni harekette "— Kalem seç —" ile başla (ilk kalem otomatik seçilmesin)
    sel.value = (secDef && liste.some(h => h.id === secDef)) ? secDef : '';
    _sonKalem = sel.value;
  };
  const yonSec = (y) => {
    yon = y;
    $$('.yon-btn').forEach(b => b.classList.toggle('sec', b.dataset.yon === y));
    $('#hrTutarKutu').classList.toggle('cikis', y === 'cikis');
    kalemDoldur();
  };
  $$('.yon-btn').forEach(b => b.onclick = () => yonSec(b.dataset.yon));
  $('#hrKalem').onchange = () => {
    const v = $('#hrKalem').value;
    if (v === '__yeni') {
      $('#hrKalem').value = _sonKalem || '';   // iptal edilirse '__yeni'de takılı kalmasın
      yeniKalemModal(yon === 'giris' ? 'gelir' : 'gider', (yk) => kalemDoldur(yk.id));
    } else { _sonKalem = v; }
  };
  kalemDoldur();
  tutarKutusuBagla($('#hrTutar'), mevcut ? mevcut.tutar : '');
  tarihGostergeBagla();

  $('#hrIptal').onclick = modalKapat;
  if ($('#hrSil')) $('#hrSil').onclick = () => {
    modalKapat();
    onayModal('Hareket silinsin mi?', `Kayıt No <b>#${mevcut.kayitNo || '—'}</b> — “${kacar(mevcut.aciklama || '')}” silinecek.`, async () => {
      await DB.sil('islemler', mevcut.id);
      State.islemler = State.islemler.filter(x => x.id !== mevcut.id);
      bildir('Hareket silindi.', 'basari'); ekstreSayfasi(banka.tip);
    });
  };
  $('#hrKaydet').onclick = async () => {
    const tutar = tutarSayi($('#hrTutar').value);
    if (!tutar || tutar <= 0) return bildir('Geçerli bir tutar girin.', 'hata');
    let katId = $('#hrKalem').value;
    if (katId === '__yeni') return yeniKalemModal(yon === 'giris' ? 'gelir' : 'gider', (yk) => kalemDoldur(yk.id));
    if (!katId) {
      const liste = State.hesaplar.filter(h => h.tip === (yon === 'giris' ? 'gelir' : 'gider'));
      if (!liste.length) return yeniKalemModal(yon === 'giris' ? 'gelir' : 'gider', (yk) => kalemDoldur(yk.id));
      return bildir(yon === 'giris' ? 'Bir gelir kalemi seçin.' : 'Bir gider kalemi seçin.', 'hata');
    }
    const veri = {
      tarih: $('#hrTarih').value, tutar,
      tip: yon === 'giris' ? 'gelir' : 'gider',
      odemeHesabiId: banka.id, kategoriId: katId,
      aciklama: $('#hrAciklama').value.trim(), kaynak: 'banka',
    };
    if (mevcut) {
      await DB.guncelle('islemler', mevcut.id, veri);
      Object.assign(mevcut, veri);
      bildir('Hareket güncellendi.', 'basari');
    } else {
      veri.kayitNo = sonrakiKayitNo();
      const y = await DB.ekle('islemler', veri);
      State.islemler.unshift(y);
      bildir('Hareket eklendi.', 'basari');
    }
    modalKapat(); ekstreSayfasi(banka.tip);
  };
}

/* hesap-kasa artık ekstreSayfasi('kasa') ile yukarıda tanımlı */
/* ===================== KREDİ KARTI yardımcıları (ekstre ortak görünümü kullanır) ===================== */
let _kartSecili = null;

function sonOdemeMetni(gun) {
  gun = parseInt(gun, 10);
  return (gun >= 1 && gun <= 31) ? `her ayın ${gun}. günü` : 'belirtilmedi';
}
function kartBorc(id) { return -Hesapla.paraHesapBakiye(id); }   // bakiye negatif = borç

function kartTileHTML(h, mini) {
  if (h.logoData) return `<div class="kart-tile ${mini ? 'mini' : ''}"><img src="${h.logoData}" alt="${kacar(h.ad)}"></div>`;
  const t = renkTon(h.ad);
  return `<div class="kart-tile ${mini ? 'mini' : ''}" style="background:linear-gradient(135deg,hsl(${t} 42% 50%),hsl(${t} 45% 32%))">
    <span class="chip"></span>${mini ? '' : `<span class="n">${kacar(h.ad)}</span>`}</div>`;
}

/* hesap-kk artık ekstreSayfasi('krediKarti') ile yukarıda tanımlı */
/* (eski kart tablo görünümü — artık kullanılmıyor) */
function krediKartlariSayfasi() {
  const kartlar = State.hesaplar.filter(h => h.tip === 'krediKarti');
  if (_kartSecili && !kartlar.some(k => k.id === _kartSecili)) _kartSecili = null;

  if (!kartlar.length) {
    ic().innerHTML = `
      <div class="bilgi-kutu"><span class="ikon">💳</span><div>Kart hareketlerini görmek için önce kredi kartı eklemelisiniz.</div></div>
      <div class="kart"><div class="banka-bos">
        <div class="el">💳</div><p>Henüz kredi kartı yok.</p>
        <button class="btn btn-ana" id="kkAyarGit" style="margin-top:12px">⚙️ Kredi Kartı Ayarları'na git</button>
      </div></div>`;
    $('#kkAyarGit').onclick = () => git('ayar-kk');
    return;
  }

  const serit = kartlar.map(h => `
    <button type="button" class="klogo ${h.id === _kartSecili ? 'sec' : ''}" data-kart="${h.id}">
      ${kartTileHTML(h)}
      <span class="ad">${kacar(h.ad)}</span>
      <span class="sd">${sonOdemeMetni(h.sonOdemeGunu)}</span>
    </button>`).join('');

  const secili = kartlar.find(k => k.id === _kartSecili);
  let govde;
  if (!secili) {
    govde = `<div class="banka-bos"><div class="el">👆</div><p>Hareketleri görmek için yukarıdan bir <b>kart seçin</b>.</p></div>`;
  } else {
    const hareketler = State.islemler
      .filter(i => i.odemeHesabiId === secili.id || i.karsiHesapId === secili.id)
      .slice()
      .sort((a, b) => (a.tarih || '').localeCompare(b.tarih || '') || (Number(a.kayitNo) || 0) - (Number(b.kayitNo) || 0));

    let borc = 0, topHarc = 0, topOde = 0;
    const rows = hareketler.map(i => {
      const odemeMi = (i.tip === 'transfer' && i.karsiHesapId === secili.id);   // borç ödeme
      const tutar = Number(i.tutar) || 0;
      let harc = 0, ode = 0, tarihGoster = '';
      if (odemeMi) { ode = tutar; borc -= tutar; topOde += tutar; tarihGoster = fmtTarih(i.tarih); }
      else { harc = tutar; borc += tutar; topHarc += tutar; }   // harcama (gider)
      const kat = State.hesaplar.find(h => h.id === i.kategoriId);
      const giderAd = odemeMi ? '' : (kat ? kacar(kat.ad) : '—');
      return { i, odemeMi, harc, ode, giderAd, borc, tarihGoster };
    });

    const satirlar = rows.map(r => `
      <tr data-hareket="${r.i.id}" style="cursor:pointer">
        <td><span class="kno">#${r.i.kayitNo || '—'}</span></td>
        <td>${kacar(r.i.aciklama || '—')}</td>
        <td>${r.giderAd ? `<span class="kat-etk">${r.giderAd}</span>` : '<span class="soluk">—</span>'}</td>
        <td class="sag num ${r.harc ? 'negatif' : 'soluk'}">${r.harc ? '−' + TL(r.harc) : '—'}</td>
        <td class="sag num ${r.ode ? 'pozitif' : 'soluk'}">${r.ode ? '+' + TL(r.ode) : '—'}</td>
        <td class="sag borc-hucre ${r.borc <= 0 ? 'sifir' : ''}">${TL(r.borc)}</td>
        <td class="tar">${r.tarihGoster || '<span class="soluk">—</span>'}</td>
      </tr>`).join('');

    const kartlarHTML = rows.map(r => `
      <div class="hareket-kart" data-hareket="${r.i.id}">
        <div class="hk-ust"><span class="kno">#${r.i.kayitNo || '—'}</span><span class="hk-ack">${kacar(r.i.aciklama || '—')}</span></div>
        <div class="hk-alt"><span class="hk-kat">${r.odemeMi ? 'Ödeme · ' + r.tarihGoster : 'Harcama · ' + (r.giderAd || '—')}</span>
          <span class="num ${r.odemeMi ? 'pozitif' : 'negatif'}">${r.odemeMi ? '+' + TL(r.ode) : '−' + TL(r.harc)}</span></div>
        <div class="hk-alt"><span class="hk-kat">Güncel Borç</span><span class="borc-hucre ${r.borc <= 0 ? 'sifir' : ''}">${TL(r.borc)}</span></div>
      </div>`).join('');

    govde = `
      <div class="banka-arac">
        <h3>${kartTileHTML(secili, true)} <span>${kacar(secili.ad)} — Hareketler</span></h3>
        <button class="btn btn-ana" id="yeniHareket">＋ Yeni Hareket</button>
      </div>
      <p class="banka-not" style="margin:-6px 2px 14px">Son ödeme günü: <b>${sonOdemeMetni(secili.sonOdemeGunu)}</b> · Güncel borç: <b class="${borc>0?'negatif':'pozitif'}">${TL(borc)}</b></p>
      ${hareketler.length === 0
        ? `<div class="kart">${bosBlok('Bu kartta henüz hareket yok. “＋ Yeni Hareket” ile ekleyin.')}</div>`
        : `<div class="kart banka-tablo-kart" style="padding:0;overflow:hidden">
            <div class="tablo-sar"><table class="tablo banka-tablo">
              <thead><tr>
                <th>Kayıt No</th><th>Açıklama</th><th>Gider Adı</th>
                <th class="sag">Harcama Tutarı</th><th class="sag">Ödeme Tutarı</th><th class="sag">Güncel Borç</th><th>Borç Ödeme Tarihi</th>
              </tr></thead>
              <tbody>${satirlar}</tbody>
              <tfoot><tr>
                <td colspan="3">TOPLAM</td>
                <td class="sag negatif">−${TL(topHarc)}</td>
                <td class="sag pozitif">+${TL(topOde)}</td>
                <td class="sag borc-hucre ${borc<=0?'sifir':''}"><b>${TL(borc)}</b></td><td></td>
              </tr></tfoot>
            </table></div>
          </div>
          <div class="banka-kartlar">${kartlarHTML}
            <div class="hareket-kart hk-toplam">
              <div class="hk-alt"><span class="hk-kat">Harcama</span><span class="negatif">−${TL(topHarc)}</span></div>
              <div class="hk-alt"><span class="hk-kat">Ödeme</span><span class="pozitif">+${TL(topOde)}</span></div>
              <div class="hk-alt"><span class="hk-kat"><b>Güncel Borç</b></span><span class="borc-hucre ${borc<=0?'sifir':''}">${TL(borc)}</span></div>
            </div>
          </div>`}
      <p class="banka-not">💡 <b>Güncel Borç</b> = harcamalar − ödemeler. Harcamalar aynı anda ilgili <b>gider hesabında</b> da görünür; borç ödemesi seçtiğin banka/kasadan düşer.</p>`;
  }

  ic().innerHTML = `<div class="banka-serit kart-serit">${serit}</div>${govde}`;
  $$('[data-kart]').forEach(b => b.onclick = () => { _kartSecili = b.dataset.kart; krediKartlariSayfasi(); });
  if ($('#yeniHareket')) $('#yeniHareket').onclick = () => kartHareketFormu(_kartSecili);
  $$('[data-hareket]').forEach(r => r.onclick = () => kartHareketFormu(_kartSecili, State.islemler.find(i => i.id === r.dataset.hareket)));
}

/* Kredi kartı hareketi ekle/düzenle — Harcama (gider) veya Borç Ödeme (banka/kasadan transfer) */
function kartHareketFormu(kartId, mevcut) {
  const kart = State.hesaplar.find(h => h.id === kartId);
  if (!kart) return;
  const giderKalem = State.hesaplar.filter(h => h.tip === 'gider');
  const kaynakHesaplar = State.hesaplar.filter(h => (h.tip === 'banka' || h.tip === 'kasa'));
  const baslangicMod = mevcut ? (mevcut.tip === 'transfer' ? 'odeme' : 'harcama') : 'harcama';

  const kalemSecenek = (secili) =>
    `<option value="">— Kalem seç —</option>`
    + State.hesaplar.filter(h => h.tip === 'gider').map(h => `<option value="${h.id}" ${secili === h.id ? 'selected' : ''}>${kacar(h.ad)}</option>`).join('')
    + `<option value="__yeni">➕ Yeni gider kalemi ekle…</option>`;
  const kaynakSecenek = (secili) => kaynakHesaplar.length
    ? kaynakHesaplar.map(h => `<option value="${h.id}" ${secili === h.id ? 'selected' : ''}>${HESAP_TIPLERI[h.tip].ikon} ${kacar(h.ad)}</option>`).join('')
    : `<option value="">— banka/kasa yok, önce ekleyin —</option>`;

  const govde = `
    <div class="hr-form">
      <div class="yon-secim">
        <button type="button" class="yon-btn kart-harc ${baslangicMod === 'harcama' ? 'sec' : ''}" data-mod="harcama">🛒 Kart Harcaması<small>borcu artırır</small></button>
        <button type="button" class="yon-btn kart-ode ${baslangicMod === 'odeme' ? 'sec' : ''}" data-mod="odeme">💳 Borç Ödeme<small>borcu azaltır</small></button>
      </div>
      <div class="hr-tutar ${baslangicMod === 'harcama' ? 'cikis' : ''}" id="hrTutarKutu">
        <label for="hrTutar">Tutar</label>
        <input type="text" id="hrTutar" inputmode="decimal" autocomplete="off" placeholder="0,00 ₺">
      </div>
      <div class="hr-grup">
        <div class="hr-satir sel" id="hrGiderKap"><label for="hrGider">Gider Adı</label><select id="hrGider"></select></div>
        <div class="hr-satir sel" id="hrKaynakKap" style="display:none"><label for="hrKaynak">Ödeme Kaynağı</label><select id="hrKaynak">${kaynakSecenek(mevcut && mevcut.tip === 'transfer' ? mevcut.odemeHesabiId : null)}</select></div>
        <div class="hr-satir hr-tarih-satir"><label id="hrTarihEt">Tarih</label><span class="hr-deger" id="hrTarihGos">${fmtTarihUzun(mevcut ? mevcut.tarih : '')}</span><input type="date" id="hrTarih" aria-label="Tarih" value="${mevcut ? (mevcut.tarih || bugunISO()).slice(0,10) : bugunISO()}"></div>
        <div class="hr-satir"><label for="hrAciklama">Açıklama</label><input type="text" id="hrAciklama" value="${mevcut ? kacar(mevcut.aciklama || '') : ''}" placeholder="Örn. Mat ve ekipman"></div>
      </div>
    </div>`;

  const alt = `${mevcut ? '<button class="btn btn-kirmizi" id="hrSil" style="margin-right:auto">🗑️ Sil</button>' : ''}
    <button class="btn" id="hrIptal">İptal</button><button class="btn btn-ana hr-kaydet" id="hrKaydet">💾 Kaydet</button>`;
  modalAc(mevcut ? 'Kart Hareketi Düzenle' : 'Yeni Kart Hareketi', govde, alt, `<span class="hr-rozet">💳 ${kacar(kart.ad)}</span>`);

  let mod = baslangicMod, _sonKalem = '';
  const modUygula = (seciliId) => {
    $$('.yon-btn').forEach(b => b.classList.toggle('sec', b.dataset.mod === mod));
    $('#hrGiderKap').style.display = mod === 'harcama' ? '' : 'none';
    $('#hrKaynakKap').style.display = mod === 'odeme' ? '' : 'none';
    $('#hrTarihEt').textContent = mod === 'odeme' ? 'Borç Ödeme Tarihi' : 'Tarih';
    $('#hrTutarKutu').classList.toggle('cikis', mod === 'harcama');
    if (mod === 'harcama') {
      const sel = $('#hrGider');
      const gider = State.hesaplar.filter(h => h.tip === 'gider');
      const secDef = seciliId || (mevcut && mevcut.tip !== 'transfer' ? mevcut.kategoriId : null);
      sel.innerHTML = kalemSecenek(secDef);
      // Yeni harekette "— Kalem seç —" ile başla
      sel.value = (secDef && gider.some(h => h.id === secDef)) ? secDef : '';
      _sonKalem = sel.value;
    }
  };
  $$('.yon-btn').forEach(b => b.onclick = () => { mod = b.dataset.mod; modUygula(); });
  $('#hrGider').onchange = () => {
    const v = $('#hrGider').value;
    if (v === '__yeni') {
      $('#hrGider').value = _sonKalem || '';   // iptal edilirse '__yeni'de takılı kalmasın
      yeniKalemModal('gider', (yk) => modUygula(yk.id));
    } else { _sonKalem = v; }
  };
  modUygula();
  tutarKutusuBagla($('#hrTutar'), mevcut ? mevcut.tutar : '');
  tarihGostergeBagla();

  $('#hrIptal').onclick = modalKapat;
  if ($('#hrSil')) $('#hrSil').onclick = () => {
    modalKapat();
    onayModal('Hareket silinsin mi?', `Kayıt No <b>#${mevcut.kayitNo || '—'}</b> — “${kacar(mevcut.aciklama || '')}” silinecek.`, async () => {
      await DB.sil('islemler', mevcut.id);
      State.islemler = State.islemler.filter(x => x.id !== mevcut.id);
      bildir('Hareket silindi.', 'basari'); ekstreSayfasi('krediKarti');
    });
  };
  $('#hrKaydet').onclick = async () => {
    const tutar = tutarSayi($('#hrTutar').value);
    if (!tutar || tutar <= 0) return bildir('Geçerli bir tutar girin.', 'hata');
    const tarih = $('#hrTarih').value;
    const aciklama = $('#hrAciklama').value.trim();
    let veri;
    if (mod === 'harcama') {
      let katId = $('#hrGider').value;
      if (katId === '__yeni') return yeniKalemModal('gider', (yk) => modUygula(yk.id));
      if (!katId) {
        const gider = State.hesaplar.filter(h => h.tip === 'gider');
        if (!gider.length) return yeniKalemModal('gider', (yk) => modUygula(yk.id));
        return bildir('Bir gider kalemi seçin.', 'hata');
      }
      veri = { tarih, tutar, tip: 'gider', odemeHesabiId: kart.id, kategoriId: katId, aciklama, kaynak: 'krediKarti' };
    } else {
      const kaynakId = $('#hrKaynak').value;
      if (!kaynakId) return bildir('Ödeme kaynağı (banka/kasa) seçin.', 'hata');
      veri = { tarih, tutar, tip: 'transfer', odemeHesabiId: kaynakId, karsiHesapId: kart.id, aciklama: aciklama || 'Kart borcu ödemesi', kaynak: 'krediKarti' };
    }
    if (mevcut) {
      // Tür değiştiyse eski alanları temizle
      const temiz = { kategoriId: null, karsiHesapId: null };
      await DB.guncelle('islemler', mevcut.id, { ...temiz, ...veri });
      Object.assign(mevcut, temiz, veri);
      bildir('Hareket güncellendi.', 'basari');
    } else {
      veri.kayitNo = sonrakiKayitNo();
      const y = await DB.ekle('islemler', veri);
      State.islemler.unshift(y);
      bildir('Hareket eklendi.', 'basari');
    }
    modalKapat(); ekstreSayfasi('krediKarti');
  };
}
SAYFALAR['hesap-gider'] = (m) => hesapListesi('gider');
SAYFALAR['hesap-gelir'] = (m) => hesapListesi('gelir');
SAYFALAR['hesap-ortak'] = (m) => ortakHesabiSayfasi();

function hesapListesi(tip) {
  const bilgi = HESAP_TIPLERI[tip];
  const hesaplar = State.hesaplar.filter(h => h.tip === tip);
  const paraMi = bilgi.para;

  const satir = (h) => {
    let deger;
    if (paraMi) deger = Hesapla.paraHesapBakiye(h.id);
    else deger = Hesapla.kategoriToplam(h.id, null);
    const adet = State.islemler.filter(i => paraMi
      ? (i.odemeHesabiId === h.id || i.karsiHesapId === h.id)
      : i.kategoriId === h.id).length;
    return `<tr data-hesap="${h.id}" style="cursor:pointer">
      <td>${bilgi.ikon} ${kacar(h.ad)}</td>
      <td class="soluk">${adet} işlem</td>
      <td class="sag ${deger<0?'negatif':'mono'}">${TL(deger)}</td>
      <td class="sag">
        <button class="btn btn-kucuk btn-ikon" data-duzenle="${h.id}" title="Düzenle">✏️</button>
        <button class="btn btn-kucuk btn-ikon" data-sil="${h.id}" title="Sil">🗑️</button>
      </td></tr>`;
  };

  const toplam = paraMi
    ? hesaplar.reduce((s, h) => s + Hesapla.paraHesapBakiye(h.id), 0)
    : hesaplar.reduce((s, h) => s + Hesapla.kategoriToplam(h.id, null), 0);

  ic().innerHTML = `
    ${hesapGeriHTML()}
    <div class="kart-baslik" style="margin-bottom:16px">
      <div class="bilgi-kutu" style="margin:0;flex:1">
        <span class="ikon">${bilgi.ikon}</span>
        <div>${aciklamaHesap(tip)}</div>
      </div>
      <button class="btn btn-ana" id="yeniHesap" style="margin-left:14px">＋ Yeni ${bilgi.ad}</button>
    </div>
    <div class="kart">
      ${hesaplar.length === 0 ? bosBlok(`Henüz ${bilgi.ad.toLowerCase()} tanımlı değil.`) : `
      <div class="tablo-sar"><table class="tablo">
        <thead><tr><th>Ad</th><th>Hareket</th><th class="sag">${paraMi?'Bakiye':'Toplam'}</th><th class="sag">İşlem</th></tr></thead>
        <tbody>${hesaplar.map(satir).join('')}</tbody>
        <tfoot><tr style="font-weight:700"><td colspan="2">TOPLAM</td><td class="sag ${toplam<0?'negatif':''}">${TL(toplam)}</td><td></td></tr></tfoot>
      </table></div>`}
    </div>`;

  $('#yeniHesap').onclick = () => hesapFormu(tip);
  $$('[data-duzenle]').forEach(b => b.onclick = e => { e.stopPropagation(); hesapFormu(tip, State.hesaplar.find(h => h.id === b.dataset.duzenle)); });
  $$('[data-sil]').forEach(b => b.onclick = e => { e.stopPropagation(); hesapSil(b.dataset.sil); });
  $$('[data-hesap]').forEach(r => r.onclick = () => hesapHareketleri(r.dataset.hesap));
}

function aciklamaHesap(tip) {
  return {
    banka: 'Bankada yapılan tüm işlemler ve güncel bakiyeler burada tutulur.',
    kasa: 'Nakit kasada yapılan tüm işlemler ve bakiye burada izlenir.',
    krediKarti: 'Kredi kartı hesapları ve borç/harcama durumu buradan izlenir.',
    gider: 'Tüm gider kalemleri (kira, maaş, malzeme…) burada tanımlanır ve toplanır.',
    gelir: 'Tüm gelir kalemleri (ders, üyelik, satış…) burada tanımlanır ve toplanır.',
  }[tip] || '';
}

function hesapFormu(tip, mevcut) {
  const bilgi = HESAP_TIPLERI[tip];
  const govde = `
    <div class="form-alan"><label>${bilgi.ad} Adı</label>
      <input type="text" id="hAd" value="${mevcut?kacar(mevcut.ad):''}" placeholder="Örn. ${ornekAd(tip)}"></div>
    ${bilgi.para ? `<div class="form-alan"><label>Açılış Bakiyesi (₺)</label>
      <input type="number" id="hAcilis" step="0.01" value="${mevcut?mevcut.acilisBakiye||0:0}"></div>` : ''}
    ${tip === 'banka' ? `<div class="form-alan"><label>Banka / IBAN (opsiyonel)</label>
      <input type="text" id="hBanka" value="${mevcut?kacar(mevcut.banka||''):''}" placeholder="Örn. Ziraat · TR..."></div>` : ''}
  `;
  const alt = `<button class="btn" id="ffIptal">İptal</button><button class="btn btn-ana" id="ffKaydet">💾 Kaydet</button>`;
  modalAc(mevcut ? bilgi.ad + ' Düzenle' : 'Yeni ' + bilgi.ad, govde, alt);
  $('#ffIptal').onclick = modalKapat;
  $('#ffKaydet').onclick = async () => {
    const ad = $('#hAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, tip, aktif: true };
    if (bilgi.para) veri.acilisBakiye = parseFloat($('#hAcilis').value) || 0;
    if (tip === 'banka') veri.banka = $('#hBanka').value.trim();
    if (mevcut) { await DB.guncelle('hesaplar', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('hesaplar', veri); State.hesaplar.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); git(State.aktifSayfa);
  };
}
function ornekAd(tip) {
  return { banka:'Ziraat Bankası', kasa:'Merkez Kasa', krediKarti:'İş Bankası Kart',
    gider:'Kira', gelir:'Ders Geliri', ortak:'Ayşe Yılmaz' }[tip] || '';
}

async function hesapSil(id) {
  const h = State.hesaplar.find(x => x.id === id);
  const kullanim = State.islemler.filter(i => i.odemeHesabiId === id || i.karsiHesapId === id || i.kategoriId === id).length;
  onayModal(`“${h.ad}” silinsin mi?`,
    kullanim ? `⚠️ Bu hesaba bağlı <b>${kullanim}</b> işlem var. Hesabı silmek işlemleri sahipsiz bırakabilir.` : 'Bu işlem geri alınamaz.',
    async () => {
      await DB.sil('hesaplar', id);
      State.hesaplar = State.hesaplar.filter(x => x.id !== id);
      bildir('Silindi.', 'basari'); git(State.aktifSayfa);
    });
}

function hesapHareketleri(hesapId) {
  const h = State.hesaplar.find(x => x.id === hesapId);
  if (!h) return;
  const paraMi = HESAP_TIPLERI[h.tip].para;
  const hareketler = State.islemler.filter(i => paraMi
    ? (i.odemeHesabiId === hesapId || i.karsiHesapId === hesapId)
    : i.kategoriId === hesapId);
  const govde = `
    <div class="tablo-sar" style="max-height:400px;overflow:auto"><table class="tablo">
      <thead><tr><th>Tarih</th><th>Açıklama</th><th>Tür</th><th class="sag">Tutar</th></tr></thead>
      <tbody>${hareketler.length ? hareketler.map(i => {
        const gir = paraMi && (i.tip === 'gelir' || (i.tip === 'transfer' && i.karsiHesapId === hesapId));
        return `<tr>
          <td>${fmtTarih(i.tarih)}</td>
          <td>${kacar(i.aciklama || '—')}</td>
          <td><span class="rozet-etk rz-${i.tip==='gelir'?'gelir':i.tip==='gider'?'gider':'transfer'}">${islemTipAd(i)}</span></td>
          <td class="sag ${gir?'pozitif':'negatif'}">${paraMi?(gir?'+':'−'):''}${TL(i.tutar)}</td>
        </tr>`; }).join('') : `<tr><td colspan="4" class="orta soluk" style="padding:24px">Hareket yok.</td></tr>`}
      </tbody>
    </table></div>`;
  modalAc(`${HESAP_TIPLERI[h.tip].ikon} ${h.ad} — Hareketler`, govde, `<button class="btn" onclick="document.getElementById('modalKap').innerHTML=''">Kapat</button>`);
}
function islemTipAd(i) {
  return { gelir:'Gelir', gider:'Gider', transfer:'Transfer', ortakOdeme:'Ortak Ödeme' }[i.tip] || i.tip;
}

/* Ortaklar Hesabı — hak ediş vs ödenen */
function ortakHesabiSayfasi() {
  const ortaklar = State.ortaklar;
  // Toplam net kar (tüm dönemler) baz alınır
  const genelKar = Hesapla.donemOzet(null).netKar;
  const dagitim = Hesapla.karPayiDagitimi(genelKar);

  const satirlar = ortaklar.map(o => {
    const hak = (dagitim.find(d => d.ortakId === o.id) || {}).tutar || 0;
    const odenen = Hesapla.ortakOdenen(o.id, null);
    const kalan = hak - odenen;
    return `<tr>
      <td>🤝 ${kacar(o.ad)}</td>
      <td class="sag">%${sayi(o.payOrani)}</td>
      <td class="sag pozitif">${TL(hak)}</td>
      <td class="sag">${TL(odenen)}</td>
      <td class="sag ${kalan>=0?'pozitif':'negatif'}"><b>${TL(kalan)}</b></td>
      <td class="sag"><button class="btn btn-kucuk" data-ode="${o.id}">💸 Ödeme Yap</button></td>
    </tr>`;
  }).join('');

  ic().innerHTML = `
    ${hesapGeriHTML()}
    <div class="bilgi-kutu"><span class="ikon">🤝</span><div>Ortaklara ait <b>hak ediş</b> (net kâr × pay oranı) ile yapılan <b>ödemeler</b> ve kalan bakiye burada izlenir.</div></div>
    <div class="kart">
      <div class="kart-baslik"><h3>Ortaklar Hesabı</h3><span class="soluk">Genel net kâr: <b class="${genelKar>=0?'pozitif':'negatif'}">${TL(genelKar)}</b></span></div>
      ${ortaklar.length === 0 ? bosBlok('Ortak tanımlı değil. “Ortak Pay Oranı”ndan ekleyin.') : `
      <div class="tablo-sar"><table class="tablo">
        <thead><tr><th>Ortak</th><th class="sag">Pay</th><th class="sag">Hak Ediş</th><th class="sag">Ödenen</th><th class="sag">Kalan</th><th class="sag">İşlem</th></tr></thead>
        <tbody>${satirlar}</tbody>
      </table></div>`}
    </div>`;
  $$('[data-ode]').forEach(b => b.onclick = () => ortakOdemeFormu(b.dataset.ode));
}

function ortakOdemeFormu(ortakId) {
  const o = State.ortaklar.find(x => x.id === ortakId);
  const paraHesaplar = State.hesaplar.filter(h => HESAP_TIPLERI[h.tip].para && h.tip !== 'krediKarti');
  const govde = `
    <div class="bilgi-kutu"><span class="ikon">💸</span><div><b>${kacar(o.ad)}</b> ortağına kar payı ödemesi.</div></div>
    <div class="form-satir">
      <div class="form-alan"><label>Ödeme Hesabı</label>
        <select id="oHesap">${paraHesaplar.map(h=>`<option value="${h.id}">${HESAP_TIPLERI[h.tip].ikon} ${kacar(h.ad)}</option>`).join('') || '<option value="">— hesap yok —</option>'}</select></div>
      <div class="form-alan"><label>Tarih</label><input type="date" id="oTarih" value="${bugunISO()}"></div>
    </div>
    <div class="form-satir">
      <div class="form-alan"><label>Tutar (₺)</label><input type="number" id="oTutar" step="0.01" min="0"></div>
      <div class="form-alan"><label>Açıklama</label><input type="text" id="oAciklama" value="Kar payı ödemesi"></div>
    </div>`;
  modalAc('Ortak Ödemesi', govde, `<button class="btn" id="oIptal">İptal</button><button class="btn btn-ana" id="oKaydet">💾 Kaydet</button>`);
  $('#oIptal').onclick = modalKapat;
  $('#oKaydet').onclick = async () => {
    const tutar = parseFloat($('#oTutar').value);
    const hesapId = $('#oHesap').value;
    if (!tutar || tutar <= 0) return bildir('Tutar girin.', 'hata');
    if (!hesapId) return bildir('Hesap seçin.', 'hata');
    const y = await DB.ekle('islemler', {
      tarih: $('#oTarih').value, tutar, tip: 'ortakOdeme', odemeHesabiId: hesapId,
      ortakId, aciklama: $('#oAciklama').value.trim(), kaynak: 'manuel',
    });
    State.islemler.unshift(y);
    modalKapat(); bildir('Ödeme kaydedildi.', 'basari'); git('hesap-ortak');
  };
}

/* ==========================================================
   8) RAPORLAR
   ========================================================== */
function donemSecici(id, deger) {
  const aylar = sonAylar(13).reverse();
  return `<select id="${id}">
    <option value="tum">Tüm Zamanlar</option>
    ${aylar.map(d => `<option value="${d}" ${d===deger?'selected':''}>${donemAdi(d)}</option>`).join('')}
  </select>`;
}

SAYFALAR['rapor-karzarar'] = function () {
  const ciz = (donem) => {
    const d = donem === 'tum' ? null : donem;
    const gelirKalem = State.hesaplar.filter(h => h.tip === 'gelir').map(h => ({ ad: h.ad, t: Hesapla.kategoriToplam(h.id, d) })).filter(x => x.t !== 0);
    const giderKalem = State.hesaplar.filter(h => h.tip === 'gider').map(h => ({ ad: h.ad, t: Hesapla.kategoriToplam(h.id, d) })).filter(x => x.t !== 0);
    const oz = Hesapla.donemOzet(d);
    $('#raporGovde').innerHTML = `
      <div class="izgara izgara-3" style="margin-bottom:18px">
        <div class="kart ozet gelir"><div class="ikon-daire">📈</div><div class="etiket">Toplam Gelir</div><div class="deger pozitif">${TL(oz.gelir)}</div></div>
        <div class="kart ozet gider"><div class="ikon-daire">📉</div><div class="etiket">Toplam Gider</div><div class="deger negatif">${TL(oz.gider)}</div></div>
        <div class="kart ozet kar"><div class="ikon-daire">⚖️</div><div class="etiket">Net ${oz.netKar>=0?'Kâr':'Zarar'}</div><div class="deger ${oz.netKar>=0?'pozitif':'negatif'}">${TL(oz.netKar)}</div></div>
      </div>
      <div class="izgara izgara-2">
        <div class="kart"><div class="kart-baslik"><h3>Gelirler</h3></div>
          ${kalemTablo(gelirKalem, oz.gelir, 'pozitif')}</div>
        <div class="kart"><div class="kart-baslik"><h3>Giderler</h3></div>
          ${kalemTablo(giderKalem, oz.gider, 'negatif')}</div>
      </div>`;
  };
  raporIskele('Kar / Zarar Raporu', 'İşletmenin gelir ve giderlerinin karşılaştırması ve net kâr/zarar durumu.', ciz);
};

function kalemTablo(kalemler, toplam, sinif) {
  if (!kalemler.length) return bosBlok('Kayıt yok.');
  return `<div class="tablo-sar"><table class="tablo">
    <tbody>${kalemler.sort((a,b)=>b.t-a.t).map(k=>`<tr><td>${kacar(k.ad)}</td><td class="sag ${sinif}">${TL(k.t)}</td></tr>`).join('')}</tbody>
    <tfoot><tr style="font-weight:700"><td>TOPLAM</td><td class="sag ${sinif}">${TL(toplam)}</td></tr></tfoot>
  </table></div>`;
}

SAYFALAR['rapor-hakedis'] = function () {
  const ciz = (donem) => {
    const d = donem === 'tum' ? null : donem;
    const oz = Hesapla.donemOzet(d);
    const dagitim = Hesapla.karPayiDagitimi(oz.netKar);
    $('#raporGovde').innerHTML = `
      <div class="bilgi-kutu"><span class="ikon">🥧</span><div>Dağıtım = <b>Net Kâr (${TL(oz.netKar)})</b> × ortak pay oranı. Dönem: <b>${donem==='tum'?'Tüm Zamanlar':donemAdi(donem)}</b></div></div>
      <div class="kart">
        ${dagitim.length === 0 ? bosBlok('Ortak tanımlı değil.') : `
        <div class="tablo-sar"><table class="tablo">
          <thead><tr><th>Ortak</th><th class="sag">Pay Oranı</th><th class="sag">Hak Ediş</th><th class="sag">Ödenen (${donem==='tum'?'Tüm':'Dönem'})</th><th class="sag">Kalan</th></tr></thead>
          <tbody>${dagitim.map(dd => {
            const odenen = Hesapla.ortakOdenen(dd.ortakId, d);
            const kalan = dd.tutar - odenen;
            return `<tr><td>🤝 ${kacar(dd.ad)}</td><td class="sag">%${sayi(dd.oran)}</td>
              <td class="sag pozitif">${TL(dd.tutar)}</td><td class="sag">${TL(odenen)}</td>
              <td class="sag ${kalan>=0?'':'negatif'}">${TL(kalan)}</td></tr>`;
          }).join('')}</tbody>
          <tfoot><tr style="font-weight:700"><td>TOPLAM</td><td class="sag">%${sayi(dagitim.reduce((s,x)=>s+x.oran,0))}</td>
            <td class="sag ${oz.netKar>=0?'pozitif':'negatif'}">${TL(oz.netKar)}</td><td class="sag"></td><td class="sag"></td></tr></tfoot>
        </table></div>`}
      </div>`;
  };
  raporIskele('Ortak Hak Ediş Raporu', 'Net kâr üzerinden ortakların pay dağıtımı ve ödeme durumu.', ciz);
};

SAYFALAR['rapor-gelir'] = () => raporHareket('gelir', 'Gelirler Raporu', 'Tüm gelir hareketlerinin dökümü.');
SAYFALAR['rapor-gider'] = () => raporHareket('gider', 'Giderler Raporu', 'Tüm gider hareketlerinin dökümü.');

function raporHareket(tip, baslik, aciklama) {
  const ciz = (donem) => {
    const d = donem === 'tum' ? null : donem;
    const hareketler = State.islemler.filter(i => i.tip === tip && (!d || donemStr(i.tarih) === d));
    const toplam = hareketler.reduce((s, i) => s + (Number(i.tutar) || 0), 0);
    const hesapAd = (id) => (State.hesaplar.find(h => h.id === id) || {}).ad || '—';
    $('#raporGovde').innerHTML = `
      <div class="kart ozet ${tip}" style="max-width:320px;margin-bottom:18px">
        <div class="etiket">Toplam ${tip==='gelir'?'Gelir':'Gider'}</div>
        <div class="deger ${tip==='gelir'?'pozitif':'negatif'}">${TL(toplam)}</div>
        <div class="alt-bilgi">${hareketler.length} hareket</div>
      </div>
      <div class="kart">
        ${hareketler.length === 0 ? bosBlok('Kayıt yok.') : `
        <div class="tablo-sar"><table class="tablo">
          <thead><tr><th>Tarih</th><th>Açıklama</th><th>Kalem</th><th>Hesap</th><th>Kaynak</th><th class="sag">Tutar</th></tr></thead>
          <tbody>${hareketler.map(i => `<tr>
            <td>${fmtTarih(i.tarih)}</td><td>${kacar(i.aciklama||'—')}</td>
            <td>${kacar(hesapAd(i.kategoriId))}</td><td>${kacar(hesapAd(i.odemeHesabiId))}</td>
            <td><span class="rozet-etk rz-notr">${kacar(i.kaynak||'manuel')}</span></td>
            <td class="sag ${tip==='gelir'?'pozitif':'negatif'}">${TL(i.tutar)}</td></tr>`).join('')}</tbody>
          <tfoot><tr style="font-weight:700"><td colspan="5">TOPLAM</td><td class="sag ${tip==='gelir'?'pozitif':'negatif'}">${TL(toplam)}</td></tr></tfoot>
        </table></div>`}
      </div>`;
  };
  raporIskele(baslik, aciklama, ciz);
}

SAYFALAR['rapor-resmi'] = function () {
  const ciz = (donem) => {
    const d = donem === 'tum' ? null : donem;
    const oz = Hesapla.donemOzet(d);
    const gelirKalem = State.hesaplar.filter(h => h.tip === 'gelir').map(h => ({ ad: h.ad, t: Hesapla.kategoriToplam(h.id, d) })).filter(x => x.t);
    const giderKalem = State.hesaplar.filter(h => h.tip === 'gider').map(h => ({ ad: h.ad, t: Hesapla.kategoriToplam(h.id, d) })).filter(x => x.t);
    const nakit = State.hesaplar.filter(h => h.tip === 'banka' || h.tip === 'kasa').map(h => ({ ad: h.ad, b: Hesapla.paraHesapBakiye(h.id) }));
    $('#raporGovde').innerHTML = `
      <div class="bilgi-kutu uyari"><span class="ikon">🧾</span><div>Bu rapor <b>resmi muhasebe/mali müşavir</b> paylaşımı için özet veriler içerir. Dönem: <b>${donem==='tum'?'Tüm Zamanlar':donemAdi(donem)}</b></div></div>
      <div class="izgara izgara-2">
        <div class="kart"><div class="kart-baslik"><h3>Gelir Özeti</h3></div>${kalemTablo(gelirKalem, oz.gelir, 'pozitif')}</div>
        <div class="kart"><div class="kart-baslik"><h3>Gider Özeti</h3></div>${kalemTablo(giderKalem, oz.gider, 'negatif')}</div>
      </div>
      <div class="kart" style="margin-top:18px"><div class="kart-baslik"><h3>Dönem Sonucu</h3></div>
        <table class="tablo"><tbody>
          <tr><td>Toplam Gelir</td><td class="sag pozitif">${TL(oz.gelir)}</td></tr>
          <tr><td>Toplam Gider</td><td class="sag negatif">${TL(oz.gider)}</td></tr>
          <tr style="font-weight:700"><td>Net ${oz.netKar>=0?'Kâr':'Zarar'}</td><td class="sag ${oz.netKar>=0?'pozitif':'negatif'}">${TL(oz.netKar)}</td></tr>
        </tbody></table>
      </div>
      <div class="kart" style="margin-top:18px"><div class="kart-baslik"><h3>Nakit Durumu (Güncel)</h3></div>
        ${nakit.length ? `<table class="tablo"><tbody>${nakit.map(n=>`<tr><td>${kacar(n.ad)}</td><td class="sag">${TL(n.b)}</td></tr>`).join('')}
          <tr style="font-weight:700"><td>TOPLAM NAKİT</td><td class="sag">${TL(nakit.reduce((s,n)=>s+n.b,0))}</td></tr></tbody></table>` : bosBlok('Hesap yok.')}
      </div>`;
  };
  raporIskele('Resmi Muhasebe Raporu', 'Mali müşavir/resmi muhasebe için özet veriler.', ciz);
};

function raporIskele(baslik, aciklama, cizFn) {
  ic().innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">📄</span><div>${kacar(aciklama)}</div></div>
    <div class="filtre-cubuk">
      <div class="form-alan"><label>Dönem</label>${donemSecici('raporDonem', buAy())}</div>
      <button class="btn" id="yazdirBtn">🖨️ Yazdır / PDF</button>
    </div>
    <div id="raporGovde"></div>`;
  const uygula = () => cizFn($('#raporDonem').value);
  $('#raporDonem').onchange = uygula;
  $('#yazdirBtn').onclick = () => window.print();
  uygula();
}

/* ==========================================================
   9) AYARLAR
   ========================================================== */
SAYFALAR['ayar-pay'] = function () {
  const ortaklar = State.ortaklar;
  const toplamOran = ortaklar.reduce((s, o) => s + (Number(o.payOrani) || 0), 0);
  const renkler = ['#6f9a72', '#4a72a8', '#c99a2e', '#8b5cc7', '#c0483f', '#2f8f5b'];
  ic().innerHTML = `
    <div class="bilgi-kutu ${toplamOran===100?'':'uyari'}"><span class="ikon">🥧</span>
      <div>Ortakların pay oranları toplamı: <b>%${sayi(toplamOran)}</b>${toplamOran!==100?' — Dağıtımın doğru olması için toplam %100 olmalıdır.':' ✓'}</div></div>
    ${ortaklar.length ? `<div class="pay-cubuk" style="height:16px;margin-bottom:18px">
      ${ortaklar.map((o,i)=>`<span style="width:${(Number(o.payOrani)||0)}%;background:${renkler[i%renkler.length]}" title="${kacar(o.ad)} %${sayi(o.payOrani)}"></span>`).join('')}
    </div>` : ''}
    <div class="kart-baslik" style="margin-bottom:14px"><h3>Ortaklar</h3><button class="btn btn-ana" id="yeniOrtak">＋ Yeni Ortak</button></div>
    <div class="kart">
      ${ortaklar.length === 0 ? bosBlok('Henüz ortak eklenmedi.') : `
      <div class="tablo-sar"><table class="tablo">
        <thead><tr><th>Ad Soyad</th><th>İletişim</th><th class="sag">Pay Oranı</th><th class="sag">Durum</th><th class="sag">İşlem</th></tr></thead>
        <tbody>${ortaklar.map((o,i)=>`<tr>
          <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${renkler[i%renkler.length]};margin-right:7px"></span>${kacar(o.ad)}</td>
          <td class="soluk">${kacar(o.telefon||o.eposta||'—')}</td>
          <td class="sag"><b>%${sayi(o.payOrani)}</b></td>
          <td class="sag">${o.aktif!==false?'<span class="rozet-etk rz-gelir">Aktif</span>':'<span class="rozet-etk rz-notr">Pasif</span>'}</td>
          <td class="sag"><button class="btn btn-kucuk btn-ikon" data-duzenle="${o.id}">✏️</button>
            <button class="btn btn-kucuk btn-ikon" data-sil="${o.id}">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    </div>`;
  $('#yeniOrtak').onclick = () => ortakFormu();
  $$('[data-duzenle]').forEach(b => b.onclick = () => ortakFormu(ortaklar.find(o => o.id === b.dataset.duzenle)));
  $$('[data-sil]').forEach(b => b.onclick = () => onayModal('Ortak silinsin mi?', 'Bu işlem geri alınamaz.', async () => {
    await DB.sil('ortaklar', b.dataset.sil);
    State.ortaklar = State.ortaklar.filter(o => o.id !== b.dataset.sil);
    bildir('Silindi.', 'basari'); git('ayar-pay');
  }));
};

function ortakFormu(mevcut) {
  let fotoData = (mevcut && mevcut.foto) || null;
  const avatarIc = () => fotoData
    ? `<img src="${fotoData}" alt="" style="width:100%;height:100%;object-fit:cover">`
    : `<span style="font-size:26px">📷</span>`;
  const govde = `
    <div style="text-align:center;margin-bottom:16px">
      <div id="oFotoOnizle" title="Fotoğraf seç"
        style="width:88px;height:88px;border-radius:50%;margin:0 auto 9px;overflow:hidden;background:var(--yesil-acik);display:grid;place-items:center;color:var(--yesil-koyu);cursor:pointer;border:1px solid var(--kenar)">${avatarIc()}</div>
      <button type="button" class="btn btn-kucuk" id="oFotoBtn">📷 Fotoğraf Seç</button>
      <button type="button" class="btn btn-kucuk" id="oFotoSil" ${fotoData?'':'style="display:none"'}>Kaldır</button>
      <input type="file" id="oFotoDosya" accept="image/*" hidden>
    </div>
    <div class="form-alan"><label>Ad Soyad</label><input type="text" id="oAd" value="${mevcut?kacar(mevcut.ad):''}" placeholder="Örn. Ayşe Yılmaz"></div>
    <div class="form-satir">
      <div class="form-alan"><label>Ders Ücreti (₺ / ders)</label><input type="number" id="oUcret" step="0.01" min="0" value="${mevcut&&mevcut.dersUcreti?mevcut.dersUcreti:''}" placeholder="Örn. 300"></div>
      <div class="form-alan"><label>Pay Oranı (%)</label><input type="number" id="oPay" step="0.01" min="0" max="100" value="${mevcut?mevcut.payOrani:''}"></div>
    </div>
    <div class="form-satir">
      <div class="form-alan"><label>Telefon</label><input type="text" id="oTel" value="${mevcut?kacar(mevcut.telefon||''):''}"></div>
      <div class="form-alan"><label>Durum</label><select id="oAktif"><option value="1" ${!mevcut||mevcut.aktif!==false?'selected':''}>Aktif</option><option value="0" ${mevcut&&mevcut.aktif===false?'selected':''}>Pasif</option></select></div>
    </div>
    <div class="form-alan"><label>E-posta</label><input type="email" id="oEp" value="${mevcut?kacar(mevcut.eposta||''):''}"></div>`;
  modalAc(mevcut ? 'Ortak Düzenle' : 'Yeni Ortak', govde, `<button class="btn" id="oiIptal">İptal</button><button class="btn btn-ana" id="oiKaydet">💾 Kaydet</button>`);
  const sec = () => $('#oFotoDosya').click();
  $('#oFotoBtn').onclick = sec; $('#oFotoOnizle').onclick = sec;
  $('#oFotoSil').onclick = () => { fotoData = null; $('#oFotoOnizle').innerHTML = avatarIc(); $('#oFotoSil').style.display = 'none'; };
  $('#oFotoDosya').onchange = () => {
    const f = $('#oFotoDosya').files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const S = 160, c = document.createElement('canvas'); c.width = S; c.height = S;
        const m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
        c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, S, S);
        try { fotoData = c.toDataURL('image/jpeg', 0.85); } catch { fotoData = fr.result; }
        $('#oFotoOnizle').innerHTML = `<img src="${fotoData}" style="width:100%;height:100%;object-fit:cover">`;
        $('#oFotoSil').style.display = '';
      };
      img.onerror = () => bildir('Görsel okunamadı.', 'hata');
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  };
  $('#oiIptal').onclick = modalKapat;
  $('#oiKaydet').onclick = async () => {
    const ad = $('#oAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, dersUcreti: parseFloat($('#oUcret').value) || 0, payOrani: parseFloat($('#oPay').value) || 0,
      telefon: $('#oTel').value.trim(), eposta: $('#oEp').value.trim(), aktif: $('#oAktif').value === '1', foto: fotoData || null };
    if (mevcut) { await DB.guncelle('ortaklar', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('ortaklar', veri); State.ortaklar.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); git('ayar-pay');
  };
}

SAYFALAR['ayar-komisyon'] = function () {
  const k = State.komisyonlar;
  ic().innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">％</span><div>Banka/POS komisyon oranlarını tanımlayın. (Örn. kredi kartı tahsilatlarında kesilen POS komisyonu.)</div></div>
    <div class="kart-baslik" style="margin-bottom:14px"><h3>Komisyon Tanımları</h3><button class="btn btn-ana" id="yeniKom">＋ Yeni Komisyon</button></div>
    <div class="kart">
      ${k.length === 0 ? bosBlok('Komisyon tanımı yok.') : `
      <div class="tablo-sar"><table class="tablo">
        <thead><tr><th>Ad</th><th class="sag">Oran</th><th class="sag">Durum</th><th class="sag">İşlem</th></tr></thead>
        <tbody>${k.map(x=>`<tr><td>${kacar(x.ad)}</td><td class="sag">%${sayi(x.oran)}</td>
          <td class="sag">${x.aktif!==false?'<span class="rozet-etk rz-gelir">Aktif</span>':'<span class="rozet-etk rz-notr">Pasif</span>'}</td>
          <td class="sag"><button class="btn btn-kucuk btn-ikon" data-duzenle="${x.id}">✏️</button>
            <button class="btn btn-kucuk btn-ikon" data-sil="${x.id}">🗑️</button></td></tr>`).join('')}</tbody>
      </table></div>`}
    </div>`;
  $('#yeniKom').onclick = () => komisyonFormu();
  $$('[data-duzenle]').forEach(b => b.onclick = () => komisyonFormu(k.find(x => x.id === b.dataset.duzenle)));
  $$('[data-sil]').forEach(b => b.onclick = () => onayModal('Komisyon silinsin mi?', '', async () => {
    await DB.sil('komisyonlar', b.dataset.sil);
    State.komisyonlar = State.komisyonlar.filter(x => x.id !== b.dataset.sil);
    bildir('Silindi.', 'basari'); git('ayar-komisyon');
  }));
};

function komisyonFormu(mevcut) {
  const govde = `
    <div class="form-alan"><label>Komisyon Adı</label><input type="text" id="kAd" value="${mevcut?kacar(mevcut.ad):''}" placeholder="Örn. Kredi Kartı POS"></div>
    <div class="form-satir">
      <div class="form-alan"><label>Oran (%)</label><input type="number" id="kOran" step="0.01" min="0" value="${mevcut?mevcut.oran:''}"></div>
      <div class="form-alan"><label>Durum</label><select id="kAktif"><option value="1" ${!mevcut||mevcut.aktif!==false?'selected':''}>Aktif</option><option value="0" ${mevcut&&mevcut.aktif===false?'selected':''}>Pasif</option></select></div>
    </div>`;
  modalAc(mevcut ? 'Komisyon Düzenle' : 'Yeni Komisyon', govde, `<button class="btn" id="kiIptal">İptal</button><button class="btn btn-ana" id="kiKaydet">💾 Kaydet</button>`);
  $('#kiIptal').onclick = modalKapat;
  $('#kiKaydet').onclick = async () => {
    const ad = $('#kAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, oran: parseFloat($('#kOran').value) || 0, aktif: $('#kAktif').value === '1' };
    if (mevcut) { await DB.guncelle('komisyonlar', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('komisyonlar', veri); State.komisyonlar.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); git('ayar-komisyon');
  };
}

SAYFALAR['ayar-kullanici'] = function () {
  const roller = { admin: 'Yönetici (tam yetki)', editor: 'Editör (veri girişi)', viewer: 'İzleyici (sadece görüntüleme)' };
  const list = State.kullanicilar;
  ic().innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">👤</span><div>Kullanıcıları ve yetki seviyelerini buradan yönetin.
      Bu liste, yetki planlaması ve kayıt amaçlıdır (yerel modda kullanıcı bazlı giriş kısıtı uygulanmaz).</div></div>
    <div class="kart-baslik" style="margin-bottom:14px"><h3>Kullanıcılar</h3><button class="btn btn-ana" id="yeniKul">＋ Yeni Kullanıcı</button></div>
    <div class="kart">
      ${list.length === 0 ? bosBlok('Kullanıcı tanımlı değil.') : `
      <div class="tablo-sar"><table class="tablo">
        <thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th class="sag">Durum</th><th class="sag">İşlem</th></tr></thead>
        <tbody>${list.map(u=>`<tr><td>${kacar(u.ad||'—')}</td><td>${kacar(u.eposta||'—')}</td>
          <td><span class="rozet-etk ${u.rol==='admin'?'rz-gider':u.rol==='editor'?'rz-banka':'rz-notr'}">${kacar(roller[u.rol]||u.rol)}</span></td>
          <td class="sag">${u.aktif!==false?'<span class="rozet-etk rz-gelir">Aktif</span>':'<span class="rozet-etk rz-notr">Pasif</span>'}</td>
          <td class="sag"><button class="btn btn-kucuk btn-ikon" data-duzenle="${u.id}">✏️</button>
            <button class="btn btn-kucuk btn-ikon" data-sil="${u.id}">🗑️</button></td></tr>`).join('')}</tbody>
      </table></div>`}
    </div>`;
  $('#yeniKul').onclick = () => kullaniciFormu(roller);
  $$('[data-duzenle]').forEach(b => b.onclick = () => kullaniciFormu(roller, list.find(u => u.id === b.dataset.duzenle)));
  $$('[data-sil]').forEach(b => b.onclick = () => onayModal('Kullanıcı silinsin mi?', '', async () => {
    await DB.sil('kullanicilar', b.dataset.sil);
    State.kullanicilar = State.kullanicilar.filter(u => u.id !== b.dataset.sil);
    bildir('Silindi.', 'basari'); git('ayar-kullanici');
  }));
};

function kullaniciFormu(roller, mevcut) {
  const govde = `
    <div class="form-alan"><label>Ad Soyad</label><input type="text" id="uAd" value="${mevcut?kacar(mevcut.ad||''):''}"></div>
    <div class="form-alan"><label>E-posta <span class="soluk">(isteğe bağlı)</span></label><input type="email" id="uEp" value="${mevcut?kacar(mevcut.eposta||''):''}" placeholder="—" ${mevcut?'disabled':''}></div>
    <div class="form-satir">
      <div class="form-alan"><label>Rol</label><select id="uRol">${Object.entries(roller).map(([k,v])=>`<option value="${k}" ${mevcut&&mevcut.rol===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-alan"><label>Durum</label><select id="uAktif"><option value="1" ${!mevcut||mevcut.aktif!==false?'selected':''}>Aktif</option><option value="0" ${mevcut&&mevcut.aktif===false?'selected':''}>Pasif</option></select></div>
    </div>
    <div class="bilgi-kutu"><span class="ikon">🔑</span><div>Bu kayıt yetki planlaması içindir. Yerel modda ayrı bir şifre/giriş kısıtı uygulanmaz.</div></div>`;
  modalAc(mevcut ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı', govde, `<button class="btn" id="uiIptal">İptal</button><button class="btn btn-ana" id="uiKaydet">💾 Kaydet</button>`);
  $('#uiIptal').onclick = modalKapat;
  $('#uiKaydet').onclick = async () => {
    const ad = $('#uAd').value.trim();
    const eposta = $('#uEp').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, rol: $('#uRol').value, aktif: $('#uAktif').value === '1' };
    if (mevcut) { await DB.guncelle('kullanicilar', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('kullanicilar', { ...veri, eposta }); State.kullanicilar.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); git('ayar-kullanici');
  };
}

/* -------- AYARLAR: Banka Ayarları (banka ekle/çıkar/logo) -------- */
let _yeniBankaLogo = null;   // ekleme formunda seçilen geçici logo verisi
SAYFALAR['ayar-banka'] = function () {
  _yeniBankaLogo = null;
  const bankalar = State.hesaplar.filter(h => h.tip === 'banka');
  const satir = (h) => `
    <div class="banka-satir">
      ${bankaTileHTML(h, 46)}
      <div class="banka-satir-ad"><b>${kacar(h.ad)}</b><small>Bakiye: ${TL(Hesapla.paraHesapBakiye(h.id))}</small></div>
      <button class="btn btn-kucuk" data-logo="${h.id}">🖼️ Logo</button>
      <button class="btn btn-kucuk btn-kirmizi" data-sil="${h.id}">🗑️</button>
    </div>`;
  ic().innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">🏦</span><div>Bankalarınızı buradan ekleyin, logolarını yükleyin veya silin. Bu bankalar “Bankalar” hesabının üstünde logo şeridi olarak görünür.</div></div>
    <div class="izgara izgara-2">
      <div class="kart">
        <div class="kart-baslik"><h3>Bankalarım</h3><span class="soluk">${bankalar.length} banka</span></div>
        <div class="banka-liste">${bankalar.length ? bankalar.map(satir).join('') : bosBlok('Henüz banka yok. Sağdan ekleyin.')}</div>
      </div>
      <div class="kart">
        <div class="kart-baslik"><h3>Yeni Banka Ekle</h3></div>
        <div class="form-alan"><label>Banka Adı</label><input type="text" id="ybAd" placeholder="Örn. Ziraat Bankası"></div>
        <div class="form-alan"><label>Açılış Bakiyesi (₺)</label><input type="number" id="ybBakiye" step="0.01" value="0"></div>
        <div class="form-alan"><label>Banka Logosu (opsiyonel)</label>
          <div class="birak-alani" id="ybLogoBirak">
            <span class="ikon">🖼️</span><b>Logo seç</b> veya sürükle<br>
            <span class="soluk">.png · .jpg · .webp · .svg</span>
            <input type="file" id="ybLogoDosya" accept="image/*" hidden>
          </div>
          <div id="ybLogoOnizleme" style="margin-top:12px"></div>
        </div>
        <button class="btn btn-ana" id="ybEkle" style="width:100%;justify-content:center;padding:12px">＋ Bankayı Ekle</button>
      </div>
    </div>
    <input type="file" id="bankaLogoDosya" accept="image/*" hidden>`;

  // Mevcut banka logolarını değiştir
  let _logoHedef = null;
  const gizliDosya = $('#bankaLogoDosya');
  $$('[data-logo]').forEach(b => b.onclick = () => { _logoHedef = b.dataset.logo; gizliDosya.click(); });
  gizliDosya.onchange = () => {
    if (gizliDosya.files[0] && _logoHedef) bankaLogoIsle(gizliDosya.files[0], async (veri) => {
      const h = State.hesaplar.find(x => x.id === _logoHedef);
      await DB.guncelle('hesaplar', h.id, { logoData: veri }); h.logoData = veri;
      bildir('Logo güncellendi.', 'basari'); git('ayar-banka');
    });
  };
  $$('[data-sil]').forEach(b => b.onclick = () => {
    const h = State.hesaplar.find(x => x.id === b.dataset.sil);
    hesapSil(h.id);
  });

  // Yeni banka logo seçimi (geçici)
  const birak = $('#ybLogoBirak'), dosya = $('#ybLogoDosya');
  birak.onclick = () => dosya.click();
  ['dragover', 'dragenter'].forEach(ev => birak.addEventListener(ev, e => { e.preventDefault(); birak.classList.add('uzerinde'); }));
  ['dragleave', 'drop'].forEach(ev => birak.addEventListener(ev, e => { e.preventDefault(); birak.classList.remove('uzerinde'); }));
  birak.addEventListener('drop', e => { if (e.dataTransfer.files[0]) yeniBankaLogoSec(e.dataTransfer.files[0]); });
  dosya.onchange = () => { if (dosya.files[0]) yeniBankaLogoSec(dosya.files[0]); };

  $('#ybEkle').onclick = async () => {
    const ad = $('#ybAd').value.trim();
    if (!ad) return bildir('Banka adı girin.', 'hata');
    const veri = { ad, tip: 'banka', aktif: true, acilisBakiye: parseFloat($('#ybBakiye').value) || 0 };
    if (_yeniBankaLogo) veri.logoData = _yeniBankaLogo;
    const y = await DB.ekle('hesaplar', veri); State.hesaplar.push(y);
    _yeniBankaLogo = null;
    bildir('Banka eklendi.', 'basari'); git('ayar-banka');
  };
};
function yeniBankaLogoSec(dosya) {
  bankaLogoIsle(dosya, (veri) => {
    _yeniBankaLogo = veri;
    $('#ybLogoOnizleme').innerHTML = `<div class="banka-tile" style="width:60px;height:60px"><img src="${veri}" alt="logo"></div>`;
  });
}
/* Banka logosunu küçült (max 200px) ve callback'e data-uri ver */
function bankaLogoIsle(dosya, tamam) {
  if (!/^image\//.test(dosya.type) && !/\.svg$/i.test(dosya.name)) return bildir('Lütfen bir görsel dosyası seçin.', 'hata');
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 200;
      let w = img.width || max, h = img.height || max;
      const oran = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * oran)); h = Math.max(1, Math.round(h * oran));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      let veri; try { veri = c.toDataURL('image/png'); } catch { veri = fr.result; }
      tamam(veri);
    };
    img.onerror = () => bildir('Görsel okunamadı.', 'hata');
    img.src = fr.result;
  };
  fr.readAsDataURL(dosya);
}

/* -------- AYARLAR: Kredi Kartı Ayarları (kart ekle/çıkar/son ödeme günü/logo) -------- */
let _yeniKartLogo = null;
SAYFALAR['ayar-kk'] = function () {
  _yeniKartLogo = null;
  const kartlar = State.hesaplar.filter(h => h.tip === 'krediKarti');
  const satir = (h) => `
    <div class="banka-satir">
      ${kartTileHTML(h, true)}
      <div class="banka-satir-ad"><b>${kacar(h.ad)}</b><small>Son ödeme: ${sonOdemeMetni(h.sonOdemeGunu)} · Borç: ${TL(kartBorc(h.id))}</small></div>
      <button class="btn btn-kucuk" data-logo="${h.id}">🖼️ Logo</button>
      <button class="btn btn-kucuk btn-kirmizi" data-sil="${h.id}">🗑️</button>
    </div>`;
  ic().innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">💳</span><div>Kredi kartlarınızı buradan ekleyin (kart adı + son ödeme günü), logolarını yükleyin veya silin. Bu kartlar “Kredi Kartları” hesabının üstünde şerit olarak görünür.</div></div>
    <div class="izgara izgara-2">
      <div class="kart">
        <div class="kart-baslik"><h3>Kartlarım</h3><span class="soluk">${kartlar.length} kart</span></div>
        <div class="banka-liste">${kartlar.length ? kartlar.map(satir).join('') : bosBlok('Henüz kart yok. Sağdan ekleyin.')}</div>
      </div>
      <div class="kart">
        <div class="kart-baslik"><h3>Yeni Kart Ekle</h3></div>
        <div class="form-alan"><label>Kart Adı</label><input type="text" id="ykAd" placeholder="Örn. Bonus Kart"></div>
        <div class="form-alan"><label>Son Ödeme Günü</label>
          <div class="gun-kutu"><span>Her ayın</span><input type="number" id="ykGun" min="1" max="31" value="1"><span>. günü</span></div>
        </div>
        <div class="form-alan"><label>Kart Logosu (opsiyonel)</label>
          <div class="birak-alani" id="ykLogoBirak">
            <span class="ikon">💳</span><b>Logo seç</b> veya sürükle<br>
            <span class="soluk">.png · .jpg · .webp · .svg</span>
            <input type="file" id="ykLogoDosya" accept="image/*" hidden>
          </div>
          <div id="ykLogoOnizleme" style="margin-top:12px"></div>
        </div>
        <button class="btn btn-ana" id="ykEkle" style="width:100%;justify-content:center;padding:12px">＋ Kartı Ekle</button>
      </div>
    </div>
    <input type="file" id="kartLogoDosya" accept="image/*" hidden>`;

  let _logoHedef = null;
  const gizliDosya = $('#kartLogoDosya');
  $$('[data-logo]').forEach(b => b.onclick = () => { _logoHedef = b.dataset.logo; gizliDosya.click(); });
  gizliDosya.onchange = () => {
    if (gizliDosya.files[0] && _logoHedef) bankaLogoIsle(gizliDosya.files[0], async (veri) => {
      const h = State.hesaplar.find(x => x.id === _logoHedef);
      await DB.guncelle('hesaplar', h.id, { logoData: veri }); h.logoData = veri;
      bildir('Logo güncellendi.', 'basari'); git('ayar-kk');
    });
  };
  $$('[data-sil]').forEach(b => b.onclick = () => hesapSil(b.dataset.sil));

  const birak = $('#ykLogoBirak'), dosya = $('#ykLogoDosya');
  birak.onclick = () => dosya.click();
  ['dragover', 'dragenter'].forEach(ev => birak.addEventListener(ev, e => { e.preventDefault(); birak.classList.add('uzerinde'); }));
  ['dragleave', 'drop'].forEach(ev => birak.addEventListener(ev, e => { e.preventDefault(); birak.classList.remove('uzerinde'); }));
  birak.addEventListener('drop', e => { if (e.dataTransfer.files[0]) yeniKartLogoSec(e.dataTransfer.files[0]); });
  dosya.onchange = () => { if (dosya.files[0]) yeniKartLogoSec(dosya.files[0]); };

  $('#ykEkle').onclick = async () => {
    const ad = $('#ykAd').value.trim();
    if (!ad) return bildir('Kart adı girin.', 'hata');
    const gun = Math.min(31, Math.max(1, parseInt($('#ykGun').value, 10) || 1));
    const veri = { ad, tip: 'krediKarti', aktif: true, acilisBakiye: 0, sonOdemeGunu: gun };
    if (_yeniKartLogo) veri.logoData = _yeniKartLogo;
    const y = await DB.ekle('hesaplar', veri); State.hesaplar.push(y);
    _yeniKartLogo = null;
    bildir('Kart eklendi.', 'basari'); git('ayar-kk');
  };
};
function yeniKartLogoSec(dosya) {
  bankaLogoIsle(dosya, (veri) => {
    _yeniKartLogo = veri;
    $('#ykLogoOnizleme').innerHTML = `<div class="kart-tile mini"><img src="${veri}" alt="logo"></div>`;
  });
}

/* -------- AYARLAR: Admin Ayarları (sadece yönetici) -------- */
SAYFALAR['ayar-admin'] = function () {
  if (!adminMi()) {
    ic().innerHTML = `<div class="kart">${bosBlok('Bu bölümü yalnızca yönetici (Admin) görüntüleyebilir.')}</div>`;
    return;
  }
  ic().innerHTML = `
    <div class="admin-kart">
      <div class="admin-head"><span class="ai">🛡️</span><h3>Admin Ayarları</h3><span class="rz">SADECE YÖNETİCİ</span></div>
      <div class="admin-body">
        <div class="admin-satir"><span class="l">Uygulama Sürümü</span><span class="v">Sürüm ${APP_SURUM} · ${APP_SURUM_TARIH}</span></div>
        <p class="admin-not">Yeni bir güncelleme yayınlandığında, en güncel hâli bu cihaza indirmek için aşağıdaki düğmeye basın. Eski sürüm önbellekte kalmaz, en yeni sürüm yüklenir.</p>
        <button class="admin-guncelle" id="adGuncelle">⟳ En Güncel Sürümü Getir</button>
        <p class="admin-alt">🔒 Verileriniz korunur — yalnızca uygulama dosyaları yenilenir.</p>
      </div>
    </div>`;
  $('#adGuncelle').onclick = () => enGuncelSurumuGetir();
};

/* En güncel sürümü zorla getir: önbelleği/servis çalışanını temizle, taze index.html yükle.
   localStorage'a (verilere) dokunmaz. */
async function enGuncelSurumuGetir() {
  const btn = $('#adGuncelle');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Güncelleniyor…'; }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches && caches.keys) {
      const anahtarlar = await caches.keys();
      await Promise.all(anahtarlar.map(k => caches.delete(k)));
    }
  } catch (e) { /* önbellek yoksa sorun değil */ }
  // Benzersiz sorgu ile index.html'i taze çektir (tarayıcı önbelleğini atlatır)
  const yeni = location.pathname + '?g=' + Date.now();
  location.replace(yeni);
}

/* -------- AYARLAR: Firma Bilgileri & Logo -------- */
SAYFALAR['ayar-firma'] = function () {
  const a = State.ayarlar || {};
  const v = (x) => kacar(a[x] || '');
  const logoVar = !!a.logoData;
  ic().innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">🏢</span><div>Firma bilgileri ve logo; giriş ekranında, menüde ve raporlarda kullanılır. Bilgiler bu tarayıcıda saklanır.</div></div>
    <div class="izgara izgara-2">
      <div class="kart">
        <div class="kart-baslik"><h3>Firma Bilgileri</h3></div>
        <div class="form-alan"><label>Firma Adı</label><input type="text" id="fAd" value="${v('firmaAd')}" placeholder="Green Village Pilates"></div>
        <div class="form-alan"><label>Slogan / Alt Başlık</label><input type="text" id="fSlogan" value="${v('slogan')}" placeholder="Ön Muhasebe · Pilates Stüdyosu"></div>
        <div class="form-satir">
          <div class="form-alan"><label>Telefon</label><input type="text" id="fTel" value="${v('telefon')}"></div>
          <div class="form-alan"><label>E-posta</label><input type="email" id="fEposta" value="${v('eposta')}"></div>
        </div>
        <div class="form-alan"><label>Adres</label><textarea id="fAdres" rows="2">${v('adres')}</textarea></div>
        <div class="form-satir">
          <div class="form-alan"><label>Vergi Dairesi</label><input type="text" id="fVd" value="${v('vergiDairesi')}"></div>
          <div class="form-alan"><label>Vergi No</label><input type="text" id="fVn" value="${v('vergiNo')}"></div>
        </div>
        <div style="text-align:right;margin-top:6px"><button class="btn btn-ana" id="fKaydet">💾 Kaydet</button></div>
      </div>

      <div class="kart">
        <div class="kart-baslik"><h3>Logo</h3></div>
        <div style="text-align:center;margin-bottom:14px">
          <div id="logoOnizleme" style="width:120px;height:120px;border-radius:22px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:var(--yesil-acik);overflow:hidden;border:1px solid var(--kenar)">
            ${logoVar ? `<img src="${a.logoData}" alt="logo" style="width:100%;height:100%;object-fit:cover">`
                      : `<span style="font-size:34px;font-weight:800;color:var(--yesil-koyu)">${kacar(monogram((State.ayarlar && State.ayarlar.firmaAd) || 'Green Village Pilates'))}</span>`}
          </div>
        </div>
        <div class="birak-alani" id="logoBirak">
          <span class="ikon">🖼️</span><b>Logo seç</b> veya sürükle<br>
          <span class="soluk">.jpeg · .jpg · .png · .webp · .svg</span>
          <input type="file" id="logoDosya" accept="image/*" hidden>
        </div>
        ${logoVar ? `<button class="btn btn-kucuk" id="logoSil" style="margin-top:12px">🗑️ Logoyu Kaldır</button>` : ''}
        <div class="bilgi-kutu" style="margin-top:14px"><span class="ikon">ℹ️</span><div>Logo tarayıcıya kaydedilir; ayrıca dosya olarak eklemek isterseniz repodaki <b>logos/</b> klasörünü de kullanabilirsiniz.</div></div>
      </div>
    </div>`;

  $('#fKaydet').onclick = () => {
    const yeni = { ...State.ayarlar,
      firmaAd: $('#fAd').value.trim(), slogan: $('#fSlogan').value.trim(),
      telefon: $('#fTel').value.trim(), eposta: $('#fEposta').value.trim(),
      adres: $('#fAdres').value.trim(), vergiDairesi: $('#fVd').value.trim(), vergiNo: $('#fVn').value.trim(),
    };
    DB.ayarYaz(yeni); firmaBilgileriUygula();
    bildir('Firma bilgileri kaydedildi.', 'basari');
  };

  const birak = $('#logoBirak'), dosya = $('#logoDosya');
  birak.onclick = () => dosya.click();
  ['dragover', 'dragenter'].forEach(ev => birak.addEventListener(ev, e => { e.preventDefault(); birak.classList.add('uzerinde'); }));
  ['dragleave', 'drop'].forEach(ev => birak.addEventListener(ev, e => { e.preventDefault(); birak.classList.remove('uzerinde'); }));
  birak.addEventListener('drop', e => { if (e.dataTransfer.files[0]) logoDosyaIsle(e.dataTransfer.files[0]); });
  dosya.onchange = () => { if (dosya.files[0]) logoDosyaIsle(dosya.files[0]); };
  if ($('#logoSil')) $('#logoSil').onclick = () => {
    const yeni = { ...State.ayarlar }; delete yeni.logoData;
    DB.ayarYaz(yeni); firmaBilgileriUygula(); git('ayar-firma'); bildir('Logo kaldırıldı.', 'basari');
  };
};

/* Yüklenen logoyu küçült (max 240px) ve ayarlara kaydet */
function logoDosyaIsle(dosya) {
  if (!/^image\//.test(dosya.type) && !/\.svg$/i.test(dosya.name)) return bildir('Lütfen bir görsel dosyası seçin.', 'hata');
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 240;
      let w = img.width || max, h = img.height || max;
      const oran = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * oran)); h = Math.max(1, Math.round(h * oran));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      let veri; try { veri = c.toDataURL('image/png'); } catch { veri = fr.result; }
      DB.ayarYaz({ ...State.ayarlar, logoData: veri });
      firmaBilgileriUygula(); git('ayar-firma'); bildir('Logo kaydedildi.', 'basari');
    };
    img.onerror = () => bildir('Görsel okunamadı.', 'hata');
    img.src = fr.result;
  };
  fr.readAsDataURL(dosya);
}

/* -------- AYARLAR: Giriş / Güvenlik (sabit yönetici girişi) -------- */
SAYFALAR['ayar-guvenlik'] = function () {
  ic().innerHTML = `
    <div class="bilgi-kutu uyari"><span class="ikon">🔒</span><div>Bu giriş, temel bir <b>erişim kilididir</b>. Veriler tarayıcıda saklandığından, cihaza erişimi olan teknik biri kilidi aşabilir. Hassas veriler için cihazınızı da (ekran kilidi vb.) koruyun.</div></div>
    <div class="kart" style="max-width:580px">
      <div class="kart-baslik"><h3>Giriş / Güvenlik</h3><span class="rozet-etk rz-gelir">Sabit giriş aktif</span></div>
      <table class="tablo"><tbody>
        <tr><td>Giriş kilidi</td><td class="sag"><b>Açık</b> (her zaman)</td></tr>
        <tr><td>Yönetici Kullanıcı Adı</td><td class="sag"><b>${kacar(SABIT_ADMIN.kullanici)}</b></td></tr>
        <tr><td>Şifre</td><td class="sag">•••••••• <span class="soluk">(kod ile tanımlı)</span></td></tr>
      </tbody></table>
      <div class="bilgi-kutu" style="margin-top:16px"><span class="ikon">ℹ️</span><div>Yönetici girişi <b>uygulama kodunda sabittir</b>; buradan kaldırılamaz veya değiştirilemez. Değişiklik gerekirse yazılım güncellemesi yapılır (geliştiriciye iletin).</div></div>
      <div style="margin-top:14px">
        <button class="btn" id="gvCikis">⏻ Oturumu Kapat</button>
      </div>
    </div>`;
  $('#gvCikis').onclick = () => $('#cikisBtn').click();
};

/* Onay modalı */
function onayModal(baslik, mesaj, onaylandi) {
  modalAc(baslik, `<p style="font-size:14px;line-height:1.6">${mesaj || 'Emin misiniz?'}</p>`,
    `<button class="btn" id="onIptal">Vazgeç</button><button class="btn btn-kirmizi" id="onEvet">Evet, Sil</button>`);
  $('#onIptal').onclick = modalKapat;
  $('#onEvet').onclick = () => { modalKapat(); onaylandi(); };
}

/* ==========================================================
   10) KİMLİK DOĞRULAMA & BAŞLATMA
   ========================================================== */
async function uygulamayiBaslat() {
  $('#girisEkrani').classList.add('gizli');
  $('#uygulama').classList.remove('gizli');
  // Kullanıcı bilgisi
  const ep = State.kullanici?.email || 'yerel@yogatugi.com';
  $('#kullaniciAd').textContent = State.kullanici?.ad || ep.split('@')[0];
  $('#kullaniciRol').textContent = 'Yönetici';
  $('#kullaniciRozet').textContent = (ep[0] || '?').toUpperCase();
  await veriYukle();
  menuCiz();
  git('dashboard');
  // Henüz veri yoksa ve başlangıç seçilmemişse hoş geldin ekranı
  if (State.hesaplar.length === 0 && !localStorage.getItem('yt_baslangic')) {
    hosgeldinModal();
  }
}

/* İlk açılış: örnek verilerle mi boş mu başlansın? */
function hosgeldinModal() {
  modalAc('Yoga Tugi\'ye Hoş Geldiniz 👋', `
    <p style="line-height:1.6">Uygulama şu an <b>yerel depolama</b> modunda çalışıyor
    (veriler bu tarayıcıda saklanır). Nasıl başlamak istersiniz?</p>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:18px">
      <button class="btn btn-ana" id="hgBos" style="justify-content:center;padding:14px">
        📄 Boş başla — kendi verilerimi gireceğim</button>
      <button class="btn" id="hgOrnek" style="justify-content:center;padding:14px">
        🎯 Örnek verilerle keşfet <span class="soluk" style="margin-left:6px">(deneme amaçlı)</span></button>
    </div>
    <div class="bilgi-kutu" style="margin-top:16px"><span class="ikon">💡</span>
      <div>Örnek verileri sonradan 💾 (Yedekle) menüsünden <b>sıfırlayabilirsiniz</b>.</div></div>`, '');
  $('#hgBos').onclick = () => {
    localStorage.setItem('yt_baslangic', 'bos');
    modalKapat();
    bildir('Boş başlandı. Hesaplar ve ortakları ekleyerek başlayın.', 'basari');
  };
  $('#hgOrnek').onclick = async () => {
    await ornekVeriYukle();
    localStorage.setItem('yt_baslangic', 'ornek');
    modalKapat();
    await veriYukle();
    git('dashboard');
    bildir('Örnek veriler yüklendi.', 'basari');
  };
}

/* Örnek (deneme) veri oluştur */
async function ornekVeriYukle() {
  const hesaplar = [
    { ad: 'Ziraat Bankası', tip: 'banka', acilisBakiye: 15000, aktif: true, banka: 'Ziraat' },
    { ad: 'Merkez Kasa', tip: 'kasa', acilisBakiye: 2000, aktif: true },
    { ad: 'İş Bankası Kart', tip: 'krediKarti', acilisBakiye: 0, aktif: true },
    { ad: 'Ders Geliri', tip: 'gelir', aktif: true },
    { ad: 'Üyelik Geliri', tip: 'gelir', aktif: true },
    { ad: 'Kira', tip: 'gider', aktif: true },
    { ad: 'Personel Maaşı', tip: 'gider', aktif: true },
    { ad: 'Malzeme / Ekipman', tip: 'gider', aktif: true },
    { ad: 'Elektrik / Su / Doğalgaz', tip: 'gider', aktif: true },
  ];
  const eklenenH = await DB.topluEkle('hesaplar', hesaplar);
  const bul = (ad) => eklenenH.find(h => h.ad === ad).id;
  const ay = buAy();
  const g = (gun) => `${ay}-${String(gun).padStart(2, '0')}`;
  const islemler = [
    { tarih: g(3), tutar: 8500, tip: 'gelir', odemeHesabiId: bul('Merkez Kasa'), kategoriId: bul('Ders Geliri'), kaynak: 'plan4me', aciklama: 'Grup dersleri' },
    { tarih: g(5), tutar: 12000, tip: 'gelir', odemeHesabiId: bul('Ziraat Bankası'), kategoriId: bul('Üyelik Geliri'), kaynak: 'banka', aciklama: 'Aylık üyelikler' },
    { tarih: g(7), tutar: 6400, tip: 'gelir', odemeHesabiId: bul('İş Bankası Kart'), kategoriId: bul('Ders Geliri'), kaynak: 'krediKarti', aciklama: 'Özel ders paketleri' },
    { tarih: g(10), tutar: 9000, tip: 'gider', odemeHesabiId: bul('Ziraat Bankası'), kategoriId: bul('Kira'), kaynak: 'banka', aciklama: 'Stüdyo kirası' },
    { tarih: g(10), tutar: 7500, tip: 'gider', odemeHesabiId: bul('Ziraat Bankası'), kategoriId: bul('Personel Maaşı'), kaynak: 'banka', aciklama: 'Eğitmen maaşı' },
    { tarih: g(12), tutar: 1800, tip: 'gider', odemeHesabiId: bul('Merkez Kasa'), kategoriId: bul('Malzeme / Ekipman'), kaynak: 'kasa', aciklama: 'Mat ve bantlar' },
    { tarih: g(15), tutar: 2200, tip: 'gider', odemeHesabiId: bul('Ziraat Bankası'), kategoriId: bul('Elektrik / Su / Doğalgaz'), kaynak: 'banka', aciklama: 'Faturalar' },
  ];
  await DB.topluEkle('islemler', islemler);
  await DB.topluEkle('ortaklar', [
    { ad: 'Tuğçe Yoga', payOrani: 60, aktif: true, telefon: '0555 000 00 00' },
    { ad: 'Selin Kaya', payOrani: 40, aktif: true, telefon: '0555 111 11 11' },
  ]);
  await DB.ekle('komisyonlar', { ad: 'Kredi Kartı POS', oran: 1.5, aktif: true });
  await DB.ekle('kullanicilar', { eposta: 'yonetici@yogatugi.com', ad: 'Yönetici', rol: 'admin', aktif: true });
}

/* Giriş — ayarlarda şifre tanımlıysa admin+şifre, değilse tek düğme */
function girisKur() { girisGovdeCiz(); }

function girisGovdeCiz() {
  const govde = $('#girisGovde');
  // Daha önce girildiyse doğrudan aç (oturum hatırlanır)
  if (localStorage.getItem('yt_girisYapildi')) { girisYap(SABIT_ADMIN.kullanici); return; }
  govde.innerHTML = `
    <label for="gKul">Kullanıcı Adı</label>
    <input type="text" id="gKul" placeholder="Admin" autocomplete="username">
    <label for="gSif">Şifre</label>
    <input type="password" id="gSif" placeholder="••••••••" autocomplete="current-password">
    <div class="giris-hata" id="girisHata"></div>
    <button type="button" class="btn-giris" id="girisBtn">Giriş Yap</button>`;
  $('#girisBtn').onclick = girisDogrula;
  govde.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') girisDogrula(); }));
}

async function girisDogrula() {
  const kul = ($('#gKul').value || '').trim();
  const sif = $('#gSif').value || '';
  const hata = $('#girisHata');
  if (kul.toLocaleLowerCase('tr') !== SABIT_ADMIN.kullanici.toLocaleLowerCase('tr')) {
    hata.textContent = 'Kullanıcı adı hatalı.'; return;
  }
  const h = await sifreHash(sif);
  if (!SABIT_ADMIN.hashler.includes(h)) { hata.textContent = 'Şifre hatalı.'; return; }
  girisYap(SABIT_ADMIN.kullanici);
}

async function girisYap(ad) {
  State.kullanici = { email: (ad || 'admin') + '@yogatugi', ad: ad || SABIT_ADMIN.kullanici };
  localStorage.setItem('yt_girisYapildi', '1');
  await uygulamayiBaslat();
}

/* Çıkış, tema, mobil menü */
function cikisYap() {
  localStorage.removeItem('yt_girisYapildi');
  State.kullanici = null;
  $('#uygulama').classList.add('gizli');
  $('#girisEkrani').classList.remove('gizli');
  girisGovdeCiz();
}
function temaDegistir() {
  document.body.classList.toggle('tema-koyu');
  const koyu = document.body.classList.contains('tema-koyu');
  const ikon = koyu ? '☀️' : '🌙';
  if ($('#temaBtn')) $('#temaBtn').textContent = ikon;
  localStorage.setItem('yt_tema', koyu ? 'koyu' : 'acik');
}
function kulMenuKapat() { $('#kulMenu').classList.add('gizli'); }

function ustCubukKur() {
  $('#cikisBtn').onclick = cikisYap;
  $('#temaBtn').onclick = temaDegistir;
  if (localStorage.getItem('yt_tema') === 'koyu') { document.body.classList.add('tema-koyu'); if ($('#temaBtn')) $('#temaBtn').textContent = '☀️'; }
  $('#menuAcBtn').onclick = () => document.body.classList.toggle('menu-acik');
  $('#menuPerde').onclick = () => document.body.classList.remove('menu-acik');
  $('#yedekBtn').onclick = yedekModal;

  // Mobil: kullanıcıya dokununca açılan menü (Yedek / Tema / Çıkış)
  const km = $('#kulMenu');
  $('#kullaniciBlok').onclick = (e) => { e.stopPropagation(); km.classList.toggle('gizli'); };
  $('#kmYedek').onclick = () => { kulMenuKapat(); yedekModal(); };
  $('#kmTema').onclick = () => { temaDegistir(); };
  $('#kmCikis').onclick = () => { kulMenuKapat(); cikisYap(); };
  document.addEventListener('click', (e) => {
    if (!km.classList.contains('gizli') && !e.target.closest('#kulMenu') && !e.target.closest('#kullaniciBlok')) kulMenuKapat();
  });

  // Mobil alt menü + grup sheet
  altMenuCiz();
  $('#sheetPerde').onclick = sheetKapat;
}

/* ---- Mobil alt menü (logolu sekme çubuğu) ---- */
const ALT_MENU = [
  { tip: 'sayfa', id: 'dashboard', ad: 'Panel',    ikon: '📊' },
  { tip: 'sayfa', id: 'hesaplar',  ad: 'Hesaplar', ikon: '🗂️' },
  { tip: 'grup',  grup: 'Raporlar', ad: 'Raporlar', ikon: '📈' },
  { tip: 'grup',  grup: 'Ayarlar',  ad: 'Ayarlar',  ikon: '⚙️' },
];
// Bir sayfanın hangi alt-menü sekmesine ait olduğunu bul
function altMenuAktifId(sayfa) {
  if (sayfa === 'dashboard') return 'dashboard';
  // Hesaplar sekmesi: kart sayfası, hesap-*, Potansiyel Müşteriler ve Plan4Me
  if (sayfa === 'hesaplar' || sayfa === 'potansiyel' || sayfa === 'plan4me' || sayfa.startsWith('hesap-')) return 'hesaplar';
  for (const m of ALT_MENU) {
    if (m.tip !== 'grup') continue;
    const grup = MENU.find(g => g.grup === m.grup);
    if (grup && grup.ogeler.some(o => o.id === sayfa)) return m.grup;
  }
  return 'dashboard';
}
function altMenuCiz() {
  const nav = $('#altMenu');
  nav.innerHTML = ALT_MENU.map(m => {
    const anahtar = m.tip === 'grup' ? m.grup : m.id;
    return `<button type="button" class="alt-oge" data-alt="${kacar(anahtar)}">
      <span class="ic">${m.ikon}</span><span class="tx">${kacar(m.ad)}</span></button>`;
  }).join('');
  $$('.alt-oge', nav).forEach(b => b.onclick = () => {
    const anahtar = b.dataset.alt;
    const m = ALT_MENU.find(x => (x.tip === 'grup' ? x.grup : x.id) === anahtar);
    if (m.tip === 'sayfa') { sheetKapat(); git(m.id); }
    else grupSheet(m.grup);
  });
  altMenuGuncelle();
}
function altMenuGuncelle() {
  const aktif = altMenuAktifId(State.aktifSayfa);
  $$('.alt-oge').forEach(b => b.classList.toggle('aktif', b.dataset.alt === aktif));
}

/* Grup sekmesine basınca alttan açılan alt sayfa listesi */
function grupSheet(grupAd) {
  const m = MENU.find(g => g.grup === grupAd);
  if (!m) return;
  const ogeler = m.ogeler.filter(o => !o.gizli && (!o.sadeceAdmin || adminMi()));
  $('#altSheet').innerHTML = `
    <div class="cizgi"></div>
    <h4>${m.ikon} ${kacar(grupAd)}</h4>
    <div class="sheet-liste">
      ${ogeler.map(o => `<button type="button" class="sheet-oge ${o.id === State.aktifSayfa ? 'aktif' : ''}" data-sayfa="${o.id}">
        <span class="oi">${o.ikon}</span><b>${kacar(o.ad)}</b><span class="ok">›</span></button>`).join('')}
    </div>`;
  document.body.classList.add('sheet-acik');
  $$('#altSheet .sheet-oge').forEach(b => b.onclick = () => { sheetKapat(); git(b.dataset.sayfa); });
}
function sheetKapat() { document.body.classList.remove('sheet-acik'); }

/* ==========================================================
   YEDEKLEME — Dışa aktar / İçe aktar / Sıfırla
   ========================================================== */
function yedekModal() {
  const adet = State.hesaplar.length + State.islemler.length + State.ortaklar.length;
  modalAc('Yedekleme & Veri Yönetimi', `
    <div class="bilgi-kutu"><span class="ikon">💾</span><div>Yerel veriler yalnızca bu tarayıcıda saklanır.
      Düzenli <b>yedek alın</b>; başka cihaza taşımak veya güvenli saklamak için bu yedeği kullanabilirsiniz.</div></div>
    <div style="display:flex;flex-direction:column;gap:11px">
      <button class="btn btn-ana" id="ydDisa" style="justify-content:center;padding:13px">
        ⤓ Yedeği İndir (.json) <span class="soluk" style="margin-left:6px">${adet} kayıt</span></button>
      <button class="btn" id="ydIce" style="justify-content:center;padding:13px">⤒ Yedekten Geri Yükle</button>
      <input type="file" id="ydDosya" accept=".json" hidden>
    </div>
    <hr style="border:none;border-top:1px solid var(--kenar);margin:18px 0">
    <div class="bilgi-kutu uyari"><span class="ikon">⚠️</span><div><b>Tehlikeli bölge:</b> Tüm yerel verileri kalıcı olarak siler.</div></div>
    <button class="btn btn-kirmizi" id="ydSifirla" style="width:100%;justify-content:center;padding:12px">🗑️ Tüm Verileri Sıfırla</button>
  `, `<button class="btn" id="ydKapat">Kapat</button>`);
  $('#ydKapat').onclick = modalKapat;
  $('#ydDisa').onclick = yedekIndir;
  $('#ydIce').onclick = () => $('#ydDosya').click();
  $('#ydDosya').onchange = (e) => { if (e.target.files[0]) yedekGeriYukle(e.target.files[0]); };
  $('#ydSifirla').onclick = () => onayModal('Tüm veriler silinsin mi?',
    'Bu işlem geri alınamaz. Önce yedek almanız önerilir.', verileriSifirla);
}

function yedekIndir() {
  const veri = {
    _uygulama: 'YogaTugi-Muhasebe', _surum: 1, _tarih: new Date().toISOString(),
    hesaplar: State.hesaplar, islemler: State.islemler, ortaklar: State.ortaklar,
    komisyonlar: State.komisyonlar, karPayi: State.karPayi, kullanicilar: State.kullanicilar,
    potansiyel: State.potansiyel,
  };
  const blob = new Blob([JSON.stringify(veri, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `yogatugi-yedek-${bugunISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
  bildir('Yedek indirildi.', 'basari');
}

function yedekGeriYukle(dosya) {
  const fr = new FileReader();
  fr.onload = async () => {
    let veri;
    try { veri = JSON.parse(fr.result); } catch { return bildir('Geçersiz dosya (JSON okunamadı).', 'hata'); }
    if (!veri || typeof veri !== 'object' || !Array.isArray(veri.hesaplar)) {
      return bildir('Bu bir Yoga Tugi yedek dosyası değil.', 'hata');
    }
    KOLEKSIYONLAR.forEach(k => { if (Array.isArray(veri[k])) DB._yaz(k, veri[k]); });
    localStorage.setItem('yt_baslangic', 'yedek');
    await veriYukle();
    modalKapat(); git('dashboard');
    bildir('Yedek geri yüklendi.', 'basari');
  };
  fr.readAsText(dosya);
}

async function verileriSifirla() {
  KOLEKSIYONLAR.forEach(k => localStorage.removeItem(DB._anahtar(k)));
  localStorage.removeItem('yt_baslangic');
  await veriYukle();
  git('dashboard');
  bildir('Tüm veriler sıfırlandı.', 'basari');
  setTimeout(hosgeldinModal, 400);
}

/* Firma bilgilerini arayüze uygula (ad, slogan, logo, başlık) */
function monogram(ad) {
  return ((ad || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr')) || 'GV';
}

function firmaBilgileriUygula() {
  const a = State.ayarlar || {};
  const ad = (a.firmaAd || '').trim() || 'Green Village Pilates';
  const slogan = (a.slogan || '').trim() || 'Ön Muhasebe · Pilates Stüdyosu';
  if ($('#girisBaslik')) $('#girisBaslik').textContent = ad;
  if ($('#girisAlt')) $('#girisAlt').textContent = slogan;
  if ($('#menuFirmaAdMetin')) $('#menuFirmaAdMetin').textContent = ad;
  if ($('#menuLogo')) $('#menuLogo').textContent = monogram(ad);   // kenar menüde monogram
  // Mobil üst çubuk: sol firma adı + logo
  if ($('#ustFirmaAd')) $('#ustFirmaAd').textContent = ad;
  if ($('#ustFirmaLogo')) {
    if (a.logoData) $('#ustFirmaLogo').innerHTML = `<img src="${a.logoData}" alt="logo">`;
    else $('#ustFirmaLogo').textContent = monogram(ad);
  }
  document.title = ad + ' — Ön Muhasebe';
  logoUygula();
}

/* Giriş ekranı markası: logo (wordmark/yüklenen) varsa göster ve metin başlığı gizle */
function girisLogoAta(src) {
  if ($('#girisLogo')) $('#girisLogo').innerHTML = `<img src="${src}" alt="logo">`;
  if ($('#girisBaslik')) $('#girisBaslik').style.display = 'none';
}
function girisLogoYer() {
  const ad = (State.ayarlar && State.ayarlar.firmaAd) || 'Green Village Pilates';
  if ($('#girisLogo')) $('#girisLogo').innerHTML = `<span class="yer-tutucu">${kacar(monogram(ad))}</span>`;
  if ($('#girisBaslik')) $('#girisBaslik').style.display = '';
}

/* Logo uygula: önce ayarlardaki yüklenen logo, yoksa logos/ klasöründeki dosya (önce GV wordmark) */
function logoUygula() {
  const a = State.ayarlar || {};
  if (a.logoData) { girisLogoAta(a.logoData); return; }
  logoDosyadanYukle([
    'logos/gv-logo.png',
    'logos/yogatugi-logo.png', 'logos/yogatugi-logo.jpeg', 'logos/yogatugi-logo.jpg',
    'logos/yogatugi-logo.webp', 'logos/yogatugi-logo.svg',
  ]);
}
function logoDosyadanYukle(adaylar) {
  if (!adaylar.length) { girisLogoYer(); return; }
  const yol = adaylar[0];
  const test = new Image();
  test.onload = () => girisLogoAta(yol);
  test.onerror = () => logoDosyadanYukle(adaylar.slice(1));
  test.src = yol;
}

/* ==========================================================
   11) AÇILIŞ
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  DB.baslat();
  State.ayarlar = DB.ayarOku();
  firmaBilgileriUygula();
  ustCubukKur();
  girisKur();
  yakinlastirmaKapat();
});

/* iOS Safari'de pinch yakınlaştırmasını engelle (çift-dokunma zaten touch-action:pan-y ile kapalı) */
function yakinlastirmaKapat() {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
    document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
}

})();
