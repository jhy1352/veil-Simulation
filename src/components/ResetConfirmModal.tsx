import React from 'react';
import { Language } from '../types';
import { getTranslation } from '../locales';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
  language: Language;
}

export function ResetConfirmModal({
  isOpen,
  onClose,
  onConfirmReset,
  language
}: ResetConfirmModalProps) {
  if (!isOpen) return null;

  const t = getTranslation(language);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-stone-900 border border-rose-900/60 rounded-2xl p-6 shadow-2xl space-y-5 text-stone-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm md:text-base font-bold">{t.game.resetSession}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <div className="space-y-2 text-xs md:text-sm text-stone-300">
            <p className="font-medium text-stone-200">
              {t.game.resetConfirm}
            </p>
            <p className="text-[11px] text-stone-400">
              {language === 'ko'
                ? '로컬 저장소의 세션 데이터, 캐릭터 시트, 대화 서사, 주사위 기록이 완전히 초기화되고 세계관/캐릭터 생성(Creation) 화면으로 복귀합니다.'
                : 'Session storage, character data, narrative history, and dice logs will be wiped clean, returning to the Creation phase.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              id="cancel-reset-modal-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              {t.modals.close}
            </button>
            <button
              id="confirm-reset-modal-btn"
              onClick={onConfirmReset}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-rose-950/50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.game.resetSession}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
