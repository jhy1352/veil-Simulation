import assert from 'node:assert/strict';
import type { CanonicalState, ImmutableHistoricalRecord, TransitionAction } from '../types';
import { adaptNpcInformationCandidateToAction } from './npcInformationCandidateAdapter';

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

const action: TransitionAction = {
  type: 'UPDATE_NPC',
  payload: {
    id: 'npc-b',
    changes: { innerThought: 'existing' },
  },
};

const valid = adaptNpcInformationCandidateToAction(
  snapshot,
  sourceKnowledgeHistory,
  action,
  'npc-b',
  {
    factId: 'F001',
    elementIds: ['E1', 'E3'],
    recipientNpcId: 'npc-b',
    sourceNpcId: 'npc-a',
    acquisition: 'TRANSFER',
  }
);

assert.equal(valid.admitted.length, 1);
assert.deepEqual(valid.rejected, []);
assert.deepEqual((valid.action.payload as any).information, [valid.admitted[0]]);
assert.deepEqual(action.payload, {
  id: 'npc-b',
  changes: { innerThought: 'existing' },
});

const invalid = adaptNpcInformationCandidateToAction(snapshot, sourceKnowledgeHistory, action, 'npc-b', {
  factId: 'F001',
  elementIds: ['E1'],
  recipientNpcId: 'npc-a',
  acquisition: 'OBSERVATION',
});

assert.equal(invalid.admitted.length, 0);
assert.ok(invalid.rejected.includes('NPC_INFORMATION_RECIPIENT_ID_MISMATCH'));
assert.deepEqual(invalid.action, action);

console.log('NPC Information Candidate Adapter: PASS');
