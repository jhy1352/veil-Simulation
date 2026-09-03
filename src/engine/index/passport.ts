import type { CanonicalEntityReferenceType, Character, WorldInfo } from '../../types';
import type { CanonicalState, ImmutableHistoricalRecord } from '../types';
import type { NovelHistoryRecord, DomainTransitionStep } from './novelHistory';

/**
 * Identity Passport is a derived continuity index.
 *
 * Sovereignty rules:
 * - ImmutableHistoricalRecord remains the historical source of truth.
 * - CanonicalState remains the current-world authority.
 * - IdentityResolver remains the identity decision authority.
 * - Passport never authorizes or mutates a state transition.
 * - Passport stamps reference existing historical records; they do not copy history.
 * - Every domain transition produces a new Passport version; retired versions remain reconstructible.
 */
export type PassportHistoryDomain = 'CANON' | 'NOVEL';
export type PassportStatus = 'ACTIVE' | 'RETIRED';

export interface PassportStamp {
  readonly stampId: string;
  readonly recordId: string;
  readonly eventId: string;
}

export interface EntityPassport {
  /** Deterministic identifier for this specific derived Passport version. */
  readonly passportId: string;
  readonly entityId: string;
  readonly historyDomain: PassportHistoryDomain;
  readonly passportVersion: number;
  readonly status: PassportStatus;
  readonly predecessorPassportId?: string;
  readonly stamps: readonly PassportStamp[];
}

export interface PassportState {
  readonly passports: readonly EntityPassport[];
}

interface EntityDescriptor {
  readonly entityId: string;
  readonly entityType: CanonicalEntityReferenceType;
  readonly domain: PassportHistoryDomain;
}

/**
 * Stable synthetic identity for the player character, whose Character model has no id field.
 */
export const CHARACTER_PASSPORT_ID = 'character:protagonist';

/**
 * Passport IDs are deterministic derived identifiers, not authority keys.
 * The version is part of the ID so retired Passport versions remain addressable.
 */
export function makePassportId(
  domain: PassportHistoryDomain,
  entityId: string,
  version: number
): string {
  return `passport:${domain.toLowerCase()}:${entityId}:v${version}`;
}

function makeStamp(record: ImmutableHistoricalRecord, index: number): PassportStamp {
  return Object.freeze({
    stampId: `stamp-${record.recordId}-${index + 1}`,
    recordId: record.recordId,
    eventId: record.eventId
  });
}

function addDescriptor(map: Map<string, EntityDescriptor>, descriptor: EntityDescriptor): void {
  if (!descriptor.entityId) return;
  if (!map.has(descriptor.entityId)) {
    map.set(descriptor.entityId, descriptor);
  }
}

/**
 * Extracts authoritative entity references from the committed canonical action.
 * This intentionally uses canonicalAction rather than LLM claims or free-form prose.
 */
