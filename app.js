/**
 * GreenlitX — prototype application logic.
 *
 * Pure vanilla JavaScript. No backend, no accounts, no payments.
 * All interactive state (demo votes, simulated pledges, demo submissions)
 * lives in browser localStorage only and never leaves this browser.
 *
 * Data comes from data.js (FILMS, GENRES, PLEDGE_AMOUNTS, REWARD_TIERS,
 * CASTING_DISCLAIMER), which is loaded before this file.
 */

"use strict";

/* ---------------- State ---------------- */

const LS_KEY = "greenlitx_demo_state_v1";
const memoryFallback = { votes: {}, pledges: {}, submissions: [] };

function loadState() {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        votes: parsed.votes || {},
        pledges: parsed.pledges || {},
        submissions: Array.isArray(parsed.submissions) ? parsed.submissions : []
      };
    }
  } catch (e) { /* localStorage unavailable — fall back to memory only */ }
  return memoryFallback;
}

let state = loadState();

function saveState() {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) { /* memory-only mode: state still works for this session */ }
}

/* ---------------- Helpers ---------------- */

function $(sel, root) { return (root || document).querySelector(sel); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function fmtMoney(n) { return "$" + Number(n).toLocaleString("en-US"); }
function fmtNum(n) { return Number(n).toLocaleString("en-US"); }

function supportCount(film) {
  return film.baseSupport + (state.votes[film.id] ? 1 : 0);
}
function pledgedTotal(film) {
  return film.basePledged + (state.pledges[film.id] || 0);
}
function pledgePct(film) {
  return Math.min(100, Math.round((pledgedTotal(film) / film.budget) * 100));
}

/* ---------------- Poster art (original SVG, generated in code) ---------------- */

function seededDots(seedStr, count) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  let out = "";
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const x = seed % 400;
    seed = (seed * 1103515245 + 12345) >>> 0;
    const y = seed % 300;
    const r = ((seed % 10) / 10) * 1.5 + 0.6;
    out += '<circle cx="' + x + '" cy="' + y + '" r="' + r.toFixed(1) + '" fill="#ffffff" opacity="0.65"/>';
  }
  return out;
}

const MOTIFS = {
  orbit: function (a) {
    return '<circle cx="200" cy="245" r="92" fill="' + a + '" opacity="0.9"/>' +
      '<circle cx="168" cy="214" r="19" fill="#000000" opacity="0.18"/>' +
      '<ellipse cx="200" cy="245" rx="168" ry="42" fill="none" stroke="' + a + '" stroke-width="5" opacity="0.75" transform="rotate(-18 200 245)"/>' +
      '<circle cx="324" cy="120" r="13" fill="#ffffff" opacity="0.9"/>';
  },
  peaks: function (a) {
    return '<circle cx="292" cy="112" r="33" fill="' + a + '" opacity="0.9"/>' +
      '<polygon points="0,430 130,235 260,430" fill="#000000" opacity="0.35"/>' +
      '<polygon points="120,430 272,185 420,430" fill="#000000" opacity="0.52"/>' +
      '<polygon points="238,430 342,285 420,430" fill="#000000" opacity="0.66"/>';
  },
  waves: function (a) {
    return '<circle cx="200" cy="140" r="45" fill="' + a + '" opacity="0.9"/>' +
      '<path d="M-10 318 Q 60 288 130 318 T 270 318 T 410 318" stroke="' + a + '" stroke-width="7" fill="none" opacity="0.85"/>' +
      '<path d="M-10 360 Q 60 330 130 360 T 270 360 T 410 360" stroke="#ffffff" stroke-width="5" fill="none" opacity="0.5"/>' +
      '<path d="M-10 402 Q 60 372 130 402 T 270 402 T 410 402" stroke="' + a + '" stroke-width="5" fill="none" opacity="0.45"/>';
  },
  rings: function (a) {
    let out = "";
    const radii = [128, 98, 68, 38];
    for (let i = 0; i < radii.length; i++) {
      out += '<circle cx="200" cy="240" r="' + radii[i] + '" fill="none" stroke="' + a +
        '" stroke-width="6" opacity="' + (0.35 + i * 0.18).toFixed(2) + '"/>';
    }
    return out + '<circle cx="200" cy="240" r="15" fill="' + a + '"/>';
  },
  skyline: function (a) {
    let windows = "";
    const cols = [108, 134, 248, 272];
    const rows = [244, 288, 332];
    for (let i = 0; i < cols.length; i++) {
      for (let j = 0; j < rows.length; j++) {
        if ((i + j) % 2 === 0) {
          windows += '<rect x="' + cols[i] + '" y="' + rows[j] + '" width="9" height="12" fill="' + a + '" opacity="0.8"/>';
        }
      }
    }
    return '<circle cx="318" cy="100" r="25" fill="#ffffff" opacity="0.85"/>' +
      '<rect x="30" y="268" width="52" height="172" fill="#000000" opacity="0.55"/>' +
      '<rect x="96" y="218" width="64" height="222" fill="#000000" opacity="0.65"/>' +
      '<rect x="176" y="298" width="44" height="142" fill="#000000" opacity="0.5"/>' +
      '<rect x="236" y="188" width="58" height="252" fill="#000000" opacity="0.7"/>' +
      '<rect x="308" y="260" width="48" height="180" fill="#000000" opacity="0.55"/>' + windows;
  },
  sun: function (a) {
    return '<circle cx="200" cy="316" r="82" fill="' + a + '"/>' +
      '<rect x="0" y="316" width="400" height="124" fill="#000000" opacity="0.30"/>' +
      '<line x1="118" y1="350" x2="282" y2="350" stroke="' + a + '" stroke-width="5" opacity="0.8"/>' +
      '<line x1="144" y1="382" x2="256" y2="382" stroke="' + a + '" stroke-width="5" opacity="0.6"/>' +
      '<line x1="168" y1="410" x2="232" y2="410" stroke="' + a + '" stroke-width="5" opacity="0.45"/>';
  }
};

