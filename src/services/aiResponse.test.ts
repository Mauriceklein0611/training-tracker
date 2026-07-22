import { describe, expect, it } from 'vitest';
import {
  parseAiResponse,
  validateAiResponse,
  type AiResponse,
  type PlanContext,
} from '@/services/aiResponse';

function baseContext(overrides: Partial<PlanContext> = {}): PlanContext {
  return {
    templates: new Map([
      [
        't1',
        {
          name: 'Push',
          description: 'Oberkörper',
          exercises: new Map([
            ['te1', { name: 'Bankdrücken', targetSets: 3, targetRepMin: 8, targetRepMax: 12, restSeconds: 120 }],
          ]),
        },
      ],
    ]),
    currentFingerprint: 'fp',
    exports: new Map([['exp-1', 'fp']]),
    seenImportFingerprints: new Set(),
    ...overrides,
  };
}

function responseText(proposals: unknown[], sourceExport: unknown = { exportId: 'exp-1', fingerprint: 'fp' }) {
  return JSON.stringify({
    format: 'training-ai-response',
    schemaVersion: 1,
    sourceExport,
    feedback: { summary: 'ok', recommendations: ['mehr Volumen'] },
    proposals,
  });
}

const targetProposal = {
  proposalId: 'p1',
  operation: 'update_template_exercise_target',
  target: { templateId: 't1', templateExerciseId: 'te1' },
  expected: { sets: 3 },
  changes: { sets: 4 },
  reason: 'Progression',
};

describe('parseAiResponse', () => {
  it('rejects non-JSON', () => {
    expect(parseAiResponse('not json').ok).toBe(false);
  });

  it('rejects a wrong format marker', () => {
    const result = parseAiResponse(JSON.stringify({ format: 'something-else', schemaVersion: 1, feedback: {} }));
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown operation', () => {
    const result = parseAiResponse(
      responseText([{ ...targetProposal, operation: 'delete_everything' }]),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects out-of-range values', () => {
    const result = parseAiResponse(responseText([{ ...targetProposal, changes: { sets: 999 } }]));
    expect(result.ok).toBe(false);
  });

  it('rejects a proposal with no actual change', () => {
    const result = parseAiResponse(responseText([{ ...targetProposal, changes: {} }]));
    expect(result.ok).toBe(false);
  });

  it('accepts a well-formed response', () => {
    const result = parseAiResponse(responseText([targetProposal]));
    expect(result.ok).toBe(true);
  });
});

describe('validateAiResponse — proposal status', () => {
  function validateFirst(proposals: unknown[], context = baseContext()) {
    const parsed = parseAiResponse(responseText(proposals));
    if (!parsed.ok) throw new Error(parsed.errors.join(', '));
    return validateAiResponse(parsed.data, context);
  }

  it('marks a matching proposal as pending', () => {
    const result = validateFirst([targetProposal]);
    expect(result.proposals[0].status).toBe('pending');
    expect(result.proposals[0].exerciseName).toBe('Bankdrücken');
  });

  it('marks an unknown plan as invalid', () => {
    const result = validateFirst([
      { ...targetProposal, target: { templateId: 'nope', templateExerciseId: 'te1' } },
    ]);
    expect(result.proposals[0].status).toBe('invalid');
  });

  it('marks an unknown exercise as invalid', () => {
    const result = validateFirst([
      { ...targetProposal, target: { templateId: 't1', templateExerciseId: 'nope' } },
    ]);
    expect(result.proposals[0].status).toBe('invalid');
  });

  it('marks a stale proposal as a conflict', () => {
    // expected sets 5 but current is 3.
    const result = validateFirst([{ ...targetProposal, expected: { sets: 5 } }]);
    expect(result.proposals[0].status).toBe('conflict');
    expect(result.proposals[0].issue).toContain('geändert');
  });

  it('rejects a rep range where min would exceed max', () => {
    const result = validateFirst([
      { ...targetProposal, expected: {}, changes: { repMin: 15, repMax: 10 } },
    ]);
    expect(result.proposals[0].status).toBe('invalid');
  });
});

describe('validateAiResponse — file-level checks', () => {
  it('flags a duplicate import', () => {
    const parsed = parseAiResponse(responseText([targetProposal]));
    if (!parsed.ok) throw new Error('parse');
    const first = validateAiResponse(parsed.data, baseContext());
    const context = baseContext({ seenImportFingerprints: new Set([first.importFingerprint]) });
    const second = validateAiResponse(parsed.data, context);
    expect(second.duplicate).toBe(true);
  });

  it('warns about an unknown export', () => {
    const result = validateAiResponse(
      (parseAiResponse(responseText([targetProposal], { exportId: 'other', fingerprint: 'x' })) as { data: AiResponse }).data,
      baseContext(),
    );
    expect(result.exportKnown).toBe(false);
    expect(result.warnings.some((w) => w.includes('unbekannten Export'))).toBe(true);
  });

  it('warns when the plan changed since the export', () => {
    const context = baseContext({ currentFingerprint: 'different' });
    const result = validateAiResponse(
      (parseAiResponse(responseText([targetProposal])) as { data: AiResponse }).data,
      context,
    );
    expect(result.planChangedSinceExport).toBe(true);
  });

  it('only exposes feedback as plain data', () => {
    const result = validateAiResponse(
      (parseAiResponse(responseText([])) as { data: AiResponse }).data,
      baseContext(),
    );
    expect(result.feedback.summary).toBe('ok');
    expect(result.feedback.recommendations).toEqual(['mehr Volumen']);
  });
});
