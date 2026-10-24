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

/* ---------------- Poster art (original SVG key art, generated in code) ----------------
   Each poster is a layered composition: three-stop sky gradient, a soft
   radial glow behind the key light source, a film-specific silhouette
   scene, a cinematic vignette plus film grain, and a key-art title block
   (condensed uppercase title, accent rule, genre line, filmmaker credit).
   Pure inline SVG — no external images. */

function makeRng(seedStr) {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) {
    s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  if (!s) s = 1;
  return function () {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 4294967296;
  };
}

function starField(seedStr, count, maxY, tint) {
  const rnd = makeRng(seedStr);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 400).toFixed(1);
    const y = (rnd() * maxY).toFixed(1);
    const r = (0.5 + rnd() * 1.6).toFixed(1);
    const o = (0.25 + rnd() * 0.65).toFixed(2);
    out += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (tint || "#ffffff") + '" opacity="' + o + '"/>';
  }
  return out;
}

function sparkles(seedStr, count) {
  const rnd = makeRng(seedStr);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = Math.round(30 + rnd() * 340);
    const y = Math.round(30 + rnd() * 300);
    const l = 5 + Math.round(rnd() * 5);
    out += '<path d="M' + x + ' ' + (y - l) + ' L' + x + ' ' + (y + l) + ' M' + (x - l) + ' ' + y + ' L' + (x + l) + ' ' + y +
      '" stroke="#ffffff" stroke-width="1.4" opacity="0.75"/>';
  }
  return out;
}

function wavePath(baseY, amp, phase, width) {
  const w = width || 400;
  const step = w / 4;
  let d = "M-10 " + baseY;
  for (let i = 0; i < 4; i++) {
    const x1 = -10 + step * i + step / 2;
    const x2 = -10 + step * (i + 1);
    const dir = (i + phase) % 2 === 0 ? -1 : 1;
    d += " Q " + x1 + " " + (baseY + dir * amp) + " " + x2 + " " + baseY;
  }
  return d;
}

