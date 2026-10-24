/**
 * GreenlitX — demonstration data.
 *
 * Every project, person, count and dollar figure in this file is FICTIONAL
 * demonstration content written for this prototype. None of it describes a
 * real production, a real filmmaker, or real audience activity.
 */

const GENRES = ["Sci-Fi", "Drama", "Documentary", "Animation", "Thriller", "Comedy"];

const FILMS = [
  {
    id: "the-last-signal",
    title: "The Last Signal",
    genre: "Sci-Fi",
    logline: "A lone engineer on a deep-space listening post intercepts a transmission in a dead language — addressed to her by name.",
    synopsis: "Alone aboard an orbital relay station, communications engineer Ana Reyes intercepts a narrow-band transmission in a language that has not been spoken for a century. Decoding it live, she realizes the message describes her station, her shift — and the next eleven minutes. As ground control dismisses it as an echo artifact, Ana must decide whether to follow protocol or answer a signal that seems to know her better than she knows herself.",
    vision: "A slow-burn, single-location science-fiction film about isolation, memory and first contact, shot largely in one set with practical lighting. The creative team wants the audience to feel the silence of orbit — and the terror of something answering back.",
    filmmaker: "Mara Ellison",
    filmmakerBio: "Mara Ellison is a fictional demonstration filmmaker profile created for this prototype. In the world of this demo she is a short-film director whose work has screened at genre festivals, now developing her first feature.",
    status: "In Development",
    stage: "Stage 2 of 5 — Script locked; concept art and casting outreach under way",
    budget: 850000,
    baseSupport: 1284,
    basePledged: 612400,
    poster: { from: "#0a2440", to: "#0d3b2e", accent: "#7CFC00", motif: "orbit" }
  },
  {
    id: "harvest-of-salt",
    title: "Harvest of Salt",
    genre: "Drama",
    logline: "Three estranged siblings return to their family's failing salt flats to decide whether heritage is worth saving.",
    synopsis: "When their father's health fails, the Andrade siblings come home to a coastal salt farm that has been in the family for four generations. The land is worth more sold than worked, the harvest is weeks away, and each sibling is carrying a different version of the same childhood. Harvest of Salt is a quiet, sun-bleached drama about inheritance — the kind you can sell, and the kind you cannot.",
    vision: "Shot on real salt flats with a small crew and natural light, the film pairs wide, still landscapes with intimate family scenes. The goal is a drama that lets silence do the heavy lifting and treats work — hands in salt, season after season — as a form of love language.",
    filmmaker: "Tomás Ribeiro",
    filmmakerBio: "Tomás Ribeiro is a fictional demonstration filmmaker profile created for this prototype. In this demo he is a documentary-turned-drama director interested in rural industries and the families who keep them alive.",
    status: "In Development",
    stage: "Stage 3 of 5 — Financing and location scouting",
    budget: 420000,
    baseSupport: 862,
    basePledged: 243600,
    poster: { from: "#2b1538", to: "#93350f", accent: "#ffb35c", motif: "peaks" }
  },
  {
    id: "the-vanishing-reef",
    title: "The Vanishing Reef",
    genre: "Documentary",
    logline: "A marine biologist and a fishing village race to document a reef that may not survive the decade.",
    synopsis: "Off a small island coast, a coral reef that has fed three generations is bleaching faster than scientists predicted. The Vanishing Reef follows marine biologist Ines Halvorsen and the local dive cooperative through one year of surveys, storms and stubborn hope — including a community-run nursery that is replanting coral by hand, fragment by fragment.",
    vision: "An observational documentary built from underwater cinematography, village life and time-lapse reef photography collected across four seasons. No narration telling the audience what to feel — the reef, and the people who depend on it, speak for themselves.",
    filmmaker: "Lena Okafor",
    filmmakerBio: "Lena Okafor is a fictional demonstration filmmaker profile created for this prototype. In this demo she is a science documentarian and certified diver who has spent a decade filming coastal ecosystems.",
    status: "Production Ready",
    stage: "Stage 4 of 5 — Permits secured; principal photography scheduled",
    budget: 260000,
    baseSupport: 1975,
    basePledged: 210600,
    poster: { from: "#062a3a", to: "#0b5563", accent: "#4dd8e6", motif: "waves" }
  },
  {
    id: "paper-moons",
    title: "Paper Moons",
    genre: "Animation",
    logline: "A young origami artist folds a paper moon every night to keep her grandmother's stories alive.",
    synopsis: "Eight-year-old Hana's grandmother told a new story for every moonrise. When her grandmother's memory begins to fade, Hana folds a paper moon each night and, in her dreams, delivers it to the Moon Keeper — a gentle, forgetful giant who archives the world's bedtime stories. Paper Moons is a hand-crafted stop-motion fable about memory, grief and the stories that hold families together.",
    vision: "Stop-motion animation built from real paper, card and light. Every set is folded, cut and assembled by hand, giving the film a tactile warmth that digital animation cannot imitate. The team plans a behind-the-scenes series so supporters can watch the paper world being built frame by frame.",
    filmmaker: "Yuki Tanaka",
    filmmakerBio: "Yuki Tanaka is a fictional demonstration filmmaker profile created for this prototype. In this demo she is a stop-motion animator whose paper-craft shorts have won family-audience awards at animation festivals.",
    status: "In Development",
    stage: "Stage 2 of 5 — Storyboards and animatic in progress",
    budget: 680000,
    baseSupport: 1533,
    basePledged: 442000,
    poster: { from: "#1d1140", to: "#4a1259", accent: "#ff8ad8", motif: "rings" }
  },
  {
    id: "the-night-auditor",
    title: "The Night Auditor",
    genre: "Thriller",
    logline: "A hotel night auditor notices the same guest checking in under a different name every Friday — always into room 6, which does not exist.",
    synopsis: "Working the graveyard shift at a grand old hotel, night auditor Felix Brandt reconciles the books the way he reconciles his life: carefully, and alone. Then the reservation system starts showing a booking for room 6 — a room sealed since 1974 — paid in cash, under a new name every week. Felix's quiet investigation pulls him into the hotel's buried history and a pattern someone is willing to protect at any cost.",
    vision: "A contained, neon-and-shadow thriller set almost entirely inside one hotel between midnight and dawn. One location, a small cast, and tension built from ledgers, key cards and corridors — proof that a thriller needs dread, not explosions.",
    filmmaker: "Daniel Kessler",
    filmmakerBio: "Daniel Kessler is a fictional demonstration filmmaker profile created for this prototype. In this demo he is a former hotel night worker turned writer-director, developing his first feature from a decade of graveyard-shift notebooks.",
    status: "Concept Stage",
    stage: "Stage 1 of 5 — Script and proof-of-concept short",
    budget: 540000,
    baseSupport: 689,
    basePledged: 140400,
    poster: { from: "#0d0d12", to: "#23232e", accent: "#e8e8f0", motif: "skyline" }
  },
  {
    id: "second-helpings",
    title: "Second Helpings",
    genre: "Comedy",
    logline: "Two rival food-truck owners, forced to share one parking spot, declare a cook-off war neither of them can afford to lose.",
    synopsis: "When a city lottery assigns the same prime lunch spot to two food trucks, taco perfectionist Rosa Delgado and ramen romantic Ken Watanabe refuse to share — until a health inspector, a viral review and one very determined seagull force them into an uneasy alliance. Second Helpings is a warm, fast-talking comedy about competition, pride and the radical act of feeding your enemy.",
    vision: "A bright, energetic ensemble comedy shot around real food trucks, with cooking sequences filmed to make audiences hungry. The production plans to hire local vendors as consultants — and cater the wrap party from the trucks that inspired it.",
    filmmaker: "Priya Nair",
    filmmakerBio: "Priya Nair is a fictional demonstration filmmaker profile created for this prototype. In this demo she is a comedy writer-director whose web series about night-market vendors built a loyal online audience.",
    status: "In Development",
    stage: "Stage 3 of 5 — Casting and financing",
    budget: 310000,
    baseSupport: 1047,
    basePledged: 173600,
    poster: { from: "#40101f", to: "#7a4d0c", accent: "#ffd23f", motif: "sun" }
  }
];

