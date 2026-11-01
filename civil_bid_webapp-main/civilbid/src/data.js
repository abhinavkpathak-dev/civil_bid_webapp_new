
/*
 * CivilBid data layer
 * Shared utilities, local storage, eligibility matching,
 * tender health analysis, and live AI Copilot integration.
 *
 * Tender records must come from a verified data source.
 */

export const BRAND = 'CivilBid';

export const DEPTS = [
  'PWD',
  'Health',
  'Railways',
  'Education',
  'Water Resources',
  'Municipal Corporation',
];

export const CERTS = [
  'ISO 9001',
  'ISO 14001',
  'Labour License',
  'Pollution Control NOC',
  'Fire Safety Certificate',
];

export const DOCS = [
  'Company Registration Certificate',
  'Contractor Registration',
  'Previous Work Certificates',
  'Financial Statements',
  'GST Registration',
  'PAN Card',
  'Technical Certifications',
  'Bid Security (EMD)',
];

export const LVL = {
  High: 'Review suggested',
  Medium: 'Worth a look',
  Low: 'Looks good',
};

export const fmt = (value) => {
  const n = Number(value) || 0;
  return n < 1
    ? `₹${(n * 100).toFixed(2)} lakh`
    : `₹${n.toFixed(2)} Cr`;
};

export const dl = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

export const dt = (date) =>
  date
    ? new Date(date).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

export const daysLeft = (date) =>
  date ? Math.ceil((new Date(date) - Date.now()) / 864e5) : 0;

export const subDays = (tender) =>
  tender?.subStart && tender?.deadline
    ? Math.max(
        Math.round(
          (new Date(tender.deadline) - new Date(tender.subStart)) /
            864e5
        ),
        0
      )
    : null;

/*
 * Safe local storage helpers.
 * These functions are for local preferences and user-entered records.
 * They are not a shared database across devices.
 */
export function load(key, fallback) {
  try {
    const saved = localStorage.getItem(key);

    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Could not load saved data:', error);
  }

  return typeof fallback === 'function' ? fallback() : fallback;
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Could not save data:', error);
  }
}

/*
 * Do not populate this list with fictional tender records.
 * Connect a verified tender API or database to display live tenders.
 */
export const seedTenders = () => [];

/*
 * Demo accounts have been disabled.
 * Authentication should use a secure backend in production.
 */
export const seedUsers = () => [];

/*
 * Eligibility matching.
 * This is an advisory calculation, not an official eligibility decision.
 */
const catOk = (required, actual) => {
  if (!required || required === 'Any') return true;
  if (!actual) return false;

  const requiredClasses = [...required.matchAll(/[A-D]/g)]
    .map((match) => match[0])
    .sort();

  if (!requiredClasses.length) return true;

  return (
    ['A', 'B', 'C', 'D'].includes(actual) &&
    actual >= requiredClasses[0] &&
    actual <= requiredClasses[requiredClasses.length - 1]
  );
};