const MOTIFS = {
  /* The Last Signal — ringed planet in deep space */
  orbit: function (pal, seed, glowId) {
    return starField(seed + "-stars", 90, 600) + sparkles(seed + "-spk", 4) +
      '<circle cx="200" cy="252" r="185" fill="url(#' + glowId + ')"/>' +
      '<ellipse cx="200" cy="252" rx="178" ry="47" fill="none" stroke="' + pal.accent + '" stroke-width="3" opacity="0.32" transform="rotate(-16 200 252)"/>' +
      '<circle cx="200" cy="252" r="97" fill="' + pal.to + '"/>' +
      '<circle cx="200" cy="252" r="97" fill="' + pal.from + '" opacity="0.55"/>' +
      '<circle cx="164" cy="222" r="88" fill="#000000" opacity="0.38"/>' +
      '<path d="M 286 214 A 97 97 0 0 1 268 322" fill="none" stroke="' + pal.accent + '" stroke-width="3" opacity="0.85"/>' +
      '<ellipse cx="200" cy="252" rx="168" ry="42" fill="none" stroke="' + pal.accent + '" stroke-width="5" opacity="0.8" transform="rotate(-16 200 252)"/>' +
      '<circle cx="330" cy="140" r="4" fill="#ffffff"/>' +
      '<circle cx="322" cy="112" r="13" fill="#e8f4ff" opacity="0.95"/>' +
      '<circle cx="317" cy="108" r="11" fill="#000000" opacity="0.22"/>' +
      '<line x1="52" y1="66" x2="104" y2="94" stroke="#ffffff" stroke-width="2" opacity="0.65"/>' +
      '<circle cx="52" cy="66" r="2.6" fill="#ffffff"/>';
  },
  /* Harvest of Salt — low sun over ridges and a salt flat */
  horizon: function (pal, seed, glowId) {
    return starField(seed + "-stars", 26, 190) +
      '<circle cx="200" cy="336" r="165" fill="url(#' + glowId + ')"/>' +
      '<circle cx="200" cy="336" r="76" fill="' + pal.accent + '"/>' +
      '<circle cx="200" cy="336" r="76" fill="#ffffff" opacity="0.18"/>' +
      '<path d="M60 128 q7 -7 14 0 q7 -7 14 0" stroke="#000000" stroke-width="2.4" fill="none" opacity="0.55"/>' +
      '<path d="M286 96 q6 -6 12 0 q6 -6 12 0" stroke="#000000" stroke-width="2.2" fill="none" opacity="0.5"/>' +
      '<polygon points="0,338 72,302 150,326 238,298 322,324 400,306 400,600 0,600" fill="#000000" opacity="0.30"/>' +
      '<polygon points="0,382 92,350 192,376 292,346 400,374 400,600 0,600" fill="#000000" opacity="0.48"/>' +
      '<rect x="174" y="392" width="52" height="150" fill="' + pal.accent + '" opacity="0.10"/>' +
      '<line x1="18" y1="428" x2="150" y2="428" stroke="#ffffff" stroke-width="2" opacity="0.28"/>' +
      '<line x1="238" y1="452" x2="386" y2="452" stroke="#ffffff" stroke-width="2" opacity="0.22"/>' +
      '<line x1="52" y1="486" x2="196" y2="486" stroke="#ffffff" stroke-width="2" opacity="0.18"/>' +
      '<line x1="226" y1="512" x2="352" y2="512" stroke="#ffffff" stroke-width="2" opacity="0.15"/>' +
      '<polygon points="0,452 120,428 268,452 400,432 400,600 0,600" fill="#000000" opacity="0.38"/>';
  },
  /* The Vanishing Reef — underwater light rays and layered swell */
  waves: function (pal, seed, glowId) {
    const rnd = makeRng(seed + "-bubbles");
    let bubbles = "";
    for (let i = 0; i < 14; i++) {
      const x = Math.round(240 + rnd() * 140);
      const y = Math.round(180 + rnd() * 280);
      const r = (1.8 + rnd() * 4.2).toFixed(1);
      bubbles += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="none" stroke="#dffaff" stroke-width="1.2" opacity="0.5"/>';
    }
    return '<circle cx="200" cy="105" r="150" fill="url(#' + glowId + ')"/>' +
      '<circle cx="200" cy="98" r="52" fill="#eafcff" opacity="0.85"/>' +
      '<polygon points="118,0 168,0 128,330 66,330" fill="#ffffff" opacity="0.06"/>' +
      '<polygon points="196,0 232,0 268,330 208,330" fill="#ffffff" opacity="0.08"/>' +
      '<polygon points="272,0 306,0 372,330 306,330" fill="#ffffff" opacity="0.05"/>' +
      '<path d="' + wavePath(296, 26, 0) + ' L410 600 L-10 600 Z" fill="#ffffff" opacity="0.10"/>' +
      '<path d="' + wavePath(378, 30, 1) + ' L410 600 L-10 600 Z" fill="#000000" opacity="0.24"/>' +
      bubbles +
      '<path d="M52 600 L66 512 L84 600 Z" fill="#000000" opacity="0.5"/>' +
      '<path d="M318 600 L336 496 L356 600 Z" fill="#000000" opacity="0.5"/>' +
      '<path d="' + wavePath(468, 30, 0) + ' L410 600 L-10 600 Z" fill="#000000" opacity="0.45"/>';
  },
  /* Paper Moons — crescent moon inside orbital story-rings */
  rings: function (pal, seed, glowId) {
    return starField(seed + "-stars", 70, 470) + sparkles(seed + "-spk", 3) +
      '<circle cx="200" cy="212" r="170" fill="url(#' + glowId + ')"/>' +
      '<circle cx="200" cy="212" r="152" fill="none" stroke="' + pal.accent + '" stroke-width="2.5" opacity="0.3"/>' +
      '<circle cx="200" cy="212" r="120" fill="none" stroke="' + pal.accent + '" stroke-width="3" opacity="0.5"/>' +
      '<circle cx="200" cy="212" r="90" fill="none" stroke="' + pal.accent + '" stroke-width="3" opacity="0.7"/>' +
      '<rect x="316" y="80" width="9" height="9" fill="#ffffff" transform="rotate(45 320 84)"/>' +
      '<rect x="76" y="300" width="8" height="8" fill="' + pal.accent + '" transform="rotate(45 80 304)"/>' +
      '<rect x="298" y="330" width="7" height="7" fill="#ffffff" opacity="0.85" transform="rotate(45 301 333)"/>' +
      '<circle cx="200" cy="212" r="63" fill="#f9ecff"/>' +
      '<circle cx="229" cy="193" r="55" fill="' + pal.mid + '"/>' +
      '<circle cx="182" cy="230" r="7" fill="#000000" opacity="0.08"/>' +
      '<circle cx="168" cy="196" r="5" fill="#000000" opacity="0.08"/>' +
      '<circle cx="58" cy="452" r="34" fill="#000000" opacity="0.32"/><circle cx="118" cy="462" r="42" fill="#000000" opacity="0.32"/>' +
      '<circle cx="192" cy="452" r="36" fill="#000000" opacity="0.32"/><circle cx="266" cy="462" r="42" fill="#000000" opacity="0.32"/>' +
      '<circle cx="340" cy="452" r="34" fill="#000000" opacity="0.32"/>' +
      '<rect x="0" y="452" width="400" height="148" fill="#000000" opacity="0.32"/>' +
      '<circle cx="88" cy="492" r="38" fill="#000000" opacity="0.3"/><circle cx="176" cy="500" r="44" fill="#000000" opacity="0.3"/>' +
      '<circle cx="268" cy="492" r="38" fill="#000000" opacity="0.3"/><circle cx="352" cy="500" r="42" fill="#000000" opacity="0.3"/>' +
      '<rect x="0" y="492" width="400" height="108" fill="#000000" opacity="0.3"/>';
  },
  /* The Night Auditor — skyline, lit windows, one green window */
  skyline: function (pal, seed, glowId) {
    const rnd = makeRng(seed + "-windows");
    const back = [
      { x: 8, w: 54, top: 208 }, { x: 74, w: 44, top: 168 }, { x: 128, w: 60, top: 226 },
      { x: 198, w: 48, top: 186 }, { x: 256, w: 56, top: 216 }, { x: 322, w: 46, top: 176 }, { x: 376, w: 30, top: 232 }
    ];
    const front = [
      { x: 20, w: 62, top: 300 }, { x: 96, w: 72, top: 252 }, { x: 182, w: 52, top: 322 },
      { x: 248, w: 66, top: 238 }, { x: 328, w: 56, top: 292 }
    ];
    let out = starField(seed + "-stars", 44, 260) +
      '<circle cx="318" cy="98" r="86" fill="url(#' + glowId + ')"/>' +
      '<circle cx="318" cy="98" r="27" fill="#f2f2f7"/>' +
      '<circle cx="309" cy="90" r="22" fill="#000000" opacity="0.14"/>';
    back.forEach(function (b) {
      out += '<rect x="' + b.x + '" y="' + b.top + '" width="' + b.w + '" height="' + (600 - b.top) + '" fill="#000000" opacity="0.34"/>';
    });
    out += '<line x1="95" y1="168" x2="95" y2="138" stroke="#000000" stroke-width="3" opacity="0.4"/>' +
      '<line x1="285" y1="216" x2="285" y2="188" stroke="#000000" stroke-width="3" opacity="0.4"/>';
    front.forEach(function (b) {
      out += '<rect x="' + b.x + '" y="' + b.top + '" width="' + b.w + '" height="' + (600 - b.top) + '" fill="#000000" opacity="0.78"/>';
    });
    front.forEach(function (b) {
      for (let wy = b.top + 16; wy < 520; wy += 30) {
        for (let wx = b.x + 9; wx < b.x + b.w - 10; wx += 17) {
          if (rnd() > 0.55) {
            out += '<rect x="' + wx + '" y="' + wy + '" width="8" height="11" fill="#ffd98a" opacity="' + (0.5 + rnd() * 0.4).toFixed(2) + '"/>';
          }
        }
      }
    });
    /* Room 6: the one window that should not exist */
    out += '<circle cx="202" cy="351" r="17" fill="#7CFC00" opacity="0.22"/>' +
      '<rect x="196" y="344" width="11" height="14" fill="#7CFC00"/>' +
      '<rect x="0" y="540" width="400" height="60" fill="#7CFC00" opacity="0.05"/>';
    return out;
  },
  /* Second Helpings — retro sunset, dunes, two rival food trucks */
  sun: function (pal, seed, glowId) {
    return starField(seed + "-stars", 20, 150) +
      '<circle cx="200" cy="292" r="180" fill="url(#' + glowId + ')"/>' +
      '<circle cx="200" cy="292" r="88" fill="' + pal.accent + '"/>' +
      '<rect x="104" y="300" width="192" height="7" fill="' + pal.mid + '" opacity="0.35"/>' +
      '<rect x="104" y="322" width="192" height="10" fill="' + pal.mid + '" opacity="0.45"/>' +
      '<rect x="104" y="348" width="192" height="13" fill="' + pal.mid + '" opacity="0.55"/>' +
      '<path d="M52 120 q6 -6 12 0 q6 -6 12 0" stroke="#000000" stroke-width="2.2" fill="none" opacity="0.5"/>' +
      '<path d="M308 84 q6 -6 12 0 q6 -6 12 0" stroke="#000000" stroke-width="2.2" fill="none" opacity="0.45"/>' +
      '<path d="' + wavePath(352, 20, 0) + ' L410 600 L-10 600 Z" fill="#000000" opacity="0.26"/>' +
      '<path d="' + wavePath(404, 24, 1) + ' L410 600 L-10 600 Z" fill="#000000" opacity="0.46"/>' +
      /* truck A — taco perfectionist, facing right */
      '<g fill="#000000" opacity="0.88">' +
      '<rect x="46" y="392" width="66" height="30" rx="4"/>' +
      '<polygon points="112,398 132,398 140,422 112,422"/>' +
      '<circle cx="66" cy="424" r="7"/><circle cx="122" cy="424" r="7"/>' +
      '</g>' +
      '<rect x="52" y="398" width="30" height="10" fill="' + pal.accent + '" opacity="0.75"/>' +
      '<line x1="46" y1="388" x2="112" y2="388" stroke="#000000" stroke-width="4" opacity="0.88"/>' +
      /* truck B — ramen romantic, facing left */
      '<g fill="#000000" opacity="0.88">' +
      '<rect x="288" y="392" width="66" height="30" rx="4"/>' +
      '<polygon points="288,398 268,398 260,422 288,422"/>' +
      '<circle cx="334" cy="424" r="7"/><circle cx="278" cy="424" r="7"/>' +
      '</g>' +
      '<rect x="318" y="398" width="30" height="10" fill="' + pal.accent + '" opacity="0.75"/>' +
      '<line x1="288" y1="388" x2="354" y2="388" stroke="#000000" stroke-width="4" opacity="0.88"/>' +
      '<path d="' + wavePath(452, 22, 0) + ' L410 600 L-10 600 Z" fill="#000000" opacity="0.5"/>';
  }
};

