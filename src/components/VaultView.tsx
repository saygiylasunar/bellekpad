import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/database'
import { createCredential, unlockAllCredentials, type UnlockedCredential } from '../data/vault'
import './VaultView.css'

const emptyDraft = { title: '', username: '', password: '', url: '', notes: '' }

export function VaultView() {
  const credentialCount = useLiveQuery(() => db.vault.where('kind').equals('credential').count(), []) ?? 0
  const [masterPassword, setMasterPassword] = useState('')
  const [unlocked, setUnlocked] = useState<UnlockedCredential[] | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function unlock() {
    if (!masterPassword) return
    try {
      setError('')
      setUnlocked(await unlockAllCredentials(masterPassword))
    } catch (reason) {
      setUnlocked(null)
      setError(reason instanceof Error ? reason.message : 'Kasa açılamadı.')
    }
  }

  async function saveCredential() {
    if (!masterPassword || !draft.title.trim() || !draft.password) return
    try {
      setError('')
      await createCredential(masterPassword, draft.title, {
        username: draft.username,
        password: draft.password,
        url: draft.url,
        notes: draft.notes,
      })
      setDraft(emptyDraft)
      setUnlocked(await unlockAllCredentials(masterPassword))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kasa kaydı oluşturulamadı.')
    }
  }

  function lock() {
    setUnlocked(null)
    setMasterPassword('')
    setDraft(emptyDraft)
    setError('')
  }

  async function copySecret(value: string, id: string) {
    await navigator.clipboard.writeText(value)
    setCopied(id)
    window.setTimeout(() => setCopied(''), 1400)
  }

  if (unlocked === null) {
    return (
      <section className="vault-gate">
        <div className="vault-emblem">⌁</div>
        <p className="eyebrow">Şifreli yerel kasa</p>
        <h2>{credentialCount ? 'Kasayı aç' : 'Kasayı oluştur'}</h2>
        <p>
          {credentialCount
            ? `${credentialCount} şifreli kayıt cihazda bekliyor. Ana parola hiçbir yere kaydedilmez.`
            : 'İlk ana parolanı belirle. Bu parola cihazda veya yedekte saklanmayacak.'}
        </p>
        <div className="vault-unlock-row">
          <input
            type="password"
            autoComplete="current-password"
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void unlock()
            }}
            placeholder="Ana parola"
          />
          <button onClick={() => void unlock()} disabled={!masterPassword}>Kilidi aç</button>
        </div>
        {error && <span className="form-error">{error}</span>}
        <small>AES‑256‑GCM · PBKDF2‑SHA256 · 250.000 tur · IndexedDB</small>
      </section>
    )
  }

  return (
    <div className="vault-layout">
      <section className="vault-toolbar">
        <div>
          <p className="eyebrow">Oturum açık</p>
          <h2>Kasa</h2>
        </div>
        <button onClick={lock}>Kilitle</button>
      </section>

      <section className="credential-form module-card">
        <div className="module-card-head">
          <div><span className="status-pill active">Şifreli</span><h3>Yeni giriş</h3></div>
          <small className="muted">Gizli alanlar yalnız şifreli blob olarak saklanır.</small>
        </div>
        <div className="vault-form-grid">
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Servis / kayıt adı" />
          <input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} placeholder="Kullanıcı adı / e-posta" />
          <input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Parola" />
          <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="Adres / URL" />
          <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Şifreli not" />
          <button onClick={() => void saveCredential()} disabled={!draft.title.trim() || !draft.password}>Kasaya al</button>
        </div>
        {error && <span className="form-error">{error}</span>}
      </section>

      <section className="credential-grid">
        {unlocked.map((credential) => (
          <article className="credential-card" key={credential.record.id}>
            <div className="credential-head">
              <div className="credential-icon">{credential.entity.title.slice(0, 1).toLocaleUpperCase('tr-TR')}</div>
              <div><strong>{credential.entity.title}</strong><span>{credential.payload.username || 'Kullanıcı adı yok'}</span></div>
            </div>
            <div className="secret-row">
              <code>{credential.payload.password}</code>
              <button onClick={() => void copySecret(credential.payload.password, credential.record.id)}>
                {copied === credential.record.id ? 'Kopyalandı' : 'Kopyala'}
              </button>
            </div>
            {credential.payload.url && <a href={credential.payload.url} target="_blank" rel="noreferrer">{credential.payload.url}</a>}
            {credential.payload.notes && <p>{credential.payload.notes}</p>}
          </article>
        ))}
        {!unlocked.length && <div className="empty-state compact"><strong>Kasa boş.</strong><p>İlk şifreli girişini yukarıdan ekle.</p></div>}
      </section>
    </div>
  )
}
