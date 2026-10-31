/**
 * GreenlitX — preview application.
 * RETIRED (Wave A, 2026-10-25, pledge-only migration): free Green Light
 * voting has been removed from the client. The Supabase `votes` table and
 * `vote_counts` view and their data are intentionally left in place —
 * this client simply no longer reads or writes them. The single support
 * action is recorded pledge interest (Supabase `pledges`), which is
 * nonbinding: no card is charged and payments are not active.
 * Follows are unchanged and still use the `follows` table / localStorage.
 */
/* ---------- Round 3 (Oct 30): /preview/ guard ----------
   The app physically lives in /preview/ but must only ever be SEEN at the
   root. Anyone landing on a /preview/ URL (stale bookmark, old tab, search
   result) is bounced to the same page at greenlitx.com with search + hash
   preserved. Never fires at "/" or "/films.html" (the root shells load this
   same app.js through <base href> with a root pathname). */
(function () {
  try {
    var p = window.location.pathname || "";
    if (p === "/preview" || p.indexOf("/preview/") === 0) {
      window.location.replace("https://greenlitx.com/" + window.location.search + window.location.hash);
    }
  } catch (e) {}
})();

"use strict";

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMoney = (n) => "$" + Number(n || 0).toLocaleString("en-US");
const fmtNum = (n) => Number(n || 0).toLocaleString("en-US");

/* All 40 founding films now have finished theatrical posters in posters/<id>.webp. */
const POSTER_READY = {};
FILMS.forEach((f) => { POSTER_READY[f.id] = 1; });
/* All 40 films have a 1600x900 backdrop in backdrops/<id>.webp — center-crops of the
   poster source art (the original five keep their earlier curated crops). */
const BACKDROPS = {};
FILMS.forEach((f) => { BACKDROPS[f.id] = 1; });
const FEATURED = ["the-last-train-below", "the-second-moon", "the-devils-frequency", "the-keeper-of-forgotten-things", "tomorrows-witness"];
/* ---------- i18n (Wave B, Stage 1f) ---------- */
const I18N = window.GLX_I18N || { ui: {}, films: {}, sectionLabels: {}, legalKeys: [], draftNotice: {}, languages: ["en"] };
const LANGS = ["en", "es", "pt-BR", "de"];
let lang = load("glx_lang", "en"); if (!LANGS.includes(lang)) lang = "en";
function t(key, vars) {
  let s = (I18N.ui[lang] && I18N.ui[lang][key]) || (I18N.ui.en && I18N.ui.en[key]) || key;
  if (vars) Object.keys(vars).forEach((k) => { s = s.replaceAll("{" + k + "}", String(vars[k])); });
  return s;
}
const isLegalKey = (key) => (I18N.legalKeys || []).includes(key);
function draftNoteHtml(key) {
  /* Round 3 (Oct 30): owner ordered every draft note removed from the
     rendered site — this helper now always returns nothing. */
  return "";
}
/* Film text: titles are NEVER translated. Logline/synopsis/tagline come from
   films.json for the active language, falling back to the English record. */
function filmText(film, field) {
  const rec = I18N.films && I18N.films[film.id];
  if (rec && rec[lang] && rec[lang][field]) return rec[lang][field];
  if (rec && rec.en && rec.en[field] && lang === "en") return film[field] || rec.en[field];
  return film[field];
}
function sectionLabel(name, fallback) {
  const sl = I18N.sectionLabels || {};
  return (sl[lang] && sl[lang][name]) || (sl.en && sl.en[name]) || fallback;
}
function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next; save("glx_lang", lang);
  document.documentElement.lang = lang;
  applyStaticI18n(); render(); syncTrailerSubtitles();
}
function syncTrailerSubtitles() {
  $$("video").forEach((video) => {
    Array.from(video.textTracks || []).forEach((track) => {
      track.mode = track.language === lang ? "showing" : "disabled";
    });
  });
}
document.documentElement.lang = lang;

/* ---------- language selector (Oct 30 r2: mockup-style dropdown) ----------
   Flags are inline SVG drawn locally — emoji flags do not render on many
   devices (owner report, Oct 30), which is why the old emoji row "lost" its
   flags. The identical flag markup sits in index.html for the pre-JS paint;
   this map keeps the current-language flag + code in sync after boot. */
const LANG_FLAGS = {
  "en": '<svg viewBox="0 0 20 14" width="22" height="15" aria-hidden="true" focusable="false"><rect width="20" height="14" fill="#fff"/><rect width="20" height="2" fill="#b31942"/><rect y="4" width="20" height="2" fill="#b31942"/><rect y="8" width="20" height="2" fill="#b31942"/><rect y="12" width="20" height="2" fill="#b31942"/><rect width="9" height="8" fill="#0a3161"/><g fill="#fff"><circle cx="1.8" cy="1.9" r="0.6"/><circle cx="4.5" cy="1.9" r="0.6"/><circle cx="7.2" cy="1.9" r="0.6"/><circle cx="1.8" cy="4" r="0.6"/><circle cx="4.5" cy="4" r="0.6"/><circle cx="7.2" cy="4" r="0.6"/><circle cx="1.8" cy="6.1" r="0.6"/><circle cx="4.5" cy="6.1" r="0.6"/><circle cx="7.2" cy="6.1" r="0.6"/></g></svg>',
  "es": '<svg viewBox="0 0 20 14" width="22" height="15" aria-hidden="true" focusable="false"><rect width="20" height="14" fill="#f1bf00"/><rect width="20" height="3.5" fill="#aa151b"/><rect y="10.5" width="20" height="3.5" fill="#aa151b"/></svg>',
  "pt-BR": '<svg viewBox="0 0 20 14" width="22" height="15" aria-hidden="true" focusable="false"><rect width="20" height="14" fill="#009b3a"/><polygon points="10,1.6 18.4,7 10,12.4 1.6,7" fill="#fedf00"/><circle cx="10" cy="7" r="3.1" fill="#002776"/><path d="M7.3 8.7 A3.1 3.1 0 0 1 12.7 5.3" stroke="#fff" stroke-width="0.9" fill="none"/></svg>',
  "de": '<svg viewBox="0 0 20 14" width="22" height="15" aria-hidden="true" focusable="false"><rect width="20" height="4.7" fill="#000"/><rect y="4.7" width="20" height="4.7" fill="#dd0000"/><rect y="9.4" width="20" height="4.6" fill="#ffcc00"/></svg>'
};
const LANG_CODES = { "en": "EN", "es": "ES", "pt-BR": "PT", "de": "DE" };
function langMenuOpen() { const l = $("#lang-list"); return !!(l && !l.hidden); }
function closeLangMenu() {
  const l = $("#lang-list"), b = $("#lang-current");
  if (l && !l.hidden) l.hidden = true;
  if (b) b.setAttribute("aria-expanded", "false");
}
function toggleLangMenu() {
  const l = $("#lang-list"), b = $("#lang-current");
  if (!l || !b) return;
  const open = l.hidden;
  l.hidden = !open;
  b.setAttribute("aria-expanded", String(open));
}
function syncLangControl() {
  const flagEl = $("#lang-current-flag");
  if (flagEl) flagEl.innerHTML = LANG_FLAGS[lang] || "";
  const codeEl = $("#lang-current-code");
  if (codeEl) codeEl.textContent = LANG_CODES[lang] || "EN";
  $$(".lang-option").forEach((b) => { const on = b.dataset.lang === lang; b.setAttribute("aria-selected", String(on)); b.classList.toggle("active", on); });
}

/* ---------- discovery state (Wave B, Stage 2d — local only, no tracking) --- */
const savedFilms = new Set(load("glx_saved", []));
const watchSaved = new Set(load("glx_watch_saved", []));
/* glx_fav_genres (favorite-genre chips) retired with the Final2 Wave 2
   Discover redesign — stored values are left on the device, unconsumed. */
let recentFilms = load("glx_recent", []);
function pushRecent(id) {
  recentFilms = [id].concat(recentFilms.filter((x) => x !== id)).slice(0, 8);
  save("glx_recent", recentFilms);
}
const FLAGSHIPS = ["the-keeper-of-forgotten-things", "tomorrows-witness", "the-woman-in-apartment-9", "the-last-train-below", "the-devils-frequency"];
const TEASERS = { "the-last-train-below": "teasers/the-last-train-below.mp4", "the-keeper-of-forgotten-things": "teasers/the-keeper-of-forgotten-things.mp4", "the-devils-frequency": "teasers/the-devils-frequency.mp4", "tomorrows-witness": "teasers/tomorrows-witness.mp4", "the-woman-in-apartment-9": "teasers/the-woman-in-apartment-9.mp4" };
/* Communication preferences (Stage 2b): Supabase user_preferences when the
   table exists (master/schema-additions.sql); localStorage is the clearly
   interim store until that migration is applied. */
const ARTWORK = window.GLX_ARTWORK || {};
const artworkFor = (id) => ARTWORK[id] || [
  { file: "posters/" + id + ".webp", kind: "poster", subject: "Poster artwork", created: "2026-10-24" },
  { file: "backdrops/" + id + ".webp", kind: "backdrop", subject: "Backdrop artwork", created: "2026-10-24" }
];
function slugifyName(v) { return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function translatedCharacters(film) {
  const rec = I18N.films && I18N.films[film.id];
  if (rec && rec[lang] && Array.isArray(rec[lang].characters) && rec[lang].characters.length) return rec[lang].characters;
  return film.characters;
}
/* ---------- story upgrade (first batch): hook / profiles / signature sequences ----------
   Generic rendering only — no film content lives here. filmText() already
   returns the active-language value for any field (arrays included) and
   falls back to the English data.js field, so the same helpers serve hook,
   signatureSequences and treatmentHtml. All new text is escaped. */
const PROFILE_KEYS = ["background", "personality", "motivation", "goal", "need", "flaws", "relationships", "fears", "dilemma", "transformation", "contribution"];
const PROFILE_LABEL_KEYS = {
  background: "film4.background", personality: "film4.personality", motivation: "film4.motivation",
  goal: "film4.goal", need: "film4.need", flaws: "film4.flaws", relationships: "film4.relationships",
  fears: "film4.fears", dilemma: "film4.dilemma", transformation: "film4.transformation", contribution: "film4.contribution"
};
function localizedArrayField(film, field) {
  const v = filmText(film, field);
  return Array.isArray(v) ? v : null;
}
function characterProfileHtml(film, c, index) {
  const source = film && Array.isArray(film.characters) ? film.characters[index] : null;
  const profile = (c && c.profile && typeof c.profile === "object") ? c.profile
    : (source && source.profile && typeof source.profile === "object" ? source.profile : null);
  if (!profile) return "";
  if (!PROFILE_KEYS.some((k) => String(profile[k] || "").trim())) return "";
  return '<details class="char-profile"><summary>' + escapeHtml(t("film4.profileHeading")) + '</summary>' +
    '<dl class="char-profile-list">' + PROFILE_KEYS.map((k) =>
      "<div><dt>" + escapeHtml(t(PROFILE_LABEL_KEYS[k])) + "</dt><dd>" + escapeHtml(profile[k] || "") + "</dd></div>").join("") +
    "</dl></details>";
}
function signatureSequencesHtml(film) {
  const seqs = localizedArrayField(film, "signatureSequences");
  if (!seqs) return "";
  const items = seqs.filter((s) => s && (String(s.title || "").trim() || String(s.description || "").trim()));
  if (!items.length) return "";
  /* Round 4 (Oct 30): mockup scene cards carry the film's real artwork
     stills — the non-portrait, non-poster gallery pieces (locations,
     moments, details, backdrop) in gallery order. They are concept
     artwork for the film, presented in sequence order; no still is
     captioned as depicting a specific sequence. The play overlay is
     honest: it appears ONLY on the five flagship films that have a real
     teaser video, and it scrolls to and plays that teaser. */
  const stills = artworkFor(film.id).filter((a) => ["location", "moment", "detail", "backdrop"].includes(a.kind));
  const hasTeaser = FLAGSHIPS.includes(film.id) && !!TEASERS[film.id];
  return '<div class="detail-section signature-section" data-fp-section="scenes"><h2>' + escapeHtml(t("filmPage.scenesHeading")) + '</h2>' +
    '<div class="signature-grid">' + items.map((s, i) => {
      const st = stills.length ? stills[i % stills.length] : null;
      const media = st ? '<div class="scene-media"><img src="' + escapeHtml(st.file) + '" loading="lazy" alt="' + escapeHtml(galleryCaption(film, st)) + '">' +
        (hasTeaser ? '<button type="button" class="scene-play" data-action="play-teaser" aria-label="' + escapeHtml(t("filmPage.watchTrailer")) + '"><span aria-hidden="true">▶</span></button>' : "") + "</div>" : "";
      return '<article class="signature-card">' + media + '<div class="scene-body"><h3>' + escapeHtml(s.title || "") + "</h3><p>" + escapeHtml(s.description || "") + "</p></div></article>";
    }).join("") + "</div></div>";
}
const PREF_CATS = [
  { key: "pref_followed_updates", labelKey: "pref.followedUpdates", label: "Updates about projects I follow" },
  { key: "pref_new_projects", labelKey: "pref.newProjects", label: "New projects added to GreenlitX" },
  { key: "pref_watch_free", labelKey: "pref.watchFree", label: "New Watch Free additions" },
  { key: "pref_membership_info", labelKey: "pref.membershipInfo", label: "Membership information" },
  { key: "pref_account_notices", labelKey: "pref.accountNotices", label: "Account and security notices" }
];
const PREF_DEFAULTS = { pref_followed_updates: true, pref_new_projects: false, pref_watch_free: false, pref_membership_info: false, pref_account_notices: true };
let commPrefs = Object.assign({}, PREF_DEFAULTS, load("glx_prefs", {}));
let prefsRemote = false;
async function loadCommPrefs() {
  if (!sb || !server.user) return;
  try {
    const { data, error } = await sb.from("user_preferences").select("*").eq("user_id", server.user.id).single();
    if (!error && data) { PREF_CATS.forEach((c) => { if (typeof data[c.key] === "boolean") commPrefs[c.key] = data[c.key]; }); prefsRemote = true; save("glx_prefs", commPrefs); }
  } catch (e) { /* table absent — interim localStorage store stays authoritative */ }
}
async function saveCommPref(key, val) {
  commPrefs[key] = val; save("glx_prefs", commPrefs);
  if (sb && server.user) {
    try {
      const row = Object.assign({ user_id: server.user.id, updated_at: new Date().toISOString() }, commPrefs);
      const { error } = await sb.from("user_preferences").upsert(row);
      if (!error) prefsRemote = true;
    } catch (e) {}
  }
}

const TYPES = ["LIVE ACTION", "AI FILM", "HYBRID", "ANIMATION"];

function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
const state = {
  follows: new Set(load("glx2_follows", [])),
  genreExact: "All",
  stageFilter: "All",
  typeFilter: "All",
  query: "",
  watchQuery: "",
  watchCategory: "All",
  watchGenre: "All",
  sortBy: "featured"
};
const filmById = (id) => FILMS.find((f) => f.id === id);
/* Retired guest voting: clear any legacy on-device vote list so it can never resurface. */
try { localStorage.removeItem("glx2_votes"); } catch (e) {}

/* ---------- backend (Supabase) ---------- */
const SB_URL = "https://fjrdjspecrnvetlsxxos.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcmRqc3BlY3JudmV0bHN4eG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzQ4MTAsImV4cCI6MjEwODQ1MDgxMH0.FuSoy9qytnRDbLWJolkvy1bTk2CB2AAkNNO09H3QpW0";
const sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SB_URL, SB_ANON) : null;
window.GLX_DB = sb;
/* ---------- Final2 P1: auth redirect + helpers ---------- */
/* Pin auth email redirects explicitly to the preview root. Never derive this
   from location.origin / location.pathname: a bare-origin redirect lands on
   the GitHub Pages 404 at the domain root (the Pages site lives under
   /greenlitx/), which is exactly the landing the owner hit on 2026-10-25.
   The dashboard Site URL / allowlist are verified correct — this pin makes
   the code independent of them. */
const AUTH_REDIRECT = "https://greenlitx.com/";
const AUTH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function authValidEmail(v) { return AUTH_EMAIL_RE.test(String(v || "").trim()); }
/* Map Supabase auth errors (and thrown fetch failures) to plain language. */
function authMapError(err) {
  const code = (err && (err.code || err.error_code)) || "";
  const status = err && err.status;
  const msg = String((err && err.message) || (typeof err === "string" ? err : "") || "");
  const low = msg.toLowerCase();
  if ((err && err.name === "AuthRetryableFetchError") || (err instanceof TypeError) || low.includes("failed to fetch") || low.includes("network")) return t("auth2.errNetwork");
  if (status === 429 || code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || low.includes("rate limit")) return t("auth2.errRateLimit");
  if (code === "email_address_invalid" || code === "validation_failed" || low.includes("validate email") || low.includes("invalid format")) return t("auth2.errInvalidEmail");
  if (code === "weak_password" || low.includes("password should be")) return t("auth2.errWeakPassword");
  if (code === "user_already_exists" || low.includes("already registered") || low.includes("already been registered")) return t("auth2.errDuplicate");
  if (code === "invalid_credentials" || low.includes("invalid login credentials")) return t("auth2.errInvalidCredentials");
  if (low.includes("email not confirmed")) return t("auth2.errNotConfirmed");
  return t("auth2.errGeneric", { detail: msg || "unknown error" });
}
/* Intended destination for gated actions (e.g. the pledge CTA): remembered
   across the account detour and consumed once after sign-in. */
function authSetReturnTo(path) { try { if (path) sessionStorage.setItem("glx_return_to", path); } catch (e) {} }
function authTakeReturnTo() { try { const v = sessionStorage.getItem("glx_return_to"); sessionStorage.removeItem("glx_return_to"); return v; } catch (e) { return null; } }
/* After supabase-js has consumed an email-link fragment, normalize the hash
   to the account route so the router and shared links never see tokens. */
function authForceAccountRoute() {
  try { history.replaceState(null, "", location.pathname + location.search + "#/account"); } catch (e) {}
  try { if ((location.hash || "") !== "#/account") location.hash = "#/account"; } catch (e) {}
}
function authNormalizeReturnHash(force) {
  const h = location.hash || "";
  /* supabase-js strips the auth fragment itself while consuming it, so by the
     time this runs the hash may already be clean — when the boot classification
     flagged a confirmed return (force), route to the account view anyway so
     the one-time notice is actually seen. */
  if (!force && !/(access_token=|refresh_token=|type=(signup|recovery|magiclink|invite|email))/.test(h)) return;
  authForceAccountRoute();
}
function authConfirmedPending() {
  try { return sessionStorage.getItem("glx_just_confirmed") === "1"; } catch (e) { return false; }
}
let recoveryMode = false; // true while a password-recovery link flow is in progress
const server = { user: null, pledgeTotals: {}, myPledges: [], ready: false };
const PLEDGE_AMOUNTS = [500, 1000, 2500, 5000, 10000];
const pledgeMicro = () => t("pledge.nonbinding") + (lang !== "en" && isLegalKey("pledge.nonbinding") ? "" : "");
let pledgePick = { filmId: null, cents: 2500, custom: false };
/* Round 4 (Oct 30): film-page tab state — kept in module scope so a
   refreshDynamic() re-render (pledge pick, follow, save) restores the
   tab the visitor was reading instead of bouncing back to Overview. */
