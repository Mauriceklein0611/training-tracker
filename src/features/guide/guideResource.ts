import { getLanguage } from '@/i18n';
import { guide as deGuide } from '@/i18n/locales/de/guide';
import { guide as enGuide } from '@/i18n/locales/en/guide';

export function guideResource() {
  return getLanguage() === 'de' ? deGuide : enGuide;
}