/** Hypothetical pledge amounts offered in the simulated pledge widget. */
const PLEDGE_AMOUNTS = [5, 10, 25, 50, 100];

/** Demonstration supporter reward tiers (examples only). */
const REWARD_TIERS = [
  {
    name: "Supporter",
    amount: 5,
    perks: [
      "Early supporter recognition on the project page",
      "Behind-the-scenes production updates"
    ]
  },
  {
    name: "Insider",
    amount: 25,
    perks: [
      "Everything in the Supporter tier",
      "Digital premiere access when the film is completed"
    ]
  },
  {
    name: "Patron",
    amount: 50,
    perks: [
      "Everything in the Insider tier",
      "A special thank-you credit, subject to production agreements",
      "Invitations to selected production experiences, where available"
    ]
  },
  {
    name: "Premiere Circle",
    amount: 100,
    perks: [
      "Everything in the Patron tier",
      "Opportunities to apply for auditions or small roles when a production is casting"
    ]
  }
];

/**
 * Mandatory honesty note shown wherever casting-related rewards appear.
 * Pledging never guarantees an acting opportunity.
 */
const CASTING_DISCLAIMER =
  "Important: an acting opportunity is never guaranteed by pledging. All casting participation depends on production requirements, eligibility, contractual terms and professional selection by the production team.";
