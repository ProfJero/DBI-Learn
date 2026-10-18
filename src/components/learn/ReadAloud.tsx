import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { getPrefs } from '@/lib/a11y';
import { cn } from '@/lib/utils';

/** Turns lesson Markdown into sentences that sound natural when spoken. */
export function speakableText(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, ' (There is a code example here.) ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => (alt ? ` Picture: ${alt}. ` : ' '))
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s*\[!(TIP|NOTE|WARNING|TRY)\]/gim, (_, k) => ({ TIP: 'Tip.', NOTE: 'Note.', WARNING: 'Watch out.', TRY: 'Try it yourself.' })[k.toUpperCase() as 'TIP'])
    .replace(/^\|?[\s:|-]+\|[\s:|-]*$/gm, '')
    .replace(/\|/g, ', ')
    .replace(/[#>*_`~]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\n{2,}/g, '.\n')
    .replace(/\s+\./g, '.')
    .trim();
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  // Prefer African and British English voices, which sound closest to classroom English in Ghana.
  return (
    voices.find((v) => /en[-_](GH|NG|KE|ZA)/i.test(v.lang)) ??
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    null
  );
}

/**
 * Reads the lesson aloud with the device's built-in voice. It needs no download,
 * so it works offline, and helps learners who read slowly or are still learning English.
 */
export function ReadAloud({ text, className }: { text: string; className?: string }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const chunks = useRef<string[]>([]);
  const index = useRef(0);

  useEffect(() => () => {
    if (supported) speechSynthesis.cancel();
  }, [supported]);

  if (!supported) return null;

  function speakFrom(i: number) {
    index.current = i;
    if (i >= chunks.current.length) {
      setState('idle');
      return;
    }
    const u = new SpeechSynthesisUtterance(chunks.current[i]);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-GB';
    u.rate = getPrefs().readRate;
    u.onend = () => speakFrom(index.current + 1);
    u.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') setState('idle');
    };
    speechSynthesis.speak(u);
  }

  function start() {
    speechSynthesis.cancel();
    // Short chunks: some Android voices stop after ~15 seconds of continuous speech.
    chunks.current = speakableText(text).match(/[^.!?\n]+[.!?\n]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
    setState('playing');
    speakFrom(0);
  }

  const btn = 'inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition';
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {state === 'idle' && (
        <button onClick={start} className={cn(btn, 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300')}>
          <Volume2 className="h-4 w-4" /> Listen
        </button>
      )}
      {state === 'playing' && (
        <button
          onClick={() => {
            speechSynthesis.pause();
            setState('paused');
          }}
          className={cn(btn, 'bg-sky-500 text-white')}
          aria-label="Pause reading"
        >
          <Pause className="h-4 w-4" /> Pause
        </button>
      )}
      {state === 'paused' && (
        <button
          onClick={() => {
            speechSynthesis.resume();
            setState('playing');
          }}
          className={cn(btn, 'bg-sky-500 text-white')}
          aria-label="Continue reading"
        >
          <Play className="h-4 w-4" /> Continue
        </button>
      )}
      {state !== 'idle' && (
        <button
          onClick={() => {
            speechSynthesis.cancel();
            chunks.current = [];
            setState('idle');
          }}
          className={cn(btn, 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800')}
          aria-label="Stop reading"
        >
          <Square className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
