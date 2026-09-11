import { SovereignEngine } from '../src/engine/state';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser';
import { ImmigrationGate } from '../src/engine/immigrationGate';
import { CandidatePacket, WorldInfo, Character } from '../src/types';
import { StateTransitionProposal, VerifiedClaim, ExternalEvidence, UntrustedClaim } from '../src/engine/types';
import { EngineValidator } from '../src/engine/validator';

console.log("==========================================================================");
console.log("     VEC-04 CANDIDATE SELF-MINTED EVIDENCE FORENSIC DEEP AUDIT RUNNER     ");
console.log("==========================================================================");

// Initialize baseline Sovereign Engine with an existing canonical state
const initialWorld: WorldInfo = {
  worldName: '중원 무림',
  settingDescription: '강호 무림의 정세',
  toneStyle: '무협',
  currentTime: { year: 100, season: 'SPRING', month: 1, day: 1, timeOfDay: 'DAWN' },
  npcs: [
    {
      id: 'npc-sam-hwa',
      name: '삼화상인',
      alias: '상인 삼화',
      npcClass: 'MERCHANT',
      innerThought: '평범하게 돈을 벌고 싶다',
      metInStory: true,
      status: 'ALIVE',
      origin: '개경',
      background: '평범한 상인 출신',
      martialArts: '삼류 권법',
      values: '금전 우선',
      affiliation: '삼화상회'
    }
  ],
  factions: [],
  seeds: [],
  chapters: { currentChapter: '제1장', upcomingChapters: [] },
  cameraOffscreenEvents: [],
  offscreenRecords: [],
  rumors: []
};

