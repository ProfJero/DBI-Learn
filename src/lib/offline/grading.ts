import type { Question, QuestionKey, QuestionResult } from '../types';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Mirrors public.submit_quiz grading so practice quizzes can be scored instantly, even offline. */
export function gradeLocally(questions: Question[], keys: QuestionKey[], answers: Record<string, string[]>) {
  const keyMap = new Map(keys.map((k) => [k.question_id, k]));
  let total = 0;
  let earned = 0;
  const results: QuestionResult[] = questions.map((q) => {
    const key = keyMap.get(q.id);
    const given = answers[q.id] ?? [];
    const expected = key?.answer ?? [];
    let correct: boolean;
    if (q.kind === 'short') {
      correct = expected.some((k) => norm(k) === norm(given[0] ?? ''));
    } else {
      const a = [...given].sort();
      const b = [...expected].sort();
      correct = b.length > 0 && a.length === b.length && a.every((v, i) => v === b[i]);
    }
    total += q.points;
    if (correct) earned += q.points;
    return {
      question_id: q.id,
      correct,
      points: q.points,
      earned: correct ? q.points : 0,
      given,
      answer: expected,
      explanation: key?.explanation ?? null,
    };
  });
  const percent = total === 0 ? 0 : Math.floor((100 * earned) / total);
  return { results, score: earned, max_score: total, percent };
}
