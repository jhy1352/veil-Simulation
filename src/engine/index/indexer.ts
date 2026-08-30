import { WorldInfo, NpcRecord, FactionRecord } from '../../types';
import { ActionType, ImmutableHistoricalRecord } from '../types';
import {
  CanonIndex,
  CanonIndexItem,
  HistoricalIndex,
  HistoricalIndexItem
} from './types';

/**
 * Deep freezes an object or array to ensure strict read-only access.
 */
function freezeDeep<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  if (obj instanceof Map) {
    // Maps cannot be easily deep-frozen with Object.freeze on entries, but we return as ReadonlyMap
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
 * Extracts normalized search keywords from a string.
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);
  return Array.from(new Set(words));
}

/**
 * Pure functional builder for Initial Canon Index.
 * Extracts baseline lore, NPCs, Factions, and Rumors from initial WorldPack.
 * Does NOT mutate or touch Canonical State.
 */
export function buildCanonIndex(worldInfo?: Partial<WorldInfo>): CanonIndex {
  const items: CanonIndexItem[] = [];
  const byEntityId = new Map<string, CanonIndexItem[]>();
  const byTag = new Map<string, CanonIndexItem[]>();

  if (!worldInfo) {
    return freezeDeep({
      items: [],
      byEntityId: new Map(),
      byTag: new Map(),
      totalItems: 0
    });
  }

  // 1. World Metadata / Lore
  if (worldInfo.worldName) {
    const loreItem: CanonIndexItem = {
      id: 'canon-lore-world',
      category: 'WORLD_LORE',
      title: worldInfo.worldName,
      content: `세계관: ${worldInfo.worldName}. ${worldInfo.settingDescription || ''}`,
      tags: ['world', 'lore', ...extractKeywords(worldInfo.worldName), ...extractKeywords(worldInfo.settingDescription || '')],
      visibility: 'PUBLIC'
    };
    items.push(loreItem);
  }

  // 2. Secret Lore
  if (Array.isArray(worldInfo.secretLore)) {
    for (let i = 0; i < worldInfo.secretLore.length; i++) {
      const lore = worldInfo.secretLore[i];
      if (lore && typeof lore === 'string') {
        const loreItem: CanonIndexItem = {
          id: `canon-secret-lore-${i + 1}`,
          category: 'WORLD_LORE',
          title: `Secret Lore #${i + 1}`,
          content: lore,
          tags: ['lore', 'secret', ...extractKeywords(lore)],
          visibility: 'PRIVATE'
        };
        items.push(loreItem);
      }
    }
  }

  // 3. Factions
  if (Array.isArray(worldInfo.factions)) {
    for (const fac of worldInfo.factions) {
      if (fac && fac.id && fac.name) {
        const facItem: CanonIndexItem = {
          id: `canon-fac-${fac.id}`,
          category: 'FACTION',
          title: fac.name,
          content: `세력: ${fac.name}. ${fac.description || ''}`,
          entityId: fac.id,
          tags: ['faction', fac.id, ...extractKeywords(fac.name), ...extractKeywords(fac.description || '')],
          visibility: 'PUBLIC'
        };
        items.push(facItem);
      }
    }
  }

  // 4. NPCs
  if (Array.isArray(worldInfo.npcs)) {
    for (const npc of worldInfo.npcs) {
      if (npc && npc.id && npc.name) {
        const npcItem: CanonIndexItem = {
          id: `canon-npc-${npc.id}`,
          category: 'NPC',
          title: npc.name,
          content: `인물: ${npc.name} [${npc.npcClass || '일반'}] 상태: ${npc.status || 'ALIVE'}. ${npc.innerThought ? `내면: ${npc.innerThought}` : ''}`,
          entityId: npc.id,
          tags: ['npc', npc.id, ...extractKeywords(npc.name), ...extractKeywords(npc.npcClass || '')],
          visibility: 'PUBLIC'
        };
        items.push(npcItem);
      }
    }
  }

  // 5. Public Rumors
  if (Array.isArray(worldInfo.publicRumors)) {
    for (let i = 0; i < worldInfo.publicRumors.length; i++) {
      const rumor = worldInfo.publicRumors[i];
      if (rumor && typeof rumor === 'string') {
        const rumorItem: CanonIndexItem = {
          id: `canon-rumor-${i + 1}`,
          category: 'RUMOR',
          title: `소문 #${i + 1}`,
          content: rumor,
          tags: ['rumor', ...extractKeywords(rumor)],
          visibility: 'PUBLIC'
        };
        items.push(rumorItem);
      }
    }
  }

  // Build indexes
  for (const item of items) {
    if (item.entityId) {
      const existing = byEntityId.get(item.entityId) || [];
      existing.push(item);
      byEntityId.set(item.entityId, existing);
    }
    for (const tag of item.tags) {
      const existing = byTag.get(tag) || [];
      existing.push(item);
      byTag.set(tag, existing);
    }
  }

  return freezeDeep({
    items,
    byEntityId,
    byTag,
    totalItems: items.length
  });
}

