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
