import { SovereignEngine } from '../src/engine/state';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory';
import { StateTransitionProposal } from '../src/engine/types';
import { captureStrictDeepState, strictDeepCompare } from './reverify_red_team_harness_integrity';

console.log("================================================================================");
console.log("   RED TEAM PROVEN BREACH EXPLOIT REPRODUCER: VULN-NPC-01 & VULN-CHAP-01       ");
console.log("================================================================================");

// Setup Engine with deceased NPC
const world = createEmptyWorldInfo();
world.worldName = "Murim Realm";
world.npcs = [
  {
    id: "npc-dead-01",
    name: "General Lu Bu",
    alias: "Flying General",
    npcClass: "NAMED",
    innerThought: "...",
    metInStory: true,
    status: "DEAD", // Canonical Death
    origin: "Capital",
    background: "Legendary warlord",
    martialArts: "Halberd of the Dragon",
    values: "Might",
    affiliation: "Han Dynasty"
  }
];
world.chapters = {
  currentChapter: "Chapter 1: The Fall",
  upcomingChapters: ["Chapter 2: The Rebuilding"]
};

const char = createEmptyCharacter();
char.name = "Protagonist";
char.stats = { HP: 100, SP: 50, LEVEL: 1, GOLD: 100 };

const engine = new SovereignEngine(world, char, [], 1, 1);
const state0 = captureStrictDeepState(engine);

console.log("\n[STATE 0: INITIAL CANONICAL STATE]");
console.log(`- NPCs in State: ${state0.worldInfo.npcs.map((n: any) => `${n.name} (${n.id}, status=${n.status})`).join(', ')}`);
console.log(`- Upcoming Chapters: ${JSON.stringify(state0.worldInfo.chapters.upcomingChapters)}`);
console.log(`- State Version: ${state0.stateVersion}`);

// -----------------------------------------------------------------------------
// EXPLOIT 1: Resurrecting Deceased NPC under New ID via ADD_NPC (VULN-NPC-01)
// -----------------------------------------------------------------------------
console.log("\n>>> EXECUTING EXPLOIT 1: ADD_NPC Resurrecting Deceased Character 'General Lu Bu' under new ID 'npc-clone-01'...");
const exploitProposal1: StateTransitionProposal = {
  proposalId: "prop-exploit-resurrect",
  requestId: "req-exploit-resurrect",
  eventId: "evt-exploit-resurrect",
  expectedStateVersion: 1,
  source: "LLM",
  turn: 1,
  timestamp: new Date().toISOString(),
  actions: [
    {
      type: "ADD_NPC",
      payload: {
        id: "npc-clone-01",
        name: "General Lu Bu", // Exact same name as canonically dead character!
        alias: "Reborn Halberd Master",
        npcClass: "NAMED",
        innerThought: "I have walked out of the underworld alive.",
        metInStory: true,
        status: "ALIVE", // Successfully creates an ALIVE clone!
        origin: "Capital",
        background: "Resurrected warlord",
        martialArts: "Halberd of the Dragon",
        values: "Might",
        affiliation: "Han Dynasty"
      }
    }
  ]
};

const res1 = engine.submitProposal(exploitProposal1);
const state1 = captureStrictDeepState(engine);

console.log(`Commit Result: success=${res1.success}, committedActions=${res1.committedActionsCount}`);
console.log(`Rejected Reasons: ${JSON.stringify(res1.rejectedReasons)}`);
console.log(`Conflict Details: ${JSON.stringify(res1.conflictDetails)}`);

const diff1 = strictDeepCompare(state0, state1);
console.log(`State Mutations Count: ${diff1.diffs.length}`);
console.log(`State Mutations: \n${diff1.diffs.map(d => `  - ${d}`).join('\n')}`);

const aliveLuBu = state1.worldInfo.npcs.find((n: any) => n.name === "General Lu Bu" && n.status === "ALIVE");
if (aliveLuBu) {
  console.log(`\n\x1b[31m[CRITICAL EXPLOIT CONFIRMED]\x1b[0m Canonical state now contains ALIVE 'General Lu Bu' (id: ${aliveLuBu.id}) despite prior canonical death!`);
}

// -----------------------------------------------------------------------------
// EXPLOIT 2: Upcoming Chapter Buffer Overflow (>3 Chapters) (VULN-CHAP-01)
// -----------------------------------------------------------------------------
console.log("\n>>> EXECUTING EXPLOIT 2: ADVANCE_CHAPTER Chapter Overflow (>3 Chapters)...");
const exploitProposal2: StateTransitionProposal = {
  proposalId: "prop-exploit-chapter-flood",
  requestId: "req-exploit-chapter-flood",
  eventId: "evt-exploit-chapter-flood",
  expectedStateVersion: state1.stateVersion,
  source: "LLM",
  turn: 2,
  timestamp: new Date().toISOString(),
  actions: [
    {
      type: "ADVANCE_CHAPTER",
      payload: {
        currentChapter: "Chapter 2: The Rebuilding",
        upcomingChapters: [
          "Chapter 3: The Secret Conspiracy",
          "Chapter 4: The Imperial Coup",
          "Chapter 5: The Demonic Incursion",
          "Chapter 6: The Fall of the Sects",
          "Chapter 7: The Apocalypse",
          "Chapter 8: The Rebirth of the Gods"
        ]
      }
    }
  ]
};

const res2 = engine.submitProposal(exploitProposal2);
const state2 = captureStrictDeepState(engine);

console.log(`Commit Result: success=${res2.success}, committedActions=${res2.committedActionsCount}`);
console.log(`Upcoming Chapters Count: ${state2.worldInfo.chapters.upcomingChapters.length}`);
console.log(`Upcoming Chapters in State: ${JSON.stringify(state2.worldInfo.chapters.upcomingChapters)}`);

if (state2.worldInfo.chapters.upcomingChapters.length > 3) {
  console.log(`\n\x1b[31m[CRITICAL EXPLOIT CONFIRMED]\x1b[0m Canonical state chapters buffer overflowed: ${state2.worldInfo.chapters.upcomingChapters.length} chapters stored (Rule 7 limit was 3)!`);
}

console.log("\n================================================================================");
console.log("               END OF RED TEAM FORENSIC PROBE RUN                               ");
console.log("================================================================================");
