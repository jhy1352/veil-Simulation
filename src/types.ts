export type ActionIntentCategory =
  | 'PLAYER_EXPLICIT'
  | 'WORLD_CAUSAL'
  | 'SYSTEM_INITIALIZATION';

export type GameState = 'creation' | 'playing' | 'gameover';

export type Language = 'ko' | 'en' | 'ja' | 'zh';

export type PlayMode = 'TRPG' | 'Narrative';

export type GeminiModelType = 'gemini-3.7-flash' | 'gemini-3.6-flash' | 'gemini-2.5-flash';

export type FontSizeLevel = 'sm' | 'base' | 'lg' | 'xl';

export type WorldType = 'original_ip' | 'popular_genre' | 'custom_world';

export type NpcClass = 'Class A' | 'Class B' | 'Class C' | 'MAJOR_NAMED' | 'MINOR_NAMED' | 'EXTRA' | string;

export const DEFAULT_NPC_CLASS: NpcClass = 'Class C';
export const DEFAULT_CHAPTER_NAME = '서막';

export type NpcStatus = 'ALIVE' | 'DEAD' | 'MISSING' | 'UNMET' | 'MET';

export interface NarrativeTime {
  year: number;
  season?: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
  month?: number;
  day?: number;
  timeOfDay?: 'DAWN' | 'MORNING' | 'NOON' | 'AFTERNOON' | 'DUSK' | 'NIGHT' | 'MIDNIGHT';
  formattedTime?: string;
}

export interface OffscreenEventRecord {
  id: string;
  eventDescription: string;
  location?: string;
  factionId?: string;
  involvedNpcIds?: string[];
  narrativeTime?: NarrativeTime;
  timestamp: string;
  visibility?: 'PUBLIC' | 'FACTION_ONLY' | 'PRIVATE' | 'HIDDEN' | 'RUMOR';
}

export interface NpcRecord {
  id: string;
  name: string;
  alias?: string;
  age?: string | number;
  origin?: string;
  background?: string;
  martialArts?: string;
  values?: string;
  innerThought?: string;
  impression?: string;
  npcClass?: NpcClass;
  affiliation?: string;
  isOriginal?: boolean;
  metInStory?: boolean;
  status?: NpcStatus;
  role?: string;
  location?: string;
  secret?: string;
  trust?: number;
  affinity?: number;
  personality?: string;
  entityReference?: EntityReferenceBundle;
}

export interface FactionRecord {
  id: string;
  name: string;
  leader?: string;
  alignment?: string;
  influence?: string | number;
  description: string;
  attitudeTowardsPlayer?: string;
  relationshipToProtagonist?: string;
  impression?: string;
  hostility?: number | string;
  entityReference?: EntityReferenceBundle;
}

export interface NarrativeSeed {
  id: string;
  content: string;
  status: 'active' | 'resolved' | 'dormant';
  turnCreated?: number;
  entityReference?: EntityReferenceBundle;
}

export interface ChapterInfo {
  currentChapter: string;
  upcomingChapters: string[];
}

export interface WorldInfo {
  worldName: string;
  worldType: WorldType;
  settingDescription: string;
  toneStyle?: string;
  playMode?: PlayMode;
  currentTime?: NarrativeTime;
  npcs: NpcRecord[];
  factions: FactionRecord[];
  publicRumors: string[];
  secretLore: string[];
  seeds: NarrativeSeed[];
  chapters: ChapterInfo;
  dcHistory: number[];
  unresolvedForeshadows: string[];
  cameraOffscreenEvents: string[];
  offscreenRecords?: OffscreenEventRecord[];
}

export type StatType = 'strength' | 'agility' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export interface CharacterStats {
  strength: number;
  agility: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  vitality?: number;
  intellect?: number;
  insight?: number;
  willpower?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  description?: string;
  itemType?: string;
  category?: string;
  rarity?: string;
  entityReference?: EntityReferenceBundle;
}

export type Item = InventoryItem;
export type CanonicalEntityReferenceType = 'CHARACTER' | 'NPC' | 'FACTION' | 'ITEM' | 'NARRATIVE_SEED';

// ----------------------------------------------------
// Canonical Entity Identity Evidence Boundary
// ----------------------------------------------------

export interface EntityReferenceEvidence {
  sourceNpcId?: string;
  context?: string;
  verifiedEventId?: string;
  cause?: string;
  cost?: { name?: string; id?: string; quantity: number };
}

/**
 * LLM-provided identity claim plus independent identity evidence.
 * claimedEntityId is a claim only; Engine/Resolver remains authoritative.
 */
export interface EntityReferenceBundle {
  entityType: CanonicalEntityReferenceType;
  claimedEntityId?: string;
  evidence: EntityReferenceEvidence;
  /** Engine-only transient field. Never accepted as an authority from LLM output. */
  resolvedEntityId?: string;
}

