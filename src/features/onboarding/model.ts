export interface OnboardingResource {
  dialogTitle: string;
  progress: string;
  previous: string;
  next: string;
  finish: string;
  skip: string;
  openImport: string;
  openPlans: string;
  openGuide: string;
  openLegacy: string;
  continueWithoutLegacy: string;
  migrationDeadline: string;
  /** Labels of the optional body-data step (#44). */
  profile: {
    heightLabel: string;
    weightLabel: string;
    hint: string;
    invalidHeight: string;
    invalidWeight: string;
  };
  steps: Array<{
    id: string;
    title: string;
    text: string;
  }>;
  migration: {
    title: string;
    text: string;
    backup: string;
    newApp: string;
  };
}
