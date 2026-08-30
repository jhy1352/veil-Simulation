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

  private executedRequestIds: Set<string> = new Set();
  private recordedEventIds: Set<string> = new Set();
  private historyManager: HistoryManager;

  constructor(
    initialWorld?: WorldInfo,
    initialCharacter?: Character,
    initialHistory?: ImmutableHistoricalRecord[],
    initialStateVersion: number = 1,
    initialTurn: number = 1
  ) {
    this.worldInfo = initialWorld ? deepClone(initialWorld) : createEmptyWorldInfo();
    this.character = initialCharacter ? deepClone(initialCharacter) : createEmptyCharacter();
    this.stateVersion = initialStateVersion;
    this.turn = initialTurn;
    this.lastCommittedAt = new Date().toISOString();
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
   * Hydrates an engine instance from persisted snapshot and history.
   * Validates snapshot schema prior to instantiation.
   */
  public static hydrate(
    snapshot: CanonicalState,
    history?: readonly ImmutableHistoricalRecord[],
    executedRequestIds?: string[],
    recordedEventIds?: string[]
  ): SovereignEngine {
    const schemaCheck = EngineValidator.validateSnapshotSchema(snapshot);
    if (!schemaCheck.isValid) {
      throw new Error(`[HYDRATION_SCHEMA_VIOLATION] Cannot hydrate invalid canonical snapshot: ${schemaCheck.errors.join('; ')}`);
    }

    if (history && history.length > 0) {
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
      snapshot.turn
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
          stateVersionAfterCommit: targetStateVersion,
          informationAccess: infoAccess,
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
