import { CanonicalState, ImmutableHistoricalRecord, ActionType } from '../types';
import { NarrativeTime, WorldInfo, Character, Item, NpcRecord, FactionRecord, NarrativeSeed, OffscreenEventRecord } from '../../types';

/**
 * Universal Entity Types supported by the Sovereign Engine Knowledge Graph.
 * Strictly limited to entities backed by structural fields in CanonicalState.
 */
export type UniversalEntityType =
  | 'CHARACTER'
  | 'NPC'
  | 'FACTION'
  | 'ITEM'
  | 'NARRATIVE_SEED'
  | 'OFFSCREEN_EVENT'
  | 'LOCATION';

/**
 * Universal Relation Types supported by the Sovereign Engine Knowledge Graph.
 * Strictly limited to 100% structurally backed relationships.
 */
export type UniversalRelationType = 'OWNS' | 'LOCATED_IN';

/**
 * Provenance descriptor separating INITIAL_CANON from HISTORICAL records.
 * Initial Canon does NOT synthesize fake record/event IDs.
 */
export type EntityProvenance =
  | {
      readonly originSource: 'INITIAL_CANON';
      readonly worldInfoField: string;
      readonly stateVersion: 1;
    }
  | {
      readonly originSource: 'HISTORICAL';
      readonly sourceRecordId: string;
      readonly sourceEventId: string;
      readonly stateVersion: number;
      readonly narrativeTime?: NarrativeTime;
      readonly actionType: ActionType;
    };

/**
 * Universal Entity in the Read-Only Derived Knowledge Graph.
 */
export interface UniversalEntity {
  readonly entityId: string;
  readonly entityType: UniversalEntityType;
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly categoryHint?: string;
  readonly provenance: EntityProvenance;
  readonly isStaleRelativeToCanonical: boolean;
  readonly staleReason?: string;
  readonly canonLifecycle?: 'ACTIVE_CANON' | 'INACTIVE_CANON';
}

/**
 * Universal Relation Edge in the Read-Only Derived Knowledge Graph.
 */
export interface UniversalRelation {
  readonly relationId: string;
  readonly relationType: UniversalRelationType;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly provenance: EntityProvenance;
  readonly isStaleRelativeToCanonical: boolean;
  readonly staleReason?: string;
  readonly validFromVersion?: number;
  readonly validToVersion?: number;
}

/**
 * Read-Only Universal Knowledge Graph Structure.
 */
export interface UniversalKnowledgeGraph {
  readonly entities: ReadonlyMap<string, UniversalEntity>;
  readonly relations: readonly UniversalRelation[];
  readonly outgoingRelations: ReadonlyMap<string, readonly UniversalRelation[]>;
  readonly incomingRelations: ReadonlyMap<string, readonly UniversalRelation[]>;
  readonly totalEntities: number;
  readonly totalRelations: number;
}

/**
 * Traversal Query configuration for the Derived Knowledge Graph.
 */
export interface GraphRetrievalQuery {
  readonly startEntityId: string;
  readonly maxDepth?: number;
  readonly relationTypes?: readonly UniversalRelationType[];
  readonly limit?: number;
}

/**
 * Traversal Result from the Derived Knowledge Graph.
 * Authority is ALWAYS 'NON_CANONICAL'.
 */
export interface GraphRetrievalResult {
  readonly startEntity?: UniversalEntity;
  readonly visitedEntities: readonly UniversalEntity[];
  readonly traversedRelations: readonly UniversalRelation[];
  readonly depthMap: ReadonlyMap<string, number>;
  readonly authority: 'NON_CANONICAL';
}

/**
 * Deep freezes an object or array to ensure strict read-only immutability.
 */
function freezeDeep<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  if (obj instanceof Map || obj instanceof Set) {
    return obj as Readonly<T>;
  }
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      freezeDeep(val);
    }
  }
  return obj as Readonly<T>;
}

/**
 * Validates whether an entity meets strict structural requirements.
 */
