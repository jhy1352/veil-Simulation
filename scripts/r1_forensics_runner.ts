import { SovereignEngine } from "../src/engine/state";
import { buildSafeProposalFromCandidate } from "../src/engine/proposalParser";

const engine = new SovereignEngine(undefined, undefined, []);
const history: any[] = [];
const report: any = { r1a_eventId: null, r1a_recordId: null, r1b: null, r1c: null };

// TURN 1: Offscreen
const candT1 = { candidateId: "1", rawMetadata: { offscreenEvents: [{ event: "T1-EVENT" }] } };
const resT1 = engine.submitProposal(buildSafeProposalFromCandidate(engine.getSnapshot(), candT1 as any, 1, history));
const eventId = resT1.eventId;
const recordId = resT1.newHistoricalRecords[0]?.recordId;

// R1-A: EventId reuse
const candA1 = { candidateId: "2", rawMetadata: { inventoryChanges: [{ name: "아이템A", quantity: 1, action: "add", acquisition: { cause: "DISCOVERY_PICKUP", verifiedEventId: eventId } }] } };
report.r1a_eventId = engine.submitProposal(buildSafeProposalFromCandidate(engine.getSnapshot(), candA1 as any, 2, history)).success ? "REPRODUCED" : "BLOCKED";

// R1-A: RecordId reuse
const candA2 = { candidateId: "3", rawMetadata: { inventoryChanges: [{ name: "아이템B", quantity: 1, action: "add", acquisition: { cause: "DISCOVERY_PICKUP", verifiedEventId: recordId } }] } };
report.r1a_recordId = engine.submitProposal(buildSafeProposalFromCandidate(engine.getSnapshot(), candA2 as any, 3, history)).success ? "REPRODUCED" : "BLOCKED";

// R1-B: Identity NOVEL
const candB = { candidateId: "4", rawMetadata: { newNpcs: [{ name: "새로운NPC", entityReference: { entityType: "NPC", evidence: { verifiedEventId: eventId } } }] } };
report.r1b = engine.submitProposal(buildSafeProposalFromCandidate(engine.getSnapshot(), candB as any, 4, history)).success ? "REPRODUCED" : "BLOCKED";

// R1-C: Invalidation
engine.submitProposal(buildSafeProposalFromCandidate(engine.getSnapshot(), { candidateId: "5", rawMetadata: { newNpcs: [{ name: "NPC2" }] } } as any, 5, history));
engine.submitProposal(buildSafeProposalFromCandidate(engine.getSnapshot(), { candidateId: "6", rawMetadata: { newNpcs: [{ name: "NPC2", isDead: true }] } } as any, 6, history));
const candC = { candidateId: "7", rawMetadata: { inventoryChanges: [{ name: "아이템C", quantity: 1, action: "add", acquisition: { cause: "DISCOVERY_PICKUP", verifiedEventId: eventId } }] } };
report.r1c = engine.submitProposal(buildSafeProposalFromCandidate(engine.getSnapshot(), candC as any, 7, history)).success ? "REPRODUCED" : "BLOCKED";

console.log("FINAL REPORT:", JSON.stringify(report, null, 2));
