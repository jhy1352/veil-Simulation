import { OffscreenWakeContext } from './offscreenHistoricalWake';
import { evaluateWakeNecessity, WakeTrigger } from './wakeNecessityGate';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

const context = {
  fromTurn: 100,
  toTurn: 400,
  elapsedTurns: 300,
  anchors: [{ entityId: 'npc-mira', entityType: 'NPC', name: '미라' }],
  relevantHistory: [],
  generationPolicy: 'CAUSAL_SKELETON_ONLY',
  authority: 'NON_CANONICAL_CONTEXT'
} as unknown as OffscreenWakeContext;

function check(trigger: WakeTrigger, expected: boolean, message: string, alreadyMaterialized?: boolean): void {
  const result = evaluateWakeNecessity({ context, trigger, alreadyMaterialized });
  assert(result.shouldWake === expected, message);
}

check('PLAYER_REENTERED_SCOPE', true, 'Re-entering a scope wakes deferred history');
check('ANCHOR_REVISITED', true, 'Revisiting an anchor wakes deferred history');
check('CURRENT_STATE_REQUIRES_HISTORY', true, 'Unexplained current state wakes deferred history');
check('NARRATIVE_DEPENDENCY', true, 'Narrative dependency wakes deferred history');
check('TIME_ADVANCED', false, 'Time advancement alone does not wake history');
check('MAP_DISCOVERED', false, 'Map discovery alone does not wake history');
check('ALREADY_MATERIALIZED', false, 'Already materialized scope does not wake again');
check('PLAYER_REENTERED_SCOPE', false, 'Explicit materialized flag suppresses repeated wake', true);

const emptyAnchorContext = {
  ...context,
  anchors: []
} as OffscreenWakeContext;
const emptyResult = evaluateWakeNecessity({
  context: emptyAnchorContext,
  trigger: 'PLAYER_REENTERED_SCOPE'
});
assert(!emptyResult.shouldWake, 'Wake is denied when no persistent anchor exists');

const zeroIntervalContext = {
  ...context,
  toTurn: 100,
  elapsedTurns: 0
} as OffscreenWakeContext;
const zeroResult = evaluateWakeNecessity({
  context: zeroIntervalContext,
  trigger: 'PLAYER_REENTERED_SCOPE'
});
assert(!zeroResult.shouldWake, 'Wake is denied when no time interval exists');

console.log(`\nWake Necessity Gate: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
