import { 
  TONE_AND_MANNER_CATALOG, 
  GENRE_PRESET_MASTER_POOL, 
  ToneAndManner, 
  GenrePreset,
  getToneDirective,
  getRandom10Presets
} from './genreAndToneData';
import { 
  GENRE_META_POOLS, 
  getWorldTailoredMetaPool,
  MetaElements,
  MetaElementCategory,
  MetaElementPresetItem,
  MetaPools
} from './metaPresetsData';
import { 
  WORLD_CHARACTER_POOLS, 
  CharacterPresetItem,
  getRandomCharacterPresetForWorld 
} from './characterPresetsData';

// Re-export all expanded data modules
export {
  TONE_AND_MANNER_CATALOG,
  GENRE_PRESET_MASTER_POOL,
  GENRE_META_POOLS,
  WORLD_CHARACTER_POOLS,
  getToneDirective,
  getRandom10Presets,
  getWorldTailoredMetaPool,
  getRandomCharacterPresetForWorld
};
export type {
  ToneAndManner,
  GenrePreset,
  MetaElements,
  MetaElementCategory,
  MetaElementPresetItem,
  MetaPools,
  CharacterPresetItem
};

export interface WorldGenrePreset {
  id: string;
  name: string;
  category: 'wuxia' | 'fantasy' | 'cyberpunk' | 'cthulhu' | 'space_opera' | 'anime';
  description: string;
  suggestedTone: string;
  starterNpcs: string[];
  starterFactions: string[];
}

// Convert GENRE_PRESET_MASTER_POOL into compatible WorldGenrePreset
export const WORLD_GENRE_PRESETS: WorldGenrePreset[] = GENRE_PRESET_MASTER_POOL.map(p => ({
  id: p.id,
  name: p.name,
  category: (p.id.includes('wuxia') ? 'wuxia' : 
            p.id.includes('fantasy') ? 'fantasy' : 
            p.id.includes('cyber') || p.id.includes('scifi') ? 'cyberpunk' : 
            p.id.includes('horror') || p.id.includes('mystery') ? 'cthulhu' : 'anime') as any,
  description: p.summary || p.name,
  suggestedTone: p.suggestedToneId,
  starterNpcs: (p.defaultNpcs || []).map(n => `${n.name} (${n.role})`),
  starterFactions: (p.defaultFactions || []).map(f => f.name)
}));

export interface MetaPresetOption {
  id: string;
  label: string;
  description: string;
}

// Universal fallback meta element presets (derived from wuxia/fantasy pools)
export const META_ELEMENT_PRESETS = {
  background: (GENRE_META_POOLS.wuxia?.background || []).map((text, idx) => ({ id: `bg_${idx}`, label: text.slice(0, 20), description: text })),
  flaw: (GENRE_META_POOLS.wuxia?.flaw || []).map((text, idx) => ({ id: `flaw_${idx}`, label: text.slice(0, 20), description: text })),
  oath: (GENRE_META_POOLS.wuxia?.oath || []).map((text, idx) => ({ id: `oath_${idx}`, label: text.slice(0, 20), description: text })),
  anchor: (GENRE_META_POOLS.wuxia?.anchor || []).map((text, idx) => ({ id: `anchor_${idx}`, label: text.slice(0, 20), description: text })),
  faction: (GENRE_META_POOLS.wuxia?.faction || []).map((text, idx) => ({ id: `faction_${idx}`, label: text.slice(0, 20), description: text }))
};
