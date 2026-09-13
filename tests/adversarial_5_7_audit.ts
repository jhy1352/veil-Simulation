import { SovereignEngine } from '../src/engine/state';
import { EngineValidator } from '../src/engine/validator';
import { applyActionToDraftState } from '../src/engine/actionApplier';
import { parseGMResponseAndProposal, buildSafeProposalFromCandidate, buildSafeProposal } from '../src/engine/proposalParser';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary';
import { dispatchEngineInternalProposal, dispatchEngineInternalAction } from '../src/engine/internalCapability';
import { StateTransitionProposal, TransitionAction, ImmutableHistoricalRecord, CanonicalState } from '../src/engine/types';
import { CandidatePacket, HistoricalRecord, NpcRecord, FactionRecord, NarrativeSeed, StatType } from '../src/types';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory';
import * as fs from 'fs';
import * as path from 'path';

interface AdversarialAttackResult {
  attackId: string;
  category: string;
  name: string;
  targetComponent: string;
  description: string;
  pipelinePath: string;
  payload: any;
  preStateSnapshot: {
    stateVersion: number;
    turn: number;
    npcsCount: number;
    inventoryCount: number;
    seedsCount: number;
    factionsCount: number;
    stats: any;
  };
  postStateSnapshot: {
    stateVersion: number;
    turn: number;
    npcsCount: number;
    inventoryCount: number;
    seedsCount: number;
    factionsCount: number;
    stats: any;
  };
  commitSuccess: boolean;
  canonicalMutated: boolean;
  rejectedReasons: string[];
  verdict: 'BREAK' | 'HOLD' | 'PASS';
  analysis: string;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function runAdversarialRedTeamSuite(): {
  timestamp: string;
  totalAttacks: number;
  breaks: number;
  holds: number;
  passes: number;
  results: AdversarialAttackResult[];
} {
  const results: AdversarialAttackResult[] = [];
  const timestamp = new Date().toISOString();

  // Helper to extract light snapshot summary
  const getLightSnapshot = (engine: SovereignEngine) => {
    const snap = engine.getSnapshot();
    return {
      stateVersion: snap.stateVersion,
      turn: snap.turn,
      npcsCount: snap.worldInfo.npcs.length,
      inventoryCount: snap.character.inventory.length,
      seedsCount: snap.worldInfo.seeds.length,
      factionsCount: snap.worldInfo.factions.length,
      stats: deepClone(snap.character.stats)
    };
  };

  // Helper to seed standard active game state
  const createSeededEngine = () => {
    const engine = new SovereignEngine();
    // Turn 1 Genesis Initialization
    dispatchEngineInternalAction(engine, [
      {
        type: 'SET_WORLD_METADATA',
        payload: {
          worldName: '중원 무림',
          currentLocation: '낙양',
          weather: '맑음',
          secretLore: ['화산파의 비급 자하신공은 사혼곡에 묻혀 있다.']
        }
      },
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-cheonma',
          name: '천마',
          alias: '마교주',
          npcClass: 'NAMED',
          status: 'DEAD',
          impression: '사망함',
          affiliation: '천마신교'
        }
      },
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-elder-baek',
          name: '백발도인',
          alias: '화산 장로',
          npcClass: 'NAMED',
          status: 'ALIVE',
          impression: '중립적',
          affinity: 50,
          trust: 50,
          metInStory: true,
          innerThought: '주인공의 기재를 주시하고 있다.',
          affiliation: '화산파'
        }
      },
      {
        type: 'ADD_NPC',
        payload: {
          id: 'npc-unmet-assassin',
          name: '혈영살수',
          alias: '암살자',
          npcClass: 'NAMED',
          status: 'UNMET',
          metInStory: false,
          innerThought: '[미인지 상태]',
          impression: '[미인지 상태]',
          affiliation: '살막'
        }
      },
      {
        type: 'ADD_FACTION',
        payload: {
          id: 'fac-hwashan',
          name: '화산파',
          influence: 40,
          description: '구파일방의 명문정파',
          attitudeTowardsPlayer: '우호적'
        }
      },
      {
        type: 'ADD_FACTION',
        payload: {
          id: 'fac-magyo',
          name: '천마신교',
          influence: 40,
          description: '서역 십만대산의 마도 세력',
          attitudeTowardsPlayer: '적대적'
        }
      },
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: 'seed-secret-scroll',
          content: '사혼곡에 묻힌 자하신공 비급의 행방',
          status: 'active',
          turnCreated: 1
        }
      },
      {
        type: 'MODIFY_INVENTORY',
        payload: {
          operation: 'ADD',
          item: {
            id: 'item-silver-ingot',
            name: '은화',
            quantity: 10
          },
          acquisition: {
            cause: 'INITIAL_EQUIPMENT'
          }
        }
      }
    ], 'Genesis World and Character Initial Setup');

    return engine;
  };

  // ============================================================================
  // ATTACK CATEGORY 1: AUTHORIZATION & CAPABILITY BOUNDARY EXPLOITS
  // ============================================================================

  // Attack 1.1: System Forgery via JSON Payload without Internal Capability Registration
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const forgedProposal: StateTransitionProposal = {
      proposalId: 'prop-forged-sys-01',
      requestId: 'req-forged-sys-01',
      eventId: 'evt-forged-sys-01',
      expectedStateVersion: preSnap.stateVersion,
      source: 'SYSTEM', // Maliciously claiming SYSTEM source directly from external JSON
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Forged system proposal to inject +100 stat modification',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 30, agility: 30, constitution: 30 }
        }
      ]
    };

    const res = engine.submitProposal(forgedProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-01-AUTH-FORGE-SYS',
      category: 'Authorization & Capability Boundary',
      name: 'Direct External Forgery of SYSTEM Proposal Source',
      targetComponent: 'EngineValidator.ts & internalCapability.ts (WeakSet Authority)',
      description: 'Attempting to inject a proposal stamped with source: SYSTEM without engineWeakSet registration.',
      pipelinePath: 'External Input -> SovereignEngine.submitProposal() -> EngineValidator.validate()',
      payload: forgedProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('PROVENANCE_VIOLATION') || r.includes('SYSTEM')) ? 'HOLD' : 'PASS'),
      analysis: mutated 
        ? 'CRITICAL BREAK: Forged SYSTEM proposal was committed to canonical state!' 
        : 'SECURE: EngineValidator authoritatively checked isEngineAuthorized(proposal) and rejected forged SYSTEM source.'
    });
  }

  // Attack 1.2: Stale GENESIS Source Escalation in Active Game Turn
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const genesisProposal: StateTransitionProposal = {
      proposalId: 'prop-forged-gen-02',
      requestId: 'req-forged-gen-02',
      eventId: 'evt-forged-gen-02',
      expectedStateVersion: preSnap.stateVersion,
      source: 'GENESIS', // Maliciously using GENESIS on turn > 1, stateVersion > 1
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Re-initialize world and overwrite character name to God',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '천하무적'
          }
        }
      ]
    };

    const res = engine.submitProposal(genesisProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-02-AUTH-GENESIS-REUSE',
      category: 'Authorization & Capability Boundary',
      name: 'Post-Genesis Re-use of GENESIS Source for Name Mutation',
      targetComponent: 'EngineValidator.ts (Genesis Turn Guard)',
      description: 'Attempting to bypass immutable character name rules by claiming GENESIS source on turn 2.',
      pipelinePath: 'External Input -> SovereignEngine.submitProposal() -> EngineValidator.validate()',
      payload: genesisProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('GENESIS')) ? 'HOLD' : 'PASS'),
      analysis: mutated 
        ? 'CRITICAL BREAK: GENESIS source accepted after initial Genesis turn!' 
        : 'SECURE: Genesis source strictly locked to turn 1, stateVersion 1, and null lastCommittedEventId.'
    });
  }

  // Attack 1.3: PLAYER Source Invoking OVERWRITE_WORLD_INFO to Wipe Secret Lore & Narrative Seeds
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const playerOverwriteProposal: StateTransitionProposal = {
      proposalId: 'prop-player-wipe-world-03',
      requestId: 'req-player-wipe-world-03',
      eventId: 'evt-player-wipe-world-03',
      expectedStateVersion: preSnap.stateVersion,
      source: 'PLAYER',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player attempts to overwrite secretLore and wipe active narrative seeds',
      actions: [
        {
          type: 'OVERWRITE_WORLD_INFO',
          payload: {
            worldName: '중원 무림', // Matching name to pass name check
            secretLore: ['조작된 비밀: 자하신공은 존재하지 않는다.'], // Attempting to replace secretLore
            seeds: [] // Attempting to wipe all active seeds
          }
        }
      ]
    };

    const res = engine.submitProposal(playerOverwriteProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;
    const snap = engine.getSnapshot();
    const secretLoreWiped = snap.worldInfo.secretLore.some(s => s.includes('조작된 비밀'));

    results.push({
      attackId: 'ADV-03-AUTH-PLAYER-OVERWRITE-WORLD',
      category: 'Authorization & Capability Boundary',
      name: 'Player OVERWRITE_WORLD_INFO Secret Lore & Narrative Seeds Tampering',
      targetComponent: 'EngineValidator.ts OVERWRITE_WORLD_INFO ACL & Validation',
      description: 'Testing if PLAYER source can wipe secretLore or active seeds via OVERWRITE_WORLD_INFO.',
      pipelinePath: 'Player Input -> SovereignEngine.submitProposal() -> EngineValidator.validate(OVERWRITE_WORLD_INFO)',
      payload: playerOverwriteProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: (mutated && secretLoreWiped) ? 'BREAK' : 'HOLD',
      analysis: (mutated && secretLoreWiped)
        ? 'CRITICAL BREAK: Player OVERWRITE_WORLD_INFO mutated canonical secretLore!'
        : 'SECURE / CONTAINED: OVERWRITE_WORLD_INFO prevented unauthorized modification or rejected.'
    });
  }

  // Attack 1.4: PLAYER Source Invoking OVERWRITE_CHARACTER to Inject Forged Timeline History
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const playerTimelineProposal: StateTransitionProposal = {
      proposalId: 'prop-player-fake-timeline-04',
      requestId: 'req-player-fake-timeline-04',
      eventId: 'evt-player-fake-timeline-04',
      expectedStateVersion: preSnap.stateVersion,
      source: 'PLAYER',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Player injects fabricated historical timeline events directly into character profile',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: engine.getSnapshot().character.name, // Matching name
            secret: engine.getSnapshot().character.secret, // Matching secret
            inventory: deepClone(engine.getSnapshot().character.inventory), // Matching inventory
            timeline: [
              {
                id: 'fake-timeline-event-01',
                year: 100,
                description: '신검을 얻어 천하제일인이 되었다.'
              }
            ]
          }
        }
      ]
    };

    const res = engine.submitProposal(playerTimelineProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;
    const snap = engine.getSnapshot();
    const timelineInjected = snap.character.timeline.some(t => t.description.includes('천하제일인'));

    results.push({
      attackId: 'ADV-04-AUTH-PLAYER-TIMELINE-INJECTION',
      category: 'Authorization & Capability Boundary',
      name: 'Player OVERWRITE_CHARACTER Forged Timeline Injection',
      targetComponent: 'EngineValidator.ts & actionApplier.ts (Character Timeline Invariant)',
      description: 'Testing if ungrounded historical events can be injected into character.timeline via OVERWRITE_CHARACTER.',
      pipelinePath: 'Player Input -> SovereignEngine.submitProposal() -> EngineValidator.validate(OVERWRITE_CHARACTER)',
      payload: playerTimelineProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: (mutated && timelineInjected) ? 'BREAK' : 'HOLD',
      analysis: (mutated && timelineInjected)
        ? 'NOTE BREAK: OVERWRITE_CHARACTER allowed player to inject ungrounded timeline history into character profile.'
        : 'SECURE: Invariant gate rejected unverified timeline mutation.'
    });
  }

  // ============================================================================
  // ATTACK CATEGORY 2: CAUSALITY & PROVENANCE BOUNDARY IN INVENTORY & RESOURCES
  // ============================================================================

  // Attack 2.1: Ungrounded DISCOVERY_PICKUP referencing Fake/Non-existent Event ID
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const fakeDiscoveryProposal: StateTransitionProposal = {
      proposalId: 'prop-fake-pickup-05',
      requestId: 'req-fake-pickup-05',
      eventId: 'evt-fake-pickup-05',
      expectedStateVersion: preSnap.stateVersion,
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Acquire Divine Dragon Sword via ungrounded DISCOVERY_PICKUP',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: {
              id: 'item-divine-sword',
              name: '신룡보검',
              quantity: 1
            },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'evt-non-existent-ruins-12345' // Fabricated event ID
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(fakeDiscoveryProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-05-INV-UNGROUNDED-PICKUP',
      category: 'Causality & Provenance Boundary',
      name: 'Ungrounded DISCOVERY_PICKUP with Fabricated verifiedEventId',
      targetComponent: 'EngineValidator.ts (Inventory Event Grounding Check)',
      description: 'Attempting to acquire an item with DISCOVERY_PICKUP using an ungrounded event ID.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate(MODIFY_INVENTORY)',
      payload: fakeDiscoveryProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('CAUSALITY_VIOLATION') || r.includes('verifiedEventId') || r.includes('not grounded')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: Ungrounded item acquisition was approved without active event/seed!'
        : 'SECURE: Event grounding check successfully verified that verifiedEventId does not exist in current seeds or offscreen records.'
    });
  }

  // Attack 2.2: RESOURCE_EXCHANGE Double Spend & Quantity Exhaustion Attack
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    // Player has 10 silver ingots. Proposal removes 10 silver ingots, then attempts to buy TWO swords each costing 10 silver ingots!
    const doubleSpendProposal: StateTransitionProposal = {
      proposalId: 'prop-double-spend-06',
      requestId: 'req-double-spend-06',
      eventId: 'evt-double-spend-06',
      expectedStateVersion: preSnap.stateVersion,
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Double spending 10 silver ingots for 2 different items',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'REMOVE',
            item: {
              id: 'item-silver-ingot',
              name: '은화',
              quantity: 10
            }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: {
              id: 'item-iron-sword-1',
              name: '철검',
              quantity: 1
            },
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: {
                id: 'item-silver-ingot',
                name: '은화',
                quantity: 10
              }
            }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: {
              id: 'item-iron-armor-2',
              name: '철갑',
              quantity: 1
            },
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: {
                id: 'item-silver-ingot',
                name: '은화',
                quantity: 10 // Second spend of the same 10 silver!
              }
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(doubleSpendProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-06-INV-RESOURCE-DOUBLE-SPEND',
      category: 'Causality & Provenance Boundary',
      name: 'Intra-Proposal RESOURCE_EXCHANGE Cost Double Spending',
      targetComponent: 'EngineValidator.ts (consumedCostPool Tracking)',
      description: 'Removing 10 silver ingots once, but attempting to purchase two separate 10-silver items in the same proposal.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate(Intra-proposal Cost Pool)',
      payload: doubleSpendProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('RESOURCE_EXCHANGE_VIOLATION') || r.includes('exceeds total removed')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: Resource double spend succeeded within atomic proposal!'
        : 'SECURE: consumedCostPool strictly tracked cumulative cost usage and rejected the second spend.'
    });
  }

  // Attack 2.3: Mathematical Edge Case - NaN / Negative / Float Item Quantity
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const nanQtyProposal: StateTransitionProposal = {
      proposalId: 'prop-nan-qty-07',
      requestId: 'req-nan-qty-07',
      eventId: 'evt-nan-qty-07',
      expectedStateVersion: preSnap.stateVersion,
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Inject NaN quantity into inventory',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: {
              id: 'item-nan-gold',
              name: '황금',
              quantity: NaN as any
            },
            acquisition: {
              cause: 'INITIAL_EQUIPMENT'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(nanQtyProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-07-INV-NAN-QUANTITY',
      category: 'Causality & Provenance Boundary',
      name: 'IEEE-754 Special Value (NaN) Injection in Item Quantity',
      targetComponent: 'EngineValidator.ts (Quantity Number Sanitization)',
      description: 'Attempting to inject NaN into inventory quantity.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate(MODIFY_INVENTORY)',
      payload: nanQtyProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('quantity')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: NaN quantity contaminated canonical inventory!'
        : 'SECURE: Strict Number.isFinite and isNaN validation rejected non-finite quantity.'
    });
  }

  // Attack 2.4: SET_QUANTITY Operation from Untrusted LLM Source
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const setQtyProposal: StateTransitionProposal = {
      proposalId: 'prop-set-qty-08',
      requestId: 'req-set-qty-08',
      eventId: 'evt-set-qty-08',
      expectedStateVersion: preSnap.stateVersion,
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Untrusted LLM attempts SET_QUANTITY to inflate silver ingots to 9999',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'SET_QUANTITY',
            item: {
              id: 'item-silver-ingot',
              name: '은화',
              quantity: 9999
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(setQtyProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-08-INV-SET-QUANTITY-LLM',
      category: 'Causality & Provenance Boundary',
      name: 'Untrusted SET_QUANTITY Operation Invocation by LLM Source',
      targetComponent: 'EngineValidator.ts (SET_QUANTITY Source Gate)',
      description: 'Attempting to call privileged SET_QUANTITY operation directly from LLM proposal.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate(SET_QUANTITY)',
      payload: setQtyProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('SET_QUANTITY')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: Untrusted LLM was able to execute SET_QUANTITY!'
        : 'SECURE: SET_QUANTITY is strictly locked to GENESIS, SYSTEM, and internal engines.'
    });
  }

  // ============================================================================
  // ATTACK CATEGORY 3: CONCURRENCY, IDEMPOTENCY & STALE STATE MANIPULATION
  // ============================================================================

  // Attack 3.1: Stale State Version Proposal Overwrite Attempt
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const staleProposal: StateTransitionProposal = {
      proposalId: 'prop-stale-ver-09',
      requestId: 'req-stale-ver-09',
      eventId: 'evt-stale-ver-09',
      expectedStateVersion: preSnap.stateVersion - 1, // Stale version!
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Stale version update attempt',
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: {
            rumor: '소문: 사혼곡의 결계가 약화되었다.'
          }
        }
      ]
    };

    const res = engine.submitProposal(staleProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-09-CONC-STALE-VERSION',
      category: 'Concurrency, Idempotency & Stale State',
      name: 'Stale expectedStateVersion Concurrency Overwrite Attempt',
      targetComponent: 'EngineValidator.ts (State Version Consistency Check)',
      description: 'Submitting a proposal with an outdated expectedStateVersion.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate()',
      payload: staleProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('STALE_STATE_DETECTED') || r.includes('stateVersion mismatch')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: Stale proposal committed over newer state version!'
        : 'SECURE: State version mismatch was immediately caught and rejected.'
    });
  }

  // Attack 3.2: Replay Attack with Duplicate requestId / eventId
  {
    const engine = createSeededEngine();
    const snap1 = getLightSnapshot(engine);
    const validProposal: StateTransitionProposal = {
      proposalId: 'prop-replay-10',
      requestId: 'req-replay-10',
      eventId: 'evt-replay-10',
      expectedStateVersion: snap1.stateVersion,
      source: 'LLM',
      turn: snap1.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Legitimate rumor addition',
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: {
            rumor: '소문: 개방 방주가 낙양으로 오고 있다.'
          }
        }
      ]
    };

    const res1 = engine.submitProposal(validProposal);
    const snap2 = getLightSnapshot(engine);

    // Replay the exact same proposal with identical requestId/eventId
    const replayProposal: StateTransitionProposal = {
      ...validProposal,
      expectedStateVersion: snap2.stateVersion // Even if updated version is forged
    };

    const res2 = engine.submitProposal(replayProposal);
    const snap3 = getLightSnapshot(engine);
    const mutatedOnReplay = snap3.stateVersion !== snap2.stateVersion;

    results.push({
      attackId: 'ADV-10-CONC-REPLAY-ATTACK',
      category: 'Concurrency, Idempotency & Stale State',
      name: 'Replay Attack with Duplicate Request/Event ID Signatures',
      targetComponent: 'SovereignEngine.ts (Idempotency Set & Commit Gate)',
      description: 'Re-submitting an already committed proposal requestId/eventId signature.',
      pipelinePath: 'External Input -> SovereignEngine.submitProposal() -> Idempotency Check',
      payload: replayProposal,
      preStateSnapshot: snap2,
      postStateSnapshot: snap3,
      commitSuccess: res2.success,
      canonicalMutated: mutatedOnReplay,
      rejectedReasons: Array.from(res2.rejectedReasons),
      verdict: mutatedOnReplay ? 'BREAK' : (res2.rejectedReasons.some(r => r.includes('IDEMPOTENCY_VIOLATION') || r.includes('Duplicate')) ? 'HOLD' : 'PASS'),
      analysis: mutatedOnReplay
        ? 'CRITICAL BREAK: Duplicate proposal was executed twice!'
        : 'SECURE: Idempotency signature detected duplicate request and prevented re-execution.'
    });
  }

  // Attack 3.3: Mid-Proposal Atomic Rollback Integrity Check
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    // Action 1 is valid (ADD_RUMOR), Action 2 is invalid (Dead NPC Resurrection).
    // The entire proposal must fail ATOMICALLY without leaving Action 1 in Canonical State.
    const mixedProposal: StateTransitionProposal = {
      proposalId: 'prop-mixed-atomic-11',
      requestId: 'req-mixed-atomic-11',
      eventId: 'evt-mixed-atomic-11',
      expectedStateVersion: preSnap.stateVersion,
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Mixed valid and invalid actions to test atomic rollback',
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: {
            rumor: '소문: 유령 소문이 떠돌고 있다.'
          }
        },
        {
          type: 'SET_NPC_STATUS',
          payload: {
            id: 'npc-cheonma', // Canonically DEAD NPC
            status: 'ALIVE',
            reason: 'Malicious Resurrection Attempt'
          }
        }
      ]
    };

    const res = engine.submitProposal(mixedProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;
    const snap = engine.getSnapshot();
    const partialRumorAdded = snap.worldInfo.publicRumors.some(r => r.includes('유령 소문'));

    results.push({
      attackId: 'ADV-11-CONC-ATOMIC-ROLLBACK',
      category: 'Concurrency, Idempotency & Stale State',
      name: 'Intra-Proposal Atomic Rollback on Partial Action Invariant Failure',
      targetComponent: 'SovereignEngine.ts & EngineValidator.ts (Virtual Draft Rollback)',
      description: 'Submitting a proposal containing 1 valid action followed by 1 invalid action.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate() -> Rollback',
      payload: mixedProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated || partialRumorAdded,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: (mutated || partialRumorAdded) ? 'BREAK' : 'HOLD',
      analysis: (mutated || partialRumorAdded)
        ? 'CRITICAL BREAK: Partial mutation occurred; Action 1 was committed despite Action 2 failure!'
        : 'SECURE: Atomic virtual draft execution aborted entire proposal without partial state leakage.'
    });
  }

  // ============================================================================
  // ATTACK CATEGORY 4: INFORMATION ASYMMETRY & DECEASED ENTITY INTEGRITY
  // ============================================================================

  // Attack 4.1: Submitting UPDATE_NPC on Canonically Dead Character
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const updateDeadNpcProposal: StateTransitionProposal = {
      proposalId: 'prop-update-dead-12',
      requestId: 'req-update-dead-12',
      eventId: 'evt-update-dead-12',
      expectedStateVersion: preSnap.stateVersion,
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Update affinity and thoughts of deceased NPC 천마',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-cheonma',
            changes: {
              affinity: 100,
              innerThought: '부활하여 복수하겠다.'
            }
          }
        }
      ]
    };

    const res = engine.submitProposal(updateDeadNpcProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-12-INFO-DEAD-NPC-UPDATE',
      category: 'Information Asymmetry & Deceased Entity Integrity',
      name: 'Direct UPDATE_NPC State Mutation on Deceased NPC',
      targetComponent: 'EngineValidator.ts (UPDATE_NPC Deceased Permanence Guard)',
      description: 'Attempting to mutate affinity/thoughts of a dead NPC.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate(UPDATE_NPC)',
      payload: updateDeadNpcProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('DEAD') || r.includes('deceased')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: Deceased NPC properties were mutated!'
        : 'SECURE: EngineValidator strictly prevented property updates on DEAD NPC.'
    });
  }

  // Attack 4.2: Un-met NPC Knowledge Leakage via Candidate Packet
  {
    const engine = createSeededEngine();
    const currentSnap = engine.getSnapshot();
    const candidateWithMetaLeak: CandidatePacket = {
      timestamp: new Date().toISOString(),
      npcChanges: [
        {
          name: '혈영살수', // Currently UNMET / metInStory: false
          innerThought: '오늘 밤 주인공의 목을 벨 계획이다.', // Leaked internal secret
          metInStory: false
        }
      ]
    };

    const proposal = buildSafeProposalFromCandidate(currentSnap, candidateWithMetaLeak, currentSnap.turn);
    const safeAction = proposal.actions.find(a => a.type === 'UPDATE_NPC') as any;
    const innerThoughtEscaped = safeAction?.payload?.changes?.innerThought !== '[미인지 상태]';

    results.push({
      attackId: 'ADV-13-INFO-UNMET-NPC-LEAK',
      category: 'Information Asymmetry & Deceased Entity Integrity',
      name: 'Un-met NPC Omniscient Inner Thought Leakage via Candidate Packet',
      targetComponent: 'proposalParser.ts (Rule 1: Un-met NPC Meta-Knowledge Defense)',
      description: 'Testing if buildSafeProposalFromCandidate sanitizes innerThought for un-met NPCs.',
      pipelinePath: 'CandidatePacket -> buildSafeProposalFromCandidate() -> Sanitized Proposal',
      payload: candidateWithMetaLeak,
      preStateSnapshot: getLightSnapshot(engine),
      postStateSnapshot: getLightSnapshot(engine),
      commitSuccess: !innerThoughtEscaped,
      canonicalMutated: false,
      rejectedReasons: innerThoughtEscaped ? ['Inner thought leaked past Rule 1 defense'] : [],
      verdict: innerThoughtEscaped ? 'BREAK' : 'HOLD',
      analysis: innerThoughtEscaped
        ? 'CRITICAL BREAK: Un-met NPC inner thought leaked into proposal without [미인지 상태] masking!'
        : 'SECURE: Rule 1 strictly forced [미인지 상태] for un-met NPC innerThought.'
    });
  }

  // Attack 4.3: Narrative Seed Resolution of Already Resolved Seed
  {
    const engine = createSeededEngine();
    // Turn 2: Resolve active seed
    dispatchEngineInternalAction(engine, [
      {
        type: 'RESOLVE_NARRATIVE_SEED',
        payload: {
          id: 'seed-secret-scroll',
          resolutionSummary: '자하신공 비급을 완전히 획득하여 복선이 완결됨.'
        }
      }
    ], 'Seed Resolution in Turn 2');

    const preSnap = getLightSnapshot(engine);
    // Turn 3: Attempt to resolve the already resolved seed again with different summary
    const reResolveProposal: StateTransitionProposal = {
      proposalId: 'prop-re-resolve-seed-14',
      requestId: 'req-re-resolve-seed-14',
      eventId: 'evt-re-resolve-seed-14',
      expectedStateVersion: preSnap.stateVersion,
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Attempt to re-resolve already resolved seed',
      actions: [
        {
          type: 'RESOLVE_NARRATIVE_SEED',
          payload: {
            id: 'seed-secret-scroll',
            resolutionSummary: '조작된 결말: 비급은 가짜였다.'
          }
        }
      ]
    };

    const res = engine.submitProposal(reResolveProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-14-INFO-RE-RESOLVE-SEED',
      category: 'Information Asymmetry & Deceased Entity Integrity',
      name: 'Double Resolution / Mutation of Canonically Resolved Narrative Seed',
      targetComponent: 'EngineValidator.ts (RESOLVE_NARRATIVE_SEED Immutability Guard)',
      description: 'Attempting to resolve a narrative seed that is already in resolved status.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate(RESOLVE_NARRATIVE_SEED)',
      payload: reResolveProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('resolved') || r.includes('already resolved')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: Already resolved narrative seed was re-resolved/mutated!'
        : 'SECURE: EngineValidator verified that only active seeds can be resolved.'
    });
  }

  // ============================================================================
  // ATTACK CATEGORY 5: MATHEMATICAL & DETERMINISTIC ENGINE INVARIANTS
  // ============================================================================

  // Attack 5.1: Target DC Out-of-Range Injection (< 1 or > 20)
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    const outOfRangeDcProposal: StateTransitionProposal = {
      proposalId: 'prop-dc-range-15',
      requestId: 'req-dc-range-15',
      eventId: 'evt-dc-range-15',
      expectedStateVersion: preSnap.stateVersion,
      source: 'PLAYER',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Record dice result with impossible targetDC 99',
      actions: [
        {
          type: 'RECORD_DICE_RESULT',
          payload: {
            targetDC: 99, // Impossible DC
            roll: 15,
            success: false,
            statUsed: 'strength',
            narrativeContext: '절벽 오르기'
          }
        }
      ]
    };

    const res = engine.submitProposal(outOfRangeDcProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-15-MATH-DC-RANGE-VIOLATION',
      category: 'Mathematical & Deterministic Engine Invariants',
      name: 'Target DC Range Boundary Violation (targetDC: 99)',
      targetComponent: 'EngineValidator.ts (DC 1-20 Invariant Gate)',
      description: 'Attempting to record a dice result with targetDC outside the constitutional 1-20 range.',
      pipelinePath: 'Player -> SovereignEngine.submitProposal() -> EngineValidator.validate(RECORD_DICE_RESULT)',
      payload: outOfRangeDcProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('targetDC')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: Impossible Target DC 99 recorded in canonical dcHistory!'
        : 'SECURE: EngineValidator strictly enforced DC range 1-20.'
    });
  }

  // Attack 5.2: Faction Total Influence Overflow (> 100%)
  {
    const engine = createSeededEngine();
    const preSnap = getLightSnapshot(engine);
    // Current factions: Hwashan (40), Magyo (40) -> Total 80%.
    // Attempt to add Shaolin with 35% influence -> Total 115% (> 100%).
    const factionOverflowProposal: StateTransitionProposal = {
      proposalId: 'prop-faction-overflow-16',
      requestId: 'req-faction-overflow-16',
      eventId: 'evt-faction-overflow-16',
      expectedStateVersion: preSnap.stateVersion,
      source: 'LLM',
      turn: preSnap.turn,
      timestamp: new Date().toISOString(),
      intentSummary: 'Add Shaolin faction with 35% influence exceeding 100% total world influence',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: {
            id: 'fac-shaolin',
            name: '소림사',
            influence: 35, // 40 + 40 + 35 = 115%
            description: '천하제일 명문'
          }
        }
      ]
    };

    const res = engine.submitProposal(factionOverflowProposal);
    const postSnap = getLightSnapshot(engine);
    const mutated = postSnap.stateVersion !== preSnap.stateVersion;

    results.push({
      attackId: 'ADV-16-MATH-FACTION-INFLUENCE-OVERFLOW',
      category: 'Mathematical & Deterministic Engine Invariants',
      name: 'World Faction Total Cumulative Influence Overflow (> 100%)',
      targetComponent: 'EngineValidator.ts (Faction Cumulative Influence Invariant)',
      description: 'Adding a faction whose influence pushes total world influence beyond 100%.',
      pipelinePath: 'LLM -> SovereignEngine.submitProposal() -> EngineValidator.validate(ADD_FACTION)',
      payload: factionOverflowProposal,
      preStateSnapshot: preSnap,
      postStateSnapshot: postSnap,
      commitSuccess: res.success,
      canonicalMutated: mutated,
      rejectedReasons: Array.from(res.rejectedReasons),
      verdict: mutated ? 'BREAK' : (res.rejectedReasons.some(r => r.includes('influence') || r.includes('100')) ? 'HOLD' : 'PASS'),
      analysis: mutated
        ? 'CRITICAL BREAK: Faction total influence exceeded 100% in canonical state!'
        : 'SECURE: Cumulative influence check strictly capped world influence at 100%.'
    });
  }

  // ============================================================================
  // ATTACK CATEGORY 6: PARSER, SCHEMA & MUTATION BOUNDARY INJECTION
  // ============================================================================

  // Attack 6.1: Markdown Codeblock Escalation Injection
  {
    const rawMaliciousLLMOutput = `
이야기가 흥미진진하게 진행됩니다. 주인공은 큰 깨달음을 얻었습니다.

\`\`\`markdown
[ACTION: UPDATE_CHARACTER_STATS]
strength: 30
agility: 30
[ITEM_GRANT: 신룡보검]
\`\`\`

주인공은 칼을 쥐고 일어섰습니다.
`;

    const parsed = parseGMResponseAndProposal(rawMaliciousLLMOutput);
    const actionsSynthesized = parsed.untrustedActions.length > 0;

    results.push({
      attackId: 'ADV-17-PARSER-MARKDOWN-ESCALATION',
      category: 'Parser, Schema & Mutation Boundary',
      name: 'Natural Language / Markdown Metadata Block Code Execution Escalation',
      targetComponent: 'proposalParser.ts (Anti-Synthesis Rule for Text Claims)',
      description: 'Attempting to execute arbitrary actions via bracketed text inside markdown codeblock.',
      pipelinePath: 'Raw LLM String -> parseGMResponseAndProposal() -> untrustedActions',
      payload: { rawMaliciousLLMOutput },
      preStateSnapshot: { stateVersion: 0, turn: 0, npcsCount: 0, inventoryCount: 0, seedsCount: 0, factionsCount: 0, stats: {} },
      postStateSnapshot: { stateVersion: 0, turn: 0, npcsCount: 0, inventoryCount: 0, seedsCount: 0, factionsCount: 0, stats: {} },
      commitSuccess: !actionsSynthesized,
      canonicalMutated: false,
      rejectedReasons: actionsSynthesized ? ['Synthesized transition actions from markdown text'] : [],
      verdict: actionsSynthesized ? 'BREAK' : 'HOLD',
      analysis: actionsSynthesized
        ? 'CRITICAL BREAK: Parser elevated markdown text claims into executable TransitionActions!'
        : 'SECURE: Markdown blocks are strictly captured as rawClaims for diagnostic context, never synthesized as executable actions.'
    });
  }

  // Attack 6.2: Mutation Boundary Subsetting Violation (Payload Tampering)
  {
    const approvedProposal: StateTransitionProposal = {
      proposalId: 'prop-approved-18',
      requestId: 'req-approved-18',
      eventId: 'evt-approved-18',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date().toISOString(),
      intentSummary: 'Approved candidate turn',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: {
              id: 'item-herb-01',
              name: '영지초',
              quantity: 1
            },
            acquisition: {
              cause: 'INITIAL_EQUIPMENT'
            }
          }
        }
      ]
    };

    // Attacker modifies final payload to inflate quantity from 1 to 99
    const tamperedFinalProposal: StateTransitionProposal = {
      ...approvedProposal,
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: {
              id: 'item-herb-01',
              name: '영지초',
              quantity: 99 // Inflated quantity!
            },
            acquisition: {
              cause: 'INITIAL_EQUIPMENT'
            }
          }
        }
      ]
    };

    const boundaryCheck = validateLLM2MutationBoundary(approvedProposal, tamperedFinalProposal);

    results.push({
      attackId: 'ADV-18-MUT-BOUNDARY-INFLATION',
      category: 'Parser, Schema & Mutation Boundary',
      name: 'Mutation Boundary Subsetting Violation (Item Quantity Inflation)',
      targetComponent: 'mutationBoundary.ts (validateLLM2MutationBoundary)',
      description: 'Tampering with the final action payload to exceed the candidate-approved quantity.',
      pipelinePath: 'Approved Candidate -> Tampered Final Proposal -> validateLLM2MutationBoundary()',
      payload: { approvedProposal, tamperedFinalProposal },
      preStateSnapshot: { stateVersion: 0, turn: 0, npcsCount: 0, inventoryCount: 0, seedsCount: 0, factionsCount: 0, stats: {} },
      postStateSnapshot: { stateVersion: 0, turn: 0, npcsCount: 0, inventoryCount: 0, seedsCount: 0, factionsCount: 0, stats: {} },
      commitSuccess: !boundaryCheck.isValid,
      canonicalMutated: false,
      rejectedReasons: boundaryCheck.violationReasons,
      verdict: boundaryCheck.isValid ? 'BREAK' : 'HOLD',
      analysis: boundaryCheck.isValid
        ? 'CRITICAL BREAK: Mutation boundary accepted quantity-inflated tampered action!'
        : 'SECURE: checkMutationBoundary caught quantity inflation and blocked execution.'
    });
  }

  // Calculate overall metrics
  const breaks = results.filter(r => r.verdict === 'BREAK').length;
  const holds = results.filter(r => r.verdict === 'HOLD').length;
  const passes = results.filter(r => r.verdict === 'PASS').length;

  return {
    timestamp,
    totalAttacks: results.length,
    breaks,
    holds,
    passes,
    results
  };
}

