import { describe, expect, it } from 'vitest';
import { gradeLocally } from './grading';
import type { Question } from '../types';

const q = (id: string, kind: Question['kind'], points = 1): Question => ({
  id,
  quiz_id: 'quiz',
  kind,
  prompt: id,
  options: [],
  points,
  position: 0,
});

describe('gradeLocally', () => {
  const questions = [q('a', 'single'), q('b', 'multiple', 2), q('c', 'short'), q('d', 'true_false')];
  const keys = [
    { question_id: 'a', answer: ['x'], explanation: 'because' },
    { question_id: 'b', answer: ['1', '3'], explanation: null },
    { question_id: 'c', answer: ['Hyper Text Markup Language', 'HTML'], explanation: null },
    { question_id: 'd', answer: ['true'], explanation: null },
  ];

  it('scores a perfect attempt, ignoring order and case/whitespace in short answers', () => {
    const r = gradeLocally(questions, keys, { a: ['x'], b: ['3', '1'], c: ['  hyper text   markup language '], d: ['true'] });
    expect(r.percent).toBe(100);
    expect(r.score).toBe(5);
    expect(r.results.every((x) => x.correct)).toBe(true);
  });

  it('requires the exact set for multiple choice and weights by points', () => {
    const r = gradeLocally(questions, keys, { a: ['y'], b: ['1'], c: ['html'], d: ['false'] });
    expect(r.score).toBe(1);
    expect(r.max_score).toBe(5);
    expect(r.percent).toBe(20);
    expect(r.results.find((x) => x.question_id === 'a')?.explanation).toBe('because');
  });

  it('treats unanswered questions as wrong', () => {
    expect(gradeLocally(questions, keys, {}).percent).toBe(0);
  });
});
