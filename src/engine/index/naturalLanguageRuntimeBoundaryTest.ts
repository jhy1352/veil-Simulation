import { SovereignEngine } from '../state';
import { dispatchEngineInternalProposal } from '../internalCapability';
import { parseGMResponseAndProposal, buildSafeProposal } from '../proposalParser';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`✓ ${message}`);
}

function playerInterpretation(
  engine: SovereignEngine,
  requestId: string,
  eventId: string,
  playerInput: string,
  meaningTreeJson: string
) {
  const parsed = parseGMResponseAndProposal(
    `${playerInput}\n\n\`\`\`json\n${meaningTreeJson}\n\`\`\``
  );

  assert(parsed.hasProposal, `Player interpretation is extracted for: ${playerInput}`);
  assert(!parsed.parseError, `Player interpretation passes recovery/grammar for: ${playerInput}`);
  assert(Boolean(parsed.meaningTree), `MeaningTree exists at the runtime boundary for: ${playerInput}`);

  return buildSafeProposal(
    {
      requestId,
      eventId,
      expectedStateVersion: engine.getSnapshot().stateVersion,
      turn: engine.getSnapshot().turn + 1,
      source: 'PLAYER',
      timestamp: new Date().toISOString(),
    },
    parsed
  );
}

function run(): void {
  console.log('\n=== Natural Language -> Runtime -> Canonical Commit Boundary ===\n');
  console.log('NOTE: The semantic interpretation below is deterministic test fixture data standing in for an LLM interpretation.');
  console.log('It does NOT claim to test Gemini inference itself. It tests the real textual parser, MeaningTree recovery, adapter, PLAYER source, Commit Gate, and zero-mutation rejection boundary.\n');

  const engine = new SovereignEngine();
  const setup = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-nl-fixture-setup',
    requestId: 'req-nl-fixture-setup',
    eventId: 'evt-nl-fixture-setup',
    turn: engine.getSnapshot().turn + 1,
    intentSummary: 'Establish ordinary world facts required for a player purchase.',
    actions: [
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-nl-blacksmith',
          name: '대장장이',
          status: 'ALIVE',
          role: '대장장이'
        }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          item: {
            id: 'item-nl-gold',
            name: '금화',
            quantity: 10,
            description: 'Natural-language runtime fixture currency'
          },
          operation: 'ADD',
          acquisition: { cause: 'SYSTEM_INITIALIZATION' }
        }
      }
    ]
  });
  assert(setup.success, 'Fixture facts enter CanonicalState through the real internal Commit Gate');

  console.log('--- Normal Existing-World Natural-Language Action ---');
  const purchaseInput = '대장장이에게 금화 세 닢을 주고 단검 하나를 만들어 달라고 한다.';
  const purchaseTree = JSON.stringify({
    atom: 'INTENT',
    scope: 'PROPOSAL',
    value: purchaseInput,
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'MODIFY_INVENTORY',
        fields: {
          actionType: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-nl-gold', name: '금화', quantity: 3 },
            operation: 'REMOVE'
          }
        }
      },
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'MODIFY_INVENTORY',
        fields: {
          actionType: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-nl-dagger', name: '단검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { id: 'item-nl-gold', name: '금화', quantity: 3 },
              sourceNpcId: 'npc-nl-blacksmith'
            }
          }
        }
      }
    ]
  });

  const purchase = engine.submitProposal(
    playerInterpretation(
      engine,
      'req-nl-purchase',
      'evt-nl-purchase',
      purchaseInput,
      purchaseTree
    )
  );
  assert(purchase.success, 'Normal player natural-language action reaches and passes the Sovereign Commit Gate');
  assert(purchase.committedActionsCount === 2, 'Natural-language purchase commits payment and acquired item atomically');
  assert(
    engine.getSnapshot().character.inventory.some(item => item.id === 'item-nl-dagger' && item.quantity === 1),
    'Natural-language purchase produces canonical inventory state'
  );
  assert(
    engine.getSnapshot().character.inventory.some(item => item.id === 'item-nl-gold' && item.quantity === 7),
    'Natural-language purchase deducts the actual canonical payment'
  );

  console.log('--- Novel But Legitimate Natural-Language Action ---');
  const novelInput = '여관에서 내일 상단이 도착한다고 사람들에게 알린다.';
  const novelTree = JSON.stringify({
    atom: 'INTENT',
    scope: 'PROPOSAL',
    value: novelInput,
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'ADD_RUMOR',
        fields: {
          actionType: 'ADD_RUMOR',
          payload: {
            rumor: '플레이어가 여관에서 내일 상단이 도착한다고 알렸다.',
            sourceContext: 'PLAYER_ACTION'
          }
        }
      }
    ]
  });
  const novel = engine.submitProposal(
    playerInterpretation(
      engine,
      'req-nl-novel',
      'evt-nl-novel',
      novelInput,
      novelTree
    )
  );
  assert(novel.success, 'Novel player intent is not falsely rejected merely because it is new');
  assert(
    engine.getSnapshot().worldInfo.publicRumors.includes('플레이어가 여관에서 내일 상단이 도착한다고 알렸다.'),
    'Novel natural-language intent becomes canonical only after Commit Gate acceptance'
  );

  console.log('--- Genuinely Contradictory Natural-Language Action ---');
  const impossibleInput = '금화 열 닢을 내고 장검을 산다. 실제로는 가진 금화가 일곱 닢뿐이다.';
  const impossibleTree = JSON.stringify({
    atom: 'INTENT',
    scope: 'PROPOSAL',
    value: impossibleInput,
    children: [
      {
        atom: 'ACTION',
        scope: 'PROPOSAL',
        value: 'MODIFY_INVENTORY',
        fields: {
          actionType: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-nl-sword', name: '장검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { id: 'item-nl-gold', name: '금화', quantity: 10 },
              sourceNpcId: 'npc-nl-blacksmith'
            }
          }
        }
      }
    ]
  });
  const beforeImpossible = engine.getSnapshot();
  const impossible = engine.submitProposal(
    playerInterpretation(
      engine,
      'req-nl-impossible',
      'evt-nl-impossible',
      impossibleInput,
      impossibleTree
    )
  );
  assert(!impossible.success, 'Contradictory natural-language intent is rejected instead of inventing missing resources');
  assert(
    impossible.rejectedReasons.some(reason => reason.includes('[CAUSALITY_VIOLATION]')),
    'Contradictory natural-language intent is denied by causality, not by PLAYER source blocking'
  );
  assert(
    JSON.stringify(engine.getSnapshot()) === JSON.stringify(beforeImpossible),
    'Rejected natural-language action preserves CanonicalState byte-for-byte'
  );
  assert(
    !engine.getSnapshot().character.inventory.some(item => item.id === 'item-nl-sword'),
    'Rejected natural-language action cannot leak a forged item into canonical inventory'
  );

  console.log('\n=== Natural Language -> Runtime -> Canonical Commit: PASS ===\n');
}

run();
