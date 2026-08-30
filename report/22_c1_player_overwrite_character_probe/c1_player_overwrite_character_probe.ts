import { SovereignEngine } from '../../src/engine/state';
import { StateTransitionProposal } from '../../src/engine/types';
import { createEmptyCharacter, createEmptyWorldInfo } from '../../src/utils/factory';

export interface ProbeStageResult {
  stage: string;
  before: {
    turn: number;
    stateVersion: number;
    stats: Record<string, number>;
  };
  proposal: {
    source: string;
    actionType: string;
    payload: any;
    expectedStateVersion: number;
    requestId: string;
    eventId: string;
    turn: number;
    hasVerifiedClaims: boolean;
  };
  validation: {
    success: boolean;
    committedActionsCount: number;
    rejectedReasons: readonly string[];
    conflictDetails: readonly string[];
  };
  after: {
    turn: number;
    stateVersion: number;
    stats: Record<string, number>;
  };
  canonicalOverwritten: boolean;
}

export function runC1Probe(): {
  stages: ProbeStageResult[];
  verdict: 'RUNTIME BREACH — CRITICAL' | 'RUNTIME BLOCKED' | 'STATIC GAP / RUNTIME UNPROVEN' | 'TEST INVALID';
  summary: string;
} {
  const stages: ProbeStageResult[] = [];

  // =========================================================================
  // SETUP: Establish initial world and character with 2 consecutive canonical commits
  // =========================================================================
  const initialWorld = createEmptyWorldInfo();
  initialWorld.worldName = 'Chronicles of Valen';
  initialWorld.currentTime = { year: 1024, month: 4, day: 15, hour: 8, minute: 0 };

  const initialCharacter = createEmptyCharacter();
  initialCharacter.name = 'Valen Knight';
  initialCharacter.stats = {
    strength: 10,
    agility: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  };
  initialCharacter.inventory = [
    { id: 'item-iron-sword', name: 'Iron Sword', quantity: 1 }
  ];

  const engine = new SovereignEngine(initialWorld, initialCharacter, [], 1, 1);

  // Commit 1: Genesis / Initial Commit (Turn 1 -> Turn 1, StateVersion 1 -> 2)
  const genesisProposal: StateTransitionProposal = {
    proposalId: 'prop-genesis-001',
    requestId: 'req-genesis-001',
    eventId: 'evt-genesis-001',
    turn: 1,
    timestamp: '2026-08-29T10:00:00.000Z',
    expectedStateVersion: 1,
    source: 'GENESIS',
    actions: [
      {
        type: 'SET_WORLD_METADATA',
        payload: {
          worldName: 'Chronicles of Valen',
          settingDescription: 'A harsh medieval realm.'
        }
      }
    ]
  };

  const commit1 = engine.submitProposal(genesisProposal);
  if (!commit1.success) {
    return {
      stages,
      verdict: 'TEST INVALID',
      summary: `Failed at Genesis Commit 1: ${commit1.rejectedReasons.join('; ')}`
    };
  }

  // Commit 2: Normal Gameplay Turn (Turn 1 -> Turn 2, StateVersion 2 -> 3)
  const normalTurn2Proposal: StateTransitionProposal = {
    proposalId: 'prop-gameplay-002',
    requestId: 'req-gameplay-002',
    eventId: 'evt-gameplay-002',
    turn: 2,
    timestamp: '2026-08-29T10:05:00.000Z',
    expectedStateVersion: 2,
    source: 'PLAYER',
    actions: [
      {
        type: 'RECORD_DICE_RESULT',
        payload: {
          targetDC: 12,
          rollValue: 15
        }
      }
    ]
  };

  const commit2 = engine.submitProposal(normalTurn2Proposal);
  if (!commit2.success) {
    return {
      stages,
      verdict: 'TEST INVALID',
      summary: `Failed at Gameplay Commit 2: ${commit2.rejectedReasons.join('; ')}`
    };
  }

  // =========================================================================
  // MANDATORY ATTACK 1: T3 / V3 — Full Max-Stat Overwrite during active gameplay
  // =========================================================================
  const snapBeforeT3 = engine.getSnapshot();
  const t3Proposal: StateTransitionProposal = {
    proposalId: 'prop-attack-t3-001',
    requestId: 'req-attack-t3-001',
    eventId: 'evt-attack-t3-001',
    turn: 3,
    timestamp: '2026-08-29T10:10:00.000Z',
    expectedStateVersion: snapBeforeT3.stateVersion, // 3
    source: 'PLAYER',
    actions: [
      {
        type: 'OVERWRITE_CHARACTER',
        payload: {
          name: snapBeforeT3.character.name, // 'Valen Knight'
          stats: {
            strength: 30,
            agility: 30,
            constitution: 30,
            intelligence: 30,
            wisdom: 30,
            charisma: 30
          },
          inventory: snapBeforeT3.character.inventory,
          timeline: snapBeforeT3.character.timeline
        }
      }
    ]
  };

  const resultT3 = engine.submitProposal(t3Proposal);
  const snapAfterT3 = engine.getSnapshot();

  const isT3Overwritten = resultT3.success &&
    snapAfterT3.character.stats.strength === 30 &&
    snapAfterT3.character.stats.agility === 30 &&
    snapAfterT3.character.stats.constitution === 30 &&
    snapAfterT3.character.stats.intelligence === 30 &&
    snapAfterT3.character.stats.wisdom === 30 &&
    snapAfterT3.character.stats.charisma === 30;

  stages.push({
    stage: 'MANDATORY ATTACK 1 (T3/V3 - Full Max-Stat 30 Overwrite)',
    before: {
      turn: snapBeforeT3.turn,
      stateVersion: snapBeforeT3.stateVersion,
      stats: { ...snapBeforeT3.character.stats }
    },
    proposal: {
      source: t3Proposal.source,
      actionType: t3Proposal.actions[0].type,
      payload: t3Proposal.actions[0].payload,
      expectedStateVersion: t3Proposal.expectedStateVersion,
      requestId: t3Proposal.requestId,
      eventId: t3Proposal.eventId,
      turn: t3Proposal.turn,
      hasVerifiedClaims: false
    },
    validation: {
      success: resultT3.success,
      committedActionsCount: resultT3.committedActionsCount,
      rejectedReasons: resultT3.rejectedReasons,
      conflictDetails: resultT3.conflictDetails
    },
    after: {
      turn: snapAfterT3.turn,
      stateVersion: snapAfterT3.stateVersion,
      stats: { ...snapAfterT3.character.stats }
    },
    canonicalOverwritten: isT3Overwritten
  });

  // =========================================================================
  // ADDITIONAL ATTACK 2: T4 / V4 — Partial Stat Overwrite (Strength=28, Intelligence=29)
  // =========================================================================
  const snapBeforeT4 = engine.getSnapshot();
  const t4Proposal: StateTransitionProposal = {
    proposalId: 'prop-attack-t4-002',
    requestId: 'req-attack-t4-002',
    eventId: 'evt-attack-t4-002',
    turn: 4,
    timestamp: '2026-08-29T10:15:00.000Z',
    expectedStateVersion: snapBeforeT4.stateVersion, // 4
    source: 'PLAYER',
    actions: [
      {
        type: 'OVERWRITE_CHARACTER',
        payload: {
          name: snapBeforeT4.character.name,
          stats: {
            strength: 28,
            intelligence: 29
          },
          inventory: snapBeforeT4.character.inventory,
          timeline: snapBeforeT4.character.timeline
        }
      }
    ]
  };

  const resultT4 = engine.submitProposal(t4Proposal);
  const snapAfterT4 = engine.getSnapshot();

  const isT4Overwritten = resultT4.success &&
    snapAfterT4.character.stats.strength === 28 &&
    snapAfterT4.character.stats.intelligence === 29;

  stages.push({
    stage: 'ADDITIONAL ATTACK 2 (T4/V4 - Partial Stat Overwrite Strength=28, Int=29)',
    before: {
      turn: snapBeforeT4.turn,
      stateVersion: snapBeforeT4.stateVersion,
      stats: { ...snapBeforeT4.character.stats }
    },
    proposal: {
      source: t4Proposal.source,
      actionType: t4Proposal.actions[0].type,
      payload: t4Proposal.actions[0].payload,
      expectedStateVersion: t4Proposal.expectedStateVersion,
      requestId: t4Proposal.requestId,
      eventId: t4Proposal.eventId,
      turn: t4Proposal.turn,
      hasVerifiedClaims: false
    },
    validation: {
      success: resultT4.success,
      committedActionsCount: resultT4.committedActionsCount,
      rejectedReasons: resultT4.rejectedReasons,
      conflictDetails: resultT4.conflictDetails
    },
    after: {
      turn: snapAfterT4.turn,
      stateVersion: snapAfterT4.stateVersion,
      stats: { ...snapAfterT4.character.stats }
    },
    canonicalOverwritten: isT4Overwritten
  });

  // =========================================================================
  // ADDITIONAL ATTACK 3: T5 / V5 — Repeated Total Stat Overwrite (All stats set to 1)
  // =========================================================================
  const snapBeforeT5 = engine.getSnapshot();
  const t5Proposal: StateTransitionProposal = {
    proposalId: 'prop-attack-t5-003',
    requestId: 'req-attack-t5-003',
    eventId: 'evt-attack-t5-003',
    turn: 5,
    timestamp: '2026-08-29T10:20:00.000Z',
    expectedStateVersion: snapBeforeT5.stateVersion, // 5
    source: 'PLAYER',
    actions: [
      {
        type: 'OVERWRITE_CHARACTER',
        payload: {
          name: snapBeforeT5.character.name,
          stats: {
            strength: 1,
            agility: 1,
            constitution: 1,
            intelligence: 1,
            wisdom: 1,
            charisma: 1
          },
          inventory: snapBeforeT5.character.inventory,
          timeline: snapBeforeT5.character.timeline
        }
      }
    ]
  };

  const resultT5 = engine.submitProposal(t5Proposal);
  const snapAfterT5 = engine.getSnapshot();

  const isT5Overwritten = resultT5.success &&
    snapAfterT5.character.stats.strength === 1 &&
    snapAfterT5.character.stats.agility === 1 &&
    snapAfterT5.character.stats.constitution === 1 &&
    snapAfterT5.character.stats.intelligence === 1 &&
    snapAfterT5.character.stats.wisdom === 1 &&
    snapAfterT5.character.stats.charisma === 1;

  stages.push({
    stage: 'ADDITIONAL ATTACK 3 (T5/V5 - Repeated Total Stat Overwrite to 1)',
    before: {
      turn: snapBeforeT5.turn,
      stateVersion: snapBeforeT5.stateVersion,
      stats: { ...snapBeforeT5.character.stats }
    },
    proposal: {
      source: t5Proposal.source,
      actionType: t5Proposal.actions[0].type,
      payload: t5Proposal.actions[0].payload,
      expectedStateVersion: t5Proposal.expectedStateVersion,
      requestId: t5Proposal.requestId,
      eventId: t5Proposal.eventId,
      turn: t5Proposal.turn,
      hasVerifiedClaims: false
    },
    validation: {
      success: resultT5.success,
      committedActionsCount: resultT5.committedActionsCount,
      rejectedReasons: resultT5.rejectedReasons,
      conflictDetails: resultT5.conflictDetails
    },
    after: {
      turn: snapAfterT5.turn,
      stateVersion: snapAfterT5.stateVersion,
      stats: { ...snapAfterT5.character.stats }
    },
    canonicalOverwritten: isT5Overwritten
  });

  // Determine Final Verdict
  if (isT3Overwritten && isT4Overwritten && isT5Overwritten) {
    return {
      stages,
      verdict: 'RUNTIME BREACH — CRITICAL',
      summary: 'Confirmed that active gameplay PLAYER source can arbitrarily overwrite Canonical Character stats to max (30), partial values (28, 29), and repeated values (1) without any VerifiedClaim, narrative grounding, dice result, point-budget, or phase constraint.'
    };
  } else if (!resultT3.success) {
    return {
      stages,
      verdict: 'RUNTIME BLOCKED',
      summary: `T3 Attack was successfully blocked at runtime by Validator: ${resultT3.rejectedReasons.join('; ')}`
    };
  } else {
    return {
      stages,
      verdict: 'STATIC GAP / RUNTIME UNPROVEN',
      summary: 'Partial validation pass but canonical state overwrite was not fully realized across all stages.'
    };
  }
}

