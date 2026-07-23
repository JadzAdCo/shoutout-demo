/* FLOQR Sports Jersey templates — NBA, NFL, European soccer top-5 (2026/27). $30 each. */
(function (global) {
  "use strict";

  const SCREEN = ["led-64x32", "led-64x48", "led-96x48", "p125-64x32", "p125-64x48", "p125-96x48"];
  const PRICE = 3000;

  function slug(name) {
    return String(name || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .replace(/^[0-9]+/, "");
  }

  function jerseyTemplate({id, name, league, sport, primary, secondary, accent, bgUrl, extraTags}) {
    const classSport = sport === "nba" ? "nba-jersey" : sport === "nfl" ? "nfl-jersey" : "soccer-jersey";
    const tags = Array.from(new Set([
      "Sports", "Jersey", sport.toUpperCase(), league, name,
      "2026/27", "$30", "shared", "name", "number",
      ...(extraTags || [])
    ].filter(Boolean)));
    return {
      id,
      name,
      scope: "Shared",
      className: `sports-jersey ${classSport} jersey-css-back`,
      category: "Sports",
      mediaMode: "No image/video",
      supportsMedia: false,
      backgroundEditable: false,
      textOverlay: true,
      layout: "soccer-jersey",
      identityRail: true,
      jerseyCssBack: true,
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
      jerseyTeamLabel: String(name || "").toUpperCase(),
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

  /* Top 5 clubs per major European league country (2026/27 seed list). */
  const EU_SOCCER = [
    {league: "Premier League", country: "England", teams: [
      ["Arsenal", "#EF0107", "#FFFFFF"],
      ["Manchester City", "#6CABDD", "#1C2C5B"],
      ["Liverpool", "#C8102E", "#00B2A9"],
      ["Chelsea", "#034694", "#DBA111"],
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
      ["Paris Saint-Germain", "#004170", "#DA291C"],
      ["AS Monaco", "#E30613", "#FFFFFF"],
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

  const catalog = {};
  const ids = [];

  function add(prefix, sport, league, teamName, primary, secondary, extraTags) {
    const id = `${prefix}${slug(teamName)}`;
    if (catalog[id]) return;
    catalog[id] = jerseyTemplate({
      id,
      name: `${sport === "soccer" ? "Soccer" : sport.toUpperCase()} ${teamName}`,
      league,
      sport,
      primary,
      secondary,
      extraTags
    });
    ids.push(id);
  }

  NBA.forEach(([name, p, s]) => add("nba", "nba", "NBA", name, p, s, ["basketball", "NBA"]));
  NFL.forEach(([name, p, s]) => add("nfl", "nfl", "NFL", name, p, s, ["football", "American football", "NFL"]));
  EU_SOCCER.forEach(group => {
    group.teams.forEach(([name, p, s]) => {
      add("soccer", "soccer", group.league, name, p, s, ["soccer", "football", group.country, "Europe"]);
    });
  });

  /* Keep classic photo jersey IDs discoverable alongside CSS catalog. */
  const PHOTO_KEEP = ["soccerMorocco", "soccerSpain", "soccerChelsea", "soccerParisSaintGermain", "soccerMonaco"];

  global.FLOQR_JERSEY_CATALOG = catalog;
  global.FLOQR_JERSEY_TEMPLATE_IDS = ids.slice();
  global.FLOQR_JERSEY_PHOTO_IDS = PHOTO_KEEP.slice();
  global.FLOQR_ALL_JERSEY_TEMPLATE_IDS = Array.from(new Set([...PHOTO_KEEP, ...ids]));

  function mergeIntoShoutOutTemplates() {
    const templates = global.SHOUTOUT_TEMPLATES || (global.SHOUTOUT_TEMPLATES = {});
    Object.keys(catalog).forEach(id => {
      if (!templates[id]) templates[id] = catalog[id];
    });
    // Ensure photo jerseys carry Sports/Jersey tags
    PHOTO_KEEP.forEach(id => {
      const t = templates[id];
      if (!t) return;
      t.identityRail = true;
      t.tags = Array.from(new Set([...(t.tags || []), "Sports", "Jersey", "soccer", "$30", "2026/27"]));
      t.category = "Sports";
    });
    const std = global.SHOUTOUT_STANDARD_TEMPLATE_IDS || [];
    global.SHOUTOUT_STANDARD_TEMPLATE_IDS = Array.from(new Set([...std, ...global.FLOQR_ALL_JERSEY_TEMPLATE_IDS]));
  }

  global.FLOQRMergeJerseyTemplates = mergeIntoShoutOutTemplates;
  mergeIntoShoutOutTemplates();
})(window);