export function check(req = {}, profile = {}) {
  const years = Number(profile.years) || 0;
  const projects = Number(profile.projects) || 0;
  const turnover = Number(profile.turnover) || 0;
  const certs = Array.isArray(profile.certs) ? profile.certs : [];
  const docs = Array.isArray(profile.docs) ? profile.docs : [];

  const requirements = {
    years: Number(req.years) || 0,
    projects: Number(req.projects) || 0,
    turnover: Number(req.turnover) || 0,
    certs: Array.isArray(req.certs) ? req.certs : [],
    docs: Array.isArray(req.docs) ? req.docs : [],
  };

  const rows = [
    {
      label: `Experience: ${requirements.years}+ years`,
      need: `${requirements.years} years`,
      have: `${years} year${years === 1 ? '' : 's'}`,
      ok: years >= requirements.years,
      why: 'Experience can indicate the ability to deliver similar work.',
      fix: 'Review your verified experience records and completion certificates.',
    },
    {
      label: `Similar projects: ${requirements.projects}+ completed`,
      need: `${requirements.projects} projects`,
      have: `${projects} projects`,
      ok: projects >= requirements.projects,
      why: 'Past similar projects can demonstrate relevant experience.',
      fix: 'Review your completion certificates for qualifying projects.',
    },
    {
      label: `Annual turnover: ₹${requirements.turnover} Cr or more`,
      need: `₹${requirements.turnover} Cr`,
      have: `₹${turnover} Cr`,
      ok: turnover >= requirements.turnover,
      why: 'Financial capacity may be part of the tender requirements.',
      fix: 'Check your audited financial statements against the official tender.',
    },
  ];

  if (req.contractorCat && req.contractorCat !== 'Any') {
    rows.push({
      label: `Contractor category: ${req.contractorCat}`,
      need: req.contractorCat,
      have: profile.contractorClass || 'Not stated',
      ok: catOk(req.contractorCat, profile.contractorClass),
      why: 'The tender may specify a contractor registration category.',
      fix: 'Check your registration class against the official tender conditions.',
    });
  }

  requirements.certs.forEach((cert) => {
    rows.push({
      label: `Certification: ${cert}`,
      need: cert,
      have: certs.includes(cert) ? 'Available' : 'Not in profile',
      ok: certs.includes(cert),
      why: 'The supplied tender data lists this certification.',
      fix: `Verify whether you hold a valid ${cert}.`,
    });
  });

  requirements.docs.forEach((doc) => {
    rows.push({
      label: `Document: ${doc}`,
      doc: true,
      need: doc,
      have: docs.includes(doc) ? 'Available' : 'Not in profile',
      ok: docs.includes(doc),
      why: 'The supplied tender data lists this document.',
      fix: `Check that ${doc} is available and current.`,
    });
  });

  const met = rows.filter((row) => row.ok);
  const missing = rows.filter((row) => !row.ok);

  return {
    rows,
    met: met.map((row) => row.label),
    missing,
    pct: rows.length
      ? Math.round((100 * met.length) / rows.length)
      : 0,
  };
}

/*
 * Explain bid observations using the supplied tender and bid values.
 */
export function observations(tender, amount, missing = []) {
  const estimate = Number(tender.value) || 0;
  const bidAmount = Number(amount) || 0;
  const notes = [];

  if (estimate > 0 && bidAmount > 0) {
    const ratio = bidAmount / estimate;

    if (ratio < 0.85) {
      notes.push(
        `The bid is ${Math.round((1 - ratio) * 100)}% below the supplied estimate. Verify the amount and cost assumptions.`
      );
    } else if (ratio > 1.03) {
      notes.push(
        `The bid is ${Math.round((ratio - 1) * 100)}% above the supplied estimate. Review the scope and pricing assumptions.`
      );
    } else {
      notes.push(
        'The bid amount is close to the supplied estimated value.'
      );
    }
  } else {
    notes.push(
      'A reliable price comparison is unavailable because the estimate or bid amount is missing.'
    );
  }

  if (missing.length) {
    notes.push(
      `${missing.length} requirement(s) need review: ${missing
        .slice(0, 2)
        .map((item) => item.label)
        .join('; ')}.`
    );
  } else {
    notes.push(
      'No missing requirements were identified in the supplied profile. Verify documents against the official tender.'
    );
  }

  return notes;
}

/*
 * Return only bids actually stored for the selected tender.
 * No synthetic bidders or fabricated bid amounts are generated.
 */
export function bidsFor(tender, realBids = []) {
  if (!tender || tender.status === 'Draft') return [];

  return realBids
    .filter((bid) => bid.tenderId === tender.id)
    .map((bid) => {
      const missing = Array.isArray(bid.missing) ? bid.missing : [];
      const amount = Number(bid.amount) || 0;

      return {
        ...bid,
        ok: missing.length === 0,
        sample: false,
        notes: observations(tender, amount, missing),
      };
    });
}

/*
 * Tender health analysis.
 * Results are advisory calculations from the supplied record,
 * not official procurement findings.
 */
const lvl = (score) =>
  score >= 60 ? 'High' : score >= 35 ? 'Medium' : 'Low';

