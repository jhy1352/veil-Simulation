import React, { useState } from 'react';
import { rollCryptoDie, evaluateCheck, RollCheckResult } from '../utils/dice';
import { StatType, CharacterStats } from '../types';
import { soundEngine } from '../utils/audio';
import { Dices, Sparkles, AlertCircle, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DiceRollerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyRollResult?: (resultText: string, rollData: RollCheckResult) => void;
  initialDC?: number;
  initialStat?: StatType;
  stats?: CharacterStats;
  actionContext?: string;
}

export function DiceRollerModal({
  isOpen,
  onClose,
  onApplyRollResult,
  initialDC = 10,
  initialStat = 'agility',
  stats,
  actionContext = '행동 판정'
}: DiceRollerModalProps) {
  const [targetDC, setTargetDC] = useState<number>(initialDC);
  const [selectedStat, setSelectedStat] = useState<StatType>(initialStat);
  const [customModifier, setCustomModifier] = useState<number>(0);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<RollCheckResult | null>(null);

  if (!isOpen) return null;

  const statMod = stats ? Math.floor(((stats[selectedStat] || 10) - 10) / 2) : 0;
  const totalModifier = statMod + customModifier;

  const handleRoll = () => {
    setIsRolling(true);
    soundEngine.playDiceRoll();
    // Simulate dice tumbling
    setTimeout(() => {
      const raw = rollCryptoDie(20);
      const evaluated = evaluateCheck(raw, totalModifier, targetDC);
      setLastResult(evaluated);
      setIsRolling(false);
      if (evaluated.isSuccess) {
        soundEngine.playSuccessSound();
      } else {
        soundEngine.playFailureSound();
      }
    }, 450);
  };

  const handleConfirmAndSend = () => {
    if (!lastResult) return;
    const modStr = totalModifier >= 0 ? `+${totalModifier}` : `${totalModifier}`;
    const resultText = `[🎲 주사위 투척 선언]
- 판정 항목: ${actionContext} (${selectedStat.toUpperCase()})
- 목표 DC: ${targetDC}
- 투척 결과: 1d20(${lastResult.rawRoll}) ${modStr} = 총합 ${lastResult.total}
- 최종 판정: ${lastResult.descriptionKo}`;

    if (onApplyRollResult) {
      onApplyRollResult(resultText, lastResult);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-stone-900 border border-stone-700 text-stone-100 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400">
                <Dices className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-amber-200">CSPRNG 암호학적 주사위 판정</h2>
                <p className="text-[11px] text-stone-400 font-mono">window.crypto.getRandomValues()</p>
              </div>
            </div>
            <button
              id="close-dice-modal-btn"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Context Notice */}
            <div className="p-3 rounded-xl bg-stone-950/50 border border-stone-800 text-xs text-stone-300">
              <span className="font-semibold text-amber-400">상황: </span>
              <span>{actionContext}</span>
            </div>

            {/* Target DC & Stat Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-400">목표 난이도 (DC 5~15)</label>
                <div className="flex items-center gap-2">
                  <input
                    id="target-dc-input"
                    type="range"
                    min="5"
                    max="15"
                    value={targetDC}
                    onChange={(e) => setTargetDC(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="px-2.5 py-1 rounded bg-stone-950 border border-stone-800 font-mono font-bold text-amber-300 text-sm">
                    {targetDC}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-400">적용 능력치</label>
                <select
                  id="stat-select"
                  value={selectedStat}
                  onChange={(e) => setSelectedStat(e.target.value as StatType)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-200 font-medium focus:outline-hidden focus:border-amber-500"
                >
                  <option value="strength">근력 (STR) {stats ? `(+${Math.floor(((stats.strength || 10) - 10) / 2)})` : ''}</option>
                  <option value="agility">민첩 (AGI) {stats ? `(+${Math.floor(((stats.agility || 10) - 10) / 2)})` : ''}</option>
                  <option value="constitution">체질 (CON) {stats ? `(+${Math.floor(((stats.constitution || 10) - 10) / 2)})` : ''}</option>
                  <option value="intelligence">지능 (INT) {stats ? `(+${Math.floor(((stats.intelligence || 10) - 10) / 2)})` : ''}</option>
                  <option value="wisdom">지혜 (WIS) {stats ? `(+${Math.floor(((stats.wisdom || 10) - 10) / 2)})` : ''}</option>
                  <option value="charisma">매력 (CHA) {stats ? `(+${Math.floor(((stats.charisma || 10) - 10) / 2)})` : ''}</option>
                </select>
              </div>
            </div>

            {/* Modifiers info */}
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-stone-950/40 border border-stone-800/80 text-stone-400 font-mono">
              <span>스탯 보정: {statMod >= 0 ? `+${statMod}` : statMod}</span>
              <span>상황 추가 보정: {customModifier >= 0 ? `+${customModifier}` : customModifier}</span>
              <span className="text-amber-300 font-bold">최종 보정: {totalModifier >= 0 ? `+${totalModifier}` : totalModifier}</span>
            </div>

            {/* Roll Animation Box */}
            <div className="p-6 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-radial from-amber-500/5 to-transparent pointer-events-none" />

              <div className="relative mb-3">
                <motion.div
                  animate={isRolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.45, repeat: isRolling ? Infinity : 0 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 border border-amber-400/40 flex items-center justify-center shadow-lg shadow-amber-950/50"
                >
                  <span className="text-2xl font-black font-mono text-amber-100">
                    {isRolling ? '?' : (lastResult ? lastResult.rawRoll : '20')}
                  </span>
                </motion.div>
              </div>

              {lastResult ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5 font-bold text-sm">
                    {lastResult.isCritSuccess && <Sparkles className="w-4 h-4 text-amber-300" />}
                    {lastResult.isCritFailure && <ShieldAlert className="w-4 h-4 text-red-400" />}
                    <span className={
                      lastResult.isSuccess
                        ? (lastResult.isCritSuccess ? 'text-amber-300' : 'text-emerald-400')
                        : (lastResult.isCritFailure ? 'text-red-400' : 'text-rose-400')
                    }>
                      {lastResult.descriptionKo}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 font-mono">
                    주사위 {lastResult.rawRoll} + 보정치 {totalModifier >= 0 ? `+${totalModifier}` : totalModifier} = 총합 {lastResult.total} (목표 DC {targetDC})
                  </p>
                </div>
              ) : (
                <p className="text-xs text-stone-400">주사위를 굴려 난수 판정을 진행하세요.</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                id="roll-dice-action-btn"
                onClick={handleRoll}
                disabled={isRolling}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-amber-950/40 disabled:opacity-50"
              >
                <Dices className="w-4 h-4" />
                <span>{isRolling ? '투척 중...' : '🎲 주사위 굴리기 (CSPRNG)'}</span>
              </button>

              {lastResult && (
                <button
                  id="apply-roll-result-btn"
                  onClick={handleConfirmAndSend}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>서사에 반영</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
