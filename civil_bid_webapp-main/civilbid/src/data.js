// CivilBid data layer: seed data, localStorage helpers, matching, tender health, mock Copilot.
export const BRAND = 'CivilBid';
export const DEPTS = ['PWD', 'Health', 'Railways', 'Education', 'Water Resources', 'Municipal Corporation'];
export const CERTS = ['ISO 9001', 'ISO 14001', 'Labour License', 'Pollution Control NOC', 'Fire Safety Certificate'];
export const DOCS = ['Company Registration Certificate', 'Contractor Registration', 'Previous Work Certificates', 'Financial Statements', 'GST Registration', 'PAN Card', 'Technical Certifications', 'Bid Security (EMD)'];
export const LVL = { High: 'Review suggested', Medium: 'Worth a look', Low: 'Looks good' };

export const fmt = (v) => (Number(v) < 1 ? `₹${(Number(v) * 100).toFixed(2)} lakh` : `₹${Number(v).toFixed(2)} Cr`);
export const dl = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const dt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
export const daysLeft = (d) => Math.ceil((new Date(d) - Date.now()) / 864e5);
export const subDays = (t) => (t.subStart && t.deadline ? Math.max(Math.round((new Date(t.deadline) - new Date(t.subStart)) / 864e5), 0) : null);
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
export const load = (k, seed) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? (typeof seed === 'function' ? seed() : seed); } catch { return typeof seed === 'function' ? seed() : seed; } };
export const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const seedUsers = () => [];

