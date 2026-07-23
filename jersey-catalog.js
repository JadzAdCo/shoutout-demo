/* FLOQR Sports Jersey catalog — soccer teams (picker) + NBA/NFL templates. Soccer is one $30 template. */
(function (global) {
  "use strict";

  const SCREEN = ["led-64x32", "led-64x48", "led-96x48", "p125-64x32", "p125-64x48", "p125-96x48"];
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
    const tags = Array.from(new Set([
      "Sports", "Jersey", sport.toUpperCase(), league, name, teamName,
      "2026/27", "$30", "shared", "name", "number",
      ...(extraTags || [])
    ].filter(Boolean)));
    return {
      id,
      name,
      teamName: teamName || String(name || "").replace(/^(Soccer|NBA|NFL)\s+/i, "").trim(),
      scope: "Shared",
      className: `sports-jersey ${classSport} jersey-css-back`,
      category: "Sports",
      mediaMode: "No image/video",
      supportsMedia: false,
      backgroundEditable: false,
      textOverlay: true,
      layout: "soccer-jersey",
      identityRail: true,
      jerseyCssBack: !bgUrl,
      jerseyPrimary: primary || "#111111",
      jerseySecondary: secondary || "#ffffff",
      jerseyAccent: accent || secondary || "#ffffff",
      defaultBackgroundUrl: bgUrl || "",
      priceCents: PRICE,
      priceLabel: "$30",
      screenFormatIds: SCREEN.slice(),
      defaultMain: "",
      defaultSub: "",
      lineCount: 2,
      maxCharactersPerLine: 8,
      maxMainCharacters: 14,
      maxSubCharacters: 2,
      jerseyNameField: true,
      jerseyNumberField: true,
      jerseyNumberMaxChars: 2,
      jerseyTeamLabel: String(teamName || name || "").replace(/^(Soccer|NBA|NFL)\s+/i, "").toUpperCase(),
      season: "2026/27",
      sport,
      league,
      description: `Shared $30 ${name} jersey-back ShoutOut (${league}, 2026/27). Country/club crest in CAPS, player name (max 14, wraps), jersey mark up to 2 characters.`,
      tags
    };
  }

  const NBA = [
    ["Atlanta Hawks", "#C8102E", "#FDB927"],
    ["Boston Celtics", "#007A33", "#BA9653"],
    ["Brooklyn Nets", "#000000", "#FFFFFF"],
    ["Charlotte Hornets", "#1D1160", "#00788C"],
    ["Chicago Bulls", "#CE1141", "#000000"],
    ["Cleveland Cavaliers", "#860038", "#FDBB30"],
    ["Dallas Mavericks", "#00538C", "#B8C4CA"],
    ["Denver Nuggets", "#0E2240", "#FEC524"],
    ["Detroit Pistons", "#C8102E", "#1D42BA"],
    ["Golden State Warriors", "#1D428A", "#FFC72C"],
    ["Houston Rockets", "#CE1141", "#000000"],
    ["Indiana Pacers", "#002D62", "#FDBB30"],
    ["LA Clippers", "#C8102E", "#1D428A"],
    ["Los Angeles Lakers", "#552583", "#FDB927"],
    ["Memphis Grizzlies", "#5D76A9", "#12173F"],
    ["Miami Heat", "#98002E", "#F9A01B"],
    ["Milwaukee Bucks", "#00471B", "#EEE1C6"],
    ["Minnesota Timberwolves", "#0C2340", "#236192"],
    ["New Orleans Pelicans", "#0C2340", "#C8102E"],
    ["New York Knicks", "#006BB6", "#F58426"],
    ["Oklahoma City Thunder", "#007AC1", "#EF3B24"],
    ["Orlando Magic", "#0077C0", "#C4CED4"],
    ["Philadelphia 76ers", "#006BB6", "#ED174C"],
    ["Phoenix Suns", "#1D1160", "#E56020"],
    ["Portland Trail Blazers", "#E03A3E", "#000000"],
    ["Sacramento Kings", "#5A2D81", "#63727A"],
    ["San Antonio Spurs", "#C4CED4", "#000000"],
    ["Toronto Raptors", "#CE1141", "#000000"],
    ["Utah Jazz", "#002B5C", "#00471B"],
    ["Washington Wizards", "#002B5C", "#E31837"]
  ];

  const NFL = [
    ["Arizona Cardinals", "#97233F", "#000000"],
    ["Atlanta Falcons", "#A71930", "#000000"],
    ["Baltimore Ravens", "#241773", "#9E7C0C"],
    ["Buffalo Bills", "#00338D", "#C60C30"],
    ["Carolina Panthers", "#0085CA", "#101820"],
    ["Chicago Bears", "#0B162A", "#C83803"],
    ["Cincinnati Bengals", "#FB4F14", "#000000"],
    ["Cleveland Browns", "#311D00", "#FF3C00"],
    ["Dallas Cowboys", "#003594", "#869397"],
    ["Denver Broncos", "#FB4F14", "#002244"],
    ["Detroit Lions", "#0076B6", "#B0B7BC"],
    ["Green Bay Packers", "#203731", "#FFB612"],
    ["Houston Texans", "#03202F", "#A71930"],
    ["Indianapolis Colts", "#002C5F", "#A2AAAD"],
    ["Jacksonville Jaguars", "#101820", "#D7A22A"],
    ["Kansas City Chiefs", "#E31837", "#FFB81C"],
    ["Las Vegas Raiders", "#000000", "#A5ACAF"],
    ["Los Angeles Chargers", "#0080C6", "#FFC20E"],
    ["Los Angeles Rams", "#003594", "#FFA300"],
    ["Miami Dolphins", "#008E97", "#FC4C02"],
    ["Minnesota Vikings", "#4F2683", "#FFC62F"],
    ["New England Patriots", "#002244", "#C60C30"],
    ["New Orleans Saints", "#D3BC8D", "#101820"],
    ["New York Giants", "#0B2265", "#A71930"],
    ["New York Jets", "#125740", "#000000"],
    ["Philadelphia Eagles", "#004C54", "#A5ACAF"],
    ["Pittsburgh Steelers", "#FFB612", "#101820"],
    ["San Francisco 49ers", "#AA0000", "#B3995D"],
    ["Seattle Seahawks", "#002244", "#69BE28"],
    ["Tampa Bay Buccaneers", "#D50A0A", "#FF7900"],
    ["Tennessee Titans", "#0C2340", "#4B92DB"],
    ["Washington Commanders", "#5A1414", "#FFB612"]
  ];

  const EU_SOCCER = [
    {league: "Premier League", country: "England", teams: [
      ["Arsenal", "#EF0107", "#FFFFFF"],
      ["Manchester City", "#6CABDD", "#1C2C5B"],
      ["Liverpool", "#C8102E", "#00B2A9"],
      ["Chelsea", "#034694", "#DBA111", "./images/soccer/soccer-chelsea-back.png"],
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
      ["Paris Saint-Germain", "#004170", "#DA291C", "./images/soccer/soccer-psg-back.png"],
      ["AS Monaco", "#E30613", "#FFFFFF", "./images/soccer/soccer-monaco-back.png"],
      ["Olympique Marseille", "#2FAEE0", "#FFFFFF"],
      ["Olympique Lyonnais", "#003399", "#FFFFFF"],
      ["Lille", "#E01E26", "#FFFFFF"]
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

  const PHOTO_NATIONALS = [
    {id: "soccerMorocco", teamName: "Morocco", league: "National teams", country: "Morocco", primary: "#C1272D", secondary: "#006233", bgUrl: "./images/soccer/soccer-morocco-back.png"},
    {id: "soccerSpain", teamName: "Spain", league: "National teams", country: "Spain", primary: "#AA151B", secondary: "#F1BF00", bgUrl: "./images/soccer/soccer-spain-back.png"}
  ];

  const soccerTeams = {};
  const nbaNflTemplates = {};
  const nbaNflIds = [];

  function addSoccerTeam(id, teamName, league, country, primary, secondary, bgUrl) {
    if (soccerTeams[id]) return;
    soccerTeams[id] = jerseyTemplate({
      id,
      name: `Soccer ${teamName}`,
      teamName,
      league,
      sport: "soccer",
      primary,
      secondary,
      bgUrl: bgUrl || "",
      extraTags: ["soccer", "football", country, league, "Europe"].filter(Boolean)
    });
  }

  function addNbaNfl(prefix, sport, league, teamName, primary, secondary, extraTags) {
    const id = `${prefix}${slug(teamName)}`;
    if (nbaNflTemplates[id]) return;
    nbaNflTemplates[id] = jerseyTemplate({
      id,
      name: `${sport.toUpperCase()} ${teamName}`,
      teamName,
      league,
      sport,
      primary,
      secondary,
      extraTags
    });
    nbaNflIds.push(id);
  }

  EU_SOCCER.forEach(group => {
    group.teams.forEach(([name, p, s, bg]) => {
      addSoccerTeam(`soccer${slug(name)}`, name, group.league, group.country, p, s, bg || "");
    });
  });
  PHOTO_NATIONALS.forEach(row => {
    addSoccerTeam(row.id, row.teamName, row.league, row.country, row.primary, row.secondary, row.bgUrl);
  });
  // Legacy photo Monaco id (catalog AS Monaco uses soccerASMonaco).
  if (soccerTeams.soccerASMonaco && !soccerTeams.soccerMonaco) {
    soccerTeams.soccerMonaco = {
      ...soccerTeams.soccerASMonaco,
      id: "soccerMonaco",
      name: "Soccer Monaco",
      defaultBackgroundUrl: "./images/soccer/soccer-monaco-back.png",
      jerseyCssBack: false
    };
  }

  NBA.forEach(([name, p, s]) => addNbaNfl("nba", "nba", "NBA", name, p, s, ["basketball", "NBA"]));
  NFL.forEach(([name, p, s]) => addNbaNfl("nfl", "nfl", "NFL", name, p, s, ["football", "American football", "NFL"]));

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
  global.FLOQR_JERSEY_CATALOG = {...soccerTeams, ...nbaNflTemplates};
  global.FLOQR_JERSEY_TEMPLATE_IDS = nbaNflIds.slice();
  global.FLOQR_JERSEY_PHOTO_IDS = PHOTO_NATIONALS.map(row => row.id).concat(["soccerChelsea", "soccerParisSaintGermain", "soccerMonaco", "soccerASMonaco"]);
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
      soccer.searchKeywords = Array.from(new Set([...(soccer.searchKeywords || []), ...teamNames, "jersey", "soccer", "football", "premier league", "la liga"]));
      soccer.tags = Array.from(new Set([...(soccer.tags || []), "Sports", "Jersey", "soccer", "football", "$30", "2026/27", ...teamNames.slice(0, 40)]));
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