/**
 * Pure functional builder for Historical Index.
 * Extracts event records, action types, entity references, and keywords from ImmutableHistoricalRecord[].
 * Does NOT mutate records or Sovereign State. Deduplicates by recordId.
 */
export function buildHistoricalIndex(records: readonly ImmutableHistoricalRecord[] = []): HistoricalIndex {
  const items: HistoricalIndexItem[] = [];
  const seenRecordIds = new Set<string>();

  const byEntityId = new Map<string, HistoricalIndexItem[]>();
  const byActionType = new Map<ActionType, HistoricalIndexItem[]>();
  const byKeyword = new Map<string, HistoricalIndexItem[]>();

  for (const rec of records) {
    if (!rec || !rec.recordId) continue;
    // Deduplicate duplicate record inputs
    if (seenRecordIds.has(rec.recordId)) continue;
    seenRecordIds.add(rec.recordId);

    // Extract entityId if present in record or payload
    let entityId = (rec as any).entityId;
    if (!entityId && rec.details) {
      try {
        const jsonMatch = rec.details.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.id) entityId = parsed.id;
          else if (parsed.item && parsed.item.id) entityId = parsed.item.id;
          else if (parsed.factionId) entityId = parsed.factionId;
        }
      } catch {
        // details wasn't valid JSON, fallback
      }
    }

    const keywords = [
      ...extractKeywords(rec.details),
      ...extractKeywords(rec.actionType),
      ...(entityId ? [entityId.toLowerCase()] : [])
    ];

    const item: HistoricalIndexItem = {
      recordId: rec.recordId,
      eventId: rec.eventId,
      stateVersion: rec.stateVersionAfterCommit,
      turn: rec.turn,
      timestamp: rec.timestamp,
      narrativeTime: rec.narrativeTime,
      actionType: rec.actionType,
      entityId,
      keywords: Array.from(new Set(keywords)),
      summary: `[T${rec.turn} V${rec.stateVersionAfterCommit}] ${rec.actionType}: ${rec.details.slice(0, 100)}`,
      details: rec.details,
      informationAccess: rec.informationAccess || 'PUBLIC'
    };

    items.push(item);

    // Entity Index
    if (item.entityId) {
      const existing = byEntityId.get(item.entityId) || [];
      existing.push(item);
      byEntityId.set(item.entityId, existing);
    }

    // Action Type Index
    const byAct = byActionType.get(item.actionType) || [];
    byAct.push(item);
    byActionType.set(item.actionType, byAct);

    // Keyword Index
    for (const kw of item.keywords) {
      const byKw = byKeyword.get(kw) || [];
      byKw.push(item);
      byKeyword.set(kw, byKw);
    }
  }

  return freezeDeep({
    items,
    byEntityId,
    byActionType,
    byKeyword,
    totalRecords: items.length
  });
}

/**
 * Rebuilds both Canon and Historical Indices cleanly.
 */
export function rebuildAllIndices(
  worldInfo?: WorldInfo,
  records?: readonly ImmutableHistoricalRecord[]
): { canonIndex: CanonIndex; historicalIndex: HistoricalIndex } {
  return {
    canonIndex: buildCanonIndex(worldInfo),
    historicalIndex: buildHistoricalIndex(records || [])
  };
}
