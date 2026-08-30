import React from 'react';
import { FontSizeLevel } from '../types';
import { Type } from 'lucide-react';

interface FontSizeControlProps {
  fontSize: FontSizeLevel;
  onChangeFontSize: (size: FontSizeLevel) => void;
}

const FONT_SIZE_OPTIONS: { id: FontSizeLevel; label: string; shortLabel: string }[] = [
  { id: 'sm', label: '작게', shortLabel: '소' },
  { id: 'base', label: '기본', shortLabel: '중' },
  { id: 'lg', label: '크게', shortLabel: '대' },
  { id: 'xl', label: '매우 크게', shortLabel: '특대' }
];

export function FontSizeControl({ fontSize, onChangeFontSize }: FontSizeControlProps) {
  const currentIndex = FONT_SIZE_OPTIONS.findIndex(opt => opt.id === fontSize);

  const handleDecrease = () => {
    if (currentIndex > 0) {
      onChangeFontSize(FONT_SIZE_OPTIONS[currentIndex - 1].id);
    }
  };

  const handleIncrease = () => {
    if (currentIndex < FONT_SIZE_OPTIONS.length - 1) {
      onChangeFontSize(FONT_SIZE_OPTIONS[currentIndex + 1].id);
    }
  };

  const currentOption = FONT_SIZE_OPTIONS[currentIndex] || FONT_SIZE_OPTIONS[1];

  return (
    <div className="flex items-center bg-stone-950/80 border border-stone-800 rounded-xl p-0.5 shadow-sm">
      <button
        id="font-size-dec-btn"
        onClick={handleDecrease}
        disabled={currentIndex <= 0}
        className="px-2 py-1 text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer font-sans select-none flex items-center gap-0.5"
        title="글자 크기 축소"
      >
        <span className="text-[10px] font-bold">A</span>
        <span className="text-[12px] font-bold">−</span>
      </button>

      <div className="px-1.5 py-0.5 flex items-center gap-1 text-[11px] font-mono text-amber-300 select-none">
        <Type className="w-3 h-3 text-amber-500/70" />
        <span className="hidden sm:inline">{currentOption.label}</span>
        <span className="sm:hidden">{currentOption.shortLabel}</span>
      </div>

      <button
        id="font-size-inc-btn"
        onClick={handleIncrease}
        disabled={currentIndex >= FONT_SIZE_OPTIONS.length - 1}
        className="px-2 py-1 text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer font-sans select-none flex items-center gap-0.5"
        title="글자 크기 확대"
      >
        <span className="text-[12px] font-bold">A</span>
        <span className="text-[10px] font-bold">+</span>
      </button>
    </div>
  );
}
