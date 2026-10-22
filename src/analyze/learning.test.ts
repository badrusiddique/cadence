import { describe, expect, it } from 'vitest';
import { buildPracticePack } from './learning';
import type { HabitFinding, PracticeScore } from '../domain/types';

describe('practice pack', () => {
  it('builds quiz from triggered habits', () => {
    const practice: PracticeScore[] = [
      { group: 'prompt-quality', label: 'Prompt Craft', score: 40, previousScore: null, findings: [] },
      { group: 'session-hygiene', label: 'Session Hygiene', score: 80, previousScore: null, findings: [] },
    ];
    const habits: HabitFinding[] = [
      {
        id: 'thin-prompts',
        name: 'Thin Prompts',
        group: 'prompt-quality',
        severity: 'medium',
        triggered: true,
        count: 3,
        total: 10,
        pct: 30,
        message: 'too short',
        improvement: 'Add intent and constraints.',
        examples: [],
      },
    ];
    const pack = buildPracticePack(practice, habits);
    expect(pack.focusGroup).toBe('prompt-quality');
    expect(pack.quiz.length).toBeGreaterThan(0);
    expect(pack.quiz[0].choices.length).toBe(4);
  });
});
