import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase.js";
import * as q from "./lib/queries.js";
import {
  Wine, User, Building2, Lock, Globe, Sparkles, Crown, Calendar, Heart,
  Check, X, ArrowDown, TrendingUp, Flame, Users, MapPin, ShieldCheck,
  BadgeCheck, Clock, Eye, Wallet, Layers, LogOut, Gift, Camera, Upload, Film, Moon, Sun
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Speakeasy, live UI over RLS-backed data.                           */
/*  Nothing here enforces access. Every list is whatever the database  */
/*  returned for the signed-in user. Locked content is absent, not     */
/*  blurred, because RLS filtered it server-side.                      */
/* ------------------------------------------------------------------ */

const FONTS =
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@300;400;500;600&display=swap');";
// Two moods, one speakeasy: "after dark" (brass on near-black) and "last call"
// a warm daytime parlor (bronze on parchment). Styles are built from whichever
// palette is active, so the toggle flips the whole room.
const PALETTES = {
  dark: {
    bg: "#14100b", frame: "#1a1510", panel: "#1d1813", raised: "#261f16", line: "rgba(201,163,91,0.16)",
    brass: "#c9a35b", brassHi: "#e7cc8e", text: "#f1eadd", muted: "#9a8f7c",
    approve: "#7ba36f", pending: "#d8a64a", block: "#bf5b4f", blue: "#7fa8c9",
    headerBg: "rgba(20,16,11,0.9)", glow: "rgba(201,163,91,0.10)",
  },
  light: {
    bg: "#f4ede0", frame: "#efe6d5", panel: "#fbf6ec", raised: "#f1e8d6", line: "rgba(123,86,28,0.20)",
    brass: "#a9761f", brassHi: "#7c5214", text: "#2b2117", muted: "#6d6153",
    approve: "#4f7a43", pending: "#8a6410", block: "#a23b2f", blue: "#3f6f98",
    headerBg: "rgba(244,237,224,0.9)", glow: "rgba(169,118,31,0.10)",
  },
};
let appliedMode = "dark";
let C = PALETTES.dark;
function applyTheme(mode) {
  if (mode === appliedMode) return;
  appliedMode = mode;
  C = PALETTES[mode] || PALETTES.dark;
  s = makeStyles(C);
  CSS = makeCSS(C);
}

const ACCOUNTS = [
  { label: "Remy, bartender", email: "remy@speakeasy.test" },
  { label: "Alex, patron", email: "alex@speakeasy.test" },
  { label: "The Gilded Owl, bar", email: "owl@speakeasy.test" },
  { label: "Marcus, patron", email: "marcus@speakeasy.test" },
  { label: "Nadia, bartender", email: "nadia@speakeasy.test" },
];
const SCOPES = [
  { label: "Private", visibility: "private", rank: null },
  { label: "Public", visibility: "public", rank: null },
  { label: "Regulars", visibility: "members", rank: 1 },
  { label: "Inner Circle", visibility: "members", rank: 2 },
  { label: "Top Shelf", visibility: "members", rank: 3 },
];
const ROLE_META = {
  bartender: { label: "Bartender", icon: Wine },
  patron: { label: "Patron", icon: User },
  bar: { label: "Bar", icon: Building2 },
};

const money = (c) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: c % 100 ? 2 : 0 })}`;
const when = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
const scopeLabel = (v, r) =>
  v === "private" ? "Private" : v === "public" ? "Public" :
  r === 1 ? "Regulars" : r === 2 ? "Inner Circle" : r === 3 ? "Top Shelf" : "Members";
const initials = (name) => (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// One responsive codebase: components branch on viewport width instead of CSS
// media queries, since the UI is built with inline styles.
function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [roles, setRoles] = useState([]);
  const [active, setActive] = useState(null);
  const [toast, setToast] = useState(null);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem("speakeasy-theme") || "dark"; } catch { return "dark"; }
  });
  applyTheme(mode);
  const w = useViewport();
  useEffect(() => { try { localStorage.setItem("speakeasy-theme", mode); } catch { /* ignore */ } }, [mode]);

  const ping = useCallback((t) => { setToast(t); setTimeout(() => setToast(null), 2400); }, []);

  useEffect(() => {
    q.getSession().then(setSession);
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setRoles([]); setActive(null); return; }
    q.myRoles().then((r) => { setRoles(r); setActive(r[0] ?? null); }).catch((e) => setErr(e.message));
  }, [session]);

  return (
    <div style={s.root}>
      <style>{FONTS + CSS}</style>

      <header style={s.topbar}>
        <span style={s.mark}>◊</span>
        <span style={s.brandName}>SPEAKEASY</span>
        {w >= 560 && <span style={s.live}><span style={s.liveDot} /> velvet rope: up</span>}
        {session && roles.length > 1 && (
          <div style={s.segmented}>
            {roles.map((r) => {
              const M = ROLE_META[r]; const on = active === r; const Icon = M.icon;
              return (
                <button key={r} onClick={() => setActive(r)} style={{ ...s.seg, ...(on ? s.segOn : {}) }}>
                  <Icon size={14} /> {M.label}
                </button>
              );
            })}
          </div>
        )}
        <div style={s.rightControls}>
          <button onClick={() => setMode(mode === "dark" ? "light" : "dark")} style={s.themeBtn}
            title={mode === "dark" ? "Raise the blinds (light)" : "Dim the lights (dark)"}>
            {mode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {session && (
            <button onClick={() => q.signOut()} style={s.signout}><LogOut size={14} /> Last call</button>
          )}
        </div>
      </header>

      {err && <div style={s.err} onClick={() => setErr(null)}>{err}  (tap to dismiss)</div>}

      {!session ? (
        <SignIn onError={setErr} />
      ) : (
        <>
          {active === "bartender" && <BartenderStudio onError={setErr} ping={ping} />}
          {active === "patron" && <PatronApp onError={setErr} ping={ping} />}
          {active === "bar" && <BarConsole onError={setErr} ping={ping} />}
          {!active && <div style={s.note}>No role on this account.</div>}
        </>
      )}

      {toast && <div style={s.toast} className="pop"><Check size={15} />{toast}</div>}
    </div>
  );
}

/* ----------------------------- Sign in ----------------------------- */
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
      <div style={s.signinCard} className="rise">
        <div style={s.signinMark}>◊</div>
        <div style={s.h2}>Members only</div>
        <p style={s.sub}>Give the word and step inside. What each guest sees is set by the house, not this door.</p>
        <label style={s.lbl}>Account</label>
        <select value={email} onChange={(e) => setEmail(e.target.value)} style={s.input}>
          {ACCOUNTS.map((a) => <option key={a.email} value={a.email}>{a.label}</option>)}
        </select>
        <label style={s.lbl}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={s.input}
          onKeyDown={(e) => e.key === "Enter" && go()} />
        <button onClick={go} disabled={busy} style={s.primary}>{busy ? "Checking the list…" : "Step inside"}</button>
      </div>
    </div>
  );
}

/* --------------------------- Bartender ----------------------------- */
function BartenderStudio({ onError, ping }) {
  const [me, setMe] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const w = useViewport();
  const desktop = w >= 980;

  const load = useCallback(async () => {
    try {
      const prof = await q.myBartenderProfile();
      setMe(prof);
      if (!prof) return;
      const [m, f, sh, r, md] = await Promise.all([
        q.myMetrics(prof.id), q.myFollowers(prof.id), q.myShifts(prof.id), q.myBarRequests(prof.id), q.listBartenderMedia(prof.id),
      ]);
      setMetrics(m); setFollowers(f); setShifts(sh); setReqs(r); setMedia(md);
    } catch (e) { onError(e.message); }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, msg) => { try { await fn(); if (msg) ping(msg); await load(); } catch (e) { onError(e.message); } };
  const uploadMedia = async (file) => {
    setMediaBusy(true);
    try { await q.addBartenderMedia(me.id, file); ping("Added to gallery"); await load(); }
    catch (e) { onError(e.message); } finally { setMediaBusy(false); }
  };
  const removeMedia = (m) => act(() => q.deleteMedia(m.id, m.storage_path), "Removed");
  if (!me) return <div style={s.wrap}><div style={s.note}>No bartender profile on this account.</div></div>;

  const pending = followers.filter((f) => f.status === "pending");
  const order = { pending: 0, approved: 1, demoted: 2, blocked: 3 };
  const sorted = [...followers].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  const followersPanel = (
    <Panel title={`Followers${pending.length ? ` · ${pending.length} awaiting you` : ""}`}>
      {sorted.length === 0 && <Empty>Nobody's pulled up a stool yet.</Empty>}
      {sorted.map((f) => (
        <Row key={f.id}>
          <Avatar url={f.patron?.avatar_url} name={f.patron?.display_name} size={40} />
          <div style={{ flex: 1 }}>
            <div style={s.rowMain}>
              {f.patron?.display_name ?? "Patron"}
              {f.patron?.identity_verified && <BadgeCheck size={13} color={C.approve} />}
            </div>
            <div style={s.rowSub}>{f.tiers?.name} · <Status s={f.status} /></div>
          </div>
          {f.status === "pending" ? (
            <div style={s.btnRow}>
              <IconBtn tone="approve" onClick={() => act(() => q.decideSubscription(f.id, "approved"), "Approved")}><Check size={15} /></IconBtn>
              <IconBtn tone="block" onClick={() => act(() => q.decideSubscription(f.id, "blocked"), "Blocked")}><X size={15} /></IconBtn>
            </div>
          ) : (
            <div style={s.btnRow}>
              <IconBtn tone="mute" onClick={() => act(() => q.decideSubscription(f.id, "demoted"), "Demoted")}><ArrowDown size={15} /></IconBtn>
              <IconBtn tone="block" onClick={() => act(() => q.decideSubscription(f.id, "blocked"), "Blocked")}><X size={15} /></IconBtn>
            </div>
          )}
        </Row>
      ))}
    </Panel>
  );

  const shiftsPanel = (
    <Panel title="Shifts · the guest list">
      {shifts.map((sh) => (
        <Row key={sh.id}>
          <DateChip iso={sh.starts_at} />
          <div style={{ flex: 1 }}>
            <div style={s.rowMain}>{sh.venues?.name ?? "Venue"}</div>
            <div style={s.rowSub}>{when(sh.starts_at)}</div>
          </div>
          <ScopePill v={sh.visibility} r={sh.min_tier_rank} />
          <select
            value={scopeLabel(sh.visibility, sh.min_tier_rank)}
            onChange={(e) => {
              const o = SCOPES.find((x) => x.label === e.target.value);
              act(() => q.setShiftScope(sh.id, o.visibility, o.rank), `Shift → ${o.label}`);
            }}
            style={s.select}>
            {SCOPES.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
          </select>
        </Row>
      ))}
    </Panel>
  );

  const mediaPanel = (
    <Panel title="The gallery">
      <MediaManager items={media} onUpload={uploadMedia} onDelete={removeMedia} busy={mediaBusy} />
    </Panel>
  );

  const barReqPanel = (
    <Panel title="Bar requests">
      {reqs.length === 0 && <Empty>No houses calling.</Empty>}
      {reqs.map((r) => (
        <Row key={r.id}>
          <div style={s.barIcon}><Building2 size={18} color={C.brass} /></div>
          <div style={{ flex: 1 }}>
            <div style={s.rowMain}>
              {r.bar_accounts?.name ?? "Bar"}
              {r.offer_cents > 0 && <span style={s.offer}>{money(r.offer_cents)}/mo offered</span>}
            </div>
            <div style={s.rowSub}>Requests visibility of your shifts · <Status s={r.status} /></div>
          </div>
          {r.status === "requested" && (
            <div style={s.btnRow}>
              <SmallBtn onClick={() => act(() => q.decideGrant(r.id, "granted"), "Granted, revocable anytime")}><Check size={13} /> Grant</SmallBtn>
              <GhostBtn onClick={() => act(() => q.decideGrant(r.id, "denied"), "Declined")}>Decline</GhostBtn>
            </div>
          )}
          {r.status === "granted" && <GhostBtn onClick={() => act(() => q.decideGrant(r.id, "revoked"), "Revoked")}>Revoke</GhostBtn>}
        </Row>
      ))}
    </Panel>
  );

  return (
    <div style={s.wrapWide}>
      <div style={s.studioHead} className="rise">
        <Avatar url={me.avatar_url} name={me.display_name} size={60} editable
          onPick={(f) => act(() => q.setBartenderAvatar(me.id, f), "Photo updated")} />
        <div style={{ flex: 1 }}>
          <h1 style={s.h1}>{me.display_name}</h1>
          <div style={s.subline}>{me.specialty}{me.handle ? ` · @${me.handle}` : ""}</div>
        </div>
        <div style={s.priorityTag}><ShieldCheck size={14} /> Your room, your rules</div>
      </div>

      {metrics && (
        <div style={{ ...s.metricGrid, gridTemplateColumns: w < 640 ? "repeat(2,1fr)" : "repeat(4,1fr)" }}>
          <Metric icon={Users} label="Followers" value={metrics.followers} />
          <Metric icon={Layers} label="Subscribers" value={metrics.subscribers} />
          <Metric icon={Wallet} label="Revenue" value={money(metrics.revenue_cents)} note="for your eyes only" />
          <Metric icon={TrendingUp} label="Rank score" value={metrics.rank_score} note={metrics.trend_rank ? `trending #${metrics.trend_rank}` : null} />
        </div>
      )}

      {desktop ? (
        <div style={s.colGrid}>
          <div>{followersPanel}{barReqPanel}</div>
          <div>{shiftsPanel}{mediaPanel}</div>
        </div>
      ) : (
        <>{followersPanel}{shiftsPanel}{mediaPanel}{barReqPanel}</>
      )}
    </div>
  );
}

