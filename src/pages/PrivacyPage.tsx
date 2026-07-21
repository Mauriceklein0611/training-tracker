import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

const SECTIONS = [
  {
    title: 'Alle Daten bleiben auf diesem Gerät',
    text: 'Übungen, Trainingspläne, Trainingseinheiten, Sätze, Pausen, Notizen und Körpergewicht werden ausschließlich in der lokalen Datenbank (IndexedDB) dieses Browsers gespeichert.',
  },
  {
    title: 'Keine Übertragung an einen Server',
    text: 'Die App besitzt kein Backend und ruft nach dem Laden der Anwendung keine externen Dienste, Schriftarten oder Programmierschnittstellen auf. Es findet keine Übertragung deiner Trainingsdaten statt.',
  },
  {
    title: 'Kein Benutzerkonto',
    text: 'Es gibt keine Registrierung, keine Anmeldung und keine Benutzerverwaltung. Die App weiß nicht, wer du bist.',
  },
  {
    title: 'Kein Tracking, keine Werbung',
    text: 'Es werden keine Cookies gesetzt, keine Analysedienste eingebunden und keine Nutzungsdaten erhoben oder verschickt.',
  },
  {
    title: 'Löschen von Browserdaten entfernt die Historie',
    text: 'Wenn du die Websitedaten deines Browsers löschst, die App vom Home-Bildschirm entfernst oder den privaten Modus verwendest, kann deine Trainingshistorie verloren gehen.',
  },
  {
    title: 'Regelmäßige Sicherungen werden empfohlen',
    text: 'Erstelle regelmäßig eine vollständige Sicherung unter „Daten & Sicherung“ und lege die Datei an einem Ort ab, den du selbst kontrollierst. Nur so kannst du auf ein anderes Gerät wechseln.',
  },
  {
    title: 'Der KI-Export bleibt in deiner Hand',
    text: 'Der Export für eine externe KI wird ausschließlich lokal erzeugt und als Datei gespeichert. Erst wenn du diese Datei selbst weitergibst — etwa in einen Chat hochlädst — verlassen die enthaltenen Daten dein Gerät. Die Datei enthält nur das, was du vor dem Export ausgewählt hast.',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Datenschutz" backTo="/mehr" />
      <div className="grid gap-3">
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{section.text}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