export interface Character {
  name: string;
  title?: string;
  gender: string;
  age: string | number;
  appearance: string;
  goal: string;
  currentGoal?: string;
  biography?: string;
  originBackground: string;
  backgroundType: 'preset' | 'custom' | 'tabula_rasa';
  flaw: string;
  flawType: 'preset' | 'custom' | 'tabula_rasa';
  oath: string;
  oathType: 'preset' | 'custom' | 'tabula_rasa';
  anchor: string;
  anchorType: 'preset' | 'custom' | 'tabula_rasa';
  faction: string;
  factionType: 'preset' | 'custom' | 'tabula_rasa';
  stats: CharacterStats;
  inventory: InventoryItem[];
  secret?: string;
  physicalDefect?: string;
  disabilities?: string[];
  overcameFlaws?: string[];
  timeline?: string[];
  metaElements?: {
    background: string;
    flaw: string;
    oath: string;
    anchor: string;
    faction: string;
  };
}

export interface Message {
  id: string;
  turn?: number;
  sender: 'player' | 'gm' | 'system';
  content: string;
  timestamp: string;
  rawMetadata?: string;
  dcPrompt?: {
    requiredDC: number;
    statType?: string;
    description: string;
  };
}

export interface StoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  cleanText?: string;
  metaData?: GMMetaData;
  rawMetaBlock?: string;
  rawResponse?: string;
  contextSnapshot?: string;
  turn?: number;
  timestamp: string;
}

export interface RollEvent {
  targetDC: number;
  statType: StatType;
  actionContext: string;
}

export interface GMMetaData {
  factCheckSummary?: string;
  uiSyncReport?: string;
  npcKnowledgeCheck?: string;
  foreshadowSeeds?: string[];
  cameraOffscreenEvents?: string[];
  currentChapter?: string;
  upcomingChapters?: string[];
  statChanges?: string;
  inventoryChanges?: (string | { name: string; quantity: number; action?: 'add' | 'remove'; operation?: 'ADD' | 'REMOVE'; entityReference?: EntityReferenceBundle })[];
  recommendedDC?: number;
  dcReason?: string;
  contextVerificationDeclaration?: string;
  newNpcs?: Partial<NpcRecord>[];
  newFactions?: Partial<FactionRecord>[];
  resolvedSeeds?: { content: string; resolutionSummary?: string }[];
  statDeltas?: { stat: StatType; delta: number }[];
}

// ----------------------------------------------------
// Section: Engine Memory, Historical Records & State Firewall
// ----------------------------------------------------

export type InformationAccessBoundary =
  | 'PUBLIC'
  | 'FACTION'
  | 'PRIVATE'
  | 'HIDDEN'
  | 'PROTAGONIST_KNOWN'
  | 'UNKNOWN';

export type HistoricalRecordType =
  | 'WORLD_ESTABLISHED'
  | 'CHARACTER_INITIALIZED'
  | 'NARRATIVE_SEED_CREATED'
  | 'NARRATIVE_SEED_RESOLVED'
  | 'OFFSCREEN_WORLD_EVENT'
  | 'NPC_REGISTERED'
  | 'NPC_STATE_CHANGED'
  | 'NPC_DECEASED'
  | 'FACTION_STATE_CHANGED'
  | 'ITEM_ACQUIRED'
  | 'ITEM_USED'
  | 'STAT_CHANGED'
  | 'DC_RECORDED'
  | 'ROADMAP_UPDATED'
  | 'CANON_FACT_CONFIRMED';

export interface HistoricalRecord {
  recordId: string;
  recordType: HistoricalRecordType;
  turn: number;
  narrativeDate?: string;
  createdAt: string;
  locationId?: string;
  involvedCharacterIds: string[];
  involvedFactionIds: string[];
  source: 'ENGINE_INITIAL' | 'USER_INPUT' | 'AI_GM_METADATA' | 'CANONICAL_ENGINE';
  status: 'CANONICAL' | 'CONFLICT' | 'SUPERSEDED' | 'INVALID';
  causalParentIds: string[];
  relatedRecordIds: string[];
  informationAccess: InformationAccessBoundary;
  payload: Record<string, any>;
}

