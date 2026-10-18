// Signs Cloudinary uploads for DBI Learn so the API secret never reaches the browser.
// Learners may upload only their own avatar; staff may upload course covers, lesson images and signatures.
// Secrets: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Without them it answers 501
// and the app falls back to Supabase Storage.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { corsHeaders, json } from "../_shared/cors.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

const STAFF_KINDS = ["cover", "lesson", "signature", "resource"] as const;
type Kind = "avatar" | (typeof STAFF_KINDS)[number];

async function sha1Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!cloudName || !apiKey || !apiSecret) return json({ error: "Cloudinary is not configured" }, 501);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!userData.user) return json({ error: "Not signed in" }, 401);
  const uid = userData.user.id;

  const { data: profile } = await admin.from("profiles").select("role, status").eq("id", uid).single();
  if (!profile || profile.status !== "active") return json({ error: "Not allowed" }, 403);

  let body: { kind?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const kind = String(body.kind ?? "") as Kind;
  const isStaff = ["super_admin", "admin", "instructor"].includes(profile.role);
  if (kind !== "avatar" && !(STAFF_KINDS as readonly string[]).includes(kind)) return json({ error: "Unknown upload kind" }, 400);
  if (kind !== "avatar" && !isStaff) return json({ error: "Only staff can upload course media" }, 403);

  // Every signed parameter is fixed here, so a signature cannot be reused for another folder or file type.
  const params: Record<string, string> = {
    allowed_formats: kind === "signature" ? "png,webp,svg" : "jpg,jpeg,png,webp,gif",
    folder: kind === "avatar" ? `dbi-learn/avatars/${uid}` : `dbi-learn/${kind}s`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const signature = await sha1Hex(toSign + apiSecret);
  return json({ cloud_name: cloudName, api_key: apiKey, signature, ...params });
});
