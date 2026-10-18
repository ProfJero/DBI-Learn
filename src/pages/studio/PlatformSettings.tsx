import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Palette, PenLine, Plus, Save, ScrollText, Trash2, Upload, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { useCategories, useSettings } from '@/hooks/queries';
import type { Category, Signatory } from '@/lib/types';
import { Button, Card, EmptyState, Field, FullPageSpinner, Input, PageHeader, Textarea } from '@/components/ui';
import { formatDate, slugify } from '@/lib/utils';

async function uploadSignature(file: File) {
  const path = `signatures/${Date.now()}-${slugify(file.name)}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('course-media').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from('course-media').getPublicUrl(path).data.publicUrl;
}

function SignatoryEditor({ value, onChange, onRemove }: { value: Signatory; onChange: (s: Signatory) => void; onRemove?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid items-end gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-800 sm:grid-cols-[1fr_1fr_auto_auto]">
      <Field label="Name">
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </Field>
      <Field label="Title">
        <Input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </Field>
      <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink-200 px-3 text-sm dark:border-ink-700">
        {value.signature_url ? <img src={value.signature_url} alt="" className="h-8 max-w-[90px] object-contain dark:invert" /> : <Upload className="h-4 w-4" />}
        {busy ? 'Uploading…' : value.signature_url ? 'Replace' : 'Signature'}
        <input
          type="file"
          accept="image/png,image/webp,image/svg+xml"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              onChange({ ...value, signature_url: await uploadSignature(f) });
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {onRemove ? (
        <Button variant="ghost" size="sm" className="h-11 text-red-600" onClick={onRemove} aria-label="Remove signatory">
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

export function PlatformSettings() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSettings();
  const { data: categories } = useCategories();
  const [branding, setBranding] = useState<Record<string, string>>({});
  const [sigs, setSigs] = useState<Signatory[]>([]);
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    if (settings) {
      setBranding((settings.branding ?? {}) as Record<string, string>);
      setSigs(((settings.certificate?.signatories ?? []) as Signatory[]).map((s) => ({ ...s })));
    }
  }, [settings]);
  useEffect(() => {
    setCats(categories?.map((c) => ({ ...c })) ?? []);
  }, [categories]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      must(
        await supabase.from('settings').upsert([
          { key: 'branding', value: branding, updated_by: profile!.id, updated_at: new Date().toISOString() },
          { key: 'certificate', value: { ...(settings?.certificate ?? {}), signatories: sigs.filter((s) => s.name.trim()) }, updated_by: profile!.id, updated_at: new Date().toISOString() },
        ]),
      );
    },
    onSuccess: () => {
      toast.success('Settings saved');
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCategories = useMutation({
    mutationFn: async () => {
      const rows = cats.map((c, i) => ({
        id: c.id,
        slug: c.slug || slugify(c.name),
        name: c.name.trim(),
        description: c.description,
        color: c.color,
        icon: c.icon,
        position: i + 1,
        signatory: c.signatory?.name?.trim() ? c.signatory : null,
      }));
      must(await supabase.from('categories').upsert(rows));
    },
    onSuccess: () => {
      toast.success('Tracks saved');
      void qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <FullPageSpinner />;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Platform settings" subtitle="Branding, certificate signatories and learning tracks." />
      <Card className="p-6">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
          <Building2 className="h-5 w-5 text-brand-500" /> Organisation & contact
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['platform_name', 'Platform name'],
            ['organisation', 'Organisation'],
            ['tagline', 'Tagline'],
            ['support_email', 'Support email'],
            ['support_phone', 'Support phone'],
            ['address', 'Address'],
          ].map(([k, label]) => (
            <Field key={k} label={label} htmlFor={`b-${k}`}>
              <Input id={`b-${k}`} value={branding[k!] ?? ''} onChange={(e) => setBranding({ ...branding, [k!]: e.target.value })} />
            </Field>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-500">Platform credit: Built by {branding.built_by || 'ProfJero Digital Studio'} · Powered by {branding.organisation || 'Digital Bridge Initiative'}.</p>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <PenLine className="h-5 w-5 text-brand-500" /> Certificate signatories
        </h2>
        <p className="mb-4 text-sm text-ink-500">Shown on every new certificate. A track's head of department is added automatically. Upload signatures as transparent PNGs.</p>
        <div className="space-y-3">
          {sigs.map((s, i) => (
            <SignatoryEditor key={i} value={s} onChange={(v) => setSigs(sigs.map((x, j) => (j === i ? v : x)))} onRemove={() => setSigs(sigs.filter((_, j) => j !== i))} />
          ))}
        </div>
        {sigs.length < 2 && (
          <Button size="sm" variant="outline" className="mt-3" icon={<Plus className="h-4 w-4" />} onClick={() => setSigs([...sigs, { name: '', title: '', signature_url: null }])}>
            Add signatory
          </Button>
        )}
        <div className="mt-6">
          <Button icon={<Save className="h-4 w-4" />} loading={saveSettings.isPending} onClick={() => saveSettings.mutate()}>
            Save settings
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <Palette className="h-5 w-5 text-brand-500" /> Learning tracks
        </h2>
        <p className="mb-4 text-sm text-ink-500">Tracks group courses in the catalogue. Each can have a head of department who co-signs its certificates.</p>
        <div className="space-y-4">
          {cats.map((c, i) => (
            <div key={c.id} className="rounded-2xl border border-ink-100 p-4 dark:border-ink-800">
              <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                <Field label="Track name">
                  <Input value={c.name} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                </Field>
                <Field label="Colour">
                  <input type="color" value={c.color ?? '#03c14b'} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} className="h-11 w-full cursor-pointer rounded-xl border border-ink-200" />
                </Field>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    className="text-red-600"
                    aria-label="Delete track"
                    onClick={async () => {
                      if (!confirm(`Delete the ${c.name} track? Its courses become uncategorised.`)) return;
                      const { error } = await supabase.from('categories').delete().eq('id', c.id);
                      if (error) return toast.error(error.message);
                      void qc.invalidateQueries({ queryKey: ['categories'] });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Field label="Description" className="mt-3">
                <Textarea rows={2} value={c.description ?? ''} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              </Field>
              <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Head of department (optional)</p>
              <SignatoryEditor
                value={c.signatory ?? { name: '', title: `Head of ${c.name}`, signature_url: null }}
                onChange={(s) => setCats(cats.map((x, j) => (j === i ? { ...x, signatory: s } : x)))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCats([...cats, { id: crypto.randomUUID(), slug: '', name: 'New track', description: '', color: '#0b7be8', icon: null, signatory: null, position: cats.length + 1 }])}
          >
            Add track
          </Button>
          <Button icon={<Save className="h-4 w-4" />} loading={saveCategories.isPending} onClick={() => saveCategories.mutate()}>
            Save tracks
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function AuditLog() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: async () =>
      must(await supabase.from('audit_logs').select('*, actor:profiles!audit_logs_actor_id_fkey(full_name)').order('created_at', { ascending: false }).limit(300)) as {
        id: number;
        action: string;
        target_type: string | null;
        target_id: string | null;
        details: Record<string, unknown>;
        created_at: string;
        actor: { full_name: string } | null;
      }[],
  });
  return (
    <>
      <PageHeader title="Audit log" subtitle="A permanent record of sensitive administrative actions." />
      {isLoading && <FullPageSpinner />}
      {!isLoading && !data?.length && <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No activity recorded yet" />}
      {!!data?.length && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500 dark:bg-ink-800/50">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500">{formatDate(r.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-4 py-3">{r.actor?.full_name ?? 'System'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-500">{Object.entries(r.details ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') || r.target_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