export interface CandidatePacket {
  candidateId: string;
  turn: number;
  narrativeDate?: string;
  timestamp: string;
  npcChanges?: {
    name: string;
    alias?: string;
    npcClass?: NpcClass;
    innerThought?: string;
    metInStory?: boolean;
    isDead?: boolean;
    origin?: string;
    background?: string;
    martialArts?: string;
    values?: string;
    affiliation?: string;
    informationAccess?: InformationAccessBoundary;
    entityReference?: EntityReferenceBundle;
  }[];
  factionChanges?: {
    name: string;
    description?: string;
    attitudeTowardsPlayer?: string;
    informationAccess?: InformationAccessBoundary;
    entityReference?: EntityReferenceBundle;
  }[];
  seedChanges?: {
    content: string;
    status: 'active' | 'resolved' | 'dormant';
    action: 'create' | 'resolve' | 'dormant';
    resolutionSummary?: string;
    entityReference?: EntityReferenceBundle;
  }[];
  offscreenEvents?: {
    event: string;
    informationAccess?: InformationAccessBoundary;
  }[];
  inventoryChanges?: {
    name: string;
    quantity: number;
    action: 'add' | 'remove';
    entityReference?: EntityReferenceBundle;
    acquisition?: {
      cause?: string;
      cost?: { name?: string; id?: string; quantity: number };
      sourceNpcId?: string;
      context?: string;
      verifiedEventId?: string;
    };
    cause?: string;
    cost?: { name?: string; id?: string; quantity: number };
    verifiedEventId?: string;
  }[];
  statChanges?: {
    stat: StatType;
    delta: number;
  }[];
  characterChanges?: {
    name?: string;
    alias?: string;
    background?: string;
    martialArts?: string;
    entityReference?: EntityReferenceBundle;
  };
  chapterChanges?: {
    currentChapter?: string;
    upcomingChapters?: string[];
  };
  recommendedDC?: number;
  rawMetadataBlock?: string;
}

export interface ValidationDiagnosticLog {
  logId?: string;
  timestamp: string;
  turn: number;
  candidateId?: string;
  isValid?: boolean;
  outcome?: 'PASSED' | 'SANITIZED_AND_PASSED' | 'REJECTED';
  details?: string;
  rejectedReasons: string[];
  sanitizedFields?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  candidateId: string;
  sanitizedCandidate: CandidatePacket;
  rejectedReasons: string[];
}

export interface TurnLatencyMetrics {
  turn: number;
  model: string;
  t0_playerInput: number;
  t1_requestStart: number;
  t2_contextAssemblyComplete: number;
  t3_geminiRequestStart: number;
  t4_geminiResponseReceived: number;
  t5_parserComplete: number;
  t6_stateMutationComplete: number;
  t7_uiUpdateComplete: number;
  contextAssemblyMs: number;
  geminiGenerationMs: number;
  parsingValidationMs: number;
  totalTurnMs: number;
  inputCharCount: number;
  outputCharCount: number;
  tokenCount?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
  retried: boolean;
}

export interface TurnTrace {
  turn: number;
  timestamp: string;
  playerInput: string;
  contextSnapshotSnippet?: string;
  rawResponseSnippet?: string;
  steps: {
    step: 'T0_PLAYER_INPUT' | 'T1_REQUEST_START' | 'T2_CONTEXT_ASSEMBLED' | 'T3_GEMINI_START' | 'T4_GEMINI_RECEIVED' | 'T5_PARSED' | 'T6_VALIDATED' | 'T7_COMMITTED';
    status: 'OK' | 'FAILED' | 'SANITIZED' | 'SKIPPED' | 'REJECTED';
    timestamp: number;
    details?: string;
  }[];
  verdict?: 'PASSED' | 'SANITIZED_AND_PASSED' | 'REJECTED' | 'NO_CANDIDATE';
  rejections?: string[];
  committedRecordIds?: string[];
}

export interface CheckpointSnapshot {
  turn: number;
  timestamp: string;
  chapter: string;
  narrativeTime: string;
  characterStats: Record<string, number>;
  inventoryCount: number;
  npcCount: number;
  seedCount: number;
  historicalRecordCount: number;
  diffSummary?: string;
}

export interface SaveDietEvent {
  eventId: string;
  turn: number;
  timestamp: string;
  eventType: 'AUTO_DIET_TRIGGERED' | 'SESSION_SAVED' | 'SESSION_RESTORED' | 'CLOUD_SYNCED';
  version: string;
  details: string;
  messageCountBefore?: number;
  messageCountAfter?: number;
}

export interface EngineState {
  historicalRecords: HistoricalRecord[];
  pendingCandidates: CandidatePacket[];
  validationLogs: ValidationDiagnosticLog[];
  latencyHistory: TurnLatencyMetrics[];
  turnTraces?: TurnTrace[];
  checkpoints?: CheckpointSnapshot[];
  saveDietEvents?: SaveDietEvent[];
  diagnostics?: import('./engine/types').EngineDiagnostics;
  lastContextSnapshot?: string;
  lastRawResponse?: string;
}

export interface ParsedMetadata {
  rawBlockText: string;
  searchAndVerificationReport: string;
  activeSeeds: string[];
  cameraOffAffairs: string;
  chapterInfo: string;
  statsAndInventory: string;
  dcStats: string;
  adherenceDeclaration: string;
  parsedAtTurn?: number;
}

export interface SessionPayload {
  gameState?: GameState;
  worldInfo: WorldInfo;
  character: Character;
  messages: (StoryMessage | Message)[];
  language?: Language;
  selectedModel?: GeminiModelType;
  storyTurnCount?: number;
  createdAt?: string;
  updatedAt: string;
  engineState?: EngineState;
  canonicalSnapshot?: any;
  engineHistory?: any[];
  genesisSnapshot?: any;
}