export function isValidKnowledgeGraphEntity(entity: any): entity is UniversalEntity {
  if (!entity || typeof entity !== 'object') return false;
  if (typeof entity.entityId !== 'string' || entity.entityId.trim() === '') return false;
  if (typeof entity.name !== 'string' || entity.name.trim() === '') return false;
  const validTypes: UniversalEntityType[] = [
    'CHARACTER',
    'NPC',
    'FACTION',
    'ITEM',
    'NARRATIVE_SEED',
    'OFFSCREEN_EVENT',
    'LOCATION'
  ];
  if (!validTypes.includes(entity.entityType)) return false;
  if (!entity.provenance || typeof entity.provenance !== 'object') return false;
  if (entity.provenance.originSource === 'INITIAL_CANON') {
    if (typeof entity.provenance.worldInfoField !== 'string' || entity.provenance.stateVersion !== 1) return false;
  } else if (entity.provenance.originSource === 'HISTORICAL') {
    if (
      typeof entity.provenance.sourceRecordId !== 'string' ||
      typeof entity.provenance.sourceEventId !== 'string' ||
      typeof entity.provenance.stateVersion !== 'number'
    ) {
      return false;
    }
  } else {
    return false;
  }
  if (typeof entity.isStaleRelativeToCanonical !== 'boolean') return false;
  return true;
}

/**
 * Validates whether a relation edge meets strict structural requirements.
 */
export function isValidKnowledgeGraphRelation(rel: any): rel is UniversalRelation {
  if (!rel || typeof rel !== 'object') return false;
  if (typeof rel.relationId !== 'string' || rel.relationId.trim() === '') return false;
  if (typeof rel.sourceEntityId !== 'string' || rel.sourceEntityId.trim() === '') return false;
  if (typeof rel.targetEntityId !== 'string' || rel.targetEntityId.trim() === '') return false;
  if (rel.sourceEntityId === rel.targetEntityId) return false; // Self-loop forbidden
  const validRelTypes: UniversalRelationType[] = ['OWNS', 'LOCATED_IN'];
  if (!validRelTypes.includes(rel.relationType)) return false;
  if (!rel.provenance || typeof rel.provenance !== 'object') return false;
  if (typeof rel.isStaleRelativeToCanonical !== 'boolean') return false;
  return true;
}

/**
 * Pure Functional Builder for the Universal Knowledge Graph.
 * Derives entities and structural relationships from CanonicalState and ImmutableHistoricalRecords.
 * NEVER mutates CanonicalState or History.
 */
