export const QUESTIONS_PER_SUBSCRIPTION = 20;
export const REWARD_PER_CORRECT_ANSWER = 10;
export function rewardForAnswer(correct: boolean) { return correct ? REWARD_PER_CORRECT_ANSWER : 0; }
export function eligibleSubscription(t: { kind: string; status: string }) { return t.kind === 'forfait' && t.status === 'success'; }
export function rankPlayers<T extends { subscriptions: number; score: number; id: string }>(players: T[]) {
  return [...players].sort((a,b) => b.subscriptions-a.subscriptions || b.score-a.score || a.id.localeCompare(b.id));
}
