import { useState, useEffect, useRef } from 'react';
import { Landmark, Building2, Handshake, ShieldCheck, Target, Bot, CheckCircle2, XCircle, AlertTriangle, LayoutDashboard, FilePlus2, FileText, BarChart3, UserCircle, LogOut, Search, Send, ArrowRight, ArrowLeft, Eye, Pencil, Plus, Trash2, Zap, ListChecks, MessageSquare, Clock, BadgeCheck, Menu, X, Mail, Phone, Info } from 'lucide-react';
import { configured, supabase, fetchTenders, fetchBids, fetchBidCount, syncTenders, syncBids, fetchProfile, saveProfileData, signUpUser, signIn, signOut } from './store.js';
import { BRAND, DEPTS, CERTS, DOCS, LVL, fmt, dl, dt, daysLeft, subDays, load, save, check, bidsFor, analyze } from './data.js';

const go = (p) => { location.hash = p; };
const useHash = () => {
  const [h, setH] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const f = () => {
      const raw = location.hash.slice(1) || '/';
      setH(raw);
      if (raw.startsWith('/')) {
        window.scrollTo(0, 0);
      } else {
        const el = document.getElementById(raw);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
};
const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const h = useHash();
  const [profile, setProfile] = useState(null);
  const [session, setS] = useState(null);
  const [tenders, setTState] = useState([]);
  const [bids, setBState] = useState([]);
  const [bidCount, setBidCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [dept, setDept] = useState(() => load('cb_dept', null));
  const refreshRef = useRef(null);
  useEffect(() => save('cb_dept', dept), [dept]);

  // Load live data from the database and keep it fresh (realtime + 30s fallback poll).
  useEffect(() => {
    if (!configured) { setReady(true); return undefined; }
    let alive = true;
    const refresh = async () => {
      try {
        const [t, b, c] = await Promise.all([fetchTenders(), fetchBids(), fetchBidCount()]);
        if (alive) { setTState(t); setBState(b); setBidCount(c); setNotice(''); }
      } catch (e) { if (alive) setNotice('Could not load live data: ' + e.message); }
    };
    refreshRef.current = refresh;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const p = await fetchProfile(data.session.user.id);
          if (alive && p) { setProfile(p); setS({ username: p.username, role: p.role, dept: p.role === 'gov' ? p.department : null }); }
        }
      } catch (e) { if (alive) setNotice('Could not restore your session: ' + e.message); }
      await refresh();
      if (alive) setReady(true);
    })();
    const channel = supabase.channel('civilbid-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, refresh)
      .subscribe();
    const timer = setInterval(refresh, 30000);
    return () => { alive = false; clearInterval(timer); supabase.removeChannel(channel); };
  }, []);

  const users = profile ? [profile] : [];
  const setT = (next) => {
    const prev = tenders; setTState(next);
    syncTenders(prev, next, profile.id).catch((e) => { setNotice('Could not save tender: ' + e.message); refreshRef.current?.(); });
  };
  const setB = (next) => {
    const prev = bids; setBState(next);
    syncBids(prev, next, profile.id).then(() => refreshRef.current?.()).catch((e) => { setNotice('Could not save bid: ' + e.message); refreshRef.current?.(); });
  };
  const saveProfile = (patch) => {
    setProfile({ ...profile, ...patch });
    saveProfileData(profile.id, patch, profile).catch((e) => setNotice('Could not save profile: ' + e.message));
  };
  const user = session && profile;
  const [, a, b, c] = h.split('/');
  const authPg = b === 'login' || b === 'signup';
  let redirect = null;
  if (!ready) redirect = null;
  else if (a === 'app' && (!user || user.role === 'bidder')) redirect = '/choose';
  else if (a === 'bidder' && !authPg && (!user || user.role !== 'bidder')) redirect = '/bidder/login';
  else if (a === 'bidder' && !authPg && b !== 'interests' && !user.interests?.length) redirect = '/bidder/interests';
  else if (a === 'gov' && authPg && !dept) redirect = '/gov/dept';
  useEffect(() => { if (redirect) go(redirect); }, [redirect]);
  if (redirect) return null;
  if (!configured) return <SetupNeeded />;
  if (!ready) return <div className="plain"><p style={{ padding: 32 }}>Loading live data…</p></div>;
  const ctx = { tenders, setT, bids, setB, bidCount, session, user, users, saveProfile };
  const enter = (u) => { setS({ username: u.username, role: u.role, dept: u.role === 'gov' ? (u.department || dept) : null }); go(u.role === 'bidder' ? (u.interests?.length ? '/bidder/browse' : '/bidder/interests') : '/app/dashboard'); };
  const login = async (role, username, password) => {
    const authUser = await signIn(role, username, password);
    if (!authUser) return false;
    const p = await fetchProfile(authUser.id);
    if (!p) return false;
    setProfile(p); await refreshRef.current?.(); enter(p);
    return true;
  };
  const signup = async (u) => {
    const r = await signUpUser(u);
    if (r.error) return r.error;
    const p = await fetchProfile(r.user.id);
    if (!p) return 'Account created, but the profile could not be loaded. Please log in.';
    setProfile(p); await refreshRef.current?.(); enter(p);
    return '';
  };
  const out = async () => { await signOut(); setS(null); setProfile(null); go('/'); refreshRef.current?.(); };
  if (!a) return <><Banner text={notice} /><Landing ctx={ctx} /></>;
  if (a === 'choose') return <Choose />;
  if (a === 'gov' && b === 'dept') return <DeptPick dept={dept} pick={(d) => { setDept(d); go('/gov/login'); }} />;
  if (authPg) return <Auth role={a} mode={b} dept={dept} login={login} signup={signup} />;
  if (a === 'app') return <IssuerShell page={b || 'dashboard'} ctx={ctx} out={out} />;
  if (a === 'bidder') return <BidderShell page={b || 'browse'} id={c} ctx={ctx} out={out} />;
  return <Landing ctx={ctx} />;
}

const Banner = ({ text }) => text ? <div role="alert" style={{ background: '#fdecea', color: '#8a1c13', padding: '8px 16px', fontSize: 14 }}>{text}</div> : null;
function SetupNeeded() {
  return <div className="plain"><main className="narrow wide"><h1>Backend not connected</h1><p className="lead2">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your environment (Vercel: Project, Settings, Environment Variables), then redeploy. See the README.</p></main></div>;
}
const Logo = ({ light }) => <a href="#/" className={`logo ${light ? 'light' : ''}`}><span className="logo-mark"><ShieldCheck size={18} /></span>{BRAND}</a>;
const Pill = ({ tone = 'gray', children }) => <span className={`pill ${tone}`}>{children}</span>;
const statusTone = { Published: 'green', Draft: 'amber', Awarded: 'blue', Closed: 'gray' };
const riskTone = { Low: 'green', Medium: 'amber', High: 'red' };
const Head = ({ t, s, children }) => <div className="pg-head"><div><h1>{t}</h1>{s && <p>{s}</p>}</div>{children}</div>;