function posterSVG(film, context) {
  const p = film.poster;
  const gid = "grad-" + context + "-" + film.id;
  const motif = MOTIFS[p.motif] ? MOTIFS[p.motif](p.accent) : "";
  return '<svg viewBox="0 0 400 600" role="img" aria-label="Original concept artwork for ' +
    escapeHtml(film.title) + ' (demonstration)">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + p.from + '"/><stop offset="1" stop-color="' + p.to + '"/>' +
    '</linearGradient></defs>' +
    '<rect width="400" height="600" fill="url(#' + gid + ')"/>' +
    seededDots(film.id + context, 26) + motif +
    '<rect x="0" y="438" width="400" height="162" fill="#000000" opacity="0.38"/>' +
    '<text x="200" y="514" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-size="27" letter-spacing="2" fill="#ffffff">' +
    escapeHtml(film.title.toUpperCase()) + '</text>' +
    '<text x="200" y="546" text-anchor="middle" font-size="13" letter-spacing="4" fill="' + p.accent + '">' +
    escapeHtml(film.genre.toUpperCase()) + ' · DEMONSTRATION</text></svg>';
}

/* ---------------- Film cards ---------------- */

function filmCard(film, context) {
  const pct = pledgePct(film);
  return '<article class="card">' +
    '<a class="poster-link" href="#/film/' + film.id + '" aria-label="View project: ' + escapeHtml(film.title) + '">' +
    '<div class="poster">' + posterSVG(film, context) + '</div></a>' +
    '<div class="card-body">' +
    '<div class="card-meta"><span class="chip">' + escapeHtml(film.genre) + '</span>' +
    '<span class="chip chip-status">' + escapeHtml(film.status) + '</span></div>' +
    '<h3><a href="#/film/' + film.id + '">' + escapeHtml(film.title) + '</a></h3>' +
    '<p class="logline">' + escapeHtml(film.logline) + '</p>' +
    '<p class="byline">by ' + escapeHtml(film.filmmaker) + '</p>' +
    '<p class="support-line">' + fmtNum(supportCount(film)) + ' supporters <span class="demo-tag">(demonstration figure)</span></p>' +
    '<div class="progress" role="img" aria-label="Demonstration funding progress: ' + pct + ' percent"><div class="bar" style="width:' + pct + '%"></div></div>' +
    '<p class="fund-line"><strong>' + fmtMoney(pledgedTotal(film)) + '</strong> of ' + fmtMoney(film.budget) + ' demo goal · ' + pct + '%</p>' +
    '<a class="btn btn-primary btn-small" href="#/film/' + film.id + '">View Project</a>' +
    '</div></article>';
}

/* ---------------- Home renders ---------------- */

function renderStats() {
  let supporters = 0, pledged = 0;
  FILMS.forEach(function (f) { supporters += supportCount(f); pledged += pledgedTotal(f); });
  $("#stat-projects").textContent = FILMS.length;
  $("#stat-supporters").textContent = fmtNum(supporters);
  $("#stat-pledged").textContent = fmtMoney(pledged);
}

