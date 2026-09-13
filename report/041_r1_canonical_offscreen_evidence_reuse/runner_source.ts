import { SovereignEngine, computeCanonicalStateHash } from "../../src/engine/state";
import { buildSafeProposalFromCandidate } from "../../src/engine/proposalParser";
import { extractCandidatesFromMetadata } from "../../src/utils/engineValidator";
import { EngineValidator } from "../../src/engine/validator";
import type { ImmutableHistoricalRecord } from "../../src/engine/types";

/**
 * R1 forensic runner.
 *
 * One canonical baseline is created first. R1-A, R1-B and R1-C then hydrate
 * independent SovereignEngine instances from the exact same snapshot, history,
 * and Genesis anchor. No branch receives another branch's mutations.
 */

function commitCandidate(
  engine: SovereignEngine,
  candidate: any,
  turn: number,
  history: ImmutableHistoricalRecord[]
) {
  const before = engine.getSnapshot();
  const packet = extractCandidatesFromMetadata(
    candidate.rawMetadata,
    turn,
    "1년차 봄 1일",
    candidate.candidateId
  );
  const proposal = buildSafeProposalFromCandidate(before, packet, turn, history);
  const validator = EngineValidator.validate(
    proposal,
    before,
    new Set(),
    new Set(),
    history
  );
  const result = engine.submitProposal(proposal);
  const after = engine.getSnapshot();

  if (result.success) history.push(...result.newHistoricalRecords);

  return { before, packet, proposal, validator, result, after };
}

function hydratePristine(
  snapshot: ReturnType<SovereignEngine["getSnapshot"]>,
  history: ImmutableHistoricalRecord[],
  genesis: ReturnType<SovereignEngine["getGenesisSnapshot"]>
) {
  return SovereignEngine.hydrate(snapshot, history, undefined, undefined, genesis);
}

