import { useEffect, useState, useCallback } from "react";
import * as q from "./lib/queries.js";

const FONTS =
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@300;400;500;600&display=swap');";
const C = {
  bg: "#14100b", panel: "#1d1813", raised: "#261f16", line: "rgba(201,163,91,0.16)",
  brass: "#c9a35b", brassHi: "#e7cc8e", text: "#f1eadd", muted: "#9a8f7c",
  approve: "#7ba36f", pending: "#d8a64a", block: "#bf5b4f",
};

const ACCOUNTS = [
  { label: "Remy (bartender)", email: "remy@speakeasy.test" },
  { label: "Alex (patron)", email: "alex@speakeasy.test" },
  { label: "The Gilded Owl (bar)", email: "owl@speakeasy.test" },
  { label: "Marcus (patron)", email: "marcus@speakeasy.test" },
  { label: "Nadia (bartender)", email: "nadia@speakeasy.test" },
];
const SCOPES = [
  { label: "Private", visibility: "private", rank: null },
  { label: "Public", visibility: "public", rank: null },
  { label: "Regulars", visibility: "members", rank: 1 },
  { label: "Inner Circle", visibility: "members", rank: 2 },
  { label: "Top Shelf", visibility: "members", rank: 3 },
];

const fmtMoney = (c) => `$${(c / 100).toFixed(2)}`;
const fmtWhen = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
const scopeLabel = (v, r) =>
  v === "private" ? "Private" : v === "public" ? "Public" :
  r === 1 ? "Regulars" : r === 2 ? "Inner Circle" : r === 3 ? "Top Shelf" : "Members";

export default function App() {
  const [session, setSession] = useState(null);
  const [roles, setRoles] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    q.getSession().then(setSession);
    // Keep session in sync with sign in / sign out.
    let unsub = () => {};
    import("./lib/supabase.js").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!session) { setRoles([]); return; }
    q.myRoles().then(setRoles).catch((e) => setErr(e.message));
  }, [session]);

  return (
    <div style={s.root}>
      <style>{FONTS + CSS}</style>
      <header style={s.topbar}>
        <span style={s.mark}>◊</span>
        <span style={s.brandName}>SPEAKEASY</span>
        <span style={s.live}>live against Supabase + RLS</span>
        {session && (
          <button onClick={() => q.signOut()} style={s.signout}>Sign out</button>
        )}
      </header>

      {err && <div style={s.err} onClick={() => setErr(null)}>{err} (tap to dismiss)</div>}

      {!session ? (
        <SignIn onError={setErr} />
      ) : (
        <main style={s.main}>
          <div style={s.who}>
            Signed in as <b style={{ color: C.brassHi }}>{session.user.email}</b>
            {roles.length > 0 && <span style={s.roleTag}>{roles.join(", ")}</span>}
          </div>
          {roles.includes("bartender") && <BartenderPanel onError={setErr} />}
          {roles.includes("patron") && <PatronPanel onError={setErr} />}
          {roles.includes("bar") && <BarPanel onError={setErr} />}
        </main>
      )}
    </div>
  );
}

function SignIn({ onError }) {
  const [email, setEmail] = useState(ACCOUNTS[0].email);
  const [password, setPassword] = useState("speakeasy-demo");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await q.signIn(email, password); }
    catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div style={s.signinWrap}>
      <div style={s.card}>
        <div style={s.h2}>Sign in</div>
        <p style={s.sub}>Pick a seeded account. Every demo password is <code style={s.code}>speakeasy-demo</code>. What each role can see is decided by the database, not this screen.</p>
        <label style={s.lbl}>Account</label>
        <select value={email} onChange={(e) => setEmail(e.target.value)} style={s.input}>
          {ACCOUNTS.map((a) => <option key={a.email} value={a.email}>{a.label}</option>)}
        </select>
        <label style={s.lbl}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={s.input} />
        <button onClick={go} disabled={busy} style={s.primary}>{busy ? "Signing in..." : "Enter"}</button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return <div style={s.section}><div style={s.sectionTitle}>{title}</div>{children}</div>;
}
function Pill({ status }) {
  const map = { approved: C.approve, granted: C.approve, pending: C.pending, requested: C.pending, demoted: "#b08a4a", blocked: C.block, denied: C.muted, revoked: C.muted };
  const col = map[status] || C.muted;
  return <span style={{ ...s.pill, color: col, borderColor: col + "55", background: col + "18" }}>{status}</span>;
}