let filmTabState = { id: null, tab: "overview" };
const fmtCents = (c) => "$" + (Number(c || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
/* Supporter interest = real recorded pledge-interest rows (Supabase pledge_totals). */
const supporterCount = (film) => Number((server.pledgeTotals[film.id] || {}).backers || 0);
const supporterTotal = (film) => Number((server.pledgeTotals[film.id] || {}).pledged_cents || 0);
function fundingFactsHtml(film) {
  const n = supporterCount(film), tot = supporterTotal(film);
  return '<dl class="funding-facts">' +
    '<div><dt>' + escapeHtml(t("funding.budgetLabel")) + '</dt><dd>' + fmtMoney(film.budget) + '</dd></div>' +
    '<div><dt>' + escapeHtml(t("funding.targetLabel")) + '</dt><dd>' + escapeHtml(t("funding.targetTBD")) + '</dd></div>' +
    '<div><dt>' + escapeHtml(t("funding.supporterInterestLabel")) + '</dt><dd>' + (n ? escapeHtml(t(n === 1 ? "funding.supporterLineOne" : "funding.supporterLineMany", { count: n, amount: fmtCents(tot) })) : escapeHtml(t("funding.noSupporterInterest"))) + '</dd></div>' +
    '<div><dt>' + escapeHtml(t("funding.collectedLabel")) + '</dt><dd>' + escapeHtml(t("funding.collectedValue")) + '</dd></div></dl>';
}
async function sbFetchCounts() {
  if (!sb) return;
  try {
    /* Retired: vote_counts is no longer read (see header note). */
    const pt = await sb.from("pledge_totals").select("film_id, pledged_cents, backers");
    if (!pt.error && pt.data) { server.pledgeTotals = {}; pt.data.forEach((r) => { server.pledgeTotals[r.film_id] = r; }); }
  } catch (e) {}
}
async function sbFetchMine() {
  if (!sb || !server.user) return;
  try {
    const { data: f } = await sb.from("follows").select("film_id").eq("user_id", server.user.id);
    if (f) state.follows = new Set(f.map((r) => r.film_id));
    const pl = await sb.from("pledges").select("id, film_id, amount_cents, status, created_at").eq("user_id", server.user.id).order("created_at", { ascending: false });
    if (pl.data) server.myPledges = pl.data;
  } catch (e) {}
}
async function sbMigrateGuest() {
  // one-time: turn this device's guest follows into account follows.
  // Legacy guest votes are NOT migrated — voting is retired (header note).
  if (!sb || !server.user) return;
  const gf = load("glx2_follows", []);
  try {
    if (gf.length) await sb.from("follows").upsert(gf.map((film_id) => ({ user_id: server.user.id, film_id })));
  } catch (e) {}
  save("glx2_follows", []);
}
async function sbToggleFollow(filmId, turnOn) {
  if (!sb || !server.user) return;
  try {
    if (turnOn) await sb.from("follows").insert({ user_id: server.user.id, film_id: filmId });
    else await sb.from("follows").delete().eq("user_id", server.user.id).eq("film_id", filmId);
  } catch (e) {}
}
async function sbInit() {
  if (!sb) return;
  /* Final2 P1: classify an email-link return BEFORE supabase-js consumes the
     fragment, so the account view can show the right one-time notice. An
     #error=... landing (expired/invalid link) must surface a clear notice,
     not break the router or silently show the plain form. */
  const bootHash = location.hash || "";
  if (bootHash.includes("type=recovery")) recoveryMode = true;
  if (/[#&]error=/.test(bootHash) || bootHash.includes("error_code=")) {
    try { sessionStorage.setItem("glx_auth_link_error", "1"); } catch (e) {}
  } else if (bootHash.includes("access_token=") && bootHash.includes("type=signup")) {
    try { sessionStorage.setItem("glx_just_confirmed", "1"); } catch (e) {}
  } else if (bootHash.includes("access_token=") && bootHash.includes("type=recovery")) {
    recoveryMode = true;
  } else if (!bootHash.includes("access_token=")) {
    /* Ordinary load: drop any stale landing flags from an earlier visit so a
       notice can never resurface outside the landing that produced it. */
    try { sessionStorage.removeItem("glx_just_confirmed"); sessionStorage.removeItem("glx_auth_link_error"); } catch (e) {}
  }
  try {
    const { data } = await sb.auth.getSession();
    server.user = data && data.session ? data.session.user : null;
    if (server.user) authNormalizeReturnHash(authConfirmedPending());
    if (server.user) { await sbMigrateGuest(); await sbFetchMine(); }
    await sbFetchCounts();
    /* A dead email link (#error=...) leaves no session; supabase-js may also
       have stripped the fragment, which would route the refresh home. Force
       the account route so the link-error notice is actually seen. */
    try { if (sessionStorage.getItem("glx_auth_link_error") === "1") authForceAccountRoute(); } catch (e) {}
    server.ready = true;
    updateAccountNav(); refreshDynamic();
    sb.auth.onAuthStateChange(async (_evt, session) => {
      if (_evt === "PASSWORD_RECOVERY") {
        recoveryMode = true;
        server.user = session ? session.user : server.user;
        updateAccountNav();
        if (parseRoute().view !== "account") location.hash = "#/account"; else refreshDynamic();
        return;
      }
      server.user = session ? session.user : null;
      if (server.user) { await sbMigrateGuest(); await sbFetchMine(); } else { state.follows = new Set(load("glx2_follows", [])); }
      await sbFetchCounts();
      if (server.user) authNormalizeReturnHash(authConfirmedPending());
      updateAccountNav(); refreshDynamic();
      if (_evt === "SIGNED_IN" && session) {
        const dest = authTakeReturnTo();
        if (dest && dest !== "#/account" && (location.hash || "") !== dest) location.hash = dest;
      }
    });
  } catch (e) {}
}
function updateAccountNav() {
  const link = document.querySelector('[data-nav="account"]');
  if (link) link.textContent = server.user ? t("nav.myAccount") : t("nav.account");
}

/* ---------- posters ---------- */
const GENRE_HUES = [
  [/horror/i, 350], [/romance|romantic/i, 330], [/comedy/i, 38], [/animation|animated|family|fantasy/i, 265],
  [/historical|adventure|epic/i, 24], [/crime|thriller|mystery|espionage|legal|political/i, 222],
  [/sci-fi|science|space|dystopian|apocalyptic|technology/i, 200], [/drama/i, 160]
];
function genreHue(film) { for (const [re, h] of GENRE_HUES) if (re.test(film.genre)) return h; return 210; }
function posterHtml(film) {
  /* Poster-first (Final2 Wave 2): no production-type badge on the poster. */
  if (POSTER_READY[film.id]) {
    return '<img src="posters/' + film.id + '.webp" width="880" height="1320" loading="lazy" alt="' + escapeHtml(t("card.posterAlt", { title: film.title })) + '">';
  }
  return '<div class="poster-typo" style="--hue:' + genreHue(film) + '">' +
    '<div class="typo-tag">' + escapeHtml(film.tagline) + '</div>' +
    '<div class="typo-title">' + escapeHtml(film.title) + "</div></div>";
}
/* Small bookmark toggle overlaid on a card poster corner. */
const BOOKMARK_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false"><path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z"/></svg>';
function bookmarkBtnHtml(action, id, on, labelKey, title) {
  return '<button type="button" class="bookmark-btn" data-action="' + action + '" data-id="' + id + '" aria-pressed="' + on + '"' +
    ' aria-label="' + escapeHtml(t(labelKey, { title })) + '" title="' + escapeHtml(t(on ? "follow.saved" : "follow.save")) + '">' + BOOKMARK_SVG + "</button>";
}
function cardHtml(film) {
  const saved = savedFilms.has(film.id);
  return '<figure class="card">' +
    '<div class="poster-wrap"><a class="poster-link" href="#/film/' + film.id + '" aria-label="' + escapeHtml(t("card.viewProject", { title: film.title })) + '">' +
    '<div class="poster">' + posterHtml(film) + "</div></a>" +
    bookmarkBtnHtml("save", film.id, saved, saved ? "follow.savedFilm" : "follow.saveFilm", film.title) + "</div>" +
    '<figcaption>' + processBarHtml("compact") + "</figcaption></figure>";
}

/* ---------- sections (home rows) ---------- */
function bucket(film, name) {
  const g = (film.genre || "").toLowerCase();
  switch (name) {
    case "scifi": return /sci-fi|science|space|dystopian|apocalyptic|technology/.test(g);
    case "thriller": return /thriller|horror/.test(g);
    case "history": return (/historical|adventure/.test(g) || /epic/.test(g)) && !/sci-fi|science/.test(g);
    case "romance": return /romance|romantic|drama/.test(g);
    case "comedy": return /comedy/.test(g);
    case "animation": return /animat|family|fantasy|young-adult/.test(g);
    default: return false;
  }
}
const SECTIONS = [
  { title: "Featured Projects", key: "section.featured", films: () => FLAGSHIPS.map(filmById).filter(Boolean) },
  { title: "Science Fiction", key: "section.scifi", films: () => FILMS.filter((f) => bucket(f, "scifi")) },
  { title: "Thrillers and Horror", key: "section.thriller", films: () => FILMS.filter((f) => bucket(f, "thriller")) },
  { title: "Historical and Adventure", key: "section.history", films: () => FILMS.filter((f) => bucket(f, "history")) },
  { title: "Romance and Drama", key: "section.romance", films: () => FILMS.filter((f) => bucket(f, "romance")) },
  { title: "Comedy", key: "section.comedy", films: () => FILMS.filter((f) => bucket(f, "comedy")) },
  { title: "Animation and Family", key: "section.animation", films: () => FILMS.filter((f) => bucket(f, "animation")) },
  { title: "AI Films", key: "section.aiFilms", films: () => FILMS.filter((f) => f.productionType === "AI FILM") },
  { title: "Live-Action Films", key: "section.liveAction", films: () => FILMS.filter((f) => f.productionType === "LIVE ACTION") },
  { title: "Hybrid Productions", key: "section.hybrid", films: () => FILMS.filter((f) => f.productionType === "HYBRID") },
  { title: "Newly Added", key: "section.newlyAdded", films: () => FILMS.slice().sort((a, b) => b.n - a.n) },
  { title: "Discover All 40", key: "section.discoverAll", films: () => FILMS.slice(), link: "#/discover" }
];
/* ---------- showcase (home hero) ---------- */
let showcaseTimer = null;
let showcaseIdx = 0;
function showcaseSlides() {
  const brand = { brand: true };
  return [brand];
}
function showcaseHtml() {
  const slides = showcaseSlides();
  const slideHtml = slides.map((s, i) => {
    if (s.brand) {
      return '<div class="showcase-slide' + (i === 0 ? " active" : "") + '">' +
        '<img class="backdrop" src="backdrops/letters-from-the-sun.webp" width="1600" height="900" alt="" aria-hidden="true">' +
        '<div class="showcase-shade"></div>' +
        '<div class="showcase-content"><div class="showcase-inner">' +
        '<h1 class="showcase-title" tabindex="-1">' + escapeHtml(t("hero.titleStart")) + ' <span class="accent">' + escapeHtml(t("hero.titleAccent")) + '</span></h1>' +
        '<p class="showcase-tagline">' + escapeHtml(t("hero.tagline")) + '</p>' +
        '<p class="showcase-subline">' + escapeHtml(t("hero.subline")) + '</p>' +
        '<div class="showcase-actions"><button type="button" class="btn btn-primary btn-trailer" id="hero-trailer-btn"><span aria-hidden="true">\u25B6</span> ' + escapeHtml(t("home3.watchTrailer")) + ' <span class="btn-duration">0:35</span></button>' +
        '<a class="btn btn-ghost" href="#/discover">' + escapeHtml(t("nav.discover")) + ' <span aria-hidden="true">\u203A</span></a></div>' +
        "</div></div></div>";
    }
    const f = s;
    return '<div class="showcase-slide' + (i === 0 ? " active" : "") + '">' +
      '<img class="backdrop" src="backdrops/' + f.id + '.webp" width="1600" height="900" alt="" aria-hidden="true">' +
      '<div class="showcase-shade"></div>' +
      '<div class="showcase-content"><div class="showcase-inner">' +
      '<p class="showcase-kicker">' + escapeHtml(t("home2.featuredKicker", { type: f.productionType })) + "</p>" +
      '<p class="showcase-title">' + escapeHtml(f.title) + "</p>" +
      '<p class="showcase-tag">' + escapeHtml(filmText(f, "tagline")) + "</p>" +
      '<p class="showcase-log">' + escapeHtml(filmText(f, "logline")) + "</p>" +
      '<div class="showcase-actions"><a class="btn btn-play" href="#/film/' + f.id + '">' + escapeHtml(t("card.exploreFilm")) + '</a>' +
      '<span class="showcase-meta">' + escapeHtml(f.genre) + " · " + escapeHtml(f.runtime) + "</span></div>" +
      "</div></div></div>";
  }).join("");
  const dots = slides.length < 2 ? "" : slides.map((s, i) => '<button type="button" data-slide="' + i + '" aria-current="' + (i === 0) + '" aria-label="' + escapeHtml(t("hero.slideLabel", { n: i + 1 })) + '"' + (i + 1) + '"></button>').join("");
  return slideHtml + '<div class="showcase-dots">' + dots + "</div>";
}
function startShowcaseRotationOnly() {
  const root = $("#showcase");
  if (!root) return;
  const slides = $$(".showcase-slide", root);
  if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  showcaseTimer = setInterval(() => {
    showcaseIdx = (showcaseIdx + 1) % slides.length;
    slides.forEach((el, i) => el.classList.toggle("active", i === showcaseIdx));
    $$(".showcase-dots button", root).forEach((d, i) => d.setAttribute("aria-current", String(i === showcaseIdx)));
  }, 7000);
}
function startShowcase() {
  const root = $("#showcase");
  if (!root) return;
  root.innerHTML = showcaseHtml();
  const tb = $("#hero-trailer-btn");
  if (tb) tb.addEventListener("click", () => { openTrailerModal(tb); });
  showcaseIdx = 0;
  if (showcaseTimer) clearInterval(showcaseTimer);
  startShowcaseRotationOnly();
}
/* Round 6 (Oct 30): the homepage "Latest Concept Artwork" section was
   removed entirely at the owner's order — artwork lives on the film
   pages. latestArtworkHtml() and its renderHome call are gone. */

/* ---------- homepage redesign (Oct 30): process bar, featured cards, wide watch cards, filmmakers panel ---------- */
const FEATURED5 = ["the-last-train-below", "the-woman-in-apartment-9", "dead-freight", "the-second-moon", "the-keeper-of-forgotten-things"];
function processBarHtml(variant) {
  /* One continuous pipeline (Oct 30 r2, mockup): a single track whose glowing
     fill ends at the Development point (stage 2 of 5). The films' real status
     is In Development (film.statusInDevelopment) — no percentage is shown.
     Round 3: one shared renderer for featured cards, discover/rail cards
     (variant "compact"), and film pages, so the element is identical
     everywhere the audience meets it. */
  const labels = [1, 2, 3, 4, 5].map((n) => "<span>" + escapeHtml(t("process.s" + n)) + "</span>").join("");
  return '<div class="process-block' + (variant === "compact" ? " compact" : "") + '"><p class="process-heading">' + escapeHtml(t("process.heading")) + '</p>' +
    '<div class="process-track" role="img" aria-label="' + escapeHtml(t("process.heading") + ": " + t("process.now") + " — " + t("film.statusInDevelopment")) + '"><span class="process-fill"></span></div>' +
    '<div class="process-labels">' + labels + '</div>' +
    '<p class="process-now">' + escapeHtml(t("process.now")) + ": " + escapeHtml(t("film.statusInDevelopment")) + "</p></div>";
}
function featuredCardHtml(f) {
  return '<article class="feature-card">' +
    '<a class="feature-media" href="#/film/' + f.id + '" aria-label="' + escapeHtml(t("card.viewProject", { title: f.title })) + '">' +
    '<img src="backdrops/' + f.id + '.webp" width="1600" height="900" loading="lazy" alt="">' +
    '<span class="feature-genre">' + escapeHtml(f.genre) + "</span></a>" +
    '<div class="feature-body"><h3 class="feature-title"><a href="#/film/' + f.id + '">' + escapeHtml(f.title) + "</a></h3>" +
    '<p class="feature-tag">' + escapeHtml(filmText(f, "tagline")) + "</p>" +
    processBarHtml() + "</div></article>";
}
function fmtRuntime(mins) {
  if (!mins && mins !== 0) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? h + "h " + String(m).padStart(2, "0") + "m" : m + "m";
}
function watchWideCardHtml(w) {
  const dur = fmtRuntime(w.runtimeMinutes);
  return '<figure class="card watch-wide">' +
    '<div class="watch-wide-wrap"><a class="poster-link" href="#/watch/' + w.id + '" aria-label="' + escapeHtml(t("card.watchFree", { title: w.title })) + '">' +
    '<img src="' + escapeHtml(w.posterUrl) + '" width="880" height="1320" loading="lazy" alt="' + escapeHtml(t("card.watchPosterAlt", { title: w.title })) + '">' +
    '<span class="watch-play" aria-hidden="true">\u25B6</span></a></div>' +
    '<figcaption>' +
    (dur ? '<p class="watch-duration">' + escapeHtml(dur) + "</p>" : "") + "</figcaption></figure>";
}
/* Stage 5 (Round 5): Watch Free catalog card — large 16:9 playable
   thumbnail, visible title, real runtime meta and a clamped synopsis.
   (The homepage keeps its duration-only wide card; the catalog page is a
   browsing surface, so titles are printed here under the artwork.) */
function watchGridCardHtml(w) {
  const saved = watchSaved.has(w.id);
  return '<figure class="card watch-card2">' +
    '<div class="watch-wide-wrap"><a class="poster-link" href="#/watch/' + w.id + '" aria-label="' + escapeHtml(t("card.watchFree", { title: w.title })) + '">' +
    '<img src="' + escapeHtml(w.posterUrl) + '" width="880" height="1320" loading="lazy" alt="' + escapeHtml(t("card.watchPosterAlt", { title: w.title })) + '">' +
    '<span class="watch-play" aria-hidden="true">\u25B6</span></a>' +
    '<button type="button" class="bookmark-btn" data-action="watch-save" data-id="' + w.id + '" aria-pressed="' + saved + '" aria-label="' + escapeHtml(t(saved ? "watch2.savedToWatchlist" : "watch2.saveToWatchlist") + ": " + w.title) + '" title="' + escapeHtml(t(saved ? "watch2.savedToWatchlist" : "watch2.saveToWatchlist")) + '">' + BOOKMARK_SVG + "</button></div>" +
    '<figcaption class="watch-card2-body">' +
    '<h3 class="watch-card2-title"><a href="#/watch/' + w.id + '">' + escapeHtml(w.title) + "</a></h3>" +
    '<p class="watch-card2-meta">' + escapeHtml(t("watch.cardMeta", { year: w.year, minutes: w.runtimeMinutes, category: watchCatLabel(w.category) })) + "</p>" +
    '<p class="watch-card2-syn">' + escapeHtml(w.synopsis || "") + "</p>" +
    "</figcaption></figure>";
}

function fmPanelHtml() {
  return '<section class="fm-panel" aria-label="' + escapeHtml(t("home3.fmTitle")) + '">' +
    '<img class="fm-bg" src="backdrops/the-last-picture-house.webp" width="1600" height="900" loading="lazy" alt="" aria-hidden="true">' +
    '<div class="fm-shade"></div><div class="fm-content">' +
    '<h2>' + escapeHtml(t("home3.fmTitle")) + "</h2>" +
    "<p>" + escapeHtml(t("home3.fmText")) + "</p>" +
    '<div class="fm-actions"><a class="btn btn-primary" href="#/submit">' + escapeHtml(t("home3.fmButton")) + ' <span aria-hidden="true">\u203A</span></a>' +
    '<a class="btn btn-ghost" href="#/professionals">' + escapeHtml(t("nav.professionals")) + "</a></div>" +
    "</div></section>";
}
function renderHome() {
  startShowcase();
  const featured = FEATURED5.map(filmById).filter(Boolean);
  const featuredHtml = featured.length ?
    '<section class="row-section featured-section" aria-label="' + escapeHtml(t("home3.featuredTitle")) + '">' +
    '<div class="section-head"><h2>' + escapeHtml(t("home3.featuredTitle")) + '</h2><a class="section-link" href="#/discover">' + escapeHtml(t("home.viewAll")) + '</a></div>' +
    '<div class="featured-row">' + featured.map(featuredCardHtml).join("") + "</div></section>" : "";
  const tonight = WATCH.filter((w) => w.category === "modern");
  const watchRow = tonight.length ?
    '<section class="row-section" aria-label="' + escapeHtml(t("home3.watchTitle")) + '">' +
    '<div class="section-head"><h2>' + escapeHtml(t("home3.watchTitle")) + '</h2><a class="section-link" href="#/watch">' + escapeHtml(t("home.allFreeFilms")) + '</a></div>' +
    '<div class="watch-wide-row">' + tonight.slice(0, 4).map(watchWideCardHtml).join("") + "</div></section>" : "";
  const recentRow = recentFilms.length ?
    '<section class="row-section" aria-label="' + escapeHtml(t("home2.recentlyViewed")) + '"><div class="section-head"><h2>' + escapeHtml(t("home2.recentlyViewed")) + '</h2></div>' +
    '<div class="poster-row">' + recentFilms.map(filmById).filter(Boolean).map(cardHtml).join("") + "</div></section>" : "";
  $("#home-rows").innerHTML = featuredHtml + watchRow + fmPanelHtml() + recentRow + SECTIONS.filter((s) => s.key !== "section.featured").map((s) => {
    const films = s.films();
    if (!films.length) return "";
    const title = s.key ? t(s.key) : s.title;
    return '<section class="row-section" aria-label="' + escapeHtml(title) + '">' +
      '<div class="section-head"><h2>' + escapeHtml(title) + "</h2>" +
      (s.link ? '<a class="section-link" href="' + s.link + '">' + escapeHtml(t("home.viewAll")) + '</a>' : "") + "</div>" +
      '<div class="poster-row">' + films.map(cardHtml).join("") + "</div></section>";
  }).join("");
}

/* ---------- discover ---------- */
/* Final2 Wave 2 (Part 13): search + genre <select> (distinct film.genre
   values) + production-type chips + development-stage <select> (distinct
   film.status values). The old genre-bucket chips and favorite-genre
   sorting were removed with this redesign; the home rails still use
   bucket() for their curated rows. Saved glx_fav_genres data is left
   untouched on the device, simply no longer consumed. */
const METHOD_LABEL_KEYS = { "All": "discover6.methodAll", "LIVE ACTION": "discover6.methodLive", "AI FILM": "discover6.methodAi", "HYBRID": "discover6.methodHybrid", "ANIMATION": "discover6.methodAnim" };
function chipsHtml(items, current, attr) {
  return '<span class="chip-label">' + escapeHtml(t("discover.filterMethod")) + "</span>" + items.map((i) =>
    '<button type="button" class="chip" data-' + attr + '="' + escapeHtml(i) + '" aria-pressed="' + (current === i) + '">' + escapeHtml(METHOD_LABEL_KEYS[i] ? t(METHOD_LABEL_KEYS[i]) : i) + "</button>").join("");
}
function renderChips() {
  const el = $("#type-chips");
  if (el) el.innerHTML = chipsHtml(["All"].concat(TYPES), state.typeFilter, "type");
}
function distinctFilmValues(field) {
  const out = [];
  FILMS.forEach((f) => { if (f[field] && !out.includes(f[field])) out.push(f[field]); });
  return out;
}
function stageLabel(status) { return status === "In Development" ? t("film.statusInDevelopment") : status; }
function renderFilterSelects() {
  const genreSel = $("#genre-select");
  if (genreSel) {
    genreSel.innerHTML = '<option value="All">' + escapeHtml(t("discover.allGenres")) + "</option>" +
      distinctFilmValues("genre").map((g) => '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + "</option>").join("");
    genreSel.value = state.genreExact;
  }
  const sortSel = $("#sort-select");
  if (sortSel) {
    sortSel.innerHTML =
      '<option value="featured">' + escapeHtml(t("discover2.sortFeatured")) + "</option>" +
      '<option value="title">' + escapeHtml(t("discover2.sortTitle")) + "</option>" +
      '<option value="newest">' + escapeHtml(t("discover2.sortNewest")) + "</option>";
    sortSel.value = state.sortBy;
  }
}
function filteredFilms() {
  const q = state.query.trim().toLowerCase();
  return FILMS.filter((f) => {
    if (state.genreExact !== "All" && f.genre !== state.genreExact) return false;
    if (state.stageFilter !== "All" && f.status !== state.stageFilter) return false;
    if (state.typeFilter !== "All" && f.productionType !== state.typeFilter) return false;
    if (q) {
      const hay = (f.title + " " + f.genre + " " + filmText(f, "logline") + " " + filmText(f, "tagline") + " " + (filmText(f, "synopsis") || "") + " " + translatedCharacters(f).map((c) => [c.name, c.role, c.note].filter(Boolean).join(" ")).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderDiscover() {
  renderFilterSelects();
  renderChips();
  const introEl = $("#discover-intro");
  if (introEl) introEl.textContent = t("discover6.intro", { count: FILMS.length });
  const projEl = $("#discover-projects-count");
  if (projEl) projEl.textContent = t("discover6.projectsCount", { count: FILMS.length });
  const list = filteredFilms();
  if (state.sortBy === "title") list.sort((a, b) => a.title.localeCompare(b.title));
  else if (state.sortBy === "newest") list.sort((a, b) => b.n - a.n);
  $("#results-count").textContent = t("discover.resultsCount", { shown: list.length, total: FILMS.length });
  $("#discover-grid").innerHTML = list.map(cardHtml).join("");
  const empty = $("#discover-empty");
  if (empty) empty.innerHTML = list.length ? "" :
    '<p class="empty-text">' + escapeHtml(t("discover.noResults")) + '</p>' +
    '<button type="button" class="btn" data-action="clear-filters">' + escapeHtml(t("discover.clearFilters")) + "</button>";
}

/* ---------- watch free ---------- */
const WATCH = (window.WATCH_FREE || []).slice();
const WATCH_CATS = [
  { key: "All", labelKey: "watch.cat.all" },
  { key: "classic", labelKey: "watch.cat.classics" },
  { key: "modern", labelKey: "watch.cat.modern" },
  { key: "short", labelKey: "watch.cat.shorts" },
  { key: "documentary", labelKey: "watch.cat.documentaries" }
];
const watchCatLabel = (key) => { const c = WATCH_CATS.find((x) => x.key === key); return c ? t(c.labelKey) : key; };
const watchById = (id) => WATCH.find((w) => w.id === id);
function watchCardHtml(w) {
  const saved = watchSaved.has(w.id);
  return '<figure class="card">' +
    '<div class="poster-wrap"><a class="poster-link" href="#/watch/' + w.id + '" aria-label="' + escapeHtml(t("card.watchFree", { title: w.title })) + '">' +
    '<div class="poster"><img src="' + escapeHtml(w.posterUrl) + '" width="880" height="1320" loading="lazy" alt="' + escapeHtml(t("card.watchPosterAlt", { title: w.title })) + '"></div></a>' +
    '<button type="button" class="bookmark-btn" data-action="watch-save" data-id="' + w.id + '" aria-pressed="' + saved + '" aria-label="' + escapeHtml(t(saved ? "watch2.savedToWatchlist" : "watch2.saveToWatchlist") + ": " + w.title) + '" title="' + escapeHtml(t(saved ? "watch2.savedToWatchlist" : "watch2.saveToWatchlist")) + '">' + BOOKMARK_SVG + "</button></div>" +
    "</figure>";
}
function watchFiltered() {
  const q = state.watchQuery.trim().toLowerCase();
  return WATCH.filter((w) => {
    if (state.watchCategory !== "All" && w.category !== state.watchCategory) return false;
    if (state.watchGenre !== "All" && !(w.genres || []).includes(state.watchGenre)) return false;
    if (q) {
      const hay = (w.title + " " + w.director + " " + w.year + " " + (w.genres || []).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
/* Round 6 (Oct 30): Watch Free as a streaming surface — featured
   carousel, genre tiles and curated rails, all populated from the real
   catalog (WATCH). Category membership uses ONLY the existing metadata:
   the catalog `category` field (classic / modern / short / documentary)
   and the `genres` arrays (Animation tile). Counts are computed live. */
let watchFeatIdx = 0;
function watchFeaturedPool() {
  const valid = WATCH.filter((w) => w.embedUrl && w.posterUrl);
  const ed = valid.find((w) => /elephants dream/i.test(w.title));
  const rest = valid.filter((w) => w !== ed);
  return (ed ? [ed] : []).concat(rest).slice(0, 6);
}
function watchFeaturedHtml() {
  const pool = watchFeaturedPool();
  if (!pool.length) return "";
  if (watchFeatIdx >= pool.length) watchFeatIdx = 0;
  const slides = pool.map((w, i) =>
    '<div class="watch-feat-slide' + (i === watchFeatIdx ? " active" : "") + '" data-wf-slide="' + i + '"' + (i === watchFeatIdx ? "" : " hidden") + '>' +
    '<img class="watch-feat-bg" src="' + escapeHtml(w.posterUrl) + '" alt="" aria-hidden="true" loading="lazy">' +
    '<div class="watch-feat-shade"></div>' +
    '<div class="watch-feat-content">' +
    '<p class="eyebrow">' + escapeHtml(t("watch6.featured")) + "</p>" +
    '<h3 class="watch-feat-title">' + escapeHtml(w.title) + "</h3>" +
    '<p class="watch-feat-meta">' + escapeHtml(t("watch.cardMeta", { year: w.year, minutes: w.runtimeMinutes, category: watchCatLabel(w.category) })) + "</p>" +
    '<p class="watch-feat-syn">' + escapeHtml(w.synopsis || "") + "</p>" +
    '<div class="watch-feat-actions"><a class="btn btn-primary" href="#/watch/' + w.id + '">' + escapeHtml(t("watch6.watchFree")) + '</a>' +
    '<a class="btn btn-ghost" href="#/watch/' + w.id + '">' + escapeHtml(t("watch6.details")) + "</a></div>" +
    "</div>" +
    '<img class="watch-feat-poster" src="' + escapeHtml(w.posterUrl) + '" width="880" height="1320" loading="lazy" alt="' + escapeHtml(t("card.watchPosterAlt", { title: w.title })) + '">' +
    "</div>").join("");
  const dots = pool.map((w, i) => '<button type="button" class="watch-feat-dot" data-action="watch-feat-go" data-idx="' + i + '" aria-current="' + (i === watchFeatIdx) + '" aria-label="' + escapeHtml(w.title) + '"></button>').join("");
  return '<section class="watch-feat" aria-label="' + escapeHtml(t("watch6.featured")) + '">' + slides +
    '<div class="watch-feat-nav"><button type="button" class="watch-feat-arrow" data-action="watch-feat-prev" aria-label="' + escapeHtml(t("gallery.prev")) + '">‹</button>' +
    '<div class="watch-feat-dots">' + dots + '</div>' +
    '<button type="button" class="watch-feat-arrow" data-action="watch-feat-next" aria-label="' + escapeHtml(t("gallery.next")) + '">›</button></div></section>';
}
const WATCH_TILES = [
  { labelKey: "watch6.tileAnimation", genre: "Animation" },
  { labelKey: "watch.cat.shorts", cat: "short" },
  { labelKey: "watch.cat.documentaries", cat: "documentary" },
  { labelKey: "watch.cat.classics", cat: "classic" },
  { labelKey: "watch.cat.modern", cat: "modern" }
];
function watchTileFilms(tile) {
  return tile.genre ? WATCH.filter((w) => (w.genres || []).includes(tile.genre)) : WATCH.filter((w) => w.category === tile.cat);
}
function watchTilesHtml() {
  return '<section class="row-section watch-tiles-section" aria-label="' + escapeHtml(t("watch6.browseGenre")) + '">' +
    '<div class="section-head"><h2>' + escapeHtml(t("watch6.browseGenre")) + "</h2></div>" +
    '<div class="watch-tiles">' + WATCH_TILES.map((tile) => {
      const films = watchTileFilms(tile);
      const img = films.length ? films[0].posterUrl : "";
      return '<button type="button" class="watch-tile" data-action="watch-tile"' + (tile.cat ? ' data-wcat="' + tile.cat + '"' : "") + (tile.genre ? ' data-wgenre="' + escapeHtml(tile.genre) + '"' : "") + '>' +
        (img ? '<img src="' + escapeHtml(img) + '" loading="lazy" alt="">' : "") +
        '<span class="watch-tile-shade"></span>' +
        '<span class="watch-tile-body"><span class="watch-tile-name">' + escapeHtml(t(tile.labelKey)) + '</span>' +
        '<span class="watch-tile-count">' + escapeHtml(t("watch6.filmCount", { count: films.length })) + '</span></span>' +
        '<span class="watch-tile-arrow" aria-hidden="true">›</span></button>';
    }).join("") + "</div></section>";
}
const WATCH_RAIL_TITLES = ["Big Buck Bunny", "Sintel", "Tears of Steel", "Spring", "Cosmos Laundromat"];
function watchRailHtml(headingKey, films) {
  if (!films.length) return "";
  return '<section class="row-section" aria-label="' + escapeHtml(t(headingKey)) + '"><div class="section-head"><h2>' + escapeHtml(t(headingKey)) + '</h2></div>' +
    '<div class="poster-row watch-rail">' + films.map(watchGridCardHtml).join("") + "</div></section>";
}
function renderWatch() {
  const chipsEl = $("#watch-chips");
  if (chipsEl) chipsEl.innerHTML = WATCH_CATS.map((c) =>
    '<button type="button" class="chip" data-wcat="' + c.key + '" aria-pressed="' + (state.watchCategory === c.key) + '">' + escapeHtml(t(c.labelKey)) + "</button>").join("");
  const genreSel = $("#watch-genre");
  if (genreSel) {
    const genres = [];
    WATCH.forEach((w) => (w.genres || []).forEach((g) => { if (!genres.includes(g)) genres.push(g); }));
    genres.sort();
    genreSel.innerHTML = '<option value="All">' + escapeHtml(t("discover.allGenres")) + "</option>" +
      genres.map((g) => '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + "</option>").join("");
    genreSel.value = state.watchGenre;
  }
  const featEl = $("#watch-featured");
  if (featEl) featEl.innerHTML = watchFeaturedHtml();
  const list = watchFiltered();
  const countEl = $("#watch-count");
  if (countEl) countEl.textContent = t("watch.resultsCount", { shown: list.length, total: WATCH.length });
  const filtersDefault = state.watchCategory === "All" && state.watchGenre === "All" && !state.watchQuery.trim();
  const tilesEl = $("#watch-genre-tiles");
  if (tilesEl) tilesEl.innerHTML = filtersDefault ? watchTilesHtml() : "";
  const savedList = list.filter((w) => watchSaved.has(w.id));
  const savedRow = savedList.length ?
    '<section class="row-section" aria-label="' + escapeHtml(t("home2.myWatchlist")) + '"><div class="section-head"><h2>' + escapeHtml(t("home2.myWatchlist")) + '</h2></div>' +
    '<div class="poster-row">' + savedList.map(watchCardHtml).join("") + "</div></section>" : "";
  if (!filtersDefault) {
    $("#watch-rows").innerHTML = savedRow + (list.length ?
      '<div class="watch-grid">' + list.map(watchGridCardHtml).join("") + "</div>"
      : '<p class="section-intro">' + escapeHtml(t("watch.noResults")) + '</p>');
    return;
  }
  const railFilms = WATCH_RAIL_TITLES.map((title) => WATCH.find((w) => w.title === title)).filter(Boolean);
  const railIds = new Set(railFilms.map((w) => w.id));
  const exploreFilms = WATCH.filter((w) => !railIds.has(w.id)).slice(0, 10);
  const allSection =
    '<section class="row-section watch-all" id="watch-all" aria-label="' + escapeHtml(t("watch6.allFilms")) + '"><div class="section-head"><h2>' + escapeHtml(t("watch6.allFilms")) + "</h2></div>" +
    '<div class="watch-grid">' + WATCH.map(watchGridCardHtml).join("") + "</div></section>" +
    '<section class="watch-grow"><div class="watch-grow-inner"><h2>' + escapeHtml(t("watch6.growTitle")) + "</h2>" +
    "<p>" + escapeHtml(t("watch6.growText")) + "</p>" +
    '<p><a class="btn btn-primary" href="#/watch" data-scroll="watch-all">' + escapeHtml(t("watch6.exploreAll")) + "</a></p></div></section>";
  $("#watch-rows").innerHTML = savedRow +
    watchRailHtml("watch6.featuredFilms", railFilms) +
    watchRailHtml("watch6.exploreMore", exploreFilms) +
    allSection;
}
function renderWatchDetail(id) {
  const el = $("#watch-detail");
  const w = watchById(id);
  if (!w) {
    el.innerHTML = '<div class="section"><h2 tabindex="-1">' + escapeHtml(t("watch.notFound")) + '</h2><p>' + escapeHtml(t("watch.notFoundText")) + ' <a href="#/watch">' + escapeHtml(t("watch.browseWatch")) + "</a>.</p></div>";
    return;
  }
  const sourceName = w.source === "youtube" ? t("watch.sourceYoutube") : t("watch.sourceArchive");
  /* Round 6: related films share a genre first; the previous same-category
     rail is the fallback when no genre matches exist. */
  const genreRelated = WATCH.filter((x) => x.id !== w.id && (x.genres || []).some((g) => (w.genres || []).includes(g)));
  const related = (genreRelated.length ? genreRelated : WATCH.filter((x) => x.category === w.category && x.id !== w.id)).slice(0, 10);
  el.innerHTML =
    '<div class="section watch-detail">' +
    '<p class="watch-back"><a href="#/watch">' + escapeHtml(t("watch.backAll")) + "</a></p>" +
    '<h1 tabindex="-1">' + escapeHtml(w.title) + "</h1>" +
    '<p class="watch-meta">' + escapeHtml(t("watch.metaLine", { year: w.year, minutes: w.runtimeMinutes, director: w.director, category: watchCatLabel(w.category) })) + "</p>" +
    (w.genres && w.genres.length ? '<p class="watch-genres"><span class="watch-genres-label">' + escapeHtml(t("watch3.genres")) + ': </span>' + w.genres.map((g) => '<span class="genre-chip genre-chip-static">' + escapeHtml(g) + "</span>").join(" ") + "</p>" : "") +
    '<div class="player-wrap"><iframe src="' + escapeHtml(w.embedUrl) + '" title="' + escapeHtml(t("watch.playerTitle", { title: w.title })) + '" loading="lazy" allowfullscreen frameborder="0" referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
    '<p class="watch-synopsis">' + escapeHtml(w.synopsis) + "</p>" +
    '<p><button type="button" class="btn btn-ghost" data-action="watch-save" data-id="' + w.id + '" aria-pressed="' + watchSaved.has(w.id) + '">' + escapeHtml(t(watchSaved.has(w.id) ? "watch2.savedToWatchlist" : "watch2.saveToWatchlist")) + "</button></p>" +
    '<p class="watch-attribution">' + escapeHtml(t("watch.streamingVia", { source: sourceName })) + " " + escapeHtml(w.rightsNote) + "</p>" +
    '<p><a class="btn btn-ghost" href="' + escapeHtml(w.sourcePageUrl) + '" target="_blank" rel="noopener">' + escapeHtml(t("watch.watchOnSource")) + "</a></p>" +
    "</div>" +
    (related.length ?
      '<section class="row-section" aria-label="' + escapeHtml(t("watch.moreLikeThis")) + '"><div class="section-head"><h2>' + escapeHtml(t("watch.moreLikeThis")) + '</h2></div>' +
      '<div class="poster-row">' + related.map(watchCardHtml).join("") + "</div></section>" : "");
}

/* ---------- film detail ---------- */
function myPledgeFor(filmId) { return server.myPledges.find((p) => p.film_id === filmId && p.status === "pledged"); }
function pledgePanelHtml(film) {
  /* Round 4 (Oct 30): restyled to the owner's film-page mockup — amount
     chips in a 3×2 grid ($5/$10/$25 / $50/$100/Custom) and ONE full-width
     green action button. Behaviour is unchanged: pledge-pick still sets
     pledgePick.cents and clears the custom field; the Custom chip reveals
     the same #pledge-custom input the submit handler has always read
     first; record/cancel/account-gate flows are untouched. The grey
     nonbinding microcopy (pledge.termsNote) stays under the button; the
     duplicate pledgeMicro line that headed the old panel is consolidated
     into it (same disclosure, one place). */
  const mine = server.user ? myPledgeFor(film.id) : null;
  if (pledgePick.filmId !== film.id) pledgePick = { filmId: film.id, cents: 2500, custom: false };
  let action = "";
  if (!server.user) {
    action = '<div class="pledge-grid" aria-hidden="true">' + PLEDGE_AMOUNTS.map((c) => '<span class="chip chip-static">' + fmtCents(c) + "</span>").join("") +
      '<span class="chip chip-static">' + escapeHtml(t("filmPage.custom")) + "</span></div>" +
      '<a class="btn btn-primary btn-block" href="#/account" data-action="pledge-gate" data-id="' + film.id + '">' + escapeHtml(t("pledge2.createAccountFull")) + '</a>' +
      '<p class="panel-note">' + escapeHtml(t("pledge.accountNote")) + '</p>';
  } else if (mine) {
    action = '<p class="panel-note"><strong>' + escapeHtml(t("pledge.youPledged", { amount: fmtCents(mine.amount_cents) })) + '</strong></p>' +
      '<button type="button" class="btn btn-ghost btn-block" data-action="pledge-cancel" data-id="' + film.id + '">' + escapeHtml(t("pledge2.cancelInterest")) + '</button>';
  } else {
    action = '<div class="pledge-grid" role="group" aria-label="' + escapeHtml(t("pledge.amountGroupLabel")) + '">' +
      PLEDGE_AMOUNTS.map((c) => '<button type="button" class="chip" data-action="pledge-pick" data-cents="' + c + '" aria-pressed="' + (pledgePick.cents === c && !pledgePick.custom) + '">' + fmtCents(c) + "</button>").join("") +
      '<button type="button" class="chip" data-action="pledge-custom" aria-pressed="' + pledgePick.custom + '">' + escapeHtml(t("filmPage.custom")) + "</button></div>" +
      '<div class="field pledge-custom-field"' + (pledgePick.custom ? "" : " hidden") + '><label for="pledge-custom">' + escapeHtml(t("pledge.customLabel")) + '</label>' +
      '<input id="pledge-custom" type="number" min="1" step="1" placeholder="' + escapeHtml(t("pledge.customPlaceholder")) + '"></div>' +
      '<button type="button" class="btn btn-primary btn-block" data-action="pledge-submit" data-id="' + film.id + '">' + escapeHtml(t("pledge.submitButton", { amount: fmtCents(pledgePick.cents) })) + "</button>" +
      '<p class="panel-note">' + escapeHtml(t("pledge.termsNote")) + '</p>';
  }
  return '<div class="action-panel pledge-panel" id="support-panel"><h3>' + escapeHtml(t("filmPage.pledgeHeading")) + '</h3>' +
    action + "</div>";
}

const ROADMAP_KEYS = ["roadmap.1", "roadmap.2", "roadmap.3", "roadmap.4", "roadmap.5", "roadmap.6"];
/* ---------- lightbox (concept artwork gallery) ---------- */
let lightboxState = null;
function closeLightbox() {
  if (!lightboxState) return;
  const { el, trigger } = lightboxState;
  lightboxState = null;
  if (el && el.parentNode) el.parentNode.removeChild(el);
  if (trigger && trigger.focus) trigger.focus();
}
function showLightboxItem() {
  if (!lightboxState) return;
  const { assets, idx, img, cap } = lightboxState;
  const a = assets[idx];
  const caption = galleryCaption(lightboxState.film, a);
  img.src = a.file; img.alt = caption;
  cap.textContent = caption;
  lightboxState.idx = idx;
}
function stepLightbox(delta) {
  if (!lightboxState) return;
  const n = lightboxState.assets.length;
  lightboxState.idx = (lightboxState.idx + delta + n) % n;
  showLightboxItem();
}
function openLightbox(film, assets, idx, trigger) {
  if (!document.body || !document.createElement) return;
  closeLightbox();
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML =
    '<button type="button" class="lightbox-close" data-lb="close" aria-label="' + escapeHtml(t("gallery.close")) + '">×</button>' +
    '<button type="button" class="lightbox-nav" data-lb="prev" aria-label="' + escapeHtml(t("gallery.prev")) + '">‹</button>' +
    '<figure class="lightbox-figure"><img class="lightbox-img" src="" alt=""><figcaption class="lightbox-cap"></figcaption></figure>' +
    '<button type="button" class="lightbox-nav" data-lb="next" aria-label="' + escapeHtml(t("gallery.next")) + '">›</button>';
  document.body.appendChild(overlay);
  const img = overlay.querySelector(".lightbox-img");
  const cap = overlay.querySelector(".lightbox-cap");
  lightboxState = { el: overlay, assets, idx, film, img, cap, trigger: trigger || null };
  overlay.addEventListener("click", (e) => {
    const btn = e.target.closest ? e.target.closest("[data-lb]") : null;
    if (btn) {
      if (btn.dataset.lb === "close") closeLightbox();
      else if (btn.dataset.lb === "prev") stepLightbox(-1);
      else if (btn.dataset.lb === "next") stepLightbox(1);
      return;
    }
    if (e.target === overlay) closeLightbox();
  });
  showLightboxItem();
  const closeBtn = overlay.querySelector(".lightbox-close");
  if (closeBtn && closeBtn.focus) closeBtn.focus();
}
function galleryCaption(film, a) {
  if (a.kind === "poster") return t("film2.artworkPosterCaption");
  if (a.kind === "backdrop") return t("film2.artworkBackdropCaption");
  return t("artworkKind." + a.kind) + " — " + a.subject;
}
function galleryHtml(film) {
  const assets = artworkFor(film.id);
  return '<div class="detail-section" data-fp-section="gallery"><h2>' + escapeHtml(t("film3.galleryHeading")) + '</h2>' +
    '<p class="fineprint gallery-label">' + escapeHtml(t("film2.artworkHeading")) + "</p>" +
    '<div class="concept-gallery">' +
    assets.map((a, i) =>
      '<figure><button type="button" class="gallery-item" data-lightbox-film="' + film.id + '" data-lightbox-idx="' + i + '" aria-label="' + escapeHtml(t("gallery.view", { caption: galleryCaption(film, a) })) + '">' +
      '<img src="' + escapeHtml(a.file) + '" loading="lazy" alt="' + escapeHtml(galleryCaption(film, a)) + '"></button>' +
      "<figcaption>" + escapeHtml(galleryCaption(film, a)) + "</figcaption></figure>").join("") +
    "</div></div>";
}
/* Portrait matching (QC Oct 26): a portrait may be shown ONLY for the
   character it actually depicts — matched on the artwork subject name,
   never by filename guesswork and never by "first unused" fallback
   (the old fallback put wrong faces on 9 films). No match = text-only card. */
const CHAR_NAME_TITLES = new Set(["dr", "mr", "mrs", "ms", "miss", "master", "captain", "queen", "king", "sister", "brother", "father", "inspector", "detective", "professor", "agent", "supervisory", "the", "voice", "sergeant", "seargent", "lt", "col", "gen"]);
function charNameTokens(name) {
  const s = String(name || "").replace(/\([^)]*\)/g, " ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['\u2019\u2018]/g, "");
  return Array.from(new Set(s.split(/[^a-z0-9]+/).filter(Boolean).filter((x) => !CHAR_NAME_TITLES.has(x))));
}
function charInitials(name) {
  const toks = charNameTokens(name);
  if (!toks.length) return "?";
  return (toks[0][0] + (toks.length > 1 ? toks[toks.length - 1][0] : "")).toUpperCase();
}
function charactersHtml(film) {
  const chars = translatedCharacters(film);
  const portraits = artworkFor(film.id).filter((a) => a.kind === "portrait");
  const used = new Set();
  const matchFor = (c) => {
    const ct = charNameTokens(c.name);
    if (!ct.length) return null;
    const hit = portraits.find((pt) => {
      if (used.has(pt.file)) return false;
      const st = charNameTokens(pt.subject);
      if (!st.length) return false;
      const subset = (a, b) => a.every((x) => b.includes(x));
      return subset(ct, st) || subset(st, ct);
    });
    if (hit) used.add(hit.file);
    return hit || null;
  };
  /* Round 4 (Oct 30): mockup media-top cards. The portrait rule above is
     unchanged (QC Oct 26): an image appears ONLY when the artwork subject
     names this character. Unmatched characters get a styled monogram card
     (initials on the film's genre hue) — never a borrowed face. */
  const hue = genreHue(film);
  return chars.map((c, idx) => {
    const pt = matchFor(c);
    const note = String(c.note || "");
    const first = (note.split(/(?<=\.)\s+/)[0] || note);
    const media = pt
      ? '<div class="char-media"><img class="char-portrait" src="' + escapeHtml(pt.file) + '" width="1200" height="1800" loading="lazy" alt="' + escapeHtml(t("artworkKind.portrait") + " — " + c.name) + '"></div>'
      : '<div class="char-media"><div class="char-monogram" style="--hue:' + hue + '" aria-hidden="true"><span>' + escapeHtml(charInitials(c.name)) + "</span></div></div>";
    return '<div class="char-card">' + media + '<div class="char-body"><h3>' + escapeHtml(c.name) + '</h3><p class="char-role">' + escapeHtml(c.role) + "</p><p>" + escapeHtml(first) + "</p>" +
      (note && note !== first ? '<details class="char-bio"><summary>' + escapeHtml(t("film3.readBio")) + "</summary><p>" + escapeHtml(note) + "</p></details>" : "") +
      characterProfileHtml(film, c, idx) + "</div></div>";
  }).join("");
}
function progressHtml(film) {
  const assets = artworkFor(film.id);
  const items = [
    [t("progress.m1"), true],
    [t("progress.m2"), assets.some((a) => a.kind === "location")],
    [t("progress.m3"), FLAGSHIPS.includes(film.id) && !!TEASERS[film.id]],
    [t("progress.m4"), assets.length >= 10],
    [t("progress.m5"), false]
  ];
  return '<div class="greenlight-status"><h3>' + escapeHtml(t("progress.heading")) + '</h3>' +
    '<p class="goal-pending"><strong>' + escapeHtml(t("progress.goalPending")) + '</strong></p>' +
    '<ul class="milestone-list">' + items.map(([label, done], i) =>
      '<li class="' + (done ? "done" : "pending") + '"><span class="milestone-mark" aria-hidden="true">' + (done ? "✓" : "○") + "</span> " + escapeHtml(label) +
      ' <span class="fineprint">(' + escapeHtml(done ? t("progress.achieved") : t("progress.notYet")) + ")</span>" +
      (i === 4 ? '<p class="fineprint milestone-note">' + escapeHtml(t("progress.m5note")) + "</p>" : "") + "</li>").join("") + "</ul></div>";
}
function relatedFilms(film) {
  const out = [];
  const add = (list) => { for (const f of list) { if (f.id !== film.id && !out.includes(f)) out.push(f); } };
  add(FILMS.filter((f) => f.genre === film.genre));
  add(FILMS.filter((f) => f.productionType === film.productionType));
  add(FILMS.filter((f) => bucket(f, "scifi") === bucket(film, "scifi") && bucket(f, "thriller") === bucket(film, "thriller") && bucket(f, "history") === bucket(film, "history") && bucket(f, "romance") === bucket(film, "romance") && bucket(f, "comedy") === bucket(film, "comedy") && bucket(f, "animation") === bucket(film, "animation")));
  add(FILMS);
  return out.slice(0, 5);
}
function journalText(entry) {
  if (lang === "en") return entry;
  for (let i = 1; i <= 4; i++) {
    const enVal = I18N.ui.en && I18N.ui.en["journal.entry" + i];
    if (enVal && entry === enVal) return t("journal.entry" + i);
  }
  return entry;
}
/* ---------- Round 4 (Oct 30): film-page building blocks ---------- */
const FP_TAB_SECTIONS = { overview: null, story: ["story", "devinfo"], characters: ["characters"], gallery: ["gallery", "teaser"], scenes: ["scenes"] };
function applyFilmTab() {
  const root = $("#film-detail");
  if (!root) return;
  const show = FP_TAB_SECTIONS[filmTabState.tab];
  $$("[data-fp-section]", root).forEach((sec) => { sec.hidden = !!(show && !show.includes(sec.dataset.fpSection)); });
  $$(".film-tab", root).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === filmTabState.tab)));
}
function filmTabsHtml(film) {
  /* Mockup tab order: Overview | Story | Characters | Gallery | Scenes.
     A tab is included only where the film has the real content (all 40
     founding films currently have all five). The mockup's "Updates" and
     "Discussion" tabs are omitted — those features do not exist here. */
  const tabs = [["overview", t("filmPage.tabOverview")], ["story", t("filmPage.tabStory")]];
  if ((film.characters || []).length) tabs.push(["characters", t("filmPage.tabCharacters")]);
  tabs.push(["gallery", t("filmPage.tabGallery")]);
  const seqs = localizedArrayField(film, "signatureSequences");
  if (seqs && seqs.some((s) => s && (String(s.title || "").trim() || String(s.description || "").trim()))) tabs.push(["scenes", t("filmPage.tabScenes")]);
  return '<div class="film-tabs" role="tablist">' + tabs.map(([key, label]) =>
    '<button type="button" role="tab" class="film-tab" data-action="film-tab" data-tab="' + key + '" aria-selected="' + (filmTabState.tab === key) + '">' + escapeHtml(label) + "</button>").join("") + "</div>";
}
const FORMAT_LABELS = { "LIVE ACTION": "Live Action", "AI FILM": "AI Film", "HYBRID": "Hybrid", "ANIMATION": "Animation" };
function filmMetaHtml(film) {
  /* Real fields only (owner rule): genre and production type from the
     catalog record, the platform's actual status string, and the four
     languages this film's content is published in. No invented
     "target audience" or similar. */
  const fmt = FORMAT_LABELS[film.productionType] || film.productionType || "";
  const row = (label, value) => "<div><dt>" + escapeHtml(label) + "</dt><dd>" + escapeHtml(value) + "</dd></div>";
  return '<div class="meta-box"><dl>' +
    row(t("filmPage.metaGenre"), film.genre) +
    row(t("filmPage.metaFormat"), fmt) +
    row(t("filmPage.metaStatus"), t("film.statusInDevelopment")) +
    row(t("filmPage.metaLanguage"), "English · Español · Português (Brasil) · Deutsch") +
    "</dl></div>";
}
function filmVisionHtml(film) {
  /* The mockup's "Director's Vision" box, filled with the film's real
     Creative Vision material (tone / themes / visual identity ship in
     every catalog record) instead of an invented director quote. */
  const vision = film.creativeVision || {};
  if (!(vision.tone || vision.themes || vision.visualIdentity)) return "";
  return '<div class="meta-box vision-box"><h3>' + escapeHtml(t("film2.visionHeading")) + "</h3>" +
    (vision.tone ? "<p><strong>" + escapeHtml(t("film2.visionTone")) + "</strong> " + escapeHtml(vision.tone) + "</p>" : "") +
    (vision.themes ? "<p><strong>" + escapeHtml(t("film2.visionThemes")) + "</strong> " + escapeHtml(vision.themes) + "</p>" : "") +
    (vision.visualIdentity ? "<p><strong>" + escapeHtml(t("film2.visionVisual")) + "</strong> " + escapeHtml(vision.visualIdentity) + "</p>" : "") + "</div>";
}

function renderFilmDetail(id) {
  const el = $("#film-detail");
  const film = filmById(id);
  if (!film) {
    el.innerHTML = '<div class="section"><h2 tabindex="-1">' + escapeHtml(t("film.notFound")) + '</h2><p>' + escapeHtml(t("film.notFoundText")) + ' <a href="#/discover">' + escapeHtml(t("film.browseAll")) + "</a>.</p></div>";
    return;
  }
  pushRecent(film.id);
  const followed = state.follows.has(film.id);
  const isSaved = savedFilms.has(film.id);
  const isFlagship = FLAGSHIPS.includes(film.id);
  const rd = film.roadmapData || {};
  const statusText = (rd.currentStatus === "Concept Development") ? t("roadmap.1") : (rd.currentStatus || t("roadmap.1"));
  const roadmapInner =
    '<p class="roadmap-status"><strong>' + escapeHtml(t("film2.statusLabel", { status: statusText })) + '</strong> — ' + escapeHtml(t("film.roadmapNote")) + "</p>" +
    (rd.completedMilestones && rd.completedMilestones.length ? "<h3>" + escapeHtml(t("film2.completedHeading")) + "</h3><ul>" + rd.completedMilestones.map((m) => "<li>" + escapeHtml(m) + "</li>").join("") + "</ul>" : "") +
    "<ol>" + ROADMAP_KEYS.map((k, i) => "<li" + (i === 0 ? ' aria-current="step"><strong>' + escapeHtml(t(k)) + " " + escapeHtml(t("film.youAreHere")) + "</strong>" : ">" + escapeHtml(t(k))) + "</li>").join("") + "</ol>" +
    (rd.nextSteps && rd.nextSteps.length ? "<h3>" + escapeHtml(t("film2.nextStepsHeading")) + "</h3><ul>" + rd.nextSteps.map((m) => "<li>" + escapeHtml(m) + "</li>").join("") + "</ul>" : "");
  const journalInner = (film.journalEntries && film.journalEntries.length) ?
    film.journalEntries.map((j) => '<article class="journal-entry"><p class="journal-date">' + escapeHtml(j.date) + "</p><p>" + escapeHtml(journalText(j.entry)) + "</p></article>").join("") : "";
  /* Round 4 (Oct 30): film page rebuilt to the owner's approved mockup —
     hero (genre chips, heavy title, tagline, L1 hook, Watch Trailer +
     View Gallery actions, follow/save), Process + Pledge rail, tab row
     (Overview | Story | Characters | Gallery | Scenes), the mockup's
     overview composite (Story Overview + Read Full Story treatment,
     meta box, Creative Vision box, characters, signature scenes,
     gallery, teaser, production, development info) and You Might Also
     Like. Adaptations vs the mockup, all honesty-driven: no Updates /
     Discussion tabs (features do not exist), no PDF download rows (no
     such files), no invented director quote (real Creative Vision
     material instead), no percentage on the Process bar. */
  const hasTeaser = isFlagship && !!TEASERS[film.id];
  const teaserHtml = hasTeaser ?
    '<div class="detail-section" id="film-teaser" data-fp-section="teaser"><h2>' + (lang === "en" ? "Concept Teaser" : escapeHtml(t("film2.teaserHeading"))) + '</h2>' +
    '<div class="trailer-frame"><video controls preload="none" playsinline loading="lazy" poster="backdrops/' + film.id + '.webp" aria-label="' + escapeHtml(t("film2.teaserAria", { title: film.title })) + '"><source src="' + TEASERS[film.id] + '" type="video/mp4"></video></div>' +
    '<p class="fineprint">' + escapeHtml(t("film2.teaserNote")) + "</p></div>" : "";
  const heroArt = BACKDROPS[film.id]
    ? '<img class="backdrop" src="backdrops/' + film.id + '.webp" width="1600" height="900" alt="" aria-hidden="true">'
    : '<div class="backdrop-gradient" style="--hue:' + genreHue(film) + '"></div>';
  const assets = artworkFor(film.id);
  const related = relatedFilms(film).slice(0, 4);
  const hookText = filmText(film, "hook");
  const hookHtml = (typeof hookText === "string" && hookText.trim()) ? '<p class="film-hook">' + escapeHtml(hookText) + "</p>" : "";
  const synopsisHtml = String(filmText(film, "synopsis") || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => '<p class="story-paragraph">' + escapeHtml(p) + "</p>").join("");
  const treatmentHtmlValue = filmText(film, "treatmentHtml");
  if (filmTabState.id !== film.id) filmTabState = { id: film.id, tab: "overview" };
  const genreChips = String(film.genre || "").split(/\s+/).filter(Boolean).slice(0, 3)
    .map((g) => '<span class="genre-chip">' + escapeHtml(g) + "</span>").join("");
  const visionHtml = filmVisionHtml(film);
  el.innerHTML =
    '<div class="fp-hero">' +
    '<div class="fp-hero-media">' + heroArt + '<div class="detail-hero-shade"></div>' +
    '<div class="fp-hero-text">' +
    '<div class="fp-chips">' + genreChips + (isFlagship ? '<span class="genre-chip featured-chip">' + escapeHtml(t("film2.featuredBadge")) + "</span>" : "") + "</div>" +
    '<h1 tabindex="-1">' + escapeHtml(film.title) + "</h1>" +
    '<p class="tagline">' + escapeHtml(filmText(film, "tagline")) + "</p>" +
    hookHtml +
    '<div class="fp-hero-actions">' +
    (hasTeaser ? '<button type="button" class="btn btn-primary" data-action="play-teaser"><span aria-hidden="true">▶</span> ' + escapeHtml(t("filmPage.watchTrailer")) + "</button>" : "") +
    '<button type="button" class="btn btn-ghost" data-action="open-gallery" data-id="' + film.id + '">' + escapeHtml(t("filmPage.viewGallery", { count: assets.length })) + "</button>" +
    "</div>" +
    '<div class="fp-hero-actions fp-follow-actions">' +
    '<button type="button" class="btn btn-ghost" data-action="follow" data-id="' + film.id + '" aria-pressed="' + followed + '">' + (followed ? escapeHtml(t("follow.following")) : escapeHtml(t("follow.follow"))) + "</button>" +
    '<button type="button" class="btn btn-ghost" data-action="save" data-id="' + film.id + '" aria-pressed="' + isSaved + '">' + (isSaved ? escapeHtml(t("follow.saved")) : escapeHtml(t("follow.save"))) + "</button>" +
    "</div>" +
    "</div></div>" +
    '<div class="fp-rail">' +
    '<div class="action-panel process-panel">' + processBarHtml() + "</div>" +
    pledgePanelHtml(film) +
    "</div></div>" +
    filmTabsHtml(film) +
    '<div class="fp-main">' +
    '<div class="detail-section" data-fp-section="story"><h2>' + escapeHtml(t("filmPage.storyOverview")) + '</h2>' +
    '<p class="logline">' + escapeHtml(filmText(film, "logline")) + "</p>" +
    synopsisHtml +
    (treatmentHtmlValue ? '<details class="detail-details treatment-wrap"><summary>' + escapeHtml(t("filmPage.readFullStory")) + ' <span aria-hidden="true">›</span></summary><p class="fineprint">' + escapeHtml(t("film.treatmentNote")) + '</p><div class="treatment">' + treatmentHtmlValue + "</div></details>" : "") +
    "</div>" +
    '<div class="fp-meta-row' + (visionHtml ? "" : " fp-meta-row--single") + '" data-fp-section="meta">' + filmMetaHtml(film) + visionHtml + "</div>" +
    '<div class="detail-section" data-fp-section="characters"><h2>' + escapeHtml(sectionLabel("mainCharacters", t("film.characters"))) + '</h2><div class="char-grid">' + charactersHtml(film) + "</div></div>" +
    signatureSequencesHtml(film) +
    galleryHtml(film) +
    teaserHtml +
    '<div class="detail-section" data-fp-section="production"><h2>' + escapeHtml(t("film3.productionFinancing")) + '</h2>' +
    "<p><strong>" + escapeHtml(film.productionType) + ".</strong> " + escapeHtml(film.productionApproach || film.productionNote) + "</p>" +
    fundingFactsHtml(film) +
    "<p><strong>" + escapeHtml(t("funding.budgetLabel")) + ":</strong> " + fmtMoney(film.budget) + " — " + escapeHtml(film.budgetNote) + "</p>" +
    (film.audiencePositioning ? "<p><strong>" + escapeHtml(t("film2.audienceLabel")) + "</strong> " + escapeHtml(film.audiencePositioning) + "</p>" : "") +
    (film.financingNote ? "<p>" + escapeHtml(film.financingNote) + "</p>" : "") + "</div>" +
    '<div class="detail-section" data-fp-section="devinfo"><h2>' + escapeHtml(t("film3.developmentInfo")) + "</h2>" +
    '<details class="detail-details"><summary>' + escapeHtml(sectionLabel("developmentRoadmap", t("film.roadmap"))) + "</summary>" + roadmapInner + "</details>" +
    (journalInner ? '<details class="detail-details"><summary>' + escapeHtml(t("film2.journalHeading")) + "</summary>" + journalInner + "</details>" : "") +
    progressHtml(film) +
    "</div>" +
    "</div>" +
    '<section class="row-section fp-related" aria-label="' + escapeHtml(t("filmPage.alsoLike")) + '"><div class="section-head"><h2>' + escapeHtml(t("filmPage.alsoLike")) + '</h2><a class="section-link" href="#/discover">' + escapeHtml(t("home.viewAll")) + '</a></div>' +
    '<div class="poster-row">' + related.map(cardHtml).join("") + "</div></section>";
  applyFilmTab();
}


/* ---------- account ---------- */
function filmLinks(ids) {
  if (!ids.length) return "<p class='fineprint'>" + escapeHtml(t("account2.noneYet")) + "</p>";
  return "<ul>" + ids.map((id) => { const f = filmById(id); return f ? '<li><a href="#/film/' + f.id + '">' + escapeHtml(f.title) + "</a></li>" : ""; }).join("") + "</ul>";
}
/* Round 6 (Oct 30): account hero (mockup) — cinematic band with the
   three real account benefits. Used by the signed-out view. */
function accountHeroHtml() {
  const ben = (n, icon) => '<div class="trust-item"><span class="account-ben-icon" aria-hidden="true">' + icon + '</span><div><h3>' + escapeHtml(t("account6.ben" + n + "T")) + "</h3><p>" + escapeHtml(t("account6.ben" + n + "X")) + "</p></div></div>";
  const ic = (path) => '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + path + "</svg>";
  return '<div class="account-hero"><img class="account-hero-bg" src="backdrops/the-night-orchestra.webp" alt="" aria-hidden="true">' +
    '<div class="account-hero-shade"></div><div class="account-hero-content">' +
    '<p class="eyebrow">' + escapeHtml(t("account6.eyebrow")) + "</p>" +
    '<h3 class="account-hero-title">' + escapeHtml(t("account6.heroTitle")) + "</h3>" +
    '<p class="account-hero-sub">' + escapeHtml(t("account6.heroDesc")) + "</p>" +
    '<div class="trust-row account-benefits">' +
    ben(1, ic('<path d="M6 3.5h12A1.5 1.5 0 0 1 19.5 5v14A1.5 1.5 0 0 1 18 20.5H6z"/><path d="M6 3.5V20.5"/>')) +
    ben(2, ic('<path d="M12 20.5C7 16.5 3.5 13.2 3.5 9.3 3.5 6.4 5.7 4.5 8.2 4.5c1.5 0 3 .8 3.8 2 .8-1.2 2.3-2 3.8-2 2.5 0 4.7 1.9 4.7 4.8 0 3.9-3.5 7.2-8.5 11.2z"/>')) +
    ben(3, ic('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>')) +
    "</div></div></div>";
}
async function renderAccount() {
  const el = $("#account-body");
  if (!el) return;
  if (!sb) { el.innerHTML = "<p>" + escapeHtml(t("account2.unavailable")) + "</p>"; return; }
  /* Final2 P1: one-time notices set by sbInit when an email link lands here. */
  /* One-time landing notices, replay-safe: renderAccount runs several times
     in quick succession around an email-link landing (initial render, session
     load, auth-state replay) and only the LAST render is what the user sees —
     so every render while a landing flag is set includes the banner, and the
     flags are cleared on a short delay (see the setTimeout in both branches)
     once a banner render has landed. sbInit also drops stale flags on the
     next ordinary page load. */
  let justConfirmed = false, linkError = false;
  try {
    justConfirmed = sessionStorage.getItem("glx_just_confirmed") === "1";
    linkError = sessionStorage.getItem("glx_auth_link_error") === "1";
  } catch (e) {}
  const authBanners =
    (justConfirmed ? "<div role='status' style='border:2px solid #1e7d32;background:#eef7ee;color:#14301a;padding:1rem 1.2rem;margin:0 0 1.2rem;border-radius:6px'><strong>" + escapeHtml(t("auth2.confirmedTitle")) + "</strong><p style='margin:0.3rem 0 0'>" + escapeHtml(t("auth2.confirmedBody")) + "</p></div>" : "") +
    (linkError ? "<div role='alert' style='border:2px solid #b3261e;background:#fdeceb;color:#5f1710;padding:1rem 1.2rem;margin:0 0 1.2rem;border-radius:6px'><strong>" + escapeHtml(t("auth2.linkErrorTitle")) + "</strong><p style='margin:0.3rem 0 0'>" + escapeHtml(t("auth2.linkErrorBody")) + "</p></div>" : "");
  if (recoveryMode) {
    el.innerHTML =
      "<p class='section-intro' style='padding-left:0'>" + escapeHtml(t("account.recoveryIntro")) + "</p>" +
      "<form id='recovery-form' novalidate>" +
      "<div class='field'><label for='r-pass'>" + escapeHtml(t("account.newPassword")) + "</label><input id='r-pass' type='password' autocomplete='new-password' required></div>" +
      "<div class='field'><label for='r-pass2'>" + escapeHtml(t("account.confirmPassword")) + "</label><input id='r-pass2' type='password' autocomplete='new-password' required></div>" +
      "<button class='btn btn-primary' type='submit'>" + escapeHtml(t("account.setPasswordButton")) + "</button>" +
      "<p class='form-msg' id='recovery-msg' role='status'></p></form>";
    $("#recovery-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#recovery-msg");
      const p1 = $("#r-pass").value, p2 = $("#r-pass2").value;
      if (p1.length < 6) { msg.textContent = t("account.passTooShort"); return; }
      if (p1 !== p2) { msg.textContent = t("account.passMismatch"); return; }
      msg.textContent = t("account.updatingPassword");
      const btn = e.target.querySelector("button[type='submit']"); btn.disabled = true;
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) { msg.textContent = t("account.genericError", { error: error.message }); btn.disabled = false; return; }
      recoveryMode = false;
      try { history.replaceState(null, "", location.pathname + "#/account"); } catch (err) {}
      await renderAccount();
      const note = $("#account-msg");
      if (note) note.textContent = t("account.passUpdated");
    });
    return;
  }
  if (!server.user) {
    el.innerHTML =
      accountHeroHtml() +
      authBanners +
      "<div id='auth-success-panel'></div>" +
      "<form id='auth-form' novalidate><div class='auth-grid'>" +
      "<div class='auth-card'><h3>" + escapeHtml(t("account6.signinHeading")) + "</h3>" +
      "<p class='auth-card-sub'>" + escapeHtml(t("account6.signinSub")) + "</p>" +
      "<div class='field'><label for='a-email'>" + escapeHtml(t("account.email")) + "</label><input id='a-email' type='email' autocomplete='email' required aria-describedby='a-email-err'>" +
      "<p class='form-msg' id='a-email-err' role='alert' style='color:#b3261e'></p></div>" +
      "<div class='field'><label for='a-pass'>" + escapeHtml(t("account.password")) + "</label><input id='a-pass' type='password' autocomplete='current-password' required aria-describedby='a-pass-hint a-pass-err'>" +
      "<p class='fineprint' id='a-pass-hint' style='margin:0.25rem 0 0'>" + escapeHtml(t("auth2.passwordRule")) + "</p>" +
      "<p class='form-msg' id='a-pass-err' role='alert' style='color:#b3261e'></p></div>" +
      "<button class='btn btn-primary btn-block' type='submit' name='mode' value='signin' id='auth-signin-btn'>" + escapeHtml(t("auth2.signIn")) + "</button>" +
      "<p class='form-msg' id='auth-msg' role='status'></p>" +
      "<p style='margin-top:0.6rem'><button type='button' class='btn btn-ghost' id='forgot-btn'>" + escapeHtml(t("account.forgotPassword")) + "</button></p>" +
      "<div id='forgot-panel' hidden style='margin-top:0.6rem'>" +
      "<div class='field'><label for='forgot-email'>" + escapeHtml(t("account.forgotEmailLabel")) + "</label><input id='forgot-email' type='email' autocomplete='email'></div>" +
      "<button type='button' class='btn' id='forgot-send'>" + escapeHtml(t("account.sendResetButton")) + "</button>" +
      "<p class='form-msg' id='forgot-msg' role='status'></p></div></div>" +
      "<div class='auth-card'><h3>" + escapeHtml(t("account6.createHeading")) + "</h3>" +
      "<p class='auth-card-sub'>" + escapeHtml(t("account6.createSub")) + "</p>" +
      "<ul class='auth-benefits'>" +
      "<li><strong>" + escapeHtml(t("account6.freeT")) + "</strong><span>" + escapeHtml(t("account6.freeX")) + "</span></li>" +
      "<li><strong>" + escapeHtml(t("account6.communityT")) + "</strong><span>" + escapeHtml(t("account6.communityX")) + "</span></li>" +
      "<li><strong>" + escapeHtml(t("account6.manageT")) + "</strong><span>" + escapeHtml(t("account6.manageX")) + "</span></li></ul>" +
      "<button class='btn btn-block btn-outline-green' type='submit' name='mode' value='signup' id='auth-signup-btn'>" + escapeHtml(t("auth2.createAccount")) + "</button>" +
      "<p class='fineprint'>" + escapeHtml(t("account2.privacyNote")) + "</p></div>" +
      "</div></form>";
    if (justConfirmed || linkError) setTimeout(() => { try { sessionStorage.removeItem("glx_just_confirmed"); sessionStorage.removeItem("glx_auth_link_error"); } catch (e) {} }, 1500);
    $("#forgot-btn").addEventListener("click", () => {
      const panel = $("#forgot-panel");
      const input = $("#forgot-email");
      if (input && !input.value.trim()) input.value = $("#a-email").value.trim();
      panel.hidden = !panel.hidden;
      if (!panel.hidden && input) input.focus();
    });
    $("#forgot-send").addEventListener("click", async () => {
      const status = $("#forgot-msg");
      const btn = $("#forgot-send");
      const email = $("#forgot-email").value.trim();
      if (!authValidEmail(email)) { status.textContent = t("auth2.errInvalidEmail"); return; }
      btn.disabled = true;
      status.textContent = t("auth2.sendingReset");
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT });
        if (error) throw error;
        status.textContent = t("auth2.resetSent");
      } catch (err) { status.textContent = authMapError(err); }
      btn.disabled = false;
    });
    $("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const mode = e.submitter && e.submitter.value === "signup" ? "signup" : "signin";
      const emailEl = $("#a-email"), passEl = $("#a-pass");
      const email = emailEl.value.trim(), pass = passEl.value;
      const msg = $("#auth-msg");
      const emailErr = $("#a-email-err"), passErr = $("#a-pass-err");
      /* Client-side validation BEFORE any network call, shown next to the field. */
      emailErr.textContent = ""; passErr.textContent = ""; msg.textContent = "";
      let valid = true;
      if (!authValidEmail(email)) { emailErr.textContent = t("auth2.errInvalidEmail"); valid = false; }
      if (pass.length < 6) { passErr.textContent = t("auth2.errWeakPassword"); valid = false; }
      if (!valid) { (emailErr.textContent ? emailEl : passEl).focus(); return; }
      /* Visible click response: disable both buttons, working label on the one used. */
      const signinBtn = $("#auth-signin-btn"), signupBtn = $("#auth-signup-btn");
      const signinLabel = signinBtn.textContent, signupLabel = signupBtn.textContent;
      const activeBtn = mode === "signup" ? signupBtn : signinBtn;
      signinBtn.disabled = true; signupBtn.disabled = true;
      activeBtn.textContent = mode === "signup" ? t("auth2.creating") : t("auth2.signingIn");
      msg.textContent = activeBtn.textContent;
      const restore = () => { signinBtn.disabled = false; signupBtn.disabled = false; signinBtn.textContent = signinLabel; signupBtn.textContent = signupLabel; };
      try {
        if (mode === "signup") {
          const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: AUTH_REDIRECT } });
          if (error) throw error;
          /* With email confirmation on, re-signing-up an existing address
             returns a user with an EMPTY identities array (no error). */
          if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            msg.textContent = "";
            emailErr.textContent = t("auth2.errDuplicate");
            restore();
            emailEl.focus();
            return;
          }
          if (data && data.session) {
            /* Confirmation not required for this account: signed in now. */
            server.user = data.session.user;
            restore();
            const dest = authTakeReturnTo();
            if (dest && dest !== "#/account") { location.hash = dest; return; }
            await renderAccount();
            return;
          }
          /* Signup success, confirmation pending: PROMINENT success panel,
             form hidden so the next step cannot be missed. */
          const panel = $("#auth-success-panel");
          if (panel) {
            panel.innerHTML = "<div role='status' style='border:2px solid #1e7d32;background:#eef7ee;color:#14301a;padding:1rem 1.2rem;margin:0 0 1.2rem;border-radius:6px'>" +
              "<h3 style='margin:0 0 0.4rem'>" + escapeHtml(t("auth2.successTitle")) + "</h3>" +
              "<p style='margin:0 0 0.4rem'>" + escapeHtml(t("auth2.successBody", { email })) + "</p>" +
              "<p style='margin:0' class='fineprint'>" + escapeHtml(t("auth2.successNote")) + "</p></div>";
            if (panel.scrollIntoView) panel.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          const form = $("#auth-form"); if (form) form.hidden = true;
          msg.textContent = "";
          restore();
          return;
        }
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        if (data && data.session) server.user = data.session.user;
        restore();
        /* Land visibly signed in: return to the gated destination if one was
           remembered, otherwise re-render the account dashboard. */
        const dest = authTakeReturnTo();
        if (dest && dest !== "#/account") { location.hash = dest; return; }
        await renderAccount();
      } catch (err) {
        restore();
        msg.textContent = authMapError(err);
      }
    });
    return;
  }

  const u = server.user;
  let profileName = "";
  try { const { data } = await sb.from("profiles").select("display_name").eq("id", u.id).single(); if (data) profileName = data.display_name || ""; } catch (e) {}
  const pledgeRows = server.myPledges.filter((p) => p.status === "pledged");
  const pledgeHtml = pledgeRows.length
    ? "<ul>" + pledgeRows.map((p) => { const f = filmById(p.film_id); const titleHtml = f ? '<a href="#/film/' + f.id + '">' + escapeHtml(f.title) + "</a>" : escapeHtml(p.film_id); return "<li>" + escapeHtml(t("account.pledgeLine", { amount: fmtCents(p.amount_cents), title: "\u0001" })).replace("\u0001", titleHtml) + ' <button type="button" class="btn btn-small btn-ghost" data-action="mypledge-cancel" data-pledge="' + p.id + '">' + escapeHtml(t("account.cancel")) + "</button></li>"; }).join("") + "</ul>"
    : "<p class='fineprint'>" + escapeHtml(t("dashboard.noPledges")) + "</p>";
  const subStatusKey = { submitted: "subStatus.submitted", pending: "subStatus.inReview", in_review: "subStatus.inReview", approved: "subStatus.approved", needs_changes: "subStatus.needsChanges", rejected: "subStatus.rejected" };
  let subsCount = null;
  let mySubsHtml = "<p class='fineprint'>" + escapeHtml(t("account.submissionsUnavailable")) + "</p>";
  try {
    const { data: subs, error: subsErr } = await sb.from("submissions").select("id, title, status").eq("user_id", u.id).order("created_at", { ascending: false });
    if (!subsErr && subs) {
      subsCount = subs.length;
      mySubsHtml = subs.length
        ? "<ul>" + subs.map((s) => "<li><strong>" + escapeHtml(s.title) + "</strong> — " + escapeHtml(subStatusKey[s.status] ? t(subStatusKey[s.status]) : s.status) + "</li>").join("") + "</ul>"
        : "<p class='fineprint'>No submissions yet — <a href='#/submit'>submit a film</a> and it will be tracked here.</p>";
    }
  } catch (e) {}
  await loadCommPrefs();
  const savedHtml = savedFilms.size ? filmLinks(Array.from(savedFilms)) : "<p class='fineprint'>" + escapeHtml(t("dashboard.noSavedFilms")) + "</p>";
  const recentHtml = recentFilms.length ?
    filmLinks(recentFilms) + "<p><button type='button' class='btn btn-small btn-ghost' data-action='clear-recent'>" + escapeHtml(t("dashboard.clearRecent")) + "</button></p>" :
    "<p class='fineprint'>" + escapeHtml(t("dashboard.nothingViewed")) + "</p>";
  const watchSavedHtml = watchSaved.size ?
    "<ul>" + Array.from(watchSaved).map((wid) => { const w = watchById(wid); return w ? '<li><a href="#/watch/' + w.id + '">' + escapeHtml(w.title) + "</a></li>" : ""; }).join("") + "</ul>" :
    "<p class='fineprint'>" + escapeHtml(t("dashboard.noWatchlist")) + "</p>";
  const prefsHtml = PREF_CATS.map((c) =>
    '<label class="pref-row"><input type="checkbox" data-pref="' + c.key + '"' + (commPrefs[c.key] ? " checked" : "") + "> " + escapeHtml(t(c.labelKey)) + "</label>").join("") +
    '<p class="fineprint">' + escapeHtml(prefsRemote ? t("dashboard.prefsSavedAccount") : t("dashboard.prefsSavedDevice")) + "</p>";
  const statCard = (label, n) => '<div class="stat-card"><span class="stat-num">' + n + '</span><span class="stat-label">' + escapeHtml(label) + "</span></div>";
  const dashNavItems = [
    ["dash-membership", t("dashboard.membershipHeading")],
    ["dash-profile", t("dash2.profile")],
    ["dash-pledges", t("dashboard.myPledgeInterest", { count: pledgeRows.length })],
    ["dash-submissions", t("account.mySubmissions")],
    ["dash-follows", t("account.projectsFollow", { count: state.follows.size })],
    ["dash-saved", t("dashboard.savedFilms", { count: savedFilms.size })],
    ["dash-watchlist", t("dashboard.watchlist", { count: watchSaved.size })],
    ["dash-recent", t("dashboard.recentlyViewed")],
    ["dash-prefs", t("dashboard.prefsHeading")],
    ["dash-security", t("dash2.security")]
  ];
  el.innerHTML = authBanners +
    '<div class="dash"><aside class="dash-nav" aria-label="' + escapeHtml(t("dash2.overview")) + '"><p class="dash-nav-user">' + escapeHtml(u.email || "") + "</p>" +
    dashNavItems.map(([id, label]) => '<a href="#/account" data-scroll="' + id + '">' + escapeHtml(label) + "</a>").join("") + "</aside>" +
    '<div class="dash-main">' +
    "<p>" + escapeHtml(t("account.signedInAs", { email: u.email || "" })).replace(escapeHtml(u.email || ""), "<strong>" + escapeHtml(u.email || "") + "</strong>") + "</p>" +
    '<div class="dash-stats">' +
    statCard(t("dash2.statFollows"), state.follows.size) +
    statCard(t("dash2.statPledges"), pledgeRows.length) +
    statCard(t("dash2.statSaved"), savedFilms.size) +
    statCard(t("dash2.statWatchlist"), watchSaved.size) +
    statCard(t("dash2.statSubmissions"), subsCount === null ? "\u2014" : subsCount) +
    "</div>" +
    '<section class="dash-panel" id="dash-membership"><h3>' + escapeHtml(t("dashboard.membershipHeading")) + "</h3>" +
    "<p><strong>Free member</strong> \u2014 free membership is live. The founding membership campaign is planned \u2014 not yet open; no paid membership can be bought today. See <a href='#/membership'>Membership</a>.</p></section>" +
    '<section class="dash-panel" id="dash-profile"><h3>' + escapeHtml(t("dash2.profile")) + "</h3>" +
    "<form id='profile-form' novalidate><div class='field'><label for='a-name'>" + escapeHtml(t("account.displayNameLabel")) + "</label><input id='a-name' value='" + escapeHtml(profileName) + "'></div>" +
    "<button class='btn' type='submit'>" + escapeHtml(t("account.saveNameButton")) + "</button> <span class='form-msg' id='profile-msg' role='status'></span></form></section>" +
    '<section class="dash-panel" id="dash-pledges"><h3>' + escapeHtml(t("dashboard.myPledgeInterest", { count: pledgeRows.length })) + "</h3>" + pledgeHtml + "</section>" +
    '<section class="dash-panel" id="dash-submissions"><h3>' + escapeHtml(t("account.mySubmissions")) + "</h3>" + mySubsHtml + "</section>" +
    '<section class="dash-panel" id="dash-follows"><h3>' + escapeHtml(t("account.projectsFollow", { count: state.follows.size })) + "</h3>" + filmLinks(Array.from(state.follows)) + "</section>" +
    '<section class="dash-panel" id="dash-saved"><h3>' + escapeHtml(t("dashboard.savedFilms", { count: savedFilms.size })) + "</h3>" + savedHtml + "</section>" +
    '<section class="dash-panel" id="dash-watchlist"><h3>' + escapeHtml(t("dashboard.watchlist", { count: watchSaved.size })) + "</h3>" + watchSavedHtml + "</section>" +
    '<section class="dash-panel" id="dash-recent"><h3>' + escapeHtml(t("dashboard.recentlyViewed")) + "</h3>" + recentHtml + "</section>" +
    '<section class="dash-panel" id="dash-prefs"><h3>' + escapeHtml(t("dashboard.prefsHeading")) + "</h3>" + prefsHtml + "</section>" +
    "<div id='admin-section'></div>" +
    '<section class="dash-panel" id="dash-security"><h3>' + escapeHtml(t("dash2.security")) + "</h3>" +
    "<p><button type='button' class='btn' id='signout-btn'>" + escapeHtml(t("account.signOutButton")) + "</button> " +
    "<button type='button' class='btn btn-ghost' id='deletedata-btn'>" + escapeHtml(t("dashboard.deleteDataButton")) + "</button></p>" +
    "<p class='form-msg' id='account-msg' role='status'></p>" +
    "<p class='fineprint'>Deleting removes your follows, recorded pledge interest and display name from GreenlitX immediately. To remove the login itself, email us at <a href='mailto:team@greenlitx.com'>team@greenlitx.com</a> and we will delete the account completely.</p></section>" +
    "</div></div>";
  if (justConfirmed || linkError) setTimeout(() => { try { sessionStorage.removeItem("glx_just_confirmed"); sessionStorage.removeItem("glx_auth_link_error"); } catch (e) {} }, 1500);
  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#a-name").value.trim();
    const { error } = await sb.from("profiles").upsert({ id: u.id, display_name: name || null });
    $("#profile-msg").textContent = error ? t("account.couldNotSave", { error: error.message }) : t("account.saved");
  });
  $("#signout-btn").addEventListener("click", async () => { await sb.auth.signOut(); });
  $$("[data-pref]").forEach((cb) => cb.addEventListener("change", () => { saveCommPref(cb.dataset.pref, cb.checked); }));
  loadAdminSection();
  $("#deletedata-btn").addEventListener("click", async () => {
    /* Retired: the votes table is no longer touched by the client (header note). */
    await sb.from("follows").delete().eq("user_id", u.id);
    await sb.from("pledges").delete().eq("user_id", u.id);
    await sb.from("profiles").delete().eq("id", u.id);
    await sb.auth.signOut();
    $("#account-msg").textContent = t("account.deletedMessage");
  });
}

