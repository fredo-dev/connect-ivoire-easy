import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function ThemeToggle() {
 const [light,setLight]=useState(false);
 useEffect(()=>{const saved=localStorage.getItem('cabine-theme')==='light';setLight(saved);document.documentElement.dataset['theme']=saved?'light':'dark';},[]);
 function toggle(){const next=!light;setLight(next);localStorage.setItem('cabine-theme',next?'light':'dark');document.documentElement.dataset['theme']=next?'light':'dark';}
 return <Button variant="outline" size="icon" onClick={toggle} title={light?'Mode nuit':'Mode clair'} aria-label={light?'Mode nuit':'Mode clair'} className="fixed right-4 top-3 z-50">{light?<Moon className="size-4"/>:<Sun className="size-4"/>}</Button>;
}