function BartenderPanel({ onError }) {
  const [me, setMe] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [reqs, setReqs] = useState([]);

  const load = useCallback(async () => {
    try {
      const prof = await q.myBartenderProfile();
      setMe(prof);
      if (!prof) return;
      const [m, f, sh, r] = await Promise.all([
        q.myMetrics(prof.id), q.myFollowers(prof.id), q.myShifts(prof.id), q.myBarRequests(prof.id),
      ]);
      setMetrics(m); setFollowers(f); setShifts(sh); setReqs(r);
    } catch (e) { onError(e.message); }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => { try { await fn(); await load(); } catch (e) { onError(e.message); } };
  if (!me) return <div style={s.note}>No bartender profile for this account.</div>;

  return (
    <>
      <div style={s.panelHead}>Bartender studio, {me.display_name}</div>
      {metrics && (
        <Section title="Your metrics (only you can read this row)">
          <div style={s.metricRow}>
            <Metric label="Followers" value={metrics.followers} />
            <Metric label="Subscribers" value={metrics.subscribers} />
            <Metric label="Revenue" value={fmtMoney(metrics.revenue_cents)} />
            <Metric label="Rank score" value={metrics.rank_score} />
          </div>
        </Section>
      )}
      <Section title="Followers">
        {followers.map((f) => (
          <div key={f.id} style={s.row}>
            <div style={{ flex: 1 }}>
              <div>{f.patron?.display_name ?? "Patron (profile not shared)"}</div>
              <div style={s.rowSub}>{f.tiers?.name} · <Pill status={f.status} /></div>
            </div>
            {f.status === "pending" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button style={s.approve} onClick={() => act(() => q.decideSubscription(f.id, "approved"))}>Approve</button>
                <button style={s.block} onClick={() => act(() => q.decideSubscription(f.id, "blocked"))}>Block</button>
              </div>
            ) : (
              <button style={s.ghost} onClick={() => act(() => q.decideSubscription(f.id, "demoted"))}>Demote</button>
            )}
          </div>
        ))}
      </Section>
      <Section title="Shifts, set visibility">
        {shifts.map((sh) => (
          <div key={sh.id} style={s.row}>
            <div style={{ flex: 1 }}>
              <div>{sh.venues?.name}</div>
              <div style={s.rowSub}>{fmtWhen(sh.starts_at)}</div>
            </div>
            <select
              value={scopeLabel(sh.visibility, sh.min_tier_rank)}
              onChange={(e) => {
                const opt = SCOPES.find((o) => o.label === e.target.value);
                act(() => q.setShiftScope(sh.id, opt.visibility, opt.rank));
              }}
              style={s.select}
            >
              {SCOPES.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </Section>
      <Section title="Bar requests">
        {reqs.length === 0 && <div style={s.note}>No requests.</div>}
        {reqs.map((r) => (
          <div key={r.id} style={s.row}>
            <div style={{ flex: 1 }}>
              <div>{r.bar_accounts?.name}{r.offer_cents > 0 && <span style={s.offer}> {fmtMoney(r.offer_cents)}/mo</span>}</div>
              <div style={s.rowSub}><Pill status={r.status} /></div>
            </div>
            {r.status === "requested" && (
              <div style={{ display: "flex", gap: 6 }}>
                <button style={s.approve} onClick={() => act(() => q.decideGrant(r.id, "granted"))}>Grant</button>
                <button style={s.ghost} onClick={() => act(() => q.decideGrant(r.id, "denied"))}>Decline</button>
              </div>
            )}
            {r.status === "granted" && (
              <button style={s.ghost} onClick={() => act(() => q.decideGrant(r.id, "revoked"))}>Revoke</button>
            )}
          </div>
        ))}
      </Section>
    </>
  );
}

function PatronPanel({ onError }) {
  const [bartenders, setBartenders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [posts, setPosts] = useState([]);

  const loadFixed = useCallback(async () => {
    try {
      const bs = await q.discoverBartenders();
      setBartenders(bs);
      setSelected((cur) => cur ?? bs[0] ?? null);
      setSubs(await q.mySubscriptions());
    } catch (e) { onError(e.message); }
  }, [onError]);
  useEffect(() => { loadFixed(); }, [loadFixed]);

  const loadSelected = useCallback(async () => {
    if (!selected) return;
    try {
      const [t, sh, p] = await Promise.all([
        q.tiersFor(selected.id), q.visibleShifts(selected.id), q.visiblePosts(selected.id),
      ]);
      setTiers(t); setShifts(sh); setPosts(p);
    } catch (e) { onError(e.message); }
  }, [selected, onError]);
  useEffect(() => { loadSelected(); }, [loadSelected]);

  const act = async (fn) => { try { await fn(); await loadFixed(); await loadSelected(); } catch (e) { onError(e.message); } };
  const subFor = (id) => subs.find((x) => x.bartender_id === id);

  return (
    <>
      <div style={s.panelHead}>Patron</div>
      <Section title="Discover">
        {bartenders.map((b) => (
          <div key={b.id} style={{ ...s.row, ...(selected?.id === b.id ? s.rowOn : {}) }} onClick={() => setSelected(b)}>
            <div style={{ flex: 1 }}>
              <div>{b.display_name}</div>
              <div style={s.rowSub}>{b.specialty}</div>
            </div>
            {subFor(b.id) && <Pill status={subFor(b.id).status} />}
          </div>
        ))}
      </Section>
      {selected && (
        <>
          <Section title={`Tiers, ${selected.display_name}`}>
            {tiers.map((t) => (
              <div key={t.id} style={s.row}>
                <div style={{ flex: 1 }}>
                  <div>{t.name} <span style={s.offer}>{fmtMoney(t.price_cents)}/mo</span></div>
                </div>
                <button style={s.primarySm} onClick={() => act(() => q.requestSubscription(selected.id, t.id))}>Request</button>
              </div>
            ))}
          </Section>
          <Section title="Shifts you can see">
            {shifts.length === 0 && <div style={s.note}>Nothing visible yet. Get approved at a tier to unlock.</div>}
            {shifts.map((sh) => (
              <div key={sh.id} style={s.row}>
                <div style={{ flex: 1 }}>{sh.venues?.name}</div>
                <div style={s.rowSub}>{fmtWhen(sh.starts_at)} · {scopeLabel(sh.visibility, sh.min_tier_rank)}</div>
              </div>
            ))}
          </Section>
          <Section title="Posts you can see">
            {posts.length === 0 && <div style={s.note}>No posts unlocked at your tier.</div>}
            {posts.map((p) => (
              <div key={p.id} style={s.row}>
                <div style={{ flex: 1 }}><span style={s.kind}>{p.kind}</span> {p.title}</div>
              </div>
            ))}
          </Section>
          {subFor(selected.id)?.status === "approved" && (
            <Section title="Tip directly">
              <div style={{ display: "flex", gap: 8 }}>
                {[500, 1000, 2000].map((amt) => (
                  <button key={amt} style={s.ghost} onClick={() => act(() => q.tip(selected.id, amt))}>{fmtMoney(amt)}</button>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </>
  );
}

function BarPanel({ onError }) {
  const [bar, setBar] = useState(null);
  const [signals, setSignals] = useState([]);
  const [grants, setGrants] = useState([]);
  const [peek, setPeek] = useState({}); // bartenderId -> shifts

  const load = useCallback(async () => {
    try {
      const b = await q.myBar();
      setBar(b);
      setSignals(await q.talentSignals());
      if (b) setGrants(await q.barGrants(b.bar_id));
    } catch (e) { onError(e.message); }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  const grantFor = (bid) => grants.find((g) => g.bartender_id === bid);
  const act = async (fn) => { try { await fn(); await load(); } catch (e) { onError(e.message); } };
  const peekShifts = async (bid) => {
    try {
      const rows = await q.barVisibleShifts(bid);
      setPeek((p) => ({ ...p, [bid]: rows }));
    } catch (e) { onError(e.message); }
  };

  if (!bar) return <div style={s.note}>No bar membership for this account.</div>;
  return (
    <>
      <div style={s.panelHead}>{bar.bar_accounts?.name}, venue account</div>
      <Section title="Favored talent (banded signals only, no schedule, revenue, or patron identities)">
        {signals.map((sig) => {
          const g = grantFor(sig.bartender_id);
          return (
            <div key={sig.bartender_id} style={s.colRow}>
              <div style={s.row}>
                <div style={{ flex: 1 }}>
                  <div>{sig.display_name}</div>
                  <div style={s.rowSub}>{sig.specialty} · rank {sig.rank_score} · trend #{sig.trend_rank} · {sig.follower_band}</div>
                </div>
                {g ? <Pill status={g.status} /> : (
                  <button style={s.primarySm} onClick={() => act(() => q.requestVisibility(sig.bartender_id, bar.bar_id, 2500))}>Request visibility</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button style={s.ghostSm} onClick={() => peekShifts(sig.bartender_id)}>Try to read shifts</button>
                {peek[sig.bartender_id] && (
                  <span style={s.rowSub}>
                    {peek[sig.bartender_id].length === 0
                      ? "0 rows returned (blocked until granted)"
                      : peek[sig.bartender_id].map((x) => x.venues?.name).join(", ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Section>
    </>
  );
}

function Metric({ label, value }) {
  return <div style={s.metric}><div style={s.metricVal}>{value}</div><div style={s.metricLabel}>{label}</div></div>;
}

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; }
button { cursor: pointer; font-family: 'Jost', sans-serif; }
select, input { font-family: 'Jost', sans-serif; }
select option { background:${C.raised}; color:${C.text}; }
`;

const s = {
  root: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Jost', sans-serif" },
  topbar: { display: "flex", alignItems: "center", gap: 11, padding: "14px 20px", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, background: C.bg, zIndex: 5 },
  mark: { width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 8, border: `1px solid ${C.brass}`, color: C.brass, fontSize: 16 },
  brandName: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 19, letterSpacing: 1.5 },
  live: { fontSize: 11.5, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 20, padding: "4px 11px" },
  signout: { marginLeft: "auto", background: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 13px", fontSize: 13 },
  err: { background: "rgba(191,91,79,0.15)", color: "#e7b0a8", borderBottom: `1px solid ${C.block}55`, padding: "10px 20px", fontSize: 13 },

  main: { maxWidth: 620, margin: "0 auto", padding: "20px 18px 60px" },
  who: { fontSize: 13, color: C.muted, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 },
  roleTag: { fontSize: 11, color: C.brass, border: `1px solid ${C.line}`, borderRadius: 20, padding: "3px 10px", textTransform: "capitalize" },
  panelHead: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, margin: "6px 0 14px" },

  signinWrap: { display: "flex", justifyContent: "center", padding: "60px 18px" },
  card: { width: 380, maxWidth: "100%", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24 },
  h2: { fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600 },
  sub: { fontSize: 13, color: C.muted, lineHeight: 1.55, margin: "6px 0 18px" },
  code: { color: C.brassHi, background: C.raised, padding: "1px 6px", borderRadius: 5, fontSize: 12 },
  lbl: { display: "block", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.muted, margin: "12px 0 6px" },
  input: { width: "100%", background: C.raised, color: C.text, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 12px", fontSize: 14 },
  primary: { width: "100%", marginTop: 18, background: C.brass, color: "#1a1206", border: "none", borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600 },

  section: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: C.muted, marginBottom: 10 },
  row: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.line}` },
  colRow: { padding: "6px 0", borderTop: `1px solid ${C.line}` },
  rowOn: { color: C.brassHi },
  rowSub: { fontSize: 12, color: C.muted, marginTop: 3, display: "flex", alignItems: "center", gap: 6 },
  note: { fontSize: 13, color: C.muted, padding: "6px 0" },
  offer: { color: C.brass, fontSize: 12.5 },
  kind: { fontSize: 11, color: C.brass, border: `1px solid ${C.line}`, borderRadius: 6, padding: "1px 7px", marginRight: 6 },

  metricRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 },
  metric: { background: C.raised, borderRadius: 10, padding: 12 },
  metricVal: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: C.brassHi },
  metricLabel: { fontSize: 11, color: C.muted, marginTop: 2 },

  pill: { fontSize: 11, border: "1px solid", borderRadius: 20, padding: "3px 10px", textTransform: "capitalize" },
  select: { background: C.raised, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13 },
  approve: { background: "transparent", color: C.approve, border: `1px solid ${C.approve}66`, borderRadius: 8, padding: "7px 12px", fontSize: 13 },
  block: { background: "transparent", color: C.block, border: `1px solid ${C.block}66`, borderRadius: 8, padding: "7px 12px", fontSize: 13 },
  ghost: { background: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px", fontSize: 13 },
  ghostSm: { background: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 10px", fontSize: 12 },
  primarySm: { background: C.brass, color: "#1a1206", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600 },
};
