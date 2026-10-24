/**
 * GreenlitX — Stage 1 preview application.
 * Real local activity only: Green Light votes and follows start at zero and
 * persist in this browser (localStorage). Server accounts and persistent
 * cross-device voting arrive with the Stage 3 backend (Supabase).
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
const TYPES = ["LIVE ACTION", "AI FILM", "HYBRID", "ANIMATION"];

function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
const state = {
  votes: new Set(load("glx2_votes", [])),
  follows: new Set(load("glx2_follows", [])),
  genreFilter: "All",
  typeFilter: "All",
  query: "",
  watchQuery: "",
  watchCategory: "All"
};
const filmById = (id) => FILMS.find((f) => f.id === id);

/* ---------- backend (Supabase) ---------- */
const SB_URL = "https://fjrdjspecrnvetlsxxos.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcmRqc3BlY3JudmV0bHN4eG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzQ4MTAsImV4cCI6MjEwODQ1MDgxMH0.FuSoy9qytnRDbLWJolkvy1bTk2CB2AAkNNO09H3QpW0";
const sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SB_URL, SB_ANON) : null;
window.GLX_DB = sb;
let recoveryMode = false; // true while a password-recovery link flow is in progress
const server = { user: null, counts: {}, pledgeTotals: {}, myPledges: [], ready: false };
const PLEDGE_DEADLINE = "December 31, 2027";
const PLEDGE_AMOUNTS = [500, 1000, 2500, 5000, 10000];
let pledgePick = { filmId: null, cents: 2500 };
const fmtCents = (c) => "$" + (Number(c || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
const voteCount = (film) => {
  const base = server.counts[film.id] || 0;
  if (server.user) return base; // server counts include my vote when signed in
  return base + (state.votes.has(film.id) ? 1 : 0); // guest: my on-device vote adds to the public total
};
async function sbFetchCounts() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from("vote_counts").select("film_id, votes");
    if (!error && data) { server.counts = {}; data.forEach((r) => { server.counts[r.film_id] = r.votes; }); }
    const pt = await sb.from("pledge_totals").select("film_id, pledged_cents, collected_cents, backers");
    if (!pt.error && pt.data) { server.pledgeTotals = {}; pt.data.forEach((r) => { server.pledgeTotals[r.film_id] = r; }); }
  } catch (e) {}
}
async function sbFetchMine() {
  if (!sb || !server.user) return;
  try {
    const [{ data: v }, { data: f }] = await Promise.all([
      sb.from("votes").select("film_id").eq("user_id", server.user.id),
      sb.from("follows").select("film_id").eq("user_id", server.user.id)
    ]);
    if (v) state.votes = new Set(v.map((r) => r.film_id));
    if (f) state.follows = new Set(f.map((r) => r.film_id));
    const pl = await sb.from("pledges").select("id, film_id, amount_cents, status, created_at").eq("user_id", server.user.id).order("created_at", { ascending: false });
    if (pl.data) server.myPledges = pl.data;
  } catch (e) {}
}
async function sbMigrateGuest() {
  // one-time: turn this device's guest votes/follows into real account votes
  if (!sb || !server.user) return;
  const gv = load("glx2_votes", []), gf = load("glx2_follows", []);
  try {
    if (gv.length) await sb.from("votes").upsert(gv.map((film_id) => ({ user_id: server.user.id, film_id })));
    if (gf.length) await sb.from("follows").upsert(gf.map((film_id) => ({ user_id: server.user.id, film_id })));
  } catch (e) {}
  save("glx2_votes", []); save("glx2_follows", []);
}
async function sbToggle(kind, filmId, turnOn) {
  if (!sb || !server.user) return;
  const table = kind === "vote" ? "votes" : "follows";
  try {
    if (turnOn) await sb.from(table).insert({ user_id: server.user.id, film_id: filmId });
    else await sb.from(table).delete().eq("user_id", server.user.id).eq("film_id", filmId);
    if (kind === "vote") { server.counts[filmId] = Math.max(0, (server.counts[filmId] || 0) + (turnOn ? 1 : -1)); }
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
      if (server.user) { await sbMigrateGuest(); await sbFetchMine(); } else { state.votes = new Set(load("glx2_votes", [])); state.follows = new Set(load("glx2_follows", [])); }
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
    return badge + '<img src="posters/' + film.id + '.webp" width="880" height="1320" loading="lazy" alt="Theatrical poster for ' + escapeHtml(film.title) + '">';
  }
  return badge +
    '<div class="poster-typo" style="--hue:' + genreHue(film) + '">' +
    '<div class="typo-tag">' + escapeHtml(film.tagline) + '</div>' +
    '<div class="typo-title">' + escapeHtml(film.title) + "</div></div>";
}
function cardHtml(film) {
  return '<figure class="card">' +
    '<a class="poster-link" href="#/film/' + film.id + '" aria-label="View project: ' + escapeHtml(film.title) + '">' +
    '<div class="poster">' + posterHtml(film) + "</div></a>" +
    '<figcaption><p class="card-title">' + escapeHtml(film.title) + '</p>' +
    '<p class="card-meta">' + escapeHtml(film.genre) + " · " + escapeHtml(film.runtime) + " · " + fmtMoney(film.budget) + "</p>" +
    '<p class="card-votes"><b>' + voteCount(film) + "</b> Green Lights</p></figcaption></figure>";
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
  { title: "Featured films", films: () => FEATURED.map(filmById).filter(Boolean) },
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
        '<p class="showcase-log">Forty original films are in development — live action, AI, hybrid and animation. Discover them, give your Green Light, and help make them happen.</p>' +
        '<div class="showcase-actions"><a class="btn btn-primary" href="#/watch">WATCH FREE MOVIES</a>' +
        '<a class="btn btn-ghost" href="#/discover">DISCOVER GREEN LIGHT PROJECTS</a></div>' +
        '<div class="hero-steps" aria-label="How it works"><span><b>1</b>&nbsp; DISCOVER</span><span><b>2</b>&nbsp; GREEN LIGHT</span><span><b>3</b>&nbsp; HELP MAKE IT HAPPEN</span></div>' +
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
      '<button type="button" class="btn btn-ghost" data-scroll="teaser">▶ Teaser</button>' +
      '<span class="showcase-meta">' + escapeHtml(f.genre) + " · " + escapeHtml(f.runtime) + " · " + fmtMoney(f.budget) + " · " + voteCount(f) + " Green Lights</span></div>" +
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
  const tonight = WATCH.filter((w) => w.category === "classic" || w.category === "modern");
  const watchRow = tonight.length ?
    '<section class="row-section" aria-label="Watch Free tonight">' +
    '<div class="section-head"><h2>Watch Free tonight</h2><a class="section-link" href="#/watch">All free films →</a></div>' +
    '<div class="poster-row">' + tonight.map(watchCardHtml).join("") + "</div></section>" : "";
  $("#home-rows").innerHTML = watchRow + SECTIONS.map((s) => {
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
  return '<span class="chip-label">' + (attr === "genre" ? "Genre" : "Method") + "</span>" + items.map((i) =>
    '<button type="button" class="chip" data-' + attr + '="' + escapeHtml(i) + '" aria-pressed="' + (current === i) + '">' + escapeHtml(i) + "</button>").join("");
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
  const list = filteredFilms();
  $("#results-count").textContent = "Showing " + list.length + " of " + FILMS.length + " films";
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
    '<p class="card-meta">' + w.year + " · " + w.runtimeMinutes + " min · " + escapeHtml(watchCatLabel(w.category)) + "</p></figcaption></figure>";
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
  const groups = WATCH_CATS.slice(1)
    .map((c) => ({ cat: c, films: list.filter((w) => w.category === c.key) }))
    .filter((g) => g.films.length);
  $("#watch-rows").innerHTML = groups.length ? groups.map((g) =>
    '<section class="row-section" aria-label="' + escapeHtml(g.cat.label) + '">' +
    '<div class="section-head"><h2>' + escapeHtml(g.cat.label) + "</h2></div>" +
    '<div class="poster-row">' + g.films.map(watchCardHtml).join("") + "</div></section>").join("")
    : '<p class="section-intro">No free films match your search yet.</p>';
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
  const t = server.pledgeTotals[film.id] || { pledged_cents: 0, collected_cents: 0, backers: 0 };
  const goalCents = film.budget * 100;
  const pct = Math.min(100, Math.round((Number(t.pledged_cents) / goalCents) * 1000) / 10);
  const mine = server.user ? myPledgeFor(film.id) : null;
  if (pledgePick.filmId !== film.id) pledgePick = { filmId: film.id, cents: 2500 };
  let action = "";
  if (!server.user) {
    action = '<div class="pledge-amounts" aria-hidden="true">' + PLEDGE_AMOUNTS.map((c) => '<span class="chip chip-static">' + fmtCents(c) + "</span>").join("") + "</div>" +
      '<a class="btn btn-primary" href="#/account">Create a free account to pledge</a>' +
      '<p class="panel-note">Pledging needs an account — your card is only ever charged once, if this film reaches 100% of its goal by ' + PLEDGE_DEADLINE + ". Until then, nothing is charged.</p>";
  } else if (mine) {
    action = '<p class="panel-note"><strong>You have pledged ' + fmtCents(mine.amount_cents) + "</strong> to this film. It will be charged once, only if the film reaches 100% of its goal by " + PLEDGE_DEADLINE + " — otherwise it is cancelled automatically and nothing is charged.</p>" +
      '<button type="button" class="btn btn-ghost" data-action="pledge-cancel" data-id="' + film.id + '">Cancel my pledge</button>';
  } else {
    action = '<div class="pledge-amounts" role="group" aria-label="Choose a pledge amount">' +
      PLEDGE_AMOUNTS.map((c) => '<button type="button" class="chip" data-action="pledge-pick" data-cents="' + c + '" aria-pressed="' + (pledgePick.cents === c) + '">' + fmtCents(c) + "</button>").join("") + "</div>" +
      '<div class="field" style="margin:0.6rem 0"><label for="pledge-custom" style="font-size:0.9rem">Or a custom amount (USD)</label>' +
      '<input id="pledge-custom" type="number" min="1" step="1" placeholder="e.g. 75"></div>' +
      '<button type="button" class="btn btn-primary" data-action="pledge-submit" data-id="' + film.id + '">Pledge ' + fmtCents(pledgePick.cents) + " — charged only at 100%</button>" +
      '<p class="panel-note">One charge, only if this film reaches 100% of its goal by ' + PLEDGE_DEADLINE + ". If it doesn't, the pledge is cancelled and nothing is charged. You can cancel your pledge any time before the goal is reached.</p>";
  }
  return '<div class="action-panel"><h3>Back this film</h3>' +
    '<p class="big-count">' + fmtCents(t.pledged_cents) + ' <small>pledged of ' + fmtMoney(film.budget) + " goal · " + (t.backers || 0) + " backers</small></p>" +
    '<div class="progress" role="img" aria-label="Pledged ' + pct + ' percent of goal"><div class="bar" style="width:' + pct + '%"></div></div>' +
    '<p class="panel-note">' + fmtCents(t.collected_cents) + " collected so far. Pledged is not collected: supporters are charged once, only when a project reaches 100%.</p>" +
    action +
    '<p class="testmode-note">Payments are being built and tested — pledges are recorded for real, but no card is charged yet. Live charging starts when the GreenlitX payment account is activated.</p></div>';
}

const ROADMAP = ["Concept development", "Script & treatment", "Audience Green Light campaign", "Conditional financing", "Production", "Release"];
function renderFilmDetail(id) {
  const el = $("#film-detail");
  const film = filmById(id);
  if (!film) {
    el.innerHTML = '<div class="section"><h2 tabindex="-1">Project not found</h2><p>This project does not exist. <a href="#/discover">Browse all films</a>.</p></div>';
    return;
  }
  const voted = state.votes.has(film.id);
  const followed = state.follows.has(film.id);
  const chars = film.characters.map((c) =>
    '<div class="char-card"><h3>' + escapeHtml(c.name) + '</h3><p class="char-role">' + escapeHtml(c.role) + "</p><p>" + escapeHtml(c.note) + "</p></div>").join("");
  const roadmap = ROADMAP.map((s, i) =>
    "<li" + (i === 0 ? ' aria-current="step"><strong>' + escapeHtml(s) + " — you are here</strong>" : ">" + escapeHtml(s)) + "</li>").join("");
  const heroArt = BACKDROPS[film.id]
    ? '<img class="backdrop" src="backdrops/' + film.id + '.webp" width="1600" height="900" alt="" aria-hidden="true">'
    : '<div class="backdrop-gradient" style="--hue:' + genreHue(film) + '"></div>';
  el.innerHTML =
    '<div class="detail-hero">' + heroArt + '<div class="detail-hero-shade"></div>' +
    '<div class="detail-hero-inner"><div class="poster">' + posterHtml(film) + "</div>" +
    '<div><p class="showcase-kicker">' + escapeHtml(film.productionType) + " · " + escapeHtml(film.genre) + "</p>" +
    '<h1 tabindex="-1">' + escapeHtml(film.title) + "</h1>" +
    '<p class="tagline">' + escapeHtml(film.tagline) + "</p>" +
    '<p class="hero-meta">' + escapeHtml(film.runtime) + " · " + escapeHtml(film.status) + " · Budget " + fmtMoney(film.budget) + " · For " + escapeHtml(film.audience) + "</p></div>" +
    "</div></div>" +
    '<div class="detail-layout">' +
    '<div class="detail-main">' +
    '<p class="logline">' + escapeHtml(film.logline) + "</p>" +
    '<div class="detail-section"><h2>The story</h2><p>' + escapeHtml(film.synopsis) + "</p></div>" +
    '<div class="detail-section"><h2>Main characters</h2><div class="char-grid">' + chars + "</div></div>" +
    '<div class="detail-section"><h2>How it will be made</h2><p><strong>' + escapeHtml(film.productionType) + ".</strong> " + escapeHtml(film.productionNote) + "</p>" +
    "<p><strong>Budget:</strong> " + fmtMoney(film.budget) + " — " + escapeHtml(film.budgetNote) + "</p></div>" +
    '<div class="detail-section"><h2>Development roadmap</h2><ol>' + roadmap + "</ol>" +
    '<p class="fineprint">Every GreenlitX founding project begins at concept development. Nothing here is financed, cast, or in production — the audience campaign is what moves a project forward.</p></div>' +
    (film.treatmentHtml ? '<div class="detail-section"><details class="treatment-wrap"><summary>Read the full development treatment</summary><div class="treatment">' + film.treatmentHtml + "</div></details></div>" : "") +
    "</div>" +
    '<div class="detail-rail">' +
    '<div class="action-panel"><h3>Give a Green Light</h3>' +
    '<p class="big-count">' + voteCount(film) + ' <small>Green Lights</small></p>' +
    '<p class="panel-note">One Green Light per person, per film. It costs nothing — it tells the filmmakers, and us, what the audience wants made. ' + (server.user ? "Your Green Light is saved to your account and counts on every device." : 'You are voting as a guest on this device — <a href="#/account">create a free account</a> to make it count everywhere.') + "</p>" +
    '<button type="button" class="btn ' + (voted ? "btn-voted" : "btn-primary") + '" data-action="vote" data-id="' + film.id + '" aria-pressed="' + voted + '">' + (voted ? "Green Light given — tap to withdraw" : "Give a Green Light") + "</button> " +
    '<button type="button" class="btn btn-ghost" data-action="follow" data-id="' + film.id + '" aria-pressed="' + followed + '">' + (followed ? "Following ✓" : "Follow project") + "</button></div>" +
    pledgePanelHtml(film) +
    "</div></div>";
}

/* ---------- account ---------- */
function filmLinks(ids) {
  if (!ids.length) return "<p class='fineprint'>None yet — give a film a Green Light and it will appear here.</p>";
  return "<ul>" + ids.map((id) => { const f = filmById(id); return f ? '<li><a href="#/film/' + f.id + '">' + escapeHtml(f.title) + "</a></li>" : ""; }).join("") + "</ul>";
}
async function renderAccount() {
  const el = $("#account-body");
  if (!el) return;
  if (!sb) { el.innerHTML = "<p>Accounts are temporarily unavailable (the sign-in service could not be loaded). Guest Green Lights still work on this device.</p>"; return; }
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
      "<p class='section-intro' style='padding-left:0'>Create a free account to make your Green Light count on every device — one per person per film, protected against duplicates. As a guest, your Green Lights still count on this device.</p>" +
      "<form id='auth-form' novalidate>" +
      "<div class='field'><label for='a-email'>Email</label><input id='a-email' type='email' autocomplete='email' required></div>" +
      "<div class='field'><label for='a-pass'>Password</label><input id='a-pass' type='password' autocomplete='current-password' required></div>" +
      "<button class='btn btn-primary' type='submit' name='mode' value='signin'>Sign in</button> " +
      "<button class='btn' type='submit' name='mode' value='signup'>Create account</button>" +
      "<p class='form-msg' id='auth-msg' role='status'></p>" +
      "<p style='margin-top:0.6rem'><button type='button' class='btn btn-ghost' id='forgot-btn'>Forgot password?</button></p>" +
      "<p class='fineprint'>New accounts confirm by email first. We store your email, an optional display name, your Green Lights and follows — nothing else. No ads, no selling data.</p></form>";
    $("#forgot-btn").addEventListener("click", async () => {
      const msg = $("#auth-msg");
      const entered = window.prompt("Enter your account email and we'll send you a password reset link:", $("#a-email").value.trim());
      if (entered == null) return;
      const email = entered.trim();
      if (!email) { msg.textContent = "Enter an email address first, then tap Forgot password."; return; }
      msg.textContent = "Sending your reset email…";
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        msg.textContent = error ? "That didn't work: " + error.message : "Reset email sent — check your inbox and tap the link to set a new password.";
      } catch (err) { msg.textContent = "That didn't work: " + (err.message || "unknown error"); }
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
    ? "<ul>" + pledgeRows.map((p) => { const f = filmById(p.film_id); return "<li><strong>" + fmtCents(p.amount_cents) + "</strong> pledged to " + (f ? '<a href="#/film/' + f.id + '">' + escapeHtml(f.title) + "</a>" : escapeHtml(p.film_id)) + ' — charged only if it reaches 100% by ' + PLEDGE_DEADLINE + '. <button type="button" class="btn btn-small btn-ghost" data-action="mypledge-cancel" data-pledge="' + p.id + '">Cancel</button></li>'; }).join("") + "</ul>"
    : "<p class='fineprint'>No active pledges yet.</p>";
  const subStatusLabel = { pending: "Pending review", approved: "Approved", rejected: "Not selected" };
  let mySubsHtml = "<p class='fineprint'>Submission history isn't available right now.</p>";
  try {
    const { data: subs, error: subsErr } = await sb.from("submissions").select("id, title, status").eq("user_id", u.id).order("created_at", { ascending: false });
    if (!subsErr && subs) {
      mySubsHtml = subs.length
        ? "<ul>" + subs.map((s) => "<li><strong>" + escapeHtml(s.title) + "</strong> — " + escapeHtml(subStatusLabel[s.status] || s.status) + "</li>").join("") + "</ul>"
        : "<p class='fineprint'>No submissions yet — <a href='#/submit'>submit a film</a> and it will be tracked here.</p>";
    }
  } catch (e) {}
  el.innerHTML =
    "<p>Signed in as <strong>" + escapeHtml(u.email || "") + "</strong></p>" +
    "<form id='profile-form' novalidate><div class='field'><label for='a-name'>Display name (optional, shown with your support)</label><input id='a-name' value='" + escapeHtml(profileName) + "'></div>" +
    "<button class='btn' type='submit'>Save name</button> <span class='form-msg' id='profile-msg' role='status'></span></form>" +
    "<h3 style='margin-top:2rem'>My Green Lights (" + state.votes.size + ")</h3>" + filmLinks(Array.from(state.votes)) +
    "<h3 style='margin-top:1.6rem'>My pledges (" + pledgeRows.length + ")</h3>" + pledgeHtml +
    "<h3 style='margin-top:1.6rem'>My submissions</h3>" + mySubsHtml +
    "<h3 style='margin-top:1.6rem'>Projects I follow (" + state.follows.size + ")</h3>" + filmLinks(Array.from(state.follows)) +
    "<p style='margin-top:2rem'><button type='button' class='btn' id='signout-btn'>Sign out</button> " +
    "<button type='button' class='btn btn-ghost' id='deletedata-btn'>Delete my Green Lights, follows and profile</button></p>" +
    "<p class='form-msg' id='account-msg' role='status'></p>" +
    "<p class='fineprint'>Deleting removes your votes, follows and display name from GreenlitX immediately. To remove the login itself, contact us and we will delete the account completely.</p>";
  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#a-name").value.trim();
    const { error } = await sb.from("profiles").upsert({ id: u.id, display_name: name || null });
    $("#profile-msg").textContent = error ? "Could not save: " + error.message : "Saved.";
  });
  $("#signout-btn").addEventListener("click", async () => { await sb.auth.signOut(); });
  $("#deletedata-btn").addEventListener("click", async () => {
    await sb.from("votes").delete().eq("user_id", u.id);
    await sb.from("follows").delete().eq("user_id", u.id);
    await sb.from("pledges").delete().eq("user_id", u.id);
    await sb.from("profiles").delete().eq("id", u.id);
    await sb.auth.signOut();
    $("#account-msg").textContent = "Your data has been deleted and you are signed out.";
  });
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

/* ---------- routing ---------- */
const VIEWS = ["home", "discover", "film", "watch", "watchdetail", "professionals", "submit", "account"];
function parseRoute() {
  const h = (location.hash || "#/home").replace(/^#\//, "");
  const parts = h.split("/");
  if (parts[0] === "film" && parts[1]) return { view: "film", id: parts[1] };
  if (parts[0] === "watch" && parts[1]) return { view: "watchdetail", id: parts[1] };
  return { view: VIEWS.includes(parts[0]) ? parts[0] : "home" };
}
function render() {
  const r = parseRoute();
  if (r.view !== "home" && showcaseTimer) { clearInterval(showcaseTimer); showcaseTimer = null; }
  VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== r.view; });
  const navView = r.view === "watchdetail" ? "watch" : r.view;
  $$(".main-nav a").forEach((a) => {
    if (a.dataset.nav === navView) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  $("#main-nav").classList.remove("open");
  $("#nav-toggle").setAttribute("aria-expanded", "false");
  if (r.view === "home") renderHome();
  if (r.view === "discover") renderDiscover();
  if (r.view === "film") renderFilmDetail(r.id);
  if (r.view === "watch") renderWatch();
  if (r.view === "watchdetail") renderWatchDetail(r.id);
  if (r.view === "professionals") renderPros();
  if (r.view === "submit") restoreSubmitDraft();
  if (r.view === "account") renderAccount();
  window.scrollTo(0, 0);
  const focusEl = $("#view-" + r.view + " h1, #view-" + r.view + " h2");
  if (focusEl) focusEl.focus({ preventScroll: true });
}
function refreshDynamic() { const r = parseRoute(); if (r.view === "film") renderFilmDetail(r.id); else render(); }

document.addEventListener("click", (e) => {
  const navBtn = e.target.closest("#nav-toggle");
  if (navBtn) {
    const nav = $("#main-nav"); const open = nav.classList.toggle("open");
    navBtn.setAttribute("aria-expanded", String(open)); return;
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
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "vote") {
    const turnOn = !state.votes.has(id);
    turnOn ? state.votes.add(id) : state.votes.delete(id);
    if (server.user) { sbToggle("vote", id, turnOn).then(refreshDynamic); }
    else save("glx2_votes", Array.from(state.votes));
    refreshDynamic();
  } else if (btn.dataset.action === "follow") {
    const turnOn = !state.follows.has(id);
    turnOn ? state.follows.add(id) : state.follows.delete(id);
    if (server.user) { sbToggle("follow", id, turnOn).then(refreshDynamic); }
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
    btn.disabled = true; btn.textContent = "Recording your pledge…";
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
  const { data, error } = await sb.from("submissions").insert(row).select("id").single();
  btn.disabled = false;
  if (error) {
    msg.textContent = "That didn't send: " + error.message + " Your entries are still in the form — please try again.";
    return;
  }
  e.target.reset();
  save("glx2_submit_draft", {});
  msg.textContent = "Received — thank you. Your submission is with the GreenlitX review team; nothing is published automatically. Reference: " + data.id.slice(0, 6) + "…" +
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
  const { data, error } = await sb.from("pro_interest").insert({
    user_id: server.user ? server.user.id : null,
    name: name,
    email: email,
    role_category: role,
    portfolio_url: portfolio || null,
    note: note || null
  }).select("id").single();
  btn.disabled = false;
  if (error) {
    msg.textContent = "That didn't send: " + error.message + " Your entries are still in the form — please try again.";
    return;
  }
  e.target.reset();
  msg.textContent = "Interest registered — welcome aboard. Reference: " + data.id.slice(0, 6) + "… This is an expression of interest only, not a job offer; the team will reach out when productions are staffed.";
});
window.addEventListener("hashchange", render);
window.addEventListener("pageshow", (e) => { if (e.persisted) render(); });
render();
sbInit();
