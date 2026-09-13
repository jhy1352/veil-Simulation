import React, { useState } from 'react';
import { EngineState, HistoricalRecord, CandidatePacket, ValidationDiagnosticLog, TurnLatencyMetrics, GeminiModelType, TurnTrace, CheckpointSnapshot, SaveDietEvent } from '../types';
import { ModelSelector } from './ModelSelector';
import { Activity, ShieldCheck, Database, Clock, Zap, AlertTriangle, Layers, FileCode, CheckCircle, XCircle, X, Cpu, GitCommit, RefreshCw, BookmarkCheck, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EngineDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineState?: EngineState;
  selectedModel?: GeminiModelType;
  onSelectModel?: (model: GeminiModelType) => void;
  isForensicRaw?: boolean;
  onToggleForensicRaw?: (enabled: boolean) => void;
}

export function EngineDiagnosticsModal({
  isOpen,
  onClose,
  engineState,
  selectedModel,
  onSelectModel,
  isForensicRaw = false,
  onToggleForensicRaw
}: EngineDiagnosticsModalProps) {
  const [activeTab, setActiveTab] = useState<'records' | 'candidates' | 'logs' | 'traces' | 'checkpoints' | 'diet' | 'latency'>('traces');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const records = engineState?.historicalRecords || [];
  const candidates = engineState?.pendingCandidates || [];
  const logs = engineState?.validationLogs || [];
  const latencyHistory = engineState?.latencyHistory || [];
  const traces = engineState?.turnTraces || [];
  const checkpoints = engineState?.checkpoints || [];
  const dietEvents = engineState?.saveDietEvents || [];

  const handleCopyText = (text: string, id: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-4xl max-h-[88vh] flex flex-col bg-stone-900 border border-amber-900/40 text-stone-100 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-amber-200 flex items-center gap-2">
                  <span>엔진 진단 및 역사적 아카이브</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                    ONLINE (Lean Diag)
                  </span>
                </h2>
                <p className="text-xs text-stone-400 font-mono">
                  Append-Oriented Historical State & 6-Point Trace Inspector
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onToggleForensicRaw && (
                <button
                  id="modal-forensic-raw-toggle-btn"
                  onClick={() => onToggleForensicRaw(!isForensicRaw)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isForensicRaw
                      ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
                      : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-400'
                  }`}
                  title="FORENSIC RAW 원본 증거 자동 보존 토글"
                >
                  <span className={`w-2 h-2 rounded-full ${isForensicRaw ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
                  <span>[FORENSIC RAW] {isForensicRaw ? 'ON' : 'OFF'}</span>
                </button>
              )}
              {selectedModel && onSelectModel && (
                <ModelSelector
                  selectedModel={selectedModel}
                  onSelectModel={onSelectModel}
                />
              )}
              <button
                id="close-diagnostics-modal-btn"
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center border-b border-stone-800 bg-stone-950/50 px-6 gap-2 text-xs font-semibold overflow-x-auto">
            <button
              id="diag-tab-traces"
              onClick={() => setActiveTab('traces')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'traces'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <GitCommit className="w-4 h-4" />
              <span>턴 추적 파이프라인 ({traces.length})</span>
            </button>

            <button
              id="diag-tab-checkpoints"
              onClick={() => setActiveTab('checkpoints')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'checkpoints'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>체크포인트 스냅샷 ({checkpoints.length})</span>
            </button>

            <button
              id="diag-tab-diet"
              onClick={() => setActiveTab('diet')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'diet'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>다이어트/세이브 이벤트 ({dietEvents.length})</span>
            </button>

            <button
              id="diag-tab-records"
              onClick={() => setActiveTab('records')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'records'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>역사적 기록 ({records.length})</span>
            </button>

            <button
              id="diag-tab-candidates"
              onClick={() => setActiveTab('candidates')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'candidates'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>후보 패킷 ({candidates.length})</span>
            </button>

            <button
              id="diag-tab-logs"
              onClick={() => setActiveTab('logs')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>검증 로그 ({logs.length})</span>
            </button>

            <button
              id="diag-tab-latency"
              onClick={() => setActiveTab('latency')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'latency'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>지연 텔레메트리 ({latencyHistory.length})</span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[60vh] text-xs">
            {/* TAB: TURN TRACES (Lean Diag #3) */}
            {activeTab === 'traces' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  한 턴의 생명주기(Player Input → Context Assembly → Gemini API → Response Parser → Candidate → Validator → Canonical Commit) 추적 로그입니다.
                </div>
                {traces.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    아직 기록된 턴 추적 데이터가 없습니다. 플레이어 메시지를 전송하면 턴 파이프라인이 기록됩니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {traces.slice().reverse().map((trace, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2.5 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-300">Turn {trace.turn}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              trace.verdict === 'PASSED' ? 'bg-emerald-950 border border-emerald-800 text-emerald-300' :
                              trace.verdict === 'SANITIZED_AND_PASSED' ? 'bg-amber-950 border border-amber-800 text-amber-300' :
                              'bg-stone-800 text-stone-300'
                            }`}>
                              {trace.verdict}
                            </span>
                          </div>
                          <span className="text-stone-500 text-[10px]">{trace.timestamp}</span>
                        </div>

                        <div className="bg-stone-900/80 p-2.5 rounded-lg border border-stone-800/80 text-stone-300">
                          <div className="text-stone-400 text-[10px] mb-1">플레이어 입력:</div>
                          <div className="font-sans text-xs">{trace.playerInput}</div>
                        </div>

                        {/* Pipeline Steps Sequence */}
                        <div className="space-y-1">
                          <div className="text-stone-400 text-[10px]">실행 파이프라인 단계:</div>
                          <div className="grid grid-cols-1 gap-1 text-[10px]">
                            {trace.steps.map((step, sIdx) => (
                              <div key={sIdx} className="flex items-center justify-between p-1.5 rounded bg-stone-900/50 border border-stone-800/50">
                                <span className="font-bold text-amber-400">{step.step}</span>
                                <span className="text-stone-300 truncate max-w-md">{step.details}</span>
                                <span className="text-stone-500 text-[9px]">{step.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-800/60">
                          {trace.contextSnapshotSnippet && (
                            <button
                              onClick={() => handleCopyText(trace.contextSnapshotSnippet!, `trace-ctx-${idx}`)}
                              className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === `trace-ctx-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>컨텍스트 스니펫 복사</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CHECKPOINTS (Lean Diag #5) */}
            {activeTab === 'checkpoints' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  100턴 단위(또는 첫 턴)로 정기 기록되는 상태 스냅샷 및 이전 체크포인트와의 변화량(Diff) 요약입니다.
                </div>
                {checkpoints.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    아직 기록된 체크포인트가 없습니다. (1턴 및 매 100턴마다 자동 생성)
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checkpoints.slice().reverse().map((cp, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-amber-300 flex items-center gap-1.5">
                            <BookmarkCheck className="w-4 h-4 text-amber-400" />
                            <span>체크포인트: Turn {cp.turn}</span>
                          </span>
                          <span className="text-stone-500 text-[10px]">{cp.narrativeTime} ({cp.timestamp})</span>
                        </div>

                        <div className="p-2.5 rounded bg-amber-950/20 border border-amber-900/40 text-amber-200 text-xs">
                          <strong>변화량 요약 (Diff): </strong>{cp.diffSummary}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                          <div className="p-2 rounded bg-stone-900 border border-stone-800">
                            챕터: <strong className="text-stone-200">{cp.chapter}</strong>
                          </div>
                          <div className="p-2 rounded bg-stone-900 border border-stone-800">
                            소지품 수: <strong className="text-stone-200">{cp.inventoryCount}개</strong>
                          </div>
                          <div className="p-2 rounded bg-stone-900 border border-stone-800">
                            등록 NPC: <strong className="text-stone-200">{cp.npcCount}명</strong>
                          </div>
                          <div className="p-2 rounded bg-stone-900 border border-stone-800">
                            역사 레코드: <strong className="text-stone-200">{cp.historicalRecordCount}개</strong>
                          </div>
                        </div>

                        <div className="p-2 rounded bg-stone-900 border border-stone-800 text-[10px] text-stone-400">
                          능력치: STR {cp.characterStats.STR} | AGI {cp.characterStats.AGI} | CON {cp.characterStats.CON} | INT {cp.characterStats.INT} | WIS {cp.characterStats.WIS} | CHA {cp.characterStats.CHA}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: DIET / SAVE EVENTS (Lean Diag #6) */}
            {activeTab === 'diet' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  토큰 다이어트(최근 메시지 윈도우링/요약 압축) 및 세이브 버전 이벤트 로그입니다.
                </div>
                {dietEvents.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    아직 기록된 다이어트 이벤트가 없습니다. 메시지 수가 20개를 초과하면 자동 다이어트 로그가 생성됩니다.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dietEvents.slice().reverse().map((ev) => (
                      <div
                        key={ev.eventId}
                        className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-1.5 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-sky-400 flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{ev.eventType} (Turn {ev.turn})</span>
                          </span>
                          <span className="text-stone-500 text-[10px]">{ev.timestamp}</span>
                        </div>
                        <p className="text-stone-300 text-xs font-sans">{ev.details}</p>
                        <div className="flex items-center gap-3 text-[10px] text-stone-500">
                          <span>엔진 버전: <strong className="text-stone-400">{ev.version}</strong></span>
                          <span>•</span>
                          <span>메시지: {ev.messageCountBefore}개 → {ev.messageCountAfter}개 압축</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: HISTORICAL RECORDS */}
            {activeTab === 'records' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  엔진은 과거의 사실을 임의로 덮어쓰거나 변조하지 않으며, 모든 사건과 상태 전이를 시간적 인덱스를 갖춘 불변 레코드로 보존합니다.
                </div>
                {records.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    아직 생성된 역사적 기록이 없습니다. 서사를 진행하면 상태 전이 레코드가 누적됩니다.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {records.slice().reverse().map((rec) => (
                      <div
                        key={rec.recordId}
                        className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-bold text-amber-400">{rec.recordType}</span>
                          <span className="text-stone-500">{rec.narrativeDate} ({new Date(rec.createdAt).toLocaleTimeString()})</span>
                        </div>
                        <div className="text-stone-300 font-mono text-[11px] bg-stone-900/60 p-2 rounded-lg border border-stone-800/80 overflow-x-auto">
                          {JSON.stringify(rec.payload, null, 2)}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-stone-500">
                          <span>권한 경계: <strong className="text-stone-400">{rec.informationAccess}</strong></span>
                          <span>•</span>
                          <span>상태: <strong className="text-emerald-400">{rec.status}</strong></span>
                          <span>•</span>
                          <span>ID: {rec.recordId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CANDIDATE PACKETS */}
            {activeTab === 'candidates' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  LLM GM이 응답 메타데이터로 제안한 임시 후보 패킷입니다. 엔진 검증 전에는 정사(Canonical State)에 반영되지 않습니다.
                </div>
                {candidates.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    보류 중인 후보 패킷이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {candidates.slice().reverse().map((cand) => (
                      <div
                        key={cand.candidateId}
                        className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-sky-400">후보 패킷: {cand.candidateId}</span>
                          <span className="text-stone-500">{cand.narrativeDate}</span>
                        </div>
                        <div className="text-stone-300 font-mono text-[11px] bg-stone-900/60 p-2 rounded-lg border border-stone-800/80 overflow-x-auto">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(cand, null, 2)}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: VALIDATION LOGS */}
            {activeTab === 'logs' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  엔진 검증 방화벽이 상태 변경 제안을 심사한 감사 로그입니다. 허위 사실 주입, 사망 NPC 부활, 권한 위반 시도를 차단합니다.
                </div>
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    기록된 검증 로그가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {logs.slice().reverse().map((log) => (
                      <div
                        key={log.logId}
                        className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {log.outcome === 'PASSED' ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            ) : log.outcome === 'SANITIZED_AND_PASSED' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            )}
                            <span className={
                              log.outcome === 'PASSED' ? 'text-emerald-400 font-bold' :
                              log.outcome === 'SANITIZED_AND_PASSED' ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'
                            }>
                              {log.outcome}
                            </span>
                          </div>
                          <span className="text-stone-500 font-mono">Turn {log.turn}</span>
                        </div>
                        <p className="text-stone-300 text-xs font-sans">{log.details}</p>
                        {log.rejectedReasons.length > 0 && (
                          <div className="p-2 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px] font-mono">
                            차단 사유: {log.rejectedReasons.join(' / ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: LATENCY */}
            {activeTab === 'latency' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  턴별 처리 지연 시간(T0~T7) 및 텍스트 입출력 규모 텔레메트리입니다.
                </div>
                {latencyHistory.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    측정된 지연 시간 기록이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {latencyHistory.slice().reverse().map((lat, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-amber-300">Turn {lat.turn} (모델: {lat.model})</span>
                          <span className="text-stone-400">총 소요: {lat.totalTurnMs}ms</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-stone-400 text-[10px]">
                          <div className="p-2 rounded bg-stone-900 border border-stone-800">
                            컨텍스트 조립: <strong className="text-stone-200">{lat.contextAssemblyMs}ms</strong>
                          </div>
                          <div className="p-2 rounded bg-stone-900 border border-stone-800">
                            Gemini 추론: <strong className="text-stone-200">{lat.geminiGenerationMs}ms</strong>
                          </div>
                          <div className="p-2 rounded bg-stone-900 border border-stone-800">
                            검증 및 상태 전이: <strong className="text-stone-200">{lat.parsingValidationMs}ms</strong>
                          </div>
                        </div>
                        <div className="text-[10px] text-stone-500 flex justify-between">
                          <span>입력 문자 수: {lat.inputCharCount}자</span>
                          <span>출력 문자 수: {lat.outputCharCount}자</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-stone-800 bg-stone-950/90 flex justify-end">
            <button
              id="confirm-diagnostics-modal-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
