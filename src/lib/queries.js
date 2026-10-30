// Data-access layer for Speakeasy.
//
// Every function here is a plain query. None of them enforce access: that is
// the job of the Row Level Security (RLS) policies in
// supabase/migrations/0001_init_schema_rls.sql. The client asks; the database
// returns only the rows the signed-in user is allowed to see. If a query comes
// back empty where you expected rows, that is usually RLS doing its job, not a
// bug.

import { supabase, currentUserId } from "./supabase.js";

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Auth ----------
export async function signIn(email, password) {
  return unwrap(await supabase.auth.signInWithPassword({ email, password }));
}
export async function signOut() {
  return unwrap(await supabase.auth.signOut());
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export async function myRoles() {
  const uid = await currentUserId();
  if (!uid) return [];
  const row = unwrap(
    await supabase.from("profiles").select("roles").eq("id", uid).single()
  );
  return row?.roles ?? [];
}

// ---------- Bartender ----------
export async function myBartenderProfile() {
  const uid = await currentUserId();
  return unwrap(
    await supabase
      .from("bartender_profiles")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle()
  );
}

export async function myMetrics(bartenderId) {
  // Only the owning bartender can read this row (metrics_owner_select).
  return unwrap(
    await supabase.from("metrics").select("*").eq("bartender_id", bartenderId).maybeSingle()
  );
}

// Followers: subscriptions to me, enriched with the patron's profile where the
// bartender is allowed to see it (pp_select_subscriber). We do this in two
// steps because there is no direct foreign key from subscriptions to
// patron_profiles to embed through.
export async function myFollowers(bartenderId) {
  const subs = unwrap(
    await supabase
      .from("subscriptions")
      .select("id, patron_id, status, tiers(name, rank)")
      .eq("bartender_id", bartenderId)
  );
  const ids = subs.map((s) => s.patron_id);
  let profilesByUser = {};
  if (ids.length) {
    const pp = unwrap(
      await supabase
        .from("patron_profiles")
        .select("user_id, display_name, identity_verified, avatar_url")
        .in("user_id", ids)
    );
    profilesByUser = Object.fromEntries(pp.map((p) => [p.user_id, p]));
  }
  return subs.map((s) => ({
    ...s,
    patron: profilesByUser[s.patron_id] ?? null,
  }));
}

export async function patronFlags(patronId) {
  // Visible to bartenders only (flags_bartender_select).
  return unwrap(
    await supabase.from("patron_flags").select("kind, evidence, created_at").eq("patron_id", patronId)
  );
}

export async function decideSubscription(subscriptionId, status) {
  // status: 'approved' | 'blocked' | 'demoted' (subs_bartender_decide)
  return unwrap(
    await supabase.from("subscriptions").update({ status }).eq("id", subscriptionId).select()
  );
}

export async function myShifts(bartenderId) {
  return unwrap(
    await supabase
      .from("shifts")
      .select("id, starts_at, ends_at, visibility, min_tier_rank, venues(name)")
      .eq("bartender_id", bartenderId)
      .order("starts_at")
  );
}

export async function setShiftScope(shiftId, visibility, minTierRank = null) {
  // visibility: 'private' | 'public' | 'members'. minTierRank required for 'members'.
  return unwrap(
    await supabase
      .from("shifts")
      .update({ visibility, min_tier_rank: visibility === "members" ? minTierRank : null })
      .eq("id", shiftId)
      .select()
  );
}

export async function myBarRequests(bartenderId) {
  return unwrap(
    await supabase
      .from("grants")
      .select("id, bar_id, status, offer_cents, bar_accounts(name)")
      .eq("bartender_id", bartenderId)
  );
}

export async function decideGrant(grantId, status) {
  // status: 'granted' | 'denied' | 'revoked' (grants_bartender_all)
  const patch = { status, decided_at: new Date().toISOString() };
  if (status === "revoked") patch.revoked_at = new Date().toISOString();
  return unwrap(await supabase.from("grants").update(patch).eq("id", grantId).select());
}

// ---------- Patron ----------
export async function discoverBartenders() {
  // Only discoverable bartenders are returned (bp_select_visible).
  return unwrap(
    await supabase
      .from("bartender_profiles")
      .select("id, display_name, handle, specialty, bio, avatar_url")
      .eq("discoverable", true)
  );
}

export async function tiersFor(bartenderId) {
  return unwrap(
    await supabase
      .from("tiers")
      .select("id, name, price_cents, rank, perks")
      .eq("bartender_id", bartenderId)
      .eq("active", true)
      .order("rank")
  );
}

export async function mySubscriptions() {
  const uid = await currentUserId();
  return unwrap(
    await supabase
      .from("subscriptions")
      .select("id, bartender_id, status, tiers(name, rank)")
      .eq("patron_id", uid)
  );
}

export async function requestSubscription(bartenderId, tierId) {
  const uid = await currentUserId();
  // Upsert so a first subscription inserts and an upgrade / re-request updates
  // the existing row. Either way the row lands at 'pending'; only the bartender
  // can move it to 'approved' (subs_patron_insert, subs_patron_rerequest,
  // subs_bartender_decide in migrations 0001 and 0002).
  return unwrap(
    await supabase
      .from("subscriptions")
      .upsert(
        { patron_id: uid, bartender_id: bartenderId, tier_id: tierId, status: "pending" },
        { onConflict: "patron_id,bartender_id" }
      )
      .select()
  );
}

// These two return only what the viewer's tier unlocks. A private shift, or a
// members shift above the viewer's tier, simply does not come back.
export async function visibleShifts(bartenderId) {
  return unwrap(
    await supabase
      .from("shifts")
      .select("id, starts_at, ends_at, visibility, min_tier_rank, venues(name)")
      .eq("bartender_id", bartenderId)
      .order("starts_at")
  );
}
export async function visiblePosts(bartenderId) {
  return unwrap(
    await supabase
      .from("posts")
      .select("id, kind, title, body, visibility, min_tier_rank, created_at")
      .eq("bartender_id", bartenderId)
      .order("created_at", { ascending: false })
  );
}

export async function tip(bartenderId, amountCents) {
  const uid = await currentUserId();
  // PoC-only direct insert (payments_payer_insert). In production this row is
  // written by the Stripe webhook using the service role.
  return unwrap(
    await supabase
      .from("payments")
      .insert({ payer_id: uid, payee_bartender_id: bartenderId, kind: "tip", amount_cents: amountCents })
      .select()
  );
}

// Starts a Stripe Checkout Session via the create-checkout Edge Function and
// returns its hosted URL. Throws if the function is not deployed or errors,
// which lets the caller fall back to the demo tip above.
export async function startCheckout(bartenderId, amountCents, kind = "tip") {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { bartenderId, amountCents, kind, returnUrl: window.location.origin },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.url) throw new Error("No checkout URL returned");
  return data.url;
}