/* ---------- membership & about (Wave B, Stage 2a) ---------- */
function renderMembership() {
  const el = $("#membership-body"); if (!el) return;
  const tt = (k, vars) => escapeHtml(t(k, vars));
  /* Round 6 (Oct 30): membership page rebuilt to the owner's approved
     mockup + brief. Five tiers in the approved order with the approved
     one-time prices/durations. Producer is removed entirely. Paid tiers
     cannot be bought today (no checkout exists): their action is a
     truthful Register Interest route to the free account, with the
     payment-status microcopy the brief requires. Paid-tier benefit
     lists were added in round 6b (Oct 30) from the owner's confirmed
     October 1 proposal — cumulative stacks (member6.tierNPlus /
     member6.tierNBenM keys; see REPORT6, round 6b section). */
  const benefitIcon = (path) => '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + path + "</svg>";
  const heroBen = (n, icon) =>
    '<div class="trust-item"><span class="member-ben-icon" aria-hidden="true">' + benefitIcon(icon) + '</span><div><p>' + tt("member6.ben" + n) + "</p></div></div>";
  const paidBenCounts = { 1: 2, 2: 2, 3: 3, 4: 1 };
  const paidCard = (n, icon, emphasis) => {
    const amount = t("membership2.tier" + n + "Amount");
    const durKey = "member6.dur" + n;
    return '<div class="tier-card r6-tier' + (emphasis ? " r6-tier-emphasis" : "") + '">' +
      '<p class="tier-icon" aria-hidden="true">' + benefitIcon(icon) + "</p>" +
      "<h3>" + tt("membership2.tier" + n + "Name") + "</h3>" +
      '<p class="tier-price">' + tt("membership2.tier" + n + "Amount") + "</p>" +
      '<p class="tier-terms">' + tt("member6.oneTime") + " · " + tt(durKey) + "</p>" +
      (n === 4 ? '<p class="tier-cap">' + tt("member6.proposedLimit") + "</p>" : "") +
      "<p>" + tt("member6.tier" + n + "Plus") + "</p>" +
      '<ul class="check-list">' + Array.from({ length: paidBenCounts[n] }, (_, i) => "<li>" + tt("member6.tier" + n + "Ben" + (i + 1)) + "</li>").join("") + "</ul>" +
      '<p><a class="btn btn-primary" href="#/account">' + tt("member6.registerInterest") + "</a></p>" +
      '<p class="tier-micro">' + tt("member6.registerMicro", { amount: amount, duration: t(durKey) }) + "</p></div>";
  };
  const faqItem = (q, a) =>
    '<details class="detail-details faq-item"><summary>' + tt(q) + "</summary><p>" + tt(a) + "</p></details>";
  el.innerHTML =
    '<div class="member-hero r6-hero">' +
    '<img class="member-hero-bg" src="backdrops/the-great-escape-club.webp" alt="" aria-hidden="true">' +
    '<div class="member-hero-shade"></div><div class="member-hero-content">' +
    '<p class="eyebrow">' + tt("nav.membership") + "</p>" +
    "<h2 tabindex='-1'>" + tt("member6.heroTitle") + "</h2>" +
    '<p class="member-hero-sub">' + tt("member6.heroSub") + "</p>" +
    '<div class="trust-row member-benefits">' +
    heroBen(1, '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/>') +
    heroBen(2, '<path d="M12 20.5C7 16.5 3.5 13.2 3.5 9.3 3.5 6.4 5.7 4.5 8.2 4.5c1.5 0 3 .8 3.8 2 .8-1.2 2.3-2 3.8-2 2.5 0 4.7 1.9 4.7 4.8 0 3.9-3.5 7.2-8.5 11.2z"/>') +
    heroBen(3, '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S13.9 16 14.5 19"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.3.2 3.9 1.6 4.4 4"/>') +
    heroBen(4, '<path d="M4 19V6l8-2.5L20 6v13l-8-2.5z"/><path d="M12 3.5V16.5"/>') +
    "</div></div></div>" +
    '<h3 class="tick-title">' + tt("member6.plansHeading") + "</h3>" +
    "<p>" + tt("member6.plansSub") + "</p>" +
    '<div class="membership-cards r6-tiers">' +
    '<div class="tier-card tier-free r6-tier"><div class="member-free-head"><h3>' + tt("membership3.freeName") + '</h3>' +
    '<p class="tier-badge tier-live">' + tt("membership3.availableNow") + "</p></div>" +
    '<p class="tier-price">$0</p>' +
    '<p class="tier-terms">' + tt("member6.durFree") + "</p>" +
    "<p>" + tt("membership2.freeIntro") + "</p>" +
    '<ul class="check-list">' + [1, 2, 3, 4, 5].map((i) => "<li>" + tt("membership2.freeItem" + i) + "</li>").join("") + "</ul>" +
    "<p>" + tt("membership2.freeCost") + "</p>" +
    '<p><a class="btn btn-primary" href="#/account">' + tt("membership3.joinFree") + "</a></p></div>" +
    paidCard(1, '<path d="M12 20.5C7 16.5 3.5 13.2 3.5 9.3 3.5 6.4 5.7 4.5 8.2 4.5c1.5 0 3 .8 3.8 2 .8-1.2 2.3-2 3.8-2 2.5 0 4.7 1.9 4.7 4.8 0 3.9-3.5 7.2-8.5 11.2z"/>', false) +
    paidCard(2, '<path d="M12 3.5l2.5 5.6 6 .7-4.4 4.1 1.2 5.9L12 17l-5.3 2.8 1.2-5.9L3.5 9.8l6-.7z"/>', true) +
    paidCard(3, '<path d="M4 18V8l4 3 4-6 4 6 4-3v10z"/><path d="M4 21h16"/>', false) +
    paidCard(4, '<path d="M7 3.5h10L21 9l-9 11.5L3 9z"/><path d="M3 9h18M9.5 9L12 20.5 14.5 9 12 3.5"/>', false) +
    "</div>" +
    '<p class="member-status-note">' + tt("member6.statusLine") + ' <a href="#/legal/membership-terms">' + tt("footer6.membershipTerms") + "</a></p>" +
    '<div class="community-banner"><div class="community-banner-text"><h3>' + tt("member6.bannerTitle") + "</h3><p>" + tt("member6.bannerText") + '</p></div>' +
    '<p class="community-banner-brand">Real stories.<br>Real people.<br><span class="accent">GreenlitX.</span></p></div>' +
    '<h3 class="tick-title">' + tt("member6.faqHeading") + "</h3>" +
    '<div class="faq-list">' +
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => faqItem("member6.faq" + n + "Q", "member6.faq" + n + "A")).join("") +
    "</div>";
}
function renderAbout() {
  const el = $("#about-body"); if (!el) return;
  const tt = (k, vars) => escapeHtml(t(k, vars));
  /* Round 6 (Oct 30): About rebuilt to the owner's approved mockup +
     brief section order. Copy is the brief's approved text (about6.*)
     or the page's existing published text; the membership strip states
     the approved five-tier model with the honesty line that paid
     checkout is not yet operational. */
  const partImgs = ["letters-from-the-sun", "the-second-moon", "dead-freight", "the-last-picture-house"];
  const partCard = (n) =>
    '<div class="step-card part-card"><img class="part-card-img" src="backdrops/' + partImgs[n - 1] + '.webp" width="1600" height="900" loading="lazy" alt="">' +
    '<span class="part-num" aria-hidden="true">0' + n + '</span><h4>' + tt("about6.part" + n + "T") + "</h4><p>" + tt("about6.part" + n + "X") + "</p></div>";
  const tierLine = (nameKey, amountKey, durText) =>
    '<li><strong>' + tt(nameKey) + '</strong> — ' + tt(amountKey) + " · " + durText + "</li>";
  el.innerHTML =
    '<div class="page-hero about-hero">' +
    '<img class="page-hero-bg" src="backdrops/the-keeper-of-forgotten-things.webp" alt="" aria-hidden="true">' +
    '<div class="page-hero-shade"></div><div class="page-hero-content">' +
    '<p class="eyebrow">' + tt("about6.eyebrow") + "</p>" +
    "<h2 tabindex='-1' class='about-hero-title'>" + tt("hero.titleStart") + ' <span class="accent">' + tt("hero.titleAccent") + "</span></h2>" +
    "<p>" + tt("about6.heroSupport") + "</p>" +
    '<p class="page-hero-actions"><a class="btn btn-primary" href="#/discover">' + tt("nav.discover") + '</a> ' +
    '<button type="button" class="btn btn-ghost" data-scroll="about-participate">' + tt("about6.howItWorks") + "</button></p>" +
    "</div></div>" +
    '<div class="about-grid">' +
    '<div class="about-panel"><h3 class="tick-title">' + tt("about2.missionHeading") + "</h3><p>" + tt("about6.missionX") + "</p></div>" +
    '<div class="about-panel"><h3 class="tick-title">' + tt("about2.whyHeading") + "</h3><p>" + tt("about6.whyX") + "</p></div>" +
    "</div>" +
    '<div class="about-steps" id="about-participate"><h3 class="tick-title">' + tt("about6.participateHeading") + "</h3>" +
    "<p>" + tt("about6.participateSub") + "</p>" +
    '<div class="steps-grid part-grid">' + [1, 2, 3, 4].map(partCard).join("") + "</div></div>" +
    '<div class="about-grid">' +
    '<div class="about-panel"><h3 class="tick-title">' + tt("about6.fmHeading") + "</h3><p>" + tt("about6.fmX") + '</p><p><a class="btn btn-primary" href="#/submit">' + tt("nav.submitFilm") + "</a></p></div>" +
    '<div class="about-panel"><h3 class="tick-title">' + tt("about6.proHeading") + "</h3><p>" + tt("about6.proX") + '</p><p><a class="btn btn-primary" href="#/professionals">' + tt("nav.professionals") + "</a></p></div>" +
    "</div>" +
    '<div class="compare-panels">' +
    '<div class="compare-panel compare-trad"><h3>' + tt("about6.tradT") + '</h3><ul class="x-list">' + [1, 2, 3, 4].map((n) => "<li>" + tt("about6.trad" + n) + "</li>").join("") + "</ul></div>" +
    '<div class="compare-panel compare-glx"><h3>' + tt("about6.glxT") + '</h3><ul class="check-list">' + [1, 2, 3, 4].map((n) => "<li>" + tt("about6.glx" + n) + "</li>").join("") + "</ul></div>" +
    "</div>" +
    '<div class="community-banner about-banner"><div class="community-banner-text"><h3>' + tt("about6.moreTitle") + "</h3><p>" + tt("about6.moreX") + '</p></div>' +
    '<p class="community-banner-brand">Real stories.<br>Real people.<br><span class="accent">GreenlitX.</span></p></div>' +
    '<div class="info-panel about-transparency"><h3 class="tick-title">' + tt("about6.transpT") + '</h3><ul class="plain-list">' +
    [1, 2, 3, 4, 5, 6].map((n) => "<li>" + tt("about6.transp" + n) + "</li>").join("") + "</ul>" +
    '<p><a href="#/legal/pledge-funding-terms">' + tt("footer6.pledgeTerms") + '</a> · <a href="#/legal/membership-terms">' + tt("footer6.membershipTerms") + '</a> · <a href="#/legal/submission-agreement">' + tt("footer6.submissionAgreement") + "</a></p></div>" +
    '<div class="about-panel about-membership"><h3 class="tick-title">' + tt("about6.memberT") + "</h3><p>" + tt("about6.memberX") + "</p>" +
    '<ul class="tier-strip">' +
    tierLine("membership3.freeName", "member6.priceFree", tt("member6.durFree")) +
    tierLine("membership2.tier1Name", "membership2.tier1Amount", tt("member6.dur1")) +
    tierLine("membership2.tier2Name", "membership2.tier2Amount", tt("member6.dur2")) +
    tierLine("membership2.tier3Name", "membership2.tier3Amount", tt("member6.dur3")) +
    tierLine("membership2.tier4Name", "membership2.tier4Amount", tt("member6.dur4") + " · " + tt("member6.proposedLimit")) +
    "</ul>" +
    "<p>" + tt("about6.memberNote") + '</p><p><a class="btn" href="#/membership">' + tt("nav.membership") + "</a></p></div>";
}
/* Admin review surface (Stage 2c): rendered ONLY when is_admin() is true for
   the signed-in user. The allowlist (public.admin_users) is empty until the
   owner adds himself in the Supabase dashboard — RLS enforces everything. */
