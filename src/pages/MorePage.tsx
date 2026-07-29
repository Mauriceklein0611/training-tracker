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
import { PageHeader } from '@/components/layout/PageHeader';
import { CommunityGroup } from '@/features/community/CommunityGroup';

interface MoreItem {
  to: string;
  label: string;
  description: string;
  Icon: LucideIcon;
}

/**
 * The "Mehr" hub, grouped so related tools sit together instead of one long
 * undifferentiated list. The full reset stays inside "Daten & Sicherung" as a
 * deliberately guarded destructive action — never a top-level tap here.
 */
const GROUPS: { title: string; items: MoreItem[] }[] = [
  {
    title: 'Training',
    items: [
      {
        to: '/bibliothek',
        label: 'Bibliothek',
        description: 'Übungseinheiten und Übungen — wiederverwendbar',
        Icon: Layers,
      },
      {
        to: '/mehr/uebungen',
        label: 'Übungen',
        description: 'Anlegen, bearbeiten, archivieren',
        Icon: Dumbbell,
      },
      {
        to: '/mehr/equipment',
        label: 'Equipment-Profile',
        description: 'Verfügbares Equipment je Ort — filtert die Übungsauswahl',
        Icon: Wrench,
      },
    ],
  },
  {
    title: 'Fortschritt',
    items: [
      {
        to: '/mehr/koerpergewicht',
        label: 'Körperdaten',
        description: 'Gewicht, Körperfett und Umfangsmaße',
        Icon: Scale,
      },
      {
        to: '/mehr/ki-analysen',
        label: 'KI-Analysen',
        description: 'Antwortdatei importieren, Feedback und geprüfte Vorschläge',
        Icon: Sparkles,
      },
    ],
  },
  {
    title: 'Daten',
    items: [
      {
        to: '/mehr/daten',
        label: 'Daten & Sicherung',
        description: 'Backup, Wiederherstellung, KI- und CSV-Export, Zurücksetzen',
        Icon: Database,
      },
      {
        to: '/mehr/speicher',
        label: 'Lokale Speicherung',
        description: 'Speicherstatus und Datenbankversion',
        Icon: HardDrive,
      },
    ],
  },
  {
    title: 'App',
    items: [
      {
        to: '/mehr/einstellungen',
        label: 'Einstellungen',
        description: 'Training, Pausen, Darstellung, Ton und Erinnerungen',
        Icon: Settings,
      },
      {
        to: '/mehr/glossar',
        label: 'Glossar',
        description: 'Fachbegriffe wie RPE, RIR, e1RM und Volumen erklärt',
        Icon: BookOpen,
      },
      {
        to: '/mehr/datenschutz',
        label: 'Datenschutz',
        description: 'Was gespeichert wird — und was nicht',
        Icon: ShieldCheck,
      },
    ],
  },
];

export default function MorePage() {
  return (
    <>
      <PageHeader title="Mehr" />
      <div className="grid gap-6">
        {GROUPS.map((group) => (
          <section key={group.title} aria-labelledby={`more-${group.title}`}>
            <h2
              id={`more-${group.title}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted"
            >
              {group.title}
            </h2>
            <ul className="grid gap-2">
              {group.items.map(({ to, label, description, Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-surface-2"
                  >
                    <Icon size={22} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{label}</span>
                      <span className="block truncate text-sm text-muted">
                        {description}
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
        Training Tracker — private, lokale Trainingsdokumentation.
        <br />
        Kein Konto, kein Server, keine Übertragung deiner Daten.
      </p>
    </>
  );
}
