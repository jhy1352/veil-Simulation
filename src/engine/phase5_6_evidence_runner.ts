import * as fs from 'fs';
import { SovereignEngine } from './state';
import { dispatchEngineInternalProposal } from './internalCapability';
import { EngineValidator } from './validator';

function extractState(engine: SovereignEngine) {
  const snap = engine.getSnapshot();
  const hist = engine.getHistory();
  return {
    turn: snap.turn,
    stateVersion: snap.stateVersion,
    lastCommittedAt: snap.lastCommittedAt,
    lastCommittedEventId: snap.lastCommittedEventId,
    character: snap.character,
    worldInfo: snap.worldInfo,
    historyLength: hist.length,
    history: hist,
    diagnostics: engine.getDiagnostics(),
  };
}

function runAudit() {
  const outputs: string[] = [];

  function formatTest(name: string, before: any, proposal: any, validatorRes: any, commitRes: any, after: any) {
    let out = `[${name}]\n`;
    out += `[BEFORE]\n${JSON.stringify(before, null, 2)}\n\n`;
    out += `[PROPOSAL]\n${JSON.stringify(proposal, null, 2)}\n\n`;
    out += `[VALIDATOR]\n${JSON.stringify(validatorRes, null, 2)}\n\n`;
    if (commitRes === 'COMMIT NOT REACHED') {
      out += `[COMMIT]\nCOMMIT NOT REACHED\n\n`;
    } else {
      out += `[COMMIT]\n${JSON.stringify(commitRes, null, 2)}\n\n`;
    }
    out += `[AFTER]\n${JSON.stringify(after, null, 2)}\n\n--------------------------------------------------\n`;
    outputs.push(out);
  }

  // --------------------------------------------------
  // 1. HISTORY ↔ CANONICAL STATE
  // --------------------------------------------------

  // 1-A. 정상 Commit 1회
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-1a-1',
      requestId: 'req-1a-1',
      eventId: 'evt-1a-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Normal commit test',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: { worldName: '정상세계' }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 1-A: HISTORY ↔ CANONICAL STATE - NORMAL COMMIT', before, proposal, valRes, commitRes, after);
  }

  // 1-B. History event 1개 누락 주입 상태에서 hydrate
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-1b-1',
      requestId: 'req-1b-1',
      eventId: 'evt-1b-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Commit 1',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: 'Step 1' } }]
    });
    engine.submitProposal({
      proposalId: 'prop-1b-2',
      requestId: 'req-1b-2',
      eventId: 'evt-1b-2',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Commit 2',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: 'Step 2' } }]
    });
    const before = extractState(engine);

    // Corrupt history by dropping event 1
    const corruptedHistory = engine.getHistory().slice(1);
    const snap = engine.getSnapshot();

    let targetEngine: SovereignEngine | null = null;
    let hydrateResult: any;
    try {
      targetEngine = SovereignEngine.hydrate(snap, corruptedHistory);
      hydrateResult = { hydrated: true };
    } catch (e: any) {
      hydrateResult = { hydrated: false, error: e.message };
    }

    const proposal: any = {
      note: 'Hydration with 1 missing history event',
      targetSnapshot: snap,
      injectedHistory: corruptedHistory
    };

    const valRes = { note: 'Hydration boundary invocation', hydrateResult };
    const commitRes = hydrateResult.hydrated ? { success: true } : 'COMMIT NOT REACHED';
    const after = targetEngine ? extractState(targetEngine) : { state: 'UNHYDRATED_DUE_TO_ERROR' };
    formatTest('TEST 1-B: HISTORY ↔ CANONICAL STATE - MISSING HISTORY EVENT HYDRATION', before, proposal, valRes, commitRes, after);
  }

  // 1-C. History event 중복 상태 주입
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-1c-1',
      requestId: 'req-1c-1',
      eventId: 'evt-1c-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Commit 1',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: 'Step 1' } }]
    });
    const hist = engine.getHistory();
    const duplicatedHistory = [hist[0], hist[0]];
    const snap = engine.getSnapshot();
    const before = extractState(engine);

    let targetEngine: SovereignEngine | null = null;
    let hydrateResult: any;
    try {
      targetEngine = SovereignEngine.hydrate(snap, duplicatedHistory);
      hydrateResult = { hydrated: true };
    } catch (e: any) {
      hydrateResult = { hydrated: false, error: e.message };
    }

    const proposal: any = {
      note: 'Hydration with duplicated history events',
      targetSnapshot: snap,
      injectedHistory: duplicatedHistory
    };

    const valRes = { note: 'Hydration boundary invocation', hydrateResult };
    const commitRes = hydrateResult.hydrated ? { success: true } : 'COMMIT NOT REACHED';
    const after = targetEngine ? extractState(targetEngine) : { state: 'UNHYDRATED_DUE_TO_ERROR' };
    formatTest('TEST 1-C: HISTORY ↔ CANONICAL STATE - DUPLICATED HISTORY EVENT HYDRATION', before, proposal, valRes, commitRes, after);
  }

  // 1-D. History의 stateVersion 귀속 변조 주입
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-1d-1',
      requestId: 'req-1d-1',
      eventId: 'evt-1d-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Commit 1',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: 'Step 1' } }]
    });
    const hist = JSON.parse(JSON.stringify(engine.getHistory()));
    hist[0].stateVersionAfterCommit = 999;
    const snap = engine.getSnapshot();
    const before = extractState(engine);

    let targetEngine: SovereignEngine | null = null;
    let hydrateResult: any;
    try {
      targetEngine = SovereignEngine.hydrate(snap, hist);
      hydrateResult = { hydrated: true };
    } catch (e: any) {
      hydrateResult = { hydrated: false, error: e.message };
    }

    const proposal: any = {
      note: 'Hydration with stateVersionAfterCommit spoofed to 999',
      targetSnapshot: snap,
      injectedHistory: hist
    };

    const valRes = { note: 'Hydration boundary invocation', hydrateResult };
    const commitRes = hydrateResult.hydrated ? { success: true } : 'COMMIT NOT REACHED';
    const after = targetEngine ? extractState(targetEngine) : { state: 'UNHYDRATED_DUE_TO_ERROR' };
    formatTest('TEST 1-D: HISTORY ↔ CANONICAL STATE - SPOOFED STATEVERSION IN HISTORY', before, proposal, valRes, commitRes, after);
  }

  // 1-E. 동일 Proposal의 복수 Action 정상 Commit
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-1e-1',
      requestId: 'req-1e-1',
      eventId: 'evt-1e-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Multi action proposal',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: { worldName: '화산파' }
        },
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 15, agility: 14 }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 1-E: HISTORY ↔ CANONICAL STATE - MULTI-ACTION SINGLE PROPOSAL COMMIT', before, proposal, valRes, commitRes, after);
  }

  // --------------------------------------------------
  // 2. 전체 CAUSALITY CHAIN
  // --------------------------------------------------

  // 2-A. 정상 verifiedEventId
  {
    const engine = new SovereignEngine();
    // Step 1: Create world narrative seed
    engine.submitProposal({
      proposalId: 'prop-2a-seed',
      requestId: 'req-2a-seed',
      eventId: 'evt-world-chest-2a',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Spawn chest event seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-chest-2a',
            content: '동굴 속에서 보물 상자와 보검을 발견했다.',
            tag: 'DISCOVERY',
            status: 'active',
            sourceContext: 'Cave exploration'
          }
        }
      ]
    });
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-2a-pickup',
      requestId: 'req-2a-pickup',
      eventId: 'evt-pickup-2a',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Pick up iron sword grounded by seed',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-2a', name: '보검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-chest-2a'
            }
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 2-A: CAUSALITY CHAIN - VALID VERIFIED_EVENT_ID', before, proposal, valRes, commitRes, after);
  }

  // 2-B. 존재하지 않는 verifiedEventId
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-2b-pickup',
      requestId: 'req-2b-pickup',
      eventId: 'evt-pickup-2b',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Pick up sword with non-existent verifiedEventId',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-2b', name: '전설검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'evt-non-existent-999'
            }
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 2-B: CAUSALITY CHAIN - NON-EXISTENT VERIFIED_EVENT_ID', before, proposal, valRes, commitRes, after);
  }

  // 2-C. 다른 실제 eventId (아이템과 인과적 연관 없는 이벤트)
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-2c-seed',
      requestId: 'req-2c-seed',
      eventId: 'evt-weather-rain',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Rain event seed',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-rain-2c',
            content: '하늘에서 세찬 소나기가 내린다.',
            tag: 'ENVIRONMENT',
            status: 'active'
          }
        }
      ]
    });
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-2c-pickup',
      requestId: 'req-2c-pickup',
      eventId: 'evt-pickup-2c',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Pickup sword grounded on unrelated rain seed',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-2c', name: '보검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-rain-2c'
            }
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 2-C: CAUSALITY CHAIN - UNRELATED EVENT AS CAUSE', before, proposal, valRes, commitRes, after);
  }

  // 2-D. prefix/suffix 변형
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-2d-seed',
      requestId: 'req-2d-seed',
      eventId: 'evt-chest-real',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Chest event',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-chest-real',
            content: '보물 상자에서 보검 발견',
            tag: 'DISCOVERY',
            status: 'active'
          }
        }
      ]
    });
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-2d-pickup',
      requestId: 'req-2d-pickup',
      eventId: 'evt-pickup-2d',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Pickup sword with prefix spoofed eventId',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-2d', name: '보검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-chest-real_spoofed'
            }
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 2-D: CAUSALITY CHAIN - PREFIX/SUFFIX SPOOFED EVENT ID', before, proposal, valRes, commitRes, after);
  }

  // 2-E. 이미 소비된 verifiedEventId
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-2e-seed',
      requestId: 'req-2e-seed',
      eventId: 'evt-single-chest-2e',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Chest event',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-single-chest-2e',
            content: '단 하나의 검만 든 보물 상자',
            tag: 'DISCOVERY',
            status: 'active'
          }
        }
      ]
    });
    // First pickup (valid)
    engine.submitProposal({
      proposalId: 'prop-2e-pickup-1',
      requestId: 'req-2e-pickup-1',
      eventId: 'evt-pickup-2e-1',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'First pickup',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-2e-1', name: '보검1', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-single-chest-2e'
            }
          }
        }
      ]
    });

    const before = extractState(engine);
    // Second pickup attempting to reuse same event
    const proposal: any = {
      proposalId: 'prop-2e-pickup-2',
      requestId: 'req-2e-pickup-2',
      eventId: 'evt-pickup-2e-2',
      expectedStateVersion: 3,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 3000).toISOString(),
      intentSummary: 'Second pickup reusing same event',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-2e-2', name: '보검2', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-single-chest-2e'
            }
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 2-E: CAUSALITY CHAIN - REUSED CONSUMED VERIFIED_EVENT_ID', before, proposal, valRes, commitRes, after);
  }

  // 2-F. verifiedEventId는 유효하지만 다른 request/event와 결합한 Proposal (예: 허용되지 않은 비정상 payload)
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-2f-seed',
      requestId: 'req-2f-seed',
      eventId: 'evt-chest-2f',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Chest event',
      actions: [
        {
          type: 'ADD_NARRATIVE_SEED',
          payload: {
            id: 'seed-chest-2f',
            content: '보물 상자에서 보검 발견',
            tag: 'DISCOVERY',
            status: 'active'
          }
        }
      ]
    });
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-2f-mixed',
      requestId: 'req-2f-mixed',
      eventId: 'evt-mixed-2f',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Mixed proposal with valid verifiedEventId and illegal action',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: {
            item: { id: 'item-sword-2f', name: '보검', quantity: 1 },
            operation: 'ADD',
            acquisition: {
              cause: 'DISCOVERY_PICKUP',
              verifiedEventId: 'seed-chest-2f'
            }
          }
        },
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 999 } // Invalid stat
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 2-F: CAUSALITY CHAIN - VALID EVENT COMBINED WITH INVALID STAT ACTION', before, proposal, valRes, commitRes, after);
  }

  // --------------------------------------------------
  // 3. OVERWRITE 역사 불변성
  // --------------------------------------------------

  // 3-A. 역사적으로 존재하는 보호 대상 상태를 정상 보존하는 OVERWRITE
  {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-3a-seed',
      requestId: 'req-3a-seed',
      eventId: 'evt-3a-seed',
      expectedStateVersion: 1,
      source: 'GENESIS',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Seed inventory and character',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-sword-3a', name: '기본검', quantity: 1 }, operation: 'ADD' }
        }
      ]
    });
    const before = extractState(engine);
    // Player OVERWRITE_CHARACTER preserving existing inventory
    const proposal: any = {
      proposalId: 'prop-3a-overwrite',
      requestId: 'req-3a-overwrite',
      eventId: 'evt-3a-overwrite',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Overwrite character name/profile while preserving inventory',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...before.character,
            name: '이수련',
            inventory: [{ id: 'item-sword-3a', name: '기본검', quantity: 1 }]
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 3-A: OVERWRITE IMMUTABILITY - PRESERVED INVENTORY OVERWRITE', before, proposal, valRes, commitRes, after);
  }

  // 3-B. 역사적으로 발생한 사실과 충돌하는 overwrite 시도 (인벤토리 몰래 추가)
  {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-3b-seed',
      requestId: 'req-3b-seed',
      eventId: 'evt-3b-seed',
      expectedStateVersion: 1,
      source: 'GENESIS',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Seed inventory',
      actions: [
        {
          type: 'MODIFY_INVENTORY',
          payload: { item: { id: 'item-sword-3b', name: '기본검', quantity: 1 }, operation: 'ADD' }
        }
      ]
    });
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-3b-overwrite',
      requestId: 'req-3b-overwrite',
      eventId: 'evt-3b-overwrite',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Overwrite character injecting unearned dragon sword',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...before.character,
            inventory: [
              { id: 'item-sword-3b', name: '기본검', quantity: 1 },
              { id: 'item-dragon-3b', name: '용검', quantity: 1 }
            ]
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 3-B: OVERWRITE IMMUTABILITY - INVENTORY INJECTION OVERWRITE', before, proposal, valRes, commitRes, after);
  }

  // 3-C. DEAD / physical defect 등 기존 보호 로직과 직접 관련된 사례 (신체 결손 임의 삭제)
  {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-3c-defect',
      requestId: 'req-3c-defect',
      eventId: 'evt-3c-defect',
      expectedStateVersion: 1,
      source: 'SYSTEM',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Record physical defect',
      actions: [
        {
          type: 'RECORD_PHYSICAL_DEFECT',
          payload: { defect: '오른팔 절단' }
        }
      ]
    });
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-3c-heal',
      requestId: 'req-3c-heal',
      eventId: 'evt-3c-heal',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Attempt OVERWRITE_CHARACTER removing defect',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...before.character,
            physicalDefect: ''
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 3-C: OVERWRITE IMMUTABILITY - PHYSICAL DEFECT ERASURE ATTEMPT', before, proposal, valRes, commitRes, after);
  }

  // 3-D. overwrite 후 history와 canonical state의 관계 확인
  {
    const engine = new SovereignEngine();
    dispatchEngineInternalProposal(engine, {
      proposalId: 'prop-3d-seed',
      requestId: 'req-3d-seed',
      eventId: 'evt-3d-seed',
      expectedStateVersion: 1,
      source: 'GENESIS',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Initial profile',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...engine.getSnapshot().character,
            name: '청운',
            originBackground: '화산파 제자'
          }
        }
      ]
    });
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-3d-update',
      requestId: 'req-3d-update',
      eventId: 'evt-3d-update',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Update profile background',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: {
            ...before.character,
            originBackground: '화산파 장문인 직속제자'
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 3-D: OVERWRITE IMMUTABILITY - VALID PROFILE EDIT RELATION WITH HISTORY', before, proposal, valRes, commitRes, after);
  }

  // --------------------------------------------------
  // 4. SOURCE → ACTION ACL
  // --------------------------------------------------

  // 4-A. 각 source의 정상 허용 Action
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-4a-player',
      requestId: 'req-4a-player',
      eventId: 'evt-4a-player',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Player stat update',
      actions: [
        {
          type: 'UPDATE_CHARACTER_STATS',
          payload: { strength: 12 }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 4-A: SOURCE ACL - PLAYER PERMITTED ACTION', before, proposal, valRes, commitRes, after);
  }

  // 4-B. 각 source로 타 source 전용 Action (LLM trying OVERWRITE_CHARACTER)
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-4b-llm',
      requestId: 'req-4b-llm',
      eventId: 'evt-4b-llm',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'LLM attempting OVERWRITE_CHARACTER',
      actions: [
        {
          type: 'OVERWRITE_CHARACTER',
          payload: { ...before.character, name: 'LLM이 바꾼 이름' }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 4-B: SOURCE ACL - LLM CALLING PROHIBITED OVERWRITE_CHARACTER', before, proposal, valRes, commitRes, after);
  }

  // 4-C. source spoofing (External caller submits with ENGINE_INTERNAL)
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-4c-spoof',
      requestId: 'req-4c-spoof',
      eventId: 'evt-4c-spoof',
      expectedStateVersion: 1,
      source: 'ENGINE_INTERNAL',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Spoof internal source from public method',
      actions: [
        {
          type: 'SET_WORLD_METADATA',
          payload: { worldName: '해킹된 세계' }
        }
      ]
    };
    const submitRes = engine.submitProposal(proposal);
    const after = extractState(engine);
    formatTest('TEST 4-C: SOURCE ACL - SOURCE SPOOFING VIA SUBMITPROPOSAL', before, proposal, { note: 'Direct invocation of submitProposal with ENGINE_INTERNAL', submitRes }, submitRes.success ? submitRes : 'COMMIT NOT REACHED', after);
  }

  // 4-D. 허용 source + 비정상 Action 조합 (PLAYER calling ADVANCE_CHAPTER)
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-4d-player-chap',
      requestId: 'req-4d-player-chap',
      eventId: 'evt-4d-player-chap',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Player attempting ADVANCE_CHAPTER',
      actions: [
        {
          type: 'ADVANCE_CHAPTER',
          payload: {
            currentChapter: '2장 결전'
          }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 4-D: SOURCE ACL - PLAYER ATTEMPTING LLM-ONLY ADVANCE_CHAPTER', before, proposal, valRes, commitRes, after);
  }

  // 4-E. SET_QUANTITY 외의 Action에도 ACL이 실제 적용되는지 확인 (LLM attempting RECORD_PHYSICAL_DEFECT)
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-4e-llm-defect',
      requestId: 'req-4e-llm-defect',
      eventId: 'evt-4e-llm-defect',
      expectedStateVersion: 1,
      source: 'LLM',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'LLM attempting RECORD_PHYSICAL_DEFECT',
      actions: [
        {
          type: 'RECORD_PHYSICAL_DEFECT',
          payload: { defect: 'LLM이 부여한 내상' }
        }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 4-E: SOURCE ACL - LLM ATTEMPTING RECORD_PHYSICAL_DEFECT', before, proposal, valRes, commitRes, after);
  }

  // --------------------------------------------------
  // 5. REPLAY / DUPLICATE COMMIT
  // --------------------------------------------------

  // 5-A. 동일 requestId 재전송
  {
    const engine = new SovereignEngine();
    const firstProposal: any = {
      proposalId: 'prop-5a-1',
      requestId: 'req-5a-same',
      eventId: 'evt-5a-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'First execution',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '1차 실행' } }]
    };
    engine.submitProposal(firstProposal);

    const before = extractState(engine);
    const replayProposal: any = {
      proposalId: 'prop-5a-2',
      requestId: 'req-5a-same',
      eventId: 'evt-5a-2',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Replay with same requestId',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '2차 실행 재전송' } }]
    };
    const valRes = EngineValidator.validate(replayProposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(replayProposal);
    }
    const after = extractState(engine);
    formatTest('TEST 5-A: REPLAY DEFENSE - DUPLICATE REQUEST_ID', before, replayProposal, valRes, commitRes, after);
  }

  // 5-B. 동일 eventId 재전송
  {
    const engine = new SovereignEngine();
    const firstProposal: any = {
      proposalId: 'prop-5b-1',
      requestId: 'req-5b-1',
      eventId: 'evt-5b-same',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'First execution',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '1차 실행' } }]
    };
    engine.submitProposal(firstProposal);

    const before = extractState(engine);
    const replayProposal: any = {
      proposalId: 'prop-5b-2',
      requestId: 'req-5b-2',
      eventId: 'evt-5b-same',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Replay with same eventId',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '2차 실행 재전송' } }]
    };
    const valRes = EngineValidator.validate(replayProposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(replayProposal);
    }
    const after = extractState(engine);
    formatTest('TEST 5-B: REPLAY DEFENSE - DUPLICATE EVENT_ID', before, replayProposal, valRes, commitRes, after);
  }

  // 5-C. 동일 Proposal 완전 재전송
  {
    const engine = new SovereignEngine();
    const proposal: any = {
      proposalId: 'prop-5c-exact',
      requestId: 'req-5c-exact',
      eventId: 'evt-5c-exact',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Exact duplicate proposal',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '완전 동일 제안' } }]
    };
    engine.submitProposal(proposal);

    const before = extractState(engine);
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 5-C: REPLAY DEFENSE - EXACT DUPLICATE PROPOSAL REPLAY', before, proposal, valRes, commitRes, after);
  }

  // 5-D. 동일 의도를 새 requestId/eventId로 재전송
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-5d-1',
      requestId: 'req-5d-1',
      eventId: 'evt-5d-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Action 1',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '이름1' } }]
    });

    const before = extractState(engine);
    const newProposal: any = {
      proposalId: 'prop-5d-2',
      requestId: 'req-5d-2',
      eventId: 'evt-5d-2',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Fresh requestId and eventId',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '이름2' } }]
    };
    const valRes = EngineValidator.validate(newProposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(newProposal);
    }
    const after = extractState(engine);
    formatTest('TEST 5-D: REPLAY DEFENSE - FRESH REQUEST_ID AND EVENT_ID', before, newProposal, valRes, commitRes, after);
  }

  // 5-E. 동일 requestId + 다른 eventId
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-5e-1',
      requestId: 'req-5e-same',
      eventId: 'evt-5e-1',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Step 1',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '이름 1' } }]
    });

    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-5e-2',
      requestId: 'req-5e-same',
      eventId: 'evt-5e-2',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Same requestId, fresh eventId',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '이름 2' } }]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 5-E: REPLAY DEFENSE - SAME REQUEST_ID DIFFERENT EVENT_ID', before, proposal, valRes, commitRes, after);
  }

  // 5-F. 동일 eventId + 다른 requestId
  {
    const engine = new SovereignEngine();
    engine.submitProposal({
      proposalId: 'prop-5f-1',
      requestId: 'req-5f-1',
      eventId: 'evt-5f-same',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'Step 1',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '이름 1' } }]
    });

    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-5f-2',
      requestId: 'req-5f-2',
      eventId: 'evt-5f-same',
      expectedStateVersion: 2,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      intentSummary: 'Different requestId, same eventId',
      actions: [{ type: 'SET_WORLD_METADATA', payload: { worldName: '이름 2' } }]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 5-F: REPLAY DEFENSE - DIFFERENT REQUEST_ID SAME EVENT_ID', before, proposal, valRes, commitRes, after);
  }

  // --------------------------------------------------
  // 6. ATOMICITY
  // --------------------------------------------------

  // 6-A. 모든 Action 정상 → Commit
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-6a-valid',
      requestId: 'req-6a-valid',
      eventId: 'evt-6a-valid',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'All valid actions in proposal',
      actions: [
        { type: 'SET_WORLD_METADATA', payload: { worldName: '원자적 세계' } },
        { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 15, agility: 16 } }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 6-A: ATOMICITY - ALL ACTIONS VALID COMMIT', before, proposal, valRes, commitRes, after);
  }

  // 6-B. 앞쪽 Action은 정상이나 뒤쪽 Action 하나가 Validator/Applier 단계에서 실패하도록 구성
  {
    const engine = new SovereignEngine();
    const before = extractState(engine);
    const proposal: any = {
      proposalId: 'prop-6b-partial-fail',
      requestId: 'req-6b-partial-fail',
      eventId: 'evt-6b-partial-fail',
      expectedStateVersion: 1,
      source: 'PLAYER',
      turn: 1,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      intentSummary: 'First action valid, second action invalid (invalid stat 999)',
      actions: [
        { type: 'SET_WORLD_METADATA', payload: { worldName: '이 이름은 반영되면 안됨' } },
        { type: 'UPDATE_CHARACTER_STATS', payload: { strength: 999 } }
      ]
    };
    const valRes = EngineValidator.validate(proposal, engine.getSnapshot(), (engine as any).executedRequestIds, (engine as any).recordedEventIds, engine.getHistory());
    let commitRes: any = 'COMMIT NOT REACHED';
    if (valRes.isValid) {
      commitRes = engine.submitProposal(proposal);
    }
    const after = extractState(engine);
    formatTest('TEST 6-B: ATOMICITY - PARTIAL FAILURE IN PROPOSAL', before, proposal, valRes, commitRes, after);
  }

  fs.writeFileSync('./src/engine/phase5_6_raw_evidence.txt', outputs.join('\n'), 'utf-8');
  console.log('Evidence file written successfully. Total entries:', outputs.length);
}

runAudit();
