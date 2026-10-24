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

const POSTER_READY = { "the-last-train-below": 1, "the-second-moon": 1, "the-devils-frequency": 1, "the-keeper-of-forgotten-things": 1, "tomorrows-witness": 1 };
const FEATURED = ["the-last-train-below", "the-second-moon", "the-devils-frequency", "the-keeper-of-forgotten-things", "tomorrows-witness"];
const TYPES = ["LIVE ACTION", "AI FILM", "HYBRID", "ANIMATION"];

function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
const state = {
  votes: new Set(load("glx2_votes", [])),
  follows: new Set(load("glx2_follows", [])),
  submissions: load("glx2_submissions", []),
  proInterest: new Set(load("glx2_pro_interest", [])),
  genreFilter: "All",
  typeFilter: "All",
  query: ""
};
const filmById = (id) => FILMS.find((f) => f.id === id);

/* ---------- backend (Supabase) ---------- */
const SB_URL = "https://fjrdjspecrnvetlsxxos.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcmRqc3BlY3JudmV0bHN4eG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzQ4MTAsImV4cCI6MjEwODQ1MDgxMH0.FuSoy9qytnRDbLWJolkvy1bTk2CB2AAkNNO09H3QpW0";
const sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SB_URL, SB_ANON) : null;
const server = { user: null, counts: {}, ready: false };
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
  try {
    const { data } = await sb.auth.getSession();
    server.user = data && data.session ? data.session.user : null;
    if (server.user) { await sbMigrateGuest(); await sbFetchMine(); }
    await sbFetchCounts();
    server.ready = true;
    updateAccountNav(); refreshDynamic();
    sb.auth.onAuthStateChange(async (_evt, session) => {
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
        '<div class="showcase-actions"><a class="btn btn-play" href="#/discover">▶ Browse the 40 films</a>' +
        '<button type="button" class="btn btn-ghost" data-scroll="teaser">Watch the teaser</button></div>' +
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
  $("#home-rows").innerHTML = SECTIONS.map((s) => {
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

/* ---------- film detail ---------- */
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
  const heroArt = POSTER_READY[film.id]
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
    '<div class="action-panel"><h3>Back this film</h3>' +
    '<p class="big-count">$0 <small>collected of ' + fmtMoney(film.budget) + " goal</small></p>" +
    '<div class="progress" role="img" aria-label="Funding progress: 0 percent"><div class="bar" style="width:0%"></div></div>' +
    '<p class="panel-note">Conditional pledges — $5 / $10 / $25 / $50 / $100 or a custom amount — open with founding memberships in January 2027. A pledge is only ever charged if the project reaches its funding goal by its deadline.</p>' +
    '<button type="button" class="btn" disabled>Pledging opens January 2027</button></div>' +
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
  if (!server.user) {
    el.innerHTML =
      "<p class='section-intro' style='padding-left:0'>Create a free account to make your Green Light count on every device — one per person per film, protected against duplicates. As a guest, your Green Lights still count on this device.</p>" +
      "<form id='auth-form' novalidate>" +
      "<div class='field'><label for='a-email'>Email</label><input id='a-email' type='email' autocomplete='email' required></div>" +
      "<div class='field'><label for='a-pass'>Password</label><input id='a-pass' type='password' autocomplete='current-password' required></div>" +
      "<button class='btn btn-primary' type='submit' name='mode' value='signin'>Sign in</button> " +
      "<button class='btn' type='submit' name='mode' value='signup'>Create account</button>" +
      "<p class='form-msg' id='auth-msg' role='status'></p>" +
      "<p class='fineprint'>New accounts confirm by email first. We store your email, an optional display name, your Green Lights and follows — nothing else. No ads, no selling data.</p></form>";
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
  el.innerHTML =
    "<p>Signed in as <strong>" + escapeHtml(u.email || "") + "</strong></p>" +
    "<form id='profile-form' novalidate><div class='field'><label for='a-name'>Display name (optional, shown with your support)</label><input id='a-name' value='" + escapeHtml(profileName) + "'></div>" +
    "<button class='btn' type='submit'>Save name</button> <span class='form-msg' id='profile-msg' role='status'></span></form>" +
    "<h3 style='margin-top:2rem'>My Green Lights (" + state.votes.size + ")</h3>" + filmLinks(Array.from(state.votes)) +
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
    await sb.from("profiles").delete().eq("id", u.id);
    await sb.auth.signOut();
    $("#account-msg").textContent = "Your data has been deleted and you are signed out.";
  });
}

/* ---------- professionals & submissions ---------- */
const PRO_CATEGORIES = ["Actors", "Directors", "Producers", "Screenwriters", "Cinematographers", "Editors", "Composers", "Animators", "AI Filmmakers", "Production Designers"];
function renderPros() {
  $("#pro-grid").innerHTML = PRO_CATEGORIES.map((c) =>
    '<div class="pro-card">' + escapeHtml(c) + '<br><button type="button" class="btn btn-small" data-action="pro" data-cat="' + escapeHtml(c) + '" aria-pressed="' + state.proInterest.has(c) + '">' +
    (state.proInterest.has(c) ? "Interest registered ✓" : "Register interest") + "</button></div>").join("");
}
function renderSubmissions() {
  const list = $("#submission-list"), count = $("#submission-count");
  count.textContent = state.submissions.length ? state.submissions.length + " saved on this device, awaiting the review system launch." : "None yet.";
  list.innerHTML = state.submissions.map((s) => "<li><strong>" + escapeHtml(s.title) + "</strong> — " + escapeHtml(s.genre) + " · " + escapeHtml(s.type) + " · by " + escapeHtml(s.name) + "</li>").join("");
}

/* ---------- routing ---------- */
const VIEWS = ["home", "discover", "film", "professionals", "submit", "account"];
function parseRoute() {
  const h = (location.hash || "#/home").replace(/^#\//, "");
  const parts = h.split("/");
  if (parts[0] === "film" && parts[1]) return { view: "film", id: parts[1] };
  return { view: VIEWS.includes(parts[0]) ? parts[0] : "home" };
}
function render() {
  const r = parseRoute();
  if (r.view !== "home" && showcaseTimer) { clearInterval(showcaseTimer); showcaseTimer = null; }
  VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== r.view; });
  $$(".main-nav a").forEach((a) => {
    if (a.dataset.nav === r.view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  $("#main-nav").classList.remove("open");
  $("#nav-toggle").setAttribute("aria-expanded", "false");
  if (r.view === "home") renderHome();
  if (r.view === "discover") renderDiscover();
  if (r.view === "film") renderFilmDetail(r.id);
  if (r.view === "professionals") renderPros();
  if (r.view === "submit") renderSubmissions();
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
  } else if (btn.dataset.action === "pro") {
    const cat = btn.dataset.cat;
    state.proInterest.has(cat) ? state.proInterest.delete(cat) : state.proInterest.add(cat);
    save("glx2_pro_interest", Array.from(state.proInterest));
    $("#pro-msg").textContent = state.proInterest.has(cat) ? "Interest registered for: " + cat + " (saved on this device)." : "";
    renderPros();
  }
});
$("#search").addEventListener("input", (e) => { state.query = e.target.value; renderDiscover(); });
$("#submit-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const get = (id) => $(id).value.trim();
  const entry = { title: get("#f-title"), genre: get("#f-genre"), logline: get("#f-logline"), synopsis: get("#f-synopsis"), type: $("#f-type").value, status: get("#f-status"), name: get("#f-name"), rights: $("#f-rights").value, target: get("#f-target"), email: get("#f-email") };
  if (!entry.title || !entry.genre || !entry.logline || !entry.synopsis || !entry.type || !entry.status || !entry.name || !entry.rights || !entry.email || !$("#f-terms").checked) {
    $("#submit-msg").textContent = "Please complete every required field and agree to the submission terms."; return;
  }
  state.submissions.push(entry); save("glx2_submissions", state.submissions);
  e.target.reset();
  $("#submit-msg").textContent = "Received on this device — submissions are reviewed before publication; the review system opens with the platform launch.";
  renderSubmissions();
});
window.addEventListener("hashchange", render);
window.addEventListener("pageshow", (e) => { if (e.persisted) render(); });
render();
sbInit();
