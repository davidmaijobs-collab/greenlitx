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
const LANGS = ["en", "es", "de", "fr", "pt-BR", "it"];
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
let favGenres = new Set(load("glx_fav_genres", []));
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
  genreFilter: "All",
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
let recoveryMode = false; // true while a password-recovery link flow is in progress
const server = { user: null, pledgeTotals: {}, myPledges: [], ready: false };
const PLEDGE_AMOUNTS = [500, 1000, 2500, 5000, 10000];
const PLEDGE_MICRO = "Nonbinding pledge interest: no card is charged, no payment is authorized, this is not a commitment, and Stripe is not active on GreenlitX.";
const pledgeMicro = () => t("pledge.nonbinding") + (lang !== "en" && isLegalKey("pledge.nonbinding") ? "" : "");
let pledgePick = { filmId: null, cents: 2500 };
const fmtCents = (c) => "$" + (Number(c || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
/* Supporter interest = real recorded pledge-interest rows (Supabase pledge_totals). */
const supporterCount = (film) => Number((server.pledgeTotals[film.id] || {}).backers || 0);
const supporterTotal = (film) => Number((server.pledgeTotals[film.id] || {}).pledged_cents || 0);
function fundingFactsHtml(film) {
  const n = supporterCount(film), t = supporterTotal(film);
  return '<dl class="funding-facts">' +
    '<div><dt>Estimated production budget</dt><dd>' + fmtMoney(film.budget) + '</dd></div>' +
    '<div><dt>Audience funding target</dt><dd>To be determined</dd></div>' +
    '<div><dt>Supporter interest</dt><dd>' + (n ? n + (n === 1 ? " supporter" : " supporters") + " · " + fmtCents(t) + " interest recorded" : "No supporter interest recorded yet") + '</dd></div>' +
    '<div><dt>Funds collected</dt><dd>$0 — payments are not yet active</dd></div></dl>';
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
  if (location.hash.includes("type=recovery")) recoveryMode = true;
  try {
    const { data } = await sb.auth.getSession();
    server.user = data && data.session ? data.session.user : null;
    if (server.user) { await sbMigrateGuest(); await sbFetchMine(); }
    await sbFetchCounts();
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
      updateAccountNav(); refreshDynamic();
    });
  } catch (e) {}
}
function updateAccountNav() {
  const link = document.querySelector('[data-nav="account"]');
  if (link) link.textContent = server.user ? "My Account" : "Account";
}