// Direct CLI Execution
(() => {
  console.log('================================================================================');
  console.log('VEIL — C1 MAXIMUM ADVERSARIAL RUNTIME PROBE EXECUTION');
  console.log('================================================================================\n');

  const result = runC1Probe();

  for (const stage of result.stages) {
    console.log(`>>> STAGE: ${stage.stage}`);
    console.log('BEFORE:');
    console.log(`  turn: ${stage.before.turn}`);
    console.log(`  stateVersion: ${stage.before.stateVersion}`);
    console.log(`  character.stats: ${JSON.stringify(stage.before.stats)}`);
    console.log('PROPOSAL:');
    console.log(`  source: ${stage.proposal.source}`);
    console.log(`  action.type: ${stage.proposal.actionType}`);
    console.log(`  payload.stats: ${JSON.stringify(stage.proposal.payload.stats)}`);
    console.log(`  expectedStateVersion: ${stage.proposal.expectedStateVersion}`);
    console.log(`  requestId: ${stage.proposal.requestId}`);
    console.log(`  eventId: ${stage.proposal.eventId}`);
    console.log('VALIDATION:');
    console.log(`  verdict: ${stage.validation.success ? 'ALLOW' : 'BLOCK'}`);
    console.log(`  committedActionsCount: ${stage.validation.committedActionsCount}`);
    if (stage.validation.rejectedReasons.length > 0) {
      console.log(`  rejectedReasons: ${stage.validation.rejectedReasons.join('; ')}`);
    }
    if (stage.validation.conflictDetails.length > 0) {
      console.log(`  conflictDetails: ${stage.validation.conflictDetails.join('; ')}`);
    }
    console.log('AFTER:');
    console.log(`  turn: ${stage.after.turn}`);
    console.log(`  stateVersion: ${stage.after.stateVersion}`);
    console.log(`  character.stats: ${JSON.stringify(stage.after.stats)}`);
    console.log(`CANONICAL OVERWRITTEN: ${stage.canonicalOverwritten}`);
    console.log('--------------------------------------------------------------------------------\n');
  }

  console.log('================================================================================');
  console.log(`FINAL VERDICT: ${result.verdict}`);
  console.log(`SUMMARY: ${result.summary}`);
  console.log('================================================================================');
})();
