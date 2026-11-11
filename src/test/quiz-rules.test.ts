import { describe,it,expect } from 'vitest';
import { QUESTIONS_PER_SUBSCRIPTION,QUESTION_TIME_LIMIT_SECONDS,rewardForAnswer,rankPlayers,eligibleSubscription,quizSessionStatus } from '@/lib/quiz/rules';
import { makeQuestions } from '@/lib/quiz/questions.server';
describe('Quiz monetary rules',()=>{
 it('unlocks exactly 20 questions per subscription',()=>expect(QUESTIONS_PER_SUBSCRIPTION).toBe(20));
 it('awards 10 XOF for a correct answer',()=>expect(rewardForAnswer(true)).toBe(10));
 it('awards no money for a wrong answer',()=>expect(rewardForAnswer(false)).toBe(0));
 it('only paid subscriptions unlock play',()=>{expect(eligibleSubscription({kind:'forfait',status:'success'})).toBe(true);expect(eligibleSubscription({kind:'forfait',status:'pending'})).toBe(false);expect(eligibleSubscription({kind:'recharge',status:'success'})).toBe(false);});
 it('allows exactly 15 seconds per question',()=>expect(QUESTION_TIME_LIMIT_SECONDS).toBe(15));
 it('ends the game when the question deadline has passed',()=>expect(quizSessionStatus({answered:3,deadline:'2026-01-01T00:00:00.000Z',finishReason:null},new Date('2026-01-01T00:00:15.000Z').getTime())).toBe('timeout'));
 it('keeps a completed game completed',()=>expect(quizSessionStatus({answered:20,deadline:null,finishReason:'completed'})).toBe('completed'));
 it('pauses between questions until the next question starts',()=>expect(quizSessionStatus({answered:1,deadline:null,finishReason:null})).toBe('paused'));
 it('ranks subscriptions before score',()=>expect(rankPlayers([{id:'a',subscriptions:2,score:40},{id:'b',subscriptions:3,score:1}])[0]?.id).toBe('b'));
 it('breaks subscription ties by score',()=>expect(rankPlayers([{id:'a',subscriptions:2,score:1},{id:'b',subscriptions:2,score:20}])[0]?.id).toBe('b'));
 it('builds 20 unique questions with 10 Ivorian and 10 world history questions',()=>{const questions=makeQuestions();expect(questions).toHaveLength(20);expect(new Set(questions.map(q=>q.prompt)).size).toBe(20);expect(questions.filter(q=>q.category==='Côte d’Ivoire')).toHaveLength(10);expect(questions.filter(q=>q.category==='Monde')).toHaveLength(10);});
});
