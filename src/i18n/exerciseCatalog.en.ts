import type { SystemExerciseCatalogKey } from '@/constants/exerciseCatalog';

export interface LocalizedSystemExercise {
  name: string;
  searchSynonyms: readonly string[];
}

/**
 * English presentation data for the immutable system catalog.
 *
 * The keys, not the German stored names, are the translation contract. The
 * `satisfies` constraint makes a catalog addition fail typecheck until it has
 * an English display name and search vocabulary.
 */
export const ENGLISH_SYSTEM_EXERCISES = {
  'bench-press': {
    name: 'Bench Press',
    searchSynonyms: ['barbell bench press', 'flat bench press', 'chest press'],
  },
  'incline-bench-press': {
    name: 'Incline Bench Press',
    searchSynonyms: ['incline barbell press', 'upper chest press'],
  },
  'decline-bench-press': {
    name: 'Decline Bench Press',
    searchSynonyms: ['decline barbell press', 'lower chest press'],
  },
  'dumbbell-bench-press': {
    name: 'Dumbbell Bench Press',
    searchSynonyms: ['flat dumbbell press', 'dumbbell chest press'],
  },
  'incline-dumbbell-press': {
    name: 'Incline Dumbbell Press',
    searchSynonyms: ['incline dumbbell bench press', 'upper chest dumbbell press'],
  },
  'dumbbell-fly': {
    name: 'Dumbbell Fly',
    searchSynonyms: ['dumbbell flye', 'chest fly', 'chest flye'],
  },
  'cable-crossover': {
    name: 'Cable Crossover',
    searchSynonyms: ['cable fly', 'standing cable fly', 'cable chest fly'],
  },
  'pec-deck': {
    name: 'Pec Deck',
    searchSynonyms: ['machine fly', 'butterfly machine', 'chest fly machine'],
  },
  'machine-chest-press': {
    name: 'Machine Chest Press',
    searchSynonyms: ['chest press machine', 'seated chest press'],
  },
  'push-up': {
    name: 'Push-Up',
    searchSynonyms: ['pushup', 'push up', 'press-up'],
  },
  'dips-chest': {
    name: 'Chest Dips',
    searchSynonyms: ['chest dip', 'forward-leaning dips', 'parallel bar dips'],
  },
  'pull-up': {
    name: 'Pull-Up',
    searchSynonyms: ['pullup', 'pull up', 'overhand pull-up'],
  },
  'chin-up': {
    name: 'Chin-Up',
    searchSynonyms: ['chinup', 'chin up', 'underhand pull-up'],
  },
  'assisted-pull-up': {
    name: 'Assisted Pull-Up',
    searchSynonyms: ['assisted pullup', 'machine-assisted pull-up', 'band pull-up'],
  },
  'lat-pulldown': {
    name: 'Lat Pulldown',
    searchSynonyms: ['lat pull-down', 'cable pulldown', 'wide-grip pulldown'],
  },
  'barbell-row': {
    name: 'Barbell Row',
    searchSynonyms: ['bent-over row', 'bent-over barbell row'],
  },
  'dumbbell-row': {
    name: 'Dumbbell Row',
    searchSynonyms: ['one-arm dumbbell row', 'single-arm row'],
  },
  'cable-row': {
    name: 'Seated Cable Row',
    searchSynonyms: ['cable row', 'seated row', 'low cable row'],
  },
  't-bar-row': {
    name: 'T-Bar Row',
    searchSynonyms: ['t bar row', 'landmine row'],
  },
  'machine-row': {
    name: 'Machine Row',
    searchSynonyms: ['seated machine row', 'row machine'],
  },
  'face-pull': {
    name: 'Face Pull',
    searchSynonyms: ['cable face pull', 'rope face pull', 'rear delt pull'],
  },
  'straight-arm-pulldown': {
    name: 'Straight-Arm Pulldown',
    searchSynonyms: ['straight arm pull-down', 'cable pullover', 'lat prayer'],
  },
  shrug: {
    name: 'Dumbbell Shrug',
    searchSynonyms: ['shrug', 'shoulder shrug', 'trapezius shrug'],
  },
  'back-extension': {
    name: 'Back Extension',
    searchSynonyms: ['hyperextension', '45-degree back extension', 'roman chair'],
  },
  'overhead-press': {
    name: 'Barbell Overhead Press',
    searchSynonyms: ['overhead press', 'shoulder press', 'military press', 'OHP'],
  },
  'dumbbell-shoulder-press': {
    name: 'Dumbbell Shoulder Press',
    searchSynonyms: ['dumbbell overhead press', 'seated dumbbell press'],
  },
  'arnold-press': {
    name: 'Arnold Press',
    searchSynonyms: ['Arnold shoulder press', 'rotating dumbbell press'],
  },
  'lateral-raise': {
    name: 'Lateral Raise',
    searchSynonyms: ['dumbbell lateral raise', 'side raise', 'shoulder side raise'],
  },
  'front-raise': {
    name: 'Front Raise',
    searchSynonyms: ['dumbbell front raise', 'shoulder front raise'],
  },
  'rear-delt-fly': {
    name: 'Rear Delt Fly',
    searchSynonyms: ['reverse fly', 'rear delt raise', 'bent-over reverse fly'],
  },
  'cable-lateral-raise': {
    name: 'Cable Lateral Raise',
    searchSynonyms: ['one-arm cable lateral raise', 'cable side raise'],
  },
  'upright-row': {
    name: 'Upright Row',
    searchSynonyms: ['barbell upright row', 'vertical row'],
  },
  'barbell-curl': {
    name: 'Barbell Curl',
    searchSynonyms: ['standing barbell curl', 'barbell biceps curl'],
  },
  'dumbbell-curl': {
    name: 'Dumbbell Curl',
    searchSynonyms: ['dumbbell biceps curl', 'standing dumbbell curl'],
  },
  'hammer-curl': {
    name: 'Hammer Curl',
    searchSynonyms: ['neutral-grip curl', 'dumbbell hammer curl'],
  },
  'preacher-curl': {
    name: 'Preacher Curl',
    searchSynonyms: ['Scott curl', 'preacher bench curl'],
  },
  'cable-curl': {
    name: 'Cable Curl',
    searchSynonyms: ['cable biceps curl', 'standing cable curl'],
  },
  'concentration-curl': {
    name: 'Concentration Curl',
    searchSynonyms: ['seated concentration curl', 'single-arm concentration curl'],
  },
  'triceps-pushdown': {
    name: 'Triceps Pushdown',
    searchSynonyms: ['tricep pushdown', 'cable pushdown', 'rope pushdown'],
  },
  'overhead-triceps-extension': {
    name: 'Overhead Triceps Extension',
    searchSynonyms: ['overhead tricep extension', 'dumbbell triceps extension'],
  },
  'skull-crusher': {
    name: 'Skull Crusher',
    searchSynonyms: ['lying triceps extension', 'EZ-bar skull crusher'],
  },
  'triceps-dips': {
    name: 'Triceps Dips',
    searchSynonyms: ['tricep dip', 'upright dips', 'parallel bar triceps dips'],
  },
  'bench-dips': {
    name: 'Bench Dips',
    searchSynonyms: ['bench triceps dips', 'chair dips'],
  },
  'close-grip-bench': {
    name: 'Close-Grip Bench Press',
    searchSynonyms: [
      'close grip press',
      'narrow-grip bench press',
      'triceps bench press',
    ],
  },
  'wrist-curl': {
    name: 'Wrist Curl',
    searchSynonyms: ['dumbbell wrist curl', 'forearm curl'],
  },
  'reverse-curl': {
    name: 'Reverse Curl',
    searchSynonyms: ['overhand curl', 'reverse biceps curl', 'pronated curl'],
  },
  'farmers-walk': {
    name: "Farmer's Walk",
    searchSynonyms: ["farmer's carry", 'farmers walk', 'loaded carry'],
  },
  plank: {
    name: 'Plank',
    searchSynonyms: ['forearm plank', 'front plank', 'elbow plank'],
  },
  'side-plank': {
    name: 'Side Plank',
    searchSynonyms: ['lateral plank', 'side bridge'],
  },
  crunch: {
    name: 'Crunch',
    searchSynonyms: ['abdominal crunch', 'ab crunch', 'floor crunch'],
  },
  'hanging-leg-raise': {
    name: 'Hanging Leg Raise',
    searchSynonyms: ['hanging knee raise', 'hanging leg lift'],
  },
  'lying-leg-raise': {
    name: 'Lying Leg Raise',
    searchSynonyms: ['floor leg raise', 'lying leg lift'],
  },
  'dead-bug': {
    name: 'Dead Bug',
    searchSynonyms: ['dead bug exercise', 'contralateral dead bug'],
  },
  'russian-twist': {
    name: 'Russian Twist',
    searchSynonyms: ['seated torso twist', 'Russian rotation'],
  },
  'cable-crunch': {
    name: 'Cable Crunch',
    searchSynonyms: ['kneeling cable crunch', 'weighted cable crunch'],
  },
  'ab-wheel': {
    name: 'Ab Wheel Rollout',
    searchSynonyms: ['ab rollout', 'ab wheel', 'kneeling rollout'],
  },
  'hollow-hold': {
    name: 'Hollow Hold',
    searchSynonyms: ['hollow body hold', 'hollow position'],
  },
  'back-squat': {
    name: 'Back Squat',
    searchSynonyms: ['barbell back squat', 'squat'],
  },
  'front-squat': {
    name: 'Front Squat',
    searchSynonyms: ['barbell front squat', 'front rack squat'],
  },
  'leg-press': {
    name: 'Leg Press',
    searchSynonyms: ['machine leg press', 'sled leg press'],
  },
  'hack-squat': {
    name: 'Hack Squat',
    searchSynonyms: ['machine hack squat', 'Hackenschmidt squat'],
  },
  'leg-extension': {
    name: 'Leg Extension',
    searchSynonyms: ['machine leg extension', 'knee extension'],
  },
  'bulgarian-split-squat': {
    name: 'Bulgarian Split Squat',
    searchSynonyms: ['rear-foot-elevated split squat', 'RFESS'],
  },
  lunge: {
    name: 'Dumbbell Lunge',
    searchSynonyms: ['walking lunge', 'forward lunge', 'dumbbell lunges'],
  },
  'goblet-squat': {
    name: 'Goblet Squat',
    searchSynonyms: ['dumbbell goblet squat', 'kettlebell goblet squat'],
  },
  'step-up': {
    name: 'Step-Up',
    searchSynonyms: ['step up', 'box step-up', 'dumbbell step-up'],
  },
  deadlift: {
    name: 'Deadlift',
    searchSynonyms: ['conventional deadlift', 'barbell deadlift'],
  },
  'romanian-deadlift': {
    name: 'Romanian Deadlift',
    searchSynonyms: ['RDL', 'stiff-leg deadlift', 'Romanian barbell deadlift'],
  },
  'hip-thrust': {
    name: 'Hip Thrust',
    searchSynonyms: ['barbell hip thrust', 'hip drive'],
  },
  'glute-bridge': {
    name: 'Glute Bridge',
    searchSynonyms: ['floor glute bridge', 'hip bridge'],
  },
  'leg-curl': {
    name: 'Machine Leg Curl',
    searchSynonyms: ['hamstring curl', 'lying leg curl', 'seated leg curl'],
  },
  'good-morning': {
    name: 'Good Morning',
    searchSynonyms: ['barbell good morning', 'hip hinge good morning'],
  },
  'cable-pull-through': {
    name: 'Cable Pull-Through',
    searchSynonyms: ['cable pull through', 'rope pull-through'],
  },
  'hip-abduction': {
    name: 'Machine Hip Abduction',
    searchSynonyms: ['hip abductor machine', 'seated hip abduction'],
  },
  'hip-adduction': {
    name: 'Machine Hip Adduction',
    searchSynonyms: ['hip adductor machine', 'seated hip adduction'],
  },
  'standing-calf-raise': {
    name: 'Standing Calf Raise',
    searchSynonyms: ['calf raise machine', 'standing heel raise'],
  },
  'seated-calf-raise': {
    name: 'Seated Calf Raise',
    searchSynonyms: ['seated heel raise', 'soleus calf raise'],
  },
  'tibia-raise': {
    name: 'Tibialis Raise',
    searchSynonyms: ['tibialis anterior raise', 'toe raise', 'shin raise'],
  },
  'kettlebell-swing': {
    name: 'Kettlebell Swing',
    searchSynonyms: ['KB swing', 'Russian kettlebell swing'],
  },
  'clean-and-press': {
    name: 'Clean and Press',
    searchSynonyms: ['barbell clean and press', 'clean & press'],
  },
  thruster: {
    name: 'Thruster',
    searchSynonyms: ['barbell thruster', 'squat to press', 'front squat press'],
  },
  burpee: {
    name: 'Burpee',
    searchSynonyms: ['burpees', 'squat thrust'],
  },
  'mountain-climber': {
    name: 'Mountain Climber',
    searchSynonyms: ['mountain climbers', 'running plank'],
  },
  'trx-row': {
    name: 'TRX Row',
    searchSynonyms: ['suspension row', 'TRX inverted row'],
  },
  'trx-push-up': {
    name: 'TRX Push-Up',
    searchSynonyms: ['suspension push-up', 'TRX press-up'],
  },
  'band-pull-apart': {
    name: 'Band Pull-Apart',
    searchSynonyms: ['resistance band pull-apart', 'banded pull-apart'],
  },
  'inverted-row': {
    name: 'Inverted Row',
    searchSynonyms: ['body row', 'Australian pull-up', 'horizontal pull-up'],
  },
  'dead-hang': {
    name: 'Dead Hang',
    searchSynonyms: ['bar hang', 'passive hang', 'hanging grip'],
  },
  'hip-flexor-stretch': {
    name: 'Hip Flexor Stretch',
    searchSynonyms: ['kneeling hip flexor stretch', 'lunge stretch'],
  },
  'cat-cow': {
    name: 'Cat-Cow',
    searchSynonyms: ['cat cow stretch', 'cat camel', 'spinal flexion extension'],
  },
  'bird-dog': {
    name: 'Bird Dog',
    searchSynonyms: ['quadruped bird dog', 'opposite arm leg raise'],
  },
  'neck-flexion': {
    name: 'Neck Flexion',
    searchSynonyms: ['neck strengthening', 'neck curl', 'cervical flexion'],
  },
  'cardio-running': {
    name: 'Outdoor Running',
    searchSynonyms: ['run', 'running', 'jog', 'jogging', 'outdoor run'],
  },
  'cardio-treadmill': {
    name: 'Treadmill Running',
    searchSynonyms: ['treadmill', 'indoor running', 'treadmill run'],
  },
  'cardio-walking': {
    name: 'Walking',
    searchSynonyms: ['walk', 'brisk walking', 'outdoor walk'],
  },
  'cardio-cycling-outdoor': {
    name: 'Outdoor Cycling',
    searchSynonyms: ['cycling', 'bike ride', 'biking', 'outdoor bike'],
  },
  'cardio-ergometer': {
    name: 'Stationary Bike',
    searchSynonyms: ['exercise bike', 'indoor cycling', 'ergometer', 'spinning'],
  },
  'cardio-rowing': {
    name: 'Rowing Machine',
    searchSynonyms: ['indoor rowing', 'rower', 'rowing ergometer', 'Concept2'],
  },
  'cardio-elliptical': {
    name: 'Elliptical Trainer',
    searchSynonyms: ['elliptical', 'cross trainer', 'elliptical machine'],
  },
  'cardio-stair-climber': {
    name: 'Stair Climber',
    searchSynonyms: ['StairMaster', 'step machine', 'stair stepper'],
  },
  'cardio-swimming': {
    name: 'Swimming',
    searchSynonyms: ['swim', 'lap swimming', 'pool swimming'],
  },
  'cardio-jump-rope': {
    name: 'Jump Rope',
    searchSynonyms: ['rope skipping', 'skipping rope', 'jumping rope'],
  },
} as const satisfies Record<SystemExerciseCatalogKey, LocalizedSystemExercise>;
