"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const SCHEDULE = [
  { task_id: "evt-001", task_name: "확률과 통계 강의", start_time: "09:00", end_time: "10:30", priority: "urgent", is_fixed: true, tags: ["lecture"], notes: "강의실 B304" },
  { task_id: "evt-002", task_name: "점심 & 휴식", start_time: "10:40", end_time: "11:30", priority: "low", is_fixed: false, tags: ["break"], notes: "" },
  { task_id: "evt-003", task_name: "온라인 멘토링 세션", start_time: "13:00", end_time: "14:00", priority: "high", is_fixed: false, tags: ["work"], notes: "Zoom 링크 확인" },
  { task_id: "evt-004", task_name: "팀 프로젝트 회의", start_time: "14:10", end_time: "15:10", priority: "high", is_fixed: false, tags: ["meeting"], notes: "" },
  { task_id: "evt-005", task_name: "개인 공부", start_time: "15:20", end_time: "17:20", priority: "medium", is_fixed: false, tags: ["study"], notes: "" },
  { task_id: "evt-006", task_name: "운동", start_time: "18:00", end_time: "19:00", priority: "low", is_fixed: false, tags: ["health"], notes: "" },
];

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
  const DAY_END = 22 * 60;
  return Math.max(0, Math.min(100, ((timeToMinutes(t) - DAY_START) / (DAY_END - DAY_START)) * 100));
}

const EMPTY_FORM = { task_name: "", start_time: "09:00", end_time: "10:00", priority: "medium" };