/* ----------------------------- Patron ------------------------------ */
function PatronApp({ onError, ping }) {
  const [bartenders, setBartenders] = useState([]);
  const [subs, setSubs] = useState([]);
  const [sel, setSel] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [media, setMedia] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [tipOpen, setTipOpen] = useState(false);

  const loadTop = useCallback(async () => {
    try {
      const bs = await q.discoverBartenders();
      setBartenders(bs);
      setSel((cur) => cur ?? bs[0] ?? null);
      setSubs(await q.mySubscriptions());
      setMyProfile(await q.getMyPatronProfile());
    } catch (e) { onError(e.message); }
  }, [onError]);
  useEffect(() => { loadTop(); }, [loadTop]);

  const loadSel = useCallback(async () => {
    if (!sel) return;
    try {
      const [t, sh, p, md] = await Promise.all([q.tiersFor(sel.id), q.visibleShifts(sel.id), q.visiblePosts(sel.id), q.listBartenderMedia(sel.id)]);
      setTiers(t); setShifts(sh); setPosts(p); setMedia(md);
    } catch (e) { onError(e.message); }
  }, [sel, onError]);
  useEffect(() => { loadSel(); }, [loadSel]);

  const act = async (fn, msg) => { try { await fn(); if (msg) ping(msg); await loadTop(); await loadSel(); } catch (e) { onError(e.message); } };
  const subFor = (id) => subs.find((x) => x.bartender_id === id);
  const mySub = sel ? subFor(sel.id) : null;
  const approved = mySub?.status === "approved";
  const myRank = approved ? (mySub.tiers?.rank ?? 0) : 0;
  const w = useViewport();
  const desktop = w >= 900;

  const discover = (
    <div style={desktop ? s.discCol : undefined}>
      {myProfile && (
        <div style={s.selfCard}>
          <Avatar url={myProfile.avatar_url} name={myProfile.display_name} size={46} editable
            onPick={(f) => act(() => q.setPatronAvatar(f), "Photo updated")} />
          <div style={{ flex: 1 }}>
            <div style={s.rowMain}>{myProfile.display_name}</div>
            <div style={s.rowSub}>Your tab</div>
          </div>
        </div>
      )}
      <div style={s.phoneEyebrow}>Who's pouring</div>
      {bartenders.map((b) => {
        const sb = subFor(b.id);
        return (
          <button key={b.id} onClick={() => setSel(b)} style={{ ...s.discCard, ...(sel?.id === b.id ? s.discOn : {}) }}>
            <Avatar url={b.avatar_url} name={b.display_name} size={46} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={s.rowMain}>{b.display_name}</div>
              <div style={s.rowSub}>{b.specialty}</div>
            </div>
            {sb ? <Status s={sb.status} /> : <Lock size={14} color={C.muted} />}
          </button>
        );
      })}
    </div>
  );

  const detail = sel && (
    <div style={{ maxWidth: desktop ? 600 : "none" }}>
      <div style={{ ...s.profBlock, ...(desktop ? { borderTop: "none", marginTop: 0, paddingTop: 2 } : {}) }} className="rise">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 11 }}>
          <Avatar url={sel.avatar_url} name={sel.display_name} size={72} />
        </div>
        <div style={s.profName}>{sel.display_name}</div>
        <div style={s.profHandle}>{sel.handle ? `@${sel.handle}` : ""} · {sel.specialty}</div>
        {approved && <span style={s.memberPill}><BadgeCheck size={13} /> {mySub.tiers?.name} member</span>}
        {mySub?.status === "pending" && <span style={s.pendPill}><Clock size={13} /> On the list, waiting</span>}
        {mySub?.status === "demoted" && <span style={s.pendPill}><ArrowDown size={13} /> Moved to the back</span>}
      </div>

      {approved && (
        <button onClick={() => setTipOpen(true)} style={s.tipBtn}><Heart size={15} /> Slip {sel.display_name.split(" ")[0]} a little something</button>
      )}

      <div style={s.phoneSection}>Tiers</div>
      {tiers.map((t) => (
        <div key={t.id} style={s.tierCard}>
          <div style={s.tierHead}>
            <span style={s.tierName}>{t.name} {t.rank === 3 && <Crown size={13} color={C.brass} />}</span>
            <span style={s.tierPrice}>{money(t.price_cents)}<span style={s.mo}>/mo</span></span>
          </div>
          {Array.isArray(t.perks) && (
            <ul style={s.perks}>{t.perks.map((p, i) => <li key={i} style={s.perk}><Check size={12} color={C.brass} /> {p}</li>)}</ul>
          )}
          {(() => {
            const curRank = approved ? (mySub.tiers?.rank ?? 0) : -1;
            if (approved && curRank === t.rank)
              return <div style={s.youreIn}><Check size={13} color={C.approve} /> You're in</div>;
            if (mySub?.status === "pending" && mySub.tiers?.rank === t.rank)
              return <button disabled style={{ ...s.joinBtn, opacity: 0.5 }}>At the door</button>;
            const label = approved && t.rank > curRank ? "Move up"
              : mySub?.status === "demoted" ? "Knock again"
              : "Ask for an in";
            const msg = label === "Move up" ? "Moving up, awaiting the nod" : "Ask sent";
            return <button onClick={() => act(() => q.requestSubscription(sel.id, t.id), msg)} style={s.joinBtn}>{label}</button>;
          })()}
        </div>
      ))}

      <div style={s.phoneSection}><Calendar size={13} /> Shifts you can see</div>
      {shifts.length === 0 && <Empty>Nothing on the list yet. Get waved in at a tier to see shifts.</Empty>}
      {shifts.map((sh) => (
        <div key={sh.id} style={s.pRow}>
          <DateChip iso={sh.starts_at} />
          <div style={{ flex: 1 }}>
            <div style={s.rowMain}>{sh.venues?.name ?? "Venue"}</div>
            <div style={s.rowSub}>{when(sh.starts_at)}</div>
          </div>
          <ScopePill v={sh.visibility} r={sh.min_tier_rank} />
        </div>
      ))}
      {approved && myRank < 3 && (
        <div style={s.unlockNote}><Lock size={12} /> Higher tiers open more doors. Anything above your tier never leaves the back room.</div>
      )}

      <div style={s.phoneSection}><Sparkles size={13} /> Posts you can see</div>
      {posts.length === 0 && <Empty>Nothing poured for your tier yet.</Empty>}
      {posts.map((p) => (
        <div key={p.id} style={s.pRow}>
          <span style={s.kind}>{p.kind}</span>
          <div style={{ flex: 1 }}><div style={s.rowMain}>{p.title}</div></div>
        </div>
      ))}

      {media.length > 0 && (
        <>
          <div style={s.phoneSection}><Camera size={13} /> Gallery</div>
          <MediaGallery items={media} />
        </>
      )}
    </div>
  );

  return (
    <div style={s.patronWrap}>
      <div style={desktop ? s.patronGrid : s.patronStack}>
        {discover}
        {detail}
      </div>

      {tipOpen && <TipSheet name={sel?.display_name?.split(" ")[0]} close={() => setTipOpen(false)}
        send={async (amt) => {
          setTipOpen(false);
          try {
            // Real path: Stripe Checkout via the Edge Function. Redirects away.
            const url = await q.startCheckout(sel.id, amt, "tip");
            window.location.href = url;
          } catch {
            // Fallback until the Edge Functions are deployed: record a demo tip.
            await act(() => q.tip(sel.id, amt), `Sent ${money(amt)} (demo, Stripe not deployed yet)`);
          }
        }} />}

      <p style={s.caption}>You're at the bar. What's locked isn't blurred, it's just never poured: the database doesn't send it.</p>
    </div>
  );
}