function renderFeatured() {
  const top = FILMS.slice().sort(function (a, b) { return supportCount(b) - supportCount(a); }).slice(0, 3);
  $("#featured-grid").innerHTML = top.map(function (f) { return filmCard(f, "feat"); }).join("");
}

function renderTiers() {
  $("#tiers-grid").innerHTML = REWARD_TIERS.map(function (t) {
    return '<article class="tier"><h3>' + escapeHtml(t.name) + '</h3>' +
      '<p class="tier-amount">' + fmtMoney(t.amount) + ' <span class="fineprint">simulated pledge</span></p>' +
      '<ul>' + t.perks.map(function (p) { return '<li>' + escapeHtml(p) + '</li>'; }).join("") + '</ul></article>';
  }).join("");
}

/* ---------------- Explore renders ---------------- */

function renderExplore() {
  const genre = $("#genre-filter").value;
  const sort = $("#sort-select").value;
  let list = FILMS.filter(function (f) { return genre === "all" || f.genre === genre; });
  if (sort === "support") {
    list.sort(function (a, b) { return supportCount(b) - supportCount(a); });
  } else if (sort === "funded") {
    list.sort(function (a, b) { return pledgePct(b) - pledgePct(a); });
  } else {
    list.sort(function (a, b) { return a.title.localeCompare(b.title); });
  }
  $("#explore-grid").innerHTML = list.map(function (f) { return filmCard(f, "explore"); }).join("");
  $("#results-count").textContent = "Showing " + list.length + " of " + FILMS.length + " demonstration projects";
}

/* ---------------- Film detail render ---------------- */

function renderFilmDetail(id) {
  const film = FILMS.find(function (f) { return f.id === id; });
  const el = $("#film-detail");
  if (!film) {
    el.innerHTML = '<h1 tabindex="-1">Project not found</h1>' +
      '<p>This demonstration project does not exist. <a href="#/explore">Browse all films</a>.</p>';
    return;
  }
  const voted = !!state.votes[film.id];
  const myPledge = state.pledges[film.id] || 0;
  const pct = pledgePct(film);

  const pledgeButtons = PLEDGE_AMOUNTS.map(function (amt) {
    return '<button type="button" class="btn btn-ghost btn-small" data-action="pledge" data-id="' + film.id +
      '" data-amount="' + amt + '" aria-pressed="' + (myPledge === amt) + '">' + fmtMoney(amt) + '</button>';
  }).join("");

  const rewardExamples = REWARD_TIERS.map(function (t) {
    return '<li><strong>' + escapeHtml(t.name) + '</strong> (' + fmtMoney(t.amount) + ' simulated pledge): ' +
      t.perks.map(escapeHtml).join("; ") + '</li>';
  }).join("");

  el.innerHTML =
    '<div class="detail-layout">' +
    '<div><div class="poster detail-poster">' + posterSVG(film, "detail") + '</div>' +
    '<div class="trailer-placeholder" role="note"><span class="play-mark" aria-hidden="true">▶</span>' +
    '<strong>Trailer placeholder</strong>No trailer exists yet for this demonstration project.</div></div>' +
    '<div class="detail-main">' +
    '<h1 tabindex="-1">' + escapeHtml(film.title) + '</h1>' +
    '<p class="logline">' + escapeHtml(film.logline) + '</p>' +
    '<dl class="detail-facts">' +
    '<div><dt>Genre</dt><dd>' + escapeHtml(film.genre) + '</dd></div>' +
    '<div><dt>Development status</dt><dd>' + escapeHtml(film.status) + '</dd></div>' +
    '<div><dt>Intended production budget</dt><dd>' + fmtMoney(film.budget) + ' <span class="fineprint">(demo)</span></dd></div>' +
    '<div><dt>Audience support</dt><dd>' + fmtNum(supportCount(film)) + ' <span class="fineprint">(demo)</span></dd></div>' +
    '</dl>' +
    '<div class="progress" role="img" aria-label="Demonstration funding progress: ' + pct + ' percent"><div class="bar" style="width:' + pct + '%"></div></div>' +
    '<p class="fund-line big"><strong>' + fmtMoney(pledgedTotal(film)) + '</strong> pledged of ' + fmtMoney(film.budget) + ' demonstration goal · ' + pct + '%</p>' +
    '<p class="fineprint">Current development stage: ' + escapeHtml(film.stage) + '</p>' +

    '<div class="action-panel" aria-labelledby="vote-heading-' + film.id + '">' +
    '<h3 id="vote-heading-' + film.id + '">Demonstration voting</h3>' +
    '<p class="panel-note">This vote is a demonstration. It is stored only in this browser (localStorage) and is not a verified public vote or a platform-wide total.</p>' +
    '<button type="button" class="btn ' + (voted ? "btn-voted" : "btn-primary") + '" data-action="vote" data-id="' + film.id + '" aria-pressed="' + voted + '">' +
    (voted ? "Demo vote cast — tap to remove" : "Cast a demo vote") + '</button>' +
    '</div>' +

    '<div class="action-panel" aria-labelledby="pledge-heading-' + film.id + '">' +
    '<h3 id="pledge-heading-' + film.id + '">Simulated pledge</h3>' +
    '<p class="panel-note">Choose a hypothetical pledge amount to see how it moves this project\'s demonstration progress. No payment information is collected, nothing is charged, and no financial returns are promised. In GreenlitX\'s planned model, pledges are conditional: a supporter would only be charged if the project reaches its funding threshold by its deadline.</p>' +
    '<div class="pledge-amounts">' + pledgeButtons + '</div>' +
    '<p class="pledge-status" role="status">' +
    (myPledge ? "Your simulated pledge: " + fmtMoney(myPledge) : "You have no simulated pledge on this project yet.") + '</p>' +
    (myPledge ? '<button type="button" class="btn btn-ghost btn-small" data-action="remove-pledge" data-id="' + film.id + '">Remove simulated pledge</button>' : "") +
    '</div>' +

    '<div class="detail-section"><h2>Synopsis</h2><p>' + escapeHtml(film.synopsis) + '</p></div>' +
    '<div class="detail-section"><h2>Creative vision</h2><p>' + escapeHtml(film.vision) + '</p></div>' +
    '<div class="detail-section"><h2>About the filmmaker</h2><p><strong>' + escapeHtml(film.filmmaker) + '</strong> — ' + escapeHtml(film.filmmakerBio) + '</p></div>' +
    '<div class="detail-section"><h2>Supporter reward examples</h2><ul>' + rewardExamples + '</ul>' +
    '<div class="notice" role="note"><p>' + escapeHtml(CASTING_DISCLAIMER) + '</p></div></div>' +
    '</div></div>';
}

