import { SovereignEngine } from '../src/engine/state';
import { buildSafeProposalFromCandidate, buildSafeProposal, parseGMResponseAndProposal } from '../src/engine/proposalParser';
import { ImmigrationGate } from '../src/engine/immigrationGate';
import { EngineValidator } from '../src/engine/validator';
import { dispatchEngineInternalProposal } from '../src/engine/internalCapability';
import {
  StateTransitionProposal,
  CanonicalState,
  TransitionAction,
  VerifiedClaim,
  ExternalEvidence,
  UntrustedClaim,
  ProposalSource
} from '../src/engine/types';
import {
  CandidatePacket,
  NpcRecord,
  FactionRecord,
  ItemRecord,
  OffscreenEventRecord,
  NarrativeSeed
} from '../src/types';
import { actionToMeaningNode } from '../src/engine/language/adapter';
import { MeaningNode } from '../src/engine/language/types';

export interface ForensicVectorResult {
  vectorId: string;
  category: string;
  title: string;
  description: string;
  entryPoint: string;
  reachedRuntime: boolean;
  status: 'REACHED' | 'BLOCKED' | 'MUTATED' | 'NOT_REACHED' | 'STATIC_ONLY' | 'HARNESS_BLOCKED' | 'UNTESTED';
  finalVerdict: 'GREEN' | 'YELLOW' | 'RED' | 'FAIL';
  multiTurn: boolean;
  turnsExecuted: number;
  stateBeforeHash: string;
  stateAfterHash: string;
  unauthorizedMutation: boolean;
  mutationDetails: string;
  rejectionReasons: string[];
  forensicLogs: string[];
}

function attachMeaningTree(proposal: StateTransitionProposal): StateTransitionProposal {
  if (!proposal.meaningTree) {
    const children = (proposal.actions || []).map(act => actionToMeaningNode(act, 'PROPOSAL'));
    const tree: MeaningNode = {
      atom: 'INTENT',
      scope: 'PROPOSAL',
      value: proposal.intentSummary || 'Penetration Attack Proposal',
      children: children.length > 0 ? children : undefined,
    };
    proposal.meaningTree = tree;
  }
  return proposal;
}

function hashState(state: CanonicalState): string {
  const clean = {
    turn: state.turn,
    stateVersion: state.stateVersion,
    lastCommittedEventId: state.lastCommittedEventId,
    character: state.character,
    worldInfo: state.worldInfo
  };
  return Buffer.from(JSON.stringify(clean)).toString('base64').substring(0, 20);
}

function createTimeGen(baseMs = 1700000000000) {
  let cur = baseMs;
  return () => {
    cur += 5000;
    return new Date(cur).toISOString();
  };
}

