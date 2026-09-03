import type { CanonicalEntityReferenceType, Character, WorldInfo } from '../../types';
import type { CanonicalState, ImmutableHistoricalRecord } from '../types';
import type { NovelHistoryRecord } from './novelHistory';

/**
 * Identity Passport is a derived continuity index.
 *
 * Sovereignty rules:
 * - ImmutableHistoricalRecord remains the historical source of truth.
 * - CanonicalState remains the current-world authority.
 * - Passport never authorizes or mutates a state transition.
 * - Passport stamps reference existing historical records; they do not copy history.
 * - Each Passport is an immutable lineage node; continuity is expressed by predecessorPassportId.
 */
export type PassportHistoryDomain = 'CANON' | 'NOVEL';
export type PassportStatus = 'ACTIVE' | 'RETIRED';

export interface PassportStamp {
  readonly stampId: string;
  readonly recordId: string;
  readonly eventId: string;
}

export interface EntityPassport {
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

function makePassportId(
  entityId: string,
  domain: PassportHistoryDomain,
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
    descriptors.push({
      entityId: CHARACTER_PASSPORT_ID,
      entityType: 'CHARACTER',
      domain: 'CANON'
    });
  }

  for (const npc of worldInfo?.npcs || []) {
    if (npc?.id) {
      descriptors.push({ entityId: npc.id, entityType: 'NPC', domain: 'CANON' });
    }
  }
  for (const faction of worldInfo?.factions || []) {
    if (faction?.id) {
      descriptors.push({ entityId: faction.id, entityType: 'FACTION', domain: 'CANON' });
    }
  }
  for (const item of character?.inventory || []) {
    if (item?.id) {
      descriptors.push({ entityId: item.id, entityType: 'ITEM', domain: 'CANON' });
    }
  }
  for (const seed of worldInfo?.seeds || []) {
    if (seed?.id) {
      descriptors.push({ entityId: seed.id, entityType: 'NARRATIVE_SEED', domain: 'CANON' });
    }
  }

  return descriptors;
}

