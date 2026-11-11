import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

function secondsLeft(deadline: string) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}

export function QuizCountdown({ deadline, disabled, onExpire }: { deadline: string; disabled: boolean; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => secondsLeft(deadline));
  const fired = useRef(false);
  const expire = useRef(onExpire);

  useEffect(() => { expire.current = onExpire; }, [onExpire]);
  useEffect(() => { fired.current = false; setRemaining(secondsLeft(deadline)); }, [deadline]);
  useEffect(() => {
    const tick = () => {
      const seconds = secondsLeft(deadline);
      setRemaining(seconds);
      if (seconds === 0 && !disabled && !fired.current) {
        fired.current = true;
        expire.current();
      }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [deadline, disabled]);

  return (
    <div role="timer" aria-live="polite" className={`flex items-center justify-between rounded-xl border px-4 py-3 ${remaining <= 5 ? 'border-destructive text-destructive' : 'border-primary/40 text-primary'}`}>
      <span className="flex items-center gap-2 text-sm font-medium"><Clock className="size-4" />Temps restant</span>
      <span className="font-display text-2xl font-bold tabular-nums">{remaining} s</span>
    </div>
  );
}
