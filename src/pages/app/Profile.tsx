import { useRef, useState } from 'react';
import { Camera, Award, Flame, Zap, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, friendlyError } from '@/lib/supabase';
import { uploadImage } from '@/lib/media';
import { useMyBadges, useBadges, useMyCertificates, useMyEnrollments } from '@/hooks/queries';
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Textarea } from '@/components/ui';
import { formatDate, levelFromXp, ROLE_LABEL } from '@/lib/utils';

export function Profile() {
  const { profile, refreshProfile, session } = useAuth();
  const { data: certs } = useMyCertificates();
  const { data: enrollments } = useMyEnrollments();
  const { data: badges } = useBadges();
  const { data: mine } = useMyBadges();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    headline: profile?.headline ?? '',
    bio: profile?.bio ?? '',
    location: profile?.location ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!profile) return null;
  const lvl = levelFromXp(profile.xp);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.full_name.trim().length < 2) return toast.error('Please enter your full name.');
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name.trim(), headline: form.headline.trim() || null, bio: form.bio.trim() || null, location: form.location.trim() || null })
      .eq('id', profile!.id);
    setSaving(false);
    if (error) return toast.error(friendlyError(error.message));
    await refreshProfile();
    toast.success('Profile updated');
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(file, 'avatar', session!.user.id);
      const { error: e2 } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile!.id);
      if (e2) throw e2;
      await refreshProfile();
      toast.success('Photo updated');
    } catch (e) {
      toast.error(friendlyError((e as Error).message));
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PageHeader title="My profile" />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-6 text-center">
          <div className="relative mx-auto w-fit">
            <Avatar name={profile.full_name} url={profile.avatar_url} size={112} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600"
              aria-label="Change photo"
              disabled={uploading}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
          <h2 className="mt-4 text-xl font-bold">{profile.full_name}</h2>
          {profile.username && <p className="text-sm text-ink-500">@{profile.username}</p>}
          <Badge tone="blue" className="mt-2">
            {ROLE_LABEL[profile.role]}
          </Badge>
          {profile.headline && <p className="mt-3 text-sm">{profile.headline}</p>}
          <p className="mt-1 text-xs text-ink-400">Member since {formatDate(profile.created_at, { month: 'long', year: 'numeric' })}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            {[
              [Zap, `Level ${lvl.level}`, `${profile.xp} XP`],
              [Flame, `${profile.streak} days`, `best ${profile.longest_streak}`],
              [BookOpen, enrollments?.length ?? 0, 'courses'],
              [Award, certs?.length ?? 0, 'certificates'],
            ].map(([Icon, v, l], i) => {
              const I = Icon as typeof Zap;
              return (
                <div key={i} className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
                  <I className="h-4 w-4 text-brand-600" />
                  <p className="mt-1 font-bold">{v as string}</p>
                  <p className="text-xs text-ink-500">{l as string}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {badges
              ?.filter((b) => mine?.some((m) => m.badge_code === b.code))
              .map((b) => (
                <span key={b.code} title={b.name} className="grid h-9 w-9 place-items-center rounded-xl text-lg" style={{ background: `${b.color}22` }}>
                  {b.icon}
                </span>
              ))}
          </div>
        </Card>
        <Card className="p-6">
          <form onSubmit={save} className="space-y-4">
            <Field label="Full name" htmlFor="p-name" hint="Printed on certificates issued from now on.">
              <Input id="p-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Headline" htmlFor="p-head" hint="e.g. Aspiring web developer · JHS 3 student">
              <Input id="p-head" maxLength={120} value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
            </Field>
            <Field label="Location" htmlFor="p-loc">
              <Input id="p-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="About me" htmlFor="p-bio">
              <Textarea id="p-bio" rows={5} maxLength={1000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </Field>
            <Button type="submit" loading={saving}>
              Save profile
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
