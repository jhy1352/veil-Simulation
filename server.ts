import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { buildKnowledgeGraph, UniversalKnowledgeGraph, UniversalEntity } from './src/engine/index/knowledgeGraph.ts';
import { DEFAULT_CHAPTER_NAME, DEFAULT_NPC_CLASS } from './src/types.ts';
import { extractCandidatesFromMetadata } from './src/utils/engineValidator.ts';
import { buildSafeProposalFromCandidate, generateProposalId } from './src/engine/proposalParser.ts';
import { EngineValidator } from './src/engine/validator.ts';
import { CanonicalState, StateTransitionProposal } from './src/engine/types.ts';
import { recoverSyntaxAndParseJson } from './src/engine/language/recovery.ts';
import { filterDiverseCandidates } from './src/engine/language/diversity.ts';
import { runCandidateRecoveryGate, parseCandidatesBlock, VeilCandidate } from './src/engine/language/candidateRecoveryGate.ts';
import { integrateSemanticEventsIntoProposal, createEngineSemanticBridgeContext } from './src/engine/language/runtimeSemanticCandidate.ts';
import { getCandidateSemanticEvents } from './src/engine/language/semanticCandidateContract.ts';

const app = express();
const PORT = 3000;

export type { VeilCandidate };
export { parseCandidatesBlock };

app.use(express.json({ limit: '10mb' }));

// In-Memory Cloud Session Store (KV fallback)
const cloudSessions = new Map<string, any>();

// Helper to generate 6-digit collision-resistant alphanumeric key (e.g. X9K2A7)
function generate6DigitSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    code += chars[idx];
  }
  return code;
}

// ============================================================================
// TRPG 3.1 Engine Specification & Technical Architecture (Rev 3.1 Final)
// [Engine Internal Responsibilities - NOT injected to LLM System Instruction]
// ============================================================================
export const ENGINE_SPECIFICATION_REV_3_1 = {
  version: '3.1.0',
  worldAuthority: 'Sovereign Engine Authority (Canonical State & World Rules)',
  truthPipeline: 'PLAYER/LLM CLAIM -> INTERPRETATION -> VALIDATION -> STATE TRANSITION -> CANONICAL COMMIT -> HISTORICAL RECORD',
  csprng: 'window.crypto.getRandomValues() / Node crypto for deterministic gameplay randomness',
  apiEconomy: {
    singleCallPerTurn: true,
    autoRetryProhibited: true,
    errorTransparency: 'Preserve raw status, error code, and stack trace without fictional fallback',
    runtimeModelResolution: 'Model identity determined by backend runtime config and official API response'
  },
  tokenDiet: {
    literalMessageWindow: 20, // 10 Player + 10 GM turns verbatim
    summaryPacketEnabled: true
  },
  persistence: {
    localStorageKey: 'TRPG_ENGINE_SESSION_V1',
    syncCodeLength: 6
  }
} as const;

// ============================================================================
// Master Gemini API System Instruction (TRPG 3.1 Narrative Intelligence Layer)
// [Strictly scoped to LLM Narrative Reasoning, Causality & Truth Authority]
// ============================================================================
export { MASTER_SYSTEM_INSTRUCTION } from './src/engine/language/masterPrompt.ts';
import { MASTER_SYSTEM_INSTRUCTION } from './src/engine/language/masterPrompt.ts';