// ---------- Bar ----------
export async function myBar() {
  return unwrap(
    await supabase
      .from("bar_members")
      .select("bar_id, bar_role, bar_accounts(name, advertiser, avatar_url)")
      .maybeSingle()
  );
}

export async function talentSignals() {
  // The banded, non-sensitive view. No revenue, traffic, schedule, or patron
  // identities are reachable here.
  return unwrap(
    await supabase
      .from("bartender_signals")
      .select("bartender_id, display_name, specialty, rank_score, trend_rank, follower_band")
      .order("rank_score", { ascending: false })
  );
}

export async function barGrants(barId) {
  return unwrap(
    await supabase
      .from("grants")
      .select("id, bartender_id, status, offer_cents")
      .eq("bar_id", barId)
  );
}

export async function requestVisibility(bartenderId, barId, offerCents = 0) {
  // Bars may only insert in the 'requested' state (grants_bar_request).
  return unwrap(
    await supabase
      .from("grants")
      .insert({ bartender_id: bartenderId, bar_id: barId, status: "requested", offer_cents: offerCents })
      .select()
  );
}

export async function sendOffer(bartenderId, barId, kind, terms) {
  // kind: 'guest_residency' | 'employment' | 'event_booking'
  return unwrap(
    await supabase
      .from("offers")
      .insert({ bar_id: barId, bartender_id: bartenderId, kind, terms, status: "sent" })
      .select()
  );
}

