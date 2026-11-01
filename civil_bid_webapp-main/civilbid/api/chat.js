// Vercel serverless endpoint. The Gemini key is read only on the server.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to your local environment and Vercel project settings.' });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const body = req.body || {};
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return res.status(400).json({ error: 'Please enter a question.' });
  if (question.length > 5000) return res.status(400).json({ error: 'Question is too long. Please keep it under 5,000 characters.' });

  const tender = body.tender && typeof body.tender === 'object' ? body.tender : {};
  const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
  const match = body.opportunityMatch && typeof body.opportunityMatch === 'object' ? body.opportunityMatch : {};
  const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
  const systemInstruction = [
    'You are CivilBid Copilot, an assistant for understanding tender notices and procurement workflows.',
    'Use the supplied tender data and bidder profile as the primary source. Do not invent tender clauses, legal requirements, official rules, dates, fees, or facts.',
    'If a detail is absent, explicitly say it is not provided in the supplied tender data and recommend checking the official tender documents.',
    'Help explain scope, deadlines, documents, eligibility, turnover, certifications, bid security, submission preparation, and potential tender-quality or re-tender risk factors.',
    'For government departments and organizations, suggest practical, fair, transparent ways to clarify scope, make eligibility proportionate, allow reasonable response time, and reduce avoidable non-responsive bids or re-tender risk. Do not recommend tailoring conditions to favor a bidder.',
    'Do not guarantee a tender will avoid re-tendering or that a bidder is officially eligible. Treat Opportunity Match and Tender Health as advisory calculations, not official determinations.',
    'Answer clearly and practically. Use short headings or bullets when useful. Do not claim you searched official portals unless that data was supplied.'
  ].join(' ');
  const context = { tender, bidderProfile: profile, opportunityMatch: match, currentQuestion: question };
  const contents = [];
  for (const item of history) {
    if (!item || !['user', 'model'].includes(item.role) || typeof item.text !== 'string') continue;
    contents.push({ role: item.role, parts: [{ text: item.text.slice(0, 5000) }] });
  }
  contents.push({ role: 'user', parts: [{ text: `Use this CivilBid context to answer my question. Context JSON:\n${JSON.stringify(context)}\n\nQuestion: ${question}` }] });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Never retry with a different model or paid tier.
      if (response.status === 429) return res.status(429).json({ error: 'Gemini free-tier quota or rate limit reached. No paid fallback was attempted. Please wait and try again, or check your model quota in Google AI Studio.' });
      if (response.status === 401 || response.status === 403) return res.status(502).json({ error: 'Gemini rejected the API key or this model is not available to the project. Check the key and free-tier model access in Google AI Studio.' });
      return res.status(502).json({ error: data?.error?.message || `Gemini request failed (${response.status}). No paid fallback was attempted.` });
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim();
    if (!text) return res.status(502).json({ error: 'Gemini returned no text. Please try asking in a different way.' });
    return res.status(200).json({ text, model });
  } catch {
    return res.status(502).json({ error: 'Could not connect to Gemini. Check the server connection and try again.' });
  }
}
