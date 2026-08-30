import { TransitionAction } from './types';
import { WorldInfo, Character, Item } from '../types';

const ALLOWED_STAT_KEYS = new Set(['strength', 'agility', 'constitution', 'intelligence', 'wisdom', 'charisma']);

/**
 * Deep clones an object or state graph.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Sanitizes an Item to prevent arbitrary field pollution and NaN/Infinity values.
 */
export function sanitizeItem(rawItem: Item): Item {
  if (!rawItem || typeof rawItem !== 'object') {
    return { id: 'unknown', name: 'Unknown Item', quantity: 1 };
  }
  const qty = typeof rawItem.quantity === 'number' && Number.isFinite(rawItem.quantity) && rawItem.quantity >= 0 ? rawItem.quantity : 1;
  return {
    id: String(rawItem.id || 'item'),
    name: String(rawItem.name || 'Unnamed Item'),
    quantity: qty,
    description: rawItem.description !== undefined ? String(rawItem.description) : undefined,
    itemType: rawItem.itemType !== undefined ? String(rawItem.itemType) : undefined,
    category: rawItem.category !== undefined ? String(rawItem.category) : undefined,
    rarity: rawItem.rarity !== undefined ? String(rawItem.rarity) : undefined
  };
}

/**
 * Applies a single transition action to the mutable draft state.
 * Shared by Validator (virtual draft) and SovereignEngine (execution draft).
 */
