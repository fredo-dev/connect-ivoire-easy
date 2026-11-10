import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pageMeta } from '@/lib/page-meta';

const videos = [
  {
    title: 'Chaque petit pas',
    description: 'Avance à ton rythme, ose essayer et recommence. Aujourd’hui, c’est ton jour.',
    src: '/videos/chaque-petit-pas.mp4',
    poster: '/images/motivation-chaque-petit-pas.jpg',
  },
  {
    title: 'Reste connecté à tes objectifs',
    description: 'Fixe-toi un objectif, avance un peu chaque jour et célèbre tes progrès.',
    src: '/videos/reste-connecte.mp4',
    poster: '/images/motivation-reste-connecte.jpg',
  },
];

export const Route = createFileRoute('/_authenticated/motivation')({
  head: () => pageMeta('Motivation — Cabine Online', 'Deux courtes vidéos pour rester motivé et avancer vers tes objectifs.'),
  component: Motivation,
});

function Motivation() {
  return (
    <div className="space-y-8">
      <div className="space-y-4 pr-12">
        <Button variant="ghost" asChild className="-ml-4">
          <Link to="/quiz"><ArrowLeft className="mr-2 size-4" />Quiz & récompenses</Link>
        </Button>
        <div>
          <p className="text-sm text-primary">Deux minutes pour toi</p>
          <h1 className="mt-1 text-2xl font-bold md:text-3xl">Une dose de motivation</h1>
          <p className="mt-2 text-sm text-muted-foreground">Lance une vidéo avec le son et fais une pause avant de continuer.</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {videos.map((video) => (
          <article key={video.src} className="space-y-4">
            <video
              className="aspect-video w-full rounded-2xl border bg-card object-cover"
              controls
              playsInline
              preload="metadata"
              poster={video.poster}
              aria-label={video.title}
            >
              <source src={video.src} type="video/mp4" />
              Ton navigateur ne peut pas lire cette vidéo.
            </video>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Play className="size-4 text-primary" />{video.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{video.description}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
