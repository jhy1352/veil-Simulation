import { SovereignEngine } from '../src/engine/state';
import { EngineValidator } from '../src/engine/validator';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary';
import { StateTransitionProposal, CanonicalState } from '../src/engine/types';
import { createEmptyWorldInfo, createEmptyCharacter } from '../src/utils/factory';
import * as fs from 'fs';
import * as path from 'path';

interface AttackScenarioResult {
  id: string;
  name: string;
  category: string;
  targetComponent: string;
  description: string;
  attackPayload: any;
  beforeSnapshot: any;
  afterSnapshot: any;
  rawVerdict: any;
  commitSuccess: boolean;
  classification: 'ENGINE BREAK' | 'DEFENSE HELD' | 'HOLD';
  evidenceDetails: string;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function runPropagationHunt(): {
  results: AttackScenarioResult[];
  summary: { total: number; breaks: number; held: number; hold: number };
} {
  const results: AttackScenarioResult[] = [];

  // Helper to create clean initial engine
  function createStandardEngine(overrides?: { world?: any; character?: any; turn?: number; version?: number }) {
    const world = createEmptyWorldInfo();
    world.worldName = 'Eldoria';
    world.factions = [
      { id: 'fac-1', name: 'Iron Vanguard', influence: 40 },
      { id: 'fac-2', name: 'Mage Guild', influence: 30 }
    ];
    world.seeds = [
      { id: 'seed-1', content: 'Ancient chest buried under the oak tree', status: 'active' },
      { id: 'seed-2', content: 'Whispering cavern has a glowing rune', status: 'active' }
    ];
    world.chapters = {
      currentChapter: 'Chapter 1: The Gathering',
      upcomingChapters: ['Chapter 2: The Storm', 'Chapter 3: The Climax']
    };
    world.unresolvedForeshadows = ['The crow watches from the tower'];
    world.secretLore = 'The King is a disguised shapeshifter';

    const character = createEmptyCharacter();
    character.name = 'Kaelen';
    character.stats = {
      strength: 14,
      agility: 12,
      constitution: 15,
      intelligence: 10,
      wisdom: 11,
      charisma: 13
    };
    character.inventory = [
      { id: 'item-gold', name: 'Gold Coin', quantity: 50 }
    ];
    character.physicalDefect = 'Scar across left eye';
    character.secret = 'True heir of the fallen crown';

    if (overrides?.world) Object.assign(world, overrides.world);
    if (overrides?.character) Object.assign(character, overrides.character);

    return new SovereignEngine(world, character, [], overrides?.version || 1, overrides?.turn || 1);
  }

  // =========================================================================
  // VECTOR 1: PROP-FACTION-01 - Semantic Duplicate & Influence Omission
  // =========================================================================
  {
    const engine = createStandardEngine();
    const before = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-fac-01',
      requestId: 'req-fac-01',
      eventId: 'ev-fac-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: {
            id: 'fac-duplicate-name',
            name: 'Iron Vanguard' // Exact duplicate semantic name of existing faction
            // influence omitted
          }
        }
      ]
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const hasDuplicateName = after.worldInfo.factions.filter(f => f.name === 'Iron Vanguard').length > 1;

    results.push({
      id: 'PROP-FACTION-01',
      name: 'ADD_FACTION Semantic Identity Collision & Omitted Influence',
      category: 'Identity Invariant',
      targetComponent: 'EngineValidator.ADD_FACTION',
      description: 'ADD_FACTION validates ID uniqueness but fails to check semantic name collision or enforce influence schema when omitted.',
      attackPayload: proposal.actions,
      beforeSnapshot: before.worldInfo.factions,
      afterSnapshot: after.worldInfo.factions,
      rawVerdict: commitRes,
      commitSuccess: commitRes.success,
      classification: hasDuplicateName && commitRes.success ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: hasDuplicateName && commitRes.success
        ? `ENGINE BREAK: Two distinct factions with identical name 'Iron Vanguard' committed to canonical state (IDs: 'fac-1', 'fac-duplicate-name').`
        : `DEFENSE HELD: Faction name collision was rejected.`
    });
  }

  // =========================================================================
  // VECTOR 2: PROP-SEED-01 - Dormant Seed Limit Bypass & Causality Exploitation
  // =========================================================================
  {
    const engine = createStandardEngine();
    // Fill up to 3 seeds with dormant status
    const fillProposal: StateTransitionProposal = {
      proposalId: 'prop-seed-fill',
      requestId: 'req-seed-fill',
      eventId: 'ev-seed-fill',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: { id: 'seed-3', content: 'Dormant seed 3', status: 'dormant' }
        },
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: { id: 'seed-4', content: 'Dormant seed 4 with silver dagger item', status: 'dormant' }
        },
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: { id: 'seed-5', content: 'Dormant seed 5 with magic ring item', status: 'dormant' }
        }
      ]
    };

    const before = engine.getSnapshot();
    const fillRes = engine.submitProposal(fillProposal);
    const afterFill = engine.getSnapshot();
    const totalSeeds = afterFill.worldInfo.seeds.length;

    // Now test if the dormant seed can be used in MODIFY_INVENTORY
    let causalitySucceeded = false;
    if (fillRes.success) {
      const invProposal: StateTransitionProposal = {
        proposalId: 'prop-seed-inv',
        requestId: 'req-seed-inv',
        eventId: 'ev-seed-inv',
        turn: 1,
        expectedStateVersion: afterFill.stateVersion,
        timestamp: new Date().toISOString(),
        source: 'LLM',
        actions: [
          {
            type: 'MODIFY_INVENTORY',
            payload: {
              operation: 'ADD',
              item: { id: 'item-dagger', name: 'silver dagger', quantity: 1 },
              acquisition: {
                cause: 'DISCOVERY_PICKUP',
                verifiedEventId: 'seed-4'
              }
            }
          }
        ]
      };
      const invRes = engine.submitProposal(invProposal);
      causalitySucceeded = invRes.success;
    }

    const isBreak = totalSeeds > 3 && fillRes.success && causalitySucceeded;

    results.push({
      id: 'PROP-SEED-01',
      name: 'Dormant Narrative Seed Limit Bypass and Causality Exploitation',
      category: 'Cardinality & Causality Invariant',
      targetComponent: 'EngineValidator.ADD_NARRATIVE_SEED & MODIFY_INVENTORY',
      description: 'ADD_NARRATIVE_SEED filters only active seeds when enforcing 3-seed limit, allowing infinite dormant seeds which are still recognized as active obtainable context by MODIFY_INVENTORY.',
      attackPayload: { fillProposal: fillProposal.actions },
      beforeSnapshot: { seedsCount: before.worldInfo.seeds.length, seeds: before.worldInfo.seeds },
      afterSnapshot: { seedsCount: totalSeeds, seeds: afterFill.worldInfo.seeds, causalitySucceeded },
      rawVerdict: { fillRes, causalitySucceeded },
      commitSuccess: fillRes.success,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Total seeds grew to ${totalSeeds} (exceeding 3-seed limit) via dormant status, and 'seed-4' was successfully consumed to acquire 'silver dagger'.`
        : `DEFENSE HELD: Dormant seed addition or causality consumption was blocked.`
    });
  }

  // =========================================================================
  // VECTOR 3: PROP-SEED-02 - Repeated Resolution of Already Resolved Seed
  // =========================================================================
  {
    const engine = createStandardEngine();
    // Resolve seed-1 once
    const res1: StateTransitionProposal = {
      proposalId: 'prop-res-1',
      requestId: 'req-res-1',
      eventId: 'ev-res-1',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'RESOLVE_NARRATIVE_SEED',
          payload: { id: 'seed-1', resolutionSummary: 'Found the gold coins' }
        }
      ]
    };
    const c1 = engine.submitProposal(res1);
    const snap1 = engine.getSnapshot();

    // Now resolve seed-1 a second time with undefined summary
    const res2: StateTransitionProposal = {
      proposalId: 'prop-res-2',
      requestId: 'req-res-2',
      eventId: 'ev-res-2',
      turn: 1,
      expectedStateVersion: snap1.stateVersion,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'RESOLVE_NARRATIVE_SEED',
          payload: { id: 'seed-1' } // missing resolutionSummary
        }
      ]
    };
    const c2 = engine.submitProposal(res2);
    const snap2 = engine.getSnapshot();
    const finalSeed = snap2.worldInfo.seeds.find(s => s.id === 'seed-1');

    const isBreak = c2.success && finalSeed?.content.includes('undefined');

    results.push({
      id: 'PROP-SEED-02',
      name: 'RESOLVE_NARRATIVE_SEED Duplicate Resolution & Payload Pollution',
      category: 'Lifecycle Invariant',
      targetComponent: 'EngineValidator.RESOLVE_NARRATIVE_SEED',
      description: 'RESOLVE_NARRATIVE_SEED lacks check for already-resolved seeds and does not validate resolutionSummary string, resulting in corrupted seed content like "(Resolved: undefined)".',
      attackPayload: res2.actions,
      beforeSnapshot: snap1.worldInfo.seeds.find(s => s.id === 'seed-1'),
      afterSnapshot: finalSeed,
      rawVerdict: c2,
      commitSuccess: c2.success,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Already-resolved seed 'seed-1' was resolved again, mutating content to '${finalSeed?.content}'.`
        : `DEFENSE HELD: Duplicate seed resolution was rejected.`
    });
  }

  // =========================================================================
  // VECTOR 4: PROP-STAT-01 - Unbounded Stat Inflation via OVERWRITE_CHARACTER
  // =========================================================================
  {
    const engine = createStandardEngine();
    const before = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-stat-01',
      requestId: 'req-stat-01',
      eventId: 'ev-stat-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: 'Kaelen',
            stats: {
              strength: 100,
              agility: 100,
              constitution: 100,
              intelligence: 100,
              wisdom: 100,
              charisma: 100
            }
          }
        }
      ]
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const isBreak = commitRes.success && after.character.stats.strength === 100;

    results.push({
      id: 'PROP-STAT-01',
      name: 'OVERWRITE_CHARACTER Stat Inflation (100 vs 1-30 Bound)',
      category: 'Range & Invariant Discrepancy',
      targetComponent: 'EngineValidator.OVERWRITE_CHARACTER vs UPDATE_CHARACTER_STATS',
      description: 'UPDATE_CHARACTER_STATS enforces a strict 1-30 range, but OVERWRITE_CHARACTER permits player to set all stats to 100 without causality or checks.',
      attackPayload: proposal.actions,
      beforeSnapshot: before.character.stats,
      afterSnapshot: after.character.stats,
      rawVerdict: commitRes,
      commitSuccess: commitRes.success,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Player set all character stats to 100 via OVERWRITE_CHARACTER, bypassing the 1-30 system bound.`
        : `DEFENSE HELD: 100 stat value rejected.`
    });
  }

  // =========================================================================
  // VECTOR 5: PROP-SEC-01 - Character Secret Provenance Bypass via OVERWRITE_CHARACTER
  // =========================================================================
  {
    const engine = createStandardEngine();
    const before = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-sec-01',
      requestId: 'req-sec-01',
      eventId: 'ev-sec-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: 'Kaelen',
            secret: 'FORGED_PLAYER_SECRET_GODHOOD'
          }
        }
      ]
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const isBreak = commitRes.success && after.character.secret === 'FORGED_PLAYER_SECRET_GODHOOD';

    results.push({
      id: 'PROP-SEC-01',
      name: 'Character Secret Provenance Bypass via OVERWRITE_CHARACTER',
      category: 'Provenance Boundary',
      targetComponent: 'EngineValidator.OVERWRITE_CHARACTER',
      description: 'SET_CHARACTER_SECRET strictly blocks PLAYER source via Provenance Violation, but OVERWRITE_CHARACTER allows PLAYER to mutate character.secret without any check.',
      attackPayload: proposal.actions,
      beforeSnapshot: before.character.secret,
      afterSnapshot: after.character.secret,
      rawVerdict: commitRes,
      commitSuccess: commitRes.success,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Player successfully mutated canonical character.secret from '${before.character.secret}' to '${after.character.secret}' via OVERWRITE_CHARACTER.`
        : `DEFENSE HELD: Secret overwrite blocked.`
    });
  }

  // =========================================================================
  // VECTOR 6: PROP-DEF-01 - Physical Defect Overwrite via Substring Trick
  // =========================================================================
  {
    const engine = createStandardEngine();
    const before = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-def-01',
      requestId: 'req-def-01',
      eventId: 'ev-def-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            name: 'Kaelen',
            physicalDefect: 'Scar across left eye is completely healed and cured'
          }
        }
      ]
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const isBreak = commitRes.success && after.character.physicalDefect === 'Scar across left eye is completely healed and cured';

    results.push({
      id: 'PROP-DEF-01',
      name: 'Physical Defect Mutation via Substring Inclusion Trick in OVERWRITE_CHARACTER',
      category: 'Immutability Bypass',
      targetComponent: 'actionApplier.OVERWRITE_CHARACTER',
      description: 'ActionApplier checks if incoming.physicalDefect.includes(character.physicalDefect) and overwrites if true, allowing player to declare the defect "healed and cured".',
      attackPayload: proposal.actions,
      beforeSnapshot: before.character.physicalDefect,
      afterSnapshot: after.character.physicalDefect,
      rawVerdict: commitRes,
      commitSuccess: commitRes.success,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Permanent physical defect was rewritten to '${after.character.physicalDefect}'.`
        : `DEFENSE HELD: Physical defect rewrite blocked.`
    });
  }

  // =========================================================================
  // VECTOR 7: PROP-WORLD-01 - Narrative State Wipe via OVERWRITE_WORLD_INFO
  // =========================================================================
  {
    const engine = createStandardEngine();
    const before = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-world-01',
      requestId: 'req-world-01',
      eventId: 'ev-world-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'OVERWRITE_WORLD_INFO',
          payload: {
            worldName: 'Eldoria',
            unresolvedForeshadows: [], // Wipe all active foreshadowing
            secretLore: 'WIPED_LORE',  // Mutate secret lore
            dcHistory: [1, 1, 1],      // Overwrite historical dice DC distribution
            chapters: {
              currentChapter: 'Epilogue',
              upcomingChapters: []
            }
          }
        }
      ]
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const isBreak = commitRes.success &&
      after.worldInfo.unresolvedForeshadows?.length === 0 &&
      after.worldInfo.secretLore === 'WIPED_LORE' &&
      after.worldInfo.chapters.currentChapter === 'Epilogue';

    results.push({
      id: 'PROP-WORLD-01',
      name: 'Narrative State, Secret Lore, and Chapter Wipe via OVERWRITE_WORLD_INFO',
      category: 'Unchecked Authority / Field Omission',
      targetComponent: 'EngineValidator.OVERWRITE_WORLD_INFO',
      description: 'OVERWRITE_WORLD_INFO validates npcs/factions/seeds but completely ignores secretLore, unresolvedForeshadows, dcHistory, and chapters, allowing player to wipe or rewrite them.',
      attackPayload: proposal.actions,
      beforeSnapshot: {
        foreshadows: before.worldInfo.unresolvedForeshadows,
        lore: before.worldInfo.secretLore,
        chapters: before.worldInfo.chapters
      },
      afterSnapshot: {
        foreshadows: after.worldInfo.unresolvedForeshadows,
        lore: after.worldInfo.secretLore,
        chapters: after.worldInfo.chapters
      },
      rawVerdict: commitRes,
      commitSuccess: commitRes.success,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Player wiped unresolvedForeshadows, rewrote secretLore to 'WIPED_LORE', and jumped chapter to 'Epilogue' without validator intervention.`
        : `DEFENSE HELD: World overwrite payload blocked.`
    });
  }

  // =========================================================================
  // VECTOR 8: PROP-OFF-01 - Offscreen Event Duplicate ID & Phantom References
  // =========================================================================
  {
    const engine = createStandardEngine();
    const before = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-off-01',
      requestId: 'req-off-01',
      eventId: 'ev-off-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            id: 'static-offscreen-id',
            eventDescription: 'First offscreen event',
            factionId: 'non-existent-faction-xyz',
            involvedNpcIds: ['phantom-npc-1', 'phantom-npc-2']
          }
        },
        {
          type: 'RECORD_OFFSCREEN_EVENT',
          payload: {
            id: 'static-offscreen-id', // duplicate ID within same proposal
            eventDescription: 'Second offscreen event with duplicate ID',
            factionId: 'non-existent-faction-abc'
          }
        }
      ]
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const offRecords = after.worldInfo.offscreenRecords || [];
    const duplicateIds = offRecords.filter(r => r.id === 'static-offscreen-id').length > 1;

    results.push({
      id: 'PROP-OFF-01',
      name: 'RECORD_OFFSCREEN_EVENT Duplicate ID & Unchecked Entity References',
      category: 'Identity & Entity Integrity',
      targetComponent: 'EngineValidator.RECORD_OFFSCREEN_EVENT',
      description: 'RECORD_OFFSCREEN_EVENT does not enforce ID uniqueness for offscreenRecords and does not validate factionId or involvedNpcIds against existing entities.',
      attackPayload: proposal.actions,
      beforeSnapshot: before.worldInfo.offscreenRecords || [],
      afterSnapshot: after.worldInfo.offscreenRecords || [],
      rawVerdict: commitRes,
      commitSuccess: commitRes.success,
      classification: duplicateIds && commitRes.success ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: duplicateIds && commitRes.success
        ? `ENGINE BREAK: Two offscreenRecords committed with identical ID 'static-offscreen-id' referencing non-existent factions and phantom NPCs.`
        : `DEFENSE HELD: Duplicate offscreen record ID was blocked.`
    });
  }

  // =========================================================================
  // VECTOR 9: PROP-RUMOR-01 - Rumor Buffer Flooding & Duplication
  // =========================================================================
  {
    const engine = createStandardEngine();
    const before = engine.getSnapshot();
    const floodActions = Array.from({ length: 50 }, (_, i) => ({
      type: 'ADD_RUMOR' as const,
      payload: { rumor: `Identical Duplicate Rumor Text #${i + 1}` }
    }));

    const proposal: StateTransitionProposal = {
      proposalId: 'prop-rumor-01',
      requestId: 'req-rumor-01',
      eventId: 'ev-rumor-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: floodActions
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const rumorCount = after.worldInfo.publicRumors?.length || 0;

    results.push({
      id: 'PROP-RUMOR-01',
      name: 'ADD_RUMOR Unbounded Array Flooding & Duplication',
      category: 'Cardinality Invariant',
      targetComponent: 'EngineValidator.ADD_RUMOR',
      description: 'ADD_RUMOR has no array size limit, rate limit, or duplicate text detection, allowing unbounded memory inflation.',
      attackPayload: { actionCount: floodActions.length },
      beforeSnapshot: { rumorsCount: before.worldInfo.publicRumors?.length || 0 },
      afterSnapshot: { rumorsCount: rumorCount },
      rawVerdict: commitRes,
      commitSuccess: commitRes.success,
      classification: rumorCount >= 50 && commitRes.success ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: rumorCount >= 50 && commitRes.success
        ? `ENGINE BREAK: 50 rumors committed in a single proposal without cardinality bounds or deduplication.`
        : `DEFENSE HELD: Rumor flooding was rejected.`
    });
  }

  // =========================================================================
  // VECTOR 10: PROP-LLM2-RUMOR-01 - LLM2 Boundary Rumor Property Injection
  // =========================================================================
  {
    const candidateProposal: StateTransitionProposal = {
      proposalId: 'prop-cand-rumor',
      requestId: 'req-cand-rumor',
      eventId: 'ev-cand-rumor',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: { rumor: 'The king has fallen ill' }
        }
      ]
    };

    const finalProposal: StateTransitionProposal = {
      proposalId: 'prop-final-rumor',
      requestId: 'req-final-rumor',
      eventId: 'ev-final-rumor',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: {
            rumor: 'The king has fallen ill',
            injectedExtraPayload: 'UNAUTHORIZED_INJECTION_FLAG',
            sneakyField: { admin: true }
          }
        }
      ]
    };

    const boundaryCheck = validateLLM2MutationBoundary(candidateProposal, finalProposal);
    const isBreak = boundaryCheck.isValid; // If boundary says valid, it's a boundary break!

    results.push({
      id: 'PROP-LLM2-RUMOR-01',
      name: 'LLM #2 Boundary ADD_RUMOR Property Injection Bypass',
      category: 'Mutation Boundary Subset Violation',
      targetComponent: 'validateLLM2MutationBoundary.ADD_RUMOR',
      description: 'isActionSemanticSubset for ADD_RUMOR only checks string rumor text and completely ignores injected extra payload properties in the final action.',
      attackPayload: { candidate: candidateProposal.actions, final: finalProposal.actions },
      beforeSnapshot: candidateProposal.actions[0].payload,
      afterSnapshot: finalProposal.actions[0].payload,
      rawVerdict: boundaryCheck,
      commitSuccess: boundaryCheck.isValid,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: LLM #2 Mutation Boundary permitted unapproved properties ('injectedExtraPayload', 'sneakyField') in ADD_RUMOR payload.`
        : `DEFENSE HELD: Property injection was rejected by boundary.`
    });
  }

  // =========================================================================
  // VECTOR 11: PROP-LLM2-FACTION-01 - LLM2 Boundary ADD_FACTION Fallthrough
  // =========================================================================
  {
    const candidateProposal: StateTransitionProposal = {
      proposalId: 'prop-cand-fac',
      requestId: 'req-cand-fac',
      eventId: 'ev-cand-fac',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: { id: 'fac-new', name: 'Shadow Guild', influence: 20 }
        }
      ]
    };

    const finalProposal: StateTransitionProposal = {
      proposalId: 'prop-final-fac',
      requestId: 'req-final-fac',
      eventId: 'ev-final-fac',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_FACTION',
          payload: { id: 'fac-new', name: 'Shadow Guild', influence: 30 } // inflated influence
        }
      ]
    };

    const boundaryCheck = validateLLM2MutationBoundary(candidateProposal, finalProposal);
    const isBreak = boundaryCheck.isValid;

    results.push({
      id: 'PROP-LLM2-FACTION-01',
      name: 'LLM #2 Boundary ADD_FACTION Influence Inflation Fallthrough',
      category: 'Mutation Boundary Subset Violation',
      targetComponent: 'validateLLM2MutationBoundary.ADD_FACTION',
      description: 'ADD_FACTION falls through to default isSemanticSubsetEqual which checks exact value match. Let us see if modified influence is caught.',
      attackPayload: { candidate: candidateProposal.actions, final: finalProposal.actions },
      beforeSnapshot: candidateProposal.actions[0].payload,
      afterSnapshot: finalProposal.actions[0].payload,
      rawVerdict: boundaryCheck,
      commitSuccess: boundaryCheck.isValid,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Boundary allowed unapproved faction influence inflation.`
        : `DEFENSE HELD: Boundary correctly rejected modified faction influence (isSemanticSubsetEqual caught value mismatch).`
    });
  }

  // =========================================================================
  // VECTOR 12: PROP-ACL-01 - Untrusted Source Cross-Action ACL Matrix
  // =========================================================================
  {
    const engine = createStandardEngine();
    const before = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-acl-01',
      requestId: 'req-acl-01',
      eventId: 'ev-acl-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'PLAYER',
      actions: [
        {
          type: 'ADVANCE_TIME',
          payload: { targetTime: { year: 101, season: 'SUMMER' } }
        }
      ]
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const isBreak = commitRes.success;

    results.push({
      id: 'PROP-ACL-01',
      name: 'Source-Action ACL Enforcement for Unauthorized Action (PLAYER ADVANCE_TIME)',
      category: 'Access Control',
      targetComponent: 'EngineValidator.SOURCE_ACTION_ACL',
      description: 'PLAYER source attempts to execute ADVANCE_TIME which is reserved for LLM/SYSTEM/GENESIS.',
      attackPayload: proposal.actions,
      beforeSnapshot: before.worldInfo.currentTime,
      afterSnapshot: after.worldInfo.currentTime,
      rawVerdict: commitRes,
      commitSuccess: commitRes.success,
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Player successfully advanced time violating SOURCE_ACTION_ACL.`
        : `DEFENSE HELD: EngineValidator rejected unauthorized action '${proposal.actions[0].type}' for source 'PLAYER' with ACL_VIOLATION.`
    });
  }

  const breaks = results.filter(r => r.classification === 'ENGINE BREAK').length;
  const held = results.filter(r => r.classification === 'DEFENSE HELD').length;
  const hold = results.filter(r => r.classification === 'HOLD').length;

  return {
    results,
    summary: { total: results.length, breaks, held, hold }
  };
}

