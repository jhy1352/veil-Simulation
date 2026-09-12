import React, { useState, useEffect } from 'react';
import {
  PRESET_LOCALES,
  PresetLocale,
  getStoredNarrativeLocale,
  setStoredNarrativeLocale,
  getEffectiveNarrativeLocale,
  detectSystemLocale,
  normalizeNarrativeLocale,
  mapLocaleToUiLanguage
} from '../utils/locale';
import { Language } from '../types';
import { Globe, Check, Settings2, Sparkles } from 'lucide-react';

interface LocaleSelectorProps {
  language: Language;
  onLanguageChange: (newUiLang: Language) => void;
  narrativeLocale: string;
  onNarrativeLocaleChange: (newLocale: string) => void;
}

export const LocaleSelector: React.FC<LocaleSelectorProps> = ({
  language,
  onLanguageChange,
  narrativeLocale,
  onNarrativeLocaleChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const effectiveLocale = getEffectiveNarrativeLocale(narrativeLocale);
  const systemDefault = detectSystemLocale();

  // Find if current locale matches a preset
  const currentPreset = PRESET_LOCALES.find(p => p.code === narrativeLocale);

  useEffect(() => {
    if (!currentPreset && narrativeLocale !== 'system' && narrativeLocale) {
      setIsCustomMode(true);
      setCustomInput(narrativeLocale);
    } else {
      setIsCustomMode(false);
    }
  }, [narrativeLocale, currentPreset]);

  const handleSelectPreset = (code: string) => {
    setIsCustomMode(false);
    onNarrativeLocaleChange(code);
    setStoredNarrativeLocale(code);

    // Auto-update UI translation language to match or fallback safely
    const effective = code === 'system' ? systemDefault : code;
    const mappedUiLang = mapLocaleToUiLanguage(effective);
    onLanguageChange(mappedUiLang);

    setIsOpen(false);
  };

  const handleApplyCustomLocale = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeNarrativeLocale(customInput);
    if (normalized) {
      onNarrativeLocaleChange(normalized);
      setStoredNarrativeLocale(normalized);
      const mappedUiLang = mapLocaleToUiLanguage(normalized);
      onLanguageChange(mappedUiLang);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        id="open-locale-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 text-stone-200 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
        title="언어/Locale 설정 (Narrative Locale & UI Language)"
      >
        <Globe className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="hidden sm:inline font-sans truncate max-w-[90px]">
          {narrativeLocale === 'system' ? `시스템 (${effectiveLocale})` : (currentPreset ? currentPreset.code : effectiveLocale)}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl z-50 p-3 text-stone-200">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 font-serif">
              <Globe className="w-4 h-4 text-amber-400" />
              <span>다국어 언어 설정 (Locale)</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-stone-500 hover:text-stone-300 text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="text-[11px] text-stone-400 mb-2 font-sans leading-tight">
            서사 출력 언어(Narrative Locale)를 선택하세요. 입력 및 출력 언어가 분리되어 지원됩니다.
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {PRESET_LOCALES.map(preset => {
              const isSelected = narrativeLocale === preset.code;
              return (
                <button
                  key={preset.code}
                  onClick={() => handleSelectPreset(preset.code)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-950/80 text-amber-200 border border-amber-800/60 font-semibold'
                      : 'hover:bg-stone-800 text-stone-300'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{preset.nativeName}</span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      {preset.code === 'system' ? `감지: ${systemDefault}` : preset.label}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}

            {/* Custom BCP-47 Input */}
            <div className="pt-2 border-t border-stone-800/80 mt-2">
              <button
                type="button"
                onClick={() => setIsCustomMode(!isCustomMode)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  isCustomMode
                    ? 'bg-amber-950/80 text-amber-200 border border-amber-800/60 font-semibold'
                    : 'hover:bg-stone-800 text-stone-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>사용자 지정 BCP-47 Tag...</span>
                </div>
                {isCustomMode && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </button>

              {isCustomMode && (
                <form onSubmit={handleApplyCustomLocale} className="mt-2 space-y-2 px-1">
                  <input
                    type="text"
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder="예: es-MX, sv-SE, ko-KR"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-amber-200 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 text-amber-200 text-xs font-semibold cursor-pointer border border-amber-700/60 transition-colors"
                  >
                    적용 (Apply Custom Locale)
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
