# Yoga Tugi — Ön Muhasebe

Pilates stüdyosu **Yoga Tugi** için basit, sade ve kolay kullanılan bir ön muhasebe / kar payı dağıtım uygulaması.

- **Teknoloji:** Saf HTML + CSS + Vanilla JavaScript (framework yok)
- **Veri saklama:** Tarayıcıda yerel depolama (localStorage) — sunucu/kurulum gerektirmez
- **Mimari:** `index.html` + `app.js` + `style.css`

> Bu proje bağımsızdır; başka bir uygulamayla veri/kod paylaşmaz.

---

## 📁 Dosyalar

| Dosya | Açıklama |
|------|----------|
| `index.html` | Uygulama iskeleti (giriş + navigasyon) |
| `app.js` | Tüm uygulama mantığı (modüller, hesaplamalar, veri katmanı) |
| `style.css` | Tema ve arayüz (adaçayı yeşili / kum / antrasit) |
| `xlsx.full.min.js` | Excel (.xlsx) dosyalarını okumak için kütüphane |
| `logos/yogatugi-logo.jpeg` | Firma logosu (buraya ekleyin) |

---

## 🚀 Kullanım

Kurulum yok. İki yol var:

**A) İnternetten (GitHub Pages):**
```
https://nizamsoft.github.io/YogaTugi-Muhasebe/
```
Telefon, tablet ve bilgisayardan bu adresle açılır.

**B) Yerelde:**
1. Yeşil **Code** → **Download ZIP** ile tüm klasörü indirin ve çıkartın.
2. Klasörün içindeki `index.html`'e çift tıklayın.
   > ⚠️ Tek başına `index.html` değil, **klasörün tamamı** gerekir (yanındaki `style.css`, `app.js` vb. ile birlikte).

İlk açılışta **"Boş başla"** (kendi verilerinizi girin) veya **"Örnek verilerle keşfet"** seçin.

---

## 💾 Yedekleme (önemli)

Veriler yalnızca kullandığınız tarayıcıda saklanır; tarayıcı verisi silinirse kaybolur. Bu yüzden:

- Üst çubuktaki **💾** simgesine tıklayın → **"Yedeği İndir (.json)"** ile düzenli yedek alın.
- Başka cihaza taşımak veya güvenli saklamak için aynı yedeği **"Yedekten Geri Yükle"** ile kullanabilirsiniz.
- **"Tüm Verileri Sıfırla"** ile baştan başlayabilirsiniz.

---

## 🧩 Modüller

- **Gösterge Paneli:** Günlük/aylık gelir, gider, net kâr ve kar payı özetleri, grafikler.
- **Veri Girişleri:** Banka, Plan4Me, Kredi Kartı aktarımı (dosyadan otomatik / manuel) ve Kasa girişleri.
- **Hesaplar:** Bankalar, Kasa, Kredi Kartı, Ortaklar Hesabı, Giderler ve Gelirler hesapları.
- **Raporlar:** Kar/Zarar, Ortak Hak Ediş, Gelirler, Giderler, Resmi Muhasebe (yazdırılabilir).
- **Ayarlar:** Kullanıcı yetkilendirme, komisyon ayarları, ortak pay oranları.

## 🧮 Kar Payı Mantığı

```
Net Kâr = Toplam Gelir − Toplam Gider   (dönem bazında)
Ortak Hak Ediş = Net Kâr × (Ortak Pay Oranı / 100)
```
Ortak pay oranları **Ayarlar > Ortak Pay Oranı** sayfasından tanımlanır (toplam %100 olmalıdır).

---

## 🖼️ Logo

Firma logosunu `logos/yogatugi-logo.jpeg` konumuna koyun (`.jpg`, `.png`, `.webp`, `.svg` de olur — uygulama hepsini otomatik dener). Uygulama logoyu otomatik algılayıp giriş ekranı ve menüde gösterir. Logo yoksa "YT" yer tutucu görünür.

GitHub'dan yüklemek için: `logos` klasörünü açın → **Add file → Upload files** → dosyayı sürükleyin → **Commit changes**.