function posterSVG(film, context) {
  const p = film.poster;
  const gid = "grad-" + context + "-" + film.id;
  const glowId = "glow-" + context + "-" + film.id;
  const vigId = "vig-" + context + "-" + film.id;
  const fadeId = "fade-" + context + "-" + film.id;
  const grainId = "grain-" + context + "-" + film.id;
  const topId = "top-" + context + "-" + film.id;
  const motif = MOTIFS[p.motif] ? MOTIFS[p.motif](p, film.id + context, glowId) : "";
  const title = film.title.toUpperCase();
  const titleSize = title.length <= 14 ? 34 : (title.length <= 18 ? 29 : 25);
  return '<svg viewBox="0 0 400 600" role="img" aria-label="Original concept artwork for ' +
    escapeHtml(film.title) + ' (demonstration)">' +
    '<defs>' +
    '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + p.from + '"/><stop offset="0.55" stop-color="' + (p.mid || p.to) + '"/>' +
    '<stop offset="1" stop-color="' + p.to + '"/></linearGradient>' +
    '<radialGradient id="' + glowId + '" cx="0.5" cy="0.5" r="0.5">' +
    '<stop offset="0" stop-color="' + p.accent + '" stop-opacity="0.5"/><stop offset="1" stop-color="' + p.accent + '" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="' + vigId + '" cx="0.5" cy="0.42" r="0.78">' +
    '<stop offset="0.6" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.58"/></radialGradient>' +
    '<linearGradient id="' + fadeId + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#000000" stop-opacity="0"/><stop offset="0.35" stop-color="#000000" stop-opacity="0.45"/>' +
    '<stop offset="1" stop-color="#000000" stop-opacity="0.82"/></linearGradient>' +
    '<linearGradient id="' + topId + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
    '<filter id="' + grainId + '" x="0" y="0" width="100%" height="100%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>' +
    '<feColorMatrix type="saturate" values="0"/></filter>' +
    '</defs>' +
    '<rect width="400" height="600" fill="url(#' + gid + ')"/>' +
    motif +
    '<rect width="400" height="600" fill="url(#' + topId + ')"/>' +
    '<rect width="400" height="600" fill="url(#' + vigId + ')"/>' +
    '<rect x="0" y="418" width="400" height="182" fill="url(#' + fadeId + ')"/>' +
    '<rect x="173" y="472" width="54" height="3" fill="' + p.accent + '"/>' +
    '<text x="201.5" y="517" text-anchor="middle" font-family="\'Arial Narrow\', \'Liberation Sans Narrow\', Impact, \'Helvetica Neue\', sans-serif" font-weight="700" font-size="' + titleSize + '" letter-spacing="1.5" fill="#000000" opacity="0.55">' +
    escapeHtml(title) + '</text>' +
    '<text x="200" y="515" text-anchor="middle" font-family="\'Arial Narrow\', \'Liberation Sans Narrow\', Impact, \'Helvetica Neue\', sans-serif" font-weight="700" font-size="' + titleSize + '" letter-spacing="1.5" fill="#ffffff">' +
    escapeHtml(title) + '</text>' +
    '<text x="200" y="545" text-anchor="middle" font-family="\'Helvetica Neue\', Arial, sans-serif" font-size="11.5" letter-spacing="4" fill="' + p.accent + '">' +
    escapeHtml(film.genre.toUpperCase()) + ' · DEMONSTRATION</text>' +
    '<text x="200" y="576" text-anchor="middle" font-family="\'Helvetica Neue\', Arial, sans-serif" font-size="9.5" letter-spacing="3" fill="#ffffff" opacity="0.78">A FILM BY ' +
    escapeHtml(film.filmmaker.toUpperCase()) + '</text>' +
    '<rect width="400" height="600" filter="url(#' + grainId + ')" opacity="0.05"/></svg>';
}

