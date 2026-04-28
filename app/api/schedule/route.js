const supabaseUrl = "https://fyfahjuextamljhrkoeo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZmFoanVleHRhbWxqaHJrb2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTA1NjYsImV4cCI6MjA5MjY4NjU2Nn0.p-6f9_Xgb4pDG79GiuHBRyCqkNTXs7D_ReVKJHEeNgI";

export async function POST(request) {
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
      "Prefer": "return=representation",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[API /api/schedule] Supabase error:", err);
    return Response.json({ error: err.message ?? "Insert failed", code: err.code }, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data, { status: 201 });
}
