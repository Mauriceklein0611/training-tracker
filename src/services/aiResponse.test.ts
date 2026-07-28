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
            [
              'te1',
              {
                name: 'Bankdrücken',
                targetSets: 3,
                targetRepMin: 8,
                targetRepMax: 12,
                restSeconds: 120,
              },
            ],
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

function responseText(
  proposals: unknown[],
  sourceExport: unknown = { exportId: 'exp-1', fingerprint: 'fp' },
) {
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
    const result = parseAiResponse(
      JSON.stringify({ format: 'something-else', schemaVersion: 1, feedback: {} }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown operation', () => {
    const result = parseAiResponse(
      responseText([{ ...targetProposal, operation: 'delete_everything' }]),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects out-of-range values', () => {
    const result = parseAiResponse(
      responseText([{ ...targetProposal, changes: { sets: 999 } }]),
    );
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
    // expected must cover the changed fields; current te1 is 8–12.
    const result = validateFirst([
      {
        ...targetProposal,
        expected: { repMin: 8, repMax: 12 },
        changes: { repMin: 15, repMax: 10 },
      },
    ]);
    expect(result.proposals[0].status).toBe('invalid');
  });
});

describe('validateAiResponse — file-level checks', () => {
  it('flags a duplicate import', () => {
    const parsed = parseAiResponse(responseText([targetProposal]));
    if (!parsed.ok) throw new Error('parse');
    const first = validateAiResponse(parsed.data, baseContext());
    const context = baseContext({
      seenImportFingerprints: new Set([first.importFingerprint]),
    });
    const second = validateAiResponse(parsed.data, context);
    expect(second.duplicate).toBe(true);
  });

  it('locks the proposals and shows feedback for an unknown export', () => {
    const result = validateAiResponse(
      (
        parseAiResponse(
          responseText([targetProposal], { exportId: 'other', fingerprint: 'x' }),
        ) as { data: AiResponse }
      ).data,
      baseContext(),
    );
    expect(result.exportKnown).toBe(false);
    expect(result.provenance).toBe('unknown');
    // Proposals are not applicable, but feedback is still available.
    expect(result.proposalsApplicable).toBe(false);
    expect(result.proposals[0].status).toBe('invalid');
    expect(result.feedback.summary).toBe('ok');
  });

  it('locks the proposals when the fingerprint does not match the stored export', () => {
    const result = validateAiResponse(
      (
        parseAiResponse(
          responseText([targetProposal], { exportId: 'exp-1', fingerprint: 'wrong' }),
        ) as { data: AiResponse }
      ).data,
      baseContext(),
    );
    expect(result.provenance).toBe('fingerprint-mismatch');
    expect(result.proposalsApplicable).toBe(false);
    expect(result.proposals[0].status).toBe('invalid');
  });

  it('locks the proposals when there is no export reference at all', () => {
    const noReference = JSON.stringify({
      format: 'training-ai-response',
      schemaVersion: 1,
      feedback: { summary: 'ok' },
      proposals: [targetProposal],
    });
    const result = validateAiResponse(
      (parseAiResponse(noReference) as { data: AiResponse }).data,
      baseContext(),
    );
    expect(result.provenance).toBe('missing');
    expect(result.proposalsApplicable).toBe(false);
  });

  it('rejects a response whose schemaVersion is newer than supported', () => {
    const bad = JSON.stringify({
      format: 'training-ai-response',
      schemaVersion: 3,
      feedback: { summary: 'x' },
      proposals: [],
    });
    expect(parseAiResponse(bad).ok).toBe(false);
  });

  it('accepts both the legacy v1 and the current v2 response', () => {
    for (const schemaVersion of [1, 2]) {
      const file = JSON.stringify({
        format: 'training-ai-response',
        schemaVersion,
        feedback: { summary: 'ok' },
        proposals: [],
      });
      expect(parseAiResponse(file).ok).toBe(true);
    }
  });

  it('accepts a v2 cardio/duration target change', () => {
    const file = JSON.stringify({
      format: 'training-ai-response',
      schemaVersion: 2,
      feedback: { summary: 'ok' },
      proposals: [
        {
          proposalId: 'p1',
          operation: 'update_template_exercise_target',
          target: { templateId: 't1', templateExerciseId: 'te1' },
          expected: { durationSeconds: 600, distanceMeters: 2000, rpe: 7 },
          changes: { durationSeconds: 900, distanceMeters: 3000, rpe: 8 },
          reason: 'Cardio-Umfang erhöhen',
        },
      ],
    });
    const parsed = parseAiResponse(file);
    expect(parsed.ok).toBe(true);
  });

  it('rejects unknown top-level fields instead of dropping them', () => {
    const bad = JSON.stringify({
      format: 'training-ai-response',
      schemaVersion: 1,
      feedback: { summary: 'x' },
      proposals: [],
      somethingExtra: true,
    });
    expect(parseAiResponse(bad).ok).toBe(false);
  });

  it('rejects duplicate proposal ids', () => {
    const result = parseAiResponse(responseText([targetProposal, { ...targetProposal }]));
    expect(result.ok).toBe(false);
  });

  it('rejects a change whose previous value is missing from expected', () => {
    const result = parseAiResponse(
      responseText([{ ...targetProposal, expected: {}, changes: { sets: 4 } }]),
    );
    expect(result.ok).toBe(false);
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
