import type { CanonicalState, ImmutableHistoricalRecord } from '../types';
import type { NpcInformationTrace } from './npcInformationTypes';
import { getNpcInformationProjection } from './npcInformationProjection';

type CandidateInformationTrace = {
  factId: string;
  elementIds: readonly string[];
  recipientNpcId: string;
  sourceNpcId?: string;
  acquisition: NpcInformationTrace['acquisition'];
  state?: NpcInformationTrace['state'];
  understoodText?: string;
};

export interface NpcInformationAdmission {
  readonly admitted: readonly NpcInformationTrace[];
  readonly rejected: readonly string[];
}

/**
 * Converts LLM candidate metadata into history-safe information evidence.
 * The gate does not establish Canon facts. It verifies identity/linkage and,
 * for NPC-to-NPC acquisition, requires the source NPC to already possess the
 * transferred elements according to immutable historical evidence.
 */
export function admitNpcInformationCandidate(
  snapshot: CanonicalState,
  candidateNpcId: string,
  information: CandidateInformationTrace | readonly CandidateInformationTrace[],
  history: readonly ImmutableHistoricalRecord[] = []
): NpcInformationAdmission {
  const traces = Array.isArray(information) ? information : [information];
  const npcIds = new Set(snapshot.worldInfo.npcs.map(n => n.id));
  const admitted: NpcInformationTrace[] = [];
  const rejected: string[] = [];

  for (const trace of traces) {
    const factId = trace.factId?.trim();
    const recipientNpcId = trace.recipientNpcId?.trim();
    const sourceNpcId = trace.sourceNpcId?.trim() || undefined;
    const elementIds = [...(trace.elementIds || [])]
      .filter(id => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean);

    if (!factId || elementIds.length === 0) {
      rejected.push('NPC_INFORMATION_INVALID_FACT_OR_ELEMENT');
      continue;
    }
    if (!recipientNpcId || recipientNpcId !== candidateNpcId.trim()) {
      rejected.push('NPC_INFORMATION_RECIPIENT_ID_MISMATCH');
      continue;
    }
    if (!npcIds.has(recipientNpcId)) {
      rejected.push('NPC_INFORMATION_RECIPIENT_NOT_CANONICAL');
      continue;
    }
    if (sourceNpcId && !npcIds.has(sourceNpcId)) {
      rejected.push('NPC_INFORMATION_SOURCE_NOT_CANONICAL');
      continue;
    }
    if (sourceNpcId === recipientNpcId) {
      rejected.push('NPC_INFORMATION_SOURCE_RECIPIENT_SELF_TRANSFER');
      continue;
    }
    if (trace.state === 'DISTORTED' && !trace.understoodText?.trim()) {
      rejected.push('NPC_INFORMATION_DISTORTION_REQUIRES_UNDERSTOOD_TEXT');
      continue;
    }
    if ((trace.acquisition === 'TESTIMONY' || trace.acquisition === 'TRANSFER' || trace.acquisition === 'RELATIONSHIP') && !sourceNpcId) {
      rejected.push('NPC_INFORMATION_SOURCE_REQUIRED_FOR_ACQUISITION');
      continue;
    }

    // A source NPC cannot transfer/testify/relay information that historical
    // evidence shows the source never acquired. This prevents the LLM from
    // inventing a knowledge chain solely by naming arbitrary fact/element IDs.
    if (
      sourceNpcId &&
      (trace.acquisition === 'TESTIMONY' || trace.acquisition === 'TRANSFER' || trace.acquisition === 'RELATIONSHIP')
    ) {
      const sourceProjection = getNpcInformationProjection(history, sourceNpcId);
      const sourceKeys = new Set(
        sourceProjection.evidence.map(e => `${e.factId}:${e.elementId}`)
      );
      const missingSourceElements = elementIds.some(elementId => !sourceKeys.has(`${factId}:${elementId}`));
      if (missingSourceElements) {
        rejected.push('NPC_INFORMATION_SOURCE_LACKS_HISTORICAL_KNOWLEDGE');
        continue;
      }
    }

    admitted.push(Object.freeze({
      factId,
      elementIds: Object.freeze(elementIds),
      recipientNpcId,
      sourceNpcId,
      acquisition: trace.acquisition,
      state: trace.state || 'MATCH',
      understoodText: trace.understoodText?.trim() || undefined,
    }));
  }

  return Object.freeze({
    admitted: Object.freeze(admitted),
    rejected: Object.freeze(rejected),
  });
}
