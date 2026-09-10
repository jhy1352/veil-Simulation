import { SovereignEngine } from '../state';
import type { StateTransitionProposal, TransitionAction } from '../types';
import { dispatchEngineInternalProposal } from '../internalCapability';
import { actionToMeaningNode } from '../language/adapter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`✓ ${message}`);
}

function makePlayerProposal(
  engine: SovereignEngine,
  requestId: string,
  eventId: string,
  intentSummary: string,
  actions: TransitionAction[]
): StateTransitionProposal {
  const state = engine.getSnapshot();
  return {
    proposalId: `prop-${requestId}`,
    requestId,
    eventId,
    expectedStateVersion: state.stateVersion,
    source: 'PLAYER',
    turn: state.turn + 1,
    timestamp: new Date().toISOString(),
    intentSummary,
    actions,
    meaningTree: {
      atom: 'INTENT',
      scope: 'PROPOSAL',
      value: intentSummary,
      children: actions.map(action => actionToMeaningNode(action, 'PROPOSAL'))
    }
  };
}

function run(): void {
  console.log('\n=== Legitimate Player Action / False-Positive Tests ===\n');

  // Establish ordinary canonical facts through the real sovereign internal path.
  const engine = new SovereignEngine();
  const setup = dispatchEngineInternalProposal(engine, {
    proposalId: 'prop-player-fixture-setup',
    requestId: 'req-player-fixture-setup',
    eventId: 'evt-player-fixture-setup',
    turn: engine.getSnapshot().turn + 1,
    intentSummary: 'Establish an existing merchant and player currency for a normal purchase.',
    actions: [
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-player-merchant',
          name: '대장장이',
          status: 'ALIVE',
          role: '대장장이'
        }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          item: {
            id: 'item-player-gold',
            name: '금화',
            quantity: 10,
            description: 'Normal-play purchase currency fixture'
          },
          operation: 'ADD',
          acquisition: { cause: 'SYSTEM_INITIALIZATION' }
        }
      }
    ]
  });
  assert(setup.success, 'Fixture setup commits through the real Sovereign Commit Gate');

  console.log('\n--- Normal Existing-World Action ---');
  const purchaseActions: TransitionAction[] = [
    {
      type: 'MODIFY_INVENTORY',
      payload: {
        item: {
          id: 'item-player-gold',
          name: '금화',
          quantity: 3
        },
        operation: 'REMOVE'
      }
    },
    {
      type: 'MODIFY_INVENTORY',
      payload: {
        item: {
          id: 'item-player-dagger',
          name: '단검',
          quantity: 1,
          description: 'Normal-play purchase result'
        },
        operation: 'ADD',
        acquisition: {
          cause: 'RESOURCE_EXCHANGE',
          cost: {
            id: 'item-player-gold',
            name: '금화',
            quantity: 3
          },
          sourceNpcId: 'npc-player-merchant'
        }
      }
    }
  ];
  const purchase = engine.submitProposal(
    makePlayerProposal(
      engine,
      'req-player-purchase',
      'evt-player-purchase',
      'Player buys a dagger from the blacksmith for three gold coins.',
      purchaseActions
    )
  );
  assert(purchase.success, 'Normal player purchase is accepted without player-supplied provenance hashes or VerifiedClaims');
  assert(purchase.committedActionsCount === 2, 'Purchase commits both the atomic payment and acquired item');
  const purchaseState = engine.getSnapshot();
  assert(
    purchaseState.character.inventory.some(item => item.id === 'item-player-dagger' && item.quantity === 1),
    'Purchased item exists in canonical inventory after commit'
  );
  assert(
    purchaseState.character.inventory.some(item => item.id === 'item-player-gold' && item.quantity === 7),
    'Payment is deducted atomically from canonical inventory'
  );

  console.log('\n--- Novel But Legitimate Player Action ---');
  const rumor = engine.submitProposal(
    makePlayerProposal(
      engine,
      'req-player-novel-rumor',
      'evt-player-novel-rumor',
      'Player tells the tavern that a caravan will arrive tomorrow.',
      [
        {
          type: 'ADD_RUMOR',
          payload: {
            rumor: '플레이어가 여관에서 내일 상단이 도착한다는 소문을 퍼뜨렸다.',
            sourceContext: 'PLAYER_ACTION'
          }
        }
      ]
    )
  );
  assert(rumor.success, 'Novel but valid player narrative action is accepted');
  assert(
    engine.getSnapshot().worldInfo.publicRumors?.includes('플레이어가 여관에서 내일 상단이 도착한다는 소문을 퍼뜨렸다.') === true,
    'Novel player action becomes canonical only after Commit Gate acceptance'
  );

  console.log('\n--- Genuinely Contradictory Action ---');
  const impossiblePurchase = engine.submitProposal(
    makePlayerProposal(
      engine,
      'req-player-impossible-purchase',
      'evt-player-impossible-purchase',
      'Player attempts to buy a sword for ten nonexistent coins.',
      [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: {
              id: 'item-player-sword',
              name: '장검',
              quantity: 1
            },
            operation: 'ADD',
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: {
                id: 'item-player-gold',
                name: '금화',
                quantity: 10
              },
              sourceNpcId: 'npc-player-merchant'
            }
          }
        }
      ]
    )
  );
  assert(!impossiblePurchase.success, 'Contradictory player action is rejected rather than inventing missing payment');
  assert(
    impossiblePurchase.rejectedReasons.some(reason => reason.includes('[CAUSALITY_VIOLATION]')),
    'Contradictory action is rejected by causality rather than by source-level PLAYER blocking'
  );
  assert(
    !engine.getSnapshot().character.inventory.some(item => item.id === 'item-player-sword'),
    'Rejected contradictory action does not mutate canonical inventory'
  );

  console.log('\n--- Internal-Only Action Boundary ---');
  const forgedNpcCreation = engine.submitProposal(
    makePlayerProposal(
      engine,
      'req-player-forged-npc',
      'evt-player-forged-npc',
      'Player attempts to directly create a canonical NPC record.',
      [
        {
          type: 'ADD_NPC',
          payload: {
            id: 'npc-forged-by-player',
            name: '직접 생성 NPC',
            status: 'ALIVE'
          }
        }
      ]
    )
  );
  assert(!forgedNpcCreation.success, 'Player cannot directly commit an internal-only NPC creation action');
  assert(
    forgedNpcCreation.rejectedReasons.some(reason => reason.includes('[UNAUTHORIZED_ACTION_FOR_SOURCE]')),
    'Internal-only action is rejected by action ACL, not by a blanket rejection of player intent'
  );

  console.log('\n=== Legitimate Player Action / False-Positive: PASS ===\n');
}

run();