export function analyze(tender = {}) {
  const req = tender.req || {};
  const value = Number(tender.value) || 0;
  const deadlineDays =
    subDays(tender) ??
    Math.max(daysLeft(tender.deadline), 0);

  const works = Array.isArray(tender.works) ? tender.works : [];
  const certs = Array.isArray(req.certs) ? req.certs : [];
  const docs = Array.isArray(req.docs) ? req.docs : [];

  const description = [
    tender.title || '',
    ...works.map((work) => `${work.name || ''} ${work.desc || ''}`),
  ].join(' ');

  const wordCount = description.split(/\s+/).filter(Boolean).length;
  const turnover = Number(req.turnover) || 0;
  const ratio = turnover / (value || 1);
  const requirementCount = certs.length + docs.length;

  let competition = 10;
  const competitionReasons = [];

  if ((Number(req.years) || 0) >= 10) {
    competition += 25;
    competitionReasons.push(
      'The experience requirement may narrow the pool of eligible bidders.'
    );
  }

  if ((Number(req.projects) || 0) >= 4) {
    competition += 20;
    competitionReasons.push(
      'The number of similar projects required may restrict participation.'
    );
  }

  if (ratio > 1.2) {
    competition += 30;
    competitionReasons.push(
      'The turnover threshold is high relative to the supplied estimated value.'
    );
  }

  if (requirementCount >= 8) {
    competition += 20;
    competitionReasons.push(
      'Multiple requirements may reduce the pool of eligible bidders.'
    );
  }

  if (!competitionReasons.length) {
    competitionReasons.push(
      'No major competition concern was identified from the supplied fields.'
    );
  }

  const expectedDays = value > 10 ? 21 : value > 1 ? 14 : 10;

  const timeline = deadlineDays < expectedDays
    ? Math.min(95, 40 + (expectedDays - deadlineDays) * 5)
    : 15;

  const timelineReasons = [
    deadlineDays < expectedDays
      ? `The supplied submission period is ${deadlineDays} days. Check the official tender to confirm whether bidders have adequate preparation time.`
      : `The supplied submission period is ${deadlineDays} days.`,
  ];

  const complexity = Math.min(
    95,
    15 +
      certs.length * 8 +
      docs.length * 5 +
      (Number(req.projects) || 0) * 4 +
      (req.other ? 10 : 0) +
      (req.registration ? 5 : 0) +
      works.length * 3 +
      (wordCount < 25 ? 20 : 0)
  );

  const complexityReasons = [
    `${certs.length} certification(s) and ${docs.length} document(s) are listed in the supplied data.`,
  ];

  if (wordCount < 25) {
    complexityReasons.push(
      'The supplied work description is short. Verify the complete scope in the official documents.'
    );
  }

  const retenderRisk = Math.round(
    0.4 * competition +
      0.35 * timeline +
      0.25 * complexity
  );

  const riskReasons = [];

  if (competition >= 35) {
    riskReasons.push(
      'Potential factor: restrictive conditions could reduce participation.'
    );
  }

  if (timeline >= 35) {
    riskReasons.push(
      'Potential factor: a short submission period could lead to incomplete bids.'
    );
  }

  if (complexity >= 60) {
    riskReasons.push(
      'Potential factor: complex requirements may increase clarification or evaluation effort.'
    );
  }

  if (!riskReasons.length) {
    riskReasons.push(
      'No major risk factor was identified from the supplied fields.'
    );
  }

  const score = Math.max(
    5,
    100 -
      Math.round(
        0.3 * competition +
          0.25 * timeline +
          0.2 * complexity +
          0.25 * retenderRisk
      )
  );

  return {
    score,
    days: deadlineDays,
    items: [
      {
        name: 'Competition Insight',
        pct: Math.min(competition, 95),
        level: lvl(competition),
        reasons: competitionReasons,
      },
      {
        name: 'Timeline Insight',
        pct: timeline,
        level: lvl(timeline),
        reasons: timelineReasons,
      },
      {
        name: 'Requirement Complexity',
        pct: complexity,
        level: lvl(complexity),
        reasons: complexityReasons,
      },
      {
        name: 'Re-tender Risk',
        pct: retenderRisk,
        level: lvl(retenderRisk),
        reasons: riskReasons,
      },
    ],
  };
}

/*
 * Live AI integration.
 * Requires the server endpoint /api/chat and GEMINI_API_KEY
 * configured in the deployment environment.
 */
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
    throw new Error(
      data.error ||
        'CivilBid Copilot could not respond. Please try again.'
    );
  }

  if (!data.text) {
    throw new Error('The AI service returned an empty response.');
  }

  return data.text;
}

export const explain = async (tender) =>
  callCivilBidAI(
    'Explain this tender in simple language. Cover its scope, estimated value, deadline, eligibility requirements, and important risks. Clearly identify any information that is missing.',
    tender
  );

export const needs = async (tender) =>
  callCivilBidAI(
    'List the documents, certifications, experience, turnover, registration, and other requirements stated in this tender. Do not invent missing requirements.',
    tender
  );

export const askCopilot = async (question, tender, profile = {}) =>
  callCivilBidAI(question, tender, profile);
