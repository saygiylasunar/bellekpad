import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addEnvironment,
  createPadEntry,
  db,
  getStoragePersistenceState,
  requestPersistentStorage,
} from './data/database'
import { CORE_ENVIRONMENTS } from './domain/model'

const quickPromotions = ['project', 'case', 'finance', 'health', 'education', 'inventory']

export function App() {
  const entries = useLiveQuery(() => db.entities.orderBy('updatedAt').reverse().limit(20).toArray(), []) ?? []
  const eventCount = useLiveQuery(() => db.events.count(), []) ?? 0
  const [draft, setDraft] = useState('')
  const [persistent, setPersistent] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getStoragePersistenceState().then(setPersistent)
  }, [])

  const environmentNames = useMemo(
    () => new Map(CORE_ENVIRONMENTS.map((environment) => [environment.id, environment.label])),
    [],
  )

  async function saveDraft() {
    const value = draft.trim()
    if (!value || saving) return
    setSaving(true)
    try {
      const firstLine = value.split('\n')[0].replace(/^#+\s*/, '')
      await createPadEntry(firstLine.slice(0, 72), value)
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  async function enablePersistentStorage() {
    const result = await requestPersistentStorage()
    setPersistent(result)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div>
            <strong>BellekPad</strong>
            <span>kişisel sistem</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Ana gezinme">
          <button className="nav-item active">⌂ <span>Pad</span></button>
          <button className="nav-item">◫ <span>Bugün</span></button>
          <button className="nav-item">◇ <span>Projeler</span></button>
          <button className="nav-item">▣ <span>Vakalar</span></button>
          <button className="nav-item">◈ <span>Envanter</span></button>
          <button className="nav-item">⌁ <span>Kasa</span></button>
          <button className="nav-item">⌁ <span>İstatistik</span></button>
        </nav>

        <div className="storage-card">
          <span className={`status-dot ${persistent ? 'ok' : ''}`} />
          <div>
            <strong>{persistent ? 'Kalıcı yerel depolama' : 'Yerel depolama'}</strong>
            <small>IndexedDB · cihazda</small>
          </div>
          {!persistent && <button onClick={enablePersistentStorage}>Sabitle</button>}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">21 Ağustos 2026 · Bellek alanı</p>
            <h1>Ne olduysa yaz.</h1>
          </div>
          <div className="top-stats">
            <span><b>{entries.length}</b> kayıt</span>
            <span><b>{eventCount}</b> olay</span>
          </div>
        </header>

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
            <span>Ctrl + Enter ile kaydet</span>
            <button className="primary-button" onClick={saveDraft} disabled={!draft.trim() || saving}>
              {saving ? 'Kaydediliyor…' : 'Belleğe al'}
            </button>
          </div>
        </section>

        <section className="section-heading">
          <div>
            <p className="eyebrow">Akış</p>
            <h2>Son kayıtlar</h2>
          </div>
          <span className="soft-badge">local-first</span>
        </section>

        <section className="entry-grid">
          {entries.length === 0 ? (
            <div className="empty-state">
              <strong>Bellek henüz boş.</strong>
              <p>İlk kaydı yukarıdaki pad'e yaz. Düz not olarak başlayıp daha sonra başka alanlara dönüşebilir.</p>
            </div>
          ) : entries.map((entry) => (
            <article className="entry-card" key={entry.id}>
              <div className="entry-meta">
                <span>{new Date(entry.updatedAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span>{entry.kind}</span>
              </div>
              <h3>{entry.title}</h3>
              <p>{String(entry.attributes.body ?? '').slice(0, 220)}</p>

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
                    <button key={environment} onClick={() => addEnvironment(entry.id, environment)}>
                      + {environmentNames.get(environment)}
                    </button>
                  ))}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
