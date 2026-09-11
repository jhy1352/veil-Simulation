import { adaptMeaningTreeToProposal } from '../../src/engine/language/adapter';
import { MeaningNode } from '../../src/engine/language/types';
import { SovereignEngine } from '../../src/engine/state';

async function executeFullAttack() {
  const engine = new SovereignEngine();
  const state0 = engine.getSnapshot();

  const npcName = "대장장이 톨린";
  const eventId1 = "offscreen-npc-mention-001";

  // 1. Commit non-creation/non-acquisition history record (RECORD_OFFSCREEN_EVENT) mentioning target NPC
  const tree1: MeaningNode = {
    atom: "ACTION",
    scope: "PROPOSAL",
    value: "RECORD_OFFSCREEN_EVENT",
    fields: {
      actionType: "RECORD_OFFSCREEN_EVENT",
      payload: {
        id: eventId1,
        eventId: eventId1,
        eventDescription: `${npcName}을 장터에서 처음 만나고 발견했다.`
      }
    }
  };

  const prop1 = adaptMeaningTreeToProposal(tree1, {
    source: "LLM",
    turn: state0.turn,
    expectedStateVersion: state0.stateVersion,
    eventId: "evt-turn1",
    requestId: "req-turn1"
  });

  const res1 = engine.submitProposal(prop1);
  const state1 = engine.getSnapshot();
  const history1 = engine.getHistory();

  // EVENT-ID PATH ATTACK
  const treeEventId: MeaningNode = {
    atom: "ACTION",
    scope: "PROPOSAL",
    value: "ADD_NPC",
    fields: {
      actionType: "ADD_NPC",
      payload: {
        id: "npc-tolin-event-path",
        name: npcName,
        role: "대장장이",
        entityReference: {
          entityType: "NPC",
          evidence: {
            verifiedEventId: eventId1,
            cause: "ENCOUNTER"
          }
        }
      }
    }
  };

  const propEventId = adaptMeaningTreeToProposal(treeEventId, {
    source: "LLM",
    turn: state1.turn + 1,
    expectedStateVersion: state1.stateVersion,
    eventId: "evt-turn2-event-path",
    requestId: "req-turn2-event-path"
  });

  const resEventId = engine.submitProposal(propEventId);
  const state2 = engine.getSnapshot();
  const npcCreatedEventId = state2.worldInfo.npcs?.some(n => n.name === npcName || n.id === "npc-tolin-event-path");

  // RECORD-ID PATH ATTACK
  const engineB = new SovereignEngine();
  const stateB0 = engineB.getSnapshot();

  const propB1 = adaptMeaningTreeToProposal(tree1, {
    source: "LLM",
    turn: stateB0.turn,
    expectedStateVersion: stateB0.stateVersion,
    eventId: "evt-b-turn1",
    requestId: "req-b-turn1"
  });
  engineB.submitProposal(propB1);
  const stateB1 = engineB.getSnapshot();
  const historyB = engineB.getHistory();
  const recordIdB = historyB.find(h => h.eventId === "evt-b-turn1")?.recordId || "";

  const treeRecordId: MeaningNode = {
    atom: "ACTION",
    scope: "PROPOSAL",
    value: "ADD_NPC",
    fields: {
      actionType: "ADD_NPC",
      payload: {
        id: "npc-tolin-record-path",
        name: npcName,
        role: "대장장이",
        entityReference: {
          entityType: "NPC",
          evidence: {
            verifiedEventId: recordIdB,
            cause: "ENCOUNTER"
          }
        }
      }
    }
  };

  const propRecordId = adaptMeaningTreeToProposal(treeRecordId, {
    source: "LLM",
    turn: stateB1.turn + 1,
    expectedStateVersion: stateB1.stateVersion,
    eventId: "evt-b-turn2-record-path",
    requestId: "req-b-turn2-record-path"
  });

  const resRecordId = engineB.submitProposal(propRecordId);
  const stateB2 = engineB.getSnapshot();
  const npcCreatedRecordId = stateB2.worldInfo.npcs?.some(n => n.name === npcName || n.id === "npc-tolin-record-path");

  console.log("=== IDENTITY NOVEL PROVENANCE ATTACK ===\n");
  console.log("EVENT-ID PATH:");
  console.log("Identity status:", "NOVEL");
  console.log("Commit:", resEventId.success);
  console.log("NPC created:", npcCreatedEventId);
  console.log("Result:", resEventId.success && npcCreatedEventId ? "RED" : "BLOCKED");

  console.log("\nRECORD-ID PATH:");
  console.log("Identity status:", "NOVEL");
  console.log("Commit:", resRecordId.success);
  console.log("NPC created:", npcCreatedRecordId);
  console.log("Result:", resRecordId.success && npcCreatedRecordId ? "RED" : "BLOCKED");

  const finalResult = (resEventId.success && npcCreatedEventId) || (resRecordId.success && npcCreatedRecordId) ? "RED" : "BLOCKED";
  console.log("\nFINAL CONCLUSION:", finalResult);
}

executeFullAttack();
