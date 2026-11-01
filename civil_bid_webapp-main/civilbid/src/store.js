/*
 * CivilBid backend layer (Supabase: Postgres + Auth + Realtime).
 * All accounts, tenders and bids are stored in the live database.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;

const fail = (error) => { if (error) throw new Error(error.message || 'Database request failed.'); };

/* ---------- Reads ---------- */
export async function fetchTenders() {
  const { data, error } = await supabase.from('tenders').select('data').order('created_at', { ascending: false });
  fail(error);
  return data.map((row) => row.data);
}

export async function fetchBids() {
  const { data, error } = await supabase.from('bids').select('data').order('created_at', { ascending: false });
  fail(error);
  return data.map((row) => row.data);
}

export async function fetchBidCount() {
  const { data, error } = await supabase.rpc('bid_count');
  fail(error);
  return data || 0;
}

/* ---------- Writes (diff the old and new list, then save only the changes) ---------- */
export async function syncTenders(prev, next, uid) {
  const before = new Map(prev.map((t) => [t.id, t]));
  const keep = new Set(next.map((t) => t.id));
  for (const t of next) {
    const old = before.get(t.id);
    const row = { status: t.status, department: t.department ?? null, issuer_type: t.issuerType ?? null, data: t };
    if (!old) {
      const { error } = await supabase.from('tenders').insert({ id: t.id, owner_id: uid, ...row });
      fail(error);
    } else if (JSON.stringify(old) !== JSON.stringify(t)) {
      const { error } = await supabase.from('tenders').update(row).eq('id', t.id);
      fail(error);
    }
  }
  for (const t of prev) {
    if (!keep.has(t.id)) {
      const { error } = await supabase.from('tenders').delete().eq('id', t.id);
      fail(error);
    }
  }
}

export async function syncBids(prev, next, uid) {
  const known = new Set(prev.map((b) => b.id));
  for (const b of next) {
    if (known.has(b.id)) continue;
    const { error } = await supabase.from('bids').insert({ id: b.id, tender_id: b.tenderId, bidder_id: uid, data: b });
    fail(error);
  }
}

/* ---------- Accounts ---------- */
const toProfile = (row) => ({ ...row.data, id: row.id, username: row.username, role: row.role, email: row.email, department: row.department ?? row.data?.department });

export async function fetchProfile(uid) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  fail(error);
  return data ? toProfile(data) : null;
}

export async function saveProfileData(uid, patch, current) {
  const { id, username, role, email, ...rest } = { ...current, ...patch };
  const { error } = await supabase.from('profiles').update({ data: rest }).eq('id', uid);
  fail(error);
}

export async function signUpUser(u) {
  const { data: taken, error: e1 } = await supabase.rpc('username_taken', { u: u.username });
  if (e1) return { error: e1.message };
  if (taken) return { error: 'That username is already taken.' };
  const { password, ...profile } = u;
  const { data, error } = await supabase.auth.signUp({
    email: (u.email || '').trim(),
    password,
    options: { data: { username: u.username.trim(), role: u.role, department: u.department || null, profile } },
  });
  if (error) return { error: error.message };
  if (!data.session) return { error: 'Account created. Please confirm your email, then log in.' };
  return { user: data.user };
}

export async function signIn(role, term, password) {
  const { data: email } = await supabase.rpc('login_email', { term: (term || '').trim(), r: role });
  if (!email) return null;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? null : data.user;
}

export const signOut = () => supabase.auth.signOut();
