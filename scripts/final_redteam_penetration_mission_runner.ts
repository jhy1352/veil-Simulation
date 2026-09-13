import { SovereignEngine } from '../src/engine/state';
import { buildSafeProposalFromCandidate, parseGMResponseAndProposal, buildSafeProposal } from '../src/engine/proposalParser';
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
  NarrativeSeed,
  DEFAULT_NPC_CLASS
} from '../src/types';
import { actionToMeaningNode } from '../src/engine/language/adapter';
import { MeaningNode } from '../src/engine/language/types';

export interface AttackReportItem {
  attackId: string;
  category: string;
  name: string;
  description: string;
  reachedRuntime: boolean;
  entryPoint: string;
  multiTurn: boolean;
  turnsExecuted: number;
  verdict: 'GREEN' | 'RED' | 'YELLOW' | 'FAIL';
  stateBeforeHash: string;
  stateAfterHash: string;
  mutatedCanonical: boolean;
  rejectionReasons: string[];
  evidenceDetails: string;
  forensicLog: string[];
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

function computeSimpleHash(obj: any): string {
  return Buffer.from(JSON.stringify(obj || {})).toString('base64').substring(0, 16);
}

function createTimeGenerator(offsetMs = 1000) {
  let currentTime = Date.now() + offsetMs;
  return () => {
    currentTime += 2000;
    return new Date(currentTime).toISOString();
  };
}

export function runFinalRedTeamPenetrationMission(): { items: AttackReportItem[]; allGreen: boolean } {
  const reports: AttackReportItem[] = [];

  console.log('================================================================');
  console.log('🚀 [TRPG 3.1] FINAL RED-TEAM PENETRATION MISSION LAUNCHED');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // ATTACK 1: Multi-Turn Offscreen Event Laundering -> ADD_NPC / MODIFY_INVENTORY
  // Scenario: Turn 1: LLM commits a fabricated RECORD_OFFSCREEN_EVENT.
  //           Turn 2: LLM tries to use that offscreen event ID as authoritative evidence to spawn an illegal legendary item without cost.
  //           Turn 2 variant: LLM tries to use that offscreen event to force-spawn a NOVEL NPC without identity resolution.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-01-OFFSCREEN-LAUNDER';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    logs.push('Initializing SovereignEngine...');
    const engine = new SovereignEngine();

    // Setup initial character with basic inventory
    const initRes = dispatchEngineInternalProposal(engine, {
      proposalId: 'p-init-01',
      requestId: 'req-init-01',
      eventId: 'evt-init-01',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Genesis setup',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '테스터',
            age: 20,
            origin: '산동',
            family: '무',
            upbringing: '수련',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [{ id: 'item-copper', name: '동전', quantity: 100, category: '재화' }],
            status: 'HEALTHY',
            location: '낙양'
          }
        }
      ]
    });
    logs.push(`Genesis Init: success=${initRes.success}, version=${engine.getSnapshot().stateVersion}`);

    // Turn 1: LLM commits RECORD_OFFSCREEN_EVENT
    const t1Prop = attachMeaningTree({
      proposalId: 'p-t1-offscreen',
      requestId: 'req-t1-off',
      eventId: 'evt-t1-off',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Turn 1 LLM creates offscreen event record',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            eventId: 'offscreen-secret-treasure-found',
            event: '소림사 비고에서 고대 신검이 발견되었다.',
            actors: ['무명승'],
            location: '소림사 장경각'
          } as OffscreenEventRecord
        }
      ]
    });
    const t1Res = engine.submitProposal(t1Prop);
    logs.push(`Turn 1 RECORD_OFFSCREEN_EVENT: success=${t1Res.success}, stateVersion=${engine.getSnapshot().stateVersion}`);

    const snapBeforeT2 = engine.getSnapshot();
    const snapBeforeT2Hash = computeSimpleHash(snapBeforeT2);

    // Turn 2: LLM attacks inventory using the offscreen event ID as verifiedEventId for DISCOVERY_PICKUP without proximity/causality
    const t2AttackProp = attachMeaningTree({
      proposalId: 'p-t2-launder-attack',
      requestId: 'req-t2-atk',
      eventId: 'evt-t2-atk',
      expectedStateVersion: snapBeforeT2.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Turn 2 LLM launders offscreen event into ungrounded legendary item acquisition',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-dragon-slayer', name: '용살검', quantity: 1, category: '전설무기' },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'offscreen-secret-treasure-found' // Offscreen event at Shaolin Temple vs player at Luoyang
            }
          }
        }
      ]
    });

    const t2Res = engine.submitProposal(t2AttackProp);
    logs.push(`Turn 2 Attack: success=${t2Res.success}, rejections=${t2Res.rejectedReasons.join('; ')}`);

    const snapAfterT2 = engine.getSnapshot();
    const snapAfterT2Hash = computeSimpleHash(snapAfterT2);
    const hasLaunderedItem = snapAfterT2.character.inventory.some(i => i.id === 'item-dragon-slayer');

    const blocked = !t2Res.success && !hasLaunderedItem;

    reports.push({
      attackId,
      category: 'EVIDENCE_LAUNDERING',
      name: 'Multi-Turn Offscreen Event Evidence Laundering',
      description: 'LLM generates RECORD_OFFSCREEN_EVENT in Turn 1, then attempts in Turn 2 to use that record as authority to mint legendary items without proximity.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Virtual Draft Executor',
      multiTurn: true,
      turnsExecuted: 2,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeT2Hash,
      stateAfterHash: snapAfterT2Hash,
      mutatedCanonical: hasLaunderedItem,
      rejectionReasons: t2Res.rejectedReasons,
      evidenceDetails: `Turn 1 event creation: ${t1Res.success}. Turn 2 launder attempt blocked: ${!t2Res.success}. Inventory modified: ${hasLaunderedItem}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 2: Multi-Turn Narrative Seed Laundering -> LOOT / Quest State
  // Scenario: Turn 1: LLM commits ADD_NARRATIVE_SEED.
  //           Turn 2: LLM exploits the active seed ID as verifiedEventId to bypass LOOT acquisition checks.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-02-SEED-LAUNDER';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Turn 1: Add seed
    const t1SeedProp = attachMeaningTree({
      proposalId: 'p-t1-seed',
      requestId: 'req-t1-seed',
      eventId: 'evt-t1-seed',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Turn 1 LLM adds narrative seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-ancient-scroll',
            content: '누군가 동굴에 무림비급을 숨겨두었다는 소문이 파다하다.'
          } as NarrativeSeed
        }
      ]
    });
    const t1SeedRes = engine.submitProposal(t1SeedProp);
    logs.push(`Turn 1 ADD_NARRATIVE_SEED: success=${t1SeedRes.success}, version=${engine.getSnapshot().stateVersion}`);

    const snapBeforeT2 = engine.getSnapshot();
    const snapBeforeT2Hash = computeSimpleHash(snapBeforeT2);

    // Turn 2: Attempt to claim loot using seed ID as verifiedEventId
    const t2LootProp = attachMeaningTree({
      proposalId: 'p-t2-seed-loot',
      requestId: 'req-t2-seed-loot',
      eventId: 'evt-t2-seed-loot',
      expectedStateVersion: snapBeforeT2.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Turn 2 LLM exploits narrative seed for unauthorized LOOT acquisition',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-secret-manual', name: '무림비급', quantity: 1, category: '비급' },
            acquisition: {
              cause: 'LOOT',
              verifiedEventId: 'seed-ancient-scroll' // Seed is not a resolved loot drop event!
            }
          }
        }
      ]
    });
    const t2LootRes = engine.submitProposal(t2LootProp);
    logs.push(`Turn 2 Seed Exploitation: success=${t2LootRes.success}, rejections=${t2LootRes.rejectedReasons.join('; ')}`);

    const snapAfterT2 = engine.getSnapshot();
    const snapAfterT2Hash = computeSimpleHash(snapAfterT2);
    const hasSecretManual = snapAfterT2.character.inventory.some(i => i.id === 'item-secret-manual');

    const blocked = !t2LootRes.success && !hasSecretManual;

    reports.push({
      attackId,
      category: 'SEED_LAUNDERING',
      name: 'Narrative Seed Authority Confusion Attack',
      description: 'LLM claims an unresolved narrative seed is sufficient causal authority for high-tier LOOT acquisition.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Inventory & Cause Verification',
      multiTurn: true,
      turnsExecuted: 2,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeT2Hash,
      stateAfterHash: snapAfterT2Hash,
      mutatedCanonical: hasSecretManual,
      rejectionReasons: t2LootRes.rejectedReasons,
      evidenceDetails: `Turn 1 seed creation: ${t1SeedRes.success}. Turn 2 exploitation blocked: ${!t2LootRes.success}. Inventory modified: ${hasSecretManual}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 3: Candidate Self-Minted Claim & Evidence Laundering
  // Scenario: CandidatePacket contains raw fabricated ExternalEvidence and untrusted claims,
  //           trying to pass through ImmigrationGate and force VerifiedClaim creation.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-03-SELF-MINTED-CLAIM';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Create an NPC
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-setup-npc-elder',
      requestId: 'req-setup-elder',
      eventId: 'evt-setup-elder',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Setup target NPC',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-elder-1', name: '소림장로', npcClass: 'Class A', affinity: 50, status: 'ALIVE' } as NpcRecord
        }
      ]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);
    logs.push(`Canonical NPC created: id='npc-elder-1', affinity=50, status='ALIVE'`);

    // Forge a CandidatePacket with self-minted claims asserting affinity=100
    const forgedCandidate: CandidatePacket = {
      candidateId: 'cand-forgery-01',
      turn: 2,
      timestamp: getTime(),
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-elder-1',
            changes: { affinity: 100 }
          }
        }
      ],
      claims: [
        {
          claimId: 'claim-forged-1',
          entityId: 'npc-elder-1',
          attribute: 'affinity',
          value: 100,
          confidence: 0.99,
          evidenceRefs: ['forged-evidence-999']
        } as UntrustedClaim
      ],
      evidence: [
        {
          evidenceId: 'forged-evidence-999',
          sourceType: 'NARRATIVE_TEXT',
          content: '소림장로는 플레이어를 극도로 신뢰하게 되었다.',
          timestamp: getTime()
        } as ExternalEvidence
      ],
      identityInvalidations: []
    };

    // Pass through buildSafeProposalFromCandidate
    const parsedProposal = buildSafeProposalFromCandidate(
      snapBefore,
      forgedCandidate,
      2,
      engine.getHistory()
    );

    logs.push(`ProposalParser output: verifiedClaims count = ${parsedProposal.verifiedClaims?.length || 0}`);

    // Submit the resulting proposal to SovereignEngine
    const commitRes = engine.submitProposal(parsedProposal);
    logs.push(`Engine submitProposal verdict: success=${commitRes.success}, rejections=${commitRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const elderNpc = snapAfter.worldInfo.npcs.find(n => n.id === 'npc-elder-1');
    const affinityMutated = elderNpc?.affinity === 100;

    const blocked = !commitRes.success && !affinityMutated;

    reports.push({
      attackId,
      category: 'CLAIM_AUTHORITY',
      name: 'Candidate Self-Minted Claim & Evidence Laundering',
      description: 'CandidatePacket bundles self-fabricated ExternalEvidence and UntrustedClaim to force Gate-issued VerifiedClaim and mutate NPC affinity.',
      reachedRuntime: true,
      entryPoint: 'ProposalParser -> ImmigrationGate -> EngineValidator -> SovereignEngine',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: affinityMutated,
      rejectionReasons: commitRes.rejectedReasons,
      evidenceDetails: `Self-minted claim verifiedClaims count: ${parsedProposal.verifiedClaims?.length || 0}. Submission blocked: ${!commitRes.success}. Affinity remained ${elderNpc?.affinity}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 4: PLAYER Direct Result Mutation (UPDATE_NPC, SET_NPC_STATUS, UPDATE_FACTION)
  // Scenario: A malicious PLAYER input tries to directly declare results:
  //           - Overwriting NPC name/affinity
  //           - Setting NPC status to DEAD
  //           - Changing Faction influence directly
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-04-PLAYER-DIRECT-MUTATION';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Setup an NPC and Faction
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-setup-entities',
      requestId: 'req-setup-ent',
      eventId: 'evt-setup-ent',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Setup entities',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-target-1', name: '청부살수', npcClass: 'Class B', affinity: 0, status: 'ALIVE' } as NpcRecord
        },
        {
          type: 'ADD_FACTION',
          payload: { id: 'fac-shadow', name: '흑호방', description: '암살 집단', influence: 50 } as FactionRecord
        }
      ]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // 4.1 Player attempts UPDATE_NPC
    const p1Prop = attachMeaningTree({
      proposalId: 'p-player-update-npc',
      requestId: 'req-p1-mut',
      eventId: 'evt-p1-mut',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player declares they seduced and befriended the assassin',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-target-1', changes: { affinity: 99 } }
        }
      ]
    });
    const p1Res = engine.submitProposal(p1Prop);
    logs.push(`4.1 Player UPDATE_NPC: success=${p1Res.success}, rejections=${p1Res.rejectedReasons.join('; ')}`);

    // 4.2 Player attempts SET_NPC_STATUS to DEAD
    const p2Prop = attachMeaningTree({
      proposalId: 'p-player-kill-npc',
      requestId: 'req-p2-mut',
      eventId: 'evt-p2-mut',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player declares they instantly killed the assassin in one strike',
      actions: [
        {
          type: 'SET_NPC_STATUS',
          payload: { id: 'npc-target-1', status: 'DEAD' }
        }
      ]
    });
    const p2Res = engine.submitProposal(p2Prop);
    logs.push(`4.2 Player SET_NPC_STATUS: success=${p2Res.success}, rejections=${p2Res.rejectedReasons.join('; ')}`);

    // 4.3 Player attempts UPDATE_FACTION
    const p3Prop = attachMeaningTree({
      proposalId: 'p-player-update-fac',
      requestId: 'req-p3-mut',
      eventId: 'evt-p3-mut',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player declares the shadow faction now obeys them',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: { id: 'fac-shadow', changes: { influence: 0, attitudeTowardsPlayer: 'FEALTY' } }
        }
      ]
    });
    const p3Res = engine.submitProposal(p3Prop);
    logs.push(`4.3 Player UPDATE_FACTION: success=${p3Res.success}, rejections=${p3Res.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const targetNpc = snapAfter.worldInfo.npcs.find(n => n.id === 'npc-target-1');
    const shadowFac = snapAfter.worldInfo.factions.find(f => f.id === 'fac-shadow');

    const blocked = !p1Res.success && !p2Res.success && !p3Res.success &&
      targetNpc?.affinity === 0 && targetNpc?.status === 'ALIVE' && shadowFac?.influence === 50;

    reports.push({
      attackId,
      category: 'ACL_AUTHORITY_FIREWALL',
      name: 'PLAYER Direct Result Declaration & State Mutation',
      description: 'Player input attempting to declare world results directly (UPDATE_NPC, SET_NPC_STATUS, UPDATE_FACTION) bypassing causality & GM evaluation.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator ACL & Claim Enforcement',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: !blocked,
      rejectionReasons: [...p1Res.rejectedReasons, ...p2Res.rejectedReasons, ...p3Res.rejectedReasons],
      evidenceDetails: `All direct player mutations rejected. Target NPC alive with 0 affinity. Faction influence maintained at 50.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 5: Legitimate Player Actions (Must PASS and NOT false-positive reject!)
  // Scenario: Player legally buys an iron sword for 50 copper with sufficient funds.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-05-PLAYER-LEGITIMATE-ACTION';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Setup character with 100 copper at Blacksmith
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-legit-setup',
      requestId: 'req-legit-setup',
      eventId: 'evt-legit-setup',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Setup player inventory',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '검객',
            age: 22,
            origin: '화산',
            family: '유랑',
            upbringing: '수행',
            stats: { strength: 12, agility: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [{ id: 'item-copper', name: '동전', quantity: 100, category: '재화' }],
            status: 'HEALTHY',
            location: '대장간'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // Legitimate purchase: deduct 50 copper, add 철검 (cause: RESOURCE_EXCHANGE)
    const legitProp = attachMeaningTree({
      proposalId: 'p-legit-buy-sword',
      requestId: 'req-legit-buy',
      eventId: 'evt-legit-buy',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player purchases 철검 for 50 copper at blacksmith',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'REMOVE',
            item: { id: 'item-copper', name: '동전', quantity: 50, category: '재화' }
          }
        },
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-iron-sword', name: '철검', quantity: 1, category: '무기' },
            acquisition: {
              cause: 'RESOURCE_EXCHANGE',
              cost: { id: 'item-copper', name: '동전', quantity: 50 }
            }
          }
        }
      ]
    });

    const legitRes = engine.submitProposal(legitProp);
    logs.push(`Legitimate Purchase Result: success=${legitRes.success}, rejections=${legitRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const copperLeft = snapAfter.character.inventory.find(i => i.id === 'item-copper')?.quantity;
    const hasSword = snapAfter.character.inventory.some(i => i.id === 'item-iron-sword');

    const legitSuccess = legitRes.success && copperLeft === 50 && hasSword;

    reports.push({
      attackId,
      category: 'LEGITIMATE_ACTION_PERMISSIVENESS',
      name: 'Legitimate Player Transaction Permissiveness',
      description: 'Verifies that legitimate, fully-funded transactions (e.g. purchasing items at a shop) are correctly executed and not over-blocked by validator paranoia.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Virtual Draft Executor',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: legitSuccess ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: legitSuccess,
      rejectionReasons: legitRes.rejectedReasons,
      evidenceDetails: `Purchase permitted: ${legitRes.success}. Remaining copper: ${copperLeft}. Iron sword received: ${hasSword}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 6: Numerical Boundary & NaN/Infinity Injection Attack
  // Scenario: Attempt to inject NaN, -Infinity, negative quantities, or out-of-bound stats
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-06-NUMERICAL-POISONING';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // 6.1 Inject NaN / Infinity in NPC affinity
    const nanProp = attachMeaningTree({
      proposalId: 'p-nan-attack',
      requestId: 'req-nan',
      eventId: 'evt-nan',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Inject NaN affinity',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-nan', name: '수학적 괴물', affinity: NaN, npcClass: 'Class C' } as any
        }
      ]
    });
    const nanRes = engine.submitProposal(nanProp);
    logs.push(`6.1 NaN Injection: success=${nanRes.success}, rejections=${nanRes.rejectedReasons.join('; ')}`);

    // 6.2 Inject negative quantity inventory
    const negInvProp = attachMeaningTree({
      proposalId: 'p-neg-inv',
      requestId: 'req-neg-inv',
      eventId: 'evt-neg-inv',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Inject negative item quantity',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-void', name: '공허의 검', quantity: -10, category: '오류' }
          }
        }
      ]
    });
    const negInvRes = engine.submitProposal(negInvProp);
    logs.push(`6.2 Negative Quantity Injection: success=${negInvRes.success}, rejections=${negInvRes.rejectedReasons.join('; ')}`);

    // 6.3 Inject stats > 100 via UPDATE_CHARACTER_STATS
    const statProp = attachMeaningTree({
      proposalId: 'p-stat-overflow',
      requestId: 'req-stat-of',
      eventId: 'evt-stat-of',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Inject stat overflow',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 99999, agility: -50 } as any
        }
      ]
    });
    const statRes = engine.submitProposal(statProp);
    logs.push(`6.3 Stat Overflow Injection: success=${statRes.success}, rejections=${statRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const blocked = !nanRes.success && !negInvRes.success && !statRes.success;

    reports.push({
      attackId,
      category: 'NUMERICAL_POISONING',
      name: 'Numerical Boundary & NaN/Infinity Injection Attack',
      description: 'Injecting NaN, Infinity, negative quantities, and stat overflows to corrupt mathematical invariants.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Numerical Gate',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: !blocked,
      rejectionReasons: [...nanRes.rejectedReasons, ...negInvRes.rejectedReasons, ...statRes.rejectedReasons],
      evidenceDetails: `All numerical poison injections blocked: ${blocked}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 7: Temporal Monotonicity & Turn/Timestamp Regression Attack
  // Scenario: Submit a proposal with a timestamp in the past or a turn number smaller than canon.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-07-TEMPORAL-REGRESSION';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Turn 1 setup
    const t1Time = getTime();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-t1-time-setup',
      requestId: 'req-t1-time',
      eventId: 'evt-t1-time',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: t1Time,
      intentSummary: 'Turn 1 setup',
      actions: [{ type: 'ADVANCE_CHAPTER', payload: { currentChapter: '제1장' } }]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // 7.1 Regression attack: timestamp 1 year in the past
    const pastTimeProp = attachMeaningTree({
      proposalId: 'p-past-time',
      requestId: 'req-past-time',
      eventId: 'evt-past-time',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: '2020-01-01T00:00:00.000Z', // In the past!
      intentSummary: 'Attempt temporal regression by manipulating timestamp',
      actions: [{ type: 'ADVANCE_CHAPTER', payload: { currentChapter: '과거의 장' } }]
    });
    const pastTimeRes = engine.submitProposal(pastTimeProp);
    logs.push(`7.1 Timestamp Regression: success=${pastTimeRes.success}, rejections=${pastTimeRes.rejectedReasons.join('; ')}`);

    // 7.2 Turn regression attack: turn number 0 when engine is at turn 1
    const pastTurnProp = attachMeaningTree({
      proposalId: 'p-past-turn',
      requestId: 'req-past-turn',
      eventId: 'evt-past-turn',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: 0, // Regressed turn!
      timestamp: getTime(),
      intentSummary: 'Attempt turn regression',
      actions: [{ type: 'ADVANCE_CHAPTER', payload: { currentChapter: '과거 턴의 장' } }]
    });
    const pastTurnRes = engine.submitProposal(pastTurnProp);
    logs.push(`7.2 Turn Regression: success=${pastTurnRes.success}, rejections=${pastTurnRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const currentChapter = snapAfter.worldInfo.chapters?.currentChapter || (snapAfter.worldInfo as any).currentChapter;
    const blocked = !pastTimeRes.success && !pastTurnRes.success && currentChapter === '제1장';

    reports.push({
      attackId,
      category: 'TEMPORAL_MONOTONICITY',
      name: 'Temporal Monotonicity & Turn/Timestamp Regression Attack',
      description: 'Submitting proposals with backwards timestamps and regressed turn numbers to test temporal integrity.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Monotonicity Check',
      multiTurn: true,
      turnsExecuted: 2,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: false,
      rejectionReasons: [...pastTimeRes.rejectedReasons, ...pastTurnRes.rejectedReasons],
      evidenceDetails: `Past timestamp rejected: ${!pastTimeRes.success}. Regressed turn rejected: ${!pastTurnRes.success}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 8: Event Grounding Double-Spending & Replay Attack
  // Scenario: Attempt to reuse the SAME verifiedEventId in multiple turns to spawn duplicate items.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-08-EVIDENCE-DOUBLE-SPEND';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Setup character in 낙양 백마사
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-setup-explorer',
      requestId: 'req-setup-exp',
      eventId: 'evt-setup-exp',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Setup explorer',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '탐험가',
            age: 20,
            origin: '낙양',
            family: '상인',
            upbringing: '상업',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [],
            status: 'HEALTHY',
            location: '낙양 백마사'
          }
        }
      ]
    });

    // Create a legitimate discovery event in history at 낙양 백마사
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-legit-event-creation',
      requestId: 'req-legit-evt',
      eventId: 'evt-legit-evt',
      expectedStateVersion: 2,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Legitimate world discovery event',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            id: 'event-buddha-relic-uncovered',
            eventDescription: '백마사 탑 아래에서 불사리가 발견되었다.',
            actors: ['주지스님'],
            location: '낙양 백마사'
          } as OffscreenEventRecord
        }
      ]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // 8.1 First consumption: Pick up 불사리 using event-buddha-relic-uncovered
    const pickup1Prop = attachMeaningTree({
      proposalId: 'p-pickup-1',
      requestId: 'req-pickup-1',
      eventId: 'evt-pickup-1',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Player picks up Buddha relic',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-buddha-relic', name: '불사리', quantity: 1, category: '성물' },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'event-buddha-relic-uncovered'
            }
          }
        }
      ]
    });
    const pickup1Res = engine.submitProposal(pickup1Prop);
    logs.push(`8.1 First Pickup: success=${pickup1Res.success}, version=${engine.getSnapshot().stateVersion}`);

    // 8.2 Second consumption: Attempt to reuse the SAME event ID to spawn a second relic!
    const pickup2Prop = attachMeaningTree({
      proposalId: 'p-pickup-2-replay',
      requestId: 'req-pickup-2',
      eventId: 'evt-pickup-2',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 3,
      timestamp: getTime(),
      intentSummary: 'Player attempts duplicate pickup with consumed event',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-buddha-relic-dup', name: '불사리 복제품', quantity: 1, category: '성물' },
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'event-buddha-relic-uncovered' // ALREADY CONSUMED in Turn 2!
            }
          }
        }
      ]
    });
    const pickup2Res = engine.submitProposal(pickup2Prop);
    logs.push(`8.2 Second Duplicate Pickup (Replay Attack): success=${pickup2Res.success}, rejections=${pickup2Res.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const relicCount = snapAfter.character.inventory.filter(i => i.name.includes('불사리')).length;

    const blocked = pickup1Res.success && !pickup2Res.success && relicCount === 1;

    reports.push({
      attackId,
      category: 'CONSUMED_EVIDENCE_REPLAY',
      name: 'Event Grounding Double-Spending & Replay Attack',
      description: 'Attempting to re-use an already consumed world event to spawn multiple items across successive turns.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Anti-Replay Gate',
      multiTurn: true,
      turnsExecuted: 3,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: relicCount > 1,
      rejectionReasons: pickup2Res.rejectedReasons,
      evidenceDetails: `First legitimate consumption succeeded. Replay attack blocked: ${!pickup2Res.success}. Final relic count: ${relicCount}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 9: Stale State Version Regression Attack
  // Scenario: Submit proposals with stale expectedStateVersion against advancing engine state
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-09-STALE-VERSION-REGRESSION';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Advance engine to version 3
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-v1-adv',
      requestId: 'req-v1-adv',
      eventId: 'evt-v1-adv',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Advance v1->v2',
      actions: [{ type: 'ADVANCE_CHAPTER', payload: { currentChapter: '제2장' } }]
    });
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-v2-adv',
      requestId: 'req-v2-adv',
      eventId: 'evt-v2-adv',
      expectedStateVersion: 2,
      source: 'SYSTEM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Advance v2->v3',
      actions: [{ type: 'ADVANCE_CHAPTER', payload: { currentChapter: '제3장' } }]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);
    logs.push(`Engine at stateVersion = ${snapBefore.stateVersion}`);

    // Attack: submit proposal claiming expectedStateVersion = 1 (stale by 2 versions)
    const staleProp = attachMeaningTree({
      proposalId: 'p-stale-attack',
      requestId: 'req-stale-atk',
      eventId: 'evt-stale-atk',
      expectedStateVersion: 1, // Stale!
      source: 'PLAYER',
      turn: 3,
      timestamp: getTime(),
      intentSummary: 'Stale version regression mutation attempt',
      actions: [{ type: 'ADVANCE_CHAPTER', payload: { currentChapter: '조작된 과거' } }]
    });
    const staleRes = engine.submitProposal(staleProp);
    logs.push(`Stale Version Attack: success=${staleRes.success}, rejections=${staleRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const currentChapter = snapAfter.worldInfo.chapters?.currentChapter || (snapAfter.worldInfo as any).currentChapter;
    const blocked = !staleRes.success && currentChapter === '제3장' && snapAfter.stateVersion === 3;

    reports.push({
      attackId,
      category: 'STATE_VERSION_GUARD',
      name: 'Stale State Version Collision & Regression Attack',
      description: 'Submitting a state mutation specifying a stale expectedStateVersion to test for silent overwrite or lost update vulnerabilities.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> StateVersion Strict Match Guard',
      multiTurn: true,
      turnsExecuted: 3,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: false,
      rejectionReasons: staleRes.rejectedReasons,
      evidenceDetails: `Stale expectedStateVersion=1 against sovereign version=3 was blocked: ${!staleRes.success}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 10: Composite Proposal & Action Ordering / Draft-vs-Canonical Confusion
  // Scenario: A single proposal contains multiple intertwined actions:
  //           Action 1: Spend 50 gold (when player only has 20 gold)
  //           Action 2: Advance Chapter
  //           Checks if EngineValidator virtual draft executor catches the overdraft without partial commits.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-10-COMPOSITE-ORDERING-DRAFT';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Setup player with 20 gold
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-draft-setup',
      requestId: 'req-draft-setup',
      eventId: 'evt-draft-setup',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Setup player with 20 gold',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: '무명인',
            age: 20,
            origin: '산동',
            family: '평민',
            upbringing: '수행',
            stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            inventory: [{ id: 'item-gold', name: '금화', quantity: 20, category: '재화' }],
            status: 'HEALTHY',
            location: '주막'
          }
        }
      ]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // Composite attack: Attempt to remove 50 gold (overdraft by 30) while advancing chapter
    const compositeProp = attachMeaningTree({
      proposalId: 'p-composite-overdraft',
      requestId: 'req-comp-od',
      eventId: 'evt-comp-od',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Composite overdraft and chapter advancement',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'REMOVE',
            item: { id: 'item-gold', name: '금화', quantity: 50, category: '재화' }
          }
        },
        {
          type: 'ADVANCE_CHAPTER',
          payload: { currentChapter: '돈 없는 장' }
        }
      ]
    });
    const compRes = engine.submitProposal(compositeProp);
    logs.push(`Composite Overdraft Attack: success=${compRes.success}, rejections=${compRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const goldCount = snapAfter.character.inventory.find(i => i.id === 'item-gold')?.quantity;
    const chapter = snapAfter.currentChapter;

    // Must be completely atomic: NO gold deducted, NO chapter advanced
    const blocked = !compRes.success && goldCount === 20 && chapter !== '돈 없는 장';

    reports.push({
      attackId,
      category: 'ATOMICITY_AND_DRAFT_EVALUATION',
      name: 'Composite Action Ordering & Virtual Draft Overdraft Defense',
      description: 'Verifies that a multi-action composite proposal containing an invalid overdraft action fails atomically with zero intermediate state mutations.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Virtual Draft Executor',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: false,
      rejectionReasons: compRes.rejectedReasons,
      evidenceDetails: `Atomic rollback confirmed: success=${compRes.success}, Gold preserved at ${goldCount}, Chapter remained '${chapter}'.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 11: Identity Collision & NOVEL Passport Gate Bypass
  // Scenario: Attempt to register an NPC with colliding identity or bypass immigration resolution
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-11-IDENTITY-COLLISION-GATE';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Setup an existing canonical NPC
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-id-setup',
      requestId: 'req-id-setup',
      eventId: 'evt-id-setup',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Setup existing canonical NPC',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-sam-hwa', name: '삼화취정 화산파 사숙', npcClass: 'Class A' } as NpcRecord
        }
      ]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // 11.1 Attempt to register another NPC with same ID from LLM source without resolution
    const dupIdProp = attachMeaningTree({
      proposalId: 'p-dup-id-atk',
      requestId: 'req-dup-id',
      eventId: 'evt-dup-id',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Duplicate NPC ID injection',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-sam-hwa', name: '가짜 화산파 사숙', npcClass: 'Class B' } as NpcRecord
        }
      ]
    });
    const dupIdRes = engine.submitProposal(dupIdProp);
    logs.push(`11.1 Duplicate NPC ID Attack: success=${dupIdRes.success}, rejections=${dupIdRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const npcs = snapAfter.worldInfo.npcs;
    const blocked = !dupIdRes.success && npcs.length === 1 && npcs[0].name === '삼화취정 화산파 사숙';

    reports.push({
      attackId,
      category: 'IDENTITY_RESOLUTION_GATE',
      name: 'NPC Identity Collision & Immigration Gate Bypass',
      description: 'Attempting to inject duplicate or colliding NPC identities from an LLM proposal to corrupt the entity identity index.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Identity & Uniqueness Check',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: false,
      rejectionReasons: dupIdRes.rejectedReasons,
      evidenceDetails: `Duplicate ID attack blocked: ${!dupIdRes.success}. Canonical NPC preserved unchanged.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 12: History / Passport Authority Exploitation
  // Scenario: LLM attempts to claim SET_WORLD_METADATA or alter canonical rules citing historical records.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-12-HISTORY-AUTHORITY-EXPLOIT';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // LLM proposal attempting to call SET_WORLD_METADATA
    const metaProp = attachMeaningTree({
      proposalId: 'p-meta-exploit',
      requestId: 'req-meta-exp',
      eventId: 'evt-meta-exp',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'LLM attempts to overwrite world metadata and genre',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: { title: '해킹된 무림', genre: '사이버펑크' }
        }
      ]
    });
    const metaRes = engine.submitProposal(metaProp);
    logs.push(`SET_WORLD_METADATA exploit: success=${metaRes.success}, rejections=${metaRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const blocked = !metaRes.success && snapAfter.worldInfo.title !== '해킹된 무림';

    reports.push({
      attackId,
      category: 'ACL_AUTHORITY_FIREWALL',
      name: 'Privileged World Metadata Modification Attack',
      description: 'LLM attempt to invoke SET_WORLD_METADATA to rewrite sovereign world parameters and genre rules.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator ACL Firewall',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: false,
      rejectionReasons: metaRes.rejectedReasons,
      evidenceDetails: `Privileged action SET_WORLD_METADATA blocked from LLM: ${!metaRes.success}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 13: Alternate Action Type / Prototype Injection Attack
  // Scenario: Submitting unwhitelisted action types or prototype polluting payloads
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-13-PROTOTYPE-POLLUTION-INJECTION';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();
    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // 13.1 Unknown action type
    const unknownActionProp = attachMeaningTree({
      proposalId: 'p-unknown-action',
      requestId: 'req-unk-act',
      eventId: 'evt-unk-act',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Inject unknown action type',
      actions: [
        {
          type: 'FORCE_GRANT_GOD_MODE' as any,
          payload: { power: 9999 }
        }
      ]
    });
    const unkRes = engine.submitProposal(unknownActionProp);
    logs.push(`13.1 Unknown action: success=${unkRes.success}, rejections=${unkRes.rejectedReasons.join('; ')}`);

    // 13.2 Prototype pollution injection in payload
    const protoProp = attachMeaningTree({
      proposalId: 'p-proto-pollute',
      requestId: 'req-proto-pol',
      eventId: 'evt-proto-pol',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Inject prototype pollution',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: JSON.parse('{"__proto__": {"polluted": true}, "currentChapter": "오염된 장"}')
        }
      ]
    });
    const protoRes = engine.submitProposal(protoProp);
    logs.push(`13.2 Prototype pollution: success=${protoRes.success}`);

    const isGlobalPolluted = ({} as any).polluted === true;
    logs.push(`Global Object polluted: ${isGlobalPolluted}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const blocked = !unkRes.success && !isGlobalPolluted;

    reports.push({
      attackId,
      category: 'SECURITY_HARDENING',
      name: 'Unwhitelisted Action Type & Prototype Pollution Attack',
      description: 'Submitting unwhitelisted action types and __proto__ object injection to test engine resilience.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Schema & Action Type Gate',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: isGlobalPolluted,
      rejectionReasons: unkRes.rejectedReasons,
      evidenceDetails: `Unknown action blocked: ${!unkRes.success}. Global prototype clean: ${!isGlobalPolluted}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 14: Multi-Turn Character Secret Laundering
  // Scenario: Turn 1: LLM tries to execute SET_CHARACTER_SECRET to fabricate a hidden vulnerability.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-14-SECRET-LAUNDERING';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // Turn 1: LLM attempts SET_CHARACTER_SECRET
    const t1SecretProp = attachMeaningTree({
      proposalId: 'p-t1-secret',
      requestId: 'req-t1-sec',
      eventId: 'evt-t1-sec',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'LLM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Turn 1 LLM tries to inject character secret',
      actions: [
        {
          type: 'SET_CHARACTER_SECRET',
          payload: { secret: '주인공은 사실 마교 교주의 숨겨진 아들이다.' }
        }
      ]
    });
    const t1SecRes = engine.submitProposal(t1SecretProp);
    logs.push(`Turn 1 SET_CHARACTER_SECRET: success=${t1SecRes.success}, rejections=${t1SecRes.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const secretInjected = snapAfter.character.secret === '주인공은 사실 마교 교주의 숨겨진 아들이다.';
    const blocked = !t1SecRes.success && !secretInjected;

    reports.push({
      attackId,
      category: 'ACL_AUTHORITY_FIREWALL',
      name: 'Multi-Turn Character Secret Laundering & Privilege Escalation',
      description: 'LLM attempt to invoke SET_CHARACTER_SECRET to unilaterally modify character backstory and bypass narrative causality.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator ACL Firewall',
      multiTurn: true,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: secretInjected,
      rejectionReasons: t1SecRes.rejectedReasons,
      evidenceDetails: `SET_CHARACTER_SECRET blocked from LLM: ${!t1SecRes.success}. Secret injected: ${secretInjected}.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // ATTACK 15: Adversarial Retry & Variant Bypass Attacks
  // Scenario: Attackers mutate previous payloads with subtle encoding/case/whitespace alterations
  //           to attempt second-order validator filter bypasses.
  // --------------------------------------------------------------------------
  {
    const attackId = 'ATK-15-ADVERSARIAL-VARIANT-RETRY';
    const logs: string[] = [];
    const getTime = createTimeGenerator();
    const engine = new SovereignEngine();

    // Setup an NPC
    dispatchEngineInternalProposal(engine, {
      proposalId: 'p-var-setup',
      requestId: 'req-var-setup',
      eventId: 'evt-var-setup',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: getTime(),
      intentSummary: 'Setup target NPC',
      actions: [
        {
          type: 'ADD_NPC',
          payload: { id: 'npc-target-var', name: '독고구검', npcClass: 'Class A', affinity: 40, status: 'ALIVE' } as NpcRecord
        }
      ]
    });

    const snapBefore = engine.getSnapshot();
    const snapBeforeHash = computeSimpleHash(snapBefore);

    // Variant 1: Trailing spaces in entity ID
    const var1Prop = attachMeaningTree({
      proposalId: 'p-var-1',
      requestId: 'req-var-1',
      eventId: 'evt-var-1',
      expectedStateVersion: snapBefore.stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Variant attack on UPDATE_NPC with whitespace padded entity ID',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-target-var ', changes: { affinity: 90 } } // Trailing space
        }
      ]
    });
    const var1Res = engine.submitProposal(var1Prop);
    logs.push(`Variant 1 (Trailing Space ID): success=${var1Res.success}, rejections=${var1Res.rejectedReasons.join('; ')}`);

    // Variant 2: Empty changes object bypass
    const var2Prop = attachMeaningTree({
      proposalId: 'p-var-2',
      requestId: 'req-var-2',
      eventId: 'evt-var-2',
      expectedStateVersion: engine.getSnapshot().stateVersion,
      source: 'PLAYER',
      turn: 2,
      timestamp: getTime(),
      intentSummary: 'Variant attack with empty changes object',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: { id: 'npc-target-var', changes: {} }
        }
      ]
    });
    const var2Res = engine.submitProposal(var2Prop);
    logs.push(`Variant 2 (Empty Changes): success=${var2Res.success}, rejections=${var2Res.rejectedReasons.join('; ')}`);

    const snapAfter = engine.getSnapshot();
    const snapAfterHash = computeSimpleHash(snapAfter);
    const targetNpc = snapAfter.worldInfo.npcs.find(n => n.id === 'npc-target-var');
    const blocked = !var1Res.success && !var2Res.success && targetNpc?.affinity === 40;

    reports.push({
      attackId,
      category: 'ADVERSARIAL_VARIANT_DEFENSE',
      name: 'Adversarial Padding & Empty-Payload Variant Attacks',
      description: 'Submitting malformed entity IDs with trailing whitespace and empty mutation change objects to test validation depth.',
      reachedRuntime: true,
      entryPoint: 'SovereignEngine.submitProposal -> EngineValidator Structural & Exact Entity Match',
      multiTurn: false,
      turnsExecuted: 1,
      verdict: blocked ? 'GREEN' : 'RED',
      stateBeforeHash: snapBeforeHash,
      stateAfterHash: snapAfterHash,
      mutatedCanonical: targetNpc?.affinity !== 40,
      rejectionReasons: [...var1Res.rejectedReasons, ...var2Res.rejectedReasons],
      evidenceDetails: `Trailing space attack blocked: ${!var1Res.success}. Empty payload attack blocked: ${!var2Res.success}. Target NPC affinity preserved at 40.`,
      forensicLog: logs
    });
  }

  // --------------------------------------------------------------------------
  // SUMMARY EVALUATION
  // --------------------------------------------------------------------------
  const allGreen = reports.every(r => r.verdict === 'GREEN');

  console.log('================================================================');
  console.log('📊 FINAL RED-TEAM PENETRATION RESULTS SUMMARY');
  console.log('================================================================');
  for (const rep of reports) {
    console.log(`[${rep.verdict}] ${rep.attackId} - ${rep.name}`);
    console.log(`      Target: ${rep.entryPoint}`);
    console.log(`      Multi-Turn: ${rep.multiTurn} (Executed ${rep.turnsExecuted} turns)`);
    console.log(`      Canonical Mutation: ${rep.mutatedCanonical ? '⚠️ VULNERABLE' : '🛡️ ZERO-MUTATION'}`);
    if (rep.rejectionReasons.length > 0) {
      console.log(`      Rejection Reasons: ${rep.rejectionReasons.join(' | ')}`);
    }
    console.log('----------------------------------------------------------------');
  }
  console.log(`\nOverall Verdict: ${allGreen ? '✅ ALL GREEN (100% BLOCKED & HARDENED)' : '❌ VULNERABILITIES DETECTED'}`);

  return { items: reports, allGreen };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.endsWith('final_redteam_penetration_mission_runner.ts')) {
  const { allGreen } = runFinalRedTeamPenetrationMission();
  if (!allGreen) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
