import fs from 'fs';
import path from 'path';
import { SovereignEngine } from '../src/engine/state.ts';
import { CanonicalState, StateTransitionProposal, EventRecord } from '../src/engine/types.ts';

const REPORT_DIR = path.join(process.cwd(), 'report', '74_gemini_3_1_flash_lite_candidate_preservation_forensics');
const RAW_DIR = path.join(process.cwd(), 'report', 'raw', '74_gemini_3_1_flash_lite_candidate_preservation_forensics');

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.mkdirSync(RAW_DIR, { recursive: true });

const playerActions = [
  { turn: 1, actionType: '이동', prompt: '마을 광장에서 활기찬 상점 골목으로 천천히 이동하며 주변 환경을 살펴본다.' },
  { turn: 2, actionType: '환경 상호작용', prompt: '잡동사니와 고서가 어지럽게 쌓인 어느 잡화점 입구의 오크나무 서가를 자세히 조사한다.' },
  { turn: 3, actionType: '아이템 관찰', prompt: '서가 맨 구석 먼지 쌓인 책 더미 뒤에서 작은 가죽 주머니(은화 5닢)와 양피지 지도를 발견하고 손을 대지 않고 눈으로 유심히 살핀다.' },
  { turn: 4, actionType: '아이템 획득', prompt: '서가 뒤에 놓인 가죽 은화 주머니(은화 5닢)를 손으로 집어 들어 배낭 안에 챙겨 넣는다.' },
  { turn: 5, actionType: 'NPC 상호작용', prompt: '잡화점 카운터에 앉아 있는 늙은 상인에게 다가가 인사를 건네고 이 주변 골목의 위험이나 소문에 대해 대화를 시도한다.' },
  { turn: 6, actionType: '복합 행동(아이템 사용+대화)', prompt: '노인에게 정중히 인사를 건넨 뒤, 방금 배낭에 챙긴 은화 주머니에서 은화 1닢을 꺼내 카운터에 내밀며 밤에 열리는 비밀 지하 주점 위치를 물어본다.' },
  { turn: 7, actionType: '후속 행동(결과 이용)', prompt: '노인이 일러준 골목 구석 붉은 등불이 걸린 오크나무 문(비밀 지하 주점 입구) 앞으로 발걸음을 옮긴다.' },
  { turn: 8, actionType: '인과 후속 행동', prompt: '주점 입구를 막아서고 있는 거구의 문지기 사내와 문 옆의 열쇠 구멍, 그리고 주변 기류를 가만히 정찰한다.' },
  { turn: 9, actionType: '아이템 사용', prompt: '배낭 속 은화 주머니에서 은화 2닢을 꺼내어 문지기 남성에게 통행료로 건네며 주점 안으로 들어갈 수 있는지 요청한다.' },
  { turn: 10, actionType: '일반 의도', prompt: '지하 주점 안으로 들어서서 조용히 빈 오크나무 테이블에 자리를 잡고 수다스러운 모험가들의 소문과 대화를 경청한다.' }
];

