# GreenlitX — Static Website Prototype

**GreenlitX** is a film platform where audiences help decide which movies get made.

> "Hollywood decides what gets made today. On GreenlitX, the audience does."

This repository folder contains the first working prototype of the GreenlitX
website: a dependency-free static site built with plain HTML5, CSS3 and vanilla
JavaScript. No frameworks, no build step, no backend, no database — and a $0
budget throughout.

## Status

Early prototype development. Everything on the site is demonstration content.

## What is included

| File         | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `index.html` | Page structure and all views (single-page app)                 |
| `styles.css` | Cinematic dark theme, responsive layout, accessible contrast   |
| `data.js`    | Fictional demonstration film data and reward tiers             |
| `app.js`     | Routing, rendering, demo voting, simulated pledges, demo form  |
| `README.md`  | This file                                                       |

## How to run it

Option 1 — just open the file:

```
open index.html in any modern browser
```

Option 2 — serve it statically (recommended, closest to production):

```bash
cd greenlitx-site
python3 -m http.server 8000
# then visit http://localhost:8000
```

Any static host (for example a free static-hosting tier) can serve this folder
as-is. Deployment is intentionally **not** configured in this prototype step.

## Features that work in this prototype

- Homepage with hero, featured projects, "How GreenlitX works", audience,
  filmmaker, actor and supporter sections
- Film discovery grid with genre filtering and sorting (popularity, funding
  progress, title)
- Individual project pages with synopsis, creative vision, filmmaker profile,
  budget, development stage and a labeled trailer placeholder
- **Demonstration voting** — cast or remove a demo vote per film
- **Simulated pledges** — pick $5 / $10 / $25 / $50 / $100 and watch the demo
  funding progress move
- Supporter reward tier examples, with an explicit disclaimer that pledging
  never guarantees an acting opportunity
- Filmmaker submission form with required-field validation

## Known limitations (by design)

- **Demonstration data only.** All six film projects, filmmakers, supporter
  counts and dollar figures are fictional examples written for this prototype.
- **Browser-local storage only.** Votes, simulated pledges and form submissions
  are stored in your browser's `localStorage`. They are visible only in this
  browser, are not verified platform-wide totals, and are not shared with
  anyone.
- **No backend and no accounts.** There is no server, database, sign-up or
  login in this version.
- **No payments.** No payment information is collected, no payment provider is
  integrated, and nothing is charged. Pledges are purely simulated to
  demonstrate the planned conditional-funding concept: in the future model, a
  supporter would only be charged if a project reaches its funding threshold.
- **Submissions are not delivered.** The submission form saves entries only in
  this browser as a demonstration. Nothing is emailed or transmitted anywhere.
- **Posters are original CSS/SVG art.** All film artwork is generated in code
  (gradients, shapes, typography) — no external images and no copyrighted
  material, so the prototype is legally safe and costs nothing to run.

## Planned next steps

- Real backend with verified accounts and platform-wide voting
- Secure filmmaker submission handling
- A compliant conditional-funding payment flow (designed with legal review)
- Milestone tracking and escrow-style release of funds for funded projects
