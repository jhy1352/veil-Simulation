import http from 'http';
import fs from 'fs';
import path from 'path';
import { SovereignEngine } from '../src/engine/state.ts';
import { EngineValidator } from '../src/engine/validator.ts';
import { createEmptyCharacter, createEmptyWorldInfo } from '../src/utils/factory.ts';
import { DEFAULT_NPC_CLASS } from '../src/types.ts';

const rawLogs: string[] = [];

function log(section: string, data: any) {
  const time = new Date().toISOString();
  const header = `\n[${time}] === ${section} ===`;
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  rawLogs.push(header);
  rawLogs.push(body);
  console.log(header);
  console.log(body);
}

function makeHttpRequest(url: string, payload: any): Promise<{ statusCode: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(payload);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: responseBody
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function runFinalRuntimePathEvidence() {
  log('START_OF_PHASE_5_7_FINAL_RUNTIME_EVIDENCE_RUN', {
    runId: 'RT-FINAL-SUCCESS-EVIDENCE-CLOSURE',
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      endpoint: 'http://localhost:3000/api/chat',
      mockGeminiAllowed: false,
      syntheticCandidatesAllowed: false,
      fakeHydrationAllowed: false
    }
  });

  // 1. Initial State Setup
  const initialWorld = createEmptyWorldInfo();
  initialWorld.currentLocation = '엘프론트 왕국 성문 앞';
  initialWorld.currentChapter = '제 1 장: 새벽의 성문';
  initialWorld.activeFactions = [
    {
      id: 'royal_guard',
      name: '왕국 근위대',
      description: '왕도를 지키는 정예 근위대',
      power: 80,
      attitude: 'NEUTRAL',
      relationshipWithPlayer: '중립',
      influence: '높음',
      keyFigures: ['guard_captain']
    }
  ];
  initialWorld.unresolvedForeshadowing = ['성문 안쪽에서 짙은 안개가 피어오르고 있다.'];
  initialWorld.npcKnowledge = {
    guard_captain: { knownFacts: ['성문 통행령 발효 중'], class: DEFAULT_NPC_CLASS }
  };

  const initialChar = createEmptyCharacter();
  initialChar.name = '아서';
  initialChar.age = 24;
  initialChar.stats = { strength: 14, agility: 12, constitution: 13, intelligence: 10, wisdom: 11, charisma: 10 };
  initialChar.inventory = [
    { id: 'item-iron-sword', name: '철검', quantity: 1, description: '기본 보병용 철검', type: 'weapon' }
  ];
  initialChar.location = '엘프론트 왕국 성문 앞';
  initialChar.gold = 100;

  const initialEngine = new SovereignEngine(initialWorld, initialChar, [], 1, 1);
  const stateBefore = initialEngine.getSnapshot();

  log('BEFORE_STATE_CANONICAL', {
    stateVersion: stateBefore.stateVersion,
    character: stateBefore.character,
    worldInfo: stateBefore.worldInfo,
    historyLength: initialEngine.getHistory().length,
    lastCommittedEventId: stateBefore.lastCommittedEventId
  });

  const playerInput = '아서가 성문 경비대장에게 접근하여 통행을 요청하고 10골드를 통행세로 건넨다.';
  log('PLAYER_INPUT', {
    input: playerInput,
    actionType: 'CLAIMED / ACTION_PROPOSAL',
    timestamp: new Date().toISOString()
  });

  // 2. HTTP Request to Live /api/chat
  log('HTTP_REQUEST_INITIATION', {
    url: 'http://localhost:3000/api/chat',
    method: 'POST',
    bodyPayload: {
      messages: [{ role: 'user', content: playerInput }],
      userPrompt: playerInput,
      stateVersion: stateBefore.stateVersion,
      character: stateBefore.character,
      worldInfo: stateBefore.worldInfo
    }
  });

  let httpResponse: { statusCode: number; headers: any; body: string };
  try {
    httpResponse = await makeHttpRequest('http://localhost:3000/api/chat', {
      messages: [{ role: 'user', content: playerInput }],
      userPrompt: playerInput,
      stateVersion: stateBefore.stateVersion,
      character: stateBefore.character,
      worldInfo: stateBefore.worldInfo
    });
  } catch (err: any) {
    log('HTTP_CONNECTION_FATAL_ERROR', {
      error: err.message,
      stack: err.stack
    });
    return;
  }

  log('HTTP_RESPONSE_RAW', {
    statusCode: httpResponse.statusCode,
    headers: httpResponse.headers,
    rawBody: httpResponse.body
  });

  let parsedBody: any = null;
  try {
    parsedBody = JSON.parse(httpResponse.body);
  } catch (e: any) {
    log('HTTP_BODY_JSON_PARSE_ERROR', { rawBody: httpResponse.body, error: e.message });
  }

  log('HTTP_BODY_PARSED', parsedBody);

  const isHttpSuccess = httpResponse.statusCode === 200 && parsedBody && parsedBody.success === true;

  if (!isHttpSuccess) {
    log('STOP_OF_NORMAL_SUCCESS_PATH_ASSERTION', {
      reason: 'UPSTREAM_API_STATUS_UNAVAILABLE_OR_NON_200',
      observedStatusCode: httpResponse.statusCode,
      observedResponsePayload: parsedBody || httpResponse.body,
      action: 'HALTING_SUCCESS_PATH_EVALUATION_PER_ABSOLUTE_RULE',
      ruleCitation: 'HTTP 500/503/429/401/404, Gemini "success !== true", Candidate 미생성 시 성공 경로 증명 중단 및 RAW 사실만 기록',
      stateVersionBefore: stateBefore.stateVersion,
      stateVersionAfter: initialEngine.getSnapshot().stateVersion,
      stateMutated: false,
      executedSteps: [
        '1. Canonical State Initial Setup (stateVersion: 1)',
        '2. Player Input Registered (CLAIMED status)',
        '3. HTTP POST /api/chat dispatched to live server',
        `4. Server response observed (HTTP ${httpResponse.statusCode})`
      ],
      unexecutedStepsDueToUpstreamStatus: [
        'Candidate Generation / Extraction',
        'State Transition Proposal Creation',
        'submitProposal to Validator',
        'Canonical Commit Gate Execution',
        'Canonical State Version Increment',
        'localStorage Persistence of New Version',
        'Browser Session Reload & Rehydration'
      ]
    });
  } else {
    log('UPSTREAM_200_SUCCESS_OBSERVED', {
      text: parsedBody.text,
      metadata: parsedBody.metadata
    });

    const candidate = parsedBody.candidate || parsedBody.text;
    log('CANDIDATE_RAW', candidate);

    const proposal = parsedBody.metadata?.stateProposal || null;
    log('PROPOSAL_RAW', proposal);

    const actions = proposal?.actions || [];
    log('PROPOSAL_ACTIONS_LENGTH', actions.length);

    if (actions.length > 0) {
      log('SUBMIT_PROPOSAL_RAW', {
        proposal,
        source: 'LLM_CANDIDATE_NARRATIVE_LAYER'
      });

      const commitResult = initialEngine.submitProposal(proposal);
      log('COMMIT_RAW', commitResult);

      const stateAfter = initialEngine.getSnapshot();
      log('CANONICAL_AFTER_STATE', {
        stateVersion: stateAfter.stateVersion,
        character: stateAfter.character,
        worldInfo: stateAfter.worldInfo,
        historyLength: initialEngine.getHistory().length,
        lastCommittedEventId: stateAfter.lastCommittedEventId
      });

      log('STATE_VERSION_TRANSITION', {
        versionBefore: stateBefore.stateVersion,
        versionAfter: stateAfter.stateVersion,
        isIncremented: stateAfter.stateVersion > stateBefore.stateVersion
      });
    }
  }

  log('END_OF_PHASE_5_7_FINAL_RUNTIME_EVIDENCE_RUN', {
    timestamp: new Date().toISOString(),
    status: isHttpSuccess ? 'COMPLETED_FULL_PATH' : 'STOPPED_AT_LIVE_API_UNAVAILABLE'
  });

  // Save complete RAW log to file
  const reportDir = path.join(process.cwd(), 'idea', 'report');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const completeLogText = rawLogs.join('\n');
  const rawLogPath = path.join(process.cwd(), 'phase5_7_final_runtime_raw_evidence.txt');
  fs.writeFileSync(rawLogPath, completeLogText, 'utf8');

  // Split into exact 500-line chunks
  const lines = completeLogText.split('\n');
  const chunkSize = 500;
  let part = 1;
  const chunkFiles: { fileName: string; lineCount: number; range: string }[] = [];

  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize).join('\n');
    const fileName = `phase5_7_final_runtime_evidence_part${part}.txt`;
    const filePath = path.join(reportDir, fileName);
    fs.writeFileSync(filePath, chunk, 'utf8');
    const actualLines = chunk.split('\n').length;
    chunkFiles.push({
      fileName,
      lineCount: actualLines,
      range: `${i + 1}..${Math.min(i + chunkSize, lines.length)}`
    });
    part++;
  }

  console.log(`Saved ${rawLogPath} (${lines.length} lines)`);
  chunkFiles.forEach(cf => console.log(`Saved ${cf.fileName} (${cf.lineCount} lines, range: ${cf.range})`));
}

runFinalRuntimePathEvidence().catch((err) => {
  console.error('Fatal error running evidence suite:', err);
  process.exit(1);
});
