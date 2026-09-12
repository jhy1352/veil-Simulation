import { Language } from '../types';

export interface PresetLocale {
  code: string;
  label: string;
  nativeName: string;
}

export const PRESET_LOCALES: readonly PresetLocale[] = [
  { code: 'system', label: 'System Default', nativeName: '시스템 기본 (자동 감지)' },
  { code: 'ko-KR', label: 'Korean', nativeName: '한국어 (ko-KR)' },
  { code: 'en-US', label: 'English', nativeName: 'English (en-US)' },
  { code: 'ja-JP', label: 'Japanese', nativeName: '日本語 (ja-JP)' },
  { code: 'zh-CN', label: 'Chinese (Simplified)', nativeName: '中文 (zh-CN)' },
  { code: 'fr-FR', label: 'French', nativeName: 'Français (fr-FR)' },
  { code: 'de-DE', label: 'German', nativeName: 'Deutsch (de-DE)' },
  { code: 'es-ES', label: 'Spanish', nativeName: 'Español (es-ES)' },
  { code: 'it-IT', label: 'Italian', nativeName: 'Italiano (it-IT)' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', nativeName: 'Português (pt-BR)' },
  { code: 'ru-RU', label: 'Russian', nativeName: 'Русский (ru-RU)' },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية (ar)' },
  { code: 'hi-IN', label: 'Hindi', nativeName: 'हिन्दी (hi-IN)' },
  { code: 'id-ID', label: 'Indonesian', nativeName: 'Bahasa Indonesia (id-ID)' },
  { code: 'tr-TR', label: 'Turkish', nativeName: 'Türkçe (tr-TR)' },
] as const;

export const NARRATIVE_LOCALE_STORAGE_KEY = 'veil_narrative_locale';

/**
 * Detect browser/system default locale using navigator.languages or navigator.language
 */
export function detectSystemLocale(): string {
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0 && navigator.languages[0]) {
      return navigator.languages[0];
    }
    if (navigator.language) {
      return navigator.language;
    }
  }
  return 'ko-KR';
}

/**
 * Normalize and sanitize any open-ended BCP-47 locale string.
 * Allows arbitrary valid locale strings (e.g. 'fr-FR', 'es-MX', 'sv-SE', 'custom:xx-YY').
 */
export function normalizeNarrativeLocale(rawLocale?: string | null): string {
  if (!rawLocale || typeof rawLocale !== 'string') {
    return 'ko-KR';
  }
  const trimmed = rawLocale.trim();
  if (!trimmed || trimmed === 'system') {
    return detectSystemLocale();
  }
  // Sanitize to prevent prompt injection attempts while supporting open-ended BCP-47 tags
  const sanitized = trimmed.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 35);
  return sanitized || 'ko-KR';
}

/**
 * Map runtime narrative locale to available UI translation table ('ko' | 'en' | 'ja' | 'zh').
 * Decouples UI translation layer from open-ended narrative locale.
 */
export function mapLocaleToUiLanguage(locale: string): Language {
  const normalized = (locale || '').toLowerCase();
  if (normalized.startsWith('ko')) return 'ko';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('zh')) return 'zh';
  return 'ko'; // Fallback for UI translation table
}

export function getStoredNarrativeLocale(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(NARRATIVE_LOCALE_STORAGE_KEY);
      if (stored && typeof stored === 'string') {
        return stored.trim();
      }
    }
  } catch {
    // ignore
  }
  return 'system';
}

export function setStoredNarrativeLocale(locale: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NARRATIVE_LOCALE_STORAGE_KEY, locale.trim());
    }
  } catch {
    // ignore
  }
}

export function getEffectiveNarrativeLocale(storedLocale?: string): string {
  const loc = storedLocale || getStoredNarrativeLocale();
  if (!loc || loc === 'system') {
    return detectSystemLocale();
  }
  return normalizeNarrativeLocale(loc);
}

/**
 * Server-side / API System Instruction builder:
 * Injects narrative output target locale directive into MASTER_SYSTEM_INSTRUCTION.
 */
export function constructSystemInstructionWithLocale(baseInstruction: string, rawLocale: string): string {
  const targetLocale = normalizeNarrativeLocale(rawLocale);
  const directive = `

---

## 11. Open-Ended Multilingual Runtime Locale Directive (Target Locale: ${targetLocale})

[CRITICAL OPERATIONAL REQUIREMENT]
1. Target Narrative Language (${targetLocale}):
   - All generated natural-language outputs (including candidate labels, narrativeSummaries, full GM narrative text, character dialogue, sensory descriptions, and non-mutation fallback prose) MUST be written in the specified target locale (${targetLocale}).
2. Engine Contract & Semantic Event Immutability:
   - Do NOT translate, alter, or mutate language-neutral SemanticEvent action strings (e.g. "PICKUP", "GIFT", "ADVANCE_TIME"), role names (e.g. "SUBJECT", "TARGET", "OBJECT"), JSON schema property keys, or engine structural flags.
   - All structured JSON contracts (CandidateOutput array, rawMetadata, actions, etc.) must adhere strictly to their language-neutral schema definitions.
3. Epistemic & Authority Isolation:
   - The output locale (${targetLocale}) is strictly transport/presentation metadata.
   - Locale is NOT player intent, world fact, historical provenance, or epistemic evidence.
   - Locale instructions MUST NOT alter Engine validation, state transition approval, or Canonical Commit gates.
`;
  return baseInstruction + directive;
}