async function loadAdminSection() {
  const host = $("#admin-section"); if (!host || !sb || !server.user) return;
  let isAdmin = false;
  try { const { data, error } = await sb.rpc("is_admin"); if (!error) isAdmin = data === true; } catch (e) {}
  if (!isAdmin) { host.innerHTML = ""; return; }
  let subs = [], pros = [];
  try { const r = await sb.from("submissions").select("id, title, status, contact_name, contact_email, created_at").in("status", ["pending", "submitted", "in_review"]).order("created_at", { ascending: true }); if (r.data) subs = r.data; } catch (e) {}
  try { const r = await sb.from("pro_interest").select("id, name, email, role_category, created_at").order("created_at", { ascending: true }); if (r.data) pros = r.data; } catch (e) {}
  host.innerHTML = "<h3 style='margin-top:1.6rem'>" + escapeHtml(t("admin.heading")) + "</h3>" +
    "<h4>" + escapeHtml(t("admin.pendingSubmissions", { count: subs.length })) + "</h4>" +
    (subs.length ? "<ul>" + subs.map((s) => "<li><strong>" + escapeHtml(s.title) + "</strong> — " + escapeHtml(s.contact_name || "") + " · " + escapeHtml(s.contact_email || "") +
      ' <button type="button" class="btn btn-small" data-action="admin-approve" data-id="' + s.id + '">' + escapeHtml(t("admin.approve")) + '</button> <button type="button" class="btn btn-small btn-ghost" data-action="admin-needs" data-id="' + s.id + '">' + escapeHtml(t("admin.needsChanges")) + "</button></li>").join("") + "</ul>" : "<p class='fineprint'>" + escapeHtml(t("admin.noPending")) + "</p>") +
    "<h4>" + escapeHtml(t("admin.proInterest", { count: pros.length })) + "</h4>" +
    (pros.length ? "<ul>" + pros.map((pr) => "<li><strong>" + escapeHtml(pr.name || "") + "</strong> — " + escapeHtml(pr.role_category || "") + " · " + escapeHtml(pr.email || "") + "</li>").join("") + "</ul>" : "<p class='fineprint'>" + escapeHtml(t("admin.noProRecords")) + "</p>") +
    "<p class='fineprint'>" + escapeHtml(t("admin.note")) + "</p>";
}

