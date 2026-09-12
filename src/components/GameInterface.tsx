import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Character,
  WorldInfo,
  StoryMessage,
  EngineState,
  Language,
  RollEvent,
  GMMetaData,
  ValidationDiagnosticLog,
  GeminiModelType,
  FontSizeLevel
} from '../types';
import { getTranslation } from '../locales';
import { parseGMResponseMetaData, sanitizeNpcRecords, formatRoadmapText } from '../utils/parser';
import { TurnLatencyProfiler } from '../utils/latency';
import { soundEngine } from '../utils/audio';
import { WorldInfoModal } from './WorldInfoModal';
import { CharacterSheetModal } from './CharacterSheetModal';
import { DiceRollerModal } from './DiceRollerModal';
import { CloudSyncModal } from './CloudSyncModal';
import { EngineDiagnosticsModal } from './EngineDiagnosticsModal';
import { ResetConfirmModal } from './ResetConfirmModal';
import { ModelSelector } from './ModelSelector';
import { FontSizeControl } from './FontSizeControl';
import { LocaleSelector } from './LocaleSelector';
import { MetadataAccordion } from './MetadataAccordion';
import {
  Send,
  Dices,
  Globe,
  User,
  Cloud,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  BookOpen,
  EyeOff,
  AlertTriangle,
  Activity,
  Layers,
  FileCode,
  CheckCircle2,
  Volume2,
  VolumeX,
  Swords,
  ScrollText,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameInterfaceProps {
  character: Character;
  worldInfo: WorldInfo;
  messages: StoryMessage[];
  engineState: EngineState;
  storyTurnCount: number;
  waitingForRoll: RollEvent | null;
  language: Language;
  onLanguageChange?: (newLang: Language) => void;
  narrativeLocale?: string;
  onNarrativeLocaleChange?: (newLocale: string) => void;
  selectedModel: GeminiModelType;
  onSelectModel: (model: GeminiModelType) => void;
  fontSize?: FontSizeLevel;
  onChangeFontSize?: (size: FontSizeLevel) => void;
  onUpdateCharacter: (char: Partial<Character>) => void;
  onUpdateWorldInfo: (world: Partial<WorldInfo>) => void;
  onUpdateEngineState: (engine: Partial<EngineState>) => void;
  onSendMessage: (text: string) => Promise<void>;
  onResetSession: () => void;
  onLoadSession: (loadedPayload: any) => void;
  isGenerating: boolean;
  modelError?: string | null;
}

export function GameInterface({
  character,
  worldInfo,
  messages,
  engineState,
  storyTurnCount,
  waitingForRoll,
  language,
  onLanguageChange,
  narrativeLocale = 'system',
  onNarrativeLocaleChange,
  selectedModel,
  onSelectModel,
  fontSize = 'base',
  onChangeFontSize,
  onUpdateCharacter,
  onUpdateWorldInfo,
  onUpdateEngineState,
  onSendMessage,
  onResetSession,
  onLoadSession,
  isGenerating,
  modelError
}: GameInterfaceProps) {
  const [inputText, setInputText] = useState('');
  const [isWorldModalOpen, setIsWorldModalOpen] = useState(false);
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [copiedMeta, setCopiedMeta] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(soundEngine.isAudioMuted());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = getTranslation(language);

  // Extract numbered choices from the latest GM message (if any)
  const detectedChoices = useMemo(() => {
    if (messages.length === 0) return [];
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMsg) return [];

    const lines = lastAssistantMsg.content.split('\n');
    const choices: string[] = [];
    const choiceRegex = /^\s*(?:[1-9]\.|\([1-9]\)|\[[1-9]\]|[①-⑩])\s+(.+)$/;

    for (const line of lines) {
      const match = line.match(choiceRegex);
      if (match && match[1] && match[1].trim().length > 0) {
        choices.push(match[1].trim());
      }
    }
    return choices;
  }, [messages]);

  // Audio Mute Toggle
  const handleToggleMute = () => {
    const newState = soundEngine.toggleMute();
    setIsAudioMuted(newState);
  };

  // Map font size levels to typography classes
  const proseFontSizeClass = {
    sm: 'text-xs sm:text-xs leading-relaxed',
    base: 'text-xs sm:text-sm leading-relaxed',
    lg: 'text-sm sm:text-base leading-loose',
    xl: 'text-base sm:text-lg leading-loose'
  }[fontSize] || 'text-xs sm:text-sm leading-relaxed';

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Handle player sending an action
  const handleSend = async () => {
    if (!inputText.trim() || isGenerating) return;
    soundEngine.playTurnComplete();
    const textToSend = inputText.trim();
    setInputText('');
    await onSendMessage(textToSend);
  };

  // Handle quick choice click
  const handleQuickChoiceClick = (choiceText: string) => {
    if (isGenerating) return;
    soundEngine.playTurnComplete();
    setInputText(choiceText);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Find last raw meta block from assistant message to allow copying
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const lastRawMetaBlock = lastAssistantMessage?.rawMetaBlock || null;
  const [copiedRoadmap, setCopiedRoadmap] = useState<string | null>(null);
  const [copiedRawResponse, setCopiedRawResponse] = useState<string | null>(null);
  const [copiedDiagInfo, setCopiedDiagInfo] = useState<string | null>(null);

  const handleCopyRawMeta = () => {
    if (!lastRawMetaBlock) return;
    navigator.clipboard.writeText(`\`\`\`json\n${lastRawMetaBlock}\n\`\`\``);
    setCopiedMeta(true);
    setTimeout(() => setCopiedMeta(false), 2000);
  };

  // 1. Raw Response Copy (Developer Tool)
  const handleCopyRawResponse = (msg?: StoryMessage, identifier: string = 'last') => {
    const targetMsg = msg || lastAssistantMessage;
    const rawText = targetMsg?.rawResponse || targetMsg?.content || '';
    if (!rawText) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(rawText).then(() => {
        setCopiedRawResponse(identifier);
        setTimeout(() => setCopiedRawResponse(null), 2000);
      }).catch(err => {
        console.warn('Clipboard write failed:', err);
      });
    }
  };

  // 2. Structured Diagnostics Info Copy (Developer Tool)
  const handleCopyDiagnosticsInfo = (msg?: StoryMessage, identifier: string = 'last') => {
    const targetMsg = msg || lastAssistantMessage;
    const turnNumber = targetMsg?.turn || storyTurnCount;
    const matchingTrace = engineState?.turnTraces?.find(t => t.turn === turnNumber);
    const matchingLog = engineState?.validationLogs?.find(l => l.turn === turnNumber);
    const matchingLatency = engineState?.latencyHistory?.find(l => l.turn === turnNumber);

    const diagPayload = {
      turn: turnNumber,
      timestamp: targetMsg?.timestamp || new Date().toISOString(),
      model: selectedModel,
      worldState: {
        worldName: worldInfo.worldName,
        currentChapter: worldInfo.chapters?.currentChapter,
        upcomingChapters: worldInfo.chapters?.upcomingChapters,
        time: worldInfo.currentTime.formattedTime,
        activeSeedsCount: worldInfo.seeds.filter(s => s.status === 'active').length,
        npcsCount: worldInfo.npcs.length,
        dcHistorySummary: worldInfo.dcHistory.slice(-5)
      },
      characterState: {
        name: character.name,
        stats: character.stats,
        inventory: character.inventory
      },
      validationVerdict: matchingTrace?.verdict || matchingLog?.outcome || 'PASSED',
      rejectedReasons: matchingTrace?.rejections || matchingLog?.rejectedReasons || [],
      latencyMs: matchingLatency || undefined,
      pipelineSteps: matchingTrace?.steps || []
    };

    const textToCopy = JSON.stringify(diagPayload, null, 2);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedDiagInfo(identifier);
        setTimeout(() => setCopiedDiagInfo(null), 2000);
      }).catch(err => {
        console.warn('Clipboard write failed:', err);
      });
    }
  };

  // 3. Roadmap Copy
  const handleCopyRoadmap = (customChapters?: { currentChapter?: string; upcomingChapters?: string[] } | null, identifier: string = 'header') => {
    const textToCopy = formatRoadmapText(customChapters || worldInfo.chapters);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedRoadmap(identifier);
        setTimeout(() => setCopiedRoadmap(null), 2000);
      }).catch(err => {
        console.warn('Clipboard write failed:', err);
      });
    }
  };

  // Dice roll submission handler
  const handleDiceRollComplete = (resultText: string) => {
    soundEngine.playDiceRoll();
    if (resultText.includes('대성공') || resultText.includes('성공')) {
      setTimeout(() => soundEngine.playSuccessSound(), 200);
    } else if (resultText.includes('실패')) {
      setTimeout(() => soundEngine.playFailureSound(), 200);
    }
    onSendMessage(resultText);
  };

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-2 sm:p-4 md:p-6 overflow-hidden">
      {/* Top Navbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-stone-900/90 border border-stone-800 backdrop-blur-md shadow-xl shrink-0">
        {/* Left: Brand & World Context */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-950/70 border border-amber-800/50 text-amber-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-bold font-serif text-amber-200">
                {worldInfo.worldName || '세계'}
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-mono">
                {worldInfo.currentTime.formattedTime}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800/60 text-amber-300 font-mono">
                턴 {storyTurnCount || 1}
              </span>
              <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-800/90 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                {(worldInfo.playMode || 'TRPG') === 'TRPG' ? (
                  <Swords className="w-3 h-3 text-amber-400" />
                ) : (
                  <ScrollText className="w-3 h-3 text-indigo-400" />
                )}
                <span>{(worldInfo.playMode || 'TRPG') === 'TRPG' ? 'TRPG 모드' : '서사 모드'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-stone-400 truncate max-w-xs md:max-w-md">
                {worldInfo.chapters?.currentChapter || '서막'}
              </p>
              <button
                id="copy-header-roadmap-btn"
                onClick={() => handleCopyRoadmap(worldInfo.chapters, 'header')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-800/90 hover:bg-stone-700 text-[10px] text-amber-300 transition-colors cursor-pointer border border-amber-900/40 shrink-0"
                title="현재 엔진 상태의 미래 3챕터 로드맵 복사"
              >
                {copiedRoadmap === 'header' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300 font-mono">✓ 복사 완료</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>📋 미래 3챕터 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Modal Triggers & Utilities */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
          {/* Audio Mute/Unmute Toggle */}
          <button
            id="toggle-audio-mute-btn"
            onClick={handleToggleMute}
            className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1 text-xs ${
              isAudioMuted
                ? 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-400'
                : 'bg-amber-950/40 border-amber-800/50 text-amber-400 hover:text-amber-300'
            }`}
            title={isAudioMuted ? '음향 활성화' : '음향 음소거'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Font Size Control for Mobile & Desktop */}
          {onChangeFontSize && (
            <FontSizeControl
              fontSize={fontSize}
              onChangeFontSize={onChangeFontSize}
            />
          )}

          {/* AI Model Selector (Dev & Test) */}
          <ModelSelector
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
          />

          {/* Multilingual Narrative Locale & UI Language Selector */}
          {onNarrativeLocaleChange && onLanguageChange && (
            <LocaleSelector
              language={language}
              onLanguageChange={onLanguageChange}
              narrativeLocale={narrativeLocale}
              onNarrativeLocaleChange={onNarrativeLocaleChange}
            />
          )}

          {/* Diagnostics Button */}
          <button
            id="open-diagnostics-btn"
            onClick={() => setIsDiagnosticsModalOpen(true)}
            className="p-2 rounded-xl bg-stone-950/70 hover:bg-stone-800 border border-amber-900/40 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1 text-xs"
            title="엔진 진단 및 역사 기록"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden md:inline font-mono">엔진 감사</span>
          </button>

          {/* World Lore Button */}
          <button
            id="open-world-info-btn"
            onClick={() => setIsWorldModalOpen(true)}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors cursor-pointer flex items-center gap-1 text-xs"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{t.game.worldInfo}</span>
          </button>

          {/* Character Sheet Button */}
          <button
            id="open-character-sheet-btn"
            onClick={() => setIsCharModalOpen(true)}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors cursor-pointer flex items-center gap-1 text-xs"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">{t.game.characterSheet}</span>
          </button>

          {/* Dice Roller Button */}
          <button
            id="open-dice-roller-btn"
            onClick={() => setIsDiceModalOpen(true)}
            className="p-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-stone-950 font-bold transition-colors cursor-pointer flex items-center gap-1 text-xs shadow-md shadow-amber-950/40"
          >
            <Dices className="w-4 h-4" />
            <span className="hidden sm:inline">{t.game.diceRoller}</span>
          </button>

          {/* Cloud Sync Button */}
          <button
            id="open-cloud-sync-btn"
            onClick={() => setIsCloudModalOpen(true)}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors cursor-pointer flex items-center gap-1 text-xs"
          >
            <Cloud className="w-4 h-4" />
          </button>

          {/* Reset Session Button */}
          <button
            id="reset-session-btn"
            onClick={() => setIsResetConfirmOpen(true)}
            className="p-2 rounded-xl bg-stone-800 hover:bg-rose-900/60 text-stone-400 hover:text-rose-200 transition-colors cursor-pointer text-xs"
            title={t.game.resetSession}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Narrative Conversation Stream */}
      <main className="flex-1 overflow-y-auto my-3 px-2 sm:px-4 py-4 space-y-5 rounded-2xl bg-stone-950/70 border border-stone-800/80 shadow-inner">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-stone-500">
            <Sparkles className="w-8 h-8 text-amber-500/50 animate-pulse" />
            <p className="text-sm font-serif">정통 서사의 첫 장을 열 준비가 완료되었습니다.</p>
            <p className="text-xs text-stone-600">아래 입력창에 주인공의 첫 행동을 선언하거나 대화를 시작하세요.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Message Box */}
              <div
                className={`max-w-3xl rounded-2xl p-4 sm:p-5 space-y-3 leading-relaxed shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-amber-950/50 border border-amber-700/60 text-amber-100 rounded-br-xs'
                    : 'bg-stone-900/90 border border-stone-800 text-stone-200 rounded-bl-xs'
                }`}
              >
                {/* Header Tag */}
                <div className="flex items-center justify-between gap-3 text-[11px] font-mono border-b border-stone-800/60 pb-1.5">
                  <span className={msg.role === 'user' ? 'text-amber-400 font-bold' : 'text-stone-400 font-bold'}>
                    {msg.role === 'user' ? `주인공 (${character.name || '플레이어'})` : 'AI 게임마스터 (정사 서사록)'}
                  </span>
                  <span className="text-stone-500 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Literary Prose Body */}
                <div className={`${proseFontSizeClass} font-serif whitespace-pre-wrap text-stone-200`}>
                  {msg.cleanText || msg.content}
                </div>

                {/* Structured Metadata Badges & Developer Copy Tools if AI GM message */}
                {msg.role === 'assistant' && (
                  <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
                    <div className="flex items-center gap-2 text-stone-400">
                      <span className="text-amber-400">챕터: </span>
                      <span className="text-stone-300 truncate max-w-[140px] sm:max-w-xs">
                        {msg.metaData?.currentChapter || worldInfo.chapters?.currentChapter || '서막'}
                      </span>
                      {msg.metaData?.recommendedDC && (
                        <span className="text-stone-400 ml-1">
                          <span className="text-amber-400">DC: </span>{msg.metaData.recommendedDC}
                        </span>
                      )}
                    </div>

                    {/* Developer Copy Buttons 3-Pack */}
                    <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                      {/* Button A: Diagnostics Info Copy */}
                      <button
                        id={`copy-msg-diag-btn-${msg.id}`}
                        onClick={() => handleCopyDiagnosticsInfo(msg, msg.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-950/80 hover:bg-stone-800 border border-stone-700 hover:border-amber-700/60 text-stone-300 hover:text-amber-300 text-[10px] transition-colors cursor-pointer"
                        title="해당 턴의 구조화된 상태 및 검증 파이프라인 정보 복사"
                      >
                        {copiedDiagInfo === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300 font-bold">✓ 완료</span>
                          </>
                        ) : (
                          <>
                            <Activity className="w-3 h-3 text-amber-400" />
                            <span>📋 디버깅 정보 복사</span>
                          </>
                        )}
                      </button>

                      {/* Button B: Raw Response Copy */}
                      <button
                        id={`copy-msg-raw-btn-${msg.id}`}
                        onClick={() => handleCopyRawResponse(msg, msg.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-950/80 hover:bg-stone-800 border border-stone-700 hover:border-amber-700/60 text-stone-300 hover:text-amber-300 text-[10px] transition-colors cursor-pointer"
                        title="LLM 원본 응답 텍스트 전체 복사"
                      >
                        {copiedRawResponse === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300 font-bold">✓ 완료</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-sky-400" />
                            <span>📋 원문 복사</span>
                          </>
                        )}
                      </button>

                      {/* Button C: Roadmap Copy */}
                      <button
                        id={`copy-msg-roadmap-btn-${msg.id}`}
                        onClick={() => handleCopyRoadmap(worldInfo.chapters, msg.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-950/80 hover:bg-stone-800 border border-amber-900/50 hover:border-amber-700/60 text-amber-300 text-[10px] transition-colors cursor-pointer"
                        title="현재 엔진 상태의 현재 챕터 및 미래 3챕터 로드맵 복사"
                      >
                        {copiedRoadmap === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300 font-bold">✓ 완료</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>📋 미래 3챕터 복사</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Turn Metadata Verification Accordion */}
                {msg.role === 'assistant' && (msg.metaData || msg.rawResponse) && (
                  <MetadataAccordion
                    metadata={msg.metaData}
                    turnNumber={msg.turn || storyTurnCount}
                    rawText={msg.rawResponse}
                  />
                )}
              </div>
            </motion.div>
          ))
        )}

        {/* Loading Indicator */}
        {isGenerating && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-stone-900/60 border border-stone-800 text-amber-300 text-xs font-serif animate-pulse">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>{t.game.generating}</span>
          </div>
        )}

        {/* Real API Error Message Display */}
        {modelError && (
          <div className="p-4 rounded-2xl bg-red-950/70 border border-red-800 text-red-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>
                {selectedModel === 'gemini-3.7-flash'
                  ? 'Gemini 3.7 Flash'
                  : selectedModel === 'gemini-3.6-flash'
                  ? 'Gemini 3.6 Flash'
                  : selectedModel === 'gemini-2.5-flash'
                  ? 'Gemini 2.5 Flash'
                  : selectedModel}{' '}
                API 호출 에러
              </span>
            </div>
            <p className="font-mono text-[11px]">{modelError}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Floating Check Alert if required */}
      {waitingForRoll && (
        <div className="mb-2 p-3.5 rounded-xl bg-amber-950/80 border border-amber-600/70 text-amber-200 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">{t.game.waitingRoll} </span>
              <span className="text-amber-300 font-mono">목표 DC {waitingForRoll.targetDC} ({waitingForRoll.statType.toUpperCase()})</span>
            </div>
          </div>
          <button
            onClick={() => setIsDiceModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>{t.game.rollNow}</span>
          </button>
        </div>
      )}

      {/* Bottom Input Area & Action Bar */}
      <footer className="space-y-2 shrink-0">
        {/* Interactive Choice Chips (if detected from last GM narrative) */}
        {!isGenerating && detectedChoices.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 px-1">
              <Zap className="w-3.5 h-3.5" />
              <span>추천 행동 선택지 (클릭 시 입력창에 반영):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
              {detectedChoices.map((choice, cIdx) => (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => handleQuickChoiceClick(choice)}
                  className="p-2 bg-stone-900/90 hover:bg-amber-950/40 border border-stone-800 hover:border-amber-500/60 rounded-xl text-left text-xs text-stone-200 hover:text-amber-200 transition-all flex items-start gap-2 shadow group cursor-pointer"
                >
                  <span className="w-4 h-4 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                    {cIdx + 1}
                  </span>
                  <span className="line-clamp-2 leading-snug">{choice}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative flex items-center bg-stone-900 border border-stone-800 rounded-2xl p-2 shadow-xl focus-within:border-amber-500/70 transition-colors">
          <textarea
            ref={inputRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.game.inputPlaceholder}
            disabled={isGenerating}
            className={`w-full px-3 py-1 bg-transparent ${proseFontSizeClass} text-stone-100 placeholder-stone-500 resize-none focus:outline-hidden`}
          />

          <div className="flex items-center gap-1 pl-2">
            <button
              id="send-action-btn"
              onClick={handleSend}
              disabled={isGenerating || !inputText.trim()}
              className="p-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition-all cursor-pointer disabled:opacity-40 shadow-md shadow-amber-950/50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer Quick Controls */}
        <div className="flex items-center justify-between text-[11px] text-stone-500 px-2">
          <div className="flex items-center gap-2">
            <span>Shift + Enter: 줄바꿈 / Enter: 선언 전송</span>
          </div>

          {lastRawMetaBlock && (
            <button
              id="copy-raw-meta-btn"
              onClick={handleCopyRawMeta}
              className="hover:text-stone-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedMeta ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedMeta ? t.game.copied : t.game.copyRawMeta}</span>
            </button>
          )}
        </div>
      </footer>

      {/* Modals */}
      <WorldInfoModal
        isOpen={isWorldModalOpen}
        onClose={() => setIsWorldModalOpen(false)}
        worldInfo={worldInfo}
        language={language}
      />

      <CharacterSheetModal
        isOpen={isCharModalOpen}
        onClose={() => setIsCharModalOpen(false)}
        character={character}
        language={language}
      />

      <DiceRollerModal
        isOpen={isDiceModalOpen}
        onClose={() => setIsDiceModalOpen(false)}
        onApplyRollResult={handleDiceRollComplete}
        initialDC={waitingForRoll?.targetDC || 10}
        initialStat={waitingForRoll?.statType || 'agility'}
        stats={character.stats}
        actionContext={waitingForRoll?.actionContext || '행동 판정'}
      />

      <CloudSyncModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        currentSession={{
          character,
          worldInfo,
          messages,
          engineState,
          storyTurnCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }}
        onLoadSuccess={onLoadSession}
      />

      <EngineDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        engineState={engineState}
        selectedModel={selectedModel}
        onSelectModel={onSelectModel}
      />

      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirmReset={() => {
          setIsResetConfirmOpen(false);
          onResetSession();
        }}
        language={language}
      />
    </div>
  );
}
