// Staff account management for DBI Learn.
// Super admins can create admins, instructors and students; admins can create instructors and students.
// Runs with the service role, so every action re-checks the caller's role from the database.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { corsHeaders, json } from "../_shared/cors.ts";

type Role = "super_admin" | "admin" | "instructor" | "student";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Which roles each caller role may create or manage.
const MANAGEABLE: Record<Role, Role[]> = {
  super_admin: ["super_admin", "admin", "instructor", "student"],
  admin: ["instructor", "student"],
  instructor: [],
  student: [],
};

function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const core = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${core.slice(0, 4)}-${core.slice(4, 8)}-${core.slice(8)}!`;
}

async function audit(actor: string, action: string, targetId: string, details: Record<string, unknown>) {
  await admin.from("audit_logs").insert({ actor_id: actor, action, target_type: "user", target_id: targetId, details });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Not signed in" }, 401);
  const callerId = userData.user.id;

  const { data: caller } = await admin.from("profiles").select("role, status").eq("id", callerId).single();
  if (!caller || caller.status !== "active") return json({ error: "Not allowed" }, 403);
  const callerRole = caller.role as Role;
  const allowed = MANAGEABLE[callerRole] ?? [];
  if (allowed.length === 0) return json({ error: "Not allowed" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body.action ?? "");

  if (action === "create_user") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.full_name ?? "").trim();
    const role = String(body.role ?? "") as Role;
    const headline = body.headline ? String(body.headline).slice(0, 120) : null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (fullName.length < 2) return json({ error: "Enter the person's full name." }, 400);
    if (!allowed.includes(role)) return json({ error: `You cannot create ${role.replace("_", " ")} accounts.` }, 403);

    const password = typeof body.password === "string" && body.password.length >= 8 ? body.password : tempPassword();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created.user) {
      const msg = /already/i.test(error?.message ?? "") ? "An account with this email already exists." : error?.message;
      return json({ error: msg ?? "Could not create account" }, 400);
    }
    const id = created.user.id;
    await admin.from("profiles").update({ role, headline }).eq("id", id);
    await admin.from("profiles_private").update({ must_change_password: true }).eq("id", id);
    await admin.from("notifications").insert({
      user_id: id,
      kind: "account",
      title: `Welcome to the DBI Learn team`,
      body: `Your ${role.replace("_", " ")} account is ready. Please set a new password from Settings.`,
      link: "/app/settings",
    });
    await audit(callerId, "user.created", id, { email, role });
    return json({ user_id: id, email, role, temp_password: password });
  }

  if (action === "reset_password" || action === "delete_user") {
    const target = String(body.user_id ?? "");
    if (!target || target === callerId) return json({ error: "Choose another user." }, 400);
    const { data: t } = await admin.from("profiles").select("role").eq("id", target).single();
    if (!t) return json({ error: "User not found" }, 404);
    if (!allowed.includes(t.role as Role)) return json({ error: "You cannot manage this account." }, 403);

    if (action === "reset_password") {
      const password = tempPassword();
      const { error } = await admin.auth.admin.updateUserById(target, { password });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles_private").update({ must_change_password: true }).eq("id", target);
      await audit(callerId, "user.password_reset", target, {});
      return json({ user_id: target, temp_password: password });
    }

    if (callerRole !== "super_admin") return json({ error: "Only super admins can delete accounts." }, 403);
    const { error } = await admin.auth.admin.deleteUser(target);
    if (error) return json({ error: error.message }, 400);
    await audit(callerId, "user.deleted", target, { role: t.role });
    return json({ deleted: target });
  }

  return json({ error: "Unknown action" }, 400);
});