export function buildKnowledgeGraph(
  canonicalState?: CanonicalState,
  records: readonly ImmutableHistoricalRecord[] = []
): UniversalKnowledgeGraph {
  const entityMap = new Map<string, UniversalEntity>();
  const relationList: UniversalRelation[] = [];
  const seenRelationKeys = new Set<string>();

  const outgoing = new Map<string, UniversalRelation[]>();
  const incoming = new Map<string, UniversalRelation[]>();

  const currentVersion = canonicalState?.stateVersion || 1;

  // -------------------------------------------------------------
  // 1. Extract Entities from CanonicalState
  // -------------------------------------------------------------
  if (canonicalState) {
    // 1-1. Character (Protagonist)
    if (canonicalState.character) {
      const charId = 'protagonist';
      const charName = (canonicalState.character.name && canonicalState.character.name.trim())
        ? canonicalState.character.name.trim()
        : '주인공';
      entityMap.set(charId, {
        entityId: charId,
        entityType: 'CHARACTER',
        name: charName,
        categoryHint: canonicalState.character.originBackground || 'Protagonist',
        provenance: {
          originSource: 'INITIAL_CANON',
          worldInfoField: 'character',
          stateVersion: 1
        },
        isStaleRelativeToCanonical: false,
        canonLifecycle: 'ACTIVE_CANON'
      });
    }

    // 1-2. NPCs
    if (Array.isArray(canonicalState.worldInfo?.npcs)) {
      for (const npc of canonicalState.worldInfo.npcs) {
        if (npc && typeof npc.id === 'string' && npc.id.trim()) {
          const isDead = npc.status === 'DEAD';
          const aliases = (npc.alias && npc.alias.trim()) ? [npc.alias.trim()] : undefined;
          entityMap.set(npc.id, {
            entityId: npc.id,
            entityType: 'NPC',
            name: npc.name || npc.id,
            aliases,
            categoryHint: npc.npcClass || 'NPC',
            provenance: {
              originSource: 'INITIAL_CANON',
              worldInfoField: 'npcs',
              stateVersion: 1
            },
            isStaleRelativeToCanonical: isDead,
            staleReason: isDead ? `NPC '${npc.name}' (${npc.id}) is currently DEAD in Canonical State.` : undefined,
            canonLifecycle: isDead ? 'INACTIVE_CANON' : 'ACTIVE_CANON'
          });
        }
      }
    }

    // 1-3. Factions
    if (Array.isArray(canonicalState.worldInfo?.factions)) {
      for (const fac of canonicalState.worldInfo.factions) {
        if (fac && typeof fac.id === 'string' && fac.id.trim()) {
          entityMap.set(fac.id, {
            entityId: fac.id,
            entityType: 'FACTION',
            name: fac.name || fac.id,
            categoryHint: 'Faction',
            provenance: {
              originSource: 'INITIAL_CANON',
              worldInfoField: 'factions',
              stateVersion: 1
            },
            isStaleRelativeToCanonical: false,
            canonLifecycle: 'ACTIVE_CANON'
          });
        }
      }
    }

    // 1-4. Items (Inventory)
    if (Array.isArray(canonicalState.character?.inventory)) {
      for (const item of canonicalState.character.inventory) {
        if (item && typeof item.id === 'string' && item.id.trim()) {
          const isDepleted = (item.quantity ?? 1) <= 0;
          entityMap.set(item.id, {
            entityId: item.id,
            entityType: 'ITEM',
            name: item.name || item.id,
            categoryHint: `Qty: ${item.quantity ?? 1}`,
            provenance: {
              originSource: 'INITIAL_CANON',
              worldInfoField: 'inventory',
              stateVersion: 1
            },
            isStaleRelativeToCanonical: isDepleted,
            staleReason: isDepleted ? `Item quantity is 0 in Canonical Inventory.` : undefined,
            canonLifecycle: isDepleted ? 'INACTIVE_CANON' : 'ACTIVE_CANON'
          });
        }
      }
    }

    // 1-5. Narrative Seeds
    if (Array.isArray(canonicalState.worldInfo?.seeds)) {
      for (const seed of canonicalState.worldInfo.seeds) {
        if (seed && typeof seed.id === 'string' && seed.id.trim()) {
          const isResolved = seed.status === 'resolved' || (seed.status as any) === 'RESOLVED' || (seed.status as any) === 'ARCHIVED';
          entityMap.set(seed.id, {
            entityId: seed.id,
            entityType: 'NARRATIVE_SEED',
            name: seed.content ? seed.content.trim() : seed.id,
            categoryHint: `Status: ${seed.status || 'active'}`,
            provenance: {
              originSource: 'INITIAL_CANON',
              worldInfoField: 'seeds',
              stateVersion: 1
            },
            isStaleRelativeToCanonical: isResolved,
            staleReason: isResolved ? `Narrative seed is ${seed.status}.` : undefined,
            canonLifecycle: isResolved ? 'INACTIVE_CANON' : 'ACTIVE_CANON'
          });
        }
      }
    }

    // 1-6. Offscreen Records & Structural Locations
    if (Array.isArray(canonicalState.worldInfo?.offscreenRecords)) {
      for (const off of canonicalState.worldInfo.offscreenRecords) {
        if (off && typeof off.id === 'string' && off.id.trim()) {
          entityMap.set(off.id, {
            entityId: off.id,
            entityType: 'OFFSCREEN_EVENT',
            name: off.eventDescription ? off.eventDescription.slice(0, 30) : off.id,
            categoryHint: `Visibility: ${off.visibility || 'HIDDEN'}`,
            provenance: {
              originSource: 'INITIAL_CANON',
              worldInfoField: 'offscreenRecords',
              stateVersion: 1
            },
            isStaleRelativeToCanonical: false,
            canonLifecycle: 'ACTIVE_CANON'
          });

          // ONLY structural location field from offscreenRecords[].location
          if (off.location && typeof off.location === 'string' && off.location.trim()) {
            const locId = `loc-${off.location.trim().toLowerCase().replace(/\s+/g, '-')}`;
            if (!entityMap.has(locId)) {
              entityMap.set(locId, {
                entityId: locId,
                entityType: 'LOCATION',
                name: off.location.trim(),
                categoryHint: 'Location',
                provenance: {
                  originSource: 'INITIAL_CANON',
                  worldInfoField: 'offscreenRecords.location',
                  stateVersion: 1
                },
                isStaleRelativeToCanonical: false,
                canonLifecycle: 'ACTIVE_CANON'
              });
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Extract Entities from Historical Records (Past items, NPCs, etc.)
  // -------------------------------------------------------------
  for (const rec of records) {
    if (!rec || !rec.recordId) continue;

    const actionPayload: any = rec.canonicalAction?.payload;
    let parsed: any = null;

    if (rec.details) {
      try {
        const jsonMatch = rec.details.match(/\{.*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Ignore unparseable historical details
      }
    }

    // Historical Item from details JSON or canonicalAction
    const itemData = parsed?.item || (rec.actionType === 'MODIFY_INVENTORY' ? actionPayload?.item : undefined);
    if (itemData && typeof itemData.id === 'string' && itemData.id.trim()) {
      const itemId = itemData.id.trim();
      if (!entityMap.has(itemId)) {
        entityMap.set(itemId, {
          entityId: itemId,
          entityType: 'ITEM',
          name: itemData.name || itemId,
          categoryHint: 'Historical Item',
          provenance: {
            originSource: 'HISTORICAL',
            sourceRecordId: rec.recordId,
            sourceEventId: rec.eventId,
            stateVersion: rec.stateVersionAfterCommit,
            narrativeTime: rec.narrativeTime,
            actionType: rec.actionType
          },
          isStaleRelativeToCanonical: true,
          staleReason: `Item (${itemId}) is not in current Canonical Inventory.`,
          canonLifecycle: 'INACTIVE_CANON'
        });
      }
    }

    // Historical NPC from details JSON or canonicalAction
    const npcId = (rec.actionType === 'ADD_NPC' && typeof (parsed?.id || actionPayload?.id) === 'string')
      ? (parsed?.id || actionPayload?.id).trim()
      : undefined;
    if (npcId && !entityMap.has(npcId)) {
      const npcName = parsed?.name || actionPayload?.name || npcId;
      entityMap.set(npcId, {
        entityId: npcId,
        entityType: 'NPC',
        name: npcName,
        categoryHint: parsed?.npcClass || actionPayload?.npcClass || 'Historical NPC',
        provenance: {
          originSource: 'HISTORICAL',
          sourceRecordId: rec.recordId,
          sourceEventId: rec.eventId,
          stateVersion: rec.stateVersionAfterCommit,
          narrativeTime: rec.narrativeTime,
          actionType: rec.actionType
        },
        isStaleRelativeToCanonical: true,
        staleReason: `NPC (${npcId}) was recorded historically but is missing in Canonical State.`,
        canonLifecycle: 'INACTIVE_CANON'
      });
    }

    // Historical Faction from details JSON or canonicalAction
    const facId = (rec.actionType === 'ADD_FACTION' && typeof (parsed?.id || actionPayload?.id) === 'string')
      ? (parsed?.id || actionPayload?.id).trim()
      : undefined;
    if (facId && !entityMap.has(facId)) {
      const facName = parsed?.name || actionPayload?.name || facId;
      entityMap.set(facId, {
        entityId: facId,
        entityType: 'FACTION',
        name: facName,
        categoryHint: 'Historical Faction',
        provenance: {
          originSource: 'HISTORICAL',
          sourceRecordId: rec.recordId,
          sourceEventId: rec.eventId,
          stateVersion: rec.stateVersionAfterCommit,
          narrativeTime: rec.narrativeTime,
          actionType: rec.actionType
        },
        isStaleRelativeToCanonical: true,
        staleReason: `Faction (${facId}) was recorded historically but is missing in Canonical State.`,
        canonLifecycle: 'INACTIVE_CANON'
      });
    }

    // Historical Narrative Seed from details JSON or canonicalAction
    const seedId = (rec.actionType === 'ADD_NARRATIVE_SEED' && typeof (parsed?.id || actionPayload?.id) === 'string')
      ? (parsed?.id || actionPayload?.id).trim()
      : undefined;
    if (seedId && !entityMap.has(seedId)) {
      const seedContent = parsed?.content || actionPayload?.content || seedId;
      entityMap.set(seedId, {
        entityId: seedId,
        entityType: 'NARRATIVE_SEED',
        name: seedContent.trim(),
        categoryHint: 'Historical Narrative Seed',
        provenance: {
          originSource: 'HISTORICAL',
          sourceRecordId: rec.recordId,
          sourceEventId: rec.eventId,
          stateVersion: rec.stateVersionAfterCommit,
          narrativeTime: rec.narrativeTime,
          actionType: rec.actionType
        },
        isStaleRelativeToCanonical: true,
        staleReason: `Narrative seed (${seedId}) was recorded historically.`,
        canonLifecycle: 'INACTIVE_CANON'
      });
    }

    // Historical Location from RECORD_OFFSCREEN_EVENT
    const locName = (rec.actionType === 'RECORD_OFFSCREEN_EVENT' && typeof (parsed?.location || actionPayload?.location) === 'string')
      ? (parsed?.location || actionPayload?.location).trim()
      : undefined;
    if (locName) {
      const locId = `loc-${locName.toLowerCase().replace(/\s+/g, '-')}`;
      if (!entityMap.has(locId)) {
        entityMap.set(locId, {
          entityId: locId,
          entityType: 'LOCATION',
          name: locName,
          categoryHint: 'Historical Location',
          provenance: {
            originSource: 'HISTORICAL',
            sourceRecordId: rec.recordId,
            sourceEventId: rec.eventId,
            stateVersion: rec.stateVersionAfterCommit,
            narrativeTime: rec.narrativeTime,
            actionType: rec.actionType
          },
          isStaleRelativeToCanonical: false,
          canonLifecycle: 'ACTIVE_CANON'
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Build Canonical Relations (OWNS, LOCATED_IN)
  // -------------------------------------------------------------
  const charId = 'protagonist';

  // 3-1. Canonical OWNS (CHARACTER -> ITEM)
  if (entityMap.has(charId) && canonicalState?.character?.inventory) {
    for (const item of canonicalState.character.inventory) {
      if (item && item.id && entityMap.has(item.id)) {
        const isQtyZero = (item.quantity ?? 1) <= 0;
        const relKey = `${charId}|OWNS|${item.id}`;
        if (!seenRelationKeys.has(relKey)) {
          seenRelationKeys.add(relKey);
          relationList.push({
            relationId: `rel-owns-${item.id}`,
            relationType: 'OWNS',
            sourceEntityId: charId,
            targetEntityId: item.id,
            provenance: {
              originSource: 'INITIAL_CANON',
              worldInfoField: 'inventory',
              stateVersion: 1
            },
            isStaleRelativeToCanonical: isQtyZero,
            staleReason: isQtyZero ? 'Item quantity is zero in current inventory.' : undefined,
            validFromVersion: 1
          });
        }
      }
    }
  }

  // 3-2. Canonical LOCATED_IN (OFFSCREEN_EVENT -> LOCATION)
  if (canonicalState?.worldInfo?.offscreenRecords) {
    for (const off of canonicalState.worldInfo.offscreenRecords) {
      if (off && off.id && off.location && entityMap.has(off.id)) {
        const locId = `loc-${off.location.trim().toLowerCase().replace(/\s+/g, '-')}`;
        if (entityMap.has(locId)) {
          const relKey = `${off.id}|LOCATED_IN|${locId}`;
          if (!seenRelationKeys.has(relKey)) {
            seenRelationKeys.add(relKey);
            relationList.push({
              relationId: `rel-loc-${off.id}`,
              relationType: 'LOCATED_IN',
              sourceEntityId: off.id,
              targetEntityId: locId,
              provenance: {
                originSource: 'INITIAL_CANON',
                worldInfoField: 'offscreenRecords',
                stateVersion: 1
              },
              isStaleRelativeToCanonical: false,
              validFromVersion: 1
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Build Historical Relations (Historical Inventory changes, etc.)
  // -------------------------------------------------------------
  for (const rec of records) {
    if (!rec || !rec.recordId || !rec.details) continue;

    if (rec.actionType === 'MODIFY_INVENTORY') {
      try {
        const jsonMatch = rec.details.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.item && parsed.item.id) {
            const itemId = parsed.item.id.trim();
            if (entityMap.has(charId) && entityMap.has(itemId)) {
              // Check if item currently exists in canonical inventory
              const currentlyInInventory = canonicalState?.character?.inventory?.some(
                i => i.id === itemId && (i.quantity ?? 1) > 0
              );
              const isRemovedOp = parsed.operation === 'REMOVE';
              const isStale = !currentlyInInventory || isRemovedOp;

              const relId = `rel-hist-owns-${rec.recordId}-${itemId}`;
              const relKey = `${charId}|OWNS|${itemId}|${rec.recordId}`;

              if (!seenRelationKeys.has(relKey)) {
                seenRelationKeys.add(relKey);
                relationList.push({
                  relationId: relId,
                  relationType: 'OWNS',
                  sourceEntityId: charId,
                  targetEntityId: itemId,
                  provenance: {
                    originSource: 'HISTORICAL',
                    sourceRecordId: rec.recordId,
                    sourceEventId: rec.eventId,
                    stateVersion: rec.stateVersionAfterCommit,
                    narrativeTime: rec.narrativeTime,
                    actionType: rec.actionType
                  },
                  isStaleRelativeToCanonical: isStale,
                  staleReason: isStale
                    ? `Historical inventory modification (${parsed.operation || 'MODIFY'}) does not reflect current inventory possession.`
                    : undefined,
                  validFromVersion: rec.stateVersionAfterCommit,
                  validToVersion: isRemovedOp ? rec.stateVersionAfterCommit : undefined
                });
              }
            }
          }
        }
      } catch {
        // Ignore unparseable JSON
      }
    }

    if (rec.actionType === 'RECORD_OFFSCREEN_EVENT') {
      try {
        const jsonMatch = rec.details.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.id && parsed.location) {
            const offId = parsed.id.trim();
            const locId = `loc-${parsed.location.trim().toLowerCase().replace(/\s+/g, '-')}`;
            if (entityMap.has(offId) && entityMap.has(locId)) {
              const relKey = `${offId}|LOCATED_IN|${locId}|${rec.recordId}`;
              if (!seenRelationKeys.has(relKey)) {
                seenRelationKeys.add(relKey);
                relationList.push({
                  relationId: `rel-hist-loc-${rec.recordId}`,
                  relationType: 'LOCATED_IN',
                  sourceEntityId: offId,
                  targetEntityId: locId,
                  provenance: {
                    originSource: 'HISTORICAL',
                    sourceRecordId: rec.recordId,
                    sourceEventId: rec.eventId,
                    stateVersion: rec.stateVersionAfterCommit,
                    narrativeTime: rec.narrativeTime,
                    actionType: rec.actionType
                  },
                  isStaleRelativeToCanonical: false,
                  validFromVersion: rec.stateVersionAfterCommit
                });
              }
            }
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  // -------------------------------------------------------------
  // 5. Index Relations into Outgoing & Incoming Maps
  // -------------------------------------------------------------
  for (const rel of relationList) {
    // Sanity check: Ensure both source and target entities actually exist
    if (!entityMap.has(rel.sourceEntityId) || !entityMap.has(rel.targetEntityId)) {
      continue; // Ghost relation dropped
    }
    if (rel.sourceEntityId === rel.targetEntityId) {
      continue; // Self loop dropped
    }

    // Outgoing
    const outList = outgoing.get(rel.sourceEntityId) || [];
    outList.push(rel);
    outgoing.set(rel.sourceEntityId, outList);

    // Incoming
    const inList = incoming.get(rel.targetEntityId) || [];
    inList.push(rel);
    incoming.set(rel.targetEntityId, inList);
  }

  return freezeDeep({
    entities: entityMap,
    relations: relationList,
    outgoingRelations: outgoing,
    incomingRelations: incoming,
    totalEntities: entityMap.size,
    totalRelations: relationList.length
  });
}

/**
 * Traverses the Universal Knowledge Graph starting from a root entity.
 * Uses BFS with strict Cycle Guard (visited Set), MAX_DEPTH default of 2,
 * and always returns authority: 'NON_CANONICAL'.
 */
export function traverseKnowledgeGraph(
  graph: UniversalKnowledgeGraph,
  query: GraphRetrievalQuery,
  currentSnapshot?: CanonicalState
): GraphRetrievalResult {
  const startId = query.startEntityId;
  const maxDepth = typeof query.maxDepth === 'number' && query.maxDepth >= 0 ? query.maxDepth : 2;
  const limit = typeof query.limit === 'number' && query.limit > 0 ? query.limit : 50;
  const allowedRelTypes = query.relationTypes;

  const startEntity = graph.entities.get(startId);
  if (!startEntity) {
    return freezeDeep({
      startEntity: undefined,
      visitedEntities: [],
      traversedRelations: [],
      depthMap: new Map(),
      authority: 'NON_CANONICAL'
    });
  }

  const visitedEntities: UniversalEntity[] = [startEntity];
  const visitedEntityIds = new Set<string>([startId]);
  const traversedRelations: UniversalRelation[] = [];
  const depthMap = new Map<string, number>([[startId, 0]]);

  // BFS Queue: [entityId, currentDepth]
  const queue: Array<[string, number]> = [[startId, 0]];

  while (queue.length > 0) {
    const [currentId, depth] = queue.shift()!;
    if (depth >= maxDepth) continue;
    if (visitedEntities.length >= limit) break;

    // Explore outgoing relations
    const outRels = graph.outgoingRelations.get(currentId) || [];
    for (const rel of outRels) {
      if (traversedRelations.length >= limit) break;
      if (allowedRelTypes && !allowedRelTypes.includes(rel.relationType)) continue;

      const targetId = rel.targetEntityId;
      const targetEntity = graph.entities.get(targetId);
      if (!targetEntity) continue;

      traversedRelations.push(rel);

      if (!visitedEntityIds.has(targetId)) {
        visitedEntityIds.add(targetId);
        visitedEntities.push(targetEntity);
        depthMap.set(targetId, depth + 1);
        queue.push([targetId, depth + 1]);
      }
    }

    // Explore incoming relations (for bidirectional exploration)
    const inRels = graph.incomingRelations.get(currentId) || [];
    for (const rel of inRels) {
      if (traversedRelations.length >= limit) break;
      if (allowedRelTypes && !allowedRelTypes.includes(rel.relationType)) continue;

      const sourceId = rel.sourceEntityId;
      const sourceEntity = graph.entities.get(sourceId);
      if (!sourceEntity) continue;

      if (!traversedRelations.some(r => r.relationId === rel.relationId)) {
        traversedRelations.push(rel);
      }

      if (!visitedEntityIds.has(sourceId)) {
        visitedEntityIds.add(sourceId);
        visitedEntities.push(sourceEntity);
        depthMap.set(sourceId, depth + 1);
        queue.push([sourceId, depth + 1]);
      }
    }
  }

  return freezeDeep({
    startEntity,
    visitedEntities,
    traversedRelations,
    depthMap,
    authority: 'NON_CANONICAL'
  });
}