// Execute and generate forensic reports
const suiteResult = runAdversarialRedTeamSuite();

const reportDir = path.join(process.cwd(), 'report', '07_5_7_direct_adversarial_redteam');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// 1. Save Raw Evidence JSON (Strict Immutable Evidence Rule)
const rawEvidencePath = path.join(reportDir, '5_7_direct_adversarial_raw_evidence.json');
fs.writeFileSync(rawEvidencePath, JSON.stringify(suiteResult, null, 2), 'utf-8');

// 2. Generate Comprehensive Text Report
let reportText = `================================================================================
TRPG 3.1 5.7 DIRECT ADVERSARIAL RED TEAM AUDIT REPORT
TIMESTAMP: ${suiteResult.timestamp}
TARGET: TRPG 3.1 5.7 Runtime (SovereignEngine, EngineValidator, MutationBoundary, ProposalParser)
TOTAL ADVERSARIAL ATTACK VECTORS TESTED: ${suiteResult.totalAttacks}
VERDICT BREAKDOWN:
  - CRITICAL BREAKS (Mutations/Bypasses Succeeded): ${suiteResult.breaks} / ${suiteResult.totalAttacks}
  - HOLDS (Attacks Authoritatively Blocked/Contained): ${suiteResult.holds} / ${suiteResult.totalAttacks}
  - PASSES: ${suiteResult.passes} / ${suiteResult.totalAttacks}

FINAL MISSION VERDICT: ${suiteResult.breaks > 0 ? 'CRITICAL SYSTEM BREAKS DETECTED' : 'SYSTEM HOLDS AGAINST ALL DIRECT ATTACK VECTORS'}
================================================================================

EXHAUSTIVE ATTACK-BY-ATTACK AUDIT EVIDENCE:

`;

