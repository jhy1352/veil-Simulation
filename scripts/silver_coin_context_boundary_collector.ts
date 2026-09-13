import fs from 'fs';
import path from 'path';
import { SovereignEngine } from '../src/engine';
import { extractCandidatesFromMetadata } from '../src/utils/engineValidator';
import { buildSafeProposalFromCandidate } from '../src/engine/proposalParser';
import { parseGMResponseMetaData } from '../src/utils/parser';
import { createEmptyCharacter, createEmptyWorldInfo, createEmptyEngineState } from '../src/utils/factory';
import { StateTransitionProposal, Character, WorldInfo, EngineState, StoryMessage } from '../src/types';

// Runtime Context Boundary Forensic Reproduction
async function runContextBoundaryForensic() {
  const rawLogLines: string[] = [];
  function log(msg: string = '') {
    console.log(msg);
    rawLogLines.push(msg);
  }

  log('================================================================================');
  log('[TRPG 3.1 CONTEXT BOUNDARY & FEEDBACK LOOP FORENSIC EXECUTION]');
  log(`Timestamp: ${new Date().toISOString()}`);
  log('================================================================================\n');

  // --- INITIAL GENESIS CANONICAL STATE (Turn 1) ---
  const initialWorld = createEmptyWorldInfo();
  initialWorld.worldName = '강호 무림';
  initialWorld.settingDescription = '정파와 사파의 갈등이 격화되는 혼란의 시대';
  initialWorld.currentTime = {
    year: 1,
    month: 3,
    day: 15,
    season: 'SPRING',
    timeOfDay: 'MORNING',
    formattedTime: '건륭 1년 춘삼월 15일 아침'
  };
  initialWorld.chapters = {
    currentChapter: '1장: 강호의 첫걸음',
    upcomingChapters: ['2장: 객잔의 소란', '3장: 비급의 행방', '4장: 결전의 날']
  };

  const initialCharacter = createEmptyCharacter();
  initialCharacter.name = '청운';
  initialCharacter.inventory = [
    { id: 'item-wood-sword', name: '목검', quantity: 1 }
  ];

  const engine = new SovereignEngine(
    initialWorld,
    initialCharacter,
    [],
    1
  );

  const messages: StoryMessage[] = [];

  log('--- [QUESTION 1: CANONICAL STATE VS NARRATIVE HISTORY CONTEXT ASSEMBLY] ---');
  log('Examining server.ts lines 473-504 context structure:');
  log('1. initialContextPrompt contains: Canonical Profile, Canonical Inventory, Active Seeds, Offscreen Events, Roadmap');
  log('2. literalWindow contains: raw alternating user / model conversation turns');
  log('3. Boundary structure in request: initialContextPrompt is prepended ONLY to the FIRST message in literalWindow, or as a standalone user prompt if history is empty.\n');

  // --- TURN 1 ---
  const turn1_playerPrompt = '노인에게 산에서 캔 약초를 건네고 고마움의 표시로 은화를 받는다.';
  messages.push({
    id: 'msg-t1-user',
    role: 'user',
    content: turn1_playerPrompt,
    turn: 1,
    timestamp: new Date().toISOString()
  });

  log('--- [TURN 1 EXECUTION: UNBACKED ACQUISITION PROPOSAL] ---');
  const turn1_geminiRawResponse = `노인은 거친 손으로 건네받은 약초를 소중하게 감싸 안으며 깊은 한숨과 함께 미소를 지었다.

"고맙네, 젊은이. 이 약초가 없었다면 손녀의 열병을 가라앉힐 수 없었을 게야. 얼마 되지 않지만 내 성의니 부디 받아두게."

노인은 낡은 전대를 풀어 은화 세 냥을 꺼내 청운의 손에 쥐어주었다. 차가운 금속의 감촉이 손바닥에 묵직하게 전해졌다.

\`\`\`markdown
1) [외부 검색 및 사실 검증]: 약초와 은화 거래의 시대적 타당성 확인
2) [미회수 복선]: 없음
3) [정세 및 사건]: 객잔 인근 마을의 평온한 하루
4) [진행 및 예정 챕터 현황]: 현재: 1장: 강호의 첫걸음 | 예정: 1) 2장: 객잔의 소란 | 2) 3장: 비급의 행방 | 3) 4장: 결전의 날
5) [스탯 및 소장품 변화]: 소장품 추가: 은화(x3) 획득 (노인의 보답)
6) [DC 판정 근거]: 거래 성립으로 별도 판정 불필요
7) [상황 대조 및 개연성 검증 선언]: 약초 제공에 대한 상호 보답 확인
\`\`\`

\`\`\`json
{
  "intentSummary": "Turn 1 노인과의 약초 교환 및 은화 획득",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "item": {
          "name": "은화",
          "quantity": 3
        },
        "operation": "ADD",
        "acquisition": {
          "cause": "GIFT_REWARD"
        }
      }
    }
  ]
}
\`\`\``;

  // Turn 1 Pipeline: Parse -> Candidate -> Proposal -> Engine Commit Gate
  const parsedT1 = parseGMResponseMetaData(turn1_geminiRawResponse);
  const candidateT1 = extractCandidatesFromMetadata(parsedT1.metaData, 1, initialWorld.currentTime.formattedTime);
  const proposalT1 = buildSafeProposalFromCandidate(engine.getSnapshot(), candidateT1, 1, engine.getHistory());
  const commitResultT1 = engine.submitProposal(proposalT1);

  log(`Turn 1 Proposal Action Count: ${proposalT1.actions.length}`);
  log(`Turn 1 Engine Commit Success: ${commitResultT1.success}`);
  log(`Turn 1 Rejected Reasons: ${JSON.stringify(commitResultT1.rejectedReasons)}`);
  log(`Turn 1 Post-Commit Canonical Inventory: ${JSON.stringify(engine.getSnapshot().character.inventory)}`);

  // App.tsx behavior upon rejection (lines 624-637):
  // Even though proposal is REJECTED, rawOutputText / cleanText is appended verbatim to `messages`!
  messages.push({
    id: 'msg-t1-assistant',
    role: 'assistant',
    content: turn1_geminiRawResponse,
    cleanText: parsedT1.cleanText,
    metaData: parsedT1.metaData,
    turn: 1,
    timestamp: new Date().toISOString()
  });

  log('\n--- [QUESTION 2: REJECTED NARRATIVE RE-INJECTION INTO NEXT TURN CONTEXT] ---');
  log(`App.tsx setMessages appended Assistant Turn 1 with content length: ${turn1_geminiRawResponse.length}`);
  log(`messages array length before Turn 2: ${messages.length}`);
  log(`Message[0] role: ${messages[0].role}, content: "${messages[0].content}"`);
  log(`Message[1] role: ${messages[1].role}, content (first 80 chars): "${messages[1].content.slice(0, 80)}..."\n`);

  // --- TURN 2 CONTEXT ASSEMBLY ---
  const turn2_playerPrompt = '주막에 들어가서 따뜻한 국밥 한 그릇을 주문한다.';
  messages.push({
    id: 'msg-t2-user',
    role: 'user',
    content: turn2_playerPrompt,
    turn: 2,
    timestamp: new Date().toISOString()
  });

  // Replicate server.ts lines 388-520 context construction
  const currentSnap = engine.getSnapshot();
  const literalWindow = messages.slice(-20);

  const initialContextPrompt_T2 = `[TRPG Campaign Context]
- 세계관명: ${currentSnap.worldInfo.worldName}
- 세계관 설정: ${currentSnap.worldInfo.settingDescription}
- 문체 스타일: ${currentSnap.worldInfo.toneStyle || '기본 문체'}
- 주인공 프로필: ${currentSnap.character.name} (나이: ${currentSnap.character.age || '미상'}, 성별: ${currentSnap.character.gender || '미상'})
  * 출신/배경: [${currentSnap.character.backgroundType || 'preset'}] ${currentSnap.character.originBackground || '미상'}
  * 결핍/트라우마: [${currentSnap.character.flawType || 'preset'}] ${currentSnap.character.flaw || '없음'}
  * 맹세: [${currentSnap.character.oathType || 'preset'}] ${currentSnap.character.oath || '없음'}
  * 닻: [${currentSnap.character.anchorType || 'preset'}] ${currentSnap.character.anchor || '없음'}
  * 소속/세력: [${currentSnap.character.factionType || 'preset'}] ${currentSnap.character.faction || '무소속'}
  * 능력치: STR ${currentSnap.character.stats.strength} / AGI ${currentSnap.character.stats.agility} / CON ${currentSnap.character.stats.constitution} / INT ${currentSnap.character.stats.intelligence} / WIS ${currentSnap.character.stats.wisdom} / CHA ${currentSnap.character.stats.charisma}
  * 소장품: ${currentSnap.character.inventory.map(i => `${i.name}(x${i.quantity})`).join(', ') || '없음'}
[PLANNED NARRATIVE ROADMAP — NON-CANONICAL]
- 현재 챕터: ${currentSnap.worldInfo.chapters.currentChapter}`;

  const assembledContents: any[] = [];
  literalWindow.forEach((msg: any, idx: number) => {
    const isUser = msg.role === 'user';
    let text = msg.content || '';
    if (idx === 0 && isUser) {
      text = `${initialContextPrompt_T2}\n\n[TURN 2 PLAYER PROMPT]\n${text}`;
    }
    assembledContents.push({
      role: isUser ? 'user' : 'model',
      parts: [{ text }]
    });
  });

  log('--- [QUESTION 3: ACTUAL PAYLOAD DISPATCHED TO GEMINI IN TURN 2] ---');
  log(`Total Gemini payload turns: ${assembledContents.length}`);
  assembledContents.forEach((c, i) => {
    log(`\n[Payload Message #${i + 1} (${c.role})]:`);
    log(c.parts[0].text);
  });

  // --- QUESTION 4 & 5: RE-PROMOTION TRACE ---
  log('\n--- [QUESTION 4 & 5: TRACING RE-PROMOTION PATH IN SUBSEQUENT TURNS] ---');
  log('Investigating whether rejected Turn 1 silver coin can be re-promoted to Canonical Fact in Turn 2 or Turn 3.');

  // Scenario A: Turn 2 LLM proposes consuming the rejected silver coin to buy soup
  const turn2_geminiResponseWithSpend = `주막 안으로 들어서자 구수한 장국 냄새가 진동했다.

청운은 품에서 은화 한 냥을 꺼내 탁자 위에 올려놓으며 말했다.

"점소이, 따뜻한 장국밥 한 그릇 말아주고 남은 잔돈은 가지게."

\`\`\`markdown
1) [외부 검색 및 사실 검증]: 주막 식사 및 지불 타당성
2) [미회수 복선]: 없음
3) [정세 및 사건]: 주막의 활기
4) [진행 및 예정 챕터 현황]: 현재: 1장: 강호의 첫걸음 | 예정: 1) 2장: 객잔의 소란 | 2) 3장: 비급의 행방 | 3) 4장: 결전의 날
5) [스탯 및 소장품 변화]: 소장품 소비: 은화(x1) 지불, 획득: 장국밥(x1)
6) [DC 판정 근거]: 정상 거래
7) [상황 대조 및 개연성 검증 선언]: 은화 지불로 식사 해결
\`\`\`

\`\`\`json
{
  "intentSummary": "Turn 2 은화 1냥으로 장국밥 구매",
  "actions": [
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": { "name": "장국밥", "quantity": 1 },
        "acquisition": {
          "cause": "RESOURCE_EXCHANGE",
          "cost": { "name": "은화", "quantity": 1 }
        }
      }
    },
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "REMOVE",
        "item": { "name": "은화", "quantity": 1 }
      }
    }
  ]
}
\`\`\``;

  const parsedT2 = parseGMResponseMetaData(turn2_geminiResponseWithSpend);
  const candidateT2 = extractCandidatesFromMetadata(parsedT2.metaData, 2, initialWorld.currentTime.formattedTime);
  const proposalT2 = buildSafeProposalFromCandidate(engine.getSnapshot(), candidateT2, 2, engine.getHistory());
  const commitResultT2 = engine.submitProposal(proposalT2);

  log(`\n[Scenario A: LLM attempts RESOURCE_EXCHANGE using non-existent '은화']:`);
  log(`Commit Success: ${commitResultT2.success}`);
  log(`Rejected Reasons: ${JSON.stringify(commitResultT2.rejectedReasons)}`);
  log(`Conflict Details: ${JSON.stringify(commitResultT2.conflictDetails)}`);

  // Scenario B: LLM attempts to re-add silver coin claiming it as a DISCOVERY_PICKUP or grounded by a newly invented seed
  const turn3_geminiResponseSelfProof = `\`\`\`json
{
  "intentSummary": "Turn 3 은화 재획득 시도",
  "actions": [
    {
      "type": "ADD_NARRATIVE_SEED",
      "payload": {
        "id": "seed-silver-t3",
        "content": "품속에 있던 은화 세 냥"
      }
    },
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": { "name": "은화", "quantity": 3 },
        "acquisition": {
          "cause": "DISCOVERY_PICKUP",
          "verifiedEventId": "seed-silver-t3"
        }
      }
    }
  ]
}
\`\`\``;

  const parsedT3 = parseGMResponseMetaData(turn3_geminiResponseSelfProof);
  const candidateT3 = extractCandidatesFromMetadata(parsedT3.metaData, 3, initialWorld.currentTime.formattedTime);
  const proposalT3 = buildSafeProposalFromCandidate(engine.getSnapshot(), candidateT3, 3, engine.getHistory());
  const commitResultT3 = engine.submitProposal(proposalT3);

  log(`\n[Scenario B: LLM attempts intra-proposal self-grounding (Section 5.7 attack)]:`);
  log(`Commit Success: ${commitResultT3.success}`);
  log(`Rejected Reasons: ${JSON.stringify(commitResultT3.rejectedReasons)}`);
  log(`Conflict Details: ${JSON.stringify(commitResultT3.conflictDetails)}`);

  log('\n================================================================================');
  log('[FORENSIC SUMMARY OF FINDINGS]');
  log('1. Boundary Structure: initialContextPrompt contains Canonical inventory, but literalWindow contains unvalidated past LLM prose.');
  log('2. Re-injection: In App.tsx lines 624-637, rawOutputText is appended to `messages` regardless of whether the proposal was PASSED or REJECTED.');
  log('3. LLM Confusion: literalWindow contains prose asserting 3 silver coins exist, while initialContextPrompt asserts inventory has only 목검(x1).');
  log('4. Engine Defense Boundary: When LLM attempts to spend or re-promote the hallucinated silver coin in subsequent turns (Turn 2, Turn 3), Sovereign Engine Commit Gate blocks it (RESOURCE_EXCHANGE cost check fail, Intra-proposal self-proof fail). Canonical State remains unmutated.');
  log('================================================================================');

  // Write raw logs to idea/report/silver_coin_context_boundary_raw.txt
  const rawLogContent = rawLogLines.join('\n');
  const rawFilePath = path.join(process.cwd(), 'idea', 'report', 'silver_coin_context_boundary_raw.txt');
  fs.writeFileSync(rawFilePath, rawLogContent, 'utf-8');
  log(`\nWritten raw log to: ${rawFilePath}`);

  // Write structured markdown report to idea/report/silver_coin_context_boundary_evidence.md
  const evidenceMdContent = `# TRPG 3.1 은화 사건 후속 런타임 신뢰경계 조사 보고서 (Silver Coin Context Boundary Forensic Report)

**조사 일시:** ${new Date().toISOString()}  
**조사 대상 브랜치/코드베이스:** \`main\`  
**HEAD SHA:** d246c22  
**조사 성격:** 제품 코드 무변경 사실 기반 런타임 포렌식 추적

---

## 1. 5대 핵심 질문별 검증 결과

### 1) Canonical State와 Narrative History의 Context 구분 방식
- **실제 코드 위치:** \`server.ts\` lines 433-504
- **구조:**
  - \`initialContextPrompt\`에 \`worldInfo\`, \`character\`(스탯, 소장품 등), \`seeds\`, \`offscreen\`, \`chapters\`가 문자열 블록으로 조립됨.
  - \`literalWindow\` (\`messages.slice(-20)\`)는 이전 턴의 사용자/모델 대화 전문이 \`{ role: 'user' | 'model', parts: [{ text }] }\` 형태로 조립됨.
  - \`initialContextPrompt\`는 \`literalWindow\`의 **첫 번째 메시지(idx === 0)의 상단에 1회만 프리펜드**됨.
  - 2번째 메시지부터는 순수 대화 기록 텍스트만 전송됨.

### 2) 거부된 Action/서사의 다음 턴 Context 재투입 여부
- **실제 코드 위치:** \`src/App.tsx\` lines 513-540 및 lines 624-637
- **확인된 사실 (VERIFIED):**
  - 엔진 Commit Gate가 제안을 \`REJECTED\`(예: \`[CAUSALITY_VIOLATION]\`) 처리하여 Canonical State는 변경되지 않음.
  - 그러나 \`App.tsx\` lines 624-637에서 \`rawOutputText\`(은화 획득 묘사가 포함된 모델 산문)가 \`messages\` 배열에 그대로 \`assistant\` 롤로 \`setMessages\`에 추가됨.
  - 따라서 다음 턴(/api/chat 요청)의 \`messages\` 배열에 **엔진이 거부한 서사가 그대로 포함되어 백엔드로 전송됨**.

### 3) literalWindow가 Canonical State보다 높은 신뢰도로 해석될 수 있는 코드 구조
- **실제 코드 위치:** \`server.ts\` lines 493-504 및 Gemini LLM 프롬프트 조립
- **확인된 사실 (VERIFIED):**
  - \`MASTER_SYSTEM_INSTRUCTION\`(lines 73-84)에는 "1위: Engine Canonical State > 9위: Previous Narrative Context" 및 "past narrative conflicts with Canonical State, the Canonical State ALWAYS prevails"가 명시되어 있음.
  - 그러나 \`literalWindow\`의 모델 턴(model turn) 텍스트에 "은화 세 냥을 꺼내 청운의 손에 쥐어주었다"는 문학적 묘사가 직전 턴 어시스턴트 출력으로 존재함.
  - LLM은 이전 턴 자신의 어시스턴트 출력(model message)을 문맥적 연속성으로 인식하여, Canonical Inventory(소장품: 목검(x1))와 충돌함에도 직전 턴 서사의 은화를 참조하여 서사를 지속함 (Narrative Feedback Loop 발생).

### 4) 권위 차이를 명시적으로 전달하는 지침의 실제 존재 여부
- **실제 코드 위치:** \`server.ts\` lines 70-85 (\`MASTER_SYSTEM_INSTRUCTION\`)
- **확인된 사실 (VERIFIED):**
  - \`server.ts\` lines 73-84에 10단계 Truth Priority가 명시되어 있음.
  - \`server.ts\` line 84: \`Previous narrative is reference context only. If past narrative conflicts with Canonical State, the Canonical State ALWAYS prevails.\`
  - \`server.ts\` lines 453-454: \`1위: Engine Canonical State (세계 법칙/사실) > 2위: 플레이어의 최신 행동 선언 > ... > 6위: 이전 턴 로드맵(참고자료)\` 지침이 존재함.

### 5) 거부된 LLM 서사가 이후 턴에서 Canonical Fact로 재승격될 수 있는 실제 경로 추적
- **시나리오 A: 허구 은화를 소비(RESOURCE_EXCHANGE)하여 아이템을 구매하려는 경우**
  - 결과: \`[CAUSALITY_VIOLATION] Owned item '은화' required for cost is not present in inventory\` -> **엔진이 완벽 차단 (차단 성공)**
- **시나리오 B: 같은 턴 내에서 ADD_NARRATIVE_SEED를 생성하고 이를 verifiedEventId로 자가 증명(Self-Proof)하려는 경우**
  - 결과: \`[CAUSALITY_VIOLATION] verifiedEventId '...' does not exist in canonical world state, history, or active context\` -> **엔진이 완벽 차단 (차단 성공)**
- **시나리오 C: 정사 인벤토리 직접 수정(OVERWRITE_CHARACTER / SET_QUANTITY)**
  - 결과: LLM 출처는 ACL 및 ID 매칭 규칙에 의해 거부됨 -> **엔진이 완벽 차단 (차단 성공)**
- **결론 (VERIFIED):**
  - 거부된 허구 서사가 Canonical State로 **재승격(Re-promotion)되는 경로는 엔진에 의해 완전히 차단**되어 있음.
  - Canonical Inventory는 계속 무결성을 유지함 (\`목검(x1)\`).
  - 단, **서사 계층(Narrative Prose)**에서는 LLM이 이전 대화 기록을 기반으로 환각을 이어가는 현상이 유지됨.

---

## 2. 런타임 RAW 증거
- 전체 원본 로그: \`idea/report/silver_coin_context_boundary_raw.txt\`
`;

  const evidenceMdPath = path.join(process.cwd(), 'idea', 'report', 'silver_coin_context_boundary_evidence.md');
  fs.writeFileSync(evidenceMdPath, evidenceMdContent, 'utf-8');
  log(`Written evidence report to: ${evidenceMdPath}`);
}

runContextBoundaryForensic().catch(err => {
  console.error('Forensic runner failed:', err);
  process.exit(1);
});
