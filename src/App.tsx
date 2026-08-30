import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Character,
  WorldInfo,
  GameState,
  StoryMessage,
  EngineState,
  Language,
  RollEvent,
  SessionPayload,
  CandidatePacket,
  ValidationDiagnosticLog,
  GeminiModelType,
  FontSizeLevel
} from './types';
import {
  createEmptyCharacter,
  createEmptyWorldInfo,
  createEmptyGameState,
  createEmptyEngineState,
  deepMerge
} from './utils/factory';
import { parseGMResponseMetaData } from './utils/parser';
import {
  extractCandidatesFromMetadata
} from './utils/engineValidator';
import { SovereignEngine } from './engine/state';
import { buildSafeProposalFromCandidate } from './engine/proposalParser';
import { StateTransitionProposal, TransitionAction } from './engine/types';
import { actionToMeaningNode, adaptMeaningTreeToProposal } from './engine/language';
import { TurnLatencyProfiler } from './utils/latency';
import { CreationPhase } from './components/CreationPhase';
import { GameInterface } from './components/GameInterface';

const STORAGE_KEY = 'engine_mk7_trpg_session_v1';
const FONT_SIZE_STORAGE_KEY = 'trpg_ui_font_size_v1';

export default function App() {
  // State Initialization with pure factory pattern
  const [character, setCharacter] = useState<Character>(() => createEmptyCharacter());
  const [worldInfo, setWorldInfo] = useState<WorldInfo>(() => createEmptyWorldInfo());
  const [gameState, setGameState] = useState<GameState>(() => createEmptyGameState());
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [engineState, setEngineState] = useState<EngineState>(() => createEmptyEngineState());
  const [storyTurnCount, setStoryTurnCount] = useState<number>(1);
  const [waitingForRoll, setWaitingForRoll] = useState<RollEvent | null>(null);
  const [language, setLanguage] = useState<Language>('ko');
  const [selectedModel, setSelectedModel] = useState<GeminiModelType>('gemini-3.7-flash');
  const [fontSize, setFontSize] = useState<FontSizeLevel>(() => {
    try {
      const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (saved === 'sm' || saved === 'base' || saved === 'lg' || saved === 'xl') {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'base';
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Sovereign Engine reference as single authoritative Commit Gate
  const sovereignEngineRef = useRef<SovereignEngine | null>(null);

  const getOrInitEngine = (
    curWorld: WorldInfo,
    curChar: Character,
    curHistory: any[],
    curTurn: number,
    curDiag?: any
  ): SovereignEngine => {
    if (!sovereignEngineRef.current) {
      // Sovereign hydration priority:
      // 1. Saved diagnostics.stateVersion (if valid number)
      // 2. Legacy fallback: curTurn
      // 3. Safe fallback: 1
      const resolvedVersion =
        typeof curDiag?.stateVersion === 'number' && curDiag.stateVersion >= 1
          ? curDiag.stateVersion
          : typeof curTurn === 'number' && curTurn >= 1
          ? curTurn
          : 1;

      sovereignEngineRef.current = SovereignEngine.hydrate(
        {
          stateVersion: resolvedVersion,
          turn: curTurn,
          worldInfo: curWorld,
          character: curChar,
          lastCommittedEventId: curDiag?.lastEventId || null,
          lastCommittedAt: new Date().toISOString()
        },
        curHistory || []
      );
    }
    return sovereignEngineRef.current;
  };

  const handleUpdateFontSize = (newSize: FontSizeLevel) => {
    setFontSize(newSize);
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, newSize);
    } catch (e) {
      // ignore
    }
  };

  // 1. Storage Hydration on Mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SessionPayload = JSON.parse(saved);
        if (parsed.character && parsed.worldInfo) {
          const loadedWorld = deepMerge(createEmptyWorldInfo(), parsed.worldInfo);
          const loadedChar = deepMerge(createEmptyCharacter(), parsed.character);
          const loadedTurn = parsed.storyTurnCount || 1;
          const loadedHistory = (parsed.engineState?.historicalRecords as any) || [];
          const loadedDiag = parsed.engineState?.diagnostics;

          setCharacter(loadedChar);
          setWorldInfo(loadedWorld);
          setMessages(parsed.messages || []);
          setStoryTurnCount(loadedTurn);
          setGameState(parsed.messages && parsed.messages.length > 0 ? 'playing' : 'creation');
          if (parsed.engineState) {
            setEngineState(parsed.engineState);
          }
          if (parsed.selectedModel) {
            setSelectedModel(parsed.selectedModel);
          }

          const resolvedVersion =
            typeof loadedDiag?.stateVersion === 'number' && loadedDiag.stateVersion >= 1
              ? loadedDiag.stateVersion
              : typeof loadedTurn === 'number' && loadedTurn >= 1
              ? loadedTurn
              : 1;

          sovereignEngineRef.current = SovereignEngine.hydrate(
            {
              stateVersion: resolvedVersion,
              turn: loadedTurn,
              worldInfo: loadedWorld,
              character: loadedChar,
              lastCommittedEventId: loadedDiag?.lastEventId || null,
              lastCommittedAt: parsed.updatedAt || new Date().toISOString()
            },
            loadedHistory,
            undefined,
            undefined,
            parsed.genesisSnapshot
          );
        }
      }
    } catch (e) {
      console.warn('Failed to hydrate session from localStorage:', e);
    }
  }, []);

  // 2. Storage Auto-Persistence
  useEffect(() => {
    if (gameState === 'playing' || messages.length > 0) {
      try {
        const payload: SessionPayload = {
          character,
          worldInfo,
          messages,
          engineState,
          storyTurnCount,
          selectedModel,
          genesisSnapshot: sovereignEngineRef.current ? sovereignEngineRef.current.getGenesisSnapshot() : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('Failed to persist session to localStorage:', e);
      }
    }
  }, [character, worldInfo, messages, engineState, storyTurnCount, gameState, selectedModel]);

  // Partial Update Handlers routed through Sovereign Gate during active gameplay
  const handleUpdateCharacter = (partial: Partial<Character>) => {
    const engine = sovereignEngineRef.current;
    if (gameState === 'playing' && engine) {
      const snap = engine.getSnapshot();
      const nextChar = { ...snap.character, ...partial };
      const action: TransitionAction = {
        type: 'OVERWRITE_CHARACTER',
        payload: nextChar
      };
      const meaningTree = actionToMeaningNode(action, 'PROPOSAL');
      const proposal = adaptMeaningTreeToProposal(meaningTree, {
        proposalId: `prop-player-char-${Date.now()}`,
        requestId: `req-player-char-${Date.now()}`,
        eventId: `evt-player-char-${Date.now()}`,
        expectedStateVersion: snap.stateVersion,
        source: 'PLAYER',
        turn: storyTurnCount,
        timestamp: new Date().toISOString(),
        intentSummary: 'Player manual character edit'
      });
      const res = engine.submitProposal(proposal);
      if (res.success) {
        setCharacter(res.snapshot.character);
      }
    } else {
      setCharacter(prev => ({ ...prev, ...partial }));
    }
  };

  const handleUpdateWorldInfo = (partial: Partial<WorldInfo>) => {
    const engine = sovereignEngineRef.current;
    if (gameState === 'playing' && engine) {
      const snap = engine.getSnapshot();
      const nextWorld = { ...snap.worldInfo, ...partial };
      const proposal: StateTransitionProposal = {
        proposalId: `prop-player-world-${Date.now()}`,
        requestId: `req-player-world-${Date.now()}`,
        eventId: `evt-player-world-${Date.now()}`,
        expectedStateVersion: snap.stateVersion,
        source: 'PLAYER',
        turn: storyTurnCount,
        timestamp: new Date().toISOString(),
        intentSummary: 'Player manual world info edit',
        actions: [
          {
            type: 'OVERWRITE_WORLD_INFO',
            payload: nextWorld
          }
        ]
      };
      const res = engine.submitProposal(proposal);
      if (res.success) {
        setWorldInfo(res.snapshot.worldInfo);
      }
    } else {
      setWorldInfo(prev => ({ ...prev, ...partial }));
    }
  };

  const handleUpdateEngineState = (partial: Partial<EngineState>) => {
    setEngineState(prev => ({ ...prev, ...partial }));
  };

  // Complete Creation Phase and Launch Campaign
  const handleCompleteCreation = async () => {
    setGameState('playing');
    setStoryTurnCount(1);

    // Initialize Sovereign Engine with genesis state
    sovereignEngineRef.current = new SovereignEngine(
      worldInfo,
      character,
      [],
      1,
      1
    );

    // Initial opening prompt to GM
    const initialPrompt = `[서사 개막 선언]
세계관: ${worldInfo.worldName || '미지의 세계'} (${worldInfo.toneStyle || '원작 고유의 문체 충실 재현'})
시대/배경: ${worldInfo.settingDescription || '새로운 이야기가 태동하는 시대'}
주인공: ${character.name || '주인공'} (나이: ${character.age || '미상'}, 성별: ${character.gender || '미상'})
출신: [${character.backgroundType || 'preset'}] ${character.originBackground || '미상'}
결핍: [${character.flawType || 'preset'}] ${character.flaw || '없음'}
맹세: [${character.oathType || 'preset'}] ${character.oath || '없음'}
닻: [${character.anchorType || 'preset'}] ${character.anchor || '없음'}
문파/세력: [${character.factionType || 'preset'}] ${character.faction || '무소속'}
${character.physicalDefect ? `신체 결손/낭만 돌파구: ${character.physicalDefect}` : ''}
궁극적 목표: ${character.goal || '자신의 길을 개척하는 것'}

대문호의 필치로 주인공이 마주한 첫 시작 장면의 정취와 상황을 묘사하고, 주인공에게 행동 기회를 제시하십시오.`;

    await handleSendMessage(initialPrompt, true);
  };

  // Reset Session to clean creation mode
  const handleResetSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCharacter(createEmptyCharacter());
    setWorldInfo(createEmptyWorldInfo());
    setMessages([]);
    setEngineState(createEmptyEngineState());
    setStoryTurnCount(1);
    setWaitingForRoll(null);
    setGameState('creation');
    setModelError(null);
    sovereignEngineRef.current = new SovereignEngine(
      createEmptyWorldInfo(),
      createEmptyCharacter(),
      [],
      1,
      1
    );
  };

  // Load Session from Cloud or Code
  const handleLoadSession = (loadedPayload: SessionPayload) => {
    if (loadedPayload.character && loadedPayload.worldInfo) {
      const loadedWorld = deepMerge(createEmptyWorldInfo(), loadedPayload.worldInfo);
      const loadedChar = deepMerge(createEmptyCharacter(), loadedPayload.character);
      const loadedTurn = loadedPayload.storyTurnCount || 1;
      const loadedHistory = (loadedPayload.engineState?.historicalRecords as any) || [];
      const loadedDiag = loadedPayload.engineState?.diagnostics;

      setCharacter(loadedChar);
      setWorldInfo(loadedWorld);
      setMessages(loadedPayload.messages || []);
      setStoryTurnCount(loadedTurn);
      setEngineState(loadedPayload.engineState || createEmptyEngineState());
      setGameState('playing');
      setWaitingForRoll(null);
      setModelError(null);

      sovereignEngineRef.current = SovereignEngine.hydrate(
        {
          stateVersion: loadedDiag?.stateVersion || (loadedHistory.length ? loadedHistory.length + 1 : 1),
          turn: loadedTurn,
          worldInfo: loadedWorld,
          character: loadedChar,
          lastCommittedEventId: loadedDiag?.lastEventId || null,
          lastCommittedAt: loadedPayload.updatedAt || new Date().toISOString()
        },
        loadedHistory,
        undefined,
        undefined,
        loadedPayload.genesisSnapshot
      );
    }
  };

  // Core Turn Processing Pipeline (T0 ~ T7)
  const handleSendMessage = useCallback(async (userPrompt: string, isInitial: boolean = false) => {
    if (isGenerating) return;

    // T0: Player Input
    const profiler = new TurnLatencyProfiler(storyTurnCount, selectedModel);
    profiler.markRequestStart(userPrompt.length);

    const turnStartTime = Date.now();
    const traceSteps: import('./types').TurnTrace['steps'] = [
      {
        step: 'T0_PLAYER_INPUT',
        status: 'OK',
        timestamp: turnStartTime,
        details: `Turn ${storyTurnCount} player input: "${userPrompt.slice(0, 50)}${userPrompt.length > 50 ? '...' : ''}" (${userPrompt.length} chars)`
      }
    ];

    setIsGenerating(true);
    setModelError(null);

    const userMessage: StoryMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: userPrompt,
      cleanText: userPrompt,
      turn: storyTurnCount,
      timestamp: new Date().toISOString()
    };

    const newMessages = isInitial ? [userMessage] : [...messages, userMessage];
    setMessages(newMessages);

    try {
      profiler.markContextAssemblyComplete();
      traceSteps.push({
        step: 'T1_REQUEST_START',
        status: 'OK',
        timestamp: Date.now(),
        details: `Initiating API POST /api/chat with model ${selectedModel}`
      });

      profiler.markGeminiRequestStart();
      traceSteps.push({
        step: 'T2_CONTEXT_ASSEMBLED',
        status: 'OK',
        timestamp: Date.now(),
        details: `Context prepared with ${newMessages.length} total messages in history`
      });

      traceSteps.push({
        step: 'T3_GEMINI_START',
        status: 'OK',
        timestamp: Date.now(),
        details: `Backend Gemini API request dispatched`
      });

      // Call Backend API Route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          worldInfo,
          character,
          engineState,
          storyTurnCount,
          userPrompt,
          selectedModel
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status}: API 호출 실패`);
      }

      const data = await response.json();
      const rawOutputText: string = data.text || data.rawResponse || '';
      const contextSnapshot: string = data.contextSnapshot || '';

      profiler.markGeminiResponseReceived(rawOutputText.length);
      traceSteps.push({
        step: 'T4_GEMINI_RECEIVED',
        status: 'OK',
        timestamp: Date.now(),
        details: `Gemini response received (${rawOutputText.length} chars)`
      });

      // T5: Parser Complete
      const { cleanText, metaData, rawMetaBlock } = parseGMResponseMetaData(rawOutputText);
      profiler.markParserComplete();
      traceSteps.push({
        step: 'T5_PARSED',
        status: metaData ? 'OK' : 'SKIPPED',
        timestamp: Date.now(),
        details: metaData ? `Metadata block parsed successfully` : `No metadata block detected in response`
      });

      // T6 & T7: Sovereign Validation & Canonical Commit Gate
      let currentWorldInfo = worldInfo;
      let currentCharacter = character;
      const engine = getOrInitEngine(
        worldInfo,
        character,
        engineState.historicalRecords || [],
        storyTurnCount,
        engineState.diagnostics
      );

      let nextEngineState: import('./types').EngineState = {
        ...engineState,
        historicalRecords: [...(engineState.historicalRecords || [])],
        pendingCandidates: [...(engineState.pendingCandidates || [])],
        validationLogs: [...(engineState.validationLogs || [])],
        latencyHistory: [...(engineState.latencyHistory || [])],
        turnTraces: [...(engineState.turnTraces || [])],
        checkpoints: [...(engineState.checkpoints || [])],
        saveDietEvents: [...(engineState.saveDietEvents || [])],
        lastContextSnapshot: contextSnapshot || engineState.lastContextSnapshot,
        lastRawResponse: rawOutputText
      };

      let turnVerdict: import('./types').TurnTrace['verdict'] = 'NO_CANDIDATE';
      let turnRejections: string[] = [];
      let turnCommittedIds: string[] = [];

      // Check if server explicitly issued and authorized a candidate state mutation
      const hasAuthorizedMutation = Boolean(metaData && data?.selectedCandidateId && !data?.isFallbackNonMutation);

      if (hasAuthorizedMutation) {
        // 1. Extract raw CandidatePacket from server-authorized metadata
        const candidate: CandidatePacket = extractCandidatesFromMetadata(
          metaData,
          storyTurnCount,
          currentWorldInfo.currentTime.formattedTime
        );

        // 2. Build Safe Proposal via Sovereign Proposal Builder with 8 Narrative Defense Rules
        const snapshot = engine.getSnapshot();
        const proposal = buildSafeProposalFromCandidate(
          snapshot,
          candidate,
          storyTurnCount,
          engine.getHistory()
        );

        // 3. Submit Proposal to Sovereign Engine Commit Gate (Atomic Validation & Commit)
        const commitResult = engine.submitProposal(proposal);

        if (commitResult.success) {
          currentWorldInfo = commitResult.snapshot.worldInfo;
          currentCharacter = commitResult.snapshot.character;

          turnVerdict = 'PASSED';
          turnCommittedIds = commitResult.newHistoricalRecords.map(r => r.recordId);

          const diagnosticLog: ValidationDiagnosticLog = {
            logId: `log-${Date.now()}`,
            turn: storyTurnCount,
            timestamp: new Date().toISOString(),
            outcome: 'PASSED',
            details: `Turn ${storyTurnCount} candidate packet committed cleanly (${commitResult.committedActionsCount} actions, StateVersion: ${commitResult.stateVersion}).`,
            rejectedReasons: []
          };

          nextEngineState.historicalRecords = engine.getHistory() as any;
          nextEngineState.diagnostics = engine.getDiagnostics();
          nextEngineState.pendingCandidates.push(candidate);
          nextEngineState.validationLogs.push(diagnosticLog);

          traceSteps.push({
            step: 'T6_VALIDATED',
            status: 'OK',
            timestamp: Date.now(),
            details: 'Proposal passed all Sovereign Engine commit gate rules'
          });

          traceSteps.push({
            step: 'T7_COMMITTED',
            status: 'OK',
            timestamp: Date.now(),
            details: `Committed ${commitResult.committedActionsCount} actions into canonical state (StateVersion: ${commitResult.stateVersion})`
          });

          setWorldInfo(commitResult.snapshot.worldInfo);
          setCharacter(commitResult.snapshot.character);

          // Commit-First UI: Reveal narrative only after successful Sovereign Engine commit
          const assistantMessage: StoryMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: rawOutputText,
            cleanText: cleanText || rawOutputText,
            metaData: metaData || undefined,
            rawMetaBlock: rawMetaBlock || undefined,
            rawResponse: rawOutputText,
            contextSnapshot: contextSnapshot || undefined,
            turn: storyTurnCount,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setStoryTurnCount(prev => prev + 1);
        } else {
          // Safe No-Commit: Canonical State remains unmodified & Narrative is isolated
          turnVerdict = 'REJECTED';
          turnRejections = [...commitResult.rejectedReasons, ...commitResult.conflictDetails];

          const diagnosticLog: ValidationDiagnosticLog = {
            logId: `log-${Date.now()}`,
            turn: storyTurnCount,
            timestamp: new Date().toISOString(),
            outcome: 'REJECTED',
            details: `Turn ${storyTurnCount} proposal rejected by Sovereign Gate: ${commitResult.rejectedReasons.join('; ')}`,
            rejectedReasons: turnRejections
          };

          nextEngineState.validationLogs.push(diagnosticLog);

          traceSteps.push({
            step: 'T6_VALIDATED',
            status: 'REJECTED',
            timestamp: Date.now(),
            details: `Sovereign Commit Gate rejected: ${commitResult.rejectedReasons.join('; ')}`
          });

          traceSteps.push({
            step: 'T7_COMMITTED',
            status: 'REJECTED',
            timestamp: Date.now(),
            details: 'Canonical state protected without mutation (Atomic safe no-commit)'
          });

          setModelError(`[VEIL_COMMIT_BLOCKED] 제안된 변이가 5.7 Commit Gate에서 거부되었습니다: ${commitResult.rejectedReasons.join('; ')}`);
        }
      } else {
        traceSteps.push({
          step: 'T6_VALIDATED',
          status: 'SKIPPED',
          timestamp: Date.now(),
          details: 'No candidate state mutation proposed'
        });
        traceSteps.push({
          step: 'T7_COMMITTED',
          status: 'SKIPPED',
          timestamp: Date.now(),
          details: 'Canonical state unchanged'
        });

        // Non-mutation turn: Display pure narrative
        const assistantMessage: StoryMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: rawOutputText,
          cleanText: cleanText || rawOutputText,
          metaData: undefined,
          rawMetaBlock: rawMetaBlock || undefined,
          rawResponse: rawOutputText,
          contextSnapshot: contextSnapshot || undefined,
          turn: storyTurnCount,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setStoryTurnCount(prev => prev + 1);
      }

      // Checkpoint Snapshot (Every 100 turns or first turn)
      if (storyTurnCount === 1 || storyTurnCount % 100 === 0) {
        const lastCheckpoint = nextEngineState.checkpoints && nextEngineState.checkpoints.length > 0
          ? nextEngineState.checkpoints[nextEngineState.checkpoints.length - 1]
          : null;

        const diffSummary = lastCheckpoint
          ? `Changes since Turn ${lastCheckpoint.turn}: +${nextEngineState.historicalRecords.length - lastCheckpoint.historicalRecordCount} records, +${currentWorldInfo.npcs.length - lastCheckpoint.npcCount} NPCs, Chapter: "${lastCheckpoint.chapter}" -> "${currentWorldInfo.chapters?.currentChapter || '서막'}"`
          : `Initial baseline checkpoint at Turn ${storyTurnCount}`;

        const checkpoint: import('./types').CheckpointSnapshot = {
          turn: storyTurnCount,
          timestamp: new Date().toISOString(),
          chapter: currentWorldInfo.chapters?.currentChapter || '서막',
          narrativeTime: currentWorldInfo.currentTime.formattedTime,
          characterStats: {
            STR: currentCharacter.stats.strength,
            AGI: currentCharacter.stats.agility,
            CON: currentCharacter.stats.constitution,
            INT: currentCharacter.stats.intelligence,
            WIS: currentCharacter.stats.wisdom,
            CHA: currentCharacter.stats.charisma
          },
          inventoryCount: currentCharacter.inventory.length,
          npcCount: currentWorldInfo.npcs.length,
          seedCount: currentWorldInfo.seeds.length,
          historicalRecordCount: nextEngineState.historicalRecords.length,
          diffSummary
        };
        nextEngineState.checkpoints = [...(nextEngineState.checkpoints || []), checkpoint];
      }

      // Check for token diet threshold and log event if active
      if (newMessages.length > 20 && storyTurnCount % 10 === 0) {
        const dietEvent: import('./types').SaveDietEvent = {
          eventId: `diet-${Date.now()}`,
          turn: storyTurnCount,
          timestamp: new Date().toISOString(),
          eventType: 'AUTO_DIET_TRIGGERED',
          version: '3.1.0',
          details: `Token diet window active: 20 verbatim messages retained, ${newMessages.length - 20} messages compressed into summary packet`,
          messageCountBefore: newMessages.length,
          messageCountAfter: 20
        };
        nextEngineState.saveDietEvents = [...(nextEngineState.saveDietEvents || []), dietEvent];
      }

      // Record Turn Trace
      const fullTrace: import('./types').TurnTrace = {
        turn: storyTurnCount,
        timestamp: new Date().toISOString(),
        playerInput: userPrompt,
        contextSnapshotSnippet: contextSnapshot ? contextSnapshot.slice(0, 300) + '...' : undefined,
        rawResponseSnippet: rawOutputText ? rawOutputText.slice(0, 300) + '...' : undefined,
        steps: traceSteps,
        verdict: turnVerdict,
        rejections: turnRejections,
        committedRecordIds: turnCommittedIds
      };
      nextEngineState.turnTraces = [...(nextEngineState.turnTraces || []), fullTrace];

      // Record Turn Latency Metrics
      const latencyReport = profiler.markUIUpdateComplete();
      nextEngineState.latencyHistory.push(latencyReport);
      setEngineState(nextEngineState);

      // Check if GM requested a dice roll
      if (metaData && metaData.recommendedDC) {
        setWaitingForRoll({
          targetDC: metaData.recommendedDC,
          statType: 'agility',
          actionContext: metaData.dcReason || '위기 대처 및 행동 판정'
        });
      } else {
        setWaitingForRoll(null);
      }
    } catch (err: any) {
      console.error('[API Turn Execution Error]', err);
      setModelError(err.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }, [character, worldInfo, engineState, messages, storyTurnCount, isGenerating, selectedModel]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {gameState === 'creation' ? (
        <CreationPhase
          character={character}
          worldInfo={worldInfo}
          language={language}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onUpdateCharacter={handleUpdateCharacter}
          onUpdateWorldInfo={handleUpdateWorldInfo}
          onCompleteCreation={handleCompleteCreation}
        />
      ) : (
        <GameInterface
          character={character}
          worldInfo={worldInfo}
          messages={messages}
          engineState={engineState}
          storyTurnCount={storyTurnCount}
          waitingForRoll={waitingForRoll}
          language={language}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          fontSize={fontSize}
          onChangeFontSize={handleUpdateFontSize}
          onUpdateCharacter={handleUpdateCharacter}
          onUpdateWorldInfo={handleUpdateWorldInfo}
          onUpdateEngineState={handleUpdateEngineState}
          onSendMessage={handleSendMessage}
          onResetSession={handleResetSession}
          onLoadSession={handleLoadSession}
          isGenerating={isGenerating}
          modelError={modelError}
        />
      )}
    </div>
  );
}
