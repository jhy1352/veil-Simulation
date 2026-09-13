import { ImmutableHistoricalRecord, ProposalSource, ActionType } from './types';

function provesNpcProvenance(record: ImmutableHistoricalRecord, sourceNpcId: string): boolean {
  const payload = (record.canonicalAction as any)?.payload;
  if (!payload) return false;

  const actType = record.actionType;
  if (actType === 'ADD_NPC' || actType === 'UPDATE_NPC' || actType === 'SET_NPC_STATUS') {
    return payload.id === sourceNpcId;
  }
  if (actType === 'RECORD_OFFSCREEN_EVENT') {
    if (Array.isArray(payload.involvedNpcIds) && payload.involvedNpcIds.includes(sourceNpcId)) {
      return true;
    }
    if (payload.information) {
      const infoList = Array.isArray(payload.information) ? payload.information : [payload.information];
      if (infoList.some((t: any) => t?.sourceNpcId === sourceNpcId || t?.recipientNpcId === sourceNpcId)) {
        return true;
      }
    }
  }
  if (payload.information) {
    const infoList = Array.isArray(payload.information) ? payload.information : [payload.information];
    if (infoList.some((t: any) => t?.sourceNpcId === sourceNpcId || t?.recipientNpcId === sourceNpcId)) {
      return true;
    }
  }
  return false;
}

/**
 * TRPG 3.1 History Manager
 * Manages an append-only, immutable registry of historical events.
 */
export class HistoryManager {
  private records: ImmutableHistoricalRecord[] = [];
  private eventIndex: Map<string, ImmutableHistoricalRecord[]> = new Map();
  private turnIndex: Map<number, ImmutableHistoricalRecord[]> = new Map();

  constructor(initialRecords: ImmutableHistoricalRecord[] = []) {
    for (const record of initialRecords) {
      this.append(record);
    }
  }

  /**
   * Resolves a uniquely provable causal parent for inventory acquisition.
   * Event IDs may map to multiple records, so an event ID alone is never copied
   * into causalParentRecordId. When sourceNpcId is present it must identify
   * exactly one record in the verified event; otherwise the parent remains unset.
   */
  private resolveCausalParent(record: ImmutableHistoricalRecord): string | undefined {
    if (record.actionType !== 'MODIFY_INVENTORY') return undefined;

    const action = record.canonicalAction as any;
    const acquisition = action?.payload?.acquisition;
    const verifiedEventId = typeof acquisition?.verifiedEventId === 'string'
      ? acquisition.verifiedEventId.trim()
      : '';
    if (!verifiedEventId) return undefined;

    const candidates = this.records.filter(existing => existing.eventId === verifiedEventId);
    if (candidates.length === 0) return undefined;

    const sourceNpcId = typeof acquisition?.sourceNpcId === 'string'
      ? acquisition.sourceNpcId.trim()
      : '';

    const matched = sourceNpcId
      ? candidates.filter(existing => provesNpcProvenance(existing, sourceNpcId))
      : candidates;

    return matched.length === 1 ? matched[0].recordId : undefined;
  }

  /**
   * Validates an explicitly supplied causal parent before appending a record.
   * Parent records must already exist, belong to the verified event, and cannot
   * point at the record being appended.
   */
  private validateCausalParent(record: ImmutableHistoricalRecord): void {
    const parentId = record.causalParentRecordId;
    if (!parentId) return;

    if (parentId === record.recordId) {
      throw new Error(`[HISTORY_PROVENANCE_VIOLATION] Record '${record.recordId}' cannot be its own causal parent.`);
    }

    const parent = this.records.find(existing => existing.recordId === parentId);
    if (!parent) {
      throw new Error(`[HISTORY_PROVENANCE_VIOLATION] Causal parent record '${parentId}' does not exist before '${record.recordId}'.`);
    }

    const acquisition = (record.canonicalAction as any)?.payload?.acquisition;
    const verifiedEventId = typeof acquisition?.verifiedEventId === 'string'
      ? acquisition.verifiedEventId.trim()
      : '';
    if (!verifiedEventId || parent.eventId !== verifiedEventId) {
      throw new Error(`[HISTORY_PROVENANCE_VIOLATION] Causal parent '${parentId}' does not match verifiedEventId for '${record.recordId}'.`);
    }

    const sourceNpcId = typeof acquisition?.sourceNpcId === 'string'
      ? acquisition.sourceNpcId.trim()
      : '';
    if (sourceNpcId) {
      if (!provesNpcProvenance(parent, sourceNpcId)) {
        throw new Error(`[HISTORY_PROVENANCE_VIOLATION] Causal parent '${parentId}' (${parent.actionType}) does not prove NPC provenance for sourceNpcId '${sourceNpcId}'.`);
      }
    }
  }

  /**
   * Appends an immutable historical record.
   */
  public append(record: ImmutableHistoricalRecord): void {
    this.validateCausalParent(record);

    const inferredParentId = this.resolveCausalParent(record);
    const normalizedRecord = record.causalParentRecordId || !inferredParentId
      ? record
      : { ...record, causalParentRecordId: inferredParentId };
    const frozenRecord = Object.freeze(normalizedRecord);
    this.records.push(frozenRecord);

    // Update event index
    const byEvent = this.eventIndex.get(record.eventId) || [];
    byEvent.push(frozenRecord);
    this.eventIndex.set(record.eventId, byEvent);

    // Update turn index
    const byTurn = this.turnIndex.get(record.turn) || [];
    byTurn.push(frozenRecord);
    this.turnIndex.set(record.turn, byTurn);
  }

  /**
   * Retrieves all historical records (as readonly array).
   */
  public getAllRecords(): readonly ImmutableHistoricalRecord[] {
    return Object.freeze([...this.records]);
  }

  /**
   * Retrieves records associated with a specific event ID.
   */
  public getRecordsByEventId(eventId: string): readonly ImmutableHistoricalRecord[] {
    return Object.freeze([...(this.eventIndex.get(eventId) || [])]);
  }

  /**
   * Retrieves records associated with a specific turn.
   */
  public getRecordsByTurn(turn: number): readonly ImmutableHistoricalRecord[] {
    return Object.freeze([...(this.turnIndex.get(turn) || [])]);
  }

  /**
   * Count of all historical records.
   */
  public get count(): number {
    return this.records.length;
  }
}