import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/database'
import './CharacterView.css'

function distinctActiveDays(dates: string[], days = 7) {
  const now = new Date()
  const threshold = new Date(now)
  threshold.setDate(now.getDate() - (days - 1))
  threshold.setHours(0, 0, 0, 0)

  return new Set(
    dates
      .map((date) => new Date(date))
      .filter((date) => date >= threshold)
      .map((date) => date.toISOString().slice(0, 10)),
  ).size
}

export function CharacterView() {
  const entities = useLiveQuery(() => db.entities.toArray(), []) ?? []
  const events = useLiveQuery(() => db.events.toArray(), []) ?? []
  const profileSetting = useLiveQuery(() => db.settings.get('character.profile'), [])

  const currentProfile = profileSetting?.value && typeof profileSetting.value === 'object'
    ? profileSetting.value as Record<string, unknown>
    : {}

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(typeof currentProfile.name === 'string' ? currentProfile.name : 'Bellek Sahibi')
  const [title, setTitle] = useState(typeof currentProfile.title === 'string' ? currentProfile.title : 'Kişisel Sistem Yöneticisi')

  const activeEntities = entities.filter((entry) => !entry.archivedAt)
  const archivedCount = entities.length - activeEntities.length
  const projectEntries = activeEntities.filter((entry) => entry.environments.includes('project'))
  const caseEntries = activeEntities.filter((entry) => entry.environments.includes('case'))
  const inventoryEntries = activeEntities.filter((entry) => entry.environments.includes('inventory'))
  const healthEntries = activeEntities.filter((entry) => entry.environments.includes('health'))

  const xp = events.length * 25 + archivedCount * 50 + inventoryEntries.length * 10
  const level = Math.floor(xp / 500) + 1
  const levelFloor = (level - 1) * 500
  const levelProgress = Math.min(100, Math.round(((xp - levelFloor) / 500) * 100))
  const activeDays = distinctActiveDays(events.map((event) => event.occurredAt), 7)
  const environmentCount = useMemo(
    () => new Set(activeEntities.flatMap((entry) => entry.environments)).size,
    [activeEntities],
  )

  const stats = [
    { label: 'Bellek', value: Math.min(100, activeEntities.length * 4), detail: `${activeEntities.length} aktif kayıt` },
    { label: 'İvme', value: Math.round((activeDays / 7) * 100), detail: `7 günde ${activeDays} etkin gün` },
    { label: 'Düzen', value: Math.min(100, environmentCount * 9), detail: `${environmentCount} etkin ortam` },
    { label: 'Kaynak', value: Math.min(100, inventoryEntries.length * 8), detail: `${inventoryEntries.length} envanter öğesi` },
  ]

  async function saveProfile() {
    await db.settings.put({
      key: 'character.profile',
      value: { name: name.trim() || 'Bellek Sahibi', title: title.trim() || 'Kişisel Sistem Yöneticisi' },
      updatedAt: new Date().toISOString(),
    })
    setEditing(false)
  }

  return (
    <div className="character-layout">
      <section className="character-hero">
        <div className="character-avatar">{name.slice(0, 1).toLocaleUpperCase('tr-TR') || 'B'}</div>
        <div className="character-identity">
          <p className="eyebrow">Character Sheet · Local profile</p>
          {editing ? (
            <div className="character-edit">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ad / rumuz" />
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Başlık" />
              <button onClick={() => void saveProfile()}>Kaydet</button>
            </div>
          ) : (
            <>
              <h2>{typeof currentProfile.name === 'string' ? currentProfile.name : name}</h2>
              <p>{typeof currentProfile.title === 'string' ? currentProfile.title : title}</p>
              <button className="character-edit-button" onClick={() => setEditing(true)}>Profili düzenle</button>
            </>
          )}
        </div>
        <div className="level-orb">
          <span>LVL</span>
          <strong>{level}</strong>
        </div>
      </section>

      <section className="xp-panel">
        <div className="xp-copy">
          <div><span>Deneyim</span><strong>{xp.toLocaleString('tr-TR')} XP</strong></div>
          <small>Sonraki seviye: {level * 500} XP</small>
        </div>
        <div className="xp-track"><span style={{ width: `${levelProgress}%` }} /></div>
      </section>

      <section className="character-columns">
        <div className="character-panel">
          <p className="eyebrow">Nitelikler</p>
          <h3>Sistem durumu</h3>
          <div className="character-stat-list">
            {stats.map((stat) => (
              <div className="character-stat" key={stat.label}>
                <div><strong>{stat.label}</strong><span>{stat.detail}</span></div>
                <div className="character-stat-track"><i style={{ width: `${stat.value}%` }} /></div>
                <b>{stat.value}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="character-panel">
          <p className="eyebrow">Aktif yük</p>
          <h3>Görev durumu</h3>
          <div className="loadout-grid">
            <div><span>◇</span><strong>{projectEntries.length}</strong><small>Proje</small></div>
            <div><span>▣</span><strong>{caseEntries.length}</strong><small>Vaka</small></div>
            <div><span>◈</span><strong>{inventoryEntries.length}</strong><small>Envanter</small></div>
            <div><span>♡</span><strong>{healthEntries.length}</strong><small>Sağlık kaydı</small></div>
          </div>
        </div>
      </section>

      <section className="character-panel character-log">
        <div>
          <p className="eyebrow">Son faaliyet</p>
          <h3>Yaşam günlüğü</h3>
        </div>
        <div className="character-events">
          {events.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8).map((event) => (
            <div key={event.id}>
              <span>{event.type}</span>
              <small>{new Date(event.occurredAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</small>
            </div>
          ))}
          {!events.length && <p>İlk kayıtla birlikte burada faaliyet izi oluşacak.</p>}
        </div>
      </section>
    </div>
  )
}
