# BellekPad — Çekirdek Mimari

## 1. Ürün kimliği

BellekPad'in ana fikri basit:

> **Oyunsu ama ağır iş yapabilen bir notepad.**

Kullanıcı ilk anda bir not uygulamasının rahatlığını görür; altında ise kişisel yaşam, proje, sağlık, finans, eğitim, parola kasası, envanter, zaman, istatistik ve ilişki motorları çalışır.

BellekPad bir turnuva paneli, görev yöneticisi veya Notion klonu değildir. Bunların davranışlarını gerektiğinde üretebilen **kişisel kayıt ve durum motorudur**.

Temel öncelik sırası:

```text
Yaz / Kaydet
    ↓
Anlamlandır
    ↓
Bağla
    ↓
İzle
    ↓
Dönüştür
    ↓
Ölç / Görselleştir
```

Kullanıcı veri tabanı tasarlamak zorunda kalmamalıdır.

## 2. Ana kavramlar

### Entity

Kalıcı gerçek nesne. Bir not, kişi, harcama, ilaç, proje, cihaz, ders, parola kaydı, dosya veya olay olabilir.

```ts
export interface Entity {
  id: string;
  kind: string;
  title: string;
  attributes: Record<string, unknown>;
  environments: string[];
  relations: RelationRef[];
  createdAt: string;
  updatedAt: string;
}
```

`kind` yalnızca başlangıç kimliğini verir. Uygulama davranışı tek başına `kind` üzerinden hard-code edilmez.

### Environment

Bir Entity'nin hangi bağlamda nasıl yorumlanacağını belirleyen davranış paketi.

```ts
export interface EnvironmentDefinition {
  id: string;
  label: string;
  capabilities: string[];
  fields: FieldDefinition[];
  rules: RuleDefinition[];
  conversions: ConversionDefinition[];
  metrics: MetricDefinition[];
  lenses: LensDefinition[];
}
```

Örnek ortamlar:

- `core`
- `temporal`
- `finance`
- `health`
- `case`
- `project`
- `education`
- `inventory`
- `character`
- `knowledge`

Bir kayıt aynı anda birden çok ortamda yaşayabilir. Örneğin bir hastane kontrolü `health + temporal + case + finance` ortamlarında anlam kazanabilir.

### Capability

Environment'ın entity'ye kazandırdığı atomik davranış.

Örnekler:

- `actionable`
- `schedulable`
- `trackable`
- `financial`
- `measurable`
- `inventoryItem`
- `container`
- `relational`
- `sensitive`
- `progressable`

UI mümkün olduğunca entity türünden değil capability'lerden türetilir.

### Event

Gerçekleşmiş değişiklik veya gelişme.

```ts
export interface DomainEvent<T = unknown> {
  id: string;
  entityId?: string;
  environmentId: string;
  type: string;
  occurredAt: string;
  payload: T;
}
```

Örnekler:

- `transaction.recorded`
- `task.completed`
- `case.updated`
- `medication.taken`
- `inventory.moved`
- `education.completed`
- `milestone.reached`

Timeline, audit, analytics ve geri alma için kritik değişikliklerde event geçmişi korunur.

### Relation

```ts
export interface RelationRef {
  type: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}
```

Örnekler: `belongsTo`, `relatedTo`, `paidFor`, `assignedTo`, `storedIn`, `dependsOn`, `createdFrom`.

### Lens

Aynı verinin farklı görsel ve etkileşimsel sunumu. Lens veri modelini değiştirmez.

- Note / Editor
- Card
- Table
- Timeline
- Calendar
- Kanban
- Graph
- Dashboard
- Character Sheet
- Spatial Inventory
- Gallery

## 3. Environment dönüşümü

Environment'lar arasında üç davranış bulunur.

### Projection

Kaynak veri değişmeden başka ortamın lensiyle gösterilir.

Örnek: bir cihaz Inventory'de ekipman, Finance'ta varlık/harcama olarak görünür.

### Promotion

Entity yeni environment/capability kazanır.

Örnek: sıradan not → Case. Not korunur; vaka takibi davranışları eklenir.

### Conversion

Gerçek semantik mapping uygulanır.

Örnek: Task → Appointment.

```ts
export interface ConversionDefinition {
  from: string;
  to: string;
  mode: "project" | "promote" | "convert";
  fieldMap?: Record<string, string>;
  defaults?: Record<string, unknown>;
  required?: string[];
}
```

Kaynak veri kontrolsüz silinmez.