// Shifts a bar can see for a given bartender. Returns rows only when an active
// grant exists (app_bar_can_see_shifts via shifts_read). Before the grant, this
// is an empty array, which is the privacy guarantee visible from the client.
export async function barVisibleShifts(bartenderId) {
  return unwrap(
    await supabase
      .from("shifts")
      .select("id, starts_at, ends_at, venues(name)")
      .eq("bartender_id", bartenderId)
      .order("starts_at")
  );
}

// ---------- Storage: avatars & media ----------
function extOf(file) {
  const m = /\.([a-z0-9]+)$/i.exec(file.name || "");
  return (m ? m[1] : "bin").toLowerCase();
}

async function uploadToBucket(bucket, file) {
  const uid = await currentUserId();
  if (!uid) throw new Error("not signed in");
  // Path must start with the uid folder so storage policies allow the write.
  const path = `${uid}/${crypto.randomUUID()}.${extOf(file)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export function mediaUrl(path) {
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

export async function setBartenderAvatar(bartenderId, file) {
  const { publicUrl } = await uploadToBucket("avatars", file);
  return unwrap(
    await supabase.from("bartender_profiles").update({ avatar_url: publicUrl }).eq("id", bartenderId).select()
  );
}
export async function setBarAvatar(barId, file) {
  const { publicUrl } = await uploadToBucket("avatars", file);
  return unwrap(
    await supabase.from("bar_accounts").update({ avatar_url: publicUrl }).eq("id", barId).select()
  );
}
export async function setPatronAvatar(file) {
  const uid = await currentUserId();
  const { publicUrl } = await uploadToBucket("avatars", file);
  return unwrap(
    await supabase.from("patron_profiles").update({ avatar_url: publicUrl }).eq("user_id", uid).select()
  );
}
export async function getMyPatronProfile() {
  const uid = await currentUserId();
  return unwrap(
    await supabase.from("patron_profiles").select("user_id, display_name, avatar_url, identity_verified").eq("user_id", uid).maybeSingle()
  );
}

export async function listBartenderMedia(bartenderId) {
  return unwrap(
    await supabase.from("media").select("id, kind, storage_path, caption, created_at")
      .eq("bartender_id", bartenderId).order("created_at", { ascending: false })
  );
}
export async function listBarMedia(barId) {
  return unwrap(
    await supabase.from("media").select("id, kind, storage_path, caption, created_at")
      .eq("bar_id", barId).order("created_at", { ascending: false })
  );
}
export async function addBartenderMedia(bartenderId, file, caption = "") {
  const kind = (file.type || "").startsWith("video") ? "video" : "photo";
  const { path } = await uploadToBucket("media", file);
  return unwrap(
    await supabase.from("media").insert({ bartender_id: bartenderId, kind, storage_path: path, caption }).select()
  );
}
export async function addBarMedia(barId, file, caption = "") {
  const kind = (file.type || "").startsWith("video") ? "video" : "photo";
  const { path } = await uploadToBucket("media", file);
  return unwrap(
    await supabase.from("media").insert({ bar_id: barId, kind, storage_path: path, caption }).select()
  );
}
export async function deleteMedia(id, storagePath) {
  await supabase.storage.from("media").remove([storagePath]);
  return unwrap(await supabase.from("media").delete().eq("id", id).select());
}