/* ---------- Landing ---------- */
function Landing({ ctx }) {
  const [ev, setEv] = useState(null);
  const [tenderFilter, setTenderFilter] = useState('All');
  const [menu, setMenu] = useState(false);
  useEffect(() => { const k = (e) => e.key === 'Escape' && setMenu(false); addEventListener('keydown', k); document.body.style.overflow = menu ? 'hidden' : ''; return () => { removeEventListener('keydown', k); document.body.style.overflow = ''; }; }, [menu]);

  useEffect(() => {
    const f = (e) => { e.preventDefault(); setEv(e); };
    addEventListener('beforeinstallprompt', f);
    return () => removeEventListener('beforeinstallprompt', f);
  }, []);


  const allTenders = ctx?.tenders || [];
  const publishedTenders = allTenders.filter((t) => t.status === 'Published');
  const displayedTenders = tenderFilter === 'All'
    ? publishedTenders
    : publishedTenders.filter((t) => (tenderFilter === 'Government' ? t.issuerType === 'Government' : t.issuerType === 'Organization'));

  return (
    <div className="landing">
      <div className={`drawer-bg ${menu ? 'open' : ''}`} onClick={() => setMenu(false)} />
      <aside className={`drawer ${menu ? 'open' : ''}`} aria-hidden={!menu} aria-label="Main menu">
        <div className="drawer-top"><Logo light /><button className="drawer-x" onClick={() => setMenu(false)} aria-label="Close menu"><X size={20} /></button></div>
        <nav onClick={() => setMenu(false)}>
          <a href="#/gov/dept"><Landmark size={18} />Government Login</a>
          <a href="#/bidder/login"><Handshake size={18} />Bidder Login</a>
          <a href="#/org/login"><Building2 size={18} />Organization Login</a>
          <a href="#live-tenders"><FileText size={18} />Live Tenders</a>
          <a href="#about"><Info size={18} />About Us</a>
          <a href="#contact"><Mail size={18} />Contact Us</a>
        </nav>
        <div className="drawer-foot"><a href="mailto:a@iiitg.com"><Mail size={15} /> a@iiitg.com</a><a href="tel:9123456780"><Phone size={15} /> 9123456780</a></div>
      </aside>
      {/* Navigation - Seamless background, balanced role access */}
      <header className="topbar">
        <div className="topbar-brand">
          <button className="menu-btn" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}><Menu size={22} /></button>
          <Logo />
          <span className="topbar-tag">Civil & Infrastructure e-Procurement</span>
        </div>
        <nav className="topbar-nav">
          <a href="#gov-section" className="nav-link"><Landmark size={15} /> Government</a>
          <a href="#org-section" className="nav-link"><Building2 size={15} /> Organizations</a>
          <a href="#bidder-section" className="nav-link"><Handshake size={15} /> Bidders</a>
          <a href="#live-tenders" className="nav-link"><FileText size={15} /> Live Tenders</a>
          {ev && <button className="btn ghost sm" onClick={() => ev.prompt()}>Install app</button>}
          <a href="#/choose" className="btn sm alt">Portals & Sign in <ArrowRight size={14} /></a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-main">
        <div className="hero-content">
          <div className="hero-kicker">
            <ShieldCheck size={14} /> GFR 2017 & CPWD COMPLIANT E-PROCUREMENT
          </div>
          <h1>
            Civil Infrastructure Tenders.<br />
            <em>Engineered with Integrity.</em>
          </h1>
          <p className="hero-lead">
            CivilBid connects Government Departments, Private Organizations, and Verified Civil Contractors on a single transparent e-tendering network. Standardized NIT drafting, pre-publish Tender Health audits, and intelligent bid matching.
          </p>

          {/* Direct Stakeholder Portals Bar */}
          <div className="hero-portals-bar">
            <a href="#gov-section" className="portal-pill-btn">
              <Landmark size={16} />
              <span><strong>Government</strong>Public Works & Depts</span>
            </a>
            <a href="#org-section" className="portal-pill-btn">
              <Building2 size={16} />
              <span><strong>Organization</strong>Private & Corporate</span>
            </a>
            <a href="#bidder-section" className="portal-pill-btn">
              <Handshake size={16} />
              <span><strong>Bidder</strong>Contractors & Suppliers</span>
            </a>
          </div>

          <div className="cta-row">
            <a className="btn lg alt" href="#/choose">Access All Portals <ArrowRight size={18} /></a>
            <a className="btn lg ghost" href="#live-tenders">Browse Live Tenders</a>
          </div>
        </div>

        <aside className="hero-board" aria-label="Live tender overview">
          <div className="hb-head"><b>Live Tenders</b><a href="#live-tenders">View all <ArrowRight size={13} /></a></div>
          <div className="hb-stats">{[['Open tenders', ctx.tenders.filter((t) => t.status === 'Published' && daysLeft(t.deadline) >= 0).length], ['Departments', new Set(ctx.tenders.map((t) => t.department)).size], ['Bids received', ctx.bidCount]].map(([l, v]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
          <div className="hb-list">{ctx.tenders.filter((t) => t.status === 'Published' && daysLeft(t.deadline) >= 0).sort((x, y) => new Date(x.deadline) - new Date(y.deadline)).slice(0, 4).map((t) => { const d = daysLeft(t.deadline), sc = analyze(t).score; return <a key={t.id} href="#live-tenders" className="hb-row"><span className="hb-ic"><FileText size={18} /></span><div><b>{t.title.length > 44 ? t.title.slice(0, 44) + '…' : t.title}</b><small>{t.department} · {t.location} · {fmt(t.value)}</small></div><div className="hb-end"><Pill tone={d <= 7 ? 'amber' : 'green'}>{d <= 7 ? `${d}d left` : 'Open'}</Pill><small>Health {sc}/100</small></div></a>; })}</div>
        </aside>
      </section>

      {/* Institutional Statistics Banner */}
      <section className="metrics-banner">
        <div className="metrics-grid">
          <div className="metric-box">
            <b>6</b>
            <span>Government Departments Active</span>
            <small>PWD, Health, Water, Municipal, Education, Railways</small>
          </div>
          <div className="metric-box">
            <b>₹142.8 Cr</b>
            <span>Active Tender Pipeline</span>
            <small>Total estimated value of published civil opportunities</small>
          </div>
          <div className="metric-box">
            <b>240+</b>
            <span>Verified Contractors & Vendors</span>
            <small>Prequalified across Class A, B, C, and D ratings</small>
          </div>
          <div className="metric-box">
            <b>100%</b>
            <span>GFR 2017 & CPWD Compliance</span>
            <small>Two-envelope technical and financial scrutiny</small>
          </div>
        </div>
      </section>

      {/* SECTION 1: Government Departments & Public Authorities */}
      <section id="gov-section" className="sect-portal gov-portal">
        <div className="portal-header">
          <div className="portal-tag"><Landmark size={15} /> PUBLIC SECTOR PROCUREMENT</div>
          <h2>Government Departments & Public Authorities</h2>
          <p className="portal-sub">
            Purpose-built for Executive Engineers, Municipal Commissioners, and Departmental Procurement Committees. Standardized NIT drafting, statutory compliance checks, and transparent bid scrutiny.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-item">
            <span className="pillar-num">01</span>
            <h3>Standardized NIT Drafting</h3>
            <p>Generate Notice Inviting Tenders (NIT) adhering strictly to CPWD and State PWD specifications, auto-calculating bid security, completion periods, and eligibility criteria.</p>
          </div>
          <div className="pillar-item">
            <span className="pillar-num">02</span>
            <h3>Pre-Publish Tender Health Audit</h3>
            <p>Pre-publication algorithmic audit evaluates submission timeline adequacy (Rule 161 GFR 2017), restrictive eligibility, and competition health before the notice goes public.</p>
          </div>
          <div className="pillar-item">
            <span className="pillar-num">03</span>
            <h3>Two-Envelope Bid Scrutiny</h3>
            <p>Automated comparative technical evaluation, quote variance checks against departmental estimates, and L1 bidder detection with complete audit trails.</p>
          </div>
        </div>

        <div className="portal-dept-showcase">
          <span className="showcase-title">Departments Active on Platform:</span>
          <div className="dept-pills">
            {DEPTS.map((d) => (
              <span key={d} className="dept-pill"><Landmark size={13} /> {d}</span>
            ))}
          </div>
        </div>

        <div className="portal-cta-row">
          <a className="btn alt" href="#/gov/dept">Select Department & Issue Tender <ArrowRight size={15} /></a>
          <a className="btn ghost" href="#/gov/login">Official Department Sign In</a>
        </div>
      </section>

      {/* SECTION 2: Private Companies & Commercial Organizations */}
      <section id="org-section" className="sect-portal org-portal">
        <div className="portal-header">
          <div className="portal-tag"><Building2 size={15} /> COMMERCIAL & INDUSTRIAL PROCUREMENT</div>
          <h2>Private Enterprises & Commercial Organizations</h2>
          <p className="portal-sub">
            Enterprise-grade procurement for infrastructure developers, logistics operators, manufacturing plants, and corporate campuses without administrative bottlenecks.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-item">
            <span className="pillar-num">01</span>
            <h3>Rapid Commercial RFP Issuance</h3>
            <p>Draft, specify scope, define milestone requirements, and publish corporate tenders in minutes with customized contractor requirements and site conditions.</p>
          </div>
          <div className="pillar-item">
            <span className="pillar-num">02</span>
            <h3>Prequalified Contractor Discovery</h3>
            <p>Direct access to vetted civil, MEP, and industrial contractors filtered by verifiable turnover, past project delivery, and safety certifications.</p>
          </div>
          <div className="pillar-item">
            <span className="pillar-num">03</span>
            <h3>Rate Benchmark & Variance Tracking</h3>
            <p>Real-time comparison of incoming contractor bids against internal engineering estimates to avoid cost overruns and price anomalies.</p>
          </div>
        </div>

        <div className="portal-dept-showcase">
          <span className="showcase-title">Commercial Issuing Profiles:</span>
          <div className="dept-pills">
            <span className="dept-pill"><Building2 size={13} /> Infrastructure Developers</span>
            <span className="dept-pill"><Building2 size={13} /> Logistics & Distribution Parks</span>
            <span className="dept-pill"><Building2 size={13} /> Commercial Real Estate</span>
            <span className="dept-pill"><Building2 size={13} /> Industrial Manufacturing</span>
          </div>
        </div>

        <div className="portal-cta-row">
          <a className="btn alt" href="#/org/login">Sign In as Organization <ArrowRight size={15} /></a>
          <a className="btn ghost" href="#/org/signup">Register New Organization</a>
        </div>
      </section>

      {/* SECTION 3: Contractors, Builders & Civil Suppliers */}
      <section id="bidder-section" className="sect-portal bidder-portal">
        <div className="portal-header">
          <div className="portal-tag"><Handshake size={15} /> CONTRACTOR INTELLIGENCE & BIDDING</div>
          <h2>Contractors, Builders & Civil Suppliers</h2>
          <p className="portal-sub">
            Leveling the field for registered contractors (Class A–D), specialized MEP vendors, and MSMEs with instant eligibility checks, AI tender clause breakdown, and bid preparation checklists.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-item">
            <span className="pillar-num">01</span>
            <h3>Opportunity Match Score (0–100%)</h3>
            <p>Instant compatibility audit calculating how closely your firm's turnover, completed projects, class, and licenses fit the tender's mandatory requirements.</p>
          </div>
          <div className="pillar-item">
            <span className="pillar-num">02</span>
            <h3>CivilBid Copilot (AI Tender Breakdown)</h3>
            <p>Chat directly with lengthy tender notices. Extract key dates, EMD exemption rules, penalty conditions, and technical requirements in seconds.</p>
          </div>
          <div className="pillar-item">
            <span className="pillar-num">03</span>
            <h3>Zero-Disqualification Document Audit</h3>
            <p>Interactive document checklist cross-references your uploaded credentials with the tender's mandatory list to prevent administrative disqualification.</p>
          </div>
        </div>

        <div className="portal-dept-showcase">
          <span className="showcase-title">Supported Civil Categories:</span>
          <div className="dept-pills">
            <span className="dept-pill"><Handshake size={13} /> Building Construction</span>
            <span className="dept-pill"><Handshake size={13} /> Civil & Road Works</span>
            <span className="dept-pill"><Handshake size={13} /> Electrical & Smart Lighting</span>
            <span className="dept-pill"><Handshake size={13} /> Medical & Hospital Equipment</span>
            <span className="dept-pill"><Handshake size={13} /> Water & Embankment Works</span>
          </div>
        </div>

        <div className="portal-cta-row">
          <a className="btn alt" href="#/bidder/login">Explore Bidding Portal <ArrowRight size={15} /></a>
          <a className="btn ghost" href="#/bidder/signup">Register as Contractor</a>
        </div>
      </section>

      {/* SECTION 4: Live Tender Opportunities Board */}
      <section id="live-tenders" className="sect-portal live-tenders-sect">
        <div className="portal-header">
          <div className="portal-tag"><FileText size={15} /> LIVE PROCUREMENT FEED</div>
          <h2>Active Tender Notices</h2>
          <p className="portal-sub">
            Verified civil works and procurement opportunities open for bid submission across participating authorities.
          </p>

          <div className="tender-filter-bar">
            {['All', 'Government', 'Organization'].map((f) => (
              <button
                key={f}
                className={`filter-btn ${tenderFilter === f ? 'on' : ''}`}
                onClick={() => setTenderFilter(f)}
              >
                {f} Tenders
              </button>
            ))}
          </div>
        </div>

        <div className="live-tenders-grid">
          {displayedTenders.map((t) => {
            const days = daysLeft(t.deadline);
            return (
              <article key={t.id} className="live-t-card">
                <div className="t-card-top">
                  <span className={`issuer-tag ${t.issuerType === 'Government' ? 'gov' : 'org'}`}>
                    {t.issuerType === 'Government' ? <Landmark size={12} /> : <Building2 size={12} />}
                    {t.issuerType}
                  </span>
                  <span className="category-pill">{t.works[0]?.category || 'Civil Works'}</span>
                  <span className={`days-badge ${days <= 7 ? 'urgent' : ''}`}>
                    <Clock size={12} /> {days >= 0 ? `${days}d left` : 'Closed'}
                  </span>
                </div>
                <h3>{t.title}</h3>
                <p className="t-issuer-line">{t.issuer} · Notice: {t.noticeNo || t.id}</p>
                <div className="t-cost-row">
                  <div>
                    <span className="t-label">Estimated Cost</span>
                    <b>{fmt(t.value)}</b>
                  </div>
                  <div>
                    <span className="t-label">Bid Security (EMD)</span>
                    <b>{fmt(t.works[0]?.security || t.value * 0.1)}</b>
                  </div>
                </div>
                <div className="t-card-foot">
                  <span className="t-deadline"><Clock size={12} /> Due: {dl(t.deadline)}</span>
                  <a className="btn sm alt" href={`#/bidder/tender/${t.id}`}>Check Match & Bid →</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Closing Call to Action */}
      <section id="about" className="sect-portal about-sect">
        <div className="about-grid">
          <div><span className="eyebrow">About Us</span><h2>Transparent e-procurement for civil infrastructure</h2></div>
          <p>CivilBid brings Government Departments, Private Organizations and Contractors onto one e-tendering platform. Issuers draft standard tender notices and review a Tender Health check before publishing. Bidders discover opportunities that match their profile and submit bids online.</p>
        </div>
      </section>

      <section id="contact" className="sect-portal contact-sect">
        <div className="about-grid">
          <div><span className="eyebrow">Contact Us</span><h2>We're here to help</h2></div>
          <div className="contact-cards">
            <a href="mailto:a@iiitg.com" className="contact-card"><span><Mail size={20} /></span><div><small>Email</small><b>a@iiitg.com</b></div></a>
            <a href="tel:9123456780" className="contact-card"><span><Phone size={20} /></span><div><small>Phone</small><b>9123456780</b></div></a>
          </div>
        </div>
      </section>

      <section className="closing-banner">
        <div>
          <h2>One unified platform. Verified procurement.<br />Better decisions for every stakeholder.</h2>
          <p>Join public departments, private enterprises, and qualified contractors transforming civil procurement.</p>
        </div>
        <div className="cta-row">
          <a className="btn lg alt" href="#/choose">Select Your Journey <ArrowRight size={18} /></a>
          <a className="btn lg ghost" href="#live-tenders">Browse Opportunities</a>
        </div>
      </section>

      {/* Institutional Enterprise Footer */}
      <footer className="portal-footer">
        <div className="footer-cols">
          <div className="foot-brand-col">
            <Logo light />
            <p>CivilBid is an intelligent civil e-procurement platform designed to maximize transparency, streamline Notice Inviting Tender (NIT) creation, and deliver objective tender health audits.</p>
            <span className="compliance-tag">Standardized under CPWD and General Financial Rules (GFR 2017)</span>
          </div>

          <div className="foot-links-col">
            <h4>Procurement Portals</h4>
            <a href="#/gov/dept">Government Department Portal</a>
            <a href="#/org/login">Organization Tender Portal</a>
            <a href="#/bidder/login">Contractor & Bidder Portal</a>
            <a href="#/choose">Choose Journey</a>
          </div>

          <div className="foot-links-col">
            <h4>Standards & Verification</h4>
            <span>CPWD Schedule of Rates</span>
            <span>Two-Envelope Bid Scrutiny</span>
            <span>Automated Tender Health Audit</span>
            <span>Algorithmic Opportunity Match</span>
          </div>

          <div className="foot-links-col">
            <h4>Support & Portals</h4>
            <a href="#/choose">All Portals</a>
            <a href="#live-tenders">Browse Live Tenders</a>
            <a href="#gov-section">Government Portal</a>
            <a href="#bidder-section">Contractor Registration</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} CivilBid e-Procurement Systems. All rights reserved.</span>
          <span>Aligned with Public Procurement Transparency Guidelines</span>
        </div>
      </footer>
    </div>
  );
}

function Choose() {
  const cards = [[Landmark, 'Government', 'For government departments and procurement officials.', '/gov/dept'], [Building2, 'Organization', 'For private companies and organizations that want to issue tenders.', '/org/login'], [Handshake, 'Bidder', 'For businesses looking for tender opportunities.', '/bidder/login']];
  return (<div className="plain"><header className="topbar"><Logo /><nav><a href="#/">Home</a></nav></header><main className="narrow wide"><h1>How will you use CivilBid?</h1><p className="lead2">Select your portal to sign in or register your organization.</p>
    <div className="roles">{cards.map(([Ic, t, d, to]) => <a key={t} href={`#${to}`} className="role"><Ic size={28} /><h3>{t}</h3><p>{d}</p><span className="btn sm">Continue <ArrowRight size={14} /></span></a>)}</div></main></div>);
}
function DeptPick({ dept, pick }) {
  return (<div className="plain"><header className="topbar"><Logo /><nav><a href="#/choose">Back</a></nav></header><main className="narrow wide"><h1>Which department do you represent?</h1><p className="lead2">Your tenders and bids are organised by department.</p>
    <div className="dept-grid three">{DEPTS.map((d) => <button key={d} className={`dept ${dept === d ? 'on' : ''}`} onClick={() => pick(d)}><Landmark size={20} />{d}</button>)}</div></main></div>);
}

/* ---------- Auth ---------- */
const FIELDS = {
  gov: [['fullName', 'Full name'], ['department', 'Official department', 'dept'], ['designation', 'Designation'], ['email', 'Official email', 'email'], ['phone', 'Phone number', 'tel'], ['address', 'Office address', 'area']],
  org: [['orgName', 'Organization name'], ['orgType', 'Organization type', 'sel:Private Limited,LLP,Partnership,Proprietorship,NGO / Trust,Public Sector Undertaking'], ['contact', 'Contact person'], ['email', 'Email', 'email'], ['phone', 'Phone number', 'tel'], ['address', 'Registered / contact address', 'area']],
  bidder: [['name', 'Company / business name'], ['contact', 'Contact person'], ['businessType', 'Business type', 'sel:Private Limited,LLP,Partnership,Proprietorship,Cooperative'], ['email', 'Email', 'email'], ['phone', 'Phone number', 'tel'], ['address', 'Business address', 'area'], ['years', 'Years of experience', 'number'], ['projects', 'Previous similar projects completed', 'number'], ['turnover', 'Annual turnover (₹ Cr)', 'number'], ['contractorClass', 'Contractor class', 'sel:A,B,C,D,Unclassified'], ['certs', 'Certifications', 'certs'], ['docs', 'Documents you can provide', 'docs']],
};
const CC = [['+91', 'India', 10], ['+1', 'USA / Canada', 10], ['+44', 'UK', 10], ['+971', 'UAE', 9], ['+880', 'Bangladesh', 10], ['+977', 'Nepal', 10], ['+94', 'Sri Lanka', 9], ['+65', 'Singapore', 8], ['+61', 'Australia', 9]];
const ROLE = { gov: 'Government', org: 'Organization', bidder: 'Bidder' };
function Auth({ role, mode, dept, login, signup }) {
  const label = ROLE[role] || ROLE.bidder, su = mode === 'signup';
  const [v, setV] = useState({ username: '', password: '', certs: [], docs: [], department: dept || DEPTS[0], contractorClass: 'Unclassified' });
  const [err, setErr] = useState('');
  const set = (k, x) => setV({ ...v, [k]: x });
  const tog = (k, x) => set(k, v[k].includes(x) ? v[k].filter((y) => y !== x) : [...v[k], x]);
  const submit = async (e) => { e.preventDefault(); setErr(''); if (su) { const m = await signup({ ...v, phone: v.phone ? `${v.cc || '+91'} ${v.phone}` : v.phone, role, interests: [] }); if (m) setErr(m); } else if (!(await login(role, v.username, v.password))) setErr('Invalid username or password. Please verify your credentials and try again.'); };
  const field = ([k, l, ty = 'text']) => ty === 'certs' || ty === 'docs' ? <fieldset className="w2" key={k}><legend>{l}</legend><div className="chips">{(ty === 'certs' ? CERTS : DOCS).map((c) => <label key={c} className={`chip ${v[k].includes(c) ? 'on' : ''}`}><input type="checkbox" checked={v[k].includes(c)} onChange={() => tog(k, c)} />{c}</label>)}</div></fieldset>
    : ty === 'email' || ty === 'tel' ? (() => { const tel = ty === 'tel', ok = tel ? (v.phone || '').length >= ((CC.find((c) => c[0] === (v.cc || '+91')) || [])[2] || 8) : /^\S+@\S+\.\S+$/.test(v[k] || ''), done = v[k + 'Ok']; return <div className={`vfield ${tel ? '' : ''}`} key={k}><span className="vlabel">{l}</span><div className="vrow">{tel && <select className="cc" aria-label="Country code" value={v.cc || '+91'} onChange={(e) => setV({ ...v, cc: e.target.value, phone: '', phoneOk: false })}>{CC.map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}</select>}<input required type={tel ? 'tel' : 'email'} inputMode={tel ? 'numeric' : 'email'} maxLength={tel ? (CC.find((c) => c[0] === (v.cc || '+91')) || [])[2] : undefined} placeholder={tel ? 'Mobile number' : 'name@example.com'} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: tel ? e.target.value.replace(/\D/g, '') : e.target.value, [k + 'Ok']: false })} />{done ? <span className="vok"><BadgeCheck size={18} /> Verified</span> : <button type="button" className="btn ghost sm vbtn" disabled={!ok} onClick={() => set(k + 'Ok', true)}>Verify</button>}</div></div>; })()
    : <label key={k} className={ty === 'area' ? 'w2' : ''}>{l}{ty === 'area' ? <textarea rows="2" required value={v[k] || ''} onChange={(e) => set(k, e.target.value)} /> : ty === 'dept' ? <select value={v[k]} onChange={(e) => set(k, e.target.value)}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select> : ty.startsWith('sel:') ? <select value={v[k] || ty.slice(4).split(',')[0]} onChange={(e) => set(k, e.target.value)}>{ty.slice(4).split(',').map((d) => <option key={d}>{d}</option>)}</select> : <input type={ty} min={ty === 'number' ? 0 : undefined} step={ty === 'number' ? 'any' : undefined} required value={v[k] ?? ''} onChange={(e) => set(k, e.target.value)} />}</label>;
  return (<div className="login-page"><div className="login-side"><Logo light /><div><h2>{label} {su ? 'account' : 'sign in'}</h2><p>{role === 'gov' ? `Issuing as ${dept || 'a department'}. Create, analyze and publish public tenders.` : role === 'org' ? 'Issue your own tenders and compare incoming bids.' : 'Discover opportunities and see how well they match your profile.'}</p></div></div>
    <form className={`login-card ${su ? 'wide' : ''}`} onSubmit={submit}>
      <h1>{su ? `Create ${label} account` : `${label} login`}</h1>
      <div className="form">{su && FIELDS[role].map(field)}
        <label>Username or Email<input required value={v.username} onChange={(e) => set('username', e.target.value)} autoComplete="username" /></label>
        <label>Password<input type="password" required value={v.password} onChange={(e) => set('password', e.target.value)} autoComplete="current-password" /></label></div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn lg" type="submit">{su ? 'Create account' : 'Login'}</button>
      <a className="back" href={`#/${role}/${su ? 'login' : 'signup'}`}>{su ? 'Already have an account? Login' : 'Create account'}</a><a className="back" href="#/choose">Choose a different journey</a>
    </form></div>);
}

/* ---------- Shared tender components ---------- */
const introFor = (t) => t.intro || (t.issuerType === 'Government' ? 'On behalf of the authorized issuing authority, online bids are invited through e-tendering from eligible and registered firms for the following works.' : `${t.issuer || 'The issuing organization'} invites competitive bids from qualified and registered firms for the following works.`);
function NoticeView({ t }) {
  const days = subDays(t), ws = t.works || [], r = t.req;
  const rows = [['Tender publication', dl(t.publication)], ['Bid document availability', dl(t.docStart)], ['Bid submission period', t.subStart && t.deadline ? `${dl(t.subStart)} – ${dl(t.deadline)}` : ''], ['Technical bid opening', dt(t.techOpening)], ['Financial bid opening', t.finOpening ? dt(t.finOpening) : 'As per qualified bidder notification'], ['Total submission period', days != null ? `${days} days` : '']].filter((x) => x[1]);
  return (<div className="notice-doc">
    <div className="nd-head"><small>{(t.tenderType || 'Open').toUpperCase()} NOTICE INVITING TENDERS</small><h2>{t.title || 'Untitled tender notice'}</h2><p><b>Office:</b> {t.office || t.issuer}{t.officer && <> · {t.officer}</>}</p><p>{t.noticeNo && <><b>Tender Notice No.:</b> {t.noticeNo} · </>}<b>Date:</b> {dl(t.issuedOn)}{t.location && <> · {t.location}</>}</p></div>
    <h3>{t.method?.startsWith('E-') ? 'E-Procurement Notice Inviting Tenders' : 'Notice Inviting Tenders'}</h3><p>{introFor(t)}</p>
    <h4>Important dates</h4><table className="nd-table"><thead><tr><th>Event</th><th>Date and time</th></tr></thead><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
    <h4>Tender details</h4>{ws.map((w, i) => <div key={i} className="work"><b>Tender {w.no || i + 1}</b><dl className="kv">{[['District / location', w.district], ['Name of work', w.name], ['Detailed description', w.desc], ['Estimated cost', w.value ? fmt(w.value) : ''], ['Bid security / EMD', w.security ? fmt(w.security) : ''], ['Tender cost', w.docCost], ['Tender category', w.category], ['Contractor category', w.cat], ['Time of completion', w.completion]].filter((x) => x[1]).map(([k, v]) => <div key={k} className={k === 'Name of work' || k === 'Detailed description' ? 'full' : ''}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>)}
    <h4>Eligibility</h4><ul className="plainul"><li>Contractor category: {r.contractorCat || 'Any'}</li><li>Minimum experience: {r.years} years · Similar projects: {r.projects}+ · Turnover: ₹{r.turnover} Cr or more</li>{r.certs.length > 0 && <li>Certifications: {r.certs.join(', ')}</li>}{r.registration && <li>Registration: {r.registration}</li>}{r.other && <li>Other: {r.other}</li>}</ul>
    {r.docs.length > 0 && <><h4>Required documents</h4><ul className="plainul">{r.docs.map((d) => <li key={d}>{d}</li>)}</ul></>}
    {t.conditions?.length > 0 && <><h4>Additional conditions</h4><ul className="plainul">{t.conditions.map((c) => <li key={c}>{c}</li>)}</ul></>}</div>);
}
function Timeline({ t }) {
  const ev = [['Tender publication', dl(t.publication)], ['Bid document availability', dl(t.docStart)], ['Bid submission opens', dl(t.subStart)], ['Bid submission deadline', dl(t.deadline)], ['Technical bid opening', dt(t.techOpening)], ['Financial bid opening', t.finOpening ? dt(t.finOpening) : 'To be announced']].filter((e) => e[1]), n = subDays(t);
  return <div className="tl">{n != null && <div className="tl-total"><Clock size={16} /> Total Submission Period: <b>{n} Days</b></div>}<ol>{ev.map(([k, v]) => <li key={k}><i /><b>{k}</b><span>{v}</span></li>)}</ol></div>;
}
function Ring({ score, size = 110, suffix = '' }) {
  const r = size / 2 - 8, C = 2 * Math.PI * r, col = score >= 70 ? '#1f7a5a' : score >= 50 ? '#c47f12' : '#b42f3a';
  return <svg width={size} height={size} role="img" aria-label={`${score}${suffix}`}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e1e7ee" strokeWidth="8" /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(C * score) / 100} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .6s' }} /><text x="50%" y="50%" textAnchor="middle" dy=".35em" className="ring-t" fontSize={size / 3.4}>{score}{suffix}</text></svg>;
}
function Report({ rep }) {
  const flagged = rep.items.some((i) => i.level !== 'Low');
  return (<section className="panel report"><div className="rep-top"><Ring score={rep.score} /><div><h3>Tender Health</h3><p><b>Overall score: {rep.score}/100.</b> {flagged ? 'Potential risk factors identified. Review the points below.' : 'No major concerns identified.'}</p><p>These insights are estimates based on the details entered. They are not predictions or guarantees.</p></div></div>
    <div className="rep-grid">{rep.items.map((i) => <div key={i.name} className="rep-item"><div className="meter-row"><b>{i.name}</b><div className="bar"><i className={riskTone[i.level]} style={{ width: i.pct + '%' }} /></div><Pill tone={riskTone[i.level]}>{LVL[i.level]}</Pill></div><ul>{i.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>)}</div></section>);
}

/* ---------- Issuer (Government / Organization) ---------- */
const NAV = [['dashboard', 'Dashboard', LayoutDashboard], ['create', 'Create Tender', FilePlus2], ['tenders', 'My Tenders', FileText], ['bids', 'Bid Analysis', Scale], ['analytics', 'Analytics', BarChart3], ['profile', 'Profile', UserCircle]];
function Scale(p) { return <ListChecks {...p} />; }
const Avatar = ({ name = '' }) => <span className="avatar">{name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>;
function IssuerShell({ page, ctx, out }) {
  const { session, user, tenders } = ctx, gov = session.role === 'gov';
  const mine = tenders.filter((t) => (gov ? t.issuerType === 'Government' && t.department === session.dept : t.owner === session.username));
  const P = { dashboard: Dashboard, create: Create, tenders: MyTenders, bids: BidAnalysis, analytics: Analytics, profile: Profile }[page] || Dashboard;
  const org = gov ? session.dept : user.orgName;
  return (<div className="shell"><aside className="side"><Logo light /><nav>{NAV.map(([k, l, Ic]) => <a key={k} href={`#/app/${k}`} className={page === k ? 'on' : ''}><Ic size={18} />{l}</a>)}</nav><button className="side-out" onClick={out}><LogOut size={16} /> Sign out</button></aside>
    <div className="content"><header className="apphead"><div className="who-card"><small>{gov ? 'Government' : 'Organization'}</small><b>{org}</b></div><div className="apphead-r"><Avatar name={user.name || org} /><span>{user.name || org}</span></div></header><main className="main"><P ctx={ctx} mine={mine} gov={gov} /></main></div></div>);
}
const dayTile = (d) => { const x = new Date(d); return [x.getDate(), x.toLocaleString('en', { month: 'short' })]; };
function Dashboard({ ctx, mine }) {
  const { bids, user, session } = ctx, pub = mine.filter((t) => t.status !== 'Draft'), active = mine.filter((t) => t.status === 'Published' && daysLeft(t.deadline) >= 0);
  const attn = mine.filter((t) => t.status === 'Published' && (analyze(t).score < 65 || (daysLeft(t.deadline) <= 10 && bidsFor(t, bids).length < 4)));
  const upcoming = [...active].sort((x, y) => new Date(x.deadline) - new Date(y.deadline)).slice(0, 4);
  const cards = [['Active Tenders', active.length, 'green', CheckCircle2], ['Draft Tenders', mine.filter((t) => t.status === 'Draft').length, 'amber', Pencil], ['Published Tenders', pub.length, 'blue', FileText], ['Total Bids Received', mine.reduce((n, t) => n + bidsFor(t, bids).length, 0), 'violet', Target], ['Needing Attention', attn.length, 'red', AlertTriangle]];
  const first = (user.name || '').split(' ')[0];
  return (<><div className="pg-head"><div><h1>Welcome back{first ? `, ${first}` : ''}!</h1><p>Manage your tenders and bids.</p></div><a className="btn" href="#/app/create"><Plus size={16} /> Create Tender</a></div>
    <div className="kpis">{cards.map(([l, v, tn, Ic]) => <div className={`kpi ${tn}`} key={l}><span className="kpi-ic"><Ic size={22} /></span><div><span>{l}</span><b>{v}</b></div></div>)}</div>
    <div className="two wide-l"><section className="panel"><div className="ph"><h3><Zap size={18} /> Active Tenders</h3><a href="#/app/tenders">View All <ArrowRight size={14} /></a></div>
      {active.length ? <div className="tbl-w"><table className="tbl"><thead><tr><th>Tender Name</th><th>Location</th><th>Est. Value</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead><tbody>{active.slice(0, 6).map((t) => <tr key={t.id}><td className="tn" title={t.title}>{t.title}</td><td>{t.location || t.department}</td><td>{fmt(t.value)}</td><td>{dl(t.deadline)}</td><td><Pill tone={daysLeft(t.deadline) <= 7 ? 'amber' : 'green'}>{daysLeft(t.deadline) <= 7 ? 'Closing Soon' : 'Open'}</Pill></td><td><a className="btn ghost sm" href="#/app/tenders">View <ArrowRight size={13} /></a></td></tr>)}</tbody></table></div> : <p className="empty">No active tenders yet.</p>}</section>
      <section className="panel"><div className="ph"><h3><Clock size={18} /> Upcoming Deadlines</h3></div>{upcoming.length ? upcoming.map((t) => { const [d, m] = dayTile(t.deadline); return <div className="row dline" key={t.id}><span className="tile"><b>{d}</b>{m}</span><div><b>{t.title.length > 34 ? t.title.slice(0, 34) + '…' : t.title}</b><small>{t.department} · {t.location}</small></div></div>; }) : <p className="empty">No upcoming deadlines.</p>}</section></div>
    <section className="panel"><div className="ph"><h3><Zap size={18} /> Quick Actions</h3></div><div className="qa">{[['create', 'Create Tender', FilePlus2], ['tenders', 'My Tenders', FileText], ['bids', 'Bid Analysis', ListChecks], ['analytics', 'Analytics', BarChart3]].map(([k, l, Ic]) => <a key={k} href={`#/app/${k}`}><Ic size={20} />{l}</a>)}</div></section>
    {attn.length > 0 && <section className="panel"><div className="ph"><h3><AlertTriangle size={18} /> Needs attention</h3></div>{attn.map((t) => { const a = analyze(t); return <div className="row" key={t.id}><div><b>{t.title}</b><small>Health {a.score}/100 · {Math.max(daysLeft(t.deadline), 0)} days left</small></div><a className="btn ghost sm" href="#/app/tenders">Review</a></div>; })}</section>}</>);
}

function TagEditor({ list, set, suggest = [], ph }) {
  const [v, setV] = useState(''); const add = (x) => { x = x.trim(); if (x && !list.includes(x)) set([...list, x]); setV(''); };
  const sg = suggest.filter((s) => !list.includes(s));
  return (<div><div className="chips">{list.map((x) => <span key={x} className="chip on">{x}<button type="button" className="x" aria-label={`Remove ${x}`} onClick={() => set(list.filter((y) => y !== x))}>×</button></span>)}{!list.length && <span className="sub">None added yet.</span>}</div>
    {sg.length > 0 && <div className="chips sug">{sg.map((s) => <button type="button" key={s} className="chip" onClick={() => add(s)}>+ {s}</button>)}</div>}
    <div className="addrow"><input value={v} placeholder={ph} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(v); } }} /><button type="button" className="btn ghost sm" onClick={() => add(v)}><Plus size={14} /> Add</button></div></div>);
}

const STEPS = ['Notice', 'Procurement', 'Dates', 'Works', 'Eligibility', 'Documents', 'Conditions', 'Review'];
const blankW = () => ({ no: '', district: '', name: '', desc: '', value: '', security: '', docCost: '', category: 'Building Work', cat: 'Any', completion: '' });
function Create({ ctx, gov }) {
  const { session, user, tenders, setT } = ctx;
  const issuer = gov ? `${session.dept} Department` : user.orgName;
  const [f, setF] = useState(() => ({ title: '', noticeNo: '', issuedOn: today(), office: gov ? user.address || issuer : user.orgName, officer: gov ? `${user.fullName}, ${user.designation}` : `${user.contact}, Procurement`, location: '', tenderType: 'Open', method: 'E-tendering (online)', intro: '', publication: today(), docStart: today(), subStart: today(), deadline: '', techOpening: '', finOpening: '', works: [blankW()], contractorCat: 'Any', years: 3, projects: 1, turnover: 1, certs: [], registration: '', other: '', docs: ['PAN Card'], conditions: [''] }));
  const [step, setStep] = useState(0), [view, setView] = useState('edit'), [rep, setRep] = useState(null), [done, setDone] = useState(null);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setRep(null); };
  const setW = (i, k, v) => set('works', f.works.map((w, j) => (j === i ? { ...w, [k]: v } : w)));
  const inp = (k, l, type = 'text', p = {}) => <label>{l}<input type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} {...p} /></label>;
  const build = (status) => ({ id: 'CB-2026-' + (done?.num || 'DRAFT'), title: f.title, noticeNo: f.noticeNo, issuedOn: f.issuedOn, office: f.office, officer: f.officer, department: gov ? session.dept : user.orgName, issuer, issuerType: gov ? 'Government' : 'Organization', owner: session.username, location: f.location, tenderType: f.tenderType, method: f.method, intro: f.intro, publication: f.publication, docStart: f.docStart, subStart: f.subStart, deadline: f.deadline, techOpening: f.techOpening, finOpening: f.finOpening,
    works: f.works.map((w, i) => ({ ...w, no: w.no || String(i + 1), value: +w.value / 100 || 0, security: w.security ? +w.security / 100 : 0 })), value: f.works.reduce((s, w) => s + (+w.value || 0), 0) / 100, conditions: f.conditions.map((c) => c.trim()).filter(Boolean), status, published: status === 'Published' ? today() : null,
    req: { contractorCat: f.contractorCat, years: +f.years || 0, projects: +f.projects || 0, turnover: +f.turnover || 0, certs: f.certs, docs: f.docs, registration: f.registration, other: f.other } });
  const problems = [!f.title && 'Add a tender notice title', !f.deadline && 'Set the bid submission deadline', f.deadline && f.deadline < f.subStart && 'Deadline is before submission start', f.works.some((w) => !w.name || !(+w.value > 0)) && 'Every work needs a name and estimated cost'].filter(Boolean);
  const finish = (status) => { const t = { ...build(status), id: 'CB-' + new Date().getFullYear() + '-' + crypto.randomUUID().slice(0, 8).toUpperCase() }; setT([t, ...tenders]); setDone({ t, status }); };
  if (done) return <div className="panel center"><CheckCircle2 size={44} color="#1f7a5a" /><h2>{done.status === 'Published' ? 'Tender published' : 'Draft saved'}</h2><p>{done.t.id} · {done.t.title}</p><p>{done.status === 'Published' ? 'It is now visible to relevant bidders and ready to receive bids.' : 'You can publish it later from My Tenders.'}</p><div className="cta-row"><a className="btn" href="#/app/tenders">Go to My Tenders</a>{done.status === 'Published' && <a className="btn ghost" href="#/app/bids">Track bids</a>}</div></div>;
  const body = [
    <div className="form" key="0"><label className="w2">Tender notice title<input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Repair and Painting of Residential Buildings, Modinagar" /></label>{inp('noticeNo', 'Tender notice number', 'text', { placeholder: 'e.g. 756/4A' })}{inp('issuedOn', 'Date of issue', 'date')}<label className="w2">Issuing office / organization<input value={f.office} onChange={(e) => set('office', e.target.value)} /></label>{inp('officer', 'Officer name and designation')}{inp('location', 'District / location')}<label>{gov ? 'Department' : 'Organization'}<input value={gov ? session.dept : user.orgName} readOnly /></label></div>,
    <div className="form" key="1"><label>Tender type<select value={f.tenderType} onChange={(e) => set('tenderType', e.target.value)}>{['Open', 'Short-Term', 'Limited', 'Two-Stage'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Procurement method<select value={f.method} onChange={(e) => set('method', e.target.value)}>{['E-tendering (online)', 'Offline / sealed bids'].map((x) => <option key={x}>{x}</option>)}</select></label><label className="w2">Short introduction / notice description<textarea rows="4" value={f.intro} onChange={(e) => set('intro', e.target.value)} placeholder={introFor({ issuerType: gov ? 'Government' : 'Organization', issuer })} /></label><p className="sub w2">Leave blank to use the standard wording shown above for {gov ? 'government' : 'organization'} tenders.</p></div>,
    <div key="2"><div className="form">{inp('publication', 'Tender publication date', 'date')}{inp('docStart', 'Bid document availability start', 'date')}{inp('subStart', 'Bid submission start', 'date')}{inp('deadline', 'Bid submission deadline', 'date')}{inp('techOpening', 'Technical bid opening', 'datetime-local')}{inp('finOpening', 'Financial bid opening (optional)', 'datetime-local')}</div><Timeline t={build('Draft')} /></div>,
    <div key="3">{f.works.map((w, i) => <fieldset key={i} className="workf"><legend>Tender / Work {w.no || i + 1}</legend><div className="form"><label>Work number<input value={w.no} placeholder={String(i + 1)} onChange={(e) => setW(i, 'no', e.target.value)} /></label><label>District / project location<input value={w.district} onChange={(e) => setW(i, 'district', e.target.value)} /></label><label className="w2">Name of work<textarea rows="2" value={w.name} onChange={(e) => setW(i, 'name', e.target.value)} /></label><label className="w2">Detailed work description<textarea rows="2" value={w.desc} onChange={(e) => setW(i, 'desc', e.target.value)} /></label>
      <label>Estimated cost (₹ lakh)<input type="number" min="0" step="0.01" value={w.value} onChange={(e) => setW(i, 'value', e.target.value)} /></label><label>Bid security / EMD (₹ lakh)<input type="number" min="0" step="0.01" value={w.security} onChange={(e) => setW(i, 'security', e.target.value)} /></label><label>Tender document cost<input value={w.docCost} placeholder="e.g. ₹2,000 + applicable charges and taxes" onChange={(e) => setW(i, 'docCost', e.target.value)} /></label><label>Time of completion<input value={w.completion} placeholder="e.g. 3 months" onChange={(e) => setW(i, 'completion', e.target.value)} /></label>
      <label>Tender category<select value={w.category} onChange={(e) => setW(i, 'category', e.target.value)}>{['Building Work', 'Civil Works', 'Road Work', 'Equipment Supply', 'Electrical', 'IT Services', 'Consultancy', 'Maintenance'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Contractor category<select value={w.cat} onChange={(e) => setW(i, 'cat', e.target.value)}>{['Any', 'A', 'A–B', 'A–C', 'A–D', 'B–D'].map((x) => <option key={x}>{x}</option>)}</select></label></div>
      {f.works.length > 1 && <button type="button" className="btn ghost sm" onClick={() => set('works', f.works.filter((_, j) => j !== i))}><Trash2 size={14} /> Remove work</button>}</fieldset>)}<button type="button" className="btn ghost" onClick={() => set('works', [...f.works, blankW()])}><Plus size={16} /> Add Another Work</button></div>,
    <div className="form" key="4"><label>Required contractor category<select value={f.contractorCat} onChange={(e) => set('contractorCat', e.target.value)}>{['Any', 'A', 'A–B', 'A–C', 'A–D', 'B–D'].map((x) => <option key={x}>{x}</option>)}</select></label>{inp('years', 'Minimum years of experience', 'number', { min: 0 })}{inp('projects', 'Required previous similar projects', 'number', { min: 0 })}{inp('turnover', 'Financial capacity: min. annual turnover (₹ Cr)', 'number', { min: 0, step: '0.01' })}<fieldset className="w2"><legend>Required certifications</legend><TagEditor list={f.certs} set={(v) => set('certs', v)} suggest={CERTS} ph="Add another certification" /></fieldset>{inp('registration', 'Registration requirements', 'text', { placeholder: 'e.g. Registered with the State PWD' })}<label className="w2">Other mandatory conditions<textarea rows="2" value={f.other} onChange={(e) => set('other', e.target.value)} /></label></div>,
    <div key="5"><p className="sub">These become the checklist bidders see, and feed Opportunity Match and CivilBid Copilot.</p><TagEditor list={f.docs} set={(v) => set('docs', v)} suggest={DOCS} ph="Add a required document" /></div>,
    <div key="6"><p className="sub">Conditions are not added automatically. Write only what applies to this tender.</p>{f.conditions.map((c, i) => <div className="addrow" key={i}><input value={c} placeholder={`Condition ${i + 1}`} onChange={(e) => set('conditions', f.conditions.map((x, j) => (j === i ? e.target.value : x)))} /><button type="button" className="btn ghost sm" aria-label="Remove condition" onClick={() => set('conditions', f.conditions.filter((_, j) => j !== i))}><Trash2 size={14} /></button></div>)}<button type="button" className="btn ghost sm" onClick={() => set('conditions', [...f.conditions, ''])}><Plus size={14} /> Add condition</button></div>,
    <div key="7">{problems.length ? <div className="notice"><AlertTriangle size={16} /><div><b>Before you publish:</b><ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul></div></div> : <p className="sub">Everything required is filled in. Run the analysis to see Tender Health, then publish.</p>}
      <div className="actions"><button className="btn" disabled={problems.length > 0} onClick={() => setRep(analyze(build('Draft')))}><ShieldCheck size={16} /> Analyze Tender</button><button className="btn ghost" onClick={() => setStep(0)}><Pencil size={14} /> Edit Tender</button><button className="btn ghost" disabled={!f.title} onClick={() => finish('Draft')}>Save as Draft</button></div>
      {rep && <><Report rep={rep} /><div className="pubbar"><p>Reviewed the report? Publishing makes this tender visible to relevant bidders.</p><button className="btn" onClick={() => finish('Published')}>Publish Tender</button></div></>}</div>,
  ];
  return (<><Head t="Create Tender" s="A guided workflow for drafting a Notice Inviting Tender.">
    <div className="seg"><button className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}><Pencil size={14} /> Edit Tender</button><button className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')}><Eye size={14} /> Preview Tender</button></div></Head>
    <ol className="steps2" aria-label="Progress">{STEPS.map((s, i) => <li key={s} className={i === step ? 'cur' : i < step ? 'done' : ''}><button onClick={() => { setStep(i); setView('edit'); }}><span>{i < step ? '✓' : i + 1}</span>{s}</button></li>)}</ol>
    <div className={`wiz ${view}`}><section className="panel wiz-form"><h3>{step + 1}. {STEPS[step]}</h3>{body[step]}<div className="wiz-nav"><button className="btn ghost" disabled={!step} onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>{step < STEPS.length - 1 && <button className="btn" onClick={() => setStep(step + 1)}>Next <ArrowRight size={16} /></button>}</div></section>
      <aside className="panel wiz-prev"><h3><Eye size={16} /> Live notice preview</h3><NoticeView t={build('Draft')} /></aside></div></>);
}

function MyTenders({ ctx, mine }) {
  const { bids, tenders, setT } = ctx, [open, setOpen] = useState(null);
  const publish = (id) => setT(tenders.map((t) => (t.id === id ? { ...t, status: 'Published', published: today() } : t)));
  const tog = (id, m) => setOpen(open?.id === id && open.m === m ? null : { id, m });
  return (<><Head t="My Tenders" s="All tenders you have created." /><section className="panel flush"><div className="scroll"><table><thead><tr><th>Tender</th><th>Value</th><th>Deadline</th><th>Bids</th><th>Status</th><th /></tr></thead><tbody>
    {mine.map((t) => <><tr key={t.id}><td><b>{t.title}</b><small>{t.id} · {t.works.length} work{t.works.length > 1 ? 's' : ''}</small></td><td>{fmt(t.value)}</td><td>{dl(t.deadline)}</td><td>{bidsFor(t, bids).length}</td><td><Pill tone={statusTone[t.status]}>{t.status}</Pill></td><td className="acts"><button className="btn ghost sm" onClick={() => tog(t.id, 'n')}>View notice</button><button className="btn ghost sm" onClick={() => tog(t.id, 'h')}>Health</button>{t.status === 'Draft' && <button className="btn sm" onClick={() => publish(t.id)}>Publish</button>}</td></tr>
      {open?.id === t.id && <tr key={t.id + 'o'}><td colSpan="6">{open.m === 'n' ? <NoticeView t={t} /> : <Report rep={analyze(t)} />}</td></tr>}</>)}
    {!mine.length && <tr><td colSpan="6" className="empty">No tenders yet.</td></tr>}</tbody></table></div></section></>);
}

function BidAnalysis({ ctx, mine }) {
  const { bids } = ctx, list = mine.filter((t) => t.status !== 'Draft'), [tid, setTid] = useState(list[0]?.id), [sel, setSel] = useState(null);
  const t = list.find((x) => x.id === tid) || list[0];
  if (!t) return <><Head t="Bid Analysis" /><p className="empty">Publish a tender to see bids here.</p></>;
  const all = bidsFor(t, bids), ok = all.filter((b) => b.ok).length, cur = all.find((b) => b.id === sel), low = Math.min(...all.map((b) => b.amount));
  return (<><Head t="Bid Analysis" s="Compare bids and bidder readiness for each published tender."><select className="sel" value={t.id} onChange={(e) => { setTid(e.target.value); setSel(null); }}>{list.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.title.slice(0, 44)}</option>)}</select></Head>
    <div className="kpis three"><div className="kpi blue"><b>{all.length}</b><span>Total bids received</span></div><div className="kpi green"><b>{ok}</b><span>Fully matched requirements</span></div><div className="kpi amber"><b>{all.length - ok}</b><span>With potential missing information</span></div></div>
    <div className="notice"><AlertTriangle size={16} /> CivilBid provides decision-support insights. Final procurement decisions must be made by authorized officials according to applicable rules and procedures. Rows marked Sample are fictional.</div>
    <div className="two wide-l"><section className="panel flush"><div className="scroll"><table><thead><tr><th>Bidder</th><th>Bid amount</th><th>vs. estimate</th><th>Readiness</th></tr></thead><tbody>{[...all].sort((a, b) => a.amount - b.amount).map((b) => <tr key={b.id} className={sel === b.id ? 'sel' : ''} onClick={() => setSel(b.id)}><td><b>{b.name}</b><small>Submitted via CivilBid</small></td><td>{fmt(b.amount)}{b.amount === low && <Pill tone="blue">Lowest</Pill>}</td><td>{((b.amount / t.value - 1) * 100).toFixed(1)}%</td><td><div className="mini-bar"><i style={{ width: (b.pct ?? 100) + '%' }} className={b.ok ? 'green' : 'amber'} /></div><small>{b.ok ? 'All matched' : `${b.missing.length} to review`}</small></td></tr>)}</tbody></table></div></section>
      <section className="panel">{cur ? <><h3>{cur.name}</h3><p className="big">{fmt(cur.amount)}</p><Pill tone={cur.ok ? 'green' : 'amber'}>{cur.ok ? 'Requirements matched' : 'Information to review'}</Pill><h4>Requirements matched ({cur.met.length})</h4><ul className="ok-list">{cur.met.map((m) => <li key={m}><CheckCircle2 size={14} />{m}</li>)}</ul><h4>Missing information ({cur.missing.length})</h4>{cur.missing.length ? <ul className="no-list">{cur.missing.map((m) => <li key={m.label}><XCircle size={14} />{m.label}</li>)}</ul> : <p className="sub">None.</p>}<h4>AI observations</h4><ul>{cur.notes.map((n) => <li key={n}>{n}</li>)}</ul></> : <p className="empty">Select a bidder to see details.</p>}</section></div></>);
}

function Analytics({ ctx, mine }) {
  const { bids } = ctx, pub = mine.filter((t) => t.status !== 'Draft'), mx = Math.max(...pub.map((t) => bidsFor(t, bids).length), 1);
  const cats = [...new Set(mine.flatMap((t) => t.works.map((w) => w.category)))].map((c) => [c, mine.filter((t) => t.works.some((w) => w.category === c)).length]);
  const Bar = ({ l, v, max, tone }) => <div className="hbar"><span>{l}</span><div className="bar"><i className={tone} style={{ width: (v / max) * 100 + '%' }} /></div><b>{v}</b></div>;
  return (<><Head t="Analytics" s="Tender Health and participation across your tenders." /><div className="two">
    <section className="panel"><h3>Tender Health by tender</h3>{mine.map((t) => { const s = analyze(t).score; return <Bar key={t.id} l={t.id} v={s} max={100} tone={s >= 70 ? 'green' : s >= 50 ? 'amber' : 'red'} />; })}</section>
    <section className="panel"><h3>Bids received</h3>{pub.map((t) => <Bar key={t.id} l={t.id} v={bidsFor(t, bids).length} max={mx} tone="blue" />)}</section>
    <section className="panel"><h3>Tenders by category</h3>{cats.map(([c, n]) => <Bar key={c} l={c} v={n} max={Math.max(...cats.map((x) => x[1]), 1)} tone="blue" />)}</section>
    <section className="panel"><h3>Insights flagged for review</h3>{['Competition Insight', 'Timeline Insight', 'Requirement Complexity', 'Re-tender Risk'].map((n) => <Bar key={n} l={n} v={mine.filter((t) => analyze(t).items.find((i) => i.name === n).level === 'High').length} max={Math.max(mine.length, 1)} tone="amber" />)}</section></div></>);
}
function Profile({ ctx, gov }) {
  const u = ctx.user, rows = gov ? [['Name', u.fullName], ['Department', u.department], ['Designation', u.designation], ['Email', u.email], ['Phone', u.phone], ['Office', u.address]] : [['Organization', u.orgName], ['Type', u.orgType], ['Contact', u.contact], ['Email', u.email], ['Phone', u.phone], ['Address', u.address]];
  return <><Head t="Profile" /><section className="panel prof"><UserCircle size={56} /><dl>{rows.map(([k, v]) => <><dt key={k}>{k}</dt><dd>{v}</dd></>)}<dt>Username</dt><dd>{u.username}</dd></dl><button className="btn ghost" onClick={async () => { if (confirm('Sign out and clear local preferences on this device? Your data stays safe in the database.')) { await signOut(); localStorage.removeItem('cb_dept'); location.hash = '/'; location.reload(); } }}>Sign out and clear local cache</button></section></>;
}

/* ---------- Bidder ---------- */
function BidderShell({ page, id, ctx, out }) {
  const { user } = ctx, tab = (k, l, Ic) => <a href={`#/bidder/${k}`} className={page === k || (k === 'browse' && page === 'tender') ? 'on' : ''}><Ic size={18} />{l}</a>;
  return (<div className="shell"><aside className="side"><Logo light /><nav>{tab('browse', 'Opportunities', Search)}{tab('interests', 'My interests', Target)}</nav><button className="side-out" onClick={out}><LogOut size={16} /> Sign out</button></aside>
    <div className="content"><header className="apphead"><div className="who-card"><small>Bidder</small><b>{user.name}</b></div><div className="apphead-r"><Avatar name={user.name} /><span>{user.name}</span></div></header>
      <main className="main">{page === 'interests' ? <Interests ctx={ctx} /> : page === 'tender' ? <Detail id={id} ctx={ctx} /> : <Browse ctx={ctx} />}</main></div></div>);
}
function Interests({ ctx }) {
  const { user, saveProfile } = ctx, [sel, setSel] = useState(user.interests || []);
  const tog = (d) => setSel(sel.includes(d) ? sel.filter((x) => x !== d) : [...sel, d]);
  return <div className="narrow wide"><h1>What opportunities are you interested in?</h1><p className="lead2">Select one or more departments. Opportunities from private organizations are always shown.</p><div className="dept-grid three">{DEPTS.map((d) => <button key={d} className={`dept ${sel.includes(d) ? 'on' : ''}`} onClick={() => tog(d)} aria-pressed={sel.includes(d)}><Landmark size={20} />{d}{sel.includes(d) && <CheckCircle2 size={18} className="tick" />}</button>)}</div><button className="btn lg" disabled={!sel.length} onClick={() => { saveProfile({ interests: sel }); go('/bidder/browse'); }}>Show opportunities</button></div>;
}
function Browse({ ctx }) {
  const { tenders, user } = ctx, [q, setQ] = useState(''), [who, setWho] = useState('All'), [cat, setCat] = useState('All');
  const base = tenders.filter((t) => t.status === 'Published' && (t.issuerType === 'Organization' || user.interests.includes(t.department)));
  const cats = [...new Set(base.flatMap((t) => t.works.map((w) => w.category)))];
  const list = base.filter((t) => (who === 'All' || t.issuerType === who) && (cat === 'All' || t.works.some((w) => w.category === cat)) && (t.title + t.issuer).toLowerCase().includes(q.toLowerCase()));
  return <><Head t="Opportunities" s={`Showing ${user.interests.join(', ')} and organization-issued tenders.`} /><div className="filters"><div className="search-w"><Search size={16} /><input placeholder="Search opportunities" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /></div><div className="seg">{['All', 'Government', 'Organization'].map((x) => <button key={x} className={who === x ? 'on' : ''} onClick={() => setWho(x)}>{x}</button>)}</div><select className="sel" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option>All</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
    {list.length ? <div className="tgrid">{list.map((t) => { const m = check(t.req, user); return <article className="tcard" key={t.id}><div className="tc-top"><Pill tone="blue">{t.works[0].category}</Pill><Pill tone={statusTone[t.status]}>{t.status}</Pill></div><h3>{t.title}</h3><p className="dept-l">{t.issuer}</p><dl><div><dt>Estimated value</dt><dd>{fmt(t.value)}</dd></div><div><dt>Deadline</dt><dd>{dl(t.deadline)}</dd></div></dl><div className="tc-foot"><small className={`match ${m.pct >= 80 ? 'hi' : m.pct >= 60 ? 'mid' : 'lo'}`}><Target size={13} /> {m.pct}% match</small><a className="btn sm" href={`#/bidder/tender/${t.id}`}>View Opportunity</a></div></article>; })}</div> : <p className="empty">No opportunities match. Try changing the filters or interests.</p>}</>;
}

function Detail({ id, ctx }) {
  const { tenders, user, bids, setB } = ctx, t = tenders.find((x) => x.id === id), inp = useRef(null);
  const chatKey = `cb_copilot_conversations_${user?.username || 'guest'}_${id}`;
  const loadedChatKey = useRef(chatKey);
  const [conversations, setConversations] = useState(() => load(chatKey, []));
  const [activeChatId, setActiveChatId] = useState(() => (load(chatKey, [])[0] || {}).id || null);
  const [q, setQ] = useState(''), [busy, setBusy] = useState(false), [showM, setShowM] = useState(false);
  const [chatError, setChatError] = useState('');
  const [amount, setAmount] = useState(''), [dchk, setDchk] = useState([]), [ok, setOk] = useState(false), [sub, setSub] = useState(null);
  useEffect(() => {
    const saved = load(chatKey, []);
    setConversations(saved);
    setActiveChatId((current) => saved.some((c) => c.id === current) ? current : ((saved[0] || {}).id || null));
    setChatError('');
  }, [chatKey]);
  useEffect(() => {
    if (loadedChatKey.current !== chatKey) { loadedChatKey.current = chatKey; return; }
    save(chatKey, conversations);
  }, [chatKey, conversations]);
  if (!t) return <p className="empty">Tender not found. <a href="#/bidder/browse">Back</a></p>;
  const activeChat = conversations.find((c) => c.id === activeChatId);
  const msgs = activeChat?.messages || [];
  const m = check(t.req, user), blockers = m.missing.filter((x) => !x.doc), mine = bids.find((b) => b.tenderId === t.id && b.username === user.username), days = Math.max(daysLeft(t.deadline), 0);
  const newConversation = () => {
    const chatId = `chat-${Date.now()}`;
    const conversation = { id: chatId, title: 'New conversation', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] };
    setConversations((items) => [conversation, ...items].slice(0, 50));
    setActiveChatId(chatId);
    setChatError('');
  };
  const say = async (userText, question) => {
    if (busy) return;
    const chatId = activeChatId || `chat-${Date.now()}`;
    const current = conversations.find((c) => c.id === chatId);
    const priorMessages = current?.messages || [];
    const title = current?.title && current.title !== 'New conversation' ? current.title : userText.trim().slice(0, 48) || 'Tender question';
    const newUserMessage = { r: 'u', text: userText };
    const newChat = {
      id: chatId, title, createdAt: current?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(), messages: [...priorMessages, newUserMessage]
    };
    setActiveChatId(chatId);
    setConversations((items) => [newChat, ...items.filter((c) => c.id !== chatId)].slice(0, 50));
    setBusy(true);
    setChatError('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question, tender: t,
          profile: {
            name: user.name || user.fullName || user.orgName || user.username,
            years: user.years, projects: user.projects, turnover: user.turnover,
            contractorClass: user.contractorClass, certs: user.certs || [], docs: user.docs || []
          },
          opportunityMatch: { pct: m.pct, met: m.met, missing: m.missing.map((x) => x.label) },
          history: priorMessages.slice(-20).map((item) => ({ role: item.r === 'u' ? 'user' : 'model', text: item.text }))
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Gemini request failed (${response.status}).`);
      const answer = payload.text || 'Gemini returned an empty answer. Please try again.';
      setConversations((items) => items.map((c) => c.id === chatId
        ? { ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, { r: 'a', text: answer }] }
        : c));
    } catch (error) {
      const message = error?.message || 'Unable to contact CivilBid Copilot. Please try again.';
      setChatError(message);
      setConversations((items) => items.map((c) => c.id === chatId
        ? { ...c, updatedAt: new Date().toISOString(), messages: [...c.messages, { r: 'a', text: `I couldn't get an AI response. ${message}` }] }
        : c));
    } finally {
      setBusy(false);
    }
  };
  const submit = (e) => { e.preventDefault(); const bid = { id: 'B-' + Date.now(), tenderId: t.id, username: user.username, name: user.name, amount: +amount / 100, met: m.met, missing: m.missing, pct: m.pct, date: new Date().toISOString() }; setB([bid, ...bids]); setSub(bid); };
  if (sub || mine) { const b = sub || mine; return <div className="panel center narrow"><CheckCircle2 size={48} color="#1f7a5a" /><h2>{sub ? 'Bid submitted' : 'You have already bid on this opportunity'}</h2><p>{t.title}</p><p className="big">{fmt(b.amount)}</p><p className="sub">Reference {b.id}. It now appears in the issuer's Bid Analysis, and it is not a legal bid.</p><a className="btn" href="#/bidder/browse">Back to opportunities</a></div>; }
  const matchPanel = <section className="panel match-panel"><div className="mp-top"><Ring score={m.pct} suffix="%" /><div><h3>Opportunity Match: {m.pct}%</h3><p className="sub">How well your profile fits the listed requirements.</p></div></div>
    <ul className="ok-list">{m.rows.filter((r) => r.ok).map((r) => <li key={r.label}><CheckCircle2 size={14} />{r.label}</li>)}{m.missing.map((r) => <li key={r.label} className="w"><AlertTriangle size={14} />{r.label}</li>)}</ul>
    {m.missing.length > 0 && <><h3>What Can You Do Next?</h3>{m.missing.map((r) => <div className="gap" key={r.label}><b>{r.doc ? r.label : `Required ${r.label.split(':')[0].toLowerCase()}: ${r.need}`}</b>{!r.doc && <p>Your profile currently shows: {r.have}.</p>}<p><u>Why it matters:</u> {r.why}</p><p><u>Next:</u> {r.fix}</p></div>)}</>}
    <p className="sub">This is a bid readiness assessment. Final eligibility is determined through the official tender evaluation process.</p></section>;
  return (<><a href="#/bidder/browse" className="back">← All opportunities</a><div className="pg-head"><div><h1>{t.title}</h1><p>{t.issuer} · {t.id}</p></div><Pill tone={statusTone[t.status]}>{t.status}</Pill></div>
    <div className="detail"><div className="d-main">
      <section className="panel"><h3>Overview</h3><div className="facts"><div><span>Issuer</span><b>{t.issuer}</b></div><div><span>Estimated value</span><b>{fmt(t.value)}</b></div><div><span>Deadline</span><b>{dl(t.deadline)} ({days}d left)</b></div><div><span>Works</span><b>{t.works.length}</b></div></div></section>
      <section className="panel"><h3>Important dates</h3><Timeline t={t} /></section>
      <section className="panel"><NoticeView t={t} /></section>
      <section className="panel"><button className="btn" onClick={() => setShowM(true)}><Target size={16} /> Check My Opportunity Match</button></section>
      {showM && matchPanel}
      <section className="panel"><h3>Proceed to Bid</h3>{!showM ? <p className="sub">Check your Opportunity Match first.</p> : blockers.length ? <><button className="btn" disabled>Proceed to Bid</button><p className="sub">Please review these before bidding: {blockers.map((b) => b.label).join('; ')}.</p></> : <form className="form" onSubmit={submit}><label className="w2">Bid amount (₹ lakh)<input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Estimate is ${(t.value * 100).toFixed(2)}`} /></label><fieldset className="w2"><legend>Required document checklist</legend><div className="chips">{t.req.docs.map((d) => <label key={d} className={`chip ${dchk.includes(d) ? 'on' : ''}`}><input type="checkbox" checked={dchk.includes(d)} onChange={() => setDchk(dchk.includes(d) ? dchk.filter((x) => x !== d) : [...dchk, d])} />{d}</label>)}</div></fieldset><label className="w2 check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />I confirm the details are accurate and I have the documents ready.</label><div className="w2"><button className="btn" disabled={!ok || dchk.length < t.req.docs.length || !amount}>Submit Bid</button>{(dchk.length < t.req.docs.length) && <span className="sub"> Tick every document to continue.</span>}</div></form>}</section>
    </div>
    <aside className="assist panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}><Bot size={18} /> CivilBid Copilot</h3>
        <button type="button" className="btn ghost sm" onClick={newConversation}>+ New chat</button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
        <label htmlFor="copilot-history" className="sub" style={{ whiteSpace: 'nowrap' }}>Chat history</label>
        <select id="copilot-history" value={activeChatId || ''} onChange={(e) => { setActiveChatId(e.target.value || null); setChatError(''); }} style={{ minWidth: 0, flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #d5dde7', background: 'white' }}>
          {!conversations.length && <option value="">No saved chats yet</option>}
          {conversations.map((c) => <option key={c.id} value={c.id}>{c.title || 'Conversation'} · {new Date(c.updatedAt || c.createdAt).toLocaleDateString('en-IN')}</option>)}
        </select>
      </div>
      <div className="qa">
        <button onClick={() => say('Explain in 30 seconds', 'Explain this tender in plain language in about 30 seconds. Highlight the scope, estimated value, deadline, eligibility, and important caveats.')}><Zap size={14} /> Explain in 30 Seconds</button>
        <button onClick={() => say('What do I need?', 'List the documents, certifications, experience, turnover, contractor category, registration, and other requirements for this tender.')}><ListChecks size={14} /> What Do I Need?</button>
        <button onClick={() => { setShowM(true); say('Check my Opportunity Match', 'Assess my Opportunity Match using the provided profile and match results. Explain the main gaps and practical next steps; do not claim official eligibility.'); }}><Target size={14} /> Check My Opportunity Match</button>
        <button onClick={() => inp.current?.focus()}><MessageSquare size={14} /> Ask a Question</button>
      </div>
      <div className="msgs" aria-live="polite">
        {!msgs.length && <p className="sub">Ask Gemini about this tender. Your conversations are saved in this browser for this account and tender.</p>}
        {msgs.map((x, i) => <div key={`${activeChatId}-${i}`} className={`msg ${x.r}`}>{x.text}</div>)}
        {busy && <div className="msg a">Gemini is thinking…</div>}
      </div>
      {chatError && <p className="err" role="alert">{chatError}</p>}
      <form className="ask" onSubmit={(e) => { e.preventDefault(); if (q.trim() && !busy) { const text = q.trim(); setQ(''); say(text, text); } }}>
        <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this tender" aria-label="Ask a question" disabled={busy} />
        <button className="btn sm" aria-label="Send" disabled={busy || !q.trim()}><Send size={14} /></button>
      </form>
      <p className="sub" style={{ fontSize: 11, marginTop: 8 }}>AI responses are advisory. Verify requirements against the official tender documents.</p>
    </aside></div></>);
}

