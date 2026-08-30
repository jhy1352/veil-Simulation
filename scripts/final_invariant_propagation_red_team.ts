import { SovereignEngine } from '../src/engine/state';
import { EngineValidator } from '../src/engine/validator';
import { validateLLM2MutationBoundary } from '../src/engine/mutationBoundary';
import { StateTransitionProposal, CanonicalState, ActionType } from '../src/engine/types';
import { createEmptyWorldInfo, createEmptyCharacter } from '../src/utils/factory';
import * as fs from 'fs';
import * as path from 'path';

export interface ComprehensiveAttackResult {
  id: string;
  name: string;
  category: string;
  actionType: ActionType;
  canonicalField: string;
  attackVectorDescription: string;
  attackPayload: any;
  beforeSnapshot: any;
  afterSnapshot: any;
  validatorVerdict: any;
  mutationBoundaryVerdict: any;
  applierVerdict: any;
  deepDiff: any;
  classification: 'ENGINE BREAK' | 'DEFENSE HELD' | 'HOLD';
  invariantMapping: {
    invariant: string;
    actionType: string;
    canonicalField: string;
    validatorStatus: string;
    boundaryStatus: string;
    applierStatus: string;
  };
  evidenceDetails: string;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function createTestEngine(overrides?: { world?: any; character?: any; turn?: number; version?: number }) {
  const world = createEmptyWorldInfo();
  world.worldName = 'Eldoria';
  world.settingDescription = 'A high fantasy medieval continent';
  world.toneStyle = 'Grimdark and realistic';
  world.currentTime = { year: 100, season: 'SPRING', month: 3, day: 15, timeOfDay: 'MORNING' };
  world.npcs = [
    { id: 'npc-1', name: 'Baron Valerius', status: 'ALIVE', affiliation: 'Iron Vanguard', role: 'Commander', trust: 50 },
    { id: 'npc-2', name: 'Sister Elena', status: 'ALIVE', affiliation: 'Holy Order', role: 'Priestess', trust: 60 }
  ];
  world.factions = [
    { id: 'fac-1', name: 'Iron Vanguard', influence: 40 },
    { id: 'fac-2', name: 'Holy Order', influence: 30 }
  ];
  world.seeds = [
    { id: 'seed-1', content: 'Ancient chest buried under the oak tree', status: 'active' },
    { id: 'seed-2', content: 'Whispering cavern glowing rune', status: 'active' }
  ];
  world.chapters = {
    currentChapter: 'Chapter 1: The Gathering',
    upcomingChapters: ['Chapter 2: The Storm', 'Chapter 3: The Climax']
  };
  world.unresolvedForeshadows = ['The crow watches from the tower'];
  world.publicRumors = ['A strange beast was seen in the northern woods'];
  world.secretLore = 'The King is a disguised shapeshifter';
  world.dcHistory = [12, 15, 10];

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
    { id: 'item-gold', name: 'Gold Coin', quantity: 50 },
    { id: 'item-sword', name: 'Iron Longsword', quantity: 1 }
  ];
  character.physicalDefect = 'Scar across left eye';
  character.secret = 'True heir of the fallen crown';

  if (overrides?.world) Object.assign(world, overrides.world);
  if (overrides?.character) Object.assign(character, overrides.character);

  return new SovereignEngine(world, character, [], overrides?.version || 1, overrides?.turn || 1);
}

