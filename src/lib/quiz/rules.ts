export const QUESTIONS_PER_SUBSCRIPTION = 20;
export const REWARD_PER_CORRECT_ANSWER = 10;
export const QUESTION_TIME_LIMIT_SECONDS = 15;

export type QuizSessionStatus = 'playing' | 'paused' | 'timeout' | 'completed';

export function rewardForAnswer(correct: boolean) { return correct ? REWARD_PER_CORRECT_ANSWER : 0; }
export function eligibleSubscription(t: { kind: string; status: string }) { return t.kind === 'forfait' && t.status === 'success'; }
export function rankPlayers<T extends { subscriptions: number; score: number; id: string }>(players: T[]) {
  return [...players].sort((a,b) => b.subscriptions-a.subscriptions || b.score-a.score || a.id.localeCompare(b.id));
}
export function quizSessionStatus(
  session: { answered: number; deadline: string | null; finishReason: string | null },
  now = Date.now(),
): QuizSessionStatus {
  if (session.finishReason === 'timeout') return 'timeout';
  if (session.finishReason === 'completed' || session.answered >= QUESTIONS_PER_SUBSCRIPTION) return 'completed';
  if (!session.deadline) return 'paused';
  return new Date(session.deadline).getTime() <= now ? 'timeout' : 'playing';
}
