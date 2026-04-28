"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import supabase, { isSupabaseConfigured } from "../lib/supabase";

const PRIORITY_CONFIG = {
  urgent: { label: "긴급", color: "#E8543A", bg: "#FEF0EC", dot: "#E8543A" },
  high:   { label: "높음", color: "#7C5FF0", bg: "#F0ECFE", dot: "#7C5FF0" },
  medium: { label: "보통", color: "#2A9D8F", bg: "#E8F6F5", dot: "#2A9D8F" },
  low:    { label: "낮음", color: "#9CA3AF", bg: "#F3F4F6", dot: "#9CA3AF" },
};

const TAG_COLORS = {
  lecture: { bg: "#FEF3C7", color: "#92400E" },
  break:   { bg: "#F0FDF4", color: "#166534" },
  work:    { bg: "#EFF6FF", color: "#1E40AF" },
  meeting: { bg: "#F5F3FF", color: "#5B21B6" },
  study:   { bg: "#FFF7ED", color: "#9A3412" },
  health:  { bg: "#F0FDF4", color: "#166534" },
};

const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function pct(t) {
  const DAY_START = 8 * 60;
  const DAY_END   = 22 * 60;
  return Math.max(0, Math.min(100, ((timeToMinutes(t) - DAY_START) / (DAY_END - DAY_START)) * 100));
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();
}

function getWeekDays() {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return d;
  });
}