/* ---------------- Submissions (demonstration) ---------------- */

function renderSubmissions() {
  const list = $("#submission-list");
  const count = $("#submission-count");
  if (!state.submissions.length) {
    count.textContent = "None yet.";
    list.innerHTML = "";
    return;
  }
  count.textContent = state.submissions.length + " saved in this browser only (demonstration — never transmitted).";
  list.innerHTML = state.submissions.map(function (s) {
    return '<li><strong>' + escapeHtml(s.title) + '</strong> — ' + escapeHtml(s.genre) +
      ' · ' + escapeHtml(s.stage) + ' · by ' + escapeHtml(s.filmmaker) + '</li>';
  }).join("");
}

/* ---------------- Actions ---------------- */

function refreshDynamic() {
  renderStats();
  renderFeatured();
  renderExplore();
  const r = parseRoute();
  if (r.view === "film") renderFilmDetail(r.id);
}

function restoreFocus(action, id, amount) {
  let sel = '[data-action="' + action + '"][data-id="' + id + '"]';
  if (amount) sel += '[data-amount="' + amount + '"]';
  const target = $(sel);
  if (target) target.focus();
}

document.addEventListener("click", function (ev) {
  const btn = ev.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if (action === "vote") {
    if (state.votes[id]) { delete state.votes[id]; } else { state.votes[id] = true; }
    saveState(); refreshDynamic(); restoreFocus("vote", id);
  } else if (action === "pledge") {
    state.pledges[id] = Number(btn.getAttribute("data-amount"));
    saveState(); refreshDynamic(); restoreFocus("pledge", id, btn.getAttribute("data-amount"));
  } else if (action === "remove-pledge") {
    delete state.pledges[id];
    saveState(); refreshDynamic(); restoreFocus("pledge", id, String(PLEDGE_AMOUNTS[0]));
  } else if (action === "clear-submissions") {
    state.submissions = [];
    saveState(); renderSubmissions();
  }
});

/* Scroll-to buttons (e.g. hero "How It Works") */
document.querySelectorAll("[data-scroll-to]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const idAttr = btn.getAttribute("data-scroll-to");
    const go = function () {
      const t = document.getElementById(idAttr);
      if (t) t.scrollIntoView({ behavior: "smooth" });
    };
    if (parseRoute().view !== "home") {
      location.hash = "#/";
      setTimeout(go, 80);
    } else { go(); }
  });
});

/* ---------------- Submission form ---------------- */

