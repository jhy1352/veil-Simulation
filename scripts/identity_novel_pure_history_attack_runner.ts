import { adaptMeaningTreeToProposal } from '../src/engine/language/adapter';
import { MeaningNode } from '../src/engine/language/types';
import { SovereignEngine } from '../src/engine/state';
import { resolveNpcIdentity } from '../src/engine/index/entityIdentityResolver';

async function runPureHistoryAttack() {
  const npcName = "대장장이 톨린";
  const pureEventText = "대장장이 톨린은 장터에서 상인들과 가격을 흥정했다.";
  const eventId1 = "offscreen-pure-history-001";

  const tree1: MeaningNode = {
    atom: "ACTION",
    scope: "PROPOSAL",
    value: "RECORD_OFFSCREEN_EVENT",
    fields: {
      actionType: "RECORD_OFFSCREEN_EVENT",
      payload: {
        id: eventId1,
        eventId: eventId1,
        eventDescription: pureEventText
      }
    }
  };

  // --- EVENT-ID PATH ---
  const engine1 = new SovereignEngine();
  const state1_0 = engine1.getSnapshot();

  const prop1_1 = adaptMeaningTreeToProposal(tree1, {
    source: "LLM",
    turn: state1_0.turn,
    expectedStateVersion: state1_0.stateVersion,
    eventId: "evt-turn1",
    requestId: "req-turn1"
  });

  const res1_1 = engine1.submitProposal(prop1_1);
  const state1_1 = engine1.getSnapshot();
  const history1 = engine1.getHistory();

  const ref1 = {
    entityType: "NPC" as const,
    evidence: {
      verifiedEventId: eventId1,
      cause: "ENCOUNTER"
    }
  };

  const status1 = resolveNpcIdentity(state1_1, history1, npcName, ref1);

  const tree1_2: MeaningNode = {
    atom: "ACTION",
    scope: "PROPOSAL",
    value: "ADD_NPC",
    fields: {
      actionType: "ADD_NPC",
      payload: {
        id: "npc-tolin-event-path",
        name: npcName,
        role: "대장장이",
        entityReference: ref1
      }
    }
  };

  const prop1_2 = adaptMeaningTreeToProposal(tree1_2, {
    source: "LLM",
    turn: state1_1.turn + 1,
    expectedStateVersion: state1_1.stateVersion,
    eventId: "evt-turn2-event-path",
    requestId: "req-turn2-event-path"
  });

  const res1_2 = engine1.submitProposal(prop1_2);
  const state1_2 = engine1.getSnapshot();
  const npcCreated1 = state1_2.worldInfo.npcs?.some(n => n.name === npcName || n.id === "npc-tolin-event-path");
  const isRed1 = status1.status === "NOVEL" && res1_2.success && npcCreated1;

  // --- RECORD-ID PATH ---
  const engine2 = new SovereignEngine();
  const state2_0 = engine2.getSnapshot();

  const prop2_1 = adaptMeaningTreeToProposal(tree1, {
    source: "LLM",
    turn: state2_0.turn,
    expectedStateVersion: state2_0.stateVersion,
    eventId: "evt-b-turn1",
    requestId: "req-b-turn1"
  });

  engine2.submitProposal(prop2_1);
  const state2_1 = engine2.getSnapshot();
  const history2 = engine2.getHistory();
  const recordId2 = history2.find(h => h.eventId === "evt-b-turn1")?.recordId || "";

  const ref2 = {
    entityType: "NPC" as const,
    evidence: {
      verifiedEventId: recordId2,
      cause: "ENCOUNTER"
    }
  };

  const status2 = resolveNpcIdentity(state2_1, history2, npcName, ref2);

  const tree2_2: MeaningNode = {
    atom: "ACTION",
    scope: "PROPOSAL",
    value: "ADD_NPC",
    fields: {
      actionType: "ADD_NPC",
      payload: {
        id: "npc-tolin-record-path",
        name: npcName,
        role: "대장장이",
        entityReference: ref2
      }
    }
  };

  const prop2_2 = adaptMeaningTreeToProposal(tree2_2, {
    source: "LLM",
    turn: state2_1.turn + 1,
    expectedStateVersion: state2_1.stateVersion,
    eventId: "evt-b-turn2-record-path",
    requestId: "req-b-turn2-record-path"
  });

  const res2_2 = engine2.submitProposal(prop2_2);
  const state2_2 = engine2.getSnapshot();
  const npcCreated2 = state2_2.worldInfo.npcs?.some(n => n.name === npcName || n.id === "npc-tolin-record-path");
  const isRed2 = status2.status === "NOVEL" && res2_2.success && npcCreated2;

  console.log("=== IDENTITY NOVEL PURE-HISTORY ATTACK ===\n");
  console.log("EVENT-ID PATH:");
  console.log("Identity status:", status1.status);
  console.log("Commit:", res1_2.success);
  console.log("NPC created:", npcCreated1);
  console.log("Result:", isRed1 ? "RED" : "BLOCKED");

  console.log("\nRECORD-ID PATH:");
  console.log("Identity status:", status2.status);
  console.log("Commit:", res2_2.success);
  console.log("NPC created:", npcCreated2);
  console.log("Result:", isRed2 ? "RED" : "BLOCKED");

  console.log("\nFINAL CONCLUSION:", (isRed1 || isRed2) ? "RED" : "BLOCKED");
}

runPureHistoryAttack();
