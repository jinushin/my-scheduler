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

  const res = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[API /api/schedule] Supabase error:", err);
    return Response.json({ error: err.message ?? "Insert failed", code: err.code }, { status: res.status });
  }

  return Response.json(rows, { status: 201 });
}
