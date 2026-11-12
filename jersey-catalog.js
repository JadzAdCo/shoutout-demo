/* FLOQR Sports Jersey catalog — soccer teams (picker) + NBA/NFL templates.
   Photo LED soccer backs: one Cameroon/Morocco silhouette, team colors only, solid #000 backdrop, no hanger.
   CSS hanger mount only for kits without a photo. Soccer = slim short-sleeve; NBA = tank; NFL = yoke + name plate.
   See .cursor/rules/sports-jersey-silhouettes.mdc and soccer-jersey-photo-backs.mdc */
(function (global) {
  "use strict";

  const SCREEN = ["led-64x32", "led-64x48", "led-96x48"];
  const PRICE = 3000;
  const SOCCER_TEMPLATE_ID = "soccerJersey";

  function slug(name) {
    return String(name || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .replace(/^[0-9]+/, "");
  }

  function jerseyTemplate({id, name, league, sport, primary, secondary, accent, bgUrl, extraTags, teamName}) {
    const classSport = sport === "nba" ? "nba-jersey" : sport === "nfl" ? "nfl-jersey" : "soccer-jersey";
    const isPhoto = !!bgUrl;
    const kindTag = league === "National teams" ? "Country" : (sport === "soccer" ? "Club" : league);
    const tags = Array.from(new Set([
      "Sports", "Jersey", "Soccer", sport.toUpperCase(), league, name, teamName, kindTag,
      isPhoto ? "photo" : "hanger",
      "2026/27", "$30", "shared", "name", "number",
      ...(extraTags || [])
    ].filter(Boolean)));
    const silhouetteNote = sport === "nba" ? "Sleeveless tank, mesh, big number." : sport === "nfl" ? "Yoke + shoulder name plate, huge number." : "Slim short-sleeve kit, fabric fashion.";
    return {
      id,
      name,
      teamName: teamName || String(name || "").replace(/^(Soccer|NBA|NFL)\s+/i, "").replace(/\s+Jersey$/i, "").trim(),
      scope: "Shared",
      className: `sports-jersey ${classSport} ${isPhoto ? "jersey-photo-back" : "jersey-css-back jersey-on-hanger"}`,
      category: "Sports",
      mediaMode: "No image/video",
      supportsMedia: false,
      backgroundEditable: false,
      textOverlay: true,
      layout: "soccer-jersey",
      identityRail: true,
      jerseyCssBack: !isPhoto,
      jerseyOnHanger: !isPhoto,
      jerseySilhouette: sport === "nba" ? "tank" : sport === "nfl" ? "yoke" : "short-sleeve",
      jerseyPrimary: primary || "#111111",
      jerseySecondary: secondary || "#ffffff",
      jerseyAccent: accent || secondary || "#ffffff",
      defaultBackgroundUrl: bgUrl || "",
      priceCents: PRICE,
      priceLabel: "$30",
      Is96x48: 1,
      Is64x48: 1,
      Is64x32: 1,
      screenFormatIds: SCREEN.slice(),
      defaultMain: "NYX",
      defaultSub: "99",
      lineCount: 2,
      maxCharactersPerLine: 8,
      maxMainCharacters: 14,
      maxSubCharacters: 2,
      jerseyNameField: true,
      jerseyNumberField: true,
      jerseyNumberMaxChars: 2,
      jerseyTeamLabel: String(teamName || name || "").replace(/^(Soccer|NBA|NFL)\s+/i, "").replace(/\s+Jersey$/i, "").toUpperCase(),
      season: "2026/27",
      sport,
      league,
      description: isPhoto
        ? (sport === "nfl"
          ? `$30 ${teamName} NFL jersey ShoutOut — 2026 home LED back (96×48, 64×48, 64×32). Club word, name, and number are typed on the kit.`
          : sport === "nba"
            ? `$30 ${teamName} basketball jersey ShoutOut — 2026/27 icon LED back (96×48, 64×48, 64×32). Team word, name, and number are typed on the kit.`
            : `$30 ${teamName} soccer jersey ShoutOut — LED back matches this kit (96×48, 64×48, 64×32). Soccer · Jersey · ${kindTag}.`)
        : `Shared $30 ${name} jersey-back ShoutOut on a hanger (${league}, 2026/27). ${silhouetteNote}`,
      tags
    };
  }

  // 2026/27 Icon kit: name, file, body, number ink, trim, side.
  const NBA = [
    ["Atlanta Hawks", "hawks", "#C8102E", "#FFFFFF", "#FDB927", "#161616"],
    ["Boston Celtics", "celtics", "#007A33", "#FFFFFF", "#BA9653", "#FFFFFF"],
    ["Brooklyn Nets", "nets", "#161616", "#FFFFFF", "#FFFFFF", "#161616"],
    ["Charlotte Hornets", "hornets", "#1D1160", "#FFFFFF", "#00788C", "#A1A1A4"],
    ["Chicago Bulls", "bulls", "#CE1141", "#FFFFFF", "#161616", "#161616"],
    ["Cleveland Cavaliers", "cavaliers", "#860038", "#FDBB30", "#FDBB30", "#041E42"],
    ["Dallas Mavericks", "mavericks", "#00538C", "#FFFFFF", "#B8C4CA", "#002B5E"],
    ["Denver Nuggets", "nuggets", "#0E2240", "#FEC524", "#FEC524", "#8B2332"],
    ["Detroit Pistons", "pistons", "#C8102E", "#FFFFFF", "#1D42BA", "#BEC0C2"],
    ["Golden State Warriors", "warriors", "#1D428A", "#FFC72C", "#FFC72C", "#FFC72C"],
    ["Houston Rockets", "rockets", "#CE1141", "#FDB927", "#FDB927", "#161616"],
    ["Indiana Pacers", "pacers", "#002D62", "#FDBB30", "#FDBB30", "#FDBB30"],
    ["LA Clippers", "clippers", "#1D428A", "#FFFFFF", "#C8102E", "#FFFFFF"],
    ["Los Angeles Lakers", "lakers", "#552583", "#FDB927", "#FDB927", "#FDB927"],
    ["Memphis Grizzlies", "grizzlies", "#5D76A9", "#FFFFFF", "#12173F", "#F5B112"],
    ["Miami Heat", "heat", "#161616", "#FFFFFF", "#98002E", "#F9A01B"],
    ["Milwaukee Bucks", "bucks", "#00471B", "#EEE1C6", "#EEE1C6", "#0077C0"],
    ["Minnesota Timberwolves", "timberwolves", "#0C2340", "#78BE20", "#78BE20", "#236192"],
    ["New Orleans Pelicans", "pelicans", "#0C2340", "#FFFFFF", "#C8102E", "#B4975A"],
    ["New York Knicks", "knicks", "#006BB6", "#F58426", "#F58426", "#F58426"],
    ["Oklahoma City Thunder", "thunder", "#007AC1", "#FDBB30", "#EF3B24", "#FDBB30"],
    ["Orlando Magic", "magic", "#0077C0", "#FFFFFF", "#C4CED4", "#161616"],
    ["Philadelphia 76ers", "76ers", "#006BB6", "#FFFFFF", "#ED174C", "#FFFFFF"],
    ["Phoenix Suns", "suns", "#1D1160", "#E56020", "#E56020", "#E56020"],
    ["Portland Trail Blazers", "blazers", "#E03A3E", "#FFFFFF", "#161616", "#161616"],
    ["Sacramento Kings", "kings", "#5A2D81", "#FFFFFF", "#63727A", "#161616"],
    ["San Antonio Spurs", "spurs", "#161616", "#C4CED4", "#C4CED4", "#C4CED4"],
    ["Toronto Raptors", "raptors", "#CE1141", "#FFFFFF", "#161616", "#A1A1A4"],
    ["Utah Jazz", "jazz", "#5B2C82", "#FFFFFF", "#111111", "#6CACE4"],
    ["Washington Wizards", "wizards", "#002B5C", "#FFFFFF", "#E31837", "#C4CED4"]
  ];

  // 2026 home kit: name, file slug, body, number, trim, nameplate.
  const NFL = [
    ["Arizona Cardinals", "cardinals", "#97233F", "#FFFFFF", "#000000", "#161616"],
    ["Atlanta Falcons", "falcons", "#A71930", "#FFFFFF", "#161616", "#161616"],
    ["Baltimore Ravens", "ravens", "#241773", "#FFFFFF", "#9E7C0C", "#9E7C0C"],
    ["Buffalo Bills", "bills", "#00338D", "#FFFFFF", "#C60C30", "#C60C30"],
    ["Carolina Panthers", "panthers", "#101820", "#FFFFFF", "#0085CA", "#B0B7BC"],
    ["Chicago Bears", "bears", "#0B162A", "#FFFFFF", "#C83803", "#C83803"],
    ["Cincinnati Bengals", "bengals", "#1A1A1A", "#FB4F14", "#FB4F14", "#FB4F14"],
    ["Cleveland Browns", "browns", "#3C2415", "#FFFFFF", "#FF3C00", "#FF3C00"],
    ["Dallas Cowboys", "cowboys", "#F4F4F4", "#041E42", "#869397", "#041E42"],
    ["Denver Broncos", "broncos", "#FB4F14", "#FFFFFF", "#002244", "#002244"],
    ["Detroit Lions", "lions", "#0076B6", "#FFFFFF", "#B0B7BC", "#B0B7BC"],
    ["Green Bay Packers", "packers", "#203731", "#FFFFFF", "#FFB612", "#FFB612"],
    ["Houston Texans", "texans", "#03202F", "#FFFFFF", "#A71930", "#A71930"],
    ["Indianapolis Colts", "colts", "#002C5F", "#FFFFFF", "#A2AAAD", "#A2AAAD"],
    ["Jacksonville Jaguars", "jaguars", "#101820", "#D7A22A", "#006778", "#D7A22A"],
    ["Kansas City Chiefs", "chiefs", "#E31837", "#FFFFFF", "#FFB81C", "#FFB81C"],
    ["Las Vegas Raiders", "raiders", "#1A1A1A", "#A5ACAF", "#A5ACAF", "#A5ACAF"],
    ["Los Angeles Chargers", "chargers", "#0073CF", "#FFFFFF", "#FFC20E", "#FFC20E"],
    ["Los Angeles Rams", "rams", "#003594", "#FFD100", "#FFD100", "#FFD100"],
    ["Miami Dolphins", "dolphins", "#008E97", "#FFFFFF", "#FC4C02", "#FC4C02"],
    ["Minnesota Vikings", "vikings", "#4F2683", "#FFFFFF", "#FFC62F", "#FFC62F"],
    ["New England Patriots", "patriots", "#002244", "#FFFFFF", "#C60C30", "#C60C30"],
    ["New Orleans Saints", "saints", "#C5B17A", "#101820", "#101820", "#101820"],
    ["New York Giants", "giants", "#0B2265", "#FFFFFF", "#A71930", "#A71930"],
    ["New York Jets", "jets", "#125740", "#FFFFFF", "#FFFFFF", "#FFFFFF"],
    ["Philadelphia Eagles", "eagles", "#004C54", "#FFFFFF", "#A5ACAF", "#A5ACAF"],
    ["Pittsburgh Steelers", "steelers", "#161616", "#FFB612", "#FFB612", "#FFB612"],
    ["San Francisco 49ers", "49ers", "#AA0000", "#FFFFFF", "#B3995D", "#B3995D"],
    ["Seattle Seahawks", "seahawks", "#002244", "#69BE28", "#69BE28", "#69BE28"],
    ["Tampa Bay Buccaneers", "buccaneers", "#D50A0A", "#FFFFFF", "#FF7900", "#34302B"],
    ["Tennessee Titans", "titans", "#4BA3E3", "#FFFFFF", "#C8102E", "#C8102E"],
    ["Washington Commanders", "commanders", "#5A1414", "#FFB612", "#FFB612", "#FFB612"]
  ];

  const EU_SOCCER = [
    {league: "Premier League", country: "England", teams: [
      ["Arsenal", "#EF0107", "#FFFFFF"],
      ["Manchester City", "#6CABDD", "#1C2C5B"],
      ["Liverpool", "#C8102E", "#00B2A9"],
      ["Chelsea", "#034694", "#DBA111", "./images/soccer/soccer-chelsea-back-with-club.png"],
      ["Manchester United", "#DA291C", "#FBE122"]
    ]},
    {league: "La Liga", country: "Spain", teams: [
      ["Real Madrid", "#FFFFFF", "#FEBE10"],
      ["Barcelona", "#A50044", "#004D98"],
      ["Atletico Madrid", "#CB3524", "#272E61"],
      ["Athletic Club", "#EE2523", "#FFFFFF"],
      ["Real Sociedad", "#0067B1", "#FFFFFF"]
    ]},
    {league: "Serie A", country: "Italy", teams: [
      ["Inter Milan", "#010E80", "#000000"],
      ["AC Milan", "#FB090B", "#000000"],
      ["Juventus", "#000000", "#FFFFFF"],
      ["Napoli", "#12A0D7", "#FFFFFF"],
      ["AS Roma", "#8E1F2F", "#F0BC42"]
    ]},
    {league: "Bundesliga", country: "Germany", teams: [
      ["Bayern Munich", "#DC052D", "#0066B2"],
      ["Borussia Dortmund", "#FDE100", "#000000"],
      ["RB Leipzig", "#DD0741", "#001F47"],
      ["Bayer Leverkusen", "#E32221", "#000000"],
      ["Eintracht Frankfurt", "#E1000F", "#000000"]
    ]},
    {league: "Ligue 1", country: "France", teams: [
      ["Paris Saint-Germain", "#004170", "#DA291C", "./images/soccer/soccer-psg-back-with-club.png"],
      ["AS Monaco", "#E30613", "#FFFFFF", "./images/soccer/soccer-monaco-back-with-club.png"],
      ["Olympique Marseille", "#2FAEE0", "#FFFFFF"],
      ["Olympique Lyonnais", "#003399", "#FFFFFF"],
      ["Lille", "#E01E26", "#FFFFFF", "./images/soccer/soccer-lille-back-with-club.png"]
    ]},
    {league: "Eredivisie", country: "Netherlands", teams: [
      ["Ajax", "#D2122E", "#FFFFFF"],
      ["PSV Eindhoven", "#ED1C24", "#FFFFFF"],
      ["Feyenoord", "#FF0000", "#FFFFFF"],
      ["AZ Alkmaar", "#ED1C24", "#FFFFFF"],
      ["FC Twente", "#E30613", "#FFFFFF"]
    ]},
    {league: "Primeira Liga", country: "Portugal", teams: [
      ["Benfica", "#E32636", "#FFFFFF"],
      ["FC Porto", "#003893", "#FFFFFF"],
      ["Sporting CP", "#008057", "#FFFFFF"],
      ["SC Braga", "#E30613", "#FFFFFF"],
      ["Vitoria Guimaraes", "#FFFFFF", "#000000"]
    ]},
    {league: "Belgian Pro League", country: "Belgium", teams: [
      ["Club Brugge", "#0055A5", "#000000"],
      ["Anderlecht", "#5A2D81", "#FFFFFF"],
      ["Union Saint-Gilloise", "#F6D800", "#1A1A1A"],
      ["Genk", "#0057B8", "#FFFFFF"],
      ["Antwerp", "#C8102E", "#FFFFFF"]
    ]},
    {league: "Scottish Premiership", country: "Scotland", teams: [
      ["Celtic", "#018749", "#FFFFFF"],
      ["Rangers", "#1B458F", "#FFFFFF"],
      ["Aberdeen", "#E30613", "#FFFFFF"],
      ["Hearts", "#8B0000", "#FFFFFF"],
      ["Hibernian", "#00843D", "#FFFFFF"]
    ]},
    {league: "Super Lig", country: "Turkey", teams: [
      ["Galatasaray", "#A90432", "#FDB912"],
      ["Fenerbahce", "#1E5AA8", "#FDB913"],
      ["Besiktas", "#000000", "#FFFFFF"],
      ["Trabzonspor", "#6CADDF", "#8B1A2B"],
      ["Basaksehir", "#F36C21", "#003A70"]
    ]}
  ];

  /** Legacy lowercase filenames already on disk (before slug casing). */
  const PHOTO_FILE_ALIASES = {
    Morocco: "soccer-morocco-back-with-country.png",
    Spain: "soccer-spain-back-with-country.png",
    Cameroon: "soccer-cameroon-back-with-country.png",
    Nigeria: "soccer-nigeria-back-with-country.png"
  };

  /** Named LED backs only (country/club wordmark in PNG). Restart with @jersey$ / $jersey@. */
  const PHOTO_READY = new Set([
    "Morocco", "Spain", "Cameroon", "Nigeria",
    "Egypt", "Ghana", "Senegal", "Ivory Coast", "South Africa", "Tunisia", "Kenya",
    "Mali", "Zambia", "Angola", "DR Congo", "Ethiopia", "Tanzania", "Mozambique", "Rwanda",
    "Russia", "Ukraine", "Germany"
  ]);

  function nationalPhotoUrl(teamName) {
    const alias = PHOTO_FILE_ALIASES[teamName];
    if (alias) return `./images/soccer/${alias}`;
    return `./images/soccer/soccer-${slug(teamName).toLowerCase()}-back-with-country.png`;
  }

  const NATIONAL_SOURCE = Array.isArray(global.FLOQR_NATIONAL_TEAMS) ? global.FLOQR_NATIONAL_TEAMS : [];
  const PHOTO_NATIONALS = NATIONAL_SOURCE.map(row => {
    const hasPhoto = PHOTO_READY.has(row.name);
    return {
      id: `soccer${slug(row.name)}`,
      teamName: row.name,
      league: "National teams",
      country: row.name,
      region: row.region || "",
      primary: row.primary,
      secondary: row.secondary,
      accent: row.accent,
      bgUrl: hasPhoto ? nationalPhotoUrl(row.name) : ""
    };
  });

  // Ensure legacy photo kits remain if national-teams-data.js failed to load.
  [
    {name: "Morocco", primary: "#C1272D", secondary: "#006233", region: "Africa"},
    {name: "Spain", primary: "#AA151B", secondary: "#F1BF00", region: "Europe"},
    {name: "Cameroon", primary: "#007A33", secondary: "#FCD116", accent: "#CE1126", region: "Africa"},
    {name: "Nigeria", primary: "#008751", secondary: "#FFFFFF", region: "Africa"}
  ].forEach(row => {
    const id = `soccer${slug(row.name)}`;
    if (PHOTO_NATIONALS.some(n => n.id === id)) return;
    PHOTO_NATIONALS.push({
      id,
      teamName: row.name,
      league: "National teams",
      country: row.name,
      region: row.region,
      primary: row.primary,
      secondary: row.secondary,
      accent: row.accent,
      bgUrl: nationalPhotoUrl(row.name)
    });
  });

  const soccerTeams = {};
  const nbaNflTemplates = {};
  const nbaNflIds = [];

  function addSoccerTeam(id, teamName, league, country, primary, secondary, bgUrl, extra = {}) {
    if (soccerTeams[id]) return;
    const europeLeagues = new Set([
      "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
      "Eredivisie", "Primeira Liga", "Belgian Pro League", "Scottish Premiership", "Super Lig"
    ]);
    soccerTeams[id] = jerseyTemplate({
      id,
      name: bgUrl ? `${teamName} Jersey` : `Soccer ${teamName}`,
      teamName,
      league,
      sport: "soccer",
      primary,
      secondary,
      accent: extra.accent || secondary || "#ffffff",
      bgUrl: bgUrl || "",
      extraTags: [
        "soccer",
        "jersey",
        "football",
        country,
        league,
        europeLeagues.has(league) ? "Europe" : "",
        league === "National teams" ? "National" : "",
        league === "National teams" ? "Country" : "Club",
        ...(extra.extraTags || [])
      ].filter(Boolean)
    });
  }

  function plateInk(hex) {
    const n = parseInt(String(hex || "").replace("#", ""), 16);
    if (!Number.isFinite(n)) return "#111111";
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return l > 0.62 ? "#111111" : "#FFFFFF";
  }

  // Approved Maryland tank output. The renderer reads this object; do not restyle basketball type in the page.
  // Sizes are fractions of the jersey image width. Tops are fractions of the image height.
  // The photo fabric, collar to hem, is an 80cm adult back.
  // The team word sits 3 cm higher on the 80 cm back (top 0.103). Each gap below the old 13.7% word was already tightened 30%
  // (name was 27.2%, number was 36.3%). That 30% tighten replaces the old 5cm floor.
  // Two-word places (LOS ANGELES, OKLAHOMA CITY) wrap to two lines at the regular word size.
  // Each line arches 25° from the left end to the right end.
  // A single word of 10 or more letters (TIMBERWOLVES) still uses the smaller size.
  const BASKETBALL_JERSEY_OUTPUT = {
    reference: "maryland-terps-2026",
    backCm: 80,
    word: { top: 0.103, liftCm: 4, size: 0.066, longSize: 0.052, longAt: 10, xlongSize: 0.042, xlongAt: 13, tracking: 0.08, longTracking: 0.02, arch: true, archDegrees: 25, wrapAtSpace: true, wrapLines: 2, wrapLineHeight: 0.58, maxChars: 16 },
    name: { top: 0.2315, size: 0.051, longSize: 0.04, longAt: 9, tracking: 0.14, longTracking: 0.04 },
    // Number height +20% vertical vs prior 0.414 / 0.3036 (s3.2.97).
    number: { one: 0.4968, two: 0.36432, top: 0.32355, style: "alumni-collegiate" }
  };

  function plateName(teamName) {
    if (/49ers/i.test(teamName)) return "49ERS";
    const parts = String(teamName || "").trim().split(/\s+/);
    return (parts[parts.length - 1] || teamName || "").toUpperCase();
  }

  function addNbaNfl(prefix, sport, league, teamName, primary, secondary, extraTags, bgUrl, extra) {
    const id = `${prefix}${slug(teamName)}`;
    if (nbaNflTemplates[id]) return;
    const more = extra || {};
    const row = jerseyTemplate({
      id,
      name: sport === "nba" && more.stateField ? teamName : `${sport.toUpperCase()} ${teamName}`,
      teamName,
      league,
      sport,
      primary,
      secondary,
      accent: more.accent || secondary,
      bgUrl: bgUrl || "",
      extraTags
    });
    if (more.plate) {
      row.jerseyPlateLabel = more.plate;
      row.jerseyTeamLabel = more.plate;
      row.jerseyOverlayWordmark = true;
      row.jerseyPlateInk = more.plateInk || plateInk(more.plateColor || secondary);
    }
    if (more.stateField) row.jerseyStateField = true;
    if (sport === "nba" && bgUrl) {
      row.jerseyOutput = BASKETBALL_JERSEY_OUTPUT;
      row.description += " Output: arch the upper word at the regular size; two-word places such as LOS ANGELES and OKLAHOMA CITY wrap onto two lines at that same size; a single word of 10+ letters such as TIMBERWOLVES uses the smaller arch; the number is 49.7% of the jersey width for one digit and 36.4% for two (+20% vertical), with its tip 5cm below the name. Numbers are collegiate varsity block numerals with open counters: team-color fill, contrasting outline, angular corners.";
    }
    nbaNflTemplates[id] = row;
    nbaNflIds.push(id);
  }

  EU_SOCCER.forEach(group => {
    group.teams.forEach(([name, p, s, bg]) => {
      addSoccerTeam(`soccer${slug(name)}`, name, group.league, group.country, p, s, bg || "");
    });
  });
  PHOTO_NATIONALS.forEach(row => {
    if (!row.bgUrl) return;
    addSoccerTeam(row.id, row.teamName, row.league, row.country, row.primary, row.secondary, row.bgUrl, {
      accent: row.accent,
      extraTags: [row.region, "National", row.region === "Oceania" ? "Australia" : ""].filter(Boolean)
    });
  });
  // Legacy photo Monaco id (catalog AS Monaco uses soccerASMonaco).
  if (soccerTeams.soccerASMonaco && !soccerTeams.soccerMonaco) {
    soccerTeams.soccerMonaco = {
      ...soccerTeams.soccerASMonaco,
      id: "soccerMonaco",
      name: "Soccer Monaco",
      defaultBackgroundUrl: "./images/soccer/soccer-monaco-back-with-club.png",
      jerseyCssBack: false
    };
  }

  NBA.forEach(([name, file, body, number, trim]) => addNbaNfl(
    "nba", "nba", "NBA", name, body, number,
    ["basketball", "NBA", "2026"],
    `./images/basketball/nba-${file}-back-with-club.png`,
    {accent: trim, plate: plateName(name), plateColor: number, plateInk: plateInk(number)}
  ));
  NFL.forEach(([name, file, body, number, trim, plate]) => addNbaNfl(
    "nfl", "nfl", "NFL", name, body, number,
    ["football", "American football", "NFL", "2026"],
    `./images/nfl/nfl-${file}-back-with-club.png`,
    {accent: trim, plate: plateName(name), plateColor: plate, plateInk: plateInk(plate)}
  ));
  addNbaNfl("nfl", "nfl", "NFL", "ScammerVille", "#004C54", "#B3995D", ["football", "American football", "NFL", "ScammerVille", "parody", "2026"], "./images/nfl/nfl-scammerville-back-with-club.png", {
    accent: "#B3995D", plate: "SCAMMERVILLE", plateColor: "#B3995D", plateInk: "#111111"
  });
  addNbaNfl("nba", "nba", "NCAA", "Maryland Terps", "#E21833", "#FFFFFF", ["basketball", "NCAA", "Maryland", "Terps", "2026"], "./images/basketball/maryland-terps-2026-back.jpg", {
    accent: "#FFD520", plate: "MARYLAND", plateColor: "#E21833", plateInk: "#FFFFFF", stateField: true
  });
  if (nbaNflTemplates.nbaMarylandTerps) {
    nbaNflTemplates.nbaMarylandTerps.description = "$30 Maryland Terps basketball jersey ShoutOut — 2026 LED back (96×48, 64×48, 64×32). State, name, and number are typed on the kit. Output: arch the state at the regular size; two-word places such as LOS ANGELES and OKLAHOMA CITY wrap onto two lines at that same size; a single word of 10+ letters uses the smaller arch; the number is 49.7% of the jersey width for one digit and 36.4% for two (+20% vertical), with its tip 5cm below the name. Numbers are collegiate varsity block numerals with open counters: team-color fill, contrasting outline, angular corners.";
  }
  // Promote photo NFL kits with dual-panel shoutout layout flags.
  Object.keys(nbaNflTemplates).forEach(id => {
    const row = nbaNflTemplates[id];
    if (!row || row.sport !== "nfl" || !row.defaultBackgroundUrl) return;
    row.nflDualLayout = true;
    row.nflShoutOut = true;
    row.layout = "nfl-jersey";
    row.description = `$30 ${row.teamName} NFL jersey ShoutOut — 2026 home LED back; 96×48 jersey+text, 64×48/64×32 rotating jersey↔text. Emotes OK.`;
  });

  function resolveSoccerTeam(teamId) {
    const id = String(teamId || "").trim();
    if (!id) return null;
    if (soccerTeams[id]) return soccerTeams[id];
    // Legacy: template id used as team id.
    if (/^soccer/i.test(id) && soccerTeams[id]) return soccerTeams[id];
    return null;
  }

  function soccerTeamOptions() {
    const byLeague = new Map();
    Object.values(soccerTeams).forEach(team => {
      const league = team.league || "Other";
      if (!byLeague.has(league)) byLeague.set(league, []);
      byLeague.get(league).push(team);
    });
    return Array.from(byLeague.entries()).map(([league, teams]) => ({
      league,
      teams: teams.slice().sort((a, b) => String(a.teamName || a.name).localeCompare(String(b.teamName || b.name)))
    })).sort((a, b) => a.league.localeCompare(b.league));
  }

  function findSoccerTeamsMatching(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return Object.values(soccerTeams).filter(team => {
      const hay = `${team.id} ${team.name} ${team.teamName} ${team.league} ${(team.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }

  global.FLOQR_SOCCER_TEMPLATE_ID = SOCCER_TEMPLATE_ID;
  global.FLOQR_SOCCER_TEAMS = soccerTeams;
  global.FLOQR_BASKETBALL_JERSEY_OUTPUT = BASKETBALL_JERSEY_OUTPUT;
  global.FLOQR_JERSEY_CATALOG = {...soccerTeams, ...nbaNflTemplates};
  global.FLOQR_JERSEY_TEMPLATE_IDS = nbaNflIds.slice();
  global.FLOQR_JERSEY_PHOTO_IDS = PHOTO_NATIONALS.filter(row => row.bgUrl).map(row => row.id).concat([
    "soccerChelsea", "soccerParisSaintGermain", "soccerMonaco", "soccerASMonaco", "soccerLille"
  ]).concat(Object.keys(nbaNflTemplates).filter(id => nbaNflTemplates[id] && nbaNflTemplates[id].defaultBackgroundUrl));
  global.FLOQRSoccerPhotoTeams = function soccerPhotoTeams() {
    const seen = new Set();
    return (global.FLOQR_JERSEY_PHOTO_IDS || []).map(id => soccerTeams[id]).filter(team => {
      if (!team || !team.defaultBackgroundUrl || seen.has(team.id)) return false;
      if (team.id === "soccerMonaco" && soccerTeams.soccerASMonaco) return false;
      seen.add(team.id);
      return true;
    });
  };
  global.FLOQR_ALL_JERSEY_TEMPLATE_IDS = Array.from(new Set([SOCCER_TEMPLATE_ID, ...nbaNflIds]));
  global.FLOQRResolveSoccerTeam = resolveSoccerTeam;
  global.FLOQRSoccerTeamOptions = soccerTeamOptions;
  global.FLOQRFindSoccerTeamsMatching = findSoccerTeamsMatching;

  function mergeIntoShoutOutTemplates() {
    const templates = global.SHOUTOUT_TEMPLATES || (global.SHOUTOUT_TEMPLATES = {});
    // NBA / NFL remain individual templates.
    Object.keys(nbaNflTemplates).forEach(id => {
      if (!templates[id]) templates[id] = nbaNflTemplates[id];
    });
    // Enrich consolidated soccer template with searchable team names.
    const soccer = templates[SOCCER_TEMPLATE_ID];
    if (soccer) {
      const teamNames = Object.values(soccerTeams).map(t => t.teamName || t.name).filter(Boolean);
      soccer.searchKeywords = Array.from(new Set([...(soccer.searchKeywords || []), ...teamNames, "jersey", "soccer", "football", "country", "club", "premier league", "la liga"]));
      soccer.tags = Array.from(new Set([...(soccer.tags || []), "Sports", "Jersey", "Soccer", "Country", "Club", "football", "$30", "2026/27", ...teamNames.slice(0, 40)]));
    }
    // Keep legacy soccer IDs as thin aliases → consolidated template + team id (for old links / HEIST).
    Object.keys(soccerTeams).forEach(id => {
      if (templates[id]) return;
      const team = soccerTeams[id];
      templates[id] = {
        ...team,
        aliasOf: SOCCER_TEMPLATE_ID,
        consolidatedTemplateId: SOCCER_TEMPLATE_ID,
        description: `${team.description} (Legacy team alias — patrons now pick this team inside Soccer Jersey.)`
      };
    });
    const std = global.SHOUTOUT_STANDARD_TEMPLATE_IDS || [];
    global.SHOUTOUT_STANDARD_TEMPLATE_IDS = Array.from(new Set([
      ...std.filter(id => !String(id).startsWith("soccer") || id === SOCCER_TEMPLATE_ID),
      SOCCER_TEMPLATE_ID,
      ...nbaNflIds
    ]));
  }

  global.FLOQRMergeJerseyTemplates = mergeIntoShoutOutTemplates;
  mergeIntoShoutOutTemplates();
})(window);
