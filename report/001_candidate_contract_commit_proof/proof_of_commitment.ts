import { SovereignEngine } from "../src/engine/state";
import { runCandidateRecoveryGate } from "../src/engine/language/candidateRecoveryGate";
import { extractCandidatesFromMetadata } from "../src/utils/engineValidator";
import { buildSafeProposalFromCandidate } from "../src/engine/proposalParser";

const historicalEvent: any = {
  recordId: "rec-test-1",
  eventId: "독립증명용 테스트 event ID",
  proposalId: "prop-test",
  turn: 1,
  timestamp: new Date().toISOString(),
  source: "ENGINE_INITIAL",
  actionType: "MODIFY_INVENTORY",
  details: "{\"item\":{\"id\":\"독립증명용 테스트 ID\",\"name\":\"독립증명용 테스트 아이템\"},\"operation\":\"ADD\",\"eventDescription\":\"보상으로 획득: 독립증명용 테스트 event ID\"}",
  canonicalAction: { type: 'MODIFY_INVENTORY', payload: { item: { id: "독립증명용 테스트 ID", name: "독립증명용 테스트 아이템" }, operation: "ADD" } },
  stateVersionAfterCommit: 1,
  informationAccess: "PUBLIC"
};
const engine = new SovereignEngine(undefined, undefined, [historicalEvent]);
const stateBefore = engine.getSnapshot();

const candidate = {
  candidateId: 1,
  label: "독립증명용 테스트",
  narrativeSummary: "독립증명용 테스트",
  rawMetadata: {
    inventoryChanges: [{
      name: "독립증명용 테스트 아이템",
      quantity: 1,
      action: "add",
      acquisition: {
        cause: "GIFT_REWARD",
        verifiedEventId: "독립증명용 테스트 event ID"
      },
      entityReference: {
        entityType: "ITEM",
        claimedEntityId: "독립증명용 테스트 ID"
      }
    }]
  }
};

const gate = runCandidateRecoveryGate([candidate]);
const packet = extractCandidatesFromMetadata(
  gate.passedCandidates[0].rawMetadata,
  1,
  undefined,
  gate.passedCandidates[0].candidateId
);
const p = Array.isArray(packet) ? packet[0] : packet;
const history: any[] = [];
const proposal = buildSafeProposalFromCandidate(stateBefore, p as any, 1, history);
const result = engine.submitProposal(proposal);