/* ---------------- Film cards ---------------- */

/* Real key art (original generated artwork) lives at posters/<film-id>.webp */
function posterArt(film) {
  return '<img class="poster-img" src="posters/' + film.id + '.webp" width="880" height="1320" loading="lazy" alt="Key art for ' + escapeHtml(film.title) + ' — original artwork created for this demonstration project">';
}

function filmCard(film, context) {
  const pct = pledgePct(film);
  return '<article class="card">' +
    '<a class="poster-link" href="#/film/' + film.id + '" aria-label="View project: ' + escapeHtml(film.title) + '">' +
    '<div class="poster">' + posterArt(film) + '</div></a>' +
    '<div class="card-body">' +
    '<h3><a href="#/film/' + film.id + '">' + escapeHtml(film.title) + '</a></h3>' +
    '<div class="card-meta"><span class="chip">' + escapeHtml(film.genre) + '</span>' +
    '<span class="chip chip-status">' + escapeHtml(film.status) + '</span></div>' +
    '<p class="logline">' + escapeHtml(film.logline) + '</p>' +
    '<p class="byline">by ' + escapeHtml(film.filmmaker) + '</p>' +
    '<div class="card-foot">' +
    '<p class="support-line">' + fmtNum(supportCount(film)) + ' supporters <span class="demo-tag">(demonstration figure)</span></p>' +
    '<div class="progress" role="img" aria-label="Demonstration funding progress: ' + pct + ' percent"><div class="bar" style="width:' + pct + '%"></div></div>' +
    '<p class="fund-line"><strong>' + fmtMoney(pledgedTotal(film)) + '</strong> of ' + fmtMoney(film.budget) + ' demo goal · ' + pct + '%</p>' +
    '</div>' +
    '<a class="btn btn-primary" href="#/film/' + film.id + '">View Project</a>' +
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

/* ---------------- Mobile navigation ----------------
   The hamburger toggles an in-flow panel inside the sticky header.
   The menu closes on toggle, on destination click, on Escape (focus
   returns to the toggle) and on every route change. */

function setMobileMenu(open, toggle, panel) {
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  panel.hidden = !open;
  const openIcon = toggle.querySelector(".menu-icon-open");
  const closeIcon = toggle.querySelector(".menu-icon-close");
  if (openIcon) openIcon.hidden = open;
  if (closeIcon) closeIcon.hidden = !open;
}

function closeMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const panel = document.getElementById("mobile-menu");
  if (toggle && panel && !panel.hidden) setMobileMenu(false, toggle, panel);
}

function initMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const panel = document.getElementById("mobile-menu");
  if (!toggle || !panel) return;
  toggle.addEventListener("click", function () {
    setMobileMenu(panel.hidden, toggle, panel);
  });
  panel.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setMobileMenu(false, toggle, panel);
    });
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !panel.hidden) {
      setMobileMenu(false, toggle, panel);
      toggle.focus();
    }
  });
}

/* Scroll reveal — purely decorative. The .js gate class is only added here,
   so if JavaScript or IntersectionObserver is unavailable (or the visitor
   prefers reduced motion) every section simply stays fully visible. */
function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const els = document.querySelectorAll("#view-home .section");
  if (!els.length) return;
  document.documentElement.classList.add("js");
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
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
    '<div><div class="poster detail-poster">' + posterArt(film) + '</div>' +
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
    '<div class="progress progress-lg" role="img" aria-label="Demonstration funding progress: ' + pct + ' percent"><div class="bar" style="width:' + pct + '%"></div></div>' +
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
  closeMobileMenu();
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
  initMobileMenu();
  initSubmissionForm();
  route();
  initReveal();
  window.addEventListener("hashchange", route);
}

document.addEventListener("DOMContentLoaded", init);
