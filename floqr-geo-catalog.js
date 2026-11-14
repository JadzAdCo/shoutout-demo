/* FLOQR static country / subdivision / calling-code catalog.
   In-page on purpose: these lists never change per request, so a Firestore
   round-trip would only add latency. Bind Profile, Search, and RydR from here. */
(function (global) {
  "use strict";

  const FEATURED_HEAD = ["US", "CA"];
  const FEATURED_MID = ["FR", "DE", "IT", "RU", "ES", "TR", "AE", "GB"];
  const SEPARATOR = "----";

  /* iso2|English name|ITU dial|nsMin|nsMax|trunkPrefix */
  const COUNTRY_ROWS = [
    "AD|Andorra|376|6|9|",
    "AE|United Arab Emirates|971|9|9|0",
    "AF|Afghanistan|93|9|9|0",
    "AG|Antigua and Barbuda|1|10|10|",
    "AL|Albania|355|8|9|0",
    "AM|Armenia|374|8|8|0",
    "AO|Angola|244|9|9|",
    "AR|Argentina|54|10|10|0",
    "AT|Austria|43|10|13|0",
    "AU|Australia|61|9|9|0",
    "AZ|Azerbaijan|994|9|9|0",
    "BA|Bosnia and Herzegovina|387|8|8|0",
    "BB|Barbados|1|10|10|",
    "BD|Bangladesh|880|10|10|0",
    "BE|Belgium|32|8|9|0",
    "BF|Burkina Faso|226|8|8|",
    "BG|Bulgaria|359|8|9|0",
    "BH|Bahrain|973|8|8|",
    "BI|Burundi|257|8|8|",
    "BJ|Benin|229|8|8|",
    "BN|Brunei|673|7|7|",
    "BO|Bolivia|591|8|8|0",
    "BR|Brazil|55|10|11|0",
    "BS|Bahamas|1|10|10|",
    "BT|Bhutan|975|8|8|",
    "BW|Botswana|267|8|8|",
    "BY|Belarus|375|9|9|0",
    "BZ|Belize|501|7|7|",
    "CA|Canada|1|10|10|",
    "CD|DR Congo|243|9|9|",
    "CF|Central African Republic|236|8|8|",
    "CG|Congo|242|9|9|",
    "CH|Switzerland|41|9|9|0",
    "CI|Ivory Coast|225|10|10|",
    "CL|Chile|56|9|9|0",
    "CM|Cameroon|237|9|9|",
    "CN|China|86|11|11|0",
    "CO|Colombia|57|10|10|0",
    "CR|Costa Rica|506|8|8|",
    "CU|Cuba|53|8|8|0",
    "CV|Cabo Verde|238|7|7|",
    "CY|Cyprus|357|8|8|",
    "CZ|Czechia|420|9|9|",
    "DE|Germany|49|10|11|0",
    "DJ|Djibouti|253|8|8|",
    "DK|Denmark|45|8|8|",
    "DM|Dominica|1|10|10|",
    "DO|Dominican Republic|1|10|10|",
    "DZ|Algeria|213|9|9|0",
    "EC|Ecuador|593|9|9|0",
    "EE|Estonia|372|7|8|",
    "EG|Egypt|20|10|10|0",
    "ER|Eritrea|291|7|7|",
    "ES|Spain|34|9|9|",
    "ET|Ethiopia|251|9|9|0",
    "FI|Finland|358|9|10|0",
    "FJ|Fiji|679|7|7|",
    "FR|France|33|9|9|0",
    "GA|Gabon|241|7|8|",
    "GB|United Kingdom|44|10|10|0",
    "GD|Grenada|1|10|10|",
    "GE|Georgia|995|9|9|0",
    "GH|Ghana|233|9|9|0",
    "GM|Gambia|220|7|7|",
    "GN|Guinea|224|9|9|",
    "GQ|Equatorial Guinea|240|9|9|",
    "GR|Greece|30|10|10|",
    "GT|Guatemala|502|8|8|",
    "GW|Guinea-Bissau|245|9|9|",
    "GY|Guyana|592|7|7|",
    "HK|Hong Kong|852|8|8|",
    "HN|Honduras|504|8|8|",
    "HR|Croatia|385|8|9|0",
    "HT|Haiti|509|8|8|",
    "HU|Hungary|36|8|9|",
    "ID|Indonesia|62|9|12|0",
    "IE|Ireland|353|9|9|0",
    "IL|Israel|972|9|9|0",
    "IN|India|91|10|10|0",
    "IQ|Iraq|964|10|10|0",
    "IR|Iran|98|10|10|0",
    "IS|Iceland|354|7|7|",
    "IT|Italy|39|9|10|",
    "JM|Jamaica|1|10|10|",
    "JO|Jordan|962|9|9|0",
    "JP|Japan|81|10|10|0",
    "KE|Kenya|254|9|9|0",
    "KG|Kyrgyzstan|996|9|9|0",
    "KH|Cambodia|855|8|9|0",
    "KI|Kiribati|686|8|8|",
    "KM|Comoros|269|7|7|",
    "KN|Saint Kitts and Nevis|1|10|10|",
    "KR|South Korea|82|9|10|0",
    "KW|Kuwait|965|8|8|",
    "KZ|Kazakhstan|7|10|10|8",
    "LA|Laos|856|8|10|0",
    "LB|Lebanon|961|7|8|0",
    "LC|Saint Lucia|1|10|10|",
    "LI|Liechtenstein|423|7|7|",
    "LK|Sri Lanka|94|9|9|0",
    "LR|Liberia|231|7|9|",
    "LS|Lesotho|266|8|8|",
    "LT|Lithuania|370|8|8|",
    "LU|Luxembourg|352|9|9|",
    "LV|Latvia|371|8|8|",
    "LY|Libya|218|9|9|0",
    "MA|Morocco|212|9|9|0",
    "MC|Monaco|377|8|9|",
    "MD|Moldova|373|8|8|0",
    "ME|Montenegro|382|8|8|0",
    "MG|Madagascar|261|9|10|0",
    "MH|Marshall Islands|692|7|7|",
    "MK|North Macedonia|389|8|8|0",
    "ML|Mali|223|8|8|",
    "MM|Myanmar|95|8|10|0",
    "MN|Mongolia|976|8|8|0",
    "MO|Macao|853|8|8|",
    "MR|Mauritania|222|8|8|",
    "MT|Malta|356|8|8|",
    "MU|Mauritius|230|8|8|",
    "MV|Maldives|960|7|7|",
    "MW|Malawi|265|9|9|",
    "MX|Mexico|52|10|10|",
    "MY|Malaysia|60|9|10|0",
    "MZ|Mozambique|258|9|9|",
    "NA|Namibia|264|9|9|0",
    "NE|Niger|227|8|8|",
    "NG|Nigeria|234|10|10|0",
    "NI|Nicaragua|505|8|8|",
    "NL|Netherlands|31|9|9|0",
    "NO|Norway|47|8|8|",
    "NP|Nepal|977|10|10|",
    "NR|Nauru|674|7|7|",
    "NZ|New Zealand|64|8|10|0",
    "OM|Oman|968|8|8|",
    "PA|Panama|507|8|8|",
    "PE|Peru|51|9|9|0",
    "PG|Papua New Guinea|675|8|8|",
    "PH|Philippines|63|10|10|0",
    "PK|Pakistan|92|10|10|0",
    "PL|Poland|48|9|9|",
    "PS|Palestine|970|9|9|0",
    "PT|Portugal|351|9|9|",
    "PY|Paraguay|595|9|9|0",
    "QA|Qatar|974|8|8|",
    "RO|Romania|40|9|9|0",
    "RS|Serbia|381|8|9|0",
    "RU|Russia|7|10|10|8",
    "RW|Rwanda|250|9|9|",
    "SA|Saudi Arabia|966|9|9|0",
    "SB|Solomon Islands|677|7|7|",
    "SC|Seychelles|248|7|7|",
    "SD|Sudan|249|9|9|0",
    "SE|Sweden|46|9|9|0",
    "SG|Singapore|65|8|8|",
    "SI|Slovenia|386|8|8|0",
    "SK|Slovakia|421|9|9|0",
    "SL|Sierra Leone|232|8|8|",
    "SM|San Marino|378|8|10|",
    "SN|Senegal|221|9|9|",
    "SO|Somalia|252|8|9|",
    "SR|Suriname|597|6|7|",
    "SS|South Sudan|211|9|9|",
    "ST|Sao Tome and Principe|239|7|7|",
    "SV|El Salvador|503|8|8|",
    "SY|Syria|963|9|9|0",
    "SZ|Eswatini|268|8|8|",
    "TD|Chad|235|8|8|",
    "TG|Togo|228|8|8|",
    "TH|Thailand|66|9|9|0",
    "TJ|Tajikistan|992|9|9|",
    "TL|Timor-Leste|670|8|8|",
    "TM|Turkmenistan|993|8|8|8",
    "TN|Tunisia|216|8|8|",
    "TO|Tonga|676|7|7|",
    "TR|Turkey|90|10|10|0",
    "TT|Trinidad and Tobago|1|10|10|",
    "TV|Tuvalu|688|5|6|",
    "TW|Taiwan|886|9|9|0",
    "TZ|Tanzania|255|9|9|0",
    "UA|Ukraine|380|9|9|0",
    "UG|Uganda|256|9|9|0",
    "US|United States|1|10|10|",
    "UY|Uruguay|598|8|8|0",
    "UZ|Uzbekistan|998|9|9|",
    "VA|Vatican City|379|10|10|",
    "VC|Saint Vincent and the Grenadines|1|10|10|",
    "VE|Venezuela|58|10|10|0",
    "VN|Vietnam|84|9|10|0",
    "VU|Vanuatu|678|7|7|",
    "WS|Samoa|685|5|7|",
    "XK|Kosovo|383|8|8|",
    "YE|Yemen|967|9|9|0",
    "ZA|South Africa|27|9|9|0",
    "ZM|Zambia|260|9|9|0",
    "ZW|Zimbabwe|263|9|9|0"
  ];

  const SUBDIVISIONS = {
    US: [
      ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
      ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
      ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
      ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
      ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
      ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
      ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
      ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
      ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
      ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
      ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
      ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
      ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]
    ],
    CA: [
      ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"],
      ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"],
      ["NT", "Northwest Territories"], ["NS", "Nova Scotia"], ["NU", "Nunavut"],
      ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
      ["SK", "Saskatchewan"], ["YT", "Yukon"]
    ],
    FR: [
      ["ARA", "Auvergne-Rhône-Alpes"], ["BFC", "Bourgogne-Franche-Comté"],
      ["BRE", "Brittany"], ["CVL", "Centre-Val de Loire"], ["COR", "Corsica"],
      ["GES", "Grand Est"], ["HDF", "Hauts-de-France"], ["IDF", "Île-de-France"],
      ["NOR", "Normandy"], ["NAQ", "Nouvelle-Aquitaine"], ["OCC", "Occitanie"],
      ["PDL", "Pays de la Loire"], ["PAC", "Provence-Alpes-Côte d'Azur"],
      ["GP", "Guadeloupe"], ["GF", "French Guiana"], ["MQ", "Martinique"],
      ["RE", "Réunion"], ["YT", "Mayotte"]
    ],
    GB: [
      ["ENG", "England"], ["SCT", "Scotland"], ["WLS", "Wales"], ["NIR", "Northern Ireland"]
    ],
    DE: [
      ["BW", "Baden-Württemberg"], ["BY", "Bavaria"], ["BE", "Berlin"],
      ["BB", "Brandenburg"], ["HB", "Bremen"], ["HH", "Hamburg"], ["HE", "Hesse"],
      ["MV", "Mecklenburg-Vorpommern"], ["NI", "Lower Saxony"], ["NW", "North Rhine-Westphalia"],
      ["RP", "Rhineland-Palatinate"], ["SL", "Saarland"], ["SN", "Saxony"],
      ["ST", "Saxony-Anhalt"], ["SH", "Schleswig-Holstein"], ["TH", "Thuringia"]
    ],
    ES: [
      ["AN", "Andalusia"], ["AR", "Aragon"], ["AS", "Asturias"], ["IB", "Balearic Islands"],
      ["PV", "Basque Country"], ["CN", "Canary Islands"], ["CB", "Cantabria"],
      ["CL", "Castile and León"], ["CM", "Castilla-La Mancha"], ["CT", "Catalonia"],
      ["CE", "Ceuta"], ["EX", "Extremadura"], ["GA", "Galicia"], ["RI", "La Rioja"],
      ["MD", "Community of Madrid"], ["ML", "Melilla"], ["MC", "Region of Murcia"],
      ["NC", "Navarre"], ["VC", "Valencian Community"]
    ],
    IT: [
      ["ABR", "Abruzzo"], ["BAS", "Basilicata"], ["CAL", "Calabria"], ["CAM", "Campania"],
      ["EMR", "Emilia-Romagna"], ["FVG", "Friuli-Venezia Giulia"], ["LAZ", "Lazio"],
      ["LIG", "Liguria"], ["LOM", "Lombardy"], ["MAR", "Marche"], ["MOL", "Molise"],
      ["PAB", "Bolzano"], ["PAT", "Trento"], ["PIE", "Piedmont"], ["PUG", "Apulia"],
      ["SAR", "Sardinia"], ["SIC", "Sicily"], ["TOS", "Tuscany"], ["UMB", "Umbria"],
      ["VDA", "Aosta Valley"], ["VEN", "Veneto"]
    ],
    AE: [
      ["AZ", "Abu Dhabi"], ["AJ", "Ajman"], ["DU", "Dubai"], ["FU", "Fujairah"],
      ["RK", "Ras Al Khaimah"], ["SH", "Sharjah"], ["UQ", "Umm Al Quwain"]
    ],
    TR: [
      ["01", "Adana"], ["02", "Adıyaman"], ["03", "Afyonkarahisar"], ["04", "Ağrı"],
      ["05", "Amasya"], ["06", "Ankara"], ["07", "Antalya"], ["08", "Artvin"],
      ["09", "Aydın"], ["10", "Balıkesir"], ["11", "Bilecik"], ["12", "Bingöl"],
      ["13", "Bitlis"], ["14", "Bolu"], ["15", "Burdur"], ["16", "Bursa"],
      ["17", "Çanakkale"], ["18", "Çankırı"], ["19", "Çorum"], ["20", "Denizli"],
      ["21", "Diyarbakır"], ["22", "Edirne"], ["23", "Elazığ"], ["24", "Erzincan"],
      ["25", "Erzurum"], ["26", "Eskişehir"], ["27", "Gaziantep"], ["28", "Giresun"],
      ["29", "Gümüşhane"], ["30", "Hakkâri"], ["31", "Hatay"], ["32", "Isparta"],
      ["33", "Mersin"], ["34", "Istanbul"], ["35", "İzmir"], ["36", "Kars"],
      ["37", "Kastamonu"], ["38", "Kayseri"], ["39", "Kırklareli"], ["40", "Kırşehir"],
      ["41", "Kocaeli"], ["42", "Konya"], ["43", "Kütahya"], ["44", "Malatya"],
      ["45", "Manisa"], ["46", "Kahramanmaraş"], ["47", "Mardin"], ["48", "Muğla"],
      ["49", "Muş"], ["50", "Nevşehir"], ["51", "Niğde"], ["52", "Ordu"],
      ["53", "Rize"], ["54", "Sakarya"], ["55", "Samsun"], ["56", "Siirt"],
      ["57", "Sinop"], ["58", "Sivas"], ["59", "Tekirdağ"], ["60", "Tokat"],
      ["61", "Trabzon"], ["62", "Tunceli"], ["63", "Şanlıurfa"], ["64", "Uşak"],
      ["65", "Van"], ["66", "Yozgat"], ["67", "Zonguldak"], ["68", "Aksaray"],
      ["69", "Bayburt"], ["70", "Karaman"], ["71", "Kırıkkale"], ["72", "Batman"],
      ["73", "Şırnak"], ["74", "Bartın"], ["75", "Ardahan"], ["76", "Iğdır"],
      ["77", "Yalova"], ["78", "Karabük"], ["79", "Kilis"], ["80", "Osmaniye"],
      ["81", "Düzce"]
    ],
    RU: [
      ["AD", "Adygea"], ["AL", "Altai Republic"], ["BA", "Bashkortostan"],
      ["BU", "Buryatia"], ["CE", "Chechnya"], ["CU", "Chuvashia"],
      ["DA", "Dagestan"], ["IN", "Ingushetia"], ["KB", "Kabardino-Balkaria"],
      ["KL", "Kalmykia"], ["KC", "Karachay-Cherkessia"], ["KR", "Karelia"],
      ["KK", "Khakassia"], ["KO", "Komi"], ["ME", "Mari El"], ["MO", "Mordovia"],
      ["SA", "Sakha (Yakutia)"], ["SE", "North Ossetia–Alania"], ["TA", "Tatarstan"],
      ["TY", "Tuva"], ["UD", "Udmurtia"], ["ALT", "Altai Krai"],
      ["KAM", "Kamchatka Krai"], ["KHA", "Khabarovsk Krai"], ["KDA", "Krasnodar Krai"],
      ["KYA", "Krasnoyarsk Krai"], ["PER", "Perm Krai"], ["PRI", "Primorsky Krai"],
      ["STA", "Stavropol Krai"], ["ZAB", "Zabaykalsky Krai"], ["AMU", "Amur Oblast"],
      ["ARK", "Arkhangelsk Oblast"], ["AST", "Astrakhan Oblast"], ["BEL", "Belgorod Oblast"],
      ["BRY", "Bryansk Oblast"], ["CHE", "Chelyabinsk Oblast"], ["IRK", "Irkutsk Oblast"],
      ["IVA", "Ivanovo Oblast"], ["KGD", "Kaliningrad Oblast"], ["KLU", "Kaluga Oblast"],
      ["KEM", "Kemerovo Oblast"], ["KIR", "Kirov Oblast"], ["KOS", "Kostroma Oblast"],
      ["KGN", "Kurgan Oblast"], ["KRS", "Kursk Oblast"], ["LEN", "Leningrad Oblast"],
      ["LIP", "Lipetsk Oblast"], ["MAG", "Magadan Oblast"], ["MOS", "Moscow Oblast"],
      ["MUR", "Murmansk Oblast"], ["NIZ", "Nizhny Novgorod Oblast"], ["NGR", "Novgorod Oblast"],
      ["NVS", "Novosibirsk Oblast"], ["OMS", "Omsk Oblast"], ["ORE", "Orenburg Oblast"],
      ["ORL", "Oryol Oblast"], ["PNZ", "Penza Oblast"], ["PSK", "Pskov Oblast"],
      ["ROS", "Rostov Oblast"], ["RYA", "Ryazan Oblast"], ["SAK", "Sakhalin Oblast"],
      ["SAM", "Samara Oblast"], ["SAR", "Saratov Oblast"], ["SMO", "Smolensk Oblast"],
      ["SVE", "Sverdlovsk Oblast"], ["TAM", "Tambov Oblast"], ["TOM", "Tomsk Oblast"],
      ["TUL", "Tula Oblast"], ["TVE", "Tver Oblast"], ["TYU", "Tyumen Oblast"],
      ["ULY", "Ulyanovsk Oblast"], ["VLA", "Vladimir Oblast"], ["VGG", "Volgograd Oblast"],
      ["VLG", "Vologda Oblast"], ["VOR", "Voronezh Oblast"], ["YAR", "Yaroslavl Oblast"],
      ["MOW", "Moscow"], ["SPE", "Saint Petersburg"], ["YEV", "Jewish Autonomous Oblast"],
      ["CHU", "Chukotka"], ["NEN", "Nenets"], ["KHM", "Khanty-Mansi"], ["YAN", "Yamalo-Nenets"]
    ]
  };

  const REGION_KIND = {
    US: "state",
    CA: "province",
    AE: "emirate",
    GB: "nation",
    FR: "region",
    DE: "state",
    ES: "region",
    IT: "region",
    TR: "province",
    RU: "region"
  };

  const countries = [];
  const byIso = Object.create(null);
  const byName = Object.create(null);
  const featuredSet = {};
  FEATURED_HEAD.concat(FEATURED_MID).forEach(code => { featuredSet[code] = true; });

  COUNTRY_ROWS.forEach(row => {
    const [iso2, name, dial, nsMin, nsMax, trunk] = row.split("|");
    const rec = {
      iso2,
      name,
      dial,
      nsMin: Number(nsMin),
      nsMax: Number(nsMax),
      trunk: trunk || ""
    };
    countries.push(rec);
    byIso[iso2] = rec;
    byName[name.toLowerCase()] = rec;
  });

  const ALIASES = {
    usa: "US", "u.s": "US", "u.s.": "US", "united states of america": "US", america: "US",
    uk: "GB", "great britain": "GB", britain: "GB", england: "GB",
    uae: "AE", dubai: "AE", "united arab emirates": "AE",
    deutschland: "DE", "russian federation": "RU", turkiye: "TR", "türkiye": "TR",
    "cote d'ivoire": "CI", "côte d'ivoire": "CI", czech: "CZ", "czech republic": "CZ",
    holland: "NL", "the netherlands": "NL", korea: "KR", "south korea": "KR",
    "hong kong sar": "HK", "macau": "MO", "viet nam": "VN"
  };

  function country(isoOrName) {
    const raw = String(isoOrName || "").trim();
    if (!raw) return null;
    const upper = raw.toUpperCase();
    if (byIso[upper]) return byIso[upper];
    const localeCode = global.FLOQRProfileLocale && typeof global.FLOQRProfileLocale.countryCodeOf === "function"
      ? String(global.FLOQRProfileLocale.countryCodeOf(raw) || "").toUpperCase()
      : "";
    if (localeCode && byIso[localeCode]) return byIso[localeCode];
    const alias = ALIASES[raw.toLowerCase().replace(/\./g, "")];
    if (alias && byIso[alias]) return byIso[alias];
    return byName[raw.toLowerCase()] || null;
  }

  function countryCodeOf(isoOrName) {
    return country(isoOrName)?.iso2 || "";
  }

  function countryNameOf(isoOrName) {
    return country(isoOrName)?.name || String(isoOrName || "").trim();
  }

  function dialOf(isoOrName) {
    return country(isoOrName)?.dial || "";
  }

  function subdivisionsOf(isoOrName) {
    const iso = countryCodeOf(isoOrName);
    return SUBDIVISIONS[iso] ? SUBDIVISIONS[iso].slice() : [];
  }

  function regionKindOf(isoOrName) {
    const iso = countryCodeOf(isoOrName);
    return REGION_KIND[iso] || (subdivisionsOf(iso).length ? "region" : "text");
  }

  function regionLabelKey(isoOrName) {
    const kind = regionKindOf(isoOrName);
    if (kind === "state") return "portal.field.state";
    if (kind === "province" || kind === "emirate") return "portal.field.province";
    return "portal.field.region";
  }

  function regionOf(isoOrName, codeOrName) {
    const list = subdivisionsOf(isoOrName);
    const raw = String(codeOrName || "").trim();
    if (!raw || !list.length) return null;
    const upper = raw.toUpperCase();
    const lower = raw.toLowerCase();
    return list.find(row => row[0].toUpperCase() === upper || row[1].toLowerCase() === lower) || null;
  }

  function featuredOrder() {
    return FEATURED_HEAD.concat(FEATURED_MID);
  }

  function restCountries() {
    return countries
      .filter(rec => !featuredSet[rec.iso2])
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function countryOptions() {
    const opts = [];
    FEATURED_HEAD.forEach(iso => opts.push(byIso[iso]));
    opts.push({ iso2: "", name: SEPARATOR, separator: true });
    FEATURED_MID.forEach(iso => opts.push(byIso[iso]));
    opts.push({ iso2: "", name: SEPARATOR, separator: true });
    restCountries().forEach(rec => opts.push(rec));
    return opts;
  }

  function fillCountrySelect(selectEl, selected) {
    if (!selectEl) return "";
    const selectedIso = countryCodeOf(selected);
    const t = (key, fallback) => {
      try { return global.FLOQRI18n?.t?.(key) || fallback; } catch (_) { return fallback; }
    };
    const html = [`<option value="">${escapeHtml(t("portal.field.selectCountry", "Select country"))}</option>`];
    countryOptions().forEach(rec => {
      if (rec.separator) {
        html.push(`<option value="" disabled>${SEPARATOR}</option>`);
        return;
      }
      const sel = rec.iso2 === selectedIso ? " selected" : "";
      html.push(`<option value="${rec.iso2}"${sel}>${escapeHtml(rec.name)}</option>`);
    });
    selectEl.innerHTML = html.join("");
    if (selectedIso) selectEl.value = selectedIso;
    return selectedIso;
  }

  function fillRegionSelect(selectEl, isoOrName, selected) {
    if (!selectEl) return "";
    const iso = countryCodeOf(isoOrName);
    const list = subdivisionsOf(iso);
    const t = (key, fallback) => {
      try { return global.FLOQRI18n?.t?.(key) || fallback; } catch (_) { return fallback; }
    };
    const kind = regionKindOf(iso);
    const placeholder = kind === "state"
      ? t("portal.field.selectState", "Select state")
      : t("portal.field.selectProvince", "Select province / region");
    if (!list.length) {
      selectEl.innerHTML = "";
      return "";
    }
    const match = regionOf(iso, selected);
    const html = [`<option value="">${escapeHtml(placeholder)}</option>`];
    list.forEach(row => {
      const sel = match && match[0] === row[0] ? " selected" : "";
      html.push(`<option value="${row[0]}"${sel}>${escapeHtml(row[1])}</option>`);
    });
    selectEl.innerHTML = html.join("");
    if (match) selectEl.value = match[0];
    return match ? match[0] : "";
  }

  function digitsOnly(raw) {
    return String(raw || "").replace(/\D/g, "");
  }

  function parsePhoneInput(raw, isoHint) {
    const text = String(raw || "").trim();
    if (!text) return { iso2: countryCodeOf(isoHint), national: "", e164: "", empty: true };
    let digits = digitsOnly(text);
    let iso = countryCodeOf(isoHint);
    if (text.startsWith("+") || digits.length > 11) {
      const hit = countries
        .slice()
        .sort((a, b) => b.dial.length - a.dial.length)
        .find(rec => digits.startsWith(rec.dial) && digits.length - rec.dial.length >= rec.nsMin);
      if (hit) {
        iso = hit.iso2;
        digits = digits.slice(hit.dial.length);
      }
    }
    const rec = country(iso);
    if (rec && (iso === "US" || iso === "CA" || rec.dial === "1") && digits.length === 11 && digits.startsWith("1")) {
      digits = digits.slice(1);
    }
    if (rec && rec.trunk && digits.startsWith(rec.trunk) && digits.length - rec.trunk.length >= rec.nsMin) {
      digits = digits.slice(rec.trunk.length);
    }
    return { iso2: iso, national: digits, e164: "", empty: !digits };
  }

  function toE164(isoOrName, nationalRaw) {
    const rec = country(isoOrName);
    if (!rec) return "";
    let digits = digitsOnly(nationalRaw);
    if (!digits) return "";
    if ((rec.iso2 === "US" || rec.iso2 === "CA") && digits.length === 11 && digits.startsWith("1")) {
      digits = digits.slice(1);
    }
    if (rec.trunk && digits.startsWith(rec.trunk) && digits.length > rec.nsMax) {
      digits = digits.slice(rec.trunk.length);
    }
    if (digits.startsWith(rec.dial) && digits.length - rec.dial.length >= rec.nsMin) {
      digits = digits.slice(rec.dial.length);
    }
    if (digits.length < rec.nsMin || digits.length > rec.nsMax) return "";
    if ((rec.iso2 === "US" || rec.iso2 === "CA") && (digits[0] === "0" || digits[0] === "1")) return "";
    return `+${rec.dial}${digits}`;
  }

  function nationalFromE164(e164, isoHint) {
    const parsed = parsePhoneInput(e164, isoHint);
    return parsed.national || "";
  }

  function formatNational(isoOrName, nationalRaw) {
    const rec = country(isoOrName);
    const digits = digitsOnly(nationalRaw);
    if (!rec || !digits) return digits;
    if (rec.iso2 === "US" || rec.iso2 === "CA") {
      const a = digits.slice(0, 3);
      const b = digits.slice(3, 6);
      const c = digits.slice(6, 10);
      if (digits.length <= 3) return a;
      if (digits.length <= 6) return `(${a}) ${b}`;
      return `(${a}) ${b}-${c}`;
    }
    return digits;
  }

  function validateMobile(isoOrName, nationalRaw, { required = false } = {}) {
    const rec = country(isoOrName);
    const digits = digitsOnly(nationalRaw);
    if (!digits) {
      return required
        ? { ok: false, empty: true, error: "Enter a valid mobile number for SMS and WhatsApp." }
        : { ok: true, empty: true, e164: "" };
    }
    if (!rec) {
      return { ok: false, empty: false, error: "Select a country so we can add the mobile country code." };
    }
    const e164 = toE164(rec.iso2, digits);
    if (!e164) {
      return {
        ok: false,
        empty: false,
        error: `Enter a valid ${rec.name} mobile number for SMS and WhatsApp.`
      };
    }
    return { ok: true, empty: false, e164, iso2: rec.iso2, dial: rec.dial };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyRegionLabel(labelEl, isoOrName) {
    if (!labelEl) return;
    const key = regionLabelKey(isoOrName);
    const fallback = key === "portal.field.state" ? "State" : key === "portal.field.province" ? "Province / Region" : "Region";
    let text = fallback;
    try { text = global.FLOQRI18n?.t?.(key) || fallback; } catch (_) { text = fallback; }
    labelEl.setAttribute("data-i18n", key);
    labelEl.textContent = text;
  }

  function bind(opts) {
    const countryEl = opts.countryEl;
    const regionEl = opts.regionEl;
    const regionWrap = opts.regionWrap;
    const regionLabelEl = opts.regionLabelEl;
    const regionTextEl = opts.regionTextEl;
    const dialEl = opts.dialEl;
    const nationalEl = opts.nationalEl;
    const hiddenEl = opts.hiddenEl;
    const onCountry = typeof opts.onCountry === "function" ? opts.onCountry : null;

    function selectedIso() {
      return countryCodeOf(countryEl && countryEl.value);
    }

    function syncRegionUi(selectedRegion) {
      const iso = selectedIso();
      const list = subdivisionsOf(iso);
      applyRegionLabel(regionLabelEl, iso);
      if (list.length) {
        if (regionWrap) regionWrap.hidden = false;
        if (regionEl) {
          regionEl.hidden = false;
          regionEl.required = false;
          fillRegionSelect(regionEl, iso, selectedRegion);
        }
        if (regionTextEl) {
          regionTextEl.hidden = true;
          regionTextEl.value = "";
        }
      } else {
        if (regionEl) {
          regionEl.innerHTML = "";
          regionEl.hidden = true;
        }
        if (regionTextEl) {
          regionTextEl.hidden = false;
          if (selectedRegion && !regionTextEl.value) regionTextEl.value = selectedRegion;
        }
        if (regionWrap) regionWrap.hidden = false;
      }
    }

    function syncDial() {
      const rec = country(selectedIso());
      if (dialEl) dialEl.textContent = rec ? `(+${rec.dial})` : "(+)";
    }

    function syncHidden() {
      if (!hiddenEl) return;
      const iso = selectedIso();
      const national = nationalEl ? nationalEl.value : "";
      hiddenEl.value = toE164(iso, national) || "";
    }

    function setCountry(value, { region, phone, silent } = {}) {
      fillCountrySelect(countryEl, value);
      syncDial();
      syncRegionUi(region || (regionEl && regionEl.value) || (regionTextEl && regionTextEl.value) || "");
      if (phone != null && nationalEl) {
        const parsed = parsePhoneInput(phone, selectedIso());
        nationalEl.value = formatNational(parsed.iso2 || selectedIso(), parsed.national);
      }
      syncHidden();
      if (!silent && onCountry) onCountry(selectedIso(), countryNameOf(selectedIso()));
    }

    fillCountrySelect(countryEl, opts.country || "");
    syncDial();
    syncRegionUi(opts.region || "");
    if (opts.phone && nationalEl) {
      const parsed = parsePhoneInput(opts.phone, selectedIso());
      nationalEl.value = formatNational(parsed.iso2 || selectedIso(), parsed.national);
    }
    syncHidden();

    countryEl?.addEventListener("change", () => {
      syncDial();
      syncRegionUi("");
      if (nationalEl && nationalEl.value) {
        nationalEl.value = formatNational(selectedIso(), nationalEl.value);
      }
      syncHidden();
      if (onCountry) onCountry(selectedIso(), countryNameOf(selectedIso()));
    });
    nationalEl?.addEventListener("input", () => {
      const iso = selectedIso();
      const parsed = parsePhoneInput(nationalEl.value, iso);
      const caretAtEnd = nationalEl.selectionStart === nationalEl.value.length;
      nationalEl.value = formatNational(iso, parsed.national);
      if (caretAtEnd) {
        try { nationalEl.setSelectionRange(nationalEl.value.length, nationalEl.value.length); } catch (_) {}
      }
      syncHidden();
    });
    regionEl?.addEventListener("change", syncHidden);

    return {
      countryCode: () => selectedIso(),
      countryName: () => countryNameOf(selectedIso()),
      regionCode: () => {
        if (subdivisionsOf(selectedIso()).length) return String(regionEl && regionEl.value || "").trim();
        return "";
      },
      regionName: () => {
        const iso = selectedIso();
        if (subdivisionsOf(iso).length) {
          const hit = regionOf(iso, regionEl && regionEl.value);
          return hit ? hit[1] : "";
        }
        return String(regionTextEl && regionTextEl.value || "").trim();
      },
      e164: () => toE164(selectedIso(), nationalEl && nationalEl.value),
      national: () => digitsOnly(nationalEl && nationalEl.value),
      validateMobile: (flags) => validateMobile(selectedIso(), nationalEl && nationalEl.value, flags),
      setCountry,
      syncHidden,
      fill: (profile) => {
        setCountry(profile?.countryCode || profile?.country || "", {
          region: profile?.regionCode || profile?.region || profile?.taxiRegion || "",
          phone: profile?.phone || "",
          silent: true
        });
      }
    };
  }

  const api = {
    FEATURED_HEAD,
    FEATURED_MID,
    SEPARATOR,
    countries,
    country,
    countryCodeOf,
    countryNameOf,
    dialOf,
    subdivisionsOf,
    regionKindOf,
    regionLabelKey,
    regionOf,
    featuredOrder,
    restCountries,
    countryOptions,
    fillCountrySelect,
    fillRegionSelect,
    parsePhoneInput,
    toE164,
    nationalFromE164,
    formatNational,
    validateMobile,
    bind
  };

  global.FLOQRGeoCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