// Helper for Gemini AI Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// 1. API: /api/chat with Token Diet Algorithm & Latency Instrumentation
app.post('/api/chat', async (req, res) => {
  const reqStartTime = Date.now();
  try {
    const { messages = [], character, worldInfo, customPrompt, userPrompt, storyTurnCount = 1, selectedModel = 'gemini-3.7-flash' } = req.body;
    const effectiveUserPrompt = (userPrompt || customPrompt || '').trim();
    const playerInputId = generateProposalId('input');

    const t1_requestStart = Date.now();
    const ai = getGeminiClient();

    // Token Diet: Keep last 20 messages (10 player + 10 GM) verbatim
    const literalWindow = messages.slice(-20);
    const olderMessages = messages.slice(0, -20);

    let summaryPacket = '';
    if (olderMessages.length > 0) {
      summaryPacket = `[Previous Narrative Summary Packet (Turns 1~${storyTurnCount - 10})]
- 주인공: ${character?.name} (${character?.goal})
- 세계관: ${worldInfo?.worldName} (${worldInfo?.settingDescription})
- 핵심 챕터: ${worldInfo?.chapters?.currentChapter || '서막'}
- 주요 경과: 이전 ${olderMessages.length}개 턴에서 형성된 인연과 사건이 누적되어 있습니다.`;
    }

    // 1. Build Derived Knowledge Graph Context (Read-Only Engine Index)
    let kgContext = '';
    try {
      const histRecords = Array.isArray(req.body.engineState?.historicalRecords)
        ? req.body.engineState.historicalRecords
        : [];
      const canonicalStateForKG = {
        stateVersion: storyTurnCount,
        turn: storyTurnCount,
        worldInfo: worldInfo || {},
        character: character || {},
        lastCommittedEventId: null,
        lastCommittedAt: new Date().toISOString()
      };
      const kg: UniversalKnowledgeGraph = buildKnowledgeGraph(canonicalStateForKG, histRecords);
      const entityList: UniversalEntity[] = Array.from(kg.entities.values());
      const activeEntities = entityList.filter(e => !e.isStaleRelativeToCanonical);
      const staleEntities = entityList.filter(e => e.isStaleRelativeToCanonical);

      const entitySummary = activeEntities.slice(0, 15).map(e => `[${e.entityType}] ${e.name}${e.categoryHint ? ` (${e.categoryHint})` : ''}`).join(', ');
      const staleSummary = staleEntities.length > 0
        ? `\n- 무효/사망 엔티티 (부활/오용 금지): ${staleEntities.map(e => `${e.name} [사유: ${e.staleReason || 'DEAD'}]`).join(', ')}`
        : '';
      const relSummary = kg.relations.slice(0, 10).map(r => `${r.sourceEntityId} --[${r.relationType}]--> ${r.targetEntityId}`).join(', ');

      kgContext = `\n[DERIVED KNOWLEDGE GRAPH — READ-ONLY ENGINE INDEX]
- 활성 정사 엔티티 (${activeEntities.length}개): ${entitySummary || '기본 엔티티'}
- 정사 관계망 (${kg.relations.length}개): ${relSummary || '기본 관계망'}${staleSummary}`;
    } catch (kgErr) {
      console.warn('Knowledge graph construction in server.ts failed gracefully:', kgErr);
    }

    // Compose Contents for Gemini
    const contents: any[] = [];

    // Prepend Context info
    const currentChapter = worldInfo?.chapters?.currentChapter || DEFAULT_CHAPTER_NAME;
    const upcomingChapters: string[] = Array.isArray(worldInfo?.chapters?.upcomingChapters) ? worldInfo.chapters.upcomingChapters : [];

    let upcomingSummary = '';
    if (upcomingChapters.length > 0) {
      upcomingSummary = upcomingChapters.map((ch, idx) => `  ${idx + 1}. ${ch}`).join('\n');
    } else {
      upcomingSummary = '  (현재 등록된 예정 로드맵 없음 — 현재 세계 상태와 플레이어 행동을 바탕으로 이어질 비정사적 미래 예정 로드맵을 자유롭게 재계획하십시오)';
    }

    const roadmapContext = `\n[PLANNED NARRATIVE ROADMAP — NON-CANONICAL]
- 현재 챕터: ${currentChapter}
- 이전 턴 예정 로드맵:
${upcomingSummary}
※ 권한 및 행동 우선순위:
1위: Engine Canonical State (세계 법칙/사실) > 2위: 플레이어의 최신 행동 선언 > 3위: 실제 발생한 사건 결과 > 4위: NPC/세계 정세 > 5위: 활성 복선 > 6위: 이전 턴 로드맵(참고자료)
※ Dynamic Re-planning 수칙:
위 예정 챕터는 비정사적 가설(Non-Canonical Roadmap)입니다. 플레이어가 기존 로드맵과 다른 행동을 하더라도 행동을 절대 제한·거부·왜곡하지 마십시오. 플레이어 행동을 먼저 해결하여 세계 상태를 갱신한 후, 새로운 세계 상태에 맞추어 미래 예정 챕터들을 자유롭게 재계획하십시오.`;

    // Active Seeds & Obtainable Events Context
    const activeSeeds = Array.isArray(worldInfo?.seeds)
      ? worldInfo.seeds.filter((s: any) => s.status === 'active' || s.status === 'dormant')
      : [];
    const seedsContext = activeSeeds.length > 0
      ? `\n[ACTIVE NARRATIVE SEEDS & OBTAINABLE CONTEXT]\n${activeSeeds.map((s: any) => `- [Seed ID: ${s.id}] ${s.content}`).join('\n')}`
      : '';

    const offscreenList = Array.isArray(worldInfo?.offscreenRecords)
      ? worldInfo.offscreenRecords.filter((o: any) => o.visibility === 'PUBLIC' || o.visibility === 'RUMOR' || o.visibility === 'PROTAGONIST_KNOWN')
      : [];
    const offscreenContext = offscreenList.length > 0
      ? `\n[ACTIVE WORLD OFFSCREEN EVENTS]\n${offscreenList.slice(-5).map((o: any) => `- [Event ID: ${o.id}] ${o.eventDescription}`).join('\n')}`
      : '';

    const initialContextPrompt = `[TRPG Campaign Context]
- 세계관명: ${worldInfo?.worldName || '기본 세계'}
- 세계관 설정: ${worldInfo?.settingDescription || ''}
- 문체 스타일: ${worldInfo?.toneStyle || '기본 문체'}
- 주인공 프로필: ${character?.name || '주인공'} (나이: ${character?.age || '미상'}, 성별: ${character?.gender || '미상'})
  * 출신/배경: [${character?.backgroundType || 'preset'}] ${character?.originBackground || '미상'}
  * 결핍/트라우마: [${character?.flawType || 'preset'}] ${character?.flaw || '없음'}
  * 맹세: [${character?.oathType || 'preset'}] ${character?.oath || '없음'}
  * 닻: [${character?.anchorType || 'preset'}] ${character?.anchor || '없음'}
  * 소속/세력: [${character?.factionType || 'preset'}] ${character?.faction || '무소속'}
  * 능력치: STR ${character?.stats?.strength ?? 10} / AGI ${character?.stats?.agility ?? 10} / CON ${character?.stats?.constitution ?? 10} / INT ${character?.stats?.intelligence ?? 10} / WIS ${character?.stats?.wisdom ?? 10} / CHA ${character?.stats?.charisma ?? 10}
  * 소장품: ${(character?.inventory || []).map((i: any) => `${i.name}(x${i.quantity})`).join(', ') || '없음'}
${character?.physicalDefect ? `  * 신체 결함/영구적 제약: ${character?.physicalDefect}` : ''}
${seedsContext}
${offscreenContext}
${kgContext}
${roadmapContext}
${summaryPacket ? `\n${summaryPacket}` : ''}`;

    // Add verbatim history ensuring alternating user/model turns
    literalWindow.forEach((msg: any, idx: number) => {
      const isUser = msg.sender === 'player' || msg.role === 'user';
      let text = msg.content || msg.text || '';
      // If this is the first message in the window and it is a user turn, prepend initial context
      if (idx === 0 && isUser) {
        text = `${initialContextPrompt}\n\n[TURN ${storyTurnCount} PLAYER PROMPT]\n${text}`;
      }
      contents.push({
        role: isUser ? 'user' : 'model',
        parts: [{ text }]
      });
    });

    // If contents is empty, initialize with single user message containing campaign context and user prompt
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: `${initialContextPrompt}\n\n[TURN ${storyTurnCount} PLAYER PROMPT]\n${effectiveUserPrompt || '서사를 시작하고 첫 장면을 묘사하라.'}` }]
      });
    } else if (effectiveUserPrompt) {
      const lastContent = contents[contents.length - 1];
      if (!lastContent || lastContent.role !== 'user' || lastContent.parts[0]?.text !== effectiveUserPrompt) {
        if (lastContent.role === 'user') {
          lastContent.parts[0].text += `\n\n[ADDITIONAL ACTION]\n${effectiveUserPrompt}`;
        } else {
          contents.push({
            role: 'user',
            parts: [{ text: effectiveUserPrompt }]
          });
        }
      }
    }

    // Strict Gemini requirement: Last turn MUST be user
    if (contents.length > 0 && contents[contents.length - 1].role !== 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: effectiveUserPrompt || '상황을 계속 전개하고 다음 장면을 묘사하라.' }]
      });
    }

    const t2_contextAssemblyComplete = Date.now();

    // Determine model and thinking configuration
    let targetModel = 'gemini-3.7-flash';
    const config: any = {
      systemInstruction: MASTER_SYSTEM_INSTRUCTION
    };

    if (selectedModel === 'gemini-3.5-flash' || selectedModel === 'gemini-2.5-flash') {
      targetModel = selectedModel;
      // Gemini 3.5 / 2.5 Flash execution
    } else if (selectedModel === 'gemini-3.6-flash') {
      targetModel = 'gemini-3.6-flash';
      // Gemini 3.6 Flash uses native dynamic thinking by default
    } else {
      // Default: Gemini 3.5 Flash or Gemini 3.7 Flash
      targetModel = selectedModel || 'gemini-3.5-flash';
      if (targetModel === 'gemini-3.7-flash') {
        config.thinkingConfig = {
          thinkingBudget: 4096
        };
      }
    }

    const t3_geminiRequestStart = Date.now();

    // Calculate total input char count
    let inputCharCount = 0;
    contents.forEach(c => {
      c.parts?.forEach((p: any) => {
        if (p.text) inputCharCount += p.text.length;
      });
    });

    // Call Gemini API (Phase 1: Candidate Generation)
    const response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config
    });

    const t4_geminiResponseReceived = Date.now();

    console.log('[Google Gemini Runtime Evidence - Phase 1]', {
      requestedModel: targetModel,
      actualModelVersion: response.modelVersion,
      responseId: response.responseId,
      geminiDurationMs: t4_geminiResponseReceived - t3_geminiRequestStart,
      contextAssemblyMs: t2_contextAssemblyComplete - t1_requestStart
    });

    const rawPhase1Response = response.text || '';
    const rawCandidates = parseCandidatesBlock(rawPhase1Response);

    // VEIL Enforcement: Check if candidates block is present
    if (!rawCandidates) {
      // Non-mutation or missing candidates block: return response directly
      const outputCharCount = rawPhase1Response.length;
      const usageMetadata = (response as any).usageMetadata;

      return res.json({
        success: true,
        text: rawPhase1Response,
        rawResponse: rawPhase1Response,
        contextSnapshot: initialContextPrompt,
        actualModelVersion: response.modelVersion,
        requestedModel: targetModel,
        serverTimings: {
          t1_requestStart,
          t2_contextAssemblyComplete,
          t3_geminiRequestStart,
          t4_geminiResponseReceived,
          contextAssemblyMs: t2_contextAssemblyComplete - t1_requestStart,
          geminiGenerationMs: t4_geminiResponseReceived - t3_geminiRequestStart,
          inputCharCount,
          outputCharCount,
          tokenCount: usageMetadata ? {
            promptTokens: usageMetadata.promptTokenCount,
            candidatesTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount
          } : undefined
        }
      });
    }

    // VEIL Candidate Recovery Gate: Quarantine corrupted candidates deterministically
    const gateResult = runCandidateRecoveryGate<VeilCandidate>(rawCandidates);
    if (gateResult.quarantinedCount > 0) {
      console.warn(`[VEIL Candidate Recovery Gate] Quarantined ${gateResult.quarantinedCount} corrupted candidate(s) out of ${gateResult.totalInputCount}:`, gateResult.quarantinedCandidates);
    }

    const candidates = gateResult.passedCandidates;

    // Fail-Closed: If 0 candidates passed gate, return non-mutation narrative safely
    if (candidates.length === 0) {
      console.warn('[VEIL Candidate Recovery Gate] All candidates quarantined. Failing closed to non-mutation.');
      const outputCharCount = rawPhase1Response.length;
      const usageMetadata = (response as any).usageMetadata;

      return res.json({
        success: true,
        text: rawPhase1Response,
        rawResponse: rawPhase1Response,
        isFallbackNonMutation: true,
        quarantinedCount: gateResult.quarantinedCount,
        contextSnapshot: initialContextPrompt,
        actualModelVersion: response.modelVersion,
        requestedModel: targetModel,
        serverTimings: {
          t1_requestStart,
          t2_contextAssemblyComplete,
          t3_geminiRequestStart,
          t4_geminiResponseReceived,
          contextAssemblyMs: t2_contextAssemblyComplete - t1_requestStart,
          geminiGenerationMs: t4_geminiResponseReceived - t3_geminiRequestStart,
          inputCharCount,
          outputCharCount,
          tokenCount: usageMetadata ? {
            promptTokens: usageMetadata.promptTokenCount,
            candidatesTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount
          } : undefined
        }
      });
    }

    // VEIL Constraint: 1 to 5 candidate packets (ceiling of 5)
    if (candidates.length < 1 || candidates.length > 5) {
      return res.status(422).json({
        error: `[VEIL_CANDIDATE_VIOLATION] LLM #1 generated ${candidates.length} valid candidates, but VEIL strictly requires between 1 and 5 candidates (ceiling of 5).`,
        rawResponse: rawPhase1Response
      });
    }

    // Phase 1.5: Translation -> Diversity Gate -> Sovereign Pre-Authorization Gate
    const engineState = req.body.engineState;
    const stateVersion = typeof engineState?.stateVersion === 'number' ? engineState.stateVersion : storyTurnCount;
    const lastCommittedEventId = engineState?.lastCommittedEventId ?? null;
    const lastCommittedAt = engineState?.lastCommittedAt ?? new Date().toISOString();

    const canonicalState: CanonicalState = {
      stateVersion,
      turn: storyTurnCount,
      worldInfo: worldInfo || {},
      character: character || {},
      lastCommittedEventId,
      lastCommittedAt
    };

    const executedRequestIds = new Set<string>(
      Array.isArray(engineState?.executedRequestIds) ? engineState.executedRequestIds : []
    );
    const recordedEventIds = new Set<string>(
      Array.isArray(engineState?.recordedEventIds) ? engineState.recordedEventIds : []
    );
    const historicalRecords = Array.isArray(engineState?.historicalRecords)
      ? engineState.historicalRecords
      : [];

    // 1. Translation: Candidate -> Meaning Tree & Proposal
    const bridgeContext = createEngineSemanticBridgeContext(canonicalState, historicalRecords);

    const translatedCandidates = candidates.map(c => {
      const candidatePacket = extractCandidatesFromMetadata(
        c.rawMetadata || {},
        storyTurnCount,
        worldInfo?.currentTime?.formattedTime || '1년차 봄 1일',
        c.candidateId
      );
      const proposal: StateTransitionProposal = buildSafeProposalFromCandidate(
        canonicalState,
        candidatePacket,
        storyTurnCount,
        historicalRecords,
        playerInputId
      );

      const rawSemanticEvents = getCandidateSemanticEvents(c);
      const semanticEvents = rawSemanticEvents.length > 0
        ? rawSemanticEvents
        : getCandidateSemanticEvents(c.rawMetadata);

      let finalProposal = proposal;
      let finalMeaningTree = proposal.meaningTree!;

      if (semanticEvents.length > 0) {
        const integration = integrateSemanticEventsIntoProposal(
          proposal,
          semanticEvents,
          bridgeContext
        );

        if (integration.status === 'MAPPABLE') {
          finalProposal = integration.proposal;
          finalMeaningTree = integration.meaningTree || finalProposal.meaningTree!;
        } else if (integration.status === 'REJECTED') {
          // Fail-closed for invalid / unsupported / ambiguous semantic events
          finalProposal = {
            ...proposal,
            actions: [],
          };
          finalMeaningTree = finalProposal.meaningTree!;
        }
      }

      return {
        candidate: c,
        candidatePacket,
        proposal: finalProposal,
        meaningTree: finalMeaningTree
      };
    });

    // 2. Diversity Gate: Deduplicate structurally identical Meaning Trees
    const diverseCandidatesWithTrees = filterDiverseCandidates(
      translatedCandidates.map(tc => ({ candidate: tc.candidatePacket, meaningTree: tc.meaningTree }))
    );

    // Keep only translated candidates that were retained by the diversity gate
    const candidatesToValidate = translatedCandidates.filter(tc =>
      diverseCandidatesWithTrees.some(d => d.candidate === tc.candidatePacket)
    );

    // 3. Sovereign Pre-Authorization Validation (ALLOW / REJECT)
    const preAuthResults: VeilCandidate[] = candidatesToValidate.map(tc => {
      const validation = EngineValidator.validate(
        tc.proposal,
        canonicalState,
        executedRequestIds,
        recordedEventIds,
        historicalRecords
      );

      return {
        ...tc.candidate,
        preAuthStatus: validation.isValid ? ('ALLOW' as const) : ('REJECT' as const),
        preAuthReasons: validation.isValid ? [] : [...validation.rejectedReasons, ...validation.conflictDetails]
      };
    });

    const allowedCandidates = preAuthResults.filter(c => c.preAuthStatus === 'ALLOW');

    // Requirement 6: ALL REJECT fallback -> NO_CANONICAL_MUTATION with clean literary fallback
    if (allowedCandidates.length === 0) {
      console.log('[VEIL Pre-Authorization Gate] All candidates REJECTED. Executing non-mutation literary fallback...');
      const fallbackPrompt = `[SOVEREIGN VEIL PIPELINE - NON-MUTATION FALLBACK]
All proposed state mutations for this turn were rejected by the Sovereign Engine Pre-Authorization Gate due to causality or world constraints.
You MUST write a rich, engaging, immersive non-mutation narrative for this scene.

STRICT INVARIANTS:
1. Do NOT propose or assert any persistent state mutations (no unbacked item acquisitions, stat changes, or permanent modifications).
2. Do NOT mention engine mechanics, system codes, rejections, or rules in the narrative prose.
3. Write standard literary narrative advancing the dialogue, sensory details, and character interaction without canonical state mutations.`;

      const fallbackContents = [
        ...contents,
        {
          role: 'user',
          parts: [{ text: fallbackPrompt }]
        }
      ];

      const fallbackResponse = await ai.models.generateContent({
        model: targetModel,
        contents: fallbackContents,
        config: {
          systemInstruction: MASTER_SYSTEM_INSTRUCTION
        }
      });

      const rawFallbackResponse = fallbackResponse.text || '';
      const outputCharCount = rawFallbackResponse.length;
      const usageMetadata = (fallbackResponse as any).usageMetadata;

      return res.json({
        success: true,
        text: rawFallbackResponse,
        rawResponse: rawFallbackResponse,
        isFallbackNonMutation: true,
        selectedCandidateId: null,
        authorizedCandidate: null,
        authorizedCandidatePacket: null,
        authorizedProposal: null,
        preAuthSummary: {
          total: candidates.length,
          allowed: 0,
          rejected: candidates.length
        },
        contextSnapshot: initialContextPrompt,
        actualModelVersion: fallbackResponse.modelVersion,
        requestedModel: targetModel,
        serverTimings: {
          t1_requestStart,
          t2_contextAssemblyComplete,
          t3_geminiRequestStart,
          t4_geminiResponseReceived: Date.now(),
          contextAssemblyMs: t2_contextAssemblyComplete - t1_requestStart,
          geminiGenerationMs: Date.now() - t3_geminiRequestStart,
          inputCharCount,
          outputCharCount,
          tokenCount: usageMetadata ? {
            promptTokens: usageMetadata.promptTokenCount,
            candidatesTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount
          } : undefined
        }
      });
    }

    // Phase 2: LLM #2 Narrative Synthesizer (Choice restricted strictly to ALLOW candidates)
    const phase2Prompt = `[SOVEREIGN VEIL PIPELINE - PHASE 2 NARRATIVE SYNTHESIZER & INTENT FIDELITY JUDGE]
ORIGINAL PLAYER INPUT (PROVENANCE & FIDELITY REFERENCE ONLY - NOT CANONICAL WORLD TRUTH):
${effectiveUserPrompt ? `"${effectiveUserPrompt}"` : '(No explicit player prompt — scene continuation)'}

PRE-AUTHORIZED ALLOW CANDIDATES (ONLY THESE MAY BE SELECTED):
${allowedCandidates.map(c => `[Candidate ${c.candidateId}] "${c.label}"\nSummary: ${c.narrativeSummary}`).join('\n\n')}

INSTRUCTIONS:
1. Compare the Original Player Input above with each of the ALLOW candidates.
2. Select the single candidate from the ALLOWED list that is most faithful to the player's intended action declaration and request.
3. Output a single JSON line specifying the selected candidate ID: {"selectedCandidateId": <number>}
4. Output the full narrative text for this turn describing the selected turn sequence.
5. Do NOT introduce new state changes outside the selected candidate.`;

    const phase2Contents = [
      ...contents,
      {
        role: 'user',
        parts: [{ text: phase2Prompt }]
      }
    ];

    const phase2Response = await ai.models.generateContent({
      model: targetModel,
      contents: phase2Contents,
      config: {
        systemInstruction: MASTER_SYSTEM_INSTRUCTION
      }
    });

    const rawPhase2Response = phase2Response.text || '';
    const selectMatch = rawPhase2Response.match(/\{"selectedCandidateId"\s*:\s*(\d+)\}/i);
    const selectedId = selectMatch ? parseInt(selectMatch[1], 10) : null;
    const selectedCandidate = selectedId !== null ? (allowedCandidates.find(c => c.candidateId === selectedId) || null) : null;
    const selectedTranslated = selectedCandidate
      ? candidatesToValidate.find(tc => tc.candidate.candidateId === selectedCandidate.candidateId) || null
      : null;

    let finalResponseText = '';
    let authorizedCandidateId: number | null = null;
    let authorizedCandidate: VeilCandidate | null = null;
    let authorizedCandidatePacket: any | null = null;
    let authorizedProposal: StateTransitionProposal | null = null;

    if (selectedCandidate && selectedTranslated) {
      // Authorized Candidate exact match: issue approved candidate raw metadata and authorized proposal
      authorizedCandidateId = selectedCandidate.candidateId;
      authorizedCandidate = selectedTranslated.candidate;
      authorizedCandidatePacket = selectedTranslated.candidatePacket;
      authorizedProposal = selectedTranslated.proposal;

      const metaJson = JSON.stringify(selectedCandidate.rawMetadata, null, 2);
      const finalNarrative = rawPhase2Response.replace(/\{"selectedCandidateId"\s*:\s*\d+\}/i, '').trim();
      finalResponseText = `\`\`\`markdown\n${selectedCandidate.rawMetadata?.factCheckSummary || '1) [검증]: 완료'}\n\`\`\`\n\`\`\`json\n${metaJson}\n\`\`\`\n\n${finalNarrative}`;
    } else {
      // FAIL-CLOSED: Missing / UNKNOWN / REJECTED ID or selection parsing failure -> NO mutation metadata issued.
      console.warn(`[VEIL Phase 2] selectedCandidateId '${selectedId}' not found in PreAuth ALLOW list (Allowed IDs: [${allowedCandidates.map(c => c.candidateId).join(', ')}]). Failing closed to non-mutation.`);
      const cleanNarrative = rawPhase2Response.replace(/\{"selectedCandidateId"\s*:\s*\d+\}/i, '').trim();
      finalResponseText = cleanNarrative;
    }

    const outputCharCount = finalResponseText.length;
    const usageMetadata = (phase2Response as any).usageMetadata;

    res.json({
      success: true,
      text: finalResponseText,
      rawResponse: finalResponseText,
      selectedCandidateId: authorizedCandidateId,
      authorizedCandidate,
      authorizedCandidatePacket,
      authorizedProposal,
      originInputId: authorizedCandidateId ? playerInputId : undefined,
      isFallbackNonMutation: !selectedCandidate,
      preAuthSummary: {
        total: candidates.length,
        allowed: allowedCandidates.length,
        rejected: candidates.length - allowedCandidates.length
      },
      contextSnapshot: initialContextPrompt,
      actualModelVersion: phase2Response.modelVersion,
      requestedModel: targetModel,
      serverTimings: {
        t1_requestStart,
        t2_contextAssemblyComplete,
        t3_geminiRequestStart,
        t4_geminiResponseReceived: Date.now(),
        contextAssemblyMs: t2_contextAssemblyComplete - t1_requestStart,
        geminiGenerationMs: Date.now() - t3_geminiRequestStart,
        inputCharCount,
        outputCharCount,
        tokenCount: usageMetadata ? {
          promptTokens: usageMetadata.promptTokenCount,
          candidatesTokens: usageMetadata.candidatesTokenCount,
          totalTokens: usageMetadata.totalTokenCount
        } : undefined
      }
    });
  } catch (err: any) {
    console.error('Chat API Error:', err);
    res.status(500).json({ error: err.message || JSON.stringify(err) });
  }
});

