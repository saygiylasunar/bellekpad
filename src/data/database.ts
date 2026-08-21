import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSetting,
  AttachmentRecord,
  AttributeValue,
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

export interface FinanceData {
  direction: 'expense' | 'income' | 'neutral'
  amount: number | null
  currency: string
  category: string
}

export interface BellekPadBackup {
  format: 'bellekpad-backup'
  version: 1
  exportedAt: string
  entities: EntityRecord[]
  events: DomainEvent[]
  relations: RelationRecord[]
  settings: AppSetting[]
  vault: VaultRecord[]
  attachments: Array<Omit<AttachmentRecord, 'blob'> & { dataUrl: string }>
}

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

export function inferFinanceData(text: string): FinanceData {
  const trimmed = text.trim()
  const amountMatch = trimmed.match(/(^|\s)([-+])?\s*(\d{1,9}(?:[.,]\d{1,2})?)\s*(₺|TL|TRY|\$|USD|€|EUR)?(?=\s|$)/i)
  const sign = amountMatch?.[2]
  const rawAmount = amountMatch?.[3]
  const currencyToken = amountMatch?.[4]?.toUpperCase()
  const amount = rawAmount ? Number(rawAmount.replace(',', '.')) : null
  const direction: FinanceData['direction'] = sign === '+' ? 'income' : sign === '-' ? 'expense' : 'neutral'
  const currency = currencyToken === '$' || currencyToken === 'USD'
    ? 'USD'
    : currencyToken === '€' || currencyToken === 'EUR'
      ? 'EUR'
      : 'TRY'

  return {
    direction,
    amount: Number.isFinite(amount) ? amount : null,
    currency,
    category: 'Genel',
  }
}

function defaultsForEnvironment(entity: EntityRecord, environmentId: string, now: string): Record<string, AttributeValue> {
  const body = String(entity.attributes.body ?? '')

  switch (environmentId) {
    case 'finance':
      return { finance: inferFinanceData(body) as unknown as Record<string, unknown> }
    case 'case':
      return { case: { status: 'active', priority: 'normal', openedAt: now } }
    case 'project':
      return { project: { status: 'active', progress: 0, openedAt: now } }
    case 'health':
      return { health: { status: 'tracking', recordedAt: now } }
    case 'education':
      return { education: { status: 'active', progress: 0 } }
    case 'inventory':
      return { inventory: { container: 'Ana Envanter', width: 1, height: 1, quantity: 1 } }
    case 'temporal':
      return { temporal: { status: 'unscheduled' } }
    default:
      return {}
  }
}

export async function addEnvironment(entityId: string, environmentId: string): Promise<void> {
  const entity = await db.entities.get(entityId)
  if (!entity || entity.environments.includes(environmentId)) return

  const now = new Date().toISOString()
  const environmentDefaults = defaultsForEnvironment(entity, environmentId, now)

  await db.transaction('rw', db.entities, db.events, async () => {
    await db.entities.update(entityId, {
      environments: [...entity.environments, environmentId],
      attributes: { ...entity.attributes, ...environmentDefaults },
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

export async function updateEnvironmentData(
  entityId: string,
  environmentId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const entity = await db.entities.get(entityId)
  if (!entity) return

  const now = new Date().toISOString()
  await db.transaction('rw', db.entities, db.events, async () => {
    await db.entities.update(entityId, {
      attributes: { ...entity.attributes, [environmentId]: data },
      updatedAt: now,
    })
    await db.events.add({
      id: crypto.randomUUID(),
      entityId,
      environmentId,
      type: 'environment.updated',
      occurredAt: now,
      payload: data,
    })
  })
}

export async function archiveEntity(entityId: string): Promise<void> {
  const now = new Date().toISOString()
  await db.transaction('rw', db.entities, db.events, async () => {
    await db.entities.update(entityId, { archivedAt: now, updatedAt: now })
    await db.events.add({
      id: crypto.randomUUID(),
      entityId,
      environmentId: 'pad',
      type: 'entity.archived',
      occurredAt: now,
      payload: {},
    })
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı'))
    reader.readAsDataURL(blob)
  })
}

export async function createBackup(): Promise<BellekPadBackup> {
  const [entities, events, relations, settings, vault, attachmentRecords] = await Promise.all([
    db.entities.toArray(),
    db.events.toArray(),
    db.relations.toArray(),
    db.settings.toArray(),
    db.vault.toArray(),
    db.attachments.toArray(),
  ])

  const attachments = await Promise.all(
    attachmentRecords.map(async ({ blob, ...attachment }) => ({
      ...attachment,
      dataUrl: await blobToDataUrl(blob),
    })),
  )

  return {
    format: 'bellekpad-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    entities,
    events,
    relations,
    settings,
    vault,
    attachments,
  }
}

export async function importBackup(raw: string): Promise<void> {
  const backup = JSON.parse(raw) as Partial<BellekPadBackup>
  if (backup.format !== 'bellekpad-backup' || backup.version !== 1) {
    throw new Error('Bu dosya geçerli bir BellekPad yedeği değil.')
  }

  const attachmentRecords: AttachmentRecord[] = await Promise.all(
    (backup.attachments ?? []).map(async ({ dataUrl, ...attachment }) => ({
      ...attachment,
      blob: await (await fetch(dataUrl)).blob(),
    })),
  )

  await db.transaction(
    'rw',
    db.entities,
    db.events,
    db.relations,
    db.settings,
    db.vault,
    db.attachments,
    async () => {
      await Promise.all([
        db.entities.clear(),
        db.events.clear(),
        db.relations.clear(),
        db.settings.clear(),
        db.vault.clear(),
        db.attachments.clear(),
      ])

      if (backup.entities?.length) await db.entities.bulkAdd(backup.entities)
      if (backup.events?.length) await db.events.bulkAdd(backup.events)
      if (backup.relations?.length) await db.relations.bulkAdd(backup.relations)
      if (backup.settings?.length) await db.settings.bulkAdd(backup.settings)
      if (backup.vault?.length) await db.vault.bulkAdd(backup.vault)
      if (attachmentRecords.length) await db.attachments.bulkAdd(attachmentRecords)
    },
  )
}
