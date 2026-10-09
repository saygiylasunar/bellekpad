# BellekPad

BellekPad, günlük hayatı tek yerde izlemek için tasarlanan oyunlaştırılmış kişisel yönetim panelidir. Notion/Obsidian benzeri esneklik hedefler; ancak odak, hızlı kayıt, tekrar kullanılabilir modüller ve düşük bakım maliyetidir.

## Ana modüller

- günlük notlar ve dönüm noktaları
- proje / iş / case takibi
- tek seferlik kritik işler ve zamansal kontroller
- aylık harcamalar ve temel istatistikler
- eğitim / bilgi notları
- sağlık ve rutin kayıtları için ayrı alanlar

## Oyunlaştırma

BellekPad'in arayüzü klasik görev listesi yerine bir **Character Sheet** mantığına yaklaşır. Kullanıcı ilerlemesi, envanter ve durum kartlarıyla görünür hale gelir; amaç sistemi oyunlaştırmak ama işi oyuna çevirmemektir.

## Teknik yön

- KISS: mümkün olan en az bağımlılık
- Netlify Drop ile kolay dağıtım
- gerektiğinde tamamen lokal çalışma
- ücretsiz / düşük maliyetli veri katmanı
- soft UI, hızlı açılan modüler panel

## Tasarım ilkesi

> Önce kayıt edilebilirlik, sonra görsellik.

Bir modül yeni özellik eklerken günlük kullanım süresini uzatmamalı; BellekPad'in değeri, kullanıcıyı yönetmekten çok kullanıcının zihinsel yükünü azaltmasında olmalı.

## Çalışan ilk sürüm · v0.1 (2026-10)

Bu depo artık **statik, bağımlılıksız ve local-first** bir kayıt panosu içeriyor:

- Yeni kayıt: başlık, detay, alan ve isteğe bağlı hedef tarih.
- Durum: açık/tamamlandı; arama ve alan/durum filtreleri.
- Tamamlanan kayıt başına +10 XP ile basit seviye göstergesi.
- Sürüm numaralı JSON dışa/içe aktarma (içe aktarım onayla mevcut listeyi değiştirir).
- Duyarlı soft UI; masaüstü, mobil ve klavye ile kullanılabilir.

### Çalıştırma

`index.html` dosyasını modern bir tarayıcıda açmak yeterlidir. Yerel dosya erişiminde `localStorage` kapalıysa üstte **Geçici oturum** uyarısı gösterilir; bu durumda mutlaka JSON yedeği alın. Daha öngörülebilir bir yerel adres için:

```bash
python -m http.server 8000
```

Ardından `http://localhost:8000` adresine gidin. Netlify Drop için depo kökündeki `index.html`, `app.js` ve `styles.css` dosyalarını birlikte yayımlayın; build adımı yoktur.

### Veri güvenliği ve sınırlar

Veriler `localStorage` üzerinden **yalnızca o tarayıcı profilinde ve o origin'de** saklanır; senkronizasyon veya sunucu yedeği yoktur. Tarayıcı verileri temizlenirse kayıtlar kaybolabilir. JSON yedekleri **şifrelenmez**; hassas bilgileri açık biçimde eklemeyin ve dışa aktarılan dosyaları güvenle saklayın.

İçe aktarma, `schemaVersion: 1` olan BellekPad JSON yedeklerini kabul eder; 2 MB ve 5.000 kayıt sınırı bulunur. Hatalı kayıtlar otomatik olarak içe alınmaz. İçe aktarma birleştirme değil, **onaylı değiştirme** işlemidir.

### Kalite kontrol

```bash
node --check app.js
node scripts/check-contract.mjs
```

GitHub Actions'ta da aynı kontroller koşar. XP, mevcut **tamamlanan** kayıt sayısından türetilir; geçmiş XP kalıcı olarak tutulmaz.

### Sonraki aşama

Kalıcı proje panoları, bütçe/istatistik modülü, isteğe bağlı şifreli yedek ve günlüksel geçmiş için önce veri modeli ve kullanıcı akışı test edilmeli. Sağlık ve diğer hassas kategoriler açık metinli MVP'ye dahil edilmemiştir.
