// app/api/audit/route.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  const { user_email, user_name, action, item_name, details } = await req.json();

  await supabase.from("audit_log").insert([{
    user_email,
    user_name,
    action,
    item_name,
    details
  }]);

  return Response.json({ ok: true });
}