/* ------------------------------- Bar ------------------------------- */
function BarConsole({ onError, ping }) {
  const [bar, setBar] = useState(null);
  const [signals, setSignals] = useState([]);
  const [grants, setGrants] = useState([]);
  const [peek, setPeek] = useState({});
  const [media, setMedia] = useState([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const w = useViewport();

  const load = useCallback(async () => {
    try {
      const b = await q.myBar();
      setBar(b);
      setSignals(await q.talentSignals());
      if (b) { setGrants(await q.barGrants(b.bar_id)); setMedia(await q.listBarMedia(b.bar_id)); }
    } catch (e) { onError(e.message); }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  const grantFor = (bid) => grants.find((g) => g.bartender_id === bid);
  const act = async (fn, msg) => { try { await fn(); if (msg) ping(msg); await load(); } catch (e) { onError(e.message); } };
  const uploadMedia = async (file) => {
    setMediaBusy(true);
    try { await q.addBarMedia(bar.bar_id, file); ping("Added to gallery"); await load(); }
    catch (e) { onError(e.message); } finally { setMediaBusy(false); }
  };
  const removeMedia = (m) => act(() => q.deleteMedia(m.id, m.storage_path), "Removed");
  const tryRead = async (bid) => {
    try { const rows = await q.barVisibleShifts(bid); setPeek((p) => ({ ...p, [bid]: rows })); }
    catch (e) { onError(e.message); }
  };

  if (!bar) return <div style={s.wrap}><div style={s.note}>No bar membership on this account.</div></div>;

  return (
    <div style={s.wrapWide}>
      <div style={s.studioHead} className="rise">
        <Avatar url={bar.bar_accounts?.avatar_url} name={bar.bar_accounts?.name} size={56} editable
          onPick={(f) => act(() => q.setBarAvatar(bar.bar_id, f), "Logo updated")} />
        <div style={{ flex: 1 }}>
          <h1 style={s.h1}>{bar.bar_accounts?.name}</h1>
          <div style={s.subline}>Venue account · you see signals, not secrets</div>
        </div>
      </div>

      <Panel title="What the house sees · and what it doesn't">
        <div style={{ ...s.compareGrid, gridTemplateColumns: w < 560 ? "1fr" : "1fr 1fr" }}>
          <div style={s.compareCol}>
            <div style={{ ...s.compareHead, color: C.approve }}><Eye size={14} /> Visible</div>
            {["Favored / trending signals", "Follower bands", "Granted schedules only"].map((x) =>
              <div key={x} style={s.compareRow}><Check size={13} color={C.approve} /> {x}</div>)}
          </div>
          <div style={s.compareCol}>
            <div style={{ ...s.compareHead, color: C.block }}><Lock size={14} /> Needs consent</div>
            {["Schedule & location", "Patron identities", "Revenue & tips"].map((x) =>
              <div key={x} style={s.compareRow}><Lock size={12} color={C.block} /> {x}</div>)}
          </div>
        </div>
      </Panel>

      <Panel title="The talent · signals only">
        {signals.length === 0 && <Empty>No one's stepped into the spotlight yet.</Empty>}
        {signals.map((sig) => {
          const g = grantFor(sig.bartender_id);
          const rows = peek[sig.bartender_id];
          return (
            <div key={sig.bartender_id} style={s.talentBlock}>
              <Row bare>
                <div style={s.avSm}>{initials(sig.display_name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={s.rowMain}>{sig.display_name}</div>
                  <div style={s.signals}>
                    <span style={s.signal}><TrendingUp size={11} /> rank {sig.rank_score}</span>
                    {sig.trend_rank && <span style={s.signal}><Flame size={11} /> #{sig.trend_rank}</span>}
                    <span style={s.signal}><Users size={11} /> {sig.follower_band}</span>
                    <span style={s.signal}><MapPin size={11} /> {sig.specialty}</span>
                  </div>
                </div>
                {g ? <Status s={g.status} /> :
                  <SmallBtn onClick={() => act(() => q.requestVisibility(sig.bartender_id, bar.bar_id, 2500), "Ask sent, the bartender decides")}>
                    <Eye size={13} /> Ask for the schedule
                  </SmallBtn>}
              </Row>

              {g?.status === "granted" && rows && rows.length > 0 && (
                <div style={s.grantBox}>
                  <div style={s.grantHead}><Calendar size={12} color={C.approve} /> Shared shifts · revocable</div>
                  {rows.map((r) => <div key={r.id} style={s.grantShift}><span>{r.venues?.name}</span><span style={{ color: C.muted }}>{when(r.starts_at)}</span></div>)}
                </div>
              )}

              <div style={s.peekRow}>
                <GhostBtn onClick={() => tryRead(sig.bartender_id)}>Peek at the schedule</GhostBtn>
                {rows && (
                  <span style={s.peekResult}>
                    {rows.length === 0
                      ? "0 rows — door's shut until they grant it"
                      : `${rows.length} row${rows.length > 1 ? "s" : ""} — you're on the list`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel title="The gallery">
        <MediaManager items={media} onUpload={uploadMedia} onDelete={removeMedia} busy={mediaBusy} />
      </Panel>
    </div>
  );
}

/* --------------------------- primitives ---------------------------- */
function Panel({ title, children }) {
  return <div style={s.panel} className="rise"><div style={s.panelHead}>{title}</div><div>{children}</div></div>;
}
function Row({ children, bare }) {
  return <div style={{ ...s.row, ...(bare ? { borderTop: "none", paddingTop: 2 } : {}) }}>{children}</div>;
}
function Empty({ children }) { return <div style={s.emptyRow}>{children}</div>; }
function Metric({ icon: Icon, label, value, note }) {
  return (
    <div style={s.metric} className="rise">
      <Icon size={17} strokeWidth={1.5} color={C.brass} />
      <div style={s.metricVal}>{value}</div>
      <div style={s.metricLabel}>{label}</div>
      {note && <div style={s.metricNote}>{note}</div>}
    </div>
  );
}
function DateChip({ iso }) {
  const d = new Date(iso);
  return (
    <div style={s.dateChip}>
      <div style={s.dDay}>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
      <div style={s.dNum}>{d.getDate()}</div>
    </div>
  );
}
function ScopePill({ v, r }) {
  const priv = v === "private", pub = v === "public";
  const color = priv ? C.muted : pub ? C.blue : C.brass;
  const Icon = priv ? Lock : pub ? Globe : Layers;
  return <span style={{ ...s.scopePill, color, borderColor: color + "55" }}><Icon size={11} /> {scopeLabel(v, r)}</span>;
}
function Status({ s: st }) {
  const map = {
    approved: [C.approve, "approved"], granted: [C.approve, "granted"], pending: [C.pending, "pending"],
    requested: [C.pending, "requested"], demoted: ["#b08a4a", "demoted"], blocked: [C.block, "blocked"],
    denied: [C.muted, "declined"], revoked: [C.muted, "revoked"], canceled: [C.muted, "canceled"],
  };
  const [color, label] = map[st] || [C.muted, st];
  return <span style={{ ...s.status, color, borderColor: color + "44", background: color + "16" }}>{label}</span>;
}
function IconBtn({ children, tone, onClick }) {
  const tones = { approve: C.approve, block: C.block, mute: C.muted };
  const col = tones[tone] || C.muted;
  return <button onClick={onClick} style={{ ...s.iconBtn, color: col, borderColor: col + "40" }}>{children}</button>;
}
function SmallBtn({ children, onClick }) { return <button onClick={onClick} style={s.smallBtn}>{children}</button>; }
function GhostBtn({ children, onClick }) { return <button onClick={onClick} style={s.ghostBtn}>{children}</button>; }
function TipSheet({ name, close, send }) {
  const [amt, setAmt] = useState(1000);
  return (
    <div style={s.sheetWrap} onClick={close}>
      <div style={s.sheet} className="slide" onClick={(e) => e.stopPropagation()}>
        <div style={s.sheetBar} />
        <div style={s.sheetTitle}>A little something for {name}</div>
        <p style={s.sheetSub}>Straight to {name}, no middleman. The house skims nothing off the top.</p>
        <div style={s.amtGrid}>
          {[500, 1000, 2000, 5000].map((a) => (
            <button key={a} onClick={() => setAmt(a)} style={{ ...s.amtBtn, ...(amt === a ? s.amtOn : {}) }}>{money(a)}</button>
          ))}
        </div>
        <button onClick={() => send(amt)} style={s.sheetCta}><Heart size={15} /> Send {money(amt)}</button>
      </div>
    </div>
  );
}

function Avatar({ url, name, size = 44, editable, onPick }) {
  const inputRef = useRef();
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {url
        ? <img src={url} alt={name || ""} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `1px solid ${C.brass}` }} />
        : <div style={{ ...s.avatarFallback, width: size, height: size, fontSize: Math.round(size / 3) }}>{initials(name)}</div>}
      {editable && (
        <>
          <button onClick={() => inputRef.current?.click()} style={s.avatarEdit} title="Change photo"><Camera size={13} /></button>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
        </>
      )}
    </div>
  );
}

function MediaTile({ m, onDelete }) {
  return (
    <figure style={s.galleryItem}>
      {m.kind === "video"
        ? <video src={q.mediaUrl(m.storage_path)} style={s.galleryMedia} controls preload="metadata" />
        : <img src={q.mediaUrl(m.storage_path)} alt={m.caption || ""} style={s.galleryMedia} loading="lazy" />}
      {m.caption && <figcaption style={s.galleryCap}>{m.caption}</figcaption>}
      {onDelete && <button onClick={() => onDelete(m)} style={s.galleryDel} title="Remove"><X size={13} /></button>}
    </figure>
  );
}

function MediaGallery({ items }) {
  if (!items?.length) return <Empty>No media yet.</Empty>;
  return <div style={s.galleryGrid}>{items.map((m) => <MediaTile key={m.id} m={m} />)}</div>;
}

function MediaManager({ items, onUpload, onDelete, busy }) {
  const inputRef = useRef();
  return (
    <div style={{ padding: "14px 18px 16px" }}>
      <button onClick={() => inputRef.current?.click()} style={{ ...s.smallBtn, opacity: busy ? 0.6 : 1 }} disabled={busy}>
        {busy ? <><Film size={13} /> Hanging it up…</> : <><Upload size={13} /> Add a photo or video</>}
      </button>
      <input ref={inputRef} type="file" accept="image/*,video/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      {items.length === 0
        ? <div style={{ ...s.emptyRow, paddingLeft: 0 }}>The gallery's bare.</div>
        : <div style={{ ...s.galleryGrid, marginTop: 13 }}>{items.map((m) => <MediaTile key={m.id} m={m} onDelete={onDelete} />)}</div>}
    </div>
  );
}

/* ----------------------------- styles ------------------------------ */
const makeCSS = (C) => `
* { box-sizing: border-box; }
body { margin: 0; background: ${C.bg}; }
button { cursor: pointer; font-family: 'Jost', sans-serif; border: none; background: none; }
select, input { font-family: 'Jost', sans-serif; outline: none; }
select option { background: ${C.raised}; color: ${C.text}; }
input:focus, select:focus { border-color: ${C.brass}; }
.rise { animation: rise .45s cubic-bezier(.2,.7,.3,1) both; }
@keyframes rise { from { opacity:0; transform: translateY(9px);} to {opacity:1; transform:none;} }
.pop { animation: pop .25s ease both; }
@keyframes pop { from { opacity:0; transform: translate(-50%,8px);} to {opacity:1; transform: translate(-50%,0);} }
.slide { animation: slide .3s cubic-bezier(.2,.8,.3,1) both; }
@keyframes slide { from { transform: translateY(100%);} to { transform:none;} }
::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 8px; }
`;

const makeStyles = (C) => ({
  root: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Jost', sans-serif",
    backgroundImage: `radial-gradient(circle at 50% -10%, ${C.glow}, transparent 55%)` },
  topbar: { display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", borderBottom: `1px solid ${C.line}`,
    position: "sticky", top: 0, background: C.headerBg, backdropFilter: "blur(12px)", zIndex: 20, flexWrap: "wrap", rowGap: 8 },
  mark: { width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 8, border: `1px solid ${C.brass}`, color: C.brass, fontSize: 16 },
  brandName: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 19, letterSpacing: 1.5 },
  live: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 20, padding: "4px 11px" },
  liveDot: { width: 7, height: 7, borderRadius: "50%", background: C.approve },
  segmented: { display: "flex", gap: 3, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 3 },
  rightControls: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 },
  themeBtn: { display: "grid", placeItems: "center", width: 36, height: 36, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8 },
  seg: { display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 7, color: C.muted, fontSize: 13 },
  segOn: { background: C.brass, color: "#1a1206", fontWeight: 600 },
  signout: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 13px", fontSize: 13 },
  err: { background: `${C.block}22`, color: C.block, borderBottom: `1px solid ${C.block}55`, padding: "10px 22px", fontSize: 13, cursor: "pointer" },

  wrap: { maxWidth: 680, margin: "0 auto", padding: "26px 20px 70px" },
  wrapWide: { maxWidth: 1120, margin: "0 auto", padding: "26px 24px 70px" },
  colGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" },
  note: { maxWidth: 680, margin: "40px auto", textAlign: "center", color: C.muted, fontSize: 14 },

  studioHead: { display: "flex", alignItems: "center", gap: 16, marginBottom: 22 },
  avLg: { width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(145deg,#3a2c19,#241a10)", border: `1px solid ${C.brass}`,
    color: C.brassHi, display: "grid", placeItems: "center", fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 22, flexShrink: 0 },
  venueIcon: { width: 56, height: 56, borderRadius: 14, background: "linear-gradient(145deg,#3a2c19,#241a10)", border: `1px solid ${C.brass}`, display: "grid", placeItems: "center", flexShrink: 0 },
  h1: { margin: 0, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 28, letterSpacing: .3 },
  subline: { color: C.muted, fontSize: 13.5, marginTop: 3 },
  priorityTag: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.brass, border: `1px solid ${C.line}`, padding: "7px 13px", borderRadius: 20 },

  metricGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13, marginBottom: 20 },
  metric: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 3 },
  metricVal: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 28, lineHeight: 1.1, marginTop: 8 },
  metricLabel: { fontSize: 12.5, color: C.text },
  metricNote: { fontSize: 11, color: C.muted },

  panel: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  panelHead: { padding: "13px 18px", borderBottom: `1px solid ${C.line}`, fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", color: C.muted },
  row: { display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", borderTop: `1px solid ${C.line}` },
  rowMain: { fontSize: 15, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rowSub: { fontSize: 12.5, color: C.muted, marginTop: 3, display: "flex", alignItems: "center", gap: 7 },
  emptyRow: { padding: "16px 18px", fontSize: 13, color: C.muted },
  btnRow: { display: "flex", gap: 7 },

  avSm: { width: 40, height: 40, borderRadius: "50%", background: C.raised, border: `1px solid ${C.brass}`, color: C.brassHi,
    display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 },
  avMd: { width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(145deg,#3a2c19,#241a10)", border: `1px solid ${C.brass}`,
    color: C.brassHi, display: "grid", placeItems: "center", fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 16, flexShrink: 0 },
  barIcon: { width: 42, height: 42, borderRadius: 11, background: C.raised, border: `1px solid ${C.line}`, display: "grid", placeItems: "center", flexShrink: 0 },
  avatarFallback: { borderRadius: "50%", background: "linear-gradient(145deg,#3a2c19,#241a10)", border: `1px solid ${C.brass}`, color: "#e7cc8e", display: "grid", placeItems: "center", fontFamily: "'Cormorant Garamond', serif", fontWeight: 700 },
  avatarEdit: { position: "absolute", bottom: -3, right: -3, width: 23, height: 23, borderRadius: "50%", background: C.brass, color: "#1a1206", display: "grid", placeItems: "center", border: `2px solid ${C.bg}` },
  selfCard: { display: "flex", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, marginBottom: 16 },
  galleryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 },
  galleryItem: { position: "relative", margin: 0, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}`, background: C.raised },
  galleryMedia: { width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" },
  galleryCap: { position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 8px", fontSize: 11, color: C.text, background: "linear-gradient(transparent, rgba(0,0,0,0.78))" },
  galleryDel: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: C.text, display: "grid", placeItems: "center", border: `1px solid ${C.line}` },

  dateChip: { width: 46, textAlign: "center", border: `1px solid ${C.line}`, borderRadius: 9, padding: "6px 0", flexShrink: 0 },
  dDay: { fontSize: 10, color: C.brass, letterSpacing: 1, textTransform: "uppercase" },
  dNum: { fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, lineHeight: 1 },

  select: { background: C.raised, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13 },
  scopePill: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, border: "1px solid", borderRadius: 20, padding: "4px 11px", whiteSpace: "nowrap" },
  status: { fontSize: 11, border: "1px solid", borderRadius: 20, padding: "4px 11px", whiteSpace: "nowrap", textTransform: "capitalize" },
  offer: { fontSize: 11, color: C.approve, border: `1px solid ${C.approve}44`, background: `${C.approve}14`, borderRadius: 6, padding: "2px 8px" },

  iconBtn: { width: 34, height: 34, display: "grid", placeItems: "center", border: "1px solid", borderRadius: 9 },
  smallBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: C.brass, color: "#1a1206", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600 },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 13px", fontSize: 13 },

  compareGrid: { display: "grid", gridTemplateColumns: "1fr 1fr" },
  compareCol: { padding: "15px 18px" },
  compareHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, marginBottom: 11 },
  compareRow: { display: "flex", alignItems: "center", gap: 9, fontSize: 13, padding: "5px 0" },

  talentBlock: { borderTop: `1px solid ${C.line}`, padding: "14px 18px" },
  signals: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 7 },
  signal: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 7, padding: "3px 8px" },
  grantBox: { background: "rgba(123,163,111,0.07)", border: `1px solid ${C.approve}33`, borderRadius: 11, padding: 12, marginTop: 12 },
  grantHead: { display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: C.approve, marginBottom: 8 },
  grantShift: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" },
  peekRow: { display: "flex", alignItems: "center", gap: 11, marginTop: 11 },
  peekResult: { fontSize: 12, color: C.muted },

  /* sign in */
  signinWrap: { display: "flex", justifyContent: "center", padding: "70px 20px" },
  signinCard: { width: 380, maxWidth: "100%", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 26 },
  signinMark: { width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 11, border: `1px solid ${C.brass}`, color: C.brass, fontSize: 22, marginBottom: 16 },
  h2: { fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600 },
  sub: { fontSize: 13, color: C.muted, lineHeight: 1.55, margin: "6px 0 18px" },
  lbl: { display: "block", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.muted, margin: "12px 0 6px" },
  input: { width: "100%", background: C.raised, color: C.text, border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 12px", fontSize: 14 },
  primary: { width: "100%", marginTop: 18, background: C.brass, color: "#1a1206", borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600 },

  /* patron, responsive */
  patronWrap: { maxWidth: 1040, margin: "0 auto", padding: "24px 20px 70px" },
  patronGrid: { display: "grid", gridTemplateColumns: "300px 1fr", gap: 26, alignItems: "start" },
  patronStack: { maxWidth: 480, margin: "0 auto" },
  discCol: { position: "sticky", top: 80, alignSelf: "start" },

  /* patron phone (legacy frame styles, kept for reference) */
  phoneWrap: { display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px 60px" },
  phone: { width: 390, maxWidth: "100%", height: 760, maxHeight: "80vh", background: C.frame, borderRadius: 42, border: `1px solid ${C.line}`,
    overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.55), inset 0 0 0 5px #0c0a07", display: "flex", flexDirection: "column" },
  statusbar: { display: "flex", justifyContent: "space-between", padding: "16px 24px 8px", fontSize: 11.5, color: C.muted, flexShrink: 0 },
  phoneScroll: { flex: 1, overflowY: "auto", padding: "6px 18px 26px" },
  phoneEyebrow: { fontSize: 10.5, letterSpacing: 2.5, textTransform: "uppercase", color: C.brass, margin: "6px 2px 12px" },
  phoneSection: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.muted, margin: "22px 0 11px" },
  discCard: { width: "100%", display: "flex", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 15, padding: 13, marginBottom: 10 },
  discOn: { borderColor: C.brass + "88" },
  profBlock: { textAlign: "center", padding: "20px 0 6px", borderTop: `1px solid ${C.line}`, marginTop: 18 },
  profName: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, marginTop: 11 },
  profHandle: { fontSize: 12.5, color: C.brass, marginTop: 3 },
  memberPill: { display: "inline-flex", alignItems: "center", gap: 6, marginTop: 11, fontSize: 12, color: C.approve, border: `1px solid ${C.approve}55`, background: `${C.approve}18`, borderRadius: 20, padding: "5px 13px" },
  pendPill: { display: "inline-flex", alignItems: "center", gap: 6, marginTop: 11, fontSize: 12, color: C.pending, border: `1px solid ${C.pending}55`, background: `${C.pending}18`, borderRadius: 20, padding: "5px 13px" },
  tipBtn: { width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, background: "transparent", color: C.brassHi, border: `1px solid ${C.brass}`, borderRadius: 12, padding: 12, fontSize: 14, marginTop: 16 },
  tierCard: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 15, padding: 15, marginBottom: 10 },
  tierHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  tierName: { fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  tierPrice: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: C.brassHi },
  mo: { fontSize: 12, color: C.muted, fontFamily: "'Jost', sans-serif" },
  perks: { listStyle: "none", padding: 0, margin: "10px 0 13px", display: "flex", flexDirection: "column", gap: 7 },
  perk: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
  joinBtn: { width: "100%", background: C.brass, color: "#1a1206", borderRadius: 11, padding: 11, fontSize: 14, fontWeight: 600 },
  youreIn: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: C.approve, justifyContent: "center", padding: "8px 0 2px" },
  pRow: { display: "flex", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 11, marginBottom: 9 },
  kind: { fontSize: 10.5, color: C.brass, border: `1px solid ${C.line}`, borderRadius: 6, padding: "2px 8px", flexShrink: 0 },
  unlockNote: { display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: C.muted, background: "rgba(201,163,91,0.06)", border: `1px solid ${C.line}`, borderRadius: 11, padding: 11, marginTop: 3 },
  caption: { color: C.muted, fontSize: 12.5, textAlign: "center", marginTop: 16, maxWidth: 390, lineHeight: 1.5 },

  sheetWrap: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  sheet: { width: 360, maxWidth: "90%", background: C.frame, border: `1px solid ${C.brass}44`, borderRadius: 20, padding: "20px 22px 24px" },
  sheetBar: { width: 40, height: 4, borderRadius: 4, background: C.line, margin: "0 auto 14px" },
  sheetTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 23, fontWeight: 600 },
  sheetSub: { fontSize: 12.5, color: C.muted, lineHeight: 1.5, margin: "6px 0 16px" },
  amtGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, marginBottom: 14 },
  amtBtn: { padding: "13px 0", borderRadius: 11, border: `1px solid ${C.line}`, background: C.raised, color: C.text, fontSize: 14, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 },
  amtOn: { borderColor: C.brass, background: "rgba(201,163,91,0.15)", color: C.brassHi },
  sheetCta: { width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, background: C.brass, color: "#1a1206", borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 600 },

  toast: { position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8,
    background: C.raised, color: C.brassHi, border: `1px solid ${C.brass}66`, borderRadius: 30, padding: "11px 20px", fontSize: 13.5,
    boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 60, maxWidth: "90%" },
});

let s = makeStyles(C);
let CSS = makeCSS(C);
