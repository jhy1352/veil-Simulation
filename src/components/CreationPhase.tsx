import React, { useState, useEffect } from 'react';
import { 
  WorldInfo, 
  Character, 
  Language, 
  GeminiModelType, 
  CharacterStats,
  WorldType 
} from '../types';
import { 
  TONE_AND_MANNER_CATALOG, 
  ToneAndManner, 
  GenrePreset, 
  GenreCategory, 
  getRandom10Presets 
} from '../data/genreAndToneData';
import { getWorldTailoredMetaPool } from '../data/metaPresetsData';
import { getRandomCharacterPresetForWorld } from '../data/characterPresetsData';
import { generateAllStatsCSPRNG, calculateModifier } from '../utils/dice';
import { soundEngine } from '../utils/audio';
import { ModelSelector } from './ModelSelector';
import { 
  Globe, 
  UserCheck, 
  Shield, 
  Sparkles, 
  BookOpen, 
  Dice5, 
  ArrowRight, 
  CheckCircle, 
  RotateCcw,
  Wand2,
  Activity
} from 'lucide-react';

export type MetaInputType = 'preset' | 'custom' | 'tabula_rasa';

export interface MetaItemState {
  type: MetaInputType;
  value: string;
  label?: string;
  isTabulaRasa?: boolean;
}

export interface MetaElementsState {
  background: MetaItemState;
  flaw: MetaItemState;
  oath: MetaItemState;
  anchor: MetaItemState;
  faction: MetaItemState;
}

interface CreationPhaseProps {
  worldInfo: WorldInfo;
  character: Character;
  language?: Language;
  selectedModel?: GeminiModelType;
  onSelectModel?: (model: GeminiModelType) => void;
  onUpdateWorldInfo: (world: Partial<WorldInfo>) => void;
  onUpdateCharacter: (character: Partial<Character>) => void;
  onCompleteCreation: () => void;
}