const W = (name, value, o = {}) => ({ no: '', district: '', name, desc: '', value, security: +(value * 0.1).toFixed(4), docCost: '₹2,000 + applicable charges and taxes', category: 'Civil Works', cat: 'Any', completion: '6 months', ...o });
const S = (o) => {
  const value = +o.works.reduce((s, w) => s + w.value, 0).toFixed(4);
  const b = { issuerType: 'Government', tenderType: 'Open', method: 'E-tendering (online)', noticeNo: '', issuedOn: addDays(-4), office: '', officer: '', location: '', intro: '', conditions: [], publication: addDays(-3), docStart: addDays(-3), techOpening: '', finOpening: '', owner: 'sample-government', ...o };
  return { ...b, value, issuer: o.issuer || o.office || `${o.department} Department`, published: o.status === 'Draft' ? null : b.publication };
};
const D5 = ['PAN Card', 'Previous Work Certificates', 'Financial Statements', 'GST Registration'];
export const seedTenders = () => [
  S({ id: 'CB-2026-756', title: 'Repair and Painting of Residential Buildings, Modinagar', tenderType: 'Short-Term', department: 'PWD', status: 'Published', noticeNo: '756/4A', office: 'Executive Engineer, Construction Division-2, P.W.D., Ghaziabad', officer: 'Anita Sharma, Executive Engineer', location: 'Ghaziabad',
    subStart: addDays(-2), deadline: addDays(5), techOpening: addDays(5) + 'T12:30',
    works: [W('Repair and painting work of Type-4, Type-3 and Type-2 residential buildings located at Modinagar Tehsil.', 0.1932, { district: 'Ghaziabad', security: 0.0193, category: 'Building Work', cat: 'A–D', completion: '3 months' })],
    req: { contractorCat: 'A–D', years: 3, projects: 1, turnover: 0.2, certs: ['Labour License'], registration: 'Registered with the State PWD as a building contractor', other: '', docs: [...D5, 'Bid Security (EMD)'] },
    conditions: ['Detailed terms and conditions are available in the tender documents.', 'Contractors may be required to provide performance security.', 'Additional performance security may be required for certain bids according to applicable tender conditions.', 'Technical evaluation will be conducted according to the applicable procurement process.'] }),
  S({ id: 'CB-2026-102', title: 'Supply and Installation of Digital X-Ray Systems for 12 District Hospitals', department: 'Health', status: 'Published', office: 'Directorate of Health Services', location: 'Statewide', subStart: addDays(-4), deadline: addDays(16),
    works: [W('Supply, installation, commissioning and 5-year maintenance of 12 digital radiography units with PACS integration.', 22.8, { category: 'Equipment Supply', completion: '9 months' })],
    req: { contractorCat: 'Any', years: 5, projects: 2, turnover: 15, certs: ['ISO 9001'], registration: '', other: 'OEM authorization letter required', docs: [...D5, 'Technical Certifications', 'Bid Security (EMD)'] } }),
  S({ id: 'CB-2026-103', title: 'Rehabilitation of Flood Embankments, Brahmaputra Reach B', department: 'Water Resources', status: 'Published', office: 'Chief Engineer, Water Resources', location: 'Assam', subStart: addDays(-3), deadline: addDays(9),
    works: [W('Strengthening of 9.4 km of embankment with geo-textile bags, launching aprons and anti-erosion works.', 36.2, { completion: '8 months', cat: 'A–C' })],
    req: { contractorCat: 'A–C', years: 7, projects: 2, turnover: 25, certs: [], registration: '', other: '', docs: [...D5.slice(0, 3), 'Bid Security (EMD)'] } }),
  S({ id: 'CB-2026-104', title: 'Smart LED Street Lighting for 40 Municipal Wards', department: 'Municipal Corporation', status: 'Published', office: 'Municipal Commissioner Office', location: 'Guwahati', subStart: addDays(-3), deadline: addDays(30),
    works: [W('Replacement of 14,500 sodium-vapour lamps with networked LED fixtures, central dashboard and 7-year warranty.', 12.4, { category: 'Electrical', completion: '10 months' })],
    req: { contractorCat: 'Any', years: 4, projects: 2, turnover: 8, certs: ['ISO 9001'], registration: '', other: '', docs: ['PAN Card', 'Financial Statements', 'GST Registration'] } }),
  S({ id: 'CB-2026-105', title: 'Construction of 25 Smart Classrooms in Government Schools', department: 'Education', status: 'Draft', office: 'Directorate of School Education', location: 'Assam', subStart: addDays(2), deadline: addDays(21), publication: addDays(1),
    works: [W('Construction of 25 classroom blocks with digital teaching infrastructure and accessible ramps.', 9.6, { category: 'Building Work' })],
    req: { contractorCat: 'Any', years: 3, projects: 2, turnover: 6, certs: [], registration: '', other: '', docs: ['PAN Card', 'Previous Work Certificates'] } }),
  S({ id: 'CB-2025-212', title: 'Track Renewal Works Phase II, Rangiya–Guwahati Section', department: 'Railways', status: 'Awarded', office: 'Divisional Railway Manager', location: 'Assam', subStart: addDays(-50), deadline: addDays(-20), publication: addDays(-52),
    works: [W('Complete track renewal of 22 km including rail, sleeper and ballast replacement.', 61, { cat: 'A' })],
    req: { contractorCat: 'A', years: 10, projects: 4, turnover: 45, certs: ['ISO 9001'], registration: '', other: '', docs: [...D5, 'Bid Security (EMD)'] }, award: { to: 'Kaziranga Builders & Co.', amount: 57.9 } }),
  S({ id: 'CB-2026-O11', title: 'Warehouse Fit-out and Racking for Regional Distribution Centre', department: 'Northline Logistics Pvt Ltd', issuerType: 'Organization', owner: 'sample-organization', issuer: 'Northline Logistics Pvt Ltd', status: 'Published', office: 'Northline Logistics Pvt Ltd', location: 'Noida', subStart: addDays(-2), deadline: addDays(12), publication: addDays(-2),
    works: [W('Supply and installation of heavy-duty racking, fire detection and flooring for a 60,000 sq ft warehouse.', 3.4, { category: 'Building Work', completion: '4 months' })],
    req: { contractorCat: 'Any', years: 3, projects: 1, turnover: 3, certs: ['Fire Safety Certificate'], registration: '', other: '', docs: ['Company Registration Certificate', 'GST Registration', 'PAN Card'] } }),
  S({ id: 'CB-2026-O12', title: 'Annual Facility Maintenance Contract, Corporate Campus', department: 'Northline Logistics Pvt Ltd', issuerType: 'Organization', owner: 'sample-organization', issuer: 'Northline Logistics Pvt Ltd', status: 'Published', office: 'Northline Logistics Pvt Ltd', location: 'Noida', subStart: addDays(-1), deadline: addDays(20), publication: addDays(-1),
    works: [W('Housekeeping, electrical and HVAC maintenance for a 4-building corporate campus for 12 months.', 1.8, { category: 'Maintenance', completion: '12 months' })],
    req: { contractorCat: 'Any', years: 2, projects: 2, turnover: 1.5, certs: [], registration: '', other: '', docs: ['Company Registration Certificate', 'GST Registration'] } }),
];

