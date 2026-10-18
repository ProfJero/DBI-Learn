import { Award, Share2 } from 'lucide-react';
import { LinkButton, Modal } from '@/components/ui';

/** True the first time a certificate is celebrated on this device. */
export function claimCelebration(serial: string | null | undefined) {
  if (!serial) return false;
  const key = `dbi-celebrated:${serial}`;
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable: celebrate anyway */
  }
  return true;
}

export function CertificateCelebration({ serial, courseTitle, onClose }: { serial: string | null; courseTitle: string; onClose: () => void }) {
  return (
    <Modal open={!!serial} onClose={onClose} title="Course complete! 🎓" size="sm">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-lg">
          <Award className="h-10 w-10" />
        </div>
        <p className="mt-4 text-lg font-bold">Congratulations!</p>
        <p className="mt-1 text-sm text-ink-500">
          You've completed <strong>{courseTitle}</strong> and earned a verifiable Digital Bridge Initiative certificate.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <LinkButton to={`/app/certificates/${serial}`} size="lg" icon={<Award className="h-5 w-5" />}>
            View my certificate
          </LinkButton>
          <LinkButton to={`/app/certificates/${serial}`} variant="outline" icon={<Share2 className="h-4 w-4" />}>
            Share on LinkedIn
          </LinkButton>
        </div>
      </div>
    </Modal>
  );
}
