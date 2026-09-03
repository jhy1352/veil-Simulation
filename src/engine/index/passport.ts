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
 * - Each Passport is an immutable lineage node; predecessorPassportId links nodes.
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

export const CHARACTER_PASSPORT_ID = 'character:protagonist';

function makePassportId(entityId: string, domain: PassportHistoryDomain, version: number): string {
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
  if (descriptor.entityId && !map.has(descriptor.entityId)) map.set(descriptor.entityId, descriptor);
}

function extractCanonicalEntityDescriptors(record: ImmutableHistoricalRecord): EntityDescriptor[] {
  const action = record.canonicalAction;
  let payload: any = action?.payload;

  if (!payload && record.details) {
    try {
      const jsonMatch = record.details.match(/\{.*\}/);
      if (jsonMatch) payload = JSON.parse(jsonMatch[0]);
    } catch {
      // Malformed diagnostic details are never identity authority.
    }
  }

  const descriptors = new Map<string, EntityDescriptor>();
  const add = (entityId: unknown, entityType: CanonicalEntityReferenceType) => {
    if (typeof entityId !== 'string' || !entityId.trim()) return;
    addDescriptor(descriptors, { entityId: entityId.trim(), entityType, domain: 'CANON' });
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
      for (const item of Array.isArray(payload?.inventory) ? payload.inventory : []) add(item?.id, 'ITEM');
      break;
    case 'MODIFY_INVENTORY':
      add(CHARACTER_PASSPORT_ID, 'CHARACTER');
      add(payload?.item?.id, 'ITEM');
      add(payload?.acquisition?.sourceNpcId, 'NPC');
      add(payload?.acquisition?.cost?.id, 'ITEM');
      break;
    case 'RECORD_OFFSCREEN_EVENT':
      add(payload?.factionId, 'FACTION');
      for (const npcId of Array.isArray(payload?.involvedNpcIds) ? payload.involvedNpcIds : []) add(npcId, 'NPC');
      break;
    case 'OVERWRITE_WORLD_INFO':
      for (const npc of Array.isArray(payload?.npcs) ? payload.npcs : []) add(npc?.id, 'NPC');
      for (const faction of Array.isArray(payload?.factions) ? payload.factions : []) add(faction?.id, 'FACTION');
      for (const seed of Array.isArray(payload?.seeds) ? payload.seeds : []) add(seed?.id, 'NARRATIVE_SEED');
      break;
    default:
      break;
  }

  return [...descriptors.values()];
}

function currentCanonicalDescriptors(character: Character, worldInfo: WorldInfo): EntityDescriptor[] {
  const descriptors: EntityDescriptor[] = [];
  if (character?.name) descriptors.push({ entityId: CHARACTER_PASSPORT_ID, entityType: 'CHARACTER', domain: 'CANON' });
  for (const npc of worldInfo?.npcs || []) if (npc?.id) descriptors.push({ entityId: npc.id, entityType: 'NPC', domain: 'CANON' });
  for (const faction of worldInfo?.factions || []) if (faction?.id) descriptors.push({ entityId: faction.id, entityType: 'FACTION', domain: 'CANON' });
  for (const item of character?.inventory || []) if (item?.id) descriptors.push({ entityId: item.id, entityType: 'ITEM', domain: 'CANON' });
  for (const seed of worldInfo?.seeds || []) if (seed?.id) descriptors.push({ entityId: seed.id, entityType: 'NARRATIVE_SEED', domain: 'CANON' });
  return descriptors;
}

