import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateEnvironmentData } from '../data/database'
import type { EntityRecord } from '../domain/model'
import './HealthView.css'

type HealthType = 'followup' | 'medication' | 'appointment' | 'test' | 'observation'

function healthData(entry: EntityRecord): Record<string, unknown> {
  const value = entry.attributes.health
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function HealthCard({ entry }: { entry: EntityRecord }) {
  const stored = healthData(entry)
  const [type, setType] = useState<HealthType>(
    stored.type === 'medication' || stored.type === 'appointment' || stored.type === 'test' || stored.type === 'observation'
      ? stored.type
      : 'followup',
  )
  const [status, setStatus] = useState(typeof stored.status === 'string' ? stored.status : 'tracking')
  const [nextAt, setNextAt] = useState(typeof stored.nextAt === 'string' ? stored.nextAt : '')
  const [detail, setDetail] = useState(typeof stored.detail === 'string' ? stored.detail : '')

  async function save() {
    await updateEnvironmentData(entry.id, 'health', {
      ...stored,
      type,
      status,
      nextAt: nextAt || null,
      detail,
    })
  }

  return (
    <article className="module-card health-card">
      <div className="module-card-head">
        <div>
          <span className={`health-type ${type}`}>{type === 'medication' ? 'İlaç' : type === 'appointment' ? 'Randevu' : type === 'test' ? 'Tetkik' : type === 'observation' ? 'Gözlem' : 'Takip'}</span>
          <h3>{entry.title}</h3>
        </div>
        <span className={`status-pill ${status === 'done' ? 'closed' : status === 'waiting' ? 'waiting' : 'active'}`}>{status === 'done' ? 'Tamamlandı' : status === 'waiting' ? 'Bekliyor' : 'Takipte'}</span>
      </div>
      <p>{String(entry.attributes.body ?? '')}</p>
      <div className="health-form">
        <select value={type} onChange={(event) => setType(event.target.value as HealthType)}>
          <option value="followup">Takip</option>
          <option value="medication">İlaç</option>
          <option value="appointment">Randevu</option>
          <option value="test">Tetkik</option>
          <option value="observation">Gözlem</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="tracking">Takipte</option>
          <option value="waiting">Bekliyor</option>
          <option value="done">Tamamlandı</option>
        </select>
        <input type="datetime-local" value={nextAt} onChange={(event) => setNextAt(event.target.value)} />
        <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={type === 'medication' ? 'Doz / sıklık notu' : 'Kısa ayrıntı'} />
        <button onClick={() => void save()}>Kaydet</button>
      </div>
    </article>
  )
}

export function HealthView() {
  const entries = useLiveQuery(
    () => db.entities.where('environments').equals('health').filter((entry) => !entry.archivedAt).toArray(),
    [],
  ) ?? []

  const medicationCount = entries.filter((entry) => healthData(entry).type === 'medication').length
  const openCount = entries.filter((entry) => healthData(entry).status !== 'done').length
  const upcoming = entries
    .map((entry) => ({ entry, nextAt: healthData(entry).nextAt }))
    .filter((item): item is { entry: EntityRecord; nextAt: string } => typeof item.nextAt === 'string' && Boolean(item.nextAt))
    .sort((a, b) => new Date(a.nextAt).getTime() - new Date(b.nextAt).getTime())[0]

  return (
    <div className="health-layout">
      <section className="metric-strip">
        <div className="metric-card"><span>Sağlık kaydı</span><strong>{entries.length}</strong><small>{openCount} açık takip</small></div>
        <div className="metric-card"><span>İlaç kaydı</span><strong>{medicationCount}</strong><small>yalnız kayıt ve zaman takibi</small></div>
        <div className="metric-card"><span>Sıradaki zaman</span><strong className="metric-small">{upcoming ? new Date(upcoming.nextAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</strong><small>{upcoming?.entry.title ?? 'Planlı kayıt yok'}</small></div>
      </section>
      <section className="module-list">
        {entries.map((entry) => <HealthCard key={entry.id} entry={entry} />)}
        {!entries.length && <div className="empty-state compact"><strong>Sağlık alanı boş.</strong><p>Pad’deki bir kontrol, ilaç veya tetkik notunu Sağlık ortamına dönüştür.</p></div>}
      </section>
    </div>
  )
}
