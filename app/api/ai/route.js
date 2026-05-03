export async function POST(request) {
  const { message, events } = await request.json();

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({ message: "API 키가 설정되지 않았어요." });
  }

  const today = new Date().toISOString().split("T")[0];

  const prompt = `오늘 날짜: ${today}
현재 일정 목록: ${JSON.stringify(events)}

사용자 요청: ${message}

다음 JSON 형식으로만 응답해줘. 다른 텍스트는 절대 포함하지 마:
{
  "message": "사용자에게 보낼 한국어 메시지",
  "addEvents": [
    {
      "task_name": "일정 이름",
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "priority": "medium"
    }
  ]
}

일정 추가가 필요 없으면 addEvents를 빈 배열로 반환해줘.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    }),
  });

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Response.json(parsed);
  } catch {
    return Response.json({ message: text || "응답을 받지 못했어요.", addEvents: [] });
  }
}
