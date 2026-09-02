import { Character, WorldInfo, NpcRecord, FactionRecord, NarrativeSeed, ChapterInfo, InventoryItem, CharacterStats, NarrativeTime, OffscreenEventRecord, ActionIntentCategory } from '../types';
import type { MeaningNode } from './language/types';

export type { ActionIntentCategory } from '../types';

declare module './proposalParser' {
  interface SafeProposalEnvelope {
    originInputId?: string;
  }
}

/**
 * TRPG 3.1 Sovereign Engine Types
 * Pure, authoritative types enforcing Single Sovereign Engine Authority.
 */

export type ProposalSource =
  | 'PLAYER'
  | 'LLM'
  | 'GENESIS'
  | 'SAVE_HYDRATION'
  | 'CLOUD_RESTORE'
  | 'ENGINE_INTERNAL'
  | 'SYSTEM';

export type ClaimVerificationStatus =
  | 'CLAIMED'
  | 'PENDING'
  | 'VERIFIED'
  | 'CANONICAL'
  | 'REJECTED'
  | 'CONFLICT';

export interface ExternalEvidence {
  readonly evidenceId: string;
  readonly entityId?: string;
  readonly entityType?: 'NPC' | 'FACTION' | 'LOCATION' | 'WORLD' | 'CHARACTER' | 'ITEM';
  readonly attribute?: string;
  readonly value?: unknown;
  readonly eventId?: string;
  readonly turn?: number;
  readonly timestamp?: string;
  readonly source?: string;
  readonly sourceType?: 'NARRATIVE' | 'INSPECTION' | 'PERCEPTION' | 'HISTORICAL' | 'SYSTEM' | 'EXTERNAL';
  readonly content?: string;
  readonly contentSnippet?: string;
  readonly targetEntityId?: string;
  readonly observedAttribute?: string;
  readonly observedValue?: unknown;
}

export interface UntrustedClaim {
  readonly rawText?: string;
  readonly targetEntityId?: string;
  readonly targetAttribute?: string;
  readonly claimedValue?: unknown;
  readonly claimedEvidenceIds?: readonly string[];
}

export interface VerifiedClaim {
  readonly claimId: string;
  readonly status: 'VERIFIED' | 'CONFLICT' | 'REJECTED';
  readonly targetEntityId: string;
  readonly targetAttribute: string;
  readonly verifiedValue: unknown;
  readonly evidenceIds: readonly string[];
  readonly verifiedAtTurn: number;
  readonly verifiedAtStateVersion: number;
  readonly verifiedAtTimestamp: string;
  readonly provenance: {
    readonly source: string;
    readonly verifiedEventId?: string;
    readonly evidenceCount: number;
    readonly originalEvidenceHashes?: readonly string[];
  };
}

export interface ImmigrationVerdict {
  readonly admitted: boolean;
  readonly status: ClaimVerificationStatus;
  readonly verifiedClaim?: VerifiedClaim;
  readonly rejectionReason?: string;
  readonly conflictDetails?: readonly string[];
}

export type AcquisitionCause =
  | 'RESOURCE_EXCHANGE'
  | 'DISCOVERY_PICKUP'
  | 'GIFT_REWARD'
  | 'LOOT'
  | 'GENESIS_STARTER'
  | 'SYSTEM_INITIALIZATION'
  | 'REWARD'
  | 'GIFT';

export interface AcquisitionCost {
  readonly id?: string;
  readonly name?: string;
  readonly quantity: number;
}

export interface AcquisitionEventPayload {
  readonly cause: AcquisitionCause;
  readonly cost?: AcquisitionCost;
  readonly verifiedEventId?: string;
  readonly sourceNpcId?: string;
}

export type ActionType =
  | 'SET_WORLD_METADATA'
  | 'ADVANCE_TIME'
  | 'ADD_RUMOR'
  | 'ADD_NPC'
  | 'UPDATE_NPC'
  | 'SET_NPC_STATUS'
  | 'ADD_FACTION'
  | 'UPDATE_FACTION'
  | 'ADD_NARRATIVE_SEED'
  | 'RESOLVE_NARRATIVE_SEED'
  | 'ADVANCE_CHAPTER'
  | 'RECORD_OFFSCREEN_EVENT'
  | 'UPDATE_CHARACTER_STATS'
  | 'MODIFY_INVENTORY'
  | 'SET_CHARACTER_SECRET'
  | 'RECORD_PHYSICAL_DEFECT'
  | 'RECORD_DICE_RESULT'
  | 'OVERWRITE_WORLD_INFO'
  | 'OVERWRITE_CHARACTER';

