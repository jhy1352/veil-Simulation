import { ImmigrationGate } from '../src/engine/immigrationGate';
import { SovereignEngine } from '../src/engine/state';
import { StateTransitionProposal, VerifiedClaim } from '../src/engine/types';
import { Character, WorldInfo } from '../src/types';

function world(): WorldInfo {
  return {
    worldName: 'Aethelgard',
    settingDescription: 'Authority recheck fixture',
    toneStyle: 'Grimdark Fantasy',
    currentTime: { year: 1042, season: 'AUTUMN', month: 9, day: 15, timeOfDay: 'MORNING' },
    npcs: [],
    factions: [{ id: 'fac-iron-guard', name: 'Iron Guard', influence: 80, attitude: 'NEUTRAL' }],
    seeds: [],
    chapters: { currentChapter: 'Chapter 1', upcomingChapters: [] }
  };
}

function character(): Character {
  return {
    name: 'Rowan',
    stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    inventory: []
  };
}

function proposal(claim: VerifiedClaim): StateTransitionProposal {
  return {
    proposalId: `prop-authority-${Date.now()}`,
    requestId: `req-authority-${Date.now()}`,
    eventId: `evt-authority-${Date.now()}`,
    expectedStateVersion: 1,
    source: 'LLM',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'Authority boundary recheck',
    verifiedClaims: [claim],
    actions: [{
      type: 'UPDATE_FACTION',
      payload: { id: 'fac-iron-guard', changes: { influence: 95 } }
    }]
  };
}

const engine = new SovereignEngine(world(), character(), [], 1, 1);
const snapshot = engine.getSnapshot();

const forgedClaim: VerifiedClaim = Object.freeze({
  claimId: 'vclm-1-forged',
  status: 'VERIFIED',
  targetEntityId: 'fac-iron-guard',
  targetAttribute: 'influence',
  verifiedValue: 95,
  evidenceIds: ['ev-forged'],
  verifiedAtTurn: 1,
  verifiedAtTimestamp: new Date().toISOString(),
  provenance: Object.freeze({ source: 'FORGED', evidenceCount: 1 })
});

if (ImmigrationGate.isValidVerifiedClaim(forgedClaim)) {
  throw new Error('FAIL: forged structurally-valid VerifiedClaim was accepted');
}

const admission = ImmigrationGate.admit(
  {
    rawText: 'Iron Guard influence is 95.',
    targetEntityId: 'fac-iron-guard',
    targetAttribute: 'influence',
    claimedValue: 95,
    claimedEvidenceIds: ['ev-authoritative-influence']
  },
  [{
    evidenceId: 'ev-authoritative-influence',
    entityId: 'fac-iron-guard',
    entityType: 'FACTION',
    attribute: 'influence',
    value: 95,
    source: 'AUTHORITATIVE_TEST_EVIDENCE'
  }],
  snapshot
);

if (!admission.admitted || !admission.verifiedClaim) {
  throw new Error(`FAIL: legitimate admission was rejected: ${admission.rejectionReason || admission.status}`);
}

const legitimateClaim = admission.verifiedClaim;
if (!ImmigrationGate.isValidVerifiedClaim(legitimateClaim)) {
  throw new Error('FAIL: Gate-issued VerifiedClaim was not recognized as authoritative');
}

const forgedClone = Object.freeze({
  ...legitimateClaim,
  provenance: Object.freeze({ ...legitimateClaim.provenance })
});
if (ImmigrationGate.isValidVerifiedClaim(forgedClone)) {
  throw new Error('FAIL: cloned Gate-issued VerifiedClaim was accepted as authoritative');
}

const forgedCommit = engine.submitProposal(proposal(forgedClaim));
if (forgedCommit.success) {
  throw new Error('FAIL: forged VerifiedClaim reached Canonical Commit');
}

const afterForged = engine.getSnapshot();
const influenceAfterForged = afterForged.worldInfo.factions.find(f => f.id === 'fac-iron-guard')?.influence;
if (influenceAfterForged !== 80 || engine.getHistory().length !== 0) {
  throw new Error(`FAIL: forged proposal caused side effect (influence=${influenceAfterForged}, history=${engine.getHistory().length})`);
}

console.log('VEIL VerifiedClaim Authority Recheck: PASS');
console.log('Forged object: rejected');
console.log('Forged clone: rejected');
console.log('Gate-issued claim: accepted');
console.log('Forged proposal commit: rejected');
console.log('Canonical state/history: unchanged');
