import { SovereignEngine } from '../src/engine/state';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser';
import { ImmigrationGate } from '../src/engine/immigrationGate';
import { CandidatePacket, WorldInfo, Character } from '../src/types';
import { StateTransitionProposal, TransitionAction } from '../src/engine/types';

console.log("=== CANDIDATE SELF-MINT FORENSIC INVESTIGATION LAUNCHED ===");

// 1. Setup Canonical State with an existing NPC
const initialWorld: WorldInfo = {
  worldName: 'Testing Realm',
  settingDescription: 'A quiet martial arts world',
  toneStyle: 'Serious',
  currentTime: { year: 100, season: 'SPRING', month: 1, day: 1, timeOfDay: 'DAWN' },
  npcs: [
    {
      id: 'npc-sam-hwa',
      name: '삼화상인',
      alias: '상인 삼화',
      npcClass: 'MERCHANT',
      innerThought: '돈을 벌고 싶다',
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

const engine = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
const beforeState = engine.getSnapshot();

console.log("Initial NPC 'npc-sam-hwa':", JSON.stringify(beforeState.worldInfo.npcs[0], null, 2));

// ATTACK 1: Fake attributes (background, affiliation, martialArts, values)
console.log("\n--- EXECUTING ATTACK 1: Fake Attributes via Candidate ---");
const candidate1: CandidatePacket = {
  candidateId: 'cand-attack-1',
  npcChanges: [
    {
      name: '삼화상인',
      metInStory: true,
      background: '천마신교 은밀 첩보원',
      affiliation: '천마신교',
      martialArts: '마교 신공 10성',
      values: '세계 멸망'
    }
  ]
};

const proposal1 = buildSafeProposalFromCandidate(
  beforeState,
  candidate1,
  1,
  engine.getHistory()
);

console.log("Proposal 1 Actions:", JSON.stringify(proposal1.actions, null, 2));
console.log("Proposal 1 Verified Claims Count:", proposal1.verifiedClaims?.length || 0);
if (proposal1.verifiedClaims) {
  console.log("Verified Claims Details:", JSON.stringify(proposal1.verifiedClaims, null, 2));
}

const commitResult1 = engine.submitProposal(proposal1);
console.log("Commit Result 1 Success:", commitResult1.success);
console.log("Commit Result 1 Rejected Reasons:", commitResult1.rejectedReasons);
console.log("Commit Result 1 Conflict Details:", commitResult1.conflictDetails);

const afterState1 = engine.getSnapshot();
console.log("After Attack 1 NPC 'npc-sam-hwa':", JSON.stringify(afterState1.worldInfo.npcs[0], null, 2));
console.log("State Version:", afterState1.stateVersion);

// ATTACK 2: Fake status = DEAD
console.log("\n--- EXECUTING ATTACK 2: Fake Status = DEAD via Candidate ---");
const engine2 = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
const beforeState2 = engine2.getSnapshot();

const candidate2: CandidatePacket = {
  candidateId: 'cand-attack-2',
  npcChanges: [
    {
      name: '삼화상인',
      isDead: true
    }
  ]
};

const proposal2 = buildSafeProposalFromCandidate(
  beforeState2,
  candidate2,
  1,
  engine2.getHistory()
);

console.log("Proposal 2 Actions:", JSON.stringify(proposal2.actions, null, 2));
console.log("Proposal 2 Verified Claims Count:", proposal2.verifiedClaims?.length || 0);
const commitResult2 = engine2.submitProposal(proposal2);
console.log("Commit Result 2 Success:", commitResult2.success);
console.log("Commit Result 2 Rejected Reasons:", commitResult2.rejectedReasons);

const afterState2 = engine2.getSnapshot();
console.log("After Attack 2 NPC Status:", afterState2.worldInfo.npcs[0].status);

// ATTACK 3: Fake innerThought / metInStory
console.log("\n--- EXECUTING ATTACK 3: Fake InnerThought & MetInStory via Candidate ---");
const engine3 = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
const beforeState3 = engine3.getSnapshot();

const candidate3: CandidatePacket = {
  candidateId: 'cand-attack-3',
  npcChanges: [
    {
      name: '삼화상인',
      metInStory: true,
      innerThought: '주인공을 암살할 계획이다'
    }
  ]
};

const proposal3 = buildSafeProposalFromCandidate(
  beforeState3,
  candidate3,
  1,
  engine3.getHistory()
);

const commitResult3 = engine3.submitProposal(proposal3);
console.log("Commit Result 3 Success:", commitResult3.success);
console.log("Commit Result 3 Rejected Reasons:", commitResult3.rejectedReasons);

const afterState3 = engine3.getSnapshot();
console.log("After Attack 3 InnerThought:", afterState3.worldInfo.npcs[0].innerThought);