// Execute and generate forensic reports
const audit = runPropagationHunt();

console.log('=== CONFIRMED BREAK PROPAGATION / VARIANT HUNT AUDIT ===');
console.log(`TOTAL SCENARIOS: ${audit.summary.total}`);
console.log(`ENGINE BREAKS: ${audit.summary.breaks}`);
console.log(`DEFENSES HELD: ${audit.summary.held}`);
console.log(`HOLD: ${audit.summary.hold}`);
console.log('');

for (const r of audit.results) {
  console.log(`[${r.classification}] ${r.id}: ${r.name}`);
  console.log(`  Target: ${r.targetComponent}`);
  console.log(`  Category: ${r.category}`);
  console.log(`  Details: ${r.evidenceDetails}`);
  console.log('');
}

// Save detailed report
const reportDir = path.join(process.cwd(), 'report', '02_confirmed_breaks_reproduction');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

const reportContent = `================================================================================
TRPG 3.1 VEIL — CONFIRMED BREAK PROPAGATION & VARIANT HUNT FORENSIC REPORT
Generated: ${new Date().toISOString()}
================================================================================

SUMMARY:
Total Vectors Evaluated: ${audit.summary.total}
Confirmed ENGINE BREAKS: ${audit.summary.breaks}
DEFENSE HELD: ${audit.summary.held}
HOLD: ${audit.summary.hold}

--------------------------------------------------------------------------------
DETAILED VECTOR FORENSIC AUDIT:
--------------------------------------------------------------------------------
${audit.results.map((r, idx) => `
[VECTOR #${idx + 1}] ${r.id} — ${r.name}
CLASSIFICATION: ${r.classification}
CATEGORY: ${r.category}
TARGET COMPONENT: ${r.targetComponent}
DESCRIPTION: ${r.description}

EVIDENCE DETAILS:
${r.evidenceDetails}

RAW VERDICT:
${JSON.stringify(r.rawVerdict, null, 2)}

BEFORE STATE:
${JSON.stringify(r.beforeSnapshot, null, 2)}

AFTER STATE:
${JSON.stringify(r.afterSnapshot, null, 2)}
--------------------------------------------------------------------------------`).join('\n')}
`;

fs.writeFileSync(path.join(reportDir, 'confirmed_break_propagation_report.txt'), reportContent, 'utf-8');

const ideaReportDir = path.join(process.cwd(), 'idea', 'report');
if (!fs.existsSync(ideaReportDir)) fs.mkdirSync(ideaReportDir, { recursive: true });
fs.writeFileSync(path.join(ideaReportDir, 'confirmed_break_propagation_report.txt'), reportContent, 'utf-8');

console.log('Saved report to report/confirmed_break_propagation_report.txt and idea/report/confirmed_break_propagation_report.txt');
