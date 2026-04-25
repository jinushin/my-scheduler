import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  supabaseUrl.startsWith("https://") && supabaseKey.length > 10;

let supabase = null;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn("[Supabase] 초기화 실패:", e.message);
  }
}

export default supabase;