function extractCanonicalEntityDescriptors(record: ImmutableHistoricalRecord): EntityDescriptor[] {
  const action = record.canonicalAction;
  let payload: any = action?.payload;

  if (!payload && record.details) {
    try {
      const jsonMatch = record.details.match(/\{.*\}/);
      if (jsonMatch) payload = JSON.parse(jsonMatch[0]);
    } catch {
      // ignore malformed details
    }
  }

  const descriptors = new Map<string, EntityDescriptor>();

  const add = (entityId: unknown, entityType: CanonicalEntityReferenceType) => {
    if (typeof entityId !== 'string' || !entityId.trim()) return;
    addDescriptor(descriptors, {
      entityId: entityId.trim(),
      entityType,
      domain: 'CANON'
    });
  };

  switch (record.actionType) {
    case 'ADD_NPC':
    case 'UPDATE_NPC':
    case 'SET_NPC_STATUS':
      add(payload?.id, 'NPC');
      break;
    case 'ADD_FACTION':
    case 'UPDATE_FACTION':
      add(payload?.id, 'FACTION');
      break;
    case 'ADD_NARRATIVE_SEED':
    case 'RESOLVE_NARRATIVE_SEED':
      add(payload?.id, 'NARRATIVE_SEED');
      break;
    case 'UPDATE_CHARACTER_STATS':
    case 'SET_CHARACTER_SECRET':
    case 'RECORD_PHYSICAL_DEFECT':
    case 'RECORD_DICE_RESULT':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      break;
    case 'OVERWRITE_CHARACTER':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      for (const item of Array.isArray(payload?.inventory) ? payload.inventory : []) {
        add(item?.id, 'ITEM');
      }
      break;
    case 'MODIFY_INVENTORY':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      add(payload?.item?.id, 'ITEM');
      if (payload?.acquisition?.sourceNpcId) {
        add(payload.acquisition.sourceNpcId, 'NPC');
      }
      if (payload?.acquisition?.cost?.id) {
        add(payload.acquisition.cost.id, 'ITEM');
      }
      break;
    case 'RECORD_OFFSCREEN_EVENT':
      add(payload?.factionId, 'FACTION');
      for (const npcId of Array.isArray(payload?.involvedNpcIds) ? payload.involvedNpcIds : []) {
        add(npcId, 'NPC');
      }
      break;
    case 'OVERWRITE_WORLD_INFO':
      for (const npc of Array.isArray(payload?.npcs) ? payload.npcs : []) {
        add(npc?.id, 'NPC');
      }
      for (const faction of Array.isArray(payload?.factions) ? payload.factions : []) {
        add(faction?.id, 'FACTION');
      }
      for (const seed of Array.isArray(payload?.seeds) ? payload.seeds : []) {
        add(seed?.id, 'NARRATIVE_SEED');
      }
      break;
    default:
      break;
  }

  return [...descriptors.values()];
}

function currentCanonicalDescriptors(
  character: Character,
  worldInfo: WorldInfo
): EntityDescriptor[] {
  const descriptors: EntityDescriptor[] = [];

  if (character?.name) {
    descriptors.push({ entityId: CHARACTER_PASSPORT_ID, entityType: 'CHARACTER', domain: 'CANON' });
  }

  for (const npc of worldInfo?.npcs || []) {
    if (npc?.id) descriptors.push({ entityId: npc.id, entityType: 'NPC', domain: 'CANON' });
  }
  for (const faction of worldInfo?.factions || []) {
    if (faction?.id) descriptors.push({ entityId: faction.id, entityType: 'FACTION', domain: 'CANON' });
  }
  for (const item of character?.inventory || []) {
    if (item?.id) descriptors.push({ entityId: item.id, entityType: 'ITEM', domain: 'CANON' });
  }
  for (const seed of worldInfo?.seeds || []) {
    if (seed?.id) descriptors.push({ entityId: seed.id, entityType: 'NARRATIVE_SEED', domain: 'CANON' });
  }

  return descriptors;
}

/**
 * Reads the already-authoritative CanonicalState to determine the current projection status.
 * This is deliberately not a demotion decision: Canon demotion must already have been
 * decided by the lifecycle/identity authority before this projection is built.
 */
function isCanonicalEntityActive(
  descriptor: EntityDescriptor,
  canonicalState: CanonicalState
): boolean {
  if (descriptor.domain !== 'CANON') return false;

  switch (descriptor.entityType) {
    case 'CHARACTER':
      return Boolean(canonicalState.character?.name);
    case 'NPC':
      return (canonicalState.worldInfo?.npcs || []).some(
        npc => npc?.id === descriptor.entityId && npc.status !== 'DEAD'
      );
    case 'FACTION':
      return (canonicalState.worldInfo?.factions || []).some(
        fac => fac?.id === descriptor.entityId
      );
    case 'ITEM':
      return (canonicalState.character?.inventory || []).some(
        item => item?.id === descriptor.entityId && (item.quantity ?? 0) > 0
      );
    case 'NARRATIVE_SEED':
      return (canonicalState.worldInfo?.seeds || []).some(seed => {
        if (seed?.id !== descriptor.entityId) return false;
        const s = (seed.status as string) || '';
        return s !== 'resolved' && s !== 'RESOLVED' && s !== 'dormant' && s !== 'ARCHIVED';
      });
    default:
      return false;
  }
}

function transitionPassportDomain(step: DomainTransitionStep): PassportHistoryDomain {
  return step.toDomain;
}