/* ---------- legal & trust center ---------- */
const LEGAL_DOCS = window.GLX_LEGAL || [];
const legalBySlug = (slug) => LEGAL_DOCS.find((d) => d.slug === slug);
function legalDocHtml(doc, backLabel) {
  return '<div class="section legal-doc">' +
    '<p class="watch-back"><a href="#/legal">&larr; ' + (backLabel || "Legal &amp; Trust Center") + '</a></p>' +
    doc.html + "</div>";
}
const LEGAL_DOC_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 2.5h8L19 7.5v14H6z"/><path d="M13.5 2.5v5.5H19"/><path d="M9 12.5h6M9 16h6"/></svg>';
function legalCardHtml(href, title) {
  return '<a class="legal-card" href="' + href + '"><span class="legal-card-icon" aria-hidden="true">' + LEGAL_DOC_SVG + '</span>' +
    '<span class="legal-card-title">' + escapeHtml(title) + '</span><span class="legal-card-arrow" aria-hidden="true">\u203A</span></a>';
}
/* Round 6 (Oct 30): Legal & Trust Center — directory of exactly the
   nine policy documents (icons + one-line descriptions from each
   document's own introduction), the "Your rights matter" panel and the
   closing banner. Funding Transparency is not a card (its page stays at
   #/funding, footer-linked). Document substance is untouched except the
   scoped membership-consistency edits recorded in REPORT6. */
