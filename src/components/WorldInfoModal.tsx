import React, { useState } from 'react';
import { WorldInfo, NpcRecord, FactionRecord, NarrativeSeed, DEFAULT_NPC_CLASS, DEFAULT_CHAPTER_NAME } from '../types';
import { getTranslation, Language } from '../locales';
import { formatRoadmapText } from '../utils/parser';
import { Globe, Users, Shield, MessageSquare, EyeOff, Sparkles, BookOpen, Compass, X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorldInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldInfo: WorldInfo;
  language?: Language;
}

export function WorldInfoModal({ isOpen, onClose, worldInfo, language = 'ko' }: WorldInfoModalProps) {
  const [activeTab, setActiveTab] = useState<'npcs' | 'factions' | 'chapters' | 'rumors' | 'secrets' | 'seeds' | 'offscreen'>('chapters');
  const [copiedRoadmap, setCopiedRoadmap] = useState(false);
  const t = getTranslation(language);

  const handleCopyRoadmap = () => {
    const textToCopy = formatRoadmapText(worldInfo.chapters);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedRoadmap(true);
        setTimeout(() => setCopiedRoadmap(false), 2000);
      }).catch(err => {
        console.warn('Clipboard copy failed:', err);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-stone-900 border border-stone-700 text-stone-100 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-amber-200">{t.modals.worldInfoTitle}</h2>
                <p className="text-xs text-stone-400 font-serif">
                  {worldInfo.worldName || '세계'} • {worldInfo.currentTime.formattedTime} • {worldInfo.chapters?.currentChapter || DEFAULT_CHAPTER_NAME}
                </p>
              </div>
            </div>
            <button
              id="close-world-info-modal-btn"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center border-b border-stone-800 bg-stone-950/50 px-6 gap-2 text-xs font-semibold overflow-x-auto">
            <button
              id="tab-chapters-btn"
              onClick={() => setActiveTab('chapters')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'chapters' ? 'border-amber-500 text-amber-300' : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>서사 로드맵 (4)</span>
            </button>

            <button
              id="tab-npcs-btn"
              onClick={() => setActiveTab('npcs')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'npcs' ? 'border-amber-500 text-amber-300' : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{t.modals.tabNpcs} ({worldInfo.npcs.length})</span>
            </button>

            <button
              id="tab-factions-btn"
              onClick={() => setActiveTab('factions')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'factions' ? 'border-amber-500 text-amber-300' : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>{t.modals.tabFactions} ({worldInfo.factions.length})</span>
            </button>

            <button
              id="tab-seeds-btn"
              onClick={() => setActiveTab('seeds')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'seeds' ? 'border-amber-500 text-amber-300' : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.modals.tabSeeds} ({worldInfo.seeds.length})</span>
            </button>

            <button
              id="tab-offscreen-btn"
              onClick={() => setActiveTab('offscreen')}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'offscreen' ? 'border-amber-500 text-amber-300' : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <EyeOff className="w-4 h-4" />
              <span>{t.modals.tabOffscreen} ({worldInfo.cameraOffscreenEvents.length})</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[60vh] text-xs">
            {/* CHAPTERS ROADMAP TAB */}
            {activeTab === 'chapters' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-stone-300 text-xs leading-relaxed space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-bold text-amber-300 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      <span>TRPG 3.1 서사 챕터 로드맵 (Planned Narrative Roadmap)</span>
                    </div>
                    <button
                      id="modal-copy-roadmap-btn"
                      onClick={handleCopyRoadmap}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors cursor-pointer"
                    >
                      {copiedRoadmap ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-stone-950" />
                          <span>✓ 복사 완료</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-950" />
                          <span>📋 미래 3챕터 복사</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    미래 예정 챕터는 정사(Canonical Fact)가 아닌 AI GM의 방향성 지침입니다. 플레이어의 자유로운 선택이 최우선이며, 필요 시 엔진에 의해 동적으로 재설계됩니다.
                  </p>
                </div>

                {/* Current Chapter */}
                <div className="p-4 rounded-xl bg-stone-950/80 border border-amber-600/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">현재 진행 중인 챕터</span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/60 text-amber-300 text-[10px] font-mono">ACTIVE</span>
                  </div>
                  <p className="text-stone-100 font-serif text-sm font-semibold">
                    {worldInfo.chapters?.currentChapter || DEFAULT_CHAPTER_NAME}
                  </p>
                </div>

                {/* Upcoming 3 Chapters */}
                <div className="space-y-2">
                  <div className="text-stone-400 text-xs font-semibold">직후 예정 챕터 (3개 사전 구상)</div>
                  <div className="space-y-2">
                    {(!worldInfo.chapters?.upcomingChapters || worldInfo.chapters.upcomingChapters.length === 0) ? (
                      <div className="p-4 rounded-xl bg-stone-950/40 border border-stone-800 text-stone-500 text-xs font-serif text-center">
                        현재 등록된 예정 로드맵이 없습니다. 서사 전개에 따라 동적으로 수립됩니다.
                      </div>
                    ) : (
                      worldInfo.chapters.upcomingChapters.map((chapterTitle, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex items-start gap-3"
                        >
                          <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 text-[10px] font-mono shrink-0 mt-0.5">
                            예정 {idx + 1}
                          </span>
                          <p className="text-xs font-serif leading-relaxed text-stone-200">
                            {chapterTitle}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* NPCS TAB */}
            {activeTab === 'npcs' && (
              <div className="space-y-3">
                {worldInfo.npcs.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    {t.modals.noNpcs}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {worldInfo.npcs.map(npc => (
                      <div
                        key={npc.id}
                        className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-300 text-sm">{npc.name}</span>
                            {npc.alias && <span className="text-stone-400 text-[11px]">({npc.alias})</span>}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-mono">
                            {npc.npcClass || DEFAULT_NPC_CLASS}
                          </span>
                        </div>

                        {npc.affiliation && (
                          <div className="text-[11px] text-stone-400">
                            소속: <span className="text-stone-300">{npc.affiliation}</span>
                          </div>
                        )}

                        <div className="p-2.5 rounded-lg bg-stone-900/70 border border-stone-800 text-[11px] text-stone-300 space-y-1">
                          <div className="font-medium text-stone-400">내면 심경 / 주인공에 대한 인상:</div>
                          <p className="italic">
                            {npc.metInStory === false ? t.modals.unencountered : (npc.innerThought || '특별한 적의나 호의 없음.')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FACTIONS TAB */}
            {activeTab === 'factions' && (
              <div className="space-y-3">
                {worldInfo.factions.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    등록된 주요 문파 및 세력이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {worldInfo.factions.map(fac => (
                      <div key={fac.id} className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-300 text-sm">{fac.name}</span>
                          {fac.leader && <span className="text-stone-400 text-xs">수장: {fac.leader}</span>}
                        </div>
                        <p className="text-stone-300 text-xs leading-relaxed">{fac.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SEEDS TAB */}
            {activeTab === 'seeds' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  엔진은 대문호의 호흡을 유지하기 위해 전면에 등장하는 미해결 복선을 최대 3개 이내로 정밀 관리합니다.
                </div>
                {worldInfo.seeds.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    활성화된 미회수 복선 씨앗이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {worldInfo.seeds.map(seed => (
                      <div key={seed.id} className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 flex-1">
                          <p className="text-stone-200 text-xs leading-relaxed">{seed.content}</p>
                          <div className="flex items-center gap-2 text-[10px] text-stone-500">
                            <span>상태: <strong className="text-amber-400">{seed.status}</strong></span>
                            <span>•</span>
                            <span>생성 시점: 턴 {seed.turnCreated}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* OFFSCREEN EVENTS TAB */}
            {activeTab === 'offscreen' && (
              <div className="space-y-3">
                <div className="text-stone-400 text-[11px] leading-relaxed">
                  주인공이 마주하지 않은 곳에서도 세계의 시간과 사건은 인과에 따라 독립적으로 흘러갑니다.
                </div>
                {worldInfo.cameraOffscreenEvents.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-stone-950/40 rounded-xl border border-stone-800">
                    아직 기록된 물밑 정세가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {worldInfo.cameraOffscreenEvents.map((event, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex items-start gap-2.5">
                        <EyeOff className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        <p className="text-stone-300 text-xs leading-relaxed">{event}</p>
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
              id="confirm-world-info-modal-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              {t.modals.close}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
