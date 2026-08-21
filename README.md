# BellekPad

**BellekPad**, notepad rahatlığını kişisel yaşam yönetimi, bilgi, proje, vaka, finans, sağlık, eğitim, parola kasası, envanter ve istatistiklerle birleştiren local-first bir kişisel sistemdir.

BellekPad'in temel fikri basittir:

> Önce yaz. Sistem sonra anlamlandırsın.

Bir kayıt tek yerde yaşar; ihtiyaç oldukça farklı **ortamlarda** farklı anlam, davranış ve görünüm kazanır.

## Ürün hissi

- Notepad kadar hızlı ve doğrudan.
- Notion kadar genişleyebilir, ama kullanıcıya veritabanı tasarlatma zorunluluğu yok.
- Obsidian kadar ilişkisel olabilir, ama dosya grafiği etrafında dönmek zorunda değil.
- Oyun menüsü kadar keyifli; ancak işlevselliği oyuncaklaştırmaz.
- Soft Tarkov/Duckov esintili envanter, Character Sheet, XP/quest gibi lensler opsiyoneldir.

## Tasarım ilkeleri

- **Pad-first:** Ana giriş noktası her zaman hızlı yazma/kayıt alanıdır.
- **Environment-first:** Finance, Health, Project, Case veya Education hard-coded veri adaları değildir.
- **Convertible environments:** Bir kayıt başka bir ortama projekte edilebilir, yeni yetenek kazanabilir veya kontrollü biçimde dönüştürülebilir.
- **Event-driven:** Kritik değişimler olay olarak kaydedilir; durum ve istatistikler gerektiğinde olaylardan türetilir.
- **Local-first:** Uygulama çevrimdışı çalışır; kişisel veri öncelikle kullanıcının cihazında tutulur.
- **Encrypted sensitive data:** Parola ve benzeri hassas alanlar ayrı şifreli kasada tutulur.
- **Multiple lenses:** Aynı varlık kart, tablo, timeline, graph, dashboard veya spatial inventory görünümüyle sunulabilir.
- **Analytics by default:** Sayısal, zamansal ve ilişkisel veriler yeni modül yazmadan ölçülebilir olmalıdır.
- **Static deployable:** Ana istemci Netlify'a statik build olarak atılabilmelidir.

## Veri hattı

V1 için ana veritabanı **Dexie + IndexedDB**'dir.

```text
React UI
  ↓
Application / Environment Engine
  ↓
Repository Layer
  ↓
Dexie
  ↓
IndexedDB (cihazda)
```

Temel tablolar:

- `entities` — asıl kayıtlar
- `events` — gelişme/değişim geçmişi
- `relations` — kayıtlar arası bağlar
- `attachments` — yerel dosya/blob kayıtları
- `vault` — yalnızca şifreli hassas payload'lar
- `settings` — kullanıcı ve uygulama ayarları

Tarayıcı destekliyorsa `StorageManager.persist()` ile kalıcı yerel depolama talep edilir. Buna rağmen local-only kullanım için dışa aktarma/yedek alma hattı ayrıca geliştirilecektir.

Bulut senkronizasyonu çekirdeğin şartı değildir. İleride `SyncAdapter` üzerinden Supabase veya başka bir ücretsiz/uygun servis eklenebilir; servis yokken BellekPad çalışmaya devam eder.

## Teknoloji

Şu an kullanılan çekirdek:

- React + TypeScript + Vite
- Dexie / IndexedDB
- Dexie React Hooks
- CSS tabanlı soft UI
- Web Crypto API için ayrılmış `vault` katmanı
- Netlify statik deploy
- GitHub Actions build kontrolü

İlerleyen katmanlar:

- Zustand
- Zod
- dnd-kit
- Apache ECharts
- PWA / Service Worker
- export/import backup
- opsiyonel cloud sync adapter

## Çekirdek kavramlar

`Entity → Environment → Capability → Event → Relation → Projection → Metric → Lens`

Detaylı mimari: [`docs/architecture.md`](docs/architecture.md)

## İlk doğrulama alanları

1. **Pad** — hızlı kayıt, arama, etiketleme ve dönüşüm.
2. **Case / Project** — gelişmeler, kararlar, görevlar, zaman çizgisi.
3. **Finance** — harcama, gelir, bütçe, abonelik ve raporlama.
4. **Health / Education** — zamansal kayıt, belge, ölçüm ve ilerleme.
5. **Inventory / Character** — liste/tablo yanında soft spatial inventory ve Character Sheet lensleri.

Bunlar birbirinden kopuk mini uygulamalar değil; aynı kayıtların farklı ortamlardaki yorumlarıdır.

## Geliştirme

```bash
npm install
npm run dev
```

Üretim build'i:

```bash
npm run build
```

Netlify Drop için `dist/` klasörünün içeriği kullanılabilir.