/* ---------- posters ---------- */
const GENRE_HUES = [
  [/horror/i, 350], [/romance|romantic/i, 330], [/comedy/i, 38], [/animation|animated|family|fantasy/i, 265],
  [/historical|adventure|epic/i, 24], [/crime|thriller|mystery|espionage|legal|political/i, 222],
  [/sci-fi|science|space|dystopian|apocalyptic|technology/i, 200], [/drama/i, 160]
];
function genreHue(film) { for (const [re, h] of GENRE_HUES) if (re.test(film.genre)) return h; return 210; }
function posterHtml(film) {
  const badge = '<span class="ptype-badge">' + escapeHtml(film.productionType) + "</span>";
  if (POSTER_READY[film.id]) {
    return badge + '<img src="posters/' + film.id + '.webp" width="880" height="1320" loading="lazy" alt="' + escapeHtml(t("card.posterAlt", { title: film.title })) + '">';
  }
  return badge +
    '<div class="poster-typo" style="--hue:' + genreHue(film) + '">' +
    '<div class="typo-tag">' + escapeHtml(film.tagline) + '</div>' +
    '<div class="typo-title">' + escapeHtml(film.title) + "</div></div>";
}
function cardHtml(film) {
  return '<figure class="card">' +
    '<a class="poster-link" href="#/film/' + film.id + '" aria-label="' + escapeHtml(t("card.viewProject", { title: film.title })) + '">' +
    '<div class="poster">' + posterHtml(film) + "</div></a>" +
    '<figcaption><p class="card-title">' + escapeHtml(film.title) + '</p>' +
    '<p class="card-meta">' + escapeHtml(film.genre) + " · " + escapeHtml(film.runtime) + " · " + fmtMoney(film.budget) + "</p>" +
    '<p class="card-support"><b>' + supporterCount(film) + "</b> supporter interest" + (supporterTotal(film) ? " · " + fmtCents(supporterTotal(film)) + " pledged interest" : "") + "</p>" +
    '<p class="card-actions"><button type="button" class="btn btn-small btn-ghost" data-action="save" data-id="' + film.id + '" aria-pressed="' + savedFilms.has(film.id) + '">' + (savedFilms.has(film.id) ? t("follow.saved") : t("follow.save")) + "</button></p></figcaption></figure>";
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
  { title: "Featured Projects", films: () => FLAGSHIPS.map(filmById).filter(Boolean) },
  { title: "Science Fiction", films: () => FILMS.filter((f) => bucket(f, "scifi")) },
  { title: "Thrillers and Horror", films: () => FILMS.filter((f) => bucket(f, "thriller")) },
  { title: "Historical and Adventure", films: () => FILMS.filter((f) => bucket(f, "history")) },
  { title: "Romance and Drama", films: () => FILMS.filter((f) => bucket(f, "romance")) },
  { title: "Comedy", films: () => FILMS.filter((f) => bucket(f, "comedy")) },
  { title: "Animation and Family", films: () => FILMS.filter((f) => bucket(f, "animation")) },
  { title: "AI Films", films: () => FILMS.filter((f) => f.productionType === "AI FILM") },
  { title: "Live-Action Films", films: () => FILMS.filter((f) => f.productionType === "LIVE ACTION") },
  { title: "Hybrid Productions", films: () => FILMS.filter((f) => f.productionType === "HYBRID") },
  { title: "Newly Added", films: () => FILMS.slice().sort((a, b) => b.n - a.n) },
  { title: "Discover All 40", films: () => FILMS.slice(), link: "#/discover" }
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
        '<p class="showcase-kicker">GreenlitX — a film platform powered by its audience</p>' +
        '<h1 class="showcase-title" tabindex="-1">Hollywood decides what gets made today. <span class="accent">On GreenlitX, the audience does.</span></h1>' +
        '<p class="showcase-log">Forty original films are in development — live action, AI, hybrid and animation. Discover them, follow them, and record nonbinding pledge interest to help bring them to life.</p>' +
        '<div class="showcase-actions"><a class="btn btn-primary" href="#/discover">Discover Films</a>' +
        '<a class="btn btn-ghost" href="#/watch">Watch Free</a></div>' +
        '<div class="hero-steps" aria-label="How it works"><span><b>1</b>&nbsp; DISCOVER FILMS</span><span><b>2</b>&nbsp; SUPPORT FILMS</span><span><b>3</b>&nbsp; WATCH FREE</span></div>' +
        "</div></div></div>";
    }
    const f = s;
    return '<div class="showcase-slide' + (i === 0 ? " active" : "") + '">' +
      '<img class="backdrop" src="backdrops/' + f.id + '.webp" width="1600" height="900" alt="" aria-hidden="true">' +
      '<div class="showcase-shade"></div>' +
      '<div class="showcase-content"><div class="showcase-inner">' +
      '<p class="showcase-kicker">Featured · ' + escapeHtml(f.productionType) + "</p>" +
      '<p class="showcase-title">' + escapeHtml(f.title) + "</p>" +
      '<p class="showcase-tag">' + escapeHtml(f.tagline) + "</p>" +
      '<p class="showcase-log">' + escapeHtml(f.logline) + "</p>" +
      '<div class="showcase-actions"><a class="btn btn-play" href="#/film/' + f.id + '">View project</a>' +
      '<button type="button" class="btn btn-ghost" data-scroll="trailer">▶ Trailer</button>' +
      '<span class="showcase-meta">' + escapeHtml(f.genre) + " · " + escapeHtml(f.runtime) + " · " + fmtMoney(f.budget) + " · " + supporterCount(f) + " supporter interest</span></div>" +
      "</div></div></div>";
  }).join("");
  const dots = slides.map((s, i) => '<button type="button" data-slide="' + i + '" aria-current="' + (i === 0) + '" aria-label="Showcase slide ' + (i + 1) + '"></button>').join("");
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
function renderHome() {
  startShowcase();
  const tonight = WATCH.filter((w) => w.category === "modern");
  const watchRow = tonight.length ?
    '<section class="row-section" aria-label="Watch Free tonight">' +
    '<div class="section-head"><h2>Watch Free tonight</h2><a class="section-link" href="#/watch">All free films →</a></div>' +
    '<div class="poster-row">' + tonight.map(watchCardHtml).join("") + "</div></section>" : "";
  const recentRow = recentFilms.length ?
    '<section class="row-section" aria-label="Recently viewed"><div class="section-head"><h2>Recently viewed</h2></div>' +
    '<div class="poster-row">' + recentFilms.map(filmById).filter(Boolean).map(cardHtml).join("") + "</div></section>" : "";
  $("#home-rows").innerHTML = watchRow + recentRow + SECTIONS.map((s) => {
    const films = s.films();
    if (!films.length) return "";
    return '<section class="row-section" aria-label="' + escapeHtml(s.title) + '">' +
      '<div class="section-head"><h2>' + escapeHtml(s.title) + "</h2>" +
      (s.link ? '<a class="section-link" href="' + s.link + '">View all →</a>' : "") + "</div>" +
      '<div class="poster-row">' + films.map(cardHtml).join("") + "</div></section>";
  }).join("");
}

