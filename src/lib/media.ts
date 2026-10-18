import { supabase } from './supabase';
import { slugify } from './utils';
import { dataSaverOn } from './a11y';

export type UploadKind = 'avatar' | 'cover' | 'lesson' | 'signature' | 'resource';

const MAX_BYTES: Record<UploadKind, number> = { avatar: 2, cover: 5, lesson: 5, signature: 1, resource: 5 }; // MB

/**
 * Uploads an image to Cloudinary (signed by the media-sign edge function) and returns its URL.
 * Falls back to Supabase Storage when Cloudinary is not configured, so uploads keep working either way.
 */
export async function uploadImage(file: File, kind: UploadKind, owner?: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > MAX_BYTES[kind] * 1024 * 1024) throw new Error(`Please choose an image under ${MAX_BYTES[kind]} MB.`);

  const { data: sig, error } = await supabase.functions.invoke('media-sign', { body: { kind } });
  if (!error && sig?.signature) {
    const form = new FormData();
    form.append('file', file);
    for (const k of ['api_key', 'timestamp', 'signature', 'folder', 'allowed_formats']) form.append(k, String(sig[k]));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, { method: 'POST', body: form });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error?.message ?? 'Upload failed');
    return out.secure_url as string;
  }
  if (error && (await statusOf(error)) !== 501) throw new Error(await messageOf(error));
  return uploadToStorage(file, kind, owner);
}

async function uploadToStorage(file: File, kind: UploadKind, owner?: string) {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'png';
  const bucket = kind === 'avatar' ? 'avatars' : 'course-media';
  const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'image';
  const path = kind === 'avatar' ? `${owner}/avatar-${Date.now()}.${ext}` : `${kind}s/${Date.now()}-${base}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function statusOf(e: unknown) {
  return (e as { context?: Response }).context?.status;
}
async function messageOf(e: unknown) {
  try {
    const body = await (e as { context?: Response }).context?.json();
    if (body?.error) return String(body.error);
  } catch {
    /* not JSON */
  }
  return (e as Error).message;
}

/**
 * Rewrites a Cloudinary URL to deliver a resized, auto-format (WebP/AVIF), auto-quality image —
 * this matters on mobile data. Other URLs are returned unchanged.
 */
export function img(url: string | null | undefined, width?: number): string | undefined {
  if (!url) return undefined;
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!m) return url;
  const saver = dataSaverOn();
  const t = ['f_auto', saver ? 'q_auto:eco' : 'q_auto', width ? `c_limit,w_${Math.round(width * (saver ? 1 : Math.min(2, globalThis.devicePixelRatio || 1)))}` : null].filter(Boolean).join(',');
  return `${m[1]}${t}/${m[2]}`;
}
