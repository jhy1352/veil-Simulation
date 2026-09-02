/**
 * @file src/engine/index/entityIdentityResolverTest.ts
 * @description Unit & Integration Tests for Canonical Entity Identity Resolver & Continuity
 */

import { CanonicalState, ImmutableHistoricalRecord } from '../types';
import { CandidatePacket } from '../../types';
import {
  resolveEntityIdentity,
  resolveInventoryItemIdentity,
  resolveCandidateInventoryIdentity,
  resolveNpcIdentity,
  resolveFactionIdentity,
  resolveNarrativeSeedIdentity,
  resolveCharacterIdentity,
  hasPositiveNoveltyEvidence,
  buildInventoryIdentityGraph
} from './entityIdentityResolver';
import { buildSafeProposalFromCandidate } from '../proposalParser';
import { validateCandidateStructure, runCandidateRecoveryGate } from '../language/candidateRecoveryGate';
import { SovereignEngine } from '../state';
import { EngineValidator } from '../validator';

function createMockState(): CanonicalState {
  return {
    stateVersion: 1,
    turn: 1,
    lastCommittedEventId: 'evt-init',
    lastCommittedAt: new Date().toISOString(),
    worldInfo: {
      worldName: '무림세계',
      worldType: 'popular_genre',
      settingDescription: '중원 무림',
      toneStyle: '진지함',
      npcs: [
        { id: 'npc-abbot', name: '방장 스님', alias: '현공 대사', affiliation: '소림사', status: 'ALIVE' }
      ],
      factions: [
        { id: 'fac-shaolin', name: '소림사', description: '천하제일 명문정파', attitudeTowardsPlayer: 'FRIENDLY' }
      ],
      publicRumors: [],
      secretLore: [],
      seeds: [],
      chapters: {
        currentChapter: '1장 입문',
        upcomingChapters: ['2장 수련']
      },
      dcHistory: [],
      unresolvedForeshadows: [],
      cameraOffscreenEvents: []
    },
    character: {
      name: '이청',
      title: '검객',
      gender: '남',
      age: 20,
      appearance: '준수한 청년',
      goal: '무림지존',
      originBackground: '평범한 출신',
      backgroundType: 'preset',
      flaw: '성급함',
      flawType: 'preset',
      oath: '정의수호',
      oathType: 'preset',
      anchor: '사형',
      anchorType: 'preset',
      faction: '소림사',
      factionType: 'preset',
      stats: {
        strength: 12,
        agility: 14,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 8
      },
      inventory: [
        { id: 'item-iron-sword', name: '철검', quantity: 1, description: '평범한 철검' },
        { id: 'item-ancestral-blade', name: '가보의 보검', quantity: 1, description: '가문 대대로 내려온 보검' }
      ]
    }
  };
}