export function runFullInvariantPropagationMatrix(): {
  results: ComprehensiveAttackResult[];
  summary: { total: number; breaks: number; held: number; hold: number };
} {
  const results: ComprehensiveAttackResult[] = [];

  // =========================================================================
  // 1. INVARIANT: Semantic Identity & Entity Shadow Path
  // ATTACK: ADD_NPC with exact semantic name duplicate & invalid trust range
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const proposal: StateTransitionProposal = {
      proposalId: 'prop-npc-dup-01',
      requestId: 'req-npc-dup-01',
      eventId: 'ev-npc-dup-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_NPC',
          payload: {
            id: 'npc-duplicate-valerius',
            name: 'Baron Valerius', // Duplicate of npc-1
            role: 'Pretender Commander',
            status: 'ALIVE',
            affiliation: 'fac-1',
            trust: 999 // Unbounded trust value
          }
        }
      ]
    };

    const commitRes = engine.submitProposal(proposal);
    const after = engine.getSnapshot();
    const valeriusList = after.worldInfo.npcs.filter(n => n.name === 'Baron Valerius');
    const isBreak = commitRes.success && valeriusList.length > 1;

    results.push({
      id: 'INV-PROP-01',
      name: 'ADD_NPC Semantic Identity Collision & Unbounded Trust Mutation',
      category: 'Semantic Identity & Range Invariant',
      actionType: 'ADD_NPC',
      canonicalField: 'worldInfo.npcs',
      attackVectorDescription: 'ADD_NPC only checks ID uniqueness and does not reject semantic duplicate NPC names or enforce trust bounds (0-100), allowing entity collision and corrupted trust metrics.',
      attackPayload: proposal.actions,
      beforeSnapshot: before.worldInfo.npcs,
      afterSnapshot: after.worldInfo.npcs,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false, note: 'Direct LLM Proposal' },
      applierVerdict: commitRes,
      deepDiff: { addedNpcCount: valeriusList.length, newNpcs: valeriusList },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Semantic Identity Uniqueness & Metric Bounds',
        actionType: 'ADD_NPC',
        canonicalField: 'worldInfo.npcs',
        validatorStatus: isBreak ? 'VULNERABLE (ID-only check)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_CORRUPTION' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Two distinct NPCs named 'Baron Valerius' (IDs: npc-1 and npc-duplicate-valerius) committed with trust 999.`
        : `DEFENSE HELD: Semantic duplicate NPC rejected.`
    });
  }

  // =========================================================================
  // 2. INVARIANT: Lifecycle / Irreversible State
  // ATTACK: Reviving DEAD NPC via UPDATE_NPC
  // =========================================================================
  {
    const engine = createTestEngine();
    // First set npc-1 to DEAD
    const deadProp: StateTransitionProposal = {
      proposalId: 'prop-dead-01',
      requestId: 'req-dead-01',
      eventId: 'ev-dead-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'SET_NPC_STATUS',
          payload: { id: 'npc-1', status: 'DEAD', reason: 'Slain in battle' }
        }
      ]
    };
    const c1 = engine.submitProposal(deadProp);
    const snapDead = engine.getSnapshot();

    // Now attempt shadow revival via UPDATE_NPC status change
    const reviveProp: StateTransitionProposal = {
      proposalId: 'prop-revive-01',
      requestId: 'req-revive-01',
      eventId: 'ev-revive-01',
      turn: 1,
      expectedStateVersion: snapDead.stateVersion,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-1',
            changes: { status: 'ALIVE', role: 'Resurrected Commander' }
          }
        }
      ]
    };
    const c2 = engine.submitProposal(reviveProp);
    const after = engine.getSnapshot();
    const finalNpc = after.worldInfo.npcs.find(n => n.id === 'npc-1');
    const isBreak = c2.success && finalNpc?.status === 'ALIVE';

    results.push({
      id: 'INV-PROP-02',
      name: 'UPDATE_NPC Shadow Path Resurrection of Irreversible DEAD NPC',
      category: 'Lifecycle Invariant / Irreversible State',
      actionType: 'UPDATE_NPC',
      canonicalField: 'worldInfo.npcs[id].status',
      attackVectorDescription: 'SET_NPC_STATUS prohibits transitioning from DEAD to ALIVE, but UPDATE_NPC fails to validate previous status lifecycle transitions and allows reviving dead NPCs.',
      attackPayload: reviveProp.actions,
      beforeSnapshot: snapDead.worldInfo.npcs.find(n => n.id === 'npc-1'),
      afterSnapshot: finalNpc,
      validatorVerdict: c2,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: c2,
      deepDiff: { beforeStatus: 'DEAD', afterStatus: finalNpc?.status },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Irreversible Dead Entity State (Lifecycle)',
        actionType: 'UPDATE_NPC',
        canonicalField: 'worldInfo.npcs.status',
        validatorStatus: isBreak ? 'VULNERABLE (Missing dead-check in UPDATE_NPC)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_RESURRECTION' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Dead NPC 'npc-1' resurrected to status 'ALIVE' via UPDATE_NPC shadow path.`
        : `DEFENSE HELD: Shadow revival rejected.`
    });
  }

  // =========================================================================
  // 3. INVARIANT: Cumulative Bound / Cardinality
  // ATTACK: Cumulative Faction Influence Inflation via repeated UPDATE_FACTION
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-fac-inf-01',
      requestId: 'req-fac-inf-01',
      eventId: 'ev-fac-inf-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'UPDATE_FACTION',
          payload: {
            id: 'fac-1',
            changes: { influence: 999999 } // Extreme influence inflation
          }
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const finalFac = after.worldInfo.factions.find(f => f.id === 'fac-1');
    const isBreak = commitRes.success && (finalFac?.influence || 0) > 100;

    results.push({
      id: 'INV-PROP-03',
      name: 'UPDATE_FACTION Unbounded Influence Inflation (999999 vs 100 max)',
      category: 'Cardinality & Range Invariant',
      actionType: 'UPDATE_FACTION',
      canonicalField: 'worldInfo.factions[id].influence',
      attackVectorDescription: 'UPDATE_FACTION allows arbitrary unbounded numeric influence without enforcing the 0-100 influence range bound.',
      attackPayload: prop.actions,
      beforeSnapshot: before.worldInfo.factions.find(f => f.id === 'fac-1'),
      afterSnapshot: finalFac,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { beforeInfluence: 40, afterInfluence: finalFac?.influence },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Faction Influence Upper Bound (0-100)',
        actionType: 'UPDATE_FACTION',
        canonicalField: 'worldInfo.factions.influence',
        validatorStatus: isBreak ? 'VULNERABLE (No upper limit on changes.influence)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_INFLATION' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Faction 'fac-1' influence inflated to ${finalFac?.influence} (exceeds 100 max bound).`
        : `DEFENSE HELD: Faction influence inflation rejected.`
    });
  }

  // =========================================================================
  // 4. INVARIANT: ActionType Shadow Path & Immutability Overreach
  // ATTACK: Overwriting Physical Defect via RECORD_PHYSICAL_DEFECT with Empty / Null
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-defect-wipe-01',
      requestId: 'req-defect-wipe-01',
      eventId: 'ev-defect-wipe-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'RECORD_PHYSICAL_DEFECT',
          payload: {
            defect: '   ' // Blank whitespace to wipe defect
          }
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const isBreak = commitRes.success && (after.character.physicalDefect === '   ' || !after.character.physicalDefect);

    results.push({
      id: 'INV-PROP-04',
      name: 'RECORD_PHYSICAL_DEFECT Blank Defect Wipe / Bypass',
      category: 'Lifecycle & Immutability Invariant',
      actionType: 'RECORD_PHYSICAL_DEFECT',
      canonicalField: 'character.physicalDefect',
      attackVectorDescription: 'RECORD_PHYSICAL_DEFECT attempts to overwrite existing permanent physical defect with empty/whitespace string.',
      attackPayload: prop.actions,
      beforeSnapshot: before.character.physicalDefect,
      afterSnapshot: after.character.physicalDefect,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { beforeDefect: before.character.physicalDefect, afterDefect: after.character.physicalDefect },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Permanent Physical Defect Immutability',
        actionType: 'RECORD_PHYSICAL_DEFECT',
        canonicalField: 'character.physicalDefect',
        validatorStatus: isBreak ? 'VULNERABLE (Blank string accepted)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_DEFECT_WIPE' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Permanent physical defect wiped or replaced with blank string '${after.character.physicalDefect}'.`
        : `DEFENSE HELD: Blank defect submission rejected.`
    });
  }

  // =========================================================================
  // 5. INVARIANT: Phantom Reference & Dangling Entity
  // ATTACK: UPDATE_NPC assigning non-existent factionId & ADD_NPC with phantom affiliation
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-phantom-fac-01',
      requestId: 'req-phantom-fac-01',
      eventId: 'ev-phantom-fac-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-1',
            changes: { affiliation: 'phantom-faction-nonexistent' }
          }
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const finalNpc = after.worldInfo.npcs.find(n => n.id === 'npc-1');
    const isBreak = commitRes.success && finalNpc?.affiliation === 'phantom-faction-nonexistent';

    results.push({
      id: 'INV-PROP-05',
      name: 'UPDATE_NPC Phantom Faction ID Reference Injection',
      category: 'Entity Referential Integrity',
      actionType: 'UPDATE_NPC',
      canonicalField: 'worldInfo.npcs[id].affiliation',
      attackVectorDescription: 'UPDATE_NPC allows setting an NPC affiliation to an arbitrary non-existent faction string without foreign key validation against worldInfo.factions.',
      attackPayload: prop.actions,
      beforeSnapshot: before.worldInfo.npcs.find(n => n.id === 'npc-1'),
      afterSnapshot: finalNpc,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { beforeAffiliation: 'Iron Vanguard', afterAffiliation: finalNpc?.affiliation },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Referential Integrity (Faction Foreign Key)',
        actionType: 'UPDATE_NPC',
        canonicalField: 'worldInfo.npcs.affiliation',
        validatorStatus: isBreak ? 'VULNERABLE (No FK check in changes.affiliation)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_DANGLING_REF' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: NPC 'npc-1' affiliation mutated to dangling phantom ID 'phantom-faction-nonexistent'.`
        : `DEFENSE HELD: Dangling faction reference rejected.`
    });
  }

  // =========================================================================
  // 6. INVARIANT: ActionType Shadow Path / Inventory Causality Bypass
  // ATTACK: MODIFY_INVENTORY ADD with ZERO quantity or negative quantity bypass
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-inv-neg-01',
      requestId: 'req-inv-neg-01',
      eventId: 'ev-inv-neg-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'REMOVE',
            item: { id: 'item-gold', name: 'Gold Coin', quantity: 9999 } // Remove more than possessed
          }
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const goldItem = after.character.inventory.find(i => i.id === 'item-gold');
    const isBreak = commitRes.success && (!goldItem || goldItem.quantity < 0);

    results.push({
      id: 'INV-PROP-06',
      name: 'MODIFY_INVENTORY Overdraft / Negative Item Quantity Check',
      category: 'Inventory Quantity Invariant',
      actionType: 'MODIFY_INVENTORY',
      canonicalField: 'character.inventory',
      attackVectorDescription: 'MODIFY_INVENTORY REMOVE operation removes more items than owned.',
      attackPayload: prop.actions,
      beforeSnapshot: before.character.inventory.find(i => i.id === 'item-gold'),
      afterSnapshot: goldItem,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { beforeQty: 50, afterQty: goldItem?.quantity },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Inventory Non-Negative Quantity',
        actionType: 'MODIFY_INVENTORY',
        canonicalField: 'character.inventory',
        validatorStatus: isBreak ? 'VULNERABLE' : 'DEFENDED (INSUFFICIENT_QUANTITY)',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_OVERDRAFT' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Inventory quantity dropped below 0 or removed unowned quantity.`
        : `DEFENSE HELD: Overdraft rejected by validator.`
    });
  }

  // =========================================================================
  // 7. INVARIANT: ActionType Shadow Path / Inventory Inflation via LOOT cause
  // ATTACK: MODIFY_INVENTORY with LOOT cause without verifiedEventId
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-inv-loot-01',
      requestId: 'req-inv-loot-01',
      eventId: 'ev-inv-loot-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            operation: 'ADD',
            item: { id: 'item-god-sword', name: 'Blade of the Cosmos', quantity: 1 },
            acquisition: {
              cause: 'LOOT'
              // verifiedEventId omitted
            }
          }
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const hasGodSword = after.character.inventory.some(i => i.name === 'Blade of the Cosmos');
    const isBreak = commitRes.success && hasGodSword;

    results.push({
      id: 'INV-PROP-07',
      name: 'MODIFY_INVENTORY LOOT Acquisition Cause without Verified Event',
      category: 'Causality & Provenance Invariant',
      actionType: 'MODIFY_INVENTORY',
      canonicalField: 'character.inventory',
      attackVectorDescription: 'MODIFY_INVENTORY allows acquiring items via LOOT/REWARD/GIFT cause without requiring a verified event or defeated entity reference.',
      attackPayload: prop.actions,
      beforeSnapshot: before.character.inventory,
      afterSnapshot: after.character.inventory,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { acquired: hasGodSword },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Item Acquisition Causality Provenance',
        actionType: 'MODIFY_INVENTORY',
        canonicalField: 'character.inventory',
        validatorStatus: isBreak ? 'VULNERABLE (LOOT cause accepted without verified context)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_UNVERIFIED_ITEM' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Player/LLM acquired 'Blade of the Cosmos' via LOOT with no causal event verification.`
        : `DEFENSE HELD: Unverified LOOT acquisition rejected.`
    });
  }

  // =========================================================================
  // 8. INVARIANT: Chapter Jump & Narrative Continuity
  // ATTACK: ADVANCE_CHAPTER to non-upcoming chapter (Arbitrary narrative skip)
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-chap-skip-01',
      requestId: 'req-chap-skip-01',
      eventId: 'ev-chap-skip-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: 'Chapter 99: The End of Time', // Arbitrary skip, not in upcomingChapters
            upcomingChapters: []
          }
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const isBreak = commitRes.success && after.worldInfo.chapters.currentChapter === 'Chapter 99: The End of Time';

    results.push({
      id: 'INV-PROP-08',
      name: 'ADVANCE_CHAPTER Arbitrary Narrative Sequence Skip',
      category: 'Narrative Continuity Invariant',
      actionType: 'ADVANCE_CHAPTER',
      canonicalField: 'worldInfo.chapters',
      attackVectorDescription: 'ADVANCE_CHAPTER fails to verify if currentChapter matches the next chapter in upcomingChapters, permitting jumping directly to arbitrary story endings.',
      attackPayload: prop.actions,
      beforeSnapshot: before.worldInfo.chapters,
      afterSnapshot: after.worldInfo.chapters,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { beforeChapter: before.worldInfo.chapters.currentChapter, afterChapter: after.worldInfo.chapters.currentChapter },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Narrative Chapter Sequence Continuity',
        actionType: 'ADVANCE_CHAPTER',
        canonicalField: 'worldInfo.chapters',
        validatorStatus: isBreak ? 'VULNERABLE (No sequence validation against upcomingChapters)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_STORY_SKIP' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Chapter advanced from 'Chapter 1: The Gathering' directly to 'Chapter 99: The End of Time', wiping upcoming chapters.`
        : `DEFENSE HELD: Chapter sequence jump rejected.`
    });
  }

  // =========================================================================
  // 9. INVARIANT: Metadata Authority & Setting Rewrite
  // ATTACK: SET_WORLD_METADATA rewriting core tone & world name
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-meta-rewrite-01',
      requestId: 'req-meta-rewrite-01',
      eventId: 'ev-meta-rewrite-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: {
            worldName: 'Cyberpunk Neon Metropolis 2099',
            settingDescription: 'Futuristic megacity with lasers and flying cars',
            toneStyle: 'Comedic slapstick sitcom'
          }
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const isBreak = commitRes.success && after.worldInfo.worldName === 'Cyberpunk Neon Metropolis 2099';

    results.push({
      id: 'INV-PROP-09',
      name: 'SET_WORLD_METADATA Mid-Game Genre & Setting Overwrite',
      category: 'World Law & Setting Immutability',
      actionType: 'SET_WORLD_METADATA',
      canonicalField: 'worldInfo.worldName, settingDescription, toneStyle',
      attackVectorDescription: 'SET_WORLD_METADATA allows LLM to completely alter world name, genre, and tone style during active play (turn > 1), destroying narrative continuity.',
      attackPayload: prop.actions,
      beforeSnapshot: { worldName: before.worldInfo.worldName, tone: before.worldInfo.toneStyle },
      afterSnapshot: { worldName: after.worldInfo.worldName, tone: after.worldInfo.toneStyle },
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { before: before.worldInfo.worldName, after: after.worldInfo.worldName },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'World Law & Genesis Setting Immutability',
        actionType: 'SET_WORLD_METADATA',
        canonicalField: 'worldInfo.worldName',
        validatorStatus: isBreak ? 'VULNERABLE (Mid-game setting overwrite allowed)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_GENRE_REWRITE' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Mid-game world name rewritten to 'Cyberpunk Neon Metropolis 2099' and tone to 'Comedic slapstick sitcom'.`
        : `DEFENSE HELD: Setting overwrite rejected.`
    });
  }

  // =========================================================================
  // 10. INVARIANT: Validator ↔ Boundary Field Mismatch & Extra Field Injection
  // ATTACK: LLM2 Boundary on UPDATE_NPC with Injected Extra Payload
  // =========================================================================
  {
    const candProp: StateTransitionProposal = {
      proposalId: 'prop-cand-npc-extra',
      requestId: 'req-cand-npc-extra',
      eventId: 'ev-cand-npc-extra',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-1',
            changes: { role: 'High Commander' }
          }
        }
      ]
    };

    const finalProp: StateTransitionProposal = {
      proposalId: 'prop-final-npc-extra',
      requestId: 'req-final-npc-extra',
      eventId: 'ev-final-npc-extra',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'UPDATE_NPC',
          payload: {
            id: 'npc-1',
            changes: {
              role: 'High Commander',
              unapprovedInjectedStat: 999,
              secretAdminOverride: true
            }
          }
        }
      ]
    };

    const boundaryVerdict = validateLLM2MutationBoundary(candProp, finalProp);
    const isBreak = boundaryVerdict.isValid;

    results.push({
      id: 'INV-PROP-10',
      name: 'LLM #2 Boundary UPDATE_NPC Extra Field Injection Bypass',
      category: 'Mutation Boundary Subset Violation',
      actionType: 'UPDATE_NPC',
      canonicalField: 'worldInfo.npcs[id]',
      attackVectorDescription: 'isActionSemanticSubset for UPDATE_NPC performs loose changes check and permits arbitrary injected extra properties inside changes.',
      attackPayload: { candidate: candProp.actions, final: finalProp.actions },
      beforeSnapshot: candProp.actions[0].payload,
      afterSnapshot: finalProp.actions[0].payload,
      validatorVerdict: { skipped: true },
      mutationBoundaryVerdict: boundaryVerdict,
      applierVerdict: { pending: true },
      deepDiff: { injectedKeys: ['unapprovedInjectedStat', 'secretAdminOverride'], isValid: boundaryVerdict.isValid },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Mutation Boundary Strict Property Subset',
        actionType: 'UPDATE_NPC',
        canonicalField: 'worldInfo.npcs.changes',
        validatorStatus: 'N/A',
        boundaryStatus: isBreak ? 'VULNERABLE (Loose changes subset check)' : 'DEFENDED',
        applierStatus: 'PENDING'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: LLM2 Boundary permitted unapproved injected fields ('unapprovedInjectedStat', 'secretAdminOverride') in UPDATE_NPC.`
        : `DEFENSE HELD: Injected fields caught by boundary.`
    });
  }

  // =========================================================================
  // 11. INVARIANT: Composite Action Atomicity
  // ATTACK: Composite proposal where Action 1 is valid, Action 2 is invalid
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-atomic-01',
      requestId: 'req-atomic-01',
      eventId: 'ev-atomic-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'ADD_RUMOR',
          payload: { rumor: 'Atomic Rumor Test' }
        },
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 999 } // Invalid strength exceeding 30
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const rumorAdded = after.worldInfo.publicRumors?.includes('Atomic Rumor Test');
    const isBreak = !commitRes.success && rumorAdded; // Partial mutation!

    results.push({
      id: 'INV-PROP-11',
      name: 'Composite Action Atomic Rollback Failure Check',
      category: 'Atomic State Transition Invariant',
      actionType: 'ADD_RUMOR',
      canonicalField: 'worldInfo.publicRumors',
      attackVectorDescription: 'Submits a composite proposal containing a valid action followed by an invalid action to verify if partial mutations leak into canonical state.',
      attackPayload: prop.actions,
      beforeSnapshot: before.worldInfo.publicRumors,
      afterSnapshot: after.worldInfo.publicRumors,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { rumorAdded, success: commitRes.success },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'Proposal Atomicity (All-or-Nothing)',
        actionType: 'COMPOSITE',
        canonicalField: 'All Canonical Fields',
        validatorStatus: isBreak ? 'VULNERABLE (Partial leak)' : 'DEFENDED (Zero-mutation rollback)',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'PARTIAL_COMMIT' : 'ROLLED_BACK'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Partial mutation occurred; 'Atomic Rumor Test' leaked into state despite proposal rejection.`
        : `DEFENSE HELD: Zero mutation confirmed; entire proposal rejected atomically.`
    });
  }

  // =========================================================================
  // 12. INVARIANT: Dice Record Tampering & Cumulative DC Invariant
  // ATTACK: RECORD_DICE_RESULT with out-of-bounds DC (e.g. DC 99 or DC -5)
  // =========================================================================
  {
    const engine = createTestEngine();
    const before = engine.getSnapshot();
    const prop: StateTransitionProposal = {
      proposalId: 'prop-dice-dc-01',
      requestId: 'req-dice-dc-01',
      eventId: 'ev-dice-dc-01',
      turn: 1,
      expectedStateVersion: 1,
      timestamp: new Date().toISOString(),
      source: 'LLM',
      actions: [
        {
          type: 'RECORD_DICE_RESULT',
          payload: {
            roll: 18,
            dc: 99, // DC 99 violates DC 1-20 Constitution
            action: 'Bypass Cosmic Barrier'
          }
        }
      ]
    };
    const commitRes = engine.submitProposal(prop);
    const after = engine.getSnapshot();
    const hasDc99 = after.worldInfo.dcHistory?.includes(99);
    const isBreak = commitRes.success && hasDc99;

    results.push({
      id: 'INV-PROP-12',
      name: 'RECORD_DICE_RESULT Out-of-Bounds DC Tampering (DC 99 vs DC 1-20 Bound)',
      category: 'Dice & DC Constitution Invariant',
      actionType: 'RECORD_DICE_RESULT',
      canonicalField: 'worldInfo.dcHistory',
      attackVectorDescription: 'RECORD_DICE_RESULT accepts arbitrary DC values like 99, violating the Article 20 Constitution mandate specifying DC range 1-20.',
      attackPayload: prop.actions,
      beforeSnapshot: before.worldInfo.dcHistory,
      afterSnapshot: after.worldInfo.dcHistory,
      validatorVerdict: commitRes,
      mutationBoundaryVerdict: { checked: false },
      applierVerdict: commitRes,
      deepDiff: { beforeDc: before.worldInfo.dcHistory, afterDc: after.worldInfo.dcHistory },
      classification: isBreak ? 'ENGINE BREAK' : 'DEFENSE HELD',
      invariantMapping: {
        invariant: 'DC Range 1-20 Bound (Article 20 Constitution)',
        actionType: 'RECORD_DICE_RESULT',
        canonicalField: 'worldInfo.dcHistory',
        validatorStatus: isBreak ? 'VULNERABLE (DC 99 committed to dcHistory)' : 'DEFENDED',
        boundaryStatus: 'N/A',
        applierStatus: isBreak ? 'COMMITTED_INVALID_DC' : 'CLEAN'
      },
      evidenceDetails: isBreak
        ? `ENGINE BREAK: Invalid DC 99 committed to worldInfo.dcHistory, violating DC 1-20 bound.`
        : `DEFENSE HELD: Out-of-bounds DC rejected.`
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

// Execute matrix
const matrix = runFullInvariantPropagationMatrix();

console.log('=== FINAL INVARIANT PROPAGATION RED TEAM AUDIT ===');
console.log(`TOTAL SCENARIOS: ${matrix.summary.total}`);
console.log(`ENGINE BREAKS: ${matrix.summary.breaks}`);
console.log(`DEFENSES HELD: ${matrix.summary.held}`);
console.log(`HOLD: ${matrix.summary.hold}`);
console.log('');

for (const r of matrix.results) {
  console.log(`[${r.classification}] ${r.id}: ${r.name}`);
  console.log(`  ActionType: ${r.actionType} | Field: ${r.canonicalField}`);
  console.log(`  Category: ${r.category}`);
  console.log(`  Details: ${r.evidenceDetails}`);
  console.log('');
}

// Write to reports
const reportDir = path.join(process.cwd(), 'report', '04_invariant_propagation_redteam');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

const reportContent = `================================================================================
TRPG 3.1 VEIL — FINAL INVARIANT PROPAGATION RED TEAM FORENSIC AUDIT
Generated: ${new Date().toISOString()}
================================================================================

SUMMARY:
Total Scenarios Tested: ${matrix.summary.total}
Confirmed ENGINE BREAKS: ${matrix.summary.breaks}
DEFENSE HELD: ${matrix.summary.held}
HOLD: ${matrix.summary.hold}

--------------------------------------------------------------------------------
COMPREHENSIVE BREAK MAPPING:
[Invariant] -> [ActionType] -> [Canonical Field] -> [Validator] -> [Boundary] -> [Applier]
--------------------------------------------------------------------------------
${matrix.results.map((r, idx) => `
[VECTOR #${idx + 1}] ${r.id}: ${r.name}
CLASSIFICATION: ${r.classification}
CATEGORY: ${r.category}
ACTION_TYPE: ${r.actionType}
CANONICAL_FIELD: ${r.canonicalField}

INVARIANT MAPPING:
  Invariant:        ${r.invariantMapping.invariant}
  ActionType:       ${r.invariantMapping.actionType}
  CanonicalField:   ${r.invariantMapping.canonicalField}
  Validator Status: ${r.invariantMapping.validatorStatus}
  Boundary Status:  ${r.invariantMapping.boundaryStatus}
  Applier Status:   ${r.invariantMapping.applierStatus}

DESCRIPTION:
${r.attackVectorDescription}

EVIDENCE DETAILS:
${r.evidenceDetails}

BEFORE SNAPSHOT:
${JSON.stringify(r.beforeSnapshot, null, 2)}

AFTER SNAPSHOT:
${JSON.stringify(r.afterSnapshot, null, 2)}

DEEP DIFF:
${JSON.stringify(r.deepDiff, null, 2)}
--------------------------------------------------------------------------------`).join('\n')}
`;

fs.writeFileSync(path.join(reportDir, 'final_invariant_propagation_report.txt'), reportContent, 'utf-8');

const ideaDir = path.join(process.cwd(), 'idea', 'report');
if (!fs.existsSync(ideaDir)) fs.mkdirSync(ideaDir, { recursive: true });
fs.writeFileSync(path.join(ideaDir, 'final_invariant_propagation_report.txt'), reportContent, 'utf-8');

console.log('Saved final report to report/04_invariant_propagation_redteam/final_invariant_propagation_report.txt and idea/report/final_invariant_propagation_report.txt');