function buildTransitionHistory(record: NovelHistoryRecord): readonly DomainTransitionStep[] {
  if (record.transitionHistory && record.transitionHistory.length > 0) {
    return record.transitionHistory;
  }

  const initialDomain: PassportHistoryDomain = record.canonicalId ? 'CANON' : 'NOVEL';
  return Object.freeze([{
    fromDomain: initialDomain,
    toDomain: initialDomain,
    version: 1,
    turn: record.firstSeenTurn
  }]);
}

/**
 * Projects every historical Passport version represented by a NovelHistory lineage.
 * The Passport objects are derived and immutable; transitionHistory remains the lineage
 * evidence, while ImmutableHistoricalRecord remains the actual historical source.
 */
function projectNovelLineage(
  novel: NovelHistoryRecord,
  canonicalRecordsByEntity: Map<string, ImmutableHistoricalRecord[]>,
  recordsByEventId: Map<string, ImmutableHistoricalRecord[]>
): EntityPassport[] {
  const transitions = buildTransitionHistory(novel);
  const passports: EntityPassport[] = [];

  const canonicalStamps = (novel.canonicalId
    ? (canonicalRecordsByEntity.get(novel.canonicalId) || [])
    : []
  ).map((record, index) => makeStamp(record, index));

  const novelRecords: ImmutableHistoricalRecord[] = [];
  const seenRecordIds = new Set<string>();
  for (const eventId of novel.sourceEventIds || []) {
    for (const record of recordsByEventId.get(eventId) || []) {
      if (!seenRecordIds.has(record.recordId)) {
        seenRecordIds.add(record.recordId);
        novelRecords.push(record);
      }
    }
  }
  const novelStamps = novelRecords.map((record, index) => makeStamp(record, index));

  const latestVersion = transitions[transitions.length - 1]?.version ?? 1;
  const currentDomain: PassportHistoryDomain = novel.lifecycle === 'CANON_LINKED' ? 'CANON' : 'NOVEL';
  const currentVersionIsRetired = novel.lifecycle === 'INACTIVE_NOVEL';

  let previousPassportId: string | undefined;
  for (const step of transitions) {
    const domain = transitionPassportDomain(step);
    const entityId = domain === 'CANON' ? novel.canonicalId : novel.novelId;
    if (!entityId) continue;

    const passportId = makePassportId(domain, entityId, step.version);
    const isCurrent = step.version === latestVersion && domain === currentDomain;
    const status: PassportStatus = isCurrent && !currentVersionIsRetired ? 'ACTIVE' : 'RETIRED';

    const stamps = domain === 'CANON' ? canonicalStamps : novelStamps;

    passports.push(Object.freeze({
      passportId,
      entityId,
      historyDomain: domain,
      passportVersion: step.version,
      status,
      predecessorPassportId: previousPassportId,
      stamps: Object.freeze([...stamps])
    }));

    previousPassportId = passportId;
  }

  return passports;
}

/**
 * Builds the Passport projection from authoritative history and current CanonicalState.
 * NovelHistory is used only as lineage/index metadata; its sourceEventIds are resolved
 * against the immutable historical ledger before stamps are emitted.
 */
