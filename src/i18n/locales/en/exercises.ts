import type { Exercises } from '@/i18n/locales/de/exercises';

export const exercises: Exercises = {
  title: 'Exercises',
  new: 'New',
  search: {
    label: 'Search',
    placeholder: 'Name, synonym, muscle group, equipment',
  },
  filter: {
    all: 'All',
    originLabel: 'Origin',
    originSystem: 'System exercises',
    originCustom: 'Your exercises',
    muscleGroup: 'Muscle group',
    equipment: 'Equipment',
    showArchived: 'Show archived exercises ({{count}})',
  },
  empty: {
    noneTitle: 'No exercises yet',
    noneDescription:
      'The app ships with a catalog of classic exercises. Add your own on top and decide how they are recorded and how their weight is to be read.',
    noneAction: 'Create the first exercise',
    noMatchTitle: 'No matches',
    noMatchDescription: 'Adjust the search or the filters.',
  },
  row: {
    rest: 'Rest {{seconds}}s',
    archivedBadge: 'Archived',
    edit: 'Edit {{name}}',
    archive: 'Archive {{name}}',
    restore: 'Restore {{name}}',
    delete: 'Delete {{name}}',
  },
  toast: {
    archived: 'Exercise archived.',
    restored: 'Exercise restored.',
    deleted: 'Exercise deleted.',
    deleteFailed: 'Could not delete the exercise.',
    usedInTraining:
      'This exercise has already been trained and cannot be deleted. Archive it instead.',
  },
  deleteDialog: {
    title: 'Delete exercise?',
    description:
      '"{{name}}" will be removed permanently. This exercise has not been used in any workout, so no training data is lost.',
    confirm: 'Delete permanently',
  },
};
