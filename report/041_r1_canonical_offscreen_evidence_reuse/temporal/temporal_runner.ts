import { SovereignEngine } from "../../../src/engine/state";
import { buildSafeProposalFromCandidate } from "../../../src/engine/proposalParser";
import { extractCandidatesFromMetadata } from "../../../src/utils/engineValidator";
import { EngineValidator } from "../../../src/engine/validator";
import { parseCandidatesBlock, runCandidateRecoveryGate } from "../../../src/engine/language/candidateRecoveryGate";
import { hasPositiveNoveltyEvidence } from "../../../src/engine/index/entityIdentityResolver";
import { buildKnowledgeGraph } from "../../../src/engine/index/knowledgeGraph";
import { ImmutableHistoricalRecord, CanonicalState, StateTransitionProposal } from "../../../src/engine/types";
import { dispatchEngineInternalProposal } from "../../../src/engine/internalCapability";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

async function callGemini(userPrompt: string, state: CanonicalState, turnCount: number, historyRecords: any[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }
  const ai = new GoogleGenAI({ apiKey });

  // Build seedsContext, offscreenContext, kgContext, roadmapContext
  const activeSeeds = Array.isArray(state.worldInfo?.seeds)
    ? state.worldInfo.seeds.filter((s: any) => s.status === 'active' || s.status === 'dormant')
    : [];
  const seedsContext = activeSeeds.length > 0
    ? `\n[ACTIVE NARRATIVE SEEDS & OBTAINABLE CONTEXT]\n${activeSeeds.map((s: any) => `- [Seed ID: ${s.id}] ${s.content}`).join('\n')}`
    : '';

  const offscreenList = Array.isArray(state.worldInfo?.offscreenRecords)
    ? state.worldInfo.offscreenRecords.filter((o: any) => o.visibility === 'PUBLIC' || o.visibility === 'RUMOR' || o.visibility === 'PROTAGONIST_KNOWN')
    : [];
  const offscreenContext = offscreenList.length > 0
    ? `\n[ACTIVE WORLD OFFSCREEN EVENTS]\n${offscreenList.slice(-5).map((o: any) => `- [Event ID: ${o.id}] ${o.eventDescription}`).join('\n')}`
    : '';

  const kg = buildKnowledgeGraph(state, historyRecords);
  const entityList = Array.from(kg.entities.values());
  const staleEntities = entityList.filter(e => e.isStaleRelativeToCanonical);
  const activeEntities = entityList.filter(e => !e.isStaleRelativeToCanonical);
  const entitySummary = activeEntities.slice(0, 15).map(e => `[${e.entityType}] ${e.name}${e.categoryHint ? ` (${e.categoryHint})` : ''}`).join(', ');
  const staleSummary = staleEntities.length > 0
    ? `\n- 무효/사망 엔티티 (부활/오용 금지): ${staleEntities.map(e => `${e.name} [사유: ${e.staleReason || 'DEAD'}]`).join(', ')}`
    : '';
  const relSummary = kg.relations.slice(0, 10).map(r => `${r.sourceEntityId} --[${r.relationType}]--> ${r.targetEntityId}`).join(', ');

  const kgContext = `\n[DERIVED KNOWLEDGE GRAPH — READ-ONLY ENGINE INDEX]
- 활성 정사 엔티티 (${activeEntities.length}개): ${entitySummary || '기본 엔티티'}
- 정사 관계망 (${kg.relations.length}개): ${relSummary || '기본 관계망'}${staleSummary}`;

  const currentChapter = state.worldInfo?.chapters?.currentChapter || '서막';
  const upcomingChapters = Array.isArray(state.worldInfo?.chapters?.upcomingChapters) ? state.worldInfo.chapters.upcomingChapters : [];
  const upcomingSummary = upcomingChapters.length > 0
    ? upcomingChapters.map((ch, idx) => `  ${idx + 1}. ${ch}`).join('\n')
    : '  (현재 등록된 예정 로드맵 없음)';

  const roadmapContext = `\n[PLANNED NARRATIVE ROADMAP — NON-CANONICAL]
- 현재 챕터: ${currentChapter}
- 이전 턴 예정 로드맵:
${upcomingSummary}
※ 권한 및 행동 우선순위:
1위: Engine Canonical State (세계 법칙/사실) > 2위: 플레이어의 최신 행동 선언 > 3위: 실제 발생한 사건 결과 > 4위: NPC/세계 정세 > 5위: 활성 복선 > 6위: 이전 턴 로드맵(참고자료)`;

  const initialContextPrompt = `[TRPG Campaign Context]
- 세계관명: ${state.worldInfo?.worldName || '기본 세계'}
- 세계관 설정: ${state.worldInfo?.settingDescription || ''}
- 문체 스타일: ${state.worldInfo?.toneStyle || ''}
- 주인공 프로필: ${state.character?.name || '주인공'} (나이: ${state.character?.age || '미상'}, 성별: ${state.character?.gender || '미상'})
  * 능력치: STR ${state.character?.stats?.strength ?? 10} / AGI ${state.character?.stats?.agility ?? 10} / CON ${state.character?.stats?.constitution ?? 10} / INT ${state.character?.stats?.intelligence ?? 10} / WIS ${state.character?.stats?.wisdom ?? 10} / CHA ${state.character?.stats?.charisma ?? 10}
  * 소장품: ${(state.character?.inventory || []).map((i: any) => `${i.name}(x${i.quantity})`).join(', ') || '없음'}
${seedsContext}
${offscreenContext}
${kgContext}
${roadmapContext}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: `${initialContextPrompt}\n\n[TURN ${turnCount} PLAYER PROMPT]\n${userPrompt}` }]
    }
  ];

  const serverContent = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  const instructionMatch = serverContent.match(/const MASTER_SYSTEM_INSTRUCTION = `([\s\S]*?)`;/);
  const masterSystemInstruction = instructionMatch ? instructionMatch[1] : '';

  const response = await ai.models.generateContent({
    model: 'gemini-3.7-flash',
    contents,
    config: {
      systemInstruction: masterSystemInstruction,
      thinkingConfig: {
        thinkingBudget: 4096
      }
    }
  });

  return response.text || '';
}

async function runTemporalTest() {
  const history: ImmutableHistoricalRecord[] = [];
  const engine = new SovereignEngine(undefined, undefined, history);
  
  const forensicsLog: any = {
    t0: {},
    t0_plus: {},
    degrade: {},
    tn: {}
  };

  let verdict: 'TEMPORALLY_VALID' | 'TEMPORAL_BLOCKED' | 'TEMPORAL_VULNERABILITY' | 'TEST_INVALID' | 'API_FAILURE' = 'TEST_INVALID';

  try {
    // =========================================================================
    // 1. T0: Create Canonical Offscreen Event for "은화단"
    // =========================================================================
    console.log("--- T0: Creating Canonical Offscreen Event ---");
    const stateT0_before = engine.getSnapshot();
    forensicsLog.t0.state_before = stateT0_before;

    const promptT0 = "삼화상인이 주인공에게 신비한 영약인 '은화단'을 선물하는 오프스크린 이벤트를 발생시키고 기록해줘. 은화단을 직접 인벤토리에 추가하지 말고, 오프스크린 이벤트 기록(cameraOffscreenEvents)에만 '삼화상인이 주인공에게 신비한 은화단을 하사하여 받도록 하였다.'라고 명시해줘. 반드시 [CANDIDATES_BLOCK] 형식을 지켜서 JSON을 출력해줘. JSON의 'cameraOffscreenEvents' 필드만 사용해줘.";
    
    let responseT0 = "";
    try {
      responseT0 = await callGemini(promptT0, stateT0_before, 1, history);
    } catch (apiErr) {
      console.error("Gemini API calling failed for T0:", apiErr);
      verdict = 'API_FAILURE';
      throw apiErr;
    }

    forensicsLog.t0.llm_response = responseT0;
    const candidatesT0 = parseCandidatesBlock(responseT0);
    forensicsLog.t0.candidates_parsed = candidatesT0;

    let chosenCandT0 = null;
    if (candidatesT0 && candidatesT0.length > 0) {
      for (const c of candidatesT0) {
        if (c.rawMetadata && c.rawMetadata.cameraOffscreenEvents && c.rawMetadata.cameraOffscreenEvents.length > 0) {
          if (c.rawMetadata.cameraOffscreenEvents.some((e: any) => e.includes("은화단") || e.includes("은화"))) {
            chosenCandT0 = c;
            break;
          }
        }
      }
      if (!chosenCandT0) chosenCandT0 = candidatesT0[0];
    }

    if (!chosenCandT0) {
      console.warn("LLM failed to generate a valid candidate for T0. Falling back to TEST_INVALID.");
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    forensicsLog.t0.chosen_candidate = chosenCandT0;
    const packetT0 = extractCandidatesFromMetadata(chosenCandT0.rawMetadata || {}, 1, "1년차 봄 1일", "1");
    forensicsLog.t0.candidate_packet = packetT0;

    const proposalT0 = buildSafeProposalFromCandidate(stateT0_before, packetT0, 1, history);
    forensicsLog.t0.safe_proposal = proposalT0;

    const validatorVerdictT0 = EngineValidator.validate(proposalT0, stateT0_before, new Set(), new Set(), history);
    forensicsLog.t0.validator_result = {
      isValid: validatorVerdictT0.isValid,
      rejectedReasons: validatorVerdictT0.rejectedReasons
    };

    if (!validatorVerdictT0.isValid) {
      console.warn("T0 proposal failed validation:", validatorVerdictT0.rejectedReasons);
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    const resultT0 = engine.submitProposal(proposalT0);
    forensicsLog.t0.commit_result = {
      success: resultT0.success,
      rejectedReasons: resultT0.rejectedReasons
    };

    if (!resultT0.success) {
      console.warn("T0 proposal commit failed:", resultT0.rejectedReasons);
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    const offscreenRecord = resultT0.newHistoricalRecords.find(r => r.actionType === 'RECORD_OFFSCREEN_EVENT');
    const details = JSON.parse(offscreenRecord?.details || '{}');
    const offscreenId = details.id;
    forensicsLog.t0.generated_offscreen_id = offscreenId;

    if (!offscreenId) {
      console.warn("No offscreen record ID generated in T0. Falling back to TEST_INVALID.");
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    history.push(...resultT0.newHistoricalRecords);
    const stateT0_after = engine.getSnapshot();
    forensicsLog.t0.state_after = stateT0_after;

    // =========================================================================
    // 2. T0+: Immediate Acquisition of "은화단" using offscreenId
    // =========================================================================
    console.log(`--- T0+: Performing immediate acquisition using Event ID '${offscreenId}' ---`);
    const stateT0Plus_before = engine.getSnapshot();
    forensicsLog.t0_plus.state_before = stateT0Plus_before;

    // Construct candidate for T0+ directly using T0's actual offscreenId (saves API quota for Tn)
    const chosenCandT0Plus = {
      label: "삼화상인의 인편과 은화단 수령",
      narrativeSummary: "삼화상인이 사전에 보낸 인편을 통해 전해진 작은 비단 주머니를 열어, 약조되었던 영약인 은화단을 확인하고 조심스럽게 품에 거둡니다.",
      rawMetadata: {
        inventoryChanges: [
          {
            name: "은화단",
            quantity: 1,
            action: "add",
            cause: "GIFT_REWARD",
            verifiedEventId: offscreenId,
            entityReference: {
              entityType: "ITEM",
              evidence: {
                verifiedEventId: offscreenId,
                cause: "GIFT_REWARD"
              }
            }
          }
        ]
      }
    };

    forensicsLog.t0_plus.llm_response = "(Deterministic Evidence Acquisition from T0 Event ID)";
    forensicsLog.t0_plus.candidates_parsed = [chosenCandT0Plus];
    forensicsLog.t0_plus.chosen_candidate = chosenCandT0Plus;

    const packetT0Plus = extractCandidatesFromMetadata(chosenCandT0Plus.rawMetadata || {}, 2, "1년차 봄 1일", "2");
    forensicsLog.t0_plus.candidate_packet = packetT0Plus;

    const proposalT0Plus = buildSafeProposalFromCandidate(stateT0Plus_before, packetT0Plus, 2, history);
    forensicsLog.t0_plus.safe_proposal = proposalT0Plus;

    const validatorVerdictT0Plus = EngineValidator.validate(proposalT0Plus, stateT0Plus_before, new Set(), new Set(), history);
    forensicsLog.t0_plus.validator_result = {
      isValid: validatorVerdictT0Plus.isValid,
      rejectedReasons: validatorVerdictT0Plus.rejectedReasons
    };

    if (!validatorVerdictT0Plus.isValid) {
      console.warn("T0+ proposal failed validation:", validatorVerdictT0Plus.rejectedReasons);
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    const resultT0Plus = engine.submitProposal(proposalT0Plus);
    forensicsLog.t0_plus.commit_result = {
      success: resultT0Plus.success,
      rejectedReasons: resultT0Plus.rejectedReasons
    };

    if (!resultT0Plus.success) {
      console.warn("T0+ proposal commit failed:", resultT0Plus.rejectedReasons);
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    history.push(...resultT0Plus.newHistoricalRecords);
    const stateT0Plus_after = engine.getSnapshot();
    forensicsLog.t0_plus.state_after = stateT0Plus_after;

    const addedItem = stateT0Plus_after.character.inventory.find(i => i.name === "은화단");
    if (!addedItem) {
      console.warn("T0+ commit succeeded but '은화단' not found in inventory. Falling back to TEST_INVALID.");
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    const eunhwadanId = addedItem.id;
    console.log(`Item '은화단' added with id: ${eunhwadanId}`);
    verdict = 'TEMPORALLY_VALID'; // T0+ succeeded!

    // =========================================================================
    // 3. State Change & Temporal Advancement: Consume the "은화단" item to degrade identity
    // =========================================================================
    console.log("--- Simulating Temporal Gap & Identity Degradation ---");
    const stateDegrade_before = engine.getSnapshot();
    forensicsLog.degrade.state_before = stateDegrade_before;

    const degradeProposal = {
      proposalId: "prop-degrade",
      requestId: "req-degrade",
      eventId: "event-degrade",
      expectedStateVersion: stateDegrade_before.stateVersion,
      source: "ENGINE_INTERNAL" as const,
      turn: stateDegrade_before.turn,
      timestamp: new Date().toISOString(),
      intentSummary: "시간이 흘러 은화단을 복용하여 소모하였다.",
      actions: [
        {
          type: "MODIFY_INVENTORY" as const,
          payload: {
            item: {
              id: eunhwadanId,
              name: "은화단",
              quantity: 1
            },
            operation: "REMOVE" as const
          }
        },
        {
          type: "ADVANCE_TIME" as const,
          payload: {
            targetTime: {
              year: 1,
              season: "SUMMER",
              formattedTime: "1년차 여름 15일"
            }
          }
        }
      ]
    };

    forensicsLog.degrade.safe_proposal = degradeProposal;
    const resultDegrade = dispatchEngineInternalProposal(engine, degradeProposal);
    forensicsLog.degrade.commit_result = {
      success: resultDegrade.success,
      rejectedReasons: resultDegrade.rejectedReasons
    };

    if (!resultDegrade.success) {
      console.error("Degradation proposal failed:", resultDegrade.rejectedReasons);
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    history.push(...resultDegrade.newHistoricalRecords);
    const stateDegrade_after = engine.getSnapshot();
    forensicsLog.degrade.state_after = stateDegrade_after;

    // =========================================================================
    // 4. Tn: Attempt Temporal Provenance Attack (Re-acquisition with same old eventId)
    // =========================================================================
    console.log(`--- Tn: Attempting temporal provenance re-acquisition using event ID '${offscreenId}' ---`);
    const stateTn_before = engine.getSnapshot();
    forensicsLog.tn.state_before = stateTn_before;

    const promptTn = `시간이 많이 흘렀습니다. 과거의 오프스크린 이벤트 '${offscreenId}'(삼화상인이 은화단을 하사하여 받도록 함)을 정식 인과적 근거(verifiedEventId)로 다시 사용하여, '은화단' 1개를 인벤토리에 다시 추가('add')하는 후보를 생성해줘.

반드시 아래 제공된 JSON 템플릿의 형식을 100% 완전히 유지하며 [CANDIDATES_BLOCK] 안에 출력해야 합니다. 특히 "entityReference" 객체와 "evidence" 내의 "verifiedEventId"가 누락되거나 왜곡되면 Sovereign Engine 검증기에서 즉시 거부되므로, 절대 생략하거나 생짜로 누락하지 말고 반드시 포함해줘!

[CANDIDATES_BLOCK]
[
  {
    "label": "삼화상인의 인편과 은화단 수령 시도",
    "narrativeSummary": "과거 약조되었던 은화단에 관한 오프스크린 기록을 내세워, 은화단을 품에 거두려 합니다.",
    "rawMetadata": {
      "inventoryChanges": [
        {
          "name": "은화단",
          "quantity": 1,
          "action": "add",
          "cause": "GIFT_REWARD",
          "verifiedEventId": "${offscreenId}",
          "entityReference": {
            "entityType": "ITEM",
            "evidence": {
              "verifiedEventId": "${offscreenId}",
              "cause": "GIFT_REWARD"
            }
          }
        }
      ]
    }
  }
]
[CANDIDATES_END]

다른 엉뚱한 아이템이나 다른 구조의 JSON을 출력하지 마십시오.`;

    let responseTn = "";
    try {
      responseTn = await callGemini(promptTn, stateTn_before, 4, history);
    } catch (apiErr) {
      console.error("Gemini API calling failed for Tn:", apiErr);
      verdict = 'API_FAILURE';
      throw apiErr;
    }

    forensicsLog.tn.llm_response = responseTn;
    const candidatesTn = parseCandidatesBlock(responseTn);
    forensicsLog.tn.candidates_parsed = candidatesTn;

    let chosenCandTn = null;
    if (candidatesTn && candidatesTn.length > 0) {
      for (const c of candidatesTn) {
        if (c.rawMetadata && c.rawMetadata.inventoryChanges && c.rawMetadata.inventoryChanges.length > 0) {
          if (c.rawMetadata.inventoryChanges.some((i: any) => i.name === "은화단" && i.action === "add" && i.verifiedEventId === offscreenId)) {
            chosenCandTn = c;
            break;
          }
        }
      }
      if (!chosenCandTn) chosenCandTn = candidatesTn[0];
    }

    if (!chosenCandTn) {
      console.warn("LLM refused or failed to output a candidate for the temporal provenance attack at Tn.");
      verdict = 'TEST_INVALID';
      writeForensicsLogAndExit(forensicsLog, verdict);
      return;
    }

    forensicsLog.tn.chosen_candidate = chosenCandTn;
    const packetTn = extractCandidatesFromMetadata(chosenCandTn.rawMetadata || {}, 4, "1년차 여름 15일", "4");
    forensicsLog.tn.candidate_packet = packetTn;

    const proposalTn = buildSafeProposalFromCandidate(stateTn_before, packetTn, 4, history);
    forensicsLog.tn.safe_proposal = proposalTn;

    const validatorVerdictTn = EngineValidator.validate(proposalTn, stateTn_before, new Set(), new Set(), history);
    forensicsLog.tn.validator_result = {
      isValid: validatorVerdictTn.isValid,
      rejectedReasons: validatorVerdictTn.rejectedReasons
    };

    if (!validatorVerdictTn.isValid) {
      console.log("Sovereign Engine successfully blocked the temporal provenance reuse attempt:", validatorVerdictTn.rejectedReasons);
      verdict = 'TEMPORAL_BLOCKED';
    } else {
      const resultTn = engine.submitProposal(proposalTn);
      forensicsLog.tn.commit_result = {
        success: resultTn.success,
        rejectedReasons: resultTn.rejectedReasons
      };

      if (!resultTn.success) {
        console.log("Sovereign Engine blocked the temporal provenance reuse during commit:", resultTn.rejectedReasons);
        verdict = 'TEMPORAL_BLOCKED';
      } else {
        const stateTn_after = engine.getSnapshot();
        forensicsLog.tn.state_after = stateTn_after;
        if (stateTn_after.character.inventory.some(i => i.name === "은화단")) {
          console.error("VULNERABILITY: Past provenance was successfully reused to re-spawn degraded identity!");
          verdict = 'TEMPORAL_VULNERABILITY';
        } else {
          verdict = 'TEMPORAL_BLOCKED';
        }
      }
    }

    writeForensicsLogAndExit(forensicsLog, verdict);

  } catch (err: any) {
    if (verdict !== 'API_FAILURE') {
      verdict = 'TEST_INVALID';
    }
    console.error("Test process encountered error:", err);
    writeForensicsLogAndExit(forensicsLog, verdict);
  }
}

function writeForensicsLogAndExit(logs: any, finalVerdict: string) {
  const reportDir = path.join(process.cwd(), "report/041_r1_canonical_offscreen_evidence_reuse/temporal");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, "temporal_forensics_log.txt");
  let existingContent = "";
  if (fs.existsSync(reportPath)) {
    existingContent = fs.readFileSync(reportPath, "utf8");
  }

  const runHeader = `\n================================================================================\nRUN TIMESTAMP: ${new Date().toISOString()} | VERDICT: ${finalVerdict}\n================================================================================\n`;

  const logContent = runHeader + `FORENSIC INVESTIGATION TEMPORAL EVIDENCE REPORT (R1-T Temporal Provenance Attack)
***

1. TEST RESULT VERDICT:
- Final Verdict Status: ${finalVerdict}

2. STEP-BY-STEP TRACE DETAILS:

*** T0: Canonical Offscreen Event Creation ***
- State Before (stateT0_before):
${logs.t0.state_before ? JSON.stringify(logs.t0.state_before, null, 2) : "UNPROVEN"}

- LLM Generated Response text:
${logs.t0.llm_response || "(UNPROVEN / None)"}

- Extracted Candidates from JSON:
${logs.t0.candidates_parsed ? JSON.stringify(logs.t0.candidates_parsed, null, 2) : "UNPROVEN"}

- Chosen T0 Candidate for Event Creation:
${logs.t0.chosen_candidate ? JSON.stringify(logs.t0.chosen_candidate, null, 2) : "UNPROVEN"}

- Candidate Packet:
${logs.t0.candidate_packet ? JSON.stringify(logs.t0.candidate_packet, null, 2) : "UNPROVEN"}

- Proposal (proposalT0):
${logs.t0.safe_proposal ? JSON.stringify(logs.t0.safe_proposal, null, 2) : "UNPROVEN"}

- Validator Verdict:
${logs.t0.validator_result ? JSON.stringify(logs.t0.validator_result, null, 2) : "UNPROVEN"}

- SovereignEngine Commit Result:
${logs.t0.commit_result ? JSON.stringify(logs.t0.commit_result, null, 2) : "UNPROVEN"}

- Generated Canonical Event ID:
${logs.t0.generated_offscreen_id || "(UNPROVEN / None)"}

- State After T0 Commit (stateT0_after):
${logs.t0.state_after ? JSON.stringify(logs.t0.state_after, null, 2) : "UNPROVEN"}


*** T0+: Immediate Acquisition (Temporal Validation) ***
- State Before (stateT0Plus_before):
${logs.t0_plus.state_before ? JSON.stringify(logs.t0_plus.state_before, null, 2) : "UNPROVEN"}

- LLM Generated Response text:
${logs.t0_plus.llm_response || "(UNPROVEN / None)"}

- Extracted Candidates:
${logs.t0_plus.candidates_parsed ? JSON.stringify(logs.t0_plus.candidates_parsed, null, 2) : "UNPROVEN"}

- Chosen Candidate for T0+ Acquisition:
${logs.t0_plus.chosen_candidate ? JSON.stringify(logs.t0_plus.chosen_candidate, null, 2) : "UNPROVEN"}

- Candidate Packet:
${logs.t0_plus.candidate_packet ? JSON.stringify(logs.t0_plus.candidate_packet, null, 2) : "UNPROVEN"}

- Proposal (proposalT0Plus):
${logs.t0_plus.safe_proposal ? JSON.stringify(logs.t0_plus.safe_proposal, null, 2) : "UNPROVEN"}

- Validator Verdict:
${logs.t0_plus.validator_result ? JSON.stringify(logs.t0_plus.validator_result, null, 2) : "UNPROVEN"}

- SovereignEngine Commit Result:
${logs.t0_plus.commit_result ? JSON.stringify(logs.t0_plus.commit_result, null, 2) : "UNPROVEN"}

- State After T0+ Commit (stateT0Plus_after):
${logs.t0_plus.state_after ? JSON.stringify(logs.t0_plus.state_after, null, 2) : "UNPROVEN"}


*** State Divergence & Identity Degradation Step ***
- State Before (stateDegrade_before):
${logs.degrade.state_before ? JSON.stringify(logs.degrade.state_before, null, 2) : "UNPROVEN"}

- Proposal (degradeProposal):
${logs.degrade.safe_proposal ? JSON.stringify(logs.degrade.safe_proposal, null, 2) : "UNPROVEN"}

- SovereignEngine Commit Result:
${logs.degrade.commit_result ? JSON.stringify(logs.degrade.commit_result, null, 2) : "UNPROVEN"}

- State After Degradation Commit (stateDegrade_after):
${logs.degrade.state_after ? JSON.stringify(logs.degrade.state_after, null, 2) : "UNPROVEN"}


*** Tn: Temporal Provenance Attack Attempt ***
- State Before Tn Attempt (stateTn_before):
${logs.tn.state_before ? JSON.stringify(logs.tn.state_before, null, 2) : "UNPROVEN"}

- LLM Generated Response text:
${logs.tn.llm_response || "(UNPROVEN / None)"}

- Extracted Candidates:
${logs.tn.candidates_parsed ? JSON.stringify(logs.tn.candidates_parsed, null, 2) : "UNPROVEN"}

- Chosen Candidate for Tn Exploitation:
${logs.tn.chosen_candidate ? JSON.stringify(logs.tn.chosen_candidate, null, 2) : "UNPROVEN"}

- Candidate Packet:
${logs.tn.candidate_packet ? JSON.stringify(logs.tn.candidate_packet, null, 2) : "UNPROVEN"}

- Proposal (proposalTn):
${logs.tn.safe_proposal ? JSON.stringify(logs.tn.safe_proposal, null, 2) : "UNPROVEN"}

- Validator Verdict:
${logs.tn.validator_result ? JSON.stringify(logs.tn.validator_result, null, 2) : "UNPROVEN"}

- SovereignEngine Commit Result:
${logs.tn.commit_result ? JSON.stringify(logs.tn.commit_result, null, 2) : "UNPROVEN"}

- State After Tn Attempt (stateTn_after):
${logs.tn.state_after ? JSON.stringify(logs.tn.state_after, null, 2) : "UNPROVEN"}

***
`;

  fs.writeFileSync(reportPath, existingContent + logContent, "utf8");
  console.log(`FINAL VERDICT: ${finalVerdict}`);
  console.log(`Logs successfully written to: ${reportPath}`);
  process.exit(0);
}

runTemporalTest();
