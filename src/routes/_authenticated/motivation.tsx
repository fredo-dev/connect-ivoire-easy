import {createFileRoute,Link} from '@tanstack/react-router';
import {ArrowLeft,Play} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {pageMeta} from '@/lib/page-meta';
export const Route=createFileRoute('/_authenticated/motivation')({head:()=>pageMeta('Motivation — Cabine Online','Les vidéos de motivation des joueurs Cabine Online.'),component:Motivation});
function Motivation(){return <div className="space-y-6"><Button variant="ghost" asChild><Link to="/quiz"><ArrowLeft className="mr-2 size-4"/>Quiz & récompenses</Link></Button><h1 className="text-2xl font-bold">Une dose de motivation</h1><div className="flex items-center gap-2 border-y py-6 text-muted-foreground"><Play className="size-5"/><p>Les vidéos sont en préparation.</p></div></div>;}
