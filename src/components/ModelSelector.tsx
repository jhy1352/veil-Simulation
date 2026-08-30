import React, { useState, useRef, useEffect } from 'react';
import { GeminiModelType } from '../types';
import { Sparkles, ChevronDown, Check, Cpu, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModelSelectorProps {
  selectedModel: GeminiModelType;
  onSelectModel: (model: GeminiModelType) => void;
  variant?: 'compact' | 'full';
}

interface ModelOption {
  id: GeminiModelType;
  name: string;
  shortName: string;
  badge: string;
  badgeColor: string;
  description: string;
  isOfficial?: boolean;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    shortName: '3.7 Flash',
    badge: '공식 기본',
    badgeColor: 'bg-emerald-950 border-emerald-700 text-emerald-300',
    description: 'TRPG 3.1 헌법 공식 엔진 사양 (Thinking Budget 4096)',
    isOfficial: true
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    shortName: '3.6 Flash',
    badge: '개발 테스트',
    badgeColor: 'bg-blue-950 border-blue-700 text-blue-300',
    description: '서사 생성 속도 및 회귀 테스트용 개발 모델'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    shortName: '2.5 Flash',
    badge: '레거시/실험',
    badgeColor: 'bg-stone-800 border-stone-600 text-stone-300',
    description: '구버전 호환 검증용 (업스트림 API 상태에 따라 변동 가능)'
  }
];

export function ModelSelector({ selectedModel, onSelectModel, variant = 'compact' }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = MODEL_OPTIONS.find(m => m.id === selectedModel) || MODEL_OPTIONS[0];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Mobile-Friendly Quick Toggle Button */}
      <button
        id="model-selector-toggle-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-amber-900/40 text-stone-200 hover:text-amber-300 transition-all cursor-pointer text-xs shadow-sm font-sans"
        title={`현재 모델: ${currentOption.name} (${currentOption.badge})`}
      >
        <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-semibold text-amber-300 whitespace-nowrap">
          {currentOption.shortName}
        </span>
        <span className={`hidden sm:inline text-[10px] px-1.5 py-0.2 rounded border font-mono ${currentOption.badgeColor}`}>
          {currentOption.badge}
        </span>
        <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 sm:w-80 rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl z-50 p-2 space-y-1 backdrop-blur-md"
          >
            <div className="px-3 py-2 border-b border-stone-800">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 모델 선택 (개발 및 테스트용)</span>
              </div>
              <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">
                공식 엔진 사양은 3.7 Flash(Budget 4096)이며, 3.6/2.5는 개발 테스트 목적으로 전환할 수 있습니다.
              </p>
            </div>

            <div className="py-1 space-y-1">
              {MODEL_OPTIONS.map((opt) => {
                const isSelected = opt.id === selectedModel;
                return (
                  <button
                    key={opt.id}
                    id={`select-model-${opt.id}`}
                    type="button"
                    onClick={() => {
                      onSelectModel(opt.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-950/60 border border-amber-800/60 text-amber-200'
                        : 'hover:bg-stone-800/80 border border-transparent text-stone-300'
                    }`}
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs">{opt.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${opt.badgeColor}`}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-400 leading-snug">
                        {opt.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
