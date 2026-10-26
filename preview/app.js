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
  if (lang === "en" || !isLegalKey(key)) return "";
  const note = (I18N.draftNotice && I18N.draftNotice[lang]) || t("legal.draftNotice");
  return ' <span class="draft-note">(' + escapeHtml(note) + ")</span>";
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
  applyStaticI18n(); render();
}
document.documentElement.lang = lang;

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
const PREF_CATS = [
  { key: "pref_followed_updates", label: "Updates about projects I follow" },
  { key: "pref_new_projects", label: "New projects added to GreenlitX" },
  { key: "pref_watch_free", label: "New Watch Free additions" },
  { key: "pref_membership_info", label: "Membership information" },
  { key: "pref_account_notices", label: "Account and security notices" }
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
  watchCategory: "All"
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
const AUTH_REDIRECT = "https://greenlitx.com/preview/";
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
let pledgePick = { filmId: null, cents: 2500 };
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
    '<figcaption><p class="card-title">' + escapeHtml(film.title) + "</p></figcaption></figure>";
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
  return [brand].concat(FEATURED.map(filmById).filter(Boolean));
}
function showcaseHtml() {
  const slides = showcaseSlides();
  const slideHtml = slides.map((s, i) => {
    if (s.brand) {
      return '<div class="showcase-slide' + (i === 0 ? " active" : "") + '">' +
        '<div class="backdrop-gradient" style="--hue:150"></div><div class="showcase-shade"></div>' +
        '<div class="showcase-content"><div class="showcase-inner">' +
        '<p class="showcase-kicker">' + escapeHtml(t("hero.kicker")) + '</p>' +
        '<h1 class="showcase-title" tabindex="-1">' + escapeHtml(t("hero.titleStart")) + ' <span class="accent">' + escapeHtml(t("hero.titleAccent")) + '</span></h1>' +
        '<p class="showcase-log">' + escapeHtml(t("hero.logline")) + '</p>' +
        '<div class="showcase-actions"><a class="btn btn-primary" href="#/discover">' + escapeHtml(t("nav.discover")) + '</a>' +
        '<a class="btn btn-ghost" href="#/watch">' + escapeHtml(t("nav.watchFree")) + '</a></div>' +
        '<div class="hero-steps" aria-label="' + escapeHtml(t("hero.stepsLabel")) + '"><span><b>1</b>&nbsp; ' + escapeHtml(t("hero2.step1")) + '</span><span><b>2</b>&nbsp; ' + escapeHtml(t("hero2.step2")) + '</span><span><b>3</b>&nbsp; ' + escapeHtml(t("hero2.step3")) + '</span></div>' +
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
  const dots = slides.map((s, i) => '<button type="button" data-slide="' + i + '" aria-current="' + (i === 0) + '" aria-label="' + escapeHtml(t("hero.slideLabel", { n: i + 1 })) + '"' + (i + 1) + '"></button>').join("");
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
  showcaseIdx = 0;
  if (showcaseTimer) clearInterval(showcaseTimer);
  startShowcaseRotationOnly();
}
function latestArtworkHtml() {
  const fresh = [];
  FILMS.forEach((f) => { artworkFor(f.id).forEach((a) => { if (a.created === "2026-10-25") fresh.push({ film: f, a }); }); });
  if (!fresh.length) return "";
  const picked = [], usedFilms = new Set();
  for (const kind of ["portrait", "location", "moment", "detail", "portrait", "location", "moment", "portrait", "location", "moment"]) {
    const hit = fresh.find((x) => x.a.kind === kind && !usedFilms.has(x.film.id) && !picked.includes(x));
    if (hit) { picked.push(hit); usedFilms.add(hit.film.id); }
    if (picked.length >= 10) break;
  }
  for (const x of fresh) { if (picked.length >= 10) break; if (!picked.includes(x)) picked.push(x); }
  return '<section class="row-section" aria-label="' + escapeHtml(t("home.latestArtwork")) + '">' +
    '<div class="section-head"><h2>' + escapeHtml(t("home.latestArtwork")) + '</h2><span class="fineprint">' + escapeHtml(t("home.latestArtworkDate")) + '</span></div>' +
    '<div class="poster-row artwork-row">' + picked.map(({ film, a }) =>
      '<figure class="card artwork-tile"><div class="poster-wrap"><a class="poster-link" href="#/film/' + film.id + '">' +
      '<div class="poster artwork-thumb"><img src="' + escapeHtml(a.file) + '" loading="lazy" alt="' + escapeHtml(t("gallery.view", { caption: t("artworkKind." + a.kind) + " — " + a.subject })) + '"></div></a></div>' +
      '<figcaption><p class="card-title">' + escapeHtml(film.title) + '</p><p class="fineprint">' + escapeHtml(t("artworkKind." + a.kind)) + "</p></figcaption></figure>").join("") + "</div></section>";
}
function renderHome() {
  startShowcase();
  const tonight = WATCH.filter((w) => w.category === "modern");
  const watchRow = tonight.length ?
    '<section class="row-section" aria-label="' + escapeHtml(t("home.watchTonight")) + '">' +
    '<div class="section-head"><h2>' + escapeHtml(t("home.watchTonight")) + '</h2><a class="section-link" href="#/watch">' + escapeHtml(t("home.allFreeFilms")) + '</a></div>' +
    '<div class="poster-row">' + tonight.map(watchCardHtml).join("") + "</div></section>" : "";
  const recentRow = recentFilms.length ?
    '<section class="row-section" aria-label="' + escapeHtml(t("home2.recentlyViewed")) + '"><div class="section-head"><h2>' + escapeHtml(t("home2.recentlyViewed")) + '</h2></div>' +
    '<div class="poster-row">' + recentFilms.map(filmById).filter(Boolean).map(cardHtml).join("") + "</div></section>" : "";
  $("#home-rows").innerHTML = watchRow + recentRow + latestArtworkHtml() + SECTIONS.map((s) => {
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
function chipsHtml(items, current, attr) {
  return '<span class="chip-label">' + escapeHtml(t("discover.filterMethod")) + "</span>" + items.map((i) =>
    '<button type="button" class="chip" data-' + attr + '="' + escapeHtml(i) + '" aria-pressed="' + (current === i) + '">' + escapeHtml(i) + "</button>").join("");
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
  const stageSel = $("#stage-select");
  if (stageSel) {
    stageSel.innerHTML = '<option value="All">' + escapeHtml(t("discover.allStages")) + "</option>" +
      distinctFilmValues("status").map((s) => '<option value="' + escapeHtml(s) + '">' + escapeHtml(stageLabel(s)) + "</option>").join("");
    stageSel.value = state.stageFilter;
  }
}
function filteredFilms() {
  const q = state.query.trim().toLowerCase();
  return FILMS.filter((f) => {
    if (state.genreExact !== "All" && f.genre !== state.genreExact) return false;
    if (state.stageFilter !== "All" && f.status !== state.stageFilter) return false;
    if (state.typeFilter !== "All" && f.productionType !== state.typeFilter) return false;
    if (q) {
      const hay = (f.title + " " + f.genre + " " + filmText(f, "logline") + " " + filmText(f, "tagline") + " " + f.synopsis + " " + f.characters.map((c) => c.name + " " + c.role).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderDiscover() {
  renderFilterSelects();
  renderChips();
  const list = filteredFilms();
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
    '<figcaption><p class="card-title">' + escapeHtml(w.title) + "</p></figcaption></figure>";
}
function watchFiltered() {
  const q = state.watchQuery.trim().toLowerCase();
  return WATCH.filter((w) => {
    if (state.watchCategory !== "All" && w.category !== state.watchCategory) return false;
    if (q) {
      const hay = (w.title + " " + w.director + " " + w.year + " " + (w.genres || []).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderWatch() {
  const chipsEl = $("#watch-chips");
  if (chipsEl) chipsEl.innerHTML = WATCH_CATS.map((c) =>
    '<button type="button" class="chip" data-wcat="' + c.key + '" aria-pressed="' + (state.watchCategory === c.key) + '">' + escapeHtml(t(c.labelKey)) + "</button>").join("");
  const list = watchFiltered();
  const countEl = $("#watch-count");
  if (countEl) countEl.textContent = t("watch.resultsCount", { shown: list.length, total: WATCH.length });
  const savedList = list.filter((w) => watchSaved.has(w.id));
  const savedRow = savedList.length ?
    '<section class="row-section" aria-label="' + escapeHtml(t("home2.myWatchlist")) + '"><div class="section-head"><h2>' + escapeHtml(t("home2.myWatchlist")) + '</h2></div>' +
    '<div class="poster-row">' + savedList.map(watchCardHtml).join("") + "</div></section>" : "";
  const groups = WATCH_CATS.slice(1)
    .map((c) => ({ cat: c, films: list.filter((w) => w.category === c.key) }))
    .filter((g) => g.films.length);
  const draftNote = lang !== "en" ? '<p class="fineprint draft-notice" style="padding:0 1.1rem">' + escapeHtml(t("watch.draftNotice")) + "</p>" : "";
  $("#watch-rows").innerHTML = draftNote + savedRow + (groups.length ? groups.map((g) =>
    '<section class="row-section" aria-label="' + escapeHtml(t(g.cat.labelKey)) + '">' +
    '<div class="section-head"><h2>' + escapeHtml(t(g.cat.labelKey)) + "</h2></div>" +
    '<div class="poster-row">' + g.films.map(watchCardHtml).join("") + "</div></section>").join("")
    : '<p class="section-intro">' + escapeHtml(t("watch.noResults")) + '</p>');
}
function renderWatchDetail(id) {
  const el = $("#watch-detail");
  const w = watchById(id);
  if (!w) {
    el.innerHTML = '<div class="section"><h2 tabindex="-1">' + escapeHtml(t("watch.notFound")) + '</h2><p>' + escapeHtml(t("watch.notFoundText")) + ' <a href="#/watch">' + escapeHtml(t("watch.browseWatch")) + "</a>.</p></div>";
    return;
  }
  const sourceName = w.source === "youtube" ? t("watch.sourceYoutube") : t("watch.sourceArchive");
  const related = WATCH.filter((x) => x.category === w.category && x.id !== w.id);
  el.innerHTML =
    '<div class="section watch-detail">' +
    '<p class="watch-back"><a href="#/watch">' + escapeHtml(t("watch.backAll")) + "</a></p>" +
    '<h1 tabindex="-1">' + escapeHtml(w.title) + "</h1>" +
    '<p class="watch-meta">' + escapeHtml(t("watch.metaLine", { year: w.year, minutes: w.runtimeMinutes, director: w.director, category: watchCatLabel(w.category) })) + "</p>" +
    '<div class="player-wrap"><iframe src="' + escapeHtml(w.embedUrl) + '" title="' + escapeHtml(t("watch.playerTitle", { title: w.title })) + '" loading="lazy" allowfullscreen frameborder="0" referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
    '<p class="watch-synopsis">' + escapeHtml(w.synopsis) + "</p>" +
    (lang !== "en" ? '<p class="fineprint draft-notice">' + escapeHtml(t("watch.draftNotice")) + "</p>" : "") +
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
  const mine = server.user ? myPledgeFor(film.id) : null;
  if (pledgePick.filmId !== film.id) pledgePick = { filmId: film.id, cents: 2500 };
  let action = "";
  if (!server.user) {
    action = '<div class="pledge-amounts" aria-hidden="true">' + PLEDGE_AMOUNTS.map((c) => '<span class="chip chip-static">' + fmtCents(c) + "</span>").join("") + "</div>" +
      '<a class="btn btn-primary" href="#/account" data-action="pledge-gate" data-id="' + film.id + '">' + escapeHtml(t("pledge2.createAccountFull")) + '</a>' +
      '<p class="panel-note">' + escapeHtml(t("pledge.accountNote")) + '</p>';
  } else if (mine) {
    action = '<p class="panel-note"><strong>' + escapeHtml(t("pledge.youPledged", { amount: fmtCents(mine.amount_cents) })) + '</strong></p>' +
      '<button type="button" class="btn btn-ghost" data-action="pledge-cancel" data-id="' + film.id + '">' + escapeHtml(t("pledge2.cancelInterest")) + '</button>';
  } else {
    action = '<div class="pledge-amounts" role="group" aria-label="' + escapeHtml(t("pledge.amountGroupLabel")) + '">' +
      PLEDGE_AMOUNTS.map((c) => '<button type="button" class="chip" data-action="pledge-pick" data-cents="' + c + '" aria-pressed="' + (pledgePick.cents === c) + '">' + fmtCents(c) + "</button>").join("") + "</div>" +
      '<div class="field" style="margin:0.6rem 0"><label for="pledge-custom" style="font-size:0.9rem">' + escapeHtml(t("pledge.customLabel")) + '</label>' +
      '<input id="pledge-custom" type="number" min="1" step="1" placeholder="' + escapeHtml(t("pledge.customPlaceholder")) + '"></div>' +
      '<button type="button" class="btn btn-primary" data-action="pledge-submit" data-id="' + film.id + '">' + escapeHtml(t("pledge.submitButton", { amount: fmtCents(pledgePick.cents) })) + "</button>" +
      '<p class="panel-note">' + escapeHtml(t("pledge.termsNote")) + '</p>';
  }
  return '<div class="action-panel" id="support-panel"><h3>' + escapeHtml(t("pledge.supportThisFilm")) + '</h3>' +
    '<p class="support-sub">' + escapeHtml(t("pledge.chooseAmount")) + '</p>' +
    '<p class="panel-note"><strong>' + escapeHtml(pledgeMicro()) + '</strong>' + draftNoteHtml("pledge.nonbinding") + '</p>' +
    action +
    '<p class="testmode-note">' + escapeHtml(t("pledge.nonbinding")) + '</p></div>';
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
  return '<div class="detail-section"><h2>' + escapeHtml(t("film3.galleryHeading")) + '</h2>' +
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
  return chars.map((c) => {
    const pt = matchFor(c);
    const note = String(c.note || "");
    const first = (note.split(/(?<=\.)\s+/)[0] || note);
    const img = pt ? '<img class="char-portrait" src="' + escapeHtml(pt.file) + '" width="1200" height="1800" loading="lazy" alt="' + escapeHtml(t("artworkKind.portrait") + " — " + c.name) + '">' : "";
    return '<div class="char-card">' + img + "<h3>" + escapeHtml(c.name) + '</h3><p class="char-role">' + escapeHtml(c.role) + "</p><p>" + escapeHtml(first) + "</p>" +
      (note && note !== first ? '<details class="char-bio"><summary>' + escapeHtml(t("film3.readBio")) + "</summary><p>" + escapeHtml(note) + "</p></details>" : "") + "</div>";
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
  const vision = film.creativeVision || {};
  const visionInner = (vision.tone || vision.themes || vision.visualIdentity) ?
    (vision.tone ? "<p><strong>" + escapeHtml(t("film2.visionTone")) + "</strong> " + escapeHtml(vision.tone) + "</p>" : "") +
    (vision.themes ? "<p><strong>" + escapeHtml(t("film2.visionThemes")) + "</strong> " + escapeHtml(vision.themes) + "</p>" : "") +
    (vision.visualIdentity ? "<p><strong>" + escapeHtml(t("film2.visionVisual")) + "</strong> " + escapeHtml(vision.visualIdentity) + "</p>" : "") : "";
  const teaserHtml = (isFlagship && TEASERS[film.id]) ?
    '<div class="detail-section"><h2>' + (lang === "en" ? "Concept Teaser" : escapeHtml(t("film2.teaserHeading"))) + '</h2>' +
    '<div class="trailer-frame"><video controls preload="none" playsinline loading="lazy" poster="backdrops/' + film.id + '.webp" aria-label="' + escapeHtml(t("film2.teaserAria", { title: film.title })) + '"><source src="' + TEASERS[film.id] + '" type="video/mp4"></video></div>' +
    '<p class="fineprint">' + escapeHtml(t("film2.teaserNote")) + "</p></div>" : "";
  const heroArt = BACKDROPS[film.id]
    ? '<img class="backdrop" src="backdrops/' + film.id + '.webp" width="1600" height="900" alt="" aria-hidden="true">'
    : '<div class="backdrop-gradient" style="--hue:' + genreHue(film) + '"></div>';
  const related = relatedFilms(film);
  el.innerHTML =
    '<div class="detail-hero">' + heroArt + '<div class="detail-hero-shade"></div>' +
    '<div class="detail-hero-inner"><div>' +
    '<p class="showcase-kicker">' + escapeHtml(film.genre) + " · " + escapeHtml(film.runtime) + " · " + escapeHtml(film.productionType) + (isFlagship ? ' · <span class="featured-badge">' + escapeHtml(t("film2.featuredBadge")) + "</span>" : "") + "</p>" +
    '<h1 tabindex="-1">' + escapeHtml(film.title) + "</h1>" +
    '<p class="tagline">' + escapeHtml(filmText(film, "tagline")) + "</p>" +
    "</div></div></div>" +
    '<div class="detail-layout">' +
    '<div class="detail-main">' +
    '<div class="detail-section"><h2>' + escapeHtml(t("film3.exploreStory")) + '</h2>' +
    '<p class="logline">' + escapeHtml(filmText(film, "logline")) + "</p>" +
    "<p>" + escapeHtml(filmText(film, "synopsis")) + "</p></div>" +
    '<div class="detail-section"><h2>' + escapeHtml(sectionLabel("mainCharacters", t("film.characters"))) + '</h2><div class="char-grid">' + charactersHtml(film) + "</div></div>" +
    galleryHtml(film) +
    teaserHtml +
    '<div class="detail-section"><h2>' + escapeHtml(t("film3.productionFinancing")) + '</h2>' +
    "<p><strong>" + escapeHtml(film.productionType) + ".</strong> " + escapeHtml(film.productionApproach || film.productionNote) + "</p>" +
    fundingFactsHtml(film) +
    "<p><strong>" + escapeHtml(t("funding.budgetLabel")) + ":</strong> " + fmtMoney(film.budget) + " — " + escapeHtml(film.budgetNote) + "</p>" +
    (film.audiencePositioning ? "<p><strong>" + escapeHtml(t("film2.audienceLabel")) + "</strong> " + escapeHtml(film.audiencePositioning) + "</p>" : "") +
    (film.financingNote ? "<p>" + escapeHtml(film.financingNote) + "</p>" : "") + "</div>" +
    '<div class="detail-section"><h2>' + escapeHtml(t("film3.developmentInfo")) + "</h2>" +
    '<details class="detail-details"><summary>' + escapeHtml(sectionLabel("developmentRoadmap", t("film.roadmap"))) + "</summary>" + roadmapInner + "</details>" +
    (journalInner ? '<details class="detail-details"><summary>' + escapeHtml(t("film2.journalHeading")) + "</summary>" + journalInner + "</details>" : "") +
    (visionInner ? '<details class="detail-details"><summary>' + escapeHtml(t("film2.visionHeading")) + "</summary>" + visionInner + "</details>" : "") +
    (film.treatmentHtml ? '<details class="detail-details treatment-wrap"><summary>' + escapeHtml(t("film.treatmentToggle")) + '</summary><p class="fineprint">' + escapeHtml(t("film.treatmentNote")) + '</p><div class="treatment">' + film.treatmentHtml + "</div></details>" : "") +
    "</div>" +
    "</div>" +
    '<div class="detail-rail">' +
    '<div class="action-panel"><h3>' + escapeHtml(t("film2.followHeading")) + "</h3>" +
    '<p class="panel-note">' + escapeHtml(t("film2.followNote")) + "</p>" +
    '<button type="button" class="btn btn-ghost" data-action="follow" data-id="' + film.id + '" aria-pressed="' + followed + '">' + (followed ? escapeHtml(t("follow.following")) : escapeHtml(t("follow.follow"))) + "</button> " +
    '<button type="button" class="btn btn-ghost" data-action="save" data-id="' + film.id + '" aria-pressed="' + isSaved + '">' + (isSaved ? escapeHtml(t("follow.saved")) : escapeHtml(t("follow.save"))) + "</button></div>" +
    '<div class="detail-section support-section"><h2>' + escapeHtml(t("pledge.helpBringToLife")) + "</h2>" +
    "<p>" + escapeHtml(t("film2.greenLightNote")) + "</p></div>" +
    pledgePanelHtml(film) +
    progressHtml(film) +
    "</div></div>" +
    '<section class="row-section" aria-label="' + escapeHtml(t("film3.continueExploring")) + '"><div class="section-head"><h2>' + escapeHtml(t("film3.continueExploring")) + '</h2></div>' +
    '<p class="section-intro">' + escapeHtml(t("film3.relatedNote")) + '</p>' +
    '<div class="poster-row">' + related.map(cardHtml).join("") + "</div></section>";
}

/* ---------- account ---------- */
function filmLinks(ids) {
  if (!ids.length) return "<p class='fineprint'>None yet.</p>";
  return "<ul>" + ids.map((id) => { const f = filmById(id); return f ? '<li><a href="#/film/' + f.id + '">' + escapeHtml(f.title) + "</a></li>" : ""; }).join("") + "</ul>";
}
async function renderAccount() {
  const el = $("#account-body");
  if (!el) return;
  if (!sb) { el.innerHTML = "<p>Accounts are temporarily unavailable (the sign-in service could not be loaded). You can still browse films and Watch Free.</p>"; return; }
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
      "<p class='section-intro' style='padding-left:0'>You followed a password reset link. Choose a new password for your GreenlitX account.</p>" +
      "<form id='recovery-form' novalidate>" +
      "<div class='field'><label for='r-pass'>New password</label><input id='r-pass' type='password' autocomplete='new-password' required></div>" +
      "<div class='field'><label for='r-pass2'>Confirm new password</label><input id='r-pass2' type='password' autocomplete='new-password' required></div>" +
      "<button class='btn btn-primary' type='submit'>Set new password</button>" +
      "<p class='form-msg' id='recovery-msg' role='status'></p></form>";
    $("#recovery-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#recovery-msg");
      const p1 = $("#r-pass").value, p2 = $("#r-pass2").value;
      if (p1.length < 6) { msg.textContent = "Passwords need at least 6 characters."; return; }
      if (p1 !== p2) { msg.textContent = "The two passwords don't match."; return; }
      msg.textContent = "Updating your password…";
      const btn = e.target.querySelector("button[type='submit']"); btn.disabled = true;
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) { msg.textContent = "That didn't work: " + error.message; btn.disabled = false; return; }
      recoveryMode = false;
      try { history.replaceState(null, "", location.pathname + "#/account"); } catch (err) {}
      await renderAccount();
      const note = $("#account-msg");
      if (note) note.textContent = "Password updated — you're signed in with your new password.";
    });
    return;
  }
  if (!server.user) {
    el.innerHTML =
      "<p class='section-intro' style='padding-left:0'>Create a free account to follow projects and record nonbinding pledge interest you can manage from here. Payments are not active — no card is ever charged.</p>" +
      authBanners +
      "<div id='auth-success-panel'></div>" +
      "<form id='auth-form' novalidate>" +
      "<div class='field'><label for='a-email'>Email</label><input id='a-email' type='email' autocomplete='email' required aria-describedby='a-email-err'>" +
      "<p class='form-msg' id='a-email-err' role='alert' style='color:#b3261e'></p></div>" +
      "<div class='field'><label for='a-pass'>Password</label><input id='a-pass' type='password' autocomplete='current-password' required aria-describedby='a-pass-hint a-pass-err'>" +
      "<p class='fineprint' id='a-pass-hint' style='margin:0.25rem 0 0'>" + escapeHtml(t("auth2.passwordRule")) + "</p>" +
      "<p class='form-msg' id='a-pass-err' role='alert' style='color:#b3261e'></p></div>" +
      "<button class='btn btn-primary' type='submit' name='mode' value='signin' id='auth-signin-btn'>Sign in</button> " +
      "<button class='btn' type='submit' name='mode' value='signup' id='auth-signup-btn'>Create account</button>" +
      "<p class='form-msg' id='auth-msg' role='status'></p>" +
      "<p style='margin-top:0.6rem'><button type='button' class='btn btn-ghost' id='forgot-btn'>Forgot password?</button></p>" +
      "<div id='forgot-panel' hidden style='margin-top:0.6rem'>" +
      "<div class='field'><label for='forgot-email'>Email for the reset link</label><input id='forgot-email' type='email' autocomplete='email'></div>" +
      "<button type='button' class='btn' id='forgot-send'>Send reset email</button>" +
      "<p class='form-msg' id='forgot-msg' role='status'></p></div>" +
      "<p class='fineprint'>New accounts confirm by email first. We store your email, an optional display name, your follows and your recorded pledge interest — nothing else. No ads, no selling data.</p></form>";
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
    ? "<ul>" + pledgeRows.map((p) => { const f = filmById(p.film_id); return "<li><strong>" + fmtCents(p.amount_cents) + "</strong> nonbinding pledge interest in " + (f ? '<a href="#/film/' + f.id + '">' + escapeHtml(f.title) + "</a>" : escapeHtml(p.film_id)) + ' — no card charged, no payment authorized. <button type="button" class="btn btn-small btn-ghost" data-action="mypledge-cancel" data-pledge="' + p.id + '">Cancel</button></li>'; }).join("") + "</ul>"
    : "<p class='fineprint'>No pledge interest recorded yet.</p>";
  const subStatusLabel = { submitted: "Submitted", pending: "In review", in_review: "In review", approved: "Approved", needs_changes: "Needs changes", rejected: "Not selected" };
  let mySubsHtml = "<p class='fineprint'>Submission history isn't available right now.</p>";
  try {
    const { data: subs, error: subsErr } = await sb.from("submissions").select("id, title, status").eq("user_id", u.id).order("created_at", { ascending: false });
    if (!subsErr && subs) {
      mySubsHtml = subs.length
        ? "<ul>" + subs.map((s) => "<li><strong>" + escapeHtml(s.title) + "</strong> — " + escapeHtml(subStatusLabel[s.status] || s.status) + "</li>").join("") + "</ul>"
        : "<p class='fineprint'>No submissions yet — <a href='#/submit'>submit a film</a> and it will be tracked here.</p>";
    }
  } catch (e) {}
  await loadCommPrefs();
  const savedHtml = savedFilms.size ? filmLinks(Array.from(savedFilms)) : "<p class='fineprint'>No saved films yet — use Save on any project to keep it here.</p>";
  const recentHtml = recentFilms.length ?
    filmLinks(recentFilms) + "<p><button type='button' class='btn btn-small btn-ghost' data-action='clear-recent'>Clear recently viewed</button></p>" :
    "<p class='fineprint'>Nothing viewed yet on this device.</p>";
  const watchSavedHtml = watchSaved.size ?
    "<ul>" + Array.from(watchSaved).map((wid) => { const w = watchById(wid); return w ? '<li><a href="#/watch/' + w.id + '">' + escapeHtml(w.title) + "</a></li>" : ""; }).join("") + "</ul>" :
    "<p class='fineprint'>No Watch Free titles saved yet.</p>";
  const prefsHtml = PREF_CATS.map((c) =>
    '<label class="pref-row"><input type="checkbox" data-pref="' + c.key + '"' + (commPrefs[c.key] ? " checked" : "") + "> " + escapeHtml(c.label) + "</label>").join("") +
    '<p class="fineprint">' + (prefsRemote ? "Preferences are saved to your account." : "Preferences are saved on this device for now (interim store) and will sync to your account when the preferences table is enabled.") + "</p>";
  el.innerHTML = authBanners +
    "<p>Signed in as <strong>" + escapeHtml(u.email || "") + "</strong></p>" +
    "<h3 style='margin-top:1.6rem'>Membership</h3>" +
    "<p><strong>Free member</strong> — free membership is live. The founding membership campaign is planned — not yet open; no paid membership can be bought today. See <a href='#/membership'>Membership</a>.</p>" +
    "<form id='profile-form' novalidate><div class='field'><label for='a-name'>Display name (optional, shown with your support)</label><input id='a-name' value='" + escapeHtml(profileName) + "'></div>" +
    "<button class='btn' type='submit'>Save name</button> <span class='form-msg' id='profile-msg' role='status'></span></form>" +
    "<h3 style='margin-top:2rem'>My pledge interest (" + pledgeRows.length + ")</h3>" + pledgeHtml +
    "<h3 style='margin-top:1.6rem'>My submissions</h3>" + mySubsHtml +
    "<h3 style='margin-top:1.6rem'>Projects I follow (" + state.follows.size + ")</h3>" + filmLinks(Array.from(state.follows)) +
    "<h3 style='margin-top:1.6rem'>Saved films (" + savedFilms.size + ")</h3>" + savedHtml +
    "<h3 style='margin-top:1.6rem'>My Watch Free watchlist (" + watchSaved.size + ")</h3>" + watchSavedHtml +
    "<h3 style='margin-top:1.6rem'>Recently viewed on this device</h3>" + recentHtml +
    "<h3 style='margin-top:1.6rem'>Communication preferences</h3>" + prefsHtml +
    "<div id='admin-section'></div>" +
    "<p style='margin-top:2rem'><button type='button' class='btn' id='signout-btn'>Sign out</button> " +
    "<button type='button' class='btn btn-ghost' id='deletedata-btn'>Delete my follows, pledges and profile</button></p>" +
    "<p class='form-msg' id='account-msg' role='status'></p>" +
    "<p class='fineprint'>Deleting removes your follows, recorded pledge interest and display name from GreenlitX immediately. To remove the login itself, email us at <a href='mailto:team@greenlitx.com'>team@greenlitx.com</a> and we will delete the account completely.</p>";
  if (justConfirmed || linkError) setTimeout(() => { try { sessionStorage.removeItem("glx_just_confirmed"); sessionStorage.removeItem("glx_auth_link_error"); } catch (e) {} }, 1500);
  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#a-name").value.trim();
    const { error } = await sb.from("profiles").upsert({ id: u.id, display_name: name || null });
    $("#profile-msg").textContent = error ? "Could not save: " + error.message : "Saved.";
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
    $("#account-msg").textContent = "Your data has been deleted and you are signed out.";
  });
}

/* ---------- membership & about (Wave B, Stage 2a) ---------- */
function renderMembership() {
  const el = $("#membership-body"); if (!el) return;
  const tt = (k, vars) => escapeHtml(t(k, vars));
  const proposedCard = (n) =>
    '<div class="tier-card"><p class="tier-badge">' + tt("membership2.proposedBadge") + '</p>' +
    "<h3>" + tt("membership2.tier" + n + "Name") + "</h3>" +
    "<p>" + tt("membership2.discussedAmount", { amount: t("membership2.tier" + n + "Amount") }) + "</p>" +
    "<p>" + tt("membership2.discussedTerm", { term: t("membership2.tier" + n + "Term") }) + "</p></div>";
  el.innerHTML =
    '<p class="draft-banner" role="note">' + tt("membership2.banner") + "</p>" +
    "<h2 tabindex='-1'>" + tt("membership2.heading") + "</h2>" +
    '<p class="footer-slogan">' + tt("membership2.slogan") + "</p>" +
    "<p>" + tt("membership2.intro") + "</p>" +
    "<h3>" + tt("membership2.tiersHeading") + "</h3>" +
    "<p>" + tt("membership2.tiersIntro") + "</p>" +
    '<div class="membership-cards">' +
    '<div class="tier-card tier-free"><p class="tier-badge tier-live">' + tt("membership2.liveNow") + "</p>" +
    "<h3>" + tt("membership2.freeHeading") + "</h3>" +
    "<p>" + tt("membership2.freeIntro") + "</p>" +
    "<ul>" + [1, 2, 3, 4, 5].map((i) => "<li>" + tt("membership2.freeItem" + i) + "</li>").join("") + "</ul>" +
    "<p>" + tt("membership2.freeCost") + "</p>" +
    '<p><a class="btn btn-primary" href="#/account">' + tt("membership2.createCta") + "</a></p></div>" +
    proposedCard(2) + proposedCard(3) + proposedCard(4) +
    '<div class="tier-card tier-producer"><h3>' + tt("membership2.tier5Name") + "</h3>" +
    "<p>" + tt("membership2.producerText") + "</p></div>" +
    "</div>" +
    "<p>" + tt("membership2.tiersApproach") + "</p>" +
    "<p>" + tt("membership2.tiersNoBuy") + "</p>" +
    "<h3>" + tt("membership2.foundingHeading") + "</h3>" +
    "<p>" + tt("membership2.foundingIntro") + "</p>" +
    "<p><strong>" + tt("membership2.foundingNotOpen") + "</strong></p>" +
    "<p>" + tt("membership2.foundingTerms") + "</p>" +
    "<h3>" + tt("membership2.diffHeading") + "</h3>" +
    "<p>" + tt("membership2.diffMembership") + "</p>" +
    "<p>" + tt("membership2.diffPledge") + "</p>" +
    "<p>" + tt("membership2.diffShort") + "</p>" +
    "<h3>" + tt("membership2.questionsHeading") + "</h3>" +
    "<p>" + tt("membership2.questionsText") + "</p>";
}
function renderAbout() {
  const el = $("#about-body"); if (!el) return;
  const tt = (k) => escapeHtml(t(k));
  el.innerHTML =
    "<h2 tabindex='-1'>" + tt("about2.heading") + "</h2>" +
    '<blockquote class="about-slogan">' + tt("about2.slogan") + "</blockquote>" +
    "<h3>" + tt("about2.missionHeading") + "</h3><p>" + tt("about2.missionP1") + "</p><p>" + tt("about2.missionP2") + "</p>" +
    "<h3>" + tt("about2.whyHeading") + "</h3><p>" + tt("about2.whyP1") + "</p><p>" + tt("about2.whyP2") + "</p><p>" + tt("about2.whyP3") + "</p>" +
    "<h3>" + tt("about2.participateHeading") + "</h3>" +
    [1, 2, 3, 4].map((i) => "<p><strong>" + tt("about2.step" + i + "Name") + "</strong> " + tt("about2.step" + i + "Text") + "</p>").join("") +
    "<p>" + tt("about2.freeNote") + "</p>" +
    "<h3>" + tt("about2.developedHeading") + "</h3><p>" + tt("about2.developedP1") + "</p><p>" + tt("about2.developedP2") + "</p>" +
    "<h3>" + tt("about2.submitHeading") + "</h3><p>" + tt("about2.submitText") + "</p>" +
    "<h3>" + tt("about2.proHeading") + "</h3><p>" + tt("about2.proText") + "</p>" +
    "<h3>" + tt("about2.diffHeading") + "</h3>" +
    [1, 2, 3, 4].map((i) => "<p>" + tt("about2.diff" + i) + "</p>").join("") +
    "<p>" + tt("about2.diffSlogan") + "</p>" +
    "<h3>" + tt("about2.nowHeading") + "</h3><p>" + tt("about2.nowText") + "</p>";
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
  host.innerHTML = "<h3 style='margin-top:1.6rem'>Admin review</h3>" +
    "<h4>Pending submissions (" + subs.length + ")</h4>" +
    (subs.length ? "<ul>" + subs.map((s) => "<li><strong>" + escapeHtml(s.title) + "</strong> — " + escapeHtml(s.contact_name || "") + " · " + escapeHtml(s.contact_email || "") +
      ' <button type="button" class="btn btn-small" data-action="admin-approve" data-id="' + s.id + '">Approve</button> <button type="button" class="btn btn-small btn-ghost" data-action="admin-needs" data-id="' + s.id + '">Needs changes</button></li>').join("") + "</ul>" : "<p class='fineprint'>No pending submissions.</p>") +
    "<h4>Professional interest (" + pros.length + ")</h4>" +
    (pros.length ? "<ul>" + pros.map((pr) => "<li><strong>" + escapeHtml(pr.name || "") + "</strong> — " + escapeHtml(pr.role_category || "") + " · " + escapeHtml(pr.email || "") + "</li>").join("") + "</ul>" : "<p class='fineprint'>No professional interest records.</p>") +
    "<p class='fineprint'>Nothing here publishes anything automatically — approving a submission only updates its review status.</p>";
}

/* ---------- legal & trust center ---------- */
const LEGAL_DOCS = window.GLX_LEGAL || [];
const legalBySlug = (slug) => LEGAL_DOCS.find((d) => d.slug === slug);
const DRAFT_BANNER = '<p class="draft-banner" role="note">DRAFT — pending qualified legal review. Not yet legal advice or a binding published policy.</p>';
function legalDocHtml(doc, backLabel) {
  return '<div class="section legal-doc">' +
    '<p class="watch-back"><a href="#/legal">&larr; ' + (backLabel || "Legal &amp; Trust Center") + '</a></p>' +
    DRAFT_BANNER + doc.html +
    '<p class="fineprint">Draft — pending legal review. This document is published for transparency and is not legal advice or a binding published policy.</p></div>';
}
function renderLegalIndex() {
  const el = $("#legal-index");
  if (!el) return;
  el.innerHTML = '<p class="section-intro" style="padding-left:0">Every GreenlitX policy in one place. All documents are drafts pending qualified legal review.</p>' +
    DRAFT_BANNER +
    '<ul class="legal-list">' + LEGAL_DOCS.map((d) => '<li><a href="#/legal/' + d.slug + '">' + escapeHtml(d.title) + '</a></li>').join("") + "</ul>" +
    '<p><a class="btn btn-ghost" href="#/funding">Funding Transparency</a></p>';
}
function renderLegalDoc(slug) {
  const el = $("#legal-doc");
  if (!el) return;
  const doc = legalBySlug(slug);
  if (!doc) { el.innerHTML = '<div class="section"><h2 tabindex="-1">Document not found</h2><p><a href="#/legal">Back to the Legal &amp; Trust Center</a>.</p></div>'; return; }
  el.innerHTML = legalDocHtml(doc);
}
function renderFunding() {
  const el = $("#funding-body");
  if (!el) return;
  const doc = legalBySlug("funding-transparency");
  if (!doc) { el.innerHTML = '<div class="section"><h2 tabindex="-1">Funding Transparency</h2><p>This page is unavailable right now.</p></div>'; return; }
  el.innerHTML = legalDocHtml(doc);
}
/* ---------- professionals & submissions ---------- */
const PRO_CATEGORIES = ["Actors", "Directors", "Producers", "Screenwriters", "Cinematographers", "Editors", "Composers", "Animators", "AI Filmmakers", "Production Designers"];
const PRO_CAT_KEYS = ["pro.cat.actors", "pro.cat.directors", "pro.cat.producers", "pro.cat.screenwriters", "pro.cat.cinematographers", "pro.cat.editors", "pro.cat.composers", "pro.cat.animators", "pro.cat.aiFilmmakers", "pro.cat.productionDesigners"];
function rolesHtml() {
  return '<div class="roles-box"><h3>' + escapeHtml(t("roles.heading")) + "</h3><ul>" +
    ["roles.audience", "roles.filmmakers", "roles.professionals", "roles.supporters"].map((k) => "<li>" + escapeHtml(t(k)) + "</li>").join("") + "</ul></div>";
}
function fillRoles(id) { const el = document.getElementById(id); if (el) el.innerHTML = rolesHtml(); }
function renderPros() {
  fillRoles("roles-pro");
  $("#pro-grid").innerHTML = PRO_CATEGORIES.map((c, i) =>
    '<div class="pro-card">' + escapeHtml(t(PRO_CAT_KEYS[i])) + '<br><button type="button" class="btn btn-small" data-action="pro" data-cat="' + escapeHtml(c) + '">' + escapeHtml(t("pro.registerButton")) + '</button></div>').join("");
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
  $$(".lang-flag").forEach((b) => { const on = b.dataset.lang === lang; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("active", on); });
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
  const navBtn = e.target.closest("#nav-toggle");
  if (navBtn) {
    const nav = $("#main-nav"); const open = nav.classList.toggle("open");
    navBtn.setAttribute("aria-expanded", String(open));
    navBtn.setAttribute("aria-label", open ? t("nav.closeMenu") : t("nav.openMenu"));
    if (open) { const first = nav.querySelector("a"); if (first) first.focus(); }
    return;
  }
  const flagBtn = e.target.closest("[data-lang]");
  if (flagBtn) { setLang(flagBtn.dataset.lang); return; }
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
    if (chip.dataset.type != null) state.typeFilter = chip.dataset.type;
    renderDiscover(); return;
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
    const custom = $("#pledge-custom"); if (custom) custom.value = "";
    refreshDynamic();
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
    state.query = ""; state.genreExact = "All"; state.stageFilter = "All"; state.typeFilter = "All";
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
  }
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
  else if (el.id === "stage-select") { state.stageFilter = el.value; renderDiscover(); }
});
const draftBtn = $("#submit-savedraft");
if (draftBtn) draftBtn.addEventListener("click", () => { saveSubmitDraft(); const m = $("#submit-draft-msg"); if (m) m.textContent = t("submit2.draftSaved"); });
document.addEventListener("keydown", (e) => {
  if (lightboxState) {
    if (e.key === "Escape") { closeLightbox(); return; }
    if (e.key === "ArrowRight") { stepLightbox(1); return; }
    if (e.key === "ArrowLeft") { stepLightbox(-1); return; }
  }
  if (e.key === "Escape") {
    const nav = $("#main-nav");
    if (nav && nav.classList.contains("open")) {
      nav.classList.remove("open");
      const tgl = $("#nav-toggle");
      if (tgl) { tgl.setAttribute("aria-expanded", "false"); tgl.setAttribute("aria-label", t("nav.openMenu")); tgl.focus(); }
    }
  }
});
window.addEventListener("hashchange", render);
window.addEventListener("pageshow", (e) => { if (e.persisted) render(); });
render();
sbInit();
