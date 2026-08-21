import { decryptJson, encryptJson } from './crypto'
import { db } from './database'
import type { EntityRecord, VaultRecord } from '../domain/model'

export interface CredentialPayload {
  username: string
  password: string
  url: string
  notes: string
}

export interface UnlockedCredential {
  entity: EntityRecord
  record: VaultRecord
  payload: CredentialPayload
}

export async function createCredential(
  masterPassword: string,
  title: string,
  payload: CredentialPayload,
): Promise<void> {
  const now = new Date().toISOString()
  const entityId = crypto.randomUUID()
  const encrypted = await encryptJson(masterPassword, payload)

  const entity: EntityRecord = {
    id: entityId,
    title: title.trim() || 'Kasa kaydı',
    kind: 'credential',
    environments: ['pad', 'vault'],
    attributes: { vault: { encrypted: true } },
    createdAt: now,
    updatedAt: now,
  }

  const record: VaultRecord = {
    id: crypto.randomUUID(),
    ownerEntityId: entityId,
    kind: 'credential',
    encryptedPayload: encrypted.encryptedPayload,
    iv: encrypted.iv,
    salt: encrypted.salt,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.entities, db.vault, db.events, async () => {
    await db.entities.add(entity)
    await db.vault.add(record)
    await db.events.add({
      id: crypto.randomUUID(),
      entityId,
      environmentId: 'vault',
      type: 'vault.credential.created',
      occurredAt: now,
      payload: { kind: 'credential' },
    })
  })
}

export async function unlockCredential(record: VaultRecord, masterPassword: string): Promise<CredentialPayload> {
  if (!record.salt) throw new Error('Bu kasa kaydında anahtar türetme tuzu bulunamadı.')
  return decryptJson<CredentialPayload>(masterPassword, record.encryptedPayload, record.iv, record.salt)
}

export async function unlockAllCredentials(masterPassword: string): Promise<UnlockedCredential[]> {
  const records = await db.vault.where('kind').equals('credential').toArray()
  const unlocked = await Promise.all(records.map(async (record) => {
    const entity = record.ownerEntityId ? await db.entities.get(record.ownerEntityId) : undefined
    if (!entity) return null
    const payload = await unlockCredential(record, masterPassword)
    return { entity, record, payload }
  }))

  return unlocked.filter((item): item is UnlockedCredential => item !== null)
}
