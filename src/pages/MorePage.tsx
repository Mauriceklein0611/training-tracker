import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Database,
  Dumbbell,
  HardDrive,
  Scale,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const ITEMS = [
  {
    to: '/mehr/uebungen',
    label: 'Übungen',
    description: 'Anlegen, bearbeiten, archivieren',
    Icon: Dumbbell,
  },
  {
    to: '/mehr/koerpergewicht',
    label: 'Körperdaten',
    description: 'Gewicht, Körperfett und Umfangsmaße',
    Icon: Scale,
  },
  {
    to: '/mehr/daten',
    label: 'Daten & Sicherung',
    description: 'Backup, Wiederherstellung, KI- und CSV-Export',
    Icon: Database,
  },
  {
    to: '/mehr/einstellungen',
    label: 'Einstellungen',
    description: 'Pausen, Darstellung, Ton und Erinnerungen',
    Icon: Settings,
  },
  {
    to: '/mehr/speicher',
    label: 'Lokale Speicherung',
    description: 'Speicherstatus und Datenbankversion',
    Icon: HardDrive,
  },
  {
    to: '/mehr/datenschutz',
    label: 'Datenschutz',
    description: 'Was gespeichert wird — und was nicht',
    Icon: ShieldCheck,
  },
];

export default function MorePage() {
  return (
    <>
      <PageHeader title="Mehr" />
      <ul className="grid gap-2">
        {ITEMS.map(({ to, label, description, Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-surface-2"
            >
              <Icon size={22} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block truncate text-sm text-muted">{description}</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        Training Tracker — private, lokale Trainingsdokumentation.
        <br />
        Kein Konto, kein Server, keine Übertragung deiner Daten.
      </p>
    </>
  );
}