async function runForensicTest() {
  console.log('=== Starting 10-Turn Candidate Preservation Forensic Test ===');
  console.log('Model: gemini-3.1-flash-lite');

  let currentTurn = 1;
  let stateVersion = 1;
  let lastCommittedEventId: string | null = null;
  let lastCommittedAt = new Date().toISOString();

  let worldInfo: any = {
    worldName: '아르카디아 영지',
    settingDescription: '중세 판타지 영지, 마법과 소문이 교차하는 위험한 국경 도시',
    toneStyle: '진중하고 세밀한 클래식 판타지 서사',
    chapters: {
      currentChapter: '서막: 기회와 소문',
      upcomingChapters: ['1장: 지하 주점의 계약', '2장: 비밀 통로의 열쇠']
    }
  };

  let character: any = {
    name: '에단',
    age: '24',
    gender: '남성',
    backgroundType: 'preset',
    originBackground: '방랑 모험가',
    flawType: 'preset',
    flaw: '지나친 호기심',
    oathType: 'preset',
    oath: '약자를 보호하고 진실을 탐구한다',
    anchorType: 'preset',
    anchor: '오래된 놋쇠 펜던트',
    factionType: 'preset',
    faction: '자유 모험가 길드',
    stats: { strength: 12, agility: 14, constitution: 12, intelligence: 15, wisdom: 11, charisma: 13 },
    inventory: []
  };

  const executedRequestIds: string[] = [];
  const recordedEventIds: string[] = [];
  const historicalRecords: EventRecord[] = [];
  const literalWindow: any[] = [];

  const turnTraces: any[] = [];

  for (const step of playerActions) {
    currentTurn = step.turn;
    console.log(`\n--- Running Turn ${currentTurn} (${step.actionType}): "${step.prompt}" ---`);

    const engineState = {
      stateVersion,
      turn: currentTurn,
      lastCommittedEventId,
      lastCommittedAt,
      executedRequestIds,
      recordedEventIds,
      historicalRecords
    };

    const requestBody = {
      selectedModel: 'gemini-3.1-flash-lite',
      effectiveUserPrompt: step.prompt,
      storyTurnCount: currentTurn,
      worldInfo,
      character,
      engineState,
      literalWindow
    };

    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      console.error(`Turn ${currentTurn} HTTP Error: ${res.status} ${res.statusText}`);
      const errText = await res.text();
      console.error('Error Body:', errText);
      break;
    }

    const resJson = await res.json();
    const forensic = resJson.forensicCapture || {};

    // Save Raw Turn Evidence immediately
    const turnRawFile = path.join(RAW_DIR, `turn_${String(currentTurn).padStart(2, '0')}_raw.json`);
    fs.writeFileSync(turnRawFile, JSON.stringify({
      turn: currentTurn,
      actionType: step.actionType,
      playerPrompt: step.prompt,
      apiResponse: resJson
    }, null, 2));

    // Extract Lifecycle counts
    const phase1 = forensic.phase1 || {};
    const recoveryGateResult = phase1.recoveryGateResult || {};
    const preAuth = forensic.preAuth || {};
    const authorizedProposal: StateTransitionProposal | null = resJson.authorizedProposal || null;

    const rawCandidatesBlock = phase1.rawCandidatesBlock;
    const llmCandidateCount = recoveryGateResult.totalInputCount ?? (rawCandidatesBlock ? (rawCandidatesBlock.match(/"candidateId"\s*:/g) || []).length : 0);
    const triageSurviving = rawCandidatesBlock ? 1 : 0;
    const recoverySurviving = recoveryGateResult.passedCount ?? 0;
    const recoveryQuarantined = recoveryGateResult.quarantinedCount ?? 0;
    const meaningTreeCount = (phase1.meaningTrees || []).length;
    const proposalCount = (phase1.meaningTrees || []).filter((m: any) => Boolean(m.proposal)).length;
    const preAuthTotal = preAuth.preAuthResults ? preAuth.preAuthResults.length : 0;
    const preAuthAllowed = preAuth.allowedCandidatesCount ?? 0;
    const preAuthRejected = preAuthTotal - preAuthAllowed;
    const engineInputCount = preAuthTotal;
    const engineAcceptCount = preAuthAllowed;
    const engineRejectCount = preAuthRejected;

    let commitSuccess = false;
    let committedActions: any[] = [];

    if (authorizedProposal) {
      const canonicalState: CanonicalState = {
        stateVersion,
        turn: currentTurn,
        worldInfo,
        character,
        lastCommittedEventId,
        lastCommittedAt
      };

      const engineInstance = SovereignEngine.create(canonicalState, executedRequestIds, recordedEventIds, historicalRecords);
      const commitRes = engineInstance.submitProposal(authorizedProposal);

      if (commitRes.success && commitRes.resultingState) {
        commitSuccess = true;
        stateVersion = commitRes.resultingState.stateVersion;
        lastCommittedEventId = commitRes.eventRecord.eventId;
        lastCommittedAt = commitRes.eventRecord.timestamp;
        executedRequestIds.push(authorizedProposal.requestId);
        recordedEventIds.push(commitRes.eventRecord.eventId);
        historicalRecords.push(commitRes.eventRecord);
        committedActions = authorizedProposal.actions;

        for (const act of authorizedProposal.actions) {
          if (act.type === 'MODIFY_INVENTORY') {
            const { operation, item } = act.payload;
            if (operation === 'ADD') {
              const existing = character.inventory.find((i: any) => i.name === item.name);
              if (existing) {
                existing.quantity += item.quantity;
              } else {
                character.inventory.push({ id: item.id || `inv-${Date.now()}`, name: item.name, quantity: item.quantity });
              }
            } else if (operation === 'REMOVE' || operation === 'CONSUME') {
              const existingIdx = character.inventory.findIndex((i: any) => i.name === item.name);
              if (existingIdx >= 0) {
                character.inventory[existingIdx].quantity -= item.quantity;
                if (character.inventory[existingIdx].quantity <= 0) {
                  character.inventory.splice(existingIdx, 1);
                }
              }
            }
          }
        }
      }
    }

    literalWindow.push({ sender: 'player', text: step.prompt });
    literalWindow.push({ sender: 'model', text: resJson.text || '' });

    const trace = {
      turn: currentTurn,
      actionType: step.actionType,
      prompt: step.prompt,
      llmCandidateCount,
      triageSurviving,
      recoverySurviving,
      recoveryQuarantined,
      meaningTreeCount,
      proposalCount,
      preAuthTotal,
      preAuthAllowed,
      preAuthRejected,
      engineInputCount,
      engineAcceptCount,
      engineRejectCount,
      commitSuccess,
      committedActions,
      inventoryAfterTurn: JSON.parse(JSON.stringify(character.inventory)),
      selectedCandidateId: resJson.selectedCandidateId,
      isFallbackNonMutation: resJson.isFallbackNonMutation
    };

    turnTraces.push(trace);

    console.log(`Turn ${currentTurn} Trace:`, {
      llmCandidates: llmCandidateCount,
      recoveryPassed: recoverySurviving,
      quarantined: recoveryQuarantined,
      meaningTrees: meaningTreeCount,
      preAuthAllowed,
      preAuthRejected,
      selectedId: resJson.selectedCandidateId,
      commitSuccess,
      inventory: character.inventory
    });
  }

  const summaryFile = path.join(RAW_DIR, 'summary_raw_evidence.json');
  fs.writeFileSync(summaryFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    model: 'gemini-3.1-flash-lite',
    totalTurns: currentTurn,
    traces: turnTraces,
    finalInventory: character.inventory,
    finalStateVersion: stateVersion,
    historicalRecordsCount: historicalRecords.length
  }, null, 2));

  console.log('\n=== Forensic Test Execution Complete ===');
  console.log(`Raw evidence saved in: ${RAW_DIR}`);
}

runForensicTest().catch(err => {
  console.error('Forensic Test Execution Failed:', err);
  process.exit(1);
});
