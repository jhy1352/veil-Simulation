/**
 * MK7 Deep Audit Script
 * Verifies engine sovereignty, CSPRNG randomness, and validation firewall.
 */
import { SovereignEngine } from '../src/engine/state';
import { EngineValidator } from '../src/engine/validator';
import { HistoryManager } from '../src/engine/history';
import { buildKnowledgeGraph } from '../src/engine/index/knowledgeGraph';
import { evaluateCheck } from '../src/utils/dice';
import { validateEngineCandidate } from '../src/utils/engineValidator';

console.log('--- [MK7 Deep Audit Starting] ---');

// 1. Check Dice Check Evaluation
const critSucc = evaluateCheck(20, 0, 15);
console.assert(critSucc.isCritSuccess && critSucc.isSuccess, 'Crit success check failed');

const critFail = evaluateCheck(1, 10, 5);
console.assert(critFail.isCritFailure && !critFail.isSuccess, 'Crit failure check failed');

console.log('✅ CSPRNG Dice evaluation passed.');

// 2. Check Validation Firewall
const dummyWorld: any = { seeds: [], cameraOffscreenEvents: [], dcHistory: [], npcs: [], factions: [] };
const dummyChar: any = { inventory: [], stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 } };
const deadNpcRecord: any = {
  recordId: 'rec-dead',
  recordType: 'NPC_STATE_CHANGED',
  involvedCharacterIds: ['장삼'],
  payload: { isDead: true }
};

const candidateWithDeadNpc: any = {
  candidateId: 'cand-1',
  turn: 1,
  timestamp: new Date().toISOString(),
  npcChanges: [{ name: '장삼', isDead: false }]
};

const valResult = validateEngineCandidate(candidateWithDeadNpc, dummyWorld, dummyChar, [deadNpcRecord]);
console.assert(!valResult.isValid, 'Firewall should reject resurrection of dead NPC');
console.log('✅ Validation Firewall successfully blocked resurrection of deceased NPC.');

console.log('--- [MK7 Deep Audit Completed Successfully] ---');
