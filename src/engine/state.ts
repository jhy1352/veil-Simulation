import {
  CanonicalState,
  StateTransitionProposal,
  CommitResult,
  ImmutableHistoricalRecord,
  EngineDiagnostics
} from './types';
import { EngineValidator } from './validator';
import { HistoryManager } from './history';
import { WorldInfo, Character } from '../types';
import { createEmptyCharacter, createEmptyWorldInfo } from '../utils/factory';
import { deepClone, applyActionToDraftState } from './actionApplier';
import { canonicalizeValue } from './language/canonicalizer';

/**
 * Deterministically computes the canonical state hash for state provenance.
 */
export function computeCanonicalStateHash(state: CanonicalState): string {
  const canonical = canonicalizeValue(state);
  const json = JSON.stringify(canonical);
  let h1 = 0x811c9dc5;
  let h2 = 0x84222325;
  for (let i = 0; i < json.length; i++) {
    const ch = json.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch;
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `csh_${hex1}${hex2}`;
}

/**
 * Deep freezes an object and all nested properties to guarantee absolute immutability.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const prop = (obj as any)[key];
    if (prop !== null && typeof prop === 'object' && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  }
  return obj as Readonly<T>;
}

/**
 * TRPG 3.1 Sovereign Engine
 * Encapsulates the single sovereign Canonical State and Commit Gate.
 */
export class SovereignEngine {
  private stateVersion: number = 1;
  private turn: number = 1;
  private worldInfo: WorldInfo;
  private character: Character;
  private lastCommittedEventId: string | null = null;
  private lastCommittedAt: string;
  private genesisSnapshot: CanonicalState;

  private executedRequestIds: Set<string> = new Set();
  private recordedEventIds: Set<string> = new Set();
  private historyManager: HistoryManager;

  constructor(
    initialWorld?: WorldInfo,
    initialCharacter?: Character,
    initialHistory?: ImmutableHistoricalRecord[],
    initialStateVersion: number = 1,
    initialTurn: number = 1,
    genesisSnapshot?: CanonicalState
  ) {
    this.worldInfo = initialWorld ? deepClone(initialWorld) : createEmptyWorldInfo();
    this.character = initialCharacter ? deepClone(initialCharacter) : createEmptyCharacter();
    this.stateVersion = initialStateVersion;
    this.turn = initialTurn;
    this.lastCommittedAt = new Date().toISOString();
    this.genesisSnapshot = genesisSnapshot
      ? deepFreeze(deepClone(genesisSnapshot))
      : deepFreeze({
          stateVersion: this.stateVersion,
          turn: this.turn,
          worldInfo: deepClone(this.worldInfo),
          character: deepClone(this.character),
          lastCommittedEventId: this.lastCommittedEventId,
          lastCommittedAt: this.lastCommittedAt
        });
    this.historyManager = new HistoryManager(initialHistory || []);
    if (initialHistory) {
      for (const rec of initialHistory) {
        if (rec.eventId) this.recordedEventIds.add(rec.eventId);
        if (rec.requestId) this.executedRequestIds.add(rec.requestId);
        if (rec.proposalId && rec.proposalId.startsWith('prop-')) {
          this.executedRequestIds.add(rec.proposalId.slice(5));
        }
      }
    }
  }

  /**
   * Retrieves the initial Genesis snapshot of this engine instance.
   */
  public getGenesisSnapshot(): CanonicalState {
    return this.genesisSnapshot;
  }

  /**
   * Hydrates an engine instance from persisted snapshot and history.
   * Validates snapshot schema and deterministic historical provenance prior to instantiation.
   */
  public static hydrate(
    snapshot: CanonicalState,
    history?: readonly ImmutableHistoricalRecord[],
    executedRequestIds?: string[],
    recordedEventIds?: string[],
    genesisState?: CanonicalState
  ): SovereignEngine {
    const schemaCheck = EngineValidator.validateSnapshotSchema(snapshot);
    if (!schemaCheck.isValid) {
      throw new Error(`[HYDRATION_SCHEMA_VIOLATION] Cannot hydrate invalid canonical snapshot: ${schemaCheck.errors.join('; ')}`);
    }

    let verifiedGenesisAnchor: CanonicalState | undefined = undefined;

    if (history && history.length > 0) {
      // Step 1: Basic Temporal and Monotonicity Checks
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];

        const prevTime = new Date(prev.timestamp).getTime();
        const currTime = new Date(curr.timestamp).getTime();

        if (currTime < prevTime) {
          throw new Error(
            `[HYDRATION_INTEGRITY_VIOLATION] History timestamp regression at index ${i}: '${curr.timestamp}' precedes '${prev.timestamp}'.`
          );
        }

        if (curr.turn < prev.turn) {
          throw new Error(
            `[HYDRATION_INTEGRITY_VIOLATION] History turn regression at index ${i}: turn ${curr.turn} precedes turn ${prev.turn}.`
          );
        }

        if (curr.stateVersionAfterCommit < prev.stateVersionAfterCommit) {
          throw new Error(
            `[HYDRATION_INTEGRITY_VIOLATION] History stateVersion regression at index ${i}: version ${curr.stateVersionAfterCommit} precedes version ${prev.stateVersionAfterCommit}.`
          );
        }
      }

      // Step 2: Provenance, previousStateHash & Deterministic Action Replay Validation
      const PROVENANCE_HASH_REGEX = /^csh_[0-9a-f]{16}$/;
      const proposalGroups: {
        proposalId: string;
        eventId: string;
        requestId?: string;
        source: string;
        turn: number;
        timestamp: string;
        stateVersionAfterCommit: number;
        previousStateHash?: string;
        records: ImmutableHistoricalRecord[];
      }[] = [];
      const proposalGroupMap = new Map<string, typeof proposalGroups[0]>();
      const seenVersionHashMap = new Map<number, string>();

      for (let i = 0; i < history.length; i++) {
        const rec = history[i];

        if (rec.previousStateHash !== undefined) {
          if (typeof rec.previousStateHash !== 'string' || !PROVENANCE_HASH_REGEX.test(rec.previousStateHash)) {
            throw new Error(
              `[HYDRATION_PROVENANCE_VIOLATION] Record at index ${i} (${rec.recordId}) contains invalid or malformed previousStateHash: '${rec.previousStateHash}'.`
            );
          }
        }

        let group = proposalGroupMap.get(rec.proposalId);
        if (group) {
          if (rec.previousStateHash !== undefined || group.previousStateHash !== undefined) {
            if (group.previousStateHash !== rec.previousStateHash) {
              throw new Error(
                `[HYDRATION_PROVENANCE_VIOLATION] Conflicting previousStateHash for proposal '${rec.proposalId}' in record '${rec.recordId}'. Expected '${group.previousStateHash}', found '${rec.previousStateHash}'.`
              );
            }
            if (group.stateVersionAfterCommit !== rec.stateVersionAfterCommit) {
              throw new Error(
                `[HYDRATION_PROVENANCE_VIOLATION] Conflicting stateVersionAfterCommit for proposal '${rec.proposalId}' in record '${rec.recordId}'. Expected '${group.stateVersionAfterCommit}', found '${rec.stateVersionAfterCommit}'.`
              );
            }
            if (group.turn !== rec.turn) {
              throw new Error(
                `[HYDRATION_PROVENANCE_VIOLATION] Conflicting turn for proposal '${rec.proposalId}' in record '${rec.recordId}'. Expected '${group.turn}', found '${rec.turn}'.`
              );
            }
            if (group.eventId !== rec.eventId) {
              throw new Error(
                `[HYDRATION_PROVENANCE_VIOLATION] Conflicting eventId for proposal '${rec.proposalId}' in record '${rec.recordId}'. Expected '${group.eventId}', found '${rec.eventId}'.`
              );
            }
          }
          group.records.push(rec);
        } else {
          group = {
            proposalId: rec.proposalId,
            eventId: rec.eventId,
            requestId: rec.requestId,
            source: rec.source,
            turn: rec.turn,
            timestamp: rec.timestamp,
            stateVersionAfterCommit: rec.stateVersionAfterCommit,
            previousStateHash: rec.previousStateHash,
            records: [rec]
          };
          proposalGroupMap.set(rec.proposalId, group);
          proposalGroups.push(group);

          if (rec.previousStateHash !== undefined) {
            const priorHashForVersion = seenVersionHashMap.get(rec.stateVersionAfterCommit);
            if (priorHashForVersion && priorHashForVersion !== rec.previousStateHash) {
              throw new Error(
                `[HYDRATION_PROVENANCE_VIOLATION] State version ${rec.stateVersionAfterCommit} has conflicting previous state hashes.`
              );
            }
            seenVersionHashMap.set(rec.stateVersionAfterCommit, rec.previousStateHash);
          }
        }
      }

      // Check if provenance tracking is active (any record has previousStateHash)
      const hasProvenanceTracking = history.some(r => r.previousStateHash !== undefined);

      if (hasProvenanceTracking) {
        // Deterministic Replay Engine
        const firstGroup = proposalGroups[0];
        let replayWorld: WorldInfo;
        let replayChar: Character;
        let replayVersion: number = 1;
        let replayTurn: number = 1;
        let replayLastEventId: string | null = null;
        let replayLastAt: string = firstGroup.timestamp;

        if (genesisState) {
          const genesisHash = computeCanonicalStateHash(genesisState);
          if (firstGroup.previousStateHash && genesisHash !== firstGroup.previousStateHash) {
            throw new Error(
              `[HYDRATION_PROVENANCE_VIOLATION] Genesis anchor hash mismatch. Expected '${firstGroup.previousStateHash}', got '${genesisHash}'.`
            );
          }
          replayWorld = deepClone(genesisState.worldInfo);
          replayChar = deepClone(genesisState.character);
          replayVersion = genesisState.stateVersion;
          replayTurn = genesisState.turn;
          replayLastEventId = genesisState.lastCommittedEventId;
          replayLastAt = genesisState.lastCommittedAt;
          verifiedGenesisAnchor = deepClone(genesisState);
        } else {
          // Default empty Genesis
          const candidateEmptyGenesis: CanonicalState = {
            stateVersion: 1,
            turn: 1,
            worldInfo: createEmptyWorldInfo(),
            character: createEmptyCharacter(),
            lastCommittedEventId: null,
            lastCommittedAt: firstGroup.timestamp
          };
          const emptyHash = computeCanonicalStateHash(candidateEmptyGenesis);
          if (firstGroup.previousStateHash && emptyHash === firstGroup.previousStateHash) {
            replayWorld = deepClone(candidateEmptyGenesis.worldInfo);
            replayChar = deepClone(candidateEmptyGenesis.character);
            replayVersion = 1;
            replayTurn = 1;
            replayLastEventId = null;
            replayLastAt = candidateEmptyGenesis.lastCommittedAt;
            verifiedGenesisAnchor = deepClone(candidateEmptyGenesis);
          } else {
            // If previousStateHash is defined but genesis anchor is not provided and doesn't match empty genesis
            throw new Error(
              `[HYDRATION_PROVENANCE_VIOLATION] Missing or unanchored Genesis state for historical replay verification.`
            );
          }
        }

        // Replay each proposal group sequentially
        for (let gIdx = 0; gIdx < proposalGroups.length; gIdx++) {
          const group = proposalGroups[gIdx];

          const currentReplayState: CanonicalState = {
            stateVersion: replayVersion,
            turn: replayTurn,
            worldInfo: deepClone(replayWorld),
            character: deepClone(replayChar),
            lastCommittedEventId: replayLastEventId,
            lastCommittedAt: replayLastAt
          };
          const currentReplayHash = computeCanonicalStateHash(currentReplayState);

          if (group.previousStateHash && currentReplayHash !== group.previousStateHash) {
            throw new Error(
              `[HYDRATION_PROVENANCE_VIOLATION] Replay state hash mismatch before proposal '${group.proposalId}' (index ${gIdx}). Expected previousStateHash '${group.previousStateHash}', computed '${currentReplayHash}'. History chain broken.`
            );
          }

          for (const rec of group.records) {
            if (!rec.canonicalAction) {
              throw new Error(
                `[HYDRATION_PROVENANCE_VIOLATION] Historical record '${rec.recordId}' in proposal '${group.proposalId}' is missing canonicalAction payload for deterministic replay.`
              );
            }
            try {
              applyActionToDraftState(rec.canonicalAction, replayWorld, replayChar);
            } catch (err: any) {
              throw new Error(
                `[HYDRATION_PROVENANCE_VIOLATION] Failed to replay canonical action '${rec.actionType}' in record '${rec.recordId}': ${err?.message || String(err)}`
              );
            }
          }

          replayVersion = group.stateVersionAfterCommit;
          replayTurn = group.turn;
          replayLastEventId = group.eventId;
          replayLastAt = group.timestamp;
        }

        // Validate final replayed state matches snapshot exactly
        const finalReplayState: CanonicalState = {
          stateVersion: replayVersion,
          turn: replayTurn,
          worldInfo: deepClone(replayWorld),
          character: deepClone(replayChar),
          lastCommittedEventId: replayLastEventId,
          lastCommittedAt: replayLastAt
        };
        const finalReplayHash = computeCanonicalStateHash(finalReplayState);
        const snapshotHash = computeCanonicalStateHash(snapshot);

        if (finalReplayHash !== snapshotHash) {
          throw new Error(
            `[HYDRATION_PROVENANCE_VIOLATION] Final replayed state hash (${finalReplayHash}) does not match snapshot hash (${snapshotHash}). Snapshot or historical records have been tampered.`
          );
        }
      }

      const lastRecord = history[history.length - 1];

      if (snapshot.stateVersion < lastRecord.stateVersionAfterCommit) {
        throw new Error(
          `[HYDRATION_INTEGRITY_VIOLATION] Snapshot stateVersion (${snapshot.stateVersion}) precedes last history version (${lastRecord.stateVersionAfterCommit}).`
        );
      }

      if (snapshot.turn < lastRecord.turn) {
        throw new Error(
          `[HYDRATION_INTEGRITY_VIOLATION] Snapshot turn (${snapshot.turn}) precedes last history turn (${lastRecord.turn}).`
        );
      }

      if (snapshot.lastCommittedEventId !== null && snapshot.lastCommittedEventId !== undefined) {
        if (snapshot.lastCommittedEventId !== lastRecord.eventId) {
          throw new Error(
            `[HYDRATION_INTEGRITY_VIOLATION] Snapshot lastCommittedEventId '${snapshot.lastCommittedEventId}' does not match last history eventId '${lastRecord.eventId}'.`
          );
        }
      }
    }

    const engine = new SovereignEngine(
      snapshot.worldInfo,
      snapshot.character,
      history ? (history as ImmutableHistoricalRecord[]) : [],
      snapshot.stateVersion,
      snapshot.turn,
      verifiedGenesisAnchor || (genesisState ? deepClone(genesisState) : undefined)
    );
    engine.lastCommittedEventId = snapshot.lastCommittedEventId;
    engine.lastCommittedAt = snapshot.lastCommittedAt;
    if (snapshot.lastCommittedEventId) {
      engine.recordedEventIds.add(snapshot.lastCommittedEventId);
    }
    if (history) {
      for (const rec of history) {
        if (rec.eventId) engine.recordedEventIds.add(rec.eventId);
        if (rec.requestId) engine.executedRequestIds.add(rec.requestId);
        if (rec.proposalId && rec.proposalId.startsWith('prop-')) {
          engine.executedRequestIds.add(rec.proposalId.slice(5));
        }
      }
    }
    if (executedRequestIds) {
      for (const reqId of executedRequestIds) engine.executedRequestIds.add(reqId);
    }
    if (recordedEventIds) {
      for (const evId of recordedEventIds) engine.recordedEventIds.add(evId);
    }
    return engine;
  }

  /**
   * Pure schema validation helper for canonical snapshots.
   */
  public static validateSnapshot(snapshot: any): { isValid: boolean; errors: string[] } {
    return EngineValidator.validateSnapshotSchema(snapshot);
  }

  /**
   * Retrieves a deeply frozen immutable snapshot of the current sovereign state.
   */
  public getSnapshot(): CanonicalState {
    const state: CanonicalState = {
      stateVersion: this.stateVersion,
      turn: this.turn,
      worldInfo: deepClone(this.worldInfo),
      character: deepClone(this.character),
      lastCommittedEventId: this.lastCommittedEventId,
      lastCommittedAt: this.lastCommittedAt
    };
    return deepFreeze(state);
  }

  /**
   * Retrieves runtime diagnostics for engine sovereign state.
   */
  public getDiagnostics(): EngineDiagnostics {
    return {
      stateVersion: this.stateVersion,
      totalExecutedRequests: this.executedRequestIds.size,
      totalRecordedEvents: this.recordedEventIds.size,
      totalHistoricalRecords: this.historyManager.count,
      lastEventId: this.lastCommittedEventId
    };
  }

  /**
   * Retrieves all immutable historical records.
   */
  public getHistory(): readonly ImmutableHistoricalRecord[] {
    return this.historyManager.getAllRecords();
  }

  /**
   * The Single Sovereign Entryway for State Mutation.
   * Processes a StateTransitionProposal through the Canonical Commit Gate.
   */
  public submitProposal(proposal: StateTransitionProposal): CommitResult {
    const currentSnapshot = this.getSnapshot();

    // Step 1: Pre-Commit Validation & Idempotency Check
    const verdict = EngineValidator.validate(
      proposal,
      currentSnapshot,
      this.executedRequestIds,
      this.recordedEventIds,
      this.getHistory()
    );

    if (!verdict.isValid) {
      return Object.freeze({
        success: false,
        stateVersion: this.stateVersion,
        eventId: proposal.eventId,
        committedActionsCount: 0,
        rejectedReasons: verdict.rejectedReasons,
        conflictDetails: verdict.conflictDetails,
        newHistoricalRecords: Object.freeze([]),
        snapshot: currentSnapshot
      });
    }

    // Step 2: Atomic Execution Draft (Dry run on isolated working copy)
    const draftWorldInfo: WorldInfo = deepClone(this.worldInfo);
    const draftCharacter: Character = deepClone(this.character);
    const newRecords: ImmutableHistoricalRecord[] = [];
    const targetStateVersion = this.stateVersion + 1;
    const previousStateHash = computeCanonicalStateHash(currentSnapshot);

    try {
      for (const action of verdict.sanitizedActions) {
        applyActionToDraftState(action, draftWorldInfo, draftCharacter);

        // Extract visibility or narrativeTime if specified in payload
        let infoAccess: 'PUBLIC' | 'FACTION_ONLY' | 'PRIVATE' | 'HIDDEN' | 'RUMOR' = 'PUBLIC';
        let actionNarrativeTime = draftWorldInfo.currentTime ? deepClone(draftWorldInfo.currentTime) : undefined;

        if (action.type === 'RECORD_OFFSCREEN_EVENT') {
          if (action.payload.visibility) infoAccess = action.payload.visibility;
          if (action.payload.narrativeTime) actionNarrativeTime = deepClone(action.payload.narrativeTime);
        } else if (action.type === 'ADD_RUMOR') {
          infoAccess = 'RUMOR';
        }

        // Generate Immutable Historical Record
        const payloadStr = JSON.stringify(action.payload);
        const recordDetails = action.description ? `[${action.description}] ${payloadStr}` : payloadStr;

        const record: ImmutableHistoricalRecord = {
          recordId: `rec-${proposal.eventId}-${newRecords.length + 1}`,
          eventId: proposal.eventId,
          requestId: proposal.requestId,
          proposalId: proposal.proposalId,
          turn: proposal.turn,
          timestamp: proposal.timestamp,
          narrativeTime: actionNarrativeTime,
          source: proposal.source,
          actionType: action.type,
          details: recordDetails,
          canonicalAction: deepClone(action),
          stateVersionAfterCommit: targetStateVersion,
          informationAccess: infoAccess,
          previousStateHash: previousStateHash,
          originInputId: proposal.originInputId,
          category: action.category
        };
        newRecords.push(record);
      }
    } catch (err: any) {
      // Step 3: Atomic Rollback on unexpected failure
      return Object.freeze({
        success: false,
        stateVersion: this.stateVersion,
        eventId: proposal.eventId,
        committedActionsCount: 0,
        rejectedReasons: Object.freeze([`[ATOMIC_EXECUTION_FAILURE] ${err?.message || String(err)}`]),
        conflictDetails: Object.freeze([]),
        newHistoricalRecords: Object.freeze([]),
        snapshot: currentSnapshot
      });
    }

    // Step 4: Canonical Commit Gate (Atomic state swap)
    this.worldInfo = draftWorldInfo;
    this.character = draftCharacter;
    this.stateVersion = targetStateVersion;
    this.turn = proposal.turn;
    this.lastCommittedEventId = proposal.eventId;
    this.lastCommittedAt = proposal.timestamp;

    // Register idempotency signatures
    this.executedRequestIds.add(proposal.requestId);
    this.recordedEventIds.add(proposal.eventId);

    // Commit history
    for (const record of newRecords) {
      this.historyManager.append(record);
    }

    const nextSnapshot = this.getSnapshot();

    return Object.freeze({
      success: true,
      stateVersion: this.stateVersion,
      eventId: proposal.eventId,
      committedActionsCount: verdict.sanitizedActions.length,
      rejectedReasons: Object.freeze([]),
      conflictDetails: Object.freeze([]),
      newHistoricalRecords: Object.freeze(newRecords),
      snapshot: nextSnapshot
    });
  }
}
