import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { rankPlayers } from './quiz/rules';
export type QuizQuestion = {category:string; prompt:string; options:string[]};
export type QuizSession = {id:string;transaction_id:string; answered:number;earned:number; question:QuizQuestion|null};
function safeSession(s: {id:string;transaction_id:string;questions:unknown;answers:unknown;earned:number}): QuizSession {
 const questions=s.questions as QuizQuestion[]; const answers=s.answers as unknown[];
 const q=questions[answers.length];
 return {id:s.id,transaction_id:s.transaction_id,answered:answers.length,earned:s.earned,question:q?{category:q.category,prompt:q.prompt,options:q.options}:null};
}
export const getQuiz = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 // Privileged reads are needed for private answer keys; only safe projections leave this handler.
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const [ss,ts,ws,ps] = await Promise.all([
 db.from('quiz_sessions').select('*').eq('user_id',context.userId).order('created_at'),
 context.supabase.from('transactions').select('id,label,created_at').eq('kind','forfait').eq('status','success').order('created_at'),
 context.supabase.from('quiz_withdrawals').select('*').eq('user_id',context.userId).order('created_at',{ascending:false}),
 context.supabase.from('quiz_prizes').select('*').eq('active',true).order('ends_at')]);
 for(const r of [ss,ts,ws,ps]) if(r.error) throw new Error(r.error.message);
 const sessions=(ss.data??[]).map(safeSession); const earned=sessions.reduce((a,s)=>a+s.earned,0);
 return {sessions,subscriptions:ts.data??[],withdrawals:ws.data??[],prizes:ps.data??[],earned,balance:earned-(ws.data??[]).filter(w=>['pending','paid'].includes(w.status)).reduce((a,w)=>a+w.amount,0)};
});
export const startQuiz=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({transactionId:z.string().uuid()})).handler(async({data,context})=>{
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server'); const {makeQuestions}=await import('./quiz/questions.server');
 const r=await db.rpc('quiz_start',{p_user:context.userId,p_transaction:data.transactionId,p_questions:makeQuestions()}); if(r.error)throw new Error(r.error.message); return r.data;
});
export const answerQuiz=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({sessionId:z.string().uuid(),index:z.number().int().min(0).max(19),choice:z.number().int().min(0).max(3)})).handler(async({data,context})=>{
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const r=await db.rpc('quiz_answer',{p_user:context.userId,p_session:data.sessionId,p_index:data.index,p_choice:data.choice});if(r.error)throw new Error(r.error.message);
 return r.data as {correct:boolean;correctChoice:number;explanation:string;reward:number};
});
export const withdrawQuiz=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({phone:z.string().regex(/^\+225\d{10}$/),operator:z.enum(['orange','mtn','moov','wave'])})).handler(async({data,context})=>{
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server'); const r=await db.rpc('quiz_withdraw',{p_user:context.userId,p_phone:data.phone,p_operator:data.operator}); if(r.error)throw new Error(r.error.message);return r.data;
});
export const quizRanking=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(z.object({prizeId:z.string().uuid().optional()})).handler(async({data,context})=>{
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 let tx=db.from('transactions').select('user_id').eq('kind','forfait').eq('status','success'); let sq=db.from('quiz_sessions').select('user_id,earned');
 if(data.prizeId){const p=await context.supabase.from('quiz_prizes').select('*').eq('id',data.prizeId).single();if(p.error)throw new Error('Concours introuvable');tx=tx.gte('created_at',p.data.starts_at).lte('created_at',p.data.ends_at);sq=sq.gte('created_at',p.data.starts_at).lte('created_at',p.data.ends_at);}
 const [t,s]=await Promise.all([tx,sq]);if(t.error||s.error)throw new Error('Classement indisponible');
 const counts=new Map<string,{id:string;subscriptions:number;score:number}>();for(const row of t.data??[]){const p=counts.get(row.user_id)??{id:row.user_id,subscriptions:0,score:0};p.subscriptions++;counts.set(row.user_id,p);}for(const row of s.data??[]){const p=counts.get(row.user_id);if(p)p.score+=row.earned/10;}
 return rankPlayers([...counts.values()]).map((p,i)=>({rank:i+1,subscriptions:p.subscriptions,score:p.score,me:p.id===context.userId,label:p.id===context.userId?'Toi':`Joueur ${i+1}`}));
});
export const getQuizAdmin=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error||!role.data)throw new Error('Accès réservé aux gérants');
 const [w,p]=await Promise.all([context.supabase.from('quiz_withdrawals').select('*').order('created_at',{ascending:false}),context.supabase.from('quiz_prizes').select('*').order('created_at',{ascending:false})]);if(w.error||p.error)throw new Error('Chargement impossible');return {withdrawals:w.data??[],prizes:p.data??[]};
});
export const manageQuiz=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.discriminatedUnion('action',[
 z.object({action:z.literal('withdrawal'),id:z.string().uuid(),status:z.enum(['paid','rejected']),reference:z.string().trim().min(1)}),
 z.object({action:z.literal('prize'),title:z.string().trim().min(1),description:z.string(),starts:z.string().datetime(),ends:z.string().datetime()}),
 z.object({action:z.literal('award'),id:z.string().uuid()})
])).handler(async({data,context})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error||!role.data)throw new Error('Accès réservé aux gérants');
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 if(data.action==='withdrawal'){const r=await db.from('quiz_withdrawals').update({status:data.status,payment_reference:data.reference}).eq('id',data.id).eq('status','pending').select('id').single();if(r.error)throw new Error('Demande déjà traitée ou introuvable');}
 if(data.action==='prize'){if(new Date(data.ends)<=new Date(data.starts))throw new Error('La fin doit suivre le début');const r=await db.from('quiz_prizes').insert({title:data.title,description:data.description,starts_at:data.starts,ends_at:data.ends,active:true});if(r.error)throw new Error(r.error.message);}
 if(data.action==='award'){const r=await db.rpc('quiz_award',{p_prize:data.id});if(r.error)throw new Error(r.error.message);}
 return {ok:true};
});