const LEGAL_CENTER_SLUGS = ["terms", "privacy", "membership-terms", "pledge-funding-terms", "submission-agreement", "copyright-dmca", "community-guidelines", "cookie-policy", "accessibility"];
const LEGAL_CENTER_ICONS = {
  "terms": '<path d="M6 2.5h8L19 7.5v14H6z"/><path d="M13.5 2.5v5.5H19"/><path d="M9 12.5h6M9 16h6"/>',
  "privacy": '<path d="M12 3l7 2.5v5.5c0 4.6-3 7.6-7 9.5-4-1.9-7-4.9-7-9.5V5.5z"/><path d="M9 11.5l2.2 2.2L15.5 9.5"/>',
  "membership-terms": '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-4.8 5.5-4.8s4.9 1.6 5.5 4.8"/><path d="M16 5.5h5M16 10h5M16 14.5h5"/>',
  "pledge-funding-terms": '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  "submission-agreement": '<path d="M12 19V5.5"/><path d="M6.5 11L12 5l5.5 6"/><path d="M5 19.5h14"/>',
  "copyright-dmca": '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 9.5A4.8 4.8 0 1 0 15.5 14.5"/>',
  "community-guidelines": '<circle cx="8.5" cy="9" r="3"/><path d="M3 19.5c.5-3 2.7-4.6 5.5-4.6s5 1.6 5.5 4.6"/><circle cx="16.8" cy="10" r="2.4"/><path d="M16.2 14.9c2.2.2 3.9 1.6 4.4 4"/>',
  "cookie-policy": '<circle cx="12" cy="12" r="8.5"/><circle cx="9.5" cy="10" r="0.6" fill="currentColor"/><circle cx="13.5" cy="8.8" r="0.6" fill="currentColor"/><circle cx="10.8" cy="14.2" r="0.6" fill="currentColor"/><circle cx="14.8" cy="13" r="0.6" fill="currentColor"/>',
  "accessibility": '<circle cx="12" cy="5" r="1.8"/><path d="M4.5 9.5c5 1 10 1 15 0"/><path d="M12 10.5v4l3 5.5M12 14.5l-3 5.5"/>'
};
function legalCenterCardHtml(doc) {
  const icon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (LEGAL_CENTER_ICONS[doc.slug] || LEGAL_CENTER_ICONS["terms"]) + "</svg>";
  return '<a class="legal-card legal-card2" href="#/legal/' + doc.slug + '"><span class="legal-card-icon" aria-hidden="true">' + icon + '</span>' +
    '<span class="legal-card-body"><span class="legal-card-title">' + escapeHtml(doc.title) + '</span>' +
    '<span class="legal-card-desc">' + escapeHtml(t("legal6.desc." + doc.slug)) + '</span></span>' +
    '<span class="legal-card-arrow" aria-hidden="true">\u203A</span></a>';
}
function renderLegalIndex() {
  const el = $("#legal-index");
  if (!el) return;
  const docs = LEGAL_CENTER_SLUGS.map(legalBySlug).filter(Boolean);
  el.innerHTML =
    '<h3 class="tick-title">' + escapeHtml(t("legal6.docsHeading")) + '</h3>' +
    '<div class="legal-grid legal-grid2">' + docs.map(legalCenterCardHtml).join("") + "</div>" +
    '<div class="info-panel rights-panel"><h3>' + escapeHtml(t("legal6.rightsTitle")) + '</h3><ul class="plain-list">' +
    [1, 2, 3, 4, 5].map((n) => "<li>" + escapeHtml(t("legal6.rights" + n)) + "</li>").join("") + "</ul></div>" +
    '<div class="community-banner legal-banner"><div class="community-banner-text"><h3>' + escapeHtml(t("legal6.banner")) + '</h3>' +
    '<p class="footer-slogan2"><span>' + escapeHtml(t("hero.titleStart")) + '</span> <span class="accent">' + escapeHtml(t("hero.titleAccent")) + "</span></p></div>" +
    '<p class="community-banner-brand">Real stories.<br>Real people.<br><span class="accent">GreenlitX.</span></p></div>' +
    '<p class="fineprint">' + escapeHtml(t("legal.documentsInEnglish")) + " " + escapeHtml(t("legal.draftNotice")) + "</p>";
}
function renderLegalDoc(slug) {
  const el = $("#legal-doc");
  if (!el) return;
  const doc = legalBySlug(slug);
  if (!doc) { el.innerHTML = '<div class="section"><h2 tabindex="-1">' + escapeHtml(t("legal.notFoundTitle")) + '</h2><p><a href="#/legal">' + escapeHtml(t("legal.backToCenter")) + "</a>.</p></div>"; return; }
  el.innerHTML = legalDocHtml(doc, escapeHtml(t("legal.backToCenter")));
}
function renderFunding() {
  const el = $("#funding-body");
  if (!el) return;
  const doc = legalBySlug("funding-transparency");
  if (!doc) { el.innerHTML = '<div class="section"><h2 tabindex="-1">Funding Transparency</h2><p>This page is unavailable right now.</p></div>'; return; }
  const tt = (k) => escapeHtml(t(k));
  /* The five distinctions of SS13, stated with the document's own facts:
     pledge interest vs money actually raised vs project status vs
     membership vs payment availability. No figures beyond the published
     $0-collected statement are shown. */
  const glance = [
    ["funding2.g1T", "funding2.g1X"],
    ["funding2.g2T", "funding.collectedValue"],
    ["funding2.g3T", "funding2.g3X"],
    ["funding2.g4T", "funding2.g4X"],
    ["funding2.g5T", "funding2.g5X"]
  ].map(([tk, xk]) => '<div class="glance-card"><h3>' + tt(tk) + "</h3><p>" + tt(xk) + "</p></div>").join("");
  el.innerHTML =
    '<div class="section funding-glance"><h2 tabindex="-1">' + tt("legal.fundingTitle") + '</h2>' +
    '<h3 class="tick-title">' + tt("funding2.glanceHeading") + '</h3><div class="glance-grid">' + glance + "</div></div>" +
    legalDocHtml(doc);
}
/* ---------- professionals & submissions ---------- */
const PRO_CATEGORIES = ["Actors", "Directors", "Producers", "Screenwriters", "Cinematographers", "Editors", "Composers", "Animators", "AI Filmmakers", "Production Designers"];
const PRO_CAT_KEYS = ["pro.cat.actors", "pro.cat.directors", "pro.cat.producers", "pro.cat.screenwriters", "pro.cat.cinematographers", "pro.cat.editors", "pro.cat.composers", "pro.cat.animators", "pro.cat.aiFilmmakers", "pro.cat.productionDesigners"];
const PRO_ICON_PATHS = [
  '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c.8-3.4 3.6-5 7-5s6.2 1.6 7 5"/>',
  '<path d="M3 10.5h18V20H3z"/><path d="M3.8 10.5L5.5 4.8l15.2 2.8-.8 3.4M8 5.5l1.5 4.3M13 6.2l1.5 4.3M18 7l1.4 4"/>',
  '<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z"/>',
  '<rect x="3" y="7" width="12" height="11" rx="2"/><path d="M15 10.5l6-3v10l-6-3"/>',
  '<circle cx="6" cy="7" r="2.4"/><circle cx="6" cy="17" r="2.4"/><path d="M8 8.8L20 17M8 15.2L20 7"/>',
  '<path d="M9 18.5V6l10-2v11.5"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/>',
  '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/>',
  '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3.6 12.6L12 17l8.4-4.4M3.6 16.6L12 21l8.4-4.4"/>'
];
const proIconSvg = (i) => '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + PRO_ICON_PATHS[i % PRO_ICON_PATHS.length] + "</svg>";
function rolesHtml() {
  return '<div class="roles-box"><h3>' + escapeHtml(t("roles.heading")) + "</h3><ul>" +
    ["roles.audience", "roles.filmmakers", "roles.professionals", "roles.supporters"].map((k) => "<li>" + escapeHtml(t(k)) + "</li>").join("") + "</ul></div>";
}
function fillRoles(id) { const el = document.getElementById(id); if (el) el.innerHTML = rolesHtml(); }
/* Round 6: discipline tiles carry existing catalog artwork (backdrops),
   one per category; the tile button keeps the existing data-action="pro"
   behaviour (sets the form's role select, scrolls to the form). */
