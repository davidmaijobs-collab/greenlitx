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
| `styles.css` | Cinematic dark theme — mobile-first compact hamburger header, slogan-centred hero, key-art film posters, compact prototype notice, scroll reveal, accessible contrast |
| `logo.webp`  | Official GreenlitX logo — the unmodified master used on Instagram @greenlitx |
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
- Compact mobile navigation — below 860px the header collapses to the logo
  plus a hamburger menu (in-flow panel, closes on selection, Escape, or route
  change; full keyboard and screen-reader support)
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
- **Posters are real photography.** Each film's poster (in `posters/`) is a
  real photograph, cropped and lightly graded — no AI-generated imagery.
  All photos are free-licensed; credits below.

## Poster photography credits

- **The Last Signal** — "Milky Way over the Swedish-ESO Submillimetre
  Telescope", ESO / P. Horálek, CC BY 4.0, via Wikimedia Commons:
  https://commons.wikimedia.org/wiki/File:Milky_Way_over_the_Swedish-ESO_Submillimetre_Telescope_(2016-04-14-la-silla-fd-swedish-eq-extended).jpg
- **Harvest of Salt** — "Salar de Uyuni, Bolivia (DD 10-12 HDR)", Diego
  Delso, CC BY-SA 4.0, via Wikimedia Commons:
  https://commons.wikimedia.org/wiki/File:Salar_de_Uyuni,_Bolivia,_2016-02-04,_DD_10-12_HDR.JPG
- **The Vanishing Reef** — "Green Sea Turtle, Ningaloo Reef", Nicole
  McLachlan, CC BY-SA 4.0, via Wikimedia Commons:
  https://commons.wikimedia.org/wiki/File:Green_Sea_Turtle,_Ningaloo_Reef.jpg
- **Paper Moons** — "Colorful star-shaped lanterns, Luang Prabang, Laos",
  Basile Morin, CC BY-SA 4.0, via Wikimedia Commons:
  https://commons.wikimedia.org/wiki/File:Colorful_star-shaped_lanterns_hanging_on_a_building_at_blue_hour_in_Luang_Prabang_Laos.jpg
- **The Night Auditor** — "Gadsden Hotel lobby, Douglas, Arizona", Nicholas
  Hartmann, CC BY-SA 4.0, via Wikimedia Commons:
  https://commons.wikimedia.org/wiki/File:Douglas_Gadsden_Hotel_lobby_2.jpg
- **Second Helpings** — "Vibrant Nightlife at a Food Truck Festival", Flor
  Ibañez, Pexels License (free to use), via Pexels:
  https://www.pexels.com/photo/38863226/

## Concept footage credits

Each project page plays a short muted concept clip, and the homepage hero
runs a showreel cut from the same footage. All footage is real film —
no AI-generated video — free-licensed as follows:

- **The Last Signal** (hero + project clip) — "La Silla Timelapse", ESO /
  José Francisco Salgado, CC BY 4.0, via Wikimedia Commons.
- **Harvest of Salt** — salt-flat mirror footage, via Pixabay (Pixabay
  Content License): cdn.pixabay.com/video/2022/11/25/140470-775192202
- **The Vanishing Reef** — "Sea turtle in North Sulawesi", Marwan Mohamad,
  CC BY-SA 4.0, via Wikimedia Commons.
- **Paper Moons** — "Releasing sky lanterns at the CAD Khomloy Sky Lantern
  Festival", ManoiCMU, CC BY 4.0, via Wikimedia Commons.
- **The Night Auditor** — grand hotel lobby footage, via Pixabay (Pixabay
  Content License): cdn.pixabay.com/video/2026/07/09/362909
- **Second Helpings** — Korean street-food market footage, via Pixabay
  (Pixabay Content License): cdn.pixabay.com/video/2019/06/23/24602-344986228

## Teaser credits

The homepage teaser ("The audience decides", 23 seconds) is cut from:

- **Night of the Living Dead (1968) theatrical trailer** — public domain,
  via Wikimedia Commons.
- Film-set, mass-crowd and confetti-crowd clips — via Pixabay (Pixabay
  Content License): cdn.pixabay.com/video/2015/10/16/992-142621119,
  cdn.pixabay.com/video/2017/09/05/11832-233049403,
  cdn.pixabay.com/video/2016/04/03/2657-865412760
- Sky-lantern footage — ManoiCMU, CC BY 4.0, via Wikimedia Commons (as
  credited above).

## Planned next steps

- Real backend with verified accounts and platform-wide voting
- Secure filmmaker submission handling
- A compliant conditional-funding payment flow (designed with legal review)
- Milestone tracking and escrow-style release of funds for funded projects