function getMonthGrid(year, month) {
  const first    = new Date(year, month, 1);
  const last     = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7;
  const cells    = Array(startDow).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const TODAY_STR  = toDateStr(new Date());
const EMPTY_FORM = { task_name: "", date: TODAY_STR, start_time: "09:00", end_time: "10:00", priority: "medium", repeat_type: "none", repeat_days: [], repeat_end: "" };

export default function ScheduleDashboard() {
  const [user, setUser]                 = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [events, setEvents]             = useState([]);
  const [eventsByDate, setEventsByDate] = useState({});
  const [dbLoading, setDbLoading]       = useState(true);
  const [input, setInput]               = useState("");
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiMsg, setAiMsg]               = useState("");
  const [selected, setSelected]         = useState(null);
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [formError, setFormError]       = useState("");
  const [view, setView]                 = useState("today");
  const [selectedDate, setSelectedDate] = useState(TODAY_STR);
  const _today = new Date();
  const [calYear, setCalYear]           = useState(_today.getFullYear());
  const [calMonth, setCalMonth]         = useState(_today.getMonth());

  const now           = getNow();
  const nowPct        = pct(`${String(Math.floor(now / 60)).padStart(2,"0")}:${String(now % 60).padStart(2,"0")}`);
  const completed     = events.filter(e => timeToMinutes(e.end_time) < now).length;
  const upcoming      = events.find(e => timeToMinutes(e.start_time) > now);
  const current       = events.find(e => timeToMinutes(e.start_time) <= now && timeToMinutes(e.end_time) > now);
  const completedPct  = events.length > 0 ? (completed / events.length) * 100 : 0;

  // ── Auth ──
  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthLoading(false); return; }

    const handleAuth = async () => {
      if (window.location.hash && window.location.hash.includes("access_token")) {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
          setUser(data.session.user);
          window.history.replaceState(null, "", window.location.pathname);
        }
        setAuthLoading(false);
      } else {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
        setAuthLoading(false);
      }
    };

    handleAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://my-scheduler-taupe.vercel.app/auth/callback" },
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setEvents([]);
    setEventsByDate({});
  }

  useEffect(() => { loadEventsForDate(selectedDate); }, [selectedDate, user]);

  useEffect(() => {
    if (view === "week") {
      const days = getWeekDays();
      loadEventsForRange(toDateStr(days[0]), toDateStr(days[6]));
    }
  }, [view, user]);

  useEffect(() => {
    if (view === "month") {
      loadEventsForRange(
        toDateStr(new Date(calYear, calMonth, 1)),
        toDateStr(new Date(calYear, calMonth + 1, 0))
      );
    }
  }, [view, calYear, calMonth, user]);

  async function loadEventsForDate(dateStr) {
    setDbLoading(true);
    if (!isSupabaseConfigured || !user) { setDbLoading(false); return; }
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("date", dateStr)
      .eq("user_id", user.id)
      .order("start_time", { ascending: true });
    if (error) console.error("[Supabase loadEventsForDate error]", error);
    if (!error && data) {
      setEvents(data);
      setEventsByDate(prev => ({ ...prev, [dateStr]: data }));
    }
    setDbLoading(false);
  }

  async function loadEventsForRange(startDate, endDate) {
    if (!isSupabaseConfigured || !user) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .eq("user_id", user.id)
      .order("start_time", { ascending: true });
    if (error) console.error("[Supabase loadEventsForRange error]", error);
    if (!error && data) {
      const byDate = {};
      data.forEach(row => {
        if (!byDate[row.date]) byDate[row.date] = [];
        byDate[row.date].push(row);
      });
      setEventsByDate(prev => ({ ...prev, ...byDate }));
    }
  }

  function getEventsForDay(date) {
    return eventsByDate[toDateStr(date)] || [];
  }

  function goToDay(date) {
    setSelectedDate(toDateStr(date));
    setView("today");
  }

  function openModal()  { setForm({ ...EMPTY_FORM, date: selectedDate }); setFormError(""); setShowModal(true); }
  function closeModal() { setShowModal(false); setFormError(""); }

  function generateDates(f) {
    if (f.repeat_type === "none" || !f.repeat_end) return [f.date];
    const start = new Date(f.date + "T00:00:00");
    const end   = new Date(f.repeat_end + "T00:00:00");
    const dates = [];
    if (f.repeat_type === "daily") {
      let cur = new Date(start);
      while (cur <= end && dates.length < 366) {
        dates.push(toDateStr(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else if (f.repeat_type === "weekly") {
      const jsDays = f.repeat_days.map(i => (i + 1) % 7);
      let cur = new Date(start);
      while (cur <= end && dates.length < 366) {
        if (jsDays.includes(cur.getDay())) dates.push(toDateStr(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else if (f.repeat_type === "monthly") {
      let cur = new Date(start);
      while (cur <= end && dates.length < 366) {
        dates.push(toDateStr(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    return dates;
  }

  async function handleAdd() {
    if (!form.task_name.trim()) { setFormError("일정 이름을 입력해주세요."); return; }
    if (timeToMinutes(form.end_time) <= timeToMinutes(form.start_time)) {
      setFormError("종료 시간은 시작 시간보다 늦어야 해요."); return;
    }
    if (form.repeat_type !== "none") {
      if (!form.repeat_end) { setFormError("반복 종료일을 설정해주세요."); return; }
      if (form.repeat_end < form.date) { setFormError("종료일은 시작일 이후여야 해요."); return; }
      if (form.repeat_type === "weekly" && form.repeat_days.length === 0) {
        setFormError("반복할 요일을 하나 이상 선택해주세요."); return;
      }
    }
    const dates = generateDates(form);
    if (dates.length > 365) { setFormError("반복 횟수가 너무 많아요. 종료일을 앞당겨주세요. (최대 365회)"); return; }
    const base = Date.now();
    const rows = dates.map((date, idx) => ({
      task_id:    `evt-${base}-${idx}`,
      task_name:  form.task_name.trim(),
      start_time: form.start_time,
      end_time:   form.end_time,
      priority:   form.priority,
      is_fixed:   false,
      tags:       [],
      notes:      "",
      date,
      user_id:    user?.id ?? null,
    }));
    let newEvents;
    if (isSupabaseConfigured) {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const payload = await res.json();
      if (!res.ok) {
        console.error("[POST /api/schedule error]", payload);
        setFormError("저장에 실패했어요. 다시 시도해주세요.");
        return;
      }
      newEvents = payload;
    } else {
      newEvents = rows;
    }
    const sort = (arr) => [...arr].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    setEvents(prev => sort([...prev, ...newEvents.filter(e => e.date === selectedDate)]));
    setEventsByDate(prev => {
      const next = { ...prev };
      newEvents.forEach(e => { next[e.date] = sort([...(next[e.date] || []), e]); });
      return next;
    });
    closeModal();
  }

  async function handleDelete(taskId) {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from("tasks").delete().eq("task_id", taskId);
      if (error) console.error("[Supabase handleDelete error]", error);
    }
    setEvents(prev => prev.filter(e => e.task_id !== taskId));
    setEventsByDate(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(d => { next[d] = next[d].filter(e => e.task_id !== taskId); });
      return next;
    });
    if (selected === taskId) setSelected(null);
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  function onDragEnd(result) {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(events);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setEvents(reordered);
  }

  async function handleAI() {
    if (!input.trim()) return;
    setAiLoading(true); setAiMsg("");
    await new Promise(r => setTimeout(r, 1400));
    setAiMsg(`"${input}" 일정을 분석했어요. 오후 5시 이후 빈 슬롯에 배치했어요.`);
    setAiLoading(false); setInput("");
  }

  // ── 로그인 화면 ──
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid #EDECEA", borderTop: "2px solid #2D2D2B", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', 'Pretendard', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');
          * { box-sizing: border-box; } body { margin: 0; }
          @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
          @keyframes spin { to { transform: rotate(360deg); } }
          .login-btn { transition: all 0.15s; cursor: pointer; }
          .login-btn:hover { background: #3A3A38 !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
          .login-btn:active { transform: scale(0.97); }
        `}</style>
        <div style={{ animation: "fadeIn 0.4s ease", textAlign: "center", padding: "48px 32px", background: "#FFFFFF", borderRadius: 24, border: "1px solid #EDECEA", boxShadow: "0 8px 40px rgba(0,0,0,0.08)", maxWidth: 400, width: "90vw" }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#2D2D2B", marginBottom: 8 }}>
            오늘의 스케줄
          </div>
          <div style={{ fontSize: 14, color: "#B0AFA8", marginBottom: 36, lineHeight: 1.6 }}>
            구글 계정으로 로그인하고<br />나만의 일정을 관리해보세요
          </div>
          <button className="login-btn" onClick={handleGoogleLogin} style={{
            width: "100%", padding: "14px 20px", borderRadius: 12, border: "none",
            background: "#2D2D2B", color: "#FAFAF8", fontSize: 15, fontWeight: 600,
            fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Google로 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", fontFamily: "'DM Sans', 'Pretendard', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        button, input, textarea, select { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .event-row { transition: all 0.18s ease; cursor: pointer; }
        .event-row:hover { background: #F5F4F0 !important; transform: translateX(2px); }
        .event-row.selected { background: #F0EFEB !important; }
        .ai-input { outline: none; border: none; background: transparent; width: 100%; font-family: inherit; font-size: 14px; color: #2D2D2B; }
        .ai-input::placeholder { color: #B0AFA8; }
        .send-btn { transition: all 0.15s; cursor: pointer; }
        .send-btn:hover { background: #2D2D2B !important; color: #FAFAF8 !important; }
        .send-btn:active { transform: scale(0.95); }
        .tag-pill { display: inline-block; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 999px; }
        .timeline-thumb { transition: all 0.3s ease; }
        .pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.15)} }
        .fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease; }
        .modal-box { background:#FAFAF8;border-radius:20px;padding:28px;width:420px;max-width:92vw;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 20px 60px rgba(0,0,0,0.18);animation:fadeIn 0.25s ease; }
        .repeat-btn { padding:7px 13px;border-radius:8px;border:1.5px solid #EDECEA;background:transparent;color:#4A4A48;font-size:13px;font-family:inherit;cursor:pointer;transition:all 0.15s; }
        .repeat-btn.active { border-color:#7C5FF0;background:#F0ECFE;color:#7C5FF0;font-weight:600; }
        .repeat-btn:hover:not(.active) { border-color:#C0BEB8; }
        .day-btn { width:38px;height:38px;border-radius:50%;border:1.5px solid #EDECEA;background:transparent;color:#4A4A48;font-size:13px;font-weight:500;font-family:inherit;cursor:pointer;transition:all 0.15s; }
        .day-btn.active { border-color:#7C5FF0;background:#7C5FF0;color:#FAFAF8; }
        .day-btn:hover:not(.active) { border-color:#C0BEB8; }
        .field-label { font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px; }
        .field-input { width:100%;padding:10px 12px;border:1.5px solid #EDECEA;border-radius:10px;font-size:14px;font-family:inherit;color:#2D2D2B;background:#FFFFFF;outline:none;transition:border-color 0.15s; }
        .field-input:focus { border-color:#7C5FF0; }
        .delete-btn { opacity:0;transition:opacity 0.15s,color 0.15s;background:none;border:none;cursor:pointer;color:#C0BEB8;font-size:18px;padding:4px 6px;line-height:1;flex-shrink:0; }
        .event-row:hover .delete-btn { opacity:1; }
        .delete-btn:hover { color:#E8543A !important; }
        .add-btn { transition:all 0.15s;cursor:pointer; }
        .add-btn:hover { background:#4A4A48 !important; }
        .add-btn:active { transform:scale(0.93); }
        .priority-radio { display:flex;gap:8px;flex-wrap:wrap; }
        .priority-radio label { display:flex;align-items:center;gap:6px;padding:6px 12px;border:1.5px solid #EDECEA;border-radius:8px;cursor:pointer;font-size:13px;color:#4A4A48;transition:all 0.15s; }
        .priority-radio label:hover { border-color:#C0BEB8; }
        .priority-radio input { display:none; }
        .priority-radio input:checked + span { font-weight:600; }
        .drag-handle { opacity:0;transition:opacity 0.15s;color:#C0BEB8;cursor:grab;display:flex;align-items:center;padding:0 8px 0 0;font-size:14px;flex-shrink:0;user-select:none; }
        .drag-handle:active { cursor:grabbing; }
        .event-row:hover .drag-handle { opacity:1; }
        .drag-fixed-icon { color:#DDDCDA;padding:0 8px 0 0;font-size:12px;flex-shrink:0;display:flex;align-items:center; }
        .event-row.dragging { background:#F0EFEB !important;box-shadow:0 8px 24px rgba(0,0,0,0.10);border-radius:10px; }
        .tab-btn { transition:all 0.2s ease;cursor:pointer; }
        .view-enter { animation:viewEnter 0.3s ease; }
        @keyframes viewEnter { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .week-col { border-radius:16px;padding:16px 12px;min-height:160px;transition:box-shadow 0.2s,transform 0.15s;cursor:pointer; }
        .week-col:hover { box-shadow:0 4px 16px rgba(0,0,0,0.10);transform:translateY(-2px); }
        .month-cell { border-radius:12px;padding:10px;min-height:88px;transition:box-shadow 0.15s;cursor:pointer; }
        .month-cell:hover { box-shadow:0 2px 10px rgba(0,0,0,0.09); }
        .cal-nav-btn { background:none;border:1.5px solid #EDECEA;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:16px;color:#4A4A48;transition:all 0.15s; }
        .cal-nav-btn:hover { background:#F0EFEB;border-color:#C0BEB8; }
        .db-badge { display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#9CA3AF;padding:3px 10px;border-radius:999px;border:1px solid #3A3A38; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .spinner { width:11px;height:11px;border:1.5px solid #4A4A48;border-top-color:#9CA3AF;border-radius:50%;animation:spin 0.7s linear infinite; }
        .empty-state { text-align:center;padding:48px 0;color:#B0AFA8;font-size:14px; }
        .logout-btn { transition:all 0.15s;cursor:pointer; }
        .logout-btn:hover { background:#3A3A38 !important; }

        .header-wrap { background:#2D2D2B;padding:28px 32px 24px;display:flex;align-items:flex-end;justify-content:space-between; }
        .header-title { font-family:'DM Serif Display',serif;font-size:28px;color:#FAFAF8;letter-spacing:-0.5px;line-height:1.2; }
        .header-meta { font-size:13px;color:#9CA3AF;margin-top:4px;display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
        .header-stats { display:flex;gap:20px;align-items:flex-end; }
        .header-stat-val { font-size:22px;font-weight:600;color:#FAFAF8;line-height:1; }
        .tabs-wrap { max-width:1100px;margin:0 auto;padding:20px 24px 0; }
        .tabs-bar { display:flex;gap:2px;background:#EDECEA;border-radius:10px;padding:3px;width:fit-content; }
        .today-grid { display:grid;grid-template-columns:1fr 340px;gap:0;max-width:1100px;margin:0 auto;padding:24px; }
        .today-left { padding-right:24px; }
        .today-right { display:flex;flex-direction:column;gap:16px; }
        .timeline-labels { display:flex;justify-content:space-between;font-size:10px;color:#C0BEB8;margin-bottom:6px; }
        .event-time-col { width:80px;flex-shrink:0;padding-right:14px; }
        .week-scroll { width:100%; }
        .week-grid-inner { display:grid;grid-template-columns:repeat(7,1fr);gap:8px; }

        @media (max-width: 640px) {
          .header-wrap { padding:18px 16px 16px;flex-wrap:wrap;gap:12px;align-items:flex-start; }
          .header-title { font-size:22px !important; }
          .header-meta { font-size:12px;gap:6px; }
          .header-stats { gap:14px;flex-wrap:wrap; }
          .header-stat-val { font-size:18px !important; }
          .tabs-wrap { padding:14px 16px 0 !important; }
          .tabs-bar { width:100% !important; }
          .tab-btn { flex:1 !important;padding:8px 4px !important;font-size:13px !important;text-align:center; }
          .today-grid { grid-template-columns:1fr !important;padding:16px !important;gap:20px !important; }
          .today-left { padding-right:0 !important; }
          .timeline-labels span:nth-child(2),
          .timeline-labels span:nth-child(4),
          .timeline-labels span:nth-child(6) { display:none; }
          .event-time-col { width:62px !important;padding-right:10px !important; }
          .delete-btn { opacity:1 !important;font-size:20px !important; }
          .drag-handle { opacity:0.35 !important; }
          .week-scroll { overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px; }
          .week-grid-inner { min-width:560px; }
          .week-col { min-height:120px !important;padding:10px 8px !important; }
          .month-cell { min-height:58px !important;padding:6px 4px !important; }
          .modal-overlay { align-items:flex-end !important; }
          .modal-box { width:100% !important;max-width:100vw !important;border-radius:20px 20px 0 0 !important;padding:24px 20px 36px !important; }
          .db-badge { display:none !important; }
          .empty-state { padding:32px 0; }
        }

        @media (max-width: 400px) {
          .header-title { font-size:20px !important; }
          .header-stats { gap:10px; }
          .header-stat-val { font-size:16px !important; }
          .event-time-col { width:56px !important;padding-right:8px !important; }
          .month-cell { min-height:48px !important;padding:4px 2px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="header-wrap">
        <div>
          <div className="header-title">
            {selectedDate === TODAY_STR ? "오늘의 스케줄" : "일간 스케줄"}
          </div>
          <div className="header-meta">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
            {selectedDate !== TODAY_STR && (
              <button onClick={() => setSelectedDate(TODAY_STR)} style={{ background: "#3A3A38", border: "none", borderRadius: 6, color: "#B0AFA8", fontSize: 11, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                ← 오늘로
              </button>
            )}
            <span className="db-badge">
              {!isSupabaseConfigured
                ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8543A", display: "inline-block" }} />
                : dbLoading
                  ? <span className="spinner" />
                  : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
              }
              {isSupabaseConfigured ? "Supabase" : "DB 미연결"}
            </span>
          </div>
        </div>
        <div className="header-stats">
          {[
            { label: "전체", val: events.length },
            { label: "완료", val: completed },
            { label: "남음", val: events.length - completed },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "right" }}>
              <div className="header-stat-val">{s.val}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
          <button className="add-btn" onClick={openModal} style={{
            width: 38, height: 38, borderRadius: "50%", border: "none",
            background: "#3A3A38", color: "#FAFAF8", fontSize: 22, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4,
          }}>+</button>
          {/* 사용자 아바타 + 로그아웃 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            {user.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="avatar"
                style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #4A4A48", objectFit: "cover" }} />
            )}
            <button className="logout-btn" onClick={handleLogout} style={{
              background: "#3A3A38", border: "none", borderRadius: 8,
              color: "#9CA3AF", fontSize: 11, padding: "6px 10px",
              fontFamily: "inherit", cursor: "pointer",
            }}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#EDECEA" }}>
        <div style={{ height: "100%", width: `${completedPct}%`, background: "linear-gradient(90deg, #7C5FF0, #E8543A)", transition: "width 0.6s ease" }} />
      </div>

      {/* Tabs */}
      <div className="tabs-wrap">
        <div className="tabs-bar">
          {[["today","오늘"], ["week","주간"], ["month","월간"]].map(([v, label]) => (
            <button key={v} className="tab-btn" onClick={() => setView(v)} style={{
              padding: "7px 20px", borderRadius: 8, border: "none",
              background: view === v ? "#2D2D2B" : "transparent",
              color: view === v ? "#FAFAF8" : "#9CA3AF",
              fontSize: 13, fontWeight: view === v ? 600 : 400, fontFamily: "inherit",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Today View ── */}
      {view === "today" && (
        <div className="view-enter today-grid">
          <div className="today-left">
            {!dbLoading && selectedDate === TODAY_STR && (current || upcoming) && (
              <div className="fade-in" style={{ marginBottom: 20, padding: "16px 20px", background: current ? "#2D2D2B" : "#F5F4F0", borderRadius: 14, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: current ? "#4ADE80" : "#9CA3AF", flexShrink: 0 }} className={current ? "pulse" : ""} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: current ? "#9CA3AF" : "#B0AFA8", marginBottom: 3 }}>{current ? "지금 진행 중" : "다음 일정"}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: current ? "#FAFAF8" : "#2D2D2B" }}>{(current || upcoming).task_name}</div>
                </div>
                <div style={{ fontSize: 13, color: current ? "#9CA3AF" : "#B0AFA8", fontVariantNumeric: "tabular-nums" }}>
                  {(current || upcoming).start_time} – {(current || upcoming).end_time}
                </div>
              </div>
            )}

            {!dbLoading && events.length > 0 && (
              <div style={{ marginBottom: 20, position: "relative" }}>
                <div className="timeline-labels">
                  {["08:00","10:00","12:00","14:00","16:00","18:00","20:00","22:00"].map(h => <span key={h}>{h}</span>)}
                </div>
                <div style={{ height: 6, background: "#EDECEA", borderRadius: 3, position: "relative", overflow: "visible" }}>
                  {events.map(e => {
                    const cfg = PRIORITY_CONFIG[e.priority];
                    return (
                      <div key={e.task_id} title={e.task_name} style={{
                        position: "absolute", top: 0, height: "100%",
                        left: `${pct(e.start_time)}%`, width: `${pct(e.end_time) - pct(e.start_time)}%`,
                        background: cfg.color, borderRadius: 2, opacity: 0.75, cursor: "pointer",
                      }} onClick={() => setSelected(e.task_id === selected ? null : e.task_id)} />
                    );
                  })}
                  {selectedDate === TODAY_STR && (
                    <div className="timeline-thumb" style={{ position: "absolute", top: -4, left: `${nowPct}%`, width: 2, height: 14, background: "#E8543A", borderRadius: 1, transform: "translateX(-50%)" }}>
                      <div style={{ width: 6, height: 6, background: "#E8543A", borderRadius: "50%", position: "absolute", top: -3, left: -2 }} className="pulse" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {dbLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[90, 75, 85, 70, 80].map((w, i) => (
                  <div key={i} style={{ height: 54, borderRadius: 10, background: "#F0EFEB", width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
                ))}
              </div>
            )}

            {!dbLoading && events.length === 0 && (
              <div className="empty-state">
                일정이 없어요.<br />
                <span style={{ fontSize: 12, color: "#C0BEB8" }}>+ 버튼을 눌러 추가해보세요.</span>
              </div>
            )}

            {!dbLoading && events.length > 0 && (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="schedule-list">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {events.map((e, i) => {
                        const cfg      = PRIORITY_CONFIG[e.priority];
                        const isDone   = timeToMinutes(e.end_time) < now;
                        const isActive = timeToMinutes(e.start_time) <= now && !isDone;
                        const isSel    = selected === e.task_id;
                        return (
                          <Draggable key={e.task_id} draggableId={e.task_id} index={i} isDragDisabled={e.is_fixed}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`event-row${isSel ? " selected" : ""}${snapshot.isDragging ? " dragging" : ""}`}
                                onClick={() => setSelected(isSel ? null : e.task_id)}
                                style={{
                                  display: "flex", alignItems: "stretch", borderRadius: 10, padding: "10px 12px",
                                  background: snapshot.isDragging ? "#F0EFEB" : isSel ? "#F0EFEB" : "transparent",
                                  opacity: isDone ? 0.45 : 1,
                                  ...provided.draggableProps.style,
                                }}
                              >
                                {e.is_fixed
                                  ? <div className="drag-fixed-icon">🔒</div>
                                  : <div className="drag-handle" {...provided.dragHandleProps} onClick={ev => ev.stopPropagation()}>⠿</div>
                                }
                                <div className="event-time-col">
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#2D2D2B", fontVariantNumeric: "tabular-nums" }}>{e.start_time}</div>
                                  <div style={{ fontSize: 11, color: "#B0AFA8", marginTop: 1 }}>{e.end_time}</div>
                                </div>
                                <div style={{ width: 3, borderRadius: 2, background: isDone ? "#DDDCDA" : cfg.color, opacity: isDone ? 0.5 : 1, flexShrink: 0, marginRight: 12, alignSelf: "stretch" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 500, color: isDone ? "#B0AFA8" : "#2D2D2B" }}>
                                      {isDone ? "✓ " : ""}{e.task_name}
                                    </span>
                                    {e.is_fixed && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>고정</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                                    {(e.tags || []).map(t => {
                                      const tc = TAG_COLORS[t] || { bg: "#F3F4F6", color: "#6B7280" };
                                      return <span key={t} className="tag-pill" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
                                    })}
                                    <span style={{ fontSize: 11, color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
                                  </div>
                                  {isSel && e.notes && (
                                    <div className="fade-in" style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF", padding: "6px 10px", background: "#F5F4F0", borderRadius: 6 }}>
                                      {e.notes}
                                    </div>
                                  )}
                                </div>
                                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, paddingLeft: 8 }}>
                                  <div style={{ fontSize: 11, color: "#C0BEB8", marginTop: 2, whiteSpace: "nowrap" }}>
                                    {timeToMinutes(e.end_time) - timeToMinutes(e.start_time)}분
                                  </div>
                                  {!e.is_fixed && (
                                    <button className="delete-btn" onClick={ev => { ev.stopPropagation(); handleDelete(e.task_id); }} title="삭제">×</button>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>

          {/* Right Panel */}
          <div className="today-right">
            <div style={{ background: "#2D2D2B", borderRadius: 16, padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80" }} className="pulse" />
                <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>AI 일정 조정</span>
              </div>
              <div style={{ background: "#3A3A38", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                <textarea className="ai-input" value={input} onChange={e => setInput(e.target.value)}
                  placeholder={"\"내일 오후 2시에 도서관 공부 2시간 추가해줘\"\n\"오늘 회의를 30분 당겨줘\""}
                  rows={3} style={{ resize: "none", lineHeight: 1.6, color: "#FAFAF8" }}
                  onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleAI(); }} />
              </div>
              <button className="send-btn" onClick={handleAI} disabled={aiLoading}
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #4A4A48", background: "transparent", color: "#FAFAF8", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>
                {aiLoading ? "분석 중..." : "⌘↵ 일정 조정 요청"}
              </button>
              {aiMsg && (
                <div className="fade-in" style={{ marginTop: 10, fontSize: 12, color: "#9CA3AF", lineHeight: 1.6, padding: "8px 12px", background: "#3A3A38", borderRadius: 8 }}>
                  {aiMsg}
                </div>
              )}
            </div>

            <div style={{ background: "#FFFFFF", border: "1px solid #EDECEA", borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#B0AFA8", marginBottom: 14 }}>우선순위 분포</div>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => {
                const cnt = events.filter(e => e.priority === key).length;
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13, color: "#4A4A48" }}>{cfg.label}</div>
                    <div style={{ flex: 2, height: 4, background: "#F3F4F6", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: events.length > 0 ? `${(cnt / events.length) * 100}%` : "0%", background: cfg.color, borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", width: 20, textAlign: "right" }}>{cnt}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "총 일정 시간", val: `${events.reduce((a,e) => a + timeToMinutes(e.end_time) - timeToMinutes(e.start_time), 0)}분` },
                { label: "완료율",       val: `${events.length > 0 ? Math.round(completedPct) : 0}%` },
                { label: "고정 일정",    val: `${events.filter(e => e.is_fixed).length}개` },
                { label: "남은 일정",    val: `${events.length - completed}개` },
              ].map(s => (
                <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #EDECEA", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#B0AFA8", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#2D2D2B" }}>{s.val}</div>
                </div>
              ))}
            </div>

            {events.some(e => e.is_fixed) && (
              <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 14 }}>🔒</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 2 }}>고정 일정 보호 중</div>
                  <div style={{ fontSize: 11, color: "#B45309", lineHeight: 1.5 }}>
                    {events.filter(e => e.is_fixed).map(e => e.task_name).join(", ")} 은(는) AI가 절대 수정하지 않아요.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Week View ── */}
      {view === "week" && (
        <div className="view-enter" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
          <div className="week-scroll">
            <div className="week-grid-inner">
              {getWeekDays().map((day, i) => {
                const dateStr   = toDateStr(day);
                const isToday   = isSameDay(day, new Date());
                const isSel     = dateStr === selectedDate;
                const isDark    = isToday || isSel;
                const dayEvents = getEventsForDay(day);
                return (
                  <div key={i} className="week-col" onClick={() => goToDay(day)} style={{
                    background: isDark ? "#2D2D2B" : "#FFFFFF",
                    border: `1px solid ${isDark ? "transparent" : "#EDECEA"}`,
                    outline: isSel && !isToday ? "2px solid #7C5FF0" : "none",
                    outlineOffset: -1,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#9CA3AF" : "#B0AFA8", letterSpacing: "0.04em" }}>{DAY_NAMES[i]}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isDark ? "#FAFAF8" : "#2D2D2B", marginTop: 2, marginBottom: 14, lineHeight: 1 }}>{day.getDate()}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {dayEvents.map(e => {
                        const cfg = PRIORITY_CONFIG[e.priority];
                        return (
                          <div key={e.task_id} style={{
                            fontSize: 11, padding: "4px 8px", borderRadius: 6, lineHeight: 1.4,
                            background: isDark ? "#3A3A38" : cfg.bg,
                            color: isDark ? "#E8E8E4" : cfg.color,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            <span style={{ opacity: 0.7 }}>{e.start_time}</span> {e.task_name}
                          </div>
                        );
                      })}
                      {dayEvents.length === 0 && (
                        <div style={{ fontSize: 12, color: isDark ? "#4A4A48" : "#DDDCDA" }}>—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Month View ── */}
      {view === "month" && (
        <div className="view-enter" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button className="cal-nav-btn" onClick={prevMonth}>←</button>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#2D2D2B" }}>
              {calYear}년 {calMonth + 1}월
            </div>
            <button className="cal-nav-btn" onClick={nextMonth}>→</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#B0AFA8", padding: "6px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {getMonthGrid(calYear, calMonth).map((week, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {week.map((day, di) => {
                  if (!day) return <div key={di} style={{ borderRadius: 12, background: "#F5F4F0", minHeight: 88 }} />;
                  const dateStr   = toDateStr(day);
                  const isToday   = isSameDay(day, new Date());
                  const isSel     = dateStr === selectedDate;
                  const isDark    = isToday || isSel;
                  const dayEvents = getEventsForDay(day);
                  return (
                    <div key={di} className="month-cell" onClick={() => goToDay(day)} style={{
                      background: isDark ? "#2D2D2B" : "#FFFFFF",
                      border: `1px solid ${isDark ? "transparent" : "#EDECEA"}`,
                      outline: isSel && !isToday ? "2px solid #7C5FF0" : "none",
                      outlineOffset: -1,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1, color: isDark ? "#FAFAF8" : "#2D2D2B", marginBottom: 6 }}>{day.getDate()}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {dayEvents.slice(0, 3).map(e => {
                          const cfg = PRIORITY_CONFIG[e.priority];
                          return (
                            <div key={e.task_id} style={{
                              fontSize: 10, padding: "2px 5px", borderRadius: 4, lineHeight: 1.5,
                              background: isDark ? "#3A3A38" : cfg.bg,
                              color: isDark ? "#E8E8E4" : cfg.color,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>{e.task_name}</div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div style={{ fontSize: 10, color: isDark ? "#9CA3AF" : "#B0AFA8", paddingLeft: 2 }}>+{dayEvents.length - 3}개</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#2D2D2B" }}>새 일정 추가</div>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: "#B0AFA8", lineHeight: 1, padding: "4px 8px" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div className="field-label">일정 이름</div>
                <input className="field-input" placeholder="예) 알고리즘 스터디" value={form.task_name}
                  onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }} autoFocus />
              </div>
              <div>
                <div className="field-label">날짜</div>
                <input className="field-input" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="field-label">시작 시간</div>
                  <input className="field-input" type="time" value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <div className="field-label">종료 시간</div>
                  <input className="field-input" type="time" value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <div className="field-label">우선순위</div>
                <div className="priority-radio">
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <label key={key} style={{ borderColor: form.priority === key ? cfg.color : undefined, background: form.priority === key ? cfg.bg : undefined }}>
                      <input type="radio" name="priority" value={key} checked={form.priority === key}
                        onChange={() => setForm(f => ({ ...f, priority: key }))} />
                      <span style={{ color: form.priority === key ? cfg.color : undefined }}>{cfg.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="field-label">반복</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["none","반복 안함"], ["daily","매일"], ["weekly","매주"], ["monthly","매월"]].map(([v, label]) => (
                    <button key={v} type="button"
                      className={`repeat-btn${form.repeat_type === v ? " active" : ""}`}
                      onClick={() => setForm(f => ({ ...f, repeat_type: v, repeat_days: [], repeat_end: v === "none" ? "" : f.repeat_end }))}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {form.repeat_type === "weekly" && (
                <div className="fade-in">
                  <div className="field-label">반복 요일</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {DAY_NAMES.map((d, i) => (
                      <button key={i} type="button"
                        className={`day-btn${form.repeat_days.includes(i) ? " active" : ""}`}
                        onClick={() => {
                          const days = form.repeat_days.includes(i)
                            ? form.repeat_days.filter(x => x !== i)
                            : [...form.repeat_days, i];
                          setForm(f => ({ ...f, repeat_days: days }));
                        }}>{d}</button>
                    ))}
                  </div>
                </div>
              )}

              {form.repeat_type !== "none" && (
                <div className="fade-in">
                  <div className="field-label">반복 종료일</div>
                  <input className="field-input" type="date" value={form.repeat_end}
                    min={form.date}
                    onChange={e => setForm(f => ({ ...f, repeat_end: e.target.value }))} />
                  {form.repeat_end && (() => {
                    const cnt = generateDates(form).length;
                    return cnt > 0 ? (
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>
                        총 <strong style={{ color: "#7C5FF0" }}>{cnt}개</strong> 일정이 생성돼요
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {formError && (
                <div style={{ fontSize: 12, color: "#E8543A", padding: "8px 12px", background: "#FEF0EC", borderRadius: 8 }}>{formError}</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={closeModal} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #EDECEA", background: "transparent", fontSize: 14, fontFamily: "inherit", color: "#9CA3AF", cursor: "pointer" }}>
                  취소
                </button>
                <button onClick={handleAdd} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "#2D2D2B", color: "#FAFAF8", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  {form.repeat_type !== "none" && form.repeat_end ? `반복 추가 (${generateDates(form).length}개)` : "추가하기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