## 4. Parametre stratejisi

Yeni her kullanım için yeni variable türü üretilmez. Atomik field havuzu küçük tutulur:

- text
- number
- boolean
- date / datetime
- duration
- money
- quantity + dimension + unit
- select / status
- relation
- attachment
- formula
- rollup
- secret

Semantik ağırlık Environment üzerinde taşınır.

## 5. Capture-first davranışı

BellekPad'i açan kullanıcı önce yazabilmelidir.

Örnek hızlı girişler:

```text
-450 market
12 Eylül dahiliye kontrolü
X projesi için yeni fikir: ...
Bu şifreyi kasaya al
Yeni milestone: ...
```

Sistem bunları daha sonra ilgili environment'lara bağlayabilir veya kullanıcı tek hareketle dönüştürebilir.

Amaç:

> **Önce yakala, sonra düzenle.**

## 6. Yaşayan durum motoru

BellekPad yalnızca CRUD ekranları üretmez. Bir gelişme kaydedildiğinde ilişkili durum ve istatistikler türetilebilir.

```text
Event
  ↓
Derived State
  ↓
Relations
  ↓
Metrics
  ↓
Timeline / Dashboard / Alerts
```

Örnekler:

```text
ExpenseRecorded
  ├─ Account balance
  ├─ Monthly spending
  ├─ Budget usage
  └─ Project cost

HospitalResultRecorded
  ├─ Case timeline
  ├─ Latest health state
  ├─ Next action
  └─ Related documents

TaskCompleted
  ├─ Project progress
  ├─ Character XP (opsiyonel)
  ├─ Completion statistics
  └─ Timeline
```

Bu motor gerektiğinde fikstür/lig/puan tablosu gibi özel simülasyonları da taşıyabilir; ancak ürünün merkezi değildir.

## 7. Oyunsuluk

Gamification çocuklaştırıcı olmamalıdır. Görsel dil **soft, sakin, premium ve araçsal** kalır.

Oyunsu katmanlar:

- Character Sheet
- XP / seviye (opsiyonel)
- Milestone
- Quest / kritik hedef
- Inventory
- Collections
- Streak yerine anlamlı continuity ölçümleri
- Progress bars
- Status badges
- Achievement / record cards

Kullanıcı bu katmanları kapatabilir.

## 8. Spatial Inventory lens

Tarkov/Duckov esintisi bir tema değil, alternatif bir **mekânsal envanter görünümüdür**.

```ts
export interface InventoryPlacement {
  itemId: string;
  containerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: 0 | 90;
}
```

Bir item aynı anda liste, tablo, kart veya spatial grid ile görüntülenebilir.

Container örnekleri:

- Backpack
- Shelf
- Drawer
- Computer
- Cloud Account
- Document Folder
- Wallet

Bu lens yalnızca gerçekten anlamlı olduğu alanlarda açılır.

## 9. Soft UI ilkeleri

BellekPad oyun HUD'ı gibi bağırmamalı; üretkenlik aracı gibi sakin kalmalıdır.

- düşük görsel gürültü
- yumuşak yüzeyler
- compact ama boğucu olmayan bilgi yoğunluğu
- güçlü klavye kullanımı
- sürükle-bırak destekli lensler
- hızlı arama ve command palette
- context-sensitive actions
- modüler dashboard
- koyu/açık tema
- erişilebilir kontrast

Oyunsuluk **işlev biçiminde**, dekorasyon biçiminde değil.

## 10. Local-first veri katmanı

```text
React UI
  ↓
Application Services
  ↓
Domain / Environment Engine
  ↓
Repository Interface
  ↓
Dexie / IndexedDB
```

Hassas alanlar ayrı encrypted vault adapter üzerinden saklanır.

Bulut sync daha sonra opsiyonel adapter olarak eklenir; çekirdeğin çalışması için zorunlu değildir.

## 11. İlk teknik hedef

İlk çalışan sürüm şunları kanıtlamalıdır:

1. Hızlı not yakalama ve editör.
2. Entity oluşturma.
3. Entity'ye birden fazla environment bağlama.
4. Event ekleyip derived state üretme.
5. Aynı veriyi en az iki farklı lens ile gösterme.
6. Character Sheet / personal dashboard prototipi.
7. Inventory'de liste ↔ spatial grid geçişi.
8. Finans için temel transaction + aylık analytics.
9. Timeline / milestone sistemi.
10. IndexedDB local-first saklama.
11. Netlify'a statik build olarak deploy edilebilme.
