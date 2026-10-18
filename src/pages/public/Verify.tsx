import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Download, FileDown, Search, ShieldAlert, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, must } from '@/lib/supabase';
import type { Certificate } from '@/lib/types';
import { Button, Card, FullPageSpinner, Input } from '@/components/ui';
import { ScaledCertificate } from '@/components/certificate/CertificateArt';
import { downloadCertificatePdf, downloadCertificatePng } from '@/components/certificate/exportCertificate';
import { formatDate } from '@/lib/utils';

export function Verify() {
  const { serial = '' } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(serial);
  const art = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);

  const { data: cert, isLoading, isFetched } = useQuery({
    queryKey: ['verify', serial],
    enabled: !!serial,
    queryFn: async () => {
      const rows = must(await supabase.rpc('verify_certificate', { p_serial: serial })) as Certificate[];
      return rows[0] ?? null;
    },
  });

  const download = async (kind: 'png' | 'pdf') => {
    if (!art.current || !cert) return;
    setBusy(kind);
    try {
      await (kind === 'pdf' ? downloadCertificatePdf : downloadCertificatePng)(art.current, cert);
    } catch {
      toast.error('Could not generate the file. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950">
          <BadgeCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Certificate verification</h1>
        <p className="mt-2 text-ink-500">Enter the certificate ID printed on a Digital Bridge Initiative certificate, or scan its QR code.</p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) navigate(`/verify/${encodeURIComponent(input.trim().toUpperCase())}`);
          }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="DBI-2026-AB12-CD34" className="h-12 font-mono uppercase" aria-label="Certificate ID" />
          <Button type="submit" size="lg" icon={<Search className="h-4 w-4" />}>
            Verify
          </Button>
        </form>
      </div>

      {isLoading && <FullPageSpinner label="Checking certificate…" />}

      {isFetched && !cert && (
        <Card className="mx-auto mt-10 max-w-2xl border-red-200 p-6 text-center dark:border-red-900">
          <ShieldX className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="mt-3 text-xl font-bold">No certificate found</h2>
          <p className="mt-1 text-ink-500">
            We couldn't find a certificate with ID <span className="font-mono font-semibold">{serial}</span>. Check the ID for typos, or contact Digital
            Bridge Initiative.
          </p>
        </Card>
      )}

      {cert && (
        <div className="mx-auto mt-10 max-w-5xl">
          <Card className={`mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${cert.status === 'valid' ? 'border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30' : 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30'}`}>
            {cert.status === 'valid' ? <BadgeCheck className="h-10 w-10 shrink-0 text-brand-600" /> : <ShieldAlert className="h-10 w-10 shrink-0 text-red-600" />}
            <div className="flex-1">
              <h2 className="text-lg font-bold">{cert.status === 'valid' ? 'This certificate is authentic and valid' : 'This certificate has been revoked'}</h2>
              <p className="text-sm text-ink-600 dark:text-ink-300">
                Issued to <strong>{cert.recipient_name}</strong> for <strong>{cert.course_title}</strong> on {formatDate(cert.issued_at, { dateStyle: 'long' })}.
                {cert.revoked_reason && ` Reason: ${cert.revoked_reason}`}
              </p>
            </div>
            {cert.status === 'valid' && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} loading={busy === 'png'} onClick={() => download('png')}>
                  PNG
                </Button>
                <Button size="sm" icon={<FileDown className="h-4 w-4" />} loading={busy === 'pdf'} onClick={() => download('pdf')}>
                  PDF
                </Button>
              </div>
            )}
          </Card>
          <ScaledCertificate cert={cert} artRef={art} />
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-4">
            {[
              ['Certificate ID', cert.serial],
              ['Type', cert.kind[0]!.toUpperCase() + cert.kind.slice(1)],
              ['Grade', cert.grade != null ? `${cert.grade}%` : '—'],
              ['Learning hours', cert.hours != null ? Number(cert.hours) : '—'],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                <dt className="text-xs text-ink-500">{k}</dt>
                <dd className="mt-0.5 font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {cert.course_slug && (
            <p className="mt-6 text-center text-sm text-ink-500">
              Want to earn this too?{' '}
              <Link to={`/courses/${cert.course_slug}`} className="font-semibold text-brand-600 hover:underline">
                View the course →
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