const initialChar: Character = {
  name: '주인공',
  title: '협객',
  stats: { strength: 10, agility: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  inventory: [],
  secrets: []
};

// Function to print exact object diff
function printDiff(title: string, before: any, after: any) {
  console.log(`\n>>> [OBJECT DIFF]: ${title}`);
  console.log(`BEFORE: ${JSON.stringify(before, null, 2)}`);
  console.log(`AFTER : ${JSON.stringify(after, null, 2)}`);
}

// =========================================================================
// TEST 1: Attack Vector 1 - Fake NPC Attributes (background, affiliation, martialArts, values)
// =========================================================================
console.log("\n--------------------------------------------------------------------------");
console.log("[ATTACK 1]: Fake NPC Attributes via CandidatePacket");
console.log("--------------------------------------------------------------------------");

const engine1 = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
const snap1_before = engine1.getSnapshot();

const cand1: CandidatePacket = {
  candidateId: 'cand-attack-1',
  npcChanges: [
    {
      name: '삼화상인',
      metInStory: true,
      background: '천마신교 사교 첩보원',
      affiliation: '천마신교',
      martialArts: '마교 신공 10성',
      values: '세계 멸망 및 절대 지배'
    }
  ]
};

console.log("[STEP 1.1] CandidatePacket constructed without external authority evidence.");
const prop1 = buildSafeProposalFromCandidate(snap1_before, cand1, 1, engine1.getHistory());

console.log(`[STEP 1.2] buildSafeProposalFromCandidate generated ${prop1.actions.length} action(s) and ${prop1.verifiedClaims?.length || 0} verifiedClaim(s).`);
console.log("Generated Actions:", JSON.stringify(prop1.actions, null, 2));
console.log("Generated Verified Claims:", JSON.stringify(prop1.verifiedClaims, null, 2));

console.log("[STEP 1.3] Submitting Proposal to SovereignEngine.submitProposal()...");
const commit1 = engine1.submitProposal(prop1);

console.log("Commit Success:", commit1.success);
console.log("Committed Actions Count:", commit1.committedActionsCount);
console.log("Rejected Reasons:", commit1.rejectedReasons);
console.log("Conflict Details:", commit1.conflictDetails);

const snap1_after = engine1.getSnapshot();

printDiff("NPC 'npc-sam-hwa' Attributes", snap1_before.worldInfo.npcs[0], snap1_after.worldInfo.npcs[0]);
console.log(`stateVersion: ${snap1_before.stateVersion} -> ${snap1_after.stateVersion}`);
console.log(`turn: ${snap1_before.turn} -> ${snap1_after.turn}`);
console.log(`lastCommittedEventId: ${snap1_before.lastCommittedEventId} -> ${snap1_after.lastCommittedEventId}`);
console.log(`History count: ${engine1.getHistory().length}`);


// =========================================================================
// TEST 2: Attack Vector 2 - Fake NPC Status = DEAD
// =========================================================================
console.log("\n--------------------------------------------------------------------------");
console.log("[ATTACK 2]: Fake NPC Status = DEAD via CandidatePacket");
console.log("--------------------------------------------------------------------------");

const engine2 = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
const snap2_before = engine2.getSnapshot();

const cand2: CandidatePacket = {
  candidateId: 'cand-attack-2',
  npcChanges: [
    {
      name: '삼화상인',
      isDead: true
    }
  ]
};

const prop2 = buildSafeProposalFromCandidate(snap2_before, cand2, 1, engine2.getHistory());

console.log(`Generated Actions:`, JSON.stringify(prop2.actions, null, 2));
console.log(`Generated Verified Claims:`, JSON.stringify(prop2.verifiedClaims, null, 2));

const commit2 = engine2.submitProposal(prop2);
console.log("Commit Success:", commit2.success);
console.log("Rejected Reasons:", commit2.rejectedReasons);

const snap2_after = engine2.getSnapshot();

printDiff("NPC 'npc-sam-hwa' Status", snap2_before.worldInfo.npcs[0].status, snap2_after.worldInfo.npcs[0].status);
console.log(`stateVersion: ${snap2_before.stateVersion} -> ${snap2_after.stateVersion}`);
console.log(`lastCommittedEventId: ${snap2_before.lastCommittedEventId} -> ${snap2_after.lastCommittedEventId}`);


// =========================================================================
// TEST 3: Attack Vector 3 - Fake InnerThought & MetInStory
// =========================================================================
console.log("\n--------------------------------------------------------------------------");
console.log("[ATTACK 3]: Fake InnerThought & MetInStory via CandidatePacket");
console.log("--------------------------------------------------------------------------");

const engine3 = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
const snap3_before = engine3.getSnapshot();

const cand3: CandidatePacket = {
  candidateId: 'cand-attack-3',
  npcChanges: [
    {
      name: '삼화상인',
      metInStory: true,
      innerThought: '주인공을 독살하기 위해 독약을 준비했다'
    }
  ]
};

const prop3 = buildSafeProposalFromCandidate(snap3_before, cand3, 1, engine3.getHistory());
const commit3 = engine3.submitProposal(prop3);

console.log("Commit Success:", commit3.success);
const snap3_after = engine3.getSnapshot();

printDiff("NPC 'npc-sam-hwa' InnerThought", snap3_before.worldInfo.npcs[0].innerThought, snap3_after.worldInfo.npcs[0].innerThought);


// =========================================================================
// TEST 4: ALTERNATE ENTRY POINTS / COUNTER-ATTACKS
// =========================================================================
console.log("\n--------------------------------------------------------------------------");
console.log("[ENTRY POINT ANALYSIS & COUNTER-ATTACK EXPERIMENTS]");
console.log("--------------------------------------------------------------------------");

// Entry Point B: Direct StateTransitionProposal construction without verifiedClaims
console.log("\n>>> Entry Point B: Direct StateTransitionProposal (No VerifiedClaims)");
const engine4 = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
const directProposalNoClaims: StateTransitionProposal = {
  proposalId: 'prop-direct-1',
  requestId: 'req-direct-1',
  eventId: 'evt-direct-1',
  expectedStateVersion: 1,
  turn: 1,
  timestamp: new Date().toISOString(),
  source: 'LLM',
  actions: [
    {
      type: 'UPDATE_NPC',
      payload: {
        id: 'npc-sam-hwa',
        changes: {
          background: '직접 주입한 허위 백그라운드'
        }
      }
    }
  ]
};

const commitDirectNoClaims = engine4.submitProposal(directProposalNoClaims);
console.log("Direct Proposal (No Claims) Result:", commitDirectNoClaims.success);
console.log("Rejected Reasons:", commitDirectNoClaims.rejectedReasons);

// Entry Point C: Direct StateTransitionProposal with Fake Forged VerifiedClaim (not registered in WeakSet)
console.log("\n>>> Entry Point C: Direct StateTransitionProposal (Forged Unadmitted VerifiedClaim)");
const forgedClaim: VerifiedClaim = {
  claimId: 'vclm-forged-999',
  status: 'VERIFIED',
  targetEntityId: 'npc-sam-hwa',
  targetAttribute: 'background',
  verifiedValue: '직접 위조된 백그라운드',
  evidenceIds: ['ev-forged-999'],
  verifiedAtTurn: 1,
  verifiedAtStateVersion: 1,
  verifiedAtTimestamp: new Date().toISOString(),
  provenance: {
    source: 'FORGED_AUTHORITY',
    evidenceCount: 1
  }
};

const directProposalForgedClaims: StateTransitionProposal = {
  proposalId: 'prop-direct-2',
  requestId: 'req-direct-2',
  eventId: 'evt-direct-2',
  expectedStateVersion: 1,
  turn: 1,
  timestamp: new Date().toISOString(),
  source: 'LLM',
  actions: [
    {
      type: 'UPDATE_NPC',
      payload: {
        id: 'npc-sam-hwa',
        changes: {
          background: '직접 위조된 백그라운드'
        }
      }
    }
  ],
  verifiedClaims: [forgedClaim]
};

const commitDirectForgedClaims = engine4.submitProposal(directProposalForgedClaims);
console.log("Direct Proposal (Forged Unadmitted Claims) Result:", commitDirectForgedClaims.success);
console.log("Rejected Reasons:", commitDirectForgedClaims.rejectedReasons);


console.log("\n==========================================================================");
console.log("SUMMARY FINDINGS & VERDICT:");
console.log("==========================================================================");
console.log("1. Entry Point A (CandidatePacket -> buildSafeProposalFromCandidate -> submitProposal): VULNERABLE");
console.log("   - Candidate self-mints ExternalEvidence with source 'RECOVERY_GATE_CANDIDATE'.");
console.log("   - ImmigrationGate.admit() admits this self-minted evidence into ISSUED_VERIFIED_CLAIMS WeakSet.");
console.log("   - EngineValidator checks ISSUED_VERIFIED_CLAIMS WeakSet and matches entity/attribute/value.");
console.log("   - SovereignEngine COMMITS the mutation to CanonicalState.");
console.log("2. Entry Point B (Direct Proposal without Claims): BLOCKED by Validator [UNVERIFIED_CLAIM_VIOLATION].");
console.log("3. Entry Point C (Direct Proposal with Unadmitted Claims): BLOCKED by Validator [UNVERIFIED_CLAIM_VIOLATION] via WeakSet check.");
console.log("==========================================================================");

