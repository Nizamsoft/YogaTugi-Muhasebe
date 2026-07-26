# Yoga Tugi — Ön Muhasebe

Pilates stüdyosu **Yoga Tugi** için basit, sade ve kolay kullanılan bir ön muhasebe / kar payı dağıtım uygulaması.

- **Teknoloji:** Saf HTML + CSS + Vanilla JavaScript (framework yok)
- **Backend:** Firebase Firestore (veritabanı) + Firebase Authentication (giriş)
- **Mimari:** `index.html` + `app.js` + `style.css` (tek sayfa uygulama)

> Bu proje, "Nizam Soft - To Do" uygulamasından **tamamen ayrı ve bağımsızdır**; ayrı bir Firebase projesi kullanır.

---

## 📁 Dosyalar

| Dosya | Açıklama |
|------|----------|
| `index.html` | Uygulama iskeleti (giriş ekranı + navigasyon) |
| `app.js` | Tüm uygulama mantığı (modüller, hesaplamalar, veri katmanı) |
| `style.css` | Tema ve arayüz (adaçayı yeşili / kum / antrasit) |
| `firebase-config.js` | **Firebase anahtarlarını buraya yapıştırın** |
| `firestore.rules` | Firestore güvenlik kuralları |
| `xlsx.full.min.js` | Excel (.xlsx) dosyalarını okumak için kütüphane |
| `logos/yogatugi-logo.jpeg` | Firma logosu (buraya ekleyin) |

---

## 🚀 Hızlı Başlangıç (Yerel Depolama — Firebase'siz)

Firebase kurmadan da uygulama **tam çalışır**; verileri tarayıcınızda (localStorage) saklar:

1. `index.html` dosyasını bir tarayıcıda açın (veya GitHub Pages ile yayınlayın).
2. Giriş ekranında **"Yerel modda gir →"** bağlantısına tıklayın.
3. Açılışta **"Boş başla"** (kendi verilerinizi girin) veya **"Örnek verilerle keşfet"** seçin.

### 💾 Yedekleme (önemli)
Yerel modda veriler yalnızca o tarayıcıda kalır; tarayıcı verisi silinirse kaybolur. Bu yüzden:
- Üst çubuktaki **💾** simgesine tıklayın → **"Yedeği İndir (.json)"** ile düzenli yedek alın.
- Başka cihaza taşımak veya ileride **Firebase'e geçmek** için aynı yedeği **"Yedekten Geri Yükle"** ile kullanabilirsiniz.

> ℹ️ Kalıcı, çok kullanıcılı ve merkezi kullanım için hazır olduğunuzda aşağıdaki Firebase kurulumunu yapın. Firebase bağlandığında kod otomatik olarak ona geçer; hiçbir şeyi yeniden yazmanız gerekmez.

---

## 🔥 Firebase Kurulumu (Adım Adım)

### 1) Firebase projesi oluşturun
1. https://console.firebase.google.com adresine girin (Google hesabınızla).
2. **"Proje ekle"** deyin. Proje adı: örn. `yoga-tugi-muhasebe`.
3. Google Analytics'i istemezseniz kapatabilirsiniz. **Oluştur** deyin.

### 2) Authentication (Giriş) açın
1. Sol menüden **Build > Authentication > Get started**.
2. **Sign-in method** sekmesinde **Email/Password**'ı **etkinleştirin** (Enable) ve kaydedin.
3. **Users** sekmesinden **Add user** ile ilk kullanıcıyı ekleyin:
   - E-posta: örn. `yonetici@yogatugi.com`
   - Şifre: güçlü bir şifre belirleyin.
   > Uygulamaya bu e-posta/şifre ile giriş yapacaksınız.

### 3) Firestore Database oluşturun
1. Sol menüden **Build > Firestore Database > Create database**.
2. Konum (location) olarak `eur3 (europe-west)` gibi Avrupa'yı seçebilirsiniz.
3. Başlangıçta **"Production mode"** seçin (kuralları 5. adımda ayarlayacağız).

### 4) Web uygulaması kaydı & config anahtarları
1. Firebase **Proje Ayarları** (dişli ⚙️ > Project settings).
2. Aşağıda **"Your apps"** bölümünde **Web** simgesine (`</>`) tıklayın.
3. Uygulamaya bir takma ad verin (örn. `yoga-tugi-web`) ve **Register app**.
4. Ekranda çıkan `firebaseConfig` nesnesini kopyalayın. Şuna benzer:
   ```js
   const firebaseConfig = {
     apiKey: "AIza........",
     authDomain: "yoga-tugi-muhasebe.firebaseapp.com",
     projectId: "yoga-tugi-muhasebe",
     storageBucket: "yoga-tugi-muhasebe.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456"
   };
   ```
5. Bu değerleri **`firebase-config.js`** dosyasındaki `window.FIREBASE_CONFIG` içine yapıştırın (BURAYA_... yazan yerlerin yerine).

### 5) Güvenlik kurallarını yayınlayın
1. Firestore Database > **Rules** (Kurallar) sekmesine gidin.
2. `firestore.rules` dosyasının içeriğini oraya yapıştırın ve **Publish** (Yayınla) deyin.
   > Bu kurallar: yalnızca giriş yapmış kullanıcılar veri okuyup yazabilir.

### 6) Firebase SDK'sını etkinleştirin
`index.html` dosyasında aşağıdaki 3 satırın **yorumunu kaldırın** (`<!--` ve `-->` işaretlerini silin):
```html
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
```

### 7) Bitti! 🎉
Artık `index.html`'i açtığınızda uygulama otomatik olarak Firebase'e bağlanır.
- Giriş ekranına 2. adımda oluşturduğunuz **e-posta/şifre** ile girin.
- Verileriniz merkezi Firestore veritabanında saklanır; bilgisayar, tablet ve telefondan erişilebilir.

---

## 🌐 Yayınlama (GitHub Pages)

1. Bu klasörü GitHub reposuna gönderin.
2. Repo **Settings > Pages** bölümünden ilgili branch'i seçin.
3. `.../yogatugi/index.html` adresinden erişebilirsiniz.

> Not: `apiKey` gibi Firebase web anahtarlarının herkese açık olması normaldir; güvenlik **Firestore kuralları** ve **Authentication** ile sağlanır (bu yüzden 5. adım önemli).

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

Firma logosunu `logos/yogatugi-logo.jpeg` konumuna koyun. Uygulama logoyu otomatik algılayıp giriş ekranı ve menüde gösterir. Logo yoksa "YT" yer tutucu görünür.