export default function ScheduleDashboard() {
  const [events, setEvents] = useState(SCHEDULE);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const now = getNow();
  const nowPct = pct(`${String(Math.floor(now / 60)).padStart(2,"0")}:${String(now % 60).padStart(2,"0")}`);

  const completed = events.filter(e => timeToMinutes(e.end_time) < now).length;
  const upcoming = events.find(e => timeToMinutes(e.start_time) > now);
  const current = events.find(e => timeToMinutes(e.start_time) <= now && timeToMinutes(e.end_time) > now);

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setFormError("");
  }

  function handleAdd() {
    if (!form.task_name.trim()) { setFormError("일정 이름을 입력해주세요."); return; }
    if (timeToMinutes(form.end_time) <= timeToMinutes(form.start_time)) {
      setFormError("종료 시간은 시작 시간보다 늦어야 해요."); return;
    }
    const newEvent = {
      task_id: `evt-${Date.now()}`,
      task_name: form.task_name.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      priority: form.priority,
      is_fixed: false,
      tags: [],
      notes: "",
    };
    setEvents(prev =>
      [...prev, newEvent].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
    );
    closeModal();
  }

  function handleDelete(taskId) {
    setEvents(prev => prev.filter(e => e.task_id !== taskId));
    if (selected === taskId) setSelected(null);
  }

  function onDragEnd(result) {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const reordered = Array.from(events);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setEvents(reordered);
  }

  async function handleAI() {
    if (!input.trim()) return;
    setLoading(true);
    setAiMsg("");
    await new Promise(r => setTimeout(r, 1400));
    setAiMsg(`"${input}" 일정을 분석했어요. 오후 5시 이후 빈 슬롯에 배치했어요.`);
    setLoading(false);
    setInput("");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FAFAF8",
      fontFamily: "'DM Sans', 'Pretendard', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
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
        .event-row.dragging { background:#F0EFEB !important;box-shadow:0 8px 24px rgba(0,0,0,0.10);border-radius:10px;transform:none !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#2D2D2B", padding: "28px 32px 24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#FAFAF8", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
            오늘의 스케줄
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
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
        <div style={{ height: "100%", width: `${(completed / events.length) * 100}%`, background: "linear-gradient(90deg, #7C5FF0, #E8543A)", transition: "width 0.6s ease" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0, maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>

        {/* Left: Timeline + List */}
        <div style={{ paddingRight: 24 }}>

          {/* Current / Next card */}
          {(current || upcoming) && (
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
          <div style={{ marginBottom: 20, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#C0BEB8", marginBottom: 6 }}>
              {["08:00","10:00","12:00","14:00","16:00","18:00","20:00","22:00"].map(h => <span key={h}>{h}</span>)}
            </div>
            <div style={{ height: 6, background: "#EDECEA", borderRadius: 3, position: "relative", overflow: "visible" }}>
              {events.map(e => {
                const left = pct(e.start_time);
                const right = pct(e.end_time);
                const cfg = PRIORITY_CONFIG[e.priority];
                return (
                  <div key={e.task_id} title={e.task_name} style={{
                    position: "absolute", top: 0, height: "100%",
                    left: `${left}%`, width: `${right - left}%`,
                    background: cfg.color, borderRadius: 2, opacity: 0.75,
                    cursor: "pointer",
                  }} onClick={() => setSelected(e.task_id === selected ? null : e.task_id)} />
                );
              })}
              {/* Now indicator */}
              <div className="timeline-thumb" style={{
                position: "absolute", top: -4, left: `${nowPct}%`,
                width: 2, height: 14, background: "#E8543A", borderRadius: 1,
                transform: "translateX(-50%)",
              }}>
                <div style={{ width: 6, height: 6, background: "#E8543A", borderRadius: "50%", position: "absolute", top: -3, left: -2 }} className="pulse" />
              </div>
            </div>
          </div>

          {/* Event list */}
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="schedule-list">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {events.map((e, i) => {
                    const cfg = PRIORITY_CONFIG[e.priority];
                    const isDone = timeToMinutes(e.end_time) < now;
                    const isActive = timeToMinutes(e.start_time) <= now && !isDone;
                    const isSel = selected === e.task_id;

                    return (
                      <Draggable
                        key={e.task_id}
                        draggableId={e.task_id}
                        index={i}
                        isDragDisabled={e.is_fixed}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`event-row${isSel ? " selected" : ""}${snapshot.isDragging ? " dragging" : ""}`}
                            onClick={() => setSelected(isSel ? null : e.task_id)}
                            style={{
                              display: "flex", alignItems: "stretch", gap: 0,
                              borderRadius: 10, padding: "10px 14px",
                              background: snapshot.isDragging ? "#F0EFEB" : isSel ? "#F0EFEB" : "transparent",
                              opacity: isDone ? 0.45 : 1,
                              ...provided.draggableProps.style,
                            }}
                          >
                            {/* Drag handle */}
                            {e.is_fixed
                              ? <div className="drag-fixed-icon">🔒</div>
                              : <div className="drag-handle" {...provided.dragHandleProps} onClick={ev => ev.stopPropagation()}>⠿</div>
                            }

                            {/* Time col */}
                            <div style={{ width: 80, flexShrink: 0, paddingRight: 14 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "#2D2D2B", fontVariantNumeric: "tabular-nums" }}>{e.start_time}</div>
                              <div style={{ fontSize: 11, color: "#B0AFA8", marginTop: 1 }}>{e.end_time}</div>
                            </div>

                            {/* Color bar */}
                            <div style={{ width: 3, borderRadius: 2, background: isActive ? cfg.color : isDone ? "#DDDCDA" : cfg.color, opacity: isDone ? 0.5 : 1, flexShrink: 0, marginRight: 12, alignSelf: "stretch" }} />

                            {/* Content */}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 500, color: isDone ? "#B0AFA8" : "#2D2D2B" }}>
                                  {isDone ? "✓ " : ""}{e.task_name}
                                </span>
                                {e.is_fixed && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>고정</span>}
                              </div>
                              <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                                {e.tags.map(t => {
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

                            {/* Duration + Delete */}
                            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, paddingLeft: 12 }}>
                              <div style={{ fontSize: 11, color: "#C0BEB8", marginTop: 2 }}>
                                {timeToMinutes(e.end_time) - timeToMinutes(e.start_time)}분
                              </div>
                              {!e.is_fixed && (
                                <button className="delete-btn" onClick={ev => { ev.stopPropagation(); handleDelete(e.task_id); }} title="삭제">
                                  ×
                                </button>
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
              <textarea
                className="ai-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={"\"내일 오후 2시에 도서관 공부 2시간 추가해줘\"\n\"오늘 회의를 30분 당겨줘\""}
                rows={3}
                style={{ resize: "none", lineHeight: 1.6, color: "#FAFAF8" }}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleAI(); }}
              />
            </div>
            <button className="send-btn" onClick={handleAI} disabled={loading}
              style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #4A4A48", background: "transparent", color: "#FAFAF8", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>
              {loading ? "분석 중..." : "⌘↵ 일정 조정 요청"}
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
                    <div style={{ height: "100%", width: `${(cnt / events.length) * 100}%`, background: cfg.color, borderRadius: 2, transition: "width 0.6s ease" }} />
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", width: 20, textAlign: "right" }}>{cnt}</div>
                </div>
              );
            })}
          </div>

          {/* Today stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "총 일정 시간", val: `${events.reduce((a,e) => a + timeToMinutes(e.end_time) - timeToMinutes(e.start_time), 0)}분` },
              { label: "완료율", val: `${Math.round((completed / events.length) * 100)}%` },
              { label: "고정 일정", val: `${events.filter(e => e.is_fixed).length}개` },
              { label: "남은 일정", val: `${events.length - completed}개` },
            ].map(s => (
              <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #EDECEA", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#B0AFA8", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#2D2D2B" }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Fixed events note */}
          <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 2 }}>고정 일정 보호 중</div>
              <div style={{ fontSize: 11, color: "#B45309", lineHeight: 1.5 }}>
                {events.filter(e => e.is_fixed).map(e => e.task_name).join(", ")} 은(는) AI가 절대 수정하지 않아요.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#2D2D2B" }}>새 일정 추가</div>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#B0AFA8", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 일정 이름 */}
              <div>
                <div className="field-label">일정 이름</div>
                <input className="field-input" placeholder="예) 알고리즘 스터디" value={form.task_name}
                  onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                  autoFocus
                />
              </div>

              {/* 시간 */}
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

              {/* 우선순위 */}
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

              {/* 에러 메시지 */}
              {formError && (
                <div style={{ fontSize: 12, color: "#E8543A", padding: "8px 12px", background: "#FEF0EC", borderRadius: 8 }}>
                  {formError}
                </div>
              )}

              {/* 버튼 */}
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
