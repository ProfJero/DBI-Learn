// Sign in with a username + password without ever exposing users' email addresses to the browser.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { corsHeaders, json } from "../_shared/cors.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });

const INVALID = "Incorrect username or password.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let username = "";
  let password = "";
  try {
    const body = await req.json();
    username = String(body.username ?? "").trim().toLowerCase();
    password = String(body.password ?? "");
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!/^[a-z0-9_.]{3,30}$/.test(username) || !password) return json({ error: INVALID }, 400);

  const { data: profile } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (!profile) return json({ error: INVALID }, 400);
  const { data: priv } = await admin.from("profiles_private").select("email").eq("id", profile.id).maybeSingle();
  if (!priv?.email) return json({ error: INVALID }, 400);

  const { data, error } = await anon.auth.signInWithPassword({ email: priv.email, password });
  if (error || !data.session) return json({ error: INVALID }, 400);
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
