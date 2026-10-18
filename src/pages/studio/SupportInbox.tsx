import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, LifeBuoy, Mail, Check } from 'lucide-react';
import { supabase, must } from '@/lib/supabase';
import { Avatar, Badge, Button, Card, EmptyState, FullPageSpinner, PageHeader, Tabs } from '@/components/ui';
import { timeAgo, formatDate } from '@/lib/utils';
import { STATUS_TONE, TicketThread, type TicketRow } from '@/pages/app/Support';

export function SupportInbox() {
  const [tab, setTab] = useState<'open' | 'pending' | 'resolved' | 'closed'>('open');
  const { data, isLoading } = useQuery({
    queryKey: ['tickets'],
    refetchInterval: 60_000,
    queryFn: async () =>
      must(await supabase.from('support_tickets').select('*, requester:profiles!support_tickets_user_id_fkey(full_name, avatar_url)').order('updated_at', { ascending: false }).limit(500)) as TicketRow[],
  });
  const list = data?.filter((t) => t.status === tab) ?? [];
  const count = (s: TicketRow['status']) => data?.filter((t) => t.status === s).length ?? 0;
  return (
    <>
      <PageHeader title="Support inbox" subtitle="Help learners with questions about courses, certificates and their accounts." />
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'open', label: 'Needs reply', count: count('open') },
          { value: 'pending', label: 'Awaiting learner', count: count('pending') },
          { value: 'resolved', label: 'Resolved', count: count('resolved') },
          { value: 'closed', label: 'Closed', count: count('closed') },
        ]}
      />
      {isLoading && <FullPageSpinner />}
      {!isLoading && !list.length && <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="Nothing here" body="Inbox zero 🎉" />}
      <div className="space-y-2">
        {list.map((t) => (
          <Link key={t.id} to={`/admin/support/${t.id}`}>
            <Card className="flex items-center gap-4 p-4 hover:shadow-lift">
              <Avatar name={t.requester?.full_name ?? '?'} url={t.requester?.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.subject}</p>
                <p className="text-xs capitalize text-ink-500">
                  {t.requester?.full_name} · {t.category} · {timeAgo(t.updated_at)}
                </p>
              </div>
              <Badge tone={STATUS_TONE[t.status]} className="capitalize">
                {t.status}
              </Badge>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

export function StudioTicket() {
  const { id = '' } = useParams();
  return <TicketThread ticketId={id} staffView />;
}

export function Inquiries() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['inquiries'],
    queryFn: async () => must(await supabase.from('inquiries').select('*').order('created_at', { ascending: false }).limit(300)) as { id: string; name: string; email: string; message: string; handled: boolean; created_at: string }[],
  });
  return (
    <>
      <PageHeader title="Contact messages" subtitle="Messages sent from the public contact form." />
      {isLoading && <FullPageSpinner />}
      {!isLoading && !data?.length && <EmptyState icon={<Inbox className="h-5 w-5" />} title="No messages yet" />}
      <div className="space-y-3">
        {data?.map((m) => (
          <Card key={m.id} className={`p-5 ${m.handled ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-xs text-ink-500">
                  {m.email} · {formatDate(m.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex gap-2">
                <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to Digital Bridge Initiative')}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-ink-200 px-3 text-sm font-medium hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800">
                  <Mail className="h-4 w-4" /> Reply
                </a>
                <Button
                  size="sm"
                  variant={m.handled ? 'ghost' : 'outline'}
                  icon={<Check className="h-4 w-4" />}
                  onClick={async () => {
                    await supabase.from('inquiries').update({ handled: !m.handled }).eq('id', m.id);
                    void qc.invalidateQueries({ queryKey: ['inquiries'] });
                  }}
                >
                  {m.handled ? 'Mark unhandled' : 'Mark handled'}
                </Button>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-ink-700 dark:text-ink-200">{m.message}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