function isCanonicalEntityActive(descriptor: EntityDescriptor, canonicalState: CanonicalState): boolean {
  if (descriptor.domain !== 'CANON') return false;
  switch (descriptor.entityType) {
    case 'CHARACTER':
      return Boolean(canonicalState.character?.name);
    case 'NPC':
      return (canonicalState.worldInfo?.npcs || []).some(npc => npc?.id === descriptor.entityId && npc.status !== 'DEAD');
    case 'FACTION':
      return (canonicalState.worldInfo?.factions || []).some(fac => fac?.id === descriptor.entityId);
    case 'ITEM':
      return (canonicalState.character?.inventory || []).some(item => item?.id === descriptor.entityId && (item.quantity ?? 0) > 0);
    case 'NARRATIVE_SEED':
      return (canonicalState.worldInfo?.seeds || []).some(seed => {
        if (seed?.id !== descriptor.entityId) return false;
        const status = (seed.status as string) || '';
        return status !== 'resolved' && status !== 'RESOLVED' && status !== 'dormant' && status !== 'ARCHIVED';
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

function recordsForSegment(
  records: readonly ImmutableHistoricalRecord[],
  startExclusiveTurn: number,
  endInclusiveTurn: number,
  eventIds: readonly string[] | undefined,
  recordsByEventId: Map<string, ImmutableHistoricalRecord[]>
): ImmutableHistoricalRecord[] {
  const segment: ImmutableHistoricalRecord[] = [];
  const seen = new Set<string>();
  const ordered = [...records].sort((a, b) => a.turn - b.turn || a.recordId.localeCompare(b.recordId));

  for (const record of ordered) {
    if (record.turn > startExclusiveTurn && record.turn <= endInclusiveTurn) {
      appendUniqueRecords(segment, [record], seen);
    }
  }

  // Event references are evidence pointers only. If an event falls outside the
  // transition window, it is not copied into this Passport delta.
  for (const eventId of eventIds || []) {
    for (const record of recordsByEventId.get(eventId) || []) {
      if (record.turn > startExclusiveTurn && record.turn <= endInclusiveTurn) {
        appendUniqueRecords(segment, [record], seen);
      }
    }
  }

  return segment;
}

/**
 * Builds the Passport projection from authoritative History and NovelHistory.
 * NovelHistory transitionHistory defines the domain boundaries; History supplies
 * only the immutable record references belonging to each continuity segment.
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
      const list = recordsByEventId.get(record.eventId) || [];
      list.push(record);
      recordsByEventId.set(record.eventId, list);
    }
    for (const descriptor of extractCanonicalEntityDescriptors(record)) {
      const list = recordsByEntity.get(descriptor.entityId) || [];
      list.push(record);
      recordsByEntity.set(descriptor.entityId, list);
      addDescriptor(canonDescriptors, descriptor);
    }
  }

  const lineageNovelIds = new Set<string>();
  const lineageCanonIds = new Set<string>();
  const passports: EntityPassport[] = [];

  for (const novel of novelHistoryRecords) {
    if (!novel?.novelId) continue;

    const transitions = [...(novel.transitionHistory || [])].sort((a, b) => a.version - b.version);
    const hasLineage = transitions.some(step => step.version > 1);
    if (!hasLineage && !novel.canonicalId && !novel.demotedFromCanonicalId) {
      // Pure Novel baseline: no Canon identity has been established.
      const stamps = recordsForSegment(historicalRecords, -Infinity, novel.lastSeenTurn, novel.sourceEventIds, recordsByEventId)
        .map((record, index) => makeStamp(record, index));
      passports.push(Object.freeze({
        passportId: makePassportId(novel.novelId, 'NOVEL', 1),
        entityId: novel.novelId,
        historyDomain: 'NOVEL',
        passportVersion: 1,
        status: novel.lifecycle === 'INACTIVE_NOVEL' ? 'RETIRED' : 'ACTIVE',
        stamps: Object.freeze(stamps)
      }));
      lineageNovelIds.add(novel.novelId);
      continue;
    }

    lineageNovelIds.add(novel.novelId);
    if (novel.canonicalId) {
      lineageCanonIds.add(novel.canonicalId);
      addDescriptor(canonDescriptors, { entityId: novel.canonicalId, entityType: novel.entityType, domain: 'CANON' });
    }
    if (novel.demotedFromCanonicalId) {
      lineageCanonIds.add(novel.demotedFromCanonicalId);
      addDescriptor(canonDescriptors, { entityId: novel.demotedFromCanonicalId, entityType: novel.entityType, domain: 'CANON' });
    }

    const effectiveTransitions = transitions.filter(step => step.version > 1);
    let predecessorPassportId: string | undefined;
    let previousTurn = -Infinity;

    // The first node is always the original Novel identity segment.
    const firstTurn = effectiveTransitions.length > 0 ? effectiveTransitions[0].turn : novel.lastSeenTurn;
    const initialRecords = recordsForSegment(historicalRecords, previousTurn, firstTurn, novel.sourceEventIds, recordsByEventId);
    const initialPassportId = makePassportId(novel.novelId, 'NOVEL', 1);
    passports.push(Object.freeze({
      passportId: initialPassportId,
      entityId: novel.novelId,
      historyDomain: 'NOVEL',
      passportVersion: 1,
      status: 'RETIRED',
      stamps: Object.freeze(initialRecords.map((record, index) => makeStamp(record, index)))
    }));
    predecessorPassportId = initialPassportId;
    previousTurn = firstTurn;

    for (let i = 0; i < effectiveTransitions.length; i++) {
      const step = effectiveTransitions[i];
      const nextStep = effectiveTransitions[i + 1];
      const segmentEnd = nextStep ? nextStep.turn : Math.max(step.turn, novel.lastSeenTurn);
      const domain = step.toDomain;
      const entityId = domain === 'CANON'
        ? novel.canonicalId || novel.demotedFromCanonicalId || novel.novelId
        : novel.novelId;
      const stamps = recordsForSegment(historicalRecords, previousTurn, segmentEnd, novel.sourceEventIds, recordsByEventId)
        .map((record, index) => makeStamp(record, index));
      const passportId = makePassportId(entityId, domain, step.version);

      const isFinal = i === effectiveTransitions.length - 1;
      const isActive = isFinal && (
        domain === 'CANON'
          ? novel.lifecycle === 'CANON_LINKED' && isCanonicalEntityActive({ entityId, entityType: novel.entityType, domain: 'CANON' }, canonicalState)
          : novel.lifecycle === 'DEMOTED_NOVEL' || novel.lifecycle === 'NOVEL'
      );

      passports.push(Object.freeze({
        passportId,
        entityId,
        historyDomain: domain,
        passportVersion: step.version,
        status: isActive ? 'ACTIVE' : 'RETIRED',
        predecessorPassportId,
        stamps: Object.freeze(stamps)
      }));

      predecessorPassportId = passportId;
      previousTurn = segmentEnd;
    }
  }

  // Entities with no Novel lifecycle still receive a single Canon baseline Passport.
  for (const descriptor of canonDescriptors.values()) {
    if (lineageCanonIds.has(descriptor.entityId)) continue;
    const sourceRecords = [...(recordsByEntity.get(descriptor.entityId) || [])]
      .sort((a, b) => a.turn - b.turn || a.recordId.localeCompare(b.recordId));
    const stamps = sourceRecords.map((record, index) => makeStamp(record, index));
    passports.push(Object.freeze({
      passportId: makePassportId(descriptor.entityId, 'CANON', 1),
      entityId: descriptor.entityId,
      historyDomain: 'CANON',
      passportVersion: 1,
      status: isCanonicalEntityActive(descriptor, canonicalState) ? 'ACTIVE' : 'RETIRED',
      stamps: Object.freeze(stamps)
    }));
  }

  passports.sort((a, b) => {
    if (a.passportVersion !== b.passportVersion) return a.passportVersion - b.passportVersion;
    if (a.entityId !== b.entityId) return a.entityId.localeCompare(b.entityId);
    return a.passportId.localeCompare(b.passportId);
  });

  return Object.freeze({ passports: Object.freeze(passports) });
}

export function projectPassportsFromHistory(
  snapshot: CanonicalState,
  history: readonly ImmutableHistoricalRecord[],
  novelHistoryRecords: readonly NovelHistoryRecord[] = []
): PassportState {
  return projectPassports(snapshot, history, novelHistoryRecords);
}