/**
 * Determines whether a Canon entity is currently active in CanonicalState.
 * This is only a read-only projection of already authoritative current state.
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

function appendUniqueRecords(
  target: ImmutableHistoricalRecord[],
  records: readonly ImmutableHistoricalRecord[],
  seen: Set<string>
): void {
  for (const record of records) {
    if (!seen.has(record.recordId)) {
      seen.add(record.recordId);
      target.push(record);
    }
  }
}

/**
 * Builds the Passport projection from authoritative history and
 * the currently authoritative CanonicalState.
 *
 * Passport nodes are reconstructed deterministically from NovelHistory transition
 * boundaries. Each node owns only the History references introduced since its
 * predecessor; the immutable ledger remains the actual history store.
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

  const novelById = new Map<string, NovelHistoryRecord>();
  const canonIdsWithNovelLineage = new Set<string>();
  const demotionNovelByCanonId = new Map<string, NovelHistoryRecord>();

  for (const novel of novelHistoryRecords) {
    if (!novel?.novelId) continue;
    novelById.set(novel.novelId, novel);

    if (novel.canonicalId) {
      canonIdsWithNovelLineage.add(novel.canonicalId);
      addDescriptor(canonDescriptors, {
        entityId: novel.canonicalId,
        entityType: novel.entityType,
        domain: 'CANON'
      });
    }

    if (novel.demotedFromCanonicalId) {
      demotionNovelByCanonId.set(novel.demotedFromCanonicalId, novel);
      addDescriptor(canonDescriptors, {
        entityId: novel.demotedFromCanonicalId,
        entityType: novel.entityType,
        domain: 'CANON'
      });
    }
  }

  const passports: EntityPassport[] = [];

  // Canon nodes are rebuilt from the NovelHistory transition chain for that entity.
  // Entities without a Novel transition get a single v1 Canon node.
  for (const descriptor of canonDescriptors.values()) {
    const sourceRecords = recordsByEntity.get(descriptor.entityId) || [];
    const sortedRecords = [...sourceRecords].sort((a, b) => {
      if (a.turn !== b.turn) return a.turn - b.turn;
      return a.recordId.localeCompare(b.recordId);
    });

    const relatedNovelRecords = novelHistoryRecords
      .filter(novel => novel?.canonicalId === descriptor.entityId || novel?.demotedFromCanonicalId === descriptor.entityId)
      .sort((a, b) => {
        const av = a.transitionHistory?.[a.transitionHistory.length - 1]?.version ?? 0;
        const bv = b.transitionHistory?.[b.transitionHistory.length - 1]?.version ?? 0;
        if (av !== bv) return av - bv;
        return a.novelId.localeCompare(b.novelId);
      });

    const transitionPoints = relatedNovelRecords.length > 0
      ? relatedNovelRecords
      : [undefined];

    let predecessorPassportId: string | undefined;
    let previousHistoryBoundary = -1;
    let version = 1;

    for (const transition of transitionPoints) {
      const transitionVersion = transition?.transitionHistory?.[transition.transitionHistory.length - 1]?.version;
      if (typeof transitionVersion === 'number' && transitionVersion > version) {
        version = transitionVersion;
      }

      const isDemotionNode = transition?.demotedFromCanonicalId === descriptor.entityId;
      const nodeRecords: ImmutableHistoricalRecord[] = [];
      const seen = new Set<string>();

      if (transition?.sourceEventIds?.length) {
        for (const eventId of transition.sourceEventIds) {
          appendUniqueRecords(nodeRecords, recordsByEventId.get(eventId) || [], seen);
        }
      }

      const boundary = sortedRecords.length - 1;
      const deltaRecords = sortedRecords.filter((record, index) => index > previousHistoryBoundary && index <= boundary);
      appendUniqueRecords(nodeRecords, deltaRecords, seen);
      previousHistoryBoundary = boundary;

      const stamps = nodeRecords.map((record, index) => makeStamp(record, index));
      const passportId = makePassportId(descriptor.entityId, 'CANON', version);
      const active = isDemotionNode
        ? false
        : transition
          ? transition.lifecycle === 'CANON_LINKED' && isCanonicalEntityActive(descriptor, canonicalState)
          : isCanonicalEntityActive(descriptor, canonicalState);

      passports.push(Object.freeze({
        passportId,
        entityId: descriptor.entityId,
        historyDomain: 'CANON',
        passportVersion: version,
        status: active ? 'ACTIVE' : 'RETIRED',
        predecessorPassportId,
        stamps: Object.freeze(stamps)
      }));

      predecessorPassportId = passportId;
      version += 1;
    }

    // No transition means one baseline node. A transition chain above may have already
    // produced all lineage nodes, so do not add a duplicate baseline.
    if (relatedNovelRecords.length === 0 && !canonIdsWithNovelLineage.has(descriptor.entityId)) {
      // The descriptor has already been emitted by the [undefined] transition point.
    }
  }

  // Novel nodes correspond one-to-one with NovelHistory records and preserve each
  // transition as an immutable lineage segment. A Novel node that is CANON_LINKED
  // is retired; DEMOTED_NOVEL becomes the active Novel successor of its Canon node.
  for (const novel of novelHistoryRecords) {
    if (!novel?.novelId) continue;

    const novelRecords: ImmutableHistoricalRecord[] = [];
    const seenRecordIds = new Set<string>();
    for (const eventId of novel.sourceEventIds || []) {
      appendUniqueRecords(novelRecords, recordsByEventId.get(eventId) || [], seenRecordIds);
    }

    const transitionVersion = novel.transitionHistory?.[novel.transitionHistory.length - 1]?.version;
    const passportVersion = typeof transitionVersion === 'number' && transitionVersion > 0
      ? transitionVersion
      : 1;
    const passportId = makePassportId(novel.novelId, 'NOVEL', passportVersion);

    const predecessorPassportId = novel.demotedFromCanonicalId
      ? makePassportId(novel.demotedFromCanonicalId, 'CANON', Math.max(1, passportVersion - 1))
      : undefined;

    const status: PassportStatus =
      novel.lifecycle === 'CANON_LINKED' || novel.lifecycle === 'INACTIVE_NOVEL'
        ? 'RETIRED'
        : 'ACTIVE';

    passports.push(Object.freeze({
      passportId,
      entityId: novel.novelId,
      historyDomain: 'NOVEL',
      passportVersion,
      status,
      predecessorPassportId,
      stamps: Object.freeze(novelRecords.map((record, index) => makeStamp(record, index)))
    }));
  }

  // The lineage itself is authoritative; deterministic output ordering is only for
  // stable serialization/tests and never changes the predecessor relationships.
  passports.sort((a, b) => {
    if (a.entityId !== b.entityId) return a.entityId.localeCompare(b.entityId);
    if (a.passportVersion !== b.passportVersion) return a.passportVersion - b.passportVersion;
    if (a.historyDomain !== b.historyDomain) return a.historyDomain === 'CANON' ? -1 : 1;
    return a.passportId.localeCompare(b.passportId);
  });

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
