import { Character, GameState, WorldInfo, DEFAULT_CHAPTER_NAME } from '../types';

export function createEmptyCharacter(): Character {
  return {
    name: '',
    gender: '',
    age: '',
    appearance: '',
    goal: '',
    originBackground: '',
    backgroundType: 'preset',
    flaw: '',
    flawType: 'preset',
    oath: '',
    oathType: 'preset',
    anchor: '',
    anchorType: 'preset',
    faction: '',
    factionType: 'preset',
    stats: {
      strength: 10,
      agility: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    },
    inventory: [],
    secret: '',
    physicalDefect: '',
    timeline: []
  };
}

export function createEmptyWorldInfo(): WorldInfo {
  return {
    worldName: '',
    worldType: 'popular_genre',
    settingDescription: '',
    toneStyle: '원작 고유의 문체 충실 재현',
    currentTime: {
      year: 1,
      season: 'SPRING',
      formattedTime: '1년 봄'
    },
    npcs: [],
    factions: [],
    publicRumors: [],
    secretLore: [],
    seeds: [],
    chapters: {
      currentChapter: DEFAULT_CHAPTER_NAME,
      upcomingChapters: []
    },
    dcHistory: [],
    unresolvedForeshadows: [],
    cameraOffscreenEvents: [],
    offscreenRecords: []
  };
}

export function createEmptyGameState(): GameState {
  return 'creation';
}

export function createEmptyEngineState(): import('../types').EngineState {
  return {
    historicalRecords: [],
    pendingCandidates: [],
    validationLogs: [],
    latencyHistory: [],
    turnTraces: [],
    checkpoints: [],
    saveDietEvents: [],
    lastContextSnapshot: '',
    lastRawResponse: ''
  };
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Recursive Deep Merge Utility for state hydration and reconciliation
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject((source as any)[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: (source as any)[key] });
        } else {
          (output as any)[key] = deepMerge((target as any)[key], (source as any)[key]);
        }
      } else {
        Object.assign(output, { [key]: (source as any)[key] });
      }
    });
  }
  return output;
}
