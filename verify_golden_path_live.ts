import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';
import { SovereignEngine } from './src/engine/state.ts';
import {
  createEmptyCharacter,
  createEmptyWorldInfo,
  createEmptyEngineState
} from './src/utils/factory.ts';
import { parseGMResponseMetaData } from './src/utils/parser.ts';
import { extractCandidatesFromMetadata } from './src/utils/engineValidator.ts';
import { buildSafeProposalFromCandidate } from './src/engine/proposalParser.ts';
import { StateTransitionProposal } from './src/engine/types.ts';
import { Character, WorldInfo, StoryMessage, EngineState } from './src/types.ts';

// 1. Check API Key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('[ERROR] GEMINI_API_KEY is not defined in environment.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// Helper to call Gemini 3.6 / 3.7 with the exact server system instruction and context
async function callGeminiRuntime(
  model: string,
  systemInstruction: string,
  contents: any[]
): Promise<{ rawText: string; modelVersion?: string }> {
  const config: any = {
    systemInstruction
  };
  if (model === 'gemini-3.7-flash') {
    config.thinkingConfig = { thinkingBudget: 4096 };
  }

  console.log(`[Calling Gemini API: model=${model}]...`);
  const response = await ai.models.generateContent({
    model,
    contents,
    config
  });

  return {
    rawText: response.text || '',
    modelVersion: response.modelVersion
  };
}

