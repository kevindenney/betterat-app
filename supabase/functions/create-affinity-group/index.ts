import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SELF_SERVE_KINDS = new Set(["crew_pod", "practice_group"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server is not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    name?: string;
    kind?: string;
    description?: string | null;
    interestSlug?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const name = String(body.name ?? "").trim();
  const kind = String(body.kind ?? "");
  const description = String(body.description ?? "").trim();
  const interestSlug = String(body.interestSlug ?? "").trim();

  if (name.length < 2) {
    return json({ error: "Give the group a name of at least 2 characters." }, 400);
  }
  if (!SELF_SERVE_KINDS.has(kind)) {
    return json({ error: "This kind of group cannot be self-created." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: group, error: groupError } = await admin
    .from("affinity_groups")
    .insert({
      name,
      kind,
      description: description || null,
      interest_slug: interestSlug || null,
      is_active: true,
    })
    .select("id, name")
    .single();

  if (groupError || !group?.id) {
    return json({ error: groupError?.message ?? "Could not create group" }, 500);
  }

  const { error: memberError } = await admin.from("affinity_group_members").insert({
    group_id: group.id,
    user_id: authData.user.id,
    role: "member",
    status: "active",
  });

  if (memberError) {
    return json({ error: memberError.message }, 500);
  }

  return json({ id: group.id, name: group.name }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
