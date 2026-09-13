import React, { useState } from 'react';
import { SessionPayload } from '../types';
import { Cloud, Download, Upload, Copy, Check, X, KeyRound, FileText, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: SessionPayload;
  onLoadSuccess: (loadedPayload: SessionPayload) => void;
}

export function CloudSyncModal({ isOpen, onClose, currentSession, onLoadSuccess }: CloudSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'save' | 'load' | 'package'>('save');
  const [syncCode, setSyncCode] = useState<string>('');
  const [loadCodeInput, setLoadCodeInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Raw 15-Turn Markdown package
  const [rawPackageInput, setRawPackageInput] = useState<string>('');

  if (!isOpen) return null;

  // Generate 15-turn markdown package text
  const generate15TurnMarkdownPackage = (): string => {
    const { character, worldInfo, messages, storyTurnCount } = currentSession;
    const latestNpcs = worldInfo.npcs.map(n => `▪ [${n.name}${n.alias ? ` (${n.alias})` : ''} | ${n.npcClass}] ${n.affiliation ? `소속: ${n.affiliation}` : ''} | 심경: ${n.innerThought}`).join('\n');
    const unresolvedSeeds = (worldInfo.seeds || []).filter(s => s.status === 'active').map(s => `▪ ${s.content}`).join('\n') || '없음';
    const dcStats = worldInfo.dcHistory.length > 0 ? `누적 DC 횟수: ${worldInfo.dcHistory.length}회 (최근 기록: ${worldInfo.dcHistory.slice(-5).join(', ')})` : '기록 없음';

    return `\`\`\`markdown
[TRPG 엔진 15-TURN 무손실 세이브 데이터 패키지]
A. [주인공 상태 및 스탯]
- 이름/별호: ${character.name} (나이: ${character.age}, 성별: ${character.gender})
- 능력치: STR ${character.stats.strength} | AGI ${character.stats.agility} | CON ${character.stats.constitution} | INT ${character.stats.intelligence} | WIS ${character.stats.wisdom} | CHA ${character.stats.charisma}
- 목표: ${character.goal}
- 출신/배경: [${character.backgroundType}] ${character.originBackground}
- 결핍/트라우마: [${character.flawType}] ${character.flaw}
- 맹세: [${character.oathType}] ${character.oath}
- 닻: [${character.anchorType}] ${character.anchor}
- 문파/세력: [${character.factionType}] ${character.faction}
${character.physicalDefect ? `- 신체 결손/낭만 돌파구: ${character.physicalDefect}` : ''}
- 소장품: ${character.inventory.map(i => `${i.name}(x${i.quantity})`).join(', ') || '없음'}

B. [원작 및 오리지널 인물(OC) 상태망]
${latestNpcs || '등록된 인물 없음'}

C. [현재 시점 세계 정보 한계선]
- [세간 공표 정보]: ${worldInfo.publicRumors.join(' / ') || '없음'}
- [미공개 기밀 정보]: ${worldInfo.secretLore.join(' / ') || '없음'}

D. [활성화된 미회수 복선 씨앗 및 카메라 밖 정세]
- 복선 씨앗:
${unresolvedSeeds}
- 카메라 밖 물밑 정세: ${worldInfo.cameraOffscreenEvents.slice(-2).join(' / ') || '없음'}

E. [DC 누적 통계 계승]
- ${dcStats}

F. [서사 진행 줄거리 및 예정 챕터]
- 현 챕터: ${worldInfo.chapters.currentChapter}
- 누적 진행 턴 수: ${storyTurnCount || 1}턴
- 타임스탬프: ${new Date().toISOString()}
\`\`\``;
  };

  const handleCloudSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/cloud-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: currentSession })
      });
      const data = await res.json();
      if (data.success && data.code) {
        setSyncCode(data.code);
        setSaveSuccess(true);
      } else {
        setErrorMsg(data.error || '클라우드 저장에 실패했습니다.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloudLoad = async () => {
    if (!loadCodeInput.trim()) return;
    setIsLoadingCode(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/cloud-load/${encodeURIComponent(loadCodeInput.trim().toUpperCase())}`);
      const data = await res.json();
      if (data.success && data.payload) {
        onLoadSuccess(data.payload);
        onClose();
      } else {
        setErrorMsg(data.error || '유효하지 않거나 만료된 동기화 코드입니다.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!syncCode) return;
    navigator.clipboard.writeText(syncCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyMarkdownPackage = () => {
    const pkg = generate15TurnMarkdownPackage();
    navigator.clipboard.writeText(pkg);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-stone-900 border border-stone-700 text-stone-100 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-amber-200">크로스 플랫폼 클라우드 동기화</h2>
                <p className="text-[11px] text-stone-400">PC / 모바일 간 6자리 코드 및 세이브 패키지 이관</p>
              </div>
            </div>
            <button
              id="close-cloud-sync-modal-btn"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center border-b border-stone-800 bg-stone-900 text-xs">
            <button
              id="tab-save-cloud-btn"
              onClick={() => setActiveTab('save')}
              className={`flex-1 py-2.5 font-medium text-center border-b-2 transition-colors cursor-pointer ${
                activeTab === 'save' ? 'border-amber-500 text-amber-300 bg-stone-800/40' : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              클라우드 저장 (6자리 코드)
            </button>
            <button
              id="tab-load-cloud-btn"
              onClick={() => setActiveTab('load')}
              className={`flex-1 py-2.5 font-medium text-center border-b-2 transition-colors cursor-pointer ${
                activeTab === 'load' ? 'border-amber-500 text-amber-300 bg-stone-800/40' : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              코드로 불러오기
            </button>
            <button
              id="tab-package-btn"
              onClick={() => setActiveTab('package')}
              className={`flex-1 py-2.5 font-medium text-center border-b-2 transition-colors cursor-pointer ${
                activeTab === 'package' ? 'border-amber-500 text-amber-300 bg-stone-800/40' : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              15턴 마크다운 패키지
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* TAB: SAVE */}
            {activeTab === 'save' && (
              <div className="space-y-4 text-xs">
                <p className="text-stone-300 leading-relaxed">
                  현재 진행 중인 캐릭터 시트, 세계관 상태, 인물록 및 최근 서사 기록을 암호화된 6자리 동기화 코드로 클라우드에 업로드합니다.
                </p>

                {syncCode ? (
                  <div className="p-4 rounded-xl bg-stone-950 border border-amber-500/40 space-y-3 text-center">
                    <span className="text-stone-400 text-[11px]">발급된 6자리 동기화 코드</span>
                    <div className="text-3xl font-black font-mono tracking-widest text-amber-300">
                      {syncCode}
                    </div>
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        id="copy-sync-code-btn"
                        onClick={handleCopyCode}
                        className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode ? '복사됨' : '코드 복사'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    id="generate-cloud-save-btn"
                    onClick={handleCloudSave}
                    disabled={isSaving}
                    className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isSaving ? '클라우드 업로드 중...' : '6자리 동기화 코드 생성 및 저장'}</span>
                  </button>
                )}
              </div>
            )}

            {/* TAB: LOAD */}
            {activeTab === 'load' && (
              <div className="space-y-4 text-xs">
                <p className="text-stone-300 leading-relaxed">
                  모바일이나 다른 브라우저에서 발급받은 6자리 동기화 코드를 입력하면 저장된 세션을 즉시 복원합니다.
                </p>

                <div className="space-y-2">
                  <label className="font-semibold text-stone-400">6자리 동기화 코드 입력</label>
                  <input
                    id="sync-code-input"
                    type="text"
                    maxLength={6}
                    placeholder="예: X9K2A7"
                    value={loadCodeInput}
                    onChange={(e) => setLoadCodeInput(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-center font-mono font-bold text-lg text-amber-300 tracking-widest focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <button
                  id="load-session-by-code-btn"
                  onClick={handleCloudLoad}
                  disabled={isLoadingCode || loadCodeInput.length < 6}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isLoadingCode ? '세션 로드 중...' : '세션 불러오기'}</span>
                </button>
              </div>
            )}

            {/* TAB: RAW 15-TURN MARKDOWN PACKAGE */}
            {activeTab === 'package' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-stone-950/50 rounded-xl border border-stone-800 text-stone-300 leading-relaxed">
                  원클릭 복사로 15번 헌법 규격의 통합 세이브 패키지를 백업하거나, 외부 텍스트를 복사해 보관할 수 있습니다.
                </div>

                <div className="relative">
                  <textarea
                    id="raw-package-textarea"
                    readOnly
                    value={generate15TurnMarkdownPackage()}
                    rows={8}
                    className="w-full p-3 rounded-xl bg-stone-950 border border-stone-800 font-mono text-[11px] text-stone-300 leading-relaxed resize-none focus:outline-hidden"
                  />
                </div>

                <button
                  id="copy-markdown-package-btn"
                  onClick={handleCopyMarkdownPackage}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? '세이브 패키지 복사 완료!' : '15턴 세이브 마크다운 전체 복사'}</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