for (const res of suiteResult.results) {
  reportText += `--------------------------------------------------------------------------------
[ATTACK ID]:         ${res.attackId}
[CATEGORY]:          ${res.category}
[NAME]:              ${res.name}
[TARGET COMPONENT]:  ${res.targetComponent}
[VERDICT]:           ${res.verdict}
[DESCRIPTION]:
${res.description}

[RUNTIME PIPELINE PATH]:
${res.pipelinePath}

[ATTACK PAYLOAD]:
${JSON.stringify(res.payload, null, 2)}

[EXECUTION RESULTS]:
  Commit Success:       ${res.commitSuccess}
  Canonical Mutated:    ${res.canonicalMutated}
  Rejected Reasons:     ${res.rejectedReasons.length > 0 ? res.rejectedReasons.join(' | ') : 'None'}
  Pre-State Version:    ${res.preStateSnapshot.stateVersion}
  Post-State Version:   ${res.postStateSnapshot.stateVersion}

[ANALYSIS & FINDING]:
${res.analysis}
`;
}

const reportSummaryPath = path.join(reportDir, '5_7_DIRECT_ADVERSARIAL_REDTEAM_REPORT.txt');
fs.writeFileSync(reportSummaryPath, reportText, 'utf-8');

console.log(`\n========================================`);
console.log(`5.7 DIRECT ADVERSARIAL RED TEAM COMPLETED`);
console.log(`Total Attacks: ${suiteResult.totalAttacks}`);
console.log(`Breaks:        ${suiteResult.breaks}`);
console.log(`Holds:         ${suiteResult.holds}`);
console.log(`Passes:        ${suiteResult.passes}`);
console.log(`Raw Evidence:  ${rawEvidencePath}`);
console.log(`Summary Report: ${reportSummaryPath}`);
console.log(`========================================\n`);