async function runR1Forensics() {
  // BASELINE: one canonical offscreen event, committed exactly once.
  const setupHistory: ImmutableHistoricalRecord[] = [];
  const setupEngine = new SovereignEngine(undefined, undefined, setupHistory);
  const genesis = setupEngine.getGenesisSnapshot();

  const setup = commitCandidate(
    setupEngine,
    {
      candidateId: "baseline-event",
      rawMetadata: {
        cameraOffscreenEvents: [
          "BASELINE-EVENT: 삼화상인이 주인공에게 은검을 선물로 주었다."
        ]
      }
    },
    1,
    setupHistory
  );

  if (!setup.result.success) {
    throw new Error(`Baseline setup failed: ${JSON.stringify(setup.result.rejectedReasons)}`);
  }

  const baselineSnapshot = setup.after;
  const baselineHistory = [...setupHistory];
  const baselineHash = computeCanonicalStateHash(baselineSnapshot);
  const baselineGenesisHash = computeCanonicalStateHash(genesis);

  const baselineRecord = setup.result.newHistoricalRecords.find(
    (r: any) => r.actionType === "RECORD_OFFSCREEN_EVENT"
  );
  const baselineDetails = JSON.parse(baselineRecord?.details || "{}");
  const offscreenId = baselineDetails.id;
  if (!offscreenId) throw new Error("Baseline offscreen eventId was not produced.");

  // R1-A: pristine hydrated branch. Consume baseline evidence once.
  const historyA = [...baselineHistory];
  const engineA = hydratePristine(baselineSnapshot, historyA, genesis);
  const a = commitCandidate(
    engineA,
    {
      candidateId: "r1a",
      rawMetadata: {
        inventoryChanges: [
          {
            name: "은검",
            quantity: 1,
            action: "add",
            entityReference: {
              entityType: "ITEM",
              evidence: { verifiedEventId: offscreenId, cause: "DISCOVERY" }
            }
          }
        ]
      }
    },
    2,
    historyA
  );

  // R1-C: another pristine branch. Consume once, then attempt exact same
  // evidence ID again. The second consumption must be blocked.
  const historyC = [...baselineHistory];
  const engineC = hydratePristine(baselineSnapshot, historyC, genesis);
  const cFirst = commitCandidate(
    engineC,
    {
      candidateId: "r1c-first",
      rawMetadata: {
        inventoryChanges: [
          {
            name: "은검-C",
            quantity: 1,
            action: "add",
            entityReference: {
              entityType: "ITEM",
              evidence: { verifiedEventId: offscreenId, cause: "DISCOVERY" }
            }
          }
        ]
      }
    },
    2,
    historyC
  );
  const cSecond = commitCandidate(
    engineC,
    {
      candidateId: "r1c-duplicate",
      rawMetadata: {
        inventoryChanges: [
          {
            name: "은검-C-DUPLICATE",
            quantity: 1,
            action: "add",
            entityReference: {
              entityType: "ITEM",
              evidence: { verifiedEventId: offscreenId, cause: "DISCOVERY" }
            }
          }
        ]
      }
    },
    3,
    historyC
  );

  // R1-B: third pristine branch. Create a NEW branch-local offscreen event,
  // then resolve a novel NPC from that canonical evidence.
  const historyB = [...baselineHistory];
  const engineB = hydratePristine(baselineSnapshot, historyB, genesis);
  const bEvidence = commitCandidate(
    engineB,
    {
      candidateId: "r1b-evidence",
      rawMetadata: {
        cameraOffscreenEvents: [
          "R1B-EVENT: 홍길동이라는 정체불명의 협객이 등장하였다."
        ]
      }
    },
    2,
    historyB
  );

  if (!bEvidence.result.success) {
    throw new Error(`R1-B evidence setup failed: ${JSON.stringify(bEvidence.result.rejectedReasons)}`);
  }

  const npcRecord = bEvidence.result.newHistoricalRecords.find(
    (r: any) => r.actionType === "RECORD_OFFSCREEN_EVENT"
  );
  const npcDetails = JSON.parse(npcRecord?.details || "{}");
  const npcOffscreenId = npcDetails.id;
  if (!npcOffscreenId) throw new Error("R1-B offscreen eventId was not produced.");

  const b = commitCandidate(
    engineB,
    {
      candidateId: "r1b",
      rawMetadata: {
        newNpcs: [
          {
            id: "npc-hong",
            name: "홍길동",
            entityReference: {
              entityType: "NPC",
              evidence: { verifiedEventId: npcOffscreenId, cause: "ENCOUNTER" }
            }
          }
        ]
      }
    },
    3,
    historyB
  );

  // Isolation assertions: every branch must begin from exactly the same
  // post-baseline canonical hash, and every successful branch must diverge.
  const hashABefore = computeCanonicalStateHash(a.before);
  const hashBBefore = computeCanonicalStateHash(bEvidence.before);
  const hashCBefore = computeCanonicalStateHash(cFirst.before);

  const pristineBaselineShared =
    hashABefore === baselineHash &&
    hashBBefore === baselineHash &&
    hashCBefore === baselineHash;

  const branchesIndependent =
    computeCanonicalStateHash(engineA.getSnapshot()) !== baselineHash &&
    computeCanonicalStateHash(engineB.getSnapshot()) !== baselineHash &&
    computeCanonicalStateHash(engineC.getSnapshot()) !== baselineHash;

  const r1a =
    a.result.success &&
    a.after.character.inventory.some((i: any) => i.name === "은검");

  const r1b =
    b.result.success &&
    b.after.worldInfo.npcs.some((n: any) => n.name === "홍길동");

  const r1c =
    cFirst.result.success &&
    !cSecond.result.success &&
    !cSecond.after.character.inventory.some((i: any) => i.name === "은검-C-DUPLICATE");

  const report = {
    baseline: {
      snapshotHash: baselineHash,
      genesisHash: baselineGenesisHash,
      offscreenId
    },
    isolation: {
      pristineBaselineShared,
      branchesIndependent,
      r1aBeforeHash: hashABefore,
      r1bBeforeHash: hashBBefore,
      r1cBeforeHash: hashCBefore
    },
    r1a: {
      verdict: r1a ? "REPRODUCED" : "BLOCKED",
      success: a.result.success,
      rejectedReasons: a.result.rejectedReasons,
      inventoryAfter: a.after.character.inventory
    },
    r1b: {
      verdict: r1b ? "REPRODUCED" : "BLOCKED",
      success: b.result.success,
      rejectedReasons: b.result.rejectedReasons,
      npcsAfter: b.after.worldInfo.npcs
    },
    r1c: {
      verdict: r1c ? "BLOCKED" : "REPRODUCED",
      firstConsumeSuccess: cFirst.result.success,
      duplicateConsumeSuccess: cSecond.result.success,
      duplicateRejectedReasons: cSecond.result.rejectedReasons,
      inventoryAfterDuplicateAttempt: cSecond.after.character.inventory
    },
    finalStatus:
      r1a && r1b && r1c && pristineBaselineShared && branchesIndependent
        ? "PASS"
        : "FAIL"
  };

  console.log("FINAL REPORT:", JSON.stringify(report, null, 2));
}

runR1Forensics().catch((err) => {
  console.error("R1 FORENSICS FAILED:", err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
