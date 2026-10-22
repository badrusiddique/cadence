import type { HabitFinding, PracticeScore } from '../domain/types';

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explain: string;
  group: string;
}

export interface PracticePack {
  focusGroup: string;
  focusLabel: string;
  score: number;
  quiz: QuizQuestion[];
  drills: string[];
}

/** Build practice drills from weakest practice groups — local, no LM required. */
export function buildPracticePack(practice: PracticeScore[], habits: HabitFinding[]): PracticePack {
  const ranked = [...practice].sort((a, b) => a.score - b.score);
  const focus = ranked[0] || practice[0];
  const triggered = habits.filter((h) => h.triggered && (!focus || h.group === focus.group));
  const pool = triggered.length ? triggered : habits.filter((h) => h.group === focus?.group).slice(0, 5);

  const quiz: QuizQuestion[] = pool.slice(0, 5).map((h, i) => {
    const good = h.improvement;
    const distractors = [
      'Ignore it and keep prompting the same way.',
      'Switch models randomly until it feels better.',
      'Paste the entire repository into every prompt.',
    ];
    const choices = [good, ...distractors].slice(0, 4);
    // rotate answer position
    const answerIndex = i % choices.length;
    const rotated = [...choices];
    const [correct] = rotated.splice(0, 1);
    rotated.splice(answerIndex, 0, correct);
    return {
      id: h.id,
      prompt: `Your Cadence finding: “${h.name}”. What’s the better next move?`,
      choices: rotated,
      answerIndex,
      explain: h.message,
      group: h.group,
    };
  });

  const drills = pool.slice(0, 4).map((h) => `Drill: ${h.improvement}`);
  if (drills.length === 0) {
    drills.push('Keep a short acceptance checklist on every non-trivial ask.');
    drills.push('Prefer ask/plan mode for questions; reserve agent mode for edits.');
  }

  return {
    focusGroup: focus?.group || 'prompt-quality',
    focusLabel: focus?.label || 'Prompt Craft',
    score: focus?.score ?? 0,
    quiz,
    drills,
  };
}