// ---- Opportunity Match ----
const catOk = (req, cls) => { if (!req || req === 'Any') return true; const L = [...req.matchAll(/[A-D]/g)].map((x) => x[0]).sort(); return !L.length || (['A', 'B', 'C', 'D'].includes(cls) && cls >= L[0] && cls <= L[L.length - 1]); };
export function check(req, p) {
  const y = +p.years || 0, pr = +p.projects || 0, to = +p.turnover || 0, certs = p.certs || [], docs = p.docs || [];
  const rows = [
    { label: `Experience: ${req.years}+ years`, need: `${req.years} years`, have: `${y} year${y === 1 ? '' : 's'}`, ok: y >= req.years, why: 'Experience shows the firm can deliver and sustain work across project cycles.', fix: 'You may need additional qualifying experience, or a joint venture with a qualified firm.' },
    { label: `Similar projects: ${req.projects}+ completed`, need: `${req.projects} projects`, have: `${pr} projects`, ok: pr >= req.projects, why: 'Similar past projects show practical ability to execute this type of work.', fix: 'Gather completion certificates for similar work, or partner with a qualified lead bidder.' },
    { label: `Annual turnover: ₹${req.turnover} Cr or more`, need: `₹${req.turnover} Cr`, have: `₹${to} Cr`, ok: to >= req.turnover, why: 'Financial capacity protects the issuer from delays caused by cash-flow problems.', fix: 'Check whether audited statements show a qualifying year, or consider a consortium.' },
  ];
  if (req.contractorCat && req.contractorCat !== 'Any') rows.push({ label: `Contractor category: ${req.contractorCat}`, need: req.contractorCat, have: p.contractorClass || 'Not stated', ok: catOk(req.contractorCat, p.contractorClass), why: 'The tender is limited to specific contractor classes.', fix: 'Review your registration class, or apply for an upgrade before the deadline.' });
  req.certs.forEach((c) => rows.push({ label: `Certification: ${c}`, need: c, have: certs.includes(c) ? 'Available' : 'Not in profile', ok: certs.includes(c), why: 'Required to meet statutory or quality standards.', fix: `Obtain or renew ${c}, then update your profile.` }));
  req.docs.forEach((d) => rows.push({ label: `Document: ${d}`, doc: true, need: d, have: docs.includes(d) ? 'Available' : 'Not in profile', ok: docs.includes(d), why: 'Needed for technical and financial scrutiny of your bid.', fix: `Prepare the ${d} before submitting.` }));
  const met = rows.filter((r) => r.ok), missing = rows.filter((r) => !r.ok);
  return { rows, met: met.map((r) => r.label), missing, pct: Math.round((100 * met.length) / rows.length) };
}

