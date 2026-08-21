# BellekPad

**BellekPad**, not, yaşam kaydı, proje, vaka, finans, sağlık, eğitim, parola kasası, envanter ve istatistikleri tek bir local-first kişisel işletim sisteminde birleştirmeyi amaçlayan modüler bir web uygulamasıdır.

BellekPad'in temel yaklaşımı sabit modüller üretmek değil; aynı verinin farklı **ortamlarda** farklı anlam ve davranış kazanabilmesini sağlamaktır.

> Bir kayıt tek yerde yaşar; farklı ortamlarda farklı biçimde yorumlanır.

## Tasarım ilkeleri

- **Environment-first:** Finance, Health, Project, Tournament veya Education hard-coded veri adaları değildir.
- **Convertible environments:** Bir kayıt başka bir ortama projekte edilebilir, yeni yetenek kazanabilir veya kontrollü biçimde dönüştürülebilir.
- **Event-driven:** Değişimler mümkün olduğunca olay olarak kaydedilir; durum ve istatistikler olaylardan türetilir.
- **Local-first:** Uygulama çevrimdışı çalışabilmeli; kişisel veri öncelikle tarayıcıda tutulmalıdır.
- **Encrypted sensitive data:** Parola ve benzeri hassas alanlar ayrı şifreli kasada tutulmalıdır.
- **Multiple lenses:** Aynı varlık kart, tablo, timeline, graph veya Tarkov/Duckov benzeri spatial inventory görünümüyle sunulabilir.
- **Analytics by default:** Sayısal, zamansal ve ilişkisel veriler yeni bir modül yazmadan ölçülebilir olmalıdır.
- **Static deployable:** Ana istemci Vite tabanlı build ile Netlify'a doğrudan deploy edilebilir olmalıdır.

## Hedef teknoloji

- React + TypeScript + Vite
- Tailwind CSS + erişilebilir headless UI primitives
- Zustand
- Dexie / IndexedDB
- Zod
- Web Crypto API
- dnd-kit (spatial inventory ve sürükle-bırak)
- Apache ECharts (genel analytics)
- PWA / Service Worker
- Netlify

Bulut eşitleme ileride opsiyonel bir adaptör olmalıdır; çekirdek çalışma için zorunlu değildir.

## Çekirdek kavramlar

`Entity → Environment → Capability → Event → Relation → Projection → Metric → View`

Detaylı mimari: [`docs/architecture.md`](docs/architecture.md)

## İlk doğrulama ortamları

BellekPad çekirdeğini yalnızca notlarla değil, farklı davranış isteyen örneklerle doğrulayacağız:

1. **Personal / Character Sheet** — kimlik, istatistikler, milestone ve envanter.
2. **Case / Project** — gelişmeler, kararlar, görevler, zaman çizgisi.
3. **Finance** — harcama, gelir, bütçe, abonelik ve raporlama.
4. **Tournament** — Haxball/FM benzeri fikstür, maç sonucu, sıralama, kadro ve transfer akışı.
5. **Inventory** — liste ve tabloya ek olarak soft Tarkov/Duckov benzeri grid/container görünümü.

Bu ortamlar birbirinden kopuk uygulamalar değil, aynı çekirdeğin farklı kompozisyonlarıdır.