function initSubmissionForm() {
  const genreSelect = $("#f-genre");
  GENRES.concat(["Other"]).forEach(function (g) {
    const opt = document.createElement("option");
    opt.textContent = g;
    genreSelect.appendChild(opt);
  });

  const form = $("#submission-form");
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    const values = {
      title: $("#f-title").value.trim(),
      genre: $("#f-genre").value,
      logline: $("#f-logline").value.trim(),
      synopsis: $("#f-synopsis").value.trim(),
      filmmaker: $("#f-name").value.trim(),
      stage: $("#f-stage").value,
      budget: Number($("#f-budget").value),
      email: $("#f-email").value.trim()
    };
    const checks = [
      ["title", "e-title", values.title.length > 0, "f-title"],
      ["genre", "e-genre", values.genre.length > 0, "f-genre"],
      ["logline", "e-logline", values.logline.length > 0, "f-logline"],
      ["synopsis", "e-synopsis", values.synopsis.length > 0, "f-synopsis"],
      ["name", "e-name", values.filmmaker.length > 0, "f-name"],
      ["stage", "e-stage", values.stage.length > 0, "f-stage"],
      ["budget", "e-budget", isFinite(values.budget) && values.budget > 0, "f-budget"],
      ["email", "e-email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email), "f-email"]
    ];
    let firstInvalid = null;
    checks.forEach(function (c) {
      const errEl = document.getElementById(c[1]);
      errEl.hidden = c[2];
      if (!c[2] && !firstInvalid) firstInvalid = c[3];
    });
    const msg = $("#submission-message");
    if (firstInvalid) {
      msg.hidden = true;
      document.getElementById(firstInvalid).focus();
      return;
    }
    state.submissions.push({
      title: values.title, genre: values.genre, logline: values.logline,
      synopsis: values.synopsis, filmmaker: values.filmmaker, stage: values.stage,
      budget: values.budget, email: values.email,
      savedAt: new Date().toISOString()
    });
    saveState();
    form.reset();
    renderSubmissions();
    msg.textContent = "Demonstration only: this submission was saved in this browser (localStorage). It was NOT sent to GreenlitX or delivered anywhere.";
    msg.hidden = false;
  });
}

/* ---------------- Router ---------------- */

const VIEWS = ["home", "explore", "film", "professionals", "submit"];
const TITLES = {
  home: "GreenlitX — The audience decides what gets made",
  explore: "Explore Films — GreenlitX (Prototype)",
  film: "Film Project — GreenlitX (Prototype)",
  professionals: "For Professionals — GreenlitX (Prototype)",
  submit: "Submit Your Film — GreenlitX (Prototype)"
};

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  if (parts[0] === "explore") return { view: "explore" };
  if (parts[0] === "film" && parts[1]) return { view: "film", id: parts[1] };
  if (parts[0] === "professionals") return { view: "professionals" };
  if (parts[0] === "submit") return { view: "submit" };
  return { view: "home" };
}

function route() {
  const r = parseRoute();
  VIEWS.forEach(function (v) {
    document.getElementById("view-" + v).hidden = v !== r.view;
  });
  document.querySelectorAll("[data-nav]").forEach(function (a) {
    const key = a.getAttribute("data-nav");
    const active = key === r.view || (r.view === "film" && key === "explore");
    if (active) { a.setAttribute("aria-current", "page"); } else { a.removeAttribute("aria-current"); }
  });
  if (r.view === "film") {
    renderFilmDetail(r.id);
    const film = FILMS.find(function (f) { return f.id === r.id; });
    document.title = film ? film.title + " — GreenlitX (Prototype)" : TITLES.film;
  } else {
    document.title = TITLES[r.view];
  }
  window.scrollTo(0, 0);
  const focusSel = { home: ".hero-slogan", explore: "#view-explore h1", film: "#film-detail h1", professionals: "#view-professionals h1", submit: "#view-submit h1" }[r.view];
  const target = $(focusSel);
  if (target) target.focus({ preventScroll: true });
}

/* ---------------- Init ---------------- */

function init() {
  const genreFilter = $("#genre-filter");
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All genres";
  genreFilter.appendChild(allOpt);
  GENRES.forEach(function (g) {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    genreFilter.appendChild(opt);
  });
  genreFilter.addEventListener("change", renderExplore);
  $("#sort-select").addEventListener("change", renderExplore);

  renderStats();
  renderFeatured();
  renderTiers();
  renderExplore();
  renderSubmissions();
  initSubmissionForm();
  route();
  window.addEventListener("hashchange", route);
}

document.addEventListener("DOMContentLoaded", init);