export const CreationPhase: React.FC<CreationPhaseProps> = ({
  worldInfo,
  character,
  selectedModel,
  onSelectModel,
  onUpdateWorldInfo,
  onUpdateCharacter,
  onCompleteCreation,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Phase 1: Mode, Category & Presets State
  const [worldMode, setWorldMode] = useState<'popular_genre' | 'original_ip' | 'custom'>(() => {
    if (worldInfo.worldType === 'original_ip') return 'original_ip';
    if (worldInfo.worldType === 'custom') return 'custom';
    return 'popular_genre';
  });
  const [genreCategory, setGenreCategory] = useState<GenreCategory>('all');
  const [displayedPresets, setDisplayedPresets] = useState<GenrePreset[]>([]);
  const [selectedGenrePresetId, setSelectedGenrePresetId] = useState<string>('');

  // Phase 1: Custom & Original IP Inputs
  const [originalIpInput, setOriginalIpInput] = useState(worldInfo.worldType === 'original_ip' ? worldInfo.worldName : '');
  const [customTitleInput, setCustomTitleInput] = useState(worldInfo.worldType === 'custom' ? worldInfo.worldName : '');
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [customPremiseInput, setCustomPremiseInput] = useState(worldInfo.worldType === 'custom' ? worldInfo.settingDescription : '');

  // Phase 1: Tone and Manner State
  const [selectedTone, setSelectedTone] = useState<ToneAndManner>(() => {
    if (worldInfo.toneStyle) {
      const found = TONE_AND_MANNER_CATALOG.find(t => t.name === worldInfo.toneStyle || t.id === worldInfo.toneStyle);
      if (found) return found;
    }
    return TONE_AND_MANNER_CATALOG[0];
  });
  const [showTonePicker, setShowTonePicker] = useState(false);

  // Phase 2: Meta Elements State
  const [metaPool, setMetaPool] = useState(() => getWorldTailoredMetaPool(worldInfo));
  const [metaInputs, setMetaInputs] = useState<MetaElementsState>(() => {
    const pool = getWorldTailoredMetaPool(worldInfo);
    const bgVal = character.originBackground || character.metaElements?.background || pool.background[0] || '은둔 고수의 제자';
    const flawVal = character.flaw || character.metaElements?.flaw || pool.flaw[0] || '내공 역류 후유증';
    const oathVal = character.oath || character.metaElements?.oath || pool.oath[0] || '협의를 지키고 약자를 구한다';
    const anchorVal = character.anchor || character.metaElements?.anchor || pool.anchor[0] || '스승의 유품인 옥패';
    const factionVal = character.faction || character.metaElements?.faction || pool.faction[0] || '화산파';

    return {
      background: {
        type: (character.backgroundType as MetaInputType) || 'preset',
        value: bgVal,
        label: '배경 설정'
      },
      flaw: {
        type: (character.flawType as MetaInputType) || 'preset',
        value: flawVal,
        label: '인간적 결핍'
      },
      oath: {
        type: (character.oathType as MetaInputType) || 'preset',
        value: oathVal,
        label: '신념 및 맹세'
      },
      anchor: {
        type: (character.anchorType as MetaInputType) || 'preset',
        value: anchorVal,
        label: '소중한 것/버팀목'
      },
      faction: {
        type: (character.factionType as MetaInputType) || 'preset',
        value: factionVal,
        label: '소속 세력'
      },
    };
  });

  const [physicalDefectInput, setPhysicalDefectInput] = useState(character.physicalDefect || '');

  // Sync meta pool when world settings change
  useEffect(() => {
    const tailoredPool = getWorldTailoredMetaPool(worldInfo);
    setMetaPool(tailoredPool);
  }, [worldInfo.worldName, worldInfo.worldType, worldInfo.settingDescription]);

  // Phase 3: Character State & Stat Mode
  const initialCharPreset = getRandomCharacterPresetForWorld(worldInfo);
  const [statInputMode, setStatInputMode] = useState<'dice' | 'manual'>('dice');
  const [charName, setCharName] = useState(character.name || initialCharPreset.name);
  const [charTitle, setCharTitle] = useState(character.title || initialCharPreset.title);
  const [charAge, setCharAge] = useState<number | string>(character.age || initialCharPreset.age);
  const [charGender, setCharGender] = useState(character.gender || initialCharPreset.gender);
  const [charAppearance, setCharAppearance] = useState(character.appearance || initialCharPreset.appearance);
  const [charBiography, setCharBiography] = useState(character.biography || '');
  const [charGoal, setCharGoal] = useState(character.goal || character.currentGoal || initialCharPreset.goal);
  const [stats, setStats] = useState<CharacterStats>(() => ({
    strength: character.stats?.strength || 12,
    agility: character.stats?.agility || 14,
    constitution: character.stats?.constitution || character.stats?.vitality || 13,
    intelligence: character.stats?.intelligence || character.stats?.intellect || 11,
    wisdom: character.stats?.wisdom || character.stats?.insight || 12,
    charisma: character.stats?.charisma || character.stats?.willpower || 10,
    vitality: character.stats?.vitality || character.stats?.constitution || 13,
    intellect: character.stats?.intellect || character.stats?.intelligence || 11,
    insight: character.stats?.insight || character.stats?.wisdom || 12,
    willpower: character.stats?.willpower || character.stats?.charisma || 10,
  }));
  const [hasCustomizedChar, setHasCustomizedChar] = useState(false);

  // Initialize 10 Presets on Category Change or Mount
  useEffect(() => {
    refreshGenrePresets(genreCategory);
  }, [genreCategory]);

  const refreshGenrePresets = (category: GenreCategory) => {
    soundEngine.playDiceRoll();
    const presets = getRandom10Presets(category);
    setDisplayedPresets(presets);
    if (presets.length > 0) {
      setSelectedGenrePresetId(presets[0].id);
      applyGenrePresetToWorld(presets[0]);
    }
  };

  const applyGenrePresetToWorld = (preset: GenrePreset) => {
    const matchedTone = TONE_AND_MANNER_CATALOG.find(t => t.id === preset.recommendedToneId) || TONE_AND_MANNER_CATALOG[0];
    setSelectedTone(matchedTone);

    const updatedWorld: Partial<WorldInfo> = {
      worldName: preset.name,
      worldType: 'popular_genre' as WorldType,
      settingDescription: preset.premise || preset.summary || '',
      toneStyle: matchedTone.name,
    };
    onUpdateWorldInfo(updatedWorld);

    // If user hasn't explicitly edited custom character details, sync character preset to new world
    if (!hasCustomizedChar) {
      const tailoredChar = getRandomCharacterPresetForWorld(updatedWorld);
      setCharName(tailoredChar.name);
      setCharTitle(tailoredChar.title);
      setCharAge(tailoredChar.age);
      setCharGender(tailoredChar.gender);
      setCharAppearance(tailoredChar.appearance);
      setCharGoal(tailoredChar.goal);

      onUpdateCharacter({
        name: tailoredChar.name,
        title: tailoredChar.title,
        age: tailoredChar.age,
        gender: tailoredChar.gender,
        appearance: tailoredChar.appearance,
        goal: tailoredChar.goal,
        currentGoal: tailoredChar.goal,
      });
    }
  };

  const handleSelectGenrePreset = (preset: GenrePreset) => {
    soundEngine.playTurnComplete();
    setSelectedGenrePresetId(preset.id);
    applyGenrePresetToWorld(preset);
  };

  // Instant CSPRNG World-Tailored Character Random Generator (0.001s, No AI Token Waste)
  const handleRandomizeCharacter = () => {
    soundEngine.playDiceRoll();
    const preset = getRandomCharacterPresetForWorld(worldInfo);
    const rawStats = generateAllStatsCSPRNG();
    const newStats: CharacterStats = {
      strength: rawStats.strength,
      agility: rawStats.agility,
      constitution: rawStats.vitality,
      intelligence: rawStats.intellect,
      wisdom: rawStats.insight,
      charisma: rawStats.willpower,
      vitality: rawStats.vitality,
      intellect: rawStats.intellect,
      insight: rawStats.insight,
      willpower: rawStats.willpower,
    };

    setCharName(preset.name);
    setCharTitle(preset.title);
    setCharAge(preset.age);
    setCharGender(preset.gender);
    setCharAppearance(preset.appearance);
    setCharGoal(preset.goal);
    setStats(newStats);

    onUpdateCharacter({
      name: preset.name,
      title: preset.title,
      age: preset.age,
      gender: preset.gender,
      appearance: preset.appearance,
      goal: preset.goal,
      currentGoal: preset.goal,
      stats: newStats,
    });
  };

  // Switch to Phase 2
  const handleProceedToPhase2 = () => {
    soundEngine.playTurnComplete();
    if (worldMode === 'original_ip') {
      const ip = originalIpInput.trim() || '원작 세계관';
      onUpdateWorldInfo({
        worldName: ip,
        worldType: 'original_ip' as WorldType,
        settingDescription: `${ip} 원작의 정사 타임라인 및 세력 관계를 바탕으로 전개되는 서사입니다.`,
        toneStyle: selectedTone.name,
      });
    } else if (worldMode === 'custom') {
      onUpdateWorldInfo({
        worldName: customTitleInput.trim() || '오리지널 세계관',
        worldType: 'custom' as WorldType,
        settingDescription: customPremiseInput.trim() || `${customGenreInput || '자유 장르'} 플레이어가 직접 설계한 독창적인 세계관입니다.`,
        toneStyle: selectedTone.name,
      });
    } else {
      onUpdateWorldInfo({
        worldType: 'popular_genre' as WorldType,
        toneStyle: selectedTone.name,
      });
    }
    setStep(2);
  };

  // Meta 5 All-in-one Smart Recommendation
  const applyAllInOneSmartMetaSet = () => {
    soundEngine.playDiceRoll();
    const pool = getWorldTailoredMetaPool(worldInfo);
    const pick = (arr: string[] = []) => (arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : '');

    const updated: MetaElementsState = {
      background: { type: 'preset', value: pick(pool.background), label: '배경 설정' },
      flaw: { type: 'preset', value: pick(pool.flaw), label: '인간적 결핍' },
      oath: { type: 'preset', value: pick(pool.oath), label: '신념 및 맹세' },
      anchor: { type: 'preset', value: pick(pool.anchor), label: '소중한 것/버팀목' },
      faction: { type: 'preset', value: pick(pool.faction), label: '소속 세력' },
    };
    setMetaInputs(updated);
    syncMetaToCharacter(updated, physicalDefectInput);
  };

  const syncMetaToCharacter = (meta: MetaElementsState, defect: string) => {
    onUpdateCharacter({
      originBackground: meta.background.value,
      backgroundType: meta.background.type,
      flaw: meta.flaw.value,
      flawType: meta.flaw.type,
      oath: meta.oath.value,
      oathType: meta.oath.type,
      anchor: meta.anchor.value,
      anchorType: meta.anchor.type,
      faction: meta.faction.value,
      factionType: meta.faction.type,
      physicalDefect: defect,
      metaElements: {
        background: meta.background.value,
        flaw: meta.flaw.value,
        oath: meta.oath.value,
        anchor: meta.anchor.value,
        faction: meta.faction.value,
      }
    });
  };

  const handleMetaItemChange = (key: keyof MetaElementsState, item: MetaItemState) => {
    const next = { ...metaInputs, [key]: item };
    setMetaInputs(next);
    syncMetaToCharacter(next, physicalDefectInput);
  };

  const rerollSingleMetaItem = (fieldKey: keyof MetaElementsState) => {
    soundEngine.playDiceRoll();
    const pool = (metaPool as any)[fieldKey] || [];
    if (pool.length === 0) return;
    const currentVal = metaInputs[fieldKey]?.value;
    const filtered = pool.filter((p: string) => p !== currentVal);
    const poolToPick = filtered.length > 0 ? filtered : pool;
    const nextVal = poolToPick[Math.floor(Math.random() * poolToPick.length)];

    handleMetaItemChange(fieldKey, {
      type: 'preset',
      value: nextVal,
      label: metaInputs[fieldKey]?.label || fieldKey,
    });
  };

  // Phase 3: Reroll CSPRNG Stats
  const handleRerollStats = () => {
    soundEngine.playDiceRoll();
    const rawStats = generateAllStatsCSPRNG();
    const newStats: CharacterStats = {
      strength: rawStats.strength,
      agility: rawStats.agility,
      constitution: rawStats.vitality,
      intelligence: rawStats.intellect,
      wisdom: rawStats.insight,
      charisma: rawStats.willpower,
      vitality: rawStats.vitality,
      intellect: rawStats.intellect,
      insight: rawStats.insight,
      willpower: rawStats.willpower,
    };
    setStats(newStats);
    onUpdateCharacter({
      stats: newStats,
    });
  };

  const handleManualStatChange = (key: keyof CharacterStats, value: number) => {
    const clamped = Math.max(3, Math.min(18, value || 3));
    const nextStats: CharacterStats = { ...stats, [key]: clamped };
    if (key === 'constitution') nextStats.vitality = clamped;
    if (key === 'intelligence') nextStats.intellect = clamped;
    if (key === 'wisdom') nextStats.insight = clamped;
    if (key === 'charisma') nextStats.willpower = clamped;

    setStats(nextStats);
    onUpdateCharacter({
      stats: nextStats,
    });
  };

  const handleProceedToPhase3 = () => {
    soundEngine.playTurnComplete();
    syncMetaToCharacter(metaInputs, physicalDefectInput);
    setStep(3);
  };

  const handleFinalSubmit = () => {
    soundEngine.playSuccessSound();
    const finalName = charName.trim() || '무명 협객';
    const finalTitle = charTitle.trim() || '초출강호';
    const finalGoal = charGoal.trim() || '세상에 얽힌 진실을 밝혀내고 살아남는 것';
    const finalAppearance = charAppearance.trim() || '단정한 용모와 결연한 눈빛';
    const finalBio = charBiography.trim() || `${finalName}의 전설이 시작되는 순간입니다.`;

    const updatedChar: Partial<Character> = {
      name: finalName,
      title: finalTitle,
      age: charAge,
      gender: charGender,
      appearance: finalAppearance,
      biography: finalBio,
      goal: finalGoal,
      currentGoal: finalGoal,
      stats,
      originBackground: metaInputs.background.value,
      backgroundType: metaInputs.background.type,
      flaw: metaInputs.flaw.value,
      flawType: metaInputs.flaw.type,
      oath: metaInputs.oath.value,
      oathType: metaInputs.oath.type,
      anchor: metaInputs.anchor.value,
      anchorType: metaInputs.anchor.type,
      faction: metaInputs.faction.value,
      factionType: metaInputs.faction.type,
      physicalDefect: physicalDefectInput,
      metaElements: {
        background: metaInputs.background.value,
        flaw: metaInputs.flaw.value,
        oath: metaInputs.oath.value,
        anchor: metaInputs.anchor.value,
        faction: metaInputs.faction.value,
      }
    };

    onUpdateCharacter(updatedChar);
    onCompleteCreation();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-20 px-1 sm:px-0">
      {/* Top Banner with Model Selector */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black font-serif text-amber-200 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>TRPG 서사 생성 엔진</span>
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            세계관, 5대 메타 설정, 캐릭터와 공정 주사위 스탯을 확립합니다.
          </p>
        </div>

        {selectedModel && onSelectModel && (
          <div className="shrink-0">
            <ModelSelector
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
            />
          </div>
        )}
      </div>

      {/* Mobile-Optimized Slim Stepper */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-2.5 shadow-lg backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            id="step-tab-1"
            onClick={() => setStep(1)}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              step === 1
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                : 'bg-stone-800/60 text-stone-300 hover:bg-stone-750'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>1. 세계관</span>
          </button>

          <button
            type="button"
            id="step-tab-2"
            onClick={() => step >= 2 && setStep(2)}
            disabled={step < 2}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              step === 2
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                : step > 2
                ? 'bg-stone-800/60 text-stone-300 hover:bg-stone-750 cursor-pointer'
                : 'bg-stone-900/40 text-stone-600 cursor-not-allowed opacity-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>2. 메타 설정</span>
          </button>

          <button
            type="button"
            id="step-tab-3"
            onClick={() => step >= 3 && setStep(3)}
            disabled={step < 3}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              step === 3
                ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                : 'bg-stone-900/40 text-stone-600 cursor-not-allowed opacity-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>3. 캐릭터 & 능력치</span>
          </button>
        </div>
      </div>

      {/* STEP 1: WORLD & TONE */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="border-b border-stone-800 pb-3">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-400" />
                1단계: 세계관 및 서사 톤 설정
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                모험의 무대가 될 세계관 프리셋을 선택하거나 자유롭게 구축하세요.
              </p>
            </div>

            {/* 3 World Modes Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'popular_genre', title: '인기 장르 프리셋', desc: '정통 무협, 판타지, SF 등 120+종', icon: '🔥' },
                { id: 'original_ip', title: '원작 IP 고증 모드', desc: '애니, 소설, 영화 명작 세계관', icon: '📖' },
                { id: 'custom', title: '오리지널 세계관 창작', desc: '자유 설정 및 독창적 대립 구도', icon: '✍️' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  id={`mode-btn-${m.id}`}
                  onClick={() => {
                    soundEngine.playTurnComplete();
                    const newMode = m.id as any;
                    setWorldMode(newMode);
                    onUpdateWorldInfo({ worldType: newMode });
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    worldMode === m.id
                      ? 'border-amber-500 bg-amber-500/10 shadow-lg ring-1 ring-amber-500/50'
                      : 'border-stone-800 bg-stone-950/40 hover:border-stone-700 hover:bg-stone-900/40'
                  }`}
                >
                  <div className="text-lg mb-1">{m.icon}</div>
                  <div className="font-bold text-xs sm:text-sm text-stone-100">{m.title}</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>

            {/* Popular Genre 10 Presets Section */}
            {worldMode === 'popular_genre' && (
              <div className="space-y-3 pt-1">
                {/* Category Filter Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: '전체 (120+ 종)' },
                    { id: 'janime_jrpg', label: '🇯🇵 소년만화/JRPG' },
                    { id: 'classic_fantasy', label: '🏰 정통/다크 판타지' },
                    { id: 'scifi_cyber', label: '🚀 SF/사이버펑크' },
                    { id: 'mystery_horror', label: '👁️ 미스터리/코스믹' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      id={`genre-cat-${cat.id}`}
                      onClick={() => setGenreCategory(cat.id as GenreCategory)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        genreCategory === cat.id
                          ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                          : 'bg-stone-800/80 text-stone-400 hover:text-stone-200 hover:bg-stone-750'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* 10 Presets Header & Reroll Button */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-stone-300 font-medium">
                    10종 무작위 추천 목록 (클릭하여 선택)
                  </span>
                  <button
                    type="button"
                    id="reroll-10-presets-btn"
                    onClick={() => refreshGenrePresets(genreCategory)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-amber-400 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>🎲 10종 리롤</span>
                  </button>
                </div>

                {/* 10 Presets Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {displayedPresets.map((preset) => {
                    const isSelected = selectedGenrePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        id={`preset-card-${preset.id}`}
                        onClick={() => handleSelectGenrePreset(preset)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 shadow-md ring-1 ring-amber-500/50'
                            : 'border-stone-800 bg-stone-950/50 hover:border-stone-700 hover:bg-stone-900/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-stone-100 truncate">{preset.name}</h4>
                          {isSelected && <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-amber-400 font-mono mt-0.5">{preset.period}</p>
                        <p className="text-xs text-stone-300 mt-1.5 line-clamp-2 leading-relaxed">
                          {preset.premise || preset.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Original IP Input */}
            {worldMode === 'original_ip' && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  원작 작품명 입력 (소설, 만화, 영화, 게임 등)
                </label>
                <input
                  type="text"
                  id="original-ip-input"
                  value={originalIpInput}
                  onChange={(e) => setOriginalIpInput(e.target.value)}
                  placeholder="예: 귀멸의 칼날, 반지의 제왕, 듄, 사조영웅전, 전생슬, 블리치..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Custom World Input */}
            {worldMode === 'custom' && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-300">세계관 이름</label>
                    <input
                      type="text"
                      id="custom-world-title-input"
                      value={customTitleInput}
                      onChange={(e) => setCustomTitleInput(e.target.value)}
                      placeholder="예: 영구동토의 증기제국"
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-300">장르 / 시대</label>
                    <input
                      type="text"
                      id="custom-world-genre-input"
                      value={customGenreInput}
                      onChange={(e) => setCustomGenreInput(e.target.value)}
                      placeholder="예: 스팀펑크, 빙하기 아포칼립스"
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-300">세계관 설정 및 대립 구도</label>
                  <textarea
                    rows={3}
                    id="custom-world-premise-input"
                    value={customPremiseInput}
                    onChange={(e) => setCustomPremiseInput(e.target.value)}
                    placeholder="세계관의 핵심 분위기, 주요 세력 간 갈등 등을 자유롭게 서술하세요."
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-sm text-stone-100 focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Tone and Manner Selection Bar */}
            <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-stone-400 block">선택된 서사 문체 (Tone & Style)</span>
                <span className="text-xs font-bold text-amber-300">{selectedTone.name}</span>
              </div>
              <button
                type="button"
                id="toggle-tone-picker-btn"
                onClick={() => setShowTonePicker(!showTonePicker)}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer"
              >
                문체 변경
              </button>
            </div>

            {showTonePicker && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-stone-800/60 max-h-[220px] overflow-y-auto">
                {TONE_AND_MANNER_CATALOG.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    id={`tone-option-${t.id}`}
                    onClick={() => {
                      soundEngine.playTurnComplete();
                      setSelectedTone(t);
                      onUpdateWorldInfo({ toneStyle: t.name });
                      setShowTonePicker(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      selectedTone.id === t.id
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-bold'
                        : 'border-stone-800 bg-stone-950/40 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="font-bold">{t.name}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">{t.description}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Proceed to Phase 2 Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                id="proceed-to-step-2-btn"
                onClick={handleProceedToPhase2}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold text-sm shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer"
              >
                <span>세계관 확정 및 메타 설정 이동</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: 5 META ELEMENTS */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-800">
              <div>
                <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  2단계: 5대 메타 요소 설정
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  세계관: <strong className="text-stone-200">{worldInfo.worldName || '미지의 세계'}</strong> | 톤: <span className="text-amber-400">{selectedTone.name}</span>
                </p>
              </div>
              <button
                type="button"
                id="smart-meta-all-btn"
                onClick={applyAllInOneSmartMetaSet}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Dice5 className="w-3.5 h-3.5" />
                <span>🎲 5대 메타 일괄 랜덤 추천</span>
              </button>
            </div>

            {/* 5 Meta Cards */}
            <div className="space-y-3">
              {[
                { key: 'background', title: '1. 배경 설정 (Background)', desc: '출신, 성장 환경 및 초기 위치' },
                { key: 'flaw', title: '2. 인간적 결핍과 약점 (Flaw)', desc: '서사 중 극복 가능한 육체/정신적 약점' },
                { key: 'oath', title: '3. 신념 및 맹세 (Oath)', desc: '타협할 수 없는 주인공의 행동 규범' },
                { key: 'anchor', title: '4. 소중한 것/버팀목 (Anchor)', desc: '붕괴를 막아주는 유대, 인연 또는 유품' },
                { key: 'faction', title: '5. 소속 세력/문파 (Faction)', desc: '초기 연고지 및 사회적 관계망' },
              ].map(({ key, title, desc }) => {
                const fieldKey = key as keyof MetaElementsState;
                const currentItem = metaInputs[fieldKey] || { type: 'preset', value: '', label: title };
                const pool = (metaPool as any)[fieldKey] || [];

                return (
                  <div key={key} className="p-3 bg-stone-950/60 border border-stone-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-stone-200">{title}</h4>
                        <span className="text-[10px] text-stone-400">{desc}</span>
                      </div>

                      {/* 3 Tab Mode Switcher */}
                      <div className="flex items-center bg-stone-900 border border-stone-800 rounded-lg p-0.5">
                        <button
                          type="button"
                          id={`meta-tab-preset-${key}`}
                          onClick={() => handleMetaItemChange(fieldKey, { type: 'preset', value: currentItem.value || pool[0] || '', label: title })}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            currentItem.type === 'preset' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                          }`}
                        >
                          프리셋
                        </button>
                        <button
                          type="button"
                          id={`meta-tab-custom-${key}`}
                          onClick={() => handleMetaItemChange(fieldKey, { type: 'custom', value: currentItem.value || '', label: title })}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            currentItem.type === 'custom' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                          }`}
                        >
                          직접서술
                        </button>
                        <button
                          type="button"
                          id={`meta-tab-tabula-${key}`}
                          onClick={() => handleMetaItemChange(fieldKey, { type: 'tabula_rasa', value: '미상 / 백지 상태 (Tabula Rasa)', isTabulaRasa: true, label: title })}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            currentItem.type === 'tabula_rasa' ? 'bg-purple-600 text-white' : 'text-stone-400'
                          }`}
                        >
                          백지
                        </button>
                      </div>
                    </div>

                    {/* Preset Selection UI */}
                    {currentItem.type === 'preset' && (
                      <div className="flex items-center justify-between gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <span className="text-xs text-stone-100 truncate">{currentItem.value || pool[0]}</span>
                        <button
                          type="button"
                          id={`meta-reroll-btn-${key}`}
                          onClick={() => rerollSingleMetaItem(fieldKey)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs font-semibold shrink-0 cursor-pointer"
                          title="다른 프리셋 무작위 추천"
                        >
                          <Dice5 className="w-3 h-3" />
                          <span>랜덤</span>
                        </button>
                      </div>
                    )}

                    {/* Custom Input UI */}
                    {currentItem.type === 'custom' && (
                      <input
                        type="text"
                        id={`meta-custom-input-${key}`}
                        value={currentItem.value}
                        onChange={(e) => handleMetaItemChange(fieldKey, { type: 'custom', value: e.target.value, label: title })}
                        placeholder="자유롭게 작성하세요 (AI가 최우선 복선으로 활용합니다)"
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                      />
                    )}

                    {/* Tabula Rasa UI */}
                    {currentItem.type === 'tabula_rasa' && (
                      <div className="p-2 bg-purple-950/30 border border-purple-800/40 rounded-lg text-xs text-purple-300">
                        🌱 기억상실 또는 무소속 백지 상태로 시작하여 서사 속에서 실마리가 밝혀집니다.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Romantic Clause: Physical Defect / Breakthrough */}
            <div className="p-3 bg-stone-950/40 border border-stone-800/80 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>신체 결손 및 낭만 돌파구 (선택 사항)</span>
              </div>
              <input
                type="text"
                id="physical-defect-input"
                value={physicalDefectInput}
                onChange={(e) => {
                  setPhysicalDefectInput(e.target.value);
                  syncMetaToCharacter(metaInputs, e.target.value);
                }}
                placeholder="예: 단전 파열 후 얻은 외공 극의, 외눈의 투시안, 기계 의수..."
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                id="back-to-step-1-btn"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold hover:bg-stone-750 transition-colors cursor-pointer"
              >
                이전: 세계관
              </button>
              <button
                type="button"
                id="proceed-to-step-3-btn"
                onClick={handleProceedToPhase3}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-stone-950 text-xs font-bold hover:bg-amber-400 shadow-md transition-colors cursor-pointer"
              >
                <span>캐릭터 시트 설정 이동</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CHARACTER SHEET & STATS */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  3단계: 캐릭터 정보 및 스탯
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  세계관 맞춤 기본 정보와 CSPRNG 공정 주사위 스탯을 설정합니다.
                </p>
              </div>

              {/* Instant 0.001s Random Button */}
              <button
                type="button"
                id="randomize-char-full-btn"
                onClick={handleRandomizeCharacter}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow cursor-pointer"
                title="세계관에 어울리는 캐릭터 정보와 스탯 즉시 무작위 생성"
              >
                <Dice5 className="w-3.5 h-3.5 text-amber-400" />
                <span>🎲 캐릭터 전체 랜덤 세팅</span>
              </button>
            </div>

            {/* Profile Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-300">이름</label>
                <input
                  type="text"
                  id="char-name-input"
                  value={charName}
                  onChange={(e) => {
                    setCharName(e.target.value);
                    setHasCustomizedChar(true);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-300">칭호 / 직함</label>
                <input
                  type="text"
                  id="char-title-input"
                  value={charTitle}
                  onChange={(e) => {
                    setCharTitle(e.target.value);
                    setHasCustomizedChar(true);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-300">나이</label>
                <input
                  type="number"
                  id="char-age-input"
                  value={charAge}
                  onChange={(e) => {
                    setCharAge(Number(e.target.value));
                    setHasCustomizedChar(true);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-300">성별</label>
                <select
                  id="char-gender-select"
                  value={charGender}
                  onChange={(e) => {
                    setCharGender(e.target.value);
                    setHasCustomizedChar(true);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="남성">남성</option>
                  <option value="여성">여성</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>

            {/* Appearance & Goal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-300">외형 묘사</label>
                <input
                  type="text"
                  id="char-appearance-input"
                  value={charAppearance}
                  onChange={(e) => {
                    setCharAppearance(e.target.value);
                    setHasCustomizedChar(true);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-300">초기 목표</label>
                <input
                  type="text"
                  id="char-goal-input"
                  value={charGoal}
                  onChange={(e) => {
                    setCharGoal(e.target.value);
                    setHasCustomizedChar(true);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Stats Board */}
            <div className="p-3.5 bg-stone-950/80 border border-stone-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                    <Dice5 className="w-3.5 h-3.5 text-amber-400" />
                    6대 기본 능력치 (Stats)
                  </h3>
                  <span className="text-[10px] text-stone-400">CSPRNG 4d6 공정 난수 굴림 방식 (3~18)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-stone-900 border border-stone-700 rounded-lg p-0.5">
                    <button
                      type="button"
                      id="stat-mode-dice-btn"
                      onClick={() => setStatInputMode('dice')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        statInputMode === 'dice' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                      }`}
                    >
                      🎲 주사위
                    </button>
                    <button
                      type="button"
                      id="stat-mode-manual-btn"
                      onClick={() => setStatInputMode('manual')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        statInputMode === 'manual' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                      }`}
                    >
                      ✏️ 직접입력
                    </button>
                  </div>
                  {statInputMode === 'dice' && (
                    <button
                      type="button"
                      id="reroll-stats-btn"
                      onClick={handleRerollStats}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>리롤</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 6 Stats Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { key: 'strength', label: '근력/공력', val: stats.strength },
                  { key: 'agility', label: '민첩/신법', val: stats.agility },
                  { key: 'constitution', label: '체력/기골', val: stats.constitution || stats.vitality || 10 },
                  { key: 'intelligence', label: '지략/학식', val: stats.intelligence || stats.intellect || 10 },
                  { key: 'wisdom', label: '통찰/안목', val: stats.wisdom || stats.insight || 10 },
                  { key: 'charisma', label: '정신/의지', val: stats.charisma || stats.willpower || 10 },
                ].map(({ key, label, val }) => {
                  const statKey = key as keyof CharacterStats;
                  const mod = calculateModifier(val);
                  return (
                    <div key={key} className="p-2 bg-stone-900 border border-stone-800 rounded-lg text-center">
                      <span className="text-[10px] text-stone-400 block truncate">{label}</span>
                      {statInputMode === 'dice' ? (
                        <div className="text-base font-bold text-stone-100 font-mono my-0.5">{val}</div>
                      ) : (
                        <input
                          type="number"
                          min={3}
                          max={18}
                          id={`manual-stat-input-${key}`}
                          value={val}
                          onChange={(e) => handleManualStatChange(statKey, Number(e.target.value))}
                          className="w-full text-center bg-stone-950 border border-stone-700 rounded py-0.5 text-xs font-bold text-amber-400 font-mono my-0.5"
                        />
                      )}
                      <span className="text-[10px] font-bold text-amber-400 block">
                        {mod >= 0 ? `+${mod}` : mod}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Game Start Button */}
            <div className="flex justify-between pt-2">
              <button
                type="button"
                id="back-to-step-2-btn"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold hover:bg-stone-750 transition-colors cursor-pointer"
              >
                이전: 메타
              </button>
              <button
                type="button"
                id="final-launch-game-btn"
                onClick={handleFinalSubmit}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold text-sm shadow-xl shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>TRPG 서사 모험 시작</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