export interface ActionPayloadMap {
  SET_WORLD_METADATA: { worldName?: string; settingDescription?: string; toneStyle?: string };
  ADVANCE_TIME: { targetTime?: NarrativeTime; reason?: string; year?: number; season?: string; month?: number; day?: number; timeOfDay?: string };
  ADD_RUMOR: { rumor: string; sourceContext?: string };
  ADD_NPC: NpcRecord;
  UPDATE_NPC: { id: string; changes: Partial<NpcRecord> };
  SET_NPC_STATUS: { id: string; status: 'ALIVE' | 'DEAD' | 'MISSING' | 'UNMET' | 'MET'; reason?: string };
  ADD_FACTION: FactionRecord;
  UPDATE_FACTION: { id: string; changes: Partial<FactionRecord> };
  ADD_NARRATIVE_SEED: NarrativeSeed;
  RESOLVE_NARRATIVE_SEED: { id: string; resolutionSummary: string };
  ADVANCE_CHAPTER: { currentChapter: string; upcomingChapters?: string[] };
  RECORD_OFFSCREEN_EVENT: {
    id?: string;
    eventDescription: string;
    location?: string;
    factionId?: string;
    involvedNpcIds?: string[];
    narrativeTime?: NarrativeTime;
    timestamp?: string;
    visibility?: 'PUBLIC' | 'FACTION_ONLY' | 'PRIVATE' | 'HIDDEN' | 'RUMOR';
  };
  UPDATE_CHARACTER_STATS: Partial<CharacterStats> & {
    verifiedEventId?: string;
    grounding?: string;
    cause?: string;
    claimId?: string;
  };
  MODIFY_INVENTORY: {
    item: InventoryItem;
    operation: 'ADD' | 'REMOVE' | 'SET_QUANTITY';
    acquisition?: {
      cause?: AcquisitionCause;
      cost?: {
        id?: string;
        name?: string;
        quantity: number;
      };
      verifiedEventId?: string;
      sourceNpcId?: string;
    };
  };
  SET_CHARACTER_SECRET: { secret: string };
  RECORD_PHYSICAL_DEFECT: { defect: string };
  RECORD_DICE_RESULT: { actionContext: string; targetDC: number; rollValue?: number; resultStatus?: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_FAILURE' };
  OVERWRITE_WORLD_INFO: WorldInfo;
  OVERWRITE_CHARACTER: Character;
}

export type TransitionAction = {
  [K in ActionType]: {
    type: K;
    payload: ActionPayloadMap[K];
    description?: string;
    category?: ActionIntentCategory;
  };
}[ActionType];

export interface StateTransitionProposal {
  proposalId: string;
  requestId: string;
  eventId: string;
  expectedStateVersion: number;
  source: ProposalSource;
  turn: number;
  timestamp: string;
  intentSummary?: string;
  actions: TransitionAction[];
  rawClaims?: string[];
  verifiedClaims?: readonly VerifiedClaim[];
  originInputId?: string;
  meaningTree?: MeaningNode;
}

export interface ImmutableHistoricalRecord {
  readonly recordId: string;
  readonly eventId: string;
  readonly requestId?: string;
  readonly proposalId: string;
  readonly turn: number;
  readonly timestamp: string;
  readonly narrativeTime?: NarrativeTime;
  readonly source: ProposalSource;
  readonly actionType: ActionType;
  readonly details: string;
  readonly canonicalAction?: TransitionAction;
  readonly stateVersionAfterCommit: number;
  readonly informationAccess?: 'PUBLIC' | 'FACTION_ONLY' | 'PRIVATE' | 'HIDDEN' | 'RUMOR';
  readonly previousStateHash?: string;
  readonly causalParentRecordId?: string;
  readonly originInputId?: string;
  readonly category?: ActionIntentCategory;
}

export interface ValidationVerdict {
  readonly isValid: boolean;
  readonly rejectedReasons: readonly string[];
  readonly conflictDetails: readonly string[];
  readonly sanitizedActions: readonly TransitionAction[];
}

export interface CanonicalState {
  readonly stateVersion: number;
  readonly turn: number;
  readonly worldInfo: WorldInfo;
  readonly character: Character;
  readonly lastCommittedEventId: string | null;
  readonly lastCommittedAt: string;
}

export interface CommitResult {
  readonly success: boolean;
  readonly stateVersion: number;
  readonly eventId: string;
  readonly committedActionsCount: number;
  readonly rejectedReasons: readonly string[];
  readonly conflictDetails: readonly string[];
  readonly newHistoricalRecords: readonly ImmutableHistoricalRecord[];
  readonly snapshot: CanonicalState;
}

export interface EngineDiagnostics {
  readonly stateVersion: number;
  readonly totalExecutedRequests: number;
  readonly totalRecordedEvents: number;
  readonly totalHistoricalRecords: number;
  readonly lastEventId: string | null;
}