const PRO_TILE_ART = ["the-woman-in-apartment-9", "the-last-picture-house", "the-retirement-job", "letters-from-the-sun", "the-last-train-below", "the-devils-frequency", "the-night-orchestra", "the-keeper-of-forgotten-things", "before-the-city-wakes", "dead-freight"];
function renderPros() {
  $("#pro-grid").innerHTML = PRO_CATEGORIES.map((c, i) =>
    '<div class="pro-card pro-tile"><img class="pro-tile-img" src="backdrops/' + PRO_TILE_ART[i % PRO_TILE_ART.length] + '.webp" width="1600" height="900" loading="lazy" alt="">' +
    '<div class="pro-tile-body"><span class="pro-icon" aria-hidden="true">' + proIconSvg(i) + '</span><span class="pro-card-name">' + escapeHtml(t(PRO_CAT_KEYS[i])) + '</span>' +
    '<button type="button" class="btn btn-small" data-action="pro" data-cat="' + escapeHtml(c) + '">' + escapeHtml(t("pro.registerButton")) + '</button></div></div>').join("");
  const sel = $("#p-role");
  if (sel && !sel.options.length) {
    sel.innerHTML = '<option value="">' + escapeHtml(t("pro.choose")) + '</option>' + PRO_CATEGORIES.map((c, i) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(t(PRO_CAT_KEYS[i])) + "</option>").join("");
  }
}
/* Submission form draft: kept on this device ONLY while typing, so a closed
   tab doesn't lose work. A draft is never a submission — the form is only
   "received" once the insert into Supabase succeeds and returns a reference. */
const SUBMIT_FIELDS = ["#f-title", "#f-genre", "#f-logline", "#f-synopsis", "#f-type", "#f-status", "#f-name", "#f-rights", "#f-target", "#f-video", "#f-email"];
function saveSubmitDraft() {
  const d = {};
  SUBMIT_FIELDS.forEach((sel) => { const el = $(sel); if (el) d[sel] = el.value; });
  save("glx2_submit_draft", d);
}
function restoreSubmitDraft() {
  const d = load("glx2_submit_draft", null);
  if (!d) return;
  SUBMIT_FIELDS.forEach((sel) => { const el = $(sel); if (el && d[sel] != null && !el.value) el.value = d[sel]; });
}

