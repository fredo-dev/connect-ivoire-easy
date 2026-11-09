import { describe,it,expect } from 'vitest';
import { QUESTIONS_PER_SUBSCRIPTION,rewardForAnswer,rankPlayers,eligibleSubscription } from '@/lib/quiz/rules';
describe('Quiz monetary rules',()=>{
 it('unlocks exactly 20 questions per subscription',()=>expect(QUESTIONS_PER_SUBSCRIPTION).toBe(20));
 it('awards 10 XOF for a correct answer',()=>expect(rewardForAnswer(true)).toBe(10));
 it('awards no money for a wrong answer',()=>expect(rewardForAnswer(false)).toBe(0));
 it('only paid subscriptions unlock play',()=>{expect(eligibleSubscription({kind:'forfait',status:'success'})).toBe(true);expect(eligibleSubscription({kind:'forfait',status:'pending'})).toBe(false);expect(eligibleSubscription({kind:'recharge',status:'success'})).toBe(false);});
 it('ranks subscriptions before score',()=>expect(rankPlayers([{id:'a',subscriptions:2,score:40},{id:'b',subscriptions:3,score:1}])[0]?.id).toBe('b'));
 it('breaks subscription ties by score',()=>expect(rankPlayers([{id:'a',subscriptions:2,score:1},{id:'b',subscriptions:2,score:20}])[0]?.id).toBe('b'));
});