// ---- Sample bidders (fictional) ----
export const SAMPLE = [
  { name: 'Brahmaputra Infra Works Pvt Ltd', years: 14, projects: 7, turnover: 52, contractorClass: 'A', certs: CERTS.slice(0, 4), docs: DOCS, f: 0.97 },
  { name: 'Kaziranga Builders & Co.', years: 11, projects: 5, turnover: 38, contractorClass: 'A', certs: ['ISO 9001', 'Labour License'], docs: DOCS, f: 0.93 },
  { name: 'NorthEast Civic Solutions LLP', years: 6, projects: 3, turnover: 21, contractorClass: 'B', certs: ['ISO 9001'], docs: DOCS.slice(0, 5), f: 1.02 },
  { name: 'Aurora Technoworks Ltd', years: 9, projects: 4, turnover: 33, contractorClass: 'B', certs: ['ISO 9001', 'ISO 14001'], docs: DOCS.slice(0, 3).concat(DOCS[7]), f: 0.78 },
  { name: 'Manas Engineering Services', years: 3, projects: 1, turnover: 7, contractorClass: 'D', certs: [], docs: ['PAN Card', 'GST Registration'], f: 0.9 },
  { name: 'Dibru Infrastructure Corp', years: 16, projects: 9, turnover: 61, contractorClass: 'A', certs: CERTS, docs: DOCS, f: 0.99 },
];
export function observations(t, amount, missing) {
  const r = amount / t.value, o = [];
  if (r < 0.85) o.push(`Bid is ${Math.round((1 - r) * 100)}% below the estimate. Consider asking for a rate analysis to confirm it is sustainable.`);
  else if (r > 1.03) o.push(`Bid is ${Math.round((r - 1) * 100)}% above the estimate. Check for scope assumptions that explain the premium.`);
  else o.push('Bid is close to the estimated value, within the expected range.');
  o.push(missing.length ? `${missing.length} item(s) need review: ${missing.slice(0, 2).map((m) => m.label).join('; ')}${missing.length > 2 ? '…' : ''}.` : 'All declared requirements appear to be matched. Documents still need official verification.');
  return o;
}
export function bidsFor(t, real) {
  if (t.status === 'Draft') return [];
  const sample = SAMPLE.map((p, i) => { const e = check(t.req, p), amount = +(t.value * p.f).toFixed(4); return { id: `${t.id}-S${i}`, name: p.name, amount, met: e.met, missing: e.missing, pct: e.pct, ok: !e.missing.length, sample: true, notes: observations(t, amount, e.missing) }; });
  const mine = real.filter((b) => b.tenderId === t.id).map((b) => ({ ...b, ok: !b.missing.length, sample: false, notes: observations(t, b.amount, b.missing) }));
  return [...mine, ...sample];
}

// ---- Tender Health (scoring) ----
const lvl = (s) => (s >= 60 ? 'High' : s >= 35 ? 'Medium' : 'Low');
export function analyze(t) {
  const r = t.req, V = t.value || 0, days = subDays(t) ?? Math.max(daysLeft(t.deadline), 0), nw = (t.works || []).length;
  const text = `${t.title} ${(t.works || []).map((w) => w.name + ' ' + w.desc).join(' ')}`, words = text.split(/\s+/).filter(Boolean).length, ratio = r.turnover / (V || 1), nreq = r.certs.length + r.docs.length;
  let c = 10; const cr = [];
  if (r.years >= 10) { c += 25; cr.push(`A ${r.years}-year experience requirement narrows the pool of bidders.`); }
  if (r.projects >= 4) { c += 20; cr.push(`${r.projects} similar projects are required, which few bidders can show.`); }
  if (ratio > 1.2) { c += 30; cr.push(`The turnover threshold is ${Math.round(ratio * 100)}% of the estimated value, which is high.`); }
  if (nreq >= 8) { c += 20; cr.push('Multiple mandatory requirements may reduce the pool of eligible bidders.'); }
  if (!cr.length) cr.push('Requirements look proportionate, so broad participation is plausible.');
  const need = V > 10 ? 21 : V > 1 ? 14 : 10, tm = days < need ? Math.min(95, 40 + (need - days) * 5) : 15;
  const tr = [days < need ? `The submission period is ${days} days. Consider whether this provides sufficient time for eligible bidders to prepare the required documents (about ${need} days is typical at this value).` : `A ${days}-day submission period gives bidders reasonable time to prepare.`];
  const x = Math.min(95, 15 + r.certs.length * 8 + r.docs.length * 5 + r.projects * 4 + (r.other ? 10 : 0) + (r.registration ? 5 : 0) + nw * 3 + (words < 25 ? 20 : 0));
  const xr = [`${r.certs.length} certification(s) and ${r.docs.length} document(s) must be checked for every bidder.`];
  if (words < 25) xr.push('The work description is short, which can lead to clarification queries.');
  const rt = Math.round(0.4 * c + 0.35 * tm + 0.25 * x), rr = [];
  if (c >= 35) rr.push('Potential factor: limited response could lead to cancellation or re-issue.');
  if (tm >= 35) rr.push('Potential factor: a short window can produce incomplete or non-responsive bids.');
  if (x >= 60) rr.push('Potential factor: complex conditions can lead to disputes or re-evaluation.');
  if (!rr.length) rr.push('No major re-tender factors identified from the details entered.');
  const score = Math.max(5, 100 - Math.round(0.3 * c + 0.25 * tm + 0.2 * x + 0.25 * rt));
  return { score, days, items: [
    { name: 'Competition Insight', pct: Math.min(c, 95), level: lvl(c), reasons: cr },
    { name: 'Timeline Insight', pct: tm, level: lvl(tm), reasons: tr },
    { name: 'Requirement Complexity', pct: x, level: lvl(x), reasons: xr },
    { name: 'Re-tender Risk', pct: rt, level: lvl(rt), reasons: rr },
  ] };
}

