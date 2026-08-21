export type EntityId = string
export type EnvironmentId = string

export type AttributeValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, unknown>

export interface EntityRecord {
  id: EntityId
  title: string
  kind: string
  environments: EnvironmentId[]
  attributes: Record<string, AttributeValue>
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export interface RelationRecord {
  id: string
  sourceId: EntityId
  targetId: EntityId
  type: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface DomainEvent<T = unknown> {
  id: string
  entityId?: EntityId
  environmentId: EnvironmentId
  type: string
  occurredAt: string
  payload: T
}

export interface VaultRecord {
  id: string
  ownerEntityId?: EntityId
  kind: string
  encryptedPayload: string
  iv: string
  salt?: string
  createdAt: string
  updatedAt: string
}

export interface AppSetting {
  key: string
  value: unknown
  updatedAt: string
}

export interface AttachmentRecord {
  id: string
  entityId: EntityId
  name: string
  mimeType: string
  size: number
  blob: Blob
  createdAt: string
}

export interface EnvironmentDefinition {
  id: EnvironmentId
  label: string
  capabilities: string[]
  accepts?: string[]
}

export const CORE_ENVIRONMENTS: EnvironmentDefinition[] = [
  { id: 'pad', label: 'Pad', capabilities: ['writable', 'searchable'] },
  { id: 'temporal', label: 'Zaman', capabilities: ['schedulable', 'reviewable'] },
  { id: 'project', label: 'Proje', capabilities: ['actionable', 'trackable'] },
  { id: 'case', label: 'Vaka', capabilities: ['trackable', 'timeline'] },
  { id: 'finance', label: 'Mali', capabilities: ['financial', 'measurable'] },
  { id: 'health', label: 'Sağlık', capabilities: ['trackable', 'temporal'] },
  { id: 'education', label: 'Eğitim', capabilities: ['trackable', 'documentable'] },
  { id: 'inventory', label: 'Envanter', capabilities: ['inventoryItem', 'container'] },
  { id: 'character', label: 'Karakter', capabilities: ['scoreable', 'relational'] },
  { id: 'vault', label: 'Kasa', capabilities: ['sensitive'] },
]
