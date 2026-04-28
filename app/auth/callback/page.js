"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../../lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.replace("/");
      });
    } else {
      supabase.auth.getSession().then(({ data }) => {
        router.replace("/");
      });
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid #EDECEA", borderTop: "2px solid #2D2D2B", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