// ---- Mock CivilBid Copilot. Replace these three functions with calls to a real AI API. ----
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const explain = async (t) => { await wait(400); const w = t.works[0]; return `${t.issuer} invites bids for ${t.works.length > 1 ? t.works.length + ' works' : 'one work'}: ${w.name} Estimated value ${fmt(t.value)}. Bids close ${dl(t.deadline)} (${Math.max(daysLeft(t.deadline), 0)} days left). You need ${t.req.years}+ years of experience, ${t.req.projects}+ similar projects and ₹${t.req.turnover} Cr turnover.`; };
export const needs = async (t) => { await wait(300); const r = t.req; return `Documents: ${r.docs.join(', ') || 'none listed'}.\nCertifications: ${r.certs.join(', ') || 'none listed'}.\nExperience: ${r.years}+ years and ${r.projects}+ similar projects.\nTurnover: ₹${r.turnover} Cr or more.${r.contractorCat !== 'Any' ? `\nContractor category: ${r.contractorCat}.` : ''}${r.registration ? `\nRegistration: ${r.registration}.` : ''}${r.other ? `\nOther: ${r.other}.` : ''}`; };
export const askCopilot = async (q, t, p) => {
  await wait(500); const s = q.toLowerCase(), has = (...w) => w.some((x) => s.includes(x)), r = t.req;
  if (has('match', 'ready', 'eligib', 'qualify')) { const m = check(r, p); return `Your Opportunity Match is ${m.pct}%. ${m.missing.length ? `Items to review: ${m.missing.map((x) => x.label).join('; ')}.` : 'All listed requirements appear to be matched.'} Final eligibility is decided in the official evaluation.`; }
  if (has('document', 'paper', 'upload')) return `Required documents: ${r.docs.join(', ')}.`;
  if (has('deadline', 'date', 'when', 'last day', 'open')) return `Bid submission runs ${dl(t.subStart)} to ${dl(t.deadline)}${t.techOpening ? `; technical bids open ${dt(t.techOpening)}` : ''}.`;
  if (has('experience', 'years', 'project')) return `You need ${r.years}+ years of experience and ${r.projects}+ similar projects.`;
  if (has('turnover', 'financ', 'capacity')) return `Minimum annual turnover is ₹${r.turnover} Cr. The estimated value is ${fmt(t.value)}.`;
  if (has('certif', 'licen', 'iso')) return r.certs.length ? `Required certifications: ${r.certs.join(', ')}.` : 'No separate certifications are listed.';
  if (has('security', 'emd', 'fee', 'cost')) return t.works.map((w, i) => `Work ${w.no || i + 1}: estimate ${fmt(w.value)}, bid security ${w.security ? fmt(w.security) : 'not specified'}, tender cost ${w.docCost || 'not specified'}.`).join('\n');
  if (has('complet', 'duration', 'time')) return t.works.map((w, i) => `Work ${w.no || i + 1}: ${w.completion || 'not specified'}.`).join('\n');
  return 'I can help with documents, dates, experience, turnover, certifications, fees and your Opportunity Match. Try "What documents do I need?"';
};
