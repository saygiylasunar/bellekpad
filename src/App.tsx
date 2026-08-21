import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addEnvironment,
  archiveEntity,
  createBackup,
  createPadEntry,
  db,
  getStoragePersistenceState,
  importBackup,
  inferFinanceData,
  requestPersistentStorage,
  updateEnvironmentData,
  type FinanceData,
} from './data/database'
import { CORE_ENVIRONMENTS, type EntityRecord } from './domain/model'
import { VaultView } from './components/VaultView'

type ViewId = 'pad' | 'today' | 'project' | 'case' | 'finance' | 'inventory' | 'vault' | 'stats'

const navigation: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: 'pad', icon: '⌂', label: 'Pad' },
  { id: 'today', icon: '◫', label: 'Bugün' },
  { id: 'project', icon: '◇', label: 'Projeler' },
  { id: 'case', icon: '▣', label: 'Vakalar' },
  { id: 'finance', icon: '₺', label: 'Mali' },
  { id: 'inventory', icon: '◈', label: 'Envanter' },
  { id: 'vault', icon: '⌾', label: 'Kasa' },
  { id: 'stats', icon: '⌁', label: 'İstatistik' },
]

const quickPromotions = ['project', 'case', 'finance', 'health', 'education', 'inventory']

function attributeObject(entry: EntityRecord, key: string): Record<string, unknown> {
  const value = entry.attributes[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatMoney(amount: number, currency = 'TRY') {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${amount.toLocaleString('tr-TR')} ${currency}`
  }
}

function smartEnvironment(text: string): string | null {
  const value = text.trim()
  if (!value) return null
  if (/^[-+]\s*\d/.test(value) || /\b(tl|try|₺|usd|eur|harcama|ödeme|aldım|satın)\b/i.test(value)) return 'finance'
  if (/\b(hastane|doktor|muayene|kontrol|ilaç|tahlil|tetkik|reçete)\b/i.test(value)) return 'health'
  if (/\b(vaka|case|sorun|başvuru|takip)\b/i.test(value)) return 'case'
  if (/\b(proje|project|yapılacak|görev|task)\b/i.test(value)) return 'project'
  if (/\b(aldım|ekipman|cihaz|envanter|çanta|raf)\b/i.test(value)) return 'inventory'
  return null
}

function EntryCard({
  entry,
  environmentNames,
}: {
  entry: EntityRecord
  environmentNames: Map<string, string>
}) {
  return (
    <article className="entry-card">
      <div className="entry-meta">
        <span>{formatDate(entry.updatedAt)}</span>
        <button className="ghost-icon" title="Arşivle" onClick={() => void archiveEntity(entry.id)}>×</button>
      </div>
      <h3>{entry.title}</h3>
      <p>{String(entry.attributes.body ?? '').slice(0, 240)}</p>

      <div className="chip-row">
        {entry.environments.map((environment) => (
          <span className="environment-chip" key={environment}>
            {environmentNames.get(environment) ?? environment}
          </span>
        ))}
      </div>

      <div className="promotion-row">
        {quickPromotions
          .filter((environment) => !entry.environments.includes(environment))
          .slice(0, 4)
          .map((environment) => (
            <button key={environment} onClick={() => void addEnvironment(entry.id, environment)}>
              + {environmentNames.get(environment)}
            </button>
          ))}
      </div>
    </article>
  )
}

function FinanceCard({ entry }: { entry: EntityRecord }) {
  const stored = attributeObject(entry, 'finance')
  const inferred = inferFinanceData(String(entry.attributes.body ?? ''))
  const initialAmount = typeof stored.amount === 'number' ? stored.amount : inferred.amount
  const [amount, setAmount] = useState(initialAmount?.toString() ?? '')
  const [direction, setDirection] = useState<FinanceData['direction']>(
    stored.direction === 'expense' || stored.direction === 'income' || stored.direction === 'neutral'
      ? stored.direction
      : inferred.direction,
  )
  const [currency, setCurrency] = useState(typeof stored.currency === 'string' ? stored.currency : inferred.currency)
  const [category, setCategory] = useState(typeof stored.category === 'string' ? stored.category : 'Genel')
  const numericAmount = Number(amount.replace(',', '.'))

  async function save() {
    await updateEnvironmentData(entry.id, 'finance', {
      amount: Number.isFinite(numericAmount) ? numericAmount : null,
      direction,
      currency,
      category: category.trim() || 'Genel',
    })
  }

  return (
    <article className="module-card finance-card">
      <div className="module-card-head">
        <div>
          <span className={`direction-pill ${direction}`}>{direction === 'expense' ? 'Gider' : direction === 'income' ? 'Gelir' : 'Belirsiz'}</span>
          <h3>{entry.title}</h3>
        </div>
        <strong>{Number.isFinite(numericAmount) && numericAmount > 0 ? formatMoney(numericAmount, currency) : 'Tutar gir'}</strong>
      </div>
      <div className="inline-form finance-form">
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Tutar" />
        <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <select value={direction} onChange={(event) => setDirection(event.target.value as FinanceData['direction'])}>
          <option value="expense">Gider</option>
          <option value="income">Gelir</option>
          <option value="neutral">Belirsiz</option>
        </select>
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Kategori" />
        <button onClick={() => void save()}>Kaydet</button>
      </div>
    </article>
  )
}

function CaseCard({ entry }: { entry: EntityRecord }) {
  const data = attributeObject(entry, 'case')
  const status = typeof data.status === 'string' ? data.status : 'active'

  async function changeStatus(next: string) {
    await updateEnvironmentData(entry.id, 'case', { ...data, status: next })
  }

  return (
    <article className="module-card case-card">
      <div className="module-card-head">
        <div>
          <span className={`status-pill ${status}`}>{status === 'closed' ? 'Kapalı' : status === 'waiting' ? 'Bekliyor' : 'Aktif'}</span>
          <h3>{entry.title}</h3>
        </div>
        <span className="muted">{formatDate(entry.updatedAt)}</span>
      </div>
      <p>{String(entry.attributes.body ?? '')}</p>
      <div className="segmented-actions">
        <button className={status === 'active' ? 'selected' : ''} onClick={() => void changeStatus('active')}>Aktif</button>
        <button className={status === 'waiting' ? 'selected' : ''} onClick={() => void changeStatus('waiting')}>Bekliyor</button>
        <button className={status === 'closed' ? 'selected' : ''} onClick={() => void changeStatus('closed')}>Kapat</button>
      </div>
    </article>
  )
}

function ProjectCard({ entry }: { entry: EntityRecord }) {
  const data = attributeObject(entry, 'project')
  const progress = typeof data.progress === 'number' ? Math.min(100, Math.max(0, data.progress)) : 0

  async function setProgress(next: number) {
    await updateEnvironmentData(entry.id, 'project', {
      ...data,
      progress: next,
      status: next >= 100 ? 'completed' : 'active',
    })
  }

  return (
    <article className="module-card project-card">
      <div className="module-card-head">
        <div>
          <span className="status-pill active">Proje</span>
          <h3>{entry.title}</h3>
        </div>
        <strong>%{progress}</strong>
      </div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      <input
        className="progress-range"
        type="range"
        min="0"
        max="100"
        step="5"
        value={progress}
        onChange={(event) => void setProgress(Number(event.target.value))}
      />
    </article>
  )
}

function InventoryCard({ entry, index }: { entry: EntityRecord; index: number }) {
  const data = attributeObject(entry, 'inventory')
  const container = typeof data.container === 'string' ? data.container : 'Ana Envanter'
  const quantity = typeof data.quantity === 'number' ? data.quantity : 1

  return (
    <article className={`inventory-slot size-${(index % 4) + 1}`}>
      <div className="slot-corner">{String(index + 1).padStart(2, '0')}</div>
      <div className="slot-icon">{entry.title.slice(0, 1).toLocaleUpperCase('tr-TR')}</div>
      <div className="slot-copy">
        <strong>{entry.title}</strong>
        <span>{container}</span>
      </div>
      {quantity > 1 && <b className="slot-qty">×{quantity}</b>}
    </article>
  )
}

export function App() {
  const entries = useLiveQuery(
    () => db.entities.orderBy('updatedAt').reverse().filter((entry) => !entry.archivedAt).toArray(),
    [],
  ) ?? []
  const events = useLiveQuery(() => db.events.orderBy('occurredAt').reverse().limit(40).toArray(), []) ?? []
  const [draft, setDraft] = useState('')
  const [persistent, setPersistent] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeView, setActiveView] = useState<ViewId>('pad')
  const [notice, setNotice] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getStoragePersistenceState().then(setPersistent)
  }, [])

  const environmentNames = useMemo(
    () => new Map(CORE_ENVIRONMENTS.map((environment) => [environment.id, environment.label])),
    [],
  )

  const suggestedEnvironment = useMemo(() => smartEnvironment(draft), [draft])
  const financeEntries = entries.filter((entry) => entry.environments.includes('finance'))
  const caseEntries = entries.filter((entry) => entry.environments.includes('case'))
  const projectEntries = entries.filter((entry) => entry.environments.includes('project'))
  const inventoryEntries = entries.filter((entry) => entry.environments.includes('inventory'))

  const financeSummary = useMemo(() => {
    const totals: Record<string, { expense: number; income: number }> = {}
    for (const entry of financeEntries) {
      const data = attributeObject(entry, 'finance')
      const amount = typeof data.amount === 'number' ? data.amount : 0
      const currency = typeof data.currency === 'string' ? data.currency : 'TRY'
      const direction = data.direction
      totals[currency] ??= { expense: 0, income: 0 }
      if (direction === 'expense') totals[currency].expense += amount
      if (direction === 'income') totals[currency].income += amount
    }
    return totals
  }, [financeEntries])

  const environmentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) {
      for (const environment of entry.environments) counts.set(environment, (counts.get(environment) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [entries])

  async function saveDraft(environment?: string | null) {
    const value = draft.trim()
    if (!value || saving) return
    setSaving(true)
    try {
      const firstLine = value.split('\n')[0].replace(/^#+\s*/, '')
      const entity = await createPadEntry(firstLine.slice(0, 72), value)
      if (environment) await addEnvironment(entity.id, environment)
      setDraft('')
      setNotice(environment ? `${environmentNames.get(environment) ?? environment} ortamına alındı.` : 'Belleğe alındı.')
    } finally {
      setSaving(false)
    }
  }

  async function enablePersistentStorage() {
    const result = await requestPersistentStorage()
    setPersistent(result)
  }

  async function exportLocalBackup() {
    const backup = await createBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `bellekpad-backup-${new Date().toISOString().slice(0, 10)}.bellekpad.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Yerel yedek dışa aktarıldı.')
  }

  async function handleImport(file: File) {
    try {
      await importBackup(await file.text())
      setNotice('Yedek içe aktarıldı.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Yedek içe aktarılamadı.')
    }
  }

  const activeLabel = navigation.find((item) => item.id === activeView)?.label ?? 'Pad'
  const todayKey = new Date().toDateString()
  const todayEntries = entries.filter((entry) => new Date(entry.updatedAt).toDateString() === todayKey)

  function renderView() {
    if (activeView === 'finance') {
      return (
        <>
          <section className="metric-strip">
            {Object.keys(financeSummary).length === 0 && <div className="metric-card"><span>Mali kayıt</span><strong>Henüz yok</strong></div>}
            {Object.entries(financeSummary).map(([currency, total]) => (
              <div className="metric-card" key={currency}>
                <span>{currency} net akış</span>
                <strong>{formatMoney(total.income - total.expense, currency)}</strong>
                <small>{formatMoney(total.income, currency)} gelir · {formatMoney(total.expense, currency)} gider</small>
              </div>
            ))}
          </section>
          <section className="module-list">
            {financeEntries.map((entry) => <FinanceCard key={entry.id} entry={entry} />)}
            {!financeEntries.length && <EmptyModule text="Bir Pad kaydını Mali ortamına dönüştür; tutar ve yön burada yönetilecek." />}
          </section>
        </>
      )
    }

    if (activeView === 'case') {
      return <section className="module-list">{caseEntries.map((entry) => <CaseCard key={entry.id} entry={entry} />)}{!caseEntries.length && <EmptyModule text="Takip edilmesi gereken bir kaydı Vaka'ya dönüştür." />}</section>
    }

    if (activeView === 'project') {
      return <section className="module-list">{projectEntries.map((entry) => <ProjectCard key={entry.id} entry={entry} />)}{!projectEntries.length && <EmptyModule text="Bir kaydı Proje'ye dönüştür; ilerleme davranışları otomatik kazanılır." />}</section>
    }

    if (activeView === 'inventory') {
      return (
        <>
          <div className="inventory-toolbar"><span>{inventoryEntries.length} öğe</span><span>Soft grid lens · drag/drop sonraki katman</span></div>
          <section className="inventory-grid">
            {inventoryEntries.map((entry, index) => <InventoryCard key={entry.id} entry={entry} index={index} />)}
            {!inventoryEntries.length && <EmptyModule text="Ekipman, belge veya dijital varlık kaydını Envanter ortamına al." />}
          </section>
        </>
      )
    }

    if (activeView === 'vault') {
      return <VaultView />
    }

    if (activeView === 'stats') {
      return (
        <div className="stats-layout">
          <section className="stats-panel">
            <p className="eyebrow">Ortam dağılımı</p>
            <h2>Belleğin yapısı</h2>
            <div className="bar-list">
              {environmentCounts.map(([environment, count]) => (
                <div className="bar-row" key={environment}>
                  <span>{environmentNames.get(environment) ?? environment}</span>
                  <div><i style={{ width: `${Math.max(8, (count / Math.max(1, entries.length)) * 100)}%` }} /></div>
                  <b>{count}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="stats-panel">
            <p className="eyebrow">Olay günlüğü</p>
            <h2>Son değişimler</h2>
            <div className="event-list">
              {events.slice(0, 12).map((event) => (
                <div key={event.id}><span>{event.type}</span><small>{formatDate(event.occurredAt)}</small></div>
              ))}
            </div>
          </section>
        </div>
      )
    }

    const visibleEntries = activeView === 'today' ? todayEntries : entries
    return (
      <>
        {activeView === 'pad' && (
          <section className="capture-card">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void saveDraft()
                }
              }}
              placeholder="Bir şey yaz… not, harcama, fikir, kontrol, iş, gelişme. Önce kaydet; sonra anlamlandırırız."
              aria-label="Hızlı kayıt"
            />
            <div className="capture-footer">
              <div className="capture-hints">
                <span>Ctrl + Enter ile kaydet</span>
                {suggestedEnvironment && (
                  <button className="smart-chip" onClick={() => void saveDraft(suggestedEnvironment)}>
                    ✦ {environmentNames.get(suggestedEnvironment)} olarak al
                  </button>
                )}
              </div>
              <button className="primary-button" onClick={() => void saveDraft()} disabled={!draft.trim() || saving}>
                {saving ? 'Kaydediliyor…' : 'Belleğe al'}
              </button>
            </div>
          </section>
        )}

        <section className="section-heading">
          <div>
            <p className="eyebrow">{activeView === 'today' ? 'Bugün' : 'Akış'}</p>
            <h2>{activeView === 'today' ? 'Bugünün izleri' : 'Son kayıtlar'}</h2>
          </div>
          <span className="soft-badge">local-first</span>
        </section>

        <section className="entry-grid">
          {visibleEntries.length === 0 ? (
            <div className="empty-state">
              <strong>{activeView === 'today' ? 'Bugün henüz iz yok.' : 'Bellek henüz boş.'}</strong>
              <p>Pad'e yazılan her şey düz not olarak başlayabilir; sonra başka ortamlarda yeni davranışlar kazanır.</p>
            </div>
          ) : visibleEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} environmentNames={environmentNames} />
          ))}
        </section>
      </>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div><strong>BellekPad</strong><span>kişisel sistem</span></div>
        </div>

        <nav className="nav-list" aria-label="Ana gezinme">
          {navigation.map((item) => (
            <button key={item.id} className={`nav-item ${activeView === item.id ? 'active' : ''}`} onClick={() => setActiveView(item.id)}>
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-actions">
          <button onClick={() => void exportLocalBackup()}>⇩ Yedek al</button>
          <button onClick={() => importRef.current?.click()}>⇧ Yedek yükle</button>
          <input
            ref={importRef}
            type="file"
            accept=".json,.bellekpad"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
              event.currentTarget.value = ''
            }}
          />
        </div>

        <div className="storage-card">
          <span className={`status-dot ${persistent ? 'ok' : ''}`} />
          <div><strong>{persistent ? 'Kalıcı yerel depolama' : 'Yerel depolama'}</strong><small>IndexedDB · cihazda</small></div>
          {!persistent && <button onClick={() => void enablePersistentStorage()}>Sabitle</button>}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · {activeLabel}</p>
            <h1>{activeView === 'pad' ? 'Ne olduysa yaz.' : activeLabel}</h1>
          </div>
          <div className="top-stats">
            <span><b>{entries.length}</b> kayıt</span>
            <span><b>{events.length}</b> son olay</span>
          </div>
        </header>

        {notice && <div className="notice" onClick={() => setNotice('')}>{notice}<span>×</span></div>}
        {renderView()}
      </main>
    </div>
  )
}

function EmptyModule({ text }: { text: string }) {
  return <div className="empty-state compact"><strong>Bu alan hazır.</strong><p>{text}</p></div>
}
