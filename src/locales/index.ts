import { ko } from './ko';
import { en } from './en';
import { Language } from '../types';

export type { Language };

export const locales = {
  ko,
  en,
  ja: ko, // Fallback to ko/en
  zh: ko
};

export function getTranslation(lang: Language = 'ko') {
  return locales[lang] || locales.ko;
}
