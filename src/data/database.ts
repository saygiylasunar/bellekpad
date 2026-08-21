import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSetting,
  AttachmentRecord,
  DomainEvent,
  EntityRecord,
  RelationRecord,
  VaultRecord,
} from '../domain/model'

class BellekPadDatabase extends Dexie {
  entities!: EntityTable<EntityRecord, 'id'>
  events!: EntityTable<DomainEvent, 'id'>
  relations!: EntityTable<RelationRecord, 'id'>
  attachments!: EntityTable<AttachmentRecord, 'id'>
  vault!: EntityTable<VaultRecord, 'id'>
  settings!: EntityTable<AppSetting, 'key'>

  constructor() {
    super('bellekpad')

    this.version(1).stores({
      entities: 'id, kind, title, updatedAt, archivedAt, *environments',
      events: 'id, entityId, environmentId, type, occurredAt',
      relations: 'id, sourceId, targetId, type, createdAt',
      attachments: 'id, entityId, name, mimeType, createdAt',
      vault: 'id, ownerEntityId, kind, updatedAt',
      settings: 'key, updatedAt',
    })
  }
}

export const db = new BellekPadDatabase()

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  return navigator.storage.persist()
}

export async function getStoragePersistenceState(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null
  return navigator.storage.persisted()
}

export async function createPadEntry(title: string, body: string): Promise<EntityRecord> {
  const now = new Date().toISOString()
  const entity: EntityRecord = {
    id: crypto.randomUUID(),
    title: title.trim() || 'Adsız kayıt',
    kind: 'note',
    environments: ['pad'],
    attributes: { body },
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.entities, db.events, async () => {
    await db.entities.add(entity)
    await db.events.add({
      id: crypto.randomUUID(),
      entityId: entity.id,
      environmentId: 'pad',
      type: 'entity.created',
      occurredAt: now,
      payload: { kind: entity.kind },
    })
  })

  return entity
}

export async function addEnvironment(entityId: string, environmentId: string): Promise<void> {
  const entity = await db.entities.get(entityId)
  if (!entity || entity.environments.includes(environmentId)) return

  const now = new Date().toISOString()
  await db.transaction('rw', db.entities, db.events, async () => {
    await db.entities.update(entityId, {
      environments: [...entity.environments, environmentId],
      updatedAt: now,
    })
    await db.events.add({
      id: crypto.randomUUID(),
      entityId,
      environmentId,
      type: 'environment.promoted',
      occurredAt: now,
      payload: { from: entity.environments, to: environmentId },
    })
  })
}