// 2. API: /api/cloud-save (Generate 6-digit sync code)
app.post('/api/cloud-save', (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) {
      return res.status(400).json({ error: 'Missing session payload' });
    }

    const code = generate6DigitSyncCode();
    cloudSessions.set(code, {
      ...payload,
      updatedAt: new Date().toISOString()
    });

    return res.json({ success: true, code });
  } catch (err: any) {
    console.error('Cloud Save Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 3. API: /api/cloud-load/:code
app.get('/api/cloud-load/:code', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const session = cloudSessions.get(code);

    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다. 코드를 확인해 주세요.' });
    }

    return res.json({ success: true, payload: session });
  } catch (err: any) {
    console.error('Cloud Load Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. API: /api/validate-state (DC distribution calculator & NPC masking)
app.post('/api/validate-state', (req, res) => {
  try {
    const { character, worldInfo } = req.body;

    // Sanitize NPC metInStory flag
    const sanitizedNpcs = (worldInfo?.npcs || []).map((npc: any) => {
      if (npc.metInStory === false) {
        return {
          ...npc,
          innerThought: '[미인지 상태]',
          impression: '[미인지 상태]'
        };
      }
      return npc;
    });

    // Auto assign recommended DC from uniform distribution (5~15)
    const dcHistory = worldInfo?.dcHistory || [];
    const dcCounts: Record<number, number> = {};
    for (let i = 5; i <= 15; i++) dcCounts[i] = 0;
    dcHistory.forEach((dc: number) => {
      if (dc >= 5 && dc <= 15) dcCounts[dc] = (dcCounts[dc] || 0) + 1;
    });

    // Find lowest count DC
    let minCount = Infinity;
    let recommendedDc = 10;
    for (let i = 5; i <= 15; i++) {
      if (dcCounts[i] < minCount) {
        minCount = dcCounts[i];
        recommendedDc = i;
      }
    }

    return res.json({ success: true, recommendedDc, sanitizedNpcs });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Vite middleware / Production Static handler
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TRPG Engine Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
