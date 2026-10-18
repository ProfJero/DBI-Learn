import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

const STEPS = [
  { emoji: '👋', title: 'Akwaaba to DBI Learn!', body: 'Learn digital skills step by step — at your own pace, on your phone or computer. Here is a quick tour.' },
  { emoji: '📚', title: 'Learn', body: 'Pick a course in Explore. Read short lessons, press Listen to hear them read aloud, then take a quick quiz.' },
  { emoji: '💻', title: 'Practice', body: 'In the Practice Lab you write real code — web pages, Python, SQL — and see it work instantly. Finish challenges to earn XP.' },
  { emoji: '🙋', title: 'Ask a teacher', body: 'Stuck? Every lesson has an “Ask a question” button. Ask in public or privately — a teacher will answer.' },
  { emoji: '📶', title: 'No data? No problem', body: 'Download a course to study and take quizzes offline. Your progress syncs when you are back online.' },
  { emoji: '🎓', title: 'Earn your certificate', body: 'Finish every lesson and pass the final exam to get a certificate anyone can verify. Ready?' },
];

const key = (uid: string) => `dbi:tour:${uid}`;

export function shouldShowTour(uid: string) {
  try {
    return !localStorage.getItem(key(uid));
  } catch {
    return false;
  }
}

/** A short first-visit tour in plain language, aimed at JHS/SHS learners. */
export function WelcomeTour({ uid }: { uid: string }) {
  const [open, setOpen] = useState(() => shouldShowTour(uid));
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const close = () => {
    try {
      localStorage.setItem(key(uid), new Date().toISOString());
    } catch {
      /* private mode */
    }
    setOpen(false);
  };
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;
  return (
    <Modal open={open} onClose={close} title={s.title}>
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-brand-100 to-sky-100 text-5xl dark:from-brand-950 dark:to-sky-950" aria-hidden>
          {s.emoji}
        </div>
        <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-ink-600 dark:text-ink-300">{s.body}</p>
        <div className="mt-5 flex justify-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-brand-500' : 'w-2 bg-ink-200 dark:bg-ink-700'}`} />
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={close}>
            Skip
          </Button>
          {last ? (
            <Button
              size="lg"
              onClick={() => {
                close();
                navigate('/app/catalog');
              }}
            >
              Find a course <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => setStep(step + 1)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
