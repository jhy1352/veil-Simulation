import React, { useState, useMemo } from 'react';
import { Character, WorldInfo, Language, StatType, GeminiModelType } from '../types';
import { getTranslation } from '../locales';
import { 
  WORLD_GENRE_PRESETS, 
  TONE_AND_MANNER_CATALOG, 
  getWorldTailoredMetaPool, 
  getRandomCharacterPresetForWorld,
  WorldGenrePreset 
} from '../data/presets';
import { roll4d6DropLowest } from '../utils/dice';
import { ModelSelector } from './ModelSelector';
import { Globe, User, Dices, ArrowRight, ArrowLeft, Sparkles, BookOpen, Compass, Shield, Heart, Zap, Feather, Flame, AlertCircle, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CreationPhaseProps {
  character: Character;
  worldInfo: WorldInfo;
  language: Language;
  selectedModel?: GeminiModelType;
  onSelectModel?: (model: GeminiModelType) => void;
  onUpdateCharacter: (char: Partial<Character>) => void;
  onUpdateWorldInfo: (world: Partial<WorldInfo>) => void;
  onCompleteCreation: () => void;
}

export function CreationPhase({
  character,
  worldInfo,
  language,
  selectedModel,
  onSelectModel,
  onUpdateCharacter,
  onUpdateWorldInfo,
  onCompleteCreation
}: CreationPhaseProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const t = getTranslation(language);

  // Tailored meta pool based on current world settings
  const tailoredMetaPool = useMemo(() => {
    return getWorldTailoredMetaPool(worldInfo);
  }, [worldInfo.worldName, worldInfo.settingDescription, worldInfo.worldType]);

  // Roll All Stats via CSPRNG 4d6 Drop Lowest
  const handleRerollAllStats = () => {
    const newStats = {
      strength: roll4d6DropLowest().total,
      agility: roll4d6DropLowest().total,
      constitution: roll4d6DropLowest().total,
      intelligence: roll4d6DropLowest().total,
      wisdom: roll4d6DropLowest().total,
      charisma: roll4d6DropLowest().total
    };
    onUpdateCharacter({ stats: newStats });
  };

  // Genre preset selection helper
  const handleSelectGenrePreset = (preset: WorldGenrePreset) => {
    onUpdateWorldInfo({
      worldName: preset.name.split(' (')[0],
      worldType: 'popular_genre',
      settingDescription: preset.description,
      toneStyle: preset.suggestedTone,
      factions: preset.starterFactions.map((name, i) => ({
        id: `fac_${i}`,
        name,
        description: `${preset.name}의 주요 세력`
      }))
    });
  };

  // CSPRNG Random Character Preset Injector
  const handleRandomizeCharacter = () => {
    const preset = getRandomCharacterPresetForWorld(worldInfo);
    if (!preset) return;

    onUpdateCharacter({
      name: `${preset.name} (${preset.title})`,
      gender: preset.gender === '여성' ? 'female' : 'male',
      age: preset.age,
      appearance: preset.appearance,
      goal: preset.goal,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      {/* Top Banner & Stepper */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black font-serif text-amber-200 tracking-tight">
              {t.creation.title}
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              {t.creation.subtitle}
            </p>
          </div>

          {/* Model Selector & Step Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedModel && onSelectModel && (
              <ModelSelector
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
              />
            )}

            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => setStep(s as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    step === s
                      ? 'bg-amber-600 text-stone-950 shadow-md shadow-amber-950/50'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {s === 1 ? '1단계: 세계관' : s === 2 ? '2단계: 캐릭터' : '3단계: 능력치'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: WORLD ESTABLISHMENT */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 space-y-6 shadow-xl"
        >
          <div className="border-b border-stone-800 pb-3">
            <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>{t.creation.phase1Title}</span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">{t.creation.phase1Desc}</p>
          </div>

          {/* Master Genre Presets Quick Select */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>정통 장르 & 마스터 세계관 프리셋 (10종)</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {WORLD_GENRE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectGenrePreset(preset)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    worldInfo.worldName === preset.name.split(' (')[0]
                      ? 'bg-amber-950/40 border-amber-500/80 text-amber-100 shadow-md'
                      : 'bg-stone-950/60 border-stone-800/80 text-stone-300 hover:border-stone-700 hover:bg-stone-800/50'
                  }`}
                >
                  <div className="text-xs font-bold text-amber-300">{preset.name}</div>
                  <div className="text-[11px] text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* World Name & Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300">{t.creation.worldName}</label>
              <input
                type="text"
                value={worldInfo.worldName}
                onChange={(e) => onUpdateWorldInfo({ worldName: e.target.value })}
                placeholder={t.creation.worldNamePlaceholder}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300">{t.creation.worldType}</label>
              <select
                value={worldInfo.worldType}
                onChange={(e) => onUpdateWorldInfo({ worldType: e.target.value as any })}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="original_ip">{t.creation.worldTypeOriginal}</option>
                <option value="popular_genre">{t.creation.worldTypeGenre}</option>
                <option value="custom_creative">{t.creation.worldTypeCustom}</option>
              </select>
            </div>
          </div>

          {/* 8 Tone & Manner Styles */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-300 flex items-center justify-between">
              <span>{t.creation.toneStyle} (대문호/장르별 8대 문체 카탈로그)</span>
            </label>
            <select
              value={worldInfo.toneStyle}
              onChange={(e) => onUpdateWorldInfo({ toneStyle: e.target.value })}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
            >
              {TONE_AND_MANNER_CATALOG.map((tone) => (
                <option key={tone.id} value={tone.id}>
                  {tone.name} — {tone.description}
                </option>
              ))}
            </select>
          </div>

          {/* Setting Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-300">{t.creation.settingDesc}</label>
            <textarea
              rows={3}
              value={worldInfo.settingDescription}
              onChange={(e) => onUpdateWorldInfo({ settingDescription: e.target.value })}
              placeholder={t.creation.settingDescPlaceholder}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
            >
              <span>{t.creation.nextStep}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 2: CHARACTER & 5 META ELEMENTS */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 space-y-6 shadow-xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-stone-800 pb-3 gap-3">
            <div>
              <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>{t.creation.phase2Title}</span>
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">{t.creation.phase2Desc}</p>
            </div>

            {/* Quick Random Character Ingestion (CSPRNG) */}
            <button
              type="button"
              onClick={handleRandomizeCharacter}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/50 border border-amber-600/50 hover:bg-amber-900/60 text-amber-200 text-xs font-bold transition-all shadow cursor-pointer self-start md:self-auto"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              <span>🎲 장르 맞춤형 캐릭터 자동 완성</span>
            </button>
          </div>

          {/* Character Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-stone-300">{t.creation.charName}</label>
              <input
                type="text"
                value={character.name}
                onChange={(e) => onUpdateCharacter({ name: e.target.value })}
                placeholder={t.creation.charNamePlaceholder}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">{t.creation.charGender}</label>
                <select
                  value={character.gender}
                  onChange={(e) => onUpdateCharacter({ gender: e.target.value as any })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                  <option value="other">기타/미정</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-300">{t.creation.charAge}</label>
                <input
                  type="number"
                  value={character.age}
                  onChange={(e) => onUpdateCharacter({ age: parseInt(e.target.value) || 20 })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300">{t.creation.charAppearance}</label>
              <input
                type="text"
                value={character.appearance}
                onChange={(e) => onUpdateCharacter({ appearance: e.target.value })}
                placeholder="예: 흑발에 낡은 도포를 걸친 청년, 날카로운 눈매"
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300">{t.creation.charGoal}</label>
              <input
                type="text"
                value={character.goal}
                onChange={(e) => onUpdateCharacter({ goal: e.target.value })}
                placeholder="예: 가문의 원수를 갚고 비급의 비밀을 밝히는 것"
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* 5 Meta Elements with Tailored Presets */}
          <div className="space-y-4 pt-2 border-t border-stone-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>5대 메타 요소 (세계관 맞춤형 250+ 프리셋 연동)</span>
              </h3>
              <span className="text-[11px] text-stone-500">직접 수정 또는 프리셋 원클릭 적용</span>
            </div>

            {/* 1. Background */}
            <div className="space-y-1.5 bg-stone-950/60 p-3 rounded-xl border border-stone-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <Feather className="w-3.5 h-3.5 text-amber-400" />
                  <span>1) {t.creation.metaBackground}</span>
                </label>
                <select
                  className="text-[11px] bg-stone-900 border border-stone-700 text-amber-300 rounded px-2 py-0.5 focus:outline-none max-w-[200px]"
                  onChange={(e) => {
                    if (e.target.value) {
                      onUpdateCharacter({
                        originBackground: e.target.value,
                        metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), background: e.target.value }
                      });
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>추천 프리셋 선택</option>
                  {(tailoredMetaPool.background || []).map((text, idx) => (
                    <option key={idx} value={text}>
                      {text.length > 25 ? text.slice(0, 25) + '...' : text}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={character.originBackground || character.metaElements?.background || ''}
                onChange={(e) => onUpdateCharacter({
                  originBackground: e.target.value,
                  metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), background: e.target.value }
                })}
                placeholder="예: 몰락한 명문세가의 유일한 후계자"
                className="w-full bg-stone-900/80 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 2. Flaw */}
            <div className="space-y-1.5 bg-stone-950/60 p-3 rounded-xl border border-stone-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>2) {t.creation.metaFlaw}</span>
                </label>
                <select
                  className="text-[11px] bg-stone-900 border border-stone-700 text-amber-300 rounded px-2 py-0.5 focus:outline-none max-w-[200px]"
                  onChange={(e) => {
                    if (e.target.value) {
                      onUpdateCharacter({
                        flaw: e.target.value,
                        metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), flaw: e.target.value }
                      });
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>추천 프리셋 선택</option>
                  {(tailoredMetaPool.flaw || []).map((text, idx) => (
                    <option key={idx} value={text}>
                      {text.length > 25 ? text.slice(0, 25) + '...' : text}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={character.flaw || character.metaElements?.flaw || ''}
                onChange={(e) => onUpdateCharacter({
                  flaw: e.target.value,
                  metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), flaw: e.target.value }
                })}
                placeholder="예: 동료의 희생에 대한 깊은 부채의식과 죄책감"
                className="w-full bg-stone-900/80 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 3. Oath */}
            <div className="space-y-1.5 bg-stone-950/60 p-3 rounded-xl border border-stone-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span>3) {t.creation.metaOath}</span>
                </label>
                <select
                  className="text-[11px] bg-stone-900 border border-stone-700 text-amber-300 rounded px-2 py-0.5 focus:outline-none max-w-[200px]"
                  onChange={(e) => {
                    if (e.target.value) {
                      onUpdateCharacter({
                        oath: e.target.value,
                        metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), oath: e.target.value }
                      });
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>추천 프리셋 선택</option>
                  {(tailoredMetaPool.oath || []).map((text, idx) => (
                    <option key={idx} value={text}>
                      {text.length > 25 ? text.slice(0, 25) + '...' : text}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={character.oath || character.metaElements?.oath || ''}
                onChange={(e) => onUpdateCharacter({
                  oath: e.target.value,
                  metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), oath: e.target.value }
                })}
                placeholder="예: 억울하게 희생된 무고한 약자를 외면하지 않는다"
                className="w-full bg-stone-900/80 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 4. Anchor */}
            <div className="space-y-1.5 bg-stone-950/60 p-3 rounded-xl border border-stone-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4) {t.creation.metaAnchor}</span>
                </label>
                <select
                  className="text-[11px] bg-stone-900 border border-stone-700 text-amber-300 rounded px-2 py-0.5 focus:outline-none max-w-[200px]"
                  onChange={(e) => {
                    if (e.target.value) {
                      onUpdateCharacter({
                        anchor: e.target.value,
                        metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), anchor: e.target.value }
                      });
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>추천 프리셋 선택</option>
                  {(tailoredMetaPool.anchor || []).map((text, idx) => (
                    <option key={idx} value={text}>
                      {text.length > 25 ? text.slice(0, 25) + '...' : text}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={character.anchor || character.metaElements?.anchor || ''}
                onChange={(e) => onUpdateCharacter({
                  anchor: e.target.value,
                  metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), anchor: e.target.value }
                })}
                placeholder="예: 행방불명된 쌍둥이 여동생이 남긴 낡은 옥패"
                className="w-full bg-stone-900/80 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 5. Faction */}
            <div className="space-y-1.5 bg-stone-950/60 p-3 rounded-xl border border-stone-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-indigo-400" />
                  <span>5) {t.creation.metaFaction}</span>
                </label>
                <select
                  className="text-[11px] bg-stone-900 border border-stone-700 text-amber-300 rounded px-2 py-0.5 focus:outline-none max-w-[200px]"
                  onChange={(e) => {
                    if (e.target.value) {
                      onUpdateCharacter({
                        faction: e.target.value,
                        metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), faction: e.target.value }
                      });
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>추천 프리셋 선택</option>
                  {(tailoredMetaPool.faction || []).map((text, idx) => (
                    <option key={idx} value={text}>
                      {text.length > 25 ? text.slice(0, 25) + '...' : text}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={character.faction || character.metaElements?.faction || ''}
                onChange={(e) => onUpdateCharacter({
                  faction: e.target.value,
                  metaElements: { ...(character.metaElements || { background: '', flaw: '', oath: '', anchor: '', faction: '' }), faction: e.target.value }
                })}
                placeholder="예: 화산파 (속가 제자 신분)"
                className="w-full bg-stone-900/80 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.creation.prevStep}</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
            >
              <span>{t.creation.nextStep}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 3: STATS & FINAL CONFIRMATION */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-stone-900/80 border border-stone-800 rounded-2xl p-6 space-y-6 shadow-xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-stone-800 pb-3 gap-3">
            <div>
              <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
                <Dices className="w-4 h-4" />
                <span>{t.creation.phase3Title}</span>
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">{t.creation.phase3Desc}</p>
            </div>

            <button
              type="button"
              onClick={handleRerollAllStats}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold transition-all shadow-md cursor-pointer self-start md:self-auto"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>{t.creation.rerollStats}</span>
            </button>
          </div>

          {/* 6 Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: 'strength', label: t.creation.statStr, desc: '물리적 완력과 근육량' },
              { key: 'agility', label: t.creation.statAgi, desc: '반사신경과 신체 유연성' },
              { key: 'constitution', label: t.creation.statCon, desc: '체력과 생명력, 내성' },
              { key: 'intelligence', label: t.creation.statInt, desc: '학식과 기억력, 논리력' },
              { key: 'wisdom', label: t.creation.statWis, desc: '직관력과 기운 감지, 정신력' },
              { key: 'charisma', label: t.creation.statCha, desc: '존재감과 리더십, 기품' }
            ].map(({ key, label, desc }) => {
              const val = character.stats[key as StatType];
              const mod = Math.floor((val - 10) / 2);
              return (
                <div
                  key={key}
                  className="bg-stone-950/80 border border-stone-800/80 rounded-xl p-3 space-y-1.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300">{label}</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {mod >= 0 ? `+${mod}` : mod}
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-200">
                    {val}
                  </div>
                  <div className="text-[10px] text-stone-500">{desc}</div>
                </div>
              );
            })}
          </div>

          {/* Character & World Review Card */}
          <div className="bg-stone-950/90 border border-stone-800 rounded-xl p-4 space-y-3 text-xs">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5 border-b border-stone-800 pb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>최종 설정 요약</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-stone-300">
              <div>
                <span className="text-stone-500 font-medium">세계관: </span>
                <span className="font-bold text-stone-200">{worldInfo.worldName || '미정'}</span> ({worldInfo.worldType})
              </div>
              <div>
                <span className="text-stone-500 font-medium">주인공: </span>
                <span className="font-bold text-stone-200">{character.name || '무명'}</span> ({character.gender === 'male' ? '남성' : '여성'}, {character.age}세)
              </div>
              <div className="md:col-span-2">
                <span className="text-stone-500 font-medium">배경 / 신념: </span>
                <span className="text-stone-300">{character.metaElements.background || '백지'} / {character.metaElements.oath || '자유'}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.creation.prevStep}</span>
            </button>

            <button
              type="button"
              onClick={onCompleteCreation}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black px-6 py-3 rounded-xl text-sm shadow-xl shadow-amber-950/60 transition-all cursor-pointer scale-100 hover:scale-102 active:scale-98"
            >
              <span>{t.creation.startGame}</span>
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
