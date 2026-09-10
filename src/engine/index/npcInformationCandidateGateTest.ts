import assert from 'node:assert/strict';
import type { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { admitNpcInformationCandidate } from './npcInformationCandidateGate';

const snapshot = {
  stateVersion: 1,
  turn: 1,
  worldInfo: {
    npcs: [
      { id: 'npc-a', name: 'A' },
      { id: 'npc-b', name: 'B' },
    ],
  },
  character: {},
  lastCommittedEventId: null,
  lastCommittedAt: '2026-01-01T00:00:00.000Z',
} as unknown as CanonicalState;

const sourceKnowledgeHistory = [{
  recordId: 'rec-knowledge-a',
  eventId: 'evt-knowledge-a',
  proposalId: 'prop-knowledge-a',
  turn: 1,
  timestamp: '2026-01-01T00:00:00.000Z',
  source: 'ENGINE_INTERNAL',
  actionType: 'UPDATE_NPC',
  details: 'A learned F001:E1,E3',
  stateVersionAfterCommit: 1,
  canonicalAction: {
    type: 'UPDATE_NPC',
    payload: {
      id: 'npc-a',
      changes: {},
      information: {
        factId: 'F001',
        elementIds: ['E1', 'E3'],
        recipientNpcId: 'npc-a',
        acquisition: 'OBSERVATION',
        state: 'MATCH',
      },
    },
  },
}] as unknown as ImmutableHistoricalRecord[];

const admitted = admitNpcInformationCandidate(
  snapshot,
  'npc-b',
  {
    factId: 'F001',
    elementIds: ['E1', 'E3'],
    recipientNpcId: 'npc-b',
    sourceNpcId: 'npc-a',
    acquisition: 'TRANSFER',
  },
  sourceKnowledgeHistory
);

assert.equal(admitted.admitted.length, 1);
assert.deepEqual(admitted.admitted[0].elementIds, ['E1', 'E3']);
assert.equal(admitted.admitted[0].state, 'MATCH');

const rejectedUnknownSource = admitNpcInformationCandidate(
  snapshot,
  'npc-b',
  {
    factId: 'F001',
    elementIds: ['E9'],
    recipientNpcId: 'npc-b',
    sourceNpcId: 'npc-a',
    acquisition: 'TRANSFER',
  },
  sourceKnowledgeHistory
);
assert.equal(rejectedUnknownSource.admitted.length, 0);
assert.ok(rejectedUnknownSource.rejected.includes('NPC_INFORMATION_SOURCE_LACKS_HISTORICAL_KNOWLEDGE'));

const rejectedRecipient = admitNpcInformationCandidate(snapshot, 'npc-b', {
  factId: 'F001',
  elementIds: ['E1'],
  recipientNpcId: 'npc-a',
  acquisition: 'OBSERVATION',
});
assert.equal(rejectedRecipient.admitted.length, 0);
assert.ok(rejectedRecipient.rejected.includes('NPC_INFORMATION_RECIPIENT_ID_MISMATCH'));

const rejectedDistortion = admitNpcInformationCandidate(snapshot, 'npc-b', {
  factId: 'F001',
  elementIds: ['E1'],
  recipientNpcId: 'npc-b',
  acquisition: 'OBSERVATION',
  state: 'DISTORTED',
});
assert.equal(rejectedDistortion.admitted.length, 0);
assert.ok(rejectedDistortion.rejected.includes('NPC_INFORMATION_DISTORTION_REQUIRES_UNDERSTOOD_TEXT'));

const rejectedSelfTransfer = admitNpcInformationCandidate(
  snapshot,
  'npc-a',
  {
    factId: 'F001',
    elementIds: ['E1'],
    recipientNpcId: 'npc-a',
    sourceNpcId: 'npc-a',
    acquisition: 'TRANSFER',
  },
  sourceKnowledgeHistory
);
assert.equal(rejectedSelfTransfer.admitted.length, 0);
assert.ok(rejectedSelfTransfer.rejected.includes('NPC_INFORMATION_SOURCE_RECIPIENT_SELF_TRANSFER'));

console.log('NPC Information Candidate Gate: PASS');
