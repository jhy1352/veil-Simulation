import assert from 'node:assert/strict';
import type { ImmutableHistoricalRecord, TransitionAction } from '../types';
import { attachNpcInformation } from './npcInformationAction';
import { projectNpcInformationFromHistory } from './npcInformationProjection';
import type { NpcInformationTrace } from './npcInformationTypes';

const baseAction: TransitionAction = {
  type: 'UPDATE_NPC',
  payload: { id: 'npc-b', changes: {} },
};

const information: NpcInformationTrace = {
  factId: 'F001',
  elementIds: ['E1', 'E3'],
  recipientNpcId: 'npc-b',
  sourceNpcId: 'npc-a',
  acquisition: 'TRANSFER',
  state: 'MATCH',
};

const action = attachNpcInformation(baseAction, information);
const payload = action.payload as unknown as Record<string, unknown>;
assert.deepEqual(payload.information, information);
assert.deepEqual((baseAction.payload as unknown as Record<string, unknown>).information, undefined);

const record: ImmutableHistoricalRecord = {
  recordId: 'rec-info-1',
  eventId: 'evt-info-1',
  proposalId: 'prop-info-1',
  turn: 1,
  timestamp: '2026-01-01T00:00:01.000Z',
  source: 'ENGINE_INTERNAL',
  actionType: action.type,
  details: JSON.stringify(action.payload),
  canonicalAction: action,
  stateVersionAfterCommit: 2,
  informationAccess: 'PUBLIC',
};

const projection = projectNpcInformationFromHistory([record]);
assert.deepEqual(
  projection.get('npc-b')?.evidence.map(e => `${e.factId}:${e.elementId}:${e.state}`),
  ['F001:E1:MATCH', 'F001:E3:MATCH']
);
assert.equal(projection.get('npc-b')?.evidence[0]?.sourceNpcId, 'npc-a');

console.log('NPC Information Action Metadata: PASS');
