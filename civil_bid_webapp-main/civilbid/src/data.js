
async function callCivilBidAI(question, tender, profile = {}) {
  if (!tender) {
    throw new Error('Select a tender before asking CivilBid Copilot.');
  }

  const opportunityMatch = tender.req
    ? check(tender.req, profile)
    : {};

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      tender,
      profile,
      opportunityMatch,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'CivilBid Copilot could not respond. Please try again.');
  }

  if (!data.text) {
    throw new Error('The AI service returned an empty response.');
  }

  return data.text;
}

export const explain = async (t) =>
  callCivilBidAI(
    'Explain this tender in simple language. Cover its scope, estimated value, deadline, eligibility requirements, and important risks. Clearly identify any information that is missing.',
    t
  );

export const needs = async (t) =>
  callCivilBidAI(
    'List the documents, certifications, experience, turnover, registration, and other requirements stated in this tender. Do not invent missing requirements.',
    t
  );

export const askCopilot = async (q, t, p = {}) =>
  callCivilBidAI(q, t, p);
