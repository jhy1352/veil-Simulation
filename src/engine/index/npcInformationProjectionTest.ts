import assert from 'node:assert/strict';
import type { ImmutableHistoricalRecord } from '../types';
import {
  getNpcInformationProjection,
  projectNpcInformationFromHistory,
  type NpcInformationTrace,
} from './npcInformationProjection';

function record(recordId: string, turn: number, information: NpcInformationTrace): ImmutableHistoricalRecord {
  return {
    recordId,
    eventId: `event-${recordId}`,
    proposalId: `proposal-${recordId}`,
    turn,
    timestamp: `2026-01-01T00:00:0${turn}.000Z`,
    source: 'ENGINE_INTERNAL',
    actionType: 'UPDATE_NPC',
    details: JSON.stringify({ information }),
    canonicalAction: {
      type: 'UPDATE_NPC',
      payload: { id: information.recipientNpcId, changes: {} },
    },
    stateVersionAfterCommit: turn + 1,
    informationAccess: 'PUBLIC',
  } as ImmutableHistoricalRecord;
}

const history: ImmutableHistoricalRecord[] = [
  record('r1', 1, { factId: 'F001', elementIds: ['E1', 'E2'], recipientNpcId: 'npc-a', sourceNpcId: 'npc-source', acquisition: 'TRANSFER', state: 'MATCH' }),
  record('r2', 2, { factId: 'F001', elementIds: ['E2'], recipientNpcId: 'npc-a', sourceNpcId: 'npc-source', acquisition: 'TESTIMONY', state: 'DISTORTED', understoodText: '왜곡된 이해' }),
  record('r3', 3, { factId: 'F001', elementIds: ['E1'], recipientNpcId: 'npc-b', sourceNpcId: 'npc-a', acquisition: 'TRANSFER', state: 'MATCH' }),
];

// Inject the metadata exactly as it exists on the canonicalAction payload at runtime.
for (const [index, trace] of history.map((_, i) => [i, history[i]] as const)) {
  const target = trace.canonicalAction as unknown as { payload: Record<string, unknown> };
  target.payload.information = [
    index === 0 ? history[0] && ({ factId: 'F001', elementIds: ['E1', 'E2'], recipientNpcId: 'npc-a', sourceNpcId: 'npc-source', acquisition: 'TRANSFER', state: 'MATCH' } as NpcInformationTrace) :
    index === 1 ? ({ factId: 'F001', elementIds: ['E2'], recipientNpcId: 'npc-a', sourceNpcId: 'npc-source', acquisition: 'TESTIMONY', state: 'DISTORTED', understoodText: '왜곡된 이해' } as NpcInformationTrace) :
    ({ factId: 'F001', elementIds: ['E1'], recipientNpcId: 'npc-b', sourceNpcId: 'npc-a', acquisition: 'TRANSFER', state: 'MATCH' } as NpcInformationTrace),
  ];
}

const all = projectNpcInformationFromHistory(history);
assert.equal(all.size, 2);
assert.deepEqual(all.get('npc-a')?.evidence.map(e => `${e.factId}:${e.elementId}:${e.state}`), ['F001:E1:MATCH', 'F001:E2:DISTORTED']);
assert.equal(all.get('npc-a')?.evidence[1]?.understoodText, '왜곡된 이해');
assert.equal(all.get('npc-a')?.evidence[1]?.recordId, 'r2');
assert.equal(all.get('npc-b')?.evidence[0]?.sourceNpcId, 'npc-a');

const unknown = getNpcInformationProjection(history, 'npc-unknown');
assert.equal(unknown.evidence.length, 0);

console.log('NPC Information Projection: PASS');