export function runEntityIdentityTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${testName}`);
    } else {
      failed++;
      const msg = `  ✗ ${testName} - ${detail || 'Assertion failed'}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  console.log('\n=== Running VEIL Canonical Entity Identity Resolver Test Suite ===\n');

  const state = createMockState();
  const history: ImmutableHistoricalRecord[] = [
    {
      recordId: 'rec-1',
      eventId: 'evt-1',
      proposalId: 'prop-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      source: 'ENGINE_INTERNAL',
      actionType: 'MODIFY_INVENTORY',
      details: 'Acquired item-iron-sword during training',
      stateVersionAfterCommit: 1
    }
  ];

  // Test A: Exact Match with Valid Claimed ID
  {
    const resolution = resolveInventoryItemIdentity(state, history, '철검', {
      entityType: 'ITEM',
      claimedEntityId: 'item-iron-sword',
      evidence: { context: '전투 중 사용' }
    });
    assert(resolution.status === 'EXACT', 'Test A1: Exact match status');
    assert(resolution.canonicalId === 'item-iron-sword', 'Test A2: Canonical ID preserved');

    // Proposal Parser Integration
    const candidate: CandidatePacket = {
      candidateId: 'cand-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            claimedEntityId: 'item-iron-sword',
            evidence: { context: '전투 중 파손' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!!invAction, 'Test A3: Proposal contains inventory action');
    assert(invAction?.payload?.item?.id === 'item-iron-sword', 'Test A4: Proposal maintains canonical ID');
  }

  // Test B: Recovered Identity when Claimed ID is missing but Name matches uniquely
  {
    const resolution = resolveInventoryItemIdentity(state, history, '가보의 보검', {
      entityType: 'ITEM',
      evidence: { sourceNpcId: 'npc-abbot', context: '방장에게 건넴' }
    });
    assert(resolution.status === 'RECOVERED', 'Test B1: Recovered status without LLM ID');
    assert(resolution.canonicalId === 'item-ancestral-blade', 'Test B2: Recovered exact canonical ID');

    const candidate: CandidatePacket = {
      candidateId: 'cand-2',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '가보의 보검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: { sourceNpcId: 'npc-abbot', context: '방장에게 건넴' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!!invAction, 'Test B3: Recovered proposal contains inventory action');
    assert(invAction?.payload?.item?.id === 'item-ancestral-blade', 'Test B4: Recovered ID used in proposal');
  }

  // Test C: Homonym / Ambiguity Blocks Mutation
  {
    // Duplicate item name in state
    const ambiguousState = createMockState();
    ambiguousState.character.inventory.push({
      id: 'item-pot-2',
      name: '철검',
      quantity: 1,
      description: '또 다른 철검'
    });
    const resolution = resolveInventoryItemIdentity(ambiguousState, history, '철검', {
      entityType: 'ITEM',
      evidence: { context: '사용' }
    });
    assert(resolution.status === 'AMBIGUOUS', 'Test C1: Ambiguous status for multiple matches');

    const candidate: CandidatePacket = {
      candidateId: 'cand-3',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: { context: '사용' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(ambiguousState, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!invAction, 'Test C2: Ambiguous item mutation is strictly blocked in proposal');
  }

  // Test D: Conflict on Bogus or Mismatched Claimed ID
  {
    const resolution = resolveInventoryItemIdentity(state, history, '철검', {
      entityType: 'ITEM',
      claimedEntityId: 'item-non-existent-999',
      evidence: { context: '사용' }
    });
    assert(resolution.status === 'CONFLICT', 'Test D1: Conflict on non-existent claimed ID');

    const resolution2 = resolveInventoryItemIdentity(state, history, '철검', {
      entityType: 'ITEM',
      claimedEntityId: 'item-ancestral-blade', // points to '가보의 보검', not '철검'
      evidence: { context: '사용' }
    });
    assert(resolution2.status === 'CONFLICT', 'Test D2: Conflict on name-ID mismatch');

    const candidate: CandidatePacket = {
      candidateId: 'cand-4',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            claimedEntityId: 'item-ancestral-blade',
            evidence: { context: '사용' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!invAction, 'Test D3: Conflicting item mutation is blocked in proposal');
  }

  // Test E: Index Miss without Novelty Evidence -> AMBIGUOUS (Mutation Prohibited)
  {
    const resolution = resolveInventoryItemIdentity(state, history, '미확인 보물', {
      entityType: 'ITEM',
      evidence: {} // No positive evidence
    });
    assert(resolution.status === 'AMBIGUOUS', 'Test E1: Index miss without evidence is AMBIGUOUS, not NOVEL');
    assert(!resolution.canonicalId, 'Test E2: No canonical ID issued');

    const candidate: CandidatePacket = {
      candidateId: 'cand-5',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '미확인 보물',
          action: 'add',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: {}
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!invAction, 'Test E3: Index miss without evidence is blocked from mutating state');
  }

  // Test F: Legitimate Novel Entity with Positive Acquisition Evidence -> NOVEL
  {
    const resolution = resolveInventoryItemIdentity(state, history, '청룡언월도', {
      entityType: 'ITEM',
      evidence: {
        cause: 'DUNGEON_REWARD',
        context: '비경을 탐색하고 획득함',
        sourceNpcId: 'npc-abbot'
      }
    });
    assert(resolution.status === 'NOVEL', 'Test F1: NOVEL status granted when positive evidence exists');
    assert(resolution.canonicalId === undefined, 'Test F2: Resolver does NOT issue ID');

    const candidate: CandidatePacket = {
      candidateId: 'cand-6',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '청룡언월도',
          action: 'add',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'DUNGEON_REWARD',
              context: '비경을 탐색하고 획득함'
            }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(state, candidate, 1, history);
    const invAction = prop.actions.find(a => a.type === 'MODIFY_INVENTORY');
    assert(!!invAction, 'Test F3: Engine allocates new canonical ID and produces proposal');
    assert(typeof invAction?.payload?.item?.id === 'string' && invAction.payload.item.id.startsWith('item-'), 'Test F4: Engine generated item ID prefix');
    assert(invAction?.payload?.item?.entityReference?.resolvedEntityId === invAction?.payload?.item?.id, 'Test F5: Engine transient resolvedEntityId populated');
  }

  // Test Gate: Candidate Recovery Gate Validation
  {
    // Valid candidate with complete entityReference bundle
    const validCandidate = {
      candidateId: 1,
      label: 'Valid Option',
      narrativeSummary: 'Summary',
      rawMetadata: {
        inventoryChanges: [
          {
            name: '철검',
            quantity: 1,
            action: 'add',
            entityReference: {
              entityType: 'ITEM',
              evidence: { cause: 'PURCHASE' }
            }
          }
        ]
      }
    };
    const gateRes = runCandidateRecoveryGate([validCandidate]);
    assert(gateRes.passedCount === 1, 'Gate Test 1: Complete bundle passes gate');

    // Missing entityReference bundle -> quarantined
    const missingRefCandidate = {
      candidateId: 2,
      label: 'Corrupted Option',
      narrativeSummary: 'Summary',
      rawMetadata: {
        inventoryChanges: [
          {
            name: '철검',
            quantity: 1,
            action: 'add'
            // missing entityReference
          }
        ]
      }
    };
    const gateRes2 = runCandidateRecoveryGate([missingRefCandidate]);
    assert(gateRes2.quarantinedCount === 1, 'Gate Test 2: Missing entityReference bundle is quarantined');

    // LLM attempts to forge resolvedEntityId -> quarantined
    const forgedResolvedCandidate = {
      candidateId: 3,
      label: 'Forged Option',
      narrativeSummary: 'Summary',
      rawMetadata: {
        inventoryChanges: [
          {
            name: '철검',
            quantity: 1,
            action: 'add',
            entityReference: {
              entityType: 'ITEM',
              evidence: { cause: 'LOOT' },
              resolvedEntityId: 'forged-item-id-from-llm'
            }
          }
        ]
      }
    };
    const gateRes3 = runCandidateRecoveryGate([forgedResolvedCandidate]);
    assert(gateRes3.quarantinedCount === 1, 'Gate Test 3: LLM-supplied resolvedEntityId is quarantined');
  }

  // ==========================================
  // Test Suite: NPC Identity Continuity
  // ==========================================
  console.log('\n--- NPC Identity Continuity Tests ---');
  {
    // Test NPC-1: Exact Match by Name & ID
    const res1 = resolveNpcIdentity(state, history, '방장 스님', {
      entityType: 'NPC',
      claimedEntityId: 'npc-abbot',
      evidence: { context: '대화' }
    });
    assert(res1.status === 'EXACT', 'NPC Test 1: Exact match status');
    assert(res1.canonicalId === 'npc-abbot', 'NPC Test 1: Preserves canonical ID');

    // Test NPC-2: Recovered Match (Alias or Name without Claimed ID)
    const res2 = resolveNpcIdentity(state, history, '현공 대사', {
      entityType: 'NPC',
      evidence: { context: '법당에서 마주침' }
    });
    assert(res2.status === 'RECOVERED', 'NPC Test 2: Recovered by alias');
    assert(res2.canonicalId === 'npc-abbot', 'NPC Test 2: Matches canonical ID npc-abbot');

    // Test NPC-3: Novel NPC with Valid Historical Event Evidence
    const res3 = resolveNpcIdentity(state, history, '장삼봉', {
      entityType: 'NPC',
      evidence: {
        cause: 'MET_DURING_STORY',
        verifiedEventId: 'evt-1',
        context: '무당파 장문인을 만남'
      }
    });
    assert(res3.status === 'NOVEL', 'NPC Test 3: Novel status with valid verifiedEventId');
    assert(res3.canonicalId === undefined, 'NPC Test 3: Resolver does not issue ID');

    // Test NPC-4: Index Miss without Evidence -> AMBIGUOUS
    const res4 = resolveNpcIdentity(state, history, '괴한', {
      entityType: 'NPC',
      evidence: {}
    });
    assert(res4.status === 'AMBIGUOUS', 'NPC Test 4: Index miss without evidence is AMBIGUOUS');

    // Test NPC-5: Conflict on Mismatched Claimed ID
    const res5 = resolveNpcIdentity(state, history, '방장 스님', {
      entityType: 'NPC',
      claimedEntityId: 'npc-wrong-id-999',
      evidence: { context: '대화' }
    });
    assert(res5.status === 'CONFLICT', 'NPC Test 5: Conflict on bogus claimed ID');
  }

  // ==========================================
  // Test Suite: FACTION Identity Continuity
  // ==========================================
  console.log('\n--- Faction Identity Continuity Tests ---');
  {
    // Test FAC-1: Exact Match
    const res1 = resolveFactionIdentity(state, history, '소림사', {
      entityType: 'FACTION',
      claimedEntityId: 'fac-shaolin',
      evidence: { context: '방문' }
    });
    assert(res1.status === 'EXACT', 'Faction Test 1: Exact match');
    assert(res1.canonicalId === 'fac-shaolin', 'Faction Test 1: Preserves fac-shaolin ID');

    // Test FAC-2: Recovered Match
    const res2 = resolveFactionIdentity(state, history, '소림사', {
      entityType: 'FACTION',
      evidence: { context: '문파 교류' }
    });
    assert(res2.status === 'RECOVERED', 'Faction Test 2: Recovered without claimed ID');
    assert(res2.canonicalId === 'fac-shaolin', 'Faction Test 2: Matches fac-shaolin');

    // Test FAC-3: Novel Faction with Cause
    const res3 = resolveFactionIdentity(state, history, '무당파', {
      entityType: 'FACTION',
      evidence: {
        cause: 'ENCOUNTERED_NEW_FACTION',
        context: '호북성에서 무당파를 접함'
      }
    });
    assert(res3.status === 'NOVEL', 'Faction Test 3: Novel faction with cause');

    // Test FAC-4: Index Miss without Cause -> AMBIGUOUS
    const res4 = resolveFactionIdentity(state, history, '비밀결사', {
      entityType: 'FACTION',
      evidence: {}
    });
    assert(res4.status === 'AMBIGUOUS', 'Faction Test 4: Index miss without evidence is AMBIGUOUS');
  }

  // ==========================================
  // Test Suite: NARRATIVE_SEED Identity Continuity
  // ==========================================
  console.log('\n--- Narrative Seed Identity Continuity Tests ---');
  {
    const stateWithSeed = createMockState();
    stateWithSeed.worldInfo.seeds = [
      { id: 'seed-stolen-manual', content: '도난당한 비급의 행방', status: 'active', turnCreated: 1 }
    ];

    // Test SEED-1: Exact Match
    const res1 = resolveNarrativeSeedIdentity(stateWithSeed, history, '도난당한 비급의 행방', {
      entityType: 'NARRATIVE_SEED',
      claimedEntityId: 'seed-stolen-manual',
      evidence: { context: '단서 발견' }
    });
    assert(res1.status === 'EXACT', 'Seed Test 1: Exact match');
    assert(res1.canonicalId === 'seed-stolen-manual', 'Seed Test 1: Matches seed-stolen-manual');

    // Test SEED-2: Novel Seed with Valid Evidence
    const res2 = resolveNarrativeSeedIdentity(stateWithSeed, history, '동굴 속의 흑영', {
      entityType: 'NARRATIVE_SEED',
      evidence: {
        cause: 'DISCOVERED_FORESHADOW',
        context: '동굴 탐험 중 기이한 그림자를 봄'
      }
    });
    assert(res2.status === 'NOVEL', 'Seed Test 2: Novel seed with cause');

    // Test SEED-3: Index Miss without Evidence -> AMBIGUOUS
    const res3 = resolveNarrativeSeedIdentity(stateWithSeed, history, '알 수 없는 소문', {
      entityType: 'NARRATIVE_SEED',
      evidence: {}
    });
    assert(res3.status === 'AMBIGUOUS', 'Seed Test 3: Index miss without evidence is AMBIGUOUS');

    // Test SEED-4: Resolution Proposal
    const candidate: CandidatePacket = {
      candidateId: 'cand-seed-res',
      turn: 1,
      timestamp: new Date().toISOString(),
      seedChanges: [
        {
          content: '도난당한 비급의 행방',
          status: 'resolved',
          action: 'resolve',
          resolutionSummary: '도적을 제압하고 비급을 회수함',
          entityReference: {
            entityType: 'NARRATIVE_SEED',
            claimedEntityId: 'seed-stolen-manual',
            evidence: { context: '해결' }
          }
        }
      ]
    };
    const prop = buildSafeProposalFromCandidate(stateWithSeed, candidate, 1, history);
    const resolveAction = prop.actions.find(a => a.type === 'RESOLVE_NARRATIVE_SEED');
    assert(!!resolveAction, 'Seed Test 4: Proposal contains RESOLVE_NARRATIVE_SEED');
    assert(resolveAction?.payload?.id === 'seed-stolen-manual', 'Seed Test 4: Resolves exact seed canonical ID');
  }

  // ==========================================
  // Test Suite: CHARACTER Identity Continuity
  // ==========================================
  console.log('\n--- Character Identity Continuity Tests ---');
  {
    // Test Char-1: Recovered by unique protagonist name
    const res1 = resolveCharacterIdentity(state, history, '이청', {
      entityType: 'CHARACTER',
      evidence: { context: '주인공 행동' }
    });
    assert(res1.status === 'RECOVERED', 'Character Test 1: Matches protagonist without claimed ID');
    assert(res1.canonicalId === 'protagonist', 'Character Test 1: Canonical ID is protagonist');

    // Test Char-2: Exact match with claimedEntityId: 'protagonist'
    const res2 = resolveCharacterIdentity(state, history, '이청', {
      entityType: 'CHARACTER',
      claimedEntityId: 'protagonist',
      evidence: { context: '주인공 직접 판정' }
    });
    assert(res2.status === 'EXACT', 'Character Test 2: Exact match with claimed protagonist ID');
    assert(res2.canonicalId === 'protagonist', 'Character Test 2: Preserves protagonist ID');

    // Test Char-3: Mismatch on claimedEntityId: 'protagonist' with wrong name
    const res3 = resolveCharacterIdentity(state, history, '가짜주인공', {
      entityType: 'CHARACTER',
      claimedEntityId: 'protagonist',
      evidence: {}
    });
    assert(res3.status === 'CONFLICT', 'Character Test 3: Mismatched character name against claimed protagonist ID produces CONFLICT');

    // Test Char-4: Conflicting character identity in candidate packet blocks stat changes
    const spoofedCharCandidate: CandidatePacket = {
      candidateId: 'cand-char-spoof',
      turn: 1,
      timestamp: new Date().toISOString(),
      characterChanges: {
        name: '가짜주인공',
        entityReference: {
          entityType: 'CHARACTER',
          claimedEntityId: 'protagonist',
          evidence: {}
        }
      },
      statChanges: [{ stat: 'strength', delta: 5 }]
    };
    const spoofedProp = buildSafeProposalFromCandidate(state, spoofedCharCandidate, 1, history);
    const hasStatAction = spoofedProp.actions.some(a => a.type === 'UPDATE_CHARACTER_STATS');
    assert(!hasStatAction, 'Character Test 4: Conflicting character identity strictly blocks character stat mutations');
  }

  // ==========================================
  // Test Suite: End-to-End Pipeline (EOF) Verification
  // ==========================================
  console.log('\n--- Full EOF Pipeline & SovereignEngine Commit Tests ---');
  {
    const engine = new SovereignEngine(state.worldInfo, state.character, history, state.stateVersion, state.turn);

    // 1. Candidate with Item, NPC, Faction, Seed changes
    const validCandidatePacket: CandidatePacket = {
      candidateId: 'cand-eof-1',
      turn: 1,
      timestamp: new Date().toISOString(),
      inventoryChanges: [
        {
          name: '철검',
          action: 'remove',
          quantity: 1,
          entityReference: {
            entityType: 'ITEM',
            claimedEntityId: 'item-iron-sword',
            evidence: { context: '사용 후 마모' }
          }
        },
        {
          name: '벽력탄',
          action: 'add',
          quantity: 2,
          entityReference: {
            entityType: 'ITEM',
            evidence: {
              cause: 'PURCHASE',
              context: '대장간에서 구매'
            }
          }
        }
      ],
      npcChanges: [
        {
          name: '방장 스님',
          innerThought: '젊은 검객의 자질이 뛰어나구나.',
          metInStory: true,
          entityReference: {
            entityType: 'NPC',
            claimedEntityId: 'npc-abbot',
            evidence: { context: '수련 대화' }
          }
        },
        {
          name: '화산파 장문인',
          npcClass: 'MAJOR_NAMED',
          metInStory: true,
          entityReference: {
            entityType: 'NPC',
            evidence: {
              cause: 'FIRST_ENCOUNTER',
              context: '화산파 본산 방문'
            }
          }
        }
      ],
      factionChanges: [
        {
          name: '화산파',
          description: '화산의 검파',
          attitudeTowardsPlayer: 'NEUTRAL',
          entityReference: {
            entityType: 'FACTION',
            evidence: {
              cause: 'ENCOUNTER',
              context: '새로운 문파 접촉'
            }
          }
        }
      ],
      seedChanges: [
        {
          content: '화산파와 소림사의 은밀한 밀약',
          status: 'active',
          action: 'create',
          entityReference: {
            entityType: 'NARRATIVE_SEED',
            evidence: {
              cause: 'EAVESDROP',
              context: '밀담을 엿들음'
            }
          }
        }
      ]
    };

    // Step 1: Candidate Recovery Gate
    const gateResult = runCandidateRecoveryGate([{
      candidateId: 1,
      label: 'EOF Step Option',
      narrativeSummary: 'Full transition test',
      rawMetadata: validCandidatePacket
    }]);
    assert(gateResult.passedCount === 1, 'EOF Test 1: Candidate passes Recovery Gate');

    // Step 2: Proposal Construction & Identity Resolution
    const proposal = buildSafeProposalFromCandidate(state, validCandidatePacket, 1, history);
    assert(proposal.actions.length >= 5, 'EOF Test 2: Proposal contains all validated actions');

    // Step 3: Sovereign Engine Validation
    const validationVerdict = EngineValidator.validate(proposal, state, new Set(), new Set(), history);
    if (!validationVerdict.isValid) {
      console.error('EOF Test 3 Validation Errors:', validationVerdict.rejectedReasons, validationVerdict.conflictDetails);
    }
    assert(validationVerdict.isValid, 'EOF Test 3: EngineValidator approves the proposal');

    // Step 4: Sovereign Engine Commit
    const commitResult = engine.submitProposal(proposal);
    if (!commitResult.success) {
      console.error('EOF Test 4 Commit Error:', commitResult.rejectedReasons || (commitResult as any).error);
    }
    assert(commitResult.success, 'EOF Test 4: SovereignEngine successfully commits the proposal');

    // Verify Canonical State Mutations
    const updatedState = engine.getSnapshot();
    const ironSword = updatedState.character.inventory.find(i => i.id === 'item-iron-sword');
    assert(!ironSword, 'EOF Test 5: Existing 철검 successfully removed');

    const thunderBomb = updatedState.character.inventory.find(i => i.name === '벽력탄');
    assert(!!thunderBomb && thunderBomb.quantity === 2, 'EOF Test 6: Novel 벽력탄 added with Engine-issued ID');

    const abbotNpc = updatedState.worldInfo.npcs.find(n => n.id === 'npc-abbot');
    assert(abbotNpc?.innerThought === '젊은 검객의 자질이 뛰어나구나.', 'EOF Test 7: Canonical NPC innerThought updated');

    const huashanNpc = updatedState.worldInfo.npcs.find(n => n.name === '화산파 장문인');
    assert(!!huashanNpc && huashanNpc.id.startsWith('npc-'), 'EOF Test 8: Novel NPC added with Engine-issued ID');

    const huashanFaction = updatedState.worldInfo.factions.find(f => f.name === '화산파');
    assert(!!huashanFaction && huashanFaction.id.startsWith('fac-'), 'EOF Test 9: Novel Faction added with Engine-issued ID');

    const newSeed = updatedState.worldInfo.seeds.find(s => s.content.includes('화산파와 소림사의 은밀한 밀약'));
    assert(!!newSeed && newSeed.id.startsWith('seed-'), 'EOF Test 10: Novel Seed added with Engine-issued ID');

    // Step 5: Historical Record Verification
    const committedHistory = engine.getHistory();
    assert(committedHistory.length >= 6, 'EOF Test 11: Immutable Historical Records created for all actions');
  }

  // ==========================================
  // Test Suite: Red Team Adversarial Attacks
  // ==========================================
  console.log('\n--- Red Team Adversarial Attack Tests ---');
  {
    // Attack 1: Fake Event ID Novelty Forgery
    const fakeEventRes = resolveInventoryItemIdentity(state, history, '신검', {
      entityType: 'ITEM',
      evidence: {
        verifiedEventId: 'evt-fabricated-non-existent-999',
        cause: 'FABRICATED'
      }
    });
    assert(fakeEventRes.status === 'AMBIGUOUS', 'Red Team 1: Fabricated eventId is rejected as AMBIGUOUS');

    // Attack 2: Bogus sourceNpcId Novelty Forgery
    const fakeNpcRes = resolveInventoryItemIdentity(state, history, '마도비급', {
      entityType: 'ITEM',
      evidence: {
        sourceNpcId: 'npc-fabricated-ghost',
        cause: 'GIFT'
      }
    });
    assert(fakeNpcRes.status === 'AMBIGUOUS', 'Red Team 2: Fabricated sourceNpcId is rejected as AMBIGUOUS');

    // Attack 3: Unauthorized Claimed ID Override on Existing Entity
    const spoofedFaction = resolveFactionIdentity(state, history, '소림사', {
      entityType: 'FACTION',
      claimedEntityId: 'fac-hacked-custom-id',
      evidence: { context: '해킹 시도' }
    });
    assert(spoofedFaction.status === 'CONFLICT', 'Red Team 3: Spoofed claimedEntityId on canonical entity triggers CONFLICT');
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed, errors };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('entityIdentityResolverTest')) {
  const res = runEntityIdentityTests();
  if (res.failed > 0) {
    process.exit(1);
  }
}
