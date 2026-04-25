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
  // "YYYY-MM-DD" in local time
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
const EMPTY_FORM = { task_name: "", date: TODAY_STR, start_time: "09:00", end_time: "10:00", priority: "medium" };

export default function ScheduleDashboard() {
  const [events, setEvents]           = useState([]);
  const [eventsByDate, setEventsByDate] = useState({});
  const [dbLoading, setDbLoading]     = useState(true);
  const [input, setInput]             = useState("");
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiMsg, setAiMsg]             = useState("");
  const [selected, setSelected]       = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formError, setFormError]     = useState("");
  const [view, setView]               = useState("today");
  const [selectedDate, setSelectedDate] = useState(TODAY_STR);
  const _today = new Date();
  const [calYear, setCalYear]         = useState(_today.getFullYear());
  const [calMonth, setCalMonth]       = useState(_today.getMonth());

  const now      = getNow();
  const nowPct   = pct(`${String(Math.floor(now / 60)).padStart(2,"0")}:${String(now % 60).padStart(2,"0")}`);
  const completed = events.filter(e => timeToMinutes(e.end_time) < now).length;
  const upcoming  = events.find(e => timeToMinutes(e.start_time) > now);
  const current   = events.find(e => timeToMinutes(e.start_time) <= now && timeToMinutes(e.end_time) > now);
  const completedPct = events.length > 0 ? (completed / events.length) * 100 : 0;

  // ── DB load ──────────────────────────────────────────────
  useEffect(() => { loadEventsForDate(selectedDate); }, [selectedDate]);

  useEffect(() => {
    if (view === "week") {
      const days = getWeekDays();
      loadEventsForRange(toDateStr(days[0]), toDateStr(days[6]));
    }
  }, [view]);

  useEffect(() => {
    if (view === "month") {
      loadEventsForRange(
        toDateStr(new Date(calYear, calMonth, 1)),
        toDateStr(new Date(calYear, calMonth + 1, 0))
      );
    }
  }, [view, calYear, calMonth]);

  async function loadEventsForDate(dateStr) {
    setDbLoading(true);
    if (!isSupabaseConfigured) { setDbLoading(false); return; }
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("date", dateStr)
      .order("start_time", { ascending: true });
    if (!error && data) {
      setEvents(data);
      setEventsByDate(prev => ({ ...prev, [dateStr]: data }));
    }
    setDbLoading(false);
  }

  async function loadEventsForRange(startDate, endDate) {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("start_time", { ascending: true });
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

  // ── Navigation ───────────────────────────────────────────
  function goToDay(date) {
    setSelectedDate(toDateStr(date));
    setView("today");
  }

  // ── CRUD ─────────────────────────────────────────────────
  function openModal()  { setForm({ ...EMPTY_FORM, date: selectedDate }); setFormError(""); setShowModal(true); }
  function closeModal() { setShowModal(false); setFormError(""); }

  async function handleAdd() {
    if (!form.task_name.trim()) { setFormError("일정 이름을 입력해주세요."); return; }
    if (timeToMinutes(form.end_time) <= timeToMinutes(form.start_time)) {
      setFormError("종료 시간은 시작 시간보다 늦어야 해요."); return;
    }
    const newEvent = {
      task_id:    `evt-${Date.now()}`,
      task_name:  form.task_name.trim(),
      start_time: form.start_time,
      end_time:   form.end_time,
      priority:   form.priority,
      is_fixed:   false,
      tags:       [],
      notes:      "",
      date:       form.date,
    };
    if (isSupabaseConfigured) {
      const { error } = await supabase.from("tasks").insert(newEvent);
      if (error) { setFormError("저장에 실패했어요. 다시 시도해주세요."); return; }
    }
    const sort = (arr) => [...arr].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    if (form.date === selectedDate) setEvents(prev => sort([...prev, newEvent]));
    setEventsByDate(prev => ({ ...prev, [form.date]: sort([...(prev[form.date] || []), newEvent]) }));
    closeModal();
  }

  async function handleDelete(taskId) {
    if (isSupabaseConfigured) await supabase.from("tasks").delete().eq("task_id", taskId);
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

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", fontFamily: "'DM Sans', 'Pretendard', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
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
        .modal-box { background:#FAFAF8;border-radius:20px;padding:28px;width:420px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.18);animation:fadeIn 0.25s ease; }
        .field-label { font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px; }
        .field-input { width:100%;padding:10px 12px;border:1.5px solid #EDECEA;border-radius:10px;font-size:14px;font-family:inherit;color:#2D2D2B;background:#FFFFFF;outline:none;transition:border-color 0.15s; }
        .field-input:focus { border-color:#7C5FF0; }
        .delete-btn { opacity:0;transition:opacity 0.15s,color 0.15s;background:none;border:none;cursor:pointer;color:#C0BEB8;font-size:16px;padding:2px 4px;line-height:1;flex-shrink:0; }
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
      `}</style>

      {/* Header */}
      <div style={{ background: "#2D2D2B", padding: "28px 32px 24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#FAFAF8", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
            {selectedDate === TODAY_STR ? "오늘의 스케줄" : "일간 스케줄"}
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
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
        <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
          {[
            { label: "전체", val: events.length },
            { label: "완료", val: completed },
            { label: "남음", val: events.length - completed },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#FAFAF8", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
          <button className="add-btn" onClick={openModal} style={{
            width: 38, height: 38, borderRadius: "50%", border: "none",
            background: "#3A3A38", color: "#FAFAF8", fontSize: 22, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4,
          }}>+</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#EDECEA" }}>
        <div style={{ height: "100%", width: `${completedPct}%`, background: "linear-gradient(90deg, #7C5FF0, #E8543A)", transition: "width 0.6s ease" }} />
      </div>

      {/* Tabs */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 0" }}>
        <div style={{ display: "flex", gap: 2, background: "#EDECEA", borderRadius: 10, padding: 3, width: "fit-content" }}>
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
        <div className="view-enter" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0, maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>

          {/* Left */}
          <div style={{ paddingRight: 24 }}>

            {/* Current / Next card — today only */}
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

            {/* Mini timeline bar */}
            {!dbLoading && events.length > 0 && (
              <div style={{ marginBottom: 20, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#C0BEB8", marginBottom: 6 }}>
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

            {/* Loading skeleton */}
            {dbLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[90, 75, 85, 70, 80].map((w, i) => (
                  <div key={i} style={{ height: 54, borderRadius: 10, background: "#F0EFEB", width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!dbLoading && events.length === 0 && (
              <div className="empty-state">
                오늘 일정이 없어요.<br />
                <span style={{ fontSize: 12, color: "#C0BEB8" }}>+ 버튼을 눌러 추가해보세요.</span>
              </div>
            )}

            {/* Event list */}
            {!dbLoading && events.length > 0 && (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="schedule-list">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {events.map((e, i) => {
                        const cfg     = PRIORITY_CONFIG[e.priority];
                        const isDone  = timeToMinutes(e.end_time) < now;
                        const isActive = timeToMinutes(e.start_time) <= now && !isDone;
                        const isSel   = selected === e.task_id;
                        return (
                          <Draggable key={e.task_id} draggableId={e.task_id} index={i} isDragDisabled={e.is_fixed}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`event-row${isSel ? " selected" : ""}${snapshot.isDragging ? " dragging" : ""}`}
                                onClick={() => setSelected(isSel ? null : e.task_id)}
                                style={{
                                  display: "flex", alignItems: "stretch", borderRadius: 10, padding: "10px 14px",
                                  background: snapshot.isDragging ? "#F0EFEB" : isSel ? "#F0EFEB" : "transparent",
                                  opacity: isDone ? 0.45 : 1,
                                  ...provided.draggableProps.style,
                                }}
                              >
                                {e.is_fixed
                                  ? <div className="drag-fixed-icon">🔒</div>
                                  : <div className="drag-handle" {...provided.dragHandleProps} onClick={ev => ev.stopPropagation()}>⠿</div>
                                }
                                <div style={{ width: 80, flexShrink: 0, paddingRight: 14 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#2D2D2B", fontVariantNumeric: "tabular-nums" }}>{e.start_time}</div>
                                  <div style={{ fontSize: 11, color: "#B0AFA8", marginTop: 1 }}>{e.end_time}</div>
                                </div>
                                <div style={{ width: 3, borderRadius: 2, background: isDone ? "#DDDCDA" : cfg.color, opacity: isDone ? 0.5 : 1, flexShrink: 0, marginRight: 12, alignSelf: "stretch" }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 500, color: isDone ? "#B0AFA8" : "#2D2D2B" }}>
                                      {isDone ? "✓ " : ""}{e.task_name}
                                    </span>
                                    {e.is_fixed && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>고정</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
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
                                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, paddingLeft: 12 }}>
                                  <div style={{ fontSize: 11, color: "#C0BEB8", marginTop: 2 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* AI Input */}
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

            {/* Priority breakdown */}
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

            {/* Stats */}
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

            {/* Fixed events note */}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
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
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1, color: isDark ? "#FAFAF8" : "#2D2D2B", marginBottom: 8 }}>{day.getDate()}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {dayEvents.slice(0, 3).map(e => {
                          const cfg = PRIORITY_CONFIG[e.priority];
                          return (
                            <div key={e.task_id} style={{
                              fontSize: 10, padding: "2px 6px", borderRadius: 4, lineHeight: 1.5,
                              background: isDark ? "#3A3A38" : cfg.bg,
                              color: isDark ? "#E8E8E4" : cfg.color,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>{e.task_name}</div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div style={{ fontSize: 10, color: isDark ? "#9CA3AF" : "#B0AFA8", paddingLeft: 2 }}>+{dayEvents.length - 3}개 더</div>
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
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#B0AFA8", lineHeight: 1 }}>×</button>
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
              {formError && (
                <div style={{ fontSize: 12, color: "#E8543A", padding: "8px 12px", background: "#FEF0EC", borderRadius: 8 }}>{formError}</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={closeModal} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #EDECEA", background: "transparent", fontSize: 14, fontFamily: "inherit", color: "#9CA3AF", cursor: "pointer" }}>
                  취소
                </button>
                <button onClick={handleAdd} style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: "#2D2D2B", color: "#FAFAF8", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  추가하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
