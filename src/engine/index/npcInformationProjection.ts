import type { ImmutableHistoricalRecord } from '../types';
import type { NpcInformationState, InformationAcquisitionMethod, NpcInformationTrace } from './npcInformationTypes';

export type { NpcInformationState, InformationAcquisitionMethod, NpcInformationTrace };

export interface NpcInformationEvidence {
  readonly factId: string;
  readonly elementId: string;
  readonly state: NpcInformationState;
  readonly recipientNpcId: string;
  readonly sourceNpcId?: string;
  readonly acquisition: InformationAcquisitionMethod;
  readonly understoodText?: string;
  readonly recordId: string;
  readonly eventId: string;
  readonly turn: number;
}

export interface NpcInformationProjection {
  readonly npcId: string;
  readonly evidence: readonly NpcInformationEvidence[];
}

function isInformationTrace(value: unknown): value is NpcInformationTrace {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.factId === 'string' &&
    candidate.factId.trim().length > 0 &&
    Array.isArray(candidate.elementIds) &&
    candidate.elementIds.every(id => typeof id === 'string' && id.trim().length > 0) &&
    typeof candidate.recipientNpcId === 'string' &&
    candidate.recipientNpcId.trim().length > 0 &&
    typeof candidate.acquisition === 'string' &&
    ['OBSERVATION', 'INVESTIGATION', 'TESTIMONY', 'RECORD', 'TRANSFER', 'RELATIONSHIP', 'ABILITY'].includes(candidate.acquisition) &&
    (candidate.state === undefined || candidate.state === 'MATCH' || candidate.state === 'DISTORTED') &&
    (candidate.sourceNpcId === undefined || typeof candidate.sourceNpcId === 'string') &&
    (candidate.understoodText === undefined || typeof candidate.understoodText === 'string')
  );
}

function readInformationTraces(record: ImmutableHistoricalRecord): readonly NpcInformationTrace[] {
  const payload = record.canonicalAction?.payload as unknown;
  if (!payload || typeof payload !== 'object') return [];

  const raw = (payload as Record<string, unknown>).information;
  if (Array.isArray(raw)) {
    return raw.filter(isInformationTrace);
  }
  return isInformationTrace(raw) ? [raw] : [];
}

/**
 * Rebuilds the current NPC information projection exclusively from immutable
 * history. Later evidence for the same fact element supersedes earlier
 * projection state, while the underlying records remain untouched.
 */
export function projectNpcInformationFromHistory(
  history: readonly ImmutableHistoricalRecord[]
): ReadonlyMap<string, NpcInformationProjection> {
  const byNpc = new Map<string, Map<string, NpcInformationEvidence>>();

  for (const record of history) {
    for (const trace of readInformationTraces(record)) {
      const recipientNpcId = trace.recipientNpcId.trim();
      if (!recipientNpcId) continue;

      let npcEvidence = byNpc.get(recipientNpcId);
      if (!npcEvidence) {
        npcEvidence = new Map<string, NpcInformationEvidence>();
        byNpc.set(recipientNpcId, npcEvidence);
      }

      const state = trace.state || 'MATCH';
      for (const rawElementId of trace.elementIds) {
        const elementId = rawElementId.trim();
        if (!elementId) continue;
        const key = `${trace.factId.trim()}:${elementId}`;
        npcEvidence.set(key, {
          factId: trace.factId.trim(),
          elementId,
          state,
          recipientNpcId,
          sourceNpcId: trace.sourceNpcId?.trim() || undefined,
          acquisition: trace.acquisition,
          understoodText: trace.understoodText,
          recordId: record.recordId,
          eventId: record.eventId,
          turn: record.turn,
        });
      }
    }
  }

  const result = new Map<string, NpcInformationProjection>();
  for (const [npcId, evidenceMap] of byNpc) {
    result.set(npcId, Object.freeze({
      npcId,
      evidence: Object.freeze([...evidenceMap.values()]),
    }));
  }

  return result;
}

/**
 * Returns only the evidence relevant to one NPC. This is a projection helper,
 * not a Retriever perspective filter and not a Canonical Truth boundary.
 */
export function getNpcInformationProjection(
  history: readonly ImmutableHistoricalRecord[],
  npcId: string
): NpcInformationProjection {
  const normalizedId = npcId.trim();
  const projection = projectNpcInformationFromHistory(history).get(normalizedId);
  return projection || Object.freeze({ npcId: normalizedId, evidence: Object.freeze([]) });
}
