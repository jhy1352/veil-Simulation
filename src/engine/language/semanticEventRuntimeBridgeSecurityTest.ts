/**
 * Security regression tests for the semantic runtime bridge.
 *
 * These tests intentionally exercise the boundary where LLM/frontend-controlled
 * SemanticEvent data could otherwise be promoted into engine authority.
 */

import { semanticEventToRuntimeActions, semanticEventsToRuntimeActions } from './semanticEventRuntimeBridge';
import type { SemanticEvent } from './types';

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const baseGift: SemanticEvent = {
  eventId: 'frontend-event-1',
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
  provenance: 'historical-event-that-llm-claimed',
};

const inventoryResolver = () => ({
  id: 'item-silver',
  name: '은화',
  quantity: 1,
});

function run(): void {
  const blockedWithoutAuthority = semanticEventToRuntimeActions(baseGift, {
    playerName: '플레이어',
    resolveInventoryItem: inventoryResolver,
  });

  assertEqual(blockedWithoutAuthority.status, 'UNSUPPORTED', 'Unresolved frontend provenance must fail closed.');
  assertEqual(blockedWithoutAuthority.actions, [], 'No runtime action may be emitted without trusted event resolution.');

  const blockedByFakeResolver = semanticEventToRuntimeActions(baseGift, {
    playerName: '플레이어',
    resolveInventoryItem: inventoryResolver,
    resolveVerifiedEventId: () => '   ',
  });

  assertEqual(blockedByFakeResolver.status, 'UNSUPPORTED', 'Blank trusted resolution must fail closed.');
  assertEqual(blockedByFakeResolver.actions, [], 'Blank trusted resolution must not authorize a mutation.');

  const mapped = semanticEventToRuntimeActions(baseGift, {
    playerName: '플레이어',
    resolveInventoryItem: inventoryResolver,
    resolveVerifiedEventId: (event) => event.provenance === 'historical-event-that-llm-claimed' ? 'verified-event-42' : undefined,
  });

  assertEqual(mapped.status, 'MAPPABLE', 'Explicit engine-side provenance resolution should permit mapping.');
  assertEqual(mapped.actions.length, 1, 'Exactly one inventory action should be emitted.');
  assertEqual(
    (mapped.actions[0] as any).payload.acquisition.verifiedEventId,
    'verified-event-42',
    'Only the trusted resolver output may become verifiedEventId.'
  );
  assertEqual(
    (mapped.actions[0] as any).payload.acquisition.causalSource,
    'EXISTING_EVENT',
    'Trusted verified-event resolution must classify the acquisition as an existing-event cause.'
  );

  const unsupportedSequence: SemanticEvent[] = [
    baseGift,
    {
      ...baseGift,
      eventId: 'frontend-event-2',
      action: 'UNSUPPORTED_FRONTEND_ACTION',
      provenance: undefined,
    },
  ];

  const sequenceResult = semanticEventsToRuntimeActions(unsupportedSequence, {
    playerName: '플레이어',
    resolveInventoryItem: inventoryResolver,
    resolveVerifiedEventId: () => 'verified-event-42',
  });

  assertEqual(sequenceResult.status, 'UNSUPPORTED', 'Any unsupported semantic event must fail the sequence closed.');
  assertEqual(sequenceResult.actions, [], 'A partially mappable sequence must never emit partial runtime actions.');

  console.log('SemanticEvent Runtime Bridge security tests: PASS');
}

run();
