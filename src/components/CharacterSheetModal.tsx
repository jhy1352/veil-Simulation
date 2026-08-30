import React from 'react';
import { Character, StatType } from '../types';
import { getTranslation, Language } from '../locales';
import { User, Shield, Zap, Heart, Award, Sparkles, X, Box, BookOpen, AlertTriangle, Activity, Flame, Feather } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CharacterSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  language?: Language;
}

export function CharacterSheetModal({ isOpen, onClose, character, language = 'ko' }: CharacterSheetModalProps) {
  const t = getTranslation(language);

  if (!isOpen) return null;

  const statList: { key: StatType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'strength', label: t.creation.statStr, icon: <Flame className="w-4 h-4" />, color: 'text-red-400' },
    { key: 'agility', label: t.creation.statAgi, icon: <Zap className="w-4 h-4" />, color: 'text-amber-400' },
    { key: 'constitution', label: t.creation.statCon, icon: <Heart className="w-4 h-4" />, color: 'text-emerald-400' },
    { key: 'intelligence', label: t.creation.statInt, icon: <BookOpen className="w-4 h-4" />, color: 'text-blue-400' },
    { key: 'wisdom', label: t.creation.statWis, icon: <Feather className="w-4 h-4" />, color: 'text-indigo-400' },
    { key: 'charisma', label: t.creation.statCha, icon: <Sparkles className="w-4 h-4" />, color: 'text-purple-400' },
  ];

  const getModStr = (val: number) => {
    const mod = Math.floor((val - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

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
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-amber-200">{t.modals.characterSheetTitle}</h2>
                <p className="text-xs text-stone-400 font-serif">
                  {character.name || '무명 무인'} ({character.age || '청년'}, {character.gender || '미상'})
                </p>
              </div>
            </div>
            <button
              id="close-character-sheet-modal-btn"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 max-h-[62vh]">
            {/* Stats Grid */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                {t.modals.statsSection}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {statList.map(({ key, label, icon, color }) => {
                  const val = character.stats[key] || 10;
                  return (
                    <div
                      key={key}
                      className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 flex flex-col items-center justify-center text-center space-y-1"
                    >
                      <div className={`flex items-center gap-1 text-[11px] font-medium ${color}`}>
                        {icon}
                        <span className="truncate">{label.split(' ')[0]}</span>
                      </div>
                      <span className="text-xl font-bold font-mono text-stone-100">{val}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-mono">
                        보정: {getModStr(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Profile Overview & Goal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-stone-950/40 border border-stone-800/80 space-y-1.5">
                <span className="text-xs font-semibold text-stone-400">{t.creation.charAppearance}</span>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {character.appearance || '단정한 용모와 결연한 눈빛.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-950/40 border border-stone-800/80 space-y-1.5">
                <span className="text-xs font-semibold text-stone-400">{t.creation.charGoal}</span>
                <p className="text-xs text-amber-300 font-serif leading-relaxed">
                  {character.goal || '자신의 길을 개척하고 목표를 완수하기 위한 여정.'}
                </p>
              </div>
            </div>

            {/* 5 Meta-Elements */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                {t.modals.metaSection}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Background */}
                <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">{t.creation.metaBackground}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400">
                      {character.backgroundType}
                    </span>
                  </div>
                  <p className="text-stone-300 leading-relaxed">{character.originBackground || '평범한 출신'}</p>
                </div>

                {/* Flaw */}
                <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-400">{t.creation.metaFlaw}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400">
                      {character.flawType}
                    </span>
                  </div>
                  <p className="text-stone-300 leading-relaxed">{character.flaw || '무결한 상태'}</p>
                </div>

                {/* Oath */}
                <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sky-400">{t.creation.metaOath}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400">
                      {character.oathType}
                    </span>
                  </div>
                  <p className="text-stone-300 leading-relaxed">{character.oath || '자유로운 신념'}</p>
                </div>

                {/* Anchor */}
                <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400">{t.creation.metaAnchor}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400">
                      {character.anchorType}
                    </span>
                  </div>
                  <p className="text-stone-300 leading-relaxed">{character.anchor || '자신만의 마음'}</p>
                </div>

                {/* Faction */}
                <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-400">{t.creation.metaFaction}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400">
                      {character.factionType}
                    </span>
                  </div>
                  <p className="text-stone-300 leading-relaxed">{character.faction || '무소속'}</p>
                </div>
              </div>
            </div>

            {/* Romantic Clause: Physical Defect / Breakthrough */}
            {character.physicalDefect && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>신체적 결손 및 대체 의수/독문 돌파구 (낭만 조항)</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">{character.physicalDefect}</p>
              </div>
            )}

            {/* Inventory */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                <Box className="w-3.5 h-3.5" />
                <span>{t.modals.inventorySection}</span>
              </h3>
              {character.inventory.length === 0 ? (
                <div className="p-3 rounded-xl bg-stone-950/40 border border-stone-800/80 text-xs text-stone-500 text-center">
                  {t.modals.emptyInventory}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {character.inventory.map(item => (
                    <div key={item.id} className="p-2.5 rounded-lg bg-stone-950/60 border border-stone-800 text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-medium text-stone-200">
                        <span>{item.name}</span>
                        <span className="text-stone-400 text-[10px]">x{item.quantity}</span>
                      </div>
                      {item.description && <p className="text-[11px] text-stone-400">{item.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Secret Lore if any */}
            {character.secret && (
              <div className="p-3 rounded-xl bg-stone-950/40 border border-stone-800 text-xs space-y-1">
                <span className="font-semibold text-stone-400">{t.creation.charSecret}:</span>
                <p className="text-stone-300 italic">{character.secret}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-stone-800 bg-stone-950/90 flex justify-end">
            <button
              id="confirm-character-sheet-modal-btn"
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
