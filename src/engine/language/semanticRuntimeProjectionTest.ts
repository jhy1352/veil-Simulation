/**
 * Regression proof for the single SemanticEvent -> MeaningTree -> Runtime path.
 * This test does not invoke the legacy Korean parser and does not mutate CanonicalState.
 */

import { compileSemanticEventsToMeaningTree } from './causalCompiler';
import { projectMeaningTreeToRuntimeActions } from './runtimeProjection';
import type { SemanticEvent } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const giftEvent: SemanticEvent = {
  eventId: 'semantic-runtime-proof-1',
  action: 'GIFT',
  roles: [
    { role: 'SUBJECT', entityName: '상인', status: 'RESOLVED' },
    { role: 'RECIPIENT', entityName: '플레이어', status: 'RESOLVED' },
    { role: 'OBJECT', entityName: '은화', status: 'RESOLVED' },
  ],
  scope: 'PROPOSAL',
  polarity: 'ASSERTED',
  epistemicStatus: 'OBSERVED',
  modality: 'NONE',
  provenance: 'frontend-reference',
};

function expectProjectionFailure(fn: () => unknown, message: string): void {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  assert(failed, message);
}

function run(): void {
  const compiled = compileSemanticEventsToMeaningTree([giftEvent]);
  assert(compiled.status === 'COMPILED', 'SemanticEvent compiles into MeaningTree');
  if (!compiled.meaningTree) throw new Error('FAIL: compiler did not produce MeaningTree');

  expectProjectionFailure(
    () => projectMeaningTreeToRuntimeActions(compiled.meaningTree!, {
      playerName: '플레이어',
      resolveInventoryItem: () => ({ id: 'item-silver', name: '은화', quantity: 1 }),
    }),
    'MeaningTree projection fails closed without trusted verified-event resolution'
  );

  const projected = projectMeaningTreeToRuntimeActions(
    compiled.meaningTree,
    {
      playerName: '플레이어',
      resolveInventoryItem: () => ({ id: 'item-silver', name: '은화', quantity: 1 }),
      resolveVerifiedEventId: (event) => event.eventId === giftEvent.eventId ? 'verified-runtime-proof-1' : undefined,
      semanticEvents: [giftEvent],
    }
  );

  assert(projected.actions.length === 1, 'Compiled semantic ACTION is projected exactly once');
  const action = projected.actions[0] as any;
  assert(action.type === 'MODIFY_INVENTORY', 'Semantic GIFT maps to existing Sovereign inventory action');
  assert(action.payload.operation === 'ADD', 'Semantic GIFT maps to inventory ADD');
  assert(action.payload.acquisition.verifiedEventId === 'verified-runtime-proof-1', 'Only trusted resolver output reaches verifiedEventId');
  assert(action.payload.acquisition.sourceNpcId === undefined, 'Unresolved NPC identity is not invented');

  expectProjectionFailure(
    () => projectMeaningTreeToRuntimeActions(compiled.meaningTree!, {
      playerName: '플레이어',
      resolveInventoryItem: () => ({ id: 'item-silver', name: '은화', quantity: 1 }),
      resolveVerifiedEventId: () => 'tampered-authority',
      semanticEvents: [{ ...giftEvent, eventId: 'different-event' }],
    }),
    'MeaningTree eventId mismatch cannot select a different SemanticEvent'
  );

  console.log('Semantic runtime projection tests: PASS');
}

run();
