import type { Domain } from '@/i18n/locales/de/domain';

export const domain: Domain = {
  trackingType: {
    weight_reps: 'Weight + reps',
    bodyweight_reps: 'Bodyweight',
    assisted_bodyweight_reps: 'Assisted',
    reps_only: 'Reps only',
    duration: 'Time',
    cardio: 'Cardio',
  },
  trackingTypeHelp: {
    weight_reps: 'External weight and reps, e.g. bench press or dumbbell curls.',
    bodyweight_reps: 'Bodyweight with optional added weight, e.g. pull-ups or dips.',
    assisted_bodyweight_reps:
      'Assisted bodyweight exercise, e.g. pull-ups on a machine or with a band.',
    reps_only: 'Reps only, without a meaningful load, e.g. TRX rows or mobility work.',
    duration: 'Time instead of reps, e.g. plank or dead hang.',
    cardio:
      'Endurance training with duration and/or distance, e.g. running, cycling or rowing. Evaluated separately from strength.',
  },
  weightMode: {
    per_hand: 'Per hand',
    total: 'Total',
    added_weight: 'Added weight',
    assistance: 'Assistance',
    none: 'No weight',
  },
  weightModeHelp: {
    per_hand:
      'The value you enter applies per dumbbell. The multiplier determines the total load.',
    total:
      'The value you enter is already the total load, e.g. a barbell including the bar.',
    added_weight: 'Weight added to your bodyweight, e.g. a dipping belt.',
    assistance: 'Assistance that reduces the load, e.g. a counterweight on a machine.',
    none: 'No weight is recorded for this exercise.',
  },
  setType: {
    warmup: 'Warm-up set',
    working: 'Working set',
    drop: 'Drop set',
    failure: 'To failure',
  },
  setTypeShort: {
    warmup: 'W',
    working: 'S',
    drop: 'D',
    failure: 'F',
  },
};
