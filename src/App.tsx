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
import { SovereignEngine } from './engine/state';
import { generateProposalId } from './engine/proposalParser';
import { observeCandidateNovelHistory } from './engine/index/novelHistory';
import { projectPassports } from './engine/index/passport';
import { StateTransitionProposal, TransitionAction } from './engine/types';
import { actionToMeaningNode, adaptMeaningTreeToProposal } from './engine/language';
import { TurnLatencyProfiler } from './utils/latency';
import {
  getStoredNarrativeLocale,
  setStoredNarrativeLocale,
  getEffectiveNarrativeLocale
} from './utils/locale';
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
  const [narrativeLocale, setNarrativeLocale] = useState<string>(() => getStoredNarrativeLocale());
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
    curDiag?: any,
    genesisSnapshot?: import('./engine/types').CanonicalState
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
        curHistory || [],
        undefined,
        undefined,
        genesisSnapshot
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

  // 1. Storage Hydration on Mount (Strict Sovereign Verification Before UI Mutation)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let parsedForLog: any = null;
      try {
        if (saved) parsedForLog = JSON.parse(saved);
      } catch (e) {}
      console.log('[STORAGE_HYDRATION_FORENSIC]', JSON.stringify({
        storageKey: STORAGE_KEY,
        hasSaved: !!saved,
        savedRaw: saved,
        parsedCharacter: parsedForLog?.character ?? null,
        parsedWorldInfo: parsedForLog?.worldInfo ?? null,
        parsedStoryTurnCount: parsedForLog?.storyTurnCount ?? null
      }, null, 2));

      if (saved) {
        const parsed: SessionPayload = JSON.parse(saved);
        if (parsed.character && parsed.worldInfo) {
          const loadedWorld = deepMerge(createEmptyWorldInfo(), parsed.worldInfo);
          const loadedChar = deepMerge(createEmptyCharacter(), parsed.character);
          const loadedTurn = parsed.storyTurnCount || 1;
          const loadedHistory = (parsed.engineState?.historicalRecords as any) || [];
          const loadedDiag = parsed.engineState?.diagnostics;

          const resolvedVersion =
            typeof loadedDiag?.stateVersion === 'number' && loadedDiag.stateVersion >= 1
              ? loadedDiag.stateVersion
              : typeof loadedTurn === 'number' && loadedTurn >= 1
              ? loadedTurn
              : 1;

          // Sovereign Gate: MUST Hydrate & Verify BEFORE setting any UI state
          const hydratedEngine = SovereignEngine.hydrate(
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

          // Succeeded: Authoritative engine is stored and UI state synchronized from verified snapshot
          sovereignEngineRef.current = hydratedEngine;
          const snap = hydratedEngine.getSnapshot();
          setCharacter(snap.character);
          setWorldInfo(snap.worldInfo);
          setMessages(parsed.messages || []);
          setStoryTurnCount(snap.turn);
          setGameState(parsed.messages && parsed.messages.length > 0 ? 'playing' : 'creation');
          if (parsed.engineState) {
            const snap = hydratedEngine.getSnapshot();
            const hist = hydratedEngine.getHistory();
            const novelRecs = parsed.engineState.novelHistoryRecords || [];
            const derivedPassports = projectPassports(snap, hist, novelRecs);
            setEngineState({
              ...parsed.engineState,
              passports: derivedPassports
            });
          }
          if (parsed.selectedModel) {
            setSelectedModel(parsed.selectedModel);
          }
          if (parsed.narrativeLocale) {
            setNarrativeLocale(parsed.narrativeLocale);
            setStoredNarrativeLocale(parsed.narrativeLocale);
          }
        }
      }
    } catch (e: any) {
      console.warn('[SOVEREIGN_HYDRATION_FAILED] Failed to hydrate session from localStorage:', e);
      // Strict Fail-Closed: Quarantined safe state & zero mutation of untrusted payload
      localStorage.removeItem(STORAGE_KEY);
      sovereignEngineRef.current = new SovereignEngine(
        createEmptyWorldInfo(),
        createEmptyCharacter(),
        [],
        1,
        1
      );
      setCharacter(createEmptyCharacter());
      setWorldInfo(createEmptyWorldInfo());
      setMessages([]);
      setStoryTurnCount(1);
      setGameState('creation');
      setEngineState(createEmptyEngineState());
      setModelError(`[SOVEREIGN_HYDRATION_FAILED] 저장 데이터 무결성 검증 실패: ${e?.message || 'Replay 검증 거부'}`);
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
          language,
          narrativeLocale,
          genesisSnapshot: sovereignEngineRef.current ? sovereignEngineRef.current.getGenesisSnapshot() : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('Failed to persist session to localStorage:', e);
      }
    }
  }, [character, worldInfo, messages, engineState, storyTurnCount, gameState, selectedModel, language, narrativeLocale]);

  // Partial Update Handlers routed through Sovereign Gate during active gameplay
  const handleUpdateCharacter = (partial: Partial<Character>) => {
    if (gameState === 'playing') {
      const engine = sovereignEngineRef.current;
      if (!engine) {
        console.error('[SOVEREIGN_VIOLATION] Direct character update blocked: Engine is not initialized in playing state.');
        return;
      }
      const snap = engine.getSnapshot();
      const nextChar = { ...snap.character, ...partial };
      const action: TransitionAction = {
        type: 'OVERWRITE_CHARACTER',
        payload: nextChar
      };
      const meaningTree = actionToMeaningNode(action, 'PROPOSAL');
      const proposal = adaptMeaningTreeToProposal(meaningTree, {
        proposalId: generateProposalId('prop-player-char'),
        requestId: generateProposalId('req-player-char'),
        eventId: generateProposalId('evt-player-char'),
        expectedStateVersion: snap.stateVersion,
        source: 'PLAYER',
        turn: storyTurnCount,
        timestamp: new Date().toISOString(),
        intentSummary: 'Player manual character edit'
      });
      const res = engine.submitProposal(proposal);
      if (res.success) {
        setCharacter(res.snapshot.character);
        setEngineState(prev => {
          const novelRecs = prev.novelHistoryRecords || [];
          const derivedPassports = projectPassports(
            res.snapshot,
            engine.getHistory(),
            novelRecs
          );
          return {
            ...prev,
            passports: derivedPassports,
            historicalRecords: engine.getHistory() as any,
            diagnostics: engine.getDiagnostics()
          };
        });
      }
    } else {
      // Creation mode: pre-game character building
      setCharacter(prev => ({ ...prev, ...partial }));
    }
  };

  const handleUpdateWorldInfo = (partial: Partial<WorldInfo>) => {
    if (gameState === 'playing') {
      const engine = sovereignEngineRef.current;
      if (!engine) {
        console.error('[SOVEREIGN_VIOLATION] Direct world info update blocked: Engine is not initialized in playing state.');
        return;
      }
      const snap = engine.getSnapshot();
      const nextWorld = { ...snap.worldInfo, ...partial };
      const proposal: StateTransitionProposal = {
        proposalId: generateProposalId('prop-player-world'),
        requestId: generateProposalId('req-player-world'),
        eventId: generateProposalId('evt-player-world'),
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
        setEngineState(prev => {
          const novelRecs = prev.novelHistoryRecords || [];
          const derivedPassports = projectPassports(
            res.snapshot,
            engine.getHistory(),
            novelRecs
          );
          return {
            ...prev,
            passports: derivedPassports,
            historicalRecords: engine.getHistory() as any,
            diagnostics: engine.getDiagnostics()
          };
        });
      }
    } else {
      // Creation mode: pre-game world building
      setWorldInfo(prev => ({ ...prev, ...partial }));
    }
  };

  const handleUpdateEngineState = (partial: Partial<EngineState>) => {
    setEngineState(prev => ({ ...prev, ...partial }));
  };

  // Complete Creation Phase and Launch Campaign
  const handleCompleteCreation = async () => {
    console.log('[CREATION_STATE_FORENSIC]', JSON.stringify({
      worldInfo,
      character,
      storyTurnCount,
      gameState
    }, null, 2));

    const genesisTurn = 1;
    const cleanWorldInfo = deepMerge(createEmptyWorldInfo(), worldInfo);
    const cleanCharacter = deepMerge(createEmptyCharacter(), character);

    console.log('[GENESIS_STATE_FORENSIC]', JSON.stringify({
      worldInfo: cleanWorldInfo,
      character: cleanCharacter,
      storyTurnCount: genesisTurn,
      gameState: 'playing'
    }, null, 2));

    // Initialize Sovereign Engine with pristine genesis state
    const genesisEngine = new SovereignEngine(
      cleanWorldInfo,
      cleanCharacter,
      [],
      1,
      1
    );
    sovereignEngineRef.current = genesisEngine;

    // Baseline Identity Passport Projection for Genesis State strictly from genesis snapshot & empty history
    const initialPassports = projectPassports(
      genesisEngine.getSnapshot(),
      [],
      []
    );

    // Pristine EngineState with ZERO leakage from previous runtime state
    const cleanEngineState: EngineState = {
      ...createEmptyEngineState(),
      passports: initialPassports,
      historicalRecords: [],
      diagnostics: genesisEngine.getDiagnostics()
    };

    setCharacter(cleanCharacter);
    setWorldInfo(cleanWorldInfo);
    setMessages([]);
    setEngineState(cleanEngineState);
    setStoryTurnCount(genesisTurn);
    setWaitingForRoll(null);
    setModelError(null);
    setGameState('playing');

    // Initial opening prompt to GM
    const initialPrompt = `[서사 개막 선언]
세계관: ${cleanWorldInfo.worldName || '미지의 세계'} (${cleanWorldInfo.toneStyle || '원작 고유의 문체 충실 재현'})
시대/배경: ${cleanWorldInfo.settingDescription || '새로운 이야기가 태동하는 시대'}
주인공: ${cleanCharacter.name || '주인공'} (나이: ${cleanCharacter.age || '미상'}, 성별: ${cleanCharacter.gender || '미상'})
출신: [${cleanCharacter.backgroundType || 'preset'}] ${cleanCharacter.originBackground || '미상'}
결핍: [${cleanCharacter.flawType || 'preset'}] ${cleanCharacter.flaw || '없음'}
맹세: [${cleanCharacter.oathType || 'preset'}] ${cleanCharacter.oath || '없음'}
닻: [${cleanCharacter.anchorType || 'preset'}] ${cleanCharacter.anchor || '없음'}
문파/세력: [${cleanCharacter.factionType || 'preset'}] ${cleanCharacter.faction || '무소속'}
${cleanCharacter.physicalDefect ? `신체 결손/낭만 돌파구: ${cleanCharacter.physicalDefect}` : ''}
궁극적 목표: ${cleanCharacter.goal || '자신의 길을 개척하는 것'}

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

  // Load Session from Cloud or Code (Strict Sovereign Verification Before UI Mutation)
  const handleLoadSession = (loadedPayload: SessionPayload) => {
    if (loadedPayload.character && loadedPayload.worldInfo) {
      try {
        const loadedWorld = deepMerge(createEmptyWorldInfo(), loadedPayload.worldInfo);
        const loadedChar = deepMerge(createEmptyCharacter(), loadedPayload.character);
        const loadedTurn = loadedPayload.storyTurnCount || 1;
        const loadedHistory = (loadedPayload.engineState?.historicalRecords as any) || [];
        const loadedDiag = loadedPayload.engineState?.diagnostics;
        const resolvedVersion =
          typeof loadedDiag?.stateVersion === 'number' && loadedDiag.stateVersion >= 1
            ? loadedDiag.stateVersion
            : loadedHistory.length ? loadedHistory.length + 1 : 1;

        // Sovereign Gate: MUST Hydrate & Verify BEFORE setting any UI state
        const hydratedEngine = SovereignEngine.hydrate(
          {
            stateVersion: resolvedVersion,
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

        // Succeeded: Authoritative engine is stored and UI state synchronized from verified snapshot
        sovereignEngineRef.current = hydratedEngine;
        const snap = hydratedEngine.getSnapshot();
        const hist = hydratedEngine.getHistory();
        const novelRecs = loadedPayload.engineState?.novelHistoryRecords || [];
        const derivedPassports = projectPassports(snap, hist, novelRecs);

        if (loadedPayload.narrativeLocale) {
          setNarrativeLocale(loadedPayload.narrativeLocale);
          setStoredNarrativeLocale(loadedPayload.narrativeLocale);
        }

        setCharacter(snap.character);
        setWorldInfo(snap.worldInfo);
        setMessages(loadedPayload.messages || []);
        setStoryTurnCount(snap.turn);
        setEngineState({
          ...(loadedPayload.engineState || createEmptyEngineState()),
          passports: derivedPassports
        });
        setGameState('playing');
        setWaitingForRoll(null);
        setModelError(null);
      } catch (err: any) {
        console.error('[SOVEREIGN_HYDRATION_ERROR] Failed to load session:', err);
        setModelError(`[SOVEREIGN_HYDRATION_FAILED] 세션 불러오기 실패 (역사 무결성/Replay 거부): ${err?.message || '검증 실패'}`);
        // Strict Fail-Closed: DO NOT change gameState to 'playing', DO NOT mutate character/world
      }
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
    console.log('[SESSION_FORENSIC]', {
      turn: storyTurnCount,
      isInitial,
      messagesLengthBefore: messages.length,
      newMessagesLength: newMessages.length,
      messages: newMessages.map((m, idx) => ({
        index: idx,
        role: m.role,
        turn: m.turn,
        contentPrefix: (m.cleanText || m.content || '').slice(0, 100)
      }))
    });
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
      const effectiveLoc = getEffectiveNarrativeLocale(narrativeLocale);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VEIL-Narrative-Locale': effectiveLoc
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          worldInfo,
          character,
          engineState,
          storyTurnCount,
          userPrompt,
          selectedModel,
          narrativeLocale: effectiveLoc
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
      const authorizedProposal: StateTransitionProposal | null = data?.authorizedProposal || null;
      const authorizedCandidatePacket: CandidatePacket | null = data?.authorizedCandidatePacket || null;

      const hasAuthorizedMutation = Boolean(
        authorizedProposal &&
        Array.isArray(authorizedProposal.actions) &&
        authorizedProposal.actions.length > 0 &&
        !data?.isFallbackNonMutation
      );

      if (hasAuthorizedMutation && authorizedProposal) {
        // Direct Sovereign Commit Gate invocation using Server-PreAuthorized Proposal (Proposal A)
        const commitResult = engine.submitProposal(authorizedProposal);

        if (commitResult.success) {
          currentWorldInfo = commitResult.snapshot.worldInfo;
          currentCharacter = commitResult.snapshot.character;

          // Commit-First Novel History Observation & Promotion: ONLY on successful commit
          const currentNovelRecords = (nextEngineState as any).novelHistoryRecords || [];
          const candidateForObservation: CandidatePacket = authorizedCandidatePacket || ({
            candidateId: String(data?.selectedCandidateId || 1),
            turn: currentWorldInfo.dcHistory?.length || 1,
            timestamp: new Date().toISOString(),
            narrativeSummary: cleanText || '',
            npcChanges: [],
            inventoryChanges: [],
            secretChanges: [],
            statChanges: {},
            currentTimeChange: undefined,
            factCheckSummary: '',
            physicalDefect: undefined
          } as unknown as CandidatePacket);

          const observationResult = observeCandidateNovelHistory(
            currentNovelRecords,
            candidateForObservation,
            authorizedProposal,
            commitResult.snapshot,
            storyTurnCount,
            engine.getHistory()
          );
          (nextEngineState as any).novelHistoryRecords = observationResult.updatedRecords;

          // Identity Passport Projection: Deterministic derived-state from Authoritative State + History + NovelHistory
          const derivedPassports = projectPassports(
            commitResult.snapshot,
            engine.getHistory(),
            observationResult.updatedRecords
          );
          nextEngineState.passports = derivedPassports;

          turnVerdict = 'PASSED';
          turnCommittedIds = commitResult.newHistoricalRecords.map(r => r.recordId);

          const diagnosticLog: ValidationDiagnosticLog = {
            logId: `log-${Date.now()}`,
            turn: storyTurnCount,
            timestamp: new Date().toISOString(),
            outcome: 'PASSED',
            details: `Turn ${storyTurnCount} authorized proposal committed cleanly (${commitResult.committedActionsCount} actions, StateVersion: ${commitResult.stateVersion}).`,
            rejectedReasons: []
          };

          nextEngineState.historicalRecords = engine.getHistory() as any;
          nextEngineState.diagnostics = engine.getDiagnostics();
          if (authorizedCandidatePacket) {
            nextEngineState.pendingCandidates.push(authorizedCandidatePacket);
          }
          nextEngineState.validationLogs.push(diagnosticLog);

          traceSteps.push({
            step: 'T6_VALIDATED',
            status: 'OK',
            timestamp: Date.now(),
            details: 'Authorized proposal passed all Sovereign Engine commit gate rules'
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
            content: cleanText,
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
          // Safe No-Commit: Canonical State and Novel History remain unmodified & Narrative is isolated
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
            details: 'Canonical state and Novel History protected without mutation (Atomic safe no-commit)'
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
          content: cleanText,
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
  }, [character, worldInfo, engineState, messages, storyTurnCount, isGenerating, selectedModel, narrativeLocale]);

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
          onLanguageChange={setLanguage}
          narrativeLocale={narrativeLocale}
          onNarrativeLocaleChange={setNarrativeLocale}
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