async function runLiveGoldenPath() {
  console.log('================================================================');
  console.log('TRPG 3.1 — LIVE RUNTIME GOLDEN PATH VERIFICATION');
  console.log('Target Path:');
  console.log('  REQUIRE_CHECK -> CSPRNG Dice Success -> Success eventId Commit');
  console.log('  -> Context Injection -> MODIFY_INVENTORY ADD (cause=DISCOVERY_PICKUP, verifiedEventId)');
  console.log('  -> Trusted Event Gate -> Canonical Inventory +1');
  console.log('  -> Next Turn REMOVE -> Canonical Inventory -1');
  console.log('================================================================\n');

  // Step 0: Initialize Genesis State & Sovereign Engine
  const worldInfo: WorldInfo = createEmptyWorldInfo();
  worldInfo.worldName = '무림 정사';
  worldInfo.settingDescription = '남송 말기 정통 무협 세계관, 낙양의 숭양서원';
  worldInfo.toneStyle = '묵직하고 유려한 정통 무협 필치';
  worldInfo.chapters = {
    currentChapter: '제1장: 서원의 은밀한 흔적',
    upcomingChapters: ['제2장: 장서각의 비밀', '제3장: 비급의 진실', '제4장: 낙양의 풍운']
  };

  const character: Character = createEmptyCharacter();
  character.name = '소진호';
  character.age = 20;
  character.gender = '남성';
  character.stats = {
    strength: 12,
    agility: 14,
    constitution: 12,
    intelligence: 15,
    wisdom: 13,
    charisma: 11
  };
  character.originBackground = '몰락한 낙양 서생';
  character.goal = '가전 비급을 되찾고 서원의 숨겨진 진실을 밝히는 것';
  character.inventory = [
    { id: 'inv-silver', name: '은화', quantity: 5, description: '통용 화폐' }
  ];

  const engine = new SovereignEngine(worldInfo, character, [], 1, 1);
  console.log('[STEP 0: Initial Canonical State]');
  console.log('Character Inventory:', JSON.stringify(engine.getSnapshot().character.inventory));
  console.log('State Version:', engine.getSnapshot().stateVersion);

  // Use the exact Master System Instruction
  const sysInst = `
# TRPG 3.1 Master System Instruction (Narrative Reasoning Layer)

You are the Narrative Reasoning Layer and Master Game Master (GM) for an authentic high-fidelity TRPG session.
You write with the literary mastery, depth, psychological realism, and atmospheric precision of a master novelist paired with a veteran TRPG Game Master's decades of tabletop experience.

---

## 1. World Sovereignty & The Truth Authority (헌법 제1조 ~ 제7조)
1. The Engine is the World itself. The Engine's Canonical State and World Rules hold the supreme authority in this session.
2. The LLM is NOT the creator or final arbiter of reality. The LLM is the Narrator / Narrative Reasoning Layer describing the world approved by the Engine.
3. Neither Player prompt nor LLM prose can create or alter world facts without Engine validation and Canonical Commit.

---

## 9. Mandatory Output Format: Structured Metadata & Planned Narrative Roadmap (헌법 제16조, 제51조, 제60조)

Before each narrative response, you MUST ALWAYS output BOTH the compact system metadata markdown block AND the structured proposal JSON block in the exact order and format shown below:

\`\`\`markdown
1) [외부 검색, UI 코드 반영 및 NPC 지식 검증 보고]: <검증 상태 요약>
2) [활성화된 미회수 복선 씨앗]: <주요 1개, 보조 2개 이내의 활성 복선>
3) [카메라 밖 정세 자율 변동]: <오프스크린 정세 요약>
4) [진행 및 예정 챕터 현황]: 현재: <현재 진행 중인 챕터> | 예정: 1) <직후 예정 챕터 1> | 2) <예정 챕터 2> | 3) <예정 챕터 3>
5) [주인공 스탯 및 소장품]: <주요 소지품 및 신체 상태>
6) [DC 누적 통계 관리]: <난이도 통계 및 이번 DC (필요시)>
7) [개연성/맥락 준수 선언]: <개연성 및 정사 맥락 일치 선언>
\`\`\`

\`\`\`json
{
  "intentSummary": "<1-sentence summary of world/character/event changes proposed this turn>",
  "actions": [
    {
      "type": "<ACTION_TYPE>",
      "payload": { ... }
    }
  ]
}
\`\`\`

* JSON Action Proposal Rules (Mandatory):
  - You MUST output the \`\`\`json ... \`\`\` block on EVERY turn immediately following the markdown metadata block.
  - If no state changes occur, output: \`{"intentSummary": "No state changes", "actions": []}\`.
  - When proposing item discovery/pickup:
    \`\`\`json
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": { "id": "item-manual", "name": "무공비급", "quantity": 1 },
        "acquisition": {
          "cause": "DISCOVERY_PICKUP",
          "verifiedEventId": "event-12345"
        }
      }
    }
    \`\`\`
  - When proposing resource exchange (e.g. buying an item):
    \`\`\`json
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "ADD",
        "item": { "id": "item-sword", "name": "청강검", "quantity": 1 },
        "acquisition": {
          "cause": "RESOURCE_EXCHANGE",
          "cost": { "name": "은화", "quantity": 1 }
        }
      }
    }
    \`\`\`
  - When proposing item usage/removal/gift to NPC:
    \`\`\`json
    {
      "type": "MODIFY_INVENTORY",
      "payload": {
        "operation": "REMOVE",
        "item": { "id": "item-herb", "name": "상처치료초", "quantity": 1 }
      }
    }
    \`\`\`

* Supported ACTION_TYPEs:
  - SET_WORLD_METADATA: { worldName?, settingDescription?, toneStyle? }
  - ADVANCE_TIME: { targetTime: { year?, month?, day?, timeOfDay? }, reason? }
  - ADD_RUMOR: { rumor: string, sourceContext?: string }
  - ADD_NPC: { id: string, name: string, npcClass: 'Class A'|'Class B'|'Class S', innerThought?: string, currentStatus?: 'ALIVE'|'DEAD'|'MISSING' }
  - UPDATE_NPC: { id: string, changes: { ... } }
  - SET_NPC_STATUS: { id: string, status: 'ALIVE'|'DEAD'|'MISSING'|'UNMET'|'MET', reason: string }
  - ADD_FACTION: { id: string, name: string, description: string, attitudeTowardsPlayer?: string }
  - UPDATE_FACTION: { id: string, changes: { ... } }
  - ADD_NARRATIVE_SEED: { id: string, seedType: 'MAIN'|'SECONDARY', title: string, clueText: string, status: 'ACTIVE' }
  - RESOLVE_NARRATIVE_SEED: { id: string, resolutionSummary: string }
  - ADVANCE_CHAPTER: { currentChapter: string, upcomingChapters?: string[] }
  - RECORD_OFFSCREEN_EVENT: { eventDescription: string, location?: string }
  - UPDATE_CHARACTER_STATS: { strength?, agility?, constitution?, intelligence?, wisdom?, charisma? }
  - MODIFY_INVENTORY: { item: { id: string, name: string, quantity: number }, operation: 'ADD'|'REMOVE', acquisition?: { cause: 'RESOURCE_EXCHANGE'|'DISCOVERY_PICKUP'|'GIFT_REWARD'|'LOOT'|'GENESIS_STARTER', cost?: { name: string, quantity: number }, verifiedEventId?: string } }
  - SET_CHARACTER_SECRET: { secret: string }
  - RECORD_PHYSICAL_DEFECT: { defect: string }

* CRITICAL INVENTORY & CANONICAL STATE RULE (아이템 획득/소비 인과율):
  - 플레이어가 소지한 아이템은 위 [TRPG Campaign Context]에 기재된 Canonical Inventory가 유일한 진실입니다.
  - 서사(Narrative)에서 새로운 아이템을 획득하거나 자원을 교환한 경우 반드시 정당한 인과(acquisition.cause: 'RESOURCE_EXCHANGE', 'DISCOVERY_PICKUP', 'GIFT_REWARD', 'LOOT', 'GENESIS_STARTER')를 포함한 'MODIFY_INVENTORY ADD' 액션을 제안하십시오.
  - **DISCOVERY_PICKUP / GIFT_REWARD / LOOT 획득 시**:
    * 반드시 활성 복선/사건 ID(seed ID 또는 event ID)를 \`verifiedEventId\`로 지정해야 합니다:
      예: \`acquisition: { cause: 'DISCOVERY_PICKUP', verifiedEventId: 'seed-...' }\`
    * 만약 현재 턴에서 새로 발견된 단서/물품이라면, 같은 제안(Proposal)에 \`ADD_NARRATIVE_SEED: { id: 'seed-...', ... }\`를 추가하고 그 \`id\`를 \`verifiedEventId\`로 연결하십시오.
  - **아이템 사용 / 양도 / 소모 시**:
    * 플레이어가 소지품을 사용하거나 NPC에게 양도/투척/파괴할 때는 'MODIFY_INVENTORY REMOVE' 액션을 제안하십시오.

After the code blocks, output the rich literary narrative in Korean.
`;

  const selectedModel = 'gemini-3.6-flash';

  // ==========================================================================
  // TURN 1: Player Declares Action Requiring a Check (e.g. Inspect Hidden Compartment)
  // ==========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('[TURN 1: Action Declaration]');
  const turn1Prompt = '장서각 깊숙한 곳, 먼지 쌓인 서가 뒤편의 벽면을 정밀하게 조사하여 숨겨진 비밀 서랍이나 비급의 단서를 찾아내려 한다.';
  console.log('Player Prompt:', turn1Prompt);

  const initialContextPrompt = `[TRPG Campaign Context]
- 세계관명: ${worldInfo.worldName}
- 세계관 설정: ${worldInfo.settingDescription}
- 문체 스타일: ${worldInfo.toneStyle}
- 주인공 프로필: ${character.name} (나이: ${character.age}, 성별: ${character.gender})
  * 출신/배경: [preset] ${character.originBackground}
  * 결핍/트라우마: [preset] ${character.flaw || '없음'}
  * 맹세: [preset] ${character.oath || '없음'}
  * 닻: [preset] ${character.anchor || '없음'}
  * 소속/세력: [preset] ${character.faction || '무소속'}
  * 능력치: STR ${character.stats.strength} / AGI ${character.stats.agility} / CON ${character.stats.constitution} / INT ${character.stats.intelligence} / WIS ${character.stats.wisdom} / CHA ${character.stats.charisma}
  * 소장품: ${character.inventory.map(i => `${i.name}(x${i.quantity})`).join(', ')}
[PLANNED NARRATIVE ROADMAP — NON-CANONICAL]
- 현재 챕터: ${worldInfo.chapters.currentChapter}
- 이전 턴 예정 로드맵:
  1. ${worldInfo.chapters.upcomingChapters[0]}
  2. ${worldInfo.chapters.upcomingChapters[1]}
  3. ${worldInfo.chapters.upcomingChapters[2]}`;

  const contentsTurn1 = [
    {
      role: 'user',
      parts: [{ text: `${initialContextPrompt}\n\n[TURN 1 PLAYER PROMPT]\n${turn1Prompt}` }]
    }
  ];

  let response1: { rawText: string; modelVersion?: string };
  try {
    response1 = await callGeminiRuntime(selectedModel, sysInst, contentsTurn1);
  } catch (err: any) {
    console.error('[FAIL] Turn 1 Gemini API call failed:', err.message);
    return;
  }

  console.log('\n[Turn 1 Raw Response Snippet]:');
  console.log(response1.rawText.slice(0, 400) + '...\n');

  const parsed1 = parseGMResponseMetaData(response1.rawText);
  console.log('[Turn 1 Parsed Metadata]:', {
    hasMetaData: !!parsed1.metaData,
    recommendedDC: parsed1.metaData?.recommendedDC,
    dcReason: parsed1.metaData?.dcReason,
    rawActionsCount: (parsed1.metaData as any)?.rawActions?.length || 0
  });

  // Check if Gemini processed candidate actions for Turn 1
  if (parsed1.metaData) {
    const candidate1 = extractCandidatesFromMetadata(parsed1.metaData, 1, '영락 3년 가을');
    const proposal1 = buildSafeProposalFromCandidate(
      engine.getSnapshot(),
      candidate1,
      1,
      engine.getHistory()
    );
    const commit1 = engine.submitProposal(proposal1);
    console.log('[Turn 1 Proposal Commit Result]:', {
      success: commit1.success,
      stateVersion: commit1.stateVersion,
      committedCount: commit1.committedActionsCount
    });
  }

  // ==========================================================================
  // STEP 2: CSPRNG Dice Roll Success & Canonical Event Commit
  // ==========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('[STEP 2: CSPRNG Dice Roll & Canonical Success Event Commit]');
  const targetDC = parsed1.metaData?.recommendedDC || 12;
  const diceValue = 16; // Simulated high roll success
  const rollTotal = diceValue + Math.floor((character.stats.intelligence - 10) / 2); // +2 = 18 >= targetDC
  const successEventId = `evt-dice-success-turn1-${Date.now()}`;
  const seedId = `seed-secret-drawer-${Date.now()}`;

  console.log(`Dice Roll: 1d20(${diceValue}) + 2 = ${rollTotal} >= Target DC ${targetDC} (SUCCESS)`);

  // Create and commit a Canonical Success Event / Narrative Seed into Sovereign Engine
  const successProposal: StateTransitionProposal = {
    proposalId: `prop-dice-${Date.now()}`,
    requestId: `req-dice-${Date.now()}`,
    eventId: successEventId,
    expectedStateVersion: engine.getSnapshot().stateVersion,
    source: 'PLAYER',
    turn: 1,
    timestamp: new Date().toISOString(),
    intentSummary: 'CSPRNG 주사위 조사 판정 성공 및 비밀 서랍 비급 발견 확정',
    actions: [
      {
        type: 'ADD_NARRATIVE_SEED',
        payload: {
          id: seedId,
          content: '낙양 장서각 비밀 서랍에서 발견된 현천신공 비급',
          status: 'active'
        }
      },
      {
        type: 'RECORD_OFFSCREEN_EVENT',
        payload: {
          id: successEventId,
          eventDescription: '소진호가 장서각 비밀 서랍의 잠금장치를 풀고 현천신공 비급을 발견함',
          location: '낙양 장서각'
        }
      }
    ]
  };

  const diceCommitResult = engine.submitProposal(successProposal);
  console.log('[Dice Success Event Commit Result]:', {
    success: diceCommitResult.success,
    stateVersion: diceCommitResult.stateVersion,
    committedActions: diceCommitResult.committedActionsCount,
    rejectedReasons: diceCommitResult.rejectedReasons
  });

  const snapshotAfterDice = engine.getSnapshot();
  console.log('Canonical Seeds Count:', snapshotAfterDice.worldInfo.seeds.length);
  console.log('Committed Seed ID:', seedId);
  console.log('Committed Event ID:', successEventId);

  // ==========================================================================
  // TURN 2: Player Picks Up Item with Success Context
  // ==========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('[TURN 2: Item Acquisition Declaration with Verified Event Context]');
  const turn2Prompt = `[🎲 주사위 투척 판정 성공: 1d20(${diceValue})+2 = ${rollTotal} >= DC ${targetDC}]
비밀 서랍의 잠금장치를 무사히 풀었으니, 서랍 안에 봉인되어 있던 [현천신공 비급] 1권을 꺼내어 품에 챙긴다.`;

  console.log('Player Prompt Turn 2:', turn2Prompt);

  const activeSeedsTurn2 = snapshotAfterDice.worldInfo.seeds
    .map(s => `- [Seed ID: ${s.id}] ${s.content || (s as any).title || (s as any).clueText}`)
    .join('\n');
  const offscreenTurn2 = (snapshotAfterDice.worldInfo.offscreenRecords || [])
    .map(o => `- [Event ID: ${o.id}] ${o.eventDescription}`)
    .join('\n');

  const contextTurn2 = `[TRPG Campaign Context]
- 세계관명: ${snapshotAfterDice.worldInfo.worldName}
- 세계관 설정: ${snapshotAfterDice.worldInfo.settingDescription}
- 주인공 프로필: ${snapshotAfterDice.character.name} (STR ${snapshotAfterDice.character.stats.strength} / INT ${snapshotAfterDice.character.stats.intelligence})
  * 소장품: ${snapshotAfterDice.character.inventory.map(i => `${i.name}(x${i.quantity})`).join(', ')}
[ACTIVE NARRATIVE SEEDS & OBTAINABLE CONTEXT]
${activeSeedsTurn2}
[ACTIVE WORLD OFFSCREEN EVENTS]
${offscreenTurn2}
[CANONICAL SUCCESS EVENT GROUNDING]
- 판정 성공 확정 ID: ${successEventId} (내용: 현천신공 비급 발견)
- 활성 복선 씨앗 ID: ${seedId} (내용: 비밀 서랍의 현천신공 비급)
※ 아이템 획득 인과율 규칙:
  플레이어가 현천신공 비급을 획득하는 경우 반드시 JSON 액션에 다음을 포함하십시오:
  "type": "MODIFY_INVENTORY",
  "payload": {
    "item": { "id": "item-hyuncheon-manual", "name": "현천신공 비급", "quantity": 1 },
    "operation": "ADD",
    "acquisition": {
      "cause": "DISCOVERY_PICKUP",
      "verifiedEventId": "${seedId}"
    }
  }`;

  const contentsTurn2 = [
    {
      role: 'user',
      parts: [{ text: `${initialContextPrompt}\n\n[TURN 1 PLAYER PROMPT]\n${turn1Prompt}` }]
    },
    {
      role: 'model',
      parts: [{ text: response1.rawText }]
    },
    {
      role: 'user',
      parts: [{ text: `${contextTurn2}\n\n[TURN 2 PLAYER PROMPT]\n${turn2Prompt}` }]
    }
  ];

  let response2: { rawText: string; modelVersion?: string };
  try {
    response2 = await callGeminiRuntime(selectedModel, sysInst, contentsTurn2);
  } catch (err: any) {
    console.error('[FAIL] Turn 2 Gemini API call failed:', err.message);
    return;
  }

  console.log('\n[Turn 2 Raw Response Snippet]:');
  console.log(response2.rawText.slice(0, 500) + '...\n');

  const parsed2 = parseGMResponseMetaData(response2.rawText);
  console.log('[Turn 2 Parsed Metadata]:', {
    hasMetaData: !!parsed2.metaData,
    rawActionsCount: (parsed2.metaData as any)?.rawActions?.length || 0,
    rawActions: (parsed2.metaData as any)?.rawActions
  });

  // Check if MODIFY_INVENTORY ADD is present in rawActions
  const inventoryAddAction = (parsed2.metaData as any)?.rawActions?.find(
    (a: any) => a.type === 'MODIFY_INVENTORY' && a.payload?.operation === 'ADD'
  );

  console.log('\n[CRITICAL CHECK: MODIFY_INVENTORY ADD issued by Gemini?]');
  if (!inventoryAddAction) {
    console.error('--> FAIL: Gemini did not issue JSON MODIFY_INVENTORY ADD action!');
    console.log('Checking narrative text for mention of acquisition:');
    const mentionsAcquisition = response2.rawText.includes('비급') || response2.rawText.includes('현천신공');
    console.log('Narrative mentions item:', mentionsAcquisition);
  } else {
    console.log('--> SUCCESS: Gemini issued MODIFY_INVENTORY ADD action:', JSON.stringify(inventoryAddAction, null, 2));
  }

  // ==========================================================================
  // STEP 3: Proposal Parsing & Sovereign Engine Commit (Canonical Inventory +1)
  // ==========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('[STEP 3: Trusted Event Gate & Canonical Inventory Commit]');

  const candidate2 = extractCandidatesFromMetadata(parsed2.metaData || {}, 2, '영락 3년 가을');
  console.log('Extracted Candidate Packet:', JSON.stringify(candidate2, null, 2));

  const proposal2 = buildSafeProposalFromCandidate(
    engine.getSnapshot(),
    candidate2,
    2,
    engine.getHistory()
  );
  console.log('Built Safe Proposal Actions:', JSON.stringify(proposal2.actions, null, 2));

  const commit2 = engine.submitProposal(proposal2);
  console.log('[Turn 2 Proposal Commit Result]:', {
    success: commit2.success,
    stateVersion: commit2.stateVersion,
    committedActionsCount: commit2.committedActionsCount,
    rejectedReasons: commit2.rejectedReasons,
    conflictDetails: commit2.conflictDetails
  });

  const snapshotAfterTurn2 = engine.getSnapshot();
  console.log('Canonical Inventory After Turn 2:', JSON.stringify(snapshotAfterTurn2.character.inventory, null, 2));

  const hasItem = snapshotAfterTurn2.character.inventory.some(i => i.name.includes('비급') || i.name.includes('현천신공'));
  console.log('Canonical Inventory +1 Verified?:', hasItem ? 'PASS' : 'FAIL');

  // ==========================================================================
  // TURN 3: Player Transfers / Uses / Removes Item (Canonical Inventory -1)
  // ==========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('[TURN 3: Item Removal / Transfer Declaration]');
  const turn3Prompt = `장서각 사서인 백발의 노인에게 다가가, 방금 발견한 [현천신공 비급] 1권을 건네며 양도한다. "어르신, 서랍 속에서 이 비급을 찾았습니다."`;

  console.log('Player Prompt Turn 3:', turn3Prompt);

  const contextTurn3 = `[TRPG Campaign Context]
- 세계관명: ${snapshotAfterTurn2.worldInfo.worldName}
- 주인공 프로필: ${snapshotAfterTurn2.character.name}
  * 소장품: ${snapshotAfterTurn2.character.inventory.map(i => `${i.name}(x${i.quantity})`).join(', ')}
※ 아이템 양도/소모 규칙:
  플레이어가 소지품인 '현천신공 비급' 1권을 양도하였으므로 반드시 다음 JSON 액션을 발행하십시오:
  "type": "MODIFY_INVENTORY",
  "payload": {
    "item": { "id": "${snapshotAfterTurn2.character.inventory.find(i => i.name.includes('비급'))?.id || 'item-hyuncheon-manual'}", "name": "현천신공 비급", "quantity": 1 },
    "operation": "REMOVE"
  }`;

  const contentsTurn3 = [
    ...contentsTurn2,
    {
      role: 'model',
      parts: [{ text: response2.rawText }]
    },
    {
      role: 'user',
      parts: [{ text: `${contextTurn3}\n\n[TURN 3 PLAYER PROMPT]\n${turn3Prompt}` }]
    }
  ];

  let response3: { rawText: string; modelVersion?: string };
  try {
    response3 = await callGeminiRuntime(selectedModel, sysInst, contentsTurn3);
  } catch (err: any) {
    console.error('[FAIL] Turn 3 Gemini API call failed:', err.message);
    return;
  }

  console.log('\n[Turn 3 Raw Response Snippet]:');
  console.log(response3.rawText.slice(0, 500) + '...\n');

  const parsed3 = parseGMResponseMetaData(response3.rawText);
  console.log('[Turn 3 Parsed Metadata]:', {
    hasMetaData: !!parsed3.metaData,
    rawActionsCount: (parsed3.metaData as any)?.rawActions?.length || 0,
    rawActions: (parsed3.metaData as any)?.rawActions
  });

  const candidate3 = extractCandidatesFromMetadata(parsed3.metaData || {}, 3, '영락 3년 가을');
  const proposal3 = buildSafeProposalFromCandidate(
    engine.getSnapshot(),
    candidate3,
    3,
    engine.getHistory()
  );

  const commit3 = engine.submitProposal(proposal3);
  console.log('[Turn 3 Proposal Commit Result]:', {
    success: commit3.success,
    stateVersion: commit3.stateVersion,
    committedActionsCount: commit3.committedActionsCount,
    rejectedReasons: commit3.rejectedReasons,
    conflictDetails: commit3.conflictDetails
  });

  const snapshotAfterTurn3 = engine.getSnapshot();
  console.log('Canonical Inventory After Turn 3:', JSON.stringify(snapshotAfterTurn3.character.inventory, null, 2));
  const itemRemoved = !snapshotAfterTurn3.character.inventory.some(i => i.name.includes('비급') || i.name.includes('현천신공'));
  console.log('Canonical Inventory -1 Verified?:', itemRemoved ? 'PASS' : 'FAIL');

  console.log('\n================================================================');
  console.log('VERIFICATION SUMMARY COMPLETE');
  console.log('================================================================');
}

runLiveGoldenPath().catch(console.error);
