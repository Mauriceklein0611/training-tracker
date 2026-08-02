import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  Database,
  Dumbbell,
  HardDrive,
  Layers,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { More } from '@/i18n/locales/de/more';
import { PageHeader } from '@/components/layout/PageHeader';
import { CommunityGroup } from '@/features/community/CommunityGroup';
import { SupportCard } from '@/features/community/SupportCard';

/**
 * Entry keys are derived from the translation resources, so the typed `t()`
 * still catches a typo or a removed entry at compile time even though the label
 * is looked up dynamically.
 */
type MoreEntryKey = Exclude<keyof More, 'title' | 'groups' | 'screens'>;
type MoreGroupKey = `groups.${keyof More['groups']}`;

interface MoreItem {
  to: string;
  /** Key into the "more" namespace holding this entry's label + description. */
  key: MoreEntryKey;
  Icon: LucideIcon;
}

/**
 * The "Mehr" hub, grouped so related tools sit together instead of one long
 * undifferentiated list. The full reset stays inside "Daten & Sicherung" as a
 * deliberately guarded destructive action — never a top-level tap here.
 */
const GROUPS: { titleKey: MoreGroupKey; items: MoreItem[] }[] = [
  {
    titleKey: 'groups.training',
    items: [
      { to: '/bibliothek', key: 'library', Icon: Layers },
      { to: '/mehr/uebungen', key: 'exercises', Icon: Dumbbell },
      { to: '/mehr/equipment', key: 'equipment', Icon: Wrench },
    ],
  },
  {
    titleKey: 'groups.progress',
    items: [
      { to: '/mehr/koerpergewicht', key: 'bodyData', Icon: Scale },
      { to: '/mehr/ki-analysen', key: 'aiAnalyses', Icon: Sparkles },
    ],
  },
  {
    titleKey: 'groups.data',
    items: [
      { to: '/mehr/daten', key: 'backup', Icon: Database },
      { to: '/mehr/speicher', key: 'storage', Icon: HardDrive },
    ],
  },
  {
    titleKey: 'groups.app',
    items: [
      { to: '/mehr/einstellungen', key: 'settings', Icon: Settings },
      { to: '/hilfe', key: 'guide', Icon: BookOpen },
      { to: '/mehr/glossar', key: 'glossary', Icon: BookOpen },
      { to: '/mehr/datenschutz', key: 'privacy', Icon: ShieldCheck },
    ],
  },
];

export default function MorePage() {
  const { t } = useTranslation('more');
  const { t: tCommon } = useTranslation();

  return (
    <>
      <PageHeader title={t('title')} />

      {/* The project card sits above the tool groups so voluntary support is
          findable — but it is never a training call to action (#32). */}
      <SupportCard />

      <div className="grid gap-6">
        {GROUPS.map((group) => (
          <section key={group.titleKey} aria-labelledby={`more-${group.titleKey}`}>
            <h2
              id={`more-${group.titleKey}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted"
            >
              {t(group.titleKey)}
            </h2>
            <ul className="grid gap-2">
              {group.items.map(({ to, key, Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-surface-2"
                  >
                    <Icon size={22} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{t(`${key}.label`)}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-muted">
                        {t(`${key}.description`)}
                      </span>
                    </span>
                    <ChevronRight
                      size={20}
                      className="shrink-0 text-muted"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <CommunityGroup />
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        {tCommon('footer.tagline')}
        <br />
        {tCommon('footer.privacy')}
      </p>
    </>
  );
}
