/** Exercise catalog screen (#31). */
export const exercises = {
  title: 'Übungen',
  new: 'Neu',
  search: {
    label: 'Suchen',
    placeholder: 'Name, Synonym, Muskelgruppe, Equipment',
  },
  filter: {
    all: 'Alle',
    originLabel: 'Herkunft',
    originSystem: 'Systemübungen',
    originCustom: 'Eigene Übungen',
    muscleGroup: 'Muskelgruppe',
    equipment: 'Equipment',
    /** "Archivierte Übungen anzeigen ({{count}})" */
    showArchived: 'Archivierte Übungen anzeigen ({{count}})',
  },
  empty: {
    noneTitle: 'Noch keine Übungen',
    noneDescription:
      'Die App bringt einen Katalog klassischer Übungen mit. Lege zusätzlich eigene Übungen an und bestimme, wie sie erfasst werden und wie das Gewicht zu verstehen ist.',
    noneAction: 'Erste Übung anlegen',
    noMatchTitle: 'Keine Treffer',
    noMatchDescription: 'Passe Suche oder Filter an.',
  },
  row: {
    /** "Pause {{seconds}}s" */
    rest: 'Pause {{seconds}}s',
    archivedBadge: 'Archiviert',
    /** Accessible names for the per-row icon buttons. */
    edit: '{{name}} bearbeiten',
    archive: '{{name}} archivieren',
    restore: '{{name}} wiederherstellen',
    delete: '{{name}} löschen',
  },
  toast: {
    archived: 'Übung archiviert.',
    restored: 'Übung wiederhergestellt.',
    deleted: 'Übung gelöscht.',
    deleteFailed: 'Löschen fehlgeschlagen.',
    usedInTraining:
      'Diese Übung wurde bereits trainiert und kann nicht gelöscht werden. Archiviere sie stattdessen.',
  },
  deleteDialog: {
    title: 'Übung löschen?',
    /** "„{{name}}“ wird endgültig entfernt. …" */
    description:
      '„{{name}}“ wird endgültig entfernt. Diese Übung wurde noch in keinem Training verwendet, es gehen also keine Trainingsdaten verloren.',
    confirm: 'Endgültig löschen',
  },
};

export type Exercises = typeof exercises;
