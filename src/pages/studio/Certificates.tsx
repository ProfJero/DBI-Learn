import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Ban, FilePlus2, Search, Upload, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, must } from '@/lib/supabase';
import { useCategories } from '@/hooks/queries';
import type { Certificate } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Field, FullPageSpinner, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import { ScaledCertificate } from '@/components/certificate/CertificateArt';
import { downloadText, formatDate, toCsv } from '@/lib/utils';

export function StudioCertificates() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'valid' | 'revoked'>('all');
  const [issuing, setIssuing] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [revoking, setRevoking] = useState<Certificate | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['all-certificates'],
    queryFn: async () => must(await supabase.from('certificates').select('*').order('issued_at', { ascending: false }).limit(2000)) as Certificate[],
  });
  const list = useMemo(() => {
    const n = q.toLowerCase();
    return (data ?? []).filter((c) => (tab === 'all' || c.status === tab) && (!n || `${c.serial} ${c.recipient_name} ${c.recipient_email} ${c.course_title}`.toLowerCase().includes(n)));
  }, [data, q, tab]);

  const revoke = useMutation({
    mutationFn: async () => must(await supabase.rpc('revoke_certificate', { p_serial: revoking!.serial, p_reason: reason.trim() })),
    onSuccess: () => {
      toast.success('Certificate revoked. Verification now shows it as revoked.');
      setRevoking(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['all-certificates'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle="Course certificates are issued automatically. Issue certificates manually for workshops, bootcamps and events."
        actions={
          <>
            <Button variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => setBulk(true)}>
              Bulk issue (CSV)
            </Button>
            <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setIssuing(true)}>
              Issue certificate
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All', count: data?.length },
            { value: 'valid', label: 'Valid', count: data?.filter((c) => c.status === 'valid').length },
            { value: 'revoked', label: 'Revoked', count: data?.filter((c) => c.status === 'revoked').length },
          ]}
        />
        <div className="flex gap-2">
          <div className="relative sm:w-72">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input className="pl-10" placeholder="Search name, ID or course" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search certificates" />
          </div>
          <Button
            variant="outline"
            disabled={!list.length}
            onClick={() =>
              downloadText(
                'dbi-certificates.csv',
                toCsv(list.map((c) => ({ serial: c.serial, recipient: c.recipient_name, email: c.recipient_email ?? '', course: c.course_title, type: c.kind, grade: c.grade ?? '', issued: c.issued_at, status: c.status }))),
              )
            }
          >
            Export
          </Button>
        </div>
      </div>
      {isLoading && <FullPageSpinner />}
      {!isLoading && !list.length && <EmptyState icon={<Award className="h-5 w-5" />} title="No certificates" />}
      {!!list.length && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500 dark:bg-ink-800/50">
                <tr>
                  <th className="px-4 py-3">Certificate ID</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Programme</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono text-xs">{c.serial}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{c.recipient_name}</span>
                      <span className="text-xs text-ink-500">{c.recipient_email}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.course_title}
                      <span className="block text-xs capitalize text-ink-500">
                        {c.kind}
                        {c.grade != null && ` · ${c.grade}%`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(c.issued_at)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={c.status === 'valid' ? 'green' : 'red'}>{c.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link to={`/verify/${c.serial}`} target="_blank" className="inline-flex rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" title="View">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      {c.status === 'valid' && (
                        <button className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" title="Revoke" onClick={() => setRevoking(c)}>
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {issuing && <IssueModal onClose={() => setIssuing(false)} />}
      {bulk && <BulkModal onClose={() => setBulk(false)} />}
      <Modal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Revoke certificate"
        size="sm"
        footer={
          <Button variant="danger" loading={revoke.isPending} disabled={reason.trim().length < 3} onClick={() => revoke.mutate()}>
            Revoke
          </Button>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Revoking <span className="font-mono">{revoking?.serial}</span> ({revoking?.recipient_name}) makes public verification show it as revoked. This is recorded in the audit log.
        </p>
        <Field label="Reason" htmlFor="rv-reason" className="mt-4">
          <Input id="rv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Issued in error" />
        </Field>
      </Modal>
    </>
  );
}

type Draft = { recipient_name: string; recipient_email: string; course_title: string; kind: Certificate['kind']; category_name: string; grade: string; hours: string; description: string; issued_at: string };

function IssueModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: async () => must(await supabase.from('settings').select('key, value')) as { key: string; value: { signatories?: Certificate['signatories'] } }[] });
  const [f, setF] = useState<Draft>({ recipient_name: '', recipient_email: '', course_title: '', kind: 'participation', category_name: '', grade: '', hours: '', description: '', issued_at: new Date().toISOString().slice(0, 10) });
  const baseSigs = settings?.find((s) => s.key === 'certificate')?.value.signatories ?? [];
  const catSig = categories?.find((c) => c.name === f.category_name)?.signatory;
  const preview: Certificate = {
    id: 'preview',
    serial: 'DBI-PREVIEW-0000',
    user_id: null,
    recipient_name: f.recipient_name || 'Recipient Name',
    recipient_email: f.recipient_email || null,
    course_id: null,
    course_title: f.course_title || 'Programme title',
    category_name: f.category_name || null,
    kind: f.kind,
    grade: f.grade ? Number(f.grade) : null,
    hours: f.hours ? Number(f.hours) : null,
    description: f.description || null,
    signatories: catSig && !baseSigs.some((s) => s.name === catSig.name) ? [...baseSigs, catSig] : baseSigs,
    status: 'valid',
    revoked_reason: null,
    issued_at: new Date(f.issued_at).toISOString(),
  };
  const issue = useMutation({
    mutationFn: async () =>
      must(
        await supabase.rpc('issue_certificate', {
          p_recipient_name: f.recipient_name,
          p_recipient_email: f.recipient_email || null,
          p_course_title: f.course_title,
          p_kind: f.kind,
          p_grade: f.grade ? Number(f.grade) : null,
          p_hours: f.hours ? Number(f.hours) : null,
          p_description: f.description || null,
          p_category_name: f.category_name || null,
          p_issued_at: new Date(f.issued_at).toISOString(),
        }),
      ) as string,
    onSuccess: (serial) => {
      toast.success(`Certificate ${serial} issued`);
      void qc.invalidateQueries({ queryKey: ['all-certificates'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Issue a certificate"
      footer={
        <Button loading={issue.isPending} disabled={f.recipient_name.trim().length < 2 || f.course_title.trim().length < 3} onClick={() => issue.mutate()}>
          Issue certificate
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <Field label="Recipient full name" htmlFor="ic-name">
            <Input id="ic-name" value={f.recipient_name} onChange={(e) => setF({ ...f, recipient_name: e.target.value })} />
          </Field>
          <Field label="Recipient email (optional)" htmlFor="ic-email" hint="If they have an account, it appears in their certificates.">
            <Input id="ic-email" type="email" value={f.recipient_email} onChange={(e) => setF({ ...f, recipient_email: e.target.value })} />
          </Field>
          <Field label="Programme / course title" htmlFor="ic-title">
            <Input id="ic-title" value={f.course_title} onChange={(e) => setF({ ...f, course_title: e.target.value })} placeholder="e.g. Digital Skills Bootcamp 2026" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="ic-kind">
              <Select id="ic-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Certificate['kind'] })}>
                <option value="participation">Participation</option>
                <option value="completion">Completion</option>
                <option value="distinction">Distinction</option>
                <option value="achievement">Achievement</option>
              </Select>
            </Field>
            <Field label="Track (adds HoD signature)" htmlFor="ic-cat">
              <Select id="ic-cat" value={f.category_name} onChange={(e) => setF({ ...f, category_name: e.target.value })}>
                <option value="">—</option>
                {categories?.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Grade % (optional)" htmlFor="ic-grade">
              <Input id="ic-grade" type="number" min={0} max={100} value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} />
            </Field>
            <Field label="Hours (optional)" htmlFor="ic-hours">
              <Input id="ic-hours" type="number" min={0} step="0.5" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
            </Field>
          </div>
          <Field label="Issue date" htmlFor="ic-date">
            <Input id="ic-date" type="date" value={f.issued_at} onChange={(e) => setF({ ...f, issued_at: e.target.value })} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Live preview</p>
          <ScaledCertificate cert={preview} />
        </div>
      </div>
    </Modal>
  );
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

function BulkModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('name,email,course,type,grade,hours\n');
  const [course, setCourse] = useState('');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<{ name: string; serial?: string; error?: string }[]>([]);
  const rows = useMemo(() => parseCsv(text).filter((r) => r.name), [text]);
  async function run() {
    setRunning(true);
    const out: typeof done = [];
    for (const r of rows) {
      const { data, error } = await supabase.rpc('issue_certificate', {
        p_recipient_name: r.name,
        p_recipient_email: r.email || null,
        p_course_title: r.course || course,
        p_kind: ['completion', 'distinction', 'participation', 'achievement'].includes(r.type ?? '') ? r.type : 'participation',
        p_grade: r.grade ? Number(r.grade) : null,
        p_hours: r.hours ? Number(r.hours) : null,
      });
      out.push({ name: r.name, serial: data as string | undefined, error: error?.message });
      setDone([...out]);
    }
    setRunning(false);
    void qc.invalidateQueries({ queryKey: ['all-certificates'] });
    toast.success(`${out.filter((o) => o.serial).length} certificates issued`);
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Bulk issue certificates"
      footer={
        done.length ? (
          <Button
            variant="outline"
            onClick={() => downloadText('issued-certificates.csv', toCsv(done.map((d) => ({ name: d.name, certificate_id: d.serial ?? '', error: d.error ?? '' }))))}
          >
            Download results
          </Button>
        ) : (
          <Button loading={running} disabled={!rows.length || rows.some((r) => !(r.course || course))} onClick={run}>
            Issue {rows.length} certificates
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Paste a CSV with columns <code>name, email, course, type, grade, hours</code>. Only <code>name</code> is required; leave <code>course</code> blank to use the default below.
        </p>
        <Field label="Default programme title" htmlFor="bk-course">
          <Input id="bk-course" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Community Coding Workshop — Ayeldu 2026" />
        </Field>
        <Field label="CSV" htmlFor="bk-csv" hint={`${rows.length} recipients detected`}>
          <Textarea id="bk-csv" rows={8} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setText(await file.text());
          }}
        />
        {!!done.length && (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-ink-50 p-3 text-xs dark:bg-ink-800">
            {done.map((d, i) => (
              <li key={i} className={d.error ? 'text-red-600' : ''}>
                {d.name}: {d.serial ?? d.error}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