export function runIndependentAdversarialAudit(): { results: ForensicVectorResult[]; allGreen: boolean } {
  const results: ForensicVectorResult[] = [];
  const getTime = createTimeGen();

  console.log('================================================================');
  console.log('🔥 INDEPENDENT ADVERSARIAL PENETRATION AUDIT RUNNER LAUNCHED');
  console.log('================================================================\n');

  // ==========================================================================
  // VECTOR 1: Multi-Turn Offscreen Event -> NPC Mutation / Spawn Escalation
  // ==========================================================================
  {
    const vectorId = 'VEC-01-OFFSCREEN-NPC-ESCALATION';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    // Genesis setup
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v1',
      requestId: 'req-v1',
      eventId: 'evt-v1',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        },
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-zhang-1', name: '장문인', npcClass: 'Class A', affinity: 50, status: 'ALIVE', affiliation: '정파' } as NpcRecord
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Turn 1: LLM records an unverified offscreen event asserting "장문인 betrayed the sect and joined 흑도"
    const t1Prop = attachMeaningTree({
      proposalId: 'p-v1-t1',
      requestId: 'req-v1-t1',
      eventId: 'evt-v1-t1',
      expectedStateVersion: beforeState.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'LLM records offscreen betrayal event',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            id: 'off-betrayal-1',
            eventDescription: '장문인이 문파를 배신하고 흑도에 가담하였다.',
            timestamp: getTime(),
            visibility: 'PUBLIC'
          } as OffscreenEventRecord
        }
      ]
    });
    const t1Res = engine.submitProposal(t1Prop);
    logs.push(`Turn 1 RECORD_OFFSCREEN_EVENT committed: ${t1Res.success}`);

    const midState = engine.getSnapshot();

    // Turn 2: LLM submits UPDATE_NPC directly modifying affiliation to '흑도' without VerifiedClaim
    const t2DirectProp = attachMeaningTree({
      proposalId: 'p-v1-t2-direct',
      requestId: 'req-v1-t2-direct',
      eventId: 'evt-v1-t2-direct',
      expectedStateVersion: midState.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'LLM attempts direct UPDATE_NPC based on Turn 1 offscreen event',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-zhang-1',
            changes: { affiliation: '흑도' }
          }
        }
      ]
    });
    const t2Res = engine.submitProposal(t2DirectProp);
    logs.push(`Turn 2 direct UPDATE_NPC submit verdict: success=${t2Res.success}, rejections=${t2Res.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const zhang = afterState.worldInfo.npcs.find(n => n.id === 'npc-zhang-1');
    const mutated = zhang?.affiliation === '흑도';

    results.push({
      vectorId,
      category: 'OFFSCREEN_EVIDENCE_ESCALATION',
      title: 'LLM Offscreen Event -> Next-Turn Direct NPC Mutation Escalation',
      description: 'LLM commits offscreen event in Turn 1, then attempts direct UPDATE_NPC in Turn 2 without Gate-issued VerifiedClaim.',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator',
      reachedRuntime: true,
      status: mutated ? 'MUTATED' : 'BLOCKED',
      finalVerdict: mutated ? 'RED' : 'GREEN',
      multiTurn: true,
      turnsExecuted: 2,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: mutated,
      mutationDetails: mutated ? `NPC 'npc-zhang-1' affiliation mutated to '${zhang?.affiliation}'` : 'Zero mutation on NPC state',
      rejectionReasons: t2Res.rejectedReasons,
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 2: Multi-Turn LLM Offscreen Event -> Next-Turn Inventory Acquisition
  // (Testing BOTH Mismatched Item Name AND Exactly Matched Item Name)
  // ==========================================================================
  {
    const vectorId = 'VEC-02-OFFSCREEN-INVENTORY-CREATION';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v2',
      requestId: 'req-v2',
      eventId: 'evt-v2',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Turn 1: LLM commits RECORD_OFFSCREEN_EVENT containing the exact item name "용살검"
    const t1Prop = attachMeaningTree({
      proposalId: 'p-v2-t1',
      requestId: 'req-v2-t1',
      eventId: 'offscreen-dragon-blade-event',
      expectedStateVersion: beforeState.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'LLM records offscreen discovery event mentioning Dragon Blade',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            id: 'offscreen-dragon-blade-event',
            eventDescription: '동굴 깊은 곳에서 전설의 용살검이 발견되었다.',
            timestamp: getTime(),
            visibility: 'PUBLIC'
          } as OffscreenEventRecord
        }
      ]
    });
    const t1Res = engine.submitProposal(t1Prop);
    logs.push(`Turn 1 RECORD_OFFSCREEN_EVENT: success=${t1Res.success}`);

    const midState = engine.getSnapshot();

    // Turn 2: LLM/PLAYER submits MODIFY_INVENTORY using offscreen event ID as verifiedEventId to create "용살검"
    const t2Prop = attachMeaningTree({
      proposalId: 'p-v2-t2',
      requestId: 'req-v2-t2',
      eventId: 'evt-v2-t2',
      expectedStateVersion: midState.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'LLM acquires 용살검 using Turn 1 offscreen event as verifiedEventId',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-dragon-blade', name: '용살검', quantity: 1, category: '무기' },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'offscreen-dragon-blade-event'
            }
          }
        }
      ]
    });
    const t2Res = engine.submitProposal(t2Prop);
    logs.push(`Turn 2 MODIFY_INVENTORY submit verdict: success=${t2Res.success}, rejections=${t2Res.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const hasDragonBlade = afterState.character.inventory.some(i => i.name === '용살검' || i.id === 'item-dragon-blade');

    results.push({
      vectorId,
      category: 'OFFSCREEN_EVIDENCE_ESCALATION',
      title: 'LLM Offscreen Event -> Next-Turn Free Inventory Item Creation Escalation',
      description: 'LLM records unverified offscreen event mentioning "용살검" in Turn 1, then uses that event ID as verifiedEventId in Turn 2 to mint "용살검" into inventory.',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Inventory Causality Gate',
      reachedRuntime: true,
      status: hasDragonBlade ? 'MUTATED' : 'BLOCKED',
      finalVerdict: hasDragonBlade ? 'RED' : 'GREEN',
      multiTurn: true,
      turnsExecuted: 2,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: hasDragonBlade,
      mutationDetails: hasDragonBlade ? "Inventory mutated: '용살검' was created in character inventory via Turn 1 offscreen event!" : 'Zero mutation on character inventory',
      rejectionReasons: t2Res.rejectedReasons,
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 3: Multi-Turn LLM Narrative Seed -> Inventory Item Creation Escalation
  // ==========================================================================
  {
    const vectorId = 'VEC-03-NARRATIVE-SEED-INVENTORY-ESCALATION';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v3',
      requestId: 'req-v3',
      eventId: 'evt-v3',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Turn 1: LLM adds narrative seed "비밀의 신검이 사당에 은닉되어 있다"
    const t1Prop = attachMeaningTree({
      proposalId: 'p-v3-t1',
      requestId: 'req-v3-t1',
      eventId: 'seed-divine-sword-event',
      expectedStateVersion: beforeState.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'LLM creates narrative seed mentioning divine sword',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-divine-sword',
            content: '비밀의 신검이 사당에 은닉되어 있다는 소문이 있다.',
            status: 'active'
          } as NarrativeSeed
        }
      ]
    });
    const t1Res = engine.submitProposal(t1Prop);
    logs.push(`Turn 1 ADD_NARRATIVE_SEED: success=${t1Res.success}`);

    const midState = engine.getSnapshot();

    // Turn 2: LLM tries to DISCOVERY_PICKUP "신검" using seed ID as verifiedEventId
    const t2Prop = attachMeaningTree({
      proposalId: 'p-v3-t2',
      requestId: 'req-v3-t2',
      eventId: 'evt-v3-t2',
      expectedStateVersion: midState.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'LLM acquires 신검 using narrative seed as verifiedEventId',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-divine-sword', name: '신검', quantity: 1, category: '무기' },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-divine-sword'
            }
          }
        }
      ]
    });
    const t2Res = engine.submitProposal(t2Prop);
    logs.push(`Turn 2 seed inventory exploitation: success=${t2Res.success}, rejections=${t2Res.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const hasDivineSword = afterState.character.inventory.some(i => i.name === '신검' || i.id === 'item-divine-sword');

    results.push({
      vectorId,
      category: 'SEED_LAUNDERING',
      title: 'LLM Narrative Seed -> Next-Turn Inventory Item Creation Escalation',
      description: 'LLM creates narrative seed mentioning "신검" in Turn 1, then uses that seed ID as verifiedEventId in Turn 2 to mint "신검" into inventory.',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Inventory Causality Gate',
      reachedRuntime: true,
      status: hasDivineSword ? 'MUTATED' : 'BLOCKED',
      finalVerdict: hasDivineSword ? 'RED' : 'GREEN',
      multiTurn: true,
      turnsExecuted: 2,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: hasDivineSword,
      mutationDetails: hasDivineSword ? "Inventory mutated: '신검' was created in character inventory via Turn 1 narrative seed!" : 'Zero mutation on character inventory',
      rejectionReasons: t2Res.rejectedReasons,
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 4: Candidate Self-Minted Evidence Laundering via buildSafeProposalFromCandidate
  // ==========================================================================
  {
    const vectorId = 'VEC-04-CANDIDATE-SELF-MINTED-EVIDENCE-LAUNDERING';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v4',
      requestId: 'req-v4',
      eventId: 'evt-v4',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup with NPC',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        },
        {
          type: 'ADD_NPC',
          payload: {
            id: 'npc-target-1',
            name: '동문사형',
            npcClass: 'Class B',
            metInStory: true,
            status: 'ALIVE',
            origin: '산동',
            background: '정파 무관 출신',
            affiliation: '화산파'
          } as NpcRecord
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Untrusted CandidatePacket containing unverified NPC change assertions (affiliation: '마교 첩자', background: '배신자')
    const untrustedCandidate: CandidatePacket = {
      candidateId: 'cand-attack-v4',
      turn: 2,
      timestamp: getTime(),
      npcChanges: [
        {
          name: '동문사형',
          metInStory: true,
          affiliation: '마교 첩자',
          background: '비밀리 마교에 포섭된 배신자'
        }
      ]
    };

    // Pass through buildSafeProposalFromCandidate
    const parsedProposal = buildSafeProposalFromCandidate(
      beforeState,
      untrustedCandidate,
      2,
      engine.getHistory()
    );

    logs.push(`buildSafeProposalFromCandidate produced verifiedClaims count: ${parsedProposal.verifiedClaims?.length || 0}`);
    if (parsedProposal.verifiedClaims && parsedProposal.verifiedClaims.length > 0) {
      logs.push(`VerifiedClaims issued: ${JSON.stringify(parsedProposal.verifiedClaims)}`);
    }

    // Submit the resulting proposal to SovereignEngine
    const commitRes = engine.submitProposal(parsedProposal);
    logs.push(`SovereignEngine submitProposal verdict: success=${commitRes.success}, rejections=${commitRes.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const targetNpc = afterState.worldInfo.npcs.find(n => n.id === 'npc-target-1');
    const affiliationMutated = targetNpc?.affiliation === '마교 첩자';
    const backgroundMutated = targetNpc?.background === '비밀리 마교에 포섭된 배신자';
    const mutated = affiliationMutated || backgroundMutated;

    results.push({
      vectorId,
      category: 'CLAIM_AUTHORITY_LAUNDERING',
      title: 'Candidate Self-Minted Evidence Laundering via buildSafeProposalFromCandidate',
      description: 'Untrusted CandidatePacket includes arbitrary npcChanges. buildSafeProposalFromCandidate self-mints ExternalEvidence with source RECOVERY_GATE_CANDIDATE, obtains Gate-issued VerifiedClaim, and mutates canonical NPC state.',
      entryPoint: 'ProposalParser.buildSafeProposalFromCandidate -> ImmigrationGate.admit -> SovereignEngine.submitProposal',
      reachedRuntime: true,
      status: mutated ? 'MUTATED' : 'BLOCKED',
      finalVerdict: mutated ? 'RED' : 'GREEN',
      multiTurn: false,
      turnsExecuted: 1,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: mutated,
      mutationDetails: mutated ? `Canonical NPC 'npc-target-1' mutated: affiliation='${targetNpc?.affiliation}', background='${targetNpc?.background}'` : 'Zero mutation on canonical NPC',
      rejectionReasons: commitRes.rejectedReasons,
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 5: PLAYER Direct Result Mutation (UPDATE_NPC, SET_NPC_STATUS, UPDATE_FACTION, SET_WORLD_METADATA)
  // ==========================================================================
  {
    const vectorId = 'VEC-05-PLAYER-DIRECT-MUTATION';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v5',
      requestId: 'req-v5',
      eventId: 'evt-v5',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        },
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-v5-1', name: '상인', npcClass: 'Class C', status: 'ALIVE' } as NpcRecord
        },
        {
          type: 'ADD_FACTION',
          payload: { id: 'fac-v5-1', name: '개방', influence: 30 } as FactionRecord
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Attack 5A: PLAYER UPDATE_NPC
    const p1 = attachMeaningTree({
      proposalId: 'p-v5-a',
      requestId: 'req-v5-a',
      eventId: 'evt-v5-a',
      expectedStateVersion: beforeState.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player attempts direct UPDATE_NPC',
      actions: [{ type: 'UPDATE_NPC', payload: { id: 'npc-v5-1', changes: { name: '해킹된 상인' } } }]
    });
    const r1 = engine.submitProposal(p1);
    logs.push(`PLAYER UPDATE_NPC: success=${r1.success}, rejections=${r1.rejectedReasons.join('; ')}`);

    // Attack 5B: PLAYER SET_NPC_STATUS
    const p2 = attachMeaningTree({
      proposalId: 'p-v5-b',
      requestId: 'req-v5-b',
      eventId: 'evt-v5-b',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player attempts direct SET_NPC_STATUS',
      actions: [{ type: 'SET_NPC_STATUS', payload: { id: 'npc-v5-1', status: 'DEAD' } }]
    });
    const r2 = engine.submitProposal(p2);
    logs.push(`PLAYER SET_NPC_STATUS: success=${r2.success}, rejections=${r2.rejectedReasons.join('; ')}`);

    // Attack 5C: PLAYER UPDATE_FACTION
    const p3 = attachMeaningTree({
      proposalId: 'p-v5-c',
      requestId: 'req-v5-c',
      eventId: 'evt-v5-c',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player attempts direct UPDATE_FACTION',
      actions: [{ type: 'UPDATE_FACTION', payload: { id: 'fac-v5-1', influence: 100 } }]
    });
    const r3 = engine.submitProposal(p3);
    logs.push(`PLAYER UPDATE_FACTION: success=${r3.success}, rejections=${r3.rejectedReasons.join('; ')}`);

    // Attack 5D: PLAYER SET_WORLD_METADATA
    const p4 = attachMeaningTree({
      proposalId: 'p-v5-d',
      requestId: 'req-v5-d',
      eventId: 'evt-v5-d',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player attempts direct SET_WORLD_METADATA',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '해킹된 세계' } }]
    });
    const r4 = engine.submitProposal(p4);
    logs.push(`PLAYER SET_WORLD_METADATA: success=${r4.success}, rejections=${r4.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const npcMutated = afterState.worldInfo.npcs.some(n => n.name === '해킹된 상인' || n.status === 'DEAD');
    const factionMutated = afterState.worldInfo.factions.some(f => f.id === 'fac-v5-1' && f.influence === 100);
    const metaMutated = (afterState.worldInfo as any).worldName === '해킹된 세계';
    const anyMutated = npcMutated || factionMutated || metaMutated;

    results.push({
      vectorId,
      category: 'PLAYER_AUTHORITY_BOUNDARY',
      title: 'PLAYER Direct State Mutation Attempts (UPDATE_NPC, SET_NPC_STATUS, UPDATE_FACTION, SET_WORLD_METADATA)',
      description: 'PLAYER source submits direct mutation actions for NPC, Faction, and World Metadata.',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator ACL Firewall',
      reachedRuntime: true,
      status: anyMutated ? 'MUTATED' : 'BLOCKED',
      finalVerdict: anyMutated ? 'RED' : 'GREEN',
      multiTurn: false,
      turnsExecuted: 1,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: anyMutated,
      mutationDetails: anyMutated ? `Unauthorized mutation occurred: npc=${npcMutated}, faction=${factionMutated}, meta=${metaMutated}` : 'All PLAYER direct mutation attempts blocked cleanly',
      rejectionReasons: [...r1.rejectedReasons, ...r2.rejectedReasons, ...r3.rejectedReasons, ...r4.rejectedReasons],
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 6: Numerical Boundary & NaN / Infinity Injection
  // ==========================================================================
  {
    const vectorId = 'VEC-06-NUMERICAL-BOUNDARY-NAN-INJECTION';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v6',
      requestId: 'req-v6',
      eventId: 'evt-v6',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [{ id: 'item-silver', name: '은전', quantity: 10 }],
            status: 'HEALTHY',
            location: '낙양'
          }
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // NaN inventory quantity
    const p1 = attachMeaningTree({
      proposalId: 'p-v6-a',
      requestId: 'req-v6-a',
      eventId: 'evt-v6-a',
      expectedStateVersion: beforeState.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'NaN quantity inventory modification',
      actions: [{ type: 'MODIFY_INVENTORY', payload: { operation: 'ADD', item: { id: 'item-nan', name: '금화', quantity: NaN }, acquisition: { cause: 'GENESIS_STARTER' } } }]
    });
    const r1 = engine.submitProposal(p1);
    logs.push(`NaN inventory quantity: success=${r1.success}, rejections=${r1.rejectedReasons.join('; ')}`);

    // Infinity stat value
    const p2 = attachMeaningTree({
      proposalId: 'p-v6-b',
      requestId: 'req-v6-b',
      eventId: 'evt-v6-b',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Infinity stat update',
      actions: [{ type: 'UPDATE_CHARACTER_STATS', payload: { stat: 'strength', delta: Infinity } }]
    });
    const r2 = engine.submitProposal(p2);
    logs.push(`Infinity stat update: success=${r2.success}, rejections=${r2.rejectedReasons.join('; ')}`);

    // Stat out of 1-30 boundary (value: 99)
    const p3 = attachMeaningTree({
      proposalId: 'p-v6-c',
      requestId: 'req-v6-c',
      eventId: 'evt-v6-c',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Stat overflow to 99 via OVERWRITE_CHARACTER',
      actions: [{ type: 'OVERWRITE_CHARACTER', payload: { name: '주인공', stats: { strength: 99 } } }]
    });
    const r3 = engine.submitProposal(p3);
    logs.push(`Stat 99 overwrite: success=${r3.success}, rejections=${r3.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const hasNanItem = afterState.character.inventory.some(i => i.name === '금화' || Number.isNaN(i.quantity));
    const statOverflowed = afterState.character.stats.strength > 30;
    const mutated = hasNanItem || statOverflowed;

    results.push({
      vectorId,
      category: 'NUMERICAL_INTEGRITY',
      title: 'NaN / Infinity / Boundary Overflow Numerical Attacks',
      description: 'Submits NaN item quantities, Infinity stat deltas, and stat values exceeding boundary limits (99).',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Numerical Gate',
      reachedRuntime: true,
      status: mutated ? 'MUTATED' : 'BLOCKED',
      finalVerdict: mutated ? 'RED' : 'GREEN',
      multiTurn: false,
      turnsExecuted: 1,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: mutated,
      mutationDetails: mutated ? `Numerical corruption occurred: NaN item=${hasNanItem}, Strength=${afterState.character.stats.strength}` : 'All numerical poisoning attempts blocked',
      rejectionReasons: [...r1.rejectedReasons, ...r2.rejectedReasons, ...r3.rejectedReasons],
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 7: Temporal Monotonicity & Stale State Version Regression
  // ==========================================================================
  {
    const vectorId = 'VEC-07-TEMPORAL-MONOTONICITY-STATEVERSION';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v7',
      requestId: 'req-v7',
      eventId: 'evt-v7',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        }
      ]
    });

    const v1State = engine.getSnapshot();

    // Turn 2 valid advance
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-turn2-v7',
      requestId: 'req-v7-t2',
      eventId: 'evt-v7-t2',
      expectedStateVersion: v1State.stateVersion,
      source: 'SYSTEM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Turn 2 advance',
      actions: [{ type: 'ADD_RUMOR', payload: { rumor: '낙양에 상인이 들어왔다.' } }]
    });

    const v2State = engine.getSnapshot();
    const beforeHash = hashState(v2State);

    // Stale expectedStateVersion attack (submitting expectedStateVersion = 1 when current stateVersion = 2)
    const pStale = attachMeaningTree({
      proposalId: 'p-v7-stale',
      requestId: 'req-v7-stale',
      eventId: 'evt-v7-stale',
      expectedStateVersion: 1, // Stale!
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Stale stateVersion submission attack',
      actions: [{ type: 'ADD_RUMOR', payload: { rumor: '오래된 버전에 근거한 소문' } }]
    });
    const rStale = engine.submitProposal(pStale);
    logs.push(`Stale stateVersion proposal: success=${rStale.success}, rejections=${rStale.rejectedReasons.join('; ')}`);

    // Turn regression attack (submitting turn = 1 when current turn = 2)
    const pTurnReg = attachMeaningTree({
      proposalId: 'p-v7-turn-reg',
      requestId: 'req-v7-turn-reg',
      eventId: 'evt-v7-turn-reg',
      expectedStateVersion: v2State.stateVersion,
      source: 'PLAYER',
      turn: 1, // Regression!
      timestamp: getTime(),
      intentSummary: 'Turn regression submission attack',
      actions: [{ type: 'ADD_RUMOR', payload: { rumor: '과거 턴으로 후퇴한 소문' } }]
    });
    const rTurnReg = engine.submitProposal(pTurnReg);
    logs.push(`Turn regression proposal: success=${rTurnReg.success}, rejections=${rTurnReg.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const staleRumorAccepted = (afterState.worldInfo.publicRumors || []).some(r => r === '오래된 버전에 근거한 소문' || r === '과거 턴으로 후퇴한 소문');

    results.push({
      vectorId,
      category: 'TEMPORAL_MONOTONICITY',
      title: 'Stale StateVersion & Turn Regression Attacks',
      description: 'Submits proposals with stale expectedStateVersion (1 vs 2) and regressed turn number (1 vs 2).',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Monotonicity Check',
      reachedRuntime: true,
      status: staleRumorAccepted ? 'MUTATED' : 'BLOCKED',
      finalVerdict: staleRumorAccepted ? 'RED' : 'GREEN',
      multiTurn: true,
      turnsExecuted: 2,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: staleRumorAccepted,
      mutationDetails: staleRumorAccepted ? 'Stale or regressed rumor was accepted into state!' : 'All temporal regression attempts blocked cleanly',
      rejectionReasons: [...rStale.rejectedReasons, ...rTurnReg.rejectedReasons],
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 8: Composite Actions Order / Duplication / Overdraft
  // ==========================================================================
  {
    const vectorId = 'VEC-08-COMPOSITE-ACTION-OVERDRAFT';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v8',
      requestId: 'req-v8',
      eventId: 'evt-v8',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup with 5 silver coins',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [{ id: 'item-silver-coin', name: '은전', quantity: 5 }],
            status: 'HEALTHY',
            location: '낙양'
          }
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Overdraft Attack: Single proposal attempts to exchange 5 silver coins TWICE (requiring 10 silver coins total)
    const pOverdraft = attachMeaningTree({
      proposalId: 'p-v8-overdraft',
      requestId: 'req-v8-od',
      eventId: 'evt-v8-od',
      expectedStateVersion: beforeState.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Double spending overdraft attack in single proposal',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-sword-1', name: '철검', quantity: 1 },
            acquisition: { cause: 'RESOURCE_EXCHANGE', cost: { id: 'item-silver-coin', name: '은전', quantity: 5 } }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'REMOVE',
            item: { id: 'item-silver-coin', name: '은전', quantity: 5 }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-shield-1', name: '방패', quantity: 1 },
            acquisition: { cause: 'RESOURCE_EXCHANGE', cost: { id: 'item-silver-coin', name: '은전', quantity: 5 } }
          }
        }
      ]
    });
    const rOverdraft = engine.submitProposal(pOverdraft);
    logs.push(`Double spending overdraft submit verdict: success=${rOverdraft.success}, rejections=${rOverdraft.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const boughtBoth = afterState.character.inventory.some(i => i.name === '철검') && afterState.character.inventory.some(i => i.name === '방패');
    const negativeBalance = afterState.character.inventory.some(i => i.name === '은전' && i.quantity < 0);
    const mutated = boughtBoth || negativeBalance;

    results.push({
      vectorId,
      category: 'ATOMIC_COMPOSITION_INTEGRITY',
      title: 'Composite Action Double-Spending Overdraft Attack',
      description: 'Character owns 5 silver coins. Proposal includes 2 exchanges costing 5 coins each with 1 removal action.',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Virtual Draft Executor',
      reachedRuntime: true,
      status: mutated ? 'MUTATED' : 'BLOCKED',
      finalVerdict: mutated ? 'RED' : 'GREEN',
      multiTurn: false,
      turnsExecuted: 1,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: mutated,
      mutationDetails: mutated ? 'Double spending overdraft succeeded: both items purchased or negative balance!' : 'Overdraft blocked, zero unapproved mutation',
      rejectionReasons: rOverdraft.rejectedReasons,
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 9: NPC Identity Collision & Passport Bypass
  // ==========================================================================
  {
    const vectorId = 'VEC-09-NPC-IDENTITY-COLLISION';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v9',
      requestId: 'req-v9',
      eventId: 'evt-v9',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup with NPC 개방방주',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        },
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-beggar-king', name: '개방방주', npcClass: 'Class A', status: 'ALIVE' } as NpcRecord
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Duplicate ADD_NPC with exact same name '개방방주' via LLM
    const pCol = attachMeaningTree({
      proposalId: 'p-v9-col',
      requestId: 'req-v9-col',
      eventId: 'evt-v9-col',
      expectedStateVersion: beforeState.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'LLM attempts duplicate ADD_NPC for pre-existing 개방방주',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-fake-beggar', name: '개방방주', npcClass: 'Class A', status: 'ALIVE' } as NpcRecord
        }
      ]
    });
    const rCol = engine.submitProposal(pCol);
    logs.push(`Duplicate ADD_NPC verdict: success=${rCol.success}, rejections=${rCol.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const duplicateAdded = afterState.worldInfo.npcs.filter(n => n.name === '개방방주').length > 1;

    results.push({
      vectorId,
      category: 'IDENTITY_CONTINUITY',
      title: 'NPC Identity Collision & Passport Bypass Attack',
      description: 'LLM attempts to ADD_NPC with name "개방방주", colliding with pre-existing canonical NPC.',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Identity Resolution Gate',
      reachedRuntime: true,
      status: duplicateAdded ? 'MUTATED' : 'BLOCKED',
      finalVerdict: duplicateAdded ? 'RED' : 'GREEN',
      multiTurn: false,
      turnsExecuted: 1,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: duplicateAdded,
      mutationDetails: duplicateAdded ? 'Duplicate NPC was created in state!' : 'NPC name collision blocked cleanly',
      rejectionReasons: rCol.rejectedReasons,
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 10: Replay / Double Spending of Historical Evidence
  // ==========================================================================
  {
    const vectorId = 'VEC-10-EVENT-DOUBLE-SPENDING-REPLAY';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v10',
      requestId: 'req-v10',
      eventId: 'evt-v10',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup with seed',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        },
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: { id: 'seed-loot-event-1', content: '보물상자에서 보검을 습득할 수 있다.', status: 'active' } as NarrativeSeed
        }
      ]
    });

    // Legitimate pickup 1 using seed
    const pLegit = attachMeaningTree({
      proposalId: 'p-v10-legit',
      requestId: 'req-v10-legit',
      eventId: 'evt-v10-legit',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'First legitimate pickup of 보검',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-sword-legit', name: '보검', quantity: 1 },
            acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-loot-event-1' }
          }
        }
      ]
    });
    const rLegit = engine.submitProposal(pLegit);
    logs.push(`First legitimate pickup: success=${rLegit.success}`);

    const midState = engine.getSnapshot();
    const beforeHash = hashState(midState);

    // Replay attack: attempt to use the same seed ID 'seed-loot-event-1' AGAIN to spawn a second '보검'
    const pReplay = attachMeaningTree({
      proposalId: 'p-v10-replay',
      requestId: 'req-v10-replay',
      eventId: 'evt-v10-replay',
      expectedStateVersion: midState.stateVersion,
      source: 'PLAYER',
      turn: 3,
      timestamp: getTime(),
      intentSummary: 'Replay attack re-using consumed seed ID',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-sword-replayed', name: '보검', quantity: 1 },
            acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-loot-event-1' }
          }
        }
      ]
    });
    const rReplay = engine.submitProposal(pReplay);
    logs.push(`Replay attack submit verdict: success=${rReplay.success}, rejections=${rReplay.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const swordCount = afterState.character.inventory.filter(i => i.name === '보검').length;
    const replayed = swordCount > 1;

    results.push({
      vectorId,
      category: 'ANTI_REPLAY_CAUSALITY',
      title: 'Double-Spending Event Grounding Replay Attack',
      description: 'Reuses an event ID that was already consumed in a prior turn to spawn duplicate items.',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Anti-Replay Gate',
      reachedRuntime: true,
      status: replayed ? 'MUTATED' : 'BLOCKED',
      finalVerdict: replayed ? 'RED' : 'GREEN',
      multiTurn: true,
      turnsExecuted: 3,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: replayed,
      mutationDetails: replayed ? `Duplicate item created via event replay! Total swords: ${swordCount}` : 'Replay attack blocked, zero duplicate item creation',
      rejectionReasons: rReplay.rejectedReasons,
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 11: Alternate Entry Point — Direct Forged VerifiedClaim Submission
  // ==========================================================================
  {
    const vectorId = 'VEC-11-DIRECT-FORGED-VERIFIEDCLAIM-SUBMISSION';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v11',
      requestId: 'req-v11',
      eventId: 'evt-v11',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        },
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-target-v11', name: '현웅', npcClass: 'Class A', status: 'ALIVE', affiliation: '소림사' } as NpcRecord
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Manually forge a VerifiedClaim object without using ImmigrationGate.admit
    const forgedClaim: VerifiedClaim = Object.freeze({
      claimId: 'vclm-2-forged-claim-999',
      status: 'VERIFIED',
      targetEntityId: 'npc-target-v11',
      targetAttribute: 'affiliation',
      verifiedValue: '마교',
      evidenceIds: ['fake-ev-1'],
      verifiedAtTurn: 2,
      verifiedAtStateVersion: beforeState.stateVersion,
      verifiedAtTimestamp: getTime(),
      provenance: { source: 'SYSTEM_FORGERY', evidenceCount: 1 }
    });

    // Directly construct proposal attaching the forged VerifiedClaim
    const directProposal: StateTransitionProposal = attachMeaningTree({
      proposalId: 'p-v11-forged-claim',
      requestId: 'req-v11-fc',
      eventId: 'evt-v11-fc',
      expectedStateVersion: beforeState.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Direct proposal with forged VerifiedClaim object',
      verifiedClaims: [forgedClaim],
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-target-v11', changes: { affiliation: '마교' } }
        }
      ]
    });

    const commitRes = engine.submitProposal(directProposal);
    logs.push(`Direct forged VerifiedClaim submit verdict: success=${commitRes.success}, rejections=${commitRes.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const npc = afterState.worldInfo.npcs.find(n => n.id === 'npc-target-v11');
    const mutated = npc?.affiliation === '마교';

    results.push({
      vectorId,
      category: 'ALTERNATE_ENTRY_POINTS',
      title: 'Direct Forged VerifiedClaim Object Submission Attack',
      description: 'Attacker bypasses ImmigrationGate by manually constructing a valid-looking VerifiedClaim object in proposal.verifiedClaims.',
      entryPoint: 'Direct StateTransitionProposal.verifiedClaims -> SovereignEngine.submitProposal -> EngineValidator.hasMatchingVerifiedClaim',
      reachedRuntime: true,
      status: mutated ? 'MUTATED' : 'BLOCKED',
      finalVerdict: mutated ? 'RED' : 'GREEN',
      multiTurn: false,
      turnsExecuted: 1,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: mutated,
      mutationDetails: mutated ? "Forged VerifiedClaim accepted! NPC affiliation mutated to '마교'" : 'Forged VerifiedClaim rejected by WeakSet authority check',
      rejectionReasons: commitRes.rejectedReasons,
      forensicLogs: logs
    });
  }

  // ==========================================================================
  // VECTOR 12: 2~N Turn Chain Pollution (Turn 1 Unverified Fact -> Turn 2 Authority)
  // ==========================================================================
  {
    const vectorId = 'VEC-12-CHAIN-POLLUTION-RUMOR-AUTHORITY';
    const logs: string[] = [];
    const engine = new SovereignEngine();

    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-genesis-v12',
      requestId: 'req-v12',
      eventId: 'evt-v12',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '주인공',
            age: 20,
            origin: '낙양',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양'
          }
        }
      ]
    });

    const beforeState = engine.getSnapshot();
    const beforeHash = hashState(beforeState);

    // Turn 1: LLM adds a rumor "동굴 속 전설의 비급이 은닉되어 있다."
    const t1Prop = attachMeaningTree({
      proposalId: 'p-v12-t1',
      requestId: 'req-v12-t1',
      eventId: 'evt-v12-t1',
      expectedStateVersion: beforeState.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'LLM adds rumor',
      actions: [{ type: 'ADD_RUMOR', payload: { rumor: '동굴 속 전설의 비급이 은닉되어 있다.' } }]
    });
    const t1Res = engine.submitProposal(t1Prop);
    logs.push(`Turn 1 ADD_RUMOR committed: ${t1Res.success}`);

    const midState = engine.getSnapshot();

    // Turn 2: LLM tries to use rumor index as verifiedEventId to DISCOVERY_PICKUP "전설의 비급"
    const t2Prop = attachMeaningTree({
      proposalId: 'p-v12-t2',
      requestId: 'req-v12-t2',
      eventId: 'evt-v12-t2',
      expectedStateVersion: midState.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'LLM attempts item acquisition using rumor as verifiedEventId',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-secret-book', name: '전설의 비급', quantity: 1 },
            acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'rumor-0' }
          }
        }
      ]
    });
    const t2Res = engine.submitProposal(t2Prop);
    logs.push(`Turn 2 rumor inventory exploitation: success=${t2Res.success}, rejections=${t2Res.rejectedReasons.join('; ')}`);

    const afterState = engine.getSnapshot();
    const afterHash = hashState(afterState);

    const hasSecretBook = afterState.character.inventory.some(i => i.name === '전설의 비급');

    results.push({
      vectorId,
      category: 'CHAIN_POLLUTION',
      title: 'Rumor Chain Pollution -> Next-Turn Item Acquisition Escalation',
      description: 'LLM creates rumor in Turn 1, then attempts to use rumor reference in Turn 2 as verifiedEventId for item creation.',
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Inventory Causality Gate',
      reachedRuntime: true,
      status: hasSecretBook ? 'MUTATED' : 'BLOCKED',
      finalVerdict: hasSecretBook ? 'RED' : 'GREEN',
      multiTurn: true,
      turnsExecuted: 2,
      stateBeforeHash: beforeHash,
      stateAfterHash: afterHash,
      unauthorizedMutation: hasSecretBook,
      mutationDetails: hasSecretBook ? 'Inventory mutated via rumor chain pollution!' : 'Rumor chain pollution attempt blocked cleanly',
      rejectionReasons: t2Res.rejectedReasons,
      forensicLogs: logs
    });
  }

  const allGreen = results.every(r => r.finalVerdict === 'GREEN');

  console.log('\n================================================================');
  console.log('📊 AUDIT SUMMARY TABLE');
  console.log('================================================================');
  for (const r of results) {
    console.log(`[${r.finalVerdict}] ${r.vectorId.padEnd(42)} | Runtime: ${r.reachedRuntime} | Mutated: ${r.unauthorizedMutation} | Rejections: ${r.rejectionReasons.length}`);
  }
  console.log('================================================================\n');

  return { results, allGreen };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const audit = runIndependentAdversarialAudit();
  if (!audit.allGreen) {
    console.error('❌ ADVERSARIAL PENETRATION AUDIT FOUND VULNERABILITIES!');
  } else {
    console.log('✅ ALL AUDITED VECTORS PASSED AS GREEN!');
  }
}
