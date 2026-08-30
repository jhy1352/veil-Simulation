import { ImmutableHistoricalRecord, ProposalSource, ActionType } from './types';

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
   * Appends an immutable historical record.
   */
  public append(record: ImmutableHistoricalRecord): void {
    const frozenRecord = Object.freeze({ ...record });
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
