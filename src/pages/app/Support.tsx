import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LifeBuoy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { Avatar, Badge, Button, Card, EmptyState, Field, FullPageSpinner, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';

export type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  requester?: { full_name: string; avatar_url: string | null };
};

export const STATUS_TONE = { open: 'amber', pending: 'blue', resolved: 'green', closed: 'gray' } as const;

const FAQ = [
  ['How do I study offline?', 'Open a course and tap "Download", or go to Downloads. Downloaded courses open without internet, and lesson completions and quiz answers sync automatically when you reconnect.'],
  ['How do I get a certificate?', 'Complete every lesson and pass every module quiz and the final exam (the pass mark is shown on each quiz). Your certificate is issued instantly and appears under Certificates.'],
  ['Can I retake a quiz?', 'Yes — most quizzes allow retakes, and your best score counts. Final exams may limit the number of attempts; the limit is shown before you start.'],
  ['My name on the certificate is wrong', 'Update your full name in Settings before completing a course. For an already-issued certificate, open a support ticket with the "Certificate" category.'],
  ['I forgot my password', 'Use "Forgot password?" on the login page to receive a reset link by email.'],
];

export function Support() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['my-tickets', session?.user.id],
    queryFn: async () => must(await supabase.from('support_tickets').select('*').eq('user_id', session!.user.id).order('updated_at', { ascending: false })) as TicketRow[],
  });
  return (
    <>
      <PageHeader
        title="Help & support"
        subtitle="Find quick answers or talk to the Digital Bridge Initiative team."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            New request
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section>
          <h2 className="mb-3 font-bold">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-ink-100 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {q}
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-bold">Your requests</h2>
          {isLoading && <FullPageSpinner />}
          {!isLoading && !data?.length && <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No support requests" body="Need help? Open a request and we'll reply here." />}
          <div className="space-y-2">
            {data?.map((t) => (
              <Link key={t.id} to={`/app/support/${t.id}`}>
                <Card className="flex items-center justify-between gap-3 p-4 hover:shadow-lift">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.subject}</p>
                    <p className="text-xs capitalize text-ink-500">
                      {t.category} · updated {timeAgo(t.updated_at)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[t.status]} className="capitalize">
                    {t.status === 'pending' ? 'Replied' : t.status}
                  </Badge>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <NewTicket open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function NewTicket({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ subject: '', category: 'general', message: '' });
  const create = useMutation({
    mutationFn: async () => {
      const t = must(
        await supabase.from('support_tickets').insert({ user_id: session!.user.id, subject: form.subject.trim(), category: form.category }).select('id').single(),
      ) as { id: string };
      must(await supabase.from('ticket_messages').insert({ ticket_id: t.id, author_id: session!.user.id, body: form.message.trim() }));
      return t;
    },
    onSuccess: (t) => {
      toast.success("Request sent. We'll reply as soon as possible.");
      void qc.invalidateQueries({ queryKey: ['my-tickets'] });
      onClose();
      navigate(`/app/support/${t.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New support request"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={form.subject.trim().length < 3 || !form.message.trim()} onClick={() => create.mutate()}>
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Subject" htmlFor="tk-subject">
          <Input id="tk-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </Field>
        <Field label="Category" htmlFor="tk-cat">
          <Select id="tk-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="general">General</option>
            <option value="technical">Technical problem</option>
            <option value="course">Course content</option>
            <option value="certificate">Certificate</option>
            <option value="account">Account</option>
          </Select>
        </Field>
        <Field label="How can we help?" htmlFor="tk-msg">
          <Textarea id="tk-msg" rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function TicketThread({ ticketId, staffView }: { ticketId: string; staffView?: boolean }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () =>
      must(await supabase.from('support_tickets').select('*, requester:profiles!support_tickets_user_id_fkey(full_name,avatar_url)').eq('id', ticketId).maybeSingle()) as TicketRow | null,
  });
  const { data: messages } = useQuery({
    queryKey: ['ticket-messages', ticketId],
    refetchInterval: 30_000,
    queryFn: async () =>
      must(
        await supabase
          .from('ticket_messages')
          .select('*, author:profiles!ticket_messages_author_id_fkey(full_name,avatar_url)')
          .eq('ticket_id', ticketId)
          .order('created_at'),
      ) as { id: string; body: string; from_staff: boolean; created_at: string; author: { full_name: string; avatar_url: string | null } }[],
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    void qc.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
    void qc.invalidateQueries({ queryKey: ['my-tickets'] });
    void qc.invalidateQueries({ queryKey: ['tickets'] });
  };
  const send = useMutation({
    mutationFn: async () => must(await supabase.from('ticket_messages').insert({ ticket_id: ticketId, author_id: session!.user.id, body: body.trim() })),
    onSuccess: () => {
      setBody('');
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setStatus = async (status: TicketRow['status']) => {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', ticketId);
    if (error) toast.error(error.message);
    refresh();
  };
  if (isLoading) return <FullPageSpinner />;
  if (!ticket) return <EmptyState title="Request not found" />;
  return (
    <div className="mx-auto max-w-3xl">
      <Link to={staffView ? '/admin/support' : '/app/support'} className="text-sm text-ink-500 hover:text-brand-600">
        ← Back
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-sm capitalize text-ink-500">
            {ticket.category} · opened {timeAgo(ticket.created_at)} {staffView && ticket.requester && `by ${ticket.requester.full_name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[ticket.status]} className="capitalize">
            {ticket.status}
          </Badge>
          {staffView ? (
            <Select value={ticket.status} onChange={(e) => setStatus(e.target.value as TicketRow['status'])} className="h-9 w-auto" aria-label="Status">
              <option value="open">Open</option>
              <option value="pending">Pending (awaiting learner)</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
          ) : (
            ticket.status !== 'closed' && (
              <Button size="sm" variant="outline" onClick={() => setStatus('closed')}>
                Close request
              </Button>
            )
          )}
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {messages?.map((m) => (
          <div key={m.id} className={cn('flex gap-3', m.from_staff ? '' : 'flex-row-reverse')}>
            <Avatar name={m.author.full_name} url={m.author.avatar_url} size={32} />
            <div className={cn('max-w-[80%] rounded-2xl px-4 py-3', m.from_staff ? 'bg-sky-50 dark:bg-sky-950/40' : 'bg-brand-50 dark:bg-brand-950/40')}>
              <p className="text-xs font-semibold">
                {m.author.full_name} {m.from_staff && <span className="text-sky-600">· DBI Support</span>}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
              <p className="mt-1 text-[11px] text-ink-400">{timeAgo(m.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
      <Card className="mt-6 p-4">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={staffView ? 'Reply to the learner…' : 'Add more details…'} />
        <div className="mt-3 flex justify-end">
          <Button loading={send.isPending} disabled={!body.trim()} onClick={() => send.mutate()}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function Ticket() {
  const { id = '' } = useParams();
  return <TicketThread ticketId={id} />;
}
