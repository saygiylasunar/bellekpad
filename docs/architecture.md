# BellekPad — Çekirdek Mimari

## 1. Ürün tanımı

BellekPad, sabit modüllerden oluşan bir not uygulaması değildir. Aynı gerçek verinin farklı **ortamlarda** farklı anlam, davranış, görünüm ve istatistik kazanabildiği local-first bir kişisel yönetim sistemidir.

Temel akış:

```text
Entity
  ↓
Environment
  ↓
Capability
  ↓
Event
  ↓
Projection / Derived State
  ↓
Metric / Analytics
  ↓
Lens / Dashboard
```

## 2. Ana kavramlar

### Entity

Kalıcı gerçek nesne. Bir kişi, harcama, ilaç, proje, maç, cihaz, ders, parola kaydı veya not olabilir.

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

`kind` yalnızca temel kimlik/veri sınıfı için kullanılır. Uygulama davranışı yalnızca `kind` üzerinden hard-code edilmez.

### Environment

Bir Entity'nin nasıl yorumlandığını belirleyen davranış paketi.

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

Örnekler:

- `core`
- `temporal`
- `finance`
- `health`
- `case`
- `project`
- `education`
- `inventory`
- `tournament`
- `character`

Bir entity birden çok environment taşıyabilir. Örneğin hastane kontrolü aynı anda `health + temporal + case + finance` içinde yaşayabilir.

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
- `scoreable`
- `relational`
- `sensitive`

UI mümkün olduğunca entity türünden değil capability'lerden türetilir.

### Event

Sistemde gerçekleşmiş değişiklik veya gelişme.

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
- `match.played`
- `transfer.completed`

Timeline, audit, analytics ve geri alma için kritik değişikliklerde event geçmişi korunur.

### Relation

```ts
export interface RelationRef {
  type: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}
```

Örnekler: `belongsTo`, `relatedTo`, `paidFor`, `participantOf`, `assignedTo`, `storedIn`, `dependsOn`.

### Lens

Aynı verinin farklı görsel/etkileşimsel sunumu. Lens veri modelini değiştirmez.

- Card
- Table
- Timeline
- Calendar
- Kanban
- Graph
- Dashboard
- Character Sheet
- Fixture Board
- Spatial Inventory

## 3. Environment dönüşümü

Environment'lar arasında üç farklı davranış bulunur.

### Projection

Kaynak veri değişmeden başka ortamın lensiyle gösterilir.

Örnek: Inventory item → Finance görünümü.

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

## 5. Zade Haxball yaklaşımının BellekPad'e çevrilmesi

Referans: `https://zade-haxball.netlify.app/`

Zade Haxball Ligi BellekPad için bir spor modülü olarak değil, **yaşayan yönetim paneli davranışının referansı** olarak kullanılır.

Temel fikir:

```text
Kullanıcı olay girer
        ↓
Event kaydı oluşur
        ↓
İlgili entity'lerin durumu türetilir
        ↓
Tablolar ve sıralamalar güncellenir
        ↓
Timeline / istatistik / dashboard yenilenir
```

Turnuva örneğinde:

```text
MatchResultEntered
  ├─ Fixture → played
  ├─ Team → W/D/L değişir
  ├─ Standings → yeniden hesaplanır
  ├─ PlayerStats → gol/asist vb. artar
  ├─ Timeline → maç olayı eklenir
  └─ Dashboard → form/puan/istatistik yenilenir
```

Aynı motor farklı ortamlarda:

```text
HospitalResultEntered
  ├─ Case status
  ├─ Health timeline
  ├─ Next action
  └─ Metrics

ExpenseRecorded
  ├─ Account balance
  ├─ Budget consumption
  ├─ Project cost
  └─ Monthly analytics

CourseCompleted
  ├─ Education progress
  ├─ Skill relation
  ├─ Milestone
  └─ Statistics
```

Bu nedenle BellekPad'in merkezinde CRUD ekranları değil **Event → Derived State** zinciri bulunur.

## 6. Tournament environment — stres testi

### Entities

- Season
- Team
- Participant
- Match
- SquadMembership
- Transfer
- CompetitionRule

### Events

- `season.created`
- `player.registered`
- `squad.joined`
- `transfer.completed`
- `match.scheduled`
- `match.played`
- `goal.recorded`
- `assist.recorded`
- `card.recorded`

### Derived views

- Fixture
- Standings
- Form table
- Player leaderboard
- Team detail
- Transfer log
- Activity timeline

Bu yapı çalışıyorsa aynı çekirdek Project/Case/Finance/Health gibi daha genel kullanım alanlarını da taşıyabilir.

## 7. Spatial Inventory lens

Tarkov/Duckov esintisi yalnızca görsel süs değil, gerçek bir **spatial inventory lens** olacaktır.

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

Bir inventory item hem tablo/listede hem de grid üzerinde gösterilebilir.

Container örnekleri:

- Backpack
- Shelf
- Drawer
- Computer
- Cloud Account
- Document Folder
- Wallet

Grid lens opsiyoneldir. Finans kaydı veya ilaç gibi her entity zorla spatial inventory'ye sokulmaz.

## 8. Local-first veri katmanı

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

## 9. İlk teknik hedef

İlk çalışan sürüm şunları kanıtlamalıdır:

1. Entity oluşturma.
2. Entity'ye birden fazla environment bağlama.
3. Event ekleyip derived state üretme.
4. Aynı veriyi en az iki farklı lens ile gösterme.
5. Tournament örneğinde maç sonucu → puan tablosu otomasyonu.
6. Inventory örneğinde liste ↔ spatial grid geçişi.
7. Veriyi IndexedDB'de local-first saklama.
8. Netlify'a statik build olarak deploy edilebilme.
