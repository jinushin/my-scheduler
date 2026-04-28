import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fyfahjuextamljhrkoeo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZmFoanVleHRhbWxqaHJrb2VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTA1NjYsImV4cCI6MjA5MjY4NjU2Nn0.p-6f9_Xgb4pDG79GiuHBRyCqkNTXs7D_ReVKJHEeNgI";

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    flowType: "implicit",
  },
});

export default supabase;
