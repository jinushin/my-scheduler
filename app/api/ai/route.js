export async function POST(request) {
  const { message, events } = await request.json();

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({ message: "API 키가 설정되지 않았어요." });
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `현재 일정 목록: ${JSON.stringify(events)}\n\n사용자 요청: ${message}\n\n일정을 분석하고 한국어로 간단하게 답변해줘.`
        }]
      }]
    }),
  });

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "응답을 받지 못했어요.";
  return Response.json({ message: text });
}