export function applyActionToDraftState(action: TransitionAction, world: WorldInfo, character: Character): void {
  switch (action.type) {
    case 'SET_WORLD_METADATA': {
      const { worldName, settingDescription, toneStyle } = action.payload;
      if (worldName) world.worldName = worldName;
      if (settingDescription) world.settingDescription = settingDescription;
      if (toneStyle) world.toneStyle = toneStyle;
      break;
    }

    case 'ADVANCE_TIME': {
      const { targetTime } = action.payload;
      if (!world.currentTime) {
        world.currentTime = deepClone(targetTime);
      } else {
        world.currentTime = { ...world.currentTime, ...deepClone(targetTime) };
      }
      break;
    }

    case 'ADD_RUMOR': {
      const { rumor } = action.payload;
      if (!world.publicRumors) world.publicRumors = [];
      world.publicRumors.push(rumor);
      break;
    }

    case 'ADD_NPC': {
      const npc = deepClone(action.payload);
      if (!npc.status) npc.status = 'ALIVE';
      world.npcs.push(npc);
      break;
    }

    case 'UPDATE_NPC': {
      const { id, changes } = action.payload;
      const index = world.npcs.findIndex(n => n.id === id);
      if (index !== -1) {
        const existing = world.npcs[index];
        // Enforce ID immutability and DEAD status protection
        const safeChanges = { ...changes };
        delete (safeChanges as any).id;
        if (existing.status === 'DEAD' && safeChanges.status && safeChanges.status !== 'DEAD') {
          delete safeChanges.status;
        }
        world.npcs[index] = { ...existing, ...safeChanges, id: existing.id };
      }
      break;
    }

    case 'SET_NPC_STATUS': {
      const { id, status } = action.payload;
      const index = world.npcs.findIndex(n => n.id === id);
      if (index !== -1) {
        const existing = world.npcs[index];
        if (existing.status === 'DEAD') {
          // Dead NPC status and properties are immutable
          break;
        }
        if (existing.status !== status) {
          world.npcs[index].status = status;
          world.npcs[index].impression = `[STATUS: ${status}] ${world.npcs[index].impression || ''}`.trim();
        }
      }
      break;
    }

    case 'ADD_FACTION': {
      world.factions.push(deepClone(action.payload));
      break;
    }

    case 'UPDATE_FACTION': {
      const { id, changes } = action.payload;
      const index = world.factions.findIndex(f => f.id === id);
      if (index !== -1) {
        const existing = world.factions[index];
        const safeChanges = { ...changes };
        delete (safeChanges as any).id;
        world.factions[index] = { ...existing, ...safeChanges, id: existing.id };
      }
      break;
    }

    case 'ADD_NARRATIVE_SEED': {
      world.seeds.push(deepClone(action.payload));
      break;
    }

    case 'RESOLVE_NARRATIVE_SEED': {
      const { id, resolutionSummary } = action.payload;
      const seed = world.seeds.find(s => s.id === id);
      if (seed) {
        seed.status = 'resolved';
        seed.content = `${seed.content} (Resolved: ${resolutionSummary})`;
      }
      break;
    }

    case 'ADVANCE_CHAPTER': {
      const { currentChapter, upcomingChapters } = action.payload;
      if (!world.chapters) {
        world.chapters = {
          currentChapter: (world as any).currentChapter || '1장',
          upcomingChapters: Array.isArray((world as any).upcomingChapters) ? [...(world as any).upcomingChapters] : []
        };
      }
      world.chapters.currentChapter = currentChapter;
      if (upcomingChapters) {
        world.chapters.upcomingChapters = [...upcomingChapters];
      }
      break;
    }

    case 'RECORD_OFFSCREEN_EVENT': {
      const { id: payloadId, eventDescription, location, factionId, involvedNpcIds, narrativeTime, timestamp, visibility } = action.payload;
      if (!world.cameraOffscreenEvents) world.cameraOffscreenEvents = [];
      world.cameraOffscreenEvents.push(eventDescription);
      
      if (!world.offscreenRecords) world.offscreenRecords = [];
      world.offscreenRecords.push({
        id: payloadId || `offscreen-${Date.now()}-${world.offscreenRecords.length + 1}`,
        eventDescription,
        location,
        factionId,
        involvedNpcIds,
        narrativeTime: narrativeTime ? deepClone(narrativeTime) : (world.currentTime ? deepClone(world.currentTime) : undefined),
        timestamp: timestamp || new Date().toISOString(),
        visibility: visibility || 'HIDDEN'
      });
      break;
    }

    case 'UPDATE_CHARACTER_STATS': {
      // BUG-06 Defense: only mutate allowed stat keys with finite numbers
      const statsPayload = action.payload || {};
      for (const [key, val] of Object.entries(statsPayload)) {
        if (ALLOWED_STAT_KEYS.has(key) && typeof val === 'number' && Number.isFinite(val) && val >= 0) {
          (character.stats as any)[key] = val;
        }
      }
      break;
    }

    case 'MODIFY_INVENTORY': {
      const { item, operation } = action.payload;
      const sanitized = sanitizeItem(item);
      const existingIndex = character.inventory.findIndex(i => {
        if (sanitized.id && i.id) {
          return i.id === sanitized.id;
        }
        return sanitized.name && i.name === sanitized.name;
      });

      if (operation === 'ADD') {
        if (existingIndex !== -1) {
          character.inventory[existingIndex].quantity += sanitized.quantity;
        } else {
          character.inventory.push(sanitized);
        }
      } else if (operation === 'REMOVE') {
        if (existingIndex !== -1) {
          character.inventory[existingIndex].quantity -= sanitized.quantity;
          if (character.inventory[existingIndex].quantity <= 0) {
            character.inventory.splice(existingIndex, 1);
          }
        }
      } else if (operation === 'SET_QUANTITY') {
        if (existingIndex !== -1) {
          character.inventory[existingIndex].quantity = sanitized.quantity;
        }
        // SET_QUANTITY on non-existent item is rejected by validator and must not invent items in applier
      }
      break;
    }

    case 'SET_CHARACTER_SECRET': {
      character.secret = action.payload.secret;
      break;
    }

    case 'RECORD_PHYSICAL_DEFECT': {
      character.physicalDefect = action.payload.defect;
      break;
    }

    case 'RECORD_DICE_RESULT': {
      world.dcHistory.push(action.payload.targetDC);
      break;
    }

    case 'OVERWRITE_WORLD_INFO': {
      const incoming = action.payload;
      world.worldName = incoming.worldName || world.worldName;
      world.worldType = incoming.worldType || world.worldType;
      world.settingDescription = incoming.settingDescription || world.settingDescription;
      world.toneStyle = incoming.toneStyle || world.toneStyle;
      if (incoming.npcs !== undefined) {
        // Defense in depth: preserve DEAD status of existing NPCs and preserve dead NPCs not in incoming list
        const existingDeadMap = new Map((world.npcs || []).filter(n => n.status === 'DEAD').map(n => [n.id, n]));
        const incomingNpcIds = new Set<string>();
        const mappedNpcs = deepClone(incoming.npcs).map((incNpc: any) => {
          if (incNpc && typeof incNpc === 'object' && incNpc.id) {
            incomingNpcIds.add(incNpc.id);
            if (existingDeadMap.has(incNpc.id)) {
              incNpc.status = 'DEAD';
            }
          }
          return incNpc;
        });
        // Preserve any existing DEAD NPCs that were omitted from incoming list
        for (const [deadId, deadNpc] of existingDeadMap.entries()) {
          if (!incomingNpcIds.has(deadId)) {
            mappedNpcs.push(deepClone(deadNpc));
          }
        }
        world.npcs = mappedNpcs;
      }
      if (incoming.factions !== undefined) world.factions = deepClone(incoming.factions);
      if (incoming.publicRumors !== undefined) world.publicRumors = deepClone(incoming.publicRumors);
      if (incoming.secretLore !== undefined) world.secretLore = deepClone(incoming.secretLore);
      if (incoming.seeds !== undefined) world.seeds = deepClone(incoming.seeds);
      if (incoming.chapters !== undefined) world.chapters = deepClone(incoming.chapters);
      if (incoming.unresolvedForeshadows !== undefined) world.unresolvedForeshadows = deepClone(incoming.unresolvedForeshadows);
      if (incoming.cameraOffscreenEvents !== undefined) world.cameraOffscreenEvents = deepClone(incoming.cameraOffscreenEvents);
      if (incoming.dcHistory !== undefined) world.dcHistory = [...incoming.dcHistory];
      break;
    }

    case 'OVERWRITE_CHARACTER': {
      const incoming = action.payload;
      character.name = incoming.name || character.name;
      character.gender = incoming.gender || character.gender;
      character.age = incoming.age ?? character.age;
      character.appearance = incoming.appearance || character.appearance;
      character.goal = incoming.goal || character.goal;
      character.originBackground = incoming.originBackground || character.originBackground;
      character.backgroundType = incoming.backgroundType || character.backgroundType;
      character.flaw = incoming.flaw || character.flaw;
      character.flawType = incoming.flawType || character.flawType;
      character.oath = incoming.oath || character.oath;
      character.oathType = incoming.oathType || character.oathType;
      character.anchor = incoming.anchor || character.anchor;
      character.anchorType = incoming.anchorType || character.anchorType;
      character.faction = incoming.faction || character.faction;
      character.factionType = incoming.factionType || character.factionType;
      if (incoming.stats !== undefined && typeof incoming.stats === 'object' && incoming.stats !== null && !Array.isArray(incoming.stats)) {
        const sanitizedStats: Record<string, number> = {};
        for (const [k, v] of Object.entries(incoming.stats)) {
          if (ALLOWED_STAT_KEYS.has(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
            sanitizedStats[k] = v;
          }
        }
        character.stats = { ...character.stats, ...sanitizedStats };
      }
      if (incoming.inventory !== undefined && Array.isArray(incoming.inventory)) {
        character.inventory = incoming.inventory.map((item: any) => sanitizeItem(item));
      }
      if (incoming.secret !== undefined) character.secret = incoming.secret;
      
      // Permanent physical defect preservation
      if (character.physicalDefect && character.physicalDefect.trim().length > 0) {
        if (incoming.physicalDefect && incoming.physicalDefect.trim().length > 0) {
          if (incoming.physicalDefect !== character.physicalDefect && !incoming.physicalDefect.includes(character.physicalDefect)) {
            character.physicalDefect = `${character.physicalDefect}, ${incoming.physicalDefect}`;
          } else {
            character.physicalDefect = incoming.physicalDefect;
          }
        }
        // If incoming.physicalDefect is empty or undefined, preserve existing canonical physical defect
      } else if (incoming.physicalDefect !== undefined) {
        character.physicalDefect = incoming.physicalDefect;
      }
      if (incoming.timeline !== undefined) character.timeline = deepClone(incoming.timeline);
      break;
    }

    default:
      break;
  }
}
