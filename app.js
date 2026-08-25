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
  musteriler: [],    // {id, ad, telefon, not}  — (eski) ders müşterileri
  giderler: [],      // {id, ad, grupId}  — Tanımlamalar > Giderler (gider kalem isimleri)
  giderGruplari: [], // {id, ad}  — Gider grup başlıkları
  giderKayitlari: [],// {id, tarih, giderId, giderAd, grupAd, aciklama, odemeSekli, tutar, ortakId, olusturma}  — Giderler sayfası (harcama kayıtları)
  uyelikler: [],     // {id, ad, fiyat, dersSayisi, gecerlilikGun, kapsam}  — Tanımlamalar > Üyelikler
  ogrenciler: [],    // {id, ad, soyad, telefon, olusturma, durum:'potansiyel'|'ogrenci', egitmenId, paketler:[{id,uyelikId,paketAd,dersToplam,kalanDers,fiyat,kalanOdeme,tarih}]}
  dersler: [],       // {id, dersAd, egitmenId, ogrenciIds:[], tarih:'YYYY-MM-DD', saat:'HH:MM', bitis:'HH:MM', studyoId, durum:'bekliyor'|'gerceklesti'|'iptal', dusumler:[{ogrenciId,paketId}], olusturma}
  studyolar: [],     // {id, ad, aktif, olusturma}  — Ders stüdyoları (salonlar)
  odemeler: [],      // {id, ogrenciId, tutar, tarih:'YYYY-MM-DD', tur:'nakit'|'kart'|'havale', dusumler:[{paketId,tutar}], olusturma}
  talepler: [],      // {id, kullaniciId, kullaniciAd, sayfa, baslik, aciklama, cevap, cevapAd, durum:'bekliyor'|'cevaplandi', olusturma, cevapTarih}  — İstek ve Öneri
  // ---- Yeni muhasebe/mutabakat modeli (Plan4me + Banka) ----
  planformiTahsilat: [], // {id, tarih:'YYYY-MM-DD', saat, egitmenAd, egitmenId?, uyeAd, tur:'nakit'|'havale'|'kart', tutar, eslesmeId?, kaynak:'planformi', imza, olusturma}
  bankaHareketleri: [],  // {id, tarih:'YYYY-MM-DD', harekettarih, islem, tutar(signed), ba:'B'|'A', aciklama, kanal, kartNo, islemNo, yon:'gelir'|'gider'|'komisyon'|'ortakOdeme'|'transfer', giderKategoriId?, egitmenId?, eslesmeId?, kaynak:'vakifbank', imza, olusturma}
  eslesmeler: [],        // {id, tip:'batch'|'havale', bankaIds:[], planformiIds:[], durum:'otomatik'|'onayli'|'manuel'|'uyumsuz', beklenen, gerceklesen, komisyon, fark, not, olusturma}
  kategoriKurallari: [], // {id, anahtar, giderKategoriId, yon, olusturma}  — banka açıklama → kategori önerisi
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
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';   // kırılmaz boşluk → ₺ alt satıra kaymaz
}
function sayi(n) { return (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
/* Binlik ayraçlı tam sayı (ondalıksız): 50000 -> "50.000" */
function binlik(n) { return Math.round(Number(n) || 0).toLocaleString('tr-TR'); }
/* Yazılan metinden yalnızca rakamları al ve binlik nokta ekle: "50000" -> "50.000" */
function binlikBiciml(metin) {
  const rakam = String(metin == null ? '' : metin).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return rakam ? Number(rakam).toLocaleString('tr-TR') : '';
}
/* Telefon: baştaki 0 atılır, 10 haneye kırpılır, 505-033-41-27 (3-3-2-2) tireli */
function telBiciml(metin) {
  let d = String(metin == null ? '' : metin).replace(/\D/g, '');
  if (d[0] === '0') d = d.slice(1);
  d = d.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join('-');
}

/* Saat: yazarken 3. rakamdan sonra "10:30" gibi ":" koyar (canlı) */
function saatBiciml(metin) {
  const d = String(metin == null ? '' : metin).replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + ':' + d.slice(2);
}
/* Saat: kaydederken HH:MM'e tamamla, saat 0-23 / dakika 0-59 sınırla */
function saatNormal(metin) {
  const d = String(metin == null ? '' : metin).replace(/\D/g, '').slice(0, 4);
  if (!d) return '10:00';
  const s = Math.min(23, parseInt(d.slice(0, 2) || '0', 10) || 0);
  const dk = Math.min(59, parseInt(d.slice(2) || '0', 10) || 0);
  return String(s).padStart(2, '0') + ':' + String(dk).padStart(2, '0');
}

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
/* Bir input'u tutar kutusu yap: canlı biçimlendir + imleç " ₺" ekine takılmadan silinebilsin */
function tutarKutusuBagla(el, baslangic) {
  if (!el) return;
  if (baslangic != null && baslangic !== '') el.value = tutarBicimle(String(baslangic).replace('.', ','));
  const ekOnce = (v) => v.endsWith(' ₺') ? v.length - 2 : v.length;   // " ₺" ekinden önceki konum
  el.addEventListener('input', () => {
    const eski = el.value, sel = el.selectionStart || 0;
    const solRakam = eski.slice(0, sel).replace(/\D/g, '').length;   // imleç solundaki rakam sayısı
    const yeni = tutarBicimle(el.value);
    el.value = yeni;
    let pos = 0, say = 0;
    if (solRakam > 0) { for (let i = 0; i < yeni.length; i++) { if (/\d/.test(yeni[i]) && ++say === solRakam) { pos = i + 1; break; } } if (say < solRakam) pos = ekOnce(yeni); }
    if (pos > ekOnce(yeni)) pos = ekOnce(yeni);
    try { el.setSelectionRange(pos, pos); } catch {}
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Backspace' || el.selectionStart !== el.selectionEnd) return;
    const ekBas = ekOnce(el.value);
    if (el.selectionStart >= ekBas && ekBas > 0) {   // imleç " ₺" ekinde → son rakamı sil
      e.preventDefault();
      el.value = tutarBicimle(el.value.slice(0, ekBas - 1));
      const p = ekOnce(el.value);
      try { el.setSelectionRange(p, p); } catch {}
    }
  });
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
/* İsimden baş harf(ler) — "Ayşe Yılmaz" -> "AY", "Elif" -> "EL" */
function basHarf(...parcalar) {
  const kelimeler = parcalar.map(p => String(p || '').trim()).filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  if (!kelimeler.length) return '?';
  if (kelimeler.length === 1) return kelimeler[0].slice(0, 2).toLocaleUpperCase('tr');
  return (kelimeler[0][0] + kelimeler[kelimeler.length - 1][0]).toLocaleUpperCase('tr');
}
/* Eğitmen (ortak) kısa gösterim adı: "Elif Kaya" -> "Elif K." */
function egitmenKisaAd(o) {
  if (!o) return '—';
  const p = String(o.ad || '').trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return o.ad || '—';
  return p[0] + ' ' + p[p.length - 1][0].toLocaleUpperCase('tr') + '.';
}
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
/* Premium ay seçici — ay büyük (serif), yıl altında altın harflerle */
function ayNavHTML(donem) {
  const aylar = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const [y, m] = donem.split('-');
  return `<div class="ay-nav"><button type="button" data-ay="-1" aria-label="Önceki ay">‹</button><span class="ay"><span class="m">${aylar[parseInt(m, 10) - 1]}</span><span class="y">${y}</span></span><button type="button" data-ay="1" aria-label="Sonraki ay">›</button></div>`;
}
function kacar(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
/* Dönemi (YYYY-MM) n ay kaydır */
function donemKaydir(donem, n) {
  let [y, m] = donem.split('-').map(Number);
  m += n;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
/* Kısa tarih: "2026-06-29" → "29.06" */
function kisaTarih(iso) { return (iso && iso.length >= 10) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : (iso ? fmtTarih(iso) : ''); }
/* Türkçe başlık harfi: "burcu ÇOLAK" → "Burcu Çolak" */
function baslikHarf(s) {
  return String(s == null ? '' : s).trim().split(/\s+/).map(w =>
    w ? w.charAt(0).toLocaleUpperCase('tr') + w.slice(1).toLocaleLowerCase('tr') : ''
  ).join(' ');
}

/* ---- Gün / saat / ders çakışma yardımcıları (ders programı) ---- */
const HAFTA_GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];   // Pazartesi-ilk
const HAFTA_GUN_TAM = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
/* ISO tarihi n gün kaydır — yerel parçalarla (UTC kayması yok) */
function gunKaydir(iso, n) {
  const [y, m, g] = (iso || bugunISO()).split('-').map(Number);
  const d = new Date(y, m - 1, g + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/* Haftanın günü — Pazartesi=0 … Pazar=6 */
function haftaGunu(iso) {
  const [y, m, g] = (iso || bugunISO()).split('-').map(Number);
  return (new Date(y, m - 1, g).getDay() + 6) % 7;
}
/* Uzun gün etiketi: "Çarşamba, 26 Ağustos 2026" */
function gunUzun(iso) {
  const [y, m, g] = (iso || bugunISO()).split('-').map(Number);
  return `${HAFTA_GUN_TAM[haftaGunu(iso)]}, ${g} ${AY_TAM[m - 1]} ${y}`;
}
/* Başlangıç saatine dk ekle → 'HH:MM' (24s içinde sınırlı) */
function saatEkleDk(hhmm, dk) {
  const [s, d] = String(hhmm || '10:00').split(':').map(Number);
  let t = Math.min(24 * 60, (s * 60 + d) + (Number(dk) || 0));
  const sh = Math.floor(t / 60), sd = t % 60;
  return String(Math.min(23, sh)).padStart(2, '0') + ':' + String(sd).padStart(2, '0');
}
/* İki saat aralığı çakışır mı? (HH:MM string karşılaştırması) */
function araliklarCakisir(aBas, aBit, bBas, bBit) { return aBas < bBit && bBas < aBit; }
/* Bir dersin bitiş saati (yoksa varsayılan +60 dk) */
function dersBitis(d) { return (d && d.bitis) ? d.bitis : saatEkleDk(d ? d.saat : '10:00', 60); }
/* Aynı tarihte eğitmen/stüdyo çakışması var mı? → {tip, ders} | null */
function dersCakismaVar({ egitmenId, studyoId, tarih, saat, bitis, haricId }) {
  const list = (State.dersler || []).filter(d => d.tarih === tarih && d.durum !== 'iptal' && d.id !== haricId);
  for (const d of list) {
    if (!araliklarCakisir(saat, bitis, d.saat, dersBitis(d))) continue;
    if (egitmenId && d.egitmenId === egitmenId) return { tip: 'egitmen', ders: d };
  }
  for (const d of list) {
    if (!araliklarCakisir(saat, bitis, d.saat, dersBitis(d))) continue;
    if (studyoId && d.studyoId === studyoId) return { tip: 'studyo', ders: d };
  }
  return null;
}
/* O gün ilgili stüdyo/eğitmenin dolu aralıkları (saat seçici bilgisi) */
function gunMesgulAraliklar(tarih, { studyoId, egitmenId }) {
  return (State.dersler || [])
    .filter(d => d.tarih === tarih && d.durum !== 'iptal' && ((studyoId && d.studyoId === studyoId) || (egitmenId && d.egitmenId === egitmenId)))
    .map(d => ({ bas: d.saat, bit: dersBitis(d) }))
    .sort((a, b) => a.bas.localeCompare(b.bas));
}
/* Aktif stüdyolar */
function aktifStudyolar() { return (State.studyolar || []).filter(s => s.aktif !== false); }
function studyoAd(id) { const s = (State.studyolar || []).find(x => x.id === id); return s ? s.ad : ''; }

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
  document.body.classList.add('govde-kilit');   // arka plan kaymasın → açılış/kaydırma akıcı
}
function modalKapat() { $('#modalKap').innerHTML = ''; document.body.classList.remove('govde-kilit'); }

/* ==========================================================
   2) VERİ KATMANI (Yerel depolama / localStorage)
   ========================================================== */
const KOLEKSIYONLAR = ['ortaklar', 'giderler', 'giderGruplari', 'giderKayitlari', 'uyelikler', 'ogrenciler', 'dersler', 'odemeler', 'talepler', 'studyolar', 'planformiTahsilat', 'bankaHareketleri', 'eslesmeler', 'kategoriKurallari'];   // + yeni muhasebe/mutabakat koleksiyonları
const ESKI_KOLEKSIYONLAR = ['hesaplar', 'islemler', 'komisyonlar', 'karPayi', 'kullanicilar', 'potansiyel', 'musteriler'];

/* Veri katmanı — Yerel depolama (localStorage). Sunucu/Firebase yok. */
const DB = {
  mod: 'yerel',

  baslat() { this.mod = 'yerel'; },

  _anahtar(kol) { return 'yt_' + kol; },
  _oku(kol) { try { return JSON.parse(localStorage.getItem(this._anahtar(kol))) || []; } catch { return []; } },
  _yaz(kol, dizi) { localStorage.setItem(this._anahtar(kol), JSON.stringify(dizi)); if (window._Bulut) window._Bulut.itPlanla(); },

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
  ayarYaz(obj) { State.ayarlar = obj; localStorage.setItem('yt_ayarlar', JSON.stringify(obj)); if (window._Bulut) window._Bulut.itPlanla(); },
};

/* ==========================================================
   2b) BULUT SENKRON (Supabase) — tüm veri tek JSON satırında paylaşılır
   ========================================================== */
const BULUT_SQL = `create table if not exists public.yt_veri (
  id text primary key,
  data jsonb,
  guncelleme timestamptz default now()
);
alter table public.yt_veri enable row level security;
drop policy if exists "acik erisim" on public.yt_veri;
create policy "acik erisim" on public.yt_veri for all
  to anon using (true) with check (true);
alter publication supabase_realtime add table public.yt_veri;`;

const Bulut = {
  client: null, aktif: false, kanal: null, beklet: null, sonImza: null, _sonNonce: null, durum: 'kapali', hataMesaj: '',

  // Varsayılan bağlantı — her cihazda otomatik; ayrıca elle de girilebilir
  VARSAYILAN: { url: 'https://crafkujmefxhbakgfxcb.supabase.co', anonKey: 'sb_publishable_Yvh-8kLSB_2nXcZk1VtYsQ_z5wzmdBV' },
  ayarOku() {
    if (localStorage.getItem('yt_bulut_kapali')) return null;   // kullanıcı elle kaldırdıysa
    try { const c = JSON.parse(localStorage.getItem('yt_supabase')); if (c && c.url && c.anonKey) return c; } catch {}
    return (this.VARSAYILAN.url && this.VARSAYILAN.anonKey) ? this.VARSAYILAN : null;
  },
  ayarKaydet(cfg) {
    if (cfg) { localStorage.setItem('yt_supabase', JSON.stringify(cfg)); localStorage.removeItem('yt_bulut_kapali'); }
    else { localStorage.removeItem('yt_supabase'); localStorage.setItem('yt_bulut_kapali', '1'); }   // varsayılana geri dönmesin
  },

  async kutuphane() {
    if (window.supabase && window.supabase.createClient) return window.supabase;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = res;
      s.onerror = () => rej(new Error('Supabase kütüphanesi yüklenemedi (internet bağlantısını kontrol edin).'));
      document.head.appendChild(s);
    });
    if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase kütüphanesi yüklenemedi.');
    return window.supabase;
  },

  async baglan(cfg) {
    const lib = await this.kutuphane();
    this.client = lib.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } });
    this.aktif = true; this.durum = 'bagli'; this.hataMesaj = '';
    return this.client;
  },
  kapat() {
    try { if (this.kanal && this.client) this.client.removeChannel(this.kanal); } catch {}
    this.client = null; this.kanal = null; this.aktif = false; this.durum = 'kapali';
  },

  paket() {
    const d = { surum: 1, guncelleme: new Date().toISOString(), _nonce: yeniId() };
    for (const k of KOLEKSIYONLAR) d[k] = DB._oku(k);
    d.ayarlar = DB.ayarOku();
    return d;
  },
  uygula(data) {
    if (!data) return;
    for (const k of KOLEKSIYONLAR) if (Array.isArray(data[k])) localStorage.setItem('yt_' + k, JSON.stringify(data[k]));
    if (data.ayarlar) localStorage.setItem('yt_ayarlar', JSON.stringify(data.ayarlar));
  },

  async cek() {
    const { data, error } = await this.client.from('yt_veri').select('data,guncelleme').eq('id', 'ana').maybeSingle();
    if (error) throw error;
    return data;   // {data, guncelleme} | null
  },
  async gonder() {
    if (!this.client) return;
    const paket = this.paket();
    this.sonImza = paket.guncelleme;   // echo yarışını önle: kendi imzamızı push'tan önce yaz
    this._sonNonce = paket._nonce;     // realtime echo'yu nonce ile kesin ayıkla
    const { error } = await this.client.from('yt_veri').upsert({ id: 'ana', data: paket, guncelleme: paket.guncelleme });
    if (error) throw error;
  },
  itPlanla() {
    if (!this.aktif || this._uzaktan) return;   // uzaktan gelen veriyi geri gönderme (döngü engeli)
    clearTimeout(this.beklet);
    this.beklet = setTimeout(() => { this.gonder().catch(e => console.warn('Bulut gönderme hatası:', e.message)); }, 900);
  },

  realtimeKur() {
    if (!this.client) return;
    try {
      if (this.kanal) this.client.removeChannel(this.kanal);
      this.kanal = this.client.channel('yt_veri_rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'yt_veri', filter: 'id=eq.ana' }, (p) => {
          const d = p.new && p.new.data;
          if (!d) return;
          // Kendi yazdığımız değişikliği kesin ayıkla (nonce; timestamp formatı sunucuda farklılaşabiliyor)
          if (d._nonce && d._nonce === this._sonNonce) return;
          this.sonImza = p.new.guncelleme;
          this._uzaktan = true;                    // bu apply push tetiklemesin
          this.uygula(d);
          veriYukle().then(() => {
            this._uzaktan = false;
            const r = SAYFALAR[State.aktifSayfa];  // sadece içerik yenile — menü/akordeon bozulmasın
            if (r) try { r(); } catch {}
          }).catch(() => { this._uzaktan = false; });
        }).subscribe();
    } catch (e) { console.warn('Realtime kurulamadı:', e.message); }
  },

  // Açılışta bağlıysa buluttan çek; bulut boşsa yereli gönder
  async baslangicSenkron() {
    const cfg = this.ayarOku();
    if (!cfg || !cfg.url || !cfg.anonKey) return false;
    try {
      await this.baglan(cfg);
      const row = await this.cek();
      if (row && row.data) { this.uygula(row.data); this.sonImza = row.guncelleme; this._sonNonce = row.data._nonce || null; }
      else { await this.gonder(); }
      this.realtimeKur();
      return true;
    } catch (e) {
      this.durum = 'hata'; this.hataMesaj = e.message;
      console.warn('Bulut başlangıç senkron hatası:', e.message);
      return false;
    }
  },
};
window._Bulut = Bulut;

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
const APP_SURUM = '179';
const APP_SURUM_TARIH = '25 Ağu 2026';
const APP_SURUM_SAAT = '22:20';

/* Giriş yapan kullanıcı yönetici (admin) mi? */
function adminMi() { return !!(State.kullanici && State.kullanici.rol === 'admin'); }
/* Giriş yapan kullanıcı bir ortaksa onun id'si; admin/eşleşmeyen için null */
function aktifOrtakId() { return (State.kullanici && State.kullanici.ortakId) || null; }
/* Ortak girişinde: diğer ortakların verilerini de göster? (varsayılan AÇIK — ortaklar tüm veriyi görür;
   👥 düğmesiyle geçici olarak yalnız kendi verisine daraltabilir) */
let ortakGoster = true;
function hepsiniGor() { return adminMi() || ortakGoster; }   // true → tüm ortakların verisi
function benId() { return aktifOrtakId(); }                    // giriş yapan ortağın id'si
/* Sayfa üst barındaki "Ortakları göster" düğmesi (yalnızca ortak girişinde) */
function ortakGosterBtnHTML() { return adminMi() ? '' : `<button type="button" class="ort-tgl ikon ${ortakGoster ? 'on' : ''}" id="ortGosterBtn" title="Ortakları göster" aria-label="Ortakları göster"><span class="ico">👥</span><span class="sw"><i></i></span></button>`; }
function ortakGosterBtnBagla(yenile) { const b = document.getElementById('ortGosterBtn'); if (b) b.onclick = () => { ortakGoster = !ortakGoster; yenile(); }; }

/* Tüm koleksiyonları State'e yükle */
async function veriYukle() {
  // Eski koleksiyonları temizle — yalnızca ortak adı + fotoğrafı kalsın
  let temizlik = false;
  ESKI_KOLEKSIYONLAR.forEach(k => { if (localStorage.getItem('yt_' + k) !== null) { localStorage.removeItem('yt_' + k); temizlik = true; } });
  // Ortakları sadeleştir (id + ad + foto)
  const ham = DB._oku('ortaklar');
  const temiz = ham.map(o => ({ id: o.id, ad: o.ad, foto: o.foto || null, aktif: o.aktif !== false, girisAd: o.girisAd || null, sifreHash: o.sifreHash || null, girisAktif: o.girisAktif !== false }));
  const degisti = JSON.stringify(ham) !== JSON.stringify(temiz);
  if (degisti) DB._yaz('ortaklar', temiz);   // bu aynı zamanda buluta temiz veriyi gönderir
  else if (temizlik && window._Bulut) window._Bulut.itPlanla();
  State.ortaklar = temiz;
  State.giderler = DB._oku('giderler');
  State.giderGruplari = DB._oku('giderGruplari');
  State.giderKayitlari = DB._oku('giderKayitlari');
  State.uyelikler = DB._oku('uyelikler');
  State.ogrenciler = DB._oku('ogrenciler');
  State.dersler = DB._oku('dersler');
  State.odemeler = DB._oku('odemeler');
  State.talepler = DB._oku('talepler');
  State.studyolar = DB._oku('studyolar');
  State.planformiTahsilat = DB._oku('planformiTahsilat');
  State.bankaHareketleri = DB._oku('bankaHareketleri');
  State.eslesmeler = DB._oku('eslesmeler');
  State.kategoriKurallari = DB._oku('kategoriKurallari');
  State.hesaplar = []; State.islemler = []; State.komisyonlar = []; State.karPayi = [];
  State.kullanicilar = []; State.potansiyel = []; State.musteriler = [];
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
  { id: 'dashboard', ad: 'Panel', ikon: 'panel', baslik: 'Finans Paneli' },
  { grup: 'Muhasebe', ikon: 'muhasebe', ogeler: [
    { id: 'ice-aktar', ad: 'İçe Aktar', ikon: 'indir', baslik: 'İçe Aktar' },
    { id: 'mutabakat', ad: 'Tahsilat Tanımla', ikon: 'onay', baslik: 'Tahsilat Tanımla' },
    { id: 'hesap-defter', ad: 'Hesaplar', ikon: 'muhasebe', baslik: 'Hesaplar' },
    { id: 'karlilik', ad: 'Kârlılık', ikon: 'ortaklar', baslik: 'Eğitmen / Ortak Kârlılığı' },
    { id: 'giderler', ad: 'Giderler', ikon: 'gider', baslik: 'Giderler' },
  ] },
  { grup: 'Ayarlar', ikon: 'ayarlar', ogeler: [
    { id: 'ayar-tanimlama', ad: 'Tanımlamalar', ikon: 'tanimlar', baslik: 'Tanımlamalar' },
  ] },
  // Operasyonel (Plan4me'de yönetiliyor) — menüde gizli, kod dursun:
  { id: 'ders-takibi', ad: 'Ders Takibi', ikon: 'hedef', baslik: 'Ders Takibi', gizli: true },
];
// Menüde olmayan alt sayfaların üst başlıkları
const SAYFA_BASLIK = { 'gelirler': 'Gelirler', 'tanim-gider': 'Giderler', 'tanim-egitmen': 'Eğitmen → Ortak Eşleme', 'tanim-kategori': 'Banka Gider Kategorileri', 'tanim-komisyon': 'Kart Komisyon Oranları', 'ayar-firma': 'Firma Bilgileri', 'ayar-ortak': 'Ortak Bilgileri', 'ayar-vergi': 'Vergi / KDV Oranı', 'ayar-giris-kul': 'Kullanıcı Girişleri', 'odemeler': 'Tahsilatlar', 'giderler': 'Giderler', 'ortaklar': 'Ortaklar' };
// Tanımlamalar hub'ından açılan alt sayfalar (menüde 'Tanımlamalar' vurgulu kalsın)
const TANIM_ALT = ['ayar-firma', 'ayar-ortak', 'tanim-egitmen', 'tanim-gider', 'tanim-kategori', 'tanim-komisyon', 'ayar-vergi', 'ayar-giris-kul'];

// Hesaplar kart sayfası — "Hesaplar"a basınca açılan 6 kart
const HESAP_GRUP_SIRA = ['Para Hesapları', 'Gelir · Gider · Ortak'];
const HESAP_KARTLARI = [
  { id: 'hesap-banka', grup: 'Para Hesapları',        ad: 'Banka Hesabı',    baslik: 'Bankalar',              ikon: '🏦', aciklama: 'Banka işlemlerini izleyin' },
  { id: 'hesap-kk',    grup: 'Para Hesapları',        ad: 'Kredi Kartı',     baslik: 'Kredi Kartı Hesapları', ikon: '💳', aciklama: 'Kart harcamalarını izleyin' },
  { id: 'hesap-kasa',  grup: 'Para Hesapları',        ad: 'Kasa',            baslik: 'Kasa',                  ikon: '💵', aciklama: 'Nakit giriş-çıkışları' },
  { id: 'hesap-gider', grup: 'Gelir · Gider · Ortak', ad: 'Giderler Hesabı', baslik: 'Giderler Hesabı',       ikon: '📉', aciklama: 'Giderleri kalem kalem', gizli: true },
  { id: 'hesap-gelir', grup: 'Gelir · Gider · Ortak', ad: 'Gelirler Hesabı', baslik: 'Gelirler Hesabı',       ikon: '📈', aciklama: 'Gelirleri kalem kalem', gizli: true },
  { id: 'hesap-ortak', grup: 'Gelir · Gider · Ortak', ad: 'Ortaklar Hesabı', baslik: 'Ortaklar Hesabı',       ikon: '🤝', aciklama: 'Hak ediş ve ödemeler', gizli: true },
  { id: 'plan4me',     grup: 'Müşteri & Planlama',    ad: 'Plan4Me',         baslik: 'Plan4Me — Ders Kayıtları', ikon: '🧘', aciklama: 'Ders gelirlerini gir', gizli: true },
  { id: 'musteriler',  grup: 'Müşteri & Planlama',    ad: 'Müşteriler',      baslik: 'Müşteriler',            ikon: '👥', aciklama: 'Ders / ödeme / borç (cari)', gizli: true },
  { id: 'potansiyel',  grup: 'Müşteri & Planlama',    ad: 'Potansiyel Müşteriler', baslik: 'Potansiyel Müşteriler', ikon: '🌱', aciklama: 'İlgilenenleri takip et', gizli: true },
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
/* ---- Uygulamaya özel elle çizilmiş SVG ikon kütüphanesi (emoji yerine) ---- */
const IK = {
  panel: '<rect x="3" y="12" width="4" height="8" rx="1.2" fill="currentColor" opacity=".3"/><rect x="3" y="12" width="4" height="8" rx="1.2" stroke="currentColor" stroke-width="1.7"/><rect x="10" y="7" width="4" height="13" rx="1.2" stroke="currentColor" stroke-width="1.7"/><rect x="17" y="4" width="4" height="16" rx="1.2" fill="currentColor" opacity=".3"/><rect x="17" y="4" width="4" height="16" rx="1.2" stroke="currentColor" stroke-width="1.7"/>',
  hedef: '<circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.4" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  dersler: '<rect x="3.5" y="5" width="17" height="15" rx="3" fill="currentColor" opacity=".26"/><rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9.5h17M8 3.2v3.4M16 3.2v3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7.5 13h3M7.5 16.3h3M13.5 13h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  ogrenci: '<path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" fill="currentColor" opacity=".26"/><path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6.5 10.5v4c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-4M21.5 8.5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  muhasebe: '<path d="M5 4.5h9a2.5 2.5 0 0 1 2.5 2.5V20H7.5A2.5 2.5 0 0 1 5 17.5V4.5Z" fill="currentColor" opacity=".24"/><path d="M6.5 4.5h9A2.5 2.5 0 0 1 18 7v12.5H8A1.5 1.5 0 0 1 6.5 18V4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.5 8.5h5M9.5 11.5h5M9.5 14.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ortaklar: '<circle cx="8.5" cy="8.5" r="2.8" fill="currentColor" opacity=".28"/><circle cx="8.5" cy="8.5" r="2.8" stroke="currentColor" stroke-width="1.6"/><circle cx="16" cy="9.5" r="2.3" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 18.5c0-2.8 2.2-4.7 5-4.7s5 1.9 5 4.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14.6 14.1c2.3-.2 4.2 1.4 4.6 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  raporlar: '<path d="M4 19V5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 19h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7 15l3.5-4 3 2.5L20 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 11V7h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  ayarlar: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  tanimlar: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.2l1.8 2h8a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-9.5Z" fill="currentColor" opacity=".24"/><path d="M3.5 7.5a2 2 0 0 1 2-2h3.2l1.8 2h8a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  hakedis: '<path d="M9 3h6l-1.2 2.2a5.5 5.5 0 0 1 3.7 5.2c0 3.6-2.9 6.4-5.5 6.4S6.5 14 6.5 10.4A5.5 5.5 0 0 1 10.2 5.2L9 3Z" fill="currentColor" opacity=".26"/><path d="M9 3h6l-1.2 2.2a5.5 5.5 0 0 1 3.7 5.2c0 3.6-2.9 6.4-5.5 6.4S6.5 14 6.5 10.4A5.5 5.5 0 0 1 10.2 5.2L9 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 8.6v4.8M10.4 9.6c0-.8.7-1.3 1.6-1.3s1.6.5 1.6 1.3M10.4 11.9c0 .8.7 1.3 1.6 1.3s1.6-.5 1.6-1.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  kisi: '<circle cx="12" cy="8" r="3.4" fill="currentColor" opacity=".28"/><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19.5c0-3.4 3-5.6 6.5-5.6s6.5 2.2 6.5 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  para: '<ellipse cx="12" cy="6.6" rx="6.8" ry="2.6" fill="currentColor" opacity=".24"/><ellipse cx="12" cy="6.6" rx="6.8" ry="2.6" stroke="currentColor" stroke-width="1.6"/><path d="M5.2 6.6v6c0 1.4 3 2.6 6.8 2.6s6.8-1.2 6.8-2.6v-6" stroke="currentColor" stroke-width="1.6"/><path d="M5.2 9.6c0 1.4 3 2.6 6.8 2.6s6.8-1.2 6.8-2.6" stroke="currentColor" stroke-width="1.6"/>',
  firma: '<rect x="4.5" y="3.5" width="9" height="17" rx="1.5" fill="currentColor" opacity=".24"/><rect x="4.5" y="3.5" width="9" height="17" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M13.5 8.5h5a1.5 1.5 0 0 1 1.5 1.5v10.5h-6.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 7h4M7 10.5h4M7 14h4M16 12h1.5M16 15.5h1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  uyelik: '<path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" fill="currentColor" opacity=".24"/><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v1.5M12 11.2v1.6M12 14.5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  gider: '<rect x="3.5" y="8" width="17" height="12" rx="2.5" fill="currentColor" opacity=".22"/><rect x="3.5" y="8" width="17" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17" stroke="currentColor" stroke-width="1.6"/><path d="M7 5.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 14.5v3M10.5 16h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  kullanici: '<circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/><path d="m11 11 8 8M16 20l3-3M19 17l2 .5-.5-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  ders: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v14H6.5A2.5 2.5 0 0 0 4 20.5V6.5Z" fill="currentColor" opacity=".22"/><path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v14h5.5A2.5 2.5 0 0 1 20 20.5V6.5Z" fill="currentColor" opacity=".22"/><path d="M12 5.2C11 4.4 9.6 4 8 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H8c1.6 0 3 .4 4 1.2m0-16C13 4.4 14.4 4 16 4h2.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H16c-1.6 0-3 .4-4 1.2m0-16v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  banka: HESAP_IKON.banka, kasa: HESAP_IKON.kasa, kart: HESAP_IKON.kart, kartBorc: HESAP_IKON.kart,
  onay: '<circle cx="12" cy="12" r="8.5" fill="currentColor" opacity=".22"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="m8.3 12.2 2.6 2.6 4.8-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  sure: '<circle cx="12" cy="12" r="8.3" fill="currentColor" opacity=".2"/><circle cx="12" cy="12" r="8.3" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  bolme: '<path d="M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.5" fill="currentColor"/><circle cx="12" cy="16.5" r="1.5" fill="currentColor"/>',
  ara: '<circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="1.8"/><path d="m15 15 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  grup: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.2l1.8 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-9Z" fill="currentColor" opacity=".22"/><path d="M3.5 7.5a2 2 0 0 1 2-2h3.2l1.8 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  yeni: '<path d="M12 20v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 13c0-3 2.2-5.2 5.5-5.2C17.5 11 15.3 13 12 13Z" fill="currentColor" opacity=".26"/><path d="M12 13c0-3 2.2-5.2 5.5-5.2C17.5 11 15.3 13 12 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 13c0-3.2-2.2-5.5-5.5-5.5C6.5 11 8.7 13 12 13Z" fill="currentColor" opacity=".26"/><path d="M12 13c0-3.2-2.2-5.5-5.5-5.5C6.5 11 8.7 13 12 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  anahtar: '<circle cx="8" cy="8" r="4" fill="currentColor" opacity=".22"/><circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/><path d="m11 11 8 8M16 20l3-3M19 17l2 .5-.5-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  belge: '<path d="M6 3.5h7l5 5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" fill="currentColor" opacity=".22"/><path d="M6 3.5h7l5 5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 3.5V8.5h5M8 12.5h8M8 15.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  kaydet: '<path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  link: '<path d="M9.5 14.5 14.5 9.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M11 7.5 12.6 6a3.6 3.6 0 0 1 5.1 5.1l-1.6 1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13 16.5 11.4 18a3.6 3.6 0 0 1-5.1-5.1l1.6-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  cop: '<path d="M6 7h12M9.5 7V5.6A1.2 1.2 0 0 1 10.7 4.4h2.6A1.2 1.2 0 0 1 14.5 5.6V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" fill="currentColor" opacity=".2"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.3 10.5v6M13.7 10.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  gelir: HESAP_IKON.gelir, gidertrend: HESAP_IKON.gider,
  ok: '<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  geri: '<path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  destek: '<path d="M4 13a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="12.5" width="4.2" height="6.7" rx="1.6" fill="currentColor" opacity=".24"/><rect x="3" y="12.5" width="4.2" height="6.7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="16.8" y="12.5" width="4.2" height="6.7" rx="1.6" fill="currentColor" opacity=".24"/><rect x="16.8" y="12.5" width="4.2" height="6.7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M20 19.2v.3a2.5 2.5 0 0 1-2.5 2.5H13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  guncel: '<path d="M20 12a8 8 0 1 1-2.3-5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 4v4h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  kalem: '<path d="M4 20h4l10.5-10.5a2 2 0 0 0-3-3L5 17v3Z" fill="currentColor" opacity=".18"/><path d="M4 20h4l10.5-10.5a2 2 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13.5 6.5l3.9 3.9" stroke="currentColor" stroke-width="1.6"/>',
  indir: '<rect x="5" y="2.5" width="14" height="19" rx="2.5" fill="currentColor" opacity=".16"/><rect x="5" y="2.5" width="14" height="19" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5v6M9.2 10.8 12 13.6l2.8-2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  uyari: '<circle cx="12" cy="12" r="9" fill="currentColor" opacity=".16"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5v5.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="16.3" r="1.1" fill="currentColor"/>',
  studyo: '<path d="M5 20V5.6A1.6 1.6 0 0 1 6.6 4h8.8A1.6 1.6 0 0 1 17 5.6V20" fill="currentColor" opacity=".2"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M5 20V5.6A1.6 1.6 0 0 1 6.6 4h8.8A1.6 1.6 0 0 1 17 5.6V20" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="13.5" cy="12.5" r="1.1" fill="currentColor"/>',
  filtre: '<path d="M4 5.5h16l-6.2 7.4v5.1l-3.6 1.8v-6.9L4 5.5Z" fill="currentColor" opacity=".2"/><path d="M4 5.5h16l-6.2 7.4v5.1l-3.6 1.8v-6.9L4 5.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  arti: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
};
/* İkon SVG'si üretir. cls: ekstra sınıf. */
function ik(ad, cls) { return `<svg class="uik${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${IK[ad] || ''}</svg>`; }
/* Modal başlığı sağındaki premium rozet: altın tile ikon + etiket */
function rozetHTML(ikAd, etiket) { return `<span class="hr-rozet"><span class="hr-rz-ik">${ik(ikAd)}</span>${kacar(etiket)}</span>`; }
/* Hesap tipi (banka/kasa/krediKarti/ortak/gider/gelir) → ik ikon adı */
const HESAP_TIP_IK = { banka: 'banka', kasa: 'kasa', krediKarti: 'kart', ortak: 'ortaklar', gider: 'gider', gelir: 'gelir' };

function menuCiz() {
  const nav = $('#anaMenu');
  const sadeceOrtak = !adminMi();   // ortak: Tanımlamalar hub'ı açık ama içinde yalnız Üyelikler + Giderler görünür
  let html = '';
  for (const m of MENU) {
    if (m.gizli) continue;
    if (sadeceOrtak && m.sadeceAdmin) continue;   // sadeceAdmin gruplar ortağa kapalı
    if (m.grup) {
      const ogeler = m.ogeler.filter(o => !o.gizli && (!o.sadeceAdmin || adminMi()));
      if (!ogeler.length) continue;
      html += `<div class="menu-grup">
        <button type="button" class="grup-baslik">
          <span class="ikon">${ik(m.ikon)}</span>
          <span class="gad">${kacar(m.grup)}</span>
          <span class="ok">▸</span>
        </button>
        <div class="menu-alt"><div class="ic">
          ${ogeler.map(o => `<button class="menu-oge" data-sayfa="${o.id}"><span class="ikon">${ik(o.ikon)}</span>${kacar(o.ad)}</button>`).join('')}
        </div></div>
      </div>`;
    } else {
      html += `<button class="menu-oge tekil" data-sayfa="${m.id}"><span class="ikon">${ik(m.ikon)}</span>${kacar(m.ad)}</button>`;
    }
  }
  if (adminMi()) html += `<button class="menu-oge tekil" id="menuKontrol"><span class="ikon">${ik('onay')}</span>Kontrol Listesi</button>`;   // yalnızca admin
  nav.innerHTML = html;
  // Akordeon: grup başlığına basınca aç/kapa; biri açılınca diğerleri kapanır
  $$('.grup-baslik', nav).forEach(b => b.onclick = () => {
    const grup = b.parentElement;
    const acikti = grup.classList.contains('acik');
    $$('.menu-grup', nav).forEach(g => g.classList.remove('acik'));
    if (!acikti) grup.classList.add('acik');
  });
  $$('.menu-oge', nav).forEach(b => { if (b.dataset.sayfa) b.onclick = () => git(b.dataset.sayfa); });
  { const mk = $('#menuKontrol'); if (mk) mk.onclick = () => { kontrolAc(); document.body.classList.remove('menu-acik'); }; }
  const ks = $('#kenarSurum');
  if (ks) {
    ks.innerHTML = `<div class="ks-bilg"><b>Sürüm ${APP_SURUM}</b><span>${APP_SURUM_TARIH} · ${APP_SURUM_SAAT}</span></div><button type="button" class="ks-guncelle" id="ksGuncelle" title="En güncel sürümü getir">⟳</button>`;
    $('#ksGuncelle').onclick = () => enGuncelSurumuGetir();
  }
}

function menuBul(id) {
  for (const m of MENU) {
    if (m.id === id) return m;
    if (m.ogeler) { const o = m.ogeler.find(x => x.id === id); if (o) return o; }
  }
  if (SAYFA_BASLIK[id]) return { baslik: SAYFA_BASLIK[id] };
  const k = HESAP_KARTLARI.find(x => x.id === id);
  if (k) return k;
  return null;
}

function git(sayfa) {
  // Dersler / Öğrenciler / Stüdyolar → tek "Ders Takibi" ekranında ilgili sekme
  if (sayfa === 'dersler' || sayfa === 'ogrenciler' || sayfa === 'studyolar') { dtSekme = sayfa; sayfa = 'ders-takibi'; }
  State.aktifSayfa = sayfa;
  const m = menuBul(sayfa) || { baslik: '—' };
  $('#sayfaBaslik').textContent = m.baslik;
  // Hesap kart sayfaları menüde tekil "Hesaplar" öğesini aktif tutar
  // (Ortaklar Hesabı'nın kenar menüde kendi öğesi var — hariç tut)
  const hesapKartMi = HESAP_KARTLARI.some(k => k.id === sayfa) && sayfa !== 'hesap-ortak';
  const vurgulanan = hesapKartMi ? 'hesaplar' : (TANIM_ALT.includes(sayfa) ? 'ayar-tanimlama' : sayfa);
  $$('.menu-oge').forEach(b => b.classList.toggle('aktif', b.dataset.sayfa === vurgulanan));
  // Aktif alt sayfanın grubunu aç, diğerlerini kapat (akordeon)
  $$('.menu-grup').forEach(g => {
    const icerir = Array.from(g.querySelectorAll('.menu-oge')).some(b => b.dataset.sayfa === sayfa || b.dataset.sayfa === vurgulanan);
    g.classList.toggle('acik', icerir);
  });
  document.body.classList.remove('menu-acik');
  if (typeof altMenuGuncelle === 'function') altMenuGuncelle();
  const render = SAYFALAR[sayfa] || SAYFALAR.dashboard;
  render(m);
  tabloSigdir();   // tabloları BOYA ÖNCESİ ölçekle → büyük tablo bir an görünüp küçülmez (titreme yok)
  // Yumuşak sayfa geçişi (fade + hafif yukarı kayma) — her sayfa değişiminde
  const el = ic();
  if (el) { el.classList.remove('sayfa-gir'); void el.offsetWidth; el.classList.add('sayfa-gir'); el.scrollTop = 0; }
  const ana = document.querySelector('.ana'); if (ana) ana.scrollTop = 0;
}
window.git = git;

/* Mobilde geniş tabloları PC boyutundan ekrana ORANTILI küçült (transform scale) — kırpma/yatay kaydırma yok */
function tabloSigdir() {
  const mobil = window.innerWidth <= 640;
  document.querySelectorAll('.ogr-kaydir, .tablo-sar').forEach(w => {
    const t = w.querySelector('table'); if (!t) return;
    t.style.transform = ''; w.style.height = '';           // önce sıfırla, doğal ölçüyü oku
    if (!mobil) return;
    const dogal = t.offsetWidth, kap = w.clientWidth;
    if (dogal > kap + 1) {
      const s = kap / dogal;
      t.style.transform = `scale(${s})`;
      w.style.height = Math.ceil(t.offsetHeight * s) + 'px';
    }
  });
}
let _tsZ;
function tabloSigdirGec() { clearTimeout(_tsZ); _tsZ = setTimeout(tabloSigdir, 40); }
window.addEventListener('resize', tabloSigdirGec);
(function () {
  const el = document.getElementById('icerik');
  // Sayfa-içi yeniden çizimlerde (arama, sekme) tabloları BOYA ÖNCESİ (senkron microtask) ölçekle → titreme yok
  if (el && 'MutationObserver' in window) new MutationObserver(() => tabloSigdir()).observe(el, { childList: true, subtree: true });
})();

/* ==========================================================
   5) SAYFALAR
   ========================================================== */
const SAYFALAR = {};
const ic = () => $('#icerik');

/* ---- Yeni muhasebe ekranları — iskelet (F2–F4'te doldurulacak) ---- */
function fazPlaceholder(baslik, aciklama, ikonAd) {
  ic().innerHTML = `
    <div class="faz-bos">
      <div class="faz-ik">${ik(ikonAd || 'belge')}</div>
      <h3>${kacar(baslik)}</h3>
      <p>${kacar(aciklama)}</p>
    </div>`;
}
/* ==========================================================
   KÂRLILIK — eğitmen/ortak bazlı P&L (Plan4me + Banka + eşleşmeler)
   ========================================================== */
// Bir Plan4me eğitmen adını → ortak eşlemesi / maaşlı dağıtımı çöz
function egitmenCoz(egitmenAd) {
  const map = (State.ayarlar && State.ayarlar.egitmenMap) || {};
  const m = map[adNorm(egitmenAd)];
  if (m && m.rol) return m;
  const o = State.ortaklar.find(x => adNorm(x.ad) === adNorm(egitmenAd) && x.aktif !== false);  // ad birebir eşleşirse ortak
  if (o) return { rol: 'ortak', ortakId: o.id };
  return { rol: 'maasli', dagitim: 'bekliyor' };   // haritada yoksa: dağıtılmadan ayrı gösterilir
}
// Plan4me'de görülen tüm eğitmen adları (eşleme ekranı için)
function planformiEgitmenler() {
  const s = new Map();
  (State.planformiTahsilat || []).forEach(p => { const k = adNorm(p.egitmenAd); if (!s.has(k)) s.set(k, baslikHarf(p.egitmenAd || '—')); });
  return [...s.entries()].map(([k, ad]) => ({ k, ad })).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
}
function egitmenKarlilik(donem) {
  const pf = (State.planformiTahsilat || []).filter(p => donemStr(p.tarih) === donem);
  const bh = (State.bankaHareketleri || []).filter(b => donemStr(b.tarih) === donem);
  const es = State.eslesmeler || [];
  const bhTum = State.bankaHareketleri || [];
  const ortaklar = State.ortaklar.filter(o => o.aktif !== false);
  const vOran = (typeof vergiOrani === 'function' ? vergiOrani() : 20) / 100;
  const pMap = {}; ortaklar.forEach(o => pMap[o.id] = { id: o.id, ad: o.ad, ortakMi: true, brut: 0, nakit: 0, havale: 0, kart: 0, komisyon: 0, havuzPayi: 0 });
  const mMap = {};
  const maasli = (ad) => { const k = adNorm(ad); if (!mMap[k]) { const c = egitmenCoz(ad); mMap[k] = { ad: baslikHarf(ad || '—'), brut: 0, nakit: 0, havale: 0, kart: 0, komisyon: 0, dagitim: c.dagitim || 'bekliyor', hedefOrtakId: c.hedefOrtakId || null }; } return mMap[k]; };
  const hedef = (ad, alan, tutar) => { const c = egitmenCoz(ad); if (c.rol === 'ortak' && pMap[c.ortakId]) pMap[c.ortakId][alan] += tutar; else maasli(ad)[alan] += tutar; };
  for (const p of pf) { hedef(p.egitmenAd, 'brut', p.tutar); hedef(p.egitmenAd, p.tur === 'havale' ? 'havale' : p.tur === 'kart' ? 'kart' : 'nakit', p.tutar); }
  for (const e of es) { const brec = bhTum.find(x => x.id === (e.bankaIds || [])[0]); if (!brec || donemStr(brec.tarih) !== donem) continue; (e.dagitim || []).forEach(d => hedef(d.egitmenAd, 'komisyon', d.komisyon || 0)); }
  const genelGider = bh.filter(b => b.yon === 'gider').reduce((s, b) => s + Math.abs(b.tutar), 0);
  const giderPayi = ortaklar.length ? genelGider / ortaklar.length : 0;
  const huzur = bh.filter(b => b.yon === 'ortakOdeme');
  const odenen = {}; ortaklar.forEach(o => { odenen[o.id] = huzur.filter(h => isimGecer(h.aciklama, o.ad)).reduce((s, h) => s + Math.abs(h.tutar), 0); });
  // Maaşlı eğitmen netleri + dağıtım
  const maasliList = Object.values(mMap).map(m => { const vergi = Math.round((m.havale + m.kart) * vOran); return { ...m, vergi, net: m.brut - m.komisyon - vergi }; });
  maasliList.forEach(m => {
    if (m.dagitim === 'havuz' && ortaklar.length) { const pay = m.net / ortaklar.length; ortaklar.forEach(o => pMap[o.id].havuzPayi += pay); }
    else if (m.dagitim === 'ortak' && m.hedefOrtakId && pMap[m.hedefOrtakId]) pMap[m.hedefOrtakId].havuzPayi += m.net;
  });
  const ortakList = ortaklar.map(o => {
    const a = pMap[o.id];
    const vergi = Math.round((a.havale + a.kart) * vOran);
    const net = a.brut - a.komisyon - giderPayi - vergi + a.havuzPayi;
    return { ...a, vergi, giderPayi, net, odenen: odenen[o.id] || 0, kalan: net - (odenen[o.id] || 0) };
  }).sort((x, y) => y.net - x.net);
  return { ortaklar: ortakList, egitmenler: maasliList.sort((a, b) => b.brut - a.brut), genelGider, giderPayi, vOran, huzurToplam: huzur.reduce((s, h) => s + Math.abs(h.tutar), 0) };
}
let karDonem = null;
SAYFALAR['karlilik'] = function karlilikSayfasi() {
  const donem = karDonem || buAy();
  const r = egitmenKarlilik(donem);
  const bosVeri = !(State.planformiTahsilat || []).length && !(State.bankaHareketleri || []).length;
  const gBrut = [...r.ortaklar, ...r.egitmenler].reduce((s, e) => s + e.brut, 0);
  const gKom = [...r.ortaklar, ...r.egitmenler].reduce((s, e) => s + e.komisyon, 0);
  const gNet = r.ortaklar.reduce((s, e) => s + e.net, 0);
  const sat = (l, v, cls = '') => `<div class="kar-sat"><span>${l}</span><b class="${cls}">${v}</b></div>`;
  const kirilim = (e) => `<div class="kar-kir"><span>Nakit ${TL(e.nakit)}</span><span>Havale ${TL(e.havale)}</span><span>Kart ${TL(e.kart)}</span></div>`;
  const ortAdBul = id => { const o = State.ortaklar.find(x => x.id === id); return o ? o.ad : '—'; };
  const ortakKart = (e) => `
    <div class="kar-kart">
      <div class="kar-bas"><span class="kar-ad">${kacar(e.ad)}</span><span class="kar-net ${e.net < 0 ? 'negatif' : 'pozitif'}">${TL(e.net)}</span></div>
      ${kirilim(e)}
      ${sat('Brüt Tahsilat', TL(e.brut))}
      ${sat('Kart Komisyonu', e.komisyon ? '−' + TL(e.komisyon) : TL(0))}
      ${sat('Genel Gider Payı', e.giderPayi ? '−' + TL(e.giderPayi) : TL(0))}
      ${sat(`Vergi (havale+kart · %${Math.round(r.vOran * 100)})`, e.vergi ? '−' + TL(e.vergi) : TL(0), 'kar-vergi')}
      ${Math.abs(e.havuzPayi) > 0.5 ? sat('Havuz Payı (maaşlı)', (e.havuzPayi < 0 ? '−' : '+') + TL(Math.abs(e.havuzPayi))) : ''}
      ${sat('Net', TL(e.net), 'kar-net-b ' + (e.net < 0 ? 'negatif' : 'pozitif'))}
      ${e.odenen ? sat('Ödenen (huzur hakkı/payı)', '−' + TL(e.odenen)) + sat('Kalan Verilecek', TL(e.kalan), e.kalan < 0 ? 'negatif' : 'pozitif') : ''}
    </div>`;
  const dagitimEt = (m) => m.dagitim === 'havuz' ? '4 ortağa eşit' : m.dagitim === 'ortak' ? kacar(ortAdBul(m.hedefOrtakId)) : 'atanmadı';
  const maasKart = (e) => `
    <div class="kar-kart maasli">
      <div class="kar-bas"><span class="kar-ad">${kacar(e.ad)}</span><span class="kar-net">${TL(e.net)}</span></div>
      ${kirilim(e)}
      ${sat('Brüt Tahsilat', TL(e.brut))}
      ${e.komisyon ? sat('Kart Komisyonu', '−' + TL(e.komisyon)) : ''}
      ${e.vergi ? sat(`Vergi (havale+kart · %${Math.round(r.vOran * 100)})`, '−' + TL(e.vergi), 'kar-vergi') : ''}
      ${sat('Net', TL(e.net), 'kar-net-b')}
      <div class="kar-dagitim ${e.dagitim === 'bekliyor' ? 'bekliyor' : ''}">${ik('link')} Dağıtım: <b>${dagitimEt(e)}</b></div>
    </div>`;
  ic().innerHTML = `
    <div class="kar-sayfa">
      <div class="kar-ust"><h3 class="kar-baslik">Kârlılık</h3><div class="kar-ust-sag"><button type="button" class="btn btn-kucuk" id="karEsle">${ik('kisi')} Eğitmen Eşleme</button>${ayNavHTML(donem)}</div></div>
      ${bosVeri ? `<div class="faz-bos"><div class="faz-ik">${ik('ortaklar')}</div><h3>Kârlılık için veri yok</h3><p>Önce “İçe Aktar” ile Plan4me ve banka dosyalarını yükleyin, ardından “Mutabakat”ta eşleştirin.</p></div>` : `
      <div class="kar-genel">
        <div class="kg-kutu"><span>Brüt Tahsilat</span><b>${TL(gBrut)}</b></div>
        <div class="kg-kutu"><span>Komisyon</span><b>−${TL(gKom)}</b></div>
        <div class="kg-kutu"><span>Genel Gider</span><b>−${TL(r.genelGider)}</b></div>
        <div class="kg-kutu vurgu"><span>Ortak Net (toplam)</span><b class="${gNet < 0 ? 'negatif' : 'pozitif'}">${TL(gNet)}</b></div>
      </div>
      <div class="kar-bilgi">${ik('uyari')} Vergi = bankaya giren (havale+kart) tahsilatın <b>%${Math.round(r.vOran * 100)}</b>’si (nakit hariç); oran Ayarlar › Vergi/KDV Oranı’ndan değişir. Genel giderler ${r.ortaklar.length} ortağa eşit bölünür.</div>
      <h4 class="kar-grup">Ortaklar</h4>
      ${r.ortaklar.map(ortakKart).join('')}
      ${r.egitmenler.length ? `<h4 class="kar-grup">Maaşlı Eğitmenler <button type="button" class="kar-grup-esle" id="karEsle2">${ik('link')} eşleştir</button></h4>${r.egitmenler.map(maasKart).join('')}` : ''}`}
    </div>`;
  $$('#icerik .ay-nav [data-ay]').forEach(b => b.onclick = () => { karDonem = donemKaydir(donem, Number(b.dataset.ay)); karlilikSayfasi(); });
  const eb = $('#karEsle'), eb2 = $('#karEsle2'); if (eb) eb.onclick = () => git('tanim-egitmen'); if (eb2) eb2.onclick = () => git('tanim-egitmen');
};

/* ---- Gelirler — Plan4me tahsilatları (dönem listesi) ---- */
let gelirDonem = null;
SAYFALAR['gelirler'] = function gelirlerSayfasi() {
  const donem = gelirDonem || buAy();
  const kayitlar = (State.planformiTahsilat || []).filter(p => donemStr(p.tarih) === donem)
    .sort((a, b) => ((b.tarih || '') + (b.saat || '')).localeCompare((a.tarih || '') + (a.saat || '')));
  const topla = (arr) => arr.reduce((s, p) => s + (Number(p.tutar) || 0), 0);
  const bru = topla(kayitlar), nak = topla(kayitlar.filter(p => p.tur === 'nakit')), hav = topla(kayitlar.filter(p => p.tur === 'havale')), krt = topla(kayitlar.filter(p => p.tur === 'kart'));
  const turRoz = (t) => { const m = { nakit: 'rz-kasa', havale: 'rz-banka', kart: 'rz-kk' }; return `<span class="rozet-etk ${m[t] || 'rz-notr'}">${t}</span>`; };
  ic().innerHTML = `
    <div class="kar-sayfa">
      <div class="kar-ust"><h3 class="kar-baslik">Gelirler</h3>${ayNavHTML(donem)}</div>
      <div class="kar-genel">
        <div class="kg-kutu vurgu"><span>Brüt Tahsilat</span><b>${TL(bru)}</b></div>
        <div class="kg-kutu"><span>Nakit</span><b>${TL(nak)}</b></div>
        <div class="kg-kutu"><span>Havale</span><b>${TL(hav)}</b></div>
        <div class="kg-kutu"><span>Kart</span><b>${TL(krt)}</b></div>
      </div>
      ${kayitlar.length ? `<div class="tablo-sar"><table class="tablo ogr-tablo"><thead><tr><th>Tarih</th><th>Eğitmen</th><th>Üye</th><th>Tür</th><th class="sag">Tutar</th></tr></thead><tbody>
        ${kayitlar.map(p => `<tr><td>${kacar(kisaTarih(p.tarih))}</td><td>${kacar(p.egitmenAd)}</td><td>${kacar(p.uyeAd)}</td><td>${turRoz(p.tur)}</td><td class="sag mono">${TL(p.tutar)}</td></tr>`).join('')}
      </tbody></table></div>`
      : `<div class="faz-bos"><div class="faz-ik">${ik('gelir')}</div><h3>Bu dönemde gelir yok</h3><p>“İçe Aktar” ile Plan4me tahsilatlarını yükleyin.</p></div>`}
    </div>`;
  $$('#icerik .ay-nav [data-ay]').forEach(b => b.onclick = () => { gelirDonem = donemKaydir(donem, Number(b.dataset.ay)); gelirlerSayfasi(); });
};

/* ---- Ayar: Banka gider kategorileri (kural editörü) ---- */
SAYFALAR['tanim-kategori'] = function kategoriKurallariSayfasi() {
  const kurallar = (State.kategoriKurallari || []).slice();
  const satir = (k) => `
    <div class="kk-satir">
      <input class="gp-inp kk-anahtar" placeholder="Anahtar kelime (örn. kira)" value="${kacar(k.anahtar || '')}">
      <span class="kk-ok">${ik('ok')}</span>
      <input class="gp-inp kk-kategori" placeholder="Kategori (örn. Kira)" value="${kacar(k.kategori || '')}">
      <button type="button" class="kk-sil" title="Sil">${ik('cop')}</button>
    </div>`;
  ic().innerHTML = `
    <div class="kk-sayfa">
      <div class="bilgi-kutu"><span class="ikon">${ik('belge')}</span><div>Banka ekstresi içe aktarılırken, işlem açıklamasında bu <b>anahtar kelimeler</b> geçen giderlere otomatik <b>kategori</b> önerilir.</div></div>
      <div id="kkListe">${kurallar.map(satir).join('')}</div>
      <div class="kk-arac">
        <button type="button" class="btn" id="kkEkle">${ik('yeni')} Kural Ekle</button>
        ${kurallar.length ? '' : `<button type="button" class="btn" id="kkVarsayilan">${ik('indir')} Varsayılanları Yükle</button>`}
      </div>
      <button type="button" class="btn btn-ana kk-kaydet" id="kkKaydet">${ik('kaydet')} Kaydet</button>
    </div>`;
  const liste = $('#kkListe');
  const yeniSatir = (k = {}) => { const t = document.createElement('template'); t.innerHTML = satir(k).trim(); liste.appendChild(t.content.firstChild); bagla(); };
  function bagla() { $$('.kk-sil', liste).forEach(b => b.onclick = () => b.closest('.kk-satir').remove()); }
  bagla();
  $('#kkEkle').onclick = () => yeniSatir();
  const vb = $('#kkVarsayilan'); if (vb) vb.onclick = () => { VARSAYILAN_KATEGORI_KURAL.forEach(k => yeniSatir(k)); vb.remove(); };
  $('#kkKaydet').onclick = async () => {
    const yeni = [...liste.querySelectorAll('.kk-satir')].map(s => ({ anahtar: s.querySelector('.kk-anahtar').value.trim(), kategori: s.querySelector('.kk-kategori').value.trim() })).filter(k => k.anahtar && k.kategori);
    for (const old of (State.kategoriKurallari || [])) await DB.sil('kategoriKurallari', old.id);
    await DB.topluEkle('kategoriKurallari', yeni);
    State.kategoriKurallari = DB._oku('kategoriKurallari');
    bildir('Kategori kuralları kaydedildi.', 'basari');
  };
};

/* ---- Ayar: Kart komisyon oranları (kart tipi bazlı — ileride kullanılacak altyapı) ---- */
SAYFALAR['tanim-komisyon'] = function komisyonOranlariSayfasi() {
  const k = (State.ayarlar && State.ayarlar.komisyonOranlari) || { debit: 0, kredi: 3.8, yurtdisi: 4.8 };
  const alan = (id, ad, v) => `<div class="form-alan"><label>${ad} (%)</label><input type="number" step="0.01" min="0" id="ko_${id}" value="${v}"></div>`;
  ic().innerHTML = `
    <div class="ko-sayfa" style="max-width:520px;margin:0 auto">
      <div class="bilgi-kutu"><span class="ikon">${ik('kart')}</span><div>Kart tipine göre <b>beklenen</b> komisyon oranları. Not: şu an komisyon bankadaki gerçek “Batch Komisyonu”ndan alınıp dağıtılıyor; bu oranlar ileride beklenen komisyonu karşılaştırmak için kullanılacak.</div></div>
      ${alan('debit', 'Debit Kart', k.debit)}
      ${alan('kredi', 'Kredi Kartı', k.kredi)}
      ${alan('yurtdisi', 'Yurt Dışı Kart', k.yurtdisi)}
      <button type="button" class="btn btn-ana" id="koKaydet">${ik('kaydet')} Kaydet</button>
    </div>`;
  $('#koKaydet').onclick = () => {
    const g = id => Math.max(0, parseFloat($('#ko_' + id).value) || 0);
    DB.ayarYaz({ ...State.ayarlar, komisyonOranlari: { debit: g('debit'), kredi: g('kredi'), yurtdisi: g('yurtdisi') } });
    bildir('Komisyon oranları kaydedildi.', 'basari');
  };
};

/* ---- Ayar: Eğitmen → Ortak eşleme (ad birebir tutmasa da doğru atıf) ---- */
function egitmenMevcutDeger(ad) {
  const m = ((State.ayarlar && State.ayarlar.egitmenMap) || {})[adNorm(ad)];
  if (m && m.rol === 'ortak') return 'ortak:' + m.ortakId;
  if (m && m.rol === 'maasli') return m.dagitim === 'havuz' ? 'maasli:havuz' : m.dagitim === 'ortak' ? 'maasli:ortak:' + m.hedefOrtakId : 'maasli:bekliyor';
  const o = State.ortaklar.find(x => adNorm(x.ad) === adNorm(ad) && x.aktif !== false);
  return o ? 'ortak:' + o.id : 'maasli:bekliyor';
}
SAYFALAR['tanim-egitmen'] = function egitmenEslemeSayfasi() {
  const ortaklar = State.ortaklar.filter(o => o.aktif !== false);
  const egitmenler = planformiEgitmenler();
  const opts = (sel) => {
    let h = '<optgroup label="Ortak (tahsilat bu ortağa yazılır)">';
    ortaklar.forEach(o => h += `<option value="ortak:${o.id}" ${sel === 'ortak:' + o.id ? 'selected' : ''}>${kacar(o.ad)}</option>`);
    h += '</optgroup><optgroup label="Maaşlı eğitmen (tahsilat havuza/ortağa)">';
    h += `<option value="maasli:havuz" ${sel === 'maasli:havuz' ? 'selected' : ''}>Maaşlı — 4 ortağa eşit</option>`;
    ortaklar.forEach(o => h += `<option value="maasli:ortak:${o.id}" ${sel === 'maasli:ortak:' + o.id ? 'selected' : ''}>Maaşlı — ${kacar(o.ad)}’a</option>`);
    h += `<option value="maasli:bekliyor" ${sel === 'maasli:bekliyor' ? 'selected' : ''}>Maaşlı — atanmadı</option></optgroup>`;
    return h;
  };
  ic().innerHTML = `
    <div class="ee-sayfa">
      <div class="tnm-scr-ust"><button type="button" class="tnm-geri" id="eeGeri">‹ Geri</button></div>
      <div class="bilgi-kutu"><span class="ikon">${ik('kisi')}</span><div>Plan4me’deki her <b>eğitmen adını</b> uygulamadaki bir ortağa bağlayın (ad birebir aynı olmasa da). Ortak olmayan eğitmenler <b>maaşlı</b> seçilir; tahsilatları 4 ortağa eşit (havuz) ya da belirli bir ortağa yazılır.</div></div>
      ${egitmenler.length ? `<div class="ee-liste">${egitmenler.map(e => `
        <div class="ee-satir" data-k="${kacar(e.k)}">
          <span class="ee-ad">${kacar(e.ad)}</span>
          <select class="gp-inp ee-sel">${opts(egitmenMevcutDeger(e.ad))}</select>
        </div>`).join('')}</div>
        <button type="button" class="btn btn-ana ee-kaydet" id="eeKaydet">${ik('kaydet')} Kaydet</button>`
      : `<div class="faz-bos"><div class="faz-ik">${ik('kisi')}</div><h3>Henüz eğitmen yok</h3><p>Önce “İçe Aktar” ile Plan4me dosyasını yükleyin.</p></div>`}
    </div>`;
  $('#eeGeri').onclick = () => git('karlilik');
  const kb = $('#eeKaydet'); if (kb) kb.onclick = () => {
    const map = {};
    $$('.ee-satir').forEach(s => {
      const k = s.dataset.k, v = s.querySelector('.ee-sel').value;
      if (v.startsWith('ortak:')) map[k] = { rol: 'ortak', ortakId: v.slice(6) };
      else if (v === 'maasli:havuz') map[k] = { rol: 'maasli', dagitim: 'havuz' };
      else if (v.startsWith('maasli:ortak:')) map[k] = { rol: 'maasli', dagitim: 'ortak', hedefOrtakId: v.slice(13) };
      else map[k] = { rol: 'maasli', dagitim: 'bekliyor' };
    });
    DB.ayarYaz({ ...State.ayarlar, egitmenMap: map });
    bildir('Eğitmen eşleme kaydedildi.', 'basari');
    git('karlilik');
  };
};

/* ==========================================================
   MUTABAKAT — Plan4me ↔ Banka eşleştirme motoru
   ========================================================== */
function gunFark(a, b) { const d = (new Date(a) - new Date(b)) / 86400000; return isNaN(d) ? 999 : d; }
function isimGecer(aciklama, ad) {
  const a = String(aciklama || '').toLocaleLowerCase('tr');
  const kelimeler = adNorm(ad).split(' ').filter(w => w.length >= 3);
  return kelimeler.length ? kelimeler.every(w => a.includes(w)) : false;
}
// Kayıtlı eşleşmeleri uygula + kalanları otomatik eşleştir → mutabakat raporu
function mutabakatAnaliz() {
  const pf = State.planformiTahsilat || [];
  const bh = State.bankaHareketleri || [];
  const es = State.eslesmeler || [];
  const esliPf = new Set(), esliBh = new Set();
  es.forEach(e => { (e.planformiIds || []).forEach(i => esliPf.add(i)); (e.bankaIds || []).forEach(i => esliBh.add(i)); });

  const batchlar = bh.filter(b => /batch yatan/i.test(b.islem) && !esliBh.has(b.id));
  const komisyonlar = bh.filter(b => b.yon === 'komisyon' && !esliBh.has(b.id)).map(k => ({ ...k, _used: false }));
  const havaleGelen = bh.filter(b => b.yon === 'gelir' && !/batch yatan/i.test(b.islem) && !esliBh.has(b.id));
  const pfKart = pf.filter(p => p.tur === 'kart' && !esliPf.has(p.id));
  const pfHavale = pf.filter(p => p.tur === 'havale' && !esliPf.has(p.id));

  const sonuc = { oneri: [], onayli: es, bankaYalniz: [], planformiYalniz: [] };
  const kullanilanPf = new Set();

  // --- KART / BATCH ---
  for (const batch of batchlar) {
    const adaylar = pfKart.filter(p => !kullanilanPf.has(p.id) && gunFark(batch.tarih, p.tarih) >= 0 && gunFark(batch.tarih, p.tarih) <= 1);
    const gunler = {};
    adaylar.forEach(p => { (gunler[p.tarih] = gunler[p.tarih] || []).push(p); });
    let secilen = null;
    for (const g in gunler) { if (Math.abs(gunler[g].reduce((s, p) => s + p.tutar, 0) - batch.tutar) < 1) { secilen = gunler[g]; break; } }
    if (!secilen && adaylar.length && Math.abs(adaylar.reduce((s, p) => s + p.tutar, 0) - batch.tutar) < 1) secilen = adaylar;
    if (secilen) {
      secilen.forEach(p => kullanilanPf.add(p.id));
      const kom = komisyonlar.find(k => !k._used && Math.abs(gunFark(k.tarih, batch.tarih)) <= 1); if (kom) kom._used = true;
      const komTut = kom ? Math.abs(kom.tutar) : 0;
      const top = secilen.reduce((s, p) => s + p.tutar, 0);
      const dagitim = secilen.map(p => ({ planformiId: p.id, egitmenId: p.egitmenId, egitmenAd: p.egitmenAd, uyeAd: p.uyeAd, tutar: p.tutar, komisyon: top ? Math.round(komTut * p.tutar / top * 100) / 100 : 0 }));
      sonuc.oneri.push({ id: 'b_' + batch.id, tip: 'batch', banka: batch, komisyonHareket: kom || null, planformiler: secilen, dagitim, beklenen: batch.tutar, gerceklesen: top, komisyon: komTut, fark: top - batch.tutar });
    } else {
      sonuc.bankaYalniz.push({ banka: batch, tip: 'kart', neden: adaylar.length ? 'tutar' : 'yok', adaySum: adaylar.reduce((s, p) => s + p.tutar, 0), adaySay: adaylar.length });
    }
  }
  // --- HAVALE ---
  const kullanilanH = new Set();
  for (const h of havaleGelen) {
    const adaylar = pfHavale.filter(p => !kullanilanH.has(p.id) && Math.abs(p.tutar - h.tutar) < 1 && Math.abs(gunFark(h.tarih, p.tarih)) <= 2);
    const isimli = adaylar.filter(p => isimGecer(h.aciklama, p.uyeAd));
    const sec = isimli.length ? isimli : adaylar;
    if (sec.length === 1) {
      kullanilanH.add(sec[0].id);
      sonuc.oneri.push({ id: 'h_' + h.id, tip: 'havale', banka: h, planformiler: [sec[0]], dagitim: [{ planformiId: sec[0].id, egitmenId: sec[0].egitmenId, egitmenAd: sec[0].egitmenAd, uyeAd: sec[0].uyeAd, tutar: sec[0].tutar, komisyon: 0 }], beklenen: h.tutar, gerceklesen: sec[0].tutar, komisyon: 0, fark: 0, isimli: isimli.length > 0 });
    } else if (sec.length > 1) {
      sonuc.bankaYalniz.push({ banka: h, tip: 'havale', neden: 'coklu', adaySay: sec.length });
    } else {
      sonuc.bankaYalniz.push({ banka: h, tip: 'havale', neden: 'yok' });
    }
  }
  pfKart.filter(p => !kullanilanPf.has(p.id)).forEach(p => sonuc.planformiYalniz.push({ p, tip: 'kart' }));
  pfHavale.filter(p => !kullanilanH.has(p.id)).forEach(p => sonuc.planformiYalniz.push({ p, tip: 'havale' }));
  return sonuc;
}
async function mutabakatOnayla(oneri) {
  const e = await DB.ekle('eslesmeler', {
    tip: oneri.tip, bankaIds: [oneri.banka.id, oneri.komisyonHareket && oneri.komisyonHareket.id].filter(Boolean),
    planformiIds: oneri.planformiler.map(p => p.id), durum: 'onayli',
    beklenen: oneri.beklenen, gerceklesen: oneri.gerceklesen, komisyon: oneri.komisyon, fark: oneri.fark, dagitim: oneri.dagitim,
  });
  for (const id of e.bankaIds) await DB.guncelle('bankaHareketleri', id, { eslesmeId: e.id });
  for (const id of e.planformiIds) await DB.guncelle('planformiTahsilat', id, { eslesmeId: e.id });
  State.eslesmeler = DB._oku('eslesmeler'); State.bankaHareketleri = DB._oku('bankaHareketleri'); State.planformiTahsilat = DB._oku('planformiTahsilat');
}
async function mutabakatBoz(eslesmeId) {
  const e = (State.eslesmeler || []).find(x => x.id === eslesmeId); if (!e) return;
  for (const id of (e.bankaIds || [])) await DB.guncelle('bankaHareketleri', id, { eslesmeId: null });
  for (const id of (e.planformiIds || [])) await DB.guncelle('planformiTahsilat', id, { eslesmeId: null });
  await DB.sil('eslesmeler', eslesmeId);
  State.eslesmeler = DB._oku('eslesmeler'); State.bankaHareketleri = DB._oku('bankaHareketleri'); State.planformiTahsilat = DB._oku('planformiTahsilat');
}
SAYFALAR['mutabakat'] = function mutabakatSayfasi() {
  const r = mutabakatAnaliz();
  const bosVeri = !(State.planformiTahsilat || []).length && !(State.bankaHareketleri || []).length;
  const tarihG = t => kisaTarih(t);
  const oneriKart = (o) => {
    const sag = o.tip === 'batch'
      ? `${o.planformiler.length} kart tahsilatı${o.komisyon ? ` · komisyon ${TL(o.komisyon)}` : ''}`
      : `${kacar(o.planformiler[0].uyeAd)}${o.isimli ? '' : ' <span class="mt-soru">?</span>'} · ${kacar(o.planformiler[0].egitmenAd)}`;
    const farkli = Math.abs(o.fark) >= 1;
    return `<div class="mt-oneri">
      <div class="mt-satir">
        <div class="mt-yan banka"><span class="mt-et">BANKA</span><span class="mt-ad">${kacar(o.banka.islem)}</span><span class="mt-tar">${tarihG(o.banka.tarih)}</span></div>
        <div class="mt-orta">${ik('link')}</div>
        <div class="mt-yan pf"><span class="mt-et">PLAN4ME</span><span class="mt-ad">${sag}</span></div>
        <div class="mt-tutar">${TL(o.gerceklesen)}${farkli ? `<span class="mt-fark">Δ ${TL(o.fark)}</span>` : ''}</div>
      </div>
      <div class="mt-alt">
        <span class="mt-durum ${o.tip}">${o.tip === 'batch' ? 'Kart / Batch' : 'Havale'}${farkli ? ' · tutar farkı' : ''}</span>
        <button type="button" class="btn btn-kucuk mt-onay" data-onay="${o.id}">${ik('onay')} Onayla</button>
      </div>
    </div>`;
  };
  const yalnizKart = (y, taraf) => {
    const b = y.banka || y.p;
    const ad = taraf === 'banka' ? b.islem : `${kacar(b.uyeAd)} · ${kacar(b.egitmenAd)}`;
    const neden = taraf === 'banka'
      ? ({ yok: 'Plan4me’de karşılığı yok', tutar: `Plan4me kart toplamı uymuyor (${TL(y.adaySum)})`, coklu: `${y.adaySay} olası eşleşme` }[y.neden] || '')
      : 'Bankada karşılığı yok';
    return `<div class="mt-yalniz ${taraf}">
      <span class="mt-y-et">${taraf === 'banka' ? 'BANKA' : 'PLAN4ME'}</span>
      <span class="mt-y-ad">${kacar(ad)}</span>
      <span class="mt-y-tar">${tarihG(b.tarih)}</span>
      <span class="mt-y-tut ${(b.tutar||b.tutar)<0?'negatif':''}">${TL(taraf === 'banka' ? b.tutar : b.tutar)}</span>
      <span class="mt-y-neden">${ik('uyari')} ${neden}</span>
    </div>`;
  };
  const onayliKart = (e) => {
    const ad = e.tip === 'batch' ? `Kart / Batch · ${(e.planformiIds || []).length} tahsilat` : 'Havale';
    return `<div class="mt-onayli">
      <span class="mt-o-ik">${ik('onay')}</span>
      <span class="mt-o-ad">${ad}${e.komisyon ? ` · komisyon ${TL(e.komisyon)}` : ''}</span>
      <span class="mt-o-tut">${TL(e.gerceklesen)}</span>
      <button type="button" class="mt-boz" data-boz="${e.id}" title="Eşleşmeyi boz">${ik('geri')}</button>
    </div>`;
  };
  ic().innerHTML = `
    <div class="mt-sayfa">
      <div class="mt-ozet">
        ${mtChip(r.oneri.length, 'Öneri', 'lime')}
        ${mtChip(r.onayli.length, 'Onaylı', 'yesil')}
        ${mtChip(r.bankaYalniz.length + r.planformiYalniz.length, 'Uyumsuz', 'amber')}
        ${r.oneri.length ? `<button type="button" class="btn btn-ana mt-tumu" id="mtTumu">${ik('onay')} Tümünü Onayla (${r.oneri.length})</button>` : ''}
      </div>
      ${bosVeri ? `<div class="faz-bos"><div class="faz-ik">${ik('onay')}</div><h3>Mutabakat için veri yok</h3><p>Önce “İçe Aktar” ile Plan4me ve banka dosyalarını yükleyin.</p></div>` : ''}
      ${r.oneri.length ? `<div class="mt-blok"><h4>${ik('link')} Eşleşme Önerileri</h4>${r.oneri.map(oneriKart).join('')}</div>` : ''}
      ${(r.bankaYalniz.length || r.planformiYalniz.length) ? `<div class="mt-blok"><h4>${ik('uyari')} Eşleşmeyenler</h4>
        ${r.bankaYalniz.map(y => yalnizKart(y, 'banka')).join('')}
        ${r.planformiYalniz.map(y => yalnizKart(y, 'pf')).join('')}</div>` : ''}
      ${r.onayli.length ? `<div class="mt-blok"><h4>${ik('onay')} Onaylananlar (${r.onayli.length})</h4>${r.onayli.map(onayliKart).join('')}</div>` : ''}
      ${!bosVeri && !r.oneri.length && !r.bankaYalniz.length && !r.planformiYalniz.length && !r.onayli.length
        ? `<div class="mt-tamam">${ik('onay')} Eşleştirilecek kart/havale tahsilatı yok. (Nakit tahsilatlar bankaya düşmez.)</div>` : ''}
    </div>`;
  const oneriMap = {}; r.oneri.forEach(o => oneriMap[o.id] = o);
  $$('.mt-onay').forEach(b => b.onclick = async () => { await mutabakatOnayla(oneriMap[b.dataset.onay]); SAYFALAR['mutabakat'](); bildir('Eşleşme onaylandı.', 'basari'); });
  const t = $('#mtTumu'); if (t) t.onclick = async () => { for (const o of r.oneri) await mutabakatOnayla(o); SAYFALAR['mutabakat'](); bildir(`${r.oneri.length} eşleşme onaylandı.`, 'basari'); };
  $$('.mt-boz').forEach(b => b.onclick = async () => { await mutabakatBoz(b.dataset.boz); SAYFALAR['mutabakat'](); bildir('Eşleşme bozuldu.', ''); });
  function mtChip(n, l, c) { return `<span class="mt-ozk ${c}"><b>${n}</b> ${l}</span>`; }
};

/* ==========================================================
   İÇE AKTAR — Plan4me (Alınan Ödemeler) + Banka (VakıfBank) importer
   ========================================================== */
// Hem TR (1.234,56) hem US (1,234.56) hem düz sayı biçimini çözen işaretli tutar
function tutarCoz(v) {
  if (typeof v === 'number') return v;
  let s = String(v == null ? '' : v).replace(/[^\d,.\-]/g, '').trim();
  if (!s) return 0;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c > -1 && d > -1) s = (c > d) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c > -1) s = (s.length - 1 - c <= 2) ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (d > -1 && s.length - 1 - d > 2) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function adNorm(s) { return String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim(); }
function egitmenEsle(ad) { const n = adNorm(ad); const o = State.ortaklar.find(x => adNorm(x.ad) === n); return o ? o.id : null; }
function odemeTipiNormalize(s) {
  const t = String(s || '').toLocaleLowerCase('tr');
  if (/havale|eft|fast/.test(t)) return 'havale';
  if (/kart|kredi|pos/.test(t)) return 'kart';
  return 'nakit';
}
const VARSAYILAN_KATEGORI_KURAL = [
  { anahtar: 'kira', kategori: 'Kira' },
  { anahtar: 'sgk', kategori: 'SGK' },
  { anahtar: 'maaş', kategori: 'Maaş' }, { anahtar: 'maas', kategori: 'Maaş' },
  { anahtar: 'aidat', kategori: 'Aidat' },
  { anahtar: 'e-ticaret', kategori: 'Vergi' }, { anahtar: 'vergi', kategori: 'Vergi' },
  { anahtar: 'pos-alışveriş', kategori: 'POS Harcama' },
];
function giderKategoriOner(islem, aciklama) {
  const metin = (String(islem || '') + ' ' + String(aciklama || '')).toLocaleLowerCase('tr');
  const kurallar = (State.kategoriKurallari && State.kategoriKurallari.length) ? State.kategoriKurallari : VARSAYILAN_KATEGORI_KURAL;
  for (const k of kurallar) { const a = String(k.anahtar || '').toLocaleLowerCase('tr'); if (a && metin.includes(a)) return k.kategori || ''; }
  return '';
}
function bankaYon(islem, ba, aciklama) {
  const i = String(islem || '').toLocaleLowerCase('tr');
  const a = String(aciklama || '').toLocaleLowerCase('tr');
  if (/komisyon/.test(i)) return 'komisyon';
  if (/batch yatan/.test(i)) return 'gelir';
  if (/huzur\s*(hakk|pay)/.test(a)) return 'ortakOdeme';
  const b = String(ba || '').toLocaleUpperCase('tr');
  if (b === 'A') return 'gelir';
  if (b === 'B') return 'gider';
  return 'gider';
}

// Dosyayı oku → {names:[...], sheet:{ad:rows[][]}}  (xlsx: tüm sayfalar, csv: tek sayfa)
function iaDosyaOku(file, cb) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const fr = new FileReader();
  fr.onerror = () => cb(null, 'Dosya okunamadı.');
  fr.onload = () => {
    try {
      if (ext === 'csv') { cb({ names: ['CSV'], sheet: { CSV: csvAyristir(fr.result) } }, null); return; }
      if (typeof XLSX === 'undefined') { cb(null, 'Excel okuma kütüphanesi (xlsx) yüklenmemiş.'); return; }
      const wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
      const sheet = {};
      wb.SheetNames.forEach(n => { sheet[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }); });
      cb({ names: wb.SheetNames, sheet }, null);
    } catch (e) { cb(null, String(e && e.message || e)); }
  };
  if (ext === 'csv') fr.readAsText(file, 'utf-8'); else fr.readAsArrayBuffer(file);
}

// Plan4me "Alınan Ödemeler" tablosunu bul (2 tablolu sayfada A–E)
function pfAyristir(data) {
  let f = null;
  for (const name of data.names) {
    const rows = data.sheet[name] || [];
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = (rows[r] || []).map(c => String(c || '').toLocaleLowerCase('tr').trim());
      const idx = {};
      row.forEach((c, i) => {
        if (/^tarih/.test(c) && idx.tarih == null) idx.tarih = i;
        else if (/(eğitmen|egitmen)/.test(c) && idx.egitmen == null) idx.egitmen = i;
        else if (/^(üye|uye)/.test(c) && idx.uye == null) idx.uye = i;
        else if (/(ödeme|odeme)/.test(c) && idx.tur == null) idx.tur = i;
        else if (/tutar/.test(c) && idx.tutar == null) idx.tutar = i;
      });
      if (idx.tarih != null && idx.egitmen != null && idx.uye != null && idx.tur != null && idx.tutar != null) { f = { rows, headerRow: r, idx }; break; }
    }
    if (f) break;
  }
  if (!f) return { hata: 'Plan4me “Alınan Ödemeler” tablosu (Tarih · Eğitmen · Üye · Ödeme Tipi · Tutar) bulunamadı.' };
  const { rows, headerRow, idx } = f;
  const kayitlar = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const tarihHam = String(row[idx.tarih] || '').trim();
    if (!tarihHam) break;                       // tablo bitti (Alınan Ödemeler A–E)
    const tutar = tutarCoz(row[idx.tutar]);
    if (!tutar) continue;
    const tarih = tarihNormalize(tarihHam);
    if (!tarih) continue;
    const sm = tarihHam.match(/(\d{1,2}:\d{2})/); const saat = sm ? sm[1] : '';
    const egitmenAd = baslikHarf(String(row[idx.egitmen] || '').trim());
    const uyeAd = baslikHarf(String(row[idx.uye] || '').trim());
    const tur = odemeTipiNormalize(row[idx.tur]);
    const imza = `${tarih}|${saat}|${adNorm(egitmenAd)}|${adNorm(uyeAd)}|${tutar}|${tur}`;
    kayitlar.push({ tarih, saat, egitmenAd, egitmenId: egitmenEsle(egitmenAd), uyeAd, tur, tutar, kaynak: 'planformi', imza });
  }
  return { kayitlar };
}

// Banka ekstresi (VakıfBank) — başlık satırını bul, hareketleri sınıflandır
function bankaAyristir(data) {
  let f = null;
  for (const name of data.names) {
    const rows = data.sheet[name] || [];
    for (let r = 0; r < Math.min(rows.length, 25); r++) {
      const row = (rows[r] || []).map(c => String(c || '').toLocaleUpperCase('tr').trim());
      const idx = {};
      row.forEach((c, i) => {
        if (c === 'İŞLEM TARİHİ' && idx.tarih == null) idx.tarih = i;
        else if (c === 'HAREKET TARIH' && idx.hareket == null) idx.hareket = i;
        else if (c === 'İŞLEM' && idx.islem == null) idx.islem = i;
        else if (c === 'TUTAR' && idx.tutar == null) idx.tutar = i;
        else if ((c === 'B/A' || c === 'BA') && idx.ba == null) idx.ba = i;
        else if (c === 'AÇIKLAMA' && idx.aciklama == null) idx.aciklama = i;
        else if (c === 'KANAL' && idx.kanal == null) idx.kanal = i;
        else if (c === 'KART NO' && idx.kartNo == null) idx.kartNo = i;
        else if (c === 'İŞLEM NO' && idx.islemNo == null) idx.islemNo = i;
      });
      if (idx.islem != null && idx.tutar != null && idx.aciklama != null) {
        if (idx.tarih == null) idx.tarih = (idx.hareket != null ? idx.hareket : idx.islem);
        f = { rows, headerRow: r, idx }; break;
      }
    }
    if (f) break;
  }
  if (!f) return { hata: 'Banka ekstresi başlık satırı (İŞLEM · TUTAR · AÇIKLAMA) bulunamadı.' };
  const { rows, headerRow, idx } = f;
  const kayitlar = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const islem = String(row[idx.islem] || '').trim();
    const tutarHam = String(row[idx.tutar] || '').trim();
    if (!islem || !tutarHam) continue;          // boş / footer satırı atla
    const tarih = tarihNormalize(row[idx.tarih]);
    if (!tarih) continue;
    const tutar = tutarCoz(row[idx.tutar]);
    const ba = idx.ba != null ? String(row[idx.ba] || '').trim().toLocaleUpperCase('tr') : (tutar < 0 ? 'B' : 'A');
    const aciklama = idx.aciklama != null ? String(row[idx.aciklama] || '').trim() : '';
    const kanal = idx.kanal != null ? String(row[idx.kanal] || '').trim() : '';
    const kartNo = idx.kartNo != null ? String(row[idx.kartNo] || '').trim() : '';
    const islemNo = idx.islemNo != null ? String(row[idx.islemNo] || '').trim() : '';
    const yon = bankaYon(islem, ba, aciklama);
    const giderKategori = yon === 'gider' ? giderKategoriOner(islem, aciklama) : '';
    const imza = islemNo || `${tarih}|${islem}|${tutar}|${aciklama.slice(0, 24)}`;
    kayitlar.push({ tarih, harekettarih: idx.hareket != null ? String(row[idx.hareket] || '').trim() : '', islem, tutar, ba, aciklama, kanal, kartNo, islemNo, yon, giderKategori, egitmenId: null, kaynak: 'vakifbank', imza });
  }
  return { kayitlar };
}

let iaSekme = 'planformi';
let iaArsivAcik = false;
SAYFALAR['ice-aktar'] = function iceAktarSayfasi() {
  const pfN = (State.planformiTahsilat || []).length, bhN = (State.bankaHareketleri || []).length;
  ic().innerHTML = `
    <div class="ia-sayfa">
      <div class="ia-ust">
        <div class="ia-seg">
          <button type="button" class="ia-oge ${iaSekme === 'planformi' ? 'sec' : ''}" data-ia="planformi">Plan4me${pfN ? ` <span class="ia-rk">${pfN}</span>` : ''}</button>
          <button type="button" class="ia-oge ${iaSekme === 'banka' ? 'sec' : ''}" data-ia="banka">Banka${bhN ? ` <span class="ia-rk">${bhN}</span>` : ''}</button>
        </div>
        <button type="button" class="ia-arsiv-btn ${iaArsivAcik ? 'sec' : ''}" id="iaArsivBtn" title="Arşiv (içe aktarılanlar)">${ik('belge')}</button>
      </div>
      <div id="iaGovde"></div>
    </div>`;
  $$('.ia-oge').forEach(b => b.onclick = () => { iaSekme = b.dataset.ia; SAYFALAR['ice-aktar'](); });
  $('#iaArsivBtn').onclick = () => { iaArsivAcik = !iaArsivAcik; SAYFALAR['ice-aktar'](); };
  iaTabCiz();
};
function iaTabCiz() {
  const g = $('#iaGovde'); const isPf = iaSekme === 'planformi';
  if (iaArsivAcik) { iaArsivCiz(g, isPf); return; }
  g.innerHTML = `
    <label class="ia-drop" id="iaDrop">
      <input type="file" id="iaFile" accept=".xlsx,.xls,.csv" hidden>
      <span class="ia-ik">${ik('indir')}</span>
      <span class="ia-dt">${isPf ? 'Plan4me “Aylık Rapor”' : 'Banka ekstresi'} — dosya seç veya sürükle</span>
      <span class="ia-ds">.xlsx · .csv</span>
    </label>
    <div id="iaOnizle"></div>`;
  const drop = $('#iaDrop'), inp = $('#iaFile');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('uzeri'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('uzeri'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('uzeri'); if (e.dataTransfer.files[0]) iaIsle(e.dataTransfer.files[0]); });
  inp.onchange = () => { if (inp.files[0]) iaIsle(inp.files[0]); };
}
function iaArsivCiz(g, isPf) {
  const kol = isPf ? 'planformiTahsilat' : 'bankaHareketleri';
  const kayitlar = (State[kol] || []).slice().reverse();   // son eklenen üstte
  const satir = isPf
    ? (r) => `<div class="ia-arow"><span class="ia-ar-t">${kacar(kisaTarih(r.tarih))}</span><span class="ia-ar-a">${kacar(r.egitmenAd || '')} · ${kacar(r.uyeAd || '')}</span><span class="ia-ar-x mono">${TL(r.tutar)}</span><button type="button" class="ia-ar-sil" data-sil="${r.id}" title="Sil">${ik('cop')}</button></div>`
    : (r) => `<div class="ia-arow"><span class="ia-ar-t">${kacar(kisaTarih(r.tarih))}</span><span class="ia-ar-a">${kacar(r.islem || '')}</span><span class="ia-ar-x mono ${(Number(r.tutar) || 0) < 0 ? 'negatif' : ''}">${TL(r.tutar)}</span><button type="button" class="ia-ar-sil" data-sil="${r.id}" title="Sil">${ik('cop')}</button></div>`;
  g.innerHTML = `
    <div class="ia-arsiv">
      <div class="ia-ars-bas"><span>${isPf ? 'Plan4me' : 'Banka'} arşivi · <b>${kayitlar.length}</b> kayıt</span>${kayitlar.length ? `<button type="button" class="btn btn-kirmizi btn-kucuk" id="iaTumSil">${ik('cop')} Tümünü Sil</button>` : ''}</div>
      ${kayitlar.length ? `<div class="ia-arliste">${kayitlar.map(satir).join('')}</div>` : `<div class="neon-bos">Bu kaynakta içe aktarılmış kayıt yok.</div>`}
    </div>`;
  $$('.ia-ar-sil').forEach(b => b.onclick = async () => { await DB.sil(kol, b.dataset.sil); State[kol] = DB._oku(kol); iaTabCiz(); });
  const ts = $('#iaTumSil'); if (ts) ts.onclick = () => onayModal('Tümünü Sil', `${isPf ? 'Plan4me' : 'Banka'} arşivindeki ${kayitlar.length} kayıt silinecek. Emin misiniz?`, async () => {
    for (const r of (State[kol] || []).slice()) await DB.sil(kol, r.id);
    State[kol] = DB._oku(kol); iaTabCiz(); bildir('İçe aktarılan kayıtlar silindi.', 'basari');
  });
}
function iaIsle(file) {
  const on = $('#iaOnizle'); on.innerHTML = '<div class="ia-yukleniyor">Okunuyor…</div>';
  iaDosyaOku(file, (data, err) => {
    if (err) { on.innerHTML = `<div class="ia-hata">${ik('uyari')} ${kacar(err)}</div>`; return; }
    const sonuc = iaSekme === 'planformi' ? pfAyristir(data) : bankaAyristir(data);
    if (sonuc.hata) { on.innerHTML = `<div class="ia-hata">${ik('uyari')} ${kacar(sonuc.hata)}</div>`; return; }
    if (!sonuc.kayitlar.length) { on.innerHTML = `<div class="ia-hata">${ik('uyari')} Dosyada uygun kayıt bulunamadı.</div>`; return; }
    iaOnizleCiz(sonuc.kayitlar, file.name);
  });
}
function iaOnizleCiz(kayitlar, dosyaAd) {
  const on = $('#iaOnizle'); const isPf = iaSekme === 'planformi';
  const kol = isPf ? 'planformiTahsilat' : 'bankaHareketleri';
  const mevcut = new Set((State[kol] || []).map(x => x.imza));
  const yeni = kayitlar.filter(k => !mevcut.has(k.imza));
  const tekrar = kayitlar.length - yeni.length;
  let ozet, thead, tbody;
  if (isPf) {
    const say = t => yeni.filter(k => k.tur === t).length;
    const top = yeni.reduce((s, k) => s + k.tutar, 0);
    const eslesmeyen = yeni.filter(k => !k.egitmenId).length;
    ozet = `${chip(`${yeni.length} yeni kayıt`, 'lime')}${tekrar ? chip(`${tekrar} tekrar atlandı`, 'notr') : ''}${chip(TL(top), 'amber')}
      <span class="ia-ozk">Nakit ${say('nakit')} · Havale ${say('havale')} · Kart ${say('kart')}</span>
      ${eslesmeyen ? `<div class="ia-uyari">${ik('uyari')} ${eslesmeyen} kaydın eğitmeni mevcut ortaklarla eşleşmedi (kayıt yine de eğitmen adıyla saklanır).</div>` : ''}`;
    thead = '<tr><th>Tarih</th><th>Eğitmen</th><th>Üye</th><th>Tip</th><th class="sag">Tutar</th></tr>';
    tbody = yeni.slice(0, 14).map(k => `<tr><td>${kacar(kisaTarih(k.tarih))}</td><td>${kacar(k.egitmenAd)}${k.egitmenId ? '' : ' <span class="ia-e0">?</span>'}</td><td>${kacar(k.uyeAd)}</td><td>${turRoz(k.tur)}</td><td class="sag mono">${TL(k.tutar)}</td></tr>`).join('');
  } else {
    const grp = y => yeni.filter(k => k.yon === y);
    const topAbs = arr => arr.reduce((s, k) => s + Math.abs(k.tutar), 0);
    ozet = `${chip(`${yeni.length} yeni hareket`, 'lime')}${tekrar ? chip(`${tekrar} tekrar atlandı`, 'notr') : ''}
      <span class="ia-ozk">Tahsilat ${grp('gelir').length} · Komisyon ${grp('komisyon').length} · Gider ${grp('gider').length} · Ortak ${grp('ortakOdeme').length}</span>`;
    thead = '<tr><th>Tarih</th><th>İşlem</th><th>Yön</th><th>Kategori</th><th class="sag">Tutar</th></tr>';
    tbody = yeni.slice(0, 16).map(k => `<tr><td>${kacar(kisaTarih(k.tarih))}</td><td class="ia-islem">${kacar(k.islem)}</td><td>${yonRoz(k.yon)}</td><td>${kacar(k.giderKategori || '')}</td><td class="sag mono ${k.tutar < 0 ? 'negatif' : 'pozitif'}">${TL(k.tutar)}</td></tr>`).join('');
  }
  on.innerHTML = `
    <div class="ia-onizle">
      <div class="ia-dosad">${ik('belge')} ${kacar(dosyaAd)}</div>
      <div class="ia-ozet">${ozet}</div>
      <div class="tablo-sar"><table class="tablo ia-tablo"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
      ${yeni.length > (isPf ? 14 : 16) ? `<div class="ia-daha">… ve ${yeni.length - (isPf ? 14 : 16)} kayıt daha</div>` : ''}
      <button type="button" class="btn btn-ana ia-kaydet" id="iaKaydet" ${yeni.length ? '' : 'disabled'}>${ik('kaydet')} ${yeni.length} kaydı içe aktar</button>
    </div>`;
  $('#iaKaydet').onclick = async () => {
    const btn = $('#iaKaydet'); btn.disabled = true; btn.textContent = 'Aktarılıyor…';
    await DB.topluEkle(kol, yeni);
    State[kol] = DB._oku(kol);
    bildir(`${yeni.length} kayıt içe aktarıldı.`, 'basari');
    SAYFALAR['ice-aktar']();
  };
  function chip(t, c) { return `<span class="ia-chip ${c}">${kacar(t)}</span>`; }
  function turRoz(t) { const m = { nakit: 'rz-kasa', havale: 'rz-banka', kart: 'rz-kk' }; return `<span class="rozet-etk ${m[t] || 'rz-notr'}">${t}</span>`; }
  function yonRoz(y) { const m = { gelir: ['rz-gelir', 'Tahsilat'], komisyon: ['rz-kk', 'Komisyon'], gider: ['rz-gider', 'Gider'], ortakOdeme: ['rz-transfer', 'Ortak'] }; const v = m[y] || ['rz-notr', y]; return `<span class="rozet-etk ${v[0]}">${v[1]}</span>`; }
}

/* ==========================================================
   DERS TAKİBİ — Dersler / Öğrenciler / Stüdyolar tek ekran (3 sekme)
   ========================================================== */
let dtSekme = 'dersler';   // aktif alt görünüm
const DT_SEKME = [
  { id: 'dersler', ad: 'Dersler', ikon: 'dersler' },
  { id: 'ogrenciler', ad: 'Öğrenciler', ikon: 'ogrenci' },
  { id: 'studyolar', ad: 'Stüdyolar', ikon: 'studyo' },
];
/* Alt sayfaların yazacağı hedef: Ders Takibi açıkken ortak kap, değilse #icerik */
function dtHedef() { return document.getElementById('dtGovde') || ic(); }
SAYFALAR['ders-takibi'] = function () {
  if (!DT_SEKME.some(s => s.id === dtSekme)) dtSekme = 'dersler';
  ic().innerHTML = `
    <div class="dt-seg" id="dtSeg">
      ${DT_SEKME.map(s => `<button type="button" class="dt-oge ${dtSekme === s.id ? 'sec' : ''}" data-dt="${s.id}"><span class="dt-ik">${ik(s.ikon)}</span><span class="dt-tx">${kacar(s.ad)}</span></button>`).join('')}
    </div>
    <div id="dtGovde"></div>`;
  $$('#dtSeg .dt-oge').forEach(b => b.onclick = () => {
    if (dtSekme === b.dataset.dt) return;
    dtSekme = b.dataset.dt;
    $$('#dtSeg .dt-oge').forEach(x => x.classList.toggle('sec', x === b));
    SAYFALAR[dtSekme]();
    const g = document.getElementById('dtGovde'); if (g) { g.classList.remove('sayfa-gir'); void g.offsetWidth; g.classList.add('sayfa-gir'); }
    tabloSigdir();
  });
  SAYFALAR[dtSekme]();   // aktif alt görünümü #dtGovde içine çiz
};

/* -------- FİNANS ANA EKRAN (Plan4me + Banka mutabakat) -------- */
let neonOzetAcik = false;
function neonAnaEkran() {
  const donem = buAy();
  const topla = (arr) => arr.reduce((s, p) => s + (Number(p.tutar) || 0), 0);
  const pf = (State.planformiTahsilat || []).filter(p => donemStr(p.tarih) === donem);
  const bru = topla(pf);
  const nakit = topla(pf.filter(p => p.tur === 'nakit'));
  const havale = topla(pf.filter(p => p.tur === 'havale'));
  const kartT = topla(pf.filter(p => p.tur === 'kart'));
  const bh = (State.bankaHareketleri || []).filter(b => donemStr(b.tarih) === donem);
  const komisyon = bh.filter(b => b.yon === 'komisyon').reduce((s, b) => s + Math.abs(Number(b.tutar) || 0), 0);
  const gider = bh.filter(b => b.yon === 'gider').reduce((s, b) => s + Math.abs(Number(b.tutar) || 0), 0);
  const vOran = (typeof vergiOrani === 'function' ? vergiOrani() : 20) / 100;
  const vergi = Math.round((havale + kartT) * vOran);   // bankaya giren tahsilatın oranı
  const net = bru - komisyon - gider - vergi;
  const es = State.eslesmeler || [];
  const esOk = es.filter(x => ['otomatik', 'onayli', 'manuel'].includes(x.durum)).length;
  const esUyumsuz = es.filter(x => x.durum === 'uyumsuz').length;
  const bosVeri = !pf.length && !bh.length;
  const kart = (ikAd, et, sayfa) => `<button type="button" class="neon-kart" data-git="${sayfa}"><span class="nk-ik">${ik(ikAd)}</span><span class="nk-et">${kacar(et)}</span></button>`;
  const ozetSat = (l, v, cls = '') => `<div class="no-sat"><span>${l}</span><b class="${cls}">${v}</b></div>`;
  ic().innerHTML = `
    <div class="neon-home">
      <div class="neon-ozet ${neonOzetAcik ? 'acik' : ''}" id="neonOzet">
        <div class="no-head"><span class="no-bas">${donemAdi(donem)} · Özet</span><span class="no-ok">▾</span></div>
        <div class="no-govde"><div class="no-ic">
          ${ozetSat('Brüt Tahsilat', TL(bru))}
          ${ozetSat('Nakit', TL(nakit))}
          ${ozetSat('Havale', TL(havale))}
          ${ozetSat('Kart', TL(kartT))}
          ${ozetSat('Kart Komisyonu', komisyon ? '−' + TL(komisyon) : TL(0))}
          ${ozetSat(`Vergi (%${Math.round(vOran * 100)})`, vergi ? '−' + TL(vergi) : TL(0))}
          ${ozetSat('Gider', gider ? '−' + TL(gider) : TL(0))}
          ${ozetSat('Net', TL(net), net < 0 ? 'negatif' : 'pozitif')}
        </div></div>
      </div>
      <div class="neon-aksiyon">
        <button type="button" class="neon-abtn lime" data-git="ice-aktar"><span class="na-ik">${ik('indir')}</span><span>İçe Aktar</span></button>
        <button type="button" class="neon-abtn amber" data-git="mutabakat"><span class="na-ik">${ik('onay')}</span><span>Tahsilat Tanımla</span></button>
      </div>
      <div class="neon-grid">
        ${kart('gelir', 'Gelirler', 'gelirler')}
        ${kart('gider', 'Giderler', 'giderler')}
        ${kart('muhasebe', 'Hesaplar', 'hesap-defter')}
        ${kart('ortaklar', 'Ortaklar', 'karlilik')}
      </div>
      <div class="neon-bosslot" data-git="mutabakat"><span>${ik('arti')}</span> Tahsilat Tanımla ile buraya ekleyeceğiz</div>
    </div>`;
  $$('[data-git]').forEach(c => c.onclick = () => git(c.dataset.git));
  $('#neonOzet').onclick = (e) => { if (e.target.closest('[data-git]')) return; neonOzetAcik = !neonOzetAcik; $('#neonOzet').classList.toggle('acik', neonOzetAcik); };
}

/* -------- DASHBOARD -------- */
let dashDonem = buAy();   // Gösterge Paneli'nde görüntülenen dönem
let dashOrtakAcik = true; // sol ortak kartı açık/kapalı
SAYFALAR.dashboard = function () {
  if (document.body.classList.contains('tema-neon')) { neonAnaEkran(); return; }
  const eksi = (n) => n ? '−' + TL(n) : TL(0);
  const veri = ortakAyHesap(dashDonem);
  const benim = benId();
  const aktifOrt = State.ortaklar.filter(o => o.aktif !== false);

  /* --- Üst 4 toplam kart (her kullanıcıda aynı) --- */
  const sonBak = (h) => h.length ? h[h.length - 1].bakiye : 0;
  const hakEdis = veri.reduce((s, r) => s + (Number(r.verilecek) || 0), 0);
  const bankaBak = sonBak(hesapHareketleri('banka'));
  const kasaBak = sonBak(hesapHareketleri('nakit'));
  const kartB = kartBorcu();
  const k4 = (cls, ikAd, lbl, val, alt) =>
    `<div class="d4 ${cls}"><span class="glow"></span><span class="ring"></span><div class="ust"><span class="ik">${ik(ikAd)}</span><span class="lbl">${lbl}</span></div><div class="val">${val}</div><div class="alt">${alt}</div></div>`;
  const ust4 = `<div class="dsh4">
    ${k4('hak', 'hakedis', 'Hak Ediş', TL(hakEdis), donemAdi(dashDonem) + ' · dağıtılacak pay')}
    ${k4('bnk', 'banka', 'Banka', TL(bankaBak), 'Güncel bakiye')}
    ${k4('ksa', 'kasa', 'Kasa', TL(kasaBak), 'Nakit bakiye')}
    ${k4('krt', 'kartBorc', 'Kredi Kartı Borcu', TL(kartB), kartB > 0 ? 'Ödenmemiş' : 'Borç yok')}
  </div>`;

  /* --- SOL: ilgili ortağın tek kartı (Ortaklar sayfasıyla birebir) --- */
  const ilgId = benim || (aktifOrt[0] ? aktifOrt[0].id : null);
  const r = veri.find(x => x.o.id === ilgId);
  let ortakHTML;
  if (r) {
    const acik = dashOrtakAcik;
    const foto = r.o.foto ? `<img src="${r.o.foto}" alt="${kacar(r.o.ad)}">` : `<span class="ok-mono">${basHarf(r.o.ad)}</span>`;
    const detay = `<div class="ok-detay">
        <div class="ok-sr"><span class="et">${ik('kisi','uik-et')}Aktif Öğrenci</span><span class="v">${r.aktifOgrenci}</span></div>
        <div class="ok-sr"><span class="et">${ik('dersler','uik-et')}Verdiği Ders</span><span class="v">${r.verdigiDers}</span></div>
        <div class="ok-sr"><span class="et">${ik('onay','uik-et')}Tahsil Edilen</span><span class="v green">${TL(r.tahsil)}</span></div>
        <div class="ok-sr"><span class="et">${ik('sure','uik-et')}Kalan Alacağı</span><span class="v gold">${TL(r.kalanAlacak)}</span></div>
        <div class="ok-sr"><span class="et">${ik('bolme','uik-et')}Giderler Payı</span><span class="v red">${eksi(r.giderPayi)}</span></div>
        <div class="ok-sr"><span class="et">${ik('banka','uik-et')}Komisyon Gideri</span><span class="v red">${eksi(r.komisyon)}</span></div>
        <div class="ok-sr"><span class="et">${ik('belge','uik-et')}Vergi Kesintisi</span><span class="v red">${eksi(r.vergi)}</span></div>
        <div class="ok-sonuc"><span class="k">${ik('para','uik-et')}Verilecek Pay</span><span class="v"${r.verilecek < 0 ? ' style="color:var(--kirmizi)"' : ''}>${TL(r.verilecek)}</span></div>
      </div>`;
    const ozet = `<div class="ok-ozet"><span class="lbl">${ik('para','uik-et')}Verilecek Pay</span><span class="val"${r.verilecek < 0 ? ' style="color:var(--kirmizi)"' : ''}>${TL(r.verilecek)}</span></div>`;
    ortakHTML = `<div class="ok-kart f1 ${acik ? 'acik' : ''}" id="dashOrtakKart">
        <div class="ok-kare"><div class="ok-foto">${foto}</div><span class="ok-isim">${kacar(r.o.ad)}</span></div>
        ${acik ? detay : ozet}
      </div>`;
  } else {
    ortakHTML = `<div class="gp-bos">Ortak bulunamadı.</div>`;
  }

  /* --- ORTA: Dersler (bugün & yarın) --- */
  const bugun = bugunISO();
  const yd = new Date(); yd.setDate(yd.getDate() + 1);
  const yarin = yd.toISOString().slice(0, 10);
  const gunAy = (iso) => { try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', weekday: 'long' }); } catch { return iso; } };
  // Dashboard takvimi: yalnızca giriş yapan kullanıcının (ortak) kendi dersleri; admin'de gösterilen ortağın dersleri
  const panelOrt = benim || (aktifOrt[0] ? aktifOrt[0].id : null);
  const dersHepsi = (State.dersler || [])
    .filter(d => d.egitmenId === panelOrt && d.durum !== 'iptal' && (d.tarih === bugun || d.tarih === yarin))
    .sort((a, b) => (a.tarih + (a.saat || '')).localeCompare(b.tarih + (b.saat || '')));
  const simdiSaat = (() => { const t = new Date(); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); })();
  const dersSatir = (d) => {
    const e = State.ortaklar.find(x => x.id === d.egitmenId);
    const ids = d.ogrenciIds || [];
    const grup = ids.length > 1;
    const ogrAd = ids.length ? ogrenciTamAd(State.ogrenciler.find(x => x.id === ids[0])) + (grup ? ` +${ids.length - 1}` : '') : '';
    const bd = [d.dersAd, ogrAd].filter(Boolean).join(' — ') || 'Ders';
    const yarinCls = d.tarih === yarin ? ' yarin' : '';
    // Saati/günü geldi mi? (bekliyor + bugün ise saat geçti VEYA geçmiş gün)
    const geldi = d.durum === 'bekliyor' && (d.tarih < bugun || (d.tarih === bugun && (d.saat || '00:00') <= simdiSaat));
    const sag = d.durum === 'gerceklesti'
      ? `<span class="drs-done" title="Gerçekleşti">${ik('onay')}</span>`
      : geldi
        ? `<button type="button" class="drs-onay" data-onayder="${d.id}" title="Dersi onayla" aria-label="Dersi onayla">${ik('onay')}</button>`
        : `<span class="chv">›</span>`;
    return `<div class="drs${d.durum === 'gerceklesti' ? ' drs-tamam' : ''}" data-git="dersler"><div class="gun${yarinCls}"><div class="g">${kacar(d.saat || '—')}</div><div class="a">${d.tarih === bugun ? 'Bugün' : 'Yarın'}</div></div><div class="orta"><div class="bd">${kacar(bd)}${grup ? ' <span class="drs-grup">Grup</span>' : ''}</div><div class="alt">${kacar(e ? egitmenKisaAd(e) : '—')}</div></div>${sag}</div>`;
  };
  const bugunD = dersHepsi.filter(d => d.tarih === bugun);
  const yarinD = dersHepsi.filter(d => d.tarih === yarin);
  const derslerIc = dersHepsi.length
    ? `${bugunD.length ? `<div class="drs-gun-et">Bugün · ${gunAy(bugun)}</div>${bugunD.map(dersSatir).join('')}` : ''}
       ${yarinD.length ? `<div class="drs-gun-et">Yarın · ${gunAy(yarin)}</div>${yarinD.map(dersSatir).join('')}` : ''}`
    : `<div class="drs-bos">Bugün ve yarın için ders yok.</div>`;
  const dersPanel = `<div class="panel">
      <div class="panel-bas"><span class="t"><span class="ik">${ik('dersler')}</span>Bugün & Yarın</span><span class="link" data-git="studyolar">Tüm dersler →</span></div>
      ${derslerIc}
    </div>`;

  ic().innerHTML = `
    <div class="dsh-c-bar">
      <span class="dsh-c-title">Gösterge Paneli</span>
      <div class="dsh-c-arac">
        ${ayNavHTML(dashDonem)}
      </div>
    </div>
    ${ust4}
    <div class="dsh2">
      <div><div class="blok-bas"><span class="bi">${ik('kisi')}</span><span>Ortak</span><span class="ln"></span></div>${ortakHTML}</div>
      <div><div class="blok-bas"><span class="bi">${ik('dersler')}</span><span>Dersler</span><span class="ln"></span></div>${dersPanel}</div>
    </div>`;

  $$('[data-git]').forEach(c => c.onclick = () => git(c.dataset.git));
  $$('[data-onayder]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const d = State.dersler.find(x => x.id === b.dataset.onayder); if (d) dersDurumDegistir(d, 'gerceklesti', () => SAYFALAR.dashboard()); });
  $$('[data-ay]').forEach(b => b.onclick = () => { dashDonem = donemKaydir(dashDonem, Number(b.dataset.ay)); SAYFALAR.dashboard(); });
  const ok = $('#dashOrtakKart'); if (ok) ok.onclick = () => { dashOrtakAcik = !dashOrtakAcik; SAYFALAR.dashboard(); };
};

/* Ortak başına hesaplama: ders geliri, eşit gider payı, hak ediş */
/* Müşteri ödemelerini derslere dağıt (FIFO: en eski ders önce kapanır).
   Döner: { [dersId]: ödenenTutar }  */
/* Bir müşterinin toplam tahsilatı (kasa/banka gelir işlemleri 'tahsilat' + eski cari ödemeler) */
function musteriTahsilat(mid) {
  const isl = State.islemler.filter(i => i.kaynak === 'tahsilat' && i.musteriId === mid).reduce((s, i) => s + (Number(i.tutar) || 0), 0);
  const leg = (State.odemeler || []).filter(o => o.musteriId === mid).reduce((s, o) => s + (Number(o.tutar) || 0), 0);
  return isl + leg;
}
function dersOdemeDagit() {
  const sonuc = {};
  const grup = {};
  State.dersler.forEach(d => { (grup[d.musteriId] = grup[d.musteriId] || []).push(d); });
  Object.keys(grup).forEach(mid => {
    const dler = grup[mid].slice().sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
    let bakiye = musteriTahsilat(mid);
    dler.forEach(d => {
      const u = Number(d.ucret) || 0;
      const odenen = Math.max(0, Math.min(bakiye, u));
      sonuc[d.id] = odenen; bakiye -= odenen;
    });
  });
  return sonuc;
}

function ortakHesapla(donem) {
  const aktif = State.ortaklar.filter(o => o.aktif !== false);
  const toplamGider = Hesapla.donemOzet(donem).gider;
  const giderPayi = aktif.length ? toplamGider / aktif.length : 0;
  const dagit = dersOdemeDagit();
  return aktif.map(o => {
    const dler = State.dersler.filter(d => d.egitmenId === o.id && donemStr(d.tarih) === donem);
    const adet = dler.length;
    const dersGeliri = dler.reduce((s, d) => s + (Number(d.ucret) || 0), 0);   // Satılan Paket Tutarı
    const tahsil = dler.reduce((s, d) => s + (dagit[d.id] || 0), 0);           // Tahsil Edilen
    const alacak = dersGeliri - tahsil;                                        // Kalan Alacak
    const bankaKomisyon = 0;   // İleride: banka hareketleri dosyasından otomatik çekilecek
    const netKar = tahsil - bankaKomisyon - giderPayi;                         // Hak Ediş
    return { o, adet, ucret: Number(o.dersUcreti) || 0, dersGeliri, tahsil, alacak, bankaKomisyon, giderPayi, netKar, hakEdis: netKar };
  });
}

/* Bir ortağın "fiş" kartı (dashboard + Ortaklar sayfası ortak kullanır) */
function ortakFisKartHTML(r, i, duzenlenebilir) {
  const avSinif = ['g', 'b', 'p', 'a'];
  const bas = (ad) => (ad || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  const eksi = (n) => n ? `−${TL(n)}` : TL(0);
  const av = r.o.foto
    ? `<div class="he-av"><img src="${r.o.foto}" alt="${kacar(r.o.ad)}"></div>`
    : `<div class="he-av ${avSinif[i % 4]}">${kacar(bas(r.o.ad))}</div>`;
  const arac = duzenlenebilir
    ? `<div class="he-arac"><button type="button" class="he-btn" data-duzenle="${r.o.id}" title="Düzenle">✎</button><button type="button" class="he-btn" data-sil="${r.o.id}" title="Sil">🗑️</button></div>`
    : '';
  return `<div class="he-kart">
    <div class="he-bas">${av}<div class="he-kim"><div class="isim">${kacar(r.o.ad)}</div><div class="rol">Eğitmen</div></div>${arac}</div>
    <div class="he-satirlar">
      <div class="sr info"><span class="et"><span class="ik">📦</span>Satılan Paket</span><span class="tt">${TL(r.dersGeliri)}</span></div>
      <div class="sr"><span class="et"><span class="ik">✅</span>Tahsil Edilen</span><span class="tt green">${TL(r.tahsil)}</span></div>
      <div class="sr"><span class="et"><span class="ik">🏦</span>Banka Komisyonu</span><span class="tt red">${eksi(r.bankaKomisyon)}</span></div>
      <div class="sr info"><span class="et"><span class="ik">⏳</span>Kalan Alacak</span><span class="tt gold">${TL(r.alacak)}</span></div>
      <div class="sr"><span class="et"><span class="ik">➗</span>Gider Payı</span><span class="tt red">${eksi(r.giderPayi)}</span></div>
    </div>
    <div class="he-sonuc"><span class="k">💰 Hak Ediş</span><span class="v"${r.hakEdis < 0 ? ' style="color:var(--kirmizi)"' : ''}>${TL(r.hakEdis)}</span></div>
  </div>`;
}

/* Dashboard: altın varak kartı — büyük kare fotoğraf + isim + yalnızca Hak Ediş */
function ortakAltinKartHTML(r, i) {
  const avSinif = ['g', 'b', 'p', 'a'];
  const bas = (ad) => (ad || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  const foto = r.o.foto
    ? `<div class="altin-foto"><img src="${r.o.foto}" alt="${kacar(r.o.ad)}"></div>`
    : `<div class="altin-foto ${avSinif[i % 4]}">${kacar(bas(r.o.ad))}</div>`;
  return `<div class="altin-kart">
    ${foto}
    <div class="altin-isim">${kacar(r.o.ad)}</div>
    <div class="altin-rol">Eğitmen</div>
    <div class="altin-ayrac"></div>
    <div class="altin-et">Hak Ediş</div>
    <div class="altin-tt"${r.hakEdis < 0 ? ' style="color:var(--kirmizi)"' : ''}>${TL(r.hakEdis)}</div>
  </div>`;
}

/* Dashboard: "Ortak Hak Edişleri" kartı. Ortak girişi varsa yalnızca kendi kartı. */
function ortakKartHTML(donem) {
  let rows = ortakHesapla(donem);
  const benim = aktifOrtakId();
  if (benim) rows = rows.filter(r => r.o.id === benim);
  const toplamHE = rows.reduce((s, r) => s + r.hakEdis, 0);
  return `
  <div class="ortakkart">
    <div class="ok-head"><h3>🤝 ${benim ? 'Hak Edişim' : 'Ortak Hak Edişleri'}</h3>
      <div class="ok-donem"><button type="button" class="ok-ok" id="okGeri" title="Önceki ay">‹</button>
      <span class="dn">${donemAdi(donem)}</span>
      <button type="button" class="ok-ok" id="okIleri" title="Sonraki ay">›</button></div></div>
    ${rows.length === 0
      ? bosBlok(benim ? 'Bu ay kaydınız yok. Aylar arasında gezinebilirsiniz.' : 'Henüz ortak yok. “Ayarlar → Ortak Pay Oranı”ndan ekleyin.')
      : `<div class="altin-izgara">${rows.map((r, i) => ortakAltinKartHTML(r, i)).join('')}</div>
        ${benim ? '' : `<div class="ok-foot"><span class="k">Toplam Hak Ediş</span><span class="v">${TL(toplamHE)}</span></div>`}`
    }
  </div>`;
}

/* Bir ortağın seçili dönemdeki ders sayısını düzenle */
function dersSayisiDuzenle(ortakId, donem) {
  const o = State.ortaklar.find(x => x.id === ortakId);
  if (!o) return;
  const mevcut = (o.dersAdet && o.dersAdet[donem]) || 0;
  modalAc(`${o.ad} — Ders Sayısı`, `
    <div class="bilgi-kutu"><span class="ikon">${ik('dersler')}</span><div><b>${donemAdi(donem)}</b> için verilen ders sayısı. Ders ücreti: <b>${TL(o.dersUcreti || 0)}</b>/ders.
      ${!o.dersUcreti ? '<br>⚠️ Bu ortağın ders ücreti tanımlı değil (Ayarlar → Ortak Pay Oranı).' : ''}</div></div>
    <div class="form-alan"><label>Ders Sayısı</label><input type="number" id="dsAdet" min="0" step="1" value="${mevcut}" autofocus></div>
  `, `<button class="btn" id="dsIptal">İptal</button><button class="btn btn-ana" id="dsKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`);
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
        <button class="btn btn-ana" id="mKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>
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
SAYFALAR['plan4me'] = () => plan4meSayfasi();

/* Plan4Me — cari mantığıyla ders kaydı (kasa/para YOK). Eğitmen + Müşteri + ücret (alacak). */
let _p4Donem = null;   // Plan4Me'de görüntülenen dönem (YYYY-MM); null = bu ay

function plan4meSayfasi() {
  const donem = _p4Donem || donemStr(bugunISO());
  const dersler = State.dersler.filter(d => donemStr(d.tarih) === donem)
    .slice().sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  const toplam = dersler.reduce((s, d) => s + (Number(d.ucret) || 0), 0);
  const seansTop = dersler.reduce((s, d) => s + (Number(d.seans) || 0), 0);

  const satirlar = dersler.map(d => {
    const eg = State.ortaklar.find(o => o.id === d.egitmenId);
    const mu = State.musteriler.find(m => m.id === d.musteriId);
    const paketMi = d.tur === 'paket';
    const turEt = paketMi ? `📦 ${d.seans || 0} seans` : (d.tur === 'ozel' ? '🧘 Özel' : '👥 Grup');
    const alt = (paketMi && d.bitis) ? `${kisaTarih(d.baslangic)} → ${kisaTarih(d.bitis)}` : kacar(d.aciklama || '');
    return `<button type="button" class="e-satir" data-ders="${d.id}">
      ${tarihBlok(d.tarih)}
      <div class="e-ic">
        <div class="e-l1"><span class="e-ack">${kacar(mu ? mu.ad : 'Müşteri')}</span>
          <span class="e-tut g">${TL(d.ucret)}</span></div>
        <div class="e-l2"><span class="e-bk">🧘 ${kacar(eg ? eg.ad : 'Eğitmen')} · ${turEt}</span>
          <span>${alt}</span></div>
      </div>
    </button>`;
  }).join('');

  ic().innerHTML = `
    ${hesapGeriHTML()}
    <div class="p4-donem">
      <button type="button" class="p4-ok" id="p4Geri" title="Önceki ay">‹</button>
      <span class="p4-ay">${donemAdi(donem)}</span>
      <button type="button" class="p4-ok" id="p4Ileri" title="Sonraki ay">›</button>
    </div>
    <div class="e-ozet">
      <div class="e-ozet-sol">
        <div class="k">🧘 Ders / Paket Kayıtları (Cari)</div>
        <div class="v">${TL(toplam)}</div>
        <div class="sd">${dersler.length} kayıt${seansTop ? ` · ${seansTop} seans` : ''}</div>
      </div>
      <button type="button" class="btn-yeni" id="p4Yeni">＋ Yeni</button>
    </div>
    <button type="button" class="p4-aktar" id="p4Aktar">📥 Excel'den Paket Aktar</button>
    ${dersler.length === 0
      ? `<div class="kart">${bosBlok("Bu ay kayıt yok. “＋ Yeni” ile ekleyin ya da Excel'den aktarın.")}</div>`
      : `<div class="e-liste">${satirlar}</div>`}`;

  $('#p4Geri').onclick = () => { _p4Donem = donemKaydir(donem, -1); plan4meSayfasi(); };
  $('#p4Ileri').onclick = () => { _p4Donem = donemKaydir(donem, +1); plan4meSayfasi(); };
  $('#p4Yeni').onclick = () => dersKaydiFormu();
  $('#p4Aktar').onclick = () => paketAktarModal();
  $$('[data-ders]').forEach(r => r.onclick = () => dersKaydiFormu(State.dersler.find(d => d.id === r.dataset.ders)));
}

/* ============ Excel'den paket satışı içe aktarma ============ */
function paketAktarModal() {
  const govde = `<div id="paGovde">
    <div class="pa-drop" id="paDrop">
      <div class="ic">📥</div>
      <div class="t">Excel dosyasını seç</div>
      <div class="s">.xlsx · “Satılan Paketler” tablosu</div>
      <button type="button" class="pa-sec" id="paSecBtn">📂 Dosya Seç</button>
      <input type="file" id="paDosya" accept=".xlsx,.xls" hidden>
    </div></div>`;
  modalAc('Excel\'den İçe Aktar', govde, `<button class="btn" id="paIptal">İptal</button>`, `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3.5h7l5 5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" fill="currentColor" opacity=".22"/><path d="M6 3.5h7l5 5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 3.5V8.5h5M8 12.5h8M8 15.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Paket Satışları</span>`);
  $('#paIptal').onclick = modalKapat;
  const dosya = $('#paDosya');
  $('#paSecBtn').onclick = (e) => { e.stopPropagation(); dosya.click(); };
  $('#paDrop').onclick = () => dosya.click();
  dosya.onchange = () => { if (dosya.files[0]) paketDosyaOku(dosya.files[0]); };
}

function paketDosyaOku(dosya) {
  const g = $('#paGovde');
  g.innerHTML = `<div class="yukleniyor"><div class="spinner"></div>Dosya okunuyor…</div>`;
  if (typeof XLSX === 'undefined') { g.innerHTML = bosBlok('Excel okuma kütüphanesi yüklenmemiş.'); return; }
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const satirlar = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
      paketOnizle(satirlar, dosya.name);
    } catch (e) { g.innerHTML = bosBlok('Dosya okunamadı: ' + e.message); }
  };
  fr.readAsArrayBuffer(dosya);
}

function paketOnizle(satirlar, dosyaAd) {
  const g = $('#paGovde');
  const norm = (s) => String(s == null ? '' : s).trim().toLocaleLowerCase('tr');
  const nrm = (s) => norm(s).replace(/\s+/g, ' ');   // isim eşleme anahtarı

  // Başlık satırını bul (Üye + Tutar + Seans içeren satır)
  let bi = -1;
  for (let i = 0; i < satirlar.length; i++) {
    const hs = (satirlar[i] || []).map(norm);
    if (hs.some(x => x.includes('üye') || x.includes('uye') || x.includes('müşteri') || x.includes('musteri'))
      && hs.some(x => x.includes('tutar')) && hs.some(x => x.includes('seans'))) { bi = i; break; }
  }
  if (bi < 0) { g.innerHTML = bosBlok('Beklenen sütunlar (Üye, Seans, Tutar) bulunamadı. Doğru dosyayı seçtiğinizden emin olun.'); return; }
  const bas = satirlar[bi].map(norm);
  const col = (keys) => bas.findIndex(b => keys.some(k => b.includes(k)));
  const cTar = col(['tarih']), cEg = col(['eğitmen', 'egitmen']),
    cUye = col(['üye', 'uye', 'müşteri', 'musteri']), cSns = col(['seans']),
    cBas = col(['başlangıç', 'baslangic']), cBit = col(['bitiş', 'bitis']), cTut = col(['tutar']);

  const ham = [];
  for (let i = bi + 1; i < satirlar.length; i++) {
    const r = satirlar[i] || [];
    const uyeAd = String(r[cUye] == null ? '' : r[cUye]).trim();
    if (!uyeAd || /toplam/i.test(uyeAd)) continue;
    const ucret = paraCoz(r[cTut]);
    const seans = parseInt(paraCoz(r[cSns]), 10) || 0;
    if (ucret <= 0 && !seans) continue;
    ham.push({
      tarih: tarihNormalize(cTar >= 0 ? r[cTar] : '') || bugunISO(),
      egitmenAd: baslikHarf(cEg >= 0 ? r[cEg] : ''),
      musteriAd: baslikHarf(uyeAd),
      seans, ucret,
      baslangic: cBas >= 0 ? tarihNormalize(r[cBas]) : '',
      bitis: cBit >= 0 ? tarihNormalize(r[cBit]) : '',
    });
  }
  if (!ham.length) { g.innerHTML = bosBlok('Aktarılacak satır bulunamadı.'); return; }

  // Mükerrer engelleme (daha önce Excel'den aktarılanlar)
  const imza = (k) => `${k.tarih}|${nrm(k.musteriAd)}|${k.ucret}|${k.seans}`;
  const mevcutImza = new Set(State.dersler.filter(d => d.kaynak === 'excel' && d.imzaId).map(d => d.imzaId));
  const yeni = ham.filter(k => !mevcutImza.has(imza(k)));
  const atlanan = ham.length - yeni.length;

  // Eğitmen / müşteri eşleme
  const egMap = new Map(State.ortaklar.map(o => [nrm(o.ad), o.id]));
  const muMap = new Map(State.musteriler.map(m => [nrm(m.ad), m.id]));
  const yeniEg = [...new Set(yeni.map(k => k.egitmenAd).filter(a => a && !egMap.has(nrm(a))))];
  const yeniMu = [...new Set(yeni.map(k => k.musteriAd).filter(a => a && !muMap.has(nrm(a))))];
  const egTop = new Set(yeni.map(k => nrm(k.egitmenAd)).filter(Boolean)).size;
  const muTop = new Set(yeni.map(k => nrm(k.musteriAd)).filter(Boolean)).size;
  const tutarTop = yeni.reduce((s, k) => s + k.ucret, 0);
  const seansGenel = yeni.reduce((s, k) => s + k.seans, 0);

  if (!yeni.length) {
    g.innerHTML = bosBlok(`Bu dosyadaki ${ham.length} kaydın tamamı zaten içe aktarılmış. Yeni kayıt yok.`);
    return;
  }

  const ornek = yeni.slice(0, 5).map(k => `<div class="pa-tr">
    <span class="pa-c-tar">${kisaTarih(k.tarih)}</span>
    <span class="pa-c-uye">${kacar(k.musteriAd)}</span>
    <span class="pa-c-eg">${kacar(k.egitmenAd)}</span>
    <span class="pa-c-se">${k.seans}</span>
    <span class="pa-c-tut">${(Math.round(k.ucret)).toLocaleString('tr-TR')}</span>
  </div>`).join('');

  g.innerHTML = `
    <div class="pa-ozet">
      <div class="pa-oz"><div class="k">Paket kaydı</div><div class="v">${yeni.length}</div></div>
      <div class="pa-oz"><div class="k">Toplam seans</div><div class="v">${seansGenel.toLocaleString('tr-TR')}</div></div>
      <div class="pa-oz"><div class="k">Müşteri</div><div class="v">${muTop}${yeniMu.length ? ` <small>+${yeniMu.length} yeni</small>` : ''}</div></div>
      <div class="pa-oz"><div class="k">Eğitmen</div><div class="v">${egTop}${yeniEg.length ? ` <small>+${yeniEg.length} yeni</small>` : ''}</div></div>
      <div class="pa-oz tam"><div class="k">Toplam Tutar (cari borç olarak yazılır)</div><div class="v">${TL(tutarTop)}</div></div>
    </div>
    <div class="pa-uyari"><span>⚠️</span><span>Bu kayıtlar <b>açık borç</b> olarak eklenir; ödeme/tahsilat yazılmaz.${atlanan ? ` <b>${atlanan}</b> mükerrer satır atlandı.` : ''}</span></div>
    <div class="pa-onbas">Örnek satırlar (ilk ${Math.min(5, yeni.length)})</div>
    <div class="pa-tablo">
      <div class="pa-tr bas"><span class="pa-c-tar">Tarih</span><span class="pa-c-uye">Müşteri</span><span class="pa-c-eg">Eğitmen</span><span class="pa-c-se">Sns</span><span class="pa-c-tut">Tutar</span></div>
      ${ornek}
      ${yeni.length > 5 ? `<div class="pa-daha">… ${yeni.length - 5} kayıt daha</div>` : ''}
    </div>`;

  // Alt butonu güncelle: İçe Aktar
  const alt = $('#modalKap .modal-alt') || document.querySelector('.modal-alt');
  if (alt) alt.innerHTML = `<button class="btn" id="paIptal">İptal</button><button class="btn btn-ana hr-kaydet" id="paAktar"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="currentColor" opacity=".22"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="m8.3 12.2 2.6 2.6 4.8-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> İçe Aktar (${yeni.length})</button>`;
  $('#paIptal').onclick = modalKapat;
  $('#paAktar').onclick = async () => {
    const btn = $('#paAktar'); btn.disabled = true; btn.textContent = 'Aktarılıyor…';
    for (const ad of yeniEg) {
      const o = await DB.ekle('ortaklar', { ad, dersUcreti: 0, payOrani: 0, aktif: true, foto: null });
      State.ortaklar.push(o); egMap.set(nrm(ad), o.id);
    }
    for (const ad of yeniMu) {
      const m = await DB.ekle('musteriler', { ad, telefon: '' });
      State.musteriler.push(m); muMap.set(nrm(ad), m.id);
    }
    const kayitlar = yeni.map(k => ({
      tarih: k.tarih, egitmenId: egMap.get(nrm(k.egitmenAd)) || null, musteriId: muMap.get(nrm(k.musteriAd)) || null,
      ucret: k.ucret, tur: 'paket', seans: k.seans, baslangic: k.baslangic, bitis: k.bitis,
      aciklama: '', kaynak: 'excel', imzaId: imza(k),
    }));
    const eklenen = await DB.topluEkle('dersler', kayitlar);
    State.dersler = eklenen.concat(State.dersler);
    modalKapat();
    bildir(`${eklenen.length} paket içe aktarıldı${atlanan ? `, ${atlanan} mükerrer atlandı` : ''}.`, 'basari');
    // İçe aktarılan kayıtlar görünsün diye en erken kaydın dönemine geç
    const enErken = eklenen.map(k => k.tarih).filter(Boolean).sort()[0];
    if (enErken) _p4Donem = donemStr(enErken);
    plan4meSayfasi();
  };
}

/* Ders kaydı formu — premium tarz; para/toggle yok, Grup/Özel + Eğitmen + Müşteri + Ücret (cari)
   opts: {onMusteri, geri} — Müşteriler'den açınca müşteri önceden seçili gelir, kaydedince geri()'ye döner */
function dersKaydiFormu(mevcut, opts = {}) {
  const geri = opts.geri || (() => plan4meSayfasi());
  let tur = mevcut ? (mevcut.tur || 'grup') : 'grup';
  const egitmenSecenek = (sec) => `<option value="">— Eğitmen seç —</option>`
    + State.ortaklar.map(o => `<option value="${o.id}" ${sec === o.id ? 'selected' : ''}>${kacar(o.ad)}</option>`).join('')
    + `<option value="__yeni">➕ Yeni Eğitmen ekle…</option>`;
  const musteriSecenek = (sec) => `<option value="">— Müşteri seç —</option>`
    + State.musteriler.map(m => `<option value="${m.id}" ${sec === m.id ? 'selected' : ''}>${kacar(m.ad)}</option>`).join('')
    + `<option value="__yeni">➕ Yeni Müşteri ekle…</option>`;

  const govde = `
    <div class="hr-form">
      <div class="yon-secim ders-tur">
        <button type="button" class="yon-btn ${tur === 'grup' ? 'sec' : ''}" data-tur="grup">👥 Grup<small>Grup dersi</small></button>
        <button type="button" class="yon-btn ${tur === 'ozel' ? 'sec' : ''}" data-tur="ozel">🧘 Özel<small>Birebir ders</small></button>
      </div>
      <div class="hr-tutar" id="hrTutarKutu">
        <label for="hrTutar">Ücret</label>
        <input type="text" id="hrTutar" inputmode="decimal" autocomplete="off" placeholder="0,00 ₺">
      </div>
      <div class="hr-grup">
        <div class="hr-satir sel"><label for="dEgitmen">Eğitmen</label><select id="dEgitmen"></select></div>
        <div class="hr-satir sel"><label for="dMusteri">Müşteri</label><select id="dMusteri"></select></div>
        <div class="hr-satir hr-tarih-satir"><label>Tarih</label><span class="hr-deger" id="hrTarihGos">${fmtTarihUzun(mevcut ? mevcut.tarih : '')}</span><input type="date" id="hrTarih" aria-label="Tarih" value="${mevcut ? (mevcut.tarih || bugunISO()).slice(0,10) : bugunISO()}"></div>
        <div class="hr-satir"><label for="hrAciklama">Açıklama</label><input type="text" id="hrAciklama" value="${mevcut ? kacar(mevcut.aciklama || '') : ''}" placeholder="Örn. Sabah mat dersi"></div>
      </div>
    </div>`;
  const alt = `${mevcut ? '<button class="btn btn-kirmizi" id="hrSil" style="margin-right:auto"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 7h12M9.5 7V5.6A1.2 1.2 0 0 1 10.7 4.4h2.6A1.2 1.2 0 0 1 14.5 5.6V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" fill="currentColor" opacity=".2"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.3 10.5v6M13.7 10.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Sil</button>' : ''}
    <button class="btn" id="hrIptal">İptal</button><button class="btn btn-ana hr-kaydet" id="hrKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`;
  modalAc(mevcut ? 'Ders Kaydı Düzenle' : 'Yeni Ders Kaydı', govde, alt, `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v14H6.5A2.5 2.5 0 0 0 4 20.5V6.5Z" fill="currentColor" opacity=".22"/><path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v14h5.5A2.5 2.5 0 0 1 20 20.5V6.5Z" fill="currentColor" opacity=".22"/><path d="M12 5.2C11 4.4 9.6 4 8 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H8c1.6 0 3 .4 4 1.2m0-16C13 4.4 14.4 4 16 4h2.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H16c-1.6 0-3 .4-4 1.2m0-16v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Ders</span>`);

  $$('.ders-tur .yon-btn').forEach(b => b.onclick = () => { tur = b.dataset.tur; $$('.ders-tur .yon-btn').forEach(x => x.classList.toggle('sec', x.dataset.tur === tur)); });

  let _sonEg = mevcut ? mevcut.egitmenId : '', _sonMu = mevcut ? mevcut.musteriId : (opts.onMusteri || '');
  const egDoldur = (sec) => { const s = $('#dEgitmen'); s.innerHTML = egitmenSecenek(sec); s.value = (sec && State.ortaklar.some(o => o.id === sec)) ? sec : ''; _sonEg = s.value; };
  const muDoldur = (sec) => { const s = $('#dMusteri'); s.innerHTML = musteriSecenek(sec); s.value = (sec && State.musteriler.some(m => m.id === sec)) ? sec : ''; _sonMu = s.value; };
  egDoldur(_sonEg); muDoldur(_sonMu);
  $('#dEgitmen').onchange = () => {
    const v = $('#dEgitmen').value;
    if (v === '__yeni') { $('#dEgitmen').value = _sonEg || ''; yeniEgitmenModal((yk) => egDoldur(yk.id)); }
    else { _sonEg = v; }
  };
  $('#dMusteri').onchange = () => {
    const v = $('#dMusteri').value;
    if (v === '__yeni') { $('#dMusteri').value = _sonMu || ''; yeniMusteriModal((yk) => muDoldur(yk.id)); }
    else { _sonMu = v; }
  };
  tutarKutusuBagla($('#hrTutar'), mevcut ? mevcut.ucret : '');
  tarihGostergeBagla();

  $('#hrIptal').onclick = modalKapat;
  if ($('#hrSil')) $('#hrSil').onclick = () => {
    modalKapat();
    onayModal('Ders kaydı silinsin mi?', 'Bu işlem geri alınamaz.', async () => {
      await DB.sil('dersler', mevcut.id);
      State.dersler = State.dersler.filter(d => d.id !== mevcut.id);
      bildir('Ders kaydı silindi.', 'basari'); geri();
    });
  };
  $('#hrKaydet').onclick = async () => {
    const ucret = tutarSayi($('#hrTutar').value);
    if (!ucret || ucret <= 0) return bildir('Geçerli bir ücret girin.', 'hata');
    const egitmenId = $('#dEgitmen').value;
    if (!egitmenId) return bildir('Eğitmen seçin.', 'hata');
    const musteriId = $('#dMusteri').value;
    if (!musteriId) return bildir('Müşteri seçin.', 'hata');
    const veri = { tarih: $('#hrTarih').value, egitmenId, musteriId, ucret, tur, aciklama: $('#hrAciklama').value.trim() };
    if (mevcut) { await DB.guncelle('dersler', mevcut.id, veri); Object.assign(mevcut, veri); bildir('Ders güncellendi.', 'basari'); }
    else { const y = await DB.ekle('dersler', veri); State.dersler.unshift(y); bildir('Ders kaydedildi.', 'basari'); }
    modalKapat(); geri();
  };
}

/* Ders formundan hızlı eğitmen (ortak) ekle — üstte açılan küçük form */
function yeniEgitmenModal(sonra) {
  const kap = document.createElement('div');
  kap.className = 'modal-perde modal-ust-kat';
  kap.innerHTML = `
    <div class="modal modal-dar" role="dialog">
      <div class="modal-ust"><h3>Yeni Eğitmen</h3><span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="2.8" fill="currentColor" opacity=".28"/><circle cx="8.5" cy="8.5" r="2.8" stroke="currentColor" stroke-width="1.6"/><circle cx="16" cy="9.5" r="2.3" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 18.5c0-2.8 2.2-4.7 5-4.7s5 1.9 5 4.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14.6 14.1c2.3-.2 4.2 1.4 4.6 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>Ortak</span><button class="modal-kapat" type="button">×</button></div>
      <div class="modal-govde">
        <div class="form-alan"><label>Ad Soyad</label><input type="text" id="yeAd" placeholder="Örn. Ayşe Yılmaz"></div>
        <div class="form-alan"><label>Ders Ücreti (₺)</label><input type="number" id="yeUcret" inputmode="decimal" min="0" placeholder="Örn. 300"></div>
      </div>
      <div class="modal-alt"><button class="btn" type="button" data-iptal>İptal</button><button class="btn btn-ana hr-kaydet" type="button" data-kaydet><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Ekle</button></div>
    </div>`;
  document.body.appendChild(kap);
  const kapat = () => kap.remove();
  const inp = kap.querySelector('#yeAd'); setTimeout(() => inp.focus(), 50);
  kap.querySelector('.modal-kapat').onclick = kapat;
  kap.querySelector('[data-iptal]').onclick = kapat;
  kap.onclick = (e) => { if (e.target === kap) kapat(); };
  kap.querySelector('[data-kaydet]').onclick = async () => {
    const ad = inp.value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const yk = await DB.ekle('ortaklar', { ad, dersUcreti: parseFloat(kap.querySelector('#yeUcret').value) || 0, payOrani: 0, aktif: true, foto: null });
    State.ortaklar.push(yk); kapat(); bildir('Eğitmen eklendi.', 'basari'); if (sonra) sonra(yk);
  };
}

/* Ders formundan hızlı müşteri ekle */
function yeniMusteriModal(sonra) {
  const kap = document.createElement('div');
  kap.className = 'modal-perde modal-ust-kat';
  kap.innerHTML = `
    <div class="modal modal-dar" role="dialog">
      <div class="modal-ust"><h3>Yeni Müşteri</h3><span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="currentColor" opacity=".28"/><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19.5c0-3.4 3-5.6 6.5-5.6s6.5 2.2 6.5 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>Müşteri</span><button class="modal-kapat" type="button">×</button></div>
      <div class="modal-govde">
        <div class="form-alan"><label>Ad Soyad</label><input type="text" id="ymAd" placeholder="Örn. Zeynep Demir"></div>
        <div class="form-alan"><label>Telefon (opsiyonel)</label><input type="tel" id="ymTel" placeholder="05..."></div>
      </div>
      <div class="modal-alt"><button class="btn" type="button" data-iptal>İptal</button><button class="btn btn-ana hr-kaydet" type="button" data-kaydet><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Ekle</button></div>
    </div>`;
  document.body.appendChild(kap);
  const kapat = () => kap.remove();
  const inp = kap.querySelector('#ymAd'); setTimeout(() => inp.focus(), 50);
  kap.querySelector('.modal-kapat').onclick = kapat;
  kap.querySelector('[data-iptal]').onclick = kapat;
  kap.onclick = (e) => { if (e.target === kap) kapat(); };
  kap.querySelector('[data-kaydet]').onclick = async () => {
    const ad = inp.value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const yk = await DB.ekle('musteriler', { ad, telefon: kap.querySelector('#ymTel').value.trim() });
    State.musteriler.push(yk); kapat(); bildir('Müşteri eklendi.', 'basari'); if (sonra) sonra(yk);
  };
}

/* ======================= MÜŞTERİLER (cari hesap) ======================= */
SAYFALAR['musteriler'] = () => musterilerSayfasi();

/* Bir müşterinin cari özeti: aldığı ders / bedel / ödediği / kalan borç */
function musteriCari(mid) {
  const dler = State.dersler.filter(d => d.musteriId === mid);
  const bedel = dler.reduce((s, d) => s + (Number(d.ucret) || 0), 0);
  const seans = dler.reduce((s, d) => s + (Number(d.seans) || 0), 0);
  const odenen = musteriTahsilat(mid);
  return { adet: dler.length, seans, bedel, odenen, borc: bedel - odenen };
}

/* Müşterinin paket durumu: en geç bitiş tarihi bugüne eşit/ileri → 'devam', hepsi geçmişse → 'biten', paketsizse → 'yok' */
function paketDurum(mid) {
  const bitisler = State.dersler.filter(d => d.musteriId === mid).map(d => d.bitis).filter(Boolean).sort();
  if (!bitisler.length) return 'yok';
  return bitisler[bitisler.length - 1] >= bugunISO() ? 'devam' : 'biten';
}

let _musFiltre = { paket: 'tumu', borc: 'tumu' };

function musterilerSayfasi() {
  const bas = (ad) => (ad || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  const renk = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];

  const hepsi = State.musteriler.map(m => ({ m, c: musteriCari(m.id), pd: paketDurum(m.id) }));
  const nPaket = { tumu: hepsi.length, devam: hepsi.filter(x => x.pd === 'devam').length, biten: hepsi.filter(x => x.pd === 'biten').length };
  const nBorc = { tumu: hepsi.length, borclu: hepsi.filter(x => x.c.borc > 0).length, odemis: hepsi.filter(x => x.c.borc <= 0).length };

  const gosterilen = hepsi
    .filter(x => (_musFiltre.paket === 'tumu' || x.pd === _musFiltre.paket)
      && (_musFiltre.borc === 'tumu' || (_musFiltre.borc === 'borclu' ? x.c.borc > 0 : x.c.borc <= 0)))
    .sort((a, b) => a.m.ad.localeCompare(b.m.ad, 'tr'));

  const rozet = (pd) => pd === 'devam' ? '<span class="mus-rz dvm">📦 Devam</span>'
    : pd === 'biten' ? '<span class="mus-rz bit">📦 Bitti</span>' : '';

  const satirlar = gosterilen.map(({ m, c, pd }, i) => `<div class="mus-satir">
      <div class="mus-foto ${renk[i % renk.length]}">${kacar(bas(m.ad))}</div>
      <div class="mus-kimlik">
        <div class="mus-ad">${kacar(m.ad)}</div>
        <div class="mus-alt">${rozet(pd)}${c.seans ? `${c.seans} seans` : `${c.adet} kayıt`} · Öd. ${TL(c.odenen)}</div>
      </div>
      <div class="mus-borc">
        <span class="l">Kalan Borç</span>
        <span class="v ${c.borc > 0 ? 'r' : 'g'}">${TL(c.borc)}</span>
      </div>
      <div class="mus-arac">
        <button class="mus-mini ekle" data-mders="${m.id}" title="Ders Ekle">＋</button>
        <button class="mus-mini" data-mduzenle="${m.id}" title="Düzenle">✎</button>
        <button class="mus-mini" data-msil="${m.id}" title="Sil">🗑️</button>
      </div>
    </div>`).join('');

  const opt = (deger, v, ad, n, kirmizi) =>
    `<button type="button" class="${deger === v ? 'sec' + (kirmizi ? ' kirmizi' : '') : ''}" data-val="${v}">${ad}${n != null ? `<small>${n}</small>` : ''}</button>`;

  ic().innerHTML = `
    ${hesapGeriHTML()}
    <div class="ort-ust">
      <span class="ort-ay">👥 ${gosterilen.length} / ${hepsi.length} müşteri</span>
      <button class="btn btn-ana" id="musEkle">＋ Yeni Müşteri</button>
    </div>
    <div class="mus-filtre">
      <div class="seg-grup"><span class="seg-et">Paket</span>
        <div class="seg3d" data-seg="paket">
          ${opt(_musFiltre.paket, 'tumu', 'Tümü')}
          ${opt(_musFiltre.paket, 'devam', 'Devam Eden', nPaket.devam)}
          ${opt(_musFiltre.paket, 'biten', 'Biten', nPaket.biten)}
        </div>
      </div>
      <div class="seg-grup"><span class="seg-et">Borç</span>
        <div class="seg3d" data-seg="borc">
          ${opt(_musFiltre.borc, 'tumu', 'Tümü')}
          ${opt(_musFiltre.borc, 'borclu', 'Borçlu', nBorc.borclu, true)}
          ${opt(_musFiltre.borc, 'odemis', 'Borcu Biten', nBorc.odemis)}
        </div>
      </div>
    </div>
    ${hepsi.length === 0
      ? `<div class="kart">${bosBlok('Henüz müşteri yok. “＋ Yeni Müşteri” ile ekleyin (ders kaydında da eklenebilir).')}</div>`
      : (gosterilen.length === 0
        ? `<div class="kart">${bosBlok('Bu filtreye uygun müşteri yok.')}</div>`
        : `<div class="mus-liste">${satirlar}</div>`)}`;

  $$('.seg3d').forEach(seg => seg.querySelectorAll('button').forEach(b => b.onclick = () => {
    _musFiltre[seg.dataset.seg] = b.dataset.val; musterilerSayfasi();
  }));
  $('#musEkle').onclick = () => musteriFormu();
  $$('[data-mduzenle]').forEach(b => b.onclick = () => musteriFormu(State.musteriler.find(m => m.id === b.dataset.mduzenle)));
  $$('[data-msil]').forEach(b => b.onclick = () => onayModal('Müşteri silinsin mi?', 'Müşterinin ders/ödeme kayıtları kalır ama sahipsiz görünebilir.', async () => {
    await DB.sil('musteriler', b.dataset.msil); State.musteriler = State.musteriler.filter(m => m.id !== b.dataset.msil);
    bildir('Silindi.', 'basari'); musterilerSayfasi();
  }));
  $$('[data-mders]').forEach(b => b.onclick = () => dersKaydiFormu(null, { onMusteri: b.dataset.mders, geri: () => musterilerSayfasi() }));
}

function musteriFormu(mevcut) {
  const govde = `
    <div class="form-alan"><label>Ad Soyad</label><input type="text" id="mfAd" value="${mevcut ? kacar(mevcut.ad) : ''}" placeholder="Örn. Zeynep Demir"></div>
    <div class="form-alan"><label>Telefon (opsiyonel)</label><input type="tel" id="mfTel" value="${mevcut ? kacar(mevcut.telefon || '') : ''}" placeholder="05..."></div>
    <div class="form-alan"><label>Not (opsiyonel)</label><input type="text" id="mfNot" value="${mevcut ? kacar(mevcut.not || '') : ''}"></div>`;
  modalAc(mevcut ? 'Müşteri Düzenle' : 'Yeni Müşteri', govde, `<button class="btn" id="mfIptal">İptal</button><button class="btn btn-ana" id="mfKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`, `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="currentColor" opacity=".28"/><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19.5c0-3.4 3-5.6 6.5-5.6s6.5 2.2 6.5 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>Müşteri</span>`);
  $('#mfIptal').onclick = modalKapat;
  $('#mfKaydet').onclick = async () => {
    const ad = $('#mfAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, telefon: $('#mfTel').value.trim(), not: $('#mfNot').value.trim() };
    if (mevcut) { await DB.guncelle('musteriler', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('musteriler', veri); State.musteriler.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari');
    if (State.aktifSayfa === 'musteriler') musterilerSayfasi(); else git(State.aktifSayfa);
  };
}

/* Tahsilat artık "Yeni Hareket" (banka/kasa) formundan, gelir → "Ders Geliri" + müşteri
   seçilerek yapılır. Ayrı Tahsilat formu kaldırıldı. */

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
          <button class="k-tarih" data-eylem="tarih">${ik('dersler')} Tarihi değiştir</button>
        </div>
        <div class="k-foot"><button class="k-ana kaydet" data-eylem="kaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="currentColor" opacity=".22"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="m8.3 12.2 2.6 2.6 4.8-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Kaydet</button></div>`;
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
    case 'plan4me':     { const d = donemStr(bugunISO()); return { metin: State.dersler.filter(x => donemStr(x.tarih) === d).length + ' ders', sinif: 'n' }; }
    case 'musteriler':  return { metin: State.musteriler.length + ' kişi', sinif: 'n' };
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
  modalAc(mevcut ? 'Kişi Düzenle' : 'Yeni Potansiyel Müşteri', govde, `<button class="btn" id="pIptal">İptal</button><button class="btn btn-ana" id="pKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`);
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
  modalAc('Yeni Kasa', govde, `<button class="btn" id="kIptal">İptal</button><button class="btn btn-ana" id="kKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Oluştur</button>`);
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
  modalAc(mevcut ? bilgi.ad + ' Düzenle' : 'Yeni ' + bilgi.ad, govde, alt, rozetHTML(HESAP_TIP_IK[tip] || 'firma', bilgi.ad));

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
        <span class="hr-rozet"><span class="hr-rz-ik">${ik(tur === 'gelir' ? 'gelir' : 'gider')}</span>${ad}</span>
        <button class="modal-kapat" type="button">×</button></div>
      <div class="modal-govde"><div class="hr-form">
        <div class="hr-grup"><div class="hr-satir"><label for="ykAdInp">${ad} Adı</label>
          <input type="text" id="ykAdInp" placeholder="Örn. ${ornek}"></div></div>
      </div></div>
      <div class="modal-alt">
        <button class="btn" type="button" data-iptal>İptal</button>
        <button class="btn btn-ana hr-kaydet" type="button" data-kaydet><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Ekle</button>
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

/* Banka hareketi ekle / düzenle — muhasebe bilmeyen için basit: Giriş mi Çıkış mı
   opts ile Plan4Me gibi yerlerden yeniden kullanılabilir: {kaynak, rozet, baslik, baslikDuzenle, geri} */
function bankaHareketFormu(bankaId, mevcut, opts = {}) {
  const banka = State.hesaplar.find(h => h.id === bankaId);
  if (!banka) return;
  const kaynak = opts.kaynak || 'banka';
  const rozet = opts.rozet || `<span class="hr-rz-ik">${ik('banka')}</span>${kacar(banka.ad)}`;
  const geri = opts.geri || (() => ekstreSayfasi(banka.tip));
  const gelirKalem = State.hesaplar.filter(h => h.tip === 'gelir');
  const giderKalem = State.hesaplar.filter(h => h.tip === 'gider');
  // Düzenlemede yön: gelir → giriş, diğer (gider/ortakOdeme) → çıkış
  const baslangicYon = mevcut ? (mevcut.tip === 'gelir' ? 'giris' : 'cikis') : 'giris';
  // "Ders Geliri" gelir kalemi seçilirse müşteri (tahsilat) seçtirilir
  const dersGelirKalem = State.hesaplar.find(h => h.tip === 'gelir' && h.ad === 'Ders Geliri');

  const kalemSecenek = (liste, secili) =>
    `<option value="">— Kalem seç —</option>`
    + liste.map(h => `<option value="${h.id}" ${secili === h.id ? 'selected' : ''}>${kacar(h.ad)}</option>`).join('')
    + `<option value="__yeni">➕ Yeni kalem ekle…</option>`;
  const musteriSecenek = (sec) => `<option value="">— Müşteri seç —</option>`
    + State.musteriler.map(m => `<option value="${m.id}" ${sec === m.id ? 'selected' : ''}>${kacar(m.ad)}</option>`).join('')
    + `<option value="__yeni">➕ Yeni Müşteri ekle…</option>`;

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
        <div class="hr-satir sel gizli" id="hrMusteriKap"><label for="hrMusteri">Müşteri</label><select id="hrMusteri"></select></div>
        <div class="hr-satir"><label for="hrAciklama">Açıklama</label><input type="text" id="hrAciklama" value="${mevcut ? kacar(mevcut.aciklama || '') : ''}" placeholder="Örn. Ocak ders geliri"></div>
      </div>
    </div>`;

  const alt = `${mevcut ? '<button class="btn btn-kirmizi" id="hrSil" style="margin-right:auto"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 7h12M9.5 7V5.6A1.2 1.2 0 0 1 10.7 4.4h2.6A1.2 1.2 0 0 1 14.5 5.6V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" fill="currentColor" opacity=".2"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.3 10.5v6M13.7 10.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Sil</button>' : ''}
    <button class="btn" id="hrIptal">İptal</button><button class="btn btn-ana hr-kaydet" id="hrKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`;
  modalAc(mevcut ? (opts.baslikDuzenle || 'Hareketi Düzenle') : (opts.baslik || 'Yeni Hareket'), govde, alt, `<span class="hr-rozet">${rozet}</span>`);

  let yon = baslangicYon, _sonKalem = '', _sonMu = mevcut ? (mevcut.musteriId || '') : '';
  // Tahsilat (müşteri) satırını göster/gizle: sadece Para Girdi + "Ders Geliri" kaleminde
  const musteriSatirGuncelle = () => {
    const goster = yon === 'giris' && dersGelirKalem && $('#hrKalem').value === dersGelirKalem.id;
    $('#hrMusteriKap').classList.toggle('gizli', !goster);
    if (goster) { const s = $('#hrMusteri'); s.innerHTML = musteriSecenek(_sonMu); s.value = (_sonMu && State.musteriler.some(m => m.id === _sonMu)) ? _sonMu : ''; }
    return goster;
  };
  const kalemDoldur = (seciliId) => {
    const et = $('#hrKalemEt'), sel = $('#hrKalem');
    const liste = State.hesaplar.filter(h => h.tip === (yon === 'giris' ? 'gelir' : 'gider'));
    et.textContent = yon === 'giris' ? 'Gelir Adı' : 'Gider Adı';
    const secDef = seciliId || (mevcut && ((yon === 'giris') === (mevcut.tip === 'gelir')) ? mevcut.kategoriId : null);
    sel.innerHTML = kalemSecenek(liste, secDef);
    // Yeni harekette "— Kalem seç —" ile başla (ilk kalem otomatik seçilmesin)
    sel.value = (secDef && liste.some(h => h.id === secDef)) ? secDef : '';
    _sonKalem = sel.value;
    musteriSatirGuncelle();
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
    } else { _sonKalem = v; musteriSatirGuncelle(); }
  };
  kalemDoldur();
  $('#hrMusteri').onchange = () => {
    const v = $('#hrMusteri').value;
    if (v === '__yeni') { $('#hrMusteri').value = _sonMu || ''; yeniMusteriModal((yk) => { _sonMu = yk.id; musteriSatirGuncelle(); }); }
    else { _sonMu = v; }
  };
  tutarKutusuBagla($('#hrTutar'), mevcut ? mevcut.tutar : '');
  tarihGostergeBagla();

  $('#hrIptal').onclick = modalKapat;
  if ($('#hrSil')) $('#hrSil').onclick = () => {
    modalKapat();
    onayModal('Hareket silinsin mi?', `Kayıt No <b>#${mevcut.kayitNo || '—'}</b> — “${kacar(mevcut.aciklama || '')}” silinecek.`, async () => {
      await DB.sil('islemler', mevcut.id);
      State.islemler = State.islemler.filter(x => x.id !== mevcut.id);
      bildir('Hareket silindi.', 'basari'); geri();
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
      aciklama: $('#hrAciklama').value.trim(), kaynak,
    };
    // "Ders Geliri" seçiliyse müşteri tahsilatı olarak işaretle
    const tahsilatMi = yon === 'giris' && dersGelirKalem && katId === dersGelirKalem.id;
    if (tahsilatMi) {
      const mid = $('#hrMusteri').value;
      if (!mid || mid === '__yeni') return bildir('Tahsilat için müşteri seçin.', 'hata');
      veri.musteriId = mid; veri.kaynak = 'tahsilat';
    } else if (mevcut && mevcut.musteriId) {
      veri.musteriId = null;   // tahsilat kalemi değiştiyse müşteri bağını kaldır
    }
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
    modalKapat(); geri();
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

  const alt = `${mevcut ? '<button class="btn btn-kirmizi" id="hrSil" style="margin-right:auto"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 7h12M9.5 7V5.6A1.2 1.2 0 0 1 10.7 4.4h2.6A1.2 1.2 0 0 1 14.5 5.6V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" fill="currentColor" opacity=".2"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.3 10.5v6M13.7 10.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Sil</button>' : ''}
    <button class="btn" id="hrIptal">İptal</button><button class="btn btn-ana hr-kaydet" id="hrKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`;
  modalAc(mevcut ? 'Kart Hareketi Düzenle' : 'Yeni Kart Hareketi', govde, alt, `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="3" fill="currentColor" opacity=".3"/><rect x="2.5" y="5.5" width="19" height="13" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 9.7h19" stroke="currentColor" stroke-width="1.8"/><path d="M6 15h4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>${kacar(kart.ad)}</span>`);

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
  const alt = `<button class="btn" id="ffIptal">İptal</button><button class="btn btn-ana" id="ffKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`;
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
  modalAc(`${h.ad} — Hareketler`, govde, `<button class="btn" onclick="document.getElementById('modalKap').innerHTML=''">Kapat</button>`, rozetHTML(HESAP_TIP_IK[h.tip] || 'firma', HESAP_TIPLERI[h.tip].ad));
}
function islemTipAd(i) {
  return { gelir:'Gelir', gider:'Gider', transfer:'Transfer', ortakOdeme:'Ortak Ödeme' }[i.tip] || i.tip;
}

/* Ortaklar Hesabı — hak ediş vs ödenen */
let _ortakDonem = null;   // Ortaklar Hesabı sayfasında görüntülenen dönem

function ortakHesabiSayfasi() {
  const donem = _ortakDonem || donemStr(bugunISO());
  const duzenlenebilir = adminMi();
  let rows = ortakHesapla(donem);
  const benim = aktifOrtakId();
  if (benim) rows = rows.filter(r => r.o.id === benim);

  ic().innerHTML = `
    ${duzenlenebilir ? hesapGeriHTML() : ''}
    <div class="ort-ust">
      <div class="p4-donem" style="margin:0">
        <button type="button" class="p4-ok" id="ortGeri" title="Önceki ay">‹</button>
        <span class="p4-ay">${donemAdi(donem)}</span>
        <button type="button" class="p4-ok" id="ortIleri" title="Sonraki ay">›</button>
      </div>
      ${duzenlenebilir ? '<button class="btn btn-ana" id="ortEkle">＋ Ortak Ekle</button>' : ''}
    </div>
    ${rows.length === 0
      ? `<div class="kart">${bosBlok(benim ? 'Bu ay kaydınız yok.' : 'Henüz ortak yok. “＋ Ortak Ekle” ile ekleyin.')}</div>`
      : `<div class="ortakkart" style="margin-top:0"><div class="he-izgara">${rows.map((r, i) => ortakFisKartHTML(r, i, duzenlenebilir)).join('')}</div></div>`}`;

  $('#ortGeri').onclick = () => { _ortakDonem = donemKaydir(donem, -1); ortakHesabiSayfasi(); };
  $('#ortIleri').onclick = () => { _ortakDonem = donemKaydir(donem, +1); ortakHesabiSayfasi(); };
  if ($('#ortEkle')) $('#ortEkle').onclick = () => ortakFormu();
  $$('[data-duzenle]').forEach(b => b.onclick = () => ortakFormu(State.ortaklar.find(o => o.id === b.dataset.duzenle)));
  $$('[data-sil]').forEach(b => b.onclick = () => onayModal('Ortak silinsin mi?', 'Bu işlem geri alınamaz.', async () => {
    await DB.sil('ortaklar', b.dataset.sil);
    State.ortaklar = State.ortaklar.filter(o => o.id !== b.dataset.sil);
    bildir('Silindi.', 'basari'); ortakHesabiSayfasi();
  }));
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
  modalAc('Ortak Ödemesi', govde, `<button class="btn" id="oIptal">İptal</button><button class="btn btn-ana" id="oKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`);
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

/* -------- GİDERLER RAPORU (gruplu + karşılaştırma) -------- */
let giderRaporDonem = buAy();
let giderRaporKarsi = false;
let giderRaporKapali = new Set();   // kapalı gruplar (grup adı)
/* Bir dönemin giderlerini grupla: { grupAd: { ad, toplam, kalemler:{ kalemAd:{ad,toplam,kayitlar[]} } } } */
function giderRaporVeri(donem) {
  const gruplar = {};
  (State.giderKayitlari || []).filter(g => donemStr(g.tarih) === donem && !g.kkOdeme).forEach(g => {
    const grpAd = (g.grupAd || '').trim() || 'Diğer';
    const klmAd = (g.giderAd || '').trim() || grpAd;
    const grp = gruplar[grpAd] || (gruplar[grpAd] = { ad: grpAd, toplam: 0, kalemler: {} });
    const klm = grp.kalemler[klmAd] || (grp.kalemler[klmAd] = { ad: klmAd, toplam: 0, kayitlar: [] });
    const t = Number(g.tutar) || 0;
    grp.toplam += t; klm.toplam += t; klm.kayitlar.push(g);
  });
  return gruplar;
}
/* Bir kalemin seçili aydaki kayıtlarını hesap-defteri formunda göster */
function giderKalemDetay(donem, grpAd, klmAd) {
  const grp = giderRaporVeri(donem)[grpAd];
  const klm = grp && grp.kalemler[klmAd];
  if (!klm) return;
  const kayitlar = klm.kayitlar.slice().sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  const satir = (g) => {
    const ort = g.ortakId ? State.ortaklar.find(x => x.id === g.ortakId) : null;
    const kime = ort ? egitmenKisaAd(ort) : (g.kaynakOdemeId ? '' : 'Tüm ortaklar');
    return `<tr>
      <td data-l="Tarih">${fmtTarihUzun(g.tarih)}</td>
      <td data-l="Açıklama">${kacar(g.aciklama || g.giderAd || '—')}${kime ? `<div class="hs-alt gr">${ik('kisi','uik-mini')}${kacar(kime)}</div>` : ''}</td>
      <td data-l="Ödeme">${kacar(HESAP_TANIM[g.odemeSekli] ? HESAP_TANIM[g.odemeSekli].ad : (g.odemeSekli || '—'))}</td>
      <td data-l="Tutar" class="sag"><span class="hs-art e">−${binlik(Number(g.tutar) || 0)} ₺</span></td>
    </tr>`;
  };
  const govde = `<div class="gk-detay-kap">
      <div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo">
        <colgroup><col style="width:20%"><col style="width:44%"><col style="width:18%"><col style="width:18%"></colgroup>
        <thead><tr><th>Tarih</th><th>Açıklama</th><th>Ödeme</th><th class="sag">Tutar</th></tr></thead>
        <tbody>${kayitlar.map(satir).join('')}</tbody>
        <tfoot><tr><td colspan="3">Toplam — ${kayitlar.length} kayıt</td><td class="sag"><span class="hs-art e">−${binlik(klm.toplam)} ₺</span></td></tr></tfoot>
      </table></div></div>
    </div>`;
  modalAc(`${klmAd} — ${donemAdi(donem)}`, govde, `<button class="btn" id="gkDetayKapat">Kapat</button>`);
  const kb = $('#gkDetayKapat'); if (kb) kb.onclick = modalKapat;
}
SAYFALAR['rapor-giderler'] = function () {
  const donem = giderRaporDonem;
  const govdeCiz = () => {
    if (giderRaporKarsi) return giderRaporKarsiHTML(donem);
    const gruplar = Object.values(giderRaporVeri(donem)).sort((a, b) => b.toplam - a.toplam);
    const dip = gruplar.reduce((s, g) => s + g.toplam, 0);
    if (!gruplar.length) return `<div class="gp-bos">${donemAdi(donem)} için gider kaydı yok.</div>`;
    const grpHTML = gruplar.map(grp => {
      const acik = !giderRaporKapali.has(grp.ad);
      const kalemler = Object.values(grp.kalemler).sort((a, b) => b.toplam - a.toplam);
      const satirlar = acik ? kalemler.map(k =>
        `<div class="gr-sat" data-grp="${kacar(grp.ad)}" data-klm="${kacar(k.ad)}"><span class="ad"><span class="nk"></span>${kacar(k.ad)}</span><span class="gr-cnt">${k.kayitlar.length} kayıt</span><span class="gr-tut">−${binlik(k.toplam)} ₺</span><span class="gr-chev">›</span></div>`
      ).join('') : '';
      return `<div class="gr-grp">
          <div class="gr-grpbas" data-grpkapa="${kacar(grp.ad)}"><span class="ad"><span class="ik">📁</span>${kacar(grp.ad)}</span><span class="gr-cnt"></span><span class="gr-tut top">−${binlik(grp.toplam)} ₺</span><span class="gr-chev"></span></div>
          ${satirlar}
        </div>`;
    }).join('');
    return `<div class="gr-kutu">${grpHTML}
        <div class="gr-dip"><span class="k">💰 Dip Toplam — ${donemAdi(donem)}</span><span class="v">−${binlik(dip)} ₺</span></div>
      </div>`;
  };
  ic().innerHTML = `
    <div class="gr-ust">
      ${ayNavHTML(donem).replace('class="ay-nav"', 'class="ay-nav gr-ay"')}
      <button type="button" class="gr-karsi ${giderRaporKarsi ? 'acik' : ''}" id="grKarsiBtn"><span class="sw"></span>⇄ Karşılaştır</button>
    </div>
    <div id="grGovde">${govdeCiz()}</div>`;
  const yenile = () => { $('#grGovde').innerHTML = govdeCiz(); bagla(); };
  const bagla = () => {
    $$('[data-grpkapa]').forEach(b => b.onclick = () => { const a = b.dataset.grpkapa; if (giderRaporKapali.has(a)) giderRaporKapali.delete(a); else giderRaporKapali.add(a); yenile(); });
    $$('[data-klm]').forEach(b => b.onclick = () => giderKalemDetay(donem, b.dataset.grp, b.dataset.klm));
  };
  $$('[data-ay]').forEach(b => b.onclick = () => { giderRaporDonem = donemKaydir(giderRaporDonem, Number(b.dataset.ay)); SAYFALAR['rapor-giderler'](); });
  $('#grKarsiBtn').onclick = () => { giderRaporKarsi = !giderRaporKarsi; SAYFALAR['rapor-giderler'](); };
  bagla();
};
/* Karşılaştırma: 1. sütun Tanımlamalardaki gider başlıkları, sonra 2 ay önce · 1 ay önce · güncel ay */
function giderRaporKarsiHTML(donem) {
  const donemler = [donemKaydir(donem, -2), donemKaydir(donem, -1), donem];
  const idSet = new Set((State.giderler || []).map(x => x.id));
  // her dönem için kalem-anahtarı bazında toplam
  const kayitKey = (g) => idSet.has(g.giderId) ? g.giderId : ('ad::' + ((g.giderAd || '').trim() || 'Diğer'));
  const topMap = donemler.map(d => {
    const m = {};
    (State.giderKayitlari || []).filter(g => donemStr(g.tarih) === d && !g.kkOdeme).forEach(g => { const k = kayitKey(g); m[k] = (m[k] || 0) + (Number(g.tutar) || 0); });
    return m;
  });
  const kalemTut = (key) => donemler.map((d, i) => topMap[i][key] || 0);
  // Tanımlı gruplar + kalemler
  const bloklar = [];
  (State.giderGruplari || []).forEach(grp => {
    const items = (State.giderler || []).filter(x => x.grupId === grp.id);
    if (!items.length) return;
    bloklar.push({ ad: grp.ad, ik: '📁', kalemler: items.map(it => ({ ad: it.ad, tut: kalemTut(it.id) })) });
  });
  // Tanımsız kalemler (ör. Banka Komisyonu) → "Diğer"
  const digerKeys = new Set();
  donemler.forEach((d, i) => Object.keys(topMap[i]).forEach(k => { if (k.startsWith('ad::')) digerKeys.add(k); }));
  if (digerKeys.size) {
    bloklar.push({ ad: 'Diğer', ik: '🏦', kalemler: [...digerKeys].map(k => ({ ad: k.slice(4), tut: kalemTut(k) })) });
  }
  if (!bloklar.length) return `<div class="gp-bos">Tanımlı gider başlığı yok.</div>`;
  const ay = (d) => donemAdi(d).replace(/ \d{4}$/, '');
  const dipTop = donemler.map((d, i) => Object.values(topMap[i]).reduce((s, v) => s + v, 0));
  const num = (n, guncel) => `<td class="num${guncel ? ' guncel' : ''}">${n ? binlik(n) : '—'}</td>`;
  const govdeSatir = bloklar.map(b => {
    const grpTut = donemler.map((d, i) => b.kalemler.reduce((s, k) => s + k.tut[i], 0));
    const grpBas = `<tr class="krs-grpbas"><td>${b.ik} ${kacar(b.ad)}</td>${grpTut.map((v, i) => num(v, i === 2)).join('')}</tr>`;
    const klm = b.kalemler.map(k => `<tr><td>${kacar(k.ad)}</td>${k.tut.map((v, i) => num(v, i === 2)).join('')}</tr>`).join('');
    return grpBas + klm;
  }).join('');
  return `<div class="gr-kutu"><div class="ogr-kaydir"><table class="krs-tablo">
      <thead><tr><th>Gider Kalemi</th><th>${kacar(ay(donemler[0]))}</th><th>${kacar(ay(donemler[1]))}</th><th class="gun">${kacar(ay(donemler[2]))} ✦</th></tr></thead>
      <tbody>${govdeSatir}
        <tr class="krs-dip"><td>Dip Toplam</td><td>${binlik(dipTop[0])}</td><td>${binlik(dipTop[1])}</td><td>${binlik(dipTop[2])}</td></tr>
      </tbody>
    </table></div></div>`;
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
  const kareIc = () => fotoData ? `<img src="${fotoData}" alt="">` : `<span class="ph">📷</span>`;
  const govde = `
    <div class="gp-logo-alan">
      <div class="gp-logo-kare gp-ort-kare" id="oFotoOnizle" title="Fotoğraf seç">${kareIc()}</div>
      <div class="gp-logo-btnlar">
        <button type="button" class="gp-sec" id="oFotoBtn">📷 Fotoğraf Seç</button>
        <button type="button" class="gp-kaldir" id="oFotoSil" ${fotoData ? '' : 'style="display:none"'}>Kaldır</button>
      </div>
      <input type="file" id="oFotoDosya" accept="image/*" hidden>
    </div>
    <div class="gp-alan" style="margin:0"><label>Ad Soyad</label><input type="text" class="gp-inp" id="oAd" value="${mevcut ? kacar(mevcut.ad) : ''}" placeholder="Örn. Ayşe Yılmaz"></div>`;
  modalAc(mevcut ? 'Ortak Düzenle' : 'Yeni Ortak', govde,
    `<button class="btn" id="oiIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="oiKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="2.8" fill="currentColor" opacity=".28"/><circle cx="8.5" cy="8.5" r="2.8" stroke="currentColor" stroke-width="1.6"/><circle cx="16" cy="9.5" r="2.3" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 18.5c0-2.8 2.2-4.7 5-4.7s5 1.9 5 4.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14.6 14.1c2.3-.2 4.2 1.4 4.6 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>Ortak</span>`);
  const sec = () => $('#oFotoDosya').click();
  $('#oFotoBtn').onclick = sec; $('#oFotoOnizle').onclick = sec;
  $('#oFotoSil').onclick = () => { fotoData = null; $('#oFotoOnizle').innerHTML = kareIc(); $('#oFotoSil').style.display = 'none'; };
  $('#oFotoDosya').onchange = () => {
    const f = $('#oFotoDosya').files[0]; if (!f) return;
    fotoKirp(f, (veri) => { fotoData = veri; $('#oFotoOnizle').innerHTML = `<img src="${veri}" alt="">`; $('#oFotoSil').style.display = ''; });
    $('#oFotoDosya').value = '';
  };
  $('#oiIptal').onclick = modalKapat;
  $('#oiKaydet').onclick = async () => {
    const ad = $('#oAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, foto: fotoData || null, aktif: true };
    if (mevcut) { await DB.guncelle('ortaklar', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('ortaklar', veri); State.ortaklar.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari');
    const s = State.aktifSayfa;
    if (s === 'ayar-ortak') SAYFALAR['ayar-ortak'](); else git(s || 'ayar-ortak');
  };
}

/* WhatsApp tarzı fotoğraf kırpma — daire içinde sürükle + yakınlaştır, kırpılmış kareyi döndürür */
function fotoKirp(dosya, onTamam) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => acModal(img);
    img.onerror = () => bildir('Görsel okunamadı.', 'hata');
    img.src = fr.result;
  };
  fr.readAsDataURL(dosya);

  function acModal(img) {
    const ST = 264, CR = 220, R = CR / 2, OUT = 240;
    const baseScale = CR / Math.min(img.width, img.height);
    let scale = 1, tx = 0, ty = 0;
    const kap = document.createElement('div');
    kap.className = 'modal-perde modal-ust-kat';
    kap.innerHTML = `
      <div class="modal modal-dar" role="dialog">
        <div class="modal-ust"><h3>Fotoğrafı Ayarla</h3></div>
        <div class="kirp-stage" style="width:${ST}px;height:${ST}px">
          <img id="kImg" alt="" draggable="false">
          <div class="kirp-mask" style="--r:${R}px"></div>
          <div class="kirp-ring" style="width:${CR}px;height:${CR}px"></div>
        </div>
        <p class="kirp-ipuc">Sürükleyerek konumla · çubukla yakınlaştır</p>
        <div class="kirp-zoom"><span>🏔️</span><input type="range" id="kZoom" min="1" max="3" step="0.01" value="1"><span style="font-size:19px">🏔️</span></div>
        <div class="modal-alt"><button class="btn" id="kIptal">İptal</button><button class="btn btn-ana hr-kaydet" id="kKullan"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="currentColor" opacity=".22"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="m8.3 12.2 2.6 2.6 4.8-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Kullan</button></div>
      </div>`;
    document.body.appendChild(kap);
    const el = kap.querySelector('#kImg');
    el.src = img.src; el.style.width = img.width + 'px'; el.style.height = img.height + 'px';
    const clamp = () => {
      const ds = baseScale * scale;
      const mx = Math.max(0, (img.width * ds - CR) / 2), my = Math.max(0, (img.height * ds - CR) / 2);
      tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty));
    };
    const uygula = () => {
      const ds = baseScale * scale;
      const L = ST / 2 + tx - img.width * ds / 2, T = ST / 2 + ty - img.height * ds / 2;
      el.style.transform = `translate(${L}px,${T}px) scale(${ds})`;
    };
    uygula();
    let sur = false, ox = 0, oy = 0;
    el.addEventListener('pointerdown', e => { e.preventDefault(); sur = true; ox = e.clientX - tx; oy = e.clientY - ty; });
    const mv = e => { if (!sur) return; tx = e.clientX - ox; ty = e.clientY - oy; clamp(); uygula(); };
    const up = () => { sur = false; };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    kap.querySelector('#kZoom').addEventListener('input', e => { scale = parseFloat(e.target.value); clamp(); uygula(); });
    const kapat = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); kap.remove(); };
    kap.querySelector('#kIptal').onclick = kapat;
    kap.onclick = e => { if (e.target === kap) kapat(); };
    kap.querySelector('#kKullan').onclick = () => {
      const ds = baseScale * scale;
      const L = ST / 2 + tx - img.width * ds / 2, T = ST / 2 + ty - img.height * ds / 2;
      const srcX = (ST / 2 - R - L) / ds, srcY = (ST / 2 - R - T) / ds, srcWH = CR / ds;
      const c = document.createElement('canvas'); c.width = OUT; c.height = OUT;
      c.getContext('2d').drawImage(img, srcX, srcY, srcWH, srcWH, 0, 0, OUT, OUT);
      let veri; try { veri = c.toDataURL('image/jpeg', 0.85); } catch { veri = img.src; }
      kapat(); onTamam(veri);
    };
  }
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
  let aktif = mevcut ? mevcut.aktif !== false : true;
  const govde = `
    <div class="gp-alan"><label>Komisyon Adı</label><input type="text" class="gp-inp" id="kAd" value="${mevcut ? kacar(mevcut.ad) : ''}" placeholder="Örn. Kredi Kartı POS" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="uy-ikili">
      <div class="gp-alan" style="margin:0"><label>Oran (%)</label><input type="text" inputmode="decimal" class="gp-inp" id="kOran" value="${mevcut ? kacar(String(mevcut.oran)) : ''}" placeholder="Örn. 1.5"></div>
      <div class="gp-alan" style="margin:0"><label>Durum</label><div class="turcip" id="kDurum"><button type="button" class="tc ${aktif ? 'sec' : ''}" data-a="1">Aktif</button><button type="button" class="tc ${!aktif ? 'sec' : ''}" data-a="0">Pasif</button></div></div>
    </div>`;
  modalAc(mevcut ? 'Komisyon Düzenle' : 'Yeni Komisyon', govde,
    `<button class="btn" id="kiIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="kiKaydet">${ik('kaydet')} Kaydet</button>`,
    rozetHTML('banka', 'Komisyon'));
  $('#kDurum').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; aktif = b.dataset.a === '1'; $$('#kDurum .tc').forEach(x => x.classList.toggle('sec', x === b)); };
  $('#kiIptal').onclick = modalKapat;
  $('#kiKaydet').onclick = async () => {
    const ad = $('#kAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, oran: parseFloat((($('#kOran').value || '').replace(',', '.'))) || 0, aktif };
    if (mevcut) { await DB.guncelle('komisyonlar', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('komisyonlar', veri); State.komisyonlar.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); git('ayar-komisyon');
  };
}

/* Gelir vergisi kesinti oranı (%) — havale/kart tahsilatlarında kâr dağıtımı önizlemesinde kullanılır.
   Bankaya/gidere yansımaz; yalnızca ortağın "Verilecek Pay" hesabından düşülür. Varsayılan %20. */
function vergiOrani() {
  const n = Number(State.ayarlar && State.ayarlar.vergiOrani);
  return (isFinite(n) && n >= 0 && n <= 100) ? n : 20;
}
SAYFALAR['ayar-vergi'] = function () {
  if (!adminMi()) { git('dashboard'); return; }
  const oran = vergiOrani();
  ic().innerHTML = `
    <div class="tnm-scr-ust"><button type="button" class="tnm-geri" id="vgGeri">‹ Tanımlamalar</button></div>
    <div class="bilgi-kutu" style="max-width:560px;margin:0 0 14px"><span class="ikon">${ik('belge')}</span><div><b>Havale</b> ve <b>kredi kartı</b> (bankaya giren) tahsilatların üzerine bu oranda vergi hesaplanır — <b>nakit hariç</b>. Kârlılık ekranında ayrı satır olarak net’ten düşülür; <b>bankaya/gidere yansımaz</b>. Örn. %20 ile 10.000 ₺ havale/kart → 2.000 ₺ vergi.</div></div>
    <div class="kart" style="max-width:560px">
      <div class="kart-baslik"><h3>Vergi / KDV Oranı</h3><span class="rozet-etk rz-banka">Havale + Kart</span></div>
      <div class="gp-alan uy-birimli" style="max-width:220px"><label>Vergi Oranı</label><input type="text" inputmode="decimal" class="gp-inp" id="vgOran" value="${kacar(String(oran))}" placeholder="20"><span class="uy-birim">%</span></div>
      <div style="margin-top:14px"><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="vgKaydet">${ik('kaydet')} Kaydet</button></div>
    </div>`;
  $('#vgGeri').onclick = () => git('ayar-tanimlama');
  $('#vgKaydet').onclick = () => {
    let n = parseFloat((($('#vgOran').value || '').replace(',', '.'))); if (!isFinite(n)) n = 0;
    n = Math.min(100, Math.max(0, n));
    DB.ayarYaz({ ...State.ayarlar, vergiOrani: n });
    bildir('Vergi oranı kaydedildi (%' + String(n).replace('.', ',') + ').', 'basari');
    git('ayar-tanimlama');
  };
};

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
  modalAc(mevcut ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı', govde, `<button class="btn" id="uiIptal">İptal</button><button class="btn btn-ana" id="uiKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`);
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

/* En güncel sürümü zorla getir: önbelleği/servis çalışanını temizle, taze index.html yükle.
   localStorage'a (verilere) dokunmaz. Sol alttaki ⟳ düğmesinden çağrılır. */
async function enGuncelSurumuGetir() {
  const btn = $('#ksGuncelle');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; btn.classList.add('donuyor'); }
  bildir('En güncel sürüm getiriliyor…', '');
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
  if (!adminMi()) { git('dashboard'); return; }
  const a = State.ayarlar || {};
  const logoVar = !!a.logoData;
  ic().innerHTML = `
    <div class="tnm-kol">
      <div class="tnm-scr-ust"><button type="button" class="tnm-geri" id="fbGeri">‹ Tanımlamalar</button></div>
      <div class="gp-kart gp-anim"><div class="gp-ic">
        <div class="gp-head"><div class="kk">Firma</div><h2>Firma Bilgileri</h2></div>
        <div class="gp-logo-alan">
          <div class="gp-logo-kare">
            ${logoVar ? `<img src="${a.logoData}" alt="logo">` : `<span class="mono">${kacar(monogram(a.firmaAd || 'Green Village'))}</span>`}
          </div>
          <div class="gp-logo-btnlar">
            <button type="button" class="gp-sec" id="logoSec">📷 Logo Seç</button>
            ${logoVar ? `<button type="button" class="gp-kaldir" id="logoSil">Kaldır</button>` : ''}
          </div>
          <input type="file" id="logoDosya" accept="image/*" hidden>
        </div>
        <div class="gp-alan"><label>Firma Adı</label><input type="text" class="gp-inp" id="fAd" value="${kacar(a.firmaAd || '')}" placeholder="Green Village Pilates"></div>
        <button type="button" class="gp-kaydet" id="fKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>
      </div></div>
    </div>`;
  $('#fbGeri').onclick = () => git('ayar-tanimlama');
  const dosya = $('#logoDosya');
  $('#logoSec').onclick = () => dosya.click();
  dosya.onchange = () => {
    const f = dosya.files[0]; if (!f) return;
    // Yakınlaştır/kırp aracı ile kareye oturt (logo her yerde net görünür)
    fotoKirp(f, (veri) => { DB.ayarYaz({ ...State.ayarlar, logoData: veri }); firmaBilgileriUygula(); git('ayar-firma'); bildir('Logo kaydedildi.', 'basari'); });
    dosya.value = '';
  };
  if ($('#logoSil')) $('#logoSil').onclick = () => {
    const yeni = { ...State.ayarlar }; delete yeni.logoData;
    DB.ayarYaz(yeni); firmaBilgileriUygula(); git('ayar-firma'); bildir('Logo kaldırıldı.', 'basari');
  };
  $('#fKaydet').onclick = () => {
    DB.ayarYaz({ ...State.ayarlar, firmaAd: $('#fAd').value.trim() });
    firmaBilgileriUygula(); bildir('Kaydedildi.', 'basari');
  };
};

/* -------- AYARLAR: Ortak Bilgileri (ad + logo) -------- */
SAYFALAR['ayar-ortak'] = function () {
  if (!adminMi()) { git('dashboard'); return; }
  const list = State.ortaklar;
  const bas = (ad) => (ad || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  const renk = ['f1', 'f2', 'f3', 'f4'];
  const kartlar = list.map((o, i) => {
    const foto = o.foto
      ? `<div class="gp-ort-foto"><img src="${o.foto}" alt="${kacar(o.ad)}"></div>`
      : `<div class="gp-ort-foto ${renk[i % renk.length]}">${kacar(bas(o.ad))}</div>`;
    return `<div class="gp-ort-kart"><div class="gp-ort-ic">
      <div class="gp-ort-arac"><button type="button" data-duzenle="${o.id}" title="Düzenle">✎</button><button type="button" data-sil="${o.id}" title="Sil">🗑️</button></div>
      ${foto}
      <div class="gp-ort-ad">${kacar(o.ad)}</div>
    </div></div>`;
  }).join('');
  ic().innerHTML = `
    <div class="tnm-scr-ust">
      <button type="button" class="tnm-geri" id="obGeri">‹ Tanımlamalar</button>
      <button type="button" class="gp-ekle" id="ortEkle">＋ Ortak Ekle</button>
    </div>
    ${list.length === 0
      ? `<div class="gp-bos">Henüz ortak yok. “＋ Ortak Ekle” ile ekleyin.</div>`
      : `<div class="gp-ort-grid gp-anim">${kartlar}</div>`}`;
  $('#obGeri').onclick = () => git('ayar-tanimlama');
  $('#ortEkle').onclick = () => ortakFormu();
  $$('[data-duzenle]').forEach(b => b.onclick = () => ortakFormu(State.ortaklar.find(o => o.id === b.dataset.duzenle)));
  $$('[data-sil]').forEach(b => b.onclick = () => onayModal('Ortak silinsin mi?', 'Bu işlem geri alınamaz.', async () => {
    await DB.sil('ortaklar', b.dataset.sil);
    State.ortaklar = State.ortaklar.filter(o => o.id !== b.dataset.sil);
    bildir('Silindi.', 'basari'); SAYFALAR['ayar-ortak']();
  }));
};

/* -------- ORTAKLAR: aylık pay / hakediş -------- */
let ortakDonem = buAy();
let ortakAcikSet = new Set();
function ogrenciEgitmenId(oid) { const o = State.ogrenciler.find(x => x.id === oid); return o ? o.egitmenId : null; }
function ortakAyHesap(donem) {
  const aktif = State.ortaklar.filter(o => o.aktif !== false);
  // Kredi Kartı giderleri henüz borç → ortak giderine sayılmaz (ödendiğinde Banka'ya "Kredi Kartı Borç Ödemesi" olarak girer ve sayılır)
  const gkTum = (State.giderKayitlari || []).filter(g => donemStr(g.tarih) === donem && (g.odemeSekli || 'nakit') !== 'kart');
  const gk = gkTum.filter(g => !g.otoKomisyon);          // normal giderler (paylaşılan/tek ortak)
  const paylasilan = gk.filter(g => !g.ortakId).reduce((s, g) => s + (Number(g.tutar) || 0), 0);   // Tüm ortaklar → eşit bölünür
  const ortakGider = {}; gk.filter(g => g.ortakId).forEach(g => { ortakGider[g.ortakId] = (ortakGider[g.ortakId] || 0) + (Number(g.tutar) || 0); });   // tek ortağa yazılan
  const paylasilanPay = aktif.length ? paylasilan / aktif.length : 0;
  // Banka Komisyonu → yalnızca geliri kazanan eğitmene ait (Komisyon Gideri), bölünmez
  const komisyonMap = {};
  gkTum.filter(g => g.otoKomisyon).forEach(g => {
    const src = (State.odemeler || []).find(o => o.id === g.kaynakOdemeId);
    const eg = src ? (src.ortakId || ogrenciEgitmenId(src.ogrenciId)) : (g.ortakId || null);
    if (eg) komisyonMap[eg] = (komisyonMap[eg] || 0) + (Number(g.tutar) || 0);
  });
  // Gelir Vergisi Kesintisi (önizleme) → havale/kart tahsilatların komisyon-net matrahından hesaplanır.
  // Bankaya/gidere YAZILMAZ; yalnız kâr dağıtımında "Verilecek Pay"dan düşülür. Nakit hariç.
  const vOran = vergiOrani() / 100;
  const komByOdeme = {};   // ödeme başına banka komisyonu (matrahtan düşülür)
  (State.giderKayitlari || []).forEach(g => { if (g.otoKomisyon && g.kaynakOdemeId) komByOdeme[g.kaynakOdemeId] = (komByOdeme[g.kaynakOdemeId] || 0) + (Number(g.tutar) || 0); });
  return aktif.map(o => {
    const giderPayi = paylasilanPay + (ortakGider[o.id] || 0);
    const dersler = (State.dersler || []).filter(d => d.egitmenId === o.id && d.durum === 'gerceklesti' && donemStr(d.tarih) === donem);
    // Aktif Öğrenci = bu eğitmene bağlı kayıtlı öğrenciler (döneme bağlı değil)
    const aktifOgrenci = State.ogrenciler.filter(x => x.egitmenId === o.id && x.durum === 'ogrenci').length;
    const tahsil = (State.odemeler || []).filter(od => donemStr(od.tarih) === donem && (od.ortakId || ogrenciEgitmenId(od.ogrenciId)) === o.id).reduce((s, od) => s + (Number(od.tutar) || 0), 0);
    const kalanAlacak = State.ogrenciler.filter(x => x.egitmenId === o.id).reduce((s, x) => s + (x.paketler || []).reduce((a, p) => a + (Number(p.kalanOdeme) || 0), 0), 0);
    const komisyon = komisyonMap[o.id] || 0;
    const vergi = (State.odemeler || [])
      .filter(od => donemStr(od.tarih) === donem && (od.ortakId || ogrenciEgitmenId(od.ogrenciId)) === o.id && (od.tur === 'havale' || od.tur === 'kart'))
      .reduce((s, od) => s + Math.round(Math.max(0, (Number(od.tutar) || 0) - (komByOdeme[od.id] || 0)) * vOran), 0);
    const verilecek = tahsil - giderPayi - komisyon - vergi;
    return { o, aktifOgrenci, verdigiDers: dersler.length, tahsil, kalanAlacak, giderPayi, komisyon, vergi, verilecek };
  });
}
SAYFALAR['ortaklar'] = function () {
  const veri = ortakAyHesap(ortakDonem);
  const kart = (r, i) => {
    const acik = ortakAcikSet.has(r.o.id);
    const foto = r.o.foto ? `<img src="${r.o.foto}" alt="${kacar(r.o.ad)}">` : `<span class="ok-mono">${basHarf(r.o.ad)}</span>`;
    const eksi = (n) => n ? '−' + TL(n) : TL(0);
    const detay = `<div class="ok-detay">
        <div class="ok-sr"><span class="et">${ik('kisi','uik-et')}Aktif Öğrenci</span><span class="v">${r.aktifOgrenci}</span></div>
        <div class="ok-sr"><span class="et">${ik('dersler','uik-et')}Verdiği Ders</span><span class="v">${r.verdigiDers}</span></div>
        <div class="ok-sr"><span class="et">${ik('onay','uik-et')}Tahsil Edilen</span><span class="v green">${TL(r.tahsil)}</span></div>
        <div class="ok-sr"><span class="et">${ik('sure','uik-et')}Kalan Alacağı</span><span class="v gold">${TL(r.kalanAlacak)}</span></div>
        <div class="ok-sr"><span class="et">${ik('bolme','uik-et')}Giderler Payı</span><span class="v red">${eksi(r.giderPayi)}</span></div>
        <div class="ok-sr"><span class="et">${ik('banka','uik-et')}Komisyon Gideri</span><span class="v red">${eksi(r.komisyon)}</span></div>
        <div class="ok-sr"><span class="et">${ik('belge','uik-et')}Vergi Kesintisi</span><span class="v red">${eksi(r.vergi)}</span></div>
        <div class="ok-sonuc"><span class="k">${ik('para','uik-et')}Verilecek Pay</span><span class="v"${r.verilecek < 0 ? ' style="color:var(--kirmizi)"' : ''}>${TL(r.verilecek)}</span></div>
      </div>`;
    const ozet = `<div class="ok-ozet"><span class="lbl">${ik('para','uik-et')}Verilecek Pay</span><span class="val"${r.verilecek < 0 ? ' style="color:var(--kirmizi)"' : ''}>${TL(r.verilecek)}</span></div>`;
    return `<div class="ok-kart f${i % 4} ${acik ? 'acik' : ''}" data-ok="${r.o.id}">
      <div class="ok-kare"><div class="ok-foto">${foto}</div><span class="ok-isim">${kacar(r.o.ad)}</span></div>
      ${acik ? detay : ozet}
    </div>`;
  };
  ic().innerHTML = `
    <div class="ortk-ust">
      <span class="ortk-bas">Ortaklar</span>
      ${ayNavHTML(ortakDonem)}
    </div>
    ${kartBorcu() > 0 ? `<div class="kkborc-not">💳 Ödenmemiş kredi kartı borcu: <b>${TL(kartBorcu())}</b> — ödenince ortak giderine yansır.</div>` : ''}
    ${veri.length ? `<div class="ok-grid">${veri.map(kart).join('')}</div>` : `<div class="gp-bos">Henüz ortak yok. Tanımlamalar › Ortak Bilgileri’nden ekleyin.</div>`}`;
  $$('[data-ay]').forEach(b => b.onclick = () => { ortakDonem = donemKaydir(ortakDonem, Number(b.dataset.ay)); SAYFALAR['ortaklar'](); });
  $$('[data-ok]').forEach(c => c.onclick = () => { const id = c.dataset.ok; const acik = ortakAcikSet.has(id); ortakAcikSet.clear(); if (!acik) ortakAcikSet.add(id); SAYFALAR['ortaklar'](); });
};

/* -------- AYARLAR: Tanımlamalar (hub) -------- */
const TANIMLAR = [
  { id: 'ayar-firma', ad: 'Firma Bilgileri', ikon: 'firma', alt: 'Ad, logo, slogan', sadeceAdmin: true },
  { id: 'ayar-ortak', ad: 'Ortak Bilgileri', ikon: 'ortaklar', alt: 'Eğitmenler ve pay oranları', sadeceAdmin: true },
  { id: 'tanim-egitmen', ad: 'Eğitmen → Ortak Eşleme', ikon: 'kisi', alt: 'Plan4me eğitmenlerini ortaklara bağla' },
  { id: 'tanim-gider', ad: 'Giderler', ikon: 'gider', alt: 'Gider kalemleri ve grupları' },
  { id: 'tanim-kategori', ad: 'Banka Gider Kategorileri', ikon: 'tanimlar', alt: 'Açıklama → kategori kuralları' },
  { id: 'tanim-komisyon', ad: 'Kart Komisyon Oranları', ikon: 'kart', alt: 'Debit / Kredi / Yurt dışı' },
  { id: 'ayar-vergi', ad: 'Vergi / KDV Oranı', ikon: 'belge', alt: 'Havale + kart tahsilatına uygulanan oran', sadeceAdmin: true },
  { id: 'ayar-giris-kul', ad: 'Kullanıcı Girişleri', ikon: 'kullanici', alt: 'Ortaklara giriş (kullanıcı adı + şifre)', sadeceAdmin: true },
];
SAYFALAR['ayar-tanimlama'] = function () {
  const gorunur = TANIMLAR.filter(t => !t.sadeceAdmin || adminMi());   // ortak: yalnız Üyelikler + Giderler
  ic().innerHTML = `
    <div class="tnm-hub">
      <div class="tnm-menu">
        ${gorunur.map(t => `<button type="button" class="tnm-row2" data-tanim="${t.id}">
          <span class="tnm-ik">${ik(t.ikon)}</span>
          <span class="tnm-metin"><span class="tnm-ad">${kacar(t.ad)}</span><span class="tnm-alt">${kacar(t.alt || '')}</span></span>
          <span class="tnm-ok">›</span>
        </button>`).join('')}
      </div>
    </div>`;
  $$('[data-tanim]').forEach(b => b.onclick = () => git(b.dataset.tanim));   // anında geç (renklenme/gecikme yok)
};

/* -------- Tanımlamalar: Kullanıcı Girişleri (ortaklara giriş) — yalnızca admin -------- */
SAYFALAR['ayar-giris-kul'] = function () {
  if (!adminMi()) { git('dashboard'); return; }
  const bas = (ad) => (ad || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  const renk = ['', 'f2', 'f3', 'f2', 'f3'];
  const kart = (o, i) => {
    const av = o.foto ? `<img src="${o.foto}" alt="">` : kacar(bas(o.ad));
    const tanimli = !!(o.girisAd && o.sifreHash);
    const aktif = o.girisAktif !== false;
    const alt = tanimli
      ? `Kullanıcı: <b>${kacar(o.girisAd)}</b> · şifre belirlendi ✓`
      : `<span class="kul-yok">Giriş tanımlı değil — “Giriş Tanımla” ile ekle</span>`;
    return `<div class="kul-kart">
      <div class="kul-av ${o.foto ? 'kul-av-foto' : renk[i % renk.length]}">${av}</div>
      <div class="kul-orta"><div class="kul-ad">${kacar(o.ad)}</div><div class="kul-alt">${alt}</div></div>
      <div class="kul-arac">
        <button type="button" class="kul-btn ${tanimli ? '' : 'kul-btn-ekle'}" data-kul="${o.id}">${tanimli ? '✎ Düzenle' : '＋ Giriş Tanımla'}</button>
        ${tanimli ? `<span class="kul-sw ${aktif ? 'on' : ''}" data-kulakt="${o.id}" title="Giriş aktif"><i></i></span>` : ''}
      </div>
    </div>`;
  };
  ic().innerHTML = `
    <div class="tnm-scr-ust"><button type="button" class="tnm-geri" id="gkGeri">‹ Tanımlamalar</button></div>
    <div class="bilgi-kutu" style="max-width:560px;margin:0 0 14px"><span class="ikon">🔑</span><div>Her ortağa <b>kullanıcı adı + şifre</b> verin. Ortak giriş yaptığında varsayılan olarak yalnızca <b>kendi</b> verilerini görür.</div></div>
    <div class="kul-list">
      <div class="kul-kart kadmin">
        <div class="kul-av f2">A</div>
        <div class="kul-orta"><div class="kul-ad">Yönetici <span class="kul-rozet">ADMIN</span></div><div class="kul-alt">Kullanıcı: <b>${kacar(SABIT_ADMIN.kullanici)}</b> · kod ile tanımlı · tüm verileri görür</div></div>
        <div class="kul-arac"><span class="kul-alt">değiştirilemez</span></div>
      </div>
      ${State.ortaklar.filter(o => o.aktif !== false).map(kart).join('') || '<div class="gp-bos">Önce Ortak Bilgileri’nden ortak ekleyin.</div>'}
    </div>`;
  $('#gkGeri').onclick = () => git('ayar-tanimlama');
  $$('[data-kul]').forEach(b => b.onclick = () => { const o = State.ortaklar.find(x => x.id === b.dataset.kul); if (o) girisKulFormu(o); });
  $$('[data-kulakt]').forEach(s => s.onclick = async () => {
    const o = State.ortaklar.find(x => x.id === s.dataset.kulakt); if (!o) return;
    const yeni = o.girisAktif === false;   // kapalıysa aç
    await DB.guncelle('ortaklar', o.id, { girisAktif: yeni }); o.girisAktif = yeni;
    bildir(yeni ? 'Giriş açıldı.' : 'Giriş kapatıldı.', 'basari'); SAYFALAR['ayar-giris-kul']();
  });
};
function girisKulFormu(o) {
  const govde = `
    <div class="gp-alan"><label>Kullanıcı Adı</label><input type="text" class="gp-inp" id="gkAd" value="${kacar(o.girisAd || '')}" placeholder="Örn. elif" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <div class="gp-alan"><label>Şifre</label><input type="password" class="gp-inp" id="gkSif" placeholder="${o.sifreHash ? '•••••• (değiştirmek için yaz)' : 'Yeni şifre'}" autocomplete="new-password"></div>
    <div class="gp-alan" style="margin:0"><label>Şifre (tekrar)</label><input type="password" class="gp-inp" id="gkSif2" placeholder="Şifreyi tekrar yaz" autocomplete="new-password"></div>`;
  modalAc('Giriş Bilgileri — ' + kacar(o.ad), govde,
    `<button class="btn" id="gkIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="gkKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor" opacity=".22"/><circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1.7"/><path d="m11 11 8 8M16 20l3-3M19 17l2 .5-.5-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Giriş</span>`);
  const zincir = ['#gkAd', '#gkSif', '#gkSif2'];
  zincir.forEach((sel, i) => { const el = $(sel); if (!el) return; el.addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); if (i < zincir.length - 1) { const sonraki = $(zincir[i + 1]); if (sonraki) sonraki.focus(); } else $('#gkKaydet').click(); }); });
  setTimeout(() => $('#gkAd').focus(), 50);
  $('#gkIptal').onclick = modalKapat;
  $('#gkKaydet').onclick = async () => {
    const ad = ($('#gkAd').value || '').trim();
    const sif = $('#gkSif').value || '';
    const sif2 = $('#gkSif2').value || '';
    if (!ad) return bildir('Kullanıcı adı girin.', 'hata');
    const adLc = ad.toLocaleLowerCase('tr');
    if (adLc === SABIT_ADMIN.kullanici.toLocaleLowerCase('tr')) return bildir('Bu kullanıcı adı yöneticiye ait.', 'hata');
    if (State.ortaklar.some(x => x.id !== o.id && (x.girisAd || '').toLocaleLowerCase('tr') === adLc)) return bildir('Bu kullanıcı adı başka ortakta kullanılıyor.', 'hata');
    const veri = { girisAd: ad };
    if (sif || !o.sifreHash) {   // yeni giriş ya da şifre değişikliği
      if (sif.length < 4) return bildir('Şifre en az 4 karakter olmalı.', 'hata');
      if (sif !== sif2) return bildir('Şifreler eşleşmiyor.', 'hata');
      veri.sifreHash = await sifreHash(sif);
    }
    if (o.girisAktif === undefined) veri.girisAktif = true;
    await DB.guncelle('ortaklar', o.id, veri); Object.assign(o, veri);
    modalKapat(); bildir('Giriş bilgileri kaydedildi.', 'basari'); SAYFALAR['ayar-giris-kul']();
  };
}

/* -------- Tanımlamalar: Giderler (gruplu) -------- */
SAYFALAR['tanim-gider'] = function () {
  const gruplar = State.giderGruplari;
  const giderler = State.giderler;
  const kalemHTML = (g) => `<div class="tnm-row">
      <span class="tnm-nokta"></span><span class="tnm-row-ad">${kacar(g.ad)}</span>
      <span class="tnm-row-arac"><button type="button" data-gd="${g.id}" title="Düzenle">✎</button><button type="button" data-gs="${g.id}" title="Sil">🗑️</button></span>
    </div>`;
  const bolumHTML = (ad, items) => !items.length ? '' : `<div class="tnm-grup">
      <div class="tnm-grup-bas"><span class="rk">📁</span><span class="ad">${kacar(ad)}</span><span class="say">${items.length}</span><span class="cizgi"></span></div>
      <div class="tnm-grup-liste">${items.map(kalemHTML).join('')}</div></div>`;
  const bolumler = gruplar.map(gr => bolumHTML(gr.ad, giderler.filter(x => x.grupId === gr.id))).join('');
  const grupsuz = giderler.filter(x => !x.grupId || !gruplar.some(g => g.id === x.grupId));
  const bolumlerTam = bolumler + bolumHTML('Diğer', grupsuz);

  ic().innerHTML = `
    <div class="tnm-kol">
      <div class="tnm-scr-ust">
        <button type="button" class="tnm-geri" id="tnmGeri">‹ Tanımlamalar</button>
        <button type="button" class="gp-ekle" id="gdEkle">＋ Gider Ekle</button>
      </div>
      ${giderler.length === 0
        ? `<div class="gp-bos">Liste boş</div>`
        : `<div class="tnm-kagit">${bolumlerTam}</div>`}
    </div>`;
  $('#tnmGeri').onclick = () => git('ayar-tanimlama');
  $('#gdEkle').onclick = () => giderFormu();
  $$('[data-gd]').forEach(b => b.onclick = () => giderFormu(State.giderler.find(g => g.id === b.dataset.gd)));
  $$('[data-gs]').forEach(b => b.onclick = () => onayModal('Gider silinsin mi?', '', async () => {
    await DB.sil('giderler', b.dataset.gs); State.giderler = State.giderler.filter(g => g.id !== b.dataset.gs);
    bildir('Silindi.', 'basari'); SAYFALAR['tanim-gider']();
  }));
};

function giderFormu(mevcut) {
  let seciliGrup = mevcut ? (mevcut.grupId || null) : (State.giderGruplari[0] ? State.giderGruplari[0].id : null);
  const grupAdi = (id) => { const g = State.giderGruplari.find(x => x.id === id); return g ? g.ad : 'Grup seç'; };
  const ogelerHTML = () => State.giderGruplari.map(g =>
    `<div class="gd-oge ${seciliGrup === g.id ? 'sec' : ''}" data-grup="${g.id}"><span class="gd-nokta"></span>${kacar(g.ad)}${seciliGrup === g.id ? '<span class="tik">✓</span>' : ''}</div>`).join('');

  const govde = `
    <div class="gp-alan"><label>Gider Adı</label>
      <input type="text" class="gp-inp" id="gdAd" value="${mevcut ? kacar(mevcut.ad) : ''}" placeholder="Örn. Kira" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="gp-alan" style="margin:0"><label>Grup</label>
      <div class="gd-dd" id="gdDD">
        <button type="button" class="gd-trig" id="gdTrig"><span id="gdSeciliAd">${kacar(grupAdi(seciliGrup))}</span><span class="ok">▾</span></button>
        <div class="gd-panel" id="gdPanel" hidden><div class="gd-ic">
          <div id="gdOgeler">${ogelerHTML()}</div>
          ${State.giderGruplari.length ? '<div class="gd-ay"></div>' : ''}
          <div class="gd-oge gd-yeni" id="gdYeni"><span class="art">＋</span>Yeni Grup</div>
          <div class="gd-yenigrup" id="gdYeniGrup" hidden>
            <input type="text" class="gp-inp" id="gdYeniAd" placeholder="Yeni grup adı…" autocomplete="off" autocorrect="off" spellcheck="false">
            <button type="button" class="gd-ekle" id="gdYeniEkle">Ekle</button>
          </div>
        </div></div>
      </div>
    </div>`;
  modalAc(mevcut ? 'Gider Düzenle' : 'Yeni Gider', govde,
    `<button class="btn" id="gdIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="gdKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="8" width="17" height="12" rx="2.5" fill="currentColor" opacity=".22"/><rect x="3.5" y="8" width="17" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17" stroke="currentColor" stroke-width="1.6"/><path d="M7 5.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 14.5v3M10.5 16h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>Gider</span>`);

  const inp = $('#gdAd'); setTimeout(() => inp.focus(), 50);
  const panel = $('#gdPanel'), trig = $('#gdTrig');
  const panelKapat = () => { panel.hidden = true; trig.classList.remove('acik'); $('#gdYeniGrup').hidden = true; };
  const panelAc = () => { panel.hidden = false; trig.classList.add('acik'); };
  trig.onclick = () => panel.hidden ? panelAc() : panelKapat();
  const ogeleriBagla = () => $$('#gdOgeler .gd-oge').forEach(o => o.onclick = () => {
    seciliGrup = o.dataset.grup; $('#gdSeciliAd').textContent = grupAdi(seciliGrup);
    $('#gdOgeler').innerHTML = ogelerHTML(); ogeleriBagla(); panelKapat();
  });
  ogeleriBagla();
  $('#gdYeni').onclick = () => { const yg = $('#gdYeniGrup'); yg.hidden = !yg.hidden; if (!yg.hidden) setTimeout(() => $('#gdYeniAd').focus(), 30); };
  const grupEkle = async () => {
    const ad = $('#gdYeniAd').value.trim();
    if (!ad) return bildir('Grup adı girin.', 'hata');
    const y = await DB.ekle('giderGruplari', { ad }); State.giderGruplari.push(y);
    seciliGrup = y.id; $('#gdSeciliAd').textContent = ad;
    $('#gdOgeler').innerHTML = ogelerHTML(); ogeleriBagla();
    $('#gdYeniAd').value = ''; panelKapat();
    bildir('Grup eklendi.', 'basari');
  };
  $('#gdYeniEkle').onclick = grupEkle;
  $('#gdYeniAd').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); grupEkle(); } });

  inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('#gdKaydet').click(); });
  $('#gdIptal').onclick = modalKapat;
  $('#gdKaydet').onclick = async () => {
    const ad = inp.value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, grupId: seciliGrup || null };
    if (mevcut) { await DB.guncelle('giderler', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('giderler', veri); State.giderler.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); SAYFALAR['tanim-gider']();
  };
}

/* Üyelik ders seçenekleri — yeni yapı {secenekler:[{dersSayisi,fiyat}]}; eski
   {dersSayisi,fiyat} kayıtları da normalize edilir. */
function uyelikSecenekleri(u) {
  if (u && Array.isArray(u.secenekler) && u.secenekler.length) return u.secenekler;
  if (u && (Number(u.dersSayisi) || Number(u.fiyat))) return [{ dersSayisi: Number(u.dersSayisi) || 0, fiyat: Number(u.fiyat) || 0 }];
  return [];
}
function uyelikAciklama(u) { return u ? (u.aciklama != null ? u.aciklama : (u.kapsam || '')) : ''; }

/* -------- Tanımlamalar: Üyelikler (ders/üyelik paketleri) -------- */
SAYFALAR['tanim-uyelik'] = function () {
  const uyelikler = State.uyelikler;
  const kartHTML = (u) => {
    const secler = uyelikSecenekleri(u);
    const acik = uyelikAciklama(u);
    return `<div class="uk"><div class="uk-ic">
      <div class="uk-bas"><span class="uk-ik">🎟️</span><span class="uk-ad">${kacar(u.ad)}</span></div>
      <div class="uk-secler">${secler.map(s => `<div class="uk-sec"><span class="d">${Number(s.dersSayisi) || 0} <small>ders</small></span><span class="f">${binlik(s.fiyat)} ₺</span></div>`).join('') || '<div class="uk-sec"><span class="d ogr-soluk">Seçenek yok</span></div>'}</div>
      <div class="uk-ay"></div>
      <div class="uk-satir"><span class="e">⏳</span><span><b>${Number(u.gecerlilikGun) || 0}</b> Gün geçerli</span></div>
      ${acik ? `<div class="uk-satir"><span class="e">📝</span><span class="uk-kapsam">${kacar(acik)}</span></div>` : ''}
      <div class="uk-arac"><button type="button" class="duz" data-ud="${u.id}">✎ Düzenle</button><button type="button" data-us="${u.id}"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 7h12M9.5 7V5.6A1.2 1.2 0 0 1 10.7 4.4h2.6A1.2 1.2 0 0 1 14.5 5.6V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" fill="currentColor" opacity=".2"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.3 10.5v6M13.7 10.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Sil</button></div>
    </div></div>`;
  };

  ic().innerHTML = `
    <div class="uk-sayfa">
      <div class="tnm-scr-ust">
        <button type="button" class="tnm-geri" id="tnmGeri">‹ Tanımlamalar</button>
        <button type="button" class="gp-ekle" id="uyEkle">＋ Üyelik Ekle</button>
      </div>
      ${uyelikler.length === 0
        ? `<div class="gp-bos">Henüz üyelik yok. “＋ Üyelik Ekle” ile ilk paketi oluşturun.</div>`
        : `<div class="uk-izgara">${uyelikler.map(kartHTML).join('')}</div>`}
    </div>`;
  $('#tnmGeri').onclick = () => git('ayar-tanimlama');
  $('#uyEkle').onclick = () => uyelikFormu();
  $$('[data-ud]').forEach(b => b.onclick = () => uyelikFormu(State.uyelikler.find(u => u.id === b.dataset.ud)));
  $$('[data-us]').forEach(b => b.onclick = () => onayModal('Üyelik silinsin mi?', '', async () => {
    await DB.sil('uyelikler', b.dataset.us); State.uyelikler = State.uyelikler.filter(u => u.id !== b.dataset.us);
    bildir('Silindi.', 'basari'); SAYFALAR['tanim-uyelik']();
  }));
};

function uyelikFormu(mevcut) {
  const secenekler = mevcut ? uyelikSecenekleri(mevcut).map(s => ({ dersSayisi: Number(s.dersSayisi) || 0, fiyat: Number(s.fiyat) || 0 })) : [{ dersSayisi: 0, fiyat: 0 }];
  if (!secenekler.length) secenekler.push({ dersSayisi: 0, fiyat: 0 });

  const satirHTML = (s, i) => `<div class="sec-row" data-i="${i}">
      <div class="ders-alan"><input type="text" inputmode="numeric" class="gp-inp sec-ders" value="${s.dersSayisi || ''}" autocomplete="off"><span class="sec-k">ders</span></div>
      <span class="sec-esit">=</span>
      <div class="fiyat-alan"><input type="text" inputmode="numeric" class="gp-inp sec-fiyat" value="${s.fiyat ? binlik(s.fiyat) : ''}" autocomplete="off"><span class="sec-k">₺</span></div>
      <button type="button" class="sec-sil" title="Sil">🗑️</button>
    </div>`;

  const govde = `
    <div class="gp-alan"><label>Paket Adı</label>
      <input type="text" class="gp-inp" id="uyAd" value="${mevcut ? kacar(mevcut.ad) : ''}" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="gp-alan"><label>Ders Seçeneği</label>
      <div id="uySecList">${secenekler.map(satirHTML).join('')}</div>
      <button type="button" class="sec-ekle" id="uySecEkle">＋ Seçenek Ekle</button></div>
    <div class="gp-alan uy-birimli"><label>Geçerlilik Süresi</label>
      <input type="text" inputmode="numeric" class="gp-inp" id="uyGun" value="${mevcut ? (Number(mevcut.gecerlilikGun) || '') : ''}" autocomplete="off"><span class="uy-birim">gün</span></div>
    <div class="gp-alan" style="margin:0"><label>Açıklama</label>
      <textarea class="gp-inp" id="uyAciklama" rows="2" autocomplete="off" autocorrect="off" spellcheck="false">${mevcut ? kacar(uyelikAciklama(mevcut)) : ''}</textarea></div>`;
  modalAc(mevcut ? 'Üyelik Düzenle' : 'Yeni Üyelik', govde,
    `<button class="btn" id="uyIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="uyKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" fill="currentColor" opacity=".24"/><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v1.5M12 11.2v1.6M12 14.5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>Üyelik</span>`);
  setTimeout(() => $('#uyAd').focus(), 50);

  const satirlariBagla = () => {
    $$('#uySecList .sec-row').forEach(row => {
      const i = Number(row.dataset.i);
      const dersEl = $('.sec-ders', row), fiyatEl = $('.sec-fiyat', row);
      dersEl.oninput = () => { dersEl.value = dersEl.value.replace(/\D/g, ''); secenekler[i].dersSayisi = Number(dersEl.value) || 0; };
      fiyatEl.oninput = () => { fiyatEl.value = binlikBiciml(fiyatEl.value); secenekler[i].fiyat = Number((fiyatEl.value || '').replace(/\D/g, '')) || 0; };
      $('.sec-sil', row).onclick = () => {
        if (secenekler.length <= 1) { secenekler[0] = { dersSayisi: 0, fiyat: 0 }; } else { secenekler.splice(i, 1); }
        cizSatirlar();
      };
    });
  };
  const cizSatirlar = (animSon) => {
    $('#uySecList').innerHTML = secenekler.map(satirHTML).join('');
    if (animSon) { const rows = $$('#uySecList .sec-row'); if (rows.length) rows[rows.length - 1].classList.add('sec-gir'); }
    satirlariBagla();
  };
  satirlariBagla();
  $('#uyGun').addEventListener('input', () => { $('#uyGun').value = $('#uyGun').value.replace(/\D/g, ''); });
  $('#uySecEkle').onclick = () => { secenekler.push({ dersSayisi: 0, fiyat: 0 }); cizSatirlar(true); const sonlar = $$('#uySecList .sec-ders'); if (sonlar.length) sonlar[sonlar.length - 1].focus(); };

  $('#uyIptal').onclick = modalKapat;
  $('#uyKaydet').onclick = async () => {
    const ad = $('#uyAd').value.trim();
    if (!ad) return bildir('Paket adı girin.', 'hata');
    const temizSec = secenekler.filter(s => (Number(s.dersSayisi) || 0) > 0).map(s => ({ dersSayisi: Number(s.dersSayisi) || 0, fiyat: Number(s.fiyat) || 0 }));
    if (!temizSec.length) return bildir('En az bir ders seçeneği girin (ders sayısı).', 'hata');
    const veri = {
      ad,
      secenekler: temizSec,
      gecerlilikGun: Number($('#uyGun').value) || 0,
      aciklama: $('#uyAciklama').value.trim(),
      fiyat: undefined, dersSayisi: undefined, kapsam: undefined,   // eski alanları temizle
    };
    if (mevcut) { await DB.guncelle('uyelikler', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('uyelikler', veri); State.uyelikler.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); SAYFALAR['tanim-uyelik']();
  };
}

/* ==========================================================
   Öğrenciler (müşteri kayıtları + üyelik/paket satışı)
   ========================================================== */
let ogrenciAktifSekme = 'ogrenci';   // 'ogrenci' | 'potansiyel'

function tarihKisa(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}
/* Bir öğrencinin paketlerinden toplam metrikler */
function ogrenciMetrik(o) {
  const p = o.paketler || [];
  return p.reduce((a, x) => {
    a.kalanDers += Number(x.kalanDers) || 0;
    a.dersToplam += Number(x.dersToplam) || 0;
    a.kalanOdeme += Number(x.kalanOdeme) || 0;
    a.fiyatToplam += Number(x.fiyat) || 0;
    return a;
  }, { kalanDers: 0, dersToplam: 0, kalanOdeme: 0, fiyatToplam: 0 });
}
function egitmenAdiById(id) { const o = State.ortaklar.find(x => x.id === id); return o ? egitmenKisaAd(o) : '—'; }
/* Eğitmen avatarı — fotoğrafı varsa görsel, yoksa baş harfler (isim geçen her yerde) */
function egitmenAv(id, cls) {
  const o = State.ortaklar.find(x => x.id === id);
  if (o && o.foto) return `<span class="${cls} av-foto"><img src="${o.foto}" alt=""></span>`;
  return `<span class="${cls}">${basHarf(o ? o.ad : '—')}</span>`;
}

SAYFALAR['ogrenciler'] = function () {
  const hepsi = (State.ogrenciler || []).filter(o => hepsiniGor() || o.egitmenId === benId());   // ortak: yalnızca kendi öğrencileri
  const bitmis = (o) => { const m = ogrenciMetrik(o); return m.dersToplam > 0 && m.kalanDers <= 0; };
  const ogrAll = hepsi.filter(o => o.durum === 'ogrenci');
  const ogr = ogrAll.filter(o => !bitmis(o));
  const pasif = ogrAll.filter(o => bitmis(o));
  const pot = hepsi.filter(o => o.durum !== 'ogrenci');

  const barHTML = (kullanilan, toplam, tur) => {
    const y = toplam > 0 ? Math.max(0, Math.min(100, (kullanilan / toplam) * 100)) : 0;
    return `<span class="ogr-bar ${tur}"><span style="width:${y}%"></span></span>`;
  };
  const ogrenciSatir = (o) => {
    const m = ogrenciMetrik(o);
    const paketler = o.paketler || [];
    const paketRozet = paketler.length
      ? `<span class="ogr-pk">${kacar(paketler[0].paketAd)}</span>${paketler.length > 1 ? ` <span class="ogr-pk">+${paketler.length - 1}</span>` : ''}`
      : '<span class="ogr-soluk">—</span>';
    const odemeHucre = m.kalanOdeme <= 0
      ? `<span class="ogr-metrik"><span class="rakam ogr-odendi">Ödendi</span>${barHTML(1, 1, 'odeme')}</span>`
      : `<span class="ogr-metrik"><span class="rakam ogr-altin">${binlik(m.kalanOdeme)}<span class="top"> / ${binlik(m.fiyatToplam)} ₺</span></span>${barHTML(m.fiyatToplam - m.kalanOdeme, m.fiyatToplam, 'odeme')}</span>`;
    return `<tr class="ogr-satir" data-odetay="${o.id}">
      <td data-l="Öğrenci"><span class="ogr-kisi"><span class="ogr-av">${basHarf(o.ad, o.soyad)}</span><span class="ogr-bilg"><span class="ogr-ad">${kacar(o.ad)} ${kacar(o.soyad || '')}</span>${o.telefon ? `<span class="ogr-tel">${kacar(o.telefon)}</span>` : ''}<span class="ogr-egit-alt">${egitmenAv(o.egitmenId, 'ogr-ea-sm')}${kacar(egitmenAdiById(o.egitmenId))}</span></span></span></td>
      <td data-l="Paket">${paketRozet}</td>
      <td data-l="Kalan Ders" class="sag"><span class="ogr-metrik"><span class="rakam">${m.kalanDers}<span class="top"> / ${m.dersToplam}</span></span>${barHTML(m.dersToplam - m.kalanDers, m.dersToplam, 'ders')}</span></td>
      <td data-l="Kalan Ödeme" class="sag">${odemeHucre}</td>
      <td class="sag"><button type="button" class="duz-btn" data-oduzenle="${o.id}">${ik('kalem')} Düzenle</button></td>
    </tr>`;
  };
  const potSatir = (o) => `<tr>
      <td data-l="Öğrenci"><span class="ogr-kisi"><span class="ogr-av">${basHarf(o.ad, o.soyad)}</span><span class="ogr-ad">${kacar(o.ad)} ${kacar(o.soyad || '')}</span></span></td>
      <td data-l="Tel">${kacar(o.telefon || '—')}</td>
      <td data-l="Görüşülen Tarih">${tarihKisa(o.olusturma)}</td>
      <td class="sag"><span class="ogr-arac"><button type="button" class="ogr-ata" data-oata="${o.id}">Paket Ata</button><button type="button" data-osil="${o.id}" title="Sil">🗑️</button></span></td>
    </tr>`;
  const pasifSatir = (o) => {
    const m = ogrenciMetrik(o);
    const paketler = o.paketler || [];
    const sonPaket = paketler.length ? `<span class="ogr-pk">${kacar(paketler[paketler.length - 1].paketAd)}</span>` : '<span class="ogr-soluk">—</span>';
    return `<tr class="ogr-satir" data-odetay="${o.id}">
      <td data-l="Öğrenci"><span class="ogr-kisi"><span class="ogr-av">${basHarf(o.ad, o.soyad)}</span><span class="ogr-bilg"><span class="ogr-ad">${kacar(o.ad)} ${kacar(o.soyad || '')}</span><span class="ogr-tel">${kacar(o.telefon || '')}</span></span></span></td>
      <td data-l="Eğitmeni"><span class="ogr-egit">${egitmenAv(o.egitmenId, 'ogr-ea')}${kacar(egitmenAdiById(o.egitmenId))}</span></td>
      <td data-l="Son Paket">${sonPaket}</td>
      <td data-l="Kalan Ders" class="sag"><span class="ogr-metrik"><span class="rakam">${m.kalanDers}<span class="top"> / ${m.dersToplam}</span></span><span class="ogr-bar bitti"><span style="width:100%"></span></span></span></td>
      <td class="sag"><span class="ogr-arac"><button type="button" class="ogr-ata" data-oata="${o.id}">Paket Ata</button><button type="button" data-osil="${o.id}" title="Sil">🗑️</button></span></td>
    </tr>`;
  };

  const ogrenciTablo = ogr.length
    ? `<div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo">
        <colgroup><col style="width:30%"><col style="width:14%"><col style="width:15%"><col style="width:22%"><col style="width:19%"></colgroup>
        <thead><tr><th>Öğrenci</th><th>Paket</th><th class="sag">Kalan Ders</th><th class="sag">Kalan Ödeme</th><th></th></tr></thead>
        <tbody>${ogr.map(ogrenciSatir).join('')}</tbody></table></div></div>`
    : `<div class="gp-bos">Henüz öğrenci yok. “＋ Yeni Üyelik Oluştur” ile başlayın.</div>`;
  const potTablo = pot.length
    ? `<div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo">
        <colgroup><col style="width:36%"><col style="width:22%"><col style="width:28%"><col style="width:14%"></colgroup>
        <thead><tr><th>Öğrenci</th><th>Tel</th><th>Görüşülen Tarih</th><th></th></tr></thead>
        <tbody>${pot.map(potSatir).join('')}</tbody></table></div></div>`
    : `<div class="gp-bos">Bekleyen potansiyel müşteri yok.</div>`;
  const pasifTablo = pasif.length
    ? `<div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo">
        <colgroup><col style="width:30%"><col style="width:20%"><col style="width:18%"><col style="width:20%"><col style="width:12%"></colgroup>
        <thead><tr><th>Öğrenci</th><th>Eğitmeni</th><th>Son Paket</th><th class="sag">Kalan Ders</th><th></th></tr></thead>
        <tbody>${pasif.map(pasifSatir).join('')}</tbody></table></div></div>`
    : `<div class="gp-bos">Pasif öğrenci yok.<br><small>Dersi/üyeliği biten öğrenciler burada otomatik görünür.</small></div>`;

  const govde = ogrenciAktifSekme === 'potansiyel' ? potTablo
    : ogrenciAktifSekme === 'pasif' ? pasifTablo : ogrenciTablo;
  dtHedef().innerHTML = `
    <div class="ogr-sayfa">
      <div class="ogr-ust">
        <div class="ogr-seg">
          <button type="button" class="seg-akt ${ogrenciAktifSekme === 'ogrenci' ? 'sec' : ''}" data-sekme="ogrenci">Aktif <span class="rk">${ogr.length}</span></button>
          <button type="button" class="seg-pot ${ogrenciAktifSekme === 'potansiyel' ? 'sec' : ''}" data-sekme="potansiyel">Potansiyel <span class="rk">${pot.length}</span></button>
          <button type="button" class="seg-pas ${ogrenciAktifSekme === 'pasif' ? 'sec' : ''}" data-sekme="pasif">Pasif <span class="rk">${pasif.length}</span></button>
        </div>
        <div class="ogr-ust-sag">${ortakGosterBtnHTML()}<button type="button" class="gp-ekle" id="yeniUyelikBtn">＋ Yeni Üyelik Oluştur</button></div>
      </div>
      ${govde}
    </div>`;

  $('#yeniUyelikBtn').onclick = yeniUyelikBaslat;
  ortakGosterBtnBagla(() => SAYFALAR['ogrenciler']());
  $$('[data-sekme]').forEach(b => b.onclick = () => { ogrenciAktifSekme = b.dataset.sekme; SAYFALAR['ogrenciler'](); });
  $$('[data-oata]').forEach(b => b.onclick = () => { const o = State.ogrenciler.find(x => x.id === b.dataset.oata); if (o) islemSecModal(o); });
  $$('[data-oduzenle]').forEach(b => b.onclick = () => { const o = State.ogrenciler.find(x => x.id === b.dataset.oduzenle); if (o) ogrenciDuzenle(o); });
  $$('[data-osil]').forEach(b => b.onclick = () => onayModal('Kayıt silinsin mi?', 'Bu öğrenci ve tüm paketleri silinecek.', async () => {
    await DB.sil('ogrenciler', b.dataset.osil); State.ogrenciler = State.ogrenciler.filter(x => x.id !== b.dataset.osil);
    bildir('Silindi.', 'basari'); SAYFALAR['ogrenciler']();
  }));
  $$('[data-odetay]').forEach(tr => tr.onclick = (e) => { if (e.target.closest('button')) return; const o = State.ogrenciler.find(x => x.id === tr.dataset.odetay); if (o) ogrenciDetayModal(o); });
};

/* Öğrenci detayı: sahip olduğu üyelikler (paket paket) + paket iptal */
function ogrenciDetayModal(o) {
  const barHTML = (kullanilan, toplam, tur) => {
    const y = toplam > 0 ? Math.max(0, Math.min(100, (kullanilan / toplam) * 100)) : 0;
    return `<span class="ogr-bar ${tur}"><span style="width:${y}%"></span></span>`;
  };
  const govde = () => {
    const paketler = o.paketler || [];
    const kart = (p) => {
      const dersT = Number(p.dersToplam) || 0, kalanD = Number(p.kalanDers) || 0;
      const fiyat = Number(p.fiyat) || 0, kalanO = Number(p.kalanOdeme) || 0;
      const odemeSat = kalanO <= 0
        ? `<span class="pk-val ok2">Ödendi</span><span class="ogr-bar odeme"><span style="width:100%"></span></span>`
        : `<span class="pk-val gold">${binlik(kalanO)} / ${binlik(fiyat)} ₺</span>${barHTML(fiyat - kalanO, fiyat, 'odeme')}`;
      return `<div class="pkart">
        <div class="pk-ust"><span class="pk-ad"><span class="pk-ic">🎟️</span>${kacar(p.paketAd || 'Paket')} — ${dersT} ders</span><button type="button" class="pk-iptal" data-piptal="${p.id}"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 7h12M9.5 7V5.6A1.2 1.2 0 0 1 10.7 4.4h2.6A1.2 1.2 0 0 1 14.5 5.6V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" fill="currentColor" opacity=".2"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.3 10.5v6M13.7 10.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Paketi İptal</button></div>
        <div class="pk-metrik">
          <div><span class="pk-lbl">Kalan Ders</span><span class="pk-val">${kalanD} / ${dersT}</span>${barHTML(dersT - kalanD, dersT, 'ders')}</div>
          <div><span class="pk-lbl">Kalan Ödeme</span>${odemeSat}</div>
        </div></div>`;
    };
    const eg = egitmenAdiById(o.egitmenId);
    return `<div class="kisi-blok"><span class="ogr-av">${basHarf(o.ad, o.soyad)}</span><span class="kisi-col"><span class="kisi-ad">${kacar(ogrenciTamAd(o))}</span><span class="kisi-alt">${kacar(telBiciml(o.telefon || '') || '—')}${eg && eg !== '—' ? ' · Eğitmen: ' + kacar(eg) : ''}</span></span></div>
      <div class="sec-mini-bas">Üyelikleri (${paketler.length} paket)</div>
      ${paketler.length ? paketler.map(kart).join('') : '<div class="gp-bos" style="margin:0">Bu öğrencinin paketi kalmadı.</div>'}`;
  };
  modalAc(ogrenciTamAd(o), govde(),
    `<button class="btn" id="odetKapat" style="flex:1">Kapat</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" fill="currentColor" opacity=".26"/><path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6.5 10.5v4c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-4M21.5 8.5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>Öğrenci</span>`);
  $('#odetKapat').onclick = modalKapat;
  $$('[data-piptal]').forEach(b => b.onclick = () => onayModal('Paket iptal edilsin mi?', 'Bu paket öğrenciden kaldırılacak.', async () => {
    o.paketler = (o.paketler || []).filter(x => x.id !== b.dataset.piptal);
    const guncel = { paketler: o.paketler };
    if (!o.paketler.length) { guncel.durum = 'potansiyel'; o.durum = 'potansiyel'; }
    await DB.guncelle('ogrenciler', o.id, guncel); Object.assign(o, guncel);
    bildir('Paket iptal edildi.', 'basari');
    SAYFALAR['ogrenciler']();
    if (o.paketler.length) ogrenciDetayModal(o);   // onayModal detayı kapattı → güncel haliyle yeniden aç
  }));
};

/* “＋ Yeni Üyelik Oluştur” → Yeni Üye / Eski Üye */
function yeniUyelikBaslat() {
  const govde = `
    <div class="uys-ikisec">
      <button type="button" class="uys-opt yeni" id="uysYeni"><span class="uys-ik yesil"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 13c0-3 2.2-5.2 5.5-5.2C17.5 11 15.3 13 12 13Z" fill="currentColor" opacity=".26"/><path d="M12 13c0-3 2.2-5.2 5.5-5.2C17.5 11 15.3 13 12 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 13c0-3.2-2.2-5.5-5.5-5.5C6.5 11 8.7 13 12 13Z" fill="currentColor" opacity=".26"/><path d="M12 13c0-3.2-2.2-5.5-5.5-5.5C6.5 11 8.7 13 12 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span><span class="uys-metin"><span class="ad">Yeni Üye</span><span class="alt">İlk kez kayıt — ad, soyad, telefon</span></span><span class="uys-ok">›</span></button>
      <button type="button" class="uys-opt eski" id="uysEski"><span class="uys-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="currentColor" opacity=".28"/><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19.5c0-3.4 3-5.6 6.5-5.6s6.5 2.2 6.5 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><span class="uys-metin"><span class="ad">Eski Üye</span><span class="alt">Kayıtlı öğrenciye yeni paket ekle</span></span><span class="uys-ok">›</span></button>
    </div>`;
  modalAc('Yeni Üyelik', govde, `<button class="btn" id="uysIptal" style="flex:1">İptal</button>`, `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" fill="currentColor" opacity=".24"/><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v1.5M12 11.2v1.6M12 14.5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>Üyelik</span>`);
  $('#uysIptal').onclick = modalKapat;
  $('#uysYeni').onclick = yeniUyeFormu;
  $('#uysEski').onclick = uyeSecModal;
}

/* Yeni Üye kaydı → potansiyel oluştur → ne yapmak istersiniz? */
function yeniUyeFormu() {
  const govde = `
    <div class="gp-alan"><label>Adı</label><input type="text" class="gp-inp" id="oAd" placeholder="Örn. Ayşe" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="gp-alan"><label>Soyadı</label><input type="text" class="gp-inp" id="oSoyad" placeholder="Örn. Yılmaz" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="gp-alan" style="margin:0"><label>Telefon</label><input type="tel" inputmode="numeric" class="gp-inp" id="oTel" placeholder="Örn. 505-033-41-27"></div>`;
  modalAc('Yeni Üye', govde,
    `<button class="btn" id="oIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="oDevam">Devam Et →</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 13c0-3 2.2-5.2 5.5-5.2C17.5 11 15.3 13 12 13Z" fill="currentColor" opacity=".26"/><path d="M12 13c0-3 2.2-5.2 5.5-5.2C17.5 11 15.3 13 12 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 13c0-3.2-2.2-5.5-5.5-5.5C6.5 11 8.7 13 12 13Z" fill="currentColor" opacity=".26"/><path d="M12 13c0-3.2-2.2-5.5-5.5-5.5C6.5 11 8.7 13 12 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span>Yeni Üye</span>`);
  setTimeout(() => $('#oAd').focus(), 50);
  { const tl = $('#oTel'); tl.addEventListener('input', () => { tl.value = telBiciml(tl.value); }); }
  $('#oIptal').onclick = modalKapat;
  $('#oDevam').onclick = async () => {
    const ad = $('#oAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    const veri = { ad, soyad: $('#oSoyad').value.trim(), telefon: telBiciml($('#oTel').value), durum: 'potansiyel', egitmenId: adminMi() ? null : (aktifOrtakId() || null), paketler: [] };
    const y = await DB.ekle('ogrenciler', veri); State.ogrenciler.push(y);
    neYapmakModal(y);
  };
}

/* Potansiyel oluştu — 3 seçenek */
function neYapmakModal(o) {
  const govde = `
    <div class="ny-ust"><div class="ny-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="currentColor" opacity=".22"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="m8.3 12.2 2.6 2.6 4.8-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="ny-bilg"><h4>Potansiyel Müşteri Oluştu</h4><p>${kacar(o.ad)} ${kacar(o.soyad || '')} eklendi. Ne yapmak istersiniz?</p></div></div>
    <div class="uys-ikisec">
      <button type="button" class="uys-opt" id="nyPaket"><span class="uys-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" fill="currentColor" opacity=".24"/><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v1.5M12 11.2v1.6M12 14.5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><span class="uys-metin"><span class="ad">Ben Ders Paketi Tanımlayacağım</span><span class="alt">Eğitmen + paket seç, öğrenciye dönüştür</span></span><span class="uys-ok">›</span></button>
      <button type="button" class="uys-opt pas" id="nyLink"><span class="uys-ik mavi"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 14.5 14.5 9.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M11 7.5 12.6 6a3.6 3.6 0 0 1 5.1 5.1l-1.6 1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13 16.5 11.4 18a3.6 3.6 0 0 1-5.1-5.1l1.6-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><span class="uys-metin"><span class="ad">Müşterime Link Göndereceğim</span><span class="alt">Paketi kendi seçsin</span></span><span class="uys-yak">yapım aşamasında</span></button>
      <button type="button" class="uys-opt" id="nySonra"><span class="uys-ik gri"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.3" fill="currentColor" opacity=".2"/><circle cx="12" cy="12" r="8.3" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="uys-metin"><span class="ad">Daha Sonra Devam Edeceğim</span><span class="alt">Potansiyel müşteri olarak beklet</span></span><span class="uys-ok">›</span></button>`;
  modalAc('Potansiyel Müşteri Oluştu', govde, null, `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 13c0-3 2.2-5.2 5.5-5.2C17.5 11 15.3 13 12 13Z" fill="currentColor" opacity=".26"/><path d="M12 13c0-3 2.2-5.2 5.5-5.2C17.5 11 15.3 13 12 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 13c0-3.2-2.2-5.5-5.5-5.5C6.5 11 8.7 13 12 13Z" fill="currentColor" opacity=".26"/><path d="M12 13c0-3.2-2.2-5.5-5.5-5.5C6.5 11 8.7 13 12 13Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span>Yeni Üye</span>`);
  $('#nySonra').onclick = () => { modalKapat(); ogrenciAktifSekme = 'potansiyel'; bildir('Potansiyel müşterilere eklendi.', 'basari'); SAYFALAR['ogrenciler'](); };
  $('#nyPaket').onclick = () => paketAtaModal(o);
  $('#nyLink').onclick = () => bildir('Bu bölüm yapım aşamasında.', '');
}

/* Eski Üye → kayıtlı öğrenci seç */
function uyeSecModal() {
  const liste = State.ogrenciler || [];
  if (!liste.length) return bildir('Kayıtlı üye yok. Önce “Yeni Üye” ekleyin.', 'hata');
  const satir = (o) => {
    const m = ogrenciMetrik(o);
    const pk = (o.paketler || []).length;
    const durumMetin = o.durum === 'ogrenci' ? (pk > 1 ? pk + ' paket' : (o.paketler[0] ? o.paketler[0].paketAd : 'Öğrenci')) : 'Potansiyel';
    return `<button type="button" class="uys-uye" data-uye="${o.id}"><span class="ogr-av">${basHarf(o.ad, o.soyad)}</span><span class="uys-uye-bilg"><span class="ad">${kacar(o.ad)} ${kacar(o.soyad || '')}</span><span class="alt">${kacar(o.telefon || '—')} · ${kacar(durumMetin)}</span></span><span class="uys-ok">›</span></button>`;
  };
  const govde = `
    <div class="uys-ara"><span class="ara-ik">${ik('ara')}</span><input type="text" id="uyeAra" placeholder="İsim ile ara…" autocomplete="off"></div>
    <div class="uys-liste" id="uyeListe">${liste.map(satir).join('')}</div>`;
  modalAc('Üye Seç', govde, `<button class="btn" id="uyeGeri" style="flex:1">‹ Geri</button>`, `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="currentColor" opacity=".28"/><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19.5c0-3.4 3-5.6 6.5-5.6s6.5 2.2 6.5 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>Eski Üye</span>`);
  const bagla = () => $$('#uyeListe [data-uye]').forEach(b => b.onclick = () => { const o = State.ogrenciler.find(x => x.id === b.dataset.uye); if (o) paketAtaModal(o); });
  bagla();
  $('#uyeGeri').onclick = yeniUyelikBaslat;
  $('#uyeAra').addEventListener('input', e => {
    const q = e.target.value.trim().toLocaleLowerCase('tr');
    const sonuc = liste.filter(o => (`${o.ad} ${o.soyad || ''}`).toLocaleLowerCase('tr').includes(q));
    $('#uyeListe').innerHTML = sonuc.length ? sonuc.map(satir).join('') : `<div class="gp-bos" style="margin:0">Eşleşen üye yok.</div>`;
    bagla();
  });
}

/* Potansiyeldeki “Paket Ata” → işlem seç (kişi başlıklı, düzenlenmiş metinler) */
function islemSecModal(o) {
  const tamAd = `${o.ad} ${o.soyad || ''}`.trim();
  const govde = `
    <div class="is-kisi"><span class="ogr-av">${basHarf(o.ad, o.soyad)}</span><span class="is-kisi-bilg"><span class="ad">${kacar(tamAd)}</span><span class="alt">Potansiyel müşteri${o.telefon ? ` · ${kacar(o.telefon)}` : ''}</span></span></div>
    <div class="is-soru">Ne yapmak istersiniz?</div>
    <div class="uys-ikisec">
      <button type="button" class="uys-opt uana" id="isPaket"><span class="uys-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" fill="currentColor" opacity=".24"/><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v1.5M12 11.2v1.6M12 14.5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><span class="uys-metin"><span class="ad">Ders Paketi Tanımla</span><span class="alt">Eğitmen ve paket seç → öğrenciye dönüştür</span></span><span class="uys-ok">›</span></button>
      <button type="button" class="uys-opt pas" id="isLink"><span class="uys-ik mavi"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 14.5 14.5 9.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M11 7.5 12.6 6a3.6 3.6 0 0 1 5.1 5.1l-1.6 1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13 16.5 11.4 18a3.6 3.6 0 0 1-5.1-5.1l1.6-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span><span class="uys-metin"><span class="ad">Müşteriye Link Gönder</span><span class="alt">Paketi kendisi seçsin</span></span><span class="uys-yak">yapım aşamasında</span></button>
    </div>`;
  modalAc('İşlem Seç', govde, `<button class="btn" id="isVazgec" style="flex:1">Vazgeç</button>`, `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="currentColor" opacity=".28"/><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19.5c0-3.4 3-5.6 6.5-5.6s6.5 2.2 6.5 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>${kacar(tamAd)}</span>`);
  $('#isPaket').onclick = () => paketAtaModal(o);
  $('#isVazgec').onclick = modalKapat;
  $('#isLink').onclick = () => bildir('Bu bölüm yapım aşamasında.', '');
}

/* Ders paketi ata — eğitmen + üyelik paketi seçimi */
function paketAtaModal(o) {
  const egitmenler = State.ortaklar.filter(x => x.aktif !== false);
  const paketler = State.uyelikler || [];
  if (!egitmenler.length) return bildir('Önce eğitmen (ortak) ekleyin: Ayarlar › Ortak Bilgileri.', 'hata');
  if (!paketler.length) return bildir('Önce üyelik paketi tanımlayın: Tanımlamalar › Üyelikler.', 'hata');

  let egitmenId = o.egitmenId || (adminMi() ? null : aktifOrtakId()) || egitmenler[0].id;
  let uyelikId = null;   // paket varsayılan olarak SEÇİLİ DEĞİL
  let secIdx = -1;       // ders seçeneği de SEÇİLİ DEĞİL
  const paketTrigIc = () => {
    const p = paketler.find(x => x.id === uyelikId);
    if (!p) return `<span class="st-col"><span class="st-ph">Paket seçin</span></span><span class="st-ok">›</span>`;
    if (secIdx < 0) return `<span class="pa-pk">${ik('uyelik')}</span><span class="st-col"><span class="st-nm">${kacar(p.ad)}</span><span class="st-sub" style="color:var(--amber);font-weight:700">Ders sayısı seçilmedi — dokun</span></span><span class="st-ok">›</span>`;
    const secler = uyelikSecenekleri(p);
    const s = secler[secIdx] || {};
    return `<span class="pa-pk">${ik('uyelik')}</span><span class="st-col"><span class="st-nm">${kacar(p.ad)} — ${Number(s.dersSayisi) || 0} ders</span><span class="st-sub">${binlik(s.fiyat || 0)} ₺ · ${Number(p.gecerlilikGun) || 0} gün geçerli</span></span><span class="st-ok">›</span>`;
  };

  const govde = `
    <div class="gp-alan"><label>Eğitmen</label>
      <button type="button" class="sec-trig" id="paeTrig">${egitmenTrigIc(egitmenId)}</button></div>
    <div class="gp-alan" style="margin:0"><label>Üyelik Paketi</label>
      <button type="button" class="sec-trig" id="papTrig">${paketTrigIc()}</button></div>`;
  modalAc('Ders Paketi Ata', govde,
    `<button class="btn" id="paIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="paKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Öğrenciye Ekle</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" fill="currentColor" opacity=".24"/><path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2 2 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2 2 0 0 0 0-5v-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v1.5M12 11.2v1.6M12 14.5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>Paket</span>`);

  $('#paeTrig').onclick = () => egitmenSecModal(egitmenId, (id) => { egitmenId = id; $('#paeTrig').innerHTML = egitmenTrigIc(egitmenId); });
  $('#papTrig').onclick = () => paketSecModal(uyelikId, secIdx, (pid, sidx) => { uyelikId = pid; secIdx = sidx; $('#papTrig').innerHTML = paketTrigIc(); });

  $('#paIptal').onclick = modalKapat;
  $('#paKaydet').onclick = async () => {
    const uy = paketler.find(x => x.id === uyelikId);
    if (!uy) return bildir('Paket seçin.', 'hata');
    if (secIdx < 0) return bildir('Önce ders sayısını seçin (Üyelik Paketi’ne dokun).', 'hata');
    const secler = uyelikSecenekleri(uy);
    const sec = secler[secIdx];
    if (!sec) return bildir('Ders seçeneği seçin.', 'hata');
    const dersAdet = Number(sec.dersSayisi) || 0;
    const paket = {
      id: yeniId(), uyelikId: uy.id, paketAd: uy.ad,
      dersToplam: dersAdet, kalanDers: dersAdet,
      fiyat: Number(sec.fiyat) || 0, kalanOdeme: Number(sec.fiyat) || 0,
      tarih: new Date().toISOString(),
    };
    const guncel = { egitmenId, durum: 'ogrenci', paketler: [...(o.paketler || []), paket] };
    await DB.guncelle('ogrenciler', o.id, guncel); Object.assign(o, guncel);
    ogrenciAktifSekme = 'ogrenci'; bildir('Paket öğrenciye eklendi.', 'basari');
    // Stüdyo tanımlıysa tekrarlı ders programı üretimini öner; değilse mevcut davranış
    if (aktifStudyolar().length) dersProgramModal(o, paket, egitmenId);
    else { modalKapat(); SAYFALAR['ogrenciler'](); }
  };
}

/* Pakete tekrarlı ders programı — "her Salı 18:00 Stüdyo A" gibi kuralla N ders üretir */
function dersProgramModal(o, paket, egitmenId) {
  const studyolar = aktifStudyolar();
  const N = Number(paket.dersToplam) || 0;
  const SURELER = [30, 45, 60, 90];
  const gunSecili = new Set();          // 0=Pzt … 6=Paz
  let saat = '10:00', sureDk = 60;
  let studyoId = studyolar[0] ? studyolar[0].id : null;
  let baslangic = bugunISO();
  const govde = `
    <div class="dpr-bilgi">${ik('dersler')}<span><b>${kacar(ogrenciTamAd(o))}</b> · ${kacar(paket.paketAd)} — <b>${N} ders</b> üretilecek</span></div>
    <div class="gp-alan"><label>Hangi günler?</label>
      <div class="turcip dpr-gunler" id="dprGun">${HAFTA_GUN_KISA.map((g, i) => `<button type="button" class="tc" data-g="${i}">${g}</button>`).join('')}</div></div>
    <div class="uy-ikili">
      <div class="gp-alan" style="margin:0"><label>Başlangıç Saati</label><button type="button" class="saat-trig" id="dprSaat">${ik('sure')}<span id="dprSaatAd">${saat}</span></button></div>
      <div class="gp-alan" style="margin:0"><label>Başlangıç Tarihi</label><button type="button" class="pa-trig" id="dprTarih"><span id="dprTarihAd">${fmtTarihUzun(baslangic)}</span><span class="ok">${ik('dersler')}</span></button></div>
    </div>
    <div class="gp-alan"><label>Süre <span class="dsl-bitis" id="dprBitis">Bitiş ${saatEkleDk(saat, sureDk)}</span></label>
      <div class="turcip" id="dprSure">${SURELER.map(dk => `<button type="button" class="tc ${sureDk === dk ? 'sec' : ''}" data-sure="${dk}">${dk} dk</button>`).join('')}</div></div>
    <div class="gp-alan" style="margin:0"><label>Stüdyo</label>
      <div class="turcip" id="dprStudyo">${studyolar.map(s => `<button type="button" class="tc ${studyoId === s.id ? 'sec' : ''}" data-std="${s.id}">${ik('studyo')}${kacar(s.ad)}</button>`).join('')}</div></div>
    <button type="button" class="dpr-takvim-link" id="dprTakvimAc">${ik('studyo')} Stüdyo takvimi — boş saatleri gör</button>
    <div id="dprCakisma"></div>`;
  modalAc('Ders Programı Oluştur', govde,
    `<button class="btn" id="dprAtla" style="margin-right:auto">Şimdilik atla</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="dprUret">${ik('dersler')} ${N} Ders Üret</button>`,
    rozetHTML('dersler', 'Program'));
  const bitisGuncelle = () => { const el = $('#dprBitis'); if (el) el.textContent = 'Bitiş ' + saatEkleDk(saat, sureDk); };
  $('#dprGun').onclick = (e) => { const b = e.target.closest('[data-g]'); if (!b) return; const g = Number(b.dataset.g); if (gunSecili.has(g)) gunSecili.delete(g); else gunSecili.add(g); b.classList.toggle('sec'); };
  $('#dprSaat').onclick = () => saatSecici(saat, (s) => { saat = s; $('#dprSaatAd').textContent = s; bitisGuncelle(); });
  $('#dprTarih').onclick = () => tarihSecici(baslangic, (iso) => { baslangic = iso; $('#dprTarihAd').textContent = fmtTarihUzun(baslangic); });
  $('#dprSure').onclick = (e) => { const b = e.target.closest('[data-sure]'); if (!b) return; sureDk = Number(b.dataset.sure); $$('#dprSure .tc').forEach(x => x.classList.toggle('sec', x === b)); bitisGuncelle(); };
  $('#dprStudyo').onclick = (e) => { const b = e.target.closest('[data-std]'); if (!b) return; studyoId = b.dataset.std; $$('#dprStudyo .tc').forEach(x => x.classList.toggle('sec', x === b)); const c = $('#dprCakisma'); if (c) c.innerHTML = ''; };
  $('#dprTakvimAc').onclick = () => studyoTakvimModal(baslangic);
  $('#dprAtla').onclick = () => { modalKapat(); SAYFALAR['ogrenciler'](); };
  $('#dprUret').onclick = async () => {
    if (!gunSecili.size) return bildir('En az bir gün seçin.', 'hata');
    if (!studyoId) return bildir('Stüdyo seçin.', 'hata');
    const bitis = saatEkleDk(saat, sureDk);
    // 1) Plandaki ilk N tarih (seçili hafta günleri) — kaydırma/telafi YOK
    const adaylar = [];
    let gun = baslangic, guvenlik = 0;
    while (adaylar.length < N && guvenlik < 400) {
      guvenlik++;
      if (gunSecili.has(haftaGunu(gun))) adaylar.push(gun);
      gun = gunKaydir(gun, 1);
    }
    // 2) Her aday için çakışma + NEDEN (eğitmen dersi var / oda dolu) topla
    const cak = adaylar.map(t => { const c = dersCakismaVar({ egitmenId, studyoId, tarih: t, saat, bitis, haricId: null }); return c ? { tarih: t, tip: c.tip, ders: c.ders } : null; }).filter(Boolean);
    // 3) Çakışan varsa TAM BLOK — nedenleri satır satır göster, modal açık kalsın
    if (cak.length) {
      const satir = (c) => {
        const d = c.ders, e = State.ortaklar.find(x => x.id === d.egitmenId);
        const ids = d.ogrenciIds || [];
        const kimders = ids.length > 1 ? `${ids.length} kişi` : (ids.length ? kacar(ogrenciTamAd(State.ogrenciler.find(x => x.id === ids[0]))) : (d.dersAd || 'Ders'));
        const neden = c.tip === 'egitmen'
          ? `${ik('kisi', 'uik-mini')} Eğitmenin bu saatte dersi var`
          : `${ik('studyo', 'uik-mini')} “${kacar(studyoAd(studyoId))}” dolu`;
        return `<div class="dpr-cak-sat"><div class="dpr-cak-t">${fmtTarih(c.tarih)}</div><div class="dpr-cak-n">${neden}</div><div class="dpr-cak-d">${kacar(d.saat)}–${kacar(dersBitis(d))} · ${kimders}${e ? ' · ' + kacar(egitmenKisaAd(e)) : ''}</div></div>`;
      };
      $('#dprCakisma').innerHTML = `<div class="dpr-cak"><div class="dpr-cak-bas">${ik('uyari')} ${cak.length} tarih dolu — düzeltip tekrar deneyin</div>${cak.map(satir).join('')}<button type="button" class="dpr-takvim" id="dprTakvim2">${ik('studyo')} Stüdyo takvimini aç (boş saatleri gör)</button></div>`;
      $('#dprTakvim2').onclick = () => studyoTakvimModal(cak[0].tarih);
      const c = $('#dprCakisma'); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    // 4) Hiç çakışma yoksa hepsini oluştur
    const kayitlar = adaylar.map(t => ({ dersAd: paket.paketAd, egitmenId, ogrenciIds: [o.id], tarih: t, saat, bitis, studyoId, durum: 'bekliyor', dusumler: [] }));
    const yeni = await DB.topluEkle('dersler', kayitlar); yeni.forEach(y => State.dersler.push(y));
    modalKapat();
    bildir(`${kayitlar.length} ders programa eklendi.`, 'basari');
    dersAktifSekme = 'bekliyor'; SAYFALAR['ogrenciler']();
  };
}

/* Öğrenci bilgilerini düzenle (ad, soyad, telefon) */
function ogrenciDuzenle(o) {
  let egitmenId = o.egitmenId || null;
  const paketler = (o.paketler || []).map(p => ({ ...p }));   // düzenlenebilir kopya
  const paketBlok = (p, i) => `
    <div class="oduz-paket">
      <div class="oduz-pbas">${ik('uyelik', 'uik-et')}Paket ${i + 1}</div>
      <div class="gp-alan"><label>Paket Adı</label><input type="text" class="gp-inp" data-pf="paketAd" data-pi="${i}" value="${kacar(p.paketAd || '')}" autocomplete="off"></div>
      <div class="uy-ikili">
        <div class="gp-alan" style="margin:0"><label>Toplam Ders</label><input type="text" class="gp-inp" data-pf="dersToplam" data-pi="${i}" inputmode="numeric" value="${Number(p.dersToplam) || 0}"></div>
        <div class="gp-alan" style="margin:0"><label>Fiyat (₺)</label><input type="text" class="gp-inp" data-pf="fiyat" data-pi="${i}" inputmode="numeric" value="${binlik(Number(p.fiyat) || 0)}"></div>
      </div>
      <div class="oduz-kalan"><span>Kalan Ders: <b>${Number(p.kalanDers) || 0}</b></span><span>Kalan Ödeme: <b>${binlik(Number(p.kalanOdeme) || 0)} ₺</b></span></div>
    </div>`;
  const govde = `
    <div class="uy-ikili">
      <div class="gp-alan" style="margin:0"><label>Adı</label><input type="text" class="gp-inp" id="oAd" value="${kacar(o.ad || '')}" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      <div class="gp-alan" style="margin:0"><label>Soyadı</label><input type="text" class="gp-inp" id="oSoyad" value="${kacar(o.soyad || '')}" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    </div>
    <div class="gp-alan"><label>Telefon</label><input type="tel" inputmode="numeric" class="gp-inp" id="oTel" value="${kacar(telBiciml(o.telefon || ''))}"></div>
    <div class="gp-alan"><label>Eğitmeni</label><button type="button" class="sec-trig" id="oEgTrig">${egitmenTrigIc(egitmenId)}</button></div>
    ${paketler.map(paketBlok).join('')}`;
  modalAc('Öğrenci Düzenle', govde,
    `<button class="btn btn-kirmizi" id="oSil" style="margin-right:auto">${ik('cop')} Sil</button><button class="btn" id="oIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="oKaydet">${ik('kaydet')} Kaydet</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="currentColor" opacity=".28"/><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19.5c0-3.4 3-5.6 6.5-5.6s6.5 2.2 6.5 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>Öğrenci</span>`);
  { const tl = $('#oTel'); tl.addEventListener('input', () => { tl.value = telBiciml(tl.value); }); }
  $('#oEgTrig').onclick = () => egitmenSecModal(egitmenId, (id) => { egitmenId = id; $('#oEgTrig').innerHTML = egitmenTrigIc(egitmenId); });
  $$('[data-pf="fiyat"]').forEach(el => el.addEventListener('input', () => { el.value = binlikBiciml(el.value); }));
  $$('[data-pf="dersToplam"]').forEach(el => el.addEventListener('input', () => { el.value = (el.value || '').replace(/\D/g, ''); }));
  $('#oIptal').onclick = modalKapat;
  $('#oSil').onclick = () => onayModal('Kayıt silinsin mi?', 'Bu öğrenci ve tüm paketleri silinecek.', async () => {
    await DB.sil('ogrenciler', o.id); State.ogrenciler = State.ogrenciler.filter(x => x.id !== o.id);
    bildir('Silindi.', 'basari'); SAYFALAR['ogrenciler']();
  });
  $('#oKaydet').onclick = async () => {
    const ad = $('#oAd').value.trim();
    if (!ad) return bildir('Ad girin.', 'hata');
    $$('[data-pf]').forEach(el => {
      const i = Number(el.dataset.pi), f = el.dataset.pf; if (!paketler[i]) return;
      if (f === 'paketAd') paketler[i].paketAd = el.value.trim();
      else paketler[i][f] = Number((el.value || '').replace(/\D/g, '')) || 0;   // kalanDers/kalanOdeme düzenlenmez
    });
    const guncel = { ad, soyad: $('#oSoyad').value.trim(), telefon: telBiciml($('#oTel').value), egitmenId, paketler };
    await DB.guncelle('ogrenciler', o.id, guncel); Object.assign(o, guncel);
    modalKapat(); bildir('Kaydedildi.', 'basari'); SAYFALAR['ogrenciler']();
  };
}

/* ==========================================================
   Dersler (planlanan / gerçekleşen / iptal + ders satışı düşümü)
   ========================================================== */
const AY_TAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
let dersAktifSekme = 'bekliyor';   // 'bekliyor' | 'gerceklesti' | 'iptal'
let dersFiltre = { egitmenId: null, studyoId: null, tarih: null, ogrenciId: null };   // Dersler filtresi
function dersFiltreAktif() { return !!(dersFiltre.egitmenId || dersFiltre.studyoId || dersFiltre.tarih || dersFiltre.ogrenciId); }
function dersFiltreUygula(list) {
  return list.filter(d =>
    (!dersFiltre.egitmenId || d.egitmenId === dersFiltre.egitmenId) &&
    (!dersFiltre.studyoId || d.studyoId === dersFiltre.studyoId) &&
    (!dersFiltre.tarih || d.tarih === dersFiltre.tarih) &&
    (!dersFiltre.ogrenciId || (d.ogrenciIds || []).includes(dersFiltre.ogrenciId)));
}
function ogrenciTamAd(o) { return o ? `${o.ad} ${o.soyad || ''}`.trim() : '—'; }

SAYFALAR['dersler'] = function () {
  const hepsiHam = (State.dersler || []).filter(d => hepsiniGor() || d.egitmenId === benId());   // ortak: yalnızca kendi dersleri
  const hepsi = dersFiltreUygula(hepsiHam);   // aktif filtreyi uygula (eğitmen/stüdyo/tarih/öğrenci)
  const say = { bekliyor: 0, gerceklesti: 0, iptal: 0 };
  hepsi.forEach(d => { if (say[d.durum] != null) say[d.durum]++; });
  const bugun = bugunISO();
  const simdiSaat = (() => { const t = new Date(); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); })();
  const geldiMi = (d) => d.durum === 'bekliyor' && (d.tarih < bugun || (d.tarih === bugun && (d.saat || '00:00') <= simdiSaat));
  const liste = hepsi.filter(d => d.durum === dersAktifSekme).sort((a, b) => {
    const ga = geldiMi(a) ? 0 : 1, gb = geldiMi(b) ? 0 : 1;
    if (ga !== gb) return ga - gb;   // saati gelmiş (onaylanacak) dersler en üstte
    return (a.tarih + a.saat).localeCompare(b.tarih + b.saat);
  });
  const drzBilgi = { bekliyor: ['b', 'Planlı', 'sure'], gerceklesti: ['g', 'Yapıldı', 'onay'], iptal: ['i', 'İptal', ''] };
  const ogrHucre = (d) => {
    const ids = d.ogrenciIds || [];
    if (!ids.length) return '<span class="ogr-soluk">—</span>';
    if (ids.length > 1) {
      return `<button type="button" class="grp-ders" data-grpders="${d.id}"><span class="grp-ik">${ik('ortaklar')}</span><span class="grp-txt"><span class="grp-ad">Grup Dersi</span><span class="ders-adet">${d.dersAd ? kacar(d.dersAd) + ' · ' : ''}${ids.length} kişi</span></span></button>`;
    }
    const ilk = ogrenciTamAd(State.ogrenciler.find(x => x.id === ids[0]));
    return `<span class="ders-ogr-ad">${kacar(ilk)}</span>${d.dersAd ? `<div class="ders-adet-satir"><span class="ders-adet">${kacar(d.dersAd)}</span></div>` : ''}`;
  };
  const satir = (d) => {
    const e = State.ortaklar.find(x => x.id === d.egitmenId);
    const [c, ad, dik] = drzBilgi[d.durum] || ['b', 'Planlı', 'sure'];
    const geldi = geldiMi(d);
    const drzBtn = `<button type="button" class="drzk ${c}" data-drz="${d.id}" title="Durumu değiştir">${dik ? ik(dik) : ''}<span>${ad}</span></button>`;
    const durumCell = geldi
      ? `<div class="drz-cell"><button type="button" class="onay-mini" data-onayder="${d.id}" title="Dersi onayla" aria-label="Dersi onayla">${ik('onay')}</button>${drzBtn}</div>`
      : drzBtn;
    return `<tr class="${geldi ? 'ders-geldi' : ''}">
      <td data-l="Eğitmen"><span class="ogr-egit">${egitmenAv(e ? e.id : null, 'ogr-ea')}${kacar(e ? egitmenKisaAd(e) : '—')}</span></td>
      <td data-l="Öğrenci">${ogrHucre(d)}</td>
      <td data-l="Tarih">${fmtTarihUzun(d.tarih)}</td>
      <td data-l="Saat"><span class="ders-saat">${kacar(d.saat || '')}${d.bitis ? '–' + kacar(d.bitis) : ''}</span>${d.studyoId ? `<span class="ders-std">${ik('studyo')}${kacar(studyoAd(d.studyoId))}</span>` : ''}</td>
      <td data-l="Durum">${durumCell}</td>
    </tr>`;
  };
  const bosMetin = dersAktifSekme === 'bekliyor' ? (dersFiltreAktif() ? 'Bu filtreye uyan planlanan ders yok.' : 'Planlanan ders yok. “＋ Ders Oluştur” ile başlayın.')
    : dersAktifSekme === 'gerceklesti' ? 'Bu görünümde gerçekleşen ders yok.' : 'Bu görünümde iptal edilmiş ders yok.';
  // Aktif filtre çipleri
  const fcip = [];
  if (dersFiltre.egitmenId) fcip.push(`<span class="dfc" data-dfx="egitmenId">${ik('kisi', 'uik-mini')}${kacar(egitmenAdiById(dersFiltre.egitmenId))}<span class="x">✕</span></span>`);
  if (dersFiltre.studyoId) fcip.push(`<span class="dfc" data-dfx="studyoId">${ik('studyo', 'uik-mini')}${kacar(studyoAd(dersFiltre.studyoId))}<span class="x">✕</span></span>`);
  if (dersFiltre.tarih) fcip.push(`<span class="dfc" data-dfx="tarih">${ik('dersler', 'uik-mini')}${fmtTarih(dersFiltre.tarih)}<span class="x">✕</span></span>`);
  if (dersFiltre.ogrenciId) { const o = State.ogrenciler.find(x => x.id === dersFiltre.ogrenciId); fcip.push(`<span class="dfc" data-dfx="ogrenciId">${ik('ogrenci', 'uik-mini')}${kacar(o ? ogrenciTamAd(o) : '—')}<span class="x">✕</span></span>`); }
  const filtreCipHTML = fcip.length ? `<div class="ders-filtre-cip">${fcip.join('')}<button type="button" class="dfc-temizle" id="dfTemizle">Tümünü temizle</button></div>` : '';
  dtHedef().innerHTML = `
    <div class="ders-sayfa">
      <div class="ogr-ust">
        <div class="ogr-seg">
          <button type="button" class="seg-pln ${dersAktifSekme === 'bekliyor' ? 'sec' : ''}" data-dsek="bekliyor">Planlanan <span class="rk">${say.bekliyor}</span></button>
          <button type="button" class="seg-grc ${dersAktifSekme === 'gerceklesti' ? 'sec' : ''}" data-dsek="gerceklesti">Gerçekleşen <span class="rk">${say.gerceklesti}</span></button>
          <button type="button" class="seg-ipt ${dersAktifSekme === 'iptal' ? 'sec' : ''}" data-dsek="iptal">İptal <span class="rk">${say.iptal}</span></button>
        </div>
        <div class="ogr-ust-sag">${ortakGosterBtnHTML()}<button type="button" class="ders-filtre-btn ${dersFiltreAktif() ? 'aktif' : ''}" id="dersFiltreBtn" title="Filtrele" aria-label="Filtrele">${ik('filtre')}</button><button type="button" class="gp-ekle" id="dersEkle">＋ Ders Oluştur</button></div>
      </div>
      ${filtreCipHTML}
      ${liste.length
        ? `<div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo">
            <colgroup><col style="width:18%"><col style="width:27%"><col style="width:16%"><col style="width:12%"><col style="width:27%"></colgroup>
            <thead><tr><th>Eğitmen</th><th>Öğrenci</th><th>Tarih</th><th>Saat</th><th>Durum</th></tr></thead>
            <tbody>${liste.map(satir).join('')}</tbody></table></div></div>`
        : `<div class="gp-bos">${bosMetin}</div>`}
    </div>`;
  $('#dersEkle').onclick = () => dersOlusturModal();
  $('#dersFiltreBtn').onclick = () => dersFiltreModal();
  { const t = $('#dfTemizle'); if (t) t.onclick = () => { dersFiltre = { egitmenId: null, studyoId: null, tarih: null, ogrenciId: null }; SAYFALAR['dersler'](); }; }
  $$('.ders-filtre-cip [data-dfx]').forEach(c => c.onclick = () => { dersFiltre[c.dataset.dfx] = null; SAYFALAR['dersler'](); });
  ortakGosterBtnBagla(() => SAYFALAR['dersler']());
  $$('[data-dsek]').forEach(b => b.onclick = () => { dersAktifSekme = b.dataset.dsek; SAYFALAR['dersler'](); });
  $$('[data-drz]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const d = State.dersler.find(x => x.id === b.dataset.drz); if (d) durumPopup(d, b); });
  $$('[data-onayder]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const d = State.dersler.find(x => x.id === b.dataset.onayder); if (d) dersDurumDegistir(d, 'gerceklesti'); });
  $$('[data-grpders]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const d = State.dersler.find(x => x.id === b.dataset.grpders); if (d) grupDersiModal(d); });
};

/* Dersler filtre modalı — eğitmen / stüdyo / tarih / öğrenci */
function dersFiltreModal() {
  const f = { ...dersFiltre };   // yerel kopya; Uygula ile işlenir
  const egitmenler = State.ortaklar.filter(x => x.aktif !== false);
  const studyolar = aktifStudyolar();
  const egitmenChips = () => `<button type="button" class="tc ${!f.egitmenId ? 'sec' : ''}" data-eg="">Hepsi</button>` + egitmenler.map(e => `<button type="button" class="tc ${f.egitmenId === e.id ? 'sec' : ''}" data-eg="${e.id}">${kacar(egitmenKisaAd(e))}</button>`).join('');
  const studyoChips = () => `<button type="button" class="tc ${!f.studyoId ? 'sec' : ''}" data-st="">Hepsi</button>` + studyolar.map(s => `<button type="button" class="tc ${f.studyoId === s.id ? 'sec' : ''}" data-st="${s.id}">${kacar(s.ad)}</button>`).join('');
  const tarihIc = () => f.tarih ? fmtTarihUzun(f.tarih) : 'Tüm tarihler';
  const ogrIc = () => { if (!f.ogrenciId) return 'Tüm öğrenciler'; const o = State.ogrenciler.find(x => x.id === f.ogrenciId); return o ? ogrenciTamAd(o) : 'Tüm öğrenciler'; };
  const govde = `
    <div class="gp-alan"><label>Eğitmen</label><div class="turcip dff-cip" id="dfEg">${egitmenChips()}</div></div>
    ${studyolar.length ? `<div class="gp-alan"><label>Stüdyo</label><div class="turcip dff-cip" id="dfSt">${studyoChips()}</div></div>` : ''}
    <div class="uy-ikili">
      <div class="gp-alan" style="margin:0"><label>Tarih</label><button type="button" class="pa-trig" id="dfTarih"><span id="dfTarihAd">${tarihIc()}</span><span class="ok">${ik('dersler')}</span></button></div>
      <div class="gp-alan" style="margin:0"><label>Öğrenci</label><button type="button" class="sec-trig" id="dfOgr"><span class="st-col"><span class="st-nm" id="dfOgrAd">${kacar(ogrIc())}</span></span><span class="st-ok">›</span></button></div>
    </div>`;
  modalAc('Dersleri Filtrele', govde,
    `<button class="btn" id="dfSifirla" style="margin-right:auto">Temizle</button><button class="btn" id="dfIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="dfUygula">${ik('filtre')} Uygula</button>`,
    rozetHTML('filtre', 'Filtre'));
  $('#dfEg').onclick = (e) => { const b = e.target.closest('[data-eg]'); if (!b) return; f.egitmenId = b.dataset.eg || null; $$('#dfEg .tc').forEach(x => x.classList.toggle('sec', x === b)); };
  { const st = $('#dfSt'); if (st) st.onclick = (e) => { const b = e.target.closest('[data-st]'); if (!b) return; f.studyoId = b.dataset.st || null; $$('#dfSt .tc').forEach(x => x.classList.toggle('sec', x === b)); }; }
  $('#dfTarih').onclick = () => tarihSecici(f.tarih || bugunISO(), (iso) => { f.tarih = iso; $('#dfTarihAd').textContent = fmtTarihUzun(iso); });
  $('#dfOgr').onclick = () => ogrenciTekSecModal(f.ogrenciId, (id) => { f.ogrenciId = id; const o = State.ogrenciler.find(x => x.id === id); $('#dfOgrAd').textContent = o ? ogrenciTamAd(o) : 'Tüm öğrenciler'; });
  $('#dfSifirla').onclick = () => { dersFiltre = { egitmenId: null, studyoId: null, tarih: null, ogrenciId: null }; modalKapat(); SAYFALAR['dersler'](); };
  $('#dfIptal').onclick = modalKapat;
  $('#dfUygula').onclick = () => { dersFiltre = { ...f }; modalKapat(); SAYFALAR['dersler'](); };
}
/* Grup dersindeki öğrencileri listele (satıra basınca) */
function grupDersiModal(d) {
  const ids = d.ogrenciIds || [];
  const satir = (id) => {
    const o = State.ogrenciler.find(x => x.id === id);
    if (!o) return '';
    const pk = (o.paketler && o.paketler[0]) ? kacar(o.paketler[0].paketAd) : (o.durum === 'ogrenci' ? 'Öğrenci' : 'Potansiyel');
    return `<button type="button" class="uys-uye" data-go="${o.id}"><span class="ogr-av">${basHarf(o.ad, o.soyad)}</span><span class="uys-uye-bilg"><span class="ad">${kacar(ogrenciTamAd(o))}</span><span class="alt">${o.telefon ? kacar(o.telefon) + ' · ' : ''}${pk}</span></span><span class="uys-ok">›</span></button>`;
  };
  const govde = `<div class="uys-liste">${ids.map(satir).join('')}</div>`;
  modalAc('Grup Dersi', govde, `<button class="btn" id="gdKapat" style="flex:1">Kapat</button>`, rozetHTML('ortaklar', ids.length + ' Öğrenci'));
  $('#gdKapat').onclick = modalKapat;
  $$('#modalKap [data-go]').forEach(b => b.onclick = () => { const o = State.ogrenciler.find(x => x.id === b.dataset.go); modalKapat(); if (o) ogrenciDetayModal(o); });
}

/* Durum rozetine basınca açılan küçük menü */
function durumPopup(ders, anker) {
  document.querySelectorAll('.drz-pop').forEach(x => x.remove());
  const secenekler = [['bekliyor', 'b', 'B', 'Bekliyor'], ['gerceklesti', 'g', 'G', 'Gerçekleşti'], ['iptal', 'i', 'İ', 'İptal edildi']];
  const pop = document.createElement('div');
  pop.className = 'drz-pop';
  pop.innerHTML = `<div class="drz-pop-cap">Durum seç</div>` + secenekler.map(([d, c, h, ad]) =>
    `<button type="button" class="drz-opt ${ders.durum === d ? 'sec' : ''}" data-d="${d}"><span class="drz ${c}">${h}</span>${ad}</button>`).join('')
    + `<div class="drz-ay"></div><button type="button" class="drz-opt" data-duz="1"><span class="drz-duz-ik">${ik('kaydet')}</span>Dersi Düzenle</button><button type="button" class="drz-opt drz-sil" data-sil="1"><span class="drz-sil-ik">${ik('cop')}</span>Dersi Sil</button>`;
  document.body.appendChild(pop);
  const r = anker.getBoundingClientRect();
  let left = r.right - pop.offsetWidth; if (left < 8) left = 8;
  let top = r.bottom + 6; if (top + pop.offsetHeight > window.innerHeight - 8) top = r.top - pop.offsetHeight - 6;
  pop.style.left = left + 'px'; pop.style.top = Math.max(8, top) + 'px';
  const kapat = (e) => { if (!pop.contains(e.target) && e.target !== anker) { pop.remove(); document.removeEventListener('pointerdown', kapat, true); } };
  setTimeout(() => document.addEventListener('pointerdown', kapat, true), 0);
  pop.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { pop.remove(); document.removeEventListener('pointerdown', kapat, true); dersDurumDegistir(ders, b.dataset.d); });
  pop.querySelector('[data-duz]').onclick = () => { pop.remove(); document.removeEventListener('pointerdown', kapat, true); dersOlusturModal(ders); };
  pop.querySelector('[data-sil]').onclick = () => { pop.remove(); document.removeEventListener('pointerdown', kapat, true); dersSil(ders); };
}
/* Dersi tamamen sil (gerçekleştiyse düşen dersleri iade et) */
function dersSil(ders) {
  onayModal('Ders silinsin mi?', 'Bu ders kaydı kalıcı olarak silinecek. Gerçekleştiyse düşen dersler iade edilir.', async () => {
    if (ders.durum === 'gerceklesti') dersDusumGeriAl(ders);
    await DB.sil('dersler', ders.id);
    State.dersler = State.dersler.filter(x => x.id !== ders.id);
    bildir('Ders silindi.', 'basari'); SAYFALAR['dersler']();
  });
}

function dersDurumDegistir(ders, yeni, sonra) {
  const yenile = sonra || (() => SAYFALAR['dersler']());   // hangi sayfayı tazeleyeceğiz (dashboard'dan da çağrılır)
  if (ders.durum === yeni) return;
  if (ders.durum === 'gerceklesti' && yeni !== 'gerceklesti') dersDusumGeriAl(ders);
  // Grup dersi (birden çok öğrenci) gerçekleşiyorsa: önce kimler katıldı seçtir
  if (yeni === 'gerceklesti' && (ders.ogrenciIds || []).length > 1) {
    katilimModal(ders, (katilanlar) => {
      dersDusumUygula(ders, katilanlar);
      ders.durum = 'gerceklesti';
      DB.guncelle('dersler', ders.id, { durum: 'gerceklesti', dusumler: ders.dusumler || [] });
      bildir('Ders gerçekleşti — kalan dersler güncellendi.', 'basari');
      yenile();
    });
    return;
  }
  if (yeni === 'gerceklesti') dersDusumUygula(ders);
  ders.durum = yeni;
  DB.guncelle('dersler', ders.id, { durum: ders.durum, dusumler: ders.dusumler || [] });
  bildir(yeni === 'gerceklesti' ? 'Ders gerçekleşti — kalan dersler güncellendi.' : yeni === 'iptal' ? 'Ders iptal edildi.' : 'Ders tekrar bekliyor.', yeni === 'iptal' ? '' : 'basari');
  yenile();
}
/* “Kimler katıldı?” — grup dersini gerçekleştirirken katılan öğrencileri seç */
function katilimModal(ders, onOnay) {
  const ogrenciler = (ders.ogrenciIds || []).map(id => State.ogrenciler.find(x => x.id === id)).filter(Boolean);
  const secili = new Set(ogrenciler.map(o => o.id));   // varsayılan: hepsi katıldı
  const item = (o) => {
    const mt = ogrenciMetrik(o);
    const pk = (o.paketler && o.paketler[0]) ? kacar(o.paketler[0].paketAd) + ' · ' : '';
    return `<div class="ds-osat ${secili.has(o.id) ? 'sec' : ''}" data-o="${o.id}"><span class="ds-ochk">${secili.has(o.id) ? '✓' : ''}</span><span class="oav-mini">${basHarf(o.ad, o.soyad)}</span><span class="ds-obil"><span class="ad">${kacar(ogrenciTamAd(o))}</span><span class="alt">${pk}${mt.kalanDers} ders kaldı</span></span></div>`;
  };
  const govde = `
    <div class="kt-bilgi"><b>${kacar(ders.dersAd || 'Ders')}</b> · ${fmtTarihUzun(ders.tarih)}${ders.saat ? ' · ' + kacar(ders.saat) : ''}</div>
    <div class="ds-oliste sec-liste-kaydir" id="ktListe">${ogrenciler.map(item).join('')}</div>
    <div class="kt-bilgi kt-not">İşaretli öğrencilerden 1’er ders düşülür. İşaretsiz kalan (gelmeyen) düşülmez.</div>`;
  const m = ustKatModal('Kimler Katıldı?', `<span class="hr-rz-ik">${ik('onay')}</span>Gerçekleşti`, govde,
    `<button class="btn" type="button" data-vaz>Vazgeç</button><button class="btn btn-ana" type="button" data-onay>Gerçekleştir (<span id="ktSay">${secili.size}</span>)</button>`);
  m.qq('#ktListe [data-o]').forEach(el => el.onclick = () => {
    const id = el.dataset.o;
    if (secili.has(id)) secili.delete(id); else secili.add(id);
    el.classList.toggle('sec', secili.has(id));
    el.querySelector('.ds-ochk').textContent = secili.has(id) ? '✓' : '';
    m.q('#ktSay').textContent = secili.size;
  });
  m.q('[data-vaz]').onclick = m.kapat;
  m.q('[data-onay]').onclick = () => { m.kapat(); onOnay(Array.from(secili)); };
}
/* Gerçekleşti: katılan öğrencilerden 1 ders düş (en eski paketten — FIFO) */
function dersDusumUygula(ders, katilanIds) {
  ders.dusumler = ders.dusumler || [];
  if (ders.dusumler.length) return;   // zaten uygulanmış
  const hedef = katilanIds || ders.ogrenciIds || [];
  for (const oid of hedef) {
    const o = State.ogrenciler.find(x => x.id === oid); if (!o) continue;
    const uygun = (o.paketler || []).filter(p => (Number(p.kalanDers) || 0) > 0)
      .sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')));
    if (!uygun.length) continue;   // kalan dersi yok — düşülmez
    uygun[0].kalanDers = (Number(uygun[0].kalanDers) || 0) - 1;
    ders.dusumler.push({ ogrenciId: oid, paketId: uygun[0].id });
    DB.guncelle('ogrenciler', o.id, { paketler: o.paketler });
  }
}
/* Geri al: düşülen dersleri iade et */
function dersDusumGeriAl(ders) {
  for (const d of (ders.dusumler || [])) {
    const o = State.ogrenciler.find(x => x.id === d.ogrenciId); if (!o) continue;
    const p = (o.paketler || []).find(x => x.id === d.paketId); if (!p) continue;
    p.kalanDers = (Number(p.kalanDers) || 0) + 1;
    DB.guncelle('ogrenciler', o.id, { paketler: o.paketler });
  }
  ders.dusumler = [];
}

/* ---- Üst-kat seçim formları (ana modalın üzerinde açılır, kapanınca geri döner) ---- */
function ustKatModal(baslik, rozet, govdeHTML, altHTML) {
  const kap = document.createElement('div');
  kap.className = 'modal-perde modal-ust-kat';
  kap.innerHTML = `<div class="modal" role="dialog">
    <div class="modal-ust"><h3>${kacar(baslik)}</h3>${rozet ? `<span class="hr-rozet">${rozet}</span>` : ''}<button class="modal-kapat" type="button">×</button></div>
    <div class="modal-govde">${govdeHTML}</div>
    ${altHTML ? `<div class="modal-alt">${altHTML}</div>` : ''}
  </div>`;
  document.body.appendChild(kap);
  autofillKapatKur();
  const kapat = () => kap.remove();
  kap.querySelector('.modal-kapat').onclick = kapat;
  kap.onclick = (e) => { if (e.target === kap) kapat(); };
  return { kap, kapat, q: (s) => kap.querySelector(s), qq: (s) => Array.from(kap.querySelectorAll(s)) };
}
/* Eğitmen tetik-satırının iç görünümü */
function egitmenTrigIc(id) {
  const e = State.ortaklar.find(x => x.id === id);
  if (!e) return `<span class="st-col"><span class="st-ph">Eğitmen seçin</span></span><span class="st-ok">›</span>`;
  const pay = (e.payOrani != null && e.payOrani !== '') ? ` · %${e.payOrani} pay` : '';
  return `${egitmenAv(e.id, 'ogr-av sm')}<span class="st-col"><span class="st-nm">${kacar(egitmenKisaAd(e))}</span><span class="st-sub">Eğitmen${pay}</span></span><span class="st-ok">›</span>`;
}
/* Eğitmen Seç (tek seçim) */
function egitmenSecModal(seciliId, onSec) {
  const egitmenler = State.ortaklar.filter(x => x.aktif !== false);
  const satir = (e) => {
    const sc = e.id === seciliId;
    const pay = (e.payOrani != null && e.payOrani !== '') ? ` · %${e.payOrani} pay` : '';
    return `<button type="button" class="uys-uye ${sc ? 'sec-akt' : ''}" data-e="${e.id}">${egitmenAv(e.id, 'ogr-av')}<span class="uys-uye-bilg"><span class="ad">${kacar(egitmenKisaAd(e))}</span><span class="alt">Eğitmen${pay}</span></span><span class="uys-ok">${sc ? '<span class="tik-yes">✓</span>' : '›'}</span></button>`;
  };
  const govde = `<div class="sec-liste">${egitmenler.map(satir).join('')}</div>`;
  const m = ustKatModal('Eğitmen Seç', `<span class="hr-rz-ik">${ik('ortaklar')}</span>Eğitmen`, govde, `<button class="btn" type="button" data-geri style="flex:1">‹ Geri</button>`);
  m.q('[data-geri]').onclick = m.kapat;
  m.qq('[data-e]').forEach(el => el.onclick = () => { onSec(el.dataset.e); m.kapat(); });
}
/* Öğrenci Seç (çoklu, aramalı) */
function ogrenciSecModal(onceki, onKaydet) {
  const ogrenciler = State.ogrenciler.filter(x => x.durum === 'ogrenci').slice()
    .sort((a, b) => ogrenciTamAd(a).localeCompare(ogrenciTamAd(b), 'tr'));
  const secili = new Set(onceki);
  const chip = () => Array.from(secili).map(id => { const o = State.ogrenciler.find(x => x.id === id); return o ? `<span class="ds-chip">${kacar(ogrenciTamAd(o))} <span class="x" data-cx="${id}">✕</span></span>` : ''; }).join('');
  const item = (o) => {
    const mt = ogrenciMetrik(o);
    const pk = (o.paketler && o.paketler[0]) ? kacar(o.paketler[0].paketAd) + ' · ' : '';
    return `<div class="ds-osat ${secili.has(o.id) ? 'sec' : ''}" data-o="${o.id}"><span class="ds-ochk">${secili.has(o.id) ? '✓' : ''}</span><span class="oav-mini">${basHarf(o.ad, o.soyad)}</span><span class="ds-obil"><span class="ad">${kacar(ogrenciTamAd(o))}</span><span class="alt">${pk}${mt.kalanDers} ders kaldı</span></span></div>`;
  };
  const govde = `
    <div class="ds-chipler" id="osChip">${chip()}</div>
    <div class="uys-ara"><span class="ara-ik">${ik('ara')}</span><input type="text" id="osAra" placeholder="Öğrenci ara…"></div>
    <div class="ds-oliste sec-liste-kaydir" id="osListe">${ogrenciler.map(item).join('')}</div>`;
  const m = ustKatModal('Öğrenci Seç', `<span class="hr-rz-ik">${ik('ogrenci')}</span>Öğrenci`, govde,
    `<button class="btn" type="button" data-geri>‹ Geri</button><button class="btn btn-ana" type="button" data-sec>Seç (<span id="osSay">${secili.size}</span>)</button>`);
  const bindListe = () => m.qq('#osListe [data-o]').forEach(el => el.onclick = () => { const id = el.dataset.o; if (secili.has(id)) secili.delete(id); else secili.add(id); m.q('#osSay').textContent = secili.size; chipYenile(); yenile(); });
  const yenile = () => {
    const q = (m.q('#osAra').value || '').trim().toLocaleLowerCase('tr');
    const suz = ogrenciler.filter(o => ogrenciTamAd(o).toLocaleLowerCase('tr').includes(q));
    m.q('#osListe').innerHTML = suz.length ? suz.map(item).join('') : `<div class="gp-bos" style="margin:8px 6px">Eşleşen öğrenci yok.</div>`;
    bindListe();
  };
  const chipYenile = () => { m.q('#osChip').innerHTML = chip(); m.qq('#osChip [data-cx]').forEach(c => c.onclick = () => { secili.delete(c.dataset.cx); m.q('#osSay').textContent = secili.size; chipYenile(); yenile(); }); };
  bindListe(); chipYenile();
  m.q('#osAra').addEventListener('input', yenile);
  m.q('[data-geri]').onclick = m.kapat;
  m.q('[data-sec]').onclick = () => { onKaydet(secili); m.kapat(); };
}
/* Öğrenci Seç (tek seçim, aramalı) — Ders seçmedeki görünümle aynı */
function ogrenciTekSecModal(seciliId, onSec) {
  const ogrenciler = State.ogrenciler.filter(x => x.durum === 'ogrenci').slice()
    .sort((a, b) => ogrenciTamAd(a).localeCompare(ogrenciTamAd(b), 'tr'));
  let sel = seciliId || null;
  const item = (o) => {
    const mt = ogrenciMetrik(o);
    const pk = (o.paketler && o.paketler[0]) ? kacar(o.paketler[0].paketAd) + ' · ' : '';
    const borc = mt.kalanOdeme > 0 ? 'Kalan borç: ' + binlik(mt.kalanOdeme) + ' ₺' : 'Borç yok';
    return `<div class="ds-osat ${sel === o.id ? 'sec' : ''}" data-o="${o.id}"><span class="ds-ochk">${sel === o.id ? '✓' : ''}</span><span class="oav-mini">${basHarf(o.ad, o.soyad)}</span><span class="ds-obil"><span class="ad">${kacar(ogrenciTamAd(o))}</span><span class="alt">${pk}${borc}</span></span></div>`;
  };
  const govde = `
    <div class="uys-ara"><span class="ara-ik">${ik('ara')}</span><input type="text" id="tsAra" placeholder="Öğrenci ara…"></div>
    <div class="ds-oliste sec-liste-kaydir" id="tsListe">${ogrenciler.map(item).join('')}</div>`;
  const m = ustKatModal('Öğrenci Seç', `<span class="hr-rz-ik">${ik('ogrenci')}</span>Öğrenci`, govde,
    `<button class="btn" type="button" data-geri>‹ Geri</button><button class="btn btn-ana" type="button" data-sec>Seç</button>`);
  const bindListe = () => m.qq('#tsListe [data-o]').forEach(el => el.onclick = () => { sel = el.dataset.o; yenile(); });
  const yenile = () => {
    const q = (m.q('#tsAra').value || '').trim().toLocaleLowerCase('tr');
    const suz = ogrenciler.filter(o => ogrenciTamAd(o).toLocaleLowerCase('tr').includes(q));
    m.q('#tsListe').innerHTML = suz.length ? suz.map(item).join('') : `<div class="gp-bos" style="margin:8px 6px">Eşleşen öğrenci yok.</div>`;
    bindListe();
  };
  bindListe();
  m.q('#tsAra').addEventListener('input', yenile);
  m.q('[data-geri]').onclick = m.kapat;
  m.q('[data-sec]').onclick = () => { if (!sel) return bildir('Öğrenci seçin.', 'hata'); onSec(sel); m.kapat(); };
}
/* Paket Seç — 2 adım: (1) paket seç → İlerle, (2) ders sayısı seç → Seç */
function paketSecModal(seciliPaketId, seciliSecIdx, onSec) {
  const paketler = State.uyelikler || [];
  let pid = seciliPaketId || null;   // paket varsayılan: seçili değil
  let sidx = (typeof seciliSecIdx === 'number' && seciliSecIdx >= 0) ? seciliSecIdx : -1;   // ders sayısı varsayılan: seçili değil
  const secOzet = (p) => uyelikSecenekleri(p).map(s => Number(s.dersSayisi) || 0).join(' · ') + ' ders';
  const m = ustKatModal('Paket Seç', `<span class="hr-rz-ik">${ik('uyelik')}</span>Paket · 1/2`, '<div id="psGovde"></div>',
    '<div id="psAlt" style="display:flex;gap:10px;width:100%"></div>');
  const baslik = m.q('.modal-ust h3'), rozet = m.q('.hr-rozet'), govde = m.q('#psGovde'), alt = m.q('#psAlt');

  const cizPaket = () => {
    baslik.textContent = 'Paket Seç'; rozet.textContent = '🎟️ Paket · 1/2';
    govde.className = 'sec-liste';
    govde.innerHTML = paketler.map(p => {
      const sc = p.id === pid;
      return `<div class="pa-oge sec-oge ${sc ? 'sec' : ''}" data-p="${p.id}"><span class="pa-pk">${ik('uyelik')}</span><span class="pa-metin"><span class="ad">${kacar(p.ad)}</span><span class="alt">${secOzet(p)} · ${Number(p.gecerlilikGun) || 0} Gün</span></span>${sc ? '<span class="pa-tik">✓</span>' : ''}</div>`;
    }).join('');
    alt.innerHTML = `<button class="btn" type="button" data-geri style="flex:1">‹ Geri</button><button class="btn btn-ana" type="button" data-ilerle style="flex:1">İlerle →</button>`;
    govde.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { if (pid !== el.dataset.p) { pid = el.dataset.p; sidx = -1; } cizPaket(); });
    alt.querySelector('[data-geri]').onclick = m.kapat;
    alt.querySelector('[data-ilerle]').onclick = () => { if (!pid) return bildir('Paket seçin.', 'hata'); cizSayi(); };
  };
  const cizSayi = () => {
    const p = paketler.find(x => x.id === pid);
    const secler = uyelikSecenekleri(p);
    if (sidx >= secler.length) sidx = -1;
    baslik.textContent = 'Ders Sayısı'; rozet.textContent = '🎟️ Paket · 2/2';
    govde.className = '';
    govde.innerHTML = `<div class="pa-oge sec-oge sec" style="margin-bottom:12px"><span class="pa-pk">${ik('uyelik')}</span><span class="pa-metin"><span class="ad">${kacar(p.ad)}</span><span class="alt">${Number(p.gecerlilikGun) || 0} gün geçerli</span></span></div>
      <div class="sec-mini-bas">Kaç derslik alsın? ${sidx < 0 ? '<span style="color:var(--amber);font-weight:700">(bir seçenek seç)</span>' : ''}</div>
      <div class="sec-cip" id="psSecList">${secler.map((s, i) => `<div class="scip ${sidx === i ? 'sec' : ''}" data-si="${i}"><span class="d">${Number(s.dersSayisi) || 0} <small>ders</small></span><span class="scip-sag"><span class="f">${binlik(s.fiyat)} ₺</span>${sidx === i ? '<span class="tik">✓</span>' : ''}</span></div>`).join('')}</div>`;
    alt.innerHTML = `<button class="btn" type="button" data-geri2 style="flex:1">‹ Geri</button><button class="btn btn-ana" type="button" data-sec style="flex:1">Seç</button>`;
    govde.querySelectorAll('[data-si]').forEach(el => el.onclick = () => { sidx = Number(el.dataset.si); cizSayi(); });
    alt.querySelector('[data-geri2]').onclick = cizPaket;
    alt.querySelector('[data-sec]').onclick = () => { if (sidx < 0) return bildir('Ders sayısını seçin.', 'hata'); onSec(pid, sidx); m.kapat(); };
  };
  cizPaket();
}

/* ==========================================================
   STÜDYOLAR — günlük doluluk ızgarası + stüdyo yönetimi
   ========================================================== */
let studyoGun = bugunISO();
const STUDYO_SAAT_BAS = 8, STUDYO_SAAT_BIT = 22;   // 08:00–22:00 saatlik ızgara

/* Gün gezinme çubuğu (ay navigasyonunun gün sürümü) */
function gunNavHTML(iso, kompakt) {
  if (kompakt) {
    const et = `${iso.slice(8, 10)} ${AY_TAM[Number(iso.slice(5, 7)) - 1].slice(0, 3)} · ${HAFTA_GUN_KISA[haftaGunu(iso)]}`;
    return `<div class="ay-nav gun-nav gun-nav-mini"><button type="button" data-gun="-1" aria-label="Önceki gün">‹</button><span class="gk">${et}</span><button type="button" data-gun="1" aria-label="Sonraki gün">›</button></div>`;
  }
  return `<div class="ay-nav gun-nav"><button type="button" data-gun="-1" aria-label="Önceki gün">‹</button><span class="ay"><span class="m">${HAFTA_GUN_TAM[haftaGunu(iso)]}</span><span class="y">${iso.slice(8, 10)} ${AY_TAM[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}</span></span><button type="button" data-gun="1" aria-label="Sonraki gün">›</button></div>`;
}

/* Günlük stüdyo doluluk ızgarası (Stüdyolar sayfası + Stüdyo Takvimi modalı ortak kullanır) */
function studyoIzgaraHTML(gun, duzenlenebilir) {
  const studyolar = aktifStudyolar();
  if (!studyolar.length) return '';
  const gunDersleri = (State.dersler || []).filter(d => d.tarih === gun && d.durum !== 'iptal');
  const hucre = (sid, h) => {
    const bas = String(h).padStart(2, '0') + ':00', bit = String(h + 1).padStart(2, '0') + ':00';
    const ders = gunDersleri.filter(d => d.studyoId === sid && araliklarCakisir(bas, bit, d.saat, dersBitis(d)));
    if (!ders.length) return `<td class="std-bos"></td>`;
    return `<td class="std-dolu">${ders.map(d => {
      const e = State.ortaklar.find(x => x.id === d.egitmenId);
      const ids = d.ogrenciIds || [];
      const kim = ids.length > 1 ? `${ids.length} kişi` : (ids.length ? kacar(ogrenciTamAd(State.ogrenciler.find(x => x.id === ids[0]))) : (d.dersAd || 'Ders'));
      return `<div class="std-blok" data-drz="${d.id}"><span class="std-sa">${kacar(d.saat)}–${kacar(dersBitis(d))}</span><span class="std-ki">${kim}</span><span class="std-eg">${kacar(e ? egitmenKisaAd(e) : '—')}</span></div>`;
    }).join('')}</td>`;
  };
  const satirlar = [];
  for (let h = STUDYO_SAAT_BAS; h < STUDYO_SAAT_BIT; h++) {
    satirlar.push(`<tr><td class="std-saat">${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00</td>${studyolar.map(s => hucre(s.id, h)).join('')}</tr>`);
  }
  const colW = Math.floor(76 / studyolar.length);
  return `<div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo std-tablo">
      <colgroup><col style="width:24%">${studyolar.map(() => `<col style="width:${colW}%">`).join('')}</colgroup>
      <thead><tr><th>Saat</th>${studyolar.map(s => `<th><span class="std-bas">${ik('studyo')}${kacar(s.ad)}${duzenlenebilir ? `<button type="button" class="std-duz" data-sduz="${s.id}" title="Düzenle">${ik('kalem')}</button>` : ''}</span></th>`).join('')}</tr></thead>
      <tbody>${satirlar.join('')}</tbody></table></div></div>`;
}

/* Stüdyo Takvimi — boş saatleri görmek için salt-okunur günlük ızgara (modal) */
function studyoTakvimModal(baslangic) {
  let gun = baslangic || bugunISO();
  const m = ustKatModal('Stüdyo Takvimi', `<span class="hr-rz-ik">${ik('studyo')}</span>Boş saatler`, '<div id="stkGovde"></div>',
    `<button class="btn" type="button" data-geri style="flex:1">‹ Geri</button>`);
  const ciz = () => {
    m.q('#stkGovde').innerHTML = `<div class="ortk-ust stk-ust">${gunNavHTML(gun)}</div>${aktifStudyolar().length ? studyoIzgaraHTML(gun, false) : '<div class="gp-bos">Henüz stüdyo yok.</div>'}`;
    m.qq('[data-gun]').forEach(b => b.onclick = () => { gun = gunKaydir(gun, Number(b.dataset.gun)); ciz(); });
    tabloSigdir();
  };
  ciz();
  m.q('[data-geri]').onclick = m.kapat;
}

SAYFALAR['studyolar'] = function () {
  const admin = true;   // stüdyo yönetimi tüm giriş yapan kullanıcılara (admin + ortak) açık
  const studyolar = aktifStudyolar();
  const izgara = studyolar.length
    ? studyoIzgaraHTML(studyoGun, admin)
    : (admin
        ? `<div class="std-bos-kart"><div class="std-bos-ik">${ik('studyo')}</div><div class="std-bos-bas">Henüz stüdyo yok</div><div class="std-bos-alt">Ders oluşturmak için önce en az bir stüdyo (salon/oda) ekleyin.</div><button type="button" class="gp-ekle" id="stdEkleBos">＋ İlk Stüdyoyu Ekle</button></div>`
        : `<div class="gp-bos">Henüz stüdyo yok.</div>`);
  dtHedef().innerHTML = `
    <div class="ortk-ust std-ust">
      <div class="std-ust-sol"><span class="ortk-bas">Stüdyolar</span>${admin ? `<button type="button" class="std-ekle-mini" id="stdEkle">＋ Stüdyo</button>` : ''}</div>
      ${gunNavHTML(studyoGun, true)}
    </div>
    ${izgara}`;
  $$('[data-gun]').forEach(b => b.onclick = () => { studyoGun = gunKaydir(studyoGun, Number(b.dataset.gun)); SAYFALAR['studyolar'](); });
  { const eb = $('#stdEkle'); if (eb) eb.onclick = () => studyoFormu(); }
  { const eb = $('#stdEkleBos'); if (eb) eb.onclick = () => studyoFormu(); }
  $$('[data-sduz]').forEach(b => b.onclick = () => studyoFormu(State.studyolar.find(x => x.id === b.dataset.sduz)));
  $$('#icerik .std-blok[data-drz]').forEach(b => b.onclick = () => { const d = State.dersler.find(x => x.id === b.dataset.drz); if (d) durumPopup(d); });
  tabloSigdir();
};

/* Stüdyo ekle / düzenle / sil — tüm giriş yapan kullanıcılara açık */
function studyoFormu(mevcut) {
  let aktif = mevcut ? mevcut.aktif !== false : true;
  const govde = `
    <div class="gp-alan"><label>Stüdyo Adı</label><input type="text" class="gp-inp" id="stdAd" value="${mevcut ? kacar(mevcut.ad) : ''}" placeholder="Örn. Reformer Oda 1" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="gp-alan" style="margin:0"><label>Durum</label><div class="turcip" id="stdDurum"><button type="button" class="tc ${aktif ? 'sec' : ''}" data-a="1">Aktif</button><button type="button" class="tc ${!aktif ? 'sec' : ''}" data-a="0">Pasif</button></div></div>`;
  modalAc(mevcut ? 'Stüdyo Düzenle' : 'Yeni Stüdyo', govde,
    `${mevcut ? `<button class="btn btn-kirmizi" id="stdSil" style="margin-right:auto">${ik('cop')} Sil</button>` : ''}<button class="btn" id="stdIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="stdKaydet">${ik('kaydet')} Kaydet</button>`,
    rozetHTML('studyo', 'Stüdyo'));
  $('#stdDurum').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; aktif = b.dataset.a === '1'; $$('#stdDurum .tc').forEach(x => x.classList.toggle('sec', x === b)); };
  $('#stdIptal').onclick = modalKapat;
  if (mevcut) $('#stdSil').onclick = () => onayModal('Stüdyo silinsin mi?', 'Bu stüdyodaki mevcut ders kayıtları kalır.', async () => {
    await DB.sil('studyolar', mevcut.id); State.studyolar = State.studyolar.filter(x => x.id !== mevcut.id);
    modalKapat(); bildir('Stüdyo silindi.', 'basari'); SAYFALAR['studyolar']();
  });
  $('#stdKaydet').onclick = async () => {
    const ad = $('#stdAd').value.trim();
    if (!ad) return bildir('Stüdyo adı girin.', 'hata');
    const veri = { ad, aktif };
    if (mevcut) { await DB.guncelle('studyolar', mevcut.id, veri); Object.assign(mevcut, veri); }
    else { const y = await DB.ekle('studyolar', veri); State.studyolar.push(y); }
    modalKapat(); bildir('Kaydedildi.', 'basari'); SAYFALAR['studyolar']();
  };
}

/* Ders Oluştur formu */
function dersOlusturModal(mevcut) {
  const egitmenler = State.ortaklar.filter(x => x.aktif !== false);
  const ogrenciler = State.ogrenciler.filter(x => x.durum === 'ogrenci').slice()
    .sort((a, b) => ogrenciTamAd(a).localeCompare(ogrenciTamAd(b), 'tr'));
  if (!egitmenler.length) return bildir('Önce eğitmen (ortak) ekleyin: Ayarlar › Ortak Bilgileri.', 'hata');
  const studyolar = aktifStudyolar();
  if (!studyolar.length) return bildir('Önce stüdyo ekleyin: Ders Takibi › Stüdyolar.', 'hata');
  if (!ogrenciler.length && !mevcut) return bildir('Önce paketli öğrenci ekleyin (Öğrenciler).', 'hata');

  const SURELER = [30, 45, 60, 90];
  let egitmenId = mevcut ? (mevcut.egitmenId || '') : '';   // boş başla — öğrenci seçilince otomatik gelir
  const secili = new Set(mevcut ? (mevcut.ogrenciIds || []) : []);
  let tarih = mevcut ? mevcut.tarih : bugunISO();
  let saat = mevcut ? (mevcut.saat || '10:00') : '10:00';
  // Süre: düzenlemede saat/bitiş farkından türet, yoksa 60
  let sureDk = 60;
  if (mevcut && mevcut.bitis && mevcut.saat) {
    const [bh, bd] = mevcut.saat.split(':').map(Number), [eh, ed] = mevcut.bitis.split(':').map(Number);
    const fark = (eh * 60 + ed) - (bh * 60 + bd);
    sureDk = SURELER.includes(fark) ? fark : (fark > 0 ? fark : 60);
  }
  let studyoId = mevcut ? (mevcut.studyoId || (studyolar[0] && studyolar[0].id)) : (studyolar[0] && studyolar[0].id);
  let otoAd = '', otoEg = '';   // son otomatik doldurulan değerler (manuel düzenleme korunur)
  const chipler = () => Array.from(secili).map(id => { const o = State.ogrenciler.find(x => x.id === id); return o ? `<span class="ds-chip">${kacar(ogrenciTamAd(o))} <span class="x" data-cx="${id}">✕</span></span>` : ''; }).join('');

  const govde = `
    <div class="gp-alan"><label>Dersi Alacak Öğrenci(ler)</label>
      <div class="ds-chipler" id="dsChipler">${chipler()}</div>
      <button type="button" class="ekle-btn" id="dsOEkle">＋ Öğrenci Seç / Ekle</button></div>
    <div class="gp-alan"><label>Ders Adı</label><input type="text" class="gp-inp" id="dsAd" value="${mevcut ? kacar(mevcut.dersAd || '') : ''}" placeholder="Öğrenci seçilince gelir…"></div>
    <div class="gp-alan"><label>Dersi Verecek Eğitmen</label>
      <button type="button" class="sec-trig" id="dsETrig">${egitmenTrigIc(egitmenId)}</button></div>
    <div class="uy-ikili">
      <div class="gp-alan" style="margin:0"><label>Tarih</label><button type="button" class="pa-trig" id="dsTarih"><span id="dsTarihAd">${fmtTarihUzun(tarih)}</span><span class="ok">${ik('dersler')}</span></button></div>
      <div class="gp-alan" style="margin:0"><label>Başlangıç Saati</label><button type="button" class="saat-trig" id="dsSaat">${ik('sure')}<span id="dsSaatAd">${saat}</span></button></div>
    </div>
    <div class="gp-alan"><label>Süre <span class="dsl-bitis" id="dsBitis">Bitiş ${saatEkleDk(saat, sureDk)}</span></label>
      <div class="turcip" id="dsSure">${SURELER.map(dk => `<button type="button" class="tc ${sureDk === dk ? 'sec' : ''}" data-sure="${dk}">${dk} dk</button>`).join('')}</div></div>
    <div class="gp-alan" style="margin:0"><label>Stüdyo</label>
      <div class="turcip" id="dsStudyo">${studyolar.map(s => `<button type="button" class="tc ${studyoId === s.id ? 'sec' : ''}" data-std="${s.id}">${ik('studyo')}${kacar(s.ad)}</button>`).join('')}</div></div>`;
  modalAc(mevcut ? 'Ders Düzenle' : 'Ders Oluştur', govde,
    `${mevcut ? `<button class="btn btn-kirmizi" id="dsSil" style="margin-right:auto">${ik('cop')} Sil</button>` : ''}<button class="btn" id="dsIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="dsKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> ${mevcut ? 'Kaydet' : 'Dersi Planla'}</button>`,
    `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="currentColor" opacity=".26"/><rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9.5h17M8 3.2v3.4M16 3.2v3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M7.5 13h3M7.5 16.3h3M13.5 13h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>Ders</span>`);

  // Öğrenci seçilince: Ders Adı = öğrencinin paketi, Eğitmen = öğrencinin eğitmeni (manuel değişiklik korunur)
  const otoDoldur = () => {
    const ilk = State.ogrenciler.find(x => x.id === Array.from(secili)[0]); if (!ilk) return;
    const pk = (ilk.paketler && ilk.paketler[0]) ? (ilk.paketler[0].paketAd || '') : '';
    const ad = $('#dsAd');
    if (ad && pk && (ad.value.trim() === '' || ad.value.trim() === otoAd)) { ad.value = pk; otoAd = pk; }
    if (ilk.egitmenId && (egitmenId === '' || egitmenId === otoEg)) { egitmenId = ilk.egitmenId; otoEg = ilk.egitmenId; $('#dsETrig').innerHTML = egitmenTrigIc(egitmenId); }
  };

  $('#dsETrig').onclick = () => egitmenSecModal(egitmenId, (id) => { egitmenId = id; otoEg = ''; $('#dsETrig').innerHTML = egitmenTrigIc(egitmenId); });

  const chipYenile = () => { $('#dsChipler').innerHTML = chipler(); $$('#dsChipler [data-cx]').forEach(c => c.onclick = () => { secili.delete(c.dataset.cx); chipYenile(); }); };
  chipYenile();
  $('#dsOEkle').onclick = () => ogrenciSecModal(secili, (yeni) => { secili.clear(); yeni.forEach(id => secili.add(id)); chipYenile(); otoDoldur(); });

  const bitisGuncelle = () => { const el = $('#dsBitis'); if (el) el.textContent = 'Bitiş ' + saatEkleDk(saat, sureDk); };
  $('#dsTarih').onclick = () => tarihSecici(tarih, (iso) => { tarih = iso; $('#dsTarihAd').textContent = fmtTarihUzun(tarih); });
  $('#dsSaat').onclick = () => saatSecici(saat, (s) => { saat = s; $('#dsSaatAd').textContent = s; bitisGuncelle(); },
    gunMesgulAraliklar(tarih, { studyoId, egitmenId }));
  $('#dsSure').onclick = (e) => { const b = e.target.closest('[data-sure]'); if (!b) return; sureDk = Number(b.dataset.sure); $$('#dsSure .tc').forEach(x => x.classList.toggle('sec', x === b)); bitisGuncelle(); };
  $('#dsStudyo').onclick = (e) => { const b = e.target.closest('[data-std]'); if (!b) return; studyoId = b.dataset.std; $$('#dsStudyo .tc').forEach(x => x.classList.toggle('sec', x === b)); };
  $('#dsIptal').onclick = modalKapat;
  if (mevcut) $('#dsSil').onclick = () => dersSil(mevcut);
  $('#dsKaydet').onclick = async () => {
    const ad = $('#dsAd').value.trim();
    if (!ad) return bildir('Ders adı girin.', 'hata');
    if (!secili.size) return bildir('En az bir öğrenci seçin.', 'hata');
    if (!egitmenId) return bildir('Eğitmen seçin.', 'hata');
    if (!studyoId) return bildir('Stüdyo seçin.', 'hata');
    saat = saatNormal(saat);
    const bitis = saatEkleDk(saat, sureDk);
    const cak = dersCakismaVar({ egitmenId, studyoId, tarih, saat, bitis, haricId: mevcut ? mevcut.id : null });
    if (cak) {
      const cd = cak.ders; const kim = cak.tip === 'egitmen' ? 'Bu eğitmenin' : ('“' + studyoAd(studyoId) + '” stüdyosunun');
      return bildir(`${kim} bu saatte dersi var (${cd.saat}–${dersBitis(cd)}). Başka saat/stüdyo seçin.`, 'hata');
    }
    if (mevcut) {
      const veri = { dersAd: ad, egitmenId, ogrenciIds: Array.from(secili), tarih, saat, bitis, studyoId };   // durum & düşümler korunur
      await DB.guncelle('dersler', mevcut.id, veri); Object.assign(mevcut, veri);
      modalKapat(); bildir('Ders güncellendi.', 'basari'); SAYFALAR['dersler']();
    } else {
      const veri = { dersAd: ad, egitmenId, ogrenciIds: Array.from(secili), tarih, saat, bitis, studyoId, durum: 'bekliyor', dusumler: [] };
      const y = await DB.ekle('dersler', veri); State.dersler.push(y);
      modalKapat(); dersAktifSekme = 'bekliyor'; bildir('Ders planlandı.', 'basari'); SAYFALAR['dersler']();
    }
  };
}

/* Katman: form modalının üzerine yüzen seçici (takvim/saat) */
function pickerKatman(icHTML) {
  const kap = document.createElement('div');
  kap.className = 'picker-perde';
  kap.innerHTML = icHTML;
  document.body.appendChild(kap);
  kap.addEventListener('pointerdown', (e) => { if (e.target === kap) kap.remove(); });
  return kap;
}
/* Uygulamaya özel takvim */
function tarihSecici(mevcutISO, cb) {
  const bug = bugunISO();
  let [gy, gm] = (mevcutISO || bug).split('-').map(Number);   // gm 1-12
  let secili = mevcutISO || bug;
  const kap = pickerKatman('<div class="tsz" id="tszKutu"></div>');
  const kutu = kap.querySelector('#tszKutu');
  const ciz = () => {
    const y = gy, m = gm - 1;
    const ofset = (new Date(y, m, 1).getDay() + 6) % 7;
    const gunSay = new Date(y, m + 1, 0).getDate();
    let hucreler = '';
    for (let i = 0; i < ofset; i++) hucreler += '<span class="tsz-t bos"></span>';
    for (let d = 1; d <= gunSay; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cls = ['tsz-t'];
      if (iso === bug) cls.push('bugun');
      if (iso < bug) cls.push('gecmis');
      if (iso === secili) cls.push('sec');
      hucreler += `<span class="${cls.join(' ')}" data-iso="${iso}">${d}</span>`;
    }
    kutu.innerHTML = `
      <div class="tsz-head">Tarih Seç</div>
      <div class="tsz-ay"><button type="button" class="tsz-nav" data-yon="-1">‹</button><span class="tsz-ad">${AY_TAM[m]} ${y}</span><button type="button" class="tsz-nav" data-yon="1">›</button></div>
      <div class="tsz-grid">${['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(g => `<span class="tsz-gun">${g}</span>`).join('')}${hucreler}</div>
      <div class="tsz-foot"><button type="button" class="picker-iptal" id="tszIptal">İptal</button><button type="button" class="picker-tamam" id="tszTamam">Tamam</button></div>`;
    kutu.querySelectorAll('[data-yon]').forEach(b => b.onclick = () => { gm += Number(b.dataset.yon); if (gm < 1) { gm = 12; gy--; } if (gm > 12) { gm = 1; gy++; } ciz(); });
    kutu.querySelectorAll('[data-iso]').forEach(b => b.onclick = () => { secili = b.dataset.iso; ciz(); });
    kutu.querySelector('#tszIptal').onclick = () => kap.remove();
    kutu.querySelector('#tszTamam').onclick = () => { kap.remove(); cb(secili); };
  };
  ciz();
}
/* Uygulamaya özel saat tekerleği */
function kurWheel(wrap, values, secili, degisti) {
  const OY = 40;
  wrap.innerHTML = `<div class="wsel-band"></div><div class="wsel"><div class="wsel-liste">${values.map(v => `<div class="wsel-oge" data-v="${v}">${v}</div>`).join('')}</div></div>`;
  const scroll = wrap.querySelector('.wsel');
  let idx = Math.max(0, values.indexOf(secili));
  const ogeler = () => Array.from(wrap.querySelectorAll('.wsel-oge'));
  const isaretle = () => ogeler().forEach((e, i) => e.classList.toggle('on', i === idx));
  const merkezle = (i, smooth) => scroll.scrollTo({ top: i * OY, behavior: smooth ? 'smooth' : 'auto' });
  isaretle();
  setTimeout(() => merkezle(idx, false), 0);
  let zaman;
  scroll.addEventListener('scroll', () => {
    clearTimeout(zaman);
    zaman = setTimeout(() => {
      const yeni = Math.max(0, Math.min(values.length - 1, Math.round(scroll.scrollTop / OY)));
      if (yeni !== idx) { idx = yeni; isaretle(); if (degisti) degisti(values[idx]); }
    }, 80);
  });
  ogeler().forEach((e, i) => e.onclick = () => { idx = i; isaretle(); if (degisti) degisti(values[i]); merkezle(i, true); });
  return { get: () => values[idx] };
}
function saatSecici(mevcut, cb, dolu) {
  const [sh, sd] = (mevcut || '10:00').split(':');
  const saatler = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const dklar = ['00', '15', '30', '45'];
  // Dolu aralık bilgisi (opsiyonel): [{bas,bit}] → başlıkta özet
  const doluHTML = (Array.isArray(dolu) && dolu.length)
    ? `<div class="ssz-dolu">${ik('uyari')}<span>Dolu: ${dolu.map(d => `${d.bas}–${d.bit}`).join(' · ')}</span></div>`
    : '';
  const kap = pickerKatman(`
    <div class="ssz">
      <div class="ssz-head">Saat Seç</div><div class="ssz-sub">Kaydırarak saat ve dakikayı seç</div>
      ${doluHTML}
      <div class="ssz-wheels"><div class="wsel-wrap" id="wSaat"></div><span class="ssz-kolon">:</span><div class="wsel-wrap" id="wDk"></div></div>
      <div class="ssz-kk"><span>Saat</span><span></span><span>Dakika</span></div>
      <div class="tsz-foot"><button type="button" class="picker-iptal" id="sszIptal">İptal</button><button type="button" class="picker-tamam" id="sszTamam">Tamam</button></div>
    </div>`);
  const wSaat = kurWheel(kap.querySelector('#wSaat'), saatler, saatler.includes(sh) ? sh : '10', null);
  const wDk = kurWheel(kap.querySelector('#wDk'), dklar, dklar.includes(sd) ? sd : '00', null);
  kap.querySelector('#sszIptal').onclick = () => kap.remove();
  kap.querySelector('#sszTamam').onclick = () => { kap.remove(); cb(`${wSaat.get()}:${wDk.get()}`); };
}

/* ==========================================================
   Ödemeler (müşteri tahsilatları — kalan borçtan FIFO düşer)
   ========================================================== */
const ODEME_TURLERI = { havale: ik('banka') + ' Havale', nakit: ik('kasa') + ' Nakit', kart: ik('kart') + ' Kredi Kartı' };

SAYFALAR['odemeler'] = function () {
  const odKapsam = (od) => { if (hepsiniGor()) return true; const o = State.ogrenciler.find(x => x.id === od.ogrenciId); return !!(o && o.egitmenId === benId()); };
  const kayitlar = (State.odemeler || []).filter(odKapsam).slice().sort((a, b) => (b.tarih + (b.olusturma || '')).localeCompare(a.tarih + (a.olusturma || '')));
  const turSinif = { nakit: 'nakit', kart: 'kart', havale: 'havale' };
  // Kalan Borcu = ödeme yapıldığı ANDAKİ kalan borç (kaydedilmiş anlık görüntü).
  // Eski kayıtlarda alan yoksa: mevcut borç + bu ödemeden sonraki (aynı öğrenci) ödemeler ile geriye dönük hesapla.
  const anahtar = (x) => (x.tarih || '') + (x.olusturma || '');
  const borcSonrasi = (od) => {
    if (typeof od.kalanBorc === 'number') return od.kalanBorc;
    const o = State.ogrenciler.find(x => x.id === od.ogrenciId);
    const guncel = o ? ogrenciMetrik(o).kalanOdeme : 0;
    const sonra = (State.odemeler || []).filter(x => x.ogrenciId === od.ogrenciId && anahtar(x) > anahtar(od))
      .reduce((s, x) => s + (Number(x.tutar) || 0), 0);
    return guncel + sonra;
  };
  const satir = (od) => {
    const o = State.ogrenciler.find(x => x.id === od.ogrenciId);
    const e = o ? State.ortaklar.find(x => x.id === o.egitmenId) : null;
    const kb = borcSonrasi(od);
    return `<tr>
      <td data-l="Öğrenci"><span class="ogr-kisi"><span class="ogr-av">${basHarf(o ? o.ad : '?', o ? o.soyad : '')}</span><span class="ogr-ad">${o ? kacar(ogrenciTamAd(o)) : '—'}</span></span></td>
      <td data-l="Eğitmeni"><span class="ogr-egit">${egitmenAv(e ? e.id : null, 'ogr-ea')}${e ? kacar(egitmenKisaAd(e)) : '—'}</span></td>
      <td data-l="Ödediği Tarih">${fmtTarihUzun(od.tarih)}</td>
      <td data-l="Ödeme Türü"><span class="od-tur ${turSinif[od.tur] || 'nakit'}">${ODEME_TURLERI[od.tur] || od.tur}</span></td>
      <td data-l="Ödediği Tutar" class="sag od-tutar">${binlik(od.tutar)} ₺</td>
      <td data-l="Kalan Borcu" class="sag ${kb > 0 ? 'od-borc' : 'od-borc ok'}">${kb > 0 ? binlik(kb) + ' ₺' : 'Borç yok'}</td>
      <td class="sag"><span class="ogr-arac"><button type="button" data-odsil="${od.id}" title="Sil">🗑️</button></span></td>
    </tr>`;
  };
  ic().innerHTML = `
    <div class="odeme-sayfa">
      <div class="ogr-ust">
        <div class="od-baslik">Tahsilat Kayıtları</div>
        <div class="ogr-ust-sag">${ortakGosterBtnHTML()}<button type="button" class="gp-ekle" id="odemeAlBtn">＋ Tahsilat Al</button></div>
      </div>
      ${kayitlar.length
        ? `<div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo ogr-genis">
            <colgroup><col style="width:19%"><col style="width:15%"><col style="width:15%"><col style="width:13%"><col style="width:14%"><col style="width:14%"><col style="width:10%"></colgroup>
            <thead><tr><th>Öğrenci</th><th>Eğitmeni</th><th>Ödediği Tarih</th><th>Ödeme Türü</th><th class="sag">Ödediği Tutar</th><th class="sag">Kalan Borcu</th><th></th></tr></thead>
            <tbody>${kayitlar.map(satir).join('')}</tbody></table></div></div>`
        : `<div class="gp-bos">Henüz ödeme yok. “＋ Ödeme Al” ile ilk ödemeyi işleyin.</div>`}
    </div>`;
  $('#odemeAlBtn').onclick = () => odemeAlModal();
  ortakGosterBtnBagla(() => SAYFALAR['odemeler']());
  $$('[data-odsil]').forEach(b => b.onclick = () => onayModal('Ödeme silinsin mi?', 'Bu tutar öğrencinin borcuna geri eklenir.', async () => {
    const od = State.odemeler.find(x => x.id === b.dataset.odsil); if (od) await odemeGeriAl(od);
    bildir('Ödeme silindi.', 'basari'); SAYFALAR['odemeler']();
  }));
};

/* Ödemeyi öğrencinin en eski borcundan (FIFO) düş */
function odemeDusumUygula(o, tutar) {
  const dusumler = [];
  let kalan = Number(tutar) || 0;
  const paketler = (o.paketler || []).slice().sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')));
  for (const p of paketler) {
    if (kalan <= 0) break;
    const borc = Number(p.kalanOdeme) || 0;
    if (borc <= 0) continue;
    const ode = Math.min(kalan, borc);
    p.kalanOdeme = borc - ode; kalan -= ode;
    dusumler.push({ paketId: p.id, tutar: ode });
  }
  return dusumler;   // fazla ödeme (kalan) yok sayılır
}
async function odemeGeriAl(od) {
  const o = State.ogrenciler.find(x => x.id === od.ogrenciId);
  if (o) {
    for (const d of (od.dusumler || [])) {
      const p = (o.paketler || []).find(x => x.id === d.paketId);
      if (p) p.kalanOdeme = (Number(p.kalanOdeme) || 0) + (Number(d.tutar) || 0);
    }
    await DB.guncelle('ogrenciler', o.id, { paketler: o.paketler });
  }
  // Bu gelire bağlı otomatik "Banka Komisyonu" giderini de sil
  const koms = (State.giderKayitlari || []).filter(g => g.kaynakOdemeId === od.id);
  for (const k of koms) { await DB.sil('giderKayitlari', k.id); }
  if (koms.length) State.giderKayitlari = State.giderKayitlari.filter(g => g.kaynakOdemeId !== od.id);
  await DB.sil('odemeler', od.id);
  State.odemeler = State.odemeler.filter(x => x.id !== od.id);
}

/* ==========================================================
   HESAPLAR — Banka / Nakit / Kart hesap defterleri
   ========================================================== */
let hesapAktif = 'banka';   // banka | nakit | kart
let hesapArama = '';
const HESAP_TANIM = {
  banka: { ad: 'Banka', ik: ik('banka'), tahsil: ['havale', 'kart'], gider: 'banka', cls: 'hs-banka' },   // Kredi Kartı geliri bankaya düşer
  nakit: { ad: 'Nakit', ik: ik('kasa'), tahsil: ['nakit'],          gider: 'nakit', cls: 'hs-nakit' },
  kart:  { ad: 'Kart',  ik: ik('kart'), tahsil: [],                 gider: 'kart',  cls: 'hs-kart' },
};
const HS_TUR_AD = { havale: 'Havale', kart: 'Kredi Kartı', nakit: 'Nakit' };
/* Ödenmemiş kredi kartı borcu (kart giderleri − kart borç ödemeleri) */
function kartBorcu() {
  const gid = State.giderKayitlari || [];
  const borc = gid.filter(g => (g.odemeSekli || 'nakit') === 'kart' && !g.kkOdeme).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  const odenen = gid.filter(g => g.kkOdeme).reduce((s, g) => s + (Number(g.tutar) || 0), 0);
  return Math.max(0, borc - odenen);
}
/* Bir hesabın hareketleri (kronolojik artan + işleyen bakiye) */
function hesapHareketleri(hesap) {
  const t = HESAP_TANIM[hesap];
  const har = [];
  // Gelir → Açıklama = ödeme türü (Havale/Kredi Kartı/Nakit), alt satır = paket - öğrenci; İlgili Ortak = eğitmen
  (State.odemeler || []).filter(o => t.tahsil.includes(o.tur || 'nakit')).forEach(o => {
    const og = State.ogrenciler.find(x => x.id === o.ogrenciId);
    const eg = State.ortaklar.find(x => x.id === (o.ortakId || (og ? og.egitmenId : null)));   // ait-kişi override öncelikli
    const pk = (og && og.paketler && og.paketler[0]) ? og.paketler[0].paketAd : '';
    const paketOgr = [pk, og ? ogrenciTamAd(og) : ''].filter(Boolean).join(' - ');
    har.push({ tip: 'tahsilat', tarih: o.tarih, ilgiliId: eg ? eg.id : null, ilgiliAd: eg ? egitmenKisaAd(eg) : '—', aciklama: o.aciklama || HS_TUR_AD[o.tur || 'nakit'] || 'Gelir', altYazi: paketOgr, altTip: 'ogr', tutar: Number(o.tutar) || 0, ref: o });
  });
  (State.giderKayitlari || []).filter(g => (g.odemeSekli || 'nakit') === t.gider).forEach(g => {
    if (g.kkOdeme) {   // Kredi Kartı Borç Ödemesi (Banka'da gider)
      har.push({ tip: 'gider', tarih: g.tarih, ilgiliId: null, ilgiliAd: 'Tüm ortaklar', aciklama: '', altYazi: 'Kredi Kartı Borç Ödemesi', altTip: 'gr', tutar: -(Number(g.tutar) || 0), ref: g });
    } else if (g.kaynakOdemeId) {   // otomatik Banka Komisyonu → kaynak gelirden paket-öğrenci + eğitmen
      const src = (State.odemeler || []).find(o => o.id === g.kaynakOdemeId);
      const og = src ? State.ogrenciler.find(x => x.id === src.ogrenciId) : null;
      const eg = og ? State.ortaklar.find(x => x.id === og.egitmenId) : null;
      const pk = (og && og.paketler && og.paketler[0]) ? og.paketler[0].paketAd : '';
      const paketOgr = [pk, og ? ogrenciTamAd(og) : ''].filter(Boolean).join(' - ');
      har.push({ tip: 'gider', tarih: g.tarih, ilgiliId: eg ? eg.id : null, ilgiliAd: eg ? egitmenKisaAd(eg) : '—', aciklama: paketOgr, altYazi: g.giderAd || 'Banka Komisyonu', altTip: 'gr', tutar: -(Number(g.tutar) || 0), ref: g });
    } else {
      const ort = g.ortakId ? State.ortaklar.find(x => x.id === g.ortakId) : null;
      har.push({ tip: 'gider', tarih: g.tarih, ilgiliId: g.ortakId || null, ilgiliAd: ort ? egitmenKisaAd(ort) : 'Tüm ortaklar', aciklama: g.aciklama || '', altYazi: g.giderAd || g.grupAd || '', altTip: 'gr', tutar: -(Number(g.tutar) || 0), ref: g });
    }
  });
  if (hesap === 'kart') {   // kredi kartı borç ödemeleri: kartta POZİTİF (borcu azaltır)
    (State.giderKayitlari || []).filter(g => g.kkOdeme).forEach(g => {
      har.push({ tip: 'kartode', tarih: g.tarih, ilgiliId: null, ilgiliAd: 'Tüm ortaklar', aciklama: '', altYazi: 'Kredi Kartı Borç Ödemesi', altTip: 'gr', tutar: Number(g.tutar) || 0, ref: g });
    });
  }
  har.sort((a, b) => (a.tarih || '').localeCompare(b.tarih || '') || ((a.ref.olusturma || '').localeCompare(b.ref.olusturma || '')));
  let bak = 0; har.forEach(h => { bak += h.tutar; h.bakiye = bak; });
  return har;
}
const HS_PILL_AD = { tahsilat: 'Gelir', gider: 'Gider', kartode: 'Kart Ödemesi' };
const HS_PILL_CLS = { tahsilat: 'gelir', gider: 'gider', kartode: 'ode' };
function hesapSayfayiYenile() { SAYFALAR['hesap-defter'](); }
SAYFALAR['hesap-defter'] = function () {
  const veri = { banka: hesapHareketleri('banka'), nakit: hesapHareketleri('nakit'), kart: hesapHareketleri('kart') };
  const bakiye = (k) => veri[k].length ? veri[k][veri[k].length - 1].bakiye : 0;
  const tumList = veri[hesapAktif].slice().reverse();   // en yeni üstte
  const satir = (h) => {
    const rtip = h.tip === 'tahsilat' ? 'tahsilat' : 'gider';   // düzenle/sil yönlendirmesi
    const alt = h.altYazi ? `<div class="hs-alt ${h.altTip}">${h.altTip === 'ogr' ? ik('ogrenci','uik-mini') : ik('grup','uik-mini')}${kacar(h.altYazi)}</div>` : '';
    const ortHucre = h.ilgiliId ? `<span class="ogr-egit">${egitmenAv(h.ilgiliId, 'ogr-ea')}${kacar(h.ilgiliAd)}</span>` : `<span class="gid-tum">${ik('kisi','uik-mini')}${kacar(h.ilgiliAd)}</span>`;
    const ana = h.aciklama ? (h.tip === 'tahsilat' ? `<span class="hs-tur">${kacar(h.aciklama)}</span>` : kacar(h.aciklama)) : '<span class="ogr-soluk">—</span>';
    return `<tr>
      <td data-l="Tarih">${fmtTarihUzun(h.tarih)}</td>
      <td data-l="İşlem Adı"><span class="isl-tur ${HS_PILL_CLS[h.tip]}">${HS_PILL_AD[h.tip]}</span></td>
      <td data-l="Açıklama">${ana}${alt}</td>
      <td data-l="İlgili Ortak">${ortHucre}</td>
      <td data-l="Tutar" class="sag"><span class="hs-art ${h.tutar >= 0 ? 'a' : 'e'}">${h.tutar >= 0 ? '+' : '−'}${binlik(Math.abs(h.tutar))} ₺</span></td>
      <td data-l="Güncel Bakiye" class="sag"><span class="hs-bak">${binlik(h.bakiye)} ₺</span></td>
      <td class="sag"><button type="button" class="duz-btn" data-hduz="${h.ref.id}" data-htip="${rtip}">${ik('kalem')} Düzenle</button></td>
    </tr>`;
  };
  const eslesir = (h, q) => { if (!q) return true; return [fmtTarihUzun(h.tarih), HS_PILL_AD[h.tip], h.aciklama, h.altYazi, h.ilgiliAd, binlik(Math.abs(h.tutar)), binlik(h.bakiye)].join(' ').toLocaleLowerCase('tr').includes(q); };
  const govdeCiz = () => {
    const q = (hesapArama || '').trim().toLocaleLowerCase('tr');
    const list = tumList.filter(h => eslesir(h, q));
    return list.length ? list.map(satir).join('') : `<tr><td colspan="7"><div class="gp-bos" style="margin:6px 4px">Eşleşen hareket yok.</div></td></tr>`;
  };
  ic().innerHTML = `
    <div class="odeme-sayfa">
      <div class="ogr-ust hesap-ust">
        <div class="ogr-seg hesap-seg">
          ${['banka', 'nakit', 'kart'].map(k => `<button type="button" class="${HESAP_TANIM[k].cls} ${k === hesapAktif ? 'sec' : ''}" data-hs="${k}">${HESAP_TANIM[k].ik} ${HESAP_TANIM[k].ad} <span class="rk">${binlik(bakiye(k))} ₺</span></button>`).join('')}
        </div>
        <div class="ogr-ust-sag"><button type="button" class="gp-ekle" id="hsIslem">${ik('para')} İşlem Yap</button></div>
      </div>
      <div class="hesap-ara"><div class="uys-ara" style="margin:0"><span class="ara-ik">${ik('ara')}</span><input type="text" id="hsAra" placeholder="Tabloda ara… (tarih, işlem, açıklama, ilgili ortak, tutar)" value="${kacar(hesapArama)}" autocomplete="off" autocorrect="off" spellcheck="false"></div></div>
      ${tumList.length
      ? `<div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo ogr-genis hs-ledger">
          <colgroup><col style="width:12%"><col style="width:11%"><col style="width:22%"><col style="width:17%"><col style="width:12%"><col style="width:15%"><col style="width:11%"></colgroup>
          <thead><tr><th>Tarih</th><th>İşlem Adı</th><th>Açıklama</th><th>İlgili Ortak</th><th class="sag">Tutar</th><th class="sag">Güncel Bakiye</th><th></th></tr></thead>
          <tbody id="hsTbody">${govdeCiz()}</tbody></table></div></div>`
      : `<div class="gp-bos">Bu hesapta hareket yok. “＋ Gelir Ekle” veya “＋ Gider Ekle” ile başlayın.</div>`}
    </div>`;
  const rowBagla = () => {
    $$('[data-hduz]').forEach(b => b.onclick = () => {
      if (b.dataset.htip === 'tahsilat') { const od = State.odemeler.find(x => x.id === b.dataset.hduz); if (od) islemYapModal({ tip: 'gelir', mevcut: od }); }
      else { const g = State.giderKayitlari.find(x => x.id === b.dataset.hduz); if (g) { if (g.otoKomisyon || g.kkOdeme) giderKayitFormu(g); else islemYapModal({ tip: 'gider', mevcut: g }); } }
    });
    $$('[data-hsil]').forEach(b => b.onclick = () => {
      if (b.dataset.htip === 'tahsilat') onayModal('Gelir silinsin mi?', 'Bu tutar öğrencinin borcuna geri eklenir.', async () => {
        const od = State.odemeler.find(x => x.id === b.dataset.hsil); if (od) await odemeGeriAl(od);
        bildir('Kayıt silindi.', 'basari'); hesapSayfayiYenile();
      });
      else onayModal('Gider silinsin mi?', 'Bu kayıt silinecek.', async () => {
        await DB.sil('giderKayitlari', b.dataset.hsil); State.giderKayitlari = State.giderKayitlari.filter(x => x.id !== b.dataset.hsil);
        bildir('Gider silindi.', 'basari'); hesapSayfayiYenile();
      });
    });
  };
  $$('[data-hs]').forEach(b => b.onclick = () => { hesapAktif = b.dataset.hs; hesapArama = ''; hesapSayfayiYenile(); });
  $('#hsIslem').onclick = () => islemYapModal();
  const ara = $('#hsAra');
  if (ara) ara.addEventListener('input', () => { hesapArama = ara.value; const tb = $('#hsTbody'); if (tb) { tb.innerHTML = govdeCiz(); rowBagla(); } });
  rowBagla();
};

/* ==========================================================
   GİDERLER — işletme harcama kayıtları (yalnızca admin)
   ========================================================== */
const ODEME_SEKLI = { banka: ik('banka') + ' Banka', nakit: ik('kasa') + ' Nakit', kart: ik('kart') + ' Kredi Kartı' };
SAYFALAR['giderler'] = function () {
  const kayitlar = (State.giderKayitlari || []).slice().sort((a, b) => (b.tarih + (b.olusturma || '')).localeCompare(a.tarih + (a.olusturma || '')));
  const kisiHucre = (g) => {
    if (!g.ortakId) return `<span class="gid-tum">${ik('kisi', 'uik-mini')}Tüm ortaklar</span>`;
    const o = State.ortaklar.find(x => x.id === g.ortakId);
    return `<span class="gid-kisi">${egitmenAv(g.ortakId, 'ogr-ea')}${kacar(o ? egitmenKisaAd(o) : '—')}</span>`;
  };
  const satir = (g) => `<tr>
      <td data-l="Tarih">${fmtTarihUzun(g.tarih)}</td>
      <td data-l="Gider Grubu">${kacar(g.giderAd || g.grupAd || '—')}</td>
      <td data-l="Açıklama">${g.aciklama ? kacar(g.aciklama) : '<span class="ogr-soluk">—</span>'}</td>
      <td data-l="Ödeme Şekli"><span class="od-tur ${g.odemeSekli || 'nakit'}">${ODEME_SEKLI[g.odemeSekli] || kacar(g.odemeSekli || '')}</span></td>
      <td data-l="Tutar" class="sag gid-tutar">${binlik(g.tutar)} ₺</td>
      <td data-l="Ait Olduğu Kişi">${kisiHucre(g)}</td>
      <td class="sag"><span class="ogr-arac"><button type="button" data-gksil="${g.id}" title="Sil">🗑️</button></span></td>
    </tr>`;
  ic().innerHTML = `
    <div class="odeme-sayfa">
      <div class="ogr-ust">
        <div class="od-baslik">Gider Kayıtları</div>
        <button type="button" class="gp-ekle" id="giderEkleBtn">＋ Gider Ekle</button>
      </div>
      ${kayitlar.length
      ? `<div class="ogr-tkart"><div class="ogr-kaydir"><table class="ogr-tablo">
            <colgroup><col style="width:13%"><col style="width:16%"><col style="width:18%"><col style="width:14%"><col style="width:13%"><col style="width:16%"><col style="width:10%"></colgroup>
            <thead><tr><th>Tarih</th><th>Gider Grubu</th><th>Açıklama</th><th>Ödeme Şekli</th><th class="sag">Tutar</th><th>Ait Olduğu Kişi</th><th></th></tr></thead>
            <tbody>${kayitlar.map(satir).join('')}</tbody></table></div></div>`
      : `<div class="gp-bos">Henüz gider yok. “＋ Gider Ekle” ile ilk gideri işleyin.</div>`}
    </div>`;
  $('#giderEkleBtn').onclick = () => giderKayitFormu();
  $$('[data-gksil]').forEach(b => b.onclick = () => onayModal('Gider silinsin mi?', 'Bu kayıt silinecek.', async () => {
    await DB.sil('giderKayitlari', b.dataset.gksil); State.giderKayitlari = State.giderKayitlari.filter(x => x.id !== b.dataset.gksil);
    bildir('Silindi.', 'basari'); SAYFALAR['giderler']();
  }));
};

function giderKayitFormu(mevcut) {
  // Form durumu tek yerde tutulur; "Gider Seç" ayrı ekrana geçince kaybolmaz
  const st = mevcut
    ? { tarih: mevcut.tarih, secId: mevcut.giderId || (mevcut.kkOdeme ? '__kkode' : null), secAd: mevcut.giderAd, secGrupAd: mevcut.grupAd, aciklama: mevcut.aciklama || '', sekli: mevcut.odemeSekli || 'banka', tutar: mevcut.tutar ? binlik(mevcut.tutar) : '', ortak: mevcut.ortakId || null, mevcutId: mevcut.id, kkOde: !!mevcut.kkOdeme, kaynakOdemeId: mevcut.kaynakOdemeId || null, otoKomisyon: !!mevcut.otoKomisyon }
    : { tarih: bugunISO(), secId: null, secAd: '', secGrupAd: '', aciklama: '', sekli: 'banka', tutar: '', ortak: null, mevcutId: null, kkOde: false, kaynakOdemeId: null, otoKomisyon: false };
  modalAc(mevcut ? 'Gider Düzenle' : 'Yeni Gider', giderFormGovde(st), giderFormAlt(!!mevcut), `<span class="hr-rozet"><span class="hr-rz-ik"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="8" width="17" height="12" rx="2.5" fill="currentColor" opacity=".22"/><rect x="3.5" y="8" width="17" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17" stroke="currentColor" stroke-width="1.6"/><path d="M7 5.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 14.5v3M10.5 16h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>Gider</span>`);
  giderFormBagla(st, false);
}
function giderFormGovde(st) {
  const ortakChip = (o) => `<span class="kisi-chip ${(o && st.ortak === o.id) || (!o && !st.ortak) ? 'sec' : ''}" data-ortk="${o ? o.id : ''}">${o ? kacar(egitmenKisaAd(o)) : ik('ortaklar') + ' Tüm ortaklar'}</span>`;
  return `<div class="gd-flow gd-flow-form gd-kompakt">
    <div class="gp-alan"><label>Tarih</label><button type="button" class="pa-trig" id="gkTarih"><span id="gkTarihAd">${fmtTarihUzun(st.tarih)}</span><span class="ok">${ik('dersler')}</span></button></div>
    <div class="gp-alan"><label>Gider Grubu</label>
      <button type="button" class="gd-trig${(st.otoKomisyon || st.kkOde) ? ' gd-kilit' : ''}" id="gkTrig"><span id="gkSecAd" class="${(st.secId || st.otoKomisyon || st.kkOde) ? '' : 'gd-soluk'}">${(st.secId || st.otoKomisyon || st.kkOde) ? kacar(st.secAd) : 'Gider seç…'}</span>${(st.otoKomisyon || st.kkOde) ? '' : '<span class="ok">›</span>'}</button>
    </div>
    <div class="gp-alan"><label>Açıklama</label><input type="text" class="gp-inp" id="gkAciklama" value="${kacar(st.aciklama)}" placeholder="Örn. Ağustos stüdyo kirası" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="gp-alan"><label>Ödeme Şekli</label>
      <div class="ods-seg" id="gkSekli">${['banka', 'nakit', 'kart'].map(k => `<button type="button" class="${st.sekli === k ? 'sec' : ''}" data-sek="${k}">${ODEME_SEKLI[k]}</button>`).join('')}</div>
    </div>
    <div class="gp-alan"><label>Tutar</label><input type="text" class="gp-inp" id="gkTutar" value="${kacar(st.tutar)}" inputmode="numeric" placeholder="0 ₺" style="font-weight:700" autocomplete="off"></div>
    <div class="gp-alan" style="margin:0"><label>Giderin Ait Olduğu Kişi</label>
      <div class="kisi-sat" id="gkKisi">${ortakChip(null)}${State.ortaklar.filter(o => o.aktif !== false).map(ortakChip).join('')}</div>
    </div>
  </div>`;
}
function giderFormAlt(edit) { return `${edit ? `<button class="btn btn-kirmizi" id="gkSil" style="margin-right:auto">${ik('cop')} Sil</button>` : ''}<button class="btn" id="gkIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="gkKaydet">${ik('kaydet')} Kaydet</button>`; }
function giderFormBagla(st, geri) {
  if (geri) { const f = $('.gd-flow-form'); if (f) f.classList.add('gd-geri'); }
  const oku = () => { st.aciklama = $('#gkAciklama').value; st.tutar = $('#gkTutar').value; };
  $('#gkTarih').onclick = () => tarihSecici(st.tarih, (iso) => { st.tarih = iso; $('#gkTarihAd').textContent = fmtTarihUzun(iso); });
  $('#gkTrig').onclick = () => { if (st.otoKomisyon || st.kkOde) return; oku(); giderSecAc(st); };   // komisyon/kart ödemesi grubu kilitli
  $('#gkSekli').onclick = (e) => { const b = e.target.closest('[data-sek]'); if (!b) return; st.sekli = b.dataset.sek; $$('#gkSekli button').forEach(x => x.classList.toggle('sec', x === b)); };
  $('#gkKisi').onclick = (e) => { const c = e.target.closest('[data-ortk]'); if (!c) return; st.ortak = c.dataset.ortk || null; $$('#gkKisi .kisi-chip').forEach(x => x.classList.toggle('sec', x === c)); };
  tutarKutusuBagla($('#gkTutar'));
  // Otomatik Banka Komisyonu: yalnızca Tutar değiştirilebilir, diğer alanlar kilitli
  if (st.otoKomisyon) {
    ['gkTarih', 'gkAciklama', 'gkSekli', 'gkKisi'].forEach(id => { const el = $('#' + id); if (el) { el.style.pointerEvents = 'none'; el.style.opacity = '.6'; } });
    const ac = $('#gkAciklama'); if (ac) ac.setAttribute('readonly', '');
    setTimeout(() => { const tt = $('#gkTutar'); if (tt) { tt.focus(); if (tt.select) tt.select(); } }, 60);
  }
  $('#gkAciklama').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#gkTutar').focus(); } });
  $('#gkTutar').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#gkKaydet').click(); } });
  $('#gkIptal').onclick = modalKapat;
  { const sb = $('#gkSil'); if (sb && st.mevcutId) sb.onclick = () => onayModal('Gider silinsin mi?', 'Bu kayıt silinecek.', async () => {
    await DB.sil('giderKayitlari', st.mevcutId); State.giderKayitlari = State.giderKayitlari.filter(x => x.id !== st.mevcutId);
    modalKapat(); bildir('Gider silindi.', 'basari'); git(State.aktifSayfa);
  }); }
  $('#gkKaydet').onclick = async () => {
    oku();
    if (!st.secId && !st.kkOde && !st.otoKomisyon) return bildir('Gider grubu seçin.', 'hata');
    const tutar = tutarSayi(st.tutar);
    if (tutar <= 0 && !st.otoKomisyon) return bildir('Tutar girin.', 'hata');   // komisyon boş kalabilir
    const kayit = st.kkOde
      ? { tarih: st.tarih, giderId: null, giderAd: 'Kredi Kartı Borç Ödemesi', grupAd: '', aciklama: (st.aciklama || '').trim(), odemeSekli: 'banka', tutar, ortakId: null, kkOdeme: true }
      : { tarih: st.tarih, giderId: st.secId, giderAd: st.secAd, grupAd: st.secGrupAd, aciklama: (st.aciklama || '').trim(), odemeSekli: st.sekli, tutar, ortakId: st.ortak || null, kaynakOdemeId: st.kaynakOdemeId || null, otoKomisyon: st.otoKomisyon || false };
    if (st.mevcutId) {
      await DB.guncelle('giderKayitlari', st.mevcutId, kayit);
      const idx = State.giderKayitlari.findIndex(x => x.id === st.mevcutId); if (idx >= 0) Object.assign(State.giderKayitlari[idx], kayit);
      bildir('Gider güncellendi.', 'basari');
    } else {
      kayit.olusturma = new Date().toISOString();
      const y = await DB.ekle('giderKayitlari', kayit); State.giderKayitlari.push(y);
      bildir('Gider kaydedildi.', 'basari');
    }
    modalKapat(); git(State.aktifSayfa);
  };
}
function giderSecListe(st, filtre) {
  const gruplar = State.giderGruplari, giderler = State.giderler;
  const f = (filtre || '').toLocaleLowerCase('tr');
  const uy = (it) => !f || (it.ad || '').toLocaleLowerCase('tr').includes(f);
  const kalem = (it) => `<div class="gs-oge ${st.secId === it.id ? 'sec' : ''}" data-gk="${it.id}"><span class="gs-nokta"></span>${kacar(it.ad)}${st.secId === it.id ? '<span class="tik">✓</span>' : ''}</div>`;
  let html = '';
  gruplar.forEach(gr => { const its = giderler.filter(x => x.grupId === gr.id && uy(x)); if (its.length) html += `<div class="gs-grp">📁 ${kacar(gr.ad)}</div>` + its.map(kalem).join(''); });
  const grupsuz = giderler.filter(x => (!x.grupId || !gruplar.some(g => g.id === x.grupId)) && uy(x));
  if (grupsuz.length) html += `<div class="gs-grp">📁 Diğer</div>` + grupsuz.map(kalem).join('');
  return html || '<div class="gd-bos">Sonuç yok. “Tanımlamalar › Giderler”den ekleyebilirsin.</div>';
}
// Kutuyu yeniden yaratmadan yalnızca içerik değişir → boyut sabit kalır, geçiş animasyonlu
function giderSecAc(st) {
  const u = $('#modalKap .modal-ust h3'); if (u) u.textContent = 'Gider Seç';
  const borc = kartBorcu();
  const kkodeHTML = borc > 0 ? `<div class="gs-kkode" id="gsKkode"><span class="l">💳 Kredi Kartı Borcunu Öde</span><span class="borc">${binlik(borc)} ₺</span></div>` : '';
  $('#modalKap .modal-govde').innerHTML = `<div class="gd-flow gd-flow-sec gd-anim">
      <div class="gs-ara"><span class="gs-ara-ik">${ik('ara')}</span><input type="text" id="gsAra" placeholder="Gider ara…" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      ${kkodeHTML}
      <button type="button" class="gs-yeni" id="gsYeni">${ik('yeni')} Yeni Gider Ekle</button>
      <div class="gs-liste" id="gsListe">${giderSecListe(st, '')}</div></div>`;
  $('#modalKap .modal-alt').innerHTML = `<button class="btn gs-geri-btn" id="gsGeri">‹ Gider Ekle</button>`;
  $('#gsGeri').onclick = () => giderFormAc(st);
  $('#gsYeni').onclick = () => yeniGiderKalemiModal((it, grupAd) => { st.secId = it.id; st.secAd = it.ad; st.kkOde = false; st.secGrupAd = grupAd; giderFormAc(st); });
  { const kk = $('#gsKkode'); if (kk) kk.onclick = () => {
    st.secId = '__kkode'; st.secAd = 'Kredi Kartı Borç Ödemesi'; st.secGrupAd = ''; st.kkOde = true; st.sekli = 'banka'; st.ortak = null; st.tutar = binlik(borc);
    giderFormAc(st);
  }; }
  $('#gsAra').addEventListener('input', () => { $('#gsListe').innerHTML = giderSecListe(st, $('#gsAra').value); });
  $('#gsListe').onclick = (e) => {
    const o = e.target.closest('[data-gk]'); if (!o) return;
    const it = State.giderler.find(x => x.id === o.dataset.gk); if (!it) return;
    st.secId = it.id; st.secAd = it.ad; st.kkOde = false; const gr = State.giderGruplari.find(g => g.id === it.grupId); st.secGrupAd = gr ? gr.ad : '';
    giderFormAc(st);
  };
  setTimeout(() => { const a = $('#gsAra'); if (a) a.focus(); }, 60);
}
function giderFormAc(st) {
  const u = $('#modalKap .modal-ust h3'); if (u) u.textContent = 'Yeni Gider';
  $('#modalKap .modal-govde').innerHTML = giderFormGovde(st);
  $('#modalKap .modal-alt').innerHTML = giderFormAlt();
  giderFormBagla(st, true);
}

/* Gider grubu seç (üst-kat, aramalı, tek dokunuşla seçer) */
function giderGrupSecModal(onSec) {
  const gruplar = State.giderGruplari || [], giderler = State.giderler || [];
  const liste = (f) => {
    f = (f || '').toLocaleLowerCase('tr');
    const uy = (it) => !f || (it.ad || '').toLocaleLowerCase('tr').includes(f);
    const kalem = (it) => `<div class="ds-osat" data-gk="${it.id}"><span class="ds-obil"><span class="ad">${kacar(it.ad)}</span></span><span class="uys-ok">›</span></div>`;
    let html = '';
    gruplar.forEach(gr => { const its = giderler.filter(x => x.grupId === gr.id && uy(x)); if (its.length) html += `<div class="gs-grp">${ik('grup', 'uik-mini')} ${kacar(gr.ad)}</div>` + its.map(kalem).join(''); });
    const grupsuz = giderler.filter(x => (!x.grupId || !gruplar.some(g => g.id === x.grupId)) && uy(x));
    if (grupsuz.length) html += `<div class="gs-grp">${ik('grup', 'uik-mini')} Diğer</div>` + grupsuz.map(kalem).join('');
    return html || '<div class="gp-bos" style="margin:8px 6px">Sonuç yok. “Tanımlamalar › Giderler”den ekleyebilirsin.</div>';
  };
  const govde = `<div class="uys-ara"><span class="ara-ik">${ik('ara')}</span><input type="text" id="ggAra" placeholder="Gider ara…" autocomplete="off"></div>
    <button type="button" class="gs-yeni" id="ggYeni">${ik('yeni')} Yeni Gider Ekle</button>
    <div class="ds-oliste sec-liste-kaydir" id="ggListe">${liste('')}</div>`;
  const m = ustKatModal('Gider Seç', `<span class="hr-rz-ik">${ik('gider')}</span>Gider`, govde, `<button class="btn" type="button" data-geri style="flex:1">‹ Geri</button>`);
  const bind = () => m.qq('#ggListe [data-gk]').forEach(el => el.onclick = () => { const it = State.giderler.find(x => x.id === el.dataset.gk); if (!it) return; const gr = (State.giderGruplari || []).find(g => g.id === it.grupId); onSec(it, gr ? gr.ad : ''); m.kapat(); });
  bind();
  m.q('#ggAra').addEventListener('input', () => { m.q('#ggListe').innerHTML = liste(m.q('#ggAra').value); bind(); });
  m.q('#ggYeni').onclick = () => yeniGiderKalemiModal((it, grupAd) => { onSec(it, grupAd); m.kapat(); });
  m.q('[data-geri]').onclick = m.kapat;
  setTimeout(() => { const a = m.q('#ggAra'); if (a) a.focus(); }, 60);
}

/* Satır-içi "＋ Yeni Gider Ekle" — kalem (+ gerekirse grup) oluşturur, oluşturulanı geri verir */
function yeniGiderKalemiModal(onSec) {
  let grupId = null, yeniGrupAcik = false;
  const gruplar = () => State.giderGruplari || [];
  const chip = (id, ad, sec) => `<button type="button" class="tc ${sec ? 'sec' : ''}" data-grp="${id == null ? '' : id}">${kacar(ad)}</button>`;
  const grupSatir = () => `${chip(null, 'Grupsuz', grupId === null && !yeniGrupAcik)}${gruplar().map(g => chip(g.id, g.ad, grupId === g.id)).join('')}<button type="button" class="tc ${yeniGrupAcik ? 'sec' : ''}" data-yenigrup>＋ Yeni Grup</button>`;
  const govde = `
    <div class="gp-alan"><label>Gider Adı</label><input type="text" class="gp-inp" id="ygAd" placeholder="Örn. Temizlik" autocomplete="off" autocorrect="off" spellcheck="false"></div>
    <div class="gp-alan" style="margin:0"><label>Grup</label><div class="turcip" id="ygGrup">${grupSatir()}</div>
      <div class="gp-alan gizli" id="ygYeniSar" style="margin:10px 0 0"><input type="text" class="gp-inp" id="ygYeniAd" placeholder="Yeni grup adı" autocomplete="off"></div>
    </div>`;
  const m = ustKatModal('Yeni Gider Kalemi', `<span class="hr-rz-ik">${ik('gider')}</span>Gider`, govde,
    `<button class="btn" type="button" data-iptal style="flex:1">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" type="button" data-kaydet style="flex:1">${ik('kaydet')} Ekle</button>`);
  const bindGrup = () => {
    m.qq('#ygGrup [data-grp]').forEach(b => b.onclick = () => { grupId = b.dataset.grp || null; yeniGrupAcik = false; m.q('#ygYeniSar').classList.add('gizli'); m.q('#ygGrup').innerHTML = grupSatir(); bindGrup(); });
    const yb = m.q('#ygGrup [data-yenigrup]'); if (yb) yb.onclick = () => { yeniGrupAcik = true; grupId = null; m.q('#ygGrup').innerHTML = grupSatir(); bindGrup(); m.q('#ygYeniSar').classList.remove('gizli'); const i = m.q('#ygYeniAd'); if (i) i.focus(); };
  };
  bindGrup();
  m.q('[data-iptal]').onclick = m.kapat;
  m.q('[data-kaydet]').onclick = async () => {
    const ad = (m.q('#ygAd').value || '').trim(); if (!ad) return bildir('Gider adı girin.', 'hata');
    let gid = grupId, gad = '';
    if (yeniGrupAcik) {
      const gy = (m.q('#ygYeniAd').value || '').trim(); if (!gy) return bildir('Yeni grup adı girin.', 'hata');
      const g = await DB.ekle('giderGruplari', { ad: gy }); State.giderGruplari.push(g); gid = g.id; gad = g.ad;
    } else if (gid) { const g = gruplar().find(x => x.id === gid); gad = g ? g.ad : ''; }
    const y = await DB.ekle('giderler', { ad, grupId: gid || null }); State.giderler.push(y);
    m.kapat(); bildir('Gider kalemi eklendi.', 'basari'); onSec(y, gad);
  };
  setTimeout(() => { const a = m.q('#ygAd'); if (a) a.focus(); }, 60);
}

/* Birleşik "İşlem Yap" modalı — Gelir/Gider geçişli (Hesaplar). opts: {tip:'gelir'|'gider', mevcut} */
function islemYapModal(opts) {
  opts = opts || {};
  const mev = opts.mevcut || null;
  const edit = !!mev;
  let mode = opts.tip || 'gelir';
  // ortak durum
  let tarih = mev ? mev.tarih : bugunISO();
  let tutar = mev ? binlik(Number(mev.tutar) || 0) : '';
  let aciklama = mev ? (mev.aciklama || '') : '';
  let sekli = mev ? (mode === 'gelir' ? (mev.tur || 'havale') : (mev.odemeSekli || 'banka')) : (mode === 'gelir' ? 'havale' : 'banka');
  // gelir
  let ogrId = (mode === 'gelir' && mev) ? mev.ogrenciId : null;
  let gOrtak = (mode === 'gelir' && mev) ? (mev.ortakId || (ogrId ? ogrenciEgitmenId(ogrId) : null)) : null;
  let gOrtakManuel = !!(mev && mode === 'gelir' && mev.ortakId);
  // gider
  let secId = (mode === 'gider' && mev) ? (mev.giderId || null) : null;
  let secAd = (mode === 'gider' && mev) ? (mev.giderAd || '') : '';
  let secGrupAd = (mode === 'gider' && mev) ? (mev.grupAd || '') : '';
  let dOrtak = (mode === 'gider' && mev) ? (mev.ortakId || null) : null;

  const ogrTrigIc = () => {
    if (!ogrId) return `<span class="st-col"><span class="st-ph">Öğrenci seçin</span></span><span class="st-ok">›</span>`;
    const o = State.ogrenciler.find(x => x.id === ogrId); if (!o) return `<span class="st-col"><span class="st-ph">Öğrenci seçin</span></span><span class="st-ok">›</span>`;
    const m = ogrenciMetrik(o); const borc = m.kalanOdeme > 0 ? 'Kalan borç: ' + binlik(m.kalanOdeme) + ' ₺' : 'Borç yok';
    return `<span class="ogr-av sm">${basHarf(o.ad, o.soyad)}</span><span class="st-col"><span class="st-nm">${kacar(ogrenciTamAd(o))}</span><span class="st-sub">${borc}</span></span><span class="st-ok">›</span>`;
  };
  const bodyHTML = () => {
    const gelir = mode === 'gelir';
    const ort = State.ortaklar.filter(o => o.aktif !== false);
    const paySrc = gelir ? ODEME_TURLERI : ODEME_SEKLI;
    const paySeg = Object.entries(paySrc).map(([k, l]) => `<button type="button" class="tc ${sekli === k ? 'sec' : ''}" data-pay="${k}">${l}</button>`).join('');
    const kisiChips = gelir
      ? ort.map(o => `<span class="kisi-chip ${gOrtak === o.id ? 'sec' : ''}" data-iyk="${o.id}">${kacar(egitmenKisaAd(o))}${(ogrId && ogrenciEgitmenId(ogrId) === o.id) ? ' <span class="kc-hint">(eğitmeni)</span>' : ''}</span>`).join('')
      : `<span class="kisi-chip ${!dOrtak ? 'sec' : ''}" data-iyk="">${ik('ortaklar')} Tüm ortaklar</span>` + ort.map(o => `<span class="kisi-chip ${dOrtak === o.id ? 'sec' : ''}" data-iyk="${o.id}">${kacar(egitmenKisaAd(o))}</span>`).join('');
    const secici = gelir
      ? `<div class="gp-alan"><label>Öğrenci (Müşteri)</label><button type="button" class="sec-trig" id="iyOgr">${ogrTrigIc()}</button></div>`
      : `<div class="gp-alan"><label>Gider Grubu</label><button type="button" class="gd-trig" id="iyGider"><span id="iyGiderAd" class="${secId ? '' : 'gd-soluk'}">${secId ? kacar(secAd) : 'Gider seç…'}</span><span class="ok">›</span></button></div>`;
    return `
      <div class="gp-alan"><label>Ödeme Yöntemi</label><div class="turcip" id="iyPay">${paySeg}</div></div>
      <div class="gp-alan"><label>Tarih</label><button type="button" class="pa-trig" id="iyTarih"><span id="iyTarihAd">${fmtTarihUzun(tarih)}</span><span class="ok">${ik('dersler')}</span></button></div>
      ${secici}
      <div class="gp-alan"><label>Açıklama</label><input type="text" class="gp-inp" id="iyAciklama" value="${kacar(aciklama)}" placeholder="${gelir ? 'Örn. Ağustos ödemesi' : 'Örn. Ağustos stüdyo kirası'}" autocomplete="off" autocorrect="off" spellcheck="false"></div>
      <div class="gp-alan"><div class="hr-tutar ${gelir ? '' : 'cikis'}"><label>${gelir ? 'Tahsil Edilen' : 'Tutar'}</label><input type="text" inputmode="numeric" id="iyTutar" value="${tutar}" placeholder="0"></div></div>
      <div class="gp-alan" style="margin:0"><label>${gelir ? 'Ait Olduğu Kişi' : 'Giderin Ait Olduğu Kişi'}</label><div class="kisi-sat" id="iyKisi">${kisiChips}</div></div>`;
  };
  const okuGiris = () => { const a = $('#iyAciklama'), t = $('#iyTutar'); if (a) aciklama = a.value; if (t) tutar = t.value; };
  const govde = `${edit ? '' : `<div class="iy-seg" id="iySeg"><button type="button" class="g ${mode === 'gelir' ? 'sec' : ''}" data-m="gelir">${ik('gelir')} Gelir Ekle</button><button type="button" class="d ${mode === 'gider' ? 'sec' : ''}" data-m="gider">${ik('gider')} Gider Ekle</button></div>`}<div class="iy-body" id="iyBody">${bodyHTML()}</div>`;
  const baslik = edit ? (mode === 'gelir' ? 'Gelir Düzenle' : 'Gider Düzenle') : 'İşlem Yap';
  modalAc(baslik, govde,
    `${edit ? `<button class="btn btn-kirmizi" id="iySil" style="margin-right:auto">${ik('cop')} Sil</button>` : ''}<button class="btn" id="iyIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini ${mode === 'gelir' ? 'iy-g' : 'iy-d'}" id="iyKaydet">${ik('kaydet')} Kaydet</button>`,
    rozetHTML('para', edit ? (mode === 'gelir' ? 'Gelir' : 'Gider') : 'İşlem'));

  const bindBody = () => {
    $('#iyPay').onclick = (e) => { const b = e.target.closest('[data-pay]'); if (!b) return; sekli = b.dataset.pay; $$('#iyPay .tc').forEach(x => x.classList.toggle('sec', x === b)); };
    $('#iyTarih').onclick = () => tarihSecici(tarih, (iso) => { tarih = iso; $('#iyTarihAd').textContent = fmtTarihUzun(tarih); });
    { const t = $('#iyTutar'); if (t) t.addEventListener('input', () => { t.value = binlikBiciml(t.value); }); }
    $('#iyKisi').onclick = (e) => { const c = e.target.closest('[data-iyk]'); if (!c) return; const id = c.dataset.iyk || null; if (mode === 'gelir') { gOrtak = id; gOrtakManuel = true; } else { dOrtak = id; } $$('#iyKisi .kisi-chip').forEach(x => x.classList.toggle('sec', x === c)); };
    if (mode === 'gelir') {
      const ob = $('#iyOgr'); if (ob) ob.onclick = () => ogrenciTekSecModal(ogrId, (id) => {
        ogrId = id;
        if (!gOrtakManuel) gOrtak = ogrenciEgitmenId(id);   // öğrenci seçilince eğitmeni varsayılan
        $('#iyOgr').innerHTML = ogrTrigIc();
        const kis = $('#iyKisi'); if (kis) { kis.innerHTML = State.ortaklar.filter(o => o.aktif !== false).map(o => `<span class="kisi-chip ${gOrtak === o.id ? 'sec' : ''}" data-iyk="${o.id}">${kacar(egitmenKisaAd(o))}${ogrenciEgitmenId(id) === o.id ? ' <span class="kc-hint">(eğitmeni)</span>' : ''}</span>`).join(''); }
      });
    } else {
      const gb = $('#iyGider'); if (gb) gb.onclick = () => giderGrupSecModal((it, grupAd) => { secId = it.id; secAd = it.ad; secGrupAd = grupAd; const el = $('#iyGiderAd'); if (el) { el.textContent = it.ad; el.classList.remove('gd-soluk'); } });
    }
  };
  const bodyYenile = () => { const b = $('#iyBody'); if (!b) return; b.innerHTML = bodyHTML(); b.classList.remove('iy-gec'); void b.offsetWidth; b.classList.add('iy-gec'); bindBody(); };
  const modDegis = (yeni) => {
    if (mode === yeni) return; okuGiris(); mode = yeni;
    sekli = mode === 'gelir' ? 'havale' : 'banka';   // ödeme varsayılanı moda göre
    $$('#iySeg [data-m]').forEach(x => x.classList.toggle('sec', x.dataset.m === mode));
    const kb = $('#iyKaydet'); if (kb) { kb.classList.toggle('iy-g', mode === 'gelir'); kb.classList.toggle('iy-d', mode === 'gider'); }
    const rz = $('#modalKap .hr-rozet'); // rozet metni sabit "İşlem"
    bodyYenile();
  };
  if (!edit) $$('#iySeg [data-m]').forEach(b => b.onclick = () => modDegis(b.dataset.m));
  bindBody();
  $('#iyIptal').onclick = modalKapat;
  if (edit && mev) $('#iySil').onclick = () => {
    if (mode === 'gelir') onayModal('Gelir silinsin mi?', 'Bu tutar öğrencinin borcuna geri eklenir.', async () => {
      await odemeGeriAl(mev); modalKapat(); bildir('Kayıt silindi.', 'basari'); git(State.aktifSayfa);
    });
    else onayModal('Gider silinsin mi?', 'Bu kayıt silinecek.', async () => {
      await DB.sil('giderKayitlari', mev.id); State.giderKayitlari = State.giderKayitlari.filter(x => x.id !== mev.id);
      modalKapat(); bildir('Gider silindi.', 'basari'); git(State.aktifSayfa);
    });
  };
  $('#iyKaydet').onclick = async () => {
    okuGiris();
    const tt = Number((tutar || '').replace(/\D/g, '')) || 0;
    if (mode === 'gelir') {
      if (!ogrId) return bildir('Öğrenci seçin.', 'hata');
      if (tt <= 0) return bildir('Tutar girin.', 'hata');
      if (edit && mev) {   // eski düşümü geri al
        const eskiO = State.ogrenciler.find(x => x.id === mev.ogrenciId);
        if (eskiO) { for (const d of (mev.dusumler || [])) { const p = (eskiO.paketler || []).find(x => x.id === d.paketId); if (p) p.kalanOdeme = (Number(p.kalanOdeme) || 0) + (Number(d.tutar) || 0); } await DB.guncelle('ogrenciler', eskiO.id, { paketler: eskiO.paketler }); }
      }
      const o = State.ogrenciler.find(x => x.id === ogrId);
      const dusumler = odemeDusumUygula(o, tt);
      const kalanBorc = ogrenciMetrik(o).kalanOdeme;
      await DB.guncelle('ogrenciler', o.id, { paketler: o.paketler });
      const veri = { ogrenciId: o.id, tutar: tt, tarih, tur: sekli, dusumler, kalanBorc, aciklama: (aciklama || '').trim(), ortakId: gOrtak || null };
      let odemeId;
      if (edit && mev) { await DB.guncelle('odemeler', mev.id, veri); Object.assign(mev, veri); odemeId = mev.id; bildir('Gelir güncellendi.', 'basari'); }
      else { const y = await DB.ekle('odemeler', veri); State.odemeler.push(y); odemeId = y.id; bildir('Gelir kaydedildi.', 'basari'); }
      const komMevcut = (State.giderKayitlari || []).find(g => g.kaynakOdemeId === odemeId);
      if (sekli === 'kart' && !komMevcut) { const k = await DB.ekle('giderKayitlari', { tarih, giderId: null, giderAd: 'Banka Komisyonu', grupAd: '', aciklama: '', odemeSekli: 'banka', tutar: 0, ortakId: null, kaynakOdemeId: odemeId, otoKomisyon: true, olusturma: new Date().toISOString() }); State.giderKayitlari.push(k); }
      else if (sekli === 'kart' && komMevcut) { await DB.guncelle('giderKayitlari', komMevcut.id, { tarih }); komMevcut.tarih = tarih; }
      else if (sekli !== 'kart' && komMevcut) { await DB.sil('giderKayitlari', komMevcut.id); State.giderKayitlari = State.giderKayitlari.filter(g => g.id !== komMevcut.id); }
    } else {
      if (!secId) return bildir('Gider grubu seçin.', 'hata');
      if (tt <= 0) return bildir('Tutar girin.', 'hata');
      const kayit = { tarih, giderId: secId, giderAd: secAd, grupAd: secGrupAd, aciklama: (aciklama || '').trim(), odemeSekli: sekli, tutar: tt, ortakId: dOrtak || null, kaynakOdemeId: (edit && mev) ? (mev.kaynakOdemeId || null) : null, otoKomisyon: false };
      if (edit && mev) { await DB.guncelle('giderKayitlari', mev.id, kayit); const idx = State.giderKayitlari.findIndex(x => x.id === mev.id); if (idx >= 0) Object.assign(State.giderKayitlari[idx], kayit); bildir('Gider güncellendi.', 'basari'); }
      else { kayit.olusturma = new Date().toISOString(); const y = await DB.ekle('giderKayitlari', kayit); State.giderKayitlari.push(y); bildir('Gider kaydedildi.', 'basari'); }
    }
    modalKapat(); git(State.aktifSayfa);
  };
}

function odemeAlModal(mevcut) {
  const ogrenciler = State.ogrenciler.filter(x => x.durum === 'ogrenci').slice()
    .sort((a, b) => ogrenciTamAd(a).localeCompare(ogrenciTamAd(b), 'tr'));
  if (!ogrenciler.length) return bildir('Önce paketli öğrenci ekleyin (Öğrenciler).', 'hata');

  let seciliId = mevcut ? mevcut.ogrenciId : null;
  let tarih = mevcut ? mevcut.tarih : bugunISO();
  let tur = mevcut ? (mevcut.tur || 'nakit') : 'nakit';
  const borcMetin = (o) => { const m = ogrenciMetrik(o); return m.kalanOdeme > 0 ? 'Kalan borç: ' + binlik(m.kalanOdeme) + ' ₺' : 'Borç yok'; };
  const musteriAlanHTML = () => {
    if (!seciliId) {
      return `<button type="button" class="ekle-btn" id="odSecBtn">＋ Öğrenci Seç</button>`;
    }
    const o = ogrenciler.find(x => x.id === seciliId);
    return `<div class="od-mus-sec"><span class="ogr-av">${basHarf(o.ad, o.soyad)}</span><span class="od-bilg"><span class="ad">${kacar(ogrenciTamAd(o))}</span><span class="alt">${borcMetin(o)}</span></span><button type="button" class="od-deg" id="odDeg">Değiştir</button></div>`;
  };
  const govde = `
    <div class="gp-alan"><label>Müşteri</label><div id="odMus">${musteriAlanHTML()}</div></div>
    <div class="gp-alan uy-birimli"><label>Ödediği Tutar</label><input type="text" inputmode="numeric" class="gp-inp" id="odTutar" value="${mevcut ? binlik(mevcut.tutar) : ''}"><span class="uy-birim">₺</span></div>
    <div class="gp-alan"><label>Ödeme Tarihi</label><button type="button" class="pa-trig" id="odTarih"><span id="odTarihAd">${fmtTarihUzun(tarih)}</span><span class="ok">${ik('dersler')}</span></button></div>
    <div class="gp-alan" style="margin:0"><label>Ödeme Türü</label>
      <div class="turcip" id="odTur">${Object.entries(ODEME_TURLERI).map(([k, l]) => `<button type="button" class="tc ${tur === k ? 'sec' : ''}" data-t="${k}">${l}</button>`).join('')}</div></div>`;
  modalAc(mevcut ? 'Gelir Düzenle' : 'Gelir Ekle', govde,
    `<button class="btn" id="odIptal">İptal</button><button class="btn btn-ana gp-kaydet gp-kaydet-mini" id="odKaydet"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" fill="currentColor" opacity=".2"/><path d="M6 4.5h9.5l3 3V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 4.5h6v4H8zM8 19v-5h8v5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg> Kaydet</button>`,
    `<span class="hr-rozet od-rozet">💰 Gelir</span>`);

  const musSec = () => ogrenciTekSecModal(seciliId, (id) => { seciliId = id; $('#odMus').innerHTML = musteriAlanHTML(); musBagla(); });
  const musBagla = () => {
    if (!seciliId) { $('#odSecBtn').onclick = musSec; }
    else { $('#odDeg').onclick = musSec; }
  };
  musBagla();
  const tut = $('#odTutar'); tut.addEventListener('input', () => { tut.value = binlikBiciml(tut.value); });
  $$('#odTur [data-t]').forEach(b => b.onclick = () => { tur = b.dataset.t; $$('#odTur .tc').forEach(x => x.classList.toggle('sec', x.dataset.t === tur)); });
  $('#odTarih').onclick = () => tarihSecici(tarih, (iso) => { tarih = iso; $('#odTarihAd').textContent = fmtTarihUzun(tarih); });
  $('#odIptal').onclick = modalKapat;
  $('#odKaydet').onclick = async () => {
    if (!seciliId) return bildir('Müşteri seçin.', 'hata');
    const tutar = Number((tut.value || '').replace(/\D/g, '')) || 0;
    if (tutar <= 0) return bildir('Tutar girin.', 'hata');
    // Düzenleme: önce eski düşümü geri al (borcu iade et)
    if (mevcut) {
      const eskiO = State.ogrenciler.find(x => x.id === mevcut.ogrenciId);
      if (eskiO) {
        for (const d of (mevcut.dusumler || [])) { const p = (eskiO.paketler || []).find(x => x.id === d.paketId); if (p) p.kalanOdeme = (Number(p.kalanOdeme) || 0) + (Number(d.tutar) || 0); }
        await DB.guncelle('ogrenciler', eskiO.id, { paketler: eskiO.paketler });
      }
    }
    const o = State.ogrenciler.find(x => x.id === seciliId);
    const dusumler = odemeDusumUygula(o, tutar);
    const kalanBorc = ogrenciMetrik(o).kalanOdeme;   // bu ödemeden hemen SONRAKİ kalan borç (anlık görüntü)
    await DB.guncelle('ogrenciler', o.id, { paketler: o.paketler });
    let odemeId;
    if (mevcut) {
      const veri = { ogrenciId: o.id, tutar, tarih, tur, dusumler, kalanBorc };
      await DB.guncelle('odemeler', mevcut.id, veri); Object.assign(mevcut, veri);
      odemeId = mevcut.id; bildir('Gelir güncellendi.', 'basari');
    } else {
      const y = await DB.ekle('odemeler', { ogrenciId: o.id, tutar, tarih, tur, dusumler, kalanBorc });
      State.odemeler.push(y); odemeId = y.id; bildir('Gelir kaydedildi.', 'basari');
    }
    // Kredi Kartı ile gelir → otomatik "Banka Komisyonu" gideri (tutar boş; sonradan doldurulur)
    const komMevcut = (State.giderKayitlari || []).find(g => g.kaynakOdemeId === odemeId);
    if (tur === 'kart' && !komMevcut) {
      const k = await DB.ekle('giderKayitlari', { tarih, giderId: null, giderAd: 'Banka Komisyonu', grupAd: '', aciklama: '', odemeSekli: 'banka', tutar: 0, ortakId: null, kaynakOdemeId: odemeId, otoKomisyon: true, olusturma: new Date().toISOString() });
      State.giderKayitlari.push(k);
    } else if (tur === 'kart' && komMevcut) {
      await DB.guncelle('giderKayitlari', komMevcut.id, { tarih }); komMevcut.tarih = tarih;   // gelir tarihiyle eşle (tutar korunur)
    } else if (tur !== 'kart' && komMevcut) {
      await DB.sil('giderKayitlari', komMevcut.id); State.giderKayitlari = State.giderKayitlari.filter(g => g.id !== komMevcut.id);
    }
    modalKapat(); git(State.aktifSayfa);
  };
}

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
  $('#gvCikis').onclick = () => cikisYap();
};

/* Onay modalı */
function onayModal(baslik, mesaj, onaylandi) {
  const govde = `<div class="onay-ic">
      <div class="onay-ik">${ik('cop')}</div>
      <h4 class="onay-bas">${kacar(baslik)}</h4>
      <p class="onay-mesaj">${mesaj || 'Emin misiniz?'}</p>
    </div>`;
  modalAc('', govde,
    `<button class="btn" id="onIptal" style="flex:1">Vazgeç</button><button class="btn btn-kirmizi" id="onEvet" style="flex:1">${ik('cop')} Sil</button>`);
  const m = $('#modalKap .modal'); if (m) m.classList.add('modal-kucuk', 'modal-onay');   // onay kutuları küçük + başlıksız
  $('#onIptal').onclick = modalKapat;
  $('#onEvet').onclick = () => { modalKapat(); onaylandi(); };
}

/* ==========================================================
   İSTEK VE ÖNERİ (talepler) — kullanıcı geri bildirimi
   ========================================================== */
const TALEP_SAYFALAR = [
  { id: 'dashboard', ad: 'Panel', ik: 'panel' },
  { id: 'ogrenciler', ad: 'Öğrenciler', ik: 'ogrenci' },
  { id: 'dersler', ad: 'Dersler', ik: 'dersler' },
  { id: 'hesap-defter', ad: 'Hesaplar', ik: 'muhasebe' },
  { id: 'ortaklar', ad: 'Ortaklar', ik: 'ortaklar' },
  { id: 'ayar-tanimlama', ad: 'Tanımlar', ik: 'tanimlar' },
  { id: 'diger', ad: 'Diğer', ik: 'grup' },
];
function talepSayfaAd(id) { const s = TALEP_SAYFALAR.find(x => x.id === id); return s ? s.ad : 'Diğer'; }
function aktifKullaniciAd() {
  const k = State.kullanici || {};
  if (adminMi()) return 'Yönetici';
  const ortak = k.ortakId ? State.ortaklar.find(o => o.id === k.ortakId) : null;
  return ortak?.ad || k.ad || 'Kullanıcı';
}
function talepSaatStr(iso) { try { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } catch { return ''; } }
const TALEP_ROZET = () => rozetHTML('destek', 'Talepler');

/* Ana ekrana ekle — yardım (iPhone/Android) */
function anaEkranaEkleModal() {
  const adim = (n, t) => `<div class="aee-step"><span class="aee-n">${n}</span><span class="aee-tx">${t}</span></div>`;
  const govde = `
    <div class="aee-bas"><span class="aee-ik">${ik('indir')}</span><div><h4>Ana Ekrana Ekle</h4><p>Uygulamayı telefonuna kısayol olarak ekle; tam ekran, uygulama gibi açılır.</p></div></div>
    <div class="aee-plat">iPhone · Safari</div>
    ${adim(1, 'Alttaki <b>Paylaş</b> (kutudan çıkan ok) simgesine dokun')}
    ${adim(2, '<b>Ana Ekrana Ekle</b> seçeneğini seç')}
    ${adim(3, 'Sağ üstte <b>Ekle</b>’ye dokun')}
    <div class="aee-plat">Android · Chrome</div>
    ${adim(1, 'Sağ üstteki <b>⋮</b> menüye dokun')}
    ${adim(2, '<b>Ana ekrana ekle</b> / <b>Uygulamayı yükle</b> seçeneğini seç')}
    ${adim(3, '<b>Ekle</b> ile onayla')}`;
  modalAc('Ana Ekrana Ekle', govde, `<button class="btn btn-ana" id="aeeKapat" style="flex:1">Anladım</button>`, rozetHTML('indir', 'Kısayol'));
  $('#aeeKapat').onclick = modalKapat;
}

function talepListeModal() {
  const liste = (State.talepler || []).slice().sort((a, b) => (b.olusturma || '').localeCompare(a.olusturma || ''));
  const bas = (s) => (s || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  const satir = (t) => {
    const cev = t.durum === 'cevaplandi';
    return `<button type="button" class="tlp-sat" data-t="${t.id}">
      <span class="tlp-ts"><b>${fmtTarihUzun((t.olusturma || '').slice(0, 10))}</b><span>${talepSaatStr(t.olusturma)}</span></span>
      <span class="tlp-orta"><span class="tlp-bas">${kacar(t.baslik || '—')}</span><span class="tlp-alt"><span class="tlp-syf">${kacar(talepSayfaAd(t.sayfa))}</span><span class="tlp-eden"><span class="tlp-av">${kacar(bas(t.kullaniciAd))}</span>${kacar(t.kullaniciAd || '—')}</span></span></span>
      <span class="dpill ${cev ? 'c' : 'b'}">${cev ? ik('onay') : ik('sure')}<span class="tlp-drm">${cev ? 'Cevaplandı' : 'Bekliyor'}</span></span>
    </button>`;
  };
  const govde = `<button type="button" class="gp-ekle tlp-yeni" id="tlpYeni"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Yeni İstek Oluştur</button>
    ${liste.length ? `<div class="tlp-liste">${liste.map(satir).join('')}</div>` : `<div class="gp-bos" style="margin:10px 4px">Henüz istek/öneri yok. İlkini sen oluştur.</div>`}`;
  modalAc('İstek ve Öneri', govde, null, TALEP_ROZET());
  $('#tlpYeni').onclick = talepFormModal;
  $$('#modalKap [data-t]').forEach(b => b.onclick = () => { const t = (State.talepler || []).find(x => x.id === b.dataset.t); if (t) talepDetayModal(t); });
}

function talepFormModal(mevcut) {
  let sayfa = mevcut ? mevcut.sayfa : null;
  const chip = (s) => `<button type="button" class="syf-chip ${sayfa === s.id ? 'sec' : ''}" data-syf="${s.id}">${ik(s.ik)} ${kacar(s.ad)}</button>`;
  const govde = `
    <div class="gp-alan"><label>Hangi sayfa ile ilgili?</label>
      <div class="syf-chipler" id="tlpSyf">${TALEP_SAYFALAR.map(chip).join('')}</div></div>
    <div class="gp-alan"><label>Başlık</label><input type="text" class="gp-inp" id="tlpBaslik" value="${mevcut ? kacar(mevcut.baslik || '') : ''}" placeholder="Örn. Kalan ders barı sığmıyor" autocomplete="off"></div>
    <div class="gp-alan" style="margin:0"><label>Açıklama</label><textarea class="gp-inp tlp-aciklama" id="tlpAciklama" placeholder="Yaşadığınız aksaklığı ya da yeni isteğinizi ayrıntılı yazın…">${mevcut ? kacar(mevcut.aciklama || '') : ''}</textarea></div>`;
  modalAc('Yeni İstek', govde,
    `<button class="btn" id="tlpGeri" style="flex:1">‹ Geri</button><button class="btn btn-ana" id="tlpGonder" style="flex:1">${ik('kaydet')} Gönder</button>`,
    rozetHTML('destek', 'İstek'));
  $('#tlpSyf').onclick = (e) => { const b = e.target.closest('[data-syf]'); if (!b) return; sayfa = b.dataset.syf; $$('#tlpSyf .syf-chip').forEach(x => x.classList.toggle('sec', x === b)); };
  $('#tlpGeri').onclick = talepListeModal;
  $('#tlpGonder').onclick = async () => {
    const baslik = $('#tlpBaslik').value.trim();
    const aciklama = $('#tlpAciklama').value.trim();
    if (!sayfa) return bildir('Bir sayfa seçin.', 'hata');
    if (!baslik) return bildir('Başlık girin.', 'hata');
    if (!aciklama) return bildir('Açıklama girin.', 'hata');
    const veri = { kullaniciId: adminMi() ? 'admin' : (aktifOrtakId() || 'admin'), kullaniciAd: aktifKullaniciAd(), sayfa, baslik, aciklama, cevap: '', cevapAd: '', durum: 'bekliyor', olusturma: new Date().toISOString() };
    const y = await DB.ekle('talepler', veri); State.talepler.push(y);
    bildir('İsteğiniz gönderildi. Teşekkürler!', 'basari');
    talepListeModal();
  };
}

function talepDetayModal(t) {
  const admin = adminMi();
  const bas = (s) => (s || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  const cevapHTML = t.cevap
    ? `<div class="tlp-cevap"><div class="cv-bas">${ik('onay')} ${kacar(t.cevapAd || 'Yönetici')} Cevabı</div><div class="cv-txt">${kacar(t.cevap)}</div></div>`
    : (!admin ? `<div class="tlp-bekle">${ik('sure')} Henüz cevaplanmadı.</div>` : '');
  const cevapKutu = admin
    ? `<div class="gp-alan" style="margin:12px 0 0"><label>Cevap yaz (yalnızca admin)</label><textarea class="gp-inp tlp-aciklama" id="tlpCevap" style="min-height:80px" placeholder="Cevabınızı yazın…">${kacar(t.cevap || '')}</textarea></div>`
    : '';
  const govde = `
    <div class="tlp-detay">
      <div class="det-ust"><span class="who"><span class="tlp-av">${kacar(bas(t.kullaniciAd))}</span>${kacar(t.kullaniciAd || '—')}</span><span class="tlp-ts2">${fmtTarihUzun((t.olusturma || '').slice(0, 10))} · ${talepSaatStr(t.olusturma)}</span></div>
      <div class="det-h">${kacar(t.baslik || '—')}</div>
      <div class="det-txt">${kacar(t.aciklama || '')}</div>
    </div>
    ${cevapHTML}
    ${cevapKutu}`;
  const alt = admin
    ? `<button class="btn btn-kirmizi" id="tlpSil" style="margin-right:auto">${ik('cop')} Sil</button><button class="btn" id="tlpKapat">Kapat</button><button class="btn btn-ana" id="tlpCevapla">${ik('kaydet')} Cevabı Gönder</button>`
    : `<button class="btn" id="tlpKapat" style="flex:1">Kapat</button>`;
  modalAc('Talep Detayı', govde, alt, rozetHTML(TALEP_SAYFALAR.find(s => s.id === t.sayfa)?.ik || 'grup', talepSayfaAd(t.sayfa)));
  $('#tlpKapat').onclick = talepListeModal;
  if (admin) {
    $('#tlpCevapla').onclick = async () => {
      const cevap = $('#tlpCevap').value.trim();
      if (!cevap) return bildir('Cevap yazın.', 'hata');
      const veri = { cevap, cevapAd: aktifKullaniciAd(), durum: 'cevaplandi', cevapTarih: new Date().toISOString() };
      await DB.guncelle('talepler', t.id, veri); Object.assign(t, veri);
      bildir('Cevap gönderildi.', 'basari'); talepListeModal();
    };
    $('#tlpSil').onclick = () => onayModal('İstek silinsin mi?', 'Bu talep kalıcı olarak silinecek.', async () => {
      await DB.sil('talepler', t.id); State.talepler = State.talepler.filter(x => x.id !== t.id);
      bildir('İstek silindi.', 'basari'); talepListeModal();
    });
  }
}

/* ==========================================================
   10) KİMLİK DOĞRULAMA & BAŞLATMA
   ========================================================== */
async function uygulamayiBaslat() {
  // Giriş ekranında premium yükleme göster; veriler yüklenince uygulamaya geç
  const gg = $('#girisGovde'), gy = $('#girisYuk');
  if (gg) gg.classList.add('gizli');
  if (gy) gy.classList.remove('gizli');
  const simdi = () => (window.performance && performance.now) ? performance.now() : 0;
  const t0 = simdi();
  ortakGoster = true;   // her girişte varsayılan: ortak da tüm ortakların verisini görür (👥 ile daraltılabilir)
  await Bulut.baslangicSenkron();   // bulut bağlıysa verileri buluttan çek (hata olsa da engel olmaz)
  await veriYukle();
  menuCiz();
  altMenuCiz();          // alt sayfa çubuğunu giriş yapan kullanıcıya göre yeniden çiz (admin → tüm sekmeler)
  kullaniciBilgiCiz();   // tepe paneli: görsel + ad soyad (ortaklar yüklendikten sonra)
  kontrolKur();
  git('dashboard');
  const bekle = Math.max(0, 900 - (simdi() - t0));   // en az ~0.9sn göster (premium his)
  await new Promise(r => setTimeout(r, bekle));
  $('#girisEkrani').classList.add('gizli');
  $('#uygulama').classList.remove('gizli');
  if (gg) gg.classList.remove('gizli');   // sonraki giriş için formu geri hazırla
  if (gy) gy.classList.add('gizli');
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
  // Daha önce girildiyse oturumu geri yükle (admin veya ortak)
  const oturumRaw = localStorage.getItem('yt_oturum');
  if (oturumRaw) {
    try {
      const o = JSON.parse(oturumRaw);
      State.kullanici = { email: (o.ad || 'admin') + '@yogatugi', ad: o.ad, rol: o.rol || 'admin', ortakId: o.ortakId || null };
      uygulamayiBaslat(); return;
    } catch { /* bozuksa normal girişe düş */ }
  }
  if (localStorage.getItem('yt_girisYapildi')) { girisYap(SABIT_ADMIN.kullanici); return; }   // eski oturum → admin
  govde.innerHTML = `
    <div class="giris-alan ilk"><span class="giris-ik">👤</span><input type="text" id="gKul" placeholder="Kullanıcı Adı :" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
    <div class="giris-alan"><span class="giris-ik">🔒</span><input type="password" id="gSif" placeholder="Şifre :" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-form-type="other"></div>
    <div class="giris-hata" id="girisHata"></div>
    <button type="button" class="btn-giris" id="girisBtn">Giriş Yap</button>
    <div class="giris-guv">🔒 Güvenli giriş</div>
    <div class="giris-demo">${ik('uyari')}<span><b>Demo uygulama.</b> Test aşamasındadır; zaman zaman hata veya eksik olabilir. Önemli verilerinizi ayrıca yedekleyin.</span></div>
    <button type="button" class="giris-ekle" id="girisEkleBtn">${ik('indir')} Ana ekrana nasıl eklenir?</button>`;
  $('#girisBtn').onclick = girisDogrula;
  { const eb = $('#girisEkleBtn'); if (eb) eb.onclick = anaEkranaEkleModal; }
  const gk = $('#gKul'), gs = $('#gSif');
  gk.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); gs.focus(); } });
  gs.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); girisDogrula(); } });
}

async function girisDogrula() {
  const kul = ($('#gKul').value || '').trim();
  const sif = $('#gSif').value || '';
  const hata = $('#girisHata');
  const kulLc = kul.toLocaleLowerCase('tr');
  const h = await sifreHash(sif);
  // Yönetici girişi
  if (kulLc === SABIT_ADMIN.kullanici.toLocaleLowerCase('tr')) {
    if (!SABIT_ADMIN.hashler.includes(h)) { hata.textContent = 'Şifre hatalı.'; return; }
    return girisYap(SABIT_ADMIN.kullanici);
  }
  // Ortak girişi (kullanıcı adı + şifre ortak kaydında saklı)
  const o = DB._oku('ortaklar').find(x => (x.girisAd || '').toLocaleLowerCase('tr') === kulLc && x.sifreHash);
  if (!o) { hata.textContent = 'Kullanıcı adı hatalı.'; return; }
  if (o.girisAktif === false) { hata.textContent = 'Bu giriş kapalı. Yöneticiye başvurun.'; return; }
  if (o.sifreHash !== h) { hata.textContent = 'Şifre hatalı.'; return; }
  girisYapOrtak(o);
}

async function girisYap(ad) {
  State.kullanici = { email: (ad || 'admin') + '@yogatugi', ad: ad || SABIT_ADMIN.kullanici, rol: 'admin', ortakId: null };
  oturumSakla();
  await uygulamayiBaslat();
}
/* Ortak olarak giriş — dashboard'da yalnızca kendi kartını görür */
async function girisYapOrtak(o) {
  State.kullanici = { email: (o.girisAd || o.id) + '@yogatugi', ad: o.ad, rol: 'ortak', ortakId: o.id };
  oturumSakla();
  await uygulamayiBaslat();
}
function oturumSakla() {
  const k = State.kullanici;
  localStorage.setItem('yt_oturum', JSON.stringify({ ad: k.ad, rol: k.rol, ortakId: k.ortakId || null }));
  localStorage.setItem('yt_girisYapildi', '1');   // geriye dönük uyumluluk
}

/* Çıkış, tema, mobil menü */
function cikisYap() {
  localStorage.removeItem('yt_girisYapildi');
  localStorage.removeItem('yt_oturum');
  State.kullanici = null;
  $('#uygulama').classList.add('gizli');
  $('#girisEkrani').classList.remove('gizli');
  girisGovdeCiz();
}
const TEMALAR = ['acik', 'koyu', 'neon'];
function aktifTema() { return 'neon'; }   // Neon tek/varsayılan tema (diğerleri gizli)
function temaUygula(ad, yenile) {
  if (!TEMALAR.includes(ad)) ad = 'acik';
  document.body.classList.remove('tema-koyu', 'tema-neon');
  if (ad === 'koyu') document.body.classList.add('tema-koyu');
  else if (ad === 'neon') document.body.classList.add('tema-neon');
  localStorage.setItem('yt_tema', ad);
  // menüdeki çip seçimini güncelle
  $$('#kmTemaSec [data-tema]').forEach(b => b.classList.toggle('sec', b.dataset.tema === ad));
  // ana ekrandaysak düzen değişebilir → yeniden çiz
  if (yenile && State.aktifSayfa === 'dashboard') SAYFALAR.dashboard();
}
/* Geriye dönük uyum */
function temaDegistir() { temaUygula(aktifTema() === 'acik' ? 'koyu' : 'acik', true); }
function kulMenuKapat() { $('#kulMenu').classList.add('gizli'); }

/* Tepe paneli: kullanıcı görseli + ad soyad + rol (çip + menü başlığı) */
function kullaniciBilgiCiz() {
  const k = State.kullanici || {};
  const admin = adminMi();
  const ortak = k.ortakId ? State.ortaklar.find(o => o.id === k.ortakId) : null;
  const ad = admin ? 'Yönetici' : (ortak?.ad || k.ad || 'Kullanıcı');
  const rol = admin ? 'Admin' : 'Eğitmen';
  const bas = (s) => (s || '?').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toLocaleUpperCase('tr');
  let ic;
  if (!admin && ortak?.foto) ic = `<img src="${ortak.foto}" alt="${kacar(ad)}">`;
  else if (admin && State.ayarlar?.logoData) ic = `<img src="${State.ayarlar.logoData}" alt="logo">`;
  else ic = kacar(bas(ad));
  const setHTML = (id, v) => { const el = $('#' + id); if (el) el.innerHTML = v; };
  const setTxt = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
  setHTML('kullaniciFoto', ic); setTxt('kullaniciAd', ad); setTxt('kullaniciRol', rol);
  setHTML('kmFoto', ic); setTxt('kmAd', ad); setTxt('kmRol', rol);
  const nb = $('#notBtn'); if (nb) nb.classList.toggle('gizli', !admin);   // not kalemi sadece admin
  if (!admin) { const np = $('#notPaneli'); if (np) np.classList.add('gizli'); }
  bakimGuncelle();   // admin dışı kullanıcılar → bakım ekranı
}
/* Admin dışı kullanıcılara "Program Güncelleme Aşamasında" ekranı (geçici) */
function bakimGuncelle() {
  const el = $('#bakimEkrani'); if (!el) return;
  const goster = !!(State.kullanici && !adminMi());
  el.classList.toggle('gizli', !goster);
  if (goster) {
    const ik0 = $('#bakimIkon'); if (ik0 && !ik0.innerHTML) ik0.innerHTML = ik('guncel');
    const c = $('#bakimCikis'); if (c) c.onclick = cikisYap;
    document.body.classList.remove('menu-acik');
  }
}
/* Üst panel not kalemi (sadece admin) — cihazda saklanan serbest not alanı */
function notlarKur() {
  const btn = $('#notBtn'), pan = $('#notPaneli'), alan = $('#notAlan');
  if (!btn || !pan || !alan) return;
  btn.innerHTML = ik('kalem');
  try { alan.value = localStorage.getItem('yt_notlar') || ''; } catch {}
  btn.onclick = () => { pan.classList.toggle('gizli'); if (!pan.classList.contains('gizli')) alan.focus(); };
  alan.oninput = () => { try { localStorage.setItem('yt_notlar', alan.value); } catch {} };
  const kap = $('#notKapat'); if (kap) kap.onclick = () => pan.classList.add('gizli');
  const kop = $('#notKopyala'); if (kop) kop.onclick = async () => {
    try { await navigator.clipboard.writeText(alan.value); }
    catch { alan.select(); try { document.execCommand('copy'); } catch {} }
    bildir('Notlar kopyalandı.', 'basari');
  };
}

function ustCubukKur() {
  temaUygula(aktifTema());   // kayıtlı temayı uygula (açık / koyu / neon)
  $('#menuAcBtn').onclick = () => document.body.classList.toggle('menu-acik');
  // Üst panel: destek (İstek ve Öneri) — en sağda. Yenileme artık aşağı çekme ile (pull-to-refresh).
  { const db = $('#destekBtn'); if (db) { db.innerHTML = ik('destek'); db.onclick = talepListeModal; } }
  notlarKur();   // üst panel not kalemi (görünürlük admin'e göre kullaniciBilgiCiz'de ayarlanır)
  $('#menuPerde').onclick = () => document.body.classList.remove('menu-acik');
  if ($('#yedekBtn')) $('#yedekBtn').onclick = yedekModal;

  // Mobil: kullanıcıya dokununca açılan menü (Tema / Çıkış)
  const km = $('#kulMenu');
  $('#kullaniciBlok').onclick = (e) => { e.stopPropagation(); km.classList.toggle('gizli'); };
  if ($('#kmYedek')) $('#kmYedek').onclick = () => { kulMenuKapat(); yedekModal(); };
  { const ts = $('#kmTemaSec'); if (ts) { $$('#kmTemaSec [data-tema]').forEach(b => b.classList.toggle('sec', b.dataset.tema === aktifTema())); ts.onclick = (e) => { const b = e.target.closest('[data-tema]'); if (!b) return; temaUygula(b.dataset.tema, true); }; } }
  { const kt = $('#kmTalep'); if (kt) { kt.innerHTML = ik('destek') + '<span>İstek & Öneri</span>'; kt.onclick = () => { kulMenuKapat(); talepListeModal(); }; } }
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
  { tip: 'sayfa', id: 'dashboard', ad: 'Panel',    ikon: 'panel' },
  { tip: 'sayfa', id: 'hesap-defter', ad: 'Hesaplar', ikon: 'muhasebe' },
  { tip: 'sayfa', id: 'ice-aktar', ad: 'İçe Aktar', ikon: 'indir', merkez: true },
  { tip: 'sayfa', id: 'mutabakat', ad: 'Tahsilat', ikon: 'onay' },
  { tip: 'sayfa', id: 'ayar-tanimlama', ad: 'Tanımlar', ikon: 'tanimlar' },
];
// Bir sayfanın hangi alt-menü sekmesine ait olduğunu bul
function altMenuAktifId(sayfa) {
  // Doğrudan alt-menüde olan sayfa (dashboard, ogrenciler, dersler, hesap-defter, ortaklar, ayar-tanimlama)
  if (ALT_MENU.some(m => m.tip === 'sayfa' && m.id === sayfa)) return sayfa;
  if (sayfa === 'dersler' || sayfa === 'ogrenciler' || sayfa === 'studyolar') return 'ders-takibi';   // Ders Takibi alt görünümleri
  if (TANIM_ALT.includes(sayfa)) return 'ayar-tanimlama';                 // Tanımlamalar alt sayfaları
  if (sayfa === 'hesap-ortak' || sayfa === 'ortaklar' || sayfa === 'karlilik') return 'dashboard';   // kârlılık/ortak sayfaları — alt menüde ayrı sekme yok
  // Hesaplar sekmesine ait diğer sayfalar (kart sayfaları, Potansiyel/Müşteriler, Plan4Me)
  if (sayfa === 'hesaplar' || sayfa === 'potansiyel' || sayfa === 'musteriler' || sayfa === 'plan4me' || sayfa.startsWith('hesap-')) return 'hesap-defter';
  for (const m of ALT_MENU) {
    if (m.tip !== 'grup') continue;
    const grup = MENU.find(g => g.grup === m.grup);
    if (grup && grup.ogeler.some(o => o.id === sayfa)) return m.grup;
  }
  return 'dashboard';
}
function altMenuCiz() {
  const nav = $('#altMenu');
  // Tanımlar sekmesi ortağa da açık (hub içinde yalnız Üyelikler + Giderler görünür)
  nav.innerHTML = ALT_MENU
    .map(m => {
    const anahtar = m.tip === 'grup' ? m.grup : m.id;
    return `<button type="button" class="alt-oge${m.merkez ? ' merkez' : ''}" data-alt="${kacar(anahtar)}">
      <span class="ic">${ik(m.ikon)}</span><span class="tx">${kacar(m.ad)}</span></button>`;
  }).join('');
  $$('.alt-oge', nav).forEach(b => b.onclick = () => {
    const anahtar = b.dataset.alt;
    const m = ALT_MENU.find(x => (x.tip === 'grup' ? x.grup : x.id) === anahtar);
    if (!m) return;
    if (m.tip === 'aksiyon') { sheetKapat(); if (m.id === 'tahsilat') odemeAlModal(); }
    else if (m.tip === 'sayfa') { sheetKapat(); git(m.id); }
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
    <h4><span class="oi">${ik(m.ikon)}</span> ${kacar(grupAd)}</h4>
    <div class="sheet-liste">
      ${ogeler.map(o => `<button type="button" class="sheet-oge ${o.id === State.aktifSayfa ? 'aktif' : ''}" data-sayfa="${o.id}">
        <span class="oi">${ik(o.ikon)}</span><b>${kacar(o.ad)}</b><span class="ok">›</span></button>`).join('')}
    </div>`;
  document.body.classList.add('sheet-acik');
  $$('#altSheet .sheet-oge').forEach(b => b.onclick = () => { sheetKapat(); git(b.dataset.sayfa); });
}
function sheetKapat() { document.body.classList.remove('sheet-acik'); }

/* ==========================================================
   YEDEKLEME — Dışa aktar / İçe aktar / Sıfırla
   ========================================================== */
/* Ayarlar > Yedekleme sayfası — sade, sadece butonlar */
SAYFALAR['ayar-yedek'] = function () {
  ic().innerHTML = `
    <div class="kart yedek-kart">
      <button class="btn btn-ana" id="yedIndir">⤓ Yedeği İndir</button>
      <button class="btn" id="yedYukle">⤒ Yedekten Geri Yükle</button>
      <input type="file" id="yedDosya" accept=".json" hidden>
      <button class="btn btn-kirmizi" id="yedSil"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 7h12M9.5 7V5.6A1.2 1.2 0 0 1 10.7 4.4h2.6A1.2 1.2 0 0 1 14.5 5.6V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" fill="currentColor" opacity=".2"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.3 10.5v6M13.7 10.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Tüm Verileri Sil</button>
    </div>`;
  $('#yedIndir').onclick = yedekIndir;
  $('#yedYukle').onclick = () => $('#yedDosya').click();
  $('#yedDosya').onchange = (e) => { if (e.target.files[0]) yedekGeriYukle(e.target.files[0]); };
  $('#yedSil').onclick = () => onayModal('Tüm veriler silinsin mi?',
    'Bu işlem geri alınamaz. Önce yedek almanız önerilir.', verileriSifirla);
};

/* Ayarlar > Bulut Senkron (Supabase) */
SAYFALAR['ayar-bulut'] = function () {
  const cfg = Bulut.ayarOku() || {};
  const bagli = Bulut.aktif;
  const durumHTML = bagli
    ? `<div class="bulut-durum on">🟢 Bağlı — veriler bu proje ile eşitleniyor</div>`
    : (Bulut.durum === 'hata'
      ? `<div class="bulut-durum hata">🔴 Bağlantı hatası: ${kacar(Bulut.hataMesaj || '')}</div>`
      : `<div class="bulut-durum">⚪ Bağlı değil (yalnızca bu cihazda saklanıyor)</div>`);
  ic().innerHTML = `
    <div class="bilgi-kutu"><span class="ikon">☁️</span><div>Bulut senkron açıkken <b>telefon ve bilgisayar aynı veriyi</b> paylaşır; birinde yaptığın değişiklik diğerinde görünür. Ücretsiz bir <b>Supabase</b> projesi yeterli. Aşağıdaki “Nasıl kurulur?” adımlarını izle, sonra 2 değeri yapıştır.</div></div>
    <div class="kart" style="max-width:640px">
      ${durumHTML}
      <div class="form-alan" style="margin-top:12px"><label>Project URL</label>
        <input type="text" id="sbUrl" autocomplete="off" spellcheck="false" value="${kacar(cfg.url || '')}" placeholder="https://xxxxx.supabase.co"></div>
      <div class="form-alan"><label>anon public key</label>
        <input type="text" id="sbKey" autocomplete="off" spellcheck="false" value="${kacar(cfg.anonKey || '')}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
        <button class="btn btn-ana" id="sbBaglan">🔌 Bağlan & Kaydet</button>
        <button class="btn" id="sbCek" ${bagli ? '' : 'disabled'}>⬇️ Buluttan Yükle</button>
        <button class="btn" id="sbGonder" ${bagli ? '' : 'disabled'}>⬆️ Buluta Gönder</button>
        <button class="btn btn-kirmizi" id="sbKaldir" ${cfg.url ? '' : 'disabled'}>Bağlantıyı Kaldır</button>
      </div>
    </div>
    <details class="kart" style="max-width:640px;margin-top:14px">
      <summary style="cursor:pointer;font-weight:800;font-size:15px">📖 Nasıl kurulur? (adım adım)</summary>
      <ol style="line-height:1.95;padding-left:22px;margin:12px 0">
        <li><b>supabase.com</b> → <b>Start your project</b> → GitHub veya e-posta ile giriş yap.</li>
        <li><b>New project</b> → bir isim ver, güçlü bir <b>Database Password</b> belirle (bir yere not al), en yakın bölgeyi seç → <b>Create new project</b> (1–2 dk kurulur).</li>
        <li>Sol menü → <b>SQL Editor</b> → <b>+ New query</b> → aşağıdaki kodu yapıştır → <b>Run</b> (bir kez).</li>
        <li>Sol alt → <b>Project Settings ⚙️</b> → <b>API</b> → <b>Project URL</b> ve <b>Project API keys → anon public</b> değerini kopyala.</li>
        <li>Bu ikisini yukarıya yapıştır → <b>Bağlan & Kaydet</b>.</li>
        <li>Aynısını <b>diğer cihazında</b> da yap (aynı URL + anahtar). Artık veriler otomatik eşitlenir. 🎉</li>
      </ol>
      <div style="font-weight:800;margin:8px 0 6px">Çalıştırılacak SQL:</div>
      <pre id="sbSql" style="background:var(--gri);border:1px solid var(--kenar);border-radius:10px;padding:12px;overflow:auto;font-size:12px;line-height:1.5;white-space:pre-wrap">${kacar(BULUT_SQL)}</pre>
      <button class="btn btn-kucuk" id="sbSqlKopya" style="margin-top:8px">📋 SQL’i Kopyala</button>
      <div class="bilgi-kutu uyari" style="margin-top:14px"><span class="ikon">⚠️</span><div><b>Güvenlik notu:</b> Bu basit kurulumda projenin URL + anahtarını bilen herkes verilere erişebilir. Linkini ve anahtarını yalnızca güvendiğin kişilerle paylaş. Daha sıkı güvenlik gerekirse söyle, kullanıcı-bazlı kimlik doğrulama ekleriz.</div></div>
    </details>`;

  const durumYaz = (metin, hata) => { const d = $('.bulut-durum'); if (d) { d.className = 'bulut-durum' + (hata ? ' hata' : ''); d.textContent = metin; } };

  $('#sbBaglan').onclick = async () => {
    const url = ($('#sbUrl').value || '').trim().replace(/\/+$/, '');
    const key = ($('#sbKey').value || '').trim();
    if (!/^https:\/\/.+\.supabase\.co$/i.test(url)) return bildir('Geçerli bir Project URL girin (https://...supabase.co).', 'hata');
    if (key.length < 30) return bildir('anon public anahtarını yapıştırın.', 'hata');
    durumYaz('🔄 Bağlanıyor…');
    try {
      Bulut.ayarKaydet({ url, anonKey: key });
      await Bulut.baglan({ url, anonKey: key });
      const row = await Bulut.cek();
      const yerelDolu = KOLEKSIYONLAR.some(k => DB._oku(k).length);
      if (row && row.data && yerelDolu) {
        bulutYonModal(row);   // iki tarafta da veri var → yön sor
      } else if (row && row.data) {
        Bulut.uygula(row.data); Bulut.sonImza = row.guncelleme; await veriYukle(); Bulut.realtimeKur();
        bildir('Bağlandı — veriler buluttan indirildi.', 'basari'); git('ayar-bulut');
      } else {
        await Bulut.gonder(); Bulut.realtimeKur();
        bildir('Bağlandı — bu cihazdaki veriler buluta yüklendi.', 'basari'); git('ayar-bulut');
      }
    } catch (e) { Bulut.durum = 'hata'; Bulut.hataMesaj = e.message; durumYaz('🔴 ' + e.message, true); bildir('Bağlantı hatası. Tabloyu (SQL) çalıştırdınız mı?', 'hata'); }
  };
  if ($('#sbCek')) $('#sbCek').onclick = async () => {
    try { const row = await Bulut.cek(); if (!row || !row.data) return bildir('Bulutta veri yok.', 'hata');
      Bulut.uygula(row.data); Bulut.sonImza = row.guncelleme; await veriYukle(); bildir('Buluttan indirildi.', 'basari'); git('ayar-bulut');
    } catch (e) { bildir('Hata: ' + e.message, 'hata'); }
  };
  if ($('#sbGonder')) $('#sbGonder').onclick = async () => {
    try { await Bulut.gonder(); bildir('Buluta gönderildi.', 'basari'); } catch (e) { bildir('Hata: ' + e.message, 'hata'); }
  };
  if ($('#sbKaldir')) $('#sbKaldir').onclick = () => onayModal('Bulut bağlantısı kaldırılsın mı?',
    'Veriler silinmez; sadece bu cihaz buluttan ayrılır (yerelde kalır).', () => {
      Bulut.kapat(); Bulut.ayarKaydet(null); bildir('Bağlantı kaldırıldı.', 'basari'); git('ayar-bulut');
    });
  $('#sbSqlKopya').onclick = async () => {
    try { await navigator.clipboard.writeText(BULUT_SQL); bildir('SQL kopyalandı.', 'basari'); }
    catch { const t = $('#sbSql'); const r = document.createRange(); r.selectNode(t); getSelection().removeAllRanges(); getSelection().addRange(r); bildir('SQL seçildi, kopyalayın (Ctrl+C).', ''); }
  };
};

/* İlk bağlantıda iki tarafta da veri varsa hangi yön kullanılsın? */
function bulutYonModal(row) {
  modalAc('Bulutta da veri var', `<p style="font-size:14px;line-height:1.6">Hem bu cihazda hem bulutta veri bulunuyor. Hangisi geçerli olsun?</p>
    <div style="display:flex;flex-direction:column;gap:11px;margin-top:8px">
      <button class="btn btn-ana" id="byIndir" style="justify-content:center;padding:13px">⬇️ Buluttakini kullan <span class="soluk" style="margin-left:5px">(bu cihazdaki değişir)</span></button>
      <button class="btn" id="byGonder" style="justify-content:center;padding:13px">⬆️ Bu cihazdakini kullan <span class="soluk" style="margin-left:5px">(buluttaki değişir)</span></button>
    </div>`, `<button class="btn" id="byIptal">Vazgeç</button>`);
  $('#byIptal').onclick = modalKapat;
  $('#byIndir').onclick = async () => { modalKapat(); Bulut.uygula(row.data); Bulut.sonImza = row.guncelleme; await veriYukle(); Bulut.realtimeKur(); bildir('Buluttaki veriler yüklendi.', 'basari'); git('ayar-bulut'); };
  $('#byGonder').onclick = async () => { modalKapat(); await Bulut.gonder(); Bulut.realtimeKur(); bildir('Bu cihazdaki veriler buluta yazıldı.', 'basari'); git('ayar-bulut'); };
}

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
    <button class="btn btn-kirmizi" id="ydSifirla" style="width:100%;justify-content:center;padding:12px"><svg class="uik" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 7h12M9.5 7V5.6A1.2 1.2 0 0 1 10.7 4.4h2.6A1.2 1.2 0 0 1 14.5 5.6V7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" fill="currentColor" opacity=".2"/><path d="M6.8 7h10.4l-.8 11.1A1.8 1.8 0 0 1 14.6 20H9.4a1.8 1.8 0 0 1-1.8-1.9L6.8 7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.3 10.5v6M13.7 10.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Tüm Verileri Sıfırla</button>
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
    potansiyel: State.potansiyel, musteriler: State.musteriler, dersler: State.dersler, odemeler: State.odemeler,
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
  if ($('#menuLogo')) {   // kenar menüde: logo varsa resim, yoksa monogram
    if (a.logoData) $('#menuLogo').innerHTML = `<img src="${a.logoData}" alt="logo">`;
    else $('#menuLogo').textContent = monogram(ad);
  }
  // Mobil üst çubuk: sol firma adı + logo
  if ($('#ustFirmaAd')) $('#ustFirmaAd').textContent = ad;
  if ($('#ustFirmaLogo')) {
    if (a.logoData) $('#ustFirmaLogo').innerHTML = `<img src="${a.logoData}" alt="logo">`;
    else $('#ustFirmaLogo').textContent = monogram(ad);
  }
  document.title = ad + ' — Ön Muhasebe';
  logoUygula();
  faviconUygula();
}

/* Sekme ikonu (favicon) + iOS/Android ana ekran ikonu — yüklenen logo */
let _maniURL = null;
function faviconUygula() {
  const a = State.ayarlar || {};
  const src = a.logoData;
  if (!src) return;   // logo yoksa index.html'deki varsayılan kalır
  const linkAta = (rel) => {
    let l = document.querySelector(`link[rel="${rel}"]`);
    if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); }
    l.href = src;
  };
  linkAta('icon');
  linkAta('apple-touch-icon');
  try {
    const ad = (a.firmaAd || 'Green Village Pilates').trim();
    const mani = {
      name: ad, short_name: (ad.split(/\s+/)[0] || ad).slice(0, 12),
      start_url: '.', display: 'standalone', background_color: '#171b21', theme_color: '#1b2026',
      icons: [{ src, sizes: '240x240', type: 'image/jpeg', purpose: 'any' }],
    };
    if (_maniURL) URL.revokeObjectURL(_maniURL);
    _maniURL = URL.createObjectURL(new Blob([JSON.stringify(mani)], { type: 'application/manifest+json' }));
    let ml = document.querySelector('link[rel="manifest"]');
    if (!ml) { ml = document.createElement('link'); ml.rel = 'manifest'; document.head.appendChild(ml); }
    ml.href = _maniURL;
  } catch {}
}

/* Giriş ekranı markası: logo (wordmark/yüklenen) varsa göster ve metin başlığı gizle */
function girisLogoAta(src) {
  // Giriş ekranı artık sabit yazı-logo kullanıyor; firma logosu buraya basılmaz.
}
function girisLogoYer() {
  // Giriş ekranı sabit yazı-logo (Green Village Pilates) — değiştirilmez.
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
  autofillKapatKur();
  pullToRefreshKur();
  surumKontrol();
});

/* Aşağı çekince yenile — .ana kaydırıcısında, en üstteyken aşağı çekiş eşiği aşınca hard reload.
   Pürüzsüz çekiş için çekiş sırasında preventDefault; asla takılmasın diye güvenlik zamanlayıcısı. */
function pullToRefreshKur() {
  let ind = document.getElementById('ptr');
  if (!ind) { ind = document.createElement('div'); ind.id = 'ptr'; ind.innerHTML = '<div class="ptr-ring"></div>'; document.body.appendChild(ind); }
  const ESIK = 68, MAKS = 92;
  let baslaY = 0, aktif = false, mesafe = 0, yukleniyor = false;
  const kaydirici = () => (window.innerWidth <= 640 ? (document.querySelector('.ana') || document.scrollingElement || document.documentElement) : (document.scrollingElement || document.documentElement));
  const engelli = () => { const app = document.getElementById('uygulama'); const bk = document.getElementById('bakimEkrani'); return !app || app.classList.contains('gizli') || document.querySelector('.modal-perde, .picker-perde') || (bk && !bk.classList.contains('gizli')); };
  const iptal = () => { aktif = false; ind.style.transform = 'translateX(-50%)'; ind.classList.remove('gorunur', 'hazir'); };
  const hedef = document.querySelector('.ana') || document;
  hedef.addEventListener('touchstart', (e) => {
    if (yukleniyor || engelli() || kaydirici().scrollTop > 0) { aktif = false; return; }
    baslaY = e.touches[0].clientY; aktif = true; mesafe = 0;
  }, { passive: true });
  hedef.addEventListener('touchmove', (e) => {
    if (!aktif) return;
    const dy = e.touches[0].clientY - baslaY;
    if (kaydirici().scrollTop > 0 || dy <= 0) { iptal(); return; }
    mesafe = Math.min(MAKS, dy * 0.42);
    if (e.cancelable) e.preventDefault();   // native overscroll'u durdur → pürüzsüz çekiş
    ind.classList.add('gorunur');
    ind.classList.toggle('hazir', mesafe >= ESIK);
    ind.style.transform = `translateX(-50%) translateY(${mesafe}px)`;
  }, { passive: false });
  const bitir = () => {
    if (!aktif) return; aktif = false;
    if (mesafe >= ESIK) {
      yukleniyor = true;
      ind.classList.add('gorunur', 'yukleniyor'); ind.style.transform = `translateX(-50%) translateY(${ESIK}px)`;
      setTimeout(() => location.replace(location.pathname + '?g=' + Date.now()), 240);
      setTimeout(() => { yukleniyor = false; ind.classList.remove('yukleniyor'); iptal(); }, 5000);   // güvenlik: takılırsa temizle
    } else { iptal(); }
  };
  hedef.addEventListener('touchend', bitir, { passive: true });
  hedef.addEventListener('touchcancel', iptal, { passive: true });
}

/* Tarayıcı kayıtlı-değer önerisini tüm giriş alanlarında kapat.
   Chrome önerisi alan ADINA göre eşleşir; her alana benzersiz ad verilince
   eşleşecek geçmiş kalmaz → açılır öneri çıkmaz. Yazmayı engellemez. */
function autofillKapatKur() {
  const disi = ['checkbox', 'radio', 'file', 'range', 'color', 'hidden', 'submit', 'button', 'reset'];
  let sayac = 0;
  const uygula = (el) => {
    if (!el || el.dataset.afk) return;
    el.dataset.afk = '1';
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (el.tagName === 'INPUT' && disi.includes(t)) return;
    if (t === 'password') return;   // giriş şifresi alanına dokunma (kayıt/otomatik giriş bozulmasın)
    // type="tel"/"email" Chrome'un profil önerilerini (telefon/e-posta) güçlü tetikler →
    // klavye ipucunu koruyarak metne indir, böylece öneri balonu çıkmaz
    if (t === 'tel') { if (!el.getAttribute('inputmode')) el.setAttribute('inputmode', 'numeric'); el.setAttribute('type', 'text'); }
    if (t === 'email') { if (!el.getAttribute('inputmode')) el.setAttribute('inputmode', 'email'); el.setAttribute('type', 'text'); }
    // "new-password" en güvenilir yöntem: Chrome profil doldurmayı kapatır, metin alanında şifre üretici de çıkmaz
    el.setAttribute('autocomplete', 'new-password');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('name', 'yt-nf-' + Date.now().toString(36) + '-' + (sayac++));
    if (el.hasAttribute('readonly') && !el.dataset.gercekReadonly) el.removeAttribute('readonly');   // eski sürümden kalan kilidi temizle
  };
  const tara = (kok) => {
    if (!kok || kok.nodeType !== 1) return;
    if (kok.matches && kok.matches('input,textarea')) uygula(kok);
    if (kok.querySelectorAll) kok.querySelectorAll('input,textarea').forEach(uygula);
  };
  tara(document.body);
  try { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(tara))).observe(document.body, { childList: true, subtree: true }); } catch {}
}

/* ==========================================================
   Kontrol Listesi — sağdan açılan test paneli (tikler cihazda saklanır)
   ========================================================== */
/* Maddeler gerçek işleyiş sırasına dizili. Her madde: [id, başlık, nasıl test edilir (aşama aşama)] */
const KONTROL_LISTE = [
  { ad: '1) Kurulum — Önce bunları tanımla', ikon: '🗂️', maddeler: [
    ['ayr_ortak', 'Eğitmen (ortak) ekle', 'Ayarlar › Ortak Bilgileri → “＋ Ortak Ekle” → adı yaz → kaydet. Listede görünmeli.'],
    ['tnm_uyelik', 'Üyelik paketi tanımla', 'Ayarlar › Tanımlamalar › Üyelikler → “＋ Üyelik Ekle” → ad + ders seçenekleri (örn. 4=8.000, 8=16.000) + geçerlilik günü → kaydet.'],
    ['tnm_uyelikduz', 'Üyeliği düzenle / sil', 'Üyelikler listesinde bir paketi düzenle (fiyat değiştir), sonra sil. Değişiklikler uygulanmalı.'],
    ['tnm_gider', 'Gider ekle / düzenle / sil', 'Ayarlar › Tanımlamalar › Giderler → “＋ Gider Ekle” → tutar + tarih. Sonra o gideri düzenle ve sil.'],
  ]},
  { ad: '2) Müşteri & Üyelik — Üye al, paket ata', ikon: '🎓', maddeler: [
    ['ogr_yeniuye', 'Yeni üye kaydı + telefon biçimi', 'Öğrenciler → “＋ Yeni Üyelik Oluştur” → “Yeni Üye” → ad/soyad + telefona 05050334127 yaz. Otomatik 505-033-41-27 olmalı.'],
    ['ogr_beklet', 'Potansiyel olarak beklet', 'Yeni üye sonrası ekranda “Daha Sonra Devam Edeceğim” seç. Kişi “Potansiyel” sekmesine düşmeli.'],
    ['ogr_islemsec', 'İşlem Seç ekranı doğru mu', 'Potansiyel sekmesi → kişide “Paket Ata”. Altta “Vazgeç” olmalı, “Şimdilik Beklet” OLMAMALI.'],
    ['ogr_egitmensec', 'Eğitmen ayrı ekrandan seçiliyor', 'Paket Ata içinde “Eğitmen” satırına dokun → açılan listeden birini seç → ana forma dönsün.'],
    ['ogr_paket2adim', 'Paket 2 adımda seçiliyor', '“Üyelik Paketi” satırı → paketi seç → “İlerle” → ders sayısını (4/8/12) seç → “Seç”.'],
    ['ogr_direktpaket', 'Yeni üyeye direkt paket', 'Yeni üye sonrası “Ben Ders Paketi Tanımlayacağım” → eğitmen + paket seç → “Öğrenciye Ekle”. Kişi öğrenci olmalı.'],
    ['ogr_ikincipaket', 'Eski üyeye ikinci paket', '“＋ Yeni Üyelik Oluştur” → “Eski Üye” → kişiyi seç → paket ata. Kişide 2. paket görünmeli.'],
    ['ogr_detay', 'Öğrenci detayını aç', 'Öğrenciler listesinde bir satıra dokun → üyelik detayı açılmalı.'],
    ['ogr_kartlar', 'Paket kartları doğru', 'Detayda her paket ayrı kart; kalan ders ve kalan ödeme barları doğru görünmeli.'],
    ['ogr_paketiptal', 'Paketi iptal et', 'Detayda bir paketin “Paketi İptal” → onayla. Paket kalkmalı; son paketse kişi Potansiyele dönmeli.'],
    ['ogr_duzenle', 'Öğrenci bilgisini düzenle', 'Satırdaki ✎ → ad/soyad/telefon değiştir → kaydet. Güncellenmeli.'],
    ['ogr_sil', 'Öğrenci sil', 'Satırdaki 🗑️ → onayla. Kişi listeden kalkmalı.'],
    ['ogr_sekme', 'Sekmeler ve sayaçlar', '“Öğrenciler” ve “Potansiyel” sekmeleri arasında geç; üstteki sayılar doğru olmalı.'],
  ]},
  { ad: '3) Dersler — Planla, gerçekleştir', ikon: '📅', maddeler: [
    ['drs_olustur', 'Ders oluştur', 'Dersler → “＋ Ders Oluştur” → ders adı + Eğitmen (ayrı ekran) + “Öğrenci Seç/Ekle” (çoklu, ayrı ekran).'],
    ['drs_tarihsaat', 'Tarih ve saat girişi', 'Tarihi takvimden seç; saat kutusuna 0930 yaz → 09:30 olmalı → “Dersi Planla”.'],
    ['drs_planlanan', 'Planlanan sekmesi', 'Ders “Planlanan” sekmesinde görünmeli; yanında sarı “B” rozeti olmalı.'],
    ['drs_gerceklesti', 'Tek öğrencide gerçekleşti', 'Tek öğrencili dersin “B” rozetine dokun → “Gerçekleşti”. Öğrencinin kalan dersi 1 azalmalı.'],
    ['drs_katilim', 'Grup dersinde katılım', 'Çok öğrencili dersi “Gerçekleşti” yap → “Kimler Katıldı?” açılmalı → gelmeyeni işaretten çıkar → sadece katılanlardan 1’er ders düşmeli.'],
    ['drs_iptal', 'Ders iptali', 'Rozet → “İptal”. Ders “İptal” sekmesine geçmeli; kimseden ders düşmemeli.'],
    ['drs_sil', 'Dersi sil', 'Rozet → “Dersi Sil” → onayla. Ders kalkmalı; gerçekleşmişse düşen dersler iade edilmeli.'],
    ['drs_rozet', 'Rozet renkleri', 'B sarı, G yeşil, İ kırmızı görünmeli.'],
  ]},
  { ad: '4) Ödemeler — Tahsilat', ikon: '💰', maddeler: [
    ['ode_al', 'Ödeme al', 'Ödemeler → “＋ Ödeme Al” → müşteriyi ara-seç → tutar + tarih + tür (Nakit/Kart/Havale) → “Ödemeyi Kaydet”.'],
    ['ode_fifo', 'Borç en eskiden düşüyor', 'Ödeme sonrası öğrencinin en eski paketinin kalan ödemesi azalmalı (FIFO).'],
    ['ode_donuk', 'Kalan borç donuyor', 'Aynı kişiye iki ödeme yap. Eski satırın “Kalan Borcu” DEĞİŞMEMELİ; sadece yeni satır güncel olmalı.'],
    ['ode_detay', 'Detayda ödeme güncel', 'Ödemeden sonra öğrenci detayında kalan ödeme azalmış olmalı.'],
    ['ode_sil', 'Ödeme sil', 'Ödeme satırındaki 🗑️ → onayla. Silinen tutar öğrencinin borcuna geri eklenmeli.'],
  ]},
  { ad: '5) Ayarlar & Yedek', ikon: '⚙️', maddeler: [
    ['ayr_firma', 'Firma adı / logo', 'Ayarlar › Firma → ad ve logo değiştir → kaydet. Menü ve başlıkta güncellenmeli.'],
    ['ayr_bulut', 'Bulut senkron (varsa)', 'Bulut bağlıysa: bir cihazda değişiklik yap, başka cihaz/oturumda aynı veriler görünmeli.'],
    ['ayr_yedek', 'Yedekle / geri yükle', 'Ayarlar › Yedekleme → dosyayı indir; sonra aynı dosyayı geri yükle. Veriler yerine gelmeli.'],
  ]},
  { ad: '6) Genel & Görünüm', ikon: '✨', maddeler: [
    ['gen_blur', 'Arka plan bulanık', 'Herhangi bir açılır pencere aç → arka plan bulanık olmalı (turuncu değil).'],
    ['gen_autofill', 'Otomatik-tamamlama kapalı', 'Ad/telefon kutularına dokun → Chrome’un isim/telefon önerisi balonu ÇIKMAMALI.'],
    ['gen_bicim', 'Telefon & tutar biçimi', 'Telefon 505-033-41-27 gibi; tutar yazarken 1.000 gibi noktalı olmalı.'],
    ['gen_surum', 'Sürüm ve güncelle düğmesi', 'Sol altta sürüm no + tarih/saat + ⟳ güncelle düğmesi görünmeli.'],
    ['gen_tema', 'Tema değişimi', 'Sağ üstteki 🌙 ile açık/koyu tema geçişi çalışmalı.'],
    ['gen_mobil', 'Mobil menü', 'Telefonda alt sekme çubuğu ve ☰ menü çalışmalı.'],
    ['gen_panel', 'Kontrol paneli', 'Bu panel açılıp kapanmalı; işaretlerin uygulamayı kapatıp açınca durmalı.'],
  ]},
];
/* Yaptığım güncelleme notları — istek metnine göre eşleşir, ilgili maddenin altında otomatik görünür */
const KL_GUNCELLEME = [
  { q: 'formun içinde form', not: 'Bir dizi düzeltme + yeni: (1) Pencereler artık içeriğe göre boyutlanıyor — İşlem Yap dahil formlar kaydırma gerekmeden tek ekrana sığıyor; Grup Dersi/Gider Seç gibi listeler “yarım/dev boş kutu” yerine içeriğe göre açılıyor. (2) Dashboard/Ortaklar “Aktif Öğrenci” artık eğitmene bağlı kayıtlı öğrencileri sayıyor (önce yalnızca o ay gerçekleşen dersteki öğrencileri sayıyordu → 0 görünüyordu). (3) Komisyon düzenleme formu premium tasarıma geçti (eski tablo/görünüm kaldırıldı). (4) Tablolarda kalem+çöp yerine tek “Düzenle” butonu; silme ilgili düzenleme formunun altına taşındı (Öğrenci, Gelir/Gider). (5) Ders Oluştur’da saat alanı düz kutu yerine kaydırmalı saat/dakika seçicisine bağlandı. (6) Giriş ekranında “Demo uygulama” uyarısı + “Ana ekrana nasıl eklenir?” yardımı (iPhone/Android adımları). (7) WhatsApp/sosyal paylaşımda karmaşık link yerine premium önizleme kartı (Open Graph başlık/açıklama/kapak görseli) + PWA manifest & ikonlar → ana ekrana ekleyince tam ekran uygulama gibi açılır.' },
  { q: 'istek ve öneri', not: 'Yeni “İstek ve Öneri” bölümü eklendi (kullanıcıların aksaklık/istek iletmesi için). Üst panel yenilendi: firma (GV) yanında kullanıcının fotoğrafı + adı soyadı; en sağda “Güncelle” (uygulamayı en son sürüme yeniler) ve “Destek” (İstek ve Öneri) ikonları. Destek ikonuna basınca önce Talepler listesi açılır (Tarih/Saat · Talep eden · Talep başlığı · Durum); herkes tüm talepleri görür. “Yeni İstek Oluştur” → sayfa seç (Diğer dahil) · başlık · geniş açıklama → Gönder. Bir talebe basınca detay açılır; yalnızca admin cevap yazabilir, cevap herkese görünür (yeşil kutu). Talepler buluta da senkronlanır.' },
  { q: 'gelirde varsayılan eğitmen', not: 'Bir dizi iyileştirme: (1) Ortak giriş yapıp üye oluşturursa varsayılan eğitmen kendisi olur (potansiyel aşamasında bile). (2) Bir derste birden fazla öğrenci varsa tablolarda isim yerine “Grup Dersi” yazar; satıra basınca öğrencilerin listelendiği modal açılır. (3) Dersler “Gerçekleşen” durum pili tabloya sığmıyordu → kompakt “✓ Yapıldı” yapıldı, sütunlar dengelendi. (4) Öğrenci Düzenle genişletildi: ad/soyad/telefon + eğitmen + paket alanları (paket adı, toplam ders, fiyat) düzenlenebilir; kalan ders / kalan ödeme salt-görüntü. (5) Ders Düzenle eklendi (durum menüsünde “Dersi Düzenle”): öğrenciler/ad/eğitmen/tarih/saat düzenlenebilir + Sil. (6) Hesaplar’da iki ayrı “Gelir/Gider Ekle” yerine tek “İşlem Yap” kartı; açılan modalda üstte Gelir/Gider geçişi (animasyonlu), ödeme yöntemi (Gelir: Havale/Nakit/Kart · Gider: Banka/Nakit/Kart), tarih (bugün), Gelir’de öğrenci seç / Gider’de gider seç, açıklama (tutardan önce), tutar, ait olduğu kişi (Gider’de “Tüm ortaklar”, Gelir’de öğrencinin eğitmeni varsayılan).' },
  { q: 'tüm açılan formları', not: 'Tüm açılan formlar/modallar tek premium dile geçti: üstte ince altın hairline, sıcak krem-gold kart, arka perde koyulaşıp hafifçe bulanıklaşıyor (backdrop-blur), açılışta aşağıdan yükselip minik yaylanma animasyonu, yuvarlak kapatma düğmesi. Başlık rozetleri ve seçim satırları artık emoji değil elle çizilmiş SVG ikon + altın tile (Yeni Üye=filiz, Eski Üye/Kişi, Üyelik/Paket=bilet, Onay=tik, Link, Saat, Giriş=anahtar, Belge, Banka/Kasa/Kart, Gelir/Gider). Seçim satırları renk-kodlu (ana=altın, onay=yeşil, link=mavi, bekleme=gri). Kaydet/Devam/Sil düğmelerinde ikon; Sil onay kutusu premium ortalanmış tasarıma geçti (kırmızı çöp ikonu). Form içi ödeme şekli (Banka/Nakit/Kart), tarih ve “Tüm ortaklar” çipleri de çizili ikonlu.' },
  { q: 'sayfalar kısmı boş kalıyor', not: 'Ortak (partner) girişi düzeltmeleri: (1) Alt menüde ortağa yalnızca “Panel” görünüyordu (kod hatası — olmayan bir id aranıyordu). Düzeltildi: ortak artık Panel · Öğrenciler · Dersler · Hesaplar · Ortaklar sekmelerini görüyor; yalnızca Tanımlar gizli. (2) Gösterge Paneli’nden “Ortakları göster” anahtarı kaldırıldı (ortak panelde zaten yalnızca kendini görüyor; mobilde fazladan satır açıyordu). (3) Kalan sayfalarda (Öğrenciler/Dersler/Tahsilatlar) “Ortakları göster” küçültülüp yalnız ikon + mini anahtar haline geldi; sekmelerin altında ekle düğmesiyle aynı satıra sığıyor.' },
  { q: 'burası böyle olmuş', not: 'Düzeltme: Hesaplar tablosunda mobilde “İşlem Adı” sütunu gizlenince tablonun sağında boş bir şerit kalıyordu (gizlenen sütunun payı boşta kalıyordu). Kalan sütunlar %100’e yeniden dağıtıldı; tablo artık kartı tam dolduruyor ve “Açıklama” sütunu genişledi.' },
  { q: '2 2 olsun satırlar çok küçük', not: 'Mobilde birkaç düzeltme: (1) Ortaklar sayfası 4 sütun yerine 2×2 kart düzenine geçti — kartlar artık daha büyük; bir ortak kartı açılınca 2 satır yükseklik alıp diğer kartlar yumuşak/akıcı şekilde etrafından kayıyor. (2) Hesaplar (Banka/Kasa/Kart) tablosunda dar ekranda “İşlem Adı” sütunu gizlendi; gelir/gider ayrımı Tutar rengiyle zaten belli, sütunlar rahatladı. (3) Öğrenciler tablosunda ayrı “Eğitmeni” sütunu kaldırıldı; eğitmen artık öğrenci adının altında küçük (avatar + kısa ad) yazıyor. (4) Bir şeye dokununca çıkan sarı/gri renklenme ve kısa gecikme kaldırıldı (Tanımlamalar satırları anında geçiyor) — “donuyor” hissi gitti.' },
  { q: 'tüm tabloların genişlikleri aynı', not: 'Öğrenciler/Dersler 880px, Tahsilatlar/Giderler 980px idi; sayfa geçişinde tablo genişliği zıplıyordu. Hepsi en geniş olana (980px) eşitlendi — artık geçişte oynamıyor.' },
  { q: 'giriş paneli daha akıcı', not: 'Giriş ekranı premium/gold yapıldı: “GV” kutusu yerine logodaki fontta (Quicksand) “Green Village Pilates” yazı-logosu; koyu ışık-haleli zemin, altın çerçeveli koyu cam kart, gold ikonlu alanlar (placeholder’lar soluk “Kullanıcı Adı :” / “Şifre :”), parlayan gold “Giriş Yap”. Giriş yapınca doğrudan uygulamaya atlamıyor; animasyonlu bir loading screen (gold dönen halka + “Hazırlanıyor…”) çıkıyor, veriler/bulut yüklenince uygulama açılıyor.' },
  { q: 'loading screen açılsın', not: 'Giriş sonrası animasyonlu loading screen eklendi (wordmark + gold halka + “Hazırlanıyor…”); bu sırada veriler yükleniyor, sonra uygulama açılıyor.' },
  { q: 'grup başlığında gitsin', not: 'Kontrol Listesi yeniden düzenlendi: “Yeni Eklenenler” yığını kaldırıldı; yeni maddeler artık kendi ANA başlığının grubuna giriyor (yerleşik grup varsa ona ekleniyor, yeni başlık kendi grubu oluyor). Ana başlık altında ALT başlık kademesi var. Ayrıca maddenin “akışı” (İstek→Yapıldı→Geri bildirim + not) madde içinde akordeon oldu: madde kapalı gelir, üstüne basınca akış açılır; ✗’e basınca otomatik açılıp not kutusu gelir. Başlıklar sabit. Yeni eklerken Ana + Alt başlık seçiliyor.' },
  { q: 'o kısımlar daralsın', not: 'Maddenin altındaki akış (cevap/geçmiş) artık akordeon: kapalı gelir, maddeye basınca açılır. Başlıklar daralmıyor.' },
  { q: 'aynı boyutta olsun', not: 'Tüm veri-giriş ve seçim pencereleri tek standart boya getirildi (Gider, Ders, Tahsilat, Yeni Üyelik/Üye, Paket Ata/Seç, Üye Seç, Ortak/Üyelik/Gider tanımı, Kullanıcı Girişi, Öğrenci Düzenle/Detay). Adımlar arası artık büyüyüp küçülmüyor; footer düğmeleri de eşit yükseklikte. Gider formu bu boyla yeterince uzadığı için “Giderin Ait Olduğu Kişi” alanı artık kaydırmasız görünüyor. Küçük “Sil?/Onay” kutuları küçük kaldı. (Prompt’a 11. kural olarak eklendi.)' },
  { q: 'altta kalmış', not: 'Formlar standart (daha uzun) boya alındığı için Gider formundaki “Ait Olduğu Kişi” alanı artık altta sıkışmıyor, tam görünüyor; tüm formlar aynı boyutta.' },
  { q: 'takvim uygulamaya özel', not: 'Gider formundaki tarih alanı, Dersler/Tahsilatlar’daki gibi uygulamaya özel takvime çevrildi (native tarih kutusu kaldırıldı). Bundan sonra formlarda bu takvim kullanılacak (Prompt kurallarına 10. madde olarak eklendi).' },
  { q: 'tık diye', not: 'Gider Seç ekranı artık “tık” diye değil, kayarak (animasyonlu) açılıp kapanıyor.' },
  { q: 'aynısı gibi dursun', not: 'Gider Ekle ile Gider Seç ekranları artık birebir aynı boyutta (kutu yeniden yaratılmıyor, gövde sabit yükseklikte, ikisinde de aynı yükseklikte footer var) — geçişte kutu oynamıyor.' },
  { q: 'gider seçilirken genişleme olmasın', not: 'Gider Grubu seçimi artık formu genişletmiyor; “Gider Ekle” ile aynı boyutta ayrı bir “Gider Seç” ekranına dönüşüyor (arama + gruplu liste). Seçince forma geri dönülüyor ve girilen tarih/açıklama/ödeme/tutar/kişi korunuyor.' },
  { q: 'prompt oluştur düğmesi yeni ile kontrolünkü ayrı', not: 'Kontrol Listesi’nde Prompt butonu sekmeye göre ayrıldı: Kontrol sekmesinde “Kontrol Promptu” (yalnız sorunlar + düzeltmeler), Yeni sekmesinde “Yeni İstek Promptu” (yalnız yeni istekler). Birine basınca ikisi birden gelmiyor.' },
  { q: 'giderleri herkes yönetebilir', not: 'Giderler sayfası artık yalnızca admine özel değil; ortaklar da girip gider ekleyip yönetebiliyor.' },
  { q: 'ödemeler sayfasının adı tahsilatlar', not: '“Ödemeler” sayfası “Tahsilatlar” olarak yeniden adlandırıldı (menü, sayfa başlığı ve “Tahsilat Al” düğmesi).' },
  { q: 'işletmenin yapılan harcamalarını', not: 'Yeni “Giderler” sayfası eklendi (menüde admin’e 💸 Giderler). Tablo: Tarih · Gider Grubu · Açıklama · Ödeme Şekli · Tutar · Ait Olduğu Kişi. “Gider Ekle” penceresi: Tarih (otomatik bugün), Gider Grubu (tanımlı giderlerden gruplu açılır liste), Açıklama (elle), Ödeme Şekli (Banka/Nakit/Kredi Kartı), Tutar (yazarken otomatik nokta), Ait Olduğu Kişi (varsayılan Tüm ortaklar; istenirse tek ortak). Ortaklar sayfasında “Tüm ortaklar” gideri eşit bölünür, tek ortak seçilen tamamen o ortağa yazılır.' },
  { q: 'sütunlarda genişliyor', not: 'Tablolar sabit sütun düzenine (table-layout:fixed + oransal sütun genişlikleri) geçirildi. Artık “Ortakları göster” açılıp kapanınca sütunlar genişleyip daralmıyor; yalnızca satırlar ekleniyor/çıkıyor.' },
  { q: 'başlıklara yenileri eklenmiyor', not: 'Kontrol › Yeni’de “Başlık” menüsü artık senin eklediğin özel başlıkları da (✨ ile) listeliyor; oluşturduğun başlığı tekrar seçebiliyorsun.' },
  { q: 'solda açılan sayfalar', not: 'Sol menü açık/sıcak temaya çevrildi; “Ayarlar” grubu kaldırılıp Firma Bilgileri, Ortak Bilgileri, Üyelikler ve Giderler tek “Tanımlamalar” sayfasında toplandı.' },
  { q: 'ortakların ilgili ay', not: 'Yeni “Ortaklar” sayfası eklendi: ay seçimli büyük kare kartlar; tıkla-aç ile Aktif Öğrenci, Verdiği Ders, Tahsil Edilen, Kalan Alacağı, Giderler Payı (eşit bölüşüm), Komisyon (0) ve Verilecek Pay (tahsilat − gider − komisyon). Ortak fotoğrafları isimlerin yanında da gösteriliyor.' },
  { q: 'altın çerçeve', not: 'Kapalı karttaki “Verilecek Pay” özeti alt alta dizildi (tutar taşmıyor). Bir kart açıkken yanındaki kapalı kartların altında kalan beyazlık giderildi (kartlar esnemiyor). Akordeon: aynı anda tek ortak açık; açık olanın etrafı altın çerçeve, başkasına tıklayınca o kapanıp tıklanan açılıyor.' },
  { q: 'açılan yapıdaki', not: 'Açık ortak kartındaki “Verilecek Pay” kutusu da alt alta dizildi (etiket üstte, tutar altta büyük ve ortalı) → büyük tutarlar taşmıyor.' },
  { q: 'sığmamış', not: 'Kapalı karttaki “Verilecek Pay” özeti alt alta dizildi (tutar taşmıyor). Bir kart açıkken yanındaki kapalı kartların altında kalan beyazlık giderildi. Akordeon: aynı anda tek ortak açık ve etrafı altın çerçeve.' },
  { q: 'tanımlamalar düğmesi', not: 'Firma ve Ortak Bilgileri sayfaları Üyelikler/Giderler gibi sola hizalandı ve açılışta tnmGir animasyonuyla geliyor. Firma’daki kocaman/hatalı “‹ Tanımlamalar” düğmesi, Üyelikler’deki gibi küçük hap düğmeye çevrildi.' },
  { q: 'akışı anlatarak', not: 'Kontrol Listesi artık döngü çalışıyor: her madde İstek → Yapıldı → Geri bildirim → Yapıldı… zinciri olarak birikiyor. ✗ ile açıklama eklersin, “Prompt Kopyala” bu zinciri konuşma gibi (İSTEK/YAPILDI/GERİ BİLDİRİM) anlatarak üretir; ✓ ile onaylayana kadar döngü sürer.' },
  { q: 'döngü gitsin', not: 'Kontrol Listesi artık döngü çalışıyor: madde İstek → Yapıldı → Geri bildirim zinciri olarak birikiyor; Prompt Kopyala akışı anlatarak üretiyor, ✓ onaya kadar sürüyor.' },
  { q: 'yeni kullanıcı ekle', not: 'Kullanıcı Girişleri eklendi (Tanımlamalar › Kullanıcı Girişleri, yalnızca admin): admin her ortağa kullanıcı adı + şifre verir, giriş aktif/pasif yapar. Ortak bu bilgilerle giriş yapar; varsayılan yalnızca KENDİ verilerini görür. Öğrenciler/Dersler/Ödemeler’de sağ üstte “Ortakları göster” düğmesi (varsayılan kapalı) — açınca diğer ortakların verileri de listelenir. Gösterge Paneli’nde ortak yalnızca kendini görür; Ortaklar sayfası aynen kalır; menüde Tanımlamalar/Kontrol ortak için gizli. Admin her yerde hepsini görür.' },
  { q: 'admin tarafından oluşturulacak', not: 'Ortaklara kullanıcı adı + şifre ile giriş (Tanımlamalar › Kullanıcı Girişleri) eklendi; ortak varsayılan kendi verisini görür, her sayfada “Ortakları göster” düğmesiyle diğerlerini de açabilir. Panelde yalnızca kendini görür, admin hepsini.' },
  { q: 'planlanan sarı', not: 'Dersler durum sütunundaki tek harf (B/G/İ), Ödeme türü hapı gibi renkli kelime hapına çevrildi: Planlanan sarı, Gerçekleşen yeşil, İptal kırmızı. Üstteki sekmeler de aynı renklerde; seçili olan parlıyor ve altın çerçeve alıyor. Hapa basınca yine durum değiştirme menüsü açılıyor.' },
  { q: 'dersler kartları', not: 'Dersler durumları renkli kelime hapı oldu (Planlanan sarı · Gerçekleşen yeşil · İptal kırmızı) ve sekmeler renklendirildi; seçili olan parlıyor + altın çerçeve.' },
  { q: 'pasifte kimse yokken', not: 'Pasif sekmesini boşken otomatik Aktif’e çeviren davranış kaldırıldı. Artık Pasif’e basınca sekme Pasif’te kalıyor ve “Pasif öğrenci yok.” mesajı gösteriliyor.' },
  { q: 'pasif öğrenciler', not: 'Öğrenciler sayfasına “Pasif” sekmesi eklendi (sıra: Aktif · Potansiyel · Pasif). Toplam kalan dersi 0’a düşen (dersi/üyeliği biten) öğrenciler otomatik Pasif’e düşüyor; “Paket Ata” ile tekrar aktif oluyor. Sekmeler renklendirildi: Aktif yeşil, Potansiyel sarı, Pasif kırmızı; seçili olan parlıyor ve altın çerçeve alıyor.' },
  { q: 'aktif öğrenci', not: 'Gösterge Paneli “Spotlight + İstatistik Şeridi” (C) tasarımıyla yeniden yapıldı — düz/kaba kartlar kaldırıldı, alttaki “Ekibimiz” bölümü çıkarıldı. Üstte büyük koyu hero: solda gold çerçeveli kişi (ad + rol/ay), sağda “Verilecek Pay” altın gradyan yazıyla + altında “Tahsilat − Giderler − Komisyon”; köşede ince altın halkalar. Altında tek panelde 6 istatistik hücresi (Aktif Öğrenci, Verdiği Ders, Tahsil Edilen, Kalan Alacak, Giderler Payı, Komisyon Gideri) — her hücrede kategori renginde sol vurgu şeridi, üstüne gelince › oku. Karta/satıra tıkla → ilgili sayfa; hero → Ortaklar. Ay seçimi + (ortak girişinde) “Ortakları göster” anahtarı: varsayılan yalnızca kendini görürsün, açınca tüm ortakların toplamı; admin hep hepsini görür.' },
  { q: 'ders takibi', not: 'Sol menü Ana ▸ Alt başlık olarak gruplandı: Gösterge Paneli (tekil, üstte öne çıkan) · Ders Takibi ▸ Dersler/Öğrenciler · Muhasebe ▸ Tahsilatlar/Giderler/Ortaklar · Ayarlar ▸ Tanımlamalar (yalnızca admin). Görsel iyileştirme: açık grubun başlığı altın tonlu zemin + sol altın şerit; alt öğeleri bağlayan ince altın kılavuz çizgisi ve her öğede altın nokta; seçili öğe yeşil. Gruplar akordeon (birine basınca açılır, diğeri kapanır); bir alt sayfaya gidince grubu otomatik açılır.' },
  { q: 'tek kodlama', not: 'Kontrol Listesi promptuna hızlandırıcı kurallar eklendi: (14) Toplu ilerle — birden çok madde varsa tek kontrol · tek kodlama · tek push; önizlemeler tek mesajda toplu, onaylananlar tek sürümde yayına. (15) Görsel olmayan işlerde (mantık/veri/metin/hata/yeniden adlandırma) önizleme atlanır. (16) Gereksiz ara-onay sorulmaz. (17) Toplu önizleme tek görselde sunulur. (18) “Tümünü onaylıyorum” kısayolu. (19) Sürüm/saat her yayında otomatik artar. (20) Riskli olmayan metin/kopya düzeltmeleri biriktirilip tek seferde uygulanır.' },
  { q: 'aynı ölçüde', not: 'Sayfa sekmeleri (Öğrenciler: Aktif/Potansiyel/Pasif · Dersler: Planlanan/Gerçekleşen/İptal) hepsi eşit sabit genişliğe (150px) getirildi — hem sayfa içinde hem sayfalar arasında aynı ölçüde. Ayrıca sağdaki aksiyon düğmeleri (＋ Yeni Üyelik Oluştur / Ders Oluştur / Tahsilat Al / Gider Ekle) de eşit genişliğe (176px, ortalı) getirildi. Dar ekranda sekmeler satırı eşit bölüşür, düğmeler tam genişlik olur.' },
  { q: 'ayırt edilemiyor', not: 'Seçili sekme belirginleştirildi: seçili olmayan sekmeler soluklaştırıldı (grileşir + saydamlaşır), seçili olan tam renkli + gold çerçeveli ve hafif büyük duruyor. Artık hangisinin seçili olduğu net.' },
  { q: 'önce öğrenci', not: 'Ders Oluştur akışı yeniden düzenlendi: sıra artık Öğrenci → Ders Adı → Eğitmen → Tarih/Saat. Açılışta hepsi boş. Öğrenci seçilince Ders Adı = öğrencinin paket adı, Eğitmen = öğrencinin eğitmeni otomatik gelir (istenirse elle değiştirilebilir; manuel değişiklik korunur).' },
  { q: 'ders seçmedeki gibi', not: 'Tahsilat (Ödeme Al) formundaki müşteri seçimi, Ders Oluştur’daki gibi “＋ Öğrenci Seç” düğmesiyle açılan aramalı listeye çevrildi (aynı görünüm, tek seçim). Seçince kalan borçlu özet kartı görünür; “Değiştir” ile yine aynı ekran açılır.' },
  { q: 'biraz küçült', not: 'Gider Ekle formundaki tüm alanlar/kartlar kompakt hale getirildi (Tarih, Gider Grubu, Açıklama, Ödeme Şekli, Tutar, Ait Olduğu Kişi) — sadece “Ait Olduğu Kişi” değil hepsi küçüldü; artık taşmadan sığıyor, ortak kartları tek satıra daha çok geliyor.' },
  { q: 'banka hareketleri', not: 'Muhasebe altına “Hesaplar” sayfası eklendi: Dersler’deki gibi 3 sekme — 🏦 Banka (Havale tahsilat + Banka gider), 💵 Nakit, 💳 Kart — her sekmede güncel bakiye rozeti, aktif olanın hareketleri. Tablo: Tarih · İşlem Adı · Açıklama · Şahıs · Tutar (+/−) · Güncel Bakiye (kronolojik işleyen bakiye). Her satırda ✎ düzenle + 🗑️ sil. “＋ Tahsilat Al” ve “＋ Gider Ekle” bu sayfada. Tahsilatlar ve Giderler menüden gizlendi (her şey buradan görünüyor); mobil alt menüde de Ödemeler yerine Hesaplar geldi.' },
  { q: 'havale mi kredi kartı', not: 'Uygulandı: Hesaplar tablosunda Gelir satırında Açıklama üstte ödeme türü (Havale / Kredi Kartı / Nakit), altında küçük 🎓 “paket - öğrenci” (ör. Single - Kerem Güllü). Komisyon satırında üstte “paket - öğrenci”, altında 📁 Banka Komisyonu. Aynı düzen Nakit ve Kart defterlerinde de. Gider formunda Tutar artık soldan yazılıyor (sağdan başlama kaldırıldı). Banka Komisyonunu ✎ ile açınca yalnızca Tutar değiştirilebiliyor (tarih/açıklama/ödeme şekli/kişi kilitli).' },
  { q: 'ilgili ortak diyelim', not: 'Uygulandı: Hesaplar tablosunda “Şahıs” sütunu “İlgili Ortak” oldu (3 tabloda da) — geliri kazanan/gideri üstlenen ortağın avatarı + adı; ortak yoksa “👥 Tüm ortaklar”. Açıklama’da ders(paket) altında küçük yeşil dersi alan öğrenci adı (🎓). Komisyon satırında Açıklama = geliri alan öğrenci, altında “📁 Banka Komisyonu”; İlgili Ortak = o eğitmen. Komisyonu ✎ ile açınca gider grubu “Banka Komisyonu” dolu ve kilitli geliyor (boş-gelme hatası düzeltildi), tutarı elle yazıyorsun. Aynı düzen Nakit ve Kart tablolarında da; arama ilgili ortağı da kapsıyor.' },
  { q: 'herkesden komisyon', not: 'Düzeltildi: Banka Komisyonu artık yalnızca o geliri kazanan eğitmenin “🏦 Komisyon Gideri” satırına yazılıyor; eskiden tüm ortakların “Giderler Payı”na eşit bölünüyordu — artık bölünmüyor, sadece ilgili ortaktan düşüyor. (Örn. öğrencisi kartla ödeyen Tuba’nın komisyonu yalnız Tuba’ya işleniyor, diğerlerinde 0.)' },
  { q: 'tl amblemine takılıyor', not: 'Düzeltildi: Gider (ve diğer) tutar kutularında rakam silme sorunu giderildi. Eskiden “300”ü “30” yapmaya çalışınca imleç sondaki “ ₺” amblemine takılıp siliyı engelliyordu; artık Backspace “ ₺”yi atlayıp rakamı siliyor ve imleç doğru rakamın yanında kalıyor.' },
  { q: 'banka kısmında', not: 'Uygulandı: Kredi Kartı ile GELİR → Banka hesabına yazılıyor; girilince otomatik boş “Banka Komisyonu” gideri oluşuyor (gelir silinince o da siliniyor). Kredi Kartı ile GİDER → Kart hesabında borç; ortak Giderler Payı’na sayılmıyor. Gider Seç en üstte “Kredi Kartı Borcunu Öde” (güncel borç) → Banka’dan ödeme olarak işleniyor, ortak giderine dahil olup borcu azaltıyor. Tabloda İşlem “Gelir/Gider” hapı; Açıklama altında küçük renkli satır (Gelir → eğitmen adı, Gider → gider grubu). Sekmelerin altına tüm sütunları kapsayan arama çubuğu. Ödenmemiş kart borcu, Verilecek Pay altında ve Ortaklar’da küçük notla gösteriliyor. “Tahsilat Al” → “Gelir Ekle”.' },
  { q: 'kasıyor', not: 'Akıcılık iyileştirmesi: kaydırma alanlarına momentum (touch) + overscroll-behavior:contain eklendi (kaydırma zincirlenmesi/donma önlenir); modal açıkken arka plan kaydırması kilitlenip gereksiz yeniden çizim durduruldu (form/sayfa açılışı daha akıcı). Tema/görünüm bozulmadı.' },
  { q: 'çıkış yap seçeneği', not: 'Tepe paneli (üst bar) yenilendi: sağ üstte gold çerçeveli kullanıcı görseli (ortağın fotoğrafı; yoksa baş harfleri, admin’de firma logosu/baş harf) + ad soyad + rol. Üstüne basınca açılan menüde başlıkta yine görsel + ad, ardından “Tema değiştir” ve kırmızı “Çıkış Yap”. Üstteki ayrı 🌙 tema düğmesi kaldırıldı (tema değiştirme artık bu menüde).' },
  { q: 'kalem ikonu', not: 'Kontrol Listesi promptuna 2 daimi kural eklendi: (12) Gold-premium tasarım — her yeni ekran/kart/eleman altın-premium dili taşısın; (13) Tutarlılık ve etkileşim — yeni eklenen kart/tablo öğeleri bir öncekiyle aynı ölçü/özelliği taşısın (Enter’la geçiş, animasyon, ₺ para biçimi), imleç kuralı (fotoğraf/düz metinde ok değişmez, metin girişinde metin imleci, düğmede el) ve tablolarda her kayıtta ✎ düzenle + 🗑️ sil.' },
  { q: 'giderlerini inceleye', not: 'Uygulandı: Menüye “Raporlar › Giderler Raporu” eklendi. İlgili ay seçilir; giderler gruplara göre listelenir, her grup başlığında grup toplamı, en altta koyu “Dip Toplam”. Bir gruba basınca açılıp kapanır; bir kaleme (ör. Kırtasiye) basınca o kalemin seçili aydaki kayıtları hesap defteri formunda (tarih · açıklama · ödeme · tutar) açılır. Sağ üstteki “⇄ Karşılaştır” anahtarı açılınca tablo: 1. sütun Tanımlamalardaki gider başlıkları (grup+kalem), sonraki sütunlar 2 ay öncesi · 1 ay öncesi · güncel ay; grup alt-toplamları ve dönem dip toplamlarıyla.' },
  { q: 'tepede 4 kart', not: 'Uygulandı: Gösterge Paneli yeniden tasarlandı. En üstte 4 toplam kart — Hak Ediş · Banka · Kasa · Kredi Kartı Borcu (her kullanıcıda aynı toplamlar). Altında ekran 3 sütun: Sol’da ilgili ortağın tek kartı (Ortaklar sayfasıyla birebir — kare fotoğraf + isim, basınca açılan detay); Orta’da Dersler (yalnız bugün ve yarın, fazlası “Tüm dersler →”); Sağ’da Öğrenciler (Aktif / Potansiyel / Pasif sayıları, satıra basınca Öğrenciler sayfası ilgili sekmede açılır). Sıcak yeşil/kum/gold premium dil korundu; dar ekranda sütunlar alt alta iner.' },
  { q: 'mobile uyumlu', not: 'Uygulandı: Tüm sayfalar mobil uyumlu hale getirildi. Tablolar mobilde artık “kart”a dönüşmüyor; PC’deki tablo boyutunda kalıp ekrana ORANTILI küçültülüyor (tüm sütunlar görünür, kırpma/yatay kaydırma yok; sayfa hiçbir yerde yana kaymıyor). Yumuşak sayfa geçişleri (fade + hafif yukarı kayma) eklendi. Yerleşim: Gösterge Paneli’nde 4 kart tek üst satır + altta 3 sütun (foto/dersler/öğrenciler); Dersler ve Üyelikler’de 3 sekme + aksiyon düğmesi eşit boyda tek satır; Hesaplar tek satır 4 sütun (Banka/Kasa/Kart + 4. sütunda Gelir/Gider Ekle altlı-üstlü); Ortaklar 4 sütun; Giderler Raporu’nda Karşılaştır düğmesi ay-seçicinin yanında tek satır.' },
  { q: 'tl amblemi', not: 'Düzeltildi: Para (₺) değerleri artık hiçbir yerde alt satıra kırılmıyor — ₺ amblemi her zaman rakamla aynı satırda kalıyor. Ayrıca Giderler Raporu’nda tutarlar tek sütunda sağa hizalandı (₺’ler alt alta), “kayıt” sayıları ve › okları da hizalı. Ve telefonun altına tüm sayfalar için geçiş çubuğu eklendi (Panel · Öğrenciler · Dersler · Hesaplar · Ortaklar · Tanımlar) — girişten sonra doğru çiziliyor (önceden yalnızca “Panel” görünüyordu).' },
  { q: 'öğrenciler kısmı gözükmesin', not: 'Uygulandı: Gösterge Paneli’nden Öğrenciler bölümü kaldırıldı (hem PC hem mobil). Artık 2 sütun: solda ilgili ortak kartı, sağda Dersler (takvim) — Dersler büyütüldü. Ayrıca: (1) Alt geçiş çubuğunda basılan sayfanın düğmesi artık doğru vurgulanıyor (eskiden hep Panel’de kalıyordu). (2) Öğrenciler tablosunda “Kalan Ders/Ödeme” çubukları sütuna sığdırıldı, iç içe girmiyor. (3) Sayfa geçişinde tablolar boya öncesi (senkron) ölçekleniyor; büyük tablo bir an görünüp küçülmüyor (titreme giderildi).' },
  { q: 'çöp kutusu ve kalem', not: 'Düzeltildi: Tablolarda ✎ (düzenle) ve 🗑️ (sil) düğmeleri artık verinin üzerine binmiyor. Neden: düğmeler PC boyutunda aksiyon sütununa sığmayıp sola taşıyordu (ör. Öğrenciler’de Kalan Ödeme’yi kapatıyordu). Düğmeler biraz küçültüldü, aksiyon sütunları genişletildi (Öğrenciler, Hesaplar, Müşteriler/cari, Gider detay tablolarında) ve uzun tutarlar gerekirse alt satıra sarıyor. Tüm tablolar kontrol edildi.' },
  { q: 'ay seçme çubuğu ve ortakları', not: 'Uygulandı: Ay seçme çubuğu ve “Ortakları göster” düğmesi tüm sayfalarda tek premium tasarıma geçti. Ay çubuğu: altın gradyan çerçeve + hafif ışıltı, oklar premium yuvarlak düğme (üstüne gelince altın dolgu), ay adı büyük serif ve altında yıl altın harflerle; Giderler Raporu’ndaki ayrı ay çubuğu da bununla birleşti. “Ortakları göster”: solda yuvarlak 👥 ikon + metin + premium altın anahtar (açıkken altın gradyan track, ikon altınlaşır, hafif altın halka ışıltısı). Sıcak yeşil/kum/gold tema korundu; koyu tema uyumu da eklendi.' },
  { q: 'sayfalar çubuğu da premium', not: 'Uygulandı: Alttaki sayfa geçiş çubuğu premiumlaştırıldı — sıcak krem gradyan zemin + üstte ince altın hairline çizgi, aktif sekme yeşil premium tile + altın halka ışıltısı (hafif kalkık), merkez “Panel” altın çerçeveli premium kutu; etiketler daha belirgin. Ayrıca dokununca çıkan gri highlight/gölge kaldırıldı (-webkit-tap-highlight-color: transparent + düğmelerde metin seçimi kapalı) — mobilde “kasma” hissi giderildi. Koyu tema uyumu eklendi.' },
  { q: 'dashboarddaki tasarımı açılış', not: 'Uygulandı: Gösterge Paneli açılış ekranı gibi premiumlaştırıldı — 4 kart koyu cam + altın çerçeve, köşede renkli ışıltı + altın halka, değerler beyaz-altın serif. Emojiler kaldırılıp uygulamaya özel elle çizilmiş altın SVG ikonlar geldi (para kesesi/banka/banknot/kart, kişi, takvim, madeni para vb.). Ayrıca: (1) Arka plan A — sıcak degrade + üstte yumuşak altın halo. (2) Tüm tablolar premium gold oldu: üstte altın hairline, zengin altın başlık + iç ışıltı, altın zebra satırlar, altın ayraçlar. (3) Sayfa emojileri elle çizilen SVG ikonlarla değiştirildi: sol menü + alt geçiş çubuğu, Tanımlamalar hub kartları, bölüm başlıkları, ortak/dashboard detay satırları, arama kutuları, hesap defteri alt-etiketleri ve “Tüm ortaklar” hapı. (Yalnız açılır menü seçeneklerinde emoji kalır — teknik olarak SVG konamıyor.) Sıcak yeşil/kum/gold tema ve koyu tema korunur.' },
];
function klGuncellemeBul(metin) {
  const n = (metin || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
  const e = KL_GUNCELLEME.find(x => n.includes(x.q));
  return e ? e.not : '';
}
// Bir "yeni istek" maddesinin döngü zinciri: Yapıldı + (Geri bildirim → Yapıldı)…
// (ilk İSTEK satırı satırın kendi metnidir, buraya dahil değil)
function klZincir(y) {
  const z = [];
  const y0 = klGuncellemeBul(y.metin); if (y0) z.push({ rol: 'yapildi', metin: y0 });
  (y.geriler || []).forEach(g => {
    const gm = typeof g === 'string' ? g : (g && g.metin) || '';
    if (!gm) return;
    z.push({ rol: 'geri', metin: gm });
    const yg = klGuncellemeBul(gm);
    z.push({ rol: 'yapildi', metin: yg || 'Uygulandı ✓' });   // gönderilen her geri bildirim ele alınmıştır → tamamlandı göster
  });
  return z;
}
let KL_DURUM = {};       // {id:{d:'ok'|'no', n:'not'}}
let KL_ACIK = new Set(); // akışı açık maddeler (id) — madde içi akordeon
let KL_YENI = [];        // [{id, baslik, altBaslik, metin, geriler:[], gonderildi}] — kullanıcının eklediği istekler + döngü
let KL_TAB = 'kontrol';  // 'kontrol' | 'yeni'
let KL_GOSTER = false;   // tamamlananları göster (varsayılan gizli)
function klYukle() {
  try { KL_DURUM = JSON.parse(localStorage.getItem('yt_kontrol') || '{}') || {}; } catch { KL_DURUM = {}; }
  try { KL_YENI = JSON.parse(localStorage.getItem('yt_kontrol_yeni') || '[]') || []; } catch { KL_YENI = []; }
  KL_GOSTER = localStorage.getItem('yt_kontrol_goster') === '1';
}
function klKaydet() { try { localStorage.setItem('yt_kontrol', JSON.stringify(KL_DURUM)); } catch {} }
function klYeniKaydet() { try { localStorage.setItem('yt_kontrol_yeni', JSON.stringify(KL_YENI)); } catch {} }
function klBekleyen() { return KL_YENI.filter(y => !y.gonderildi); }        // Yeni sekmesindeki (henüz prompt'a verilmemiş)
function klGonderilen() { return KL_YENI.filter(y => y.gonderildi); }       // Kontrol'e taşınmış
function klGruplar() {   // Ana başlık → Alt başlık → maddeler (yeni istekler kendi grubuna girer)
  const anaMap = new Map();
  const anaEkle = (ad, ikon) => {
    if (!anaMap.has(ad)) anaMap.set(ad, { ad, ikon: ikon || '✨', altMap: new Map(), altSira: [] });
    const a = anaMap.get(ad); if (ikon && a.ikon === '✨') a.ikon = ikon; return a;
  };
  const altEkle = (ana, altAd, md) => {
    const key = altAd || '';
    if (!ana.altMap.has(key)) { ana.altMap.set(key, []); ana.altSira.push(key); }
    ana.altMap.get(key).push(md);
  };
  for (const g of KONTROL_LISTE) { const ana = anaEkle(g.ad, g.ikon); for (const m of g.maddeler) altEkle(ana, '', { id: m[0], metin: m[1], alt: m[2] || '' }); }
  for (const y of klGonderilen()) { const ana = anaEkle(y.baslik || 'Genel', '✨'); altEkle(ana, y.altBaslik || '', { id: y.id, metin: y.metin, yeni: true, zincir: klZincir(y) }); }
  return [...anaMap.values()].map(a => ({ ad: a.ad, ikon: a.ikon, altlar: a.altSira.map(k => ({ alt: k, maddeler: a.altMap.get(k) })) }));
}
function klSayac() {
  let top = 0, ok = 0, no = 0;
  const say = (id) => { top++; const d = KL_DURUM[id]; if (d && d.d === 'ok') ok++; else if (d && d.d === 'no') no++; };
  for (const g of KONTROL_LISTE) for (const m of g.maddeler) say(m[0]);
  for (const y of klGonderilen()) say(y.id);
  return { top, ok, no };
}
function kontrolKur() {
  if (document.getElementById('klPanel')) return;
  klYukle();
  const perde = document.createElement('div');
  perde.id = 'klPerde'; perde.className = 'kl-perde'; perde.onclick = kontrolKapat;
  const panel = document.createElement('aside');
  panel.id = 'klPanel'; panel.className = 'kl-panel';
  document.body.appendChild(perde);
  document.body.appendChild(panel);
}
function kontrolAc() { kontrolKur(); klCiz(); document.body.classList.add('kl-acik'); }
function kontrolKapat() { document.body.classList.remove('kl-acik'); }
function klRowHTML(md) {
  const d = KL_DURUM[md.id] || {}; const durum = d.d || '';
  const zincir = (md.zincir || []).map(t => t.rol === 'yapildi'
    ? `<div class="kl-tur yap"><span class="rol">✅ Yapıldı</span>${kacar(t.metin)}</div>`
    : `<div class="kl-tur ger"><span class="rol">↩ Geri bildirim</span>${kacar(t.metin)}</div>`).join('');
  const yerTut = md.yeni ? 'Yeni geri bildirim ekle…' : 'Sorunu kısaca yaz…';
  const noteHTML = durum === 'no' ? `<div class="kl-note"><textarea data-note="${md.id}" placeholder="${yerTut}" rows="2">${kacar(d.n || '')}</textarea></div>` : '';
  const akisHTML = (zincir || noteHTML) ? `<div class="kl-akis">${zincir}${noteHTML}</div>` : '';
  const acilir = !!akisHTML;                       // altında akış/not var mı → açılabilir
  const acik = acilir && KL_ACIK.has(md.id);
  const istekEt = md.yeni ? '<span class="kl-tur-rol istek">İstek</span>' : '';
  const akisRoz = (md.zincir && md.zincir.length) ? '<span class="kl-akis-say">akış</span>' : '';
  const ok = acilir ? '<span class="kl-rok">›</span>' : '<span class="kl-rok bos"></span>';
  return `<div class="kl-row ${durum === 'ok' ? 'ok' : ''}${acik ? ' acik' : ''}${acilir ? ' acilir' : ''}" data-id="${md.id}">
      <div class="kl-rbas"${acilir ? ` data-rowtgl="${md.id}"` : ''}>${ok}<span class="kl-mt">${istekEt}${kacar(md.metin)}${md.yeni ? '<span class="kl-yroz">yeni</span>' : ''}${md.alt ? `<small>${kacar(md.alt)}</small>` : ''}</span>${akisRoz}
        <span class="kl-ibs"><button type="button" class="kl-ib ok ${durum === 'ok' ? 'sec' : ''}" data-k="ok" title="Çalışıyor / Onayla">✓</button><button type="button" class="kl-ib no ${durum === 'no' ? 'sec' : ''}" data-k="no" title="Sorun var / Geri bildirim">✗</button></span>
      </div>${akisHTML}</div>`;
}
function klKontrolGovde() {
  const durumOf = (id) => (KL_DURUM[id] && KL_DURUM[id].d) || '';
  const html = klGruplar().map(g => {
    const tumMd = g.altlar.reduce((s, a) => s.concat(a.maddeler), []);
    const top = tumMd.length;
    let go = 0, gn = 0; tumMd.forEach(md => { const dd = durumOf(md.id); if (dd === 'ok') go++; else if (dd === 'no') gn++; });
    if (top > 0 && go === top && !KL_GOSTER) return '';   // tümü biten grubu gizle
    const altHTML = g.altlar.map(a => {
      const rows = a.maddeler.map(md => { const dd = durumOf(md.id); if (dd === 'ok' && !KL_GOSTER) return ''; return klRowHTML(md); }).join('');
      if (!rows) return '';
      const altBas = a.alt ? `<div class="kl-alt">${kacar(a.alt)}<span class="kl-alt-cz"></span></div>` : '';
      return altBas + rows;
    }).join('');
    if (!altHTML) return '';
    const kalan = top - go;
    const say = `✓${go}${gn ? ` · ✗${gn}` : ''}${kalan > 0 ? ` · ${kalan} kaldı` : ''}`;
    return `<div class="kl-grp"><div class="kl-grp-bas">${g.ikon} ${kacar(g.ad)} <span class="kl-gsay">${say}</span></div>${altHTML}</div>`;
  }).join('');
  return html || '<div class="kl-bos2">Hepsi tamamlandı 🎉<br>“Tamamlananları göster”i açabilirsin.</div>';
}
function klYeniGovde() {
  const yerlesik = KONTROL_LISTE.map(g => g.ad);
  const ozel = [...new Set(KL_YENI.map(y => (y.baslik || '').trim()).filter(b => b && !yerlesik.includes(b)))];   // kullanıcının eklediği özel başlıklar
  const opts = KONTROL_LISTE.map(g => `<option value="${kacar(g.ad)}">${g.ikon} ${kacar(g.ad)}</option>`).join('')
    + ozel.map(b => `<option value="${kacar(b)}">✨ ${kacar(b)}</option>`).join('');
  const bekleyen = klBekleyen();
  const liste = bekleyen.length
    ? bekleyen.map(y => `<div class="kl-yit" data-yid="${y.id}"><span class="kl-ycol"><span class="kl-ybas">${kacar(y.baslik || 'Genel')}${y.altBaslik ? ' › ' + kacar(y.altBaslik) : ''}</span><span class="kl-ytxt">${kacar(y.metin)}</span></span><span class="kl-yarac"><button type="button" data-yduz="${y.id}" title="Düzenle">✎</button><button type="button" data-ysil="${y.id}" title="Sil">🗑️</button></span></div>`).join('')
    : '<div class="kl-bos2">Henüz istek yok.<br>Ekle → “Prompt Kopyala” ile Kontrol’e geçer.</div>';
  const altlar = [...new Set(KL_YENI.map(y => (y.altBaslik || '').trim()).filter(Boolean))];
  const altOpts = altlar.map(a => `<option value="${kacar(a)}">${kacar(a)}</option>`).join('');
  return `<div class="kl-yform">
    <label class="kl-lbl">Ana Başlık (grup)</label>
    <select class="kl-sel" id="klYbaslik"><option value="__yeni">＋ Yeni Ana Başlık…</option>${opts}</select>
    <input type="text" class="kl-inp" id="klYbaslikYeni" placeholder="Yeni ana başlık adı…" hidden>
    <label class="kl-lbl">Alt Başlık <span style="font-weight:600;text-transform:none;color:var(--metin-soluk)">(opsiyonel)</span></label>
    <select class="kl-sel" id="klYalt"><option value="">(Alt başlık yok)</option>${altOpts}<option value="__yeni">＋ Yeni Alt Başlık…</option></select>
    <input type="text" class="kl-inp" id="klYaltYeni" placeholder="Yeni alt başlık adı…" hidden>
    <label class="kl-lbl">Ne istiyorsun?</label>
    <textarea class="kl-ta" id="klYmetin" placeholder="Örn. Derslere “tekrarla” butonu ekle; aynı ders ertesi hafta otomatik oluşsun."></textarea>
    <button type="button" class="kl-ekle" id="klYekle">＋ İsteği Ekle</button>
    <label class="kl-lbl" style="margin-top:16px">Eklenen istekler (prompt’a girer, Kontrol’de test edilir)</label>
    <div id="klYliste">${liste}</div>
  </div>`;
}
function klCiz() {
  const panel = document.getElementById('klPanel'); if (!panel) return;
  const s = klSayac();
  const yuzde = s.top ? Math.round(s.ok / s.top * 100) : 0;
  const onceki = panel.querySelector('.kl-govde'); const kaydir = onceki ? onceki.scrollTop : 0;
  const kontrolAktif = KL_TAB === 'kontrol';
  const ustHTML = kontrolAktif
    ? `<div class="kl-ozet"><span class="kl-yz">${s.ok}/${s.top}</span><span class="kl-pbar"><span style="width:${yuzde}%"></span></span>${s.no ? `<span class="kl-sr">✗ ${s.no}</span>` : ''}</div>
       <div class="kl-tgl" id="klTgl"><span class="kl-sw ${KL_GOSTER ? 'on' : ''}"><i></i></span> Tamamlananları göster</div>`
    : '';
  panel.innerHTML = `
    <div class="kl-bas"><span class="kl-ik">✅</span><span class="kl-t">Kontrol Listesi</span><button type="button" class="kl-x" id="klKapat" title="Kapat">✕</button></div>
    <div class="kl-tabs">
      <button type="button" class="kl-tab ${kontrolAktif ? 'sec' : ''}" data-tab="kontrol"><span class="tt">🔍 Kontrol</span><span class="ts">${s.ok}/${s.top}${s.no ? ` · ✗${s.no}` : ''}</span></button>
      <button type="button" class="kl-tab ${!kontrolAktif ? 'sec' : ''}" data-tab="yeni"><span class="tt">＋ Yeni</span><span class="ts">${klBekleyen().length} istek</span></button>
    </div>
    ${ustHTML}
    <div class="kl-govde">${kontrolAktif ? klKontrolGovde() : klYeniGovde()}</div>
    <div class="kl-alt"><button type="button" class="kl-prompt" id="klPrompt">📋 ${kontrolAktif ? 'Kontrol Promptu' : 'Yeni İstek Promptu'}</button><button type="button" class="kl-sifir" id="klSifir" title="Tümünü sıfırla">↺</button></div>`;
  { const g = panel.querySelector('.kl-govde'); if (g) g.scrollTop = kaydir; }
  document.getElementById('klKapat').onclick = kontrolKapat;
  document.getElementById('klPrompt').onclick = klPromptKopyala;
  document.getElementById('klSifir').onclick = () => onayModal('Tümü sıfırlansın mı?', 'Bütün ✓/✗ işaretleri, notlar ve eklenen istekler silinir.', () => { KL_DURUM = {}; KL_YENI = []; klKaydet(); klYeniKaydet(); klCiz(); });
  panel.querySelectorAll('.kl-tab').forEach(b => b.onclick = () => { KL_TAB = b.dataset.tab; klCiz(); });
  const tgl = document.getElementById('klTgl');
  if (tgl) tgl.onclick = () => { KL_GOSTER = !KL_GOSTER; localStorage.setItem('yt_kontrol_goster', KL_GOSTER ? '1' : '0'); klCiz(); };
  // Kontrol: ✓/✗ + not
  panel.querySelectorAll('.kl-ib').forEach(b => b.onclick = (e) => {
    e.stopPropagation();   // satır akordeonunu tetikleme
    const id = b.closest('.kl-row').dataset.id, k = b.dataset.k;
    const cur = (KL_DURUM[id] && KL_DURUM[id].d) || '';
    if (cur === k) delete KL_DURUM[id]; else KL_DURUM[id] = Object.assign({}, KL_DURUM[id], { d: k });
    if (KL_DURUM[id] && KL_DURUM[id].d === 'no') KL_ACIK.add(id);   // ✗ → akış açılsın (not yazılır)
    klKaydet(); klCiz();
    if (KL_DURUM[id] && KL_DURUM[id].d === 'no') { const ta = panel.querySelector(`[data-note="${id}"]`); if (ta) ta.focus(); }
  });
  // Madde akordeonu: başlığa basınca akış aç/kapa (yumuşak, yeniden çizmeden)
  panel.querySelectorAll('[data-rowtgl]').forEach(el => el.onclick = (e) => {
    if (e.target.closest('.kl-ib')) return;
    const id = el.dataset.rowtgl, row = el.closest('.kl-row');
    if (KL_ACIK.has(id)) KL_ACIK.delete(id); else KL_ACIK.add(id);
    row.classList.toggle('acik');
  });
  panel.querySelectorAll('[data-note]').forEach(ta => ta.addEventListener('input', () => { const id = ta.dataset.note; KL_DURUM[id] = Object.assign({}, KL_DURUM[id], { d: 'no', n: ta.value }); klKaydet(); }));
  // Yeni: form + istek yönetimi
  const sel = document.getElementById('klYbaslik');
  if (sel) {
    const yb = document.getElementById('klYbaslikYeni');
    const alt = document.getElementById('klYalt');
    const altYeni = document.getElementById('klYaltYeni');
    const senk = () => { yb.hidden = sel.value !== '__yeni'; };
    const senkAlt = () => { altYeni.hidden = alt.value !== '__yeni'; };
    senk(); senkAlt();
    sel.onchange = () => { senk(); if (!yb.hidden) yb.focus(); };
    alt.onchange = () => { senkAlt(); if (!altYeni.hidden) altYeni.focus(); };
    document.getElementById('klYekle').onclick = () => {
      const baslik = sel.value === '__yeni' ? (yb.value.trim() || 'Genel') : sel.value;
      const altBaslik = alt.value === '__yeni' ? altYeni.value.trim() : (alt.value || '');
      const metin = document.getElementById('klYmetin').value.trim();
      if (!metin) return bildir('Ne istediğini yaz.', 'hata');
      KL_YENI.push({ id: 'kly_' + yeniId(), baslik, altBaslik, metin });
      klYeniKaydet(); klCiz();
    };
    panel.querySelectorAll('[data-ysil]').forEach(b => b.onclick = () => { const id = b.dataset.ysil; KL_YENI = KL_YENI.filter(x => x.id !== id); delete KL_DURUM[id]; klYeniKaydet(); klKaydet(); klCiz(); });
    panel.querySelectorAll('[data-yduz]').forEach(b => b.onclick = () => {
      const y = KL_YENI.find(x => x.id === b.dataset.yduz); if (!y) return;
      KL_YENI = KL_YENI.filter(x => x.id !== y.id); delete KL_DURUM[y.id]; klYeniKaydet(); klKaydet(); KL_TAB = 'yeni'; klCiz();
      const sel2 = document.getElementById('klYbaslik'), yb2 = document.getElementById('klYbaslikYeni'), mt2 = document.getElementById('klYmetin');
      const alt2 = document.getElementById('klYalt'), altY2 = document.getElementById('klYaltYeni');
      const bilinen = Array.from(sel2.options).some(o => o.value === y.baslik);
      if (bilinen) { sel2.value = y.baslik; yb2.hidden = true; } else { sel2.value = '__yeni'; yb2.hidden = false; yb2.value = y.baslik; }
      const ab = y.altBaslik || '';
      if (!ab) { alt2.value = ''; altY2.hidden = true; }
      else if (Array.from(alt2.options).some(o => o.value === ab)) { alt2.value = ab; altY2.hidden = true; }
      else { alt2.value = '__yeni'; altY2.hidden = false; altY2.value = ab; }
      mt2.value = y.metin; mt2.focus();
    });
  }
}
function klPromptKopyala() {
  const tab = KL_TAB;   // 'kontrol' → sorunlar + düzeltmeler; 'yeni' → yalnız yeni istekler
  const sorunlar = [], yeniIstekler = [], dongu = [];
  const durumOf = (id) => (KL_DURUM[id] && KL_DURUM[id].d) || '';
  if (tab === 'yeni') {
    for (const y of KL_YENI) if (!y.gonderildi) yeniIstekler.push({ grup: (y.baslik || 'Genel') + (y.altBaslik ? ' › ' + y.altBaslik : ''), metin: y.metin });
  } else {
    for (const g of KONTROL_LISTE) for (const [id, metin] of g.maddeler) { if (durumOf(id) === 'no') sorunlar.push({ grup: g.ad, metin, not: (KL_DURUM[id].n || '').trim() }); }
    for (const y of KL_YENI) { if (!y.gonderildi) continue; const geri = durumOf(y.id) === 'no' ? (KL_DURUM[y.id].n || '').trim() : ''; if (geri) dongu.push({ y, geri }); }
  }
  const s = klSayac();
  let t = `GREEN VILLAGE PILATES — KONTROL RAPORU (Sürüm ${APP_SURUM})\n`;
  t += `Çalışıyor: ${s.ok}/${s.top} · ` + (tab === 'yeni' ? `Yeni istek: ${yeniIstekler.length}` : `Sorun: ${sorunlar.length} · Düzeltme: ${dongu.length}`) + `\n`;
  if (sorunlar.length) { t += '\nSORUNLAR:\n'; sorunlar.forEach((x, i) => { t += `${i + 1}) [${x.grup}] ${x.metin}${x.not ? ` — ${x.not}` : ''}\n`; }); }
  if (yeniIstekler.length) { t += '\nYENİ İSTEKLER:\n'; yeniIstekler.forEach((x, i) => { t += `${i + 1}) [${x.grup}] ${x.metin}\n`; }); }
  if (dongu.length) {
    t += '\nDÜZELTMELER (döngü — istek → yapıldı → geri bildirim):\n';
    dongu.forEach((x, i) => {
      t += `\n${i + 1}) [${(x.y.baslik || 'Genel') + (x.y.altBaslik ? ' › ' + x.y.altBaslik : '')}]\n`;
      t += `   İSTEK: ${x.y.metin}\n`;
      klZincir(x.y).forEach(tr => { t += `   ${tr.rol === 'yapildi' ? 'YAPILDI' : 'GERİ BİLDİRİM'}: ${tr.metin}\n`; });
      t += `   GERİ BİLDİRİM: ${x.geri}\n`;
      t += `   → Lütfen son geri bildirimi uygula.\n`;
    });
    t += '\n(Bu maddeler bir döngüdür: ben ✓ ile onaylayana kadar İSTEK → YAPILDI → GERİ BİLDİRİM olarak sürer.)\n';
  }
  if (!sorunlar.length && !yeniIstekler.length && !dongu.length) t += '\nİşaretli sorun/istek yok. ✓\n';
  t += '\nKURALLAR (her düzeltmede uy):\n';
  t += '1) Önce tasarımı (önizleme) ilet, onay alınca kodla.\n';
  t += '2) Sıcak yeşil/kum/gold temayı ve mevcut tasarımı bozma.\n';
  t += '3) Hiçbir metin kutusunda Chrome otomatik-tamamlama (autofill) çıkmasın.\n';
  t += '4) Geçişler ve açılışlar akıcı, hafif animasyonlu ve 3B derinlik hissi versin (abartısız).\n';
  t += '5) Programın mevcut yapısını bozma; işleyişi zorlaştırma, sade ve kolay kalsın.\n';
  t += '6) Gereksiz açıklama/yorum yazma; kısa ve öz ol.\n';
  t += '7) Uygulama aşırı hızlı ve çok akıcı çalışsın.\n';
  t += '8) Formlarda Enter’a basınca bir sonraki alana/girişe geçilsin.\n';
  t += '9) Yaptığın her düzeltme/güncellemeyi ilgili maddenin altına “Yapılan Güncelleme: ...” olarak yaz.\n';
  t += '10) Formlarda tarih için uygulamaya özel takvimi (Dersler/Giderler’deki gibi) kullan; native tarih kutusu kullanma. Ayrı seçim ekranları form ile AYNI boyutta ve animasyonlu (kayarak) açılsın; kutu oynamasın.\n';
  t += '11) Yeni form/açılır pencere oluştururken standart form boyunu kullan; tüm formlar aynı boyutta olsun ve adımlar arası büyüyüp küçülmesin (yalnız küçük “Sil?/Onay” kutuları küçük kalır).\n';
  t += '12) Gold-premium tasarım: her yeni ekran/kart/eleman altın-premium dili taşısın (altın gradyan çerçeve/vurgu, sıcak ışıltı, yumuşak gölge, ince 3B derinlik); giriş ekranı ve Gösterge Paneli’ndeki premium havayla tutarlı olsun.\n';
  t += '13) Tutarlılık ve etkileşim: Bir kart/tabloya yeni ne eklenirse bir öncekiyle AYNI ölçü ve özellikleri taşısın (Enter’la sonraki alana geçme, açılış/geçiş animasyonları, para birimi biçimi ₺ ve binlik ayracı vb.). İmleç kuralı: fotoğraf/dosya seçimi ve düz metinde imleç DEĞİŞMESİN (varsayılan ok); metin girişlerinde metin imleci, düğmelerde el (pointer) olsun. Tablolarda her kaydın satırında kalem (✎) ikonuyla düzenleme (geri düzenlenebilir) ve aynı yerden silme (🗑️) bulunsun.\n';
  t += '14) Toplu ilerle (tek kontrol · tek kodlama · tek push): Raporda birden çok madde varsa her biri için ayrı döngü yapma. Görsel maddelerin önizlemelerini TEK mesajda topluca ilet; onaylananların HEPSİNİ tek kodlama turunda yap ve tek sürümde (tek commit + tek push) yayına al. Yalnızca revizyon isteyen bir tasarım kendi mini-döngüsünde ayrı yürür.\n';
  t += '15) Görsel olmayan işlerde önizleme atla: Mantık/veri düzeltmesi, metin/yazım, hata giderme, yeniden adlandırma gibi görünümü değiştirmeyen işlerde önizleme bekleme; doğrudan kodla, yaz ve “Yapılan Güncelleme”yi ekle. Önizleme yalnızca görünümü değiştiren işler için.\n';
  t += '16) Gereksiz ara-onay sorma: İş netse ilerle; her küçük adımı ayrıca onaylatma. Onay yalnızca tasarım önizlemesi ve geri döndürülemez işlemler için istenir — “tamam/uygun/olur” gibi tek kelime onay yeterlidir.\n';
  t += '17) Toplu önizleme tek görselde: Birden çok görsel maddeyi mümkünse tek karşılaştırma/önizleme görselinde sun — daha az mesaj, tek bakışta karar.\n';
  t += '18) “Tümünü onaylıyorum” kısayolu: Toplu önizlemede kullanıcı “hepsi uygun / tümünü onaylıyorum” derse tüm maddeler tek seferde onaylanmış sayılır ve toplu kodlanır.\n';
  t += '19) Otomatik sürüm/saat: Her yayına almada sürüm numarası ve saat otomatik artırılır; kullanıcıdan elle güncelleme istenmez.\n';
  t += '20) Riskli olmayan metin/kopya (yazım, etiket, açıklama) düzeltmelerini biriktirip tek seferde uygula; ayrı ayrı deploy etme.\n';
  if (sorunlar.length || yeniIstekler.length || dongu.length) t += '\nLütfen sorunları düzelt, yeni istekleri yap ve her birine tek tek ne yaptığını yaz.';
  const tasindi = tab === 'yeni' ? yeniIstekler.length : dongu.length;
  const tamam = () => bildir(tasindi ? (tab === 'yeni' ? `Kopyalandı — ${tasindi} yeni istek Kontrol’e taşındı.` : `Kopyalandı — ${tasindi} geri bildirim döngüye eklendi.`) : 'Rapor panoya kopyalandı — sohbete yapıştır.', 'basari');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(tamam).catch(() => klPromptGoster(t));
  else klPromptGoster(t);
  // Prompt oluşturulunca: (Yeni) bekleyen istekler Kontrol'e kayar; (Kontrol) döngü geri bildirimleri zincire eklenir
  let degisti = false;
  if (tab === 'yeni') { KL_YENI.forEach(y => { if (!y.gonderildi) { y.gonderildi = true; degisti = true; } }); }
  else { dongu.forEach(x => { x.y.geriler = x.y.geriler || []; x.y.geriler.push(x.geri); delete KL_DURUM[x.y.id]; degisti = true; }); }
  if (degisti) { klYeniKaydet(); klKaydet(); klCiz(); }
}
function klPromptGoster(t) {
  modalAc('Kontrol Raporu', `<textarea class="gp-inp" id="klRapor" style="width:100%;box-sizing:border-box;min-height:220px;font-family:monospace;font-size:12px">${kacar(t)}</textarea><p class="soluk" style="font-size:12px;margin-top:8px">Metni seç, kopyala ve sohbete yapıştır.</p>`, `<button class="btn" id="klRaporKapat">Kapat</button>`);
  document.getElementById('klRaporKapat').onclick = modalKapat;
  setTimeout(() => { const el = document.getElementById('klRapor'); if (el) { el.focus(); el.select(); } }, 60);
}

/* Otomatik sürüm kontrolü: taze index.html'i çek, daha yeni sürüm varsa
   önbelleği atlayarak kendini güncelle (ana ekrana eklenmiş cihazlar için).
   Sonsuz döngüyü önlemek için oturumda tek sefer dener. */
async function surumKontrol() {
  try {
    if (sessionStorage.getItem('yt_surum_kontrol')) return;
    sessionStorage.setItem('yt_surum_kontrol', '1');
    const yol = location.pathname.replace(/[^/]*$/, '') + 'index.html?sk=' + Date.now();
    const r = await fetch(yol, { cache: 'no-store' });
    if (!r.ok) return;
    const html = await r.text();
    const m = html.match(/app\.js\?v=(\d+)/);
    if (m && Number(m[1]) > Number(APP_SURUM)) {
      if ('serviceWorker' in navigator) {
        try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(x => x.unregister())); } catch {}
      }
      if (window.caches && caches.keys) {
        try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch {}
      }
      location.replace(location.pathname + '?g=' + Date.now());
    }
  } catch { /* çevrimdışı vb. — sorun değil */ }
}

/* iOS Safari'de pinch yakınlaştırmasını engelle (çift-dokunma zaten touch-action:pan-y ile kapalı) */
function yakinlastirmaKapat() {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
    document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
}

})();
