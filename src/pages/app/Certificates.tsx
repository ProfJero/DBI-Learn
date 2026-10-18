import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, Copy, Download, ExternalLink, FileDown, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMyCertificates } from '@/hooks/queries';
import { supabase, must } from '@/lib/supabase';
import type { Certificate } from '@/lib/types';
import { Badge, Button, Card, EmptyState, FullPageSpinner, LinkButton, PageHeader } from '@/components/ui';
import { ScaledCertificate } from '@/components/certificate/CertificateArt';
import { downloadCertificatePdf, downloadCertificatePng, linkedInAddUrl } from '@/components/certificate/exportCertificate';
import { formatDate } from '@/lib/utils';
import { SITE_URL } from '@/lib/config';

export function Certificates() {
  const { data, isLoading } = useMyCertificates();
  return (
    <>
      <PageHeader title="My certificates" subtitle="Verifiable credentials from Digital Bridge Initiative. Download, print or share them." />
      {isLoading && <FullPageSpinner />}
      {!isLoading && !data?.length && (
        <EmptyState
          icon={<Award className="h-5 w-5" />}
          title="No certificates yet"
          body="Complete every lesson and pass the quizzes in a course to earn your first certificate."
          action={<LinkButton to="/app/courses">Continue learning</LinkButton>}
        />
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {data?.map((c) => (
          <Link key={c.id} to={`/app/certificates/${c.serial}`} className="group">
            <Card className="overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
              <Thumb cert={c} />
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold">{c.course_title}</p>
                  <p className="text-xs text-ink-500">
                    Issued {formatDate(c.issued_at)} · <span className="font-mono">{c.serial}</span>
                  </p>
                </div>
                <Badge tone={c.status === 'revoked' ? 'red' : c.kind === 'distinction' ? 'gold' : 'green'} className="capitalize">
                  {c.status === 'revoked' ? 'Revoked' : c.kind}
                </Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

function Thumb({ cert }: { cert: Certificate }) {
  return (
    <div className="pointer-events-none">
      <ScaledCertificate cert={cert} />
    </div>
  );
}

export function CertificatePage() {
  const { serial = '' } = useParams();
  const art = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null);
  const { data: cert, isLoading } = useQuery({
    queryKey: ['certificate', serial],
    queryFn: async () => must(await supabase.from('certificates').select('*').eq('serial', serial).maybeSingle()) as Certificate | null,
  });
  if (isLoading) return <FullPageSpinner />;
  if (!cert) return <EmptyState icon={<Award className="h-5 w-5" />} title="Certificate not found" action={<LinkButton to="/app/certificates">Back to certificates</LinkButton>} />;

  const verifyUrl = `${SITE_URL}/verify/${cert.serial}`;
  const download = async (kind: 'png' | 'pdf') => {
    if (!art.current) return;
    setBusy(kind);
    try {
      await (kind === 'pdf' ? downloadCertificatePdf : downloadCertificatePng)(art.current, cert);
    } catch {
      toast.error('Could not generate the file. Please try again.');
    } finally {
      setBusy(null);
    }
  };
  const share = async () => {
    const text = `I just earned my "${cert.course_title}" certificate from Digital Bridge Initiative! 🎓`;
    if (navigator.share) await navigator.share({ title: 'My DBI certificate', text, url: verifyUrl }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(`${text} ${verifyUrl}`);
      toast.success('Share text copied to clipboard');
    }
  };

  return (
    <>
      <PageHeader
        title={cert.course_title}
        subtitle={`Issued to ${cert.recipient_name} on ${formatDate(cert.issued_at, { dateStyle: 'long' })}`}
        actions={
          <>
            <Button variant="outline" icon={<Download className="h-4 w-4" />} loading={busy === 'png'} onClick={() => download('png')}>
              PNG
            </Button>
            <Button icon={<FileDown className="h-4 w-4" />} loading={busy === 'pdf'} onClick={() => download('pdf')}>
              Download PDF
            </Button>
          </>
        }
      />
      <ScaledCertificate cert={cert} artRef={art} />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-semibold">Share your achievement</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={linkedInAddUrl(cert, verifyUrl)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#0a66c2] px-3 text-sm font-semibold text-white hover:opacity-90">
              <LinkedInMark /> Add to LinkedIn
            </a>
            <Button size="sm" variant="outline" icon={<Share2 className="h-4 w-4" />} onClick={share}>
              Share
            </Button>
          </div>
        </Card>
        <Card className="p-5 md:col-span-2">
          <p className="text-sm font-semibold">Public verification link</p>
          <div className="mt-3 flex gap-2">
            <code className="flex-1 truncate rounded-xl bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800">{verifyUrl}</code>
            <Button
              size="sm"
              variant="outline"
              icon={<Copy className="h-4 w-4" />}
              onClick={async () => {
                await navigator.clipboard.writeText(verifyUrl);
                toast.success('Link copied');
              }}
            >
              Copy
            </Button>
            <LinkButton to={`/verify/${cert.serial}`} size="sm" variant="ghost" icon={<ExternalLink className="h-4 w-4" />}>
              Open
            </LinkButton>
          </div>
          <p className="mt-2 text-xs text-ink-500">Anyone with this link or the QR code on your certificate can confirm it is genuine.</p>
        </Card>
      </div>
    </>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