/* ---------- discover ---------- */
const GENRE_FILTERS = ["All", "Science Fiction", "Thrillers & Horror", "Historical & Adventure", "Romance & Drama", "Comedy", "Animation & Family"];
const GENRE_BUCKET = { "Science Fiction": "scifi", "Thrillers & Horror": "thriller", "Historical & Adventure": "history", "Romance & Drama": "romance", "Comedy": "comedy", "Animation & Family": "animation" };
function chipsHtml(items, current, attr) {
  const fav = attr === "genre" ? items.filter((i) => i !== "All").map((i) =>
    '<button type="button" class="chip chip-fav" data-action="genre-fav" data-genre-name="' + escapeHtml(i) + '" aria-pressed="' + favGenres.has(i) + '" title="Favorite genre">' + (favGenres.has(i) ? "★ " : "☆ ") + escapeHtml(i) + "</button>").join("") : "";
  return '<span class="chip-label">' + (attr === "genre" ? escapeHtml(t("discover.filterGenre")) : escapeHtml(t("discover.filterMethod"))) + "</span>" + items.map((i) =>
    '<button type="button" class="chip" data-' + attr + '="' + escapeHtml(i) + '" aria-pressed="' + (current === i) + '">' + escapeHtml(i) + "</button>").join("") + fav;
}
function renderChips() {
  $("#genre-chips").innerHTML = chipsHtml(GENRE_FILTERS, state.genreFilter, "genre");
  $("#type-chips").innerHTML = chipsHtml(["All"].concat(TYPES), state.typeFilter, "type");
}
function filteredFilms() {
  const q = state.query.trim().toLowerCase();
  return FILMS.filter((f) => {
    if (state.genreFilter !== "All" && !bucket(f, GENRE_BUCKET[state.genreFilter])) return false;
    if (state.typeFilter !== "All" && f.productionType !== state.typeFilter) return false;
    if (q) {
      const hay = (f.title + " " + f.genre + " " + f.logline + " " + f.synopsis + " " + f.characters.map((c) => c.name + " " + c.role).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderDiscover() {
  renderChips();
  let list = filteredFilms();
  if (state.genreFilter === "All" && favGenres.size) {
    list = list.slice().sort((a, b) => {
      const ga = GENRE_FILTERS.find((g) => GENRE_BUCKET[g] && bucket(a, GENRE_BUCKET[g])) || "";
      const gb = GENRE_FILTERS.find((g) => GENRE_BUCKET[g] && bucket(b, GENRE_BUCKET[g])) || "";
      return (favGenres.has(gb) ? 1 : 0) - (favGenres.has(ga) ? 1 : 0);
    });
  }
  $("#results-count").textContent = t("discover.resultsCount", { shown: list.length, total: FILMS.length });
  $("#discover-grid").innerHTML = list.map(cardHtml).join("");
}

/* ---------- watch free ---------- */
const WATCH = (window.WATCH_FREE || []).slice();
const WATCH_CATS = [
  { key: "All", label: "All" },
  { key: "classic", label: "Classics" },
  { key: "modern", label: "Modern Independent" },
  { key: "short", label: "Short Films" },
  { key: "documentary", label: "Documentaries" }
];
const watchCatLabel = (key) => { const c = WATCH_CATS.find((x) => x.key === key); return c ? c.label : key; };
const watchById = (id) => WATCH.find((w) => w.id === id);
function watchCardHtml(w) {
  return '<figure class="card">' +
    '<a class="poster-link" href="#/watch/' + w.id + '" aria-label="Watch free: ' + escapeHtml(w.title) + '">' +
    '<div class="poster"><img src="' + escapeHtml(w.posterUrl) + '" width="880" height="1320" loading="lazy" alt="Poster for ' + escapeHtml(w.title) + '"></div></a>' +
    '<figcaption><p class="card-title">' + escapeHtml(w.title) + '</p>' +
    '<p class="card-meta">' + w.year + " · " + w.runtimeMinutes + " min · " + escapeHtml(watchCatLabel(w.category)) + "</p>" +
    '<p class="card-actions"><button type="button" class="btn btn-small btn-ghost" data-action="watch-save" data-id="' + w.id + '" aria-pressed="' + watchSaved.has(w.id) + '">' + (watchSaved.has(w.id) ? "Saved to watchlist ✓" : "Save to watchlist") + "</button></p></figcaption></figure>";
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
    '<button type="button" class="chip" data-wcat="' + c.key + '" aria-pressed="' + (state.watchCategory === c.key) + '">' + escapeHtml(c.label) + "</button>").join("");
  const list = watchFiltered();
  const countEl = $("#watch-count");
  if (countEl) countEl.textContent = "Showing " + list.length + " of " + WATCH.length + " free films";
  const savedList = list.filter((w) => watchSaved.has(w.id));
  const savedRow = savedList.length ?
    '<section class="row-section" aria-label="My Watchlist"><div class="section-head"><h2>My Watchlist</h2></div>' +
    '<div class="poster-row">' + savedList.map(watchCardHtml).join("") + "</div></section>" : "";
  const groups = WATCH_CATS.slice(1)
    .map((c) => ({ cat: c, films: list.filter((w) => w.category === c.key) }))
    .filter((g) => g.films.length);
  $("#watch-rows").innerHTML = savedRow + (groups.length ? groups.map((g) =>
    '<section class="row-section" aria-label="' + escapeHtml(g.cat.label) + '">' +
    '<div class="section-head"><h2>' + escapeHtml(g.cat.label) + "</h2></div>" +
    '<div class="poster-row">' + g.films.map(watchCardHtml).join("") + "</div></section>").join("")
    : '<p class="section-intro">No free films match your search yet.</p>');
}
function renderWatchDetail(id) {
  const el = $("#watch-detail");
  const w = watchById(id);
  if (!w) {
    el.innerHTML = '<div class="section"><h2 tabindex="-1">Film not found</h2><p>This free film does not exist. <a href="#/watch">Browse Watch Free</a>.</p></div>';
    return;
  }
  const sourceName = w.source === "youtube" ? "YouTube" : "the Internet Archive";
  const related = WATCH.filter((x) => x.category === w.category && x.id !== w.id);
  el.innerHTML =
    '<div class="section watch-detail">' +
    '<p class="watch-back"><a href="#/watch">&larr; All Watch Free films</a></p>' +
    '<h1 tabindex="-1">' + escapeHtml(w.title) + "</h1>" +
    '<p class="watch-meta">' + w.year + " · " + w.runtimeMinutes + " min · Directed by " + escapeHtml(w.director) + " · " + escapeHtml(watchCatLabel(w.category)) + "</p>" +
    '<div class="player-wrap"><iframe src="' + escapeHtml(w.embedUrl) + '" title="' + escapeHtml(w.title) + ' — free streaming player" loading="lazy" allowfullscreen frameborder="0" referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
    '<p class="watch-synopsis">' + escapeHtml(w.synopsis) + "</p>" +
    '<p><button type="button" class="btn btn-ghost" data-action="watch-save" data-id="' + w.id + '" aria-pressed="' + watchSaved.has(w.id) + '">' + (watchSaved.has(w.id) ? "Saved to watchlist ✓" : "Save to watchlist") + "</button></p>" +
    '<p class="watch-attribution">Streaming via ' + sourceName + ". " + escapeHtml(w.rightsNote) + "</p>" +
    '<p><a class="btn btn-ghost" href="' + escapeHtml(w.sourcePageUrl) + '" target="_blank" rel="noopener">Watch on the source site</a></p>' +
    "</div>" +
    (related.length ?
      '<section class="row-section" aria-label="More like this"><div class="section-head"><h2>More like this</h2></div>' +
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
      '<a class="btn btn-primary" href="#/account">Create a free account to record pledge interest</a>' +
      '<p class="panel-note">Recording pledge interest needs a free account, so your interest is saved to you and can be cancelled any time.</p>';
  } else if (mine) {
    action = '<p class="panel-note"><strong>You have recorded ' + fmtCents(mine.amount_cents) + '</strong> of nonbinding pledge interest in this film. No card has been charged and no payment is authorized.</p>' +
      '<button type="button" class="btn btn-ghost" data-action="pledge-cancel" data-id="' + film.id + '">Cancel my pledge interest</button>';
  } else {
    action = '<div class="pledge-amounts" role="group" aria-label="Choose your pledge amount">' +
      PLEDGE_AMOUNTS.map((c) => '<button type="button" class="chip" data-action="pledge-pick" data-cents="' + c + '" aria-pressed="' + (pledgePick.cents === c) + '">' + fmtCents(c) + "</button>").join("") + "</div>" +
      '<div class="field" style="margin:0.6rem 0"><label for="pledge-custom" style="font-size:0.9rem">Or a custom amount (USD)</label>' +
      '<input id="pledge-custom" type="number" min="1" step="1" placeholder="e.g. 75"></div>' +
      '<button type="button" class="btn btn-primary" data-action="pledge-submit" data-id="' + film.id + '">Record ' + fmtCents(pledgePick.cents) + " pledge interest</button>" +
      '<p class="panel-note">You can cancel your recorded interest any time from this page or your account.</p>';
  }
  return '<div class="action-panel" id="support-panel"><h3>' + escapeHtml(t("pledge.supportThisFilm")) + '</h3>' +
    '<p class="support-sub">' + escapeHtml(t("pledge.chooseAmount")) + '</p>' +
    '<p class="panel-note"><strong>' + escapeHtml(pledgeMicro()) + '</strong>' + draftNoteHtml("pledge.nonbinding") + '</p>' +
    action +
    fundingFactsHtml(film) +
    '<p class="testmode-note">' + PLEDGE_MICRO + '</p></div>';
}

const ROADMAP = ["Concept development", "Script & treatment", "Audience support campaign", "Conditional financing", "Production", "Release"];
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
  const chars = film.characters.map((c) =>
    '<div class="char-card"><h3>' + escapeHtml(c.name) + '</h3><p class="char-role">' + escapeHtml(c.role) + "</p><p>" + escapeHtml(c.note) + "</p></div>").join("");
  const rd = film.roadmapData || {};
  const roadmapHtml =
    '<p class="roadmap-status"><strong>Status: ' + escapeHtml(rd.currentStatus || "Concept Development") + '</strong> — ' + escapeHtml(t("film.roadmapNote")) + "</p>" +
    (rd.completedMilestones && rd.completedMilestones.length ? "<h3>Completed</h3><ul>" + rd.completedMilestones.map((m) => "<li>" + escapeHtml(m) + "</li>").join("") + "</ul>" : "") +
    "<ol>" + ROADMAP.map((s, i) => "<li" + (i === 0 ? ' aria-current="step"><strong>' + escapeHtml(s) + " " + escapeHtml(t("film.youAreHere")) + "</strong>" : ">" + escapeHtml(s)) + "</li>").join("") + "</ol>" +
    (rd.nextSteps && rd.nextSteps.length ? "<h3>Next steps</h3><ul>" + rd.nextSteps.map((m) => "<li>" + escapeHtml(m) + "</li>").join("") + "</ul>" : "");
  const journalHtml = (film.journalEntries && film.journalEntries.length) ?
    '<div class="detail-section"><h2>Development journal</h2>' +
    film.journalEntries.map((j) => '<article class="journal-entry"><p class="journal-date">' + escapeHtml(j.date) + "</p><p>" + escapeHtml(j.entry) + "</p></article>").join("") + "</div>" : "";
  const vision = film.creativeVision || {};
  const visionHtml = (vision.tone || vision.themes || vision.visualIdentity) ?
    '<div class="detail-section"><h2>Creative vision</h2>' +
    (vision.tone ? "<p><strong>Tone.</strong> " + escapeHtml(vision.tone) + "</p>" : "") +
    (vision.themes ? "<p><strong>Themes.</strong> " + escapeHtml(vision.themes) + "</p>" : "") +
    (vision.visualIdentity ? "<p><strong>Visual identity.</strong> " + escapeHtml(vision.visualIdentity) + "</p>" : "") + "</div>" : "";
  const teaserHtml = (isFlagship && TEASERS[film.id]) ?
    '<div class="detail-section"><h2>Concept teaser</h2>' +
    '<div class="trailer-frame"><video controls preload="none" playsinline loading="lazy" poster="backdrops/' + film.id + '.webp" aria-label="Concept teaser for ' + escapeHtml(film.title) + '"><source src="' + TEASERS[film.id] + '" type="video/mp4"></video></div>' +
    '<p class="fineprint">Concept Teaser — not footage from the finished film. Assembled from concept artwork and existing concept motion material.</p></div>' : "";
  const galleryHtml =
    '<div class="detail-section"><h2>Concept artwork</h2><div class="concept-gallery">' +
    '<figure><img src="posters/' + film.id + '.webp" width="880" height="1320" loading="lazy" alt="Concept poster artwork for ' + escapeHtml(film.title) + '"><figcaption>Concept artwork — poster</figcaption></figure>' +
    '<figure><img src="backdrops/' + film.id + '.webp" width="1600" height="900" loading="lazy" alt="Concept backdrop artwork for ' + escapeHtml(film.title) + '"><figcaption>Concept artwork — backdrop</figcaption></figure>' +
    "</div></div>";
  const similar = FILMS.filter((f) => f.id !== film.id && (f.genre === film.genre || f.productionType === film.productionType)).slice(0, 8);
  const similarHtml = similar.length ?
    '<section class="row-section" aria-label="More like this"><div class="section-head"><h2>' + escapeHtml(t("watch.moreLikeThis")) + '</h2></div><div class="poster-row">' + similar.map(cardHtml).join("") + "</div></section>" : "";
  const heroArt = BACKDROPS[film.id]
    ? '<img class="backdrop" src="backdrops/' + film.id + '.webp" width="1600" height="900" alt="" aria-hidden="true">'
    : '<div class="backdrop-gradient" style="--hue:' + genreHue(film) + '"></div>';
  el.innerHTML =
    '<div class="detail-hero">' + heroArt + '<div class="detail-hero-shade"></div>' +
    '<div class="detail-hero-inner"><div class="poster">' + posterHtml(film) + "</div>" +
    '<div><p class="showcase-kicker">' + escapeHtml(film.productionType) + " · " + escapeHtml(film.genre) + (isFlagship ? ' · <span class="featured-badge">Featured Project</span>' : "") + "</p>" +
    '<h1 tabindex="-1">' + escapeHtml(film.title) + "</h1>" +
    '<p class="tagline">' + escapeHtml(filmText(film, "tagline")) + "</p>" +
    '<p class="hero-meta">' + escapeHtml(film.runtime) + " · " + escapeHtml(film.status) + " · " + escapeHtml(t("film.budgetWord")) + " " + fmtMoney(film.budget) + " · For " + escapeHtml(film.audience) + "</p></div>" +
    "</div></div>" +
    '<div class="detail-layout">' +
    '<div class="detail-main">' +
    '<p class="logline">' + escapeHtml(filmText(film, "logline")) + "</p>" +
    '<div class="detail-section"><h2>' + escapeHtml(sectionLabel("theStory", t("film.story"))) + '</h2><p>' + escapeHtml(filmText(film, "synopsis")) + "</p></div>" +
    teaserHtml +
    '<div class="detail-section"><h2>' + escapeHtml(sectionLabel("mainCharacters", t("film.characters"))) + '</h2><div class="char-grid">' + chars + "</div></div>" +
    visionHtml +
    '<div class="detail-section"><h2>' + escapeHtml(sectionLabel("howItWillBeMade", t("film.howMade"))) + '</h2><p><strong>' + escapeHtml(film.productionType) + ".</strong> " + escapeHtml(film.productionApproach || film.productionNote) + "</p>" +
    "<p><strong>Estimated production budget:</strong> " + fmtMoney(film.budget) + " — " + escapeHtml(film.budgetNote) + "</p>" +
    (film.audiencePositioning ? "<p><strong>Audience.</strong> " + escapeHtml(film.audiencePositioning) + "</p>" : "") + "</div>" +
    galleryHtml +
    '<div class="detail-section"><h2>Help bring this film to life</h2>' +
    (film.financingNote ? '<p>' + escapeHtml(film.financingNote) + "</p>" : "") +
    '<p>Your Green Light starts with a pledge. Support for this film is recorded as <strong>nonbinding pledge interest</strong> only — the estimated production budget above is a planning estimate, not a fundraising goal, and this project\'s audience funding target is to be determined. See <a href="#/funding">Funding Transparency</a>.</p></div>' +
    '<div class="detail-section"><h2>' + escapeHtml(sectionLabel("developmentRoadmap", t("film.roadmap"))) + "</h2>" + roadmapHtml + "</div>" +
    journalHtml +
    (film.treatmentHtml ? '<div class="detail-section"><details class="treatment-wrap"><summary>' + escapeHtml(t("film.treatmentToggle")) + '</summary><p class="fineprint">' + escapeHtml(t("film.treatmentNote")) + '</p><div class="treatment">' + film.treatmentHtml + "</div></details></div>" : "") +
    "</div>" +
    '<div class="detail-rail">' +
    '<div class="action-panel"><h3>Follow this project</h3>' +
    '<p class="panel-note">Following is free and keeps this project in your account. A follow is not a pledge — to support the film, record pledge interest below.</p>' +
    '<button type="button" class="btn btn-ghost" data-action="follow" data-id="' + film.id + '" aria-pressed="' + followed + '">' + (followed ? escapeHtml(t("follow.following")) : escapeHtml(t("follow.follow"))) + "</button> " +
    '<button type="button" class="btn btn-ghost" data-action="save" data-id="' + film.id + '" aria-pressed="' + isSaved + '">' + (isSaved ? escapeHtml(t("follow.saved")) : escapeHtml(t("follow.save"))) + "</button></div>" +
    pledgePanelHtml(film) +
    "</div></div>" + similarHtml;
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
      "<form id='auth-form' novalidate>" +
      "<div class='field'><label for='a-email'>Email</label><input id='a-email' type='email' autocomplete='email' required></div>" +
      "<div class='field'><label for='a-pass'>Password</label><input id='a-pass' type='password' autocomplete='current-password' required></div>" +
      "<button class='btn btn-primary' type='submit' name='mode' value='signin'>Sign in</button> " +
      "<button class='btn' type='submit' name='mode' value='signup'>Create account</button>" +
      "<p class='form-msg' id='auth-msg' role='status'></p>" +
      "<p style='margin-top:0.6rem'><button type='button' class='btn btn-ghost' id='forgot-btn'>Forgot password?</button></p>" +
      "<div id='forgot-panel' hidden style='margin-top:0.6rem'>" +
      "<div class='field'><label for='forgot-email'>Email for the reset link</label><input id='forgot-email' type='email' autocomplete='email'></div>" +
      "<button type='button' class='btn' id='forgot-send'>Send reset email</button>" +
      "<p class='form-msg' id='forgot-msg' role='status'></p></div>" +
      "<p class='fineprint'>New accounts confirm by email first. We store your email, an optional display name, your follows and your recorded pledge interest — nothing else. No ads, no selling data.</p></form>";
    $("#forgot-btn").addEventListener("click", () => {
      const panel = $("#forgot-panel");
      const input = $("#forgot-email");
      if (input && !input.value.trim()) input.value = $("#a-email").value.trim();
      panel.hidden = !panel.hidden;
      if (!panel.hidden && input) input.focus();
    });
    $("#forgot-send").addEventListener("click", async () => {
      const status = $("#forgot-msg");
      const email = $("#forgot-email").value.trim();
      if (!email) { status.textContent = "Enter your email address to get a reset link."; return; }
      status.textContent = "Sending your reset email…";
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        status.textContent = error ? "That didn't work: " + error.message : "If an account exists for that email, a reset link is on its way.";
      } catch (err) { status.textContent = "That didn't work: " + (err.message || "unknown error"); }
    });
    $("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const mode = e.submitter && e.submitter.value === "signup" ? "signup" : "signin";
      const email = $("#a-email").value.trim(), pass = $("#a-pass").value;
      const msg = $("#auth-msg");
      msg.textContent = mode === "signup" ? "Creating your account…" : "Signing you in…";
      try {
        if (mode === "signup") {
          const { data, error } = await sb.auth.signUp({ email, password: pass });
          if (error) throw error;
          msg.textContent = data.session ? "Account created — welcome to GreenlitX." : "Account created. Check your email and tap the confirmation link, then sign in.";
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password: pass });
          if (error) throw error;
          msg.textContent = "Signed in.";
        }
      } catch (err) { msg.textContent = "That didn't work: " + (err.message || "unknown error"); }
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
  el.innerHTML =
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
    "<p class='fineprint'>Deleting removes your follows, recorded pledge interest and display name from GreenlitX immediately. To remove the login itself, contact us and we will delete the account completely.</p>";
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
  el.innerHTML =
    '<p class="draft-banner" role="note">Free membership is live. The founding membership campaign is planned — not yet open. No paid membership can be bought today.</p>' +
    "<h2 tabindex='-1'>Membership at GreenlitX</h2>" +
    '<p class="footer-slogan">Hollywood decides what gets made today. On GreenlitX, the audience does.</p>' +
    "<p>Membership is how you take part. As a member, you can discover original projects in development, follow the ones you care about, record your interest, and watch films in the Watch Free collection.</p>" +
    "<h3>Free membership — live now</h3>" +
    "<p>Free membership is live and real. Accounts exist today, and you can create a free account now.</p>" +
    "<ul><li>Discover the current catalog of original projects in concept development</li>" +
    "<li>Follow projects and receive updates about the projects you follow, where you have opted in to those updates</li>" +
    "<li>Record pledge interest in a project — see below for exactly what that means today</li>" +
    "<li>Watch films in the Watch Free collection</li>" +
    "<li>Take part as an audience member in the GreenlitX model: your follows and your recorded interest help show which projects audiences want to see made</li></ul>" +
    "<p>Free membership costs nothing. No payment method is required for free membership.</p>" +
    '<p><a class="btn btn-primary" href="#/account">Create a free account</a></p>' +
    "<h3>The founding membership campaign — planned, not yet open</h3>" +
    "<p>GreenlitX is planning a founding membership campaign, discussed for January 2027.</p>" +
    "<p><strong>That campaign is not open. No founding membership is on sale today, and no payment is being taken for it.</strong></p>" +
    "<p>If a founding campaign opens, full terms will be published before it opens — including what a founding membership is, its price, its duration, the campaign goal and deadline, and what happens if a goal is or is not reached. Nothing about the campaign should be taken as promised until those final terms are published by GreenlitX.</p>" +
    "<h3>Proposed paid tiers — under consideration, not yet finalized</h3>" +
    "<p><strong>Proposed — under consideration, not yet finalized.</strong> The table below is a proposal that has been discussed. It is <strong>not</strong> a price list, <strong>not</strong> an offer, and <strong>not</strong> a promise that any of these tiers will be offered on these terms — or at all.</p>" +
    '<table class="legal-table"><thead><tr><th>Proposed tier</th><th>Proposed amount discussed</th><th>Proposed term discussed</th></tr></thead><tbody>' +
    "<tr><td>Supporter</td><td>$25</td><td>1 year</td></tr>" +
    "<tr><td>Founding</td><td>$50</td><td>2 years</td></tr>" +
    "<tr><td>Founding Plus</td><td>$99</td><td>4 years</td></tr>" +
    "<tr><td>Lifetime Founder</td><td>$199</td><td>Lifetime, with a proposed cap of 500</td></tr>" +
    "<tr><td>Producer</td><td>$499+</td><td>No final terms discussed</td></tr></tbody></table>" +
    "<p>The working approach is free membership first, with any paid membership considered only after the catalog's value is proven. Final tiers, prices, and terms — if paid membership is offered — will be announced only when they are finalized.</p>" +
    "<p>There is no way to buy, reserve, or pre-pay for any tier in this table today.</p>" +
    "<h3>Memberships and pledges are different</h3>" +
    "<p><strong>A membership is about belonging to GreenlitX.</strong> Free membership is your account and your participation on the platform. A founding or paid membership, if offered in the future, would be a payment for membership itself, under that membership campaign's own published terms. A membership payment is <strong>not</strong> a pledge to a film, does <strong>not</strong> fund a specific project, and does <strong>not</strong> count toward any individual project's funding goal.</p>" +
    "<p><strong>A pledge is about one specific film project.</strong> Today, what you can record on GreenlitX is <strong>pledge interest</strong>. Pledge interest is <strong>nonbinding</strong>: it records that you are interested in supporting a project. <strong>No charge is made, no payment method is charged, and no money is collected</strong> for pledge interest. Payments are not yet active on GreenlitX.</p>" +
    "<p>In short: membership = your place on the platform. Pledge interest = your interest in one project. One is never substituted for the other.</p>" +
    "<h3>Questions</h3>" +
    "<p>If final founding campaign terms are published, they will appear on this page. Until then, the accurate statement is the one at the top of this page: free membership is live; the founding campaign is planned — not yet open; proposed paid tiers are under consideration, not yet finalized.</p>" +
    (lang !== "en" ? '<p class="fineprint">' + escapeHtml((I18N.draftNotice && I18N.draftNotice[lang]) || t("legal.draftNotice")) + " — this page is shown in English.</p>" : "");
}
function renderAbout() {
  const el = $("#about-body"); if (!el) return;
  el.innerHTML =
    "<h2 tabindex='-1'>About GreenlitX</h2>" +
    '<blockquote class="about-slogan">Hollywood decides what gets made today. On GreenlitX, the audience does.</blockquote>' +
    "<h3>Our mission</h3><p>GreenlitX exists to give audiences a real say in which original film projects move forward — and to give those projects a public place to be discovered, followed, and supported before a traditional gatekeeper has decided their fate for them.</p>" +
    "<p>Our mission is simple: build a platform where interest is visible, participation is open, and the decision about what deserves to be made is informed by the people who would actually watch it.</p>" +
    "<h3>Why GreenlitX exists</h3><p>Most films never reach an audience for one reason: they never get past a closed decision. A small number of executives, committees, and buyers decide — in private, on criteria audiences never see — which stories are financed and which are set aside, often before a single future viewer has had the chance to respond to them.</p>" +
    "<p>That system leaves two gaps. Audiences have no meaningful way to signal, early enough to matter, what they want to see. And original projects without an existing connection into that system have no public way to demonstrate that an audience exists for them.</p>" +
    "<p>GreenlitX was created to close those gaps in the open: a catalog anyone can browse, projects anyone can follow, and interest that is recorded and visible rather than guessed at in a closed room.</p>" +
    "<h3>How audiences participate</h3>" +
    "<p><strong>1. Discover.</strong> Browse the catalog of original projects in development — live action, hybrid, AI film, and animation. Each project page presents the project's concept and treatment so you can judge the idea itself, not a marketing summary of it.</p>" +
    "<p><strong>2. Follow.</strong> Follow the projects you care about. Following is how you say \u201ckeep me updated on this one\u201d and how the platform can show, in aggregate, where audience attention actually is.</p>" +
    "<p><strong>3. Record pledge interest.</strong> On a project page you can record pledge interest — an indication that you would be interested in supporting that project. Pledge interest today is <strong>nonbinding</strong>. Payments are not yet active on GreenlitX, so recording interest <strong>does not charge you, does not collect any money, and does not commit you to pay anything</strong>.</p>" +
    "<p><strong>4. Watch Free.</strong> GreenlitX also carries a Watch Free collection — complete films and genuine documentaries, principally from the 1970s through the 2010s, that are lawfully available to watch.</p>" +
    "<p>Free membership is live, and accounts exist today. Free membership is how you follow projects, record interest, and manage your participation.</p>" +
    "<h3>How original projects are developed</h3><p>The original projects on GreenlitX are developed as concepts first: a premise is worked into a treatment — the story, its world, and its intended form — together with poster artwork, so audiences can respond to something concrete. Projects are presented at the stage they are actually at. A project in the catalog is a project <strong>in concept development</strong>; its presence in the catalog is not a claim that it is financed, in production, cast, or scheduled for release.</p>" +
    "<p>Audience response is part of development. Follows and recorded pledge interest show which concepts are finding their audience, and that evidence informs which projects GreenlitX prioritizes for further development.</p>" +
    "<h3>How filmmakers submit</h3><p>Filmmakers can submit an original project for consideration through the submission route on the platform. A submission is a request for consideration, not a guarantee of listing, development, funding, or production. Submissions are reviewed before anything is published. Do not submit material you do not have the right to submit.</p>" +
    "<h3>How professionals participate</h3><p>Film professionals can register professional interest through the platform. Registering professional interest records your interest in being considered for future work connected with projects as they develop. It is not a job offer, not a booking, and not a promise of work.</p>" +
    "<h3>How the audience-decides model differs from studio gatekeeping</h3>" +
    "<p><strong>Open catalog, not a closed slate.</strong> Projects are shown publicly, so anyone can discover them.</p>" +
    "<p><strong>Visible interest, not private assumption.</strong> Follows and recorded interest are audience signals that can be counted and shown.</p>" +
    "<p><strong>Participation before production.</strong> Audiences respond while a project is still a concept — early enough for that response to inform whether and how it is developed further.</p>" +
    "<p><strong>No promise disguised as a decision.</strong> Audience support informs GreenlitX's decisions; it does not by itself finance a film, guarantee production, or guarantee release.</p>" +
    "<p>That is the meaning of the line this platform stands on: <strong>Hollywood decides what gets made today. On GreenlitX, the audience does.</strong></p>" +
    "<h3>Where GreenlitX is now — stated honestly</h3><p>GreenlitX is an <strong>early-stage platform</strong>. The catalog of original projects is in <strong>concept development</strong>. Free accounts, following, recorded pledge interest, project submissions, and professional-interest registration are the live participation features. The Watch Free collection is live, within the lawful pool available for it. <strong>Payments are not yet active.</strong> No pledges are charged, no paid memberships are sold, and no money is collected through the platform today. A founding membership campaign is planned — not yet open — and proposed paid tiers are under consideration, not yet finalized (see the Membership page).</p>" +
    (lang !== "en" ? '<p class="fineprint">' + escapeHtml((I18N.draftNotice && I18N.draftNotice[lang]) || t("legal.draftNotice")) + " — this page is shown in English.</p>" : "");
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
function renderPros() {
  $("#pro-grid").innerHTML = PRO_CATEGORIES.map((c) =>
    '<div class="pro-card">' + escapeHtml(c) + '<br><button type="button" class="btn btn-small" data-action="pro" data-cat="' + escapeHtml(c) + '">Register interest</button></div>').join("");
  const sel = $("#p-role");
  if (sel && !sel.options.length) {
    sel.innerHTML = '<option value="">Choose…</option>' + PRO_CATEGORIES.map((c) => "<option>" + escapeHtml(c) + "</option>").join("");
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
  if (r.view === "membership") { title = "Membership — GreenlitX"; }
  if (r.view === "about") { title = "About — GreenlitX"; }
  if (r.view === "account") { title = t("account.heading") + " — GreenlitX"; }
  if (r.view === "film") {
    const f = filmById(r.id);
    if (f) { title = f.title + " — GreenlitX"; desc = filmText(f, "logline"); img = "posters/" + f.id + ".webp"; }
  }
  if (r.view === "watchdetail") {
    const w = watchById(r.id);
    if (w) { title = w.title + " — Watch Free — GreenlitX"; desc = w.synopsis || desc; }
  }
  document.title = title;
  setMeta("description", desc); setMeta("og:title", title, true); setMeta("og:description", desc, true); setMeta("og:image", img, true); setMeta("og:type", "website", true);
}
function applyStaticI18n() {
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  $$(".lang-select").forEach((sel) => { sel.value = lang; });
  const acc = document.querySelector('[data-nav="account"]');
  if (acc && !server.user) acc.textContent = t("nav.account");
  const srch = $("#search"); if (srch) { srch.placeholder = t("discover.searchPlaceholder"); srch.setAttribute("aria-label", t("discover.searchLabel")); }
  const ws = $("#watch-search"); if (ws) { ws.placeholder = t("watch.searchPlaceholder"); ws.setAttribute("aria-label", t("watch.searchLabel")); }
}

/* ---------- routing ---------- */
const VIEWS = ["home", "discover", "film", "watch", "watchdetail", "professionals", "submit", "account", "legal", "legaldoc", "funding", "membership", "about"];
function parseRoute() {
  const h = (location.hash || "#/home").replace(/^#\//, "");
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
  const navView = r.view === "watchdetail" ? "watch" : r.view;
  $$(".main-nav a").forEach((a) => {
    if (a.dataset.nav === navView) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  $("#main-nav").classList.remove("open");
  const navTgl = $("#nav-toggle");
  navTgl.setAttribute("aria-expanded", "false");
  navTgl.setAttribute("aria-label", "Open menu");
  if (r.view === "home") renderHome();
  if (r.view === "discover") renderDiscover();
  if (r.view === "film") renderFilmDetail(r.id);
  if (r.view === "watch") renderWatch();
  if (r.view === "watchdetail") renderWatchDetail(r.id);
  if (r.view === "professionals") renderPros();
  if (r.view === "submit") restoreSubmitDraft();
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
    navBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) { const first = nav.querySelector("a"); if (first) first.focus(); }
    return;
  }
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
    if (chip.dataset.genre != null) state.genreFilter = chip.dataset.genre;
    if (chip.dataset.type != null) state.typeFilter = chip.dataset.type;
    renderDiscover(); return;
  }
  const langSel = e.target.closest(".lang-select");
  if (langSel) return; // handled on change
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "follow") {
    const turnOn = !state.follows.has(id);
    turnOn ? state.follows.add(id) : state.follows.delete(id);
    if (server.user) { sbToggleFollow(id, turnOn).then(refreshDynamic); }
    else save("glx2_follows", Array.from(state.follows));
    refreshDynamic();
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
    btn.disabled = true; btn.textContent = "Recording your pledge interest…";
    sb.from("pledges").insert({ user_id: server.user.id, film_id: id, amount_cents: cents, status: "pledged" })
      .then(async () => { await sbFetchMine(); await sbFetchCounts(); refreshDynamic(); });
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
  } else if (btn.dataset.action === "genre-fav") {
    favGenres.has(btn.dataset.genreName) ? favGenres.delete(btn.dataset.genreName) : favGenres.add(btn.dataset.genreName);
    save("glx_fav_genres", Array.from(favGenres));
    renderDiscover();
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
  if (!entry.title || !entry.genre || !entry.logline || !entry.synopsis || !entry.type || !entry.status || !entry.name || !entry.rights || !entry.email || !$("#f-terms").checked) {
    msg.textContent = "Please complete every required field, declare the rights position, and agree to the submission terms."; return;
  }
  if (!sb) {
    msg.textContent = "Submissions can't be sent right now — the service is unavailable on this device. Your entries are kept in the form; please try again later.";
    return;
  }
  const btn = e.target.querySelector("button[type='submit']");
  btn.disabled = true;
  msg.textContent = "Sending your submission…";
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
    msg.textContent = "That didn't send: " + error.message + " Your entries are still in the form — please try again.";
    return;
  }
  e.target.reset();
  save("glx2_submit_draft", {});
  msg.textContent = "Received — thank you. Your submission is with the GreenlitX review team; nothing is published automatically. Reference: " + row.id.slice(0, 6) + "…" +
    (server.user ? " Track its status under Account → My submissions." : " Create a free account before submitting next time to track its status.");
});
$("#pro-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#pro-msg");
  const name = $("#p-name").value.trim(), email = $("#p-email").value.trim(), role = $("#p-role").value;
  const portfolio = $("#p-portfolio").value.trim(), note = $("#p-note").value.trim();
  if (!name || !email || !role) { msg.textContent = "Please add your name, email, and what you do."; return; }
  if (!sb) {
    msg.textContent = "Interest can't be registered right now — the service is unavailable on this device. Your entries are kept in the form; please try again later.";
    return;
  }
  const btn = e.target.querySelector("button[type='submit']");
  btn.disabled = true;
  msg.textContent = "Registering your interest…";
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
    msg.textContent = "That didn't send: " + error.message + " Your entries are still in the form — please try again.";
    return;
  }
  e.target.reset();
  msg.textContent = "Interest registered — welcome aboard. Reference: " + proRow.id.slice(0, 6) + "… This is an expression of interest only, not a job offer; the team will reach out when productions are staffed.";
});
document.addEventListener("change", (e) => {
  const sel = e.target.closest && e.target.closest(".lang-select");
  if (sel) setLang(sel.value);
});
const draftBtn = $("#submit-savedraft");
if (draftBtn) draftBtn.addEventListener("click", () => { saveSubmitDraft(); const m = $("#submit-draft-msg"); if (m) m.textContent = "Draft saved on this device. A draft is not a submission — submit when you are ready."; });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const nav = $("#main-nav");
    if (nav && nav.classList.contains("open")) {
      nav.classList.remove("open");
      const t = $("#nav-toggle");
      if (t) { t.setAttribute("aria-expanded", "false"); t.setAttribute("aria-label", "Open menu"); t.focus(); }
    }
  }
});
window.addEventListener("hashchange", render);
window.addEventListener("pageshow", (e) => { if (e.persisted) render(); });
render();
sbInit();
