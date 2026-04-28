import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(request) {
  if (!supabaseUrl.startsWith("https://") || supabaseKey.length <= 10) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let rows;
  try {
    rows = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "rows must be a non-empty array" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from("tasks").insert(rows).select();

  if (error) {
    console.error("[API /api/schedule] Supabase error:", error);
    return Response.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