export function projectPassports(
  canonicalState: CanonicalState,
  historicalRecords: readonly ImmutableHistoricalRecord[] = [],
  novelHistoryRecords: readonly NovelHistoryRecord[] = []
): PassportState {
  const canonDescriptors = new Map<string, EntityDescriptor>();

  for (const descriptor of currentCanonicalDescriptors(canonicalState.character, canonicalState.worldInfo)) {
    addDescriptor(canonDescriptors, descriptor);
  }

  const recordsByEntity = new Map<string, ImmutableHistoricalRecord[]>();
  const recordsByEventId = new Map<string, ImmutableHistoricalRecord[]>();

  for (const record of historicalRecords) {
    if (record.eventId) {
      const eventList = recordsByEventId.get(record.eventId) || [];
      eventList.push(record);
      recordsByEventId.set(record.eventId, eventList);
    }

    for (const descriptor of extractCanonicalEntityDescriptors(record)) {
      const list = recordsByEntity.get(descriptor.entityId) || [];
      list.push(record);
      recordsByEntity.set(descriptor.entityId, list);
      addDescriptor(canonDescriptors, descriptor);
    }
  }

  const novelPredecessorByCanonicalId = new Map<string, NovelHistoryRecord>();
  const demotedNovelByCanonicalId = new Map<string, NovelHistoryRecord>();

  for (const novel of novelHistoryRecords) {
    if (novel?.canonicalId && novel.lifecycle === 'CANON_LINKED') {
      novelPredecessorByCanonicalId.set(novel.canonicalId, novel);
      addDescriptor(canonDescriptors, {
        entityId: novel.canonicalId,
        entityType: novel.entityType,
        domain: 'CANON'
      });
    }
    if (novel?.demotedFromCanonicalId && novel.lifecycle === 'DEMOTED_NOVEL') {
      demotedNovelByCanonicalId.set(novel.demotedFromCanonicalId, novel);
      addDescriptor(canonDescriptors, {
        entityId: novel.demotedFromCanonicalId,
        entityType: novel.entityType,
        domain: 'CANON'
      });
    }
  }

  const passports: EntityPassport[] = [];
  const lineageCanonicalIds = new Set<string>();

  // 1. Canon-only entities: one immutable v1 Canon Passport unless a Novel lineage owns them.
  for (const descriptor of canonDescriptors.values()) {
    const lineage = novelPredecessorByCanonicalId.get(descriptor.entityId) || demotedNovelByCanonicalId.get(descriptor.entityId);
    if (lineage) {
      lineageCanonicalIds.add(descriptor.entityId);
      continue;
    }

    const sourceRecords = recordsByEntity.get(descriptor.entityId) || [];
    const stamps = sourceRecords.map((record, index) => makeStamp(record, index));
    const active = isCanonicalEntityActive(descriptor, canonicalState);

    passports.push(Object.freeze({
      passportId: makePassportId('CANON', descriptor.entityId, 1),
      entityId: descriptor.entityId,
      historyDomain: 'CANON',
      passportVersion: 1,
      status: active ? 'ACTIVE' : 'RETIRED',
      stamps: Object.freeze(stamps)
    }));
  }

  // 2. Novel lineages: emit every historical Passport version, including retired versions.
  for (const novel of novelHistoryRecords) {
    passports.push(...projectNovelLineage(novel, recordsByEntity, recordsByEventId));
  }

  // 3. Deterministic ordering: domain first, then entityId, then version.
  passports.sort((a, b) => {
    if (a.historyDomain !== b.historyDomain) return a.historyDomain === 'CANON' ? -1 : 1;
    const entityOrder = a.entityId.localeCompare(b.entityId);
    if (entityOrder !== 0) return entityOrder;
    return a.passportVersion - b.passportVersion;
  });

  // Defensive invariant: at most one ACTIVE Passport exists for each lineage identity.
  // Multiple domain-specific entity IDs can belong to one lineage, so lineage ownership is
  // determined from NovelHistory rather than by assuming Canon and Novel IDs are equal.
  const activeByLineage = new Map<string, EntityPassport>();
  for (const passport of passports) {
    if (passport.status !== 'ACTIVE') continue;
    const lineage = novelHistoryRecords.find(n =>
      n.novelId === passport.entityId || n.canonicalId === passport.entityId
    );
    const lineageKey = lineage ? `lineage:${lineage.novelId}` : `entity:${passport.entityId}`;
    const existing = activeByLineage.get(lineageKey);
    if (existing) {
      // Projection failure is represented by retiring the later duplicate rather than
      // allowing two ACTIVE passports for the same entity lineage.
      const idx = passports.indexOf(passport);
      passports[idx] = Object.freeze({ ...passport, status: 'RETIRED' });
    } else {
      activeByLineage.set(lineageKey, passport);
    }
  }

  return Object.freeze({ passports: Object.freeze(passports) });
}

/**
 * Convenience overload for callers that already have the engine snapshot.
 */
export function projectPassportsFromHistory(
  snapshot: CanonicalState,
  history: readonly ImmutableHistoricalRecord[],
  novelHistoryRecords: readonly NovelHistoryRecord[] = []
): PassportState {
  return projectPassports(snapshot, history, novelHistoryRecords);
}
