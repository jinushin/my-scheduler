export async function POST(request) {
  const { message, events } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return Response.json({ message: "API 키가 설정되지 않았어요." });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `현재 일정 목록: ${JSON.stringify(events)}\n\n사용자 요청: ${message}\n\n일정을 분석하고 한국어로 간단하게 답변해줘.`,
        },
      ],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "응답을 받지 못했어요.";
  return Response.json({ message: text });
}
