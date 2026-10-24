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
const voteCount = (film) => (state.votes.has(film.id) ? 1 : 0);

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
    '<p class="card-meta">' + escapeHtml(film.genre) + " · " + escapeHtml(film.runtime) + "</p>" +
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
function renderHome() {
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
  el.innerHTML =
    '<div class="detail-layout">' +
    '<div><div class="poster detail-poster">' + posterHtml(film) + "</div>" +
    '<div class="action-panel"><h3>Give a Green Light</h3>' +
    '<p class="big-count">' + voteCount(film) + ' <small>Green Lights</small></p>' +
    '<p class="panel-note">One Green Light per person, per film. It costs nothing — it tells the filmmakers, and us, what the audience wants made.</p>' +
    '<button type="button" class="btn ' + (voted ? "btn-voted" : "btn-primary") + '" data-action="vote" data-id="' + film.id + '" aria-pressed="' + voted + '">' + (voted ? "Green Light given — tap to withdraw" : "Give a Green Light") + "</button> " +
    '<button type="button" class="btn btn-ghost" data-action="follow" data-id="' + film.id + '" aria-pressed="' + followed + '">' + (followed ? "Following ✓" : "Follow project") + "</button></div>" +
    '<div class="action-panel"><h3>Back this film</h3>' +
    '<p class="big-count">$0 <small>collected of ' + fmtMoney(film.budget) + " goal</small></p>" +
    '<div class="progress" role="img" aria-label="Funding progress: 0 percent"><div class="bar" style="width:0%"></div></div>' +
    '<p class="panel-note">Conditional pledges — $5 / $10 / $25 / $50 / $100 or a custom amount — open with founding memberships in January 2027. A pledge is only ever charged if the project reaches its funding goal by its deadline.</p>' +
    '<button type="button" class="btn" disabled>Pledging opens January 2027</button></div></div>' +
    '<div class="detail-main">' +
    '<h1 tabindex="-1">' + escapeHtml(film.title) + "</h1>" +
    '<p class="tagline">' + escapeHtml(film.tagline) + "</p>" +
    '<dl class="detail-facts">' +
    "<div><dt>Production type</dt><dd>" + escapeHtml(film.productionType) + "</dd></div>" +
    "<div><dt>Genre</dt><dd>" + escapeHtml(film.genre) + "</dd></div>" +
    "<div><dt>Intended runtime</dt><dd>" + escapeHtml(film.runtime) + "</dd></div>" +
    "<div><dt>Development status</dt><dd>" + escapeHtml(film.status) + "</dd></div>" +
    "<div><dt>Production budget</dt><dd>" + fmtMoney(film.budget) + "</dd></div>" +
    "<div><dt>Target audience</dt><dd>" + escapeHtml(film.audience) + "</dd></div>" +
    "</dl>" +
    '<p class="logline">' + escapeHtml(film.logline) + "</p>" +
    '<div class="detail-section"><h2>The story</h2><p>' + escapeHtml(film.synopsis) + "</p></div>" +
    '<div class="detail-section"><h2>Main characters</h2><div class="char-grid">' + chars + "</div></div>" +
    '<div class="detail-section"><h2>How it will be made</h2><p><strong>' + escapeHtml(film.productionType) + ".</strong> " + escapeHtml(film.productionNote) + "</p>" +
    "<p><strong>Budget:</strong> " + fmtMoney(film.budget) + " — " + escapeHtml(film.budgetNote) + "</p></div>" +
    '<div class="detail-section"><h2>Development roadmap</h2><ol>' + roadmap + "</ol>" +
    '<p class="fineprint">Every GreenlitX founding project begins at concept development. Nothing here is financed, cast, or in production — the audience campaign is what moves a project forward.</p></div>' +
    (film.treatmentHtml ? '<div class="detail-section"><details class="treatment-wrap"><summary>Read the full development treatment</summary><div class="treatment">' + film.treatmentHtml + "</div></details></div>" : "") +
    "</div></div>";
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
const VIEWS = ["home", "discover", "film", "professionals", "submit"];
function parseRoute() {
  const h = (location.hash || "#/home").replace(/^#\//, "");
  const parts = h.split("/");
  if (parts[0] === "film" && parts[1]) return { view: "film", id: parts[1] };
  return { view: VIEWS.includes(parts[0]) ? parts[0] : "home" };
}
function render() {
  const r = parseRoute();
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
    state.votes.has(id) ? state.votes.delete(id) : state.votes.add(id);
    save("glx2_votes", Array.from(state.votes)); refreshDynamic();
  } else if (btn.dataset.action === "follow") {
    state.follows.has(id) ? state.follows.delete(id) : state.follows.add(id);
    save("glx2_follows", Array.from(state.follows)); refreshDynamic();
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