/* ---------- metadata + static i18n (Wave B, final pass) ---------- */
function setMeta(name, content, prop) {
  const sel = prop ? 'meta[property="' + name + '"]' : 'meta[name="' + name + '"]';
  let el = document.querySelector(sel);
  if (!el) { el = document.createElement("meta"); if (prop) el.setAttribute("property", name); else el.setAttribute("name", name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
function updateMeta(r) {
  let title = t("site.title"), desc = t("site.description"), img = "logo.webp";
  if (r.view === "discover") { title = t("discover.heading") + " — GreenlitX"; }
  if (r.view === "watch") { title = t("watch.heading") + " — GreenlitX"; }
  if (r.view === "membership") { title = t("meta.membershipTitle"); }
  if (r.view === "about") { title = t("meta.aboutTitle"); }
  if (r.view === "account") { title = t("account.heading") + " — GreenlitX"; }
  if (r.view === "film") {
    const f = filmById(r.id);
    if (f) { title = t("meta.filmTitle", { title: f.title }); desc = filmText(f, "logline"); img = "posters/" + f.id + ".webp"; }
  }
  if (r.view === "watchdetail") {
    const w = watchById(r.id);
    if (w) { title = t("meta.watchDetailTitle", { title: w.title }); desc = w.synopsis || desc; }
  }
  document.title = title;
  setMeta("description", desc); setMeta("og:title", title, true); setMeta("og:description", desc, true); setMeta("og:image", img, true); setMeta("og:type", "website", true);
}
function applyStaticI18n() {
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  syncLangControl(); closeLangMenu(); syncFooterLangs();
  const acc = document.querySelector('[data-nav="account"]');
  if (acc && !server.user) acc.textContent = t("nav.account");
  const srch = $("#search"); if (srch) { srch.placeholder = t("discover.searchPlaceholder"); srch.setAttribute("aria-label", t("discover.searchLabel")); }
  const ws = $("#watch-search"); if (ws) { ws.placeholder = t("watch.searchPlaceholder"); ws.setAttribute("aria-label", t("watch.searchLabel")); }
}

/* ---------- routing ---------- */
const VIEWS = ["home", "discover", "film", "watch", "watchdetail", "professionals", "submit", "account", "legal", "legaldoc", "funding", "membership", "about"];
function parseRoute() {
  const rawHash = location.hash || "";
  /* Final2 P1: Supabase email links return with auth fragments
     (#access_token=...&type=signup, #error=...&error_code=otp_expired) instead
     of an app route. Route those to the account view - never let them fall
     through to the home fallback or be parsed as a film/watch slug. */
  if (/[#&](access_token|refresh_token|error|error_code)=/.test(rawHash) || /[#&]type=(signup|recovery|magiclink|invite|email)=/.test(rawHash)) {
    return { view: "account" };
  }
  const h = rawHash.replace(/^#\//, "");
  const parts = h.split("/");
  if (parts[0] === "film" && parts[1]) return { view: "film", id: parts[1] };
  if (parts[0] === "watch" && parts[1]) return { view: "watchdetail", id: parts[1] };
  if (parts[0] === "legal" && parts[1]) return { view: "legaldoc", id: parts[1] };
  if (parts[0] === "funding") return { view: "funding" };
  return { view: VIEWS.includes(parts[0]) ? parts[0] : "home" };
}
function render() {
  applyStaticI18n();
  const r = parseRoute();
  if (r.view !== "home" && showcaseTimer) { clearInterval(showcaseTimer); showcaseTimer = null; }
  VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== r.view; });
  const navView = r.view === "watchdetail" ? "watch" : r.view === "film" ? "discover" : (r.view === "legaldoc" || r.view === "funding") ? "legal" : r.view;
  $$(".main-nav a").forEach((a) => {
    const on = a.dataset.nav === navView;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  $("#main-nav").classList.remove("open");
  const navTgl = $("#nav-toggle");
  navTgl.setAttribute("aria-expanded", "false");
  navTgl.setAttribute("aria-label", t("nav.openMenu"));
  if (r.view === "home") renderHome();
  if (r.view === "discover") renderDiscover();
  if (r.view === "film") renderFilmDetail(r.id);
  if (r.view === "watch") renderWatch();
  if (r.view === "watchdetail") renderWatchDetail(r.id);
  if (r.view === "professionals") renderPros();
  if (r.view === "submit") { restoreSubmitDraft(); fillRoles("roles-submit"); }
  if (r.view === "account") renderAccount();
  if (r.view === "legal") renderLegalIndex();
  if (r.view === "legaldoc") renderLegalDoc(r.id);
  if (r.view === "funding") renderFunding();
  if (r.view === "membership") renderMembership();
  if (r.view === "about") renderAbout();
  updateMeta(r);
  window.scrollTo(0, 0);
  const focusEl = $("#view-" + r.view + " h1, #view-" + r.view + " h2");
  if (focusEl) focusEl.focus({ preventScroll: true });
}
function refreshDynamic() { const r = parseRoute(); if (r.view === "film") renderFilmDetail(r.id); else render(); }

document.addEventListener("click", (e) => {
  if (!e.target.closest("#lang-menu")) closeLangMenu();
  const navBtn = e.target.closest("#nav-toggle");
  if (navBtn) {
    const nav = $("#main-nav"); const open = nav.classList.toggle("open");
    navBtn.setAttribute("aria-expanded", String(open));
    navBtn.setAttribute("aria-label", open ? t("nav.closeMenu") : t("nav.openMenu"));
    if (open) { const first = nav.querySelector("a"); if (first) first.focus(); }
    return;
  }
  const langToggle = e.target.closest("#lang-current");
  if (langToggle) { toggleLangMenu(); return; }
  const flagBtn = e.target.closest("[data-lang]");
  if (flagBtn) { setLang(flagBtn.dataset.lang); closeLangMenu(); const cur = $("#lang-current"); if (cur) cur.focus(); return; }
  const scrollBtn = e.target.closest("[data-scroll]");
  if (scrollBtn) {
    const target = document.getElementById(scrollBtn.dataset.scroll);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const dot = e.target.closest("[data-slide]");
  if (dot) {
    const root = $("#showcase");
    showcaseIdx = Number(dot.dataset.slide);
    $$(".showcase-slide", root).forEach((el, i) => el.classList.toggle("active", i === showcaseIdx));
    $$(".showcase-dots button", root).forEach((d, i) => d.setAttribute("aria-current", String(i === showcaseIdx)));
    if (showcaseTimer) { clearInterval(showcaseTimer); startShowcaseRotationOnly(); }
    return;
  }
  const chip = e.target.closest(".chip");
  if (chip) {
    if (chip.dataset.wcat != null) { state.watchCategory = chip.dataset.wcat; renderWatch(); return; }
    if (chip.dataset.type != null) { state.typeFilter = chip.dataset.type; renderDiscover(); return; }
    /* Chips carrying data-action (e.g. pledge amounts) fall through to the
       action dispatch below — previously this branch returned for EVERY
       .chip, which silently swallowed pledge-pick clicks (owner-found,
       Oct 26 E2E: amount buttons appeared dead). */
  }
  const lbBtn = e.target.closest("[data-lightbox-film]");
  if (lbBtn) {
    const f = filmById(lbBtn.dataset.lightboxFilm);
    if (f) openLightbox(f, artworkFor(f.id), Number(lbBtn.dataset.lightboxIdx || 0), lbBtn);
    return;
  }
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "follow") {
    const turnOn = !state.follows.has(id);
    turnOn ? state.follows.add(id) : state.follows.delete(id);
    if (server.user) { sbToggleFollow(id, turnOn).then(refreshDynamic); }
    else save("glx2_follows", Array.from(state.follows));
    refreshDynamic();
  } else if (btn.dataset.action === "pledge-gate") {
    authSetReturnTo("#/film/" + id);
  } else if (btn.dataset.action === "pledge-pick") {
    pledgePick.cents = Number(btn.dataset.cents);
    pledgePick.custom = false;
    const custom = $("#pledge-custom"); if (custom) custom.value = "";
    refreshDynamic();
  } else if (btn.dataset.action === "pledge-custom") {
    /* Round 4: the grid's Custom chip reveals the same #pledge-custom
       input the submit handler has always read first — it only toggles
       which amount source is armed, never the amounts or the submit. */
    pledgePick.custom = true;
    refreshDynamic();
    const ci = $("#pledge-custom"); if (ci) ci.focus({ preventScroll: true });
  } else if (btn.dataset.action === "film-tab") {
    filmTabState.tab = btn.dataset.tab || "overview";
    applyFilmTab();
  } else if (btn.dataset.action === "open-gallery") {
    const f = filmById(id);
    if (f) openLightbox(f, artworkFor(f.id), 0, btn);
  } else if (btn.dataset.action === "play-teaser") {
    const sec = $("#film-teaser");
    const vid = sec ? sec.querySelector("video") : null;
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "center" });
    if (vid) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); }
  } else if (btn.dataset.action === "pledge-submit") {
    if (!server.user || !sb) return;
    const custom = $("#pledge-custom");
    let cents = pledgePick.cents;
    if (custom && custom.value) cents = Math.round(Number(custom.value) * 100);
    if (!cents || cents < 100) return;
    btn.disabled = true; btn.textContent = t("pledge2.recordingInterest");
    /* Final2 P1: one ACTIVE pledge per user+film. If one already exists
       (e.g. the panel rendered from stale data), update its amount instead
       of inserting a duplicate row. Errors are surfaced and the button is
       restored; displayed counts only ever come from the server refetch. */
    const existingPledge = myPledgeFor(id);
    const pledgeOp = existingPledge
      ? sb.from("pledges").update({ amount_cents: cents, status: "pledged" }).eq("id", existingPledge.id)
      : sb.from("pledges").insert({ user_id: server.user.id, film_id: id, amount_cents: cents, status: "pledged" });
    pledgeOp.then(async (res) => {
      if (res && res.error) { btn.disabled = false; btn.textContent = "That didn't record — please try again."; return; }
      await sbFetchMine(); await sbFetchCounts(); refreshDynamic();
    });
  } else if (btn.dataset.action === "pledge-cancel") {
    const mine = myPledgeFor(id);
    if (!mine || !sb) return;
    btn.disabled = true;
    sb.from("pledges").update({ status: "cancelled" }).eq("id", mine.id)
      .then(async () => { await sbFetchMine(); await sbFetchCounts(); refreshDynamic(); });
  } else if (btn.dataset.action === "mypledge-cancel") {
    if (!sb) return;
    btn.disabled = true;
    sb.from("pledges").update({ status: "cancelled" }).eq("id", btn.dataset.pledge)
      .then(async () => { await sbFetchMine(); await sbFetchCounts(); refreshDynamic(); });
  } else if (btn.dataset.action === "clear-filters") {
    state.query = ""; state.genreExact = "All"; state.stageFilter = "All"; state.typeFilter = "All"; state.sortBy = "featured";
    const searchEl = $("#search"); if (searchEl) searchEl.value = "";
    renderDiscover();
  } else if (btn.dataset.action === "save") {
    savedFilms.has(id) ? savedFilms.delete(id) : savedFilms.add(id);
    save("glx_saved", Array.from(savedFilms));
    refreshDynamic();
  } else if (btn.dataset.action === "watch-save") {
    watchSaved.has(id) ? watchSaved.delete(id) : watchSaved.add(id);
    save("glx_watch_saved", Array.from(watchSaved));
    refreshDynamic();
  } else if (btn.dataset.action === "clear-recent") {
    recentFilms = []; save("glx_recent", []);
    refreshDynamic();
  } else if (btn.dataset.action === "admin-approve" || btn.dataset.action === "admin-needs") {
    if (!sb) return;
    btn.disabled = true;
    const status = btn.dataset.action === "admin-approve" ? "approved" : "needs_changes";
    sb.from("submissions").update({ status }).eq("id", id).then(async () => { refreshDynamic(); });
  } else if (btn.dataset.action === "pro") {
    const sel = $("#p-role");
    if (sel) sel.value = btn.dataset.cat;
    const form = $("#pro-form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
    const nameEl = $("#p-name");
    if (nameEl) nameEl.focus({ preventScroll: true });
  } else if (btn.dataset.action === "watch-tile") {
    if (btn.dataset.wcat) { state.watchCategory = btn.dataset.wcat; state.watchGenre = "All"; }
    if (btn.dataset.wgenre) { state.watchGenre = btn.dataset.wgenre; state.watchCategory = "All"; }
    renderWatch();
    const rows = $("#watch-rows"); if (rows) rows.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (btn.dataset.action === "watch-feat-prev" || btn.dataset.action === "watch-feat-next") {
    const pool = watchFeaturedPool();
    if (pool.length) {
      watchFeatIdx = (watchFeatIdx + (btn.dataset.action === "watch-feat-next" ? 1 : -1) + pool.length) % pool.length;
      const featEl = $("#watch-featured"); if (featEl) featEl.innerHTML = watchFeaturedHtml();
    }
  } else if (btn.dataset.action === "watch-feat-go") {
    watchFeatIdx = Number(btn.dataset.idx || 0);
    const featEl = $("#watch-featured"); if (featEl) featEl.innerHTML = watchFeaturedHtml();
  }
});
/* Round 4: typing a custom pledge amount arms the Custom chip (visual
   state only, synced in place so the input never loses focus or value
   mid-typing; the submit handler's read order is unchanged). */
document.addEventListener("input", (e) => {
  if (!e.target || e.target.id !== "pledge-custom" || !e.target.value) return;
  pledgePick.custom = true;
  const panel = $("#support-panel");
  if (!panel) return;
  $$(".chip[data-action='pledge-pick']", panel).forEach((c) => c.setAttribute("aria-pressed", "false"));
  const cc = panel.querySelector(".chip[data-action='pledge-custom']");
  if (cc) cc.setAttribute("aria-pressed", "true");
});
$("#search").addEventListener("input", (e) => { state.query = e.target.value; renderDiscover(); });
const watchSearchEl = $("#watch-search");
if (watchSearchEl) watchSearchEl.addEventListener("input", (e) => { state.watchQuery = e.target.value; renderWatch(); });
$("#submit-form").addEventListener("input", saveSubmitDraft);
$("#submit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#submit-msg");
  const get = (id) => { const el = $(id); return el ? el.value.trim() : ""; };
  const entry = { title: get("#f-title"), genre: get("#f-genre"), logline: get("#f-logline"), synopsis: get("#f-synopsis"), type: $("#f-type").value, status: get("#f-status"), name: get("#f-name"), rights: $("#f-rights").value, target: get("#f-target"), video: get("#f-video"), email: get("#f-email") };
  if (!entry.title || !entry.genre || !entry.logline || !entry.synopsis || !entry.type || !entry.status || !entry.name || !entry.rights || !authValidEmail(entry.email) || !$("#f-terms").checked) {
    msg.textContent = t("submit.validation"); return;
  }
  if (!sb) {
    msg.textContent = t("submit.unavailable");
    return;
  }
  const btn = e.target.querySelector("button[type='submit']");
  btn.disabled = true;
  msg.textContent = t("submit.sending");
  const row = {
    id: crypto.randomUUID(),
    user_id: server.user ? server.user.id : null,
    contact_name: entry.name,
    contact_email: entry.email,
    title: entry.title,
    genre: entry.genre,
    logline: entry.logline,
    synopsis: entry.synopsis,
    production_type: entry.type,
    dev_status: entry.status,
    // The rights declaration is enforced here in the form: the submitter had
    // to state their rights position and agree to the terms above.
    rights_declaration: true,
    funding_target_usd: entry.target ? parseInt(entry.target, 10) : null,
    pitch_video_url: entry.video || null,
    notes: null
  };
  const { error } = await sb.from("submissions").insert(row);
  btn.disabled = false;
  if (error) {
    msg.textContent = t("submit.errorRetry", { error: error.message });
    return;
  }
  e.target.reset();
  save("glx2_submit_draft", {});
  msg.textContent = t("submit.received", { ref: row.id.slice(0, 6) }) + " " +
    (server.user ? t("submit.receivedTrack") : t("submit.receivedGuest"));
});
$("#pro-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#pro-msg");
  const name = $("#p-name").value.trim(), email = $("#p-email").value.trim(), role = $("#p-role").value;
  const portfolio = $("#p-portfolio").value.trim(), note = $("#p-note").value.trim();
  if (!name || !authValidEmail(email) || !role) { msg.textContent = t("pro.validation"); return; }
  if (!sb) {
    msg.textContent = t("pro.unavailable");
    return;
  }
  const btn = e.target.querySelector("button[type='submit']");
  btn.disabled = true;
  msg.textContent = t("pro.registering");
  const credits = ($("#p-credits") ? $("#p-credits").value.trim() : "");
  const skills = ($("#p-skills") ? $("#p-skills").value.trim() : "");
  const contactPref = ($("#p-contactpref") ? $("#p-contactpref").value : "");
  const extraNote = [note, credits ? "Credits: " + credits : "", skills ? "Skills: " + skills : "", contactPref ? "Contact preference: " + contactPref : ""].filter(Boolean).join("\n");
  let profileStored = false;
  try {
    const prof = { user_id: server.user ? server.user.id : null, name, email, role_categories: [role], credits: credits || null, skills: skills || null, portfolio_links: portfolio ? [portfolio] : [], contact_pref: contactPref || null };
    const pr = await sb.from("pro_profiles").insert(prof);
    profileStored = !pr.error;
  } catch (e) { profileStored = false; }
  const proRow = {
    id: crypto.randomUUID(),
    user_id: server.user ? server.user.id : null,
    name: name,
    email: email,
    role_category: role,
    portfolio_url: portfolio || null,
    note: extraNote || null
  };
  const { error } = profileStored ? { error: null } : await sb.from("pro_interest").insert(proRow);
  btn.disabled = false;
  if (error) {
    msg.textContent = t("pro.errorRetry", { error: error.message });
    return;
  }
  e.target.reset();
  msg.textContent = t("pro.success", { ref: proRow.id.slice(0, 6) });
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (!el || !el.id) return;
  if (el.id === "genre-select") { state.genreExact = el.value; renderDiscover(); }
  else if (el.id === "sort-select") { state.sortBy = el.value; renderDiscover(); }
  else if (el.id === "watch-genre") { state.watchGenre = el.value; renderWatch(); }
});
const draftBtn = $("#submit-savedraft");
if (draftBtn) draftBtn.addEventListener("click", () => { saveSubmitDraft(); const m = $("#submit-draft-msg"); if (m) m.textContent = t("submit2.draftSaved"); });
document.addEventListener("keydown", (e) => {
  if (lightboxState) {
    if (e.key === "Escape") { closeLightbox(); return; }
    if (e.key === "ArrowRight") { stepLightbox(1); return; }
    if (e.key === "ArrowLeft") { stepLightbox(-1); return; }
  }
  const langOpt = e.target && e.target.closest ? e.target.closest(".lang-option") : null;
  if (langOpt && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    const opts = $$(".lang-option");
    const i = opts.indexOf(langOpt);
    const nxt = opts[(i + (e.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length];
    if (nxt) nxt.focus();
    return;
  }
  if (e.key === "Escape") {
    if (langMenuOpen()) { closeLangMenu(); const c = $("#lang-current"); if (c) c.focus(); return; }
    const nav = $("#main-nav");
    if (nav && nav.classList.contains("open")) {
      nav.classList.remove("open");
      const tgl = $("#nav-toggle");
      if (tgl) { tgl.setAttribute("aria-expanded", "false"); tgl.setAttribute("aria-label", t("nav.openMenu")); tgl.focus(); }
    }
  }
});
/* ---------- Round 6 (Oct 30): trailer modal, footer accordions + language ---------- */
let trailerTrigger = null;
function openTrailerModal(trigger) {
  const modal = $("#trailer-modal");
  if (!modal) return;
  trailerTrigger = trigger || null;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  syncTrailerSubtitles();
  const vid = $("#trailer-video");
  if (vid) { const pr = vid.play(); if (pr && pr.catch) pr.catch(() => {}); }
  const closeBtn = modal.querySelector(".trailer-modal-close");
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}
function closeTrailerModal() {
  const modal = $("#trailer-modal");
  if (!modal || modal.hidden) return;
  const vid = $("#trailer-video");
  if (vid) { try { vid.pause(); vid.currentTime = 0; } catch (e) {} }
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (trailerTrigger && trailerTrigger.focus) trailerTrigger.focus({ preventScroll: true });
  trailerTrigger = null;
}
function syncFooterLangs() {
  $$(".foot-lang").forEach((b) => {
    const on = b.dataset.footlang === lang;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
  });
}
document.addEventListener("click", (e) => {
  const close = e.target.closest ? e.target.closest("[data-trailer-close]") : null;
  if (close) { closeTrailerModal(); return; }
  const accBtn = e.target.closest ? e.target.closest(".footer-acc-btn") : null;
  if (accBtn) {
    const col = accBtn.closest(".footer-col");
    const open = col ? col.classList.toggle("open") : false;
    accBtn.setAttribute("aria-expanded", String(open));
    return;
  }
  const fl = e.target.closest ? e.target.closest("[data-footlang]") : null;
  if (fl) { setLang(fl.dataset.footlang); syncFooterLangs(); }
}, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = $("#trailer-modal");
    if (modal && !modal.hidden) { closeTrailerModal(); e.stopPropagation(); }
  }
}, true);

window.addEventListener("hashchange", render);
window.addEventListener("pageshow", (e) => { if (e.persisted) render(); });
render();
syncTrailerSubtitles();
sbInit();
