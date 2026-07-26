/* ============================================================
   Yoga Tugi — Firebase Yapılandırması
   ------------------------------------------------------------
   BURAYA Firebase Console'dan aldığın kendi anahtarlarını yapıştır.
   (Adım adım rehber: README.md dosyasına bak.)

   Firebase henüz kurulmadıysa bu dosyaya dokunmana gerek yok;
   uygulama otomatik olarak "Demo Modu"nda (tarayıcı hafızası) çalışır.
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey:            "BURAYA_API_KEY",
  authDomain:        "BURAYA_PROJE.firebaseapp.com",
  projectId:         "BURAYA_PROJE_ID",
  storageBucket:     "BURAYA_PROJE.appspot.com",
  messagingSenderId: "BURAYA_SENDER_ID",
  appId:             "BURAYA_APP_ID"
};

/* Config gerçek değerlerle doldurulduğunda ve index.html'deki Firebase
   <script> satırlarının yorumu kaldırıldığında uygulama otomatik olarak
   gerçek Firebase'e (Firestore + Authentication) bağlanır. */
